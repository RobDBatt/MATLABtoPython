import { describe, expect, it } from 'vitest'
import { compareWorkspaces } from '../../../../scripts/oracle/compare-workspaces'

describe('Octave workspace comparison', () => {
  it('rejects a missing requested result even when another result matches', () => {
    const x = { shape: [1, 1], real: 1 }
    const answer = { shape: [1, 1], real: 42 }
    const result = compareWorkspaces({ x, answer }, { x }, { probe: ['x', 'answer'] })
    expect(result.mismatches).toEqual(['answer (missing numeric output)'])
    expect(compareWorkspaces({ x }, { x }, { probe: ['x', 'answer'] }).missingReference).toEqual(['answer'])
  })

  it('requires the declared index contract before accepting an offset', () => {
    const reference = { answer: { shape: [1, 1], real: 42 } }
    const candidate = { answer: { shape: [], real: 41 } }
    expect(compareWorkspaces(reference, candidate).mismatches).toEqual(['answer (values)'])
    const contract = { indexOutputs: ['answer'] }
    expect(compareWorkspaces(reference, candidate, contract).indexMatches).toEqual(['answer'])
    expect(compareWorkspaces(reference, reference, contract).mismatches).toEqual(['answer (values)'])
  })

  it('distinguishes row and column shapes with the same values', () => {
    const column = { shape: [2, 1], real: [1, 2] }
    const row = { shape: [1, 2], real: [1, 2] }
    const flat = { shape: [2], real: [1, 2] }
    expect(compareWorkspaces({ v: column }, { v: row }).mismatches).toEqual(['v (shape [1,2] vs [2,1])'])
    expect(compareWorkspaces({ v: row }, { v: flat }).mismatches).toEqual([])
    expect(compareWorkspaces({ v: column }, { v: flat }).mismatches).toHaveLength(1)
    expect(compareWorkspaces({ v: column }, { v: flat }, { flatColumnOutputs: ['v'] }).mismatches).toEqual([])
  })

  it('checks imaginary components as well as real components', () => {
    const reference = { z: { shape: [1, 1], real: 1, imag: -2 } }
    const candidate = { z: { shape: [], real: 1, imag: 2 } }
    expect(compareWorkspaces(reference, candidate).mismatches).toEqual(['z (values)'])
  })
})
