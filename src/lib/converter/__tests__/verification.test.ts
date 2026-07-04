import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { convert } from '../index'

/**
 * Three-tier verification harness for the deterministic MATLAB→Python converter.
 * Corpus: tests/verification-corpus/<case>/{input.m, meta.json}, grounded in the
 * functions real users actually convert (production analytics).
 *
 *   Tier A — GOLDEN/SNAPSHOT (regression): convert(input.m) must equal the
 *            committed expected.py. Deterministic converter ⇒ any diff is a
 *            regression. Goldens are generated on first run, then asserted stable.
 *   Tier B — EXECUTABILITY: run the generated Python under numpy/scipy; it must
 *            exit cleanly and every probed output var must be present, non-empty,
 *            and finite (sane shape/type).
 *   Tier C — BEHAVIORAL CORRECTNESS: compare probed numeric outputs to
 *            hand-authored MATLAB-correct values within tolerance (the oracle —
 *            GNU Octave isn't installed). Cases with empty `expected` are n/a.
 *
 * Tier A always runs. Tiers B/C require a Python interpreter with numpy+scipy;
 * if none is found they are skipped (CI provisions it so they run there).
 *
 * This pass is MEASUREMENT — it does not modify converter logic. Tier A failures
 * are true regressions; Tier B/C failures are real converter bugs to triage.
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..', '..', '..')
const corpusDir = join(repoRoot, 'tests', 'verification-corpus')
const tmpDir = join(corpusDir, '.tmp')

interface Meta {
  id: string
  lang: string
  features: string[]
  probe: string[]
  expected: Record<string, { value?: number | number[] | string; tol?: number }>
}

interface CaseResult {
  id: string
  features: string[]
  tierA: 'PASS' | 'FAIL' | 'BOOTSTRAP'
  tierB: 'PASS' | 'FAIL' | 'SKIP'
  tierC: 'PASS' | 'FAIL' | 'N/A' | 'SKIP'
  notes: string[]
}

/** First interpreter on PATH that can import numpy + scipy, or null. */
function findPython(): string | null {
  for (const exe of ['python3', 'python']) {
    const r = spawnSync(exe, ['-c', 'import numpy, scipy'], { encoding: 'utf8' })
    if (r.status === 0) return exe
  }
  return null
}

const PY = findPython()

// Run code after the converter output to introspect named output variables. Kept
// separate so it never touches the committed golden — only the executed temp file.
function probeEpilogue(vars: string[]): string {
  const list = JSON.stringify(vars)
  return `

# === verification probe (harness-appended; not part of converter output) ===
import json as _vp_json
import numpy as _vp_np
def _vp_probe(_name, _g):
    if _name not in _g:
        return {"missing": True}
    try:
        _a = _vp_np.asarray(_g[_name])
        _kind = _a.dtype.kind
        _flat = _a.flatten().tolist()
        # Keep the probe JSON-safe: numerics/bools as-is, strings stringified,
        # everything else (complex from fft, Python type objects from class(), ...)
        # reduced to a string scalar so the probe never crashes the process — a
        # genuine exec failure must come from the CONVERTED code, not this harness.
        if _kind in "biuf":            # bool / int / uint / float
            _value = _flat if _a.size <= 64 else None
            _scalar = _flat[0] if _a.size == 1 else None
        elif _kind in "US":            # strings
            _value = [str(z) for z in _flat] if _a.size <= 64 else None
            _scalar = str(_flat[0]) if _a.size == 1 else None
        else:                          # complex / object / other — not directly comparable
            _value = None
            _scalar = (str(_flat[0]) if _a.size == 1 else None)
        return {
            "shape": list(_a.shape),
            "dtype": str(_a.dtype),
            "size": int(_a.size),
            "finite": (bool(_vp_np.all(_vp_np.isfinite(_a))) if _kind in "fc" else True),
            "value": _value,
            "scalar": _scalar,
        }
    except Exception as _e:
        return {"error": str(_e)[:120]}
_VP_G = dict(globals())
print("__PROBE__" + _vp_json.dumps({_n: _vp_probe(_n, _VP_G) for _n in ${list}}))
`
}

function num(x: unknown): number {
  if (typeof x === 'boolean') return x ? 1 : 0
  return Number(x)
}

/** Compare one probed var to its hand-authored expected. Returns null on pass,
 *  else a human-readable mismatch reason. */
