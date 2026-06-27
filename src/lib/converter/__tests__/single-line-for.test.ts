import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// One-line `for` loops with the body on the header line — both the canonical
// comma form (`for i=1:n, body, end`) and the space form (`for i=1:n body; end`,
// common in lightspeed micro-benchmarks). Both used to glue the body into the
// range expression (`range(1, n, print(i) + 1)`) and emit an empty `pass` body.
function py(matlab: string): string {
  return convert(matlab).python
    .split('\n').filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n').trim()
}

describe('one-line for-loop body splitting', () => {
  it('comma form: for i=1:n, disp(i); end', () => {
    const out = py('for i = 1:n, disp(i); end')
    expect(out).toContain('for i in range(1, n + 1):')
    expect(out).toContain('print(i)')
    expect(out).not.toContain('range(1, n,')   // body not pulled into range
    expect(out).not.toMatch(/range\([^)]*\):\n\s+pass/) // body not empty
  })

  it('space form: for i=1:niter max(x); end', () => {
    const out = py('for i = 1:niter max(x); end')
    expect(out).toContain('for i in range(1, niter + 1):')
    expect(out).toContain('np.max(x)')
    expect(out).not.toContain('niter np.max')   // body not glued to range
  })

  it('full benchmark line: tic; for ...; end; t = toc;', () => {
    const out = py('tic; for i = 1:niter max(x); end; t = toc;')
    expect(out).toContain('for i in range(1, niter + 1):')
    expect(out).toContain('np.max(x)')
    expect(out).toContain('t = toc')
  })

  it('does NOT split a normal multi-line for header', () => {
    const out = py('for k = 1:10\n  y = k;\nend')
    expect(out).toContain('for k in range(1, 10 + 1):')
    expect(out).toContain('y = k')
  })

  it('comma form with multiple body statements', () => {
    const out = py('for i = 1:3, a = i, b = 2*i; end')
    expect(out).toContain('for i in range(1, 3 + 1):')
    expect(out).toContain('a = i')
    expect(out).toContain('b = 2*i')
  })
})
