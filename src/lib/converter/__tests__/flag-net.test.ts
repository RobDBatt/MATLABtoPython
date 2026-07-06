import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// flag net → unmapped MATLAB higher-order functions that survive into the
// output get flagged instead of shipping a silent NameError.

describe('flag net — unmapped higher-order functions get flagged', () => {
  it('flags a surviving arrayfun call', () => {
    const r: any = convert('y = arrayfun(@(x) x.^2, v);')
    const msgs = (r.report.flags as any[]).map(f => f.message).join(' ')
    expect(msgs.toLowerCase()).toContain('arrayfun')
  })

  it('flags accumarray', () => {
    const r: any = convert('z = accumarray(a, b);')
    const msgs = (r.report.flags as any[]).map(f => f.message).join(' ')
    expect(msgs).toContain('accumarray')
  })

  it('flags a multi-array cellfun (the form the comprehension rewrite skips)', () => {
    // Simple `cellfun(@f, c)` now CONVERTS to a comprehension (coverage-audit
    // batch); only the lambda/multi-array forms survive — those must flag.
    const r: any = convert('z = cellfun(@(x, y) x + y, a, b);')
    const msgs = (r.report.flags as any[]).map(f => f.message).join(' ')
    expect(msgs).toContain('cellfun')
    expect(r.python).toContain('cellfun(')
  })

  it('a flag-net entry (arrayfun) reports through report.flags without polluting python', () => {
    const r: any = convert('y = arrayfun(@(x) x.^2, v);')
    expect(r.python).not.toMatch(/# (📋|❌|⚠)/)
  })
})