function compareExpected(
  varName: string,
  exp: { value?: number | number[] | string; tol?: number },
  probe: any,
): string | null {
  if (!probe || probe.missing) return `${varName}: not defined in output`
  if (probe.error) return `${varName}: probe error (${probe.error})`
  const want = exp.value
  if (typeof want === 'string') {
    const got = probe.scalar != null ? String(probe.scalar) : (probe.value ? String(probe.value[0]) : '')
    return got === want ? null : `${varName}: expected "${want}", got "${got}"`
  }
  const wantArr = (Array.isArray(want) ? want : [want]).map(num)
  let gotArr: number[] | null = null
  if (probe.value != null) gotArr = probe.value.map(num)
  else if (probe.scalar != null) gotArr = [num(probe.scalar)]
  if (gotArr == null) return `${varName}: no numeric value to compare`
  if (gotArr.length !== wantArr.length) return `${varName}: length ${gotArr.length} != expected ${wantArr.length} (got [${gotArr.slice(0, 8)}])`
  const tol = exp.tol ?? 1e-9
  for (let i = 0; i < wantArr.length; i++) {
    if (Math.abs(gotArr[i] - wantArr[i]) > tol + 1e-9 * Math.abs(wantArr[i])) {
      return `${varName}[${i}]: expected ${wantArr[i]}, got ${gotArr[i]}`
    }
  }
  return null
}

function discoverCases(): { dir: string; meta: Meta }[] {
  if (!existsSync(corpusDir)) return []
  return readdirSync(corpusDir)
    .map((n) => join(corpusDir, n))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, 'input.m')) && existsSync(join(p, 'meta.json')))
    .sort()
    .map((dir) => ({ dir, meta: JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Meta }))
}

const cases = discoverCases()
const results = new Map<string, CaseResult>()

beforeAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })

  for (const { dir, meta } of cases) {
    const res: CaseResult = { id: meta.id, features: meta.features, tierA: 'PASS', tierB: 'SKIP', tierC: 'N/A', notes: [] }
    results.set(meta.id, res)

    const matlab = readFileSync(join(dir, 'input.m'), 'utf8')

    // --- Tier A: golden / snapshot ---
    let python = ''
    try {
      python = convert(matlab).python
    } catch (e) {
      res.tierA = 'FAIL'
      res.tierB = 'FAIL'
      res.tierC = Object.keys(meta.expected).length ? 'FAIL' : 'N/A'
      res.notes.push(`convert() threw: ${String((e as Error).message).slice(0, 100)}`)
      continue
    }
    const goldenPath = join(dir, 'expected.py')
    if (!existsSync(goldenPath)) {
      writeFileSync(goldenPath, python, 'utf8')
      res.tierA = 'BOOTSTRAP'
    } else if (readFileSync(goldenPath, 'utf8') !== python) {
      res.tierA = 'FAIL'
      res.notes.push('golden drift — output changed vs committed expected.py (regression)')
    }

    // --- Tier B/C: execute under numpy/scipy ---
    if (!PY) continue
    const hasExpected = Object.keys(meta.expected).length > 0
    res.tierB = 'FAIL'
    if (hasExpected) res.tierC = 'FAIL'

    const script = 'import os\nos.environ.setdefault("MPLBACKEND", "Agg")\n' + python + probeEpilogue(meta.probe)
    const pyFile = join(tmpDir, `${meta.id}.py`)
    writeFileSync(pyFile, script, 'utf8')
    const compatPath = join(repoRoot, 'packages', 'matlabtopython-compat', 'src')
    const run = spawnSync(PY, [pyFile], { encoding: 'utf8', timeout: 15000, env: { ...process.env, MPLBACKEND: 'Agg', PYTHONPATH: compatPath } })

    if (run.status !== 0) {
      const err = (run.stderr || '').trim().split('\n').filter(Boolean).pop() || run.signal || 'nonzero exit'
      res.notes.push(`exec failed: ${err}`.slice(0, 160))
      continue
    }

    // Parse the probe line.
    const line = (run.stdout || '').split('\n').find((l) => l.startsWith('__PROBE__'))
    let probe: Record<string, any> = {}
    if (line) {
      try { probe = JSON.parse(line.slice('__PROBE__'.length)) } catch { /* leave empty */ }
    }

    // Tier B: ran + every probe var present, non-empty, finite.
    const bProblems: string[] = []
    for (const v of meta.probe) {
      const p = probe[v]
      if (!p || p.missing) bProblems.push(`${v} undefined`)
      else if (p.error) bProblems.push(`${v} probe error`)
      else if (p.size < 1) bProblems.push(`${v} empty`)
      else if (p.finite === false) bProblems.push(`${v} non-finite`)
    }
    if (bProblems.length === 0) {
      res.tierB = 'PASS'
    } else {
      res.notes.push(`Tier B: ${bProblems.join('; ')}`)
    }

    // Tier C: numeric/string comparison against the hand-authored oracle.
    if (hasExpected) {
      const cProblems: string[] = []
      for (const [v, exp] of Object.entries(meta.expected)) {
        const r = compareExpected(v, exp, probe[v])
        if (r) cProblems.push(r)
      }
      if (cProblems.length === 0) res.tierC = 'PASS'
      else res.notes.push(`Tier C: ${cProblems.join('; ')}`)
    }
  }

  // Write the matrix report.
  writeFileSync(join(corpusDir, 'REPORT.md'), buildReport(), 'utf8')
}, 180_000) // 24 cases × a Python spawn each — well over the default 10s hook cap.

