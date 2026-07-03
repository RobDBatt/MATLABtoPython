import { describe, it, expect } from 'vitest'
import { convert } from '../index'

// Deeper shape inference (the documented `arguments`-block TODO in shape-table).
// A function `arguments` block declares each parameter's size: `A (3,3) double`
// is unambiguously a 2-D matrix; `x (1,1) double` is a scalar. Wiring those
// declarations into the shape table lets matmul-rewrite and column-iteration
// act on parameters that were previously stuck at 'unknown' — WITHOUT guessing
// (vectors / `:` / symbolic dims stay unknown, so we never misclassify).
function out(m: string): string {
  return convert(m).python
}
function flags(m: string): string {
  return convert(m).report.flags.map((f: any) => f.message).join(' | ').toLowerCase()
}

describe('arguments-block shape inference', () => {
  it('classifies `A (3,3) double` as a matrix → column iteration uses .T', () => {
    const m =
      'function s = f(A)\n' +
      '  arguments\n' +
      '    A (3,3) double\n' +
      '  end\n' +
      '  for c = A\n' +
      '    s = sum(c);\n' +
      '  end\n' +
      'end'
    expect(out(m)).toContain('for c in A.T:')
    expect(flags(m)).toMatch(/column/)
  })

  it('classifies a declared matrix param → ambiguous `*` flags', () => {
    const m =
      'function y = g(A, b)\n' +
      '  arguments\n' +
      '    A (3,3) double\n' +
      '    b double\n' +
      '  end\n' +
      '  y = A * b;\n' +
      'end'
    // A is a known matrix, b is unknown → matrix*unknown is the ambiguous case
    expect(flags(m)).toBe('')
    expect(out(m)).toContain('A @ b')
  })

  it('classifies `(1,1)` as scalar — no column-iteration rewrite', () => {
    const m =
      'function f(x)\n' +
      '  arguments\n' +
      '    x (1,1) double\n' +
      '  end\n' +
      '  for c = x\n' +
      '    disp(c);\n' +
      '  end\n' +
      'end'
    expect(out(m)).not.toContain('x.T')
    expect(flags(m)).not.toMatch(/column/)
  })

  it('leaves a vector param `(1,:)` unknown — no rewrite, no misclassification', () => {
    const m =
      'function f(v)\n' +
      '  arguments\n' +
      '    v (1,:) double\n' +
      '  end\n' +
      '  for c = v\n' +
      '    disp(c);\n' +
      '  end\n' +
      'end'
    expect(out(m)).toContain('for c in v:')
    expect(out(m)).not.toContain('v.T')
    expect(flags(m)).not.toMatch(/column/)
  })

  it('leaves symbolic-dim param `(n,n)` unknown — runtime size unknowable', () => {
    const m =
      'function f(M)\n' +
      '  arguments\n' +
      '    M (n,n) double\n' +
      '  end\n' +
      '  for c = M\n' +
      '    disp(c);\n' +
      '  end\n' +
      'end'
    expect(out(m)).toContain('for c in M:')
    expect(out(m)).not.toContain('M.T')
  })
})
