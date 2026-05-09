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
