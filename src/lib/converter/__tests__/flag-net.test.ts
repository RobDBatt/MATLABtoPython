import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// (a) inline flag rendering → result.annotated carries the explanations as
//     comments, while result.python stays clean (additive, no regressions).
// (b) flag net → unmapped MATLAB higher-order functions that survive into the
//     output get flagged instead of shipping a silent NameError.

describe('flag net — unmapped higher-order functions get flagged', () => {
  it('flags a surviving arrayfun call', () => {
    const r: any = convert('y = arrayfun(@(x) x.^2, v);')
    const msgs = (r.report.flags as any[]).map(f => f.message).join(' ')
    expect(msgs.toLowerCase()).toContain('arrayfun')
  })

  it('flags accumarray and cellfun', () => {
    for (const fn of ['accumarray', 'cellfun']) {
      const r: any = convert(`z = ${fn}(a, b);`)
      const msgs = (r.report.flags as any[]).map(f => f.message).join(' ')
      expect(msgs).toContain(fn)
    }
  })
})

describe('inline flag rendering (additive)', () => {
  it('annotated output carries the flag as an inline comment', () => {
    const r: any = convert('y = arrayfun(@(x) x.^2, v);')
    expect(r.annotated).toMatch(/#.*(TODO|❌|⚠).*arrayfun/i)
  })

  it('result.python is UNCHANGED — no flag comments leak into the clean output', () => {
    const r: any = convert('y = arrayfun(@(x) x.^2, v);')
    expect(r.python).not.toMatch(/# (📋|❌|⚠)/)
  })

  it('construct-level flags surface in a header notes block', () => {
    const r: any = convert('T = table(a, b);')
    expect(r.annotated).toContain('Conversion notes')
    expect(r.annotated.toLowerCase()).toContain('dataframe')
  })

  it('a fully-clean conversion gets no notes and identical annotated/python', () => {
    const r: any = convert('x = 1 + 2;')
    expect(r.python).toBe(r.annotated)
  })
})
