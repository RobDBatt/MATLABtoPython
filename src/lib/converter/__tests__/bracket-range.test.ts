import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// A square-bracketed colon range `[a:b]` is just a range in MATLAB (`[0:5]`==`0:5`).
// The inline-range converter handled `(a:b)` but not `[a:b]`, so it survived as
// invalid Python `[0:(r-1)]` (colon in a list literal). Found on real geometry
// code (UnitQuaternion.m, trinterp2.m, circle.m).
function py(matlab: string): string {
  return convert(matlab).python
    .split('\n').filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n').trim()
}

describe('bracketed colon range [a:b] → np.arange', () => {
  it('converts [0:(r-1)] (paren bound)', () => {
    const out = py('r = [0:(r-1)] / x;')
    expect(out).toContain('np.arange(0, ((r-1)) + 1)')
    expect(out).not.toContain('[0:') // no bracket-colon survives
  })

  it('converts a plain [0:5]', () => {
    const out = py('th = [0:5];')
    expect(out).toContain('np.arange(0,')
    expect(out).not.toContain('[0:5]')
  })

  it('converts a 3-part [a:s:b]', () => {
    const out = py('g = [0:2:10];')
    expect(out).toContain('np.arange(0,')
    expect(out).not.toContain('[0:2:10]')
  })

  it('leaves a numeric array literal [1 2 3] alone', () => {
    expect(py('y = [1 2 3];')).toContain('np.array([1, 2, 3])')
  })

  it('does not touch a space-separated multi-range [1:5 1:5] (different bucket)', () => {
    // must not collapse into a single arange — it has two ranges
    expect(py('z = [1:5 1:5];')).not.toContain('np.arange(1, (5) + 1, 1')
  })
})
