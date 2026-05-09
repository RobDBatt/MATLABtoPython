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
