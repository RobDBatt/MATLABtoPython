import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// From the oracle PY_CRASH queue: `[d, n] = size(X)` → `d, n = X.shape`
// raises "not enough values to unpack" when X is a row vector the converter
// deliberately de-2-D'd (`rand(1,n)` → 1-D). np.atleast_2d restores MATLAB's
// (1, n) view and is a no-op for genuine 2-D arrays.

describe('two-output size', () => {
  it('[d, n] = size(X) → np.atleast_2d(X).shape', () => {
    expect(convert('[d, n] = size(X);').python).toContain('d, n = np.atleast_2d(X).shape')
  })

  it('tilde discard form', () => {
    expect(convert('[~, n] = size(X);').python).toContain('_, n = np.atleast_2d(X).shape')
  })

  it('expression argument', () => {
    expect(convert('[d, n] = size(X.data);').python).toContain('np.atleast_2d(X.data).shape')
  })

  it('single-output and dim forms unchanged', () => {
    expect(convert('s = size(X);').python).toContain('X.shape')
    expect(convert('n = size(X, 2);').python).toContain('X.shape[1]')
  })
})

describe('reduction dim → axis keyword', () => {
  it('mean(X, 2) → np.mean(X, axis=-1) (correct for de-2-D rows AND 2-D)', () => {
    expect(convert('xbar = mean(X, 2);').python).toContain('np.mean(X, axis=-1)')
  })
  it('sum(X, 1) → axis=0', () => {
    expect(convert('s = sum(X, 1);').python).toContain('np.sum(X, axis=0)')
  })
  it('max along-dim form: max(X, [], 2)', () => {
    expect(convert('m = max(X, [], 2);').python).toContain('np.max(X, axis=-1)')
  })
  it('max pair form stays elementwise', () => {
    expect(convert('m = max(a, b);').python).toContain('np.maximum(a, b)')
  })
  it("sum(X, 'all') → full reduction", () => {
    expect(convert("s = sum(X, 'all');").python).toContain('np.sum(X)')
  })
  it('1-arg forms unchanged', () => {
    expect(convert('s = sum(v);').python).toContain('np.sum(v)')
  })
})
