import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// From the oracle PY_CRASH queue: MATLAB function FILES may omit the closing
// `end` entirely — the return-emission (triggered on block close) never
// fired, so `model, llh = f(...)` callers crashed unpacking the implicit
// None (PRMLT rvmReg* demos: "not enough values to unpack").

describe('function files without a closing end still return', () => {
  it('multi-output function, no end, EOF flush', () => {
    const m = 'function [a, b] = f(x)\na = x;\nb = x * 2;'
    const py = convert(m).python
    expect(py).toContain('return a, b')
  })

  it('single-output function, no end', () => {
    const py = convert('function y = g(x)\ny = x + 1;').python
    expect(py).toContain('return y')
  })

  it('two end-less functions: first return flushes before the next def', () => {
    const m = 'function y = one(x)\ny = x;\n\nfunction z = two(x)\nz = x * 2;'
    const py = convert(m).python
    const iRet1 = py.indexOf('return y')
    const iDef2 = py.indexOf('def two')
    const iRet2 = py.indexOf('return z')
    expect(iRet1).toBeGreaterThan(-1)
    expect(iRet2).toBeGreaterThan(-1)
    expect(iRet1).toBeLessThan(iDef2)
  })

  it('function WITH end is unchanged (no double return)', () => {
    const py = convert('function [a, b] = f(x)\na = x;\nb = x;\nend').python
    expect(py.match(/return a, b/g)?.length).toBe(1)
  })
})
