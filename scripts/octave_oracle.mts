/**
 * Octave numeric oracle — the real silent-wrong detector.
 *
 * For each MATLAB *script* (function files are skipped — they need args):
 *   1. run the original .m in Octave, dump numeric workspace vars to JSON
 *   2. convert the .m, run the Python, dump the same vars to JSON
 *   3. diff by variable name within tolerance
 *
 * MATCH = converter is numerically correct. MISMATCH = SILENT-WRONG (the class
 * py_compile, runtime-exec, and the flag system all miss). PY_CRASH = a crash
 * bug. OCTAVE_ERR = the original itself failed (environmental, excluded).
 *
 *   OCTAVE_BIN=octave npx tsx scripts/octave_oracle.mts [globOrDir]
 *   CORPUS_SAMPLE=150 npx tsx scripts/octave_oracle.mts   # also sample corpus scripts
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { convert } from '../src/lib/converter/index'

const OCTAVE = process.env.OCTAVE_BIN || 'octave'
const root = process.cwd()
const RTOL = 1e-6, ATOL = 1e-9

const OCT_PROLOGUE = `try; pkg load signal; catch; end
try; pkg load statistics; catch; end
`
const OCT_DUMP = `
__names = who();
__o = struct();
for __i = 1:numel(__names)
  __n = __names{__i};
  if length(__n) >= 2 && strcmp(__n(1:2), '__'); continue; end
  __v = eval(__n);
  if (isnumeric(__v) || islogical(__v)) && isreal(__v) && numel(__v) >= 1 && numel(__v) <= 10000 && all(isfinite(double(__v)(:)))
    __o.(__n) = reshape(double(__v).', 1, []);  % row-major flatten to match numpy
  end
end
__fp = fopen(getenv('ORACLE_OUT'), 'w'); fwrite(__fp, jsonencode(__o)); fclose(__fp);
`
const PY_DUMP = `
import json as _j, os as _os, math as _m
try:
    import numpy as _np
except Exception:
    _np = None
def _fin(xs):
    return [float(x) for x in xs] if all(_m.isfinite(x) for x in xs) else None
_o = {}
for _k, _v in list(globals().items()):
    if _k.startswith('_'): continue
    try:
        if isinstance(_v, bool): _o[_k] = [float(_v)]
        elif isinstance(_v, (int, float)): _o[_k] = _fin([_v])
        elif _np is not None and isinstance(_v, _np.generic):
            if _np.iscomplexobj(_v): continue
            _o[_k] = _fin([float(_v)])
        elif _np is not None and isinstance(_v, _np.ndarray):
            if _np.iscomplexobj(_v) or _v.size < 1: continue
            _o[_k] = _fin([float(x) for x in _v.astype(float).flatten()])
        elif isinstance(_v, (list, tuple)) and len(_v) >= 1 and all(isinstance(x,(int,float,bool)) for x in _v): _o[_k] = _fin([float(x) for x in _v])
        else: continue
        if _o.get(_k) is None: _o.pop(_k, None)
    except Exception: _o.pop(_k, None)
open(_os.environ['ORACLE_OUT'], 'w').write(_j.dumps(_o))
`

function firstCodeLine(src: string): string {
  for (const raw of src.split('\n')) {
    const l = raw.trim()
    if (l === '' || l.startsWith('%') || l.startsWith('#')) continue
    return l
  }
  return ''
}
const isFunctionFile = (src: string) => /^\s*function\b/.test(firstCodeLine(src))

function flat(v: unknown): number[] {
  if (typeof v === 'number') return [v]
  if (typeof v === 'boolean') return [v ? 1 : 0]
  if (Array.isArray(v)) return v.flatMap(flat)
  return []
}
function closeEnough(a: number[], b: number[]): boolean {
  if (a.length !== b.length || a.length === 0) return false
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > ATOL + RTOL * Math.abs(b[i])) return false
  }
  return true
}

interface Input { name: string; src: string }
function collectInputs(): Input[] {
  const out: Input[] = []
  const vcDir = join(root, 'tests', 'verification-corpus')
  if (existsSync(vcDir)) {
    for (const d of readdirSync(vcDir)) {
      const p = join(vcDir, d, 'input.m')
      if (existsSync(p)) out.push({ name: `vc/${d}`, src: readFileSync(p, 'utf8') })
    }
  }
  const sample = Number(process.env.CORPUS_SAMPLE || 0)
  if (sample > 0) {
    const rawPath = join(root, 'scripts', 'corpus', 'output', 'raw.json')
    if (existsSync(rawPath)) {
      const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
      const rows: Array<{ rel: string; status: string }> = Array.isArray(raw) ? raw : raw.results || []
      const scripts = rows.filter(r => r.status === 'PASS').map(r => r.rel).filter(rel => {
        try { return !isFunctionFile(readFileSync(join(root, 'scripts', 'corpus', 'repos', rel.replace(/\\/g, '/')), 'utf8')) } catch { return false }
      })
      for (const rel of scripts.slice(0, sample)) {
        out.push({ name: rel, src: readFileSync(join(root, 'scripts', 'corpus', 'repos', rel.replace(/\\/g, '/')), 'utf8') })
      }
    }
  }
  return out
}

const work = mkdtempSync(join(tmpdir(), 'oracle-'))
const inputs = collectInputs()
const buckets: Record<string, number> = {}
const mismatches: string[] = []
let compared = 0, match = 0

for (const inp of inputs) {
  if (isFunctionFile(inp.src)) { buckets['SKIP (function file)'] = (buckets['SKIP (function file)'] || 0) + 1; continue }
  if (/\brand[ni]?\s*\(/.test(inp.src)) { buckets['SKIP (nondeterministic rand)'] = (buckets['SKIP (nondeterministic rand)'] || 0) + 1; continue }

  // Octave
  const octOut = join(work, 'oct.json')
  const mFile = join(work, 'run.m')
  writeFileSync(mFile, OCT_PROLOGUE + inp.src + '\n' + OCT_DUMP)
  const oct = spawnSync(OCTAVE, ['--no-gui', '--norc', '--quiet', mFile], {
    cwd: work, encoding: 'utf8', timeout: 20000, env: { ...process.env, ORACLE_OUT: octOut },
  })
  if (oct.status !== 0 || !existsSync(octOut)) { buckets['OCTAVE_ERR (env/incompat)'] = (buckets['OCTAVE_ERR (env/incompat)'] || 0) + 1; continue }

  // Python (converted)
  let py: string
  try { py = convert(inp.src).python } catch { buckets['convert() threw'] = (buckets['convert() threw'] || 0) + 1; continue }
  const pyOut = join(work, 'py.json')
  const pyFile = join(work, 'run.py')
  writeFileSync(pyFile, py + '\n' + PY_DUMP)
  const pr = spawnSync('python', [pyFile], { cwd: work, encoding: 'utf8', timeout: 20000, env: { ...process.env, ORACLE_OUT: pyOut, MPLBACKEND: 'Agg' } })
  if (pr.status !== 0 || !existsSync(pyOut)) { buckets['PY_CRASH (converter)'] = (buckets['PY_CRASH (converter)'] || 0) + 1; continue }

  const o = JSON.parse(readFileSync(octOut, 'utf8')) as Record<string, unknown>
  const p = JSON.parse(readFileSync(pyOut, 'utf8')) as Record<string, unknown>
  const shared = Object.keys(o).filter(k => k in p)
  if (shared.length === 0) { buckets['INCONCLUSIVE (no shared vars)'] = (buckets['INCONCLUSIVE (no shared vars)'] || 0) + 1; continue }

  compared++
  const bad = shared.filter(k => !closeEnough(flat(p[k]), flat(o[k])))
  if (bad.length === 0) { match++; buckets['MATCH ✅'] = (buckets['MATCH ✅'] || 0) + 1 }
  else { buckets['MISMATCH ☠ (SILENT-WRONG)'] = (buckets['MISMATCH ☠ (SILENT-WRONG)'] || 0) + 1; mismatches.push(`${inp.name}  vars: ${bad.join(', ')}`) }
}
rmSync(work, { recursive: true, force: true })

const lines: string[] = []
lines.push(`\n=== OCTAVE NUMERIC ORACLE — ${inputs.length} inputs ===`)
for (const [b, n] of Object.entries(buckets).sort((a, c) => c[1] - a[1])) lines.push(`${String(n).padStart(4)}  ${b}`)
lines.push(`\nNumerically comparable: ${compared}`)
lines.push(`  MATCH (correct):        ${match} (${compared ? ((100 * match) / compared).toFixed(1) : '0'}%)`)
lines.push(`  MISMATCH (SILENT-WRONG): ${compared - match} (${compared ? ((100 * (compared - match)) / compared).toFixed(1) : '0'}%)  <-- the number we couldn't measure before`)
if (mismatches.length) { lines.push(`\n--- silent-wrong files ---`); for (const m of mismatches.slice(0, 40)) lines.push('  ' + m) }
const out = lines.join('\n')
console.log(out)
writeFileSync(join(root, 'scripts', 'corpus', 'output', 'oracle_report.txt'), out)
