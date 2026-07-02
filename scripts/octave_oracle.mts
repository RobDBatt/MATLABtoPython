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
 * Determinism: rand/randn/randi are replaced on BOTH sides by an identical
 * minstd LCG (Octave: shadowing .m stubs in the work dir; Python: numpy
 * monkeypatch preamble), so random scripts are numerically comparable instead
 * of skipped. Headless-graphics calls are stubbed out on the Octave side.
 *
 * Index contract: the converter intentionally returns 0-based indices
 * ("0-based + flag on display", REVIEW_PUNCHLIST). A variable whose values
 * differ from Octave by EXACTLY +1 everywhere (and are integers) is counted as
 * MATCH (index contract), verifying the contract rather than misreporting it.
 *
 *   OCTAVE_BIN=octave npx tsx scripts/octave_oracle.mts
 *   CORPUS_SAMPLE=150 npx tsx scripts/octave_oracle.mts   # also sample corpus scripts
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { convert } from '../src/lib/converter/index'
import { convertBundle } from '../src/lib/converter/bundle'

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

// ── Deterministic RNG: identical minstd LCG on both sides ─────────────────
// x' = 16807 x mod (2^31 - 1); u = x' / (2^31 - 1). All products stay below
// 2^53, so plain double arithmetic is exact in both runtimes. randn uses
// one-value-per-draw Box-Muller (the sine partner is discarded) so the draw
// streams stay aligned. MATLAB fills column-major; the numpy patch reshapes
// with order='F' to match.

const OCT_RAND_STUBS: Record<string, string> = {
  '__lcg.m': `function u = __lcg()
  global __lcg_state
  if isempty(__lcg_state); __lcg_state = 123456; end
  __lcg_state = mod(16807 * __lcg_state, 2147483647);
  u = __lcg_state / 2147483647;
end`,
  'rand.m': `function r = rand(varargin)
  [m, n] = __randsize(varargin{:});
  v = zeros(1, m*n);
  for i = 1:m*n; v(i) = __lcg(); end
  r = reshape(v, m, n);
end`,
  'randn.m': `function r = randn(varargin)
  [m, n] = __randsize(varargin{:});
  v = zeros(1, m*n);
  for i = 1:m*n
    u1 = __lcg(); u2 = __lcg();
    v(i) = sqrt(-2*log(u1)) * cos(2*pi*u2);
  end
  r = reshape(v, m, n);
end`,
  'randi.m': `function r = randi(imax, varargin)
  if numel(imax) == 2; lo = imax(1); hi = imax(2); else; lo = 1; hi = imax; end
  [m, n] = __randsize(varargin{:});
  v = zeros(1, m*n);
  for i = 1:m*n; v(i) = floor(__lcg() * (hi - lo + 1)) + lo; end
  r = reshape(v, m, n);
end`,
  'randperm.m': `function p = randperm(n, varargin)
  % Fisher-Yates driven by the shared LCG (identical on the Python side)
  p = 1:n;
  for i = n:-1:2
    j = floor(__lcg() * i) + 1;
    t = p(i); p(i) = p(j); p(j) = t;
  end
  if nargin > 1; p = p(1:varargin{1}); end
end`,
  '__randsize.m': `function [m, n] = __randsize(varargin)
  if nargin == 0; m = 1; n = 1;
  elseif nargin == 1
    if numel(varargin{1}) == 2; m = varargin{1}(1); n = varargin{1}(2);
    else; m = varargin{1}; n = varargin{1}; end
  else; m = varargin{1}; n = varargin{2}; end
end`,
  'fields.m': `function f = fields(s)
  % MATLAB alias for fieldnames() that Octave lacks - exact shim
  f = fieldnames(s);
end`,
  'rng.m': `function rng(varargin)
  global __lcg_state
  __lcg_state = 123456;  % any seeding resets the shared stream
end`,
}

