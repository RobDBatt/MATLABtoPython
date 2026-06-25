/**
 * Regression tests — one entry per bug fixed.
 * Date and issue tag in each comment so history is searchable.
 */
import { describe, it, expect } from 'vitest'
import { convert } from '../index'

function py(matlab: string): string {
  return convert(matlab)
    .python.split('\n')
    .filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n')
    .trim()
}

// ── 2026-05-08: Issue #1 — R2019b arguments blocks ───────
// Previously caused parse failures: `arguments` was not a recognised block
// type, so its `end` prematurely closed the enclosing function block and all
// type-annotation lines leaked into the Python body.

describe('arguments block (R2019b+)', () => {
  it('strips the entire arguments block from output', () => {
    const code = [
      'function result = add(a, b)',
      'arguments',
      '  a (1,1) double',
      '  b (1,1) double',
      'end',
      'result = a + b;',
      'end',
    ].join('\n')
    const out = py(code)
    expect(out).toContain('def add(a, b)')
    expect(out).not.toContain('arguments')
    expect(out).not.toContain('(1,1) double')
    expect(out).toContain('result = a + b')
  })

  it('lifts simple numeric default from arguments block into signature', () => {
    const code = [
      'function y = foo(x, n)',
      'arguments',
      '  x double',
      '  n (1,1) double = 10',
      'end',
      'y = x + n;',
      'end',
    ].join('\n')
    expect(py(code)).toContain('def foo(x, n=10)')
  })

  it('lifts boolean default from arguments block', () => {
    const code = [
      'function y = bar(x, flag)',
      'arguments',
      '  x',
      '  flag (1,1) logical = true',
      'end',
      'y = x;',
      'end',
    ].join('\n')
    expect(py(code)).toContain('def bar(x, flag=True)')
  })

  it('lifts opts.field defaults as keyword args', () => {
    const code = [
      'function y = baz(x, opts)',
      'arguments',
      '  x double',
      '  opts.verbose (1,1) logical = false',
      'end',
      'y = x;',
      'end',
    ].join('\n')
    const out = py(code)
    // opts removed from positional; verbose=False added as kwarg
    expect(out).toContain('def baz(x, verbose=False)')
    expect(out).not.toContain('arguments')
  })

  it('function body lands at correct indent after arguments block', () => {
    const code = [
      'function result = add(a, b)',
      'arguments',
      '  a double',
      '  b double',
      'end',
      'result = a + b;',
      'end',
    ].join('\n')
    const out = py(code)
    // The body line must be inside the function (indented 4 spaces)
    expect(out).toContain('    result = a + b')
  })
})

// ── 2026-05-08: Issue #2 — backslash solve A\b (already worked; confirm) ──
describe('backslash solve (mldivide)', () => {
  it('A backslash b → np.linalg.solve(A, b)', () => {
    expect(py('x = A \\ b;')).toBe('x = np.linalg.solve(A, b)')
  })

  it('matrix expression on LHS → np.linalg.solve', () => {
    expect(py('coeffs = M \\ rhs;')).toBe('coeffs = np.linalg.solve(M, rhs)')
  })
})

// ── 2026-05-08: Issue #3 — std/var ddof=1 ────────────────
// Previously mapped to bare np.std(x) / np.var(x) — NumPy divides by N,
// MATLAB divides by N-1.  Now injects ddof=1.

describe('std/var ddof=1', () => {
  it('std(x) → np.std(x, ddof=1)', () => {
    expect(py('s = std(x);')).toBe('s = np.std(x, ddof=1)')
  })

  it('var(x) → np.var(x, ddof=1)', () => {
    expect(py('v = var(x);')).toBe('v = np.var(x, ddof=1)')
  })

  it('std(x, 0) keeps ddof=1', () => {
    expect(py('s = std(x, 0);')).toBe('s = np.std(x, ddof=1)')
  })

  it('std(x, 1) → ddof=0', () => {
    expect(py('s = std(x, 1);')).toBe('s = np.std(x, ddof=0)')
  })

  it('std(x, 0, 2) → np.std(x, ddof=1, axis=1)', () => {
    expect(py('s = std(x, 0, 2);')).toBe('s = np.std(x, ddof=1, axis=1)')
  })

  it('std does not flag anymore (correct conversion, no user action needed)', () => {
    const flags = convert('s = std(x);').report.flags
    expect(flags.some(f => /ddof/.test(f.message))).toBe(false)
  })
})

