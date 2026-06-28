import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Confirmed 🟢 quick wins from docs/matlab-coverage.md (all silent-wrong today).
function py(matlab: string): string {
  return convert(matlab).python
    .split('\n').filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n').trim()
}

describe('rem → np.fmod (not np.remainder)', () => {
  // MATLAB rem() takes the sign of the dividend (like C fmod); np.remainder
  // takes the sign of the divisor — wrong for negative dividends.
  //   rem(-7, 3)       = -1   (np.fmod)
  //   np.remainder(-7,3) = 2  (WRONG)
  it('maps rem to np.fmod', () => {
    expect(py('y = rem(-7, 3);')).toContain('np.fmod(-7, 3)')
    expect(py('y = rem(-7, 3);')).not.toContain('np.remainder')
  })
})

describe("reshape is column-major (order='F')", () => {
  // MATLAB reshape fills column-major; numpy defaults to C order.
  //   reshape(1:6, 2, 3) = [1 3 5; 2 4 6]   ⇒  .reshape(2, 3, order='F')
  it('appends order=F to the multi-dim form', () => {
    expect(py('B = reshape(v, 2, 3);')).toContain("v.reshape(2, 3, order='F')")
  })
  it('appends order=F to the size-vector form', () => {
    expect(py('C = reshape(A, [2 3]);')).toContain("order='F'")
  })
  it('appends order=F to the [] auto-dim idiom', () => {
    expect(py('D = reshape(x, [], 1);')).toContain("x.reshape(-1, 1, order='F')")
  })
})

describe('axis command-form → matplotlib', () => {
  it('axis ij inverts the y-axis', () => {
    expect(py('axis ij')).toContain('invert_yaxis()')
  })
  it("axis equal / off map to plt.axis", () => {
    expect(py('axis equal')).toContain("plt.axis('equal')")
    expect(py('axis off')).toContain("plt.axis('off')")
  })
})
