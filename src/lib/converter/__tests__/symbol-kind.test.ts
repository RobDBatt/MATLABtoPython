import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Root Cause A — the `()` call-vs-index ambiguity. Closing A1–A4 via symbol-KIND
// tracking (array | lambda | dict | index), per docs/symbol-kind-plan.md.
// These reproduce the punch-list bugs and lock the fixes.
function py(matlab: string): string {
  return convert(matlab).python
    .split('\n')
    .filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n')
    .trim()
}

describe('Root Cause A — symbol-kind resolves call-vs-index', () => {
  // A1: the max/min/sort/find index output is already 0-based after argmax/
  // flatnonzero — it must NOT get the extra `- 1` shift (silent-wrong otherwise).
  it('A1: multi-return index var is not double-corrected', () => {
    const out = py('v = [3 1 4 1 5 9 2 6];\n[mx, ix] = max(v);\nm = v(ix);')
    expect(out).toContain('m = v[ix]')
    expect(out).not.toContain('v[ix - 1]')
  })

  // A2: an expression subscript on a known array must become a subscript, not be
  // left as a call on an ndarray (TypeError: not callable).
  it('A2: expression subscript on an array becomes a subscript', () => {
    const out = py('v = [3 1 4 1 5];\nidx = [2 4];\nfirst = v(idx(1));')
    expect(out).not.toContain('v(idx')       // not left as a call (crash)
    expect(out).toContain('v[idx[0] - 1]')   // subscripted, inner resolved + shifted
  })

  // A3: an anonymous function is a callable, not an array — `f(3)` stays a call.
  it('A3: lambda call is not turned into a subscript', () => {
    const out = py('f = @(x) x.^2 + 1;\ny = f(3);')
    expect(out).toContain('y = f(3)')
    expect(out).not.toContain('f[2]')
  })

  // A4: containers.Map → dict; a `m('key')` READ must convert to `m['key']`
  // (the write side already did), not stay a call (TypeError: not callable).
  it('A4: dict read converts to subscript', () => {
    const out = py("m = containers.Map();\nm('key') = 1;\nv = m('key');")
    expect(out).toContain("v = m['key']")
    expect(out).not.toContain("m('key')")
  })
})
