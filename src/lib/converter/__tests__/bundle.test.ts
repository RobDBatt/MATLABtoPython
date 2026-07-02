import { describe, it, expect } from 'vitest'
import { convertBundle, resolveClosure } from '../bundle'
import { convert } from '../index'

// Multi-file conversion: entry script + sibling function files → one bundle.
const files = new Map<string, string>([
  ['double_it', 'function y = double_it(x)\n  y = deeper(x) * 2;\nend'],
  ['deeper', 'function y = deeper(x)\n  y = x + 1;\nend'],
  // Shadows the Curve Fitting toolbox mapping — project file must win.
  ['smooth', 'function y = smooth(x)\n  y = x / 2;\nend'],
  ['unused', 'function y = unused(x)\n  y = x;\nend'],
])

describe('resolveClosure', () => {
  it('walks transitive deps, skips unused files', () => {
    const c = resolveClosure('a = double_it(3);', files)
    expect(c).toContain('double_it')
    expect(c).toContain('deeper')
    expect(c).not.toContain('unused')
  })
  it('finds no-paren bare-statement invocations', () => {
    expect(resolveClosure('double_it;\n', files)).toContain('double_it')
  })
})

describe('convertBundle', () => {
  it('emits helper defs before the entry body, single import block', () => {
    const r = convertBundle('v = [1 2 3];\na = double_it(sum(v));', files)
    expect(r.included).toEqual(expect.arrayContaining(['double_it', 'deeper']))
    const iDef = r.python.indexOf('def double_it')
    const iDeeper = r.python.indexOf('def deeper')
    const iBody = r.python.indexOf('a = double_it')
    expect(iDef).toBeGreaterThan(-1)
    expect(iDeeper).toBeGreaterThan(-1)
    expect(iBody).toBeGreaterThan(Math.max(iDef, iDeeper))
    // exactly one numpy import, at the top
    expect(r.python.match(/^import numpy as np$/gm)?.length).toBe(1)
    expect(r.python.trimStart().startsWith('import')).toBe(true)
  })

  it('project smooth.m shadows the toolbox mapping', () => {
    const r = convertBundle('y = smooth(x);', files)
    expect(r.python).toContain('def smooth(')
    expect(r.python).toContain('y = smooth(x)')
    // no toolbox flag/mapping for the shadowed name
    expect(r.python).not.toContain('np.convolve')
    expect(r.flags.map(f => f.message).join(' ')).not.toMatch(/smooth → /)
  })

  it('external calls are not bracket-indexed by Stage 4', () => {
    const r = convertBundle('a = double_it(3);', files)
    expect(r.python).toContain('double_it(3)')
    expect(r.python).not.toContain('double_it[')
  })

  it('helper flags carry their filename', () => {
    const withFlagged = new Map(files)
    withFlagged.set('uses_sim', "function r = uses_sim(m)\n  r = sim(m);\nend")
    const r = convertBundle('q = uses_sim(1);', withFlagged)
    expect(r.flags.some(f => f.message.startsWith('[uses_sim.m]'))).toBe(true)
  })
})

describe('no-paren RNG invocation (unmasked by bundled oracle runs)', () => {
  it('w = randn; is a CALL in MATLAB → np.random.randn()', () => {
    expect(convert('w = randn;').python).toContain('w = np.random.randn()')
    expect(convert('b = rand;').python).toContain('b = np.random.rand()')
  })
  it('paren form and expressions still convert', () => {
    expect(convert('t = w*2 + randn(1,3);').python).toContain('np.random.randn(3)')
    expect(convert('y = a + randn*s;').python).toContain('np.random.randn()*s')
  })
  it('assignment TO rand (user variable) is untouched', () => {
    expect(convert('rand = 3;\nz = rand + 1;').python).toContain('rand = 3')
  })
  it('prose lines with quotes are untouched', () => {
    expect(convert("disp('uses rand here');").python).toContain('uses rand here')
  })
})

describe('single-file convert unchanged without options', () => {
  it('smooth still maps via toolbox registry when no project file exists', () => {
    const r = convert('y = smooth(x);')
    const msgs = r.report.flags.map(f => f.message).join(' ')
    expect(msgs).toMatch(/smooth/)
  })
})
