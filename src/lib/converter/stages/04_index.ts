import type { StructuredLine, Flag, IndexShiftResult } from '../types'
import { FUNCTION_MAP } from '../registry/functions'
import { TOOLBOX_MAP } from '../registry/toolboxes'
import type { SymbolTable } from '../analysis/scope'

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
 *
 * When a symbol table from the scope analyzer is available, it takes
 * precedence over the ad-hoc heuristics: `A(i)` is indexed iff `A`
 * appears in symbols.variables (LHS, loop var, param) and not in
 * symbols.functions. This resolves the MATLAB ambiguity exactly as the
 * language spec does (variables shadow functions by name in scope).
 */
export function shiftIndices(
  lines: StructuredLine[],
  symbols?: SymbolTable,
): IndexShiftResult {
  const flags: Flag[] = []
  const shifted: StructuredLine[] = []

  // Phase 2A: Build identifier classification from all lines
  const knownArrays = buildKnownArrays(lines)
  const knownFunctions = new Set<string>()
  if (symbols) {
    // Union in everything the scope analyzer classified as a variable.
    // Stage 3 has already rewritten the function-call sites for names
    // that are truly functions (via FUNCTION_MAP/TOOLBOX_MAP), so any
    // remaining `A(i)` where A is in symbols.variables is indexing.
    for (const v of symbols.variables) knownArrays.add(v)
    // Seed known-functions from the scope analyzer so names like `all`,
    // `any`, `find` (MATLAB built-ins, not in Stage 4's hard-coded
    // callable list) don't get misclassified as arrays when their
    // arguments happen to contain colons.
    for (const f of symbols.functions) knownFunctions.add(f)
    // `buildKnownArrays` uses slice-heuristic pattern matching that can
    // wrongly add built-in functions like `all(x, 2)` (args happen to
    // contain colons or commas) to knownArrays. Remove any name that
    // the symbol table definitively classifies as a function and that
    // was NOT also assigned as a variable. Functions win in that case.
    for (const f of symbols.functions) {
      if (!symbols.variables.has(f)) knownArrays.delete(f)
    }
  }

  // Track variables that hold 0-based indices (from np.where, np.argmax, etc.)
  // These should NOT be shifted when used as array subscripts
  const zeroBased = buildZeroBasedVars(lines)

  for (const line of lines) {
    if (line.isComment || line.content.trim() === '' || line.isBlockClose) {
      shifted.push(line)
      continue
    }

    let content = line.content
    const lineFlags: Flag[] = []

    // Skip only lines where parens are ALL syntax (def signatures, class
    // decls). `for`/`raise` args can contain indexing that must be
    // converted — the isKnownFunction check already prevents exception
    // classes and `range`/`enumerate` from being misread as arrays.
    if (/^\s*(def |class )/.test(content)) {
      shifted.push(line)
      continue
    }

    // 1E. Cell array {} indexing (unambiguous)
    content = transformCellIndexing(content)

    // 2C. Logical indexing: A(A > 5) → A[A > 5] (unambiguous)
    content = transformLogicalIndexing(content, knownArrays, knownFunctions)

    // Specific unambiguous patterns (end, :, slicing)
    content = transformUnambiguousIndexing(content, lineFlags, line, knownArrays, knownFunctions)

    // 2B. General A(i) → A[i-1] using identifier tracker
    content = transformGeneralIndexing(content, knownArrays, zeroBased, lineFlags, line, knownFunctions)

    // 2E. Chained subscript: ](args) and )(args) → ][shifted_args]
    // Required because cell-array and bracket transforms produce subscript
    // chains like `A.b[i][j]` that don't have a bare identifier preceding
    // the trailing `(args)`, so the identifier-anchored transforms above
    // can't see them. In MATLAB, `expr(args)` after a subscript chain is
    // ALWAYS array indexing (MATLAB has no first-class function results),
    // so the rewrite is unambiguous.
    content = rewriteChainedSubscript(content, zeroBased)

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
  'butter', 'cheby1', 'ellip', 'freqz', 'spectrogram',
  'imread', 'rgb2gray', 'im2double',
  'gradient', 'diff', 'cumtrapz', 'trapz',
  'unique', 'intersect', 'union', 'setdiff',
  // After Stage 3 these become np.XXX or signal.XXX — check both
  'np.zeros', 'np.ones', 'np.eye', 'np.random.rand', 'np.random.randn',
  'np.linspace', 'np.logspace', 'np.meshgrid', 'np.tile', 'np.diag',
  'np.fft.fft', 'np.fft.ifft', 'np.fft.fft2', 'np.fft.fftshift',
  'np.abs', 'np.sqrt', 'np.exp', 'np.log', 'np.sin', 'np.cos',
  'np.sort', 'np.hstack', 'np.vstack', 'np.concatenate',
  'np.cumsum', 'np.cumprod', 'np.cross', 'np.hanning', 'np.hamming',
  'np.gradient', 'np.diff', 'np.unique', 'np.arange',
  'signal.butter', 'signal.filtfilt', 'signal.lfilter', 'signal.freqz',
  'signal.spectrogram', 'signal.welch',
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

    // Pattern 4: Used with colon slicing: A(1:end) — definitely an array.
    // `[^()]` instead of `[^)]` so the regex can't cross paren boundaries.
    // Without this, lines like `Xo = bsxfun(minus, X, mu(:, i))` capture
    // `bsxfun` (the outermost callable) as a "sliced array" because the
    // colon inside the nested `mu(:, i)` falls within `bsxfun(...)`.
    const sliceMatch = content.match(/\b(\w+)\([^()]*:[^()]*\)/)
    if (sliceMatch && !isKnownFunction(sliceMatch[1])) {
      arrays.add(sliceMatch[1])
    }

    // Pattern 5: Used with dot-transpose: A' or A.' — definitely a matrix
    const transposeMatch = content.match(/\b(\w+)(?:\.'|\.T\b|\.conj\(\)\.T)/)
    if (transposeMatch) {
      arrays.add(transposeMatch[1])
    }

    // Pattern 6: Function parameters — if used with () later, likely arrays
    // Extract parameter names from def lines
    const defMatch = content.match(/^def\s+\w+\(([^)]+)\)/)
    if (defMatch) {
      const params = defMatch[1].split(',').map(s => s.trim()).filter(Boolean)
      for (const p of params) {
        // Add all params as potential arrays — better to convert () to []
        // on a scalar (minor cosmetic issue) than to leave array indexing as ()
        // (which is a syntax error)
        arrays.add(p)
      }
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
  'assert', 'input', 'round', 'super', 'getattr', 'setattr', 'hasattr',
  // Python exceptions (appear after 'raise')
  'ValueError', 'TypeError', 'RuntimeError', 'Exception', 'KeyError',
  'IndexError', 'AttributeError', 'IOError', 'OSError', 'StopIteration',
  // Post-conversion Python names that should NOT be treated as array indexing
  'where', 'flatnonzero', 'arange', 'linspace', 'array', 'zeros', 'ones', 'empty',
  'full', 'concatenate', 'stack', 'hstack', 'vstack', 'reshape',
  'solve_ivp', 'quad', 'find_peaks', 'axhline', 'axvline',
  'ceil', 'floor', 'log2', 'log10', 'log',
  // MATLAB GUI/runtime functions that become Python calls
  'close', 'figure', 'warnings', 'rng',
  // MATLAB higher-order / functional programming functions
  'arrayfun', 'cellfun', 'structfun', 'spfun', 'accumarray',
  // MATLAB event / GUI listener functions
  'addlistener', 'addprop', 'notify', 'delete', 'isvalid',
  // MATLAB OOP / handle functions
  'class', 'isa', 'isequal', 'isobject', 'methods', 'events', 'properties',
  // User-defined helper functions (common patterns)
  'icaprintf', 'fprintf', 'sprintf',
])

/**
 * Check if an identifier is a known Python/converted function.
 *
 * Resolution order (first hit wins):
 *   1. `knownArrays` (scope analyzer's variables) — locally-assigned
 *      names shadow global built-ins, fixes `map = ...; map(1, :) = v`.
 *   2. `knownFunctions` (scope analyzer's functions + MATLAB built-ins
 *      like `all`, `any`, `find`) — prevents `all(X, 2)` from being
 *      misclassified as array indexing.
 *   3. Hard-coded Python/converter callables.
 */
function isKnownFunction(
  name: string,
  knownArrays?: Set<string>,
  knownFunctions?: Set<string>,
): boolean {
  if (knownArrays?.has(name)) return false
  if (knownFunctions?.has(name)) return true
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
  // C{end} → C[-1]
  result = result.replace(/(\w+)\{end\}/g, '$1[-1]')
  // C{end-n} → C[-n-1]
  result = result.replace(/(\w+)\{end\s*-\s*(\w+)\}/g, '$1[-$2 - 1]')
  // C{1:end-1} → C[:-1] (all but last)
  result = result.replace(/(\w+)\{1\s*:\s*end\s*-\s*1\}/g, '$1[:-1]')
  // C{1:end} → C[:] (all elements)
  result = result.replace(/(\w+)\{1\s*:\s*end\}/g, '$1[:]')
  // C{start:end} → C[start-1:]
  result = result.replace(/(\w+)\{(\w+)\s*:\s*end\}/g, (_, varName, start) => {
    return `${varName}[${shiftSingleIndex(start)}:]`
  })
  // C{i} → C[i-1] (simple index)
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
function transformLogicalIndexing(
  content: string,
  knownArrays?: Set<string>,
  knownFunctions?: Set<string>,
): string {
  let result = content

  // Match: identifier(expression with comparison/logical operators)
  // Allows one level of nested parens for function calls like ~isnan(col)
  // Covers: A(A > 5), A(A ~= 0), A(~isnan(A)), A(logical_mask & cond)
  result = result.replace(
    /\b(\w+)\(((?:[^()]|\([^()]*\))*(?:>|<|>=|<=|==|!=|~=|\bnot\b|~)(?:[^()]|\([^()]*\))*)\)/g,
    (match, varName, expr) => {
      if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
      let pyExpr = expr.replace(/~=/g, '!=')
      return `${varName}[${pyExpr}]`
    },
  )

  // Also catch: A(logical_func(args)) on LHS of assignment
  // e.g., A(isnan(A)) = 0, A(np.isnan(A)) = 0
  // These are logical indexing even without comparison operators
  const LOGICAL_FUNCS = /np\.isnan|np\.isinf|np\.isfinite|isnan|isinf|isfinite/
  result = result.replace(
    /\b(\w+)\(((?:np\.)?(?:isnan|isinf|isfinite|islogical)\([^)]+\))\)\s*=/g,
    (match, varName, expr) => {
      if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
      return `${varName}[${expr}] =`
    },
  )

  return result
}

// ── Unambiguous Indexing Patterns ──────────────────────────

function transformUnambiguousIndexing(
  content: string,
  flags: Flag[],
  line: StructuredLine,
  knownArrays?: Set<string>,
  knownFunctions?: Set<string>,
): string {
  let result = content

  // A(end) → A[-1]
  result = result.replace(
    /\b(\w+)\(end\)/g,
    (match, varName) => {
      if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
      return `${varName}[-1]`
    },
  )

  // A(end-n) → A[-n-1]
  result = result.replace(
    /\b(\w+)\(end\s*-\s*(\w+)\)/g,
    (match, varName, n) => {
      if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
      return `${varName}[-${n} - 1]`
    },
  )

  // A(:) → A.flatten()
  // Skip LHS occurrences: `[~, last(:)] = foo()` must stay `last(:)` so the
  // cleanup stage turns it into `last[:]` (slice assignment). Flatten on
  // the RHS produces a new array, which is wrong for LHS semantics.
  result = result
    .split('\n')
    .map((line) => {
      const eq = findTopLevelAssign(line)
      const rhsStart = eq >= 0 ? eq + 1 : 0
      const lhs = line.slice(0, rhsStart)
      const rhs = line.slice(rhsStart)
      // First handle bare-identifier flatten: A(:) → A.flatten()
      let newRhs = rhs.replace(/\b(\w+)\(:\)/g, (match, varName) => {
        if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
        return `${varName}.flatten()`
      })
      // Then handle subscript-chain flatten: A.b[i][j](:) → A.b[i][j].flatten()
      // Required because cell-indexing transforms `A{i}{j}` to `A[i-1][j-1]`,
      // leaving a `]` immediately before `(:)` which the bare-identifier
      // regex above can't match.
      newRhs = newRhs.replace(
        /(\w+(?:\.\w+|\[[^\[\]]*\]|\([^()]*\))+)\(:\)/g,
        (_match, expr) => `${expr}.flatten()`,
      )
      return lhs + newRhs
    })
    .join('\n')

  // 2D. Multi-dimensional colon patterns: A(:, :, k), A(i, :, :), etc.
  // Parse comma-separated args, apply shifting to non-colon args.
  // Uses balanced-paren walking so `map(np.uint32(A)+1, :)` (args with
  // nested function calls) gets recognized as indexing.
  result = rewriteMultiDimIndexing(result, knownArrays ?? new Set<string>(), knownFunctions ?? new Set<string>())

  // A(i:j) → A[i-1:j] (range slicing, no comma)
  result = result.replace(
    /\b(\w+)\(\s*(\w+)\s*:\s*(\w+)\s*\)/g,
    (match, varName, start, end) => {
      if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
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
  zeroBased: Set<string>,
  flags: Flag[],
  line: StructuredLine,
  knownFunctions?: Set<string>,
): string {
  let result = content

  // Match: word(args) where args don't contain : or comparison operators
  // (those are already handled by unambiguous and logical patterns)
  result = result.replace(
    /\b(\w+)\(([^()]+)\)/g,
    (match, varName, argsStr) => {
      // Skip if already converted (contains [)
      if (match.includes('[')) return match
      // Skip known functions — but variables always shadow functions
      if (isKnownFunction(varName, knownArrays, knownFunctions)) return match
      // Skip if args contain colon (handled by unambiguous patterns)
      if (argsStr.includes(':')) return match
      // Skip if args contain comparison operators (handled by logical indexing)
      if (/[><=!]/.test(argsStr)) return match
      // Skip if args contain string literals
      if (/['"]/.test(argsStr)) return match

      if (knownArrays.has(varName)) {
        // Known array — convert to bracket indexing with shift
        const args = splitArgs(argsStr)
        const pyArgs = args.map(a => {
          const trimmed = a.trim()
          // If this index variable holds a 0-based result (from np.where etc.),
          // don't shift it — it's already correct
          if (zeroBased.has(trimmed)) return trimmed
          return shiftSingleIndex(trimmed)
        })
        return `${varName}[${pyArgs.join(', ')}]`
      }

      // Unknown — leave as-is (could be a user-defined function)
      // Don't flag every unknown call — too noisy
      return match
    },
  )

  return result
}

/**
 * Chain-subscript indexing: rewrite `](args)` and `)(args)` to `][shifted]`.
 *
 * In MATLAB, an expression like `cae.ok{1}{i}(1,:,:)` ends in array
 * indexing. After cell-array transforms convert `{...}` to `[...]`, the
 * trailing `(1,:,:)` survives as a function-call-shaped suffix. Stage 4's
 * other transforms anchor on a bare identifier preceding `(`, so they
 * skip chains where the preceding token is `]` or `)`.
 *
 * This pass walks the source, finds every `](` or `)(`, walks the
 * balanced close, and rewrites the call as a subscript with the same
 * 1→0 shifting rules used elsewhere. Skips arg lists that contain
 * comparison operators (those are logical masks the previous logical-
 * indexing pass would have handled if applicable).
 */
function rewriteChainedSubscript(
  source: string,
  zeroBased: Set<string>,
): string {
  type Match = { start: number; end: number; args: string }
  const matches: Match[] = []
  let i = 0
  let inString: '"' | "'" | null = null
  while (i < source.length) {
    const ch = source[i]
    if (inString === null && (ch === "'" || ch === '"')) {
      inString = ch as '"' | "'"
      i++
      continue
    }
    if (inString !== null) {
      if (ch === inString) inString = null
      i++
      continue
    }
    if (inString === null && ch === '#') break
    if ((ch === ']' || ch === ')') && source[i + 1] === '(') {
      const open = i + 1
      let depth = 1
      let j = open + 1
      let strInArgs: '"' | "'" | null = null
      while (j < source.length && depth > 0) {
        const c = source[j]
        if (strInArgs) {
          if (c === strInArgs) strInArgs = null
          j++
          continue
        }
        if (c === "'" || c === '"') { strInArgs = c as '"' | "'"; j++; continue }
        if (c === '(') depth++
        else if (c === ')') { depth--; if (depth === 0) break }
        j++
      }
      if (depth !== 0) { i++; continue }
      const args = source.slice(open + 1, j)
      // Skip if arg list looks like a function call (no `:` or `,` and contains
      // a comparison operator) — that's logical indexing or a scalar call we
      // shouldn't touch.
      if (/[><]|==|!=|~=/.test(args)) { i = j + 1; continue }
      // Skip empty `()` — that's a no-arg call, not indexing
      if (args.trim() === '') { i = j + 1; continue }
      // Single bare arg, multi-arg, and colon/comma cases are all
      // unambiguous array indexing in MATLAB after a subscript chain
      // (MATLAB has no chained function calls), so we always rewrite.
      matches.push({ start: open, end: j, args })
      i = j + 1
      continue
    }
    i++
  }
  if (matches.length === 0) return source
  let result = source
  for (let k = matches.length - 1; k >= 0; k--) {
    const m = matches[k]
    const argList = splitArgs(m.args).map((a) => {
      const t = a.trim()
      if (t === ':' || t === '') return t
      if (t.includes(':')) return t
      if (zeroBased.has(t)) return t
      return shiftSingleIndex(t)
    })
    result = result.slice(0, m.start) + `[${argList.join(', ')}]` + result.slice(m.end + 1)
  }
  return result
}

/**
 * Multi-dim indexing with balanced-paren arg walking. The previous
 * `[^()]*,[^()]*` regex couldn't recognize `A(f(x), :)` because the
 * inner `f(x)` has parens. This variant walks every `name(` and finds
 * the matching `)` with depth tracking; if the args contain a top-level
 * `:` and `name` isn't a known function, rewrite to `name[...]` with
 * appropriate index shifting.
 */
function rewriteMultiDimIndexing(
  source: string,
  knownArrays: Set<string>,
  knownFunctions: Set<string>,
): string {
  const matches: Array<{ start: number; end: number; name: string; args: string }> = []
  let i = 0
  while (i < source.length) {
    // Find identifier followed by `(`
    if (!/[A-Za-z_]/.test(source[i])) { i++; continue }
    let nameEnd = i
    while (nameEnd < source.length && /\w/.test(source[nameEnd])) nameEnd++
    if (nameEnd === i || source[nameEnd] !== '(') { i = nameEnd + 1; continue }
    const name = source.slice(i, nameEnd)
    if (isKnownFunction(name, knownArrays, knownFunctions)) { i = nameEnd + 1; continue }
    // Walk balanced close
    let depth = 1
    let j = nameEnd + 1
    let inString = false
    let sc = ''
    let hasTopColon = false
    let hasTopComma = false
    while (j < source.length && depth > 0) {
      const c = source[j]
      if (inString) {
        if (c === sc) {
          if (j + 1 < source.length && source[j + 1] === sc) { j += 2; continue }
          inString = false
        }
        j++
        continue
      }
      if (c === "'" || c === '"') { inString = true; sc = c; j++; continue }
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) break }
      else if (c === ':' && depth === 1) hasTopColon = true
      else if (c === ',' && depth === 1) hasTopComma = true
      j++
    }
    if (depth !== 0 || !hasTopColon || !hasTopComma) {
      i = nameEnd + 1
      continue
    }
    matches.push({
      start: i,
      end: j,
      name,
      args: source.slice(nameEnd + 1, j),
    })
    i = j + 1
  }
  if (matches.length === 0) return source

  let result = source
  for (let k = matches.length - 1; k >= 0; k--) {
    const mm = matches[k]
    const args = splitArgs(mm.args)
    const pyArgs = args.map(a => {
      const trimmed = a.trim()
      if (trimmed === ':') return ':'
      if (trimmed.includes(':')) return trimmed
      return shiftSingleIndex(trimmed)
    })
    result = result.slice(0, mm.start) + `${mm.name}[${pyArgs.join(', ')}]` + result.slice(mm.end + 1)
  }
  return result
}

/**
 * Scan all lines for variables assigned from 0-based-returning functions.
 * These include np.where()[0][0], np.argmax(), np.argmin(), etc.
 */
function buildZeroBasedVars(lines: StructuredLine[]): Set<string> {
  const vars = new Set<string>()
  for (const line of lines) {
    if (line.isComment || line.content.trim() === '') continue
    const content = line.content
    // Pattern: var = np.where(...)[0][0] or np.where(...)[0][-1]
    const whereMatch = content.match(/^\s*(\w+)\s*=\s*np\.where\b/)
    if (whereMatch) vars.add(whereMatch[1])
    // Pattern: var = np.argmax(...) or np.argmin(...)
    const argMatch = content.match(/^\s*(\w+)\s*=\s*np\.arg(?:max|min)\b/)
    if (argMatch) vars.add(argMatch[1])
    // Pattern: _, var = np.where(...) or similar multi-return
    const multiMatch = content.match(/^\s*\w+\s*,\s*(\w+)\s*=\s*.*np\.where\b/)
    if (multiMatch) vars.add(multiMatch[1])
  }
  return vars
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
 *
 * Only shifts "bare" indices — a single variable or literal number.
 * If the expression already contains arithmetic (+, -, *, /), the user
 * is doing their own offset math and we should NOT add another -1.
 *
 * Examples:
 *   i       → i - 1        (bare variable — shift)
 *   2       → 1            (literal — shift)
 *   i-1     → i-1          (has arithmetic — don't shift)
 *   i+1     → i+1          (has arithmetic — don't shift)
 *   2*i     → 2*i          (has arithmetic — don't shift)
 *   end     → handled separately, not here
 */
function shiftSingleIndex(idx: string): string {
  const trimmed = idx.trim()
  if (trimmed === ':') return ':'
  if (trimmed === '') return ''

  // Numeric literal — shift directly
  const num = parseInt(trimmed, 10)
  if (!isNaN(num) && String(num) === trimmed) {
    return String(num - 1)
  }

  // If expression contains arithmetic operators, don't shift —
  // the user is already computing an offset
  // Allow leading negative sign (e.g. -1) but catch internal operators
  if (/[+\-*/]/.test(trimmed.slice(1))) {
    return trimmed
  }

  // Bare variable — shift
  return `${trimmed} - 1`
}

/**
 * Find the index of the top-level `=` assignment operator in a line,
 * ignoring `==`, `<=`, `>=`, `!=`, `~=` and anything inside strings or
 * brackets. Returns -1 if no plain assignment exists.
 */
function findTopLevelAssign(line: string): number {
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < line.length && line[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '#') return -1
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === '=' && depth === 0) {
      const prev = line[i - 1] || ''
      const next = line[i + 1] || ''
      if (next === '=') { i++; continue }
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') continue
      return i
    }
  }
  return -1
}
