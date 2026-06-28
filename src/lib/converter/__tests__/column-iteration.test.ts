import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Shape-aware column iteration (Root Cause B). MATLAB `for c = M` over a 2-D
// matrix iterates its COLUMNS; numpy `for c in M` iterates ROWS. `M.T` makes
// numpy iterate the columns — and is a harmless no-op for a 1-D vector — so when
// the iterable is a KNOWN matrix we convert it. Unknown iterables are left alone
// (most `for x = v` loops are over 1-D vectors/lists; flagging all = noise).
function out(m: string): string {
  return convert(m).python
}
function flags(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ').toLowerCase()
}

describe('column iteration: for c = M (matrix) → for c in M.T', () => {
  it('converts a known-matrix iterable to .T', () => {
    const m = 'M = zeros(3, 4);\nfor c = M\n  s = sum(c);\nend'
    expect(out(m)).toContain('for c in M.T:')
    expect(flags(m)).toMatch(/column/)
  })

  it('leaves a range loop untouched', () => {
    const m = 'for i = 1:10\n  y = i;\nend'
    expect(out(m)).toContain('for i in range(1, 10 + 1):')
    expect(out(m)).not.toContain('.T')
    expect(flags(m)).not.toMatch(/column/)
  })

  it('does NOT touch (or flag) an unknown iterable — avoids noise', () => {
    const m = 'function f(v)\n  for x = v\n    disp(x);\n  end\nend'
    expect(out(m)).toContain('for x in v:')
    expect(out(m)).not.toContain('v.T')
    expect(flags(m)).not.toMatch(/column/)
  })
})
