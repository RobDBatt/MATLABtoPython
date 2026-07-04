/**
 * Shape-inference tests — written BEFORE the implementation.
 * All tests in the first describe() should initially fail.
 */
import { describe, it, expect } from 'vitest'
import { convert } from '../index'

function py(matlab: string): string {
  return convert(matlab)
    .python.split('\n')
    .filter(l => !l.startsWith('import ') && !l.startsWith('from '))
    .join('\n')
    .trim()
}

// ── Failing tests (before shape inference is implemented) ──────────────────
describe('matrix multiply: * → @ with shape inference', () => {

  // Both sides directly assigned from known matrix constructors
  it('zeros * zeros → @', () => {
    const out = py('A = zeros(3,3);\nB = zeros(3,3);\nC = A * B;')
    expect(out).toContain('C = A @ B')
    expect(out).not.toContain('C = A * B')
  })

  it('eye * rand → @', () => {
    const out = py('A = eye(4);\nB = rand(4,4);\nC = A * B;')
    expect(out).toContain('C = A @ B')
  })

  it('ones * ones → @', () => {
    const out = py('A = ones(5,3);\nB = ones(3,2);\nC = A * B;')
    expect(out).toContain('C = A @ B')
  })

  // Chained: A * B * C where all are matrices
  it('chained matrix multiply → @ chain', () => {
    const out = py('A = eye(3);\nB = rand(3,3);\nC = ones(3,3);\nD = A * B * C;')
    // At least the first * should become @
    expect(out).toContain('@')
  })

  // ── Conservative: should NOT replace ────────────────────────────────────

  it('scalar * matrix stays *', () => {
    const out = py('s = 2;\nA = zeros(3,3);\nB = s * A;')
    // s is scalar, A is matrix → broadcasting, keep *
    expect(out).toContain('B = s * A')
  })

  it('unknown * matrix is matrix multiply', () => {
    // x is a parameter (unknown shape), A is matrix
    const out = py('function y = f(x)\nA = eye(3);\ny = x * A;\nend')
    expect(out).toContain('x @ A')
  })

  it('element-wise .* stays * (never becomes @)', () => {
    const out = py('A = zeros(3,3);\nB = ones(3,3);\nC = A .* B;')
    // .* is element-wise — must stay * in output, never @
    expect(out).toContain('C = A * B')
    expect(out).not.toContain('@')
  })

  it('numeric literal multiply stays *', () => {
    const out = py('A = zeros(3,3);\nC = A * 2;')
    // 2 is scalar literal — must stay *
    expect(out).toContain('A * 2')
    expect(out).not.toContain('A @ 2')
  })

  it('complex LHS expression gets classified as matrix', () => {
    const out = py('A = zeros(3,3);\nB = ones(3,3);\nC = (A + B) * B;')
    expect(out).toContain('(A + B) @ B')
  })
})

// ── Shape table classification tests ──────────────────────────────────────
describe('shape table: known matrix variables', () => {
  it('inv output is matrix', () => {
    const out = py('A = zeros(3,3);\nB = inv(A);\nC = B * A;')
    expect(out).toContain('C = B @ A')
  })

  it('reshape output is matrix', () => {
    const out = py('A = reshape(x, 3, 4);\nB = zeros(4,3);\nC = A * B;')
    expect(out).toContain('C = A @ B')
  })

  it('for loop variable is scalar — never triggers @', () => {
    const out = py('A = zeros(3,3);\nfor i = 1:3\n  B = i * A;\nend')
    // i is loop counter = scalar, so stays *
    expect(out).toContain('i * A')
    expect(out).not.toContain('i @ A')
  })

  it('numeric literal assignment makes variable scalar', () => {
    const out = py('n = 5;\nA = zeros(3,3);\nB = n * A;')
    expect(out).toContain('n * A')
    expect(out).not.toContain('n @ A')
  })
})