function mark(s: string): string {
  return { PASS: '✅', FAIL: '❌', BOOTSTRAP: '🌱', SKIP: '⏭️', 'N/A': '—' }[s] ?? s
}

function buildReport(): string {
  const L: string[] = []
  L.push('# MATLAB→Python verification matrix')
  L.push('')
  L.push(`_Generated by \`src/lib/converter/__tests__/verification.test.ts\`. Python: ${PY ?? 'NOT FOUND (Tiers B/C skipped)'}._`)
  L.push('')
  L.push('Tier A = golden/snapshot (regression) · Tier B = executes under numpy/scipy · Tier C = numeric vs hand-authored oracle.')
  L.push('')
  L.push('| Case | Features | A | B | C | Notes |')
  L.push('|------|----------|:-:|:-:|:-:|-------|')
  for (const { meta } of cases) {
    const r = results.get(meta.id)!
    L.push(`| ${meta.id} | ${meta.features.join(', ')} | ${mark(r.tierA)} | ${mark(r.tierB)} | ${mark(r.tierC)} | ${r.notes.join(' · ')} |`)
  }
  L.push('')
  const fails = [...results.values()].filter((r) => r.tierA === 'FAIL' || r.tierB === 'FAIL' || r.tierC === 'FAIL')
  L.push(`## Real failures (${fails.length})`)
  L.push('')
  if (fails.length === 0) L.push('_None._')
  for (const r of fails) L.push(`- **${r.id}** — ${r.notes.join(' · ')}`)
  L.push('')
  L.push('Legend: ✅ pass · ❌ fail · 🌱 golden bootstrapped (first run) · ⏭️ skipped (no Python) · — n/a')
  return L.join('\n') + '\n'
}

afterAll(() => {
  // Echo the matrix to the test log so a CI run surfaces it without opening files.
  process.stdout.write('\n' + buildReport() + '\n')
})

describe('MATLAB→Python verification harness', () => {
  it('corpus is discovered', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20)
  })

  for (const { meta } of cases) {
    describe(meta.id, () => {
      it('Tier A — golden stable (no regression)', () => {
        const r = results.get(meta.id)!
        if (r.tierA === 'FAIL') throw new Error(r.notes.join(' · '))
        expect(['PASS', 'BOOTSTRAP']).toContain(r.tierA)
      })

      it.skipIf(!PY)('Tier B — executes cleanly under numpy/scipy', () => {
        const r = results.get(meta.id)!
        if (r.tierB === 'FAIL') throw new Error(r.notes.find((n) => n.startsWith('Tier B') || n.startsWith('exec') || n.startsWith('convert')) ?? r.notes.join(' · '))
        expect(r.tierB).toBe('PASS')
      })

      const hasOracle = Object.keys(meta.expected).length > 0
      it.skipIf(!PY || !hasOracle)('Tier C — matches hand-authored numeric oracle', () => {
        const r = results.get(meta.id)!
        if (r.tierC === 'FAIL') throw new Error(r.notes.find((n) => n.startsWith('Tier C') || n.startsWith('exec') || n.startsWith('convert')) ?? r.notes.join(' · '))
        expect(['PASS', 'N/A']).toContain(r.tierC)
      })
    })
  }
})