// Headless-graphics no-op stubs: these produce no numeric workspace output,
// and headless Octave errors on real rendering. `hist`/`set`/`get` are NOT
// stubbed (they carry data / non-graphics uses).
const OCT_GRAPHICS_NOOPS = [
  'figure', 'clf', 'cla', 'close', 'plot', 'plot3', 'surf', 'mesh', 'contour',
  'contourf', 'imagesc', 'image', 'scatter', 'scatter3', 'semilogx', 'semilogy',
  'loglog', 'bar', 'barh', 'stairs', 'stem', 'errorbar', 'fill', 'patch',
  'text', 'xlabel', 'ylabel', 'zlabel', 'title', 'legend', 'grid', 'axis',
  'axes', 'subplot', 'colorbar', 'colormap', 'drawnow', 'pause', 'view',
  'shading', 'print', 'saveas', 'hold', 'xlim', 'ylim', 'zlim', 'box', 'quiver',
]

const PY_RAND_PATCH = `
import numpy as _onp
_lcg_state = [123456]
def _lcg_u():
    _lcg_state[0] = (16807 * _lcg_state[0]) % 2147483647
    return _lcg_state[0] / 2147483647
def _lcg_fill(shape):
    import math as _mm
    total = 1
    for s in shape: total *= int(s)
    vals = [_lcg_u() for _ in range(total)]
    return _onp.array(vals).reshape(shape, order='F') if len(shape) > 1 else _onp.array(vals)
def _p_rand(*args):
    if len(args) == 0: return _lcg_u()
    return _lcg_fill(tuple(int(a) for a in args))
def _p_randn(*args):
    import math as _mm
    def draw():
        u1, u2 = _lcg_u(), _lcg_u()
        return _mm.sqrt(-2*_mm.log(u1)) * _mm.cos(2*_mm.pi*u2)
    if len(args) == 0: return draw()
    shape = tuple(int(a) for a in args)
    total = 1
    for s in shape: total *= s
    vals = [draw() for _ in range(total)]
    return _onp.array(vals).reshape(shape, order='F') if len(shape) > 1 else _onp.array(vals)
def _p_randint(low, high=None, size=None):
    if high is None: low, high = 1, low + 1
    def draw(): return int(_lcg_u() * (high - low)) + low
    if size is None: return draw()
    if isinstance(size, int): size = (size,)
    total = 1
    for s in size: total *= int(s)
    vals = [draw() for _ in range(total)]
    return _onp.array(vals).reshape(size, order='F') if len(size) > 1 else _onp.array(vals)
def _p_permutation(n):
    p = list(range(1, int(n) + 1))
    for i in range(int(n) - 1, 0, -1):
        j = int(_lcg_u() * (i + 1))
        p[i], p[j] = p[j], p[i]
    return _onp.array(p)
_onp.random.rand = _p_rand
_onp.random.randn = _p_randn
_onp.random.randint = _p_randint
_onp.random.permutation = _p_permutation
_onp.random.seed = lambda *a, **k: _lcg_state.__setitem__(0, 123456)
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
/** Octave value = Python value + 1 everywhere, all integers → the converter's
 *  locked 0-based index contract, not a bug. */
function isIndexContract(py: number[], oct: number[]): boolean {
  if (py.length !== oct.length || py.length === 0) return false
  for (let i = 0; i < py.length; i++) {
    if (!Number.isInteger(py[i]) || !Number.isInteger(oct[i])) return false
    if (oct[i] !== py[i] + 1) return false
  }
  return true
}

interface Input { name: string; src: string; repoRoot?: string }
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
        const relFwd = rel.replace(/\\/g, '/')
        const repo = relFwd.split('/')[0]
        out.push({
          name: rel,
          src: readFileSync(join(root, 'scripts', 'corpus', 'repos', relFwd), 'utf8'),
          repoRoot: join(root, 'scripts', 'corpus', 'repos', repo),
        })
      }
    }
  }
  return out
}

// Per-repo index of FUNCTION files (basename → source) for multi-file
// bundling — mirrors MATLAB's resolve-by-filename path lookup. Class folders
// (@x) and package dirs (+x) are excluded (out of converter scope).
const repoIndexCache = new Map<string, Map<string, string>>()
function repoFunctionIndex(repoRoot: string): Map<string, string> {
  const cached = repoIndexCache.get(repoRoot)
  if (cached) return cached
  const index = new Map<string, string>()
  const walk = (dir: string) => {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      if (e.startsWith('.') || e.startsWith('@') || e.startsWith('+')) continue
      const p = join(dir, e)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) walk(p)
      else if (e.endsWith('.m')) {
        try {
          const src = readFileSync(p, 'utf8')
          if (isFunctionFile(src)) {
            const base = e.slice(0, -2)
            if (!index.has(base)) index.set(base, src) // first hit wins (like path order)
          }
        } catch { /* unreadable — skip */ }
      }
    }
  }
  walk(repoRoot)
  repoIndexCache.set(repoRoot, index)
  return index
}

const work = mkdtempSync(join(tmpdir(), 'oracle-'))
// Deterministic-RNG + graphics stubs shadow the builtins for scripts run with cwd=work.
for (const [name, body] of Object.entries(OCT_RAND_STUBS)) writeFileSync(join(work, name), body + '\n')
for (const fn of OCT_GRAPHICS_NOOPS) {
  writeFileSync(join(work, `${fn}.m`), `function varargout = ${fn}(varargin)\n  varargout = cell(1, nargout);\nend\n`)
}

const inputs = collectInputs()
const buckets: Record<string, number> = {}
const mismatches: string[] = []
const contractVars: string[] = []
const octErrCauses: Record<string, number> = {}
const pyCrashCauses: Record<string, number> = {}
const pyCrashFiles: string[] = []
let compared = 0, match = 0
let bundledInputs = 0, bundledDeps = 0

for (const inp of inputs) {
  if (isFunctionFile(inp.src)) { buckets['SKIP (function file)'] = (buckets['SKIP (function file)'] || 0) + 1; continue }

  // Octave — repo scripts get their repo on the path so sibling function
  // files resolve natively (cwd stubs still take precedence for the RNG).
  const octOut = join(work, 'oct.json')
  rmSync(octOut, { force: true })
  const mFile = join(work, 'run.m')
  const pathLine = inp.repoRoot
    ? `addpath(genpath('${inp.repoRoot.replace(/\\/g, '/')}'));\n`
    : ''
  writeFileSync(mFile, OCT_PROLOGUE + pathLine + inp.src + '\n' + OCT_DUMP)
  const oct = spawnSync(OCTAVE, ['--no-gui', '--norc', '--quiet', mFile], {
    cwd: work, encoding: 'utf8', timeout: 30000, env: { ...process.env, ORACLE_OUT: octOut },
  })
  if (oct.status !== 0 || !existsSync(octOut)) {
    buckets['OCTAVE_ERR (env/incompat)'] = (buckets['OCTAVE_ERR (env/incompat)'] || 0) + 1
    const cause = (oct.stderr || '').split('\n').find(l => l.trim().startsWith('error:'))?.trim().slice(0, 90) || (oct.status === null ? 'timeout' : 'unknown')
    octErrCauses[cause] = (octErrCauses[cause] || 0) + 1
    continue
  }

  // Python (converted) — repo scripts convert as a BUNDLE: the entry plus its
  // dependency closure over sibling function files, in one self-contained file.
  let py: string
  try {
    if (inp.repoRoot) {
      const bundle = convertBundle(inp.src, repoFunctionIndex(inp.repoRoot))
      py = bundle.python
      if (bundle.included.length > 0) bundledDeps += bundle.included.length, bundledInputs++
    } else {
      py = convert(inp.src).python
    }
  } catch { buckets['convert() threw'] = (buckets['convert() threw'] || 0) + 1; continue }
  const pyOut = join(work, 'py.json')
  rmSync(pyOut, { force: true })
  const pyFile = join(work, 'run.py')
  writeFileSync(pyFile, PY_RAND_PATCH + '\n' + py + '\n' + PY_DUMP)
  // PYTHONPATH gains the vendored compat package so conversions that emit
  // `from matlabtopython_compat import ...` can resolve it.
  const compatSrc = join(root, 'packages', 'matlabtopython-compat', 'src')
  const pr = spawnSync('python', [pyFile], { cwd: work, encoding: 'utf8', timeout: 30000, env: { ...process.env, ORACLE_OUT: pyOut, MPLBACKEND: 'Agg', PYTHONPATH: compatSrc } })
  if (pr.status !== 0 || !existsSync(pyOut)) {
    buckets['PY_CRASH (converter)'] = (buckets['PY_CRASH (converter)'] || 0) + 1
    const errLine = (pr.stderr || '').split('\n').reverse().find(l => /Error|Exception/.test(l))?.trim().slice(0, 90) || (pr.status === null ? 'timeout' : 'unknown')
    pyCrashCauses[errLine] = (pyCrashCauses[errLine] || 0) + 1
    pyCrashFiles.push(`${inp.name}  ${errLine}`)
    continue
  }

  const o = JSON.parse(readFileSync(octOut, 'utf8')) as Record<string, unknown>
  const p = JSON.parse(readFileSync(pyOut, 'utf8')) as Record<string, unknown>
  const shared = Object.keys(o).filter(k => k in p)
  if (shared.length === 0) { buckets['INCONCLUSIVE (no shared vars)'] = (buckets['INCONCLUSIVE (no shared vars)'] || 0) + 1; continue }

  compared++
  const bad: string[] = []
  let sawContract = false
  for (const k of shared) {
    const pv = flat(p[k])
    const ov = flat(o[k])
    if (closeEnough(pv, ov)) continue
    if (isIndexContract(pv, ov)) { sawContract = true; contractVars.push(`${inp.name}:${k}`); continue }
    bad.push(k)
  }
  if (bad.length === 0) {
    match++
    const label = sawContract ? 'MATCH ✅ (incl. 0-based index contract)' : 'MATCH ✅'
    buckets[label] = (buckets[label] || 0) + 1
  } else {
    buckets['MISMATCH ☠ (SILENT-WRONG)'] = (buckets['MISMATCH ☠ (SILENT-WRONG)'] || 0) + 1
    mismatches.push(`${inp.name}  vars: ${bad.join(', ')}`)
  }
}
rmSync(work, { recursive: true, force: true })

const lines: string[] = []
lines.push(`\n=== OCTAVE NUMERIC ORACLE — ${inputs.length} inputs ===`)
for (const [b, n] of Object.entries(buckets).sort((a, c) => c[1] - a[1])) lines.push(`${String(n).padStart(4)}  ${b}`)
if (bundledInputs) lines.push(`\nMulti-file bundles: ${bundledInputs} inputs pulled ${bundledDeps} sibling function files`)
lines.push(`\nNumerically comparable: ${compared}`)
lines.push(`  MATCH (correct):        ${match} (${compared ? ((100 * match) / compared).toFixed(1) : '0'}%)`)
lines.push(`  MISMATCH (SILENT-WRONG): ${compared - match} (${compared ? ((100 * (compared - match)) / compared).toFixed(1) : '0'}%)  <-- the number we couldn't measure before`)
if (contractVars.length) lines.push(`\n0-based index-contract vars verified (uniform -1): ${contractVars.length}\n  ${contractVars.slice(0, 20).join('\n  ')}`)
if (mismatches.length) { lines.push(`\n--- silent-wrong files ---`); for (const m of mismatches.slice(0, 40)) lines.push('  ' + m) }
if (pyCrashFiles.length) { lines.push(`\n--- PY_CRASH files ---`); for (const f of pyCrashFiles.slice(0, 25)) lines.push('  ' + f) }
const pyCrashTop = Object.entries(pyCrashCauses).sort((a, b) => b[1] - a[1]).slice(0, 10)
if (pyCrashTop.length) { lines.push(`
--- PY_CRASH causes (top) ---`); for (const [c, n] of pyCrashTop) lines.push(`  ${String(n).padStart(3)}  ${c}`) }
const octErrTop = Object.entries(octErrCauses).sort((a, b) => b[1] - a[1]).slice(0, 10)
if (octErrTop.length) { lines.push(`\n--- OCTAVE_ERR causes (top) ---`); for (const [c, n] of octErrTop) lines.push(`  ${String(n).padStart(3)}  ${c}`) }
const out = lines.join('\n')
console.log(out)
writeFileSync(join(root, 'scripts', 'corpus', 'output', 'oracle_report.txt'), out)
