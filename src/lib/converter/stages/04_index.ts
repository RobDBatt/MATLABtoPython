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
  imports?: Set<string>,
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
    // Some names are *proven* arrays by an unambiguous indexing use — most
    // notably `end` inside a subscript, which is meaningless in a function
    // call. The symbol table may still classify such a name as a function
    // (e.g. it is never assigned `v = ...`, only ever subscripted), so we
    // protect proven arrays from the deletion below. Without this, a file
    // with `v(2:end)` (converted to `v[1:]`) would inconsistently leave a
    // sibling `v(1)` as a call instead of shifting it to `v[0]`.
    const provenArrays = buildProvenArrays(lines)
    for (const p of provenArrays) knownArrays.add(p)

    // Call-shaped params must not become arrays via the variables union
    // above either — `kn(X, X1)` is a function-handle call, not indexing.
    // Proven arrays (an existing `p[` use) win over the shape heuristic.
    const { params: allParams, counters } = collectParamsAndCounters(lines)
    const { callShaped } = classifyParamUsage(lines, allParams, counters)
    for (const p of callShaped) {
      if (provenArrays.has(p)) continue
      knownArrays.delete(p)
      knownFunctions.add(p)
    }

    // `buildKnownArrays` uses slice-heuristic pattern matching that can
    // wrongly add built-in functions like `all(x, 2)` (args happen to
    // contain colons or commas) to knownArrays. Remove any name that
    // the symbol table definitively classifies as a function and that
    // was NOT also assigned as a variable. Functions win in that case —
    // unless the name was proven to be an array above.
    for (const f of symbols.functions) {
      if (!symbols.variables.has(f) && !provenArrays.has(f)) knownArrays.delete(f)
    }
  }

  // Symbol-KIND resolution (Root Cause A). Names the scope pre-pass classified by
  // kind override the heuristic array/function split:
  //   lambda → a callable, never an array (A3)
  //   dict   → subscript on read too, with string/scalar keys (A4)
  //   index  → already 0-based (argmax/argsort/flatnonzero); skip the `- 1` (A1)
  const dictNames = new Set<string>()
  const kindIndexNames = new Set<string>()
  if (symbols) {
    for (const [name, kind] of symbols.kinds) {
      if (kind === 'lambda') { knownFunctions.add(name); knownArrays.delete(name) }
      else if (kind === 'dict') { dictNames.add(name); knownArrays.delete(name) }
      else if (kind === 'index') kindIndexNames.add(name)
    }
  }

  // Track variables that hold 0-based indices (from np.where, np.argmax, etc.)
  // These should NOT be shifted when used as array subscripts
  const zeroBased = buildZeroBasedVars(lines)
  for (const n of kindIndexNames) zeroBased.add(n) // multi-return max/min/sort index (A1)

  // Variables that are ONLY ever scalar/empty-initialized. Writing past their
  // bounds is MATLAB array-growth, which NumPy/lists can't do silently.
  const growthVars = buildGrowthVars(lines)

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

    // Intercept the append idiom `VAR(end+1) = RHS` BEFORE index math turns
    // `end+1` into `-1+1` (= overwrite element 0). RHS still flows through the
    // transforms below.
    content = rewriteEndAppend(content, line, lineFlags, imports)

    // 1E. Cell array {} indexing (unambiguous)
    content = transformCellIndexing(content)

    // 2C. Logical indexing: A(A > 5) → A[A > 5] (unambiguous)
    content = transformLogicalIndexing(content, knownArrays, knownFunctions)

    // dict read: m('key') → m['key'] for containers.Map vars (keys, no shift) (A4)
    content = transformDictRead(content, dictNames)

    // Specific unambiguous patterns (end, :, slicing)
    content = transformUnambiguousIndexing(content, lineFlags, line, knownArrays, knownFunctions)

    // 2B. General A(i) → A[i-1] using identifier tracker. Iterate to a fixed
    // point so an expression subscript like `v(idx(1))` resolves both layers:
    // pass 1 makes the inner `idx(1)` → `idx[0]`, pass 2 makes `v(idx[0])` →
    // `v[idx[0] - 1]` instead of leaving `v(...)` as a call on an ndarray (A2).
    for (let pass = 0; pass < 5; pass++) {
      const next = transformGeneralIndexing(content, knownArrays, zeroBased, lineFlags, line, knownFunctions)
      if (next === content) break
      content = next
    }

    // 2E. Chained subscript: ](args) and )(args) → ][shifted_args]
    // Required because cell-array and bracket transforms produce subscript
    // chains like `A.b[i][j]` that don't have a bare identifier preceding
    // the trailing `(args)`, so the identifier-anchored transforms above
    // can't see them. In MATLAB, `expr(args)` after a subscript chain is
    // ALWAYS array indexing (MATLAB has no first-class function results),
    // so the rewrite is unambiguous.
    content = rewriteChainedSubscript(content, zeroBased)

    // After index transforms, a write to a scalar/empty-only variable looks
    // like `VAR[idx] = ...` — which raises in Python. Flag it inline rather
    // than ship silently-broken code.
    content = flagGrowthAssignment(content, growthVars, line, lineFlags)

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
  const paramCandidates = new Set<string>()
  const forCounters = new Set<string>()
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

    // Pattern 6 (collection): function parameters are array CANDIDATES —
    // resolved after the scan by usage evidence (see below). Blindly adding
    // every param indexed function-HANDLE params (`kn(X, X1)` → `kn[X-1,
    // X1-1]`, a TypeError on a callable — the PRMLT kernel-demo crash class).
    const defMatch = content.match(/^def\s+\w+\(([^)]+)\)/)
    if (defMatch) {
      for (const p of defMatch[1].split(',').map(s => s.trim().replace(/=.*$/, '').trim()).filter(Boolean)) {
        if (p !== 'args' && !p.startsWith('*')) paramCandidates.add(p)
      }
    }

    // Track loop counters — `v(i)` inside a loop is array evidence.
    const forM = content.match(/^\s*for\s+(\w+)\s+in\b/)
    if (forM) forCounters.add(forM[1])
  }

  // Pattern 6 (resolution): a param is a known array only with ARRAY EVIDENCE
  // (see classifyParamUsage). Call-shaped params (`kn(X, X1)` — commonly
  // function handles) stay calls.
  const { evidenced } = classifyParamUsage(lines, paramCandidates, forCounters)
  for (const p of evidenced) arrays.add(p)

  return arrays
}

