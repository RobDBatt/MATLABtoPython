import type { StructuredLine, Flag, IndexShiftResult } from '../types'
import { FUNCTION_MAP } from '../registry/functions'
import { TOOLBOX_MAP } from '../registry/toolboxes'

/**
 * Stage 4: Index Shifting
 *
 * Dedicated pass for converting MATLAB 1-based indexing to Python 0-based.
 * Includes:
 * - Identifier tracker to distinguish arrays from functions
 * - Cell array {} indexing (unambiguous)
 * - Logical indexing A(A > 5) (unambiguous)
 * - General A(i) when identifier is a known array
 * - Multi-dimensional colon patterns A(:, :, k)
 */
export function shiftIndices(lines: StructuredLine[]): IndexShiftResult {
  const flags: Flag[] = []
  const shifted: StructuredLine[] = []

  // Phase 2A: Build identifier classification from all lines
  const knownArrays = buildKnownArrays(lines)

  for (const line of lines) {
    if (line.isComment || line.content.trim() === '' || line.isBlockClose) {
      shifted.push(line)
      continue
    }

    let content = line.content
    const lineFlags: Flag[] = []

    // Skip control flow lines
    if (/^\s*(def |for |while |if |elif |else:|try:|except |class |return\b)/.test(content)) {
      shifted.push(line)
      continue
    }

    // 1E. Cell array {} indexing (unambiguous)
    content = transformCellIndexing(content)

    // 2C. Logical indexing: A(A > 5) → A[A > 5] (unambiguous)
    content = transformLogicalIndexing(content)

    // Specific unambiguous patterns (end, :, slicing)
    content = transformUnambiguousIndexing(content, lineFlags, line)

    // 2B. General A(i) → A[i-1] using identifier tracker
    content = transformGeneralIndexing(content, knownArrays, lineFlags, line)

    flags.push(...lineFlags)
    shifted.push({ ...line, content })
  }

  return { shifted, flags }
}

// ── Identifier Tracker (Phase 2A) ─────────────────────────

/** Set of MATLAB function names that produce arrays */
const ARRAY_PRODUCING_FUNCTIONS = new Set([
  'zeros', 'ones', 'eye', 'rand', 'randn', 'linspace', 'logspace',
  'meshgrid', 'repmat', 'diag', 'reshape', 'fliplr', 'flipud',
  'rot90', 'sort', 'cat', 'horzcat', 'vertcat', 'fft', 'ifft',
  'fft2', 'fftshift', 'abs', 'sqrt', 'exp', 'log', 'sin', 'cos',
  'cumsum', 'cumprod', 'cross', 'conv', 'filter', 'filtfilt',
  'hanning', 'hamming', 'blackman', 'kaiser',
  // After Stage 3 these become np.XXX — check both
  'np.zeros', 'np.ones', 'np.eye', 'np.random.rand', 'np.random.randn',
  'np.linspace', 'np.logspace', 'np.meshgrid', 'np.tile', 'np.diag',
  'np.fft.fft', 'np.fft.ifft', 'np.fft.fft2', 'np.fft.fftshift',
  'np.abs', 'np.sqrt', 'np.exp', 'np.log', 'np.sin', 'np.cos',
  'np.sort', 'np.hstack', 'np.vstack', 'np.concatenate',
  'np.cumsum', 'np.cumprod', 'np.cross', 'np.hanning', 'np.hamming',
])

/** Functions whose arguments are arrays (e.g., size(A), length(A)) */
const ARRAY_QUERY_FUNCTIONS = new Set([
  'size', 'length', 'numel', 'ndims', 'isempty',
  'max', 'min', 'sum', 'mean', 'median', 'std', 'var',
  'norm', 'det', 'inv', 'eig', 'svd', 'rank', 'trace',
  'np.max', 'np.min', 'np.sum', 'np.mean', 'np.median',
  'np.linalg.norm', 'np.linalg.det', 'np.linalg.inv',
])

/**
 * Pre-scan all lines to build a Set of identifiers that are definitely arrays.
 */
