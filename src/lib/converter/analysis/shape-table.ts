import type { LogicalLine } from '../types'

/**
 * Lightweight static shape classifier.
 *
 * Walks tokenised MATLAB lines in a single forward pass and classifies each
 * variable as one of:
 *
 *   'scalar'  — known to hold a single number (numeric literal, size
 *               functions, for-loop counter, etc.)
 *   'matrix'  — known to hold a 2-D numeric array (assigned from a matrix-
 *               constructor or matrix-returning function)
 *   'unknown' — not enough information, or conflicting assignments
 *
 * The table is used by Stage 3 to rewrite bare `*` (MATLAB matrix-multiply)
 * to NumPy `@` when BOTH operands are classifiable as 'matrix'.  Conservative
 * by design: 'unknown' always keeps `*`.
 *
 * Limitations (by design):
 *   - No inter-procedural analysis: function parameters are 'unknown' unless
 *     the function has an `arguments` block (integration TODO).
 *   - Multi-return assignments `[A, B] = eig(X)` leave A and B 'unknown'
 *     (too risky to guess which output is which).
 *   - Conflicting shapes (variable assigned both matrix and scalar in the same
 *     file) → 'unknown'.
 */

export type ShapeClass = 'scalar' | 'matrix' | 'unknown'

/** Functions whose return value is always a 2-D numeric matrix. */
const MATRIX_PRODUCERS = new Set([
  // Array construction
  'zeros', 'ones', 'eye', 'rand', 'randn',
  'repmat', 'reshape', 'meshgrid',
  'diag',           // vector → square diagonal matrix
  'horzcat', 'vertcat',
  'kron',
  'magic', 'hilb', 'toeplitz', 'hankel', 'vander', 'rosser',
  'pascal', 'wilkinson', 'hadamard', 'compan',
  // Linear algebra results (matrix in → matrix out)
  'inv', 'pinv', 'expm', 'logm', 'sqrtm',
  'triu', 'tril',
  'transpose',      // explicit call form
  'rot90', 'fliplr', 'flipud',
  // Image / data
  'imread',
  // Sparse  (scipy.sparse is still 2-D)
  'sparse', 'speye', 'sprand',
])

/** Functions whose return value is always a scalar (single number). */
const SCALAR_PRODUCERS = new Set([
  'length', 'numel', 'ndims',
  'norm', 'det', 'trace', 'rank', 'cond',
  'max',   // single-output form of max(vector) → scalar; conservative (multi-
  'min',   //   output [m,i]=max(v) is caught by the multi-return guard below)
  'sum',   // sum(vector) → scalar; sum(matrix) → row vector but we mark scalar
           // because the most common use-case is summing a flat array
])

// ── Helpers ───────────────────────────────────────────────

/** True iff `s` is a plain non-negative numeric literal (int or float). */
function isNumericLiteral(s: string): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim())
}

/**
 * Merge two shape observations.  If they disagree, collapse to 'unknown' so
 * we never misfire on a variable that changes type across branches.
 */
function mergeShape(prev: ShapeClass | undefined, next: ShapeClass): ShapeClass {
  if (prev === undefined || prev === next) return next
  return 'unknown'
}

/** Find the index of the bare assignment `=` in a line (not `==`/`~=` etc.). */
function findAssignEquals(line: string): number {
  let paren = 0, bracket = 0, brace = 0
  let inStr = false, sc = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inStr) {
      if (ch === sc) {
        if (i + 1 < line.length && line[i + 1] === sc) { i++; continue }
        inStr = false
      }
      continue
    }
    if (ch === '%' || ch === '#') return -1
    if (ch === "'" || ch === '"') { inStr = true; sc = ch; continue }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '=' && paren === 0 && bracket === 0 && brace === 0) {
      const prev = line[i - 1] || ''
      const next = line[i + 1] || ''
      if (next === '=') return -1
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') return -1
      return i
    }
  }
  return -1
}

// ── Main export ────────────────────────────────────────────

export function buildShapeTable(lines: LogicalLine[]): Map<string, ShapeClass> {
  const shapes = new Map<string, ShapeClass>()

  const record = (name: string, cls: ShapeClass) => {
    shapes.set(name, mergeShape(shapes.get(name), cls))
  }

  for (const line of lines) {
    if (line.isComment) continue
    const content = line.content.trim()
    if (!content) continue

    // ── for / parfor loop counters → always scalar ──────
    const forM = content.match(/^(?:for|parfor)\s+(\w+)\s*=/)
    if (forM) { record(forM[1], 'scalar'); continue }

    // ── Function parameters → unknown (we don't know the caller's types) ──
    // Skip: they default to 'unknown' because they're never recorded.

    // ── Multi-return `[a, b] = func(...)` → unknown for each output ───────
    if (/^\[/.test(content)) {
      const eqIdx = findAssignEquals(content)
      if (eqIdx > 0) {
        const lhsRaw = content.slice(0, eqIdx).trim()
        const inner = lhsRaw.replace(/^\[|\]$/g, '')
        for (const name of inner.split(',').map(s => s.trim()).filter(Boolean)) {
          if (name !== '~') record(name, 'unknown')
        }
      }
      continue
    }

    // ── Simple assignment `varname = rhs` ─────────────────────────────────
    const eqIdx = findAssignEquals(content)
    if (eqIdx < 0) continue

    const lhsRaw = content.slice(0, eqIdx).trim()
    const rhs = content.slice(eqIdx + 1).trim()
    if (!rhs) continue

    // LHS must be a plain identifier (not `A(i) = ...` which is indexing)
    const lhsRoot = lhsRaw.match(/^(\w+)(?:\s*[\(\[\{])?/)
    if (!lhsRoot) continue
    const varName = lhsRoot[1]

    // Skip if LHS has subscript (array element assignment, not variable decl)
    if (/^(\w+)\s*[\(\[\{]/.test(lhsRaw)) continue

    // ── Classify RHS ──────────────────────────────────────────────────────

    // 1. Direct call to a known producer: funcName(...)
    const callM = rhs.match(/^(\w+)\s*\(/)
    if (callM) {
      const fn = callM[1]
      if (MATRIX_PRODUCERS.has(fn)) {
        record(varName, 'matrix')
        continue
      }
      if (SCALAR_PRODUCERS.has(fn)) {
        record(varName, 'scalar')
        continue
      }
      // Unknown function — leave as unknown (don't record)
      continue
    }

    // 2. Numeric literal
    if (isNumericLiteral(rhs)) {
      record(varName, 'scalar')
      continue
    }

    // 3. Boolean literal
    if (rhs === 'true' || rhs === 'false') {
      record(varName, 'scalar')
      continue
    }

    // 4. Multi-row matrix literal `[... ; ...]`
    if (rhs.startsWith('[') && rhs.includes(';')) {
      record(varName, 'matrix')
      continue
    }

    // 5. Simple copy `B = A` — propagate known shape
    if (/^\w+$/.test(rhs)) {
      const src = shapes.get(rhs)
      if (src && src !== 'unknown') {
        record(varName, src)
      }
      continue
    }

    // 6. Transposed copy `B = A.T` or `B = A'` (already resolved to .T)
    if (/^\w+\.T$/.test(rhs.trim())) {
      const src = rhs.split('.')[0]
      if (shapes.get(src) === 'matrix') record(varName, 'matrix')
      continue
    }
  }

  return shapes
}