/**
 * Split function-parameter names by their usage shape. ARRAY EVIDENCE = a
 * subscript containing a numeric literal, a colon/slice, `end`, or a loop
 * counter; a subscripted WRITE; or cell indexing. A param whose only
 * parenthesized uses have plain variable args is CALL-SHAPED — commonly a
 * function handle (the PRMLT kernel-fn crash class). Both misreads fail
 * loudly (callable-not-subscriptable vs ndarray-not-callable); the evidence
 * rule picks the right one far more often on real code.
 */
function classifyParamUsage(
  lines: StructuredLine[],
  params: Set<string>,
  forCounters: Set<string>,
): { evidenced: Set<string>; callShaped: Set<string> } {
  const evidenced = new Set<string>()
  const callShaped = new Set<string>()
  for (const p of params) {
    let evidence = false
    let parenUse = false
    for (const line of lines) {
      if (line.isComment || !line.content.includes(p)) continue
      const c = line.content
      for (const m of c.matchAll(new RegExp(`\\b${p}\\s*\\(([^()]*)\\)`, 'g'))) {
        parenUse = true
        const parts = m[1].split(',').map(s => s.trim())
        if (parts.some(a => /^[+-]?\d/.test(a) || a.includes(':') || /\bend\b/.test(a) || forCounters.has(a))) {
          evidence = true
          break
        }
      }
      if (!evidence && new RegExp(`\\b${p}\\s*\\([^()]*\\)\\s*=(?!=)`).test(c)) evidence = true
      if (!evidence && new RegExp(`\\b${p}\\s*\\{`).test(c)) evidence = true
      if (evidence) break
    }
    if (evidence) evidenced.add(p)
    else if (parenUse) callShaped.add(p)
  }
  return { evidenced, callShaped }
}

/** Params + loop counters gathered for classifyParamUsage from converted lines. */
function collectParamsAndCounters(lines: StructuredLine[]): { params: Set<string>; counters: Set<string> } {
  const params = new Set<string>()
  const counters = new Set<string>()
  for (const line of lines) {
    if (line.isComment) continue
    const defMatch = line.content.match(/^def\s+\w+\(([^)]+)\)/)
    if (defMatch) {
      for (const p of defMatch[1].split(',').map(s => s.trim().replace(/=.*$/, '').trim()).filter(Boolean)) {
        if (p !== 'args' && !p.startsWith('*')) params.add(p)
      }
    }
    const forM = line.content.match(/^\s*for\s+(\w+)\s+in\b/)
    if (forM) counters.add(forM[1])
  }
  return { params, counters }
}

