import { describe, it, expect } from 'vitest'
import { convert } from '../index'

function py(matlab: string): string {
  const result = convert(matlab)
  return result.python
    .split('\n')
    .filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n')
    .trim()
}

describe('Issue probes (failing = needs fix)', () => {

  // ── 1. arguments block ──────────────────────────────────
  it('strips arguments block and preserves function body', () => {
    const code = [
      'function result = add(a, b, opts)',
      'arguments',
      '  a (1,1) double',
      '  b (1,1) double',
      '  opts.verbose (1,1) logical = false',
      'end',
      'result = a + b;',
      'end',
    ].join('\n')
    const out = py(code)
    expect(out).toContain('def add(a, b')
    expect(out).not.toContain('arguments')
    expect(out).toContain('result = a + b')
  })

  it('arguments block with simple defaults lifts them to signature', () => {
    const code = [
      'function y = foo(x, n)',
      'arguments',
      '  x double',
      '  n (1,1) double = 10',
      'end',
      'y = x + n;',
      'end',
    ].join('\n')
    const out = py(code)
    expect(out).toContain('def foo(x, n=10)')
    expect(out).not.toContain('arguments')
    expect(out).toContain('y = x + n')
  })

  // ── 2. backslash solve ────────────────────────────────────
  it('A backslash b converts to np.linalg.solve', () => {
    expect(py('x = A \\ b;')).toBe('x = np.linalg.solve(A, b)')
  })

  it('backslash with matrix expression converts', () => {
    expect(py('coeffs = M \\ rhs;')).toBe('coeffs = np.linalg.solve(M, rhs)')
  })

  // ── 3. std/var ddof=1 ─────────────────────────────────────
  it('std emits ddof=1', () => {
    expect(py('s = std(x);')).toBe('s = np.std(x, ddof=1)')
  })

  it('std with dim arg gets ddof=1 first', () => {
    expect(py('s = std(x, 0, 2);')).toBe('s = np.std(x, ddof=1, axis=1)')
  })

  it('var emits ddof=1', () => {
    expect(py('v = var(x);')).toBe('v = np.var(x, ddof=1)')
  })

  // ── 4. randi upper bound ──────────────────────────────────
  it('randi([lo, hi]) adds +1 to upper bound', () => {
    // Numeric literal: 10+1 is folded to 11 for cleaner output
    expect(py('x = randi([1, 10]);')).toBe('x = np.random.randint(1, 11)')
  })

  it('randi([lo, hi], m, n) passes size as tuple', () => {
    expect(py('x = randi([1, 10], 3, 4);')).toBe('x = np.random.randint(1, 11, (3, 4))')
  })

  it('randi(N) → randint(1, N+1)', () => {
    expect(py('x = randi(10);')).toBe('x = np.random.randint(1, 11)')
  })

  it('randi([lo, hi]) with variable hi uses hi + 1 expression', () => {
    expect(py('x = randi([1, n]);')).toBe('x = np.random.randint(1, n + 1)')
  })

  // ── 5. anonymous functions ────────────────────────────────
  it('@(x) x^2 becomes lambda with ** operator', () => {
    expect(py('f = @(x) x^2;')).toBe('f = lambda x: x**2')
  })

  it('@(x, y) x + y multi-arg lambda', () => {
    expect(py('f = @(x, y) x + y;')).toBe('f = lambda x, y: x + y')
  })

  // ── 6. varargout tuple packing ────────────────────────────
  // ── 7. ode45 import/name consistency ──────────────────────
  it('ode45 call uses the same name that gets imported (no NameError)', () => {
    const { python } = convert('[t, y] = ode45(@f, [0 10], y0);')
    // Import is `from scipy import integrate`, so the call MUST be qualified.
    expect(python).toContain('from scipy import integrate')
    expect(python).toContain('integrate.solve_ivp(')
    expect(python).not.toMatch(/(^|[^.])\bsolve_ivp\(/m)
  })

  // ── 8. proven-array promotion: scalar subscript consistency ──
  it('v(1) shifts when v is proven an array by end-indexing elsewhere', () => {
    const out = py('first = v(1);\ntail = v(2:end);')
    expect(out).toContain('first = v[0]')
    expect(out).toContain('tail = v[1:]')
    expect(out).not.toContain('v(1)')
  })

  it('v(1) shifts when v is proven an array by subscript assignment', () => {
    const out = py('v(3) = 5;\nx = v(1);')
    expect(out).toContain('v[2] = 5')
    expect(out).toContain('x = v[0]')
  })

  it('genuine unknown call is NOT promoted to indexing', () => {
    const out = py('y = myfunc(2);')
    expect(out).toContain('myfunc(2)')
  })

  // ── 9. shadowed builtins (F1) ─────────────────────────────
  it('locally-assigned var shadowing a builtin is NOT rewritten to np.*', () => {
    const out = py('sum = [1 2 3];\nx = sum(2);')
    expect(out).toContain('x = sum[1]')
    expect(out).not.toContain('np.sum[')
  })

  it('shadowed length() does not become np.max(2.shape) syntax error', () => {
    const out = py('length = [1 2 3];\nx = length(2);')
    expect(out).toContain('x = length[1]')
    expect(out).not.toContain('np.max(')
  })

  it('unshadowed builtin still converts normally', () => {
    expect(py('s = sum(v);')).toContain('np.sum(v)')
  })

  // ── F2: end-N off-by-one in multidim subscript ────────────
  it('A(end-1, 3) shifts end-1 to -2 (multidim)', () => {
    expect(py('A = zeros(5,5);\nx = A(end-1, 3);')).toContain('x = A[-2, 2]')
  })
  it('A(2, end-1) second-dim end-1 to -2', () => {
    expect(py('A = zeros(5,5);\nx = A(2, end-1);')).toContain('x = A[1, -2]')
  })
  it('A(end, end) has no stray spaces', () => {
    expect(py('A = zeros(5,5);\nx = A(end, end);')).toContain('x = A[-1, -1]')
  })
  it('v(end-2:end) slice start shifts to -3', () => {
    expect(py('v = 1:10;\nx = v(end-2:end);')).toContain('x = v[-3:]')
  })

  // ── F4: range with end inside multidim subscript ──────────
  it('A(2:end-1, :) becomes a slice, not np.arange', () => {
    const out = py('A = zeros(5,5);\nx = A(2:end-1, :);')
    expect(out).toContain('x = A[1:-1, :]')
    expect(out).not.toContain('np.arange')
  })

  // ── F3: stepped slice ─────────────────────────────────────
  it('v(2:2:end) keeps step in the step position and shifts start', () => {
    expect(py('v = 1:10;\nx = v(2:2:end);')).toContain('x = v[1::2]')
  })
  it('v(1:2:end) → v[0::2]', () => {
    expect(py('v = 1:10;\nx = v(1:2:end);')).toContain('x = v[0::2]')
  })

  // ── F5: nested subscript ──────────────────────────────────
  it('a(b(end)) indexes the outer array too', () => {
    expect(py('a = [10 20 30 40];\nb = [2 3];\nx = a(b(end));')).toContain('x = a[b[-1] - 1]')
  })

  // ── sortrows {a} template leak ────────────────────────────
  it('sortrows(A) substitutes the arg (no {a} leak)', () => {
    const out = py('B = sortrows(A);')
    expect(out).toBe('B = A[np.lexsort(A[:, ::-1].T)]')
    expect(out).not.toContain('{a}')
  })
  it('sortrows(A, 2) sorts by that column (0-based)', () => {
    expect(py('B = sortrows(A, 2);')).toBe("B = A[A[:, 1].argsort(kind='stable')]")
  })

  // ── ~ ignored input params ────────────────────────────────
  it('~ input param becomes _', () => {
    expect(py('function y = f(~, x)\ny = x;\nend')).toContain('def f(_, x):')
  })
  it('lone ~ param becomes _', () => {
    expect(py('function branching_model(~)\nx = 1;\nend')).toContain('def branching_model(_):')
  })
  it('multiple ~ params get unique names', () => {
    expect(py('function out = g(a, ~, ~)\nout = a;\nend')).toContain('def g(a, _, _2):')
  })

  // ── syms symbolic declarations ────────────────────────────
  it('syms x y z → sp.symbols tuple', () => {
    expect(py('syms x y z')).toContain("x, y, z = sp.symbols('x y z')")
  })
  it('syms theta real → single symbol with assumption', () => {
    expect(py('syms theta real')).toContain("theta = sp.symbols('theta', real=True)")
  })
  it('syms s x y z real → tuple with assumption', () => {
    expect(py('syms s x y z real')).toContain("s, x, y, z = sp.symbols('s x y z', real=True)")
  })

  // ── classdef property-method defs (get./set.) ─────────────
  it('set.Z property method → valid def set_Z', () => {
    const out = py('function obj = set.Z(obj, Z)\nobj.Z = Z;\nend')
    expect(out).toContain('def set_Z(obj, Z):')
    expect(out).not.toContain('function ')
  })
  it('get.n property method → valid def get_n', () => {
    expect(py('function v = get.n(obj)\nv = obj.n;\nend')).toContain('def get_n(obj):')
  })

  // ── string-array concat v2 (operator-aware, validate-or-bail) ─────
  it('string in middle joins', () => {
    expect(py("p = [pre 'mid' post];")).toBe("p = pre + 'mid' + post")
  })
  it('call + string suffix joins', () => {
    expect(py("v = [mfilename('fullpath') '.m'];")).toBe("v = mfilename('fullpath') + '.m'")
  })
  it('comma-separated mixed joins', () => {
    expect(py("h = ['<a>', label, '</a>'];")).toBe("h = '<a>' + label + '</a>'")
  })
  it('many dotted/word elements join', () => {
    expect(py("c = [conf.dir name '_x' suffix];")).toBe("c = conf.dir + name + '_x' + suffix")
  })
  it('string + %-format does NOT split at the operator (regression)', () => {
    const out = py("ps = [ps sprintf('%5.2f', v)];")
    expect(out).toBe("ps = ps + f'{v:5.2f}'")
    expect(out).not.toContain('+ %')
  })
  it('numeric array untouched', () => {
    expect(py('x = [1 2 3];')).toBe('x = np.array([1, 2, 3])')
    expect(py('x = [a b-1 c];')).toContain('[a, b-1, c]')
  })

  // ── cell {:} in invalid (non-call-arg) positions ──────────
  it('starred cell-expand in `in` and subscript becomes [0] access', () => {
    const out = py('if ~isfield(options,f{:}) || isempty(options.(f{:}))\n  x = 1;\nend')
    expect(out).toContain('f[0] in options')
    expect(out).toContain('options[f[0]]')
    expect(out).not.toContain('*f')
  })
  it('legitimate call-arg unpacking is preserved', () => {
    expect(py('y = func(c{:});')).toContain('func(*c)')
  })

  // ── assert → statement form (not a tuple!) ────────────────
  it('assert(cond, msg) → assert cond, msg (no parens)', () => {
    expect(py("assert(x > 0, 'must be positive');")).toBe("assert x > 0, 'must be positive'")
  })
  it('assert(cond) single arg', () => {
    expect(py('assert(isempty(y));')).toBe('assert len(y) == 0')
  })
  it('assert with format args → f-string', () => {
    expect(py("assert(n > 0, 'n=%d', n);")).toBe("assert n > 0, f'n={int(n):d}'")
  })

  // ── classdef attributes / inheritance ─────────────────────
  it('classdef (Abstract) Name < handle → class Name (handle base dropped)', () => {
    expect(py('classdef (Abstract) Foo < handle\nend')).toContain('class Foo:')
  })
  it('classdef (Abstract) Name < Parent → class Name(Parent)', () => {
    expect(py('classdef (Abstract) Bar < BaseVec\nend')).toContain('class Bar(BaseVec):')
  })
  it('classdef multiple inheritance A & B → (A, B)', () => {
    expect(py('classdef Baz < A & B\nend')).toContain('class Baz(A, B):')
  })

  // ── error() on RHS + reserved method names ────────────────
  it('var = error(msg) drops the dead LHS → raise', () => {
    const out = py("c = error('Cdf not provided');")
    expect(out).toContain("raise ValueError('Cdf not provided')")
    expect(out).not.toContain('c = raise')
  })
  it('method named `or` (Python keyword) → def or_', () => {
    expect(py('function r = or(a, b)\nr = a | b;\nend')).toContain('def or_(a, b):')
  })

  it('varargout function packs assignments into return tuple', () => {
    const code = [
      'function varargout = myfun(x)',
      'varargout{1} = x;',
      'varargout{2} = x * 2;',
      'end',
    ].join('\n')
    const out = py(code)
    expect(out).toContain('def myfun(x)')
    // Pre-pass introduces named temporaries and injects the return statement
    expect(out).toContain('_vout_0 = x')
    expect(out).toContain('_vout_1 = x * 2')
    expect(out).toContain('return _vout_0, _vout_1')
    expect(out).not.toContain('varargout')
  })
})

// Array-growth-by-assignment: MATLAB auto-grows arrays on out-of-bounds /
// end+1 assignment; NumPy does not. Rewrite the append idiom; flag the rest
// rather than emit silently-broken code.
describe('array growth by assignment', () => {
  it('rewrites VAR(end+1) = x to np.append', () => {
    const { python, report } = convert(`a = [1 2 3];\na(end+1) = 4;`)
    expect(python).toContain('a = np.append(a, 4)')
    expect(python).toContain('import numpy as np')
    expect(python).not.toContain('a[-1+1]')
    expect(report.flags.some(f => f.type === 'WARNING')).toBe(true)
  })

  it('rewrites end+1 append inside a loop, RHS still index-shifted', () => {
    const { python } = convert(
      `result = [];\nfor i = 1:5\n    result(end+1) = i^2;\nend`,
    )
    expect(python).toContain('result = np.append(result, i**2)')
  })

  it('flags growth on a scalar-initialized variable', () => {
    const { python, report } = convert(`x = 0;\nx(4) = 7;`)
    expect(python).toContain('# ⚠ WARNING')
    expect(report.flags.some(f => f.type === 'WARNING')).toBe(true)
  })

  it('does NOT touch in-bounds writes to a preallocated array', () => {
    const { python, report } = convert(`a = zeros(1,5);\na(3) = 7;`)
    expect(python).toContain('a[2] = 7')
    expect(python).not.toContain('np.append')
    expect(python).not.toContain('# ⚠ WARNING')
    expect(report.flags.some(f => f.type === 'WARNING')).toBe(false)
  })
})
