import { describe, it } from 'vitest'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, copyFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { convert } from '../index'

/**
 * Real-world corpus analyzer. Walks scripts/corpus/repos, converts every
 * .m file, runs Python's parser on the output, and emits a grouped
 * failure report at scripts/corpus/output/report.md. Gated behind
 * RUN_CORPUS=1 so it never runs during the normal test suite.
 *
 * Usage:
 *   RUN_CORPUS=1 npx vitest run src/lib/converter/__tests__/corpus-analysis.test.ts
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..', '..', '..')
const corpusRoot = join(repoRoot, 'scripts', 'corpus', 'repos')
const outDir = join(repoRoot, 'scripts', 'corpus', 'output')

const runCorpus = process.env.RUN_CORPUS === '1'

describe.skipIf(!runCorpus)('corpus analysis', () => {
  it('classifies failures across the real-world corpus', { timeout: 600_000 }, () => {
    // Snapshot the previous run's results so `npm run corpus:diff` can
    // show what changed (newly-passing / newly-failing files).
    const rawPath = join(outDir, 'raw.json')
    const prevPath = join(outDir, 'raw_prev.json')
    if (existsSync(rawPath)) copyFileSync(rawPath, prevPath)
    // Clear only the tmp `_check_*.py` files so the snapshot survives.
    if (existsSync(outDir)) {
      for (const f of readdirSync(outDir)) {
        if (f.startsWith('_check_')) {
          try { rmSync(join(outDir, f)) } catch { /* ignore */ }
        }
      }
    } else {
      mkdirSync(outDir, { recursive: true })
    }

    const files = walkMatlabFiles(corpusRoot)
    const results: FileResult[] = []

    for (const abs of files) {
      const rel = relative(corpusRoot, abs)
      const matlab = safeRead(abs)
      if (matlab === null) continue
      // Skip files that are obviously too big to be representative
      if (matlab.length > 200_000) continue

      let python = ''
      let flagCount = 0
      let flagDetails: Array<{ type: string; message: string }> = []
      let convertError: string | null = null
      try {
        const r = convert(matlab)
        python = r.python
        flagCount = r.report.flags.length
        // Keep just type + message; drop line numbers and originalCode so the
        // resulting JSON file stays small and the flag-frequency analyzer can
        // group by message text.
        flagDetails = r.report.flags.map((f) => ({ type: f.type, message: f.message }))
      } catch (err) {
        convertError = (err as Error).message
      }

      if (convertError) {
        results.push({ rel, status: 'CONVERT_THREW', error: convertError, snippet: '', flagCount: 0 })
        continue
      }

      const check = runPyCompile(python)
      if (check.ok) {
        results.push({ rel, status: 'PASS', error: '', snippet: '', flagCount, flags: flagDetails })
      } else {
        results.push({
          rel,
          status: 'PY_COMPILE_FAIL',
          error: check.error,
          snippet: check.snippet,
          flagCount,
          flags: flagDetails,
        })
      }
    }

    const report = buildReport(results)
    writeFileSync(join(outDir, 'report.md'), report)
    writeFileSync(join(outDir, 'raw.json'), JSON.stringify(results, null, 2))

    // Log a two-line summary: syntax pass rate + clean (zero-flag) rate.
    // The clean rate is the more honest "needs no review" metric — a file
    // that py_compile accepts but emits flags still requires the user
    // to look at the converter's warnings.
    const pass = results.filter(r => r.status === 'PASS').length
    const clean = results.filter(r => r.status === 'PASS' && r.flagCount === 0).length
    console.log(`\nCorpus: ${pass}/${results.length} pass py_compile (${pct(pass, results.length)})`)
    console.log(`Clean:  ${clean}/${results.length} pass with zero flags (${pct(clean, results.length)})`)
  })
})

// ── helpers ───────────────────────────────────────────────

type FileResult = {
  rel: string
  status: 'PASS' | 'PY_COMPILE_FAIL' | 'CONVERT_THREW'
  error: string
  snippet: string
  flagCount: number
  flags?: Array<{ type: string; message: string }>
}

