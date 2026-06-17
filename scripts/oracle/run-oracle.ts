/**
 * Execution oracle — raises the converter's bar from "compiles" to "runs".
 *
 * For each MATLAB input it converts to Python, then actually executes the
 * Python against the installed scientific stack (numpy/scipy/...). The current
 * corpus test only runs `py_compile` (syntax), which lets every *runtime* bug
 * (AttributeError, TypeError, IndexError) pass — this catches those.
 *
 * Two input sets:
 *   - smoke   : scripts/corpus/repos/**.m  (real cloned repos; breadth). Many
 *               are function-only or need data files, so failures are split into
 *               CONVERTER defects vs ENVIRONMENTAL noise (missing data / pip pkg).
 *   - curated : tests/oracle-cases/**.m    (self-contained; the trustworthy
 *               "USABLE" rate — these SHOULD run to completion).
 *
 * Usage:
 *   npx tsx scripts/oracle/run-oracle.ts --set curated
 *   npx tsx scripts/oracle/run-oracle.ts --set smoke --limit 300
 *   npx tsx scripts/oracle/run-oracle.ts --set smoke --gate 0       # CI: fail if any curated case regresses
 *
 * Requires python3 on PATH with numpy + scipy importable.
 * Writes scripts/oracle/output/{report.md,raw.json}.
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { convert } from '../../src/lib/converter/index'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const OUT = join(HERE, 'output')
const TMP = join(OUT, 'tmp')

// Failure classes that reflect the *environment*, not a conversion defect.
const ENVIRONMENTAL = new Set(['FileNotFoundError', 'ModuleNotFoundError', 'OSError'])

interface Result {
  rel: string
  status: 'RUNS' | 'CONVERT_THROW' | 'CONVERTER_FAIL' | 'ENV_FAIL'
  bucket: string // error class or 'ok'
  detail: string
}

function args(): { set: string; limit: number; offset: number } {
  const a = process.argv.slice(2)
  const get = (k: string, d: string) => {
    const i = a.indexOf(k)
    return i >= 0 && a[i + 1] ? a[i + 1] : d
  }
  return { set: get('--set', 'curated'), limit: Number(get('--limit', '0')), offset: Number(get('--offset', '0')) }
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, acc)
    else if (n.endsWith('.m')) acc.push(p)
  }
  return acc
}

const PREAMBLE = 'import os\nos.environ.setdefault("MPLBACKEND", "Agg")\n'

function lastErrorClass(stderr: string): string {
  const lines = stderr.trim().split('\n').filter(Boolean)
  const m = lines.pop() || ''
  const t = m.match(/^([A-Za-z_]*Error|Exception):/)?.[1]
  if (t) return t
  if (/Error/.test(m)) return m.split(':')[0].trim()
  return 'UnknownFail'
}

function run(set: string): Result[] {
  mkdirSync(TMP, { recursive: true })
  const root = set === 'smoke' ? join(REPO, 'scripts/corpus/repos') : join(REPO, 'tests/oracle-cases')
  const { limit, offset } = args()
  let files = walk(root).sort()
  if (limit > 0) files = files.slice(offset, offset + limit)

  const results: Result[] = []
  for (const f of files) {
    const rel = f.replace(root + '/', '')
    let py = ''
    try {
      py = convert(readFileSync(f, 'utf8')).python
    } catch (e) {
      results.push({ rel, status: 'CONVERT_THROW', bucket: 'ConvertThrow', detail: String((e as Error).message).slice(0, 120) })
      continue
    }
    const pyFile = join(TMP, 'case.py')
    writeFileSync(pyFile, PREAMBLE + py)
    const r = spawnSync('python3', [pyFile], { encoding: 'utf8', timeout: 8000, env: { ...process.env, MPLBACKEND: 'Agg' } })
    if (r.status === 0) {
      results.push({ rel, status: 'RUNS', bucket: 'ok', detail: '' })
      continue
    }
    const cls = r.signal === 'SIGTERM' ? 'Timeout' : lastErrorClass(r.stderr || '')
    const env = ENVIRONMENTAL.has(cls)
    results.push({
      rel,
      status: env ? 'ENV_FAIL' : 'CONVERTER_FAIL',
      bucket: cls,
      detail: (r.stderr || '').trim().split('\n').pop()?.slice(0, 140) || '',
    })
  }
  return results
}

function report(set: string, results: Result[]): string {
  const total = results.length
  const runs = results.filter(r => r.status === 'RUNS').length
  const envFail = results.filter(r => r.status === 'ENV_FAIL').length
  const defects = results.filter(r => r.status === 'CONVERTER_FAIL' || r.status === 'CONVERT_THROW')
  // Converter-attributable denominator excludes environmental failures.
  const attributable = total - envFail
  const rate = attributable > 0 ? Math.round((runs / attributable) * 100) : 100

  const buckets: Record<string, number> = {}
  for (const d of defects) buckets[d.bucket] = (buckets[d.bucket] || 0) + 1
  const ranked = Object.entries(buckets).sort((a, b) => b[1] - a[1])

  const L: string[] = []
  L.push(`# Execution oracle — ${set} set`)
  L.push('')
  L.push(`_Converts each .m, runs the Python, classifies the outcome. Generated by \`scripts/oracle/run-oracle.ts\`._`)
  L.push('')
  L.push(`- **Files:** ${total}`)
  L.push(`- **Runs clean:** ${runs}`)
  L.push(`- **Converter defects:** ${defects.length}`)
  L.push(`- **Environmental (missing data / pip pkg — not a defect):** ${envFail}`)
  L.push(`- **Converter-attributable runnable rate:** ${rate}%  (${runs}/${attributable})`)
  L.push('')
  L.push('## Defect buckets (ranked)')
  L.push('')
  L.push('| count | error class |')
  L.push('|------:|-------------|')
  for (const [k, v] of ranked) L.push(`| ${v} | \`${k}\` |`)
  L.push('')
  L.push('## Sample defects')
  L.push('')
  const seen: Record<string, number> = {}
  for (const d of defects) {
    seen[d.bucket] = (seen[d.bucket] || 0) + 1
    if (seen[d.bucket] <= 3) L.push(`- \`${d.bucket}\` — ${d.rel}: ${d.detail}`)
  }
  return L.join('\n') + '\n'
}

function main() {
  const { set } = args()
  const results = run(set)
  mkdirSync(OUT, { recursive: true })
  const md = report(set, results)
  writeFileSync(join(OUT, `report-${set}.md`), md)
  writeFileSync(join(OUT, `raw-${set}.json`), JSON.stringify(results, null, 2))
  process.stdout.write(md)

  // CI gate: on the curated set, fail if any case is a converter defect.
  if (set === 'curated' && process.argv.includes('--gate')) {
    const defects = results.filter(r => r.status === 'CONVERTER_FAIL' || r.status === 'CONVERT_THROW')
    if (defects.length > 0) {
      process.stderr.write(`\nGATE FAILED: ${defects.length} curated case(s) do not run.\n`)
      process.exit(1)
    }
  }
}

main()