// ── 2026-05-08: Issue #4 — randi upper bound ─────────────
// MATLAB randi is 1-based inclusive; NumPy randint is exclusive on the upper
// bound.  Previously passed args through unchanged, producing wrong range.

describe('randi bounds', () => {
  it('randi(N) → np.random.randint(1, N+1) folded', () => {
    expect(py('x = randi(10);')).toBe('x = np.random.randint(1, 11)')
  })

  it('randi([lo, hi]) adds +1 to hi (folded for literals)', () => {
    expect(py('x = randi([1, 10]);')).toBe('x = np.random.randint(1, 11)')
  })

  it('randi([lo, hi], m, n) packs shape as tuple', () => {
    expect(py('x = randi([1, 10], 3, 4);')).toBe('x = np.random.randint(1, 11, (3, 4))')
  })

  it('randi([1, n]) variable hi uses n + 1 expression', () => {
    expect(py('x = randi([1, n]);')).toBe('x = np.random.randint(1, n + 1)')
  })

  it('randi(N, m) single size arg', () => {
    expect(py('x = randi(5, 3);')).toBe('x = np.random.randint(1, 6, 3)')
  })
})

// ── 2026-05-08: Issue #5 — anonymous functions (already worked; confirm) ──
describe('anonymous function handles', () => {
  it('@(x) x^2 → lambda x: x**2', () => {
    expect(py('f = @(x) x^2;')).toBe('f = lambda x: x**2')
  })

  it('@(x, y) x + y → lambda x, y: x + y', () => {
    expect(py('f = @(x, y) x + y;')).toBe('f = lambda x, y: x + y')
  })

  it('@(x) sin(x) + cos(x) → lambda with function calls', () => {
    const out = py('f = @(x) sin(x) + cos(x);')
    expect(out).toContain('lambda x:')
    expect(out).toContain('np.sin(x)')
  })
})

// ── 2026-05-08: Issue #6 — varargout tuple packing ───────
// Previously kept varargout[N] = expr assignments and emitted `return varargout`
// (a list), instead of packing the assigned values into a tuple return.

describe('varargout packing', () => {
  it('varargout{1}=x; varargout{2}=y → _vout temporaries + return tuple', () => {
    const code = [
      'function varargout = myfun(x)',
      'varargout{1} = x;',
      'varargout{2} = x * 2;',
      'end',
    ].join('\n')
    const out = py(code)
    expect(out).toContain('def myfun(x)')
    expect(out).toContain('_vout_0 = x')
    expect(out).toContain('_vout_1 = x * 2')
    expect(out).toContain('return _vout_0, _vout_1')
    expect(out).not.toContain('varargout')
  })

  it('single varargout{1} = expr → _vout_0 + return', () => {
    const code = [
      'function varargout = wrapper(x)',
      'varargout{1} = x + 1;',
      'end',
    ].join('\n')
    const out = py(code)
    expect(out).toContain('_vout_0 = x + 1')
    expect(out).toContain('return _vout_0')
    expect(out).not.toContain('varargout')
  })
})

