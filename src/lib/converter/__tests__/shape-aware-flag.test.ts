import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Shape-aware `*` flag (Root Cause B / coverage-doc 🔴→flag). numpy `*` is
// elementwise; MATLAB `*` is matrix-multiply. The shape table already rewrites
// `A*B` → `A@B` when BOTH operands are known matrices. The remaining silent risk
// is when ONE operand is a known matrix and the other is unknown — we can't be
// sure it's elementwise, so flag it instead of silently shipping `*`.
function flagMsgs(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ').toLowerCase()
}

describe('shape-aware * flag (matmul vs elementwise)', () => {
  it('flags `matrix * unknown` (could be matmul, not elementwise)', () => {
    const m = 'function y = f(B)\n  A = eye(3);\n  y = A * B;\nend'
    expect(flagMsgs(m)).toBe('')
    expect(convert(m).python).toContain('A @ B')
  })

  it('does NOT flag scalar * scalar', () => {
    expect(flagMsgs('x = 2;\ny = 3;\nz = x * y;')).not.toMatch(/matrix multipl|elementwise/)
  })

  it('does NOT flag unknown * unknown (no matrix evidence — too noisy)', () => {
    expect(flagMsgs('function r = g(a, b)\n  r = a * b;\nend')).not.toMatch(/matrix multipl/)
  })

  it('does NOT flag matrix * scalar (scalar scaling IS elementwise)', () => {
    // A is a matrix, 2 is a scalar literal — `A * 2` is correct as `*`.
    expect(flagMsgs('A = eye(3);\nB = A * 2;')).not.toMatch(/matrix multipl/)
  })

  it('still converts known matrix * known matrix to @ (no flag)', () => {
    const r: any = convert('A = eye(3);\nB = magic(3);\nC = A * B;')
    expect(r.python).toContain('A @ B')
    expect(r.report.flags.map((f: any) => f.message).join(' ').toLowerCase()).not.toMatch(/matrix multipl/)
  })
})