/**
 * Names that are *unambiguously* arrays, regardless of what the symbol table
 * thinks. By the time Stage 4 runs, Stage 3 has already rewritten proven
 * indexing forms into Python bracket subscripts — `v(2:end)` becomes `v[1:]`.
 * A name that is bracket-subscripted anywhere (`name[...]`) is therefore an
 * array, never a function call (MATLAB names don't switch between array and
 * function within a scope). Promoting these keeps sibling scalar subscripts
 * consistent: without it, `v(2:end)` → `v[1:]` but `v(1)` would stay `v(1)`.
 *
 * Deliberately narrower than `buildKnownArrays`: only an existing bracket
 * subscript counts as proof. A `[` opening a list literal is never preceded
 * by an identifier char (`= [1, 2]`, `array([...])`), so the `\b(\w+)\[`
 * shape can't misfire on those.
 */
function buildProvenArrays(lines: StructuredLine[]): Set<string> {
  const proven = new Set<string>()
  const subscriptPattern = /\b(\w+)\[/g
  for (const line of lines) {
    if (line.isComment || line.content.trim() === '') continue
    for (const m of line.content.matchAll(subscriptPattern)) {
      if (!isKnownFunction(m[1])) proven.add(m[1])
    }
  }
  return proven
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
  'solve_ivp', 'quad', 'find_peaks', 'axhline', 'axvline', 'lexsort',
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
  // Runs to a FIXPOINT: one scan converts only the outermost subscript
  // (`pts(np.isfinite(pts(:,1)), :)` — the inner `pts(:,1)` sits inside the
  // consumed span), so re-scan until nothing changes; the second pass then
  // converts the inner one with proper shifting. Capped defensively.
  for (let pass = 0; pass < 5; pass++) {
    const next = rewriteMultiDimIndexing(result, knownArrays ?? new Set<string>(), knownFunctions ?? new Set<string>())
    if (next === result) break
    result = next
  }

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
/**
 * containers.Map read access: `m(key)` → `m[key]` for dict-kind vars (A4).
 * Dict keys are not 1-based subscripts, so there is NO `- 1` shift. The write
 * side (`m(k) = v` → `m[k] = v`) is already converted upstream; this closes the
 * read side, which the general-indexing pass skips because the key is a string.
 */
function transformDictRead(content: string, dictNames: Set<string>): string {
  if (dictNames.size === 0) return content
  return content.replace(/\b(\w+)\(([^()]+)\)/g, (match, name: string, args: string) => {
    if (!dictNames.has(name)) return match
    if (args.includes(':')) return match // not a dict key access — leave it
    return `${name}[${args}]`
  })
}

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
      // A `[` in the args is a nested subscript that was already converted
      // (e.g. `a(b(end))` → `a(b[-1])`). Only bail when `varName` is NOT a
      // known array; for a known array we still need to bracket-index it, or
      // the outer `a(...)` is left as a call on an ndarray (TypeError).
      if (match.includes('[') && !knownArrays.has(varName)) return match
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
      // A range dim after a chain (`S{i}(1:2+n)` → `S[i - 1](1:2+n)`) is
      // 1-based MATLAB slicing — sliceify it (start-1, keep stop) instead of
      // passing the raw range through as an unshifted Python slice.
      if (t.includes(':')) return sliceifyDim(t)
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
    // NOTE: dot-preceded names are NOT skipped here — `model.F_struc(top:n, :)`
    // is struct-FIELD indexing and must convert. Method calls that merely look
    // like indexing (`g.stat_fit('fun', @(x)...)`) are excluded by the
    // lambda/quote guard below instead.
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
    const argText = source.slice(nameEnd + 1, j)
    // A converted lambda in the args means this is a CALL, not indexing — the
    // lambda's own `:` is what tripped hasTopColon. String args likewise:
    // numeric multi-dim subscripts never contain string literals.
    if (/\blambda\b|['"]/.test(argText)) { i = nameEnd + 1; continue }
    matches.push({
      start: i,
      end: j,
      name,
      args: argText,
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
      if (trimmed.includes(':')) return sliceifyDim(trimmed)
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
    // Pattern: var = signal.find_peaks(...)[0] — 0-based peak indices (from the
    // two-output findpeaks rewrite). So a later `sig(var)` → `sig[var]`.
    const fpMatch = content.match(/^\s*(\w+)\s*=\s*signal\.find_peaks\([^\n]*\)\[0\]/)
    if (fpMatch) vars.add(fpMatch[1])
    // Pattern: _, var = np.where(...) or similar multi-return
    const multiMatch = content.match(/^\s*\w+\s*,\s*(\w+)\s*=\s*.*np\.where\b/)
    if (multiMatch) vars.add(multiMatch[1])
  }
  return vars
}

// ── Array-growth-by-assignment ────────────────────────────

/**
 * Identify variables that are ONLY ever scalar- or empty-initialized and
 * never assigned an array/array-producing RHS. Writing to an out-of-bounds
 * index of such a variable is MATLAB array-growth — which raises in NumPy /
 * on a Python list — so those assignments must be flagged, not silently
 * "converted" into code that crashes at runtime.
 */
function buildGrowthVars(lines: StructuredLine[]): Set<string> {
  const scalarOrEmpty = new Set<string>()
  const everArray = new Set<string>()
  for (const line of lines) {
    if (line.isComment || line.content.trim() === '') continue
    // Plain `name = rhs` only (indexed/multi-LHS assignments don't match
    // because `name` must be immediately followed by `=`).
    const m = line.content.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+?)\s*;?\s*$/)
    if (!m) continue
    const [, name, rhs] = m
    if (/^\[\s*\]$/.test(rhs)) { scalarOrEmpty.add(name); continue }   // x = []
    if (/^-?\d+(\.\d+)?$/.test(rhs)) { scalarOrEmpty.add(name); continue } // x = 0
    everArray.add(name) // any other RHS — treat as possibly an array
  }
  // A var assigned an array anywhere is not a growth candidate.
  for (const n of everArray) scalarOrEmpty.delete(n)
  return scalarOrEmpty
}

/**
 * `VAR(end+1) = RHS` is MATLAB's append idiom. NumPy arrays are fixed-size, so
 * rewrite to `VAR = np.append(VAR, RHS)` (correct for both ndarrays and lists
 * built from `[]`) and flag it. Without this, `end+1` is index-shifted to
 * `[-1+1]` (= overwrite element 0) — silently wrong output.
 */
function rewriteEndAppend(
  content: string,
  line: StructuredLine,
  flags: Flag[],
  imports?: Set<string>,
): string {
  const eq = findTopLevelAssign(content)
  if (eq < 0) return content
  const lhs = content.slice(0, eq)
  const rhs = content.slice(eq + 1).replace(/;\s*$/, '').trim()
  const m = lhs.match(/^(\s*)([A-Za-z_]\w*)\s*\(\s*end\s*\+\s*1\s*\)\s*$/)
  if (!m) return content
  const [, indent, name] = m
  imports?.add('numpy')
  flags.push({
    type: 'WARNING',
    message: `${name}(end+1) grows the array; converted to np.append(${name}, ...). In a hot or large loop this reallocates every pass — consider building a Python list with .append() and calling np.array() once at the end.`,
    originalLine: line.originalLineStart,
    outputLine: 0,
    originalCode: line.content,
  })
  return `${indent}${name} = np.append(${name}, ${rhs})`
}

/**
 * After index transforms, a write to a scalar/empty-only variable looks like
 * `VAR[idx] = ...`. That raises in Python (can't index an int; can't grow a
 * list by out-of-bounds assignment), so flag it inline rather than emit
 * silently-broken code.
 */
function flagGrowthAssignment(
  content: string,
  growthVars: Set<string>,
  line: StructuredLine,
  flags: Flag[],
): string {
  if (growthVars.size === 0 || content.includes('# ⚠')) return content
  const eq = findTopLevelAssign(content)
  if (eq < 0) return content
  const lhs = content.slice(0, eq)
  const m = lhs.match(/^\s*([A-Za-z_]\w*)\s*\[[^\]]+\]\s*$/)
  if (!m || !growthVars.has(m[1])) return content
  const name = m[1]
  flags.push({
    type: 'WARNING',
    message: `${name} is only ever scalar/empty-initialized, so this indexed assignment relies on MATLAB array-growth. NumPy and Python lists do not grow on out-of-bounds assignment — preallocate ${name} (e.g. np.zeros(n)) or build it with np.append / list.append.`,
    originalLine: line.originalLineStart,
    outputLine: 0,
    originalCode: line.content,
  })
  return `${content}  # ⚠ WARNING: relies on MATLAB array-growth — preallocate ${name} or use np.append`
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
/**
 * Convert a MATLAB range used as ONE dim of a multidim subscript into a Python
 * slice. MATLAB `a:b` → Python `a-1:b` (the start shifts; the stop is kept
 * because MATLAB's inclusive upper bound cancels Python's exclusive one).
 * `end` → omit, `end-k` → `-k`; stepped `a:s:b` → `a-1:b:s`.
 *
 *   A(2:end-1, :)   dim "2:end-1"   → "1:-1"
 *   A(end-1:end, :) dim "end-1:end" → "-2:"
 *   A(1:2:end, :)   dim "1:2:end"   → "0::2"
 */
function sliceifyDim(dim: string): string {
  // Only act on genuine simple ranges. `rewriteMultiDimIndexing` also matches
  // function calls whose args merely contain a colon (a lambda body, a
  // `'str:str'` literal, a nested subscript) — slicing those produces syntax
  // errors. If any part isn't a plain range term, leave the dim untouched
  // (the conservative, pre-existing behavior).
  if (/['"@[\]().]|lambda/.test(dim)) return dim
  const parts = dim.split(':').map((s) => s.trim())
  if (parts.length < 2 || parts.length > 3) return dim
  // Plain arithmetic bounds (`1:2+LoN`) are safe: the stop carries over
  // unchanged (MATLAB's inclusive bound cancels Python's exclusive one) and
  // the start gets the standard `- 1`. Comparison/paren/quote dims are still
  // rejected by the guard above and by this class (no `<>=!` chars).
  const SIMPLE = /^(|end|end\s*-\s*\w+|-?\d+|[\w\s+\-*/]+)$/
  if (!parts.every((p) => SIMPLE.test(p))) return dim
  const start = (s: string): string => {
    if (s === '' || s === 'end') return ''
    if (/^\d+$/.test(s)) return String(Number(s) - 1)
    const em = s.match(/^end\s*-\s*(.+)$/)
    if (em) { const n = em[1].trim(); return /^\d+$/.test(n) ? `-${Number(n) + 1}` : `-${n} - 1` }
    return `${s} - 1`
  }
  const stop = (s: string): string => {
    if (s === '' || s === 'end') return ''
    const em = s.match(/^end\s*-\s*(.+)$/)
    if (em) return `-${em[1].trim()}`
    return s
  }
  if (parts.length === 2) return `${start(parts[0])}:${stop(parts[1])}`
  if (parts.length === 3) return `${start(parts[0])}:${stop(parts[2])}:${parts[1]}`
  return dim
}

function shiftSingleIndex(idx: string): string {
  const trimmed = idx.trim()
  if (trimmed === ':') return ':'
  if (trimmed === '') return ''
  // A string literal is never a 1-based subscript — shifting it produces
  // `'fun' - 1` garbage (seen when a method call is misread as indexing).
  if (/^['"]/.test(trimmed)) return trimmed

  // MATLAB `end` as an index: the last element is `-1`, and `end-N` is
  // `-(N+1)` (e.g. `end-1` is second-to-last → `-2`). Handle it here so a
  // standalone `end` dim isn't shifted to `end - 1` (which a downstream pass
  // would then mis-fold). Single-dim `A(end)` is handled earlier; this covers
  // multidim dims like `A(end, end)` and `A(end-1, 3)`.
  if (trimmed === 'end') return '-1'
  const endMinus = trimmed.match(/^end\s*-\s*(.+)$/)
  if (endMinus) {
    const n = endMinus[1].trim()
    return /^\d+$/.test(n) ? `-${parseInt(n, 10) + 1}` : `-${n} - 1`
  }

  // Numeric literal — shift directly
  const num = parseInt(trimmed, 10)
  if (!isNaN(num) && String(num) === trimmed) {
    return String(num - 1)
  }

  // If expression contains TOP-LEVEL arithmetic operators, don't shift —
  // the user is already computing an offset (e.g. `i-1`). Operators inside a
  // nested subscript (`b[-1]`) are not top-level: that whole expression is a
  // 1-based index value and still needs the `- 1` shift.
  const topLevel = trimmed.replace(/\[[^\][]*\]/g, '')
  if (/[+\-*/]/.test(topLevel.slice(1))) {
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
