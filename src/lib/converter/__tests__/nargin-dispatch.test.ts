import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// From the oracle PY_CRASH queue (PRMLT): MATLAB nargin-DISPATCH functions
// (`if nargin == 2 ... elseif nargin == 3 ...`) crashed because (a) `nargin
// == N` mapped to the wrong param/polarity, (b) optional params never got
// `=None` defaults, and (c) Pattern 6 treated every param used with parens as
// an ARRAY — indexing function-handle params like `kn(X, X1)`.

const KNCENTER = `function Kc = knCenter(kn, X, X1, X2)
K = kn(X,X);
if nargin == 2
    Kc = K;
elseif nargin == 3
    Kc = kn(X1,X1);
elseif nargin == 4
    Kc = kn(X1,X2);
end
end`

describe('nargin == N dispatch', () => {
  it('maps to first-absent-param tests with correct polarity', () => {
    const py = convert(KNCENTER).python
    // nargin == 2 → 3rd param absent (and 2nd present)
    expect(py).toMatch(/if \(X is not None and X1 is None\):|if X1 is None:/)
    // nargin == 3 → 4th absent, 3rd present
    expect(py).toMatch(/\(X1 is not None and X2 is None\)/)
    // nargin == 4 (== total) → last param present
    expect(py).toMatch(/X2 is not None/)
    // the OLD wrong mapping must be gone
    expect(py).not.toMatch(/if X is not None:\s*$/m)
  })

  it('optional params get =None defaults from the dispatch arity', () => {
    const py = convert(KNCENTER).python
    expect(py).toContain('def knCenter(kn, X, X1=None, X2=None):')
  })

  it('nargin <= N maps to first-absent-param', () => {
    const py = convert('function y = f(a, b, c)\nif nargin <= 2\n  y = a;\nelse\n  y = c;\nend\nend').python
    expect(py).toContain('if c is None:')
    // `<= 2` implies arity 2 is legal → params AFTER position 2 default
    expect(py).toContain('def f(a, b, c=None):')
  })

  it('existing nargin < N default-lifting still works', () => {
    const py = convert("function y = g(a, b)\nif nargin < 2\n  b = 5;\nend\ny = a + b;\nend").python
    expect(py).toContain('def g(a, b=5):')
  })
})

describe('function-handle params are not force-indexed (Pattern 6)', () => {
  it('call-shaped param usage keeps parens', () => {
    const py = convert(KNCENTER).python
    expect(py).toContain('kn(X')
    expect(py).not.toContain('kn[')
  })

  it('array-evidence params still index (numeric subscript)', () => {
    const py = convert('function y = f(v)\ny = v(1) + v(2);\nend').python
    expect(py).toContain('v[0]')
  })

  it('array-evidence params still index (colon slice)', () => {
    const py = convert('function y = f(A)\ny = A(:, 2);\nend').python
    expect(py).toContain('A[:, 1:1+1]')
  })

  it('array-evidence params still index (loop-counter subscript)', () => {
    const py = convert('function s = f(v, n)\ns = 0;\nfor i = 1:n\n  s = s + v(i);\nend\nend').python
    expect(py).toContain('v[i - 1]')
  })
})