function walkMatlabFiles(root: string): string[] {
  const out: string[] = []
  function walk(dir: string) {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const name of entries) {
      const p = join(dir, name)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) {
        // Skip tests dirs — they have MATLAB-the-test-runner syntax that's
        // not representative of the code we want to convert.
        if (/^(test|tests|unit_tests|examples?)$/i.test(name)) continue
        if (name === '.git') continue
        walk(p)
      } else if (st.isFile() && name.endsWith('.m')) {
        out.push(p)
      }
    }
  }
  walk(root)
  return out
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function runPyCompile(python: string): { ok: true } | { ok: false; error: string; snippet: string } {
  // Write to a temp file to run py_compile against
  const tmpFile = join(outDir, `_check_${Math.random().toString(36).slice(2)}.py`)
  writeFileSync(tmpFile, python)
  const r = spawnSync('python', ['-m', 'py_compile', tmpFile], { encoding: 'utf8' })
  try { rmSync(tmpFile) } catch { /* ignore */ }
  if (r.status === 0) return { ok: true }
  const errText = (r.stderr || r.stdout || '').trim()
  // Extract error type (SyntaxError / IndentationError / etc.) and a snippet
  const match = errText.match(/^(?:.*?\n)*(\w*Error): (.+)$/m)
  const error = match ? `${match[1]}: ${match[2]}` : errText.slice(0, 120)
  // Snippet: the `^`-pointed line in the traceback
  const snippetMatch = errText.match(/\n {4}([^\n]+)\n {4}\^/)
  const snippet = snippetMatch ? snippetMatch[1].trim() : ''
  return { ok: false, error, snippet }
}

function buildReport(results: FileResult[]): string {
  const total = results.length
  const pass = results.filter(r => r.status === 'PASS').length
  const clean = results.filter(r => r.status === 'PASS' && r.flagCount === 0).length
  const passWithFlags = pass - clean
  const convertThrew = results.filter(r => r.status === 'CONVERT_THREW').length
  const pyFail = results.filter(r => r.status === 'PY_COMPILE_FAIL').length

  // Group failures by error signature
  const groups = new Map<string, FileResult[]>()
  for (const r of results) {
    if (r.status === 'PASS') continue
    const key = normalizeErrorKey(r.error)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const sortedGroups = Array.from(groups.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  )

  const lines: string[] = []
  lines.push('# Corpus Analysis Report')
  lines.push('')
  lines.push(`Total files analyzed: **${total}**`)
  lines.push(`- **Clean** (py_compile passes, zero flags): **${clean}** (${pct(clean, total)})`)
  lines.push(`- PASS with flags (needs human review): ${passWithFlags} (${pct(passWithFlags, total)})`)
  lines.push(`- py_compile fail: ${pyFail} (${pct(pyFail, total)})`)
  lines.push(`- converter threw: ${convertThrew} (${pct(convertThrew, total)})`)
  lines.push('')
  // Top flagged files — useful when triaging "what does the converter
  // know it can't do?" since these are exactly the places the converter
  // already admits uncertainty.
  const flaggedPasses = results
    .filter(r => r.status === 'PASS' && r.flagCount > 0)
    .sort((a, b) => b.flagCount - a.flagCount)
  if (flaggedPasses.length > 0) {
    lines.push('## Top flagged files (highest review effort)')
    lines.push('')
    for (const r of flaggedPasses.slice(0, 10)) {
      lines.push(`- ${r.flagCount} flags — \`${r.rel}\``)
    }
    lines.push('')
  }
  lines.push('## Failure patterns (grouped by error signature)')
  lines.push('')

  let rank = 1
  for (const [key, items] of sortedGroups) {
    lines.push(`### ${rank}. ${key}  —  ${items.length} files`)
    lines.push('')
    // Show up to 5 example files with offending snippet
    const examples = items.slice(0, 5)
    for (const ex of examples) {
      const snip = ex.snippet ? `  \`${truncate(ex.snippet, 80)}\`` : ''
      lines.push(`- \`${ex.rel}\`${snip}`)
    }
    if (items.length > examples.length) {
      lines.push(`- ...and ${items.length - examples.length} more`)
    }
    lines.push('')
    rank++
    if (rank > 25) break
  }

  return lines.join('\n') + '\n'
}

function normalizeErrorKey(error: string): string {
  // Collapse positional details so files with the same root cause group together
  return error
    .replace(/line \d+/g, 'line N')
    .replace(/\(.+?, line \d+\)/g, '')
    .replace(/at position \d+/g, '')
    .trim()
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%'
  return `${((num / denom) * 100).toFixed(1)}%`
}
