import type { OperatorMapping } from '../types'

/**
 * Operator mappings — ORDER MATTERS.
 * Element-wise operators (.*, ./, .^) must be processed BEFORE
 * their matrix counterparts (*, /, ^) to avoid double-replacement.
 * Short-circuit operators (&&, ||) must be processed BEFORE
 * single operators (&, |).
 */
export const OPERATOR_MAP: OperatorMapping[] = [
  // Element-wise (process FIRST)
  { matlab: '.*', python: '*', note: 'element-wise multiply' },
  { matlab: './', python: '/', note: 'element-wise divide' },
  { matlab: '.\\', python: '1/', note: 'element-wise left divide' },
  { matlab: '.^', python: '**', note: 'element-wise power' },
  { matlab: ".'" , python: '.T', note: 'non-conjugate transpose' },

  // Matrix operators (process AFTER element-wise)
  // NOTE: * → @ is the "correct" MATLAB matrix multiply mapping, but in practice
  // most MATLAB code uses * for both scalar and matrix multiply. We keep * as *
  // (element-wise/scalar) and only map explicit mtimes() to @.
  // Users should review matrix operations manually.
  { matlab: '*', python: '*', note: 'multiply — kept as * (could be scalar or matrix)' },
  // / stays as / — MATLAB uses it for both scalar and matrix division
  // Only explicit mrdivide() or mldivide() would map to np.linalg.solve
  {
    matlab: '\\',
    python: 'np.linalg.solve',
    note: 'matrix left divide',
    flag: { type: 'WARNING', message: 'Backslash (mldivide) → np.linalg.solve — verify usage' },
  },
  {
    matlab: '^',
    python: '**',
    note: 'power — kept as ** (could be scalar or matrix)',
  },
  {
    matlab: "'",
    python: '.T',
    note: 'transpose (simplified — use .conj().T for complex)',
  },

  // Comparison / logical (process short-circuit BEFORE single)
  { matlab: '~=', python: '!=', note: 'not equal' },
  { matlab: '&&', python: 'and', note: 'short-circuit AND' },
  { matlab: '||', python: 'or', note: 'short-circuit OR' },
  { matlab: '&', python: '&', note: 'element-wise AND' },
  { matlab: '|', python: '|', note: 'element-wise OR' },
  { matlab: '~', python: 'not ', note: 'logical not (prefix)' },
]