function buildKnownArrays(lines: StructuredLine[]): Set<string> {
  const arrays = new Set<string>()

  for (const line of lines) {
    if (line.isComment || line.content.trim() === '') continue
    const content = line.content

    // Pattern 1: Left side of assignment: A = ..., A(i) = ...
    const assignMatch = content.match(/^\s*(\w+)\s*(?:\(.*?\))?\s*=\s*(.+)/)
    if (assignMatch) {
      const varName = assignMatch[1]
      const rhs = assignMatch[2]

      // Check if RHS is an array-producing function
      for (const fn of ARRAY_PRODUCING_FUNCTIONS) {
        if (rhs.includes(fn + '(') || rhs.includes(fn + ' ')) {
          arrays.add(varName)
          break
        }
      }

      // RHS is a matrix literal [...]
      if (/^\s*\[/.test(rhs)) {
        arrays.add(varName)
      }

      // RHS is a numeric literal or range (likely scalar, but could be assigned later)
      // Skip — don't add scalars
    }

    // Pattern 2: Multiple return [a, b] = ... → both are arrays
    const multiMatch = content.match(/^\s*(\w+(?:\s*,\s*\w+)+)\s*=\s*/)
    if (multiMatch) {
      const vars = multiMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      for (const v of vars) {
        if (v !== '_') arrays.add(v)
      }
    }

    // Pattern 3: Used with array-query functions: size(A), length(B)
    for (const fn of ARRAY_QUERY_FUNCTIONS) {
      const queryPattern = new RegExp(`\\b${fn.replace('.', '\\.')}\\(\\s*(\\w+)`)
      const queryMatch = content.match(queryPattern)
      if (queryMatch) {
        arrays.add(queryMatch[1])
      }
    }

    // Pattern 4: Used with colon slicing: A(1:end) — definitely an array
    const sliceMatch = content.match(/\b(\w+)\([^)]*:[^)]*\)/)
    if (sliceMatch && !isKnownFunction(sliceMatch[1])) {
      arrays.add(sliceMatch[1])
    }

    // Pattern 5: Used with dot-transpose: A' or A.' — definitely a matrix
    const transposeMatch = content.match(/\b(\w+)(?:\.'|\.T\b|\.conj\(\)\.T)/)
    if (transposeMatch) {
      arrays.add(transposeMatch[1])
    }
  }

  return arrays
}

// ── Known Function Checks ─────────────────────────────────

/** Python function prefixes that should NOT be treated as array indexing */
const KNOWN_FUNCTION_PREFIXES = new Set([
  'np', 'plt', 'signal', 'stats', 'optimize', 'control', 'pd', 'sm', 're',
  'io', 'color', 'transform', 'feature', 'measure', 'morphology', 'util',
  'ndi', 'sio', 'sf', 'warnings', 'time', 'os', 'sp', 'pywt',
])

/** Python builtins + all known MATLAB functions (after Stage 3 conversion) */
const KNOWN_CALLABLES = new Set([
  'range', 'print', 'len', 'str', 'int', 'float', 'type', 'open',
  'sorted', 'list', 'dict', 'tuple', 'set', 'enumerate', 'zip', 'map',
  'isinstance', 'chr', 'ord', 'hex', 'bin', 'bool', 'complex',
  'assert', 'input', 'round',
])

/** Check if an identifier is a known Python/converted function */
function isKnownFunction(name: string): boolean {
  if (name.includes('.')) return true
  if (KNOWN_FUNCTION_PREFIXES.has(name)) return true
  if (KNOWN_CALLABLES.has(name)) return true
  // Check if it's a known MATLAB function that was already converted
  if (FUNCTION_MAP[name]) return true
  if (TOOLBOX_MAP[name]) return true
  return false
}

// ── Cell Array Indexing ───────────────────────────────────

function transformCellIndexing(content: string): string {
  let result = content
  result = result.replace(/(\w+)\{end\}/g, '$1[-1]')
  result = result.replace(/(\w+)\{end\s*-\s*(\w+)\}/g, '$1[-$2 - 1]')
  result = result.replace(/(\w+)\{([^{}]+)\}/g, (_, varName, idx) => {
    return `${varName}[${shiftSingleIndex(idx)}]`
  })
  return result
}

// ── Logical Indexing (Phase 2C) ───────────────────────────

/**
 * Convert A(A > 5) → A[A > 5], A(mask & cond) → A[mask & cond]
 * When content inside () contains comparison operators, it's boolean masking.
 * No index shift needed.
 */
function transformLogicalIndexing(content: string): string {
  // Match: identifier(expression with comparison operators)
  return content.replace(
    /\b(\w+)\(([^()]*(?:>|<|>=|<=|==|!=|~=)[^()]*)\)/g,
    (match, varName, expr) => {
      if (isKnownFunction(varName)) return match
      // Convert ~= to != if not already done
      const pyExpr = expr.replace(/~=/g, '!=')
      return `${varName}[${pyExpr}]`
    },
  )
}

// ── Unambiguous Indexing Patterns ──────────────────────────

function transformUnambiguousIndexing(
  content: string,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  // A(end) → A[-1]
  result = result.replace(
    /\b(\w+)\(end\)/g,
    (match, varName) => {
      if (isKnownFunction(varName)) return match
      return `${varName}[-1]`
    },
  )

  // A(end-n) → A[-n-1]
  result = result.replace(
    /\b(\w+)\(end\s*-\s*(\w+)\)/g,
    (match, varName, n) => {
      if (isKnownFunction(varName)) return match
      return `${varName}[-${n} - 1]`
    },
  )

  // A(:) → A.flatten()
  result = result.replace(
    /\b(\w+)\(:\)/g,
    (match, varName) => {
      if (isKnownFunction(varName)) return match
      return `${varName}.flatten()`
    },
  )

  // 2D. Multi-dimensional colon patterns: A(:, :, k), A(i, :, :), etc.
  // Parse comma-separated args, apply shifting to non-colon args
  result = result.replace(
    /\b(\w+)\(([^()]*,[^()]*)\)/g,
    (match, varName, argsStr) => {
      if (isKnownFunction(varName)) return match

      // Check if any arg contains a colon (indicating slicing, not function call)
      const args = splitArgs(argsStr)
      const hasColon = args.some(a => a.trim() === ':')
      if (!hasColon) return match // might be a function call, handle later

      // This is definitely array indexing — convert
      const pyArgs = args.map(a => {
        const trimmed = a.trim()
        if (trimmed === ':') return ':'
        // Check for range: i:j
        if (trimmed.includes(':')) return trimmed // already has colon, keep as-is
        return shiftSingleIndex(trimmed)
      })
      return `${varName}[${pyArgs.join(', ')}]`
    },
  )

  // A(i:j) → A[i-1:j] (range slicing, no comma)
  result = result.replace(
    /\b(\w+)\(\s*(\w+)\s*:\s*(\w+)\s*\)/g,
    (match, varName, start, end) => {
      if (isKnownFunction(varName)) return match
      return `${varName}[${shiftSingleIndex(start)}:${end}]`
    },
  )

  return result
}

// ── General Indexing (Phase 2B) ───────────────────────────

/**
 * Convert A(i) → A[i-1] and A(i, j) → A[i-1, j-1]
 * ONLY when the identifier is in knownArrays.
 * Flag unknown identifiers as TODO.
 */
function transformGeneralIndexing(
  content: string,
  knownArrays: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  // Match: word(args) where args don't contain : or comparison operators
  // (those are already handled by unambiguous and logical patterns)
  result = result.replace(
    /\b(\w+)\(([^()]+)\)/g,
    (match, varName, argsStr) => {
      // Skip if already converted (contains [)
      if (match.includes('[')) return match
      // Skip known functions
      if (isKnownFunction(varName)) return match
      // Skip if args contain colon (handled by unambiguous patterns)
      if (argsStr.includes(':')) return match
      // Skip if args contain comparison operators (handled by logical indexing)
      if (/[><=!]/.test(argsStr)) return match
      // Skip if args contain string literals
      if (/['"]/.test(argsStr)) return match

      if (knownArrays.has(varName)) {
        // Known array — convert to bracket indexing with shift
        const args = splitArgs(argsStr)
        const pyArgs = args.map(a => shiftSingleIndex(a.trim()))
        return `${varName}[${pyArgs.join(', ')}]`
      }

      // Unknown — leave as-is (could be a user-defined function)
      // Don't flag every unknown call — too noisy
      return match
    },
  )

  return result
}

// ── Helpers ───────────────────────────────────────────────

/** Split a comma-separated argument string, respecting parentheses */
function splitArgs(argsStr: string): string[] {
  const args: string[] = []
  let current = ''
  let depth = 0

  for (const ch of argsStr) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (ch === ',' && depth === 0) {
      args.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current) args.push(current)
  return args
}

/**
 * Shift a single index expression from 1-based to 0-based.
 */
function shiftSingleIndex(idx: string): string {
  const trimmed = idx.trim()
  if (trimmed === ':') return ':'
  if (trimmed === '') return ''

  const num = parseInt(trimmed, 10)
  if (!isNaN(num) && String(num) === trimmed) {
    return String(num - 1)
  }

  return `${trimmed} - 1`
}