// ── 2026-06-19: ode45 family emitted bare `solve_ivp` while the import is
// `from scipy import integrate`, so the call referenced an unbound name
// (NameError at runtime). Qualify as `integrate.solve_ivp`, matching how
// quad/dblquad/cumulative_trapezoid already emit `integrate.*`.
describe('ode solver name matches scipy.integrate import', () => {
  it('ode45 → integrate.solve_ivp (not bare solve_ivp)', () => {
    const { python } = convert('[t, y] = ode45(@f, [0 10], y0);')
    expect(python).toContain('from scipy import integrate')
    expect(python).toContain('integrate.solve_ivp(')
    expect(python).not.toMatch(/(^|[^.])\bsolve_ivp\(/m)
  })

  it('ode15s → integrate.solve_ivp', () => {
    const { python } = convert('[t, y] = ode15s(@f, [0 10], y0);')
    expect(python).toContain('integrate.solve_ivp(')
    expect(python).not.toMatch(/(^|[^.])\bsolve_ivp\(/m)
  })
})

// ── 2026-06-19: readtable was left literal with a generic TODO. Now mapped to
// the pandas reader by file extension (.xlsx→read_excel, else read_csv), with
// a WARNING only when the extension can't be read from a string literal.
describe('readtable → pandas reader by extension', () => {
  it('.csv → pd.read_csv, no flag', () => {
    const { python, report } = convert("T = readtable('data.csv');")
    expect(python).toContain("pd.read_csv('data.csv')")
    expect(python).toContain('import pandas as pd')
    expect(report.flags.some(f => f.type === 'WARNING' || f.type === 'TODO')).toBe(false)
  })
  it('.xlsx → pd.read_excel', () => {
    expect(convert("T = readtable('book.xlsx');").python).toContain("pd.read_excel('book.xlsx')")
  })
  it('variable filename → pd.read_csv + WARNING', () => {
    const { python, report } = convert('T = readtable(fname);')
    expect(python).toContain('pd.read_csv(fname)')
    expect(report.flags.some(f => f.type === 'WARNING')).toBe(true)
  })
})

// ── 2026-06-19: scalar subscript inconsistency. When the symbol table
// classified a never-assigned name as a function, a bare `v(1)` was left as a
// call even though a sibling `v(2:end)` was bracket-shifted to `v[1:]`. Stage 4
// now promotes any bracket-subscripted name to a proven array so all its
// scalar subscripts shift consistently. Genuine calls stay untouched.
describe('proven-array promotion (scalar subscript consistency)', () => {
  it('shifts v(1) when v is bracket-indexed elsewhere via end', () => {
    const py = convert('first = v(1);\ntail = v(2:end);').python
    expect(py).toContain('first = v[0]')
    expect(py).toContain('tail = v[1:]')
    expect(py).not.toContain('v(1)')
  })
  it('does not promote a genuine unknown function call', () => {
    expect(convert('y = myfunc(2);').python).toContain('myfunc(2)')
  })
})

// ── 2026-06-19: batch of heuristic-disagreement bugs found while auditing the
// ode45/v(1) classes. Each produced broken or silently-wrong Python with NO
// flag (violating flag-don't-guess).
describe('indexing heuristic-disagreement batch (2026-06-19)', () => {
  // F1: a var shadowing a builtin was rewritten to np.* then bracket-indexed.
  it('F1: shadowed sum/length stay plain names', () => {
    expect(convert('sum = [1 2 3];\nx = sum(2);').python).toContain('x = sum[1]')
    const lp = convert('length = [1 2 3];\nx = length(2);').python
    expect(lp).toContain('x = length[1]')
    expect(lp).not.toContain('np.max(')
  })
  it('F1: unshadowed builtin still converts', () => {
    expect(convert('s = sum(v);').python).toContain('np.sum(v)')
  })

  // F2: end-N off-by-one in multidim subscript.
  it('F2: A(end-1, 3) → A[-2, 2]; A(end,end) → A[-1,-1]', () => {
    expect(convert('A = zeros(5,5);\nx = A(end-1, 3);').python).toContain('x = A[-2, 2]')
    expect(convert('A = zeros(5,5);\nx = A(end, end);').python).toContain('x = A[-1, -1]')
  })

  // F3: stepped slice had the step in the stop position (empty result).
  it('F3: v(2:2:end) → v[1::2]; v(2:2:10) → v[1:10:2]', () => {
    expect(convert('v = 1:10;\nx = v(2:2:end);').python).toContain('x = v[1::2]')
    expect(convert('v = 1:10;\nx = v(2:2:10);').python).toContain('x = v[1:10:2]')
  })

  // F4: range with end inside a multidim subscript became a broken np.arange.
  it('F4: A(2:end-1, :) → A[1:-1, :], not np.arange', () => {
    const out = convert('A = zeros(5,5);\nx = A(2:end-1, :);').python
    expect(out).toContain('x = A[1:-1, :]')
    expect(out).not.toContain('np.arange')
  })
  it('F4: a range inside a real function call still becomes np.arange', () => {
    expect(convert('y = plot(0:N, z);').python).toContain('np.arange(0, N + 1)')
  })

  // F5: nested subscript left the outer array as a call on an ndarray.
  it('F5: a(b(end)) → a[b[-1] - 1]', () => {
    expect(convert('a = [10 20 30 40];\nb = [2 3];\nx = a(b(end));').python).toContain('x = a[b[-1] - 1]')
  })
})

// ── 2026-06-19: the F3 bounded-stepped-slice pattern used a char class that
// allowed [ ] ! =, so on already-converted subscripts like
// `find(mrec[1:]!=mrec[:-1])` it greedily matched colons across different
// subscripts and produced garbage (`find[mrec[1 - 1:-1]:]!=mrec[]`). The class
// now excludes brackets and comparison operators.
describe('stepped-slice pattern does not span sibling subscripts', () => {
  it('find(mrec(2:end)~=mrec(1:end-1)) stays well-formed', () => {
    const py = convert('mrec=[0;rec;1];\ni=find(mrec(2:end)~=mrec(1:end-1))+1;').python
    expect(py).toContain('np.flatnonzero(mrec[1:]!=mrec[:-1])')
    expect(py).not.toContain('mrec[]')
    expect(py).not.toContain('1 - 1')
  })
})

// ── 2026-06-19: corpus fallout from the F2/F4 fixes. rewriteMultiDimIndexing
// also matches function calls whose args merely contain a colon (lambda body,
// 'str:str' literal, nested subscript); sliceifyDim must leave those alone, the
// validator must not dangle a partial token off `end-<expr>`, and a name that
// is both a variable and a hardcoded builtin (str) must still produce valid
// Python. All three regressed real corpus files (py_compile syntax errors).
describe('F2/F4 corpus regressions stay fixed', () => {
  it('function call with lambda + string args is not sliceified into garbage', () => {
    const py = convert("verifyError(tc, @() vex(1), 'SMTB:badarg', @vex);").python
    expect(py).not.toContain('SMTB - 1')          // colon inside the string left alone
    expect(py).not.toContain('lambda - 1')
  })
  it('end minus a complex expression does not dangle a partial token', () => {
    const py = convert('y = v(max(1,end-ceil(0.5*k)+1):end);').python
    expect(py).not.toMatch(/-\w+ - 1\.\w/)        // the `-np - 1.ceil` shape
    expect(py).not.toContain('1.ceil')
  })
  it('str(1:end-1) where str shadows the builtin stays valid (no bare slice in call)', () => {
    const py = convert("str = sprintf('%d.', arr);\nstr = str(1:end-1);").python
    expect(py).not.toContain('str(1:end-1)')      // not left as an invalid slice-in-call
  })
})

// ── 2026-06-19: sortrows had args:'custom' but no handler, so the registry's
// `{a}` template placeholder was never substituted and leaked into the output
// (`{a}np.array([{a}[:,0]...])` → invalid Python). Now a real rewriter emits a
// lexsort/argsort expression.
describe('sortrows {a} template leak', () => {
  it('sortrows(A) → lexicographic lexsort, no {a}', () => {
    const { python } = convert('B = sortrows(A);')
    expect(python).toContain('B = A[np.lexsort(A[:, ::-1].T)]')
    expect(python).not.toContain('{a}')
    expect(python).not.toContain('np.lexsort[')   // stays a call, not a subscript
  })
  it('sortrows(A, 2) → argsort on 0-based column', () => {
    expect(convert('B = sortrows(A, 2);').python).toContain("B = A[A[:, 1].argsort(kind='stable')]")
  })
  it('[B, idx] = sortrows(A) warns about the index output', () => {
    expect(convert('[B, idx] = sortrows(A);').report.flags.some(f => f.type === 'WARNING')).toBe(true)
  })
})

// ── 2026-06-19: support sweep (Phase A). Small mechanical buckets from the
// corpus failure analysis.
describe('support sweep: ~ params and syms', () => {
  it('~ ignored input param becomes _ (unique for multiples)', () => {
    expect(convert('function y = f(~, x)\ny = x;\nend').python).toContain('def f(_, x):')
    expect(convert('function g(a, ~, ~)\nx = a;\nend').python).toContain('def g(a, _, _2):')
  })
  it('syms declares sympy symbols, with assumptions', () => {
    expect(convert('syms x y z').python).toContain("x, y, z = sp.symbols('x y z')")
    expect(convert('syms theta real').python).toContain("theta = sp.symbols('theta', real=True)")
    expect(convert('syms s x y z real').python).toContain("s, x, y, z = sp.symbols('s x y z', real=True)")
  })
})

// ── 2026-06-19: support sweep (Phase B — valid-or-flagged). Make structurally
// unconvertible constructs emit valid Python (stub + flag) instead of leaving
// raw MATLAB that fails py_compile.
describe('support sweep: property methods + dynamic fields', () => {
  it('function set.Z(...) → valid def set_Z (no raw function keyword)', () => {
    const { python, report } = convert('function obj = set.Z(obj, Z)\nobj.Z = Z;\nend')
    expect(python).toContain('def set_Z(obj, Z):')
    expect(python).not.toContain('function ')
    expect(report.flags.some(f => /property accessor/.test(f.message))).toBe(true)
  })
  it('dynamic field after a subscript/call converts', () => {
    expect(convert('y = s_array(n).(fname);').python).toContain('[fname]')
    expect(convert('z = obj.method().(f);').python).toContain('obj.method()[f]')
  })
})

// ── 2026-06-19: support sweep — string-concat v2 (operator-aware + validate-or-
// bail) and cell `{:}` in invalid positions. The v1 string-concat over/under-
// split and broke 10 corpus files; v2 never emits a partial join.
describe('support sweep: string-concat v2 + cell {:}', () => {
  it('joins string-array elements (call + suffix, dotted words, commas)', () => {
    expect(convert("v = [mfilename('fullpath') '.m'];").python).toContain("mfilename('fullpath') + '.m'")
    expect(convert("c = [conf.dir name '_x' suffix];").python).toContain("conf.dir + name + '_x' + suffix")
  })
  it('does NOT split at a %-format operator after a string (v1 regression)', () => {
    const out = convert("ps = [ps sprintf('%5.2f', v)];").python
    expect(out).toContain("ps + '%5.2f' % (v,)")
    expect(out).not.toContain('+ %')
  })
  it('numeric arrays are not treated as string concat', () => {
    expect(convert('x = [1 2 3];').python).toContain('np.array([1, 2, 3])')
  })
  it('cell {:} in `in`/subscript → [0]; call-arg unpacking preserved', () => {
    const out = convert('if ~isfield(options,f{:}) || isempty(options.(f{:}))\nx=1;\nend').python
    expect(out).toContain('f[0] in options')
    expect(out).toContain('options[f[0]]')
    expect(out).not.toContain('*f')
    expect(convert('y = func(c{:});').python).toContain('func(*c)')
  })
})

// ── 2026-06-19: "why won't this convert" flags. Unconvertible constructs that
// used to emit broken Python with ZERO explanation now carry a specific flag
// (and stay false-positive-free on valid code).
describe('support sweep: explanatory flags for unconvertible constructs', () => {
  const flags = (m: string) => convert(m).report.flags
  it('arrayfun/cellfun UniformOutput=false → TODO with list-comp guidance', () => {
    expect(flags("y = arrayfun(@(x) x^2, v, 'UniformOutput', false);").some(f => f.type === 'TODO' && /UniformOutput/.test(f.message))).toBe(true)
  })
  it('command-form pause flagged, but pause(n) converts cleanly (no flag)', () => {
    expect(flags('pause off').some(f => f.type === 'UNSUPPORTED')).toBe(true)
    expect(convert('pause(0.5);').python).toContain('time.sleep(0.5)')
    expect(flags('pause(0.5);').length).toBe(0)
  })
  it('cd command and import matlab flagged', () => {
    expect(flags('cd ..').some(f => f.type === 'UNSUPPORTED')).toBe(true)
    expect(flags('import matlab.desktop.editor.*').some(f => f.type === 'UNSUPPORTED')).toBe(true)
  })
  it('top-level range in array literal flagged; nested subscript slice is NOT', () => {
    expect(flags('n = [1:10, 20, 30];').some(f => /array literal/.test(f.message))).toBe(true)
    expect(flags('d = [0 all(xo(1:end-1,:)==xo(2:end,:),2)];').some(f => /array literal/.test(f.message))).toBe(false)
  })
})

// ── 2026-06-19: output-residual safety net. A final pass scans the generated
// Python for lines that still contain invalid-Python / residual-MATLAB markers
// and attaches an explanatory flag, so no broken line ships silently. Verified
// zero false positives across the corpus's compiling files.
import { detectResidualFlags } from '../flags/detector'
describe('output-residual safety net', () => {
  it('flags residual-invalid lines with a reason', () => {
    expect(detectResidualFlags('content = *cellcontent').length).toBe(1)        // starred RHS
    expect(detectResidualFlags('y = str2double(s(1:5))').length).toBe(1)        // range in call
    expect(detectResidualFlags('if len(track) == 0 continue').length).toBe(1)   // inline stmt
    expect(detectResidualFlags('z = [a b c]').length).toBe(1)                   // space in literal
    expect(detectResidualFlags('w = foo(bar').length).toBe(1)                   // unbalanced
    expect(detectResidualFlags('v = obj.(field)').length).toBe(1)              // dynamic field
  })
  it('does NOT flag valid Python', () => {
    expect(detectResidualFlags('ok = a + b')).toEqual([])
    expect(detectResidualFlags('good = np.array([1, 2, 3])')).toEqual([])
    expect(detectResidualFlags('fine = f(x, kw=1)')).toEqual([])
    expect(detectResidualFlags("s = '<a href=\'x\'>' + label").length).toBe(0) // markers inside strings ignored
    expect(detectResidualFlags('items = [x for x in data]')).toEqual([])        // list comp (spaces, but keyworded)
  })
  it('end-to-end: a residual flag reaches the conversion report', () => {
    const r = convert('x = a{:} + b;')   // cell expand on RHS → *a (invalid position)
    expect(r.report.flags.some(f => /\*|cell expansion/.test(f.message))).toBe(true)
  })
})

// ── 2026-06-19: Tier-1 registry breadth. assert(cond, msg) as a call asserts a
// always-true tuple — convert to the statement form. Plus common unmapped
// builtins (isscalar/isreal/isequal, scipy.special.*).
describe('Tier-1 registry breadth', () => {
  it('assert becomes a statement, not a tuple-asserting call', () => {
    expect(convert("assert(x > 0, 'must be positive');").python).toContain("assert x > 0, 'must be positive'")
    expect(convert('assert(isempty(y));').python).toContain('assert len(y) == 0')
    expect(convert("assert(n > 0, 'n=%d', n);").python).toContain("assert n > 0, 'n=%d' % (n,)")
  })
  it('isscalar/isreal/isequal map to numpy', () => {
    expect(convert('b = isscalar(x);').python).toContain('np.isscalar(x)')
    expect(convert('b = isreal(z);').python).toContain('np.isrealobj(z)')
    expect(convert('b = isequal(a, c);').python).toContain('np.array_equal(a, c)')
  })
  it('special functions map to scipy.special with the import bound', () => {
    const py = convert('g = gammaln(n);\ns = logsumexp(v);\nc = nchoosek(n, k);').python
    expect(py).toContain('from scipy import special')
    expect(py).toContain('special.gammaln(n)')
    expect(py).toContain('special.logsumexp(v)')
    expect(py).toContain('special.comb(n, k)')
  })
})

// ── 2026-06-19: Tier-1 classdef breadth. Attribute blocks, multiple
// inheritance, the `handle` base, error() on RHS, and keyword method names.
describe('Tier-1 classdef breadth', () => {
  it('classdef (Abstract) attribute block stripped; handle base dropped', () => {
    expect(convert('classdef (Abstract) Foo < handle\nend').python).toContain('class Foo:')
    expect(convert('classdef (Abstract) Bar < BaseVec\nend').python).toContain('class Bar(BaseVec):')
  })
  it('multiple inheritance A & B → (A, B)', () => {
    expect(convert('classdef Baz < A & B\nend').python).toContain('class Baz(A, B):')
  })
  it('out = error(msg) drops dead LHS → raise', () => {
    const py = convert("c = error('x');").python
    expect(py).toContain("raise ValueError('x')")
    expect(py).not.toContain('c = raise')
  })
  it('method named with a Python keyword gets a trailing underscore', () => {
    expect(convert('function r = or(a, b)\nr = a | b;\nend').python).toContain('def or_(a, b):')
  })
})

// ── 2026-06-25: verification-harness batch 1 ─────────────────────────────────
// Surfaced by tests/verification-corpus (3-tier harness).

// zeros(n)/ones(n) single SCALAR LITERAL is an n×n matrix in MATLAB, not a
// length-n vector. Was emitting np.ones(3) (length-3); now np.ones((3, 3)).
describe('zeros/ones single scalar-literal arg → n×n', () => {
  it('ones(3) → np.ones((3, 3))', () => {
    expect(py('B = ones(3);')).toBe('B = np.ones((3, 3))')
  })
  it('zeros(4) → np.zeros((4, 4))', () => {
    expect(py('A = zeros(4);')).toBe('A = np.zeros((4, 4))')
  })
  it('two-arg form unchanged: zeros(2, 3) → np.zeros((2, 3))', () => {
    expect(py('A = zeros(2, 3);')).toBe('A = np.zeros((2, 3))')
  })
  it('identifier arg stays 1-arg (size-vector vs scalar is ambiguous): zeros(sz)', () => {
    expect(py('A = zeros(sz);')).toBe('A = np.zeros(sz)')
  })
})

// class(x) returned a type OBJECT (`type(x)`) which breaks any string use; now
// emits a runnable string via type(x).__name__.
describe('class(x) emits a string, not a type object', () => {
  it('class(v) → type(v).__name__', () => {
    expect(py('c = class(v);')).toBe('c = type(v).__name__')
  })
})
