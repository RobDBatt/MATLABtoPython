import type { StructuredLine, Flag, TransformResult } from '../types'
import type { ShapeClass } from '../analysis/shape-table'
import { FUNCTION_MAP } from '../registry/functions'
import { TOOLBOX_MAP } from '../registry/toolboxes'
import { OPERATOR_MAP } from '../registry/operators'
import { CONSTANT_MAP } from '../registry/constants'
import { replaceInCodeOnly } from '../tokenizer/string-extractor'
import { applyIdioms } from '../analysis/idioms'
import { extractNarginDefaults } from '../analysis/nargin-defaults'
import { extractArgumentsDefaults } from '../analysis/arguments-defaults'
import { extractVarargoutReturns } from '../analysis/varargout-returns'

/**
 * Stage 3: Transform
 *
 * Applies registry rules to convert MATLAB syntax to Python.
 * Processing order:
 * 1. Control flow keywords (for, while, if, function, etc.)
 * 2. Operators (element-wise before matrix — order critical)
 * 3. Known functions (core MATLAB)
 * 4. Toolbox functions
 * 5. Constants
 * 6. Special constructs (grid on, hold on, etc.)
 * 7. Unknown function calls get TODO flag
 */
export function transform(
  lines: StructuredLine[],
  shapeTable?: Map<string, ShapeClass>,
  shadowed?: Set<string>,
  arrayNames?: Set<string>,
): TransformResult {
  const imports = new Set<string>()
  const flags: Flag[] = []
  const transformed: StructuredLine[] = []

  // Pre-pass 1: Strip R2019b+ `arguments` blocks and lift simple defaults
  // into the function signature. Must run before the nargin pre-pass so
  // that lines already scheduled for removal are not double-processed.
  const {
    paramsWithDefaultsByLine: argsParams,
    linesToRemove: argsLinesToRemove,
  } = extractArgumentsDefaults(lines)

  // Pre-pass 2: Lift `if nargin < N; param = expr; end` blocks into defaults.
  // Merge the two remove sets so the main loop sees one unified set.
  const { paramsWithDefaultsByLine: narginParams, linesToRemove: narginLinesToRemove } =
    extractNarginDefaults(lines)

  // Pre-pass 3: Convert varargout{N} = expr into _vout_N = expr and
  // record the new returns comment for the function definition line.
  const { varargoutReturnsByLine, varargoutLineReplacements } =
    extractVarargoutReturns(lines)

  // Merge: nargin params take priority (they're more specific); arguments
  // params fill in gaps.
  const paramsWithDefaultsByLine = new Map([...argsParams, ...narginParams])
  const linesToRemove = new Set([...argsLinesToRemove, ...narginLinesToRemove])

  // Track current function's parameter names for nargin conversion
  let currentFuncParams: string[] = []
  _currentSwitchExpr = '' // reset switch state for each conversion

  for (const line of lines) {
    if (line.isComment || line.content.trim() === '' || line.isBlockClose) {
      // Even a block-close line can be a nargin-default `end` we elided.
      if (linesToRemove.has(line.originalLineStart)) {
        transformed.push({ ...line, content: '' })
        continue
      }
      transformed.push(line)
      continue
    }

    // Lines elided by the nargin/arguments pre-passes: emit empty content so
    // block structure stays intact and Stage 5 cleanup can collapse the gap.
    if (linesToRemove.has(line.originalLineStart)) {
      transformed.push({ ...line, content: '' })
      continue
    }

    let content = line.content

    // Apply varargout-body line replacements BEFORE any other transform.
    // The varargout pre-pass collected `varargout{N} = expr` → `_vout_N = expr`
    // mappings; swap them in here so downstream transforms see plain assignments.
    if (varargoutLineReplacements.has(line.originalLineStart)) {
      content = varargoutLineReplacements.get(line.originalLineStart)!
    }

    // Track function signatures to know parameter names
    const funcMatch = content.match(/^\s*function\s+(?:\[?[^\]]*\]?\s*=\s*)?(\w+)\s*\(([^)]*)\)/)
    if (funcMatch) {
      currentFuncParams = funcMatch[2].split(',').map(s => s.trim()).filter(Boolean)
    }

    // MATLAB function DEFINITIONS must be converted before the registry
    // replacements run — otherwise `function names = fieldnames(s)` has
    // `fieldnames(s)` rewritten to `list(s.keys())` and the subsequent
    // control-flow pass can't recover the original function name.
    const isFunctionDef = /^\s*function\b/.test(content)

    const lineFlags: Flag[] = []

    // 0. Pre-transform: MATLAB syntax that needs converting before everything else
    content = preTransform(content, imports, lineFlags, line)

    // 0b. Matrix-multiply rewrite: bare `*` → `@` when both operands are known
    // 2-D matrices per the shape table.  Must run BEFORE transformOperators
    // converts `.*` → `*`, or the two would become indistinguishable.
    if (shapeTable) {
      content = rewriteMatrixMultiply(content, shapeTable, imports)
    }

    // 1. Control flow transformations
    content = transformControlFlow(content, line, lineFlags, paramsWithDefaultsByLine, varargoutReturnsByLine)

    // On function-definition lines, the registry passes below would
    // mangle the function's name. Skip them and let the def line
    // pass through cleanly.
    if (isFunctionDef) {
      flags.push(...lineFlags)
      transformed.push({ ...line, content })
      continue
    }

    // 2. Operators (order matters — element-wise before matrix)
    content = transformOperators(content, lineFlags, line)

    // 3. Known functions
    content = transformFunctions(content, imports, lineFlags, line, shadowed)

    // 4. Toolbox functions
    content = transformToolboxFunctions(content, imports, lineFlags, line, shadowed)

    // 5. Constants (only standalone words, not parts of identifiers)
    content = transformConstants(content, imports, lineFlags, line)

    // 6. Special constructs (pass function params for nargin)
    content = transformSpecialConstructs(content, imports, lineFlags, line, currentFuncParams)

    // 7. Post-transform: convert remaining MATLAB indexing syntax
    content = postTransform(content, imports, lineFlags, line, arrayNames)

    // 8. MATLAB array-creation constants used as calls. After step 5 turned
    // `inf` and `nan` into `np.inf` / `np.nan`, any remaining `np.inf(args)`
    // / `np.nan(args)` is the MATLAB array-constructor form (`inf(1, n)`,
    // `nan(M, N)`, …). Rewrite to `np.full(...)` so the output is correct
    // and clean instead of crashing at runtime. Only handles flat arg
    // lists (no nested calls) — those still flag below.
    {
      const before = content
      content = content.replace(
        /\bnp\.(inf|nan)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
        (_, kind, args) => {
          const argList = String(args)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
          imports.add('numpy')
          const fillValue = `np.${kind}`
          if (argList.length === 0) return fillValue
          // MATLAB `inf(N)` (one arg) creates an N×N matrix, not a 1-D vector.
          if (argList.length === 1) {
            return `np.full((${argList[0]}, ${argList[0]}), ${fillValue})`
          }
          return `np.full((${argList.join(', ')}), ${fillValue})`
        },
      )
      // If anything still looks like `np.inf(...)`/`np.nan(...)` (nested
      // call args our flat regex couldn't unpack), keep the warning so
      // the user knows the output won't run.
      if (content === before && /\bnp\.(inf|nan)\s*\(/.test(content)) {
        lineFlags.push({
          type: 'WARNING',
          message: 'np.inf / np.nan are scalars, not callable — MATLAB inf(M, N) creates an array. Replace with `np.full((M, N), np.inf)` (or `np.nan`).',
          originalLine: line.originalLineStart,
          outputLine: 0,
          originalCode: content,
        })
      }
    }

    flags.push(...lineFlags)
    transformed.push({ ...line, content })
  }

  return { transformed, imports, flags }
}

/**
 * Strip MATLAB block-terminator tails off the body of a single-line
 * `if cond, body[, end]` / `if cond, body; end` form. Handles all four
 * shapes the comma-body regex can pass through:
 *
 *   `break, end`   → `break`
 *   `break; end`   → `break`
 *   `break`        → `break`
 *   `x = 1, end`   → `x = 1`
 */
function cleanInlineBody(body: string): string {
  return body
    .replace(/\s*[,;]\s*end\s*$/, '')
    .replace(/\s*;\s*$/, '')
    .replace(/:\s*$/, '')
    .trim()
}

/**
 * Index of the first top-level (depth-0, outside strings) comma in `s`,
 * or -1 if none. Used to split MATLAB inline `if cond, body, end` forms
 * where the condition itself can contain function calls with commas
 * (e.g. `if size(ud,2)<13, error('msg'), end`).
 */
function findTopLevelComma(s: string): number {
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (ch === sc && s[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) return i
  }
  return -1
}

// ── Pre-Transform (MATLAB syntax normalization) ───────────

/**
 * Map of bsxfun's MATLAB function-handle first arg → Python operator.
 * Used by `convertBsxfun` to rewrite the most common bsxfun forms into
 * direct numpy broadcasting expressions.
 */
const BSXFUN_OPS: Record<string, string> = {
  plus: '+', minus: '-', times: '*', rdivide: '/', ldivide: '/',
  power: '**',
  eq: '==', ne: '!=', lt: '<', le: '<=', gt: '>', ge: '>=',
  and: '&', or: '|',
  max: 'np.maximum', min: 'np.minimum',
}

/**
 * Convert MATLAB `bsxfun(@op, A, B)` to numpy broadcasting. For arithmetic
 * and comparison ops, emits `A op B` directly. For min/max, emits a
 * function call. Unknown handles are left as-is and flagged so the user
 * knows the converter couldn't make a safe rewrite.
 */
function convertBsxfun(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  if (!content.includes('bsxfun')) return content
  return replaceFunctionCalls(content, 'bsxfun', (_full, args) => {
    const argList = splitArgsRespectingStrings(args).map((s) => s.trim())
    if (argList.length !== 3) {
      flags.push({
        type: 'WARNING',
        message: 'bsxfun → numpy broadcasting — non-standard arg count, manual review needed',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: _full,
      })
      return _full
    }
    const op = argList[0].replace(/^@/, '')
    const a = argList[1]
    const b = argList[2]
    const py = BSXFUN_OPS[op]
    if (!py) {
      flags.push({
        type: 'WARNING',
        message: `bsxfun(@${op}, ...) has no automatic numpy broadcasting equivalent — replace with the appropriate elementwise operation`,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: _full,
      })
      return _full
    }
    if (py.startsWith('np.')) {
      imports.add('numpy')
      return `${py}(${a}, ${b})`
    }
    return `(${a} ${py} ${b})`
  })
}

function preTransform(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  // Pattern-rewrite common multi-token idioms BEFORE the piecewise
  // transforms see them. Handles things like `zeros(size(X))` →
  // `np.zeros_like(X)` and `[~, idx] = max(X)` → `idx = np.argmax(X)`.
  const idiomResult = applyIdioms(result)
  result = idiomResult.code
  for (const imp of idiomResult.imports) imports.add(imp)

  // Convert bsxfun calls to direct broadcasting (or flag if we can't).
  // Must run before the generic function-handle stripper turns `@plus`
  // into a bare undefined name `plus`.
  result = convertBsxfun(result, imports, flags, line)

  // MATLAB imaginary unit: 1i → 1j, 2i → 2j, 3.14i → 3.14j
  // Must run early before other transforms touch these
  result = result.replace(/(\d+\.?\d*)[ij](?!\w)/g, '$1j')
  result = result.replace(/(\d+\.?\d*e[+-]?\d+)[ij](?!\w)/g, '$1j')

  // MATLAB `dot(X, Y, dim)` (3-arg form) computes a sum along an axis,
  // not a vector dot product. np.dot has no `dim` arg, so this form
  // can't go through the registry. Rewrite directly to np.sum so the
  // common case (dim=1 or dim=2) produces drop-in correct Python.
  // Only handles flat args (no nested parens) — exotic forms still flag
  // through the registry path.
  result = result.replace(
    /\bdot\s*\(([^,()]+),\s*([^,()]+),\s*([^,()]+)\)/g,
    (_, x, y, dim) => {
      imports.add('numpy')
      return `np.sum(${x.trim()} * ${y.trim()}, axis=${dim.trim()} - 1)`
    },
  )

  // MATLAB file handle 1 = stdout: fprintf(1, ...) → print(...)
  result = result.replace(/\bfprintf\(1\s*,\s*(.+)\)/, (_, args) => {
    return `print(${args.trim()})`
  })

  // MATLAB file handle 2 = stderr: fprintf(2, ...) → sys.stderr.write(...)
  result = result.replace(/\bfprintf\(2\s*,\s*(.+)\)/, (_, args) => {
    imports.add('sys')
    return `sys.stderr.write(${args.trim()})`
  })
  // Bare 2, 'message') → sys.stderr.write('message') (partially converted form)
  result = result.replace(/^\s*2\s*,\s*('.*')\s*\)/, (_, msg) => {
    imports.add('sys')
    return `sys.stderr.write(${msg})`
  })

  // `out = error('msg')` — MATLAB error() never returns, so the assignment is
  // dead. Drop the LHS (otherwise `out = raise ValueError(...)` is a syntax error).
  result = result.replace(/^(\s*)\w+\s*=\s*(error\s*\()/, '$1$2')

  // classdef Name → class Name: (with optional < Parent → (Parent))
  // Emits valid Python class syntax so files parse even before full OOP conversion.
  if (/^\s*classdef\b/.test(result)) {
    // Strip the attribute block: `classdef (Abstract, Sealed) Name` → `classdef Name`.
    result = result.replace(/^(\s*classdef)\s*\([^)]*\)/, '$1')
    const sup = result.match(/^(\s*)classdef\s+(\w+)\s*<\s*([\w.\s&]+?)\s*$/)
    if (sup) {
      // Drop MATLAB's `handle` base (Python is reference-by-default); `A & B`
      // multiple inheritance → `A, B`.
      const parents = sup[3].split('&').map(s => s.trim()).filter(p => p && p !== 'handle')
      result = parents.length ? `${sup[1]}class ${sup[2]}(${parents.join(', ')}):` : `${sup[1]}class ${sup[2]}:`
    } else {
      result = result.replace(/^(\s*)classdef\s+(\w+)\s*$/, '$1class $2:')
    }
  }

  // properties/methods block headers inside classdef — convert to comments so
  // the Python class body is syntactically valid. The TODO flags (from detector.ts)
  // already tell the user to move these into __init__ / add self.
  if (/^\s*properties\b/.test(result) && !/=/.test(result)) {
    result = result.replace(/^(\s*)properties(\s.*)?$/, '$1# --- properties$2---')
  }
  if (/^\s*methods\b/.test(result) && !/[=(]/.test(result)) {
    result = result.replace(/^(\s*)methods(\s.*)?$/, '$1# --- methods$2---')
  }

  // `else, body` / `else; body` / `else body` — MATLAB inline else body.
  // Split into `else:\n    body` so the output is valid Python.
  // Handles three MATLAB separators: comma, semicolon, or bare space.
  {
    const elseInline = result.match(/^(\s*)else\s*[,;]\s*(.+)$/) ||
                       result.match(/^(\s*)else\s+(?!:)(.+)$/)
    if (elseInline) {
      const [, indent, body] = elseInline
      result = `${indent}else:\n${indent}    ${body.trimEnd()}`
    }
  }

  // mex/make build commands — always comment out regardless of argument syntax
  // (the general command-form handler below excludes `=` chars, missing `mex CFLAGS=...`)
  if (/^\s*mex\b/.test(result) || /^\s*make\b/.test(result)) {
    result = `# ❌ UNSUPPORTED: ${result.trim()} — MEX/C extension, out of scope for converter`
  }

  // Remove MATLAB trailing commas in conditions: if x>0, → if x>0
  // MATLAB allows trailing comma after condition before newline
  result = result.replace(/^(\s*(?:if|elseif|while)\s+.+),\s*$/, '$1')

  // MATLAB command-form syntax: `load map1`, `warning off`, `clear all` —
  // no parens, space-separated args treated as string literals. Python
  // doesn't have this form, so either rewrite with quoted args or
  // comment out (for no-op commands like clear/clc/format).
  //
  // Match `NAME ARG[S]` at start-of-line where NAME is a known
  // command-form builtin. Excludes assignments (= would prevent match).
  //
  // Note: `hold on/off`, `grid on/off`, `figure` without args are handled
  // later by transformSpecialConstructs — don't steal those here.
  {
    const cmd = result.match(/^(\s*)(load|warning|clear|clc|format|save|doc|help|type|mex|make|xlabel|ylabel|zlabel|title|legend|colorbar|colormap|subplot)\s+([^\s=(][^=\n]*?)\s*$/)
    if (cmd) {
      const [, indent, name, args] = cmd
      const trimmedArgs = args.trim()
      if (name === 'mex' || name === 'make') {
        result = `${indent}# ❌ UNSUPPORTED: ${result.trim()} — MEX/C extension, out of scope for converter`
      } else if (name === 'xlabel' || name === 'ylabel' || name === 'zlabel' || name === 'title' || name === 'legend' || name === 'colorbar') {
        imports.add('matplotlib.pyplot')
        result = `${indent}plt.${name}(${trimmedArgs})`
      } else if (name === 'colormap') {
        imports.add('matplotlib.pyplot')
        result = `${indent}plt.set_cmap(${trimmedArgs})`
      } else if (name === 'subplot') {
        imports.add('matplotlib.pyplot')
        result = `${indent}plt.subplot(${trimmedArgs})`
      } else if (name === 'clear' || name === 'clc' || name === 'format' || name === 'warning') {
        result = `${indent}# ${result.trim()} — MATLAB command; no direct Python equivalent`
      } else if (name === 'load') {
        result = `${indent}${name}('${trimmedArgs}')  # ⚠ MATLAB load: consider scipy.io.loadmat for .mat files`
      } else if (name === 'save') {
        result = `${indent}# ${result.trim()} — use numpy.save / scipy.io.savemat`
      } else {
        result = `${indent}# ${result.trim()} — MATLAB command-form call, manual review`
      }
    }
  }

  // MATLAB path commands (addpath/rmpath/savepath/rehash) have no Python
  // equivalent — Python uses imports / sys.path. Comment the whole line out as
  // a clear no-op. Handled early so inner calls like `genpath(pwd)` aren't
  // separately transformed. Covers both function-call form `addpath(genpath(
  // pwd))` and command form `addpath ./lib`. `path` is intentionally excluded
  // (too common as a variable name).
  {
    const pathCmd = result.match(/^\s*(addpath|rmpath|savepath|rehash)\b/)
    if (pathCmd) {
      result = `# ${result.trim()} — MATLAB path command; use Python imports / sys.path`
    }
  }

  // Convert MATLAB `~` logical-NOT to Python `not`.
  // MATLAB `~` is logical NOT (returns true/false for scalars). Python `~`
  // is bitwise NOT, which gives wrong semantics for booleans: `~True == -2`
  // is truthy, so `if ~isequal(a, b):` always enters the branch. Handle
  // the common cases:
  //   `if ~X` / `elif ~X` / `while ~X` → `if not X` / ...
  //   standalone `~identifier(args)` / `~identifier` / `~(expr)` on RHS
  // We avoid converting `~=` (already handled as `!=`) and `[~, ...]`
  // (discard syntax) by requiring a non-`=` and non-`,` char to follow.
  //
  // Python note: after a comparison operator (`==`, `!=`, `<`, `>`, `<=`,
  // `>=`), the RHS cannot be `not expr` without parens — Python's parser
  // rejects it. So when `~` sits between a comparison and a bare `not X`
  // would be ambiguous, we wrap the `not` expression in parens.
  result = replaceInCodeOnly(
    result,
    /(^|[\s,(=<>!&|])~(?!=)(\s*)(\w|\()/g,
    (...matchArgs: unknown[]) => {
      const prefix = matchArgs[1] as string
      const next = matchArgs[3] as string
      // If prefix is a comparison-tail character (space after `!=`, `==`,
      // etc.) Python needs parens around `not X`. Detect by looking at
      // the `prefix` + what precedes in the full line — simplest heuristic:
      // if prefix ends with a space or is empty (line start), no wrap;
      // if it ends with `=`, `>`, `<`, `&`, `|`, `!`, we're after an
      // operator and need parens.
      const needsParen = /[=<>!&|]$/.test(prefix)
      if (needsParen) {
        return `${prefix} (not ${next}`.replace(/  +/g, ' ') + '__WRAP_NOT__'
      }
      return `${prefix}not ${next}`.replace(/  +/g, ' ')
    },
  )
  // Close the `(not ...)` wraps inserted above.
  if (result.includes('__WRAP_NOT__')) {
    result = result.replace(
      /__WRAP_NOT__([^\s,)\]}]*)/g,
      (_, tail: string) => `${tail})`,
    )
  }

  // Post-pass: wrap `not X` after comparison operators. The `~ → not`
  // transform above only sees the char directly preceding `~`; it can't
  // predict that `i ~= ~isfinite(b)` will later become `i != not np.isfinite(b)`
  // after `~=` is rewritten to `!=`. Catch that here by scanning for
  // `<op> not <balanced-expr>` and wrapping the RHS in parens.
  result = wrapNotAfterComparison(result)

  // Transpose was resolved in Stage 0 (resolveQuotes): both `.'` and `'`
  // that were transpose operators are already `.T`. Any `'` reaching here
  // is part of a string literal and must not be touched.

  // ispc → sys.platform == 'win32'
  result = result.replace(/\bispc\b/g, "sys.platform == 'win32'")
  // isunix → sys.platform != 'win32'
  result = result.replace(/\bisunix\b/g, "sys.platform != 'win32'")
  // ismac → sys.platform == 'darwin'
  result = result.replace(/\bismac\b/g, "sys.platform == 'darwin'")
  if (/sys\.platform/.test(result)) imports.add('sys')

  // nargout → flag (no direct Python equivalent)
  if (/\bnargout\b/.test(result)) {
    // Leave nargout as-is but it's flagged in special constructs
  }

  // varargin → *args conversion
  // In function signatures: varargin → *args
  // When varargin is the only/first parameter, don't prepend a comma or
  // the signature ends up as `def foo(, *args)` (syntax error).
  result = result.replace(
    /^(\s*function\s+(?:\[?[^\]]*\]?\s*=\s*)?\w+\s*\()([^)]*)\bvarargin\b([^)]*\))/,
    (match, prefix, inner, after) => {
      const beforeVar = inner.replace(/,\s*$/, '')
      const afterVar = after.replace(/^\s*,/, '')
      const sep = beforeVar.trim() === '' ? '' : ', '
      return `${prefix}${beforeVar}${sep}*args${afterVar}`
    },
  )
  // In function bodies: varargin{i} → args[i-1], varargin{:} → *args
  result = result.replace(/\bvarargin\{:\}/g, '*args')
  // General cell-unpack: bare `name{:}` → `*name`. Conservative form to
  // avoid matching `strct.field{:}` and breaking other transforms; a
  // follow-up cleanup handles chained forms if needed.
  result = result.replace(/\b(\w+)\{:\}/g, '*$1')
  // length(varargin) → len(args) (before varargin→args rename, before length→np.max)
  result = result.replace(/\blength\(varargin\)/g, 'len(args)')
  result = result.replace(/\bnumel\(varargin\)/g, 'len(args)')
  // fprintf(fid, varargin{:}) → fid.write(args[0] % args[1:]) — special case
  result = result.replace(/\bfprintf\((\w+),\s*varargin\{:\}\)/g, '$1.write(args[0] % args[1:] if len(args) > 1 else args[0])')
  // fprintf(varargin{:}) → print(args[0] % args[1:])
  result = result.replace(/\bfprintf\(varargin\{:\}\)/g, 'print(args[0] % args[1:] if len(args) > 1 else args[0], end="")')
  result = result.replace(/\bvarargin\b/g, 'args')

  // (isempty now produces len(x) == 0 which works for arrays, lists, and strings)

  // Single-line if/else with commas: `if x, y=1; end` / `if x, y=1, end` →
  // `if x: y=1`. Walk to find the first TOP-LEVEL comma so condition parens
  // like `if size(ud,2)<13, error('msg'), end` don't trip the split.
  {
    const m = result.match(/^(\s*)if\s+(.+)$/)
    if (m) {
      const indent = m[1]
      const rest = m[2]
      const commaIdx = findTopLevelComma(rest)
      if (commaIdx >= 0) {
        const cond = rest.slice(0, commaIdx).trim()
        let body = rest.slice(commaIdx + 1).trim()
        // Strip a trailing `end` (with leading `,`, `;`, or whitespace).
        body = body.replace(/[\s,;]*end\s*$/, '').trim()
        if (cond && body) {
          const elseMatch = body.match(/^(.+?)\s*;\s*else\s*,?\s*(.+)$/)
          if (elseMatch) {
            result = `${indent}if ${cond}:\n${indent}    ${elseMatch[1].trim()}\n${indent}else:\n${indent}    ${cleanInlineBody(elseMatch[2])}`
          } else {
            result = `${indent}if ${cond}:\n${indent}    ${cleanInlineBody(body)}`
          }
        }
      }
    }
  }

  // Cell array literal: {'a', 'b', 'c'} → ['a', 'b', 'c']
  // Only match when { is at the start of an assignment RHS or standalone (not indexing like C{1})
  result = result.replace(
    /(?<!\w)\{([^{}]*)\}/g,
    (match, inner) => {
      // If inner contains only string literals and/or numbers separated by commas — it's a cell literal
      const trimmed = inner.trim()
      if (!trimmed) return match
      // Check it looks like a literal (strings, numbers, variables separated by commas)
      if (/^['"\w]/.test(trimmed) && !trimmed.includes(':') && !trimmed.includes('=')) {
        return `[${inner}]`
      }
      return match
    },
  )

  // Cell array range slicing: C{1:end-1} → C[:-1], C{1:end} → C[:], C{2:end} → C[1:]
  // Must run BEFORE any range handler touches the colon inside {}
  result = result.replace(/(\w+)\{1\s*:\s*end\s*-\s*1\}/g, '$1[:-1]')
  result = result.replace(/(\w+)\{1\s*:\s*end\}/g, '$1[:]')
  result = result.replace(/(\w+)\{(\d+)\s*:\s*end\}/g, (_, v, start) => {
    return `${v}[${parseInt(start, 10) - 1}:]`
  })
  result = result.replace(/(\w+)\{(\d+)\s*:\s*(\d+)\}/g, (_, v, start, end) => {
    return `${v}[${parseInt(start, 10) - 1}:${end}]`
  })

  // 1D. Anonymous functions: @(x) x.^2 → lambda x: x**2
  // Must run BEFORE function handle removal (1B)
  result = result.replace(
    /@\(([^)]*)\)\s*/g,
    (match, args) => {
      // Find the body — everything after @(args) until end of expression
      // The body continues until: semicolon, comma at depth 0, or end of string
      return `lambda ${args}: `
    },
  )

  // 1B. Function handle removal: @func → func (after anonymous functions handled)
  result = result.replace(/(?<!\w)@(\w+)/g, '$1')

  // 4C. Struct creation: struct('key', val, 'key2', val2) → {'key': val, 'key2': val2}
  // Uses balanced paren matching to handle nested function calls like ci_boot(1)
  result = convertStructCreation(result)

  // 1A + Multiple return assignment: [a, b] = func() → a, b = func()
  // Also handles tilde discard: [~, idx] → _, idx
  // Handles both [a, b] and [a b] (space-separated) MATLAB syntax
  result = result.replace(
    /^\s*\[([^\]]+)\]\s*=\s*/,
    (_, vars) => {
      // Split on commas first; if no commas, split on whitespace
      let varList: string[]
      if (vars.includes(',')) {
        varList = vars.split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      } else {
        varList = vars.trim().split(/\s+/)
          .filter(Boolean)
      }
      varList = varList.map((v: string) => v === '~' ? '_' : v)
      return `${varList.join(', ')} = `
    },
  )

  // Inline range expressions (not in for loops): (0:N-1) → np.arange(0, N)
  // Match (start:end) but ONLY when NOT preceded by a word char (which would be indexing)
  // e.g. "(0:L-1)" is a range, but "y2(N/2:end)" is indexing
  if (!/^\s*(for|parfor)\b/.test(content)) {
    // First: handle ranges with function calls like (0:length(data)-1)
    // These have nested parens so the simple regex won't catch them
    result = result.replace(
      /([^a-zA-Z0-9_]|^)\((\d+)\s*:\s*(\w+\([^)]*\)\s*[-+*/]\s*\d+|\w+\([^)]*\))\)/g,
      (match, prefix, start, endExpr) => {
        if (/['"]/.test(endExpr)) return match
        imports.add('numpy')
        // Check for -1 pattern: length(x)-1 means we want 0..length-1 which is range(length)
        const minusOneMatch = endExpr.match(/^(.+)\s*-\s*1$/)
        if (minusOneMatch && start === '0') {
          return `${prefix}np.arange(${minusOneMatch[1].trim()})`
        }
        return `${prefix}np.arange(${start.trim()}, ${endExpr.trim()} + 1)`
      },
    )

    // Two-part range: (expr:expr) — simple exprs without nested parens
    // Commas excluded from the inner classes so the non-greedy match can't
    // cross argument boundaries: `(1,:,:)` is a multi-dim subscript args
    // list, NOT a range, and was previously being mangled to
    // `np.arange(1,, ,: + 1)` because the regex matched start=`1,` end=`,:,`.
    result = result.replace(
      /([^a-zA-Z0-9_]|^)\(([^(),]*?):([^(),]*?)\)/g,
      (match, prefix, start, end) => {
        // Skip if this looks like it contains 'end' keyword (that's indexing)
        if (end.trim() === 'end' || start.trim() === 'end') return match
        // Skip if start or end contain quotes (string args)
        if (/['"]/.test(start) || /['"]/.test(end)) return match
        // Must have at least one numeric-looking part to be a range
        if (!/\d/.test(start) && !/\d/.test(end) && !/\w/.test(start)) return match
        imports.add('numpy')
        return `${prefix}np.arange(${start.trim()}, ${end.trim()} + 1)`
      },
    )

    // Three-part range: (expr:expr:expr)
    result = result.replace(
      /([^a-zA-Z0-9_]|^)\(([^(),]*?):([^(),]*?):([^(),]*?)\)/g,
      (match, prefix, start, step, end) => {
        if (/['"]/.test(start) || /['"]/.test(end)) return match
        imports.add('numpy')
        return `${prefix}np.arange(${start.trim()}, ${end.trim()} + 1, ${step.trim()})`
      },
    )
  }

  return result
}

// ── Post-Transform (remaining MATLAB syntax) ──────────────

/**
 * MATLAB `isfield(S, F)` tests whether struct S has field F. Structs convert to
 * Python dicts (`struct(...)` → `{...}`), so the test is dict membership with
 * the arguments reversed: `F in S`.
 *
 *   isfield(s, 'name')   →  'name' in s
 *   tf = isfield(s, f)   →  tf = f in s
 *   ~isfield(s, 'name')  →  not 'name' in s   (the ~→not pass already ran;
 *                            `in` binds tighter than `not`, so no parens needed)
 *
 * Emitted unparenthesized for clean output — correct in every boolean /
 * assignment / logical context (the common cases). The cell-array field-list
 * form `isfield(s, {'a','b'})` returns a logical ARRAY in MATLAB (no clean
 * one-liner) — left unconverted and flagged.
 */
function convertIsfield(
  content: string,
  flags: Flag[],
  line: StructuredLine,
): string {
  if (!/\bisfield\s*\(/.test(content)) return content
  return replaceFunctionCalls(content, 'isfield', (full, args) => {
    const argList = splitArgsRespectingStrings(args).map(s => s.trim())
    if (argList.length !== 2 || argList[0] === '' || argList[1] === '') return full
    const [s, f] = argList
    // Multi-field form: by here a cell `{...}` may already be a list `[...]`.
    // Either way it's a logical-array result, not a scalar membership test.
    if (/^[[{]/.test(f)) {
      flags.push({
        type: 'TODO',
        message: 'isfield(s, {fields}) tests multiple fields and returns a logical array — convert manually, e.g. np.array([k in s for k in [...]]).',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
      return full
    }
    return `${f} in ${s}`
  })
}

function postTransform(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
  arrayNames?: Set<string>,
): string {
  let result = content

  // isfield(s, 'f') → 'f' in s (structs convert to dicts). Runs here, after
  // the ~→not pass in preTransform, so `~isfield(...)` is already `not
  // isfield(...)` and becomes `not 'f' in s`.
  result = convertIsfield(result, flags, line)

  // Convert MATLAB plot named arguments: 'LineWidth', 1.5 → linewidth=1.5
  result = convertMatlabNamedArgs(result)

  // Convert MATLAB reverse-slice and `end` idioms FIRST, before the generic
  // range handlers get confused (e.g. `v(end:-1:1)` must become `v[::-1]`,
  // not a mangled np.arange call).
  result = convertEndIdioms(result)

  // Convert MATLAB indexing: varName(expr:end) → varName[expr:]
  //
  // NOTE: LHS `A(i) = v` is handled by Stage 4 (index shifting) — the
  // symbol-table pre-pass ensures `A` is classified as a variable there,
  // so `()` on LHS gets converted to `[]` with 1→0 shifting. Running a
  // dedicated LHS converter here would strip the parens but not the
  // shift, causing `A[i]` instead of `A[i - 1]`.
  result = convertMatlabIndexing(result, content)

  // Convert complex standalone range expressions: -(N/2):(N/2)-1 → np.arange(...)
  result = convertComplexRanges(result, imports, flags, line, arrayNames)

  // ── find → numpy translation ──────────────────────────────
  // Context-aware (registry-bypass; see registry/functions.ts):
  //   `[r, c] = find(M)`   → `r, c = np.where(M)`              (tuple unpack)
  //   `find(c, 1, 'first')`→ `np.flatnonzero(c)[0]`
  //   `find(c, 1, 'last')` → `np.flatnonzero(c)[-1]`
  //   `find(c)`            → `np.flatnonzero(c)`               (1D linear indices)
  //
  // np.flatnonzero is the right primitive for the single-output form: it
  // returns a 1D array of indices into the flattened input, which is what
  // MATLAB code uses single-output find for (boolean masking, looping,
  // etc.). np.where with `[0]` post-fix happened to work but produced
  // broken Python whenever find appeared inside another expression.
  if (/\bfind\s*\(/.test(result)) {
    // Multi-return path: preTransform already turned `[r, c] = find(M)`
    // into `r, c = find(M)`. Match that Python-style LHS, then preserve
    // the np.where tuple-shape.
    //
    // Three-output `[r, c, v] = find(M)` is special: MATLAB returns the
    // values as a third array; np.where doesn't have that. Emit a warning
    // and a hint comment.
    result = result.replace(
      /^(\s*)(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*=\s*find\s*\(([^)]*)\)/,
      (_, indent, a, b, c, args) => {
        imports.add('numpy')
        flags.push({
          type: 'WARNING',
          message: `[r, c, v] = find(M) → np.where returns only (rows, cols). After this line, set ${c} = M[${a}, ${b}] to recover the values array.`,
          originalLine: line.originalLineStart,
          outputLine: 0,
          originalCode: content,
        })
        // Emit a *valid Python* line that captures rows/cols. The values
        // recovery is left to the user (flagged above). Inlining a `# …`
        // comment here breaks Stage 4's bracket/paren rewrite when the
        // `find(...)` arg itself contains a function call.
        return `${indent}${a}, ${b} = np.where(${args.trim()})`
      },
    )
    result = result.replace(
      /^(\s*)(\w+)\s*,\s*(\w+)\s*=\s*find\s*\(([^)]*)\)/,
      (_, indent, a, b, args) => {
        imports.add('numpy')
        return `${indent}${a}, ${b} = np.where(${args.trim()})`
      },
    )

    // Single-output path: walk all remaining `find(...)` calls with balanced
    // bracket matching so we handle nested expressions like `x(find(c))`.
    result = rewriteFindCallsToFlatnonzero(result, imports)
  }

  // Flag any remaining colon `:` outside of strings/slices/brackets that looks like a MATLAB range
  if (/:/.test(result) && !result.includes('#') && !result.includes('lambda') && !/^\s*(for|elif|else|if|while|def|try|except|case)/.test(result)) {
    // Strip all contexts where colons are valid Python (slicing, dicts, strings, ranges)
    const stripped = result
      .replace(/\[(?:[^\[\]]|\[[^\]]*\])*\]/g, '')  // remove bracket contents incl. one level of nesting (Python slicing)
      .replace(/\{[^}]*\}/g, '')         // remove dict literals (key: value)
      .replace(/'[^']*'/g, '')           // remove single-quoted strings
      .replace(/"[^"]*"/g, '')           // remove double-quoted strings
      .replace(/np\.arange\([^)]*\)/g, '')  // remove already-converted ranges
      .replace(/,\s*:\s*(?=[,)\]]|$)/g, ',')  // numpy all-elements dimension (arr[i, :] / arr[i, :, j])
      .replace(/:\s*$/g, '')             // remove trailing colon (Python block syntax)
      .replace(/\([^)]*:[^)]*\)/g, '')  // remove parens with colons inside (function args with slices)
    if (/:/.test(stripped)) {
      flags.push({
        type: 'TODO',
        message: 'Unconverted range (:) found — replace start:end with np.arange(start, end+1) or start:step:end with np.arange(start, end+1, step). For array slicing, use Python slice notation arr[start:end].',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  return result
}

// ── Plot Named Arguments ──────────────────────────────────

/** MATLAB to Python property name mapping for plot functions */
const PLOT_PROP_MAP: Record<string, string> = {
  'linewidth': 'linewidth',
  'linestyle': 'linestyle',
  'color': 'color',
  'marker': 'marker',
  'markersize': 'markersize',
  'markerfacecolor': 'markerfacecolor',
  'markeredgecolor': 'markeredgecolor',
  'displayname': 'label',
  'fontsize': 'fontsize',
  'fontweight': 'fontweight',
  'fontname': 'fontname',
  'horizontalalignment': 'ha',
  'verticalalignment': 'va',
  'interpreter': 'interpreter',  // flag — matplotlib doesn't use this the same way
  'location': 'loc',
}

/**
 * Convert MATLAB 'Name', Value pairs to Python name=value kwargs.
 * e.g. plot(x, y, 'r', 'LineWidth', 1.5) → plt.plot(x, y, 'r', linewidth=1.5)
 * e.g. legend('a', 'b', 'Location', 'Best') → plt.legend(['a', 'b'], loc='best')
 */
function convertMatlabNamedArgs(content: string): string {
  // Only process lines that have plt. calls (already converted from MATLAB plot functions)
  if (!content.includes('plt.')) return content

  let result = content

  // Special handling for plt.legend — wrap string label args in a list
  result = result.replace(
    /plt\.legend\(([^)]+)\)/g,
    (match, argsStr) => {
      const args = splitFormatArgs(argsStr)
      const labels: string[] = []
      const kwargs: string[] = []
      let i = 0
      while (i < args.length) {
        const arg = args[i].trim()
        // Check if this is a named property (starts with uppercase in quotes)
        const propMatch = arg.match(/^'([A-Z]\w+)'$/)
        if (propMatch && i + 1 < args.length) {
          const pyProp = PLOT_PROP_MAP[propMatch[1].toLowerCase()]
          if (pyProp) {
            let val = args[i + 1].trim()
            if (val.startsWith("'") || val.startsWith('"')) {
              val = `'${val.slice(1, -1).toLowerCase()}'`
            }
            kwargs.push(`${pyProp}=${val}`)
            i += 2
            continue
          }
        }
        // It's a label string
        labels.push(arg)
        i++
      }
      const parts: string[] = []
      if (labels.length > 0) {
        parts.push(`[${labels.join(', ')}]`)
      }
      parts.push(...kwargs)
      return `plt.legend(${parts.join(', ')})`
    },
  )

  // Match MATLAB name-value pairs for other plot functions: 'PropertyName', value
  let changed = true
  while (changed) {
    changed = false
    result = result.replace(
      /,\s*'([A-Z]\w+)'\s*,\s*('(?:[^']*)'|"(?:[^"]*)"|[\d.]+(?:e[+-]?\d+)?|\w+)(\s*[,)])/,
      (match, propName, value, trailing) => {
        const pyProp = PLOT_PROP_MAP[propName.toLowerCase()]
        if (pyProp) {
          changed = true
          let pyValue = value
          if (pyValue.startsWith("'") || pyValue.startsWith('"')) {
            const inner = pyValue.slice(1, -1).toLowerCase()
            pyValue = `'${inner}'`
          }
          return `, ${pyProp}=${pyValue}${trailing}`
        }
        return match
      },
    )
  }

  return result
}

// ── Complex Range Expressions ─────────────────────────────

/**
 * Convert complex standalone MATLAB range expressions that the simple
 * preTransform regex couldn't handle. These have nested parens or
 * arithmetic inside the range bounds.
 *
 * Examples:
 *   (-(N/2):(N/2)-1)  →  np.arange(-(N/2), (N/2)-1 + 1)
 *   Fs*(0:(L/2))/L    →  Fs*np.arange(0, (L/2) + 1)/L
 */
/**
 * True if the text ending at `before` sits inside the argument list of a
 * `name(` where `name` is a known array variable — i.e. the range under
 * consideration is a subscript dim (`A(2:end-1, ...`), not a function-call
 * argument (`plot(0:N`). Used to keep array slices out of the np.arange pass
 * so Stage 4 can turn them into Python slices.
 */
function isInArraySubscript(before: string, arrayNames?: Set<string>): boolean {
  if (!arrayNames || arrayNames.size === 0) return false
  let paren = 0
  let bracket = 0
  for (let i = before.length - 1; i >= 0; i--) {
    const c = before[i]
    if (c === ')') paren++
    else if (c === '(') {
      if (paren === 0) {
        if (bracket > 0) return false // already inside a [...] slice
        const name = before.slice(0, i).match(/([A-Za-z_]\w*)\s*$/)
        // Must be a known array AND not also a hardcoded Python builtin like
        // `str`/`max` — those are treated as function calls downstream, so the
        // range still needs np.arange conversion here (skipping leaves an
        // invalid `str(1:end-1)`).
        return !!name && arrayNames.has(name[1]) && !isKnownPythonFunc(name[1])
      }
      paren--
    } else if (c === ']') bracket++
    else if (c === '[') {
      if (bracket === 0) return false // directly inside an open [...]
      bracket--
    }
  }
  return false
}

function convertComplexRanges(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
  arrayNames?: Set<string>,
): string {
  // Earlier transforms (try/otherwise with inline bodies, single-line
  // if/else) may have injected `\n`. Those newlines leave a `try:` or
  // `else:` block-opener on a preceding segment, which the range
  // matcher would mistake for a MATLAB range `try:promo_time`. Run on
  // each segment independently so block-opening colons can't bleed into
  // a range match.
  if (content.includes('\n')) {
    return content
      .split('\n')
      .map(seg => convertComplexRanges(seg, imports, flags, line, arrayNames))
      .join('\n')
  }
  if (!/^\s*(for|parfor|def|if|elif|while)\b/.test(content) && !content.includes('#') && !content.includes('lambda')) {
    // Look for colon that's NOT inside brackets, strings, or already converted
    // Strategy: find bare colons and check if they look like range expressions
    let result = content

    // Pattern: expr1:expr2 where neither side contains = or comparison operators
    // and the line isn't a slice (no [ before the colon)
    const stripped = result.replace(/'[^']*'/g, 'STR').replace(/"[^"]*"/g, 'STR').replace(/\[[^\]]*\]/g, 'BRK')

    // Find colons that are range operators (not in slices, not in Python syntax)
    if (/:/.test(stripped) && !/:\s*$/.test(stripped)) {
      // 3-part range FIRST: expr:step:stop — MATLAB `a:s:b` means every
      // s-th element from a to b inclusive. Python equivalent that handles
      // both integer and non-integer steps is `np.arange(a, b + s, s)`.
      // Must run before the 2-part matcher, which would otherwise match
      // `a:s` and leave `:b` dangling.
      //
      // A range term is either a parenthesized expression or a numeric /
      // identifier expression with optional leading sign, decimal point,
      // and arithmetic continuation. The leading `[-+]?` is what lets
      // negative steps like `-0.5` match; `[\w.]` allows `0.1` and `pi`.
      const RANGE_TERM = /\([^()]*(?:\([^()]*\)[^()]*)*\)|[-+]?[\w.][\w.*/+-]*/.source
      const threePartRe = new RegExp(
        `(^|[^a-zA-Z0-9_\\[])(${RANGE_TERM})\\s*:\\s*(${RANGE_TERM})\\s*:\\s*(${RANGE_TERM})`,
        'g',
      )
      result = result.replace(threePartRe, (match, prefix, start, step, stop) => {
        if (/['"]/.test(start) || /['"]/.test(step) || /['"]/.test(stop)) return match
        if (start === '' || step === '' || stop === '') return match
        // Skip if inside brackets (already a Python slice)
        const idx = result.indexOf(match)
        const beforeMatch = result.slice(0, idx)
        const openB = (beforeMatch.match(/\[/g) || []).length
        const closeB = (beforeMatch.match(/\]/g) || []).length
        if (openB > closeB) return match
        // Skip ranges that are a dim of a known-array subscript like
        // `A(2:2:end, :)` — those are slices, handled by Stage 4. A range
        // inside a FUNCTION call (`plot(0:N)`) still becomes np.arange.
        if (isInArraySubscript(beforeMatch + prefix, arrayNames)) return match
        imports.add('numpy')
        return `${prefix}np.arange(${start.trim()}, ${stop.trim()} + ${step.trim()}, ${step.trim()})`
      })

      // Try to extract the range expression by finding the colon and expanding outward
      // Match: (complex_expr):(complex_expr) allowing parens in each side
      result = result.replace(
        /(\([^()]*(?:\([^()]*\)[^()]*)*\)|\w[\w*/+-]*)\s*:\s*(\([^()]*(?:\([^()]*\)[^()]*)*\)|\w[\w*/+-]*)/g,
        (match, left, right) => {
          // Skip if this is inside brackets (already a Python slice)
          const beforeMatch = result.slice(0, result.indexOf(match))
          const openBrackets = (beforeMatch.match(/\[/g) || []).length
          const closeBrackets = (beforeMatch.match(/\]/g) || []).length
          if (openBrackets > closeBrackets) return match  // inside a bracket

          // Skip if left or right look like Python syntax (dict literal, slice)
          if (left === '' || right === '') return match

          // Skip a range that is a dim of a known-array subscript (e.g.
          // `A(2:end-1, :)`) — Stage 4 turns it into a proper slice. A range
          // inside a function call (`plot(0:N)`) is still converted.
          if (isInArraySubscript(beforeMatch, arrayNames)) return match

          imports.add('numpy')
          return `np.arange(${left}, ${right} + 1)`
        },
      )

      return result
    }
  }
  return content
}

/**
 * Convert `name(args) = value` on the LHS of assignments to
 * `name[args] = value`. Python does not allow assignment to a function
 * call, and MATLAB uses the same `()` for array indexing and function
 * calls — on the LHS of `=` it can only be array indexing, so the
 * conversion is unambiguous.
 *
 * Skips:
 *   - Comparison operators (`==`, `~=`, `<=`, `>=`)
 *   - Augmented assignment (`+=`, etc. — but MATLAB doesn't have these)
 *   - Known Python functions (already in isKnownPythonFunc list)
 *   - Content inside strings/comments
 */
function convertLhsIndexAssignment(line: string): string {
  const eqIdx = findAssignmentEquals(line)
  if (eqIdx < 0) return line

  const lhs = line.slice(0, eqIdx)
  const rhs = line.slice(eqIdx)

  // Find balanced `name(...)` runs in the LHS and convert outer parens
  // to brackets. Iterate right-to-left so indexes remain valid.
  const converted = convertCallsToIndex(lhs)
  return converted + rhs
}

function findAssignmentEquals(line: string): number {
  let paren = 0, bracket = 0, brace = 0
  let inString = false, sc = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < line.length && line[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === '#' || ch === '%') return -1
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '=' && paren === 0 && bracket === 0 && brace === 0) {
      // Skip comparisons and augmented assignments
      const prev = line[i - 1] || ''
      const next = line[i + 1] || ''
      if (next === '=') return -1 // `==`
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') return -1
      return i
    }
  }
  return -1
}

/**
 * Walk LHS text, find each top-level `name(...)` with balanced parens,
 * and rewrite to `name[...]`. Skips known Python/numpy function names so
 * things like `size(A)=...` (which wouldn't happen in practice) don't
 * get mangled.
 */
function convertCallsToIndex(lhs: string): string {
  // Scan from right to left so replacements don't shift earlier indexes
  const replacements: Array<{ start: number; end: number; replacement: string }> = []
  let i = 0
  let inString = false, sc = ''
  while (i < lhs.length) {
    const ch = lhs[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < lhs.length && lhs[i + 1] === sc) { i += 2; continue }
        inString = false
      }
      i++
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; i++; continue }
    if (ch === '(') {
      // Look backward for a name char sequence
      let nameEnd = i
      let nameStart = i
      while (nameStart > 0 && /\w/.test(lhs[nameStart - 1])) nameStart--
      if (nameStart === nameEnd) {
        i++
        continue
      }
      const name = lhs.slice(nameStart, nameEnd)
      // No isKnownPythonFunc check here: on the LHS of `=`, a name cannot
      // be a function call (Python forbids it), so parens must be array
      // indexing even for names that happen to match Python builtins like
      // `map` (common MATLAB variable for colormap).
      // Find the matching close paren
      let depth = 1
      let j = i + 1
      let sInStr = false, ssc = ''
      while (j < lhs.length && depth > 0) {
        const c = lhs[j]
        if (sInStr) {
          if (c === ssc) {
            if (j + 1 < lhs.length && lhs[j + 1] === ssc) { j += 2; continue }
            sInStr = false
          }
          j++
          continue
        }
        if (c === "'" || c === '"') { sInStr = true; ssc = c; j++; continue }
        if (c === '(') depth++
        else if (c === ')') depth--
        if (depth > 0) j++
      }
      if (depth === 0) {
        const args = lhs.slice(i + 1, j)
        replacements.push({
          start: i,
          end: j,
          replacement: `[${args}]`,
        })
        i = j + 1
        continue
      }
    }
    i++
  }
  let result = lhs
  for (let k = replacements.length - 1; k >= 0; k--) {
    const r = replacements[k]
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end + 1)
  }
  return result
}

/**
 * Convert MATLAB `end`-anchored indexing and reverse-slice idioms directly
 * to Python slices. These patterns are common in real MATLAB code and
 * used to produce wrong semantics (`v(end:-1:1)` → mangled np.arange).
 * Run this BEFORE the generic range and indexing handlers so they never
 * see these forms.
 *
 * Supported rewrites (word before `(` must not be a known Python func):
 *   v(end)           → v[-1]
 *   v(end-k)         → v[-(k+1)] (literal k folded when numeric)
 *   v(1:end)         → v[:]
 *   v(1:end-k)       → v[:-k]
 *   v(m:end)         → v[m-1:]  (1-based m)
 *   v(m:end-k)       → v[m-1:-k]
 *   v(end:-1:1)      → v[::-1]
 *   v(end:-1:m)      → v[:m-2:-1]  when m > 1 (numeric), else v[::-1]
 *   v(end-k:-1:1)    → v[-(k+1)::-1]
 *   v(end:-s:1)      → v[::-s]
 */
function convertEndIdioms(line: string): string {
  const safe = (name: string) => !isKnownPythonFunc(name)
  let result = line

  // Reverse-slice patterns — most specific first.

  // v(end:-1:1) → v[::-1]
  result = result.replace(/\b(\w+)\(\s*end\s*:\s*-\s*1\s*:\s*1\s*\)/g, (m, name) =>
    safe(name) ? `${name}[::-1]` : m,
  )

  // v(end:-s:1) → v[::-s] (numeric step)
  result = result.replace(/\b(\w+)\(\s*end\s*:\s*-\s*(\d+)\s*:\s*1\s*\)/g, (m, name, step) =>
    safe(name) ? `${name}[::-${step}]` : m,
  )

  // v(end-k:-1:1) → v[-(k+1)::-1]
  result = result.replace(
    /\b(\w+)\(\s*end\s*-\s*(\d+)\s*:\s*-\s*1\s*:\s*1\s*\)/g,
    (m, name, k) => (safe(name) ? `${name}[-${Number(k) + 1}::-1]` : m),
  )

  // v(end:-1:m) → v[:m-2:-1] (numeric m >= 2)
  result = result.replace(
    /\b(\w+)\(\s*end\s*:\s*-\s*1\s*:\s*(\d+)\s*\)/g,
    (m, name, stop) => {
      if (!safe(name)) return m
      const s = Number(stop)
      if (s === 1) return `${name}[::-1]`
      if (s === 2) return `${name}[:0:-1]`
      return `${name}[:${s - 2}:-1]`
    },
  )

  // Forward slice patterns anchored to `end`.

  // Stepped slices to `end` — must run before the 2-part patterns below so the
  // middle step isn't mistaken for the stop. v(m:s:end) → v[m-1::s].
  result = result.replace(
    /\b(\w+)\(\s*(\d+)\s*:\s*(\d+)\s*:\s*end\s*\)/g,
    (m, name, start, step) =>
      safe(name) ? `${name}[${Number(start) - 1}::${step}]` : m,
  )

  // v(m:s:end-k) → v[m-1:-k:s]
  result = result.replace(
    /\b(\w+)\(\s*(\d+)\s*:\s*(\d+)\s*:\s*end\s*-\s*(\d+)\s*\)/g,
    (m, name, start, step, k) =>
      safe(name) ? `${name}[${Number(start) - 1}:-${k}:${step}]` : m,
  )

  // v(1:end) → v[:]
  result = result.replace(/\b(\w+)\(\s*1\s*:\s*end\s*\)/g, (m, name) =>
    safe(name) ? `${name}[:]` : m,
  )

  // v(1:end-k) → v[:-k]
  result = result.replace(
    /\b(\w+)\(\s*1\s*:\s*end\s*-\s*(\d+)\s*\)/g,
    (m, name, k) => (safe(name) ? `${name}[:-${k}]` : m),
  )

  // v(m:end) → v[m-1:] when m is numeric, else v[m - 1:]
  result = result.replace(
    /\b(\w+)\(\s*(\d+)\s*:\s*end\s*\)/g,
    (m, name, start) => (safe(name) ? `${name}[${Number(start) - 1}:]` : m),
  )

  // v(m:end-k) → v[m-1:-k] (numeric m)
  result = result.replace(
    /\b(\w+)\(\s*(\d+)\s*:\s*end\s*-\s*(\d+)\s*\)/g,
    (m, name, start, k) =>
      safe(name) ? `${name}[${Number(start) - 1}:-${k}]` : m,
  )

  // Single-element `end` patterns. These duplicate Stage 4 rules but run
  // here so that bare `end` never survives to confuse later transforms.

  // v(end) → v[-1]
  result = result.replace(/\b(\w+)\(\s*end\s*\)/g, (m, name) =>
    safe(name) ? `${name}[-1]` : m,
  )

  // v(end-k) → v[-(k+1)]
  result = result.replace(
    /\b(\w+)\(\s*end\s*-\s*(\d+)\s*\)/g,
    (m, name, k) => (safe(name) ? `${name}[-${Number(k) + 1}]` : m),
  )

  return result
}

/**
 * Convert MATLAB array indexing like y2(N/2:end) → y2[N/2:]
 * Handles nested parens correctly by finding innermost varName(range) patterns.
 */
function convertMatlabIndexing(line: string, originalContent: string): string {
  let result = line
  // Skip for-loop lines
  if (/^\s*(for|parfor)\b/.test(originalContent)) return result

  // Pattern: word(expr:end) where word is NOT a known Python function
  // Process innermost matches first (no nested parens inside the match)
  let changed = true
  let iterations = 0
  while (changed && iterations < 10) {
    changed = false
    iterations++

    // Bounded stepped slice: varName(start:step:stop) → varName[start-1:stop:step].
    // Must run before the single-colon patterns (which would mis-split it) and
    // before convertComplexRanges (which would mangle it into a v(np.arange(...))
    // call on an ndarray). Numeric start is shifted; variable start gets ` - 1`.
    //
    // The term classes exclude brackets and comparison operators so the regex
    // can't span already-converted subscripts: e.g. `find(mrec[1:]!=mrec[:-1])`
    // must NOT be read as a 3-part range (start=`mrec[1`, step=`]!=mrec[`, …).
    result = result.replace(
      /\b(\w+)\(([^(),:'"\[\]<>=!~]+):([^(),:'"\[\]<>=!~]+):([^(),:'"\[\]<>=!~]+)\)/g,
      (match, varName, start, step, stop) => {
        if (isKnownPythonFunc(varName)) return match
        changed = true
        const s = start.trim()
        const shifted = /^\d+$/.test(s) ? String(Number(s) - 1) : `${s} - 1`
        return `${varName}[${shifted}:${stop.trim()}:${step.trim()}]`
      },
    )

    // Match varName(simple_expr:end) — no parens inside
    result = result.replace(
      /\b(\w+)\(([^()]*):end\)/g,
      (match, varName) => {
        if (isKnownPythonFunc(varName)) return match
        changed = true
        const innerExpr = match.slice(varName.length + 1, match.lastIndexOf(':end)'))
        return `${varName}[${innerExpr}:]`
      },
    )

    // Match varName(simple_expr1:simple_expr2) — no parens, no commas, no quotes inside
    result = result.replace(
      /\b(\w+)\(([^(),:'"]+):([^(),:'"]+)\)/g,
      (match, varName, start, end) => {
        if (isKnownPythonFunc(varName)) return match
        changed = true
        return `${varName}[${start}:${end}]`
      },
    )
  }

  return result
}

/** Check if a name is a known Python function (not array indexing) */
function isKnownPythonFunc(name: string): boolean {
  // Dotted names are always function calls in our context
  // But we check the word BEFORE the dot was attached
  const KNOWN = new Set([
    'np', 'plt', 'signal', 'stats', 'optimize', 'control', 'pd', 'sm',
    're', 'io', 'color', 'transform', 'feature', 'measure', 'morphology',
    'util', 'ndi', 'sio', 'sf', 'warnings', 'time',
    'range', 'print', 'len', 'str', 'int', 'float', 'type', 'open',
    'sorted', 'list', 'dict', 'tuple', 'set', 'enumerate', 'zip', 'map',
    'isinstance', 'max', 'min', 'abs', 'sum', 'round',
    'where', 'array', 'arange', 'linspace', 'zeros', 'ones', 'empty',
    'concatenate', 'stack', 'hstack', 'vstack', 'reshape',
    'solve_ivp', 'quad', 'find_peaks', 'lexsort',
  ])
  return KNOWN.has(name)
}

// ── Control Flow ──────────────────────────────────────────

/**
 * MATLAB uses `~` for an ignored input parameter (`function f(~, x)`). Python
 * has no `~`; replace each with a unique throwaway name (`_`, `_2`, `_3`) — a
 * single `_` works but duplicate `_` params are a Python syntax error.
 */
function sanitizeIgnoredParams(inputs: string): string {
  let n = 0
  return inputs
    .split(',')
    .map((s) => {
      const t = s.trim()
      if (t === '~') { n++; return n === 1 ? '_' : `_${n}` }
      return t
    })
    .filter(Boolean)
    .join(', ')
}

/** Python reserved words a MATLAB function/method name could collide with. */
const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])

// Module-level switch expression tracker
let _currentSwitchExpr = ''

function transformControlFlow(
  content: string,
  line: StructuredLine,
  flags: Flag[],
  paramsWithDefaultsByLine?: Map<number, string>,
  varargoutReturnsByLine?: Map<number, string>,
): string {
  const trimmed = content.trim()

  // function [out1, out2] = name(in1, in2). The name can be dotted for class
  // property accessors (`set.Z`, `get.n`) — those become `set_Z`/`get_n` so the
  // method body stays structurally valid Python instead of leaving the raw
  // `function` keyword (a syntax error).
  const funcMatch = trimmed.match(
    /^function\s+(?:\[([^\]]*)\]\s*=\s*|(\w+)\s*=\s*)?([\w.]+)\s*\(([^)]*)\)/,
  )
  if (funcMatch) {
    const outputs = funcMatch[1] || funcMatch[2] || ''
    const rawName = funcMatch[3]
    // Dots in property accessors (set.Z) → underscores; a name that collides
    // with a Python keyword (MATLAB operator methods `or`/`and`/`not`) gets a
    // trailing underscore so `def or(...)` isn't a syntax error.
    const name = PYTHON_KEYWORDS.has(rawName) ? `${rawName}_` : rawName.replace(/\./g, '_')
    if (rawName !== name) {
      flags.push({
        type: 'TODO',
        message: `MATLAB property accessor ${rawName} → def ${name}. In Python, make this a @property (getter) or @<prop>.setter on the class instead of a standalone method.`,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
    // If the nargin/arguments pre-pass extracted Python defaults, use them.
    const overrideInputs = paramsWithDefaultsByLine?.get(line.originalLineStart)
    const inputs = sanitizeIgnoredParams(overrideInputs ?? (funcMatch[4] || ''))
    if (outputs) {
      // If varargout pre-pass rewrote the returns, use the new names.
      const overrideReturns = varargoutReturnsByLine?.get(line.originalLineStart)
      const returnPart = overrideReturns
        ?? (outputs.split(',').map(s => s.trim()).filter(Boolean).join(', '))
      return `def ${name}(${inputs}):  # returns ${returnPart}`
    }
    return `def ${name}(${inputs}):`
  }

  // function name   OR   function out = name   (MATLAB allows no-arg
  // definitions without parens; without this branch the literal
  // `function` keyword survives into the Python output).
  const noArgFunc = trimmed.match(
    /^function\s+(?:\[([^\]]*)\]\s*=\s*|(\w+)\s*=\s*)?(\w+)\s*$/,
  )
  if (noArgFunc) {
    const outputs = noArgFunc[1] || noArgFunc[2] || ''
    const name = noArgFunc[3]
    if (outputs) {
      const outVars = outputs.split(',').map(s => s.trim()).filter(Boolean)
      const returnPart = outVars.length === 1 ? outVars[0] : outVars.join(', ')
      return `def ${name}():  # returns ${returnPart}`
    }
    return `def ${name}():`
  }

  // for i = start:end  or  for i = start:step:end
  const forMatch = trimmed.match(/^for\s+(\w+)\s*=\s*(.+)/)
  if (forMatch) {
    const varName = forMatch[1]
    const rangeExpr = forMatch[2].trim()
    return `for ${varName} in ${convertRange(rangeExpr, flags, line)}:`
  }

  // parfor — convert to for with warning
  const parforMatch = trimmed.match(/^parfor\s+(\w+)\s*=\s*(.+)/)
  if (parforMatch) {
    const varName = parforMatch[1]
    const rangeExpr = parforMatch[2].trim()
    flags.push({
      type: 'WARNING',
      message: 'parfor converted to for — parallel execution removed',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: trimmed,
    })
    return `for ${varName} in ${convertRange(rangeExpr, flags, line)}:  # ⚠ WARNING: parfor → for`
  }

  // while — allow both `while cond` and `while(cond)` (no space)
  if (/^while\b/.test(trimmed)) {
    const cond = trimmed.replace(/^while\s*/, '').trim()
    return `while ${cond}:`
  }

  // if — accept both `if cond` and `if(cond)` (MATLAB allows paren-attached form)
  if (/^if\b/.test(trimmed)) {
    const cond = trimmed.replace(/^if\s*/, '').trim()
    return `if ${cond}:`
  }

  // elseif — also accepts `elseif(cond)` form
  if (/^elseif\b/.test(trimmed)) {
    const cond = trimmed.replace(/^elseif\s*/, '').trim()
    return `elif ${cond}:`
  }

  // else
  if (/^else\s*$/.test(trimmed)) {
    return 'else:'
  }

  // switch — store expression for case comparisons. Accepts `switch(expr)` form too.
  // No flag: if/elif chain is always semantically equivalent to MATLAB switch.
  if (/^switch\b/.test(trimmed)) {
    const expr = trimmed.replace(/^switch\s*/, '').trim()
    _currentSwitchExpr = expr
    return `# switch ${expr}  → converted to if/elif`
  }

  // case — compare against stored switch expression
  if (/^case\b/.test(trimmed)) {
    const val = trimmed.replace(/^case\s+/, '').trim()
    const switchVar = _currentSwitchExpr || '_switch_var'
    // Handle case with cell array of values: case {'a', 'b'} → if x in ['a', 'b']
    if (val.startsWith('{') || val.startsWith('[')) {
      const inner = val.replace(/^\{/, '[').replace(/\}$/, ']')
      return `elif ${switchVar} in ${inner}:`
    }
    return `elif ${switchVar} == ${val}:`  // Note: first case → 'if' in cleanup
  }

  // otherwise (bare)
  if (/^otherwise\s*$/.test(trimmed)) {
    return 'else:'
  }

  // otherwise STATEMENT (inline body) — MATLAB `otherwise body` on a
  // single line. Split into `else:\n    body` so Python gets a valid
  // block.
  const otherwiseInline = trimmed.match(/^otherwise\s+(.+)$/)
  if (otherwiseInline) {
    return `else:\n    ${otherwiseInline[1]}`
  }

  // try (bare)
  if (/^try\s*$/.test(trimmed)) {
    return 'try:'
  }

  // try STATEMENT (inline body) — MATLAB `try body` on a single line.
  const tryInline = trimmed.match(/^try\s+(.+)$/)
  if (tryInline) {
    return `try:\n    ${tryInline[1]}`
  }

  // catch — handles all MATLAB forms:
  //   catch              → except Exception:
  //   catch ME           → except Exception as ME:
  //   catch, STMT        → except Exception:\n    STMT
  //   catch ME, STMT     → except Exception as ME:\n    STMT
  if (/^catch\b/.test(trimmed)) {
    let rest = trimmed.replace(/^catch\b/, '').trim()
    // No var/body → bare except
    if (!rest) return 'except Exception:'
    // rest starts with `, STATEMENT` → no var, inline body
    if (rest.startsWith(',')) {
      const stmt = rest.slice(1).trim()
      return stmt ? `except Exception:\n    ${stmt}` : 'except Exception:'
    }
    // rest might be `VAR` or `VAR, STATEMENT`
    const commaIdx = rest.indexOf(',')
    if (commaIdx < 0) {
      return `except Exception as ${rest}:`
    }
    const varName = rest.slice(0, commaIdx).trim()
    const stmt = rest.slice(commaIdx + 1).trim()
    if (!stmt) return `except Exception as ${varName}:`
    return `except Exception as ${varName}:\n    ${stmt}`
  }

  // return (standalone)
  if (/^return\s*$/.test(trimmed)) {
    return 'return'
  }

  // return with value
  if (/^return\s+/.test(trimmed)) {
    return trimmed // keep as-is, Python return syntax is compatible
  }

  return content
}

/**
 * Convert MATLAB range expression to Python range().
 * Handles: 1:n, a:b, a:step:b
 */
function convertRange(expr: string, flags: Flag[], line: StructuredLine): string {
  // Split on TOP-LEVEL colons only — parens, brackets, and quoted strings
  // contain colons that are NOT range separators (e.g. `arr(1:end)`,
  // `[1:n, k]`, `"a:b"`).
  const parts = splitTopLevelColons(expr)

  if (parts.length === 1) {
    // No top-level colon at all — `for x = vec` where `vec` is a list,
    // array, or function call returning iterable. Python's `for x in vec`
    // does the same thing for any iterable, so no flag is needed. The
    // common shapes (column-vector iteration aside, which is rare in
    // real code) all map cleanly.
    return parts[0]
  }

  if (parts.length === 2) {
    // Always emit start to end+1 to keep the loop variable 1-based, so stage 4's
    // `i → i-1` shift on indexers produces correct 0-based subscripts. The old
    // `start === '1'` simplification to `range(end)` switched the loop var to
    // 0-based and caused double-offset bugs whenever indexers used the var.
    const [start, end] = parts
    return `range(${start}, ${end} + 1)`
  }

  if (parts.length === 3) {
    // start:step:end → range(start, end ± 1, step). MATLAB includes the
    // end value; Python's `range` excludes it. The boundary adjustment
    // depends on the SIGN of the step:
    //   step > 0 → end + 1   (step toward end, include it)
    //   step < 0 → end - 1   (step away from end, include it)
    // For unknown / variable step, we can't know at compile time and have
    // to flag the ambiguity.
    const [start, step, end] = parts
    const stepT = step.trim()
    if (/^\+?\d+(\.\d+)?$/.test(stepT)) {
      return `range(${start}, ${end} + 1, ${step})`
    }
    if (/^-\d+(\.\d+)?$/.test(stepT)) {
      return `range(${start}, ${end} - 1, ${step})`
    }
    // Variable step — direction unknown at compile time.
    flags.push({
      type: 'INDEX',
      message: 'for loop with variable step — sign of step affects whether the end value is included. Verify range bounds.',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: expr,
    })
    return `range(${start}, ${end} + 1, ${step})`
  }

  // 4+ colons — exotic. Push a TODO flag rather than inlining a `# TODO:`
  // comment, because the comment would land AFTER the block-opening `:`
  // the caller appends, making Python's parser treat the `:` as part of
  // the comment.
  flags.push({
    type: 'TODO',
    message: 'complex for-loop range expression — verify the range conversion is correct (MATLAB includes end value, Python range() excludes it)',
    originalLine: line.originalLineStart,
    outputLine: 0,
    originalCode: expr,
  })
  return `range(${expr})`
}

/**
 * Split `expr` on `:` characters that lie at depth 0 (not inside parens,
 * brackets, braces, or quoted strings). Matches what a MATLAB user means
 * by "the range separator" rather than every literal colon.
 */
function splitTopLevelColons(expr: string): string[] {
  const out: string[] = []
  let depth = 0
  let inSingle = false
  let inDouble = false
  let start = 0
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (inSingle) {
      if (c === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (c === '"') inDouble = false
      continue
    }
    if (c === "'") { inSingle = true; continue }
    if (c === '"') { inDouble = true; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ':' && depth === 0) {
      out.push(expr.slice(start, i).trim())
      start = i + 1
    }
  }
  out.push(expr.slice(start).trim())
  return out
}

// ── Operators ───────────────────────────��─────────────────

function transformOperators(
  content: string,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  for (const op of OPERATOR_MAP) {
    if (!result.includes(op.matlab)) continue

    const before = result
    // Use careful replacement to avoid breaking strings
    result = replaceOutsideStrings(result, op.matlab, op.python)

    // Only flag if the replacement actually changed something
    // (meaning the operator appeared outside of strings)
    if (op.flag && result !== before) {
      flags.push({
        type: op.flag.type,
        message: op.flag.message,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  return result
}

// ── Functions ───────────────────────────────────────���─────

/**
 * MATLAB `zeros(1, N)` / `zeros(N, 1)` (and the `rand`/`randn` equivalents)
 * build a 2-D row/column vector with a singleton dimension. The rest of the
 * pipeline accesses these with a single subscript (`z(i)` → `z[i - 1]`),
 * which indexes axis 0 — fatal for `(1, N)` (axis 0 has size 1 → IndexError).
 * When a literal `1` sits in the leading or trailing position of a 2-arg
 * dim list, drop it so we emit a 1-D array (`np.zeros(N)`), for which
 * single-subscript access is correct. Non-literal or non-1 dims are left
 * untouched, and only the 2-arg form is affected.
 */
function dropSingletonVectorDim(argList: string[]): string[] {
  if (argList.length === 2) {
    if (argList[0] === '1') return [argList[1]]
    if (argList[1] === '1') return [argList[0]]
  }
  return argList
}

function transformFunctions(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
  shadowed?: Set<string>,
): string {
  let result = content

  for (const [matlabName, mapping] of Object.entries(FUNCTION_MAP)) {
    // A locally-assigned variable shadows the builtin of the same name
    // (MATLAB: `sum = [...]; sum(2)` indexes the array). Leave the name
    // alone so Stage 4 can bracket-index it instead of emitting `np.sum[1]`.
    if (shadowed?.has(matlabName)) continue
    // Match function call pattern: funcName(
    const pattern = new RegExp(`\\b${escapeRegex(matlabName)}\\s*\\(`, 'g')
    if (!pattern.test(result)) continue
    pattern.lastIndex = 0

    // Add required imports
    for (const imp of mapping.imports) {
      imports.add(imp)
    }

    // Apply transformation based on arg type
    switch (mapping.args) {
      case 'passthrough':
        result = result.replace(pattern, `${mapping.python}(`)
        break

      case 'reshape': {
        // zeros(m,n) → np.zeros((m,n)) — wrap args in tuple
        result = replaceFunctionCalls(result, matlabName, (_, args) => {
          let argList = splitArgsRespectingStrings(args).map(s => s.trim())
          // zeros/ones with a literal leading/trailing 1 are row/col vectors;
          // emit 1-D so single-subscript indexing works. Scoped by name so a
          // future function on this arg-mode whose 1 is meaningful isn't de-2-D'd.
          if (matlabName === 'zeros' || matlabName === 'ones') {
            argList = dropSingletonVectorDim(argList)
          }
          if (argList.length > 1) {
            return `${mapping.python}((${argList.join(', ')}))`
          }
          if (argList.length === 1) {
            return `${mapping.python}(${argList[0]})`
          }
          return `${mapping.python}(${args})`
        })
        break
      }

      case 'rand_shape': {
        // rand/randn take SEPARATE dim args (not a tuple): rand(2,3) →
        // np.random.rand(2, 3). A literal leading/trailing 1 in the 2-arg
        // form is a row/col vector → emit 1-D (np.random.rand(n)).
        result = replaceFunctionCalls(result, matlabName, (_, args) => {
          const argList = dropSingletonVectorDim(
            splitArgsRespectingStrings(args).map(s => s.trim()),
          )
          return `${mapping.python}(${argList.join(', ')})`
        })
        break
      }

      case 'tile': {
        // repmat(A, m, n[, ...]) → np.tile(A, (m, n, ...)). The FIRST arg is
        // the array to tile; the rest are the reps. The old `reshape` mode
        // wrongly tupled all args together (np.tile((A, m, n))), leaving
        // np.tile with one positional arg → "missing 'reps'" at runtime.
        result = replaceFunctionCalls(result, matlabName, (_, args) => {
          const argList = splitArgsRespectingStrings(args).map(s => s.trim())
          if (argList.length === 0) return `${mapping.python}(${args})`
          const A = argList[0]
          const reps = argList.slice(1)
          if (reps.length === 0) return `${mapping.python}(${A})` // degenerate
          if (reps.length === 1) {
            const r = reps[0]
            // repmat(A, [m, n]) — size-vector form. numpy accepts an array-like
            // reps, so pass the bracket through unchanged.
            if (r.startsWith('[') && r.endsWith(']')) {
              return `${mapping.python}(${A}, ${r})`
            }
            // repmat(A, n) means n×n in MATLAB; np.tile(A, n) would only tile
            // the last axis, so expand the scalar to (n, n).
            return `${mapping.python}(${A}, (${r}, ${r}))`
          }
          return `${mapping.python}(${A}, (${reps.join(', ')}))`
        })
        break
      }

      case 'attribute': {
        // size(A) → A.shape
        result = replaceFunctionCalls(result, matlabName, (_, args) => {
          const argList = splitArgsRespectingStrings(args).map(s => s.trim())
          if (matlabName === 'size' && argList.length === 2) {
            // size(A, dim) → A.shape[dim-1]
            const dim = parseInt(argList[1], 10)
            if (!isNaN(dim)) {
              return `${argList[0]}.shape[${dim - 1}]`
            }
            return `${argList[0]}.shape[${argList[1]} - 1]`
          }
          return `${argList[0]}${mapping.python}`
        })
        break
      }

      case 'template': {
        // length(A) → max(A.shape), numel(A) → A.size
        // Multi-arg templates keep the trailing args as a call:
        //   strsplit('a,b', ',') → 'a,b'.split(',')
        //   strrep('x,y', ',', ':') → 'x,y'.replace(',', ':')
        // The template's `{}` is replaced with the first arg. If the
        // template has no trailing parens and more args were passed,
        // append them as `(rest...)`. If the template already has `()`
        // (e.g. `{}.strip()`), leave it alone.
        result = replaceFunctionCalls(result, matlabName, (_, args) => {
          const argList = splitArgsRespectingStrings(args).map(s => s.trim())
          const firstArg = argList[0] ?? ''
          const restArgs = argList.slice(1)
          const substituted = mapping.python.replace(/\{\}/g, firstArg)
          // If template ends with an identifier char (no `)` or `]`) and
          // there are remaining args, append them as a function call.
          const endsWithCallable = /[A-Za-z_]$/.test(substituted)
          if (endsWithCallable && restArgs.length > 0) {
            return `${substituted}(${restArgs.join(', ')})`
          }
          return substituted
        })
        break
      }

      case 'format_convert': {
        if (matlabName === 'fprintf' || matlabName === 'sprintf') {
          // Match fprintf('format', arg1, arg2) or fprintf(fid, 'format', arg1, arg2)
          const fmtPattern = new RegExp(
            `\\b${escapeRegex(matlabName)}\\((.+)\\)`,
            'g',
          )
          result = result.replace(fmtPattern, (match, allArgs) => {
            return convertFormatCall(matlabName, allArgs)
          })
        }
        break
      }

      default: {
        // 'custom' — name replacement with per-function argument rewriting
        if (matlabName === 'std' || matlabName === 'var') {
          result = replaceFunctionCalls(result, matlabName, (_, args) =>
            rewriteStdVar(mapping.python, args),
          )
        } else if (matlabName === 'randi') {
          result = replaceFunctionCalls(result, matlabName, (_, args) =>
            rewriteRandi(args, imports),
          )
        } else if (matlabName === 'readtable') {
          result = replaceFunctionCalls(result, matlabName, (_, args) =>
            rewriteReadtable(args),
          )
        } else if (matlabName === 'sortrows') {
          result = replaceFunctionCalls(result, matlabName, (_, args) =>
            rewriteSortrows(args),
          )
        } else {
          result = result.replace(pattern, `${mapping.python}(`)
        }
        break
      }
    }

    // Add flag if mapping specifies one. `flagWhen`, when present, gates
    // emission so we only warn on risky shapes (e.g. `[U,p]=chol(X)` or
    // 3-arg `dot(X,Y,dim)`) and stay silent on shapes that map cleanly.
    if (mapping.flag && (!mapping.flagWhen || mapping.flagWhen(content))) {
      flags.push({
        type: mapping.flag.type,
        message: mapping.flag.message,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  return result
}

// ── sortrows rewriter ─────────────────────────────────────

/**
 * Rewrite MATLAB sortrows to a NumPy expression. The registry's old `{a}`
 * template was never substituted (no custom handler), so `{a}` leaked into the
 * output and was mangled into invalid Python.
 *
 *   sortrows(A)      → A[np.lexsort(A[:, ::-1].T)]   (lexicographic, all cols)
 *   sortrows(A, c)   → A[A[:, c-1].argsort(kind='stable')]   (single column)
 *
 * np.lexsort keys are applied last-to-first, so the columns are reversed to get
 * MATLAB's left-to-right ascending order. Descending columns, a column vector,
 * and the `[B, idx] = sortrows(...)` index output are flagged (see registry).
 */
function rewriteSortrows(rawArgs: string): string {
  const args = splitArgsRespectingStrings(rawArgs).map(s => s.trim())
  const a = args[0] ?? ''
  if (args.length >= 2 && /^\d+$/.test(args[1])) {
    const col = parseInt(args[1], 10) - 1
    return `${a}[${a}[:, ${col}].argsort(kind='stable')]`
  }
  return `${a}[np.lexsort(${a}[:, ::-1].T)]`
}

// ── std / var ddof rewriter ───────────────────────────────

/**
 * Rewrite MATLAB std(x[, w[, dim]]) / var(x[, w[, dim]]) to NumPy equivalents,
 * injecting ddof=1 (MATLAB normalises by N-1 by default; NumPy default is N).
 *
 *   std(x)         → np.std(x, ddof=1)
 *   std(x, 0)      → np.std(x, ddof=1)      (w=0 means N-1 normalization)
 *   std(x, 1)      → np.std(x, ddof=0)      (w=1 means N normalization)
 *   std(x, 0, dim) → np.std(x, ddof=1, axis=dim-1)
 *   std(x, 1, dim) → np.std(x, ddof=0, axis=dim-1)
 *   std(x, w)      → np.std(x, ddof=1) + flag for non-trivial weight vector
 */
function rewriteStdVar(pyName: string, rawArgs: string): string {
  const args = splitArgsRespectingStrings(rawArgs).map(s => s.trim())
  if (args.length === 0) return `${pyName}()`

  const data = args[0]

  if (args.length === 1) {
    return `${pyName}(${data}, ddof=1)`
  }

  const w = args[1]
  const ddof = w === '0' ? 1 : w === '1' ? 0 : 1  // default to ddof=1 for other values

  if (args.length === 2) {
    return `${pyName}(${data}, ddof=${ddof})`
  }

  // 3-arg: std(x, w, dim)
  const dim = args[2].trim()
  const axisExpr = /^\d+$/.test(dim) ? String(parseInt(dim, 10) - 1) : `${dim} - 1`
  return `${pyName}(${data}, ddof=${ddof}, axis=${axisExpr})`
}

// ── readtable reader selection ────────────────────────────

/**
 * Rewrite MATLAB readtable(file, ...) to the matching pandas reader.
 *
 *   readtable('d.csv')   → pd.read_csv('d.csv')
 *   readtable('d.txt')   → pd.read_csv('d.txt')
 *   readtable('b.xlsx')  → pd.read_excel('b.xlsx')
 *   readtable(fname)     → pd.read_csv(fname)      (+ WARNING flag, extension unknown)
 *
 * Excel extensions get read_excel; everything else defaults to read_csv. The
 * registry's flagWhen warns whenever the extension can't be read as a string
 * literal, so a variable filename is converted but flagged for review.
 */
function rewriteReadtable(rawArgs: string): string {
  const args = splitArgsRespectingStrings(rawArgs).map(s => s.trim())
  const file = args[0] ?? ''
  const ext = file.match(/\.([A-Za-z0-9]+)['"]\s*$/)?.[1]?.toLowerCase() ?? ''
  const reader = ext === 'xls' || ext === 'xlsx' || ext === 'xlsm'
    ? 'pd.read_excel'
    : 'pd.read_csv'
  return `${reader}(${args.join(', ')})`
}

// ── randi bounds rewriter ─────────────────────────────────

/**
 * Rewrite MATLAB randi to np.random.randint with correct bounds.
 *
 * MATLAB randi is always 1-based and inclusive on both ends:
 *   randi(N)          → np.random.randint(1, N + 1)
 *   randi(N, m, n)    → np.random.randint(1, N + 1, (m, n))
 *   randi([lo, hi])   → np.random.randint(lo, hi + 1)
 *   randi([lo, hi], m, n) → np.random.randint(lo, hi + 1, (m, n))
 */
function rewriteRandi(rawArgs: string, imports: Set<string>): string {
  imports.add('numpy')
  const args = splitArgsRespectingStrings(rawArgs).map(s => s.trim())
  if (args.length === 0) return 'np.random.randint()'

  const first = args[0]
  const sizeArgs = args.slice(1)

  let lo: string, hi: string
  // Check if first arg is a range vector [lo, hi]
  const rangeMatch = first.match(/^\[\s*([^\],]+)\s*,\s*([^\],]+)\s*\]$/)
  if (rangeMatch) {
    lo = rangeMatch[1].trim()
    hi = rangeMatch[2].trim()
  } else {
    // Scalar N: randi(N) means integers from 1 to N inclusive
    lo = '1'
    hi = first
  }

  // NumPy hi is exclusive so add +1. For numeric literals we fold the +1.
  const hiExpr = /^\d+$/.test(hi) ? `${parseInt(hi, 10) + 1}` : `${hi} + 1`

  if (sizeArgs.length === 0) {
    return `np.random.randint(${lo}, ${hiExpr})`
  }
  if (sizeArgs.length === 1) {
    return `np.random.randint(${lo}, ${hiExpr}, ${sizeArgs[0]})`
  }
  // Multiple size args: wrap in a tuple
  return `np.random.randint(${lo}, ${hiExpr}, (${sizeArgs.join(', ')}))`
}

// ── Matrix-multiply rewriter ──────────────────────────────

/**
 * Rewrite bare `*` to `@` when both immediate identifier operands are
 * classified as 'matrix' in the shape table.
 *
 * Must run BEFORE transformOperators converts `.*` → `*`, while
 * element-wise and matrix-multiply operators are still distinguishable:
 *   - `.*` (element-wise) → the char before `*` is `.` → skip
 *   - `*`  (matrix-multiply candidate) → no `.` before it
 *
 * Conservative rules (never emit false-positive `@`):
 *   - Only replaces when the atom immediately left of `*` and the atom
 *     immediately right of `*` are both plain word-char identifiers
 *     (optionally dotted for `.T`).
 *   - Complex LHS expressions `(A + B) * C` keep `*` (scan stops at `)`.
 *   - Function-call LHS `func(A) * B` keeps `*` (scan stops at `)`.
 *   - Numeric literals, scalars, unknowns all keep `*`.
 */
function rewriteMatrixMultiply(
  code: string,
  shapes: Map<string, ShapeClass>,
  imports: Set<string>,
): string {
  if (!code.includes('*')) return code

  const out: string[] = []
  let i = 0
  let inStr = false
  let strCh = ''
  // O(1) tracking — avoids out.join() inside the hot loop.
  // lastNonSpace: last non-whitespace character emitted (outside strings).
  // lastAtom: most recent contiguous run of [\w.] outside strings; reset on
  //           any non-word non-space character so it always holds the
  //           identifier immediately to the left of the current position.
  let lastNonSpace = ''
  let lastAtom = ''

  while (i < code.length) {
    const ch = code[i]

    if (inStr) {
      out.push(ch)
      if (ch === strCh) {
        inStr = false
        lastNonSpace = ch
        lastAtom = ''  // string literal is not a variable
      }
      i++
      continue
    }

    if (ch === "'" || ch === '"') {
      if (ch === "'" && i > 0 && /[a-zA-Z0-9_)\].]/.test(code[i - 1])) {
        // Transpose operator — not a string opener
        out.push(ch); lastNonSpace = ch; lastAtom = ''; i++; continue
      }
      inStr = true; strCh = ch
      out.push(ch); lastNonSpace = ch; lastAtom = ''; i++; continue
    }

    // Comment: copy rest of line verbatim and stop
    if (ch === '#') { out.push(code.slice(i)); break }

    if (ch === '*') {
      // Skip `.*` — element-wise multiply; must not become `@`
      if (lastNonSpace === '.') { out.push(ch); lastNonSpace = ch; lastAtom = ''; i++; continue }
      // Skip `**` (defensive)
      if (i + 1 < code.length && code[i + 1] === '*') { out.push(ch); lastNonSpace = ch; lastAtom = ''; i++; continue }

      // Extract RHS atom: skip spaces then collect [\w.]+
      let j = i + 1
      while (j < code.length && code[j] === ' ') j++
      let rhs = ''
      while (j < code.length && /[\w.]/.test(code[j])) { rhs += code[j++] }
      const rhsBase = rhs.split('.')[0]
      const lhsBase = lastAtom.split('.')[0]

      if (lhsBase && rhsBase &&
          shapes.get(lhsBase) === 'matrix' &&
          shapes.get(rhsBase) === 'matrix') {
        imports.add('numpy')
        out.push('@'); lastNonSpace = '@'; lastAtom = ''
      } else {
        out.push('*'); lastNonSpace = '*'; lastAtom = ''
      }
      i++
      continue
    }

    out.push(ch)
    if (ch !== ' ' && ch !== '\t') {
      lastNonSpace = ch
      if (/[\w.]/.test(ch)) {
        lastAtom += ch
      } else {
        lastAtom = ''
      }
    }
    i++
  }

  return out.join('')
}

// ── Toolbox Functions ─────────────────────────────────────

/** Specific actionable guidance for common toolbox function differences */
const TOOLBOX_SPECIFIC_HELP: Record<string, string> = {
  // Signal Processing
  butter: 'MATLAB butter() returns [b,a] filter coefficients. scipy.signal.butter() is the same, but pass output="sos" for better numerical stability on high-order filters.',
  filtfilt: 'Same interface. Make sure b,a coefficients are from scipy.signal.butter(), not MATLAB-saved values.',
  pwelch: 'MATLAB pwelch(x,window,noverlap,nfft,fs) → scipy.signal.welch(x,fs,window,nperseg,noverlap,nfft). Argument ORDER differs — fs comes second in scipy.',
  spectrogram: 'MATLAB spectrogram(x,window,noverlap,nfft,fs) → scipy.signal.spectrogram(x,fs,...). Argument ORDER differs. Returns (f,t,Sxx) not (S,F,T).',
  findpeaks: 'MATLAB findpeaks returns [peaks, locs]. scipy.signal.find_peaks returns (peak_indices, properties). Get values with x[peaks_idx]. Use height= instead of MinPeakHeight.',
  freqz: 'Same interface. Returns (w, h) where w is in rad/sample by default. Pass fs= to get frequency in Hz.',
  resample: 'MATLAB resample(x,p,q) → scipy.signal.resample_poly(x,p,q). Same interface but may differ slightly in antialiasing filter.',
  hilbert: 'MATLAB hilbert() returns the analytic signal. scipy.signal.hilbert() does the same, but returns the full analytic signal (not just the envelope).',

  // Statistics
  cov: 'MATLAB cov(X) normalizes by N-1 (unbiased). np.cov(X) also uses N-1 by default, but MATLAB treats rows as observations while NumPy treats rows as variables. You may need np.cov(X.T) or np.cov(X, rowvar=False).',
  corrcoef: 'Same as cov — MATLAB treats rows as observations. Use np.corrcoef(X.T) or np.corrcoef(X, rowvar=False) to match.',
  normpdf: 'Same interface: stats.norm.pdf(x, mu, sigma).',
  normcdf: 'Same interface: stats.norm.cdf(x, mu, sigma).',
  ttest2: 'MATLAB ttest2 returns [h,p,ci,stats]. scipy.stats.ttest_ind returns (statistic, pvalue) only. Extract p-value with result.pvalue.',
  polyfit: 'Same interface: np.polyfit(x, y, deg). Returns coefficients highest-degree first, same as MATLAB.',
  polyval: 'Same interface: np.polyval(p, x).',

  // Image Processing
  imread: 'MATLAB imread returns uint8 by default. skimage.io.imread returns uint8 too, but use img_as_float() if you need [0,1] range.',
  rgb2gray: 'MATLAB rgb2gray returns uint8. skimage.color.rgb2gray returns float64 in [0,1]. Multiply by 255 and cast to uint8 if needed.',
  imfilter: 'MATLAB imfilter pads with zeros by default. scipy.ndimage.convolve uses reflect padding. Pass mode="constant" for zero padding.',

  // Optimization
  fminunc: 'MATLAB fminunc(fun,x0) → scipy.optimize.minimize(fun,x0). Returns an OptimizeResult object — get x with result.x, function value with result.fun.',
  fsolve: 'Same interface. scipy.optimize.fsolve returns the root directly (not a struct).',
  linprog: 'MATLAB linprog(f,A,b) minimizes f\'*x subject to A*x <= b. scipy.optimize.linprog has the same interface but uses keyword arguments: linprog(c, A_ub=A, b_ub=b).',

  // Control Systems
  tf: 'Same interface: control.tf(num, den). Returns a TransferFunction object.',
  bode: 'MATLAB bode(sys) plots automatically. control.bode_plot(sys) also plots. To get data without plotting, use control.bode(sys).',
  margin: 'MATLAB [Gm,Pm,Wcg,Wcp] = margin(sys). control.margin(sys) returns (Gm, Pm, Wcg, Wcp) — same order.',
  feedback: 'Same interface: control.feedback(G*C, 1).',
  step: 'MATLAB [y,t] = step(sys). control.step_response(sys) returns (t, y) — note the ORDER IS SWAPPED.',

  // Symbolic
  sym: 'sp.Symbol(\'x\') creates one symbol. For multiple: x, y, z = sp.symbols(\'x y z\').',
  solve: 'sp.solve(expr, var) returns a list of solutions, not a struct.',

  // Wavelet
  wavedec: 'Same interface: pywt.wavedec(data, wavelet, level). Returns [cA, cD1, cD2, ...] as a list.',
  wthresh: 'pywt.threshold(data, value, mode) — mode is \'soft\' or \'hard\' (MATLAB uses \'s\' or \'h\').',
}

/**
 * MATLAB `findpeaks(X)` returns peak VALUES; scipy's `signal.find_peaks(X)`
 * returns `(indices, properties)`. We adapt the return shape:
 *
 *   single-output:  x = findpeaks(SIG)
 *     → x = SIG[signal.find_peaks(SIG)[0]]
 *
 *   two-output:     [pks, locs] = findpeaks(SIG)   (values + locations)
 *     → locs = signal.find_peaks(SIG)[0]   # 0-based indices
 *       pks  = SIG[locs]                   # values at those indices
 *     `locs` is registered 0-based in Stage 4 (buildZeroBasedVars) so a later
 *     `SIG(locs)` becomes `SIG[locs]`, not `SIG[locs - 1]`.
 *
 * Name/Value options `findpeaks(P, 'MinPeakHeight', h)` are mapped to
 * find_peaks kwargs (height/distance/prominence/width/threshold) and folded
 * into the value rewrite: `P[signal.find_peaks(P, height=h)[0]]`. Options with
 * no clean scipy equivalent (NPeaks, SortStr, …) are left as a name-swap + flag
 * — dropping them would silently change results.
 */

// MATLAB findpeaks Name/Value option → scipy.signal.find_peaks kwarg.
const FINDPEAKS_OPT_MAP: Record<string, string> = {
  minpeakheight: 'height',
  minpeakdistance: 'distance',
  minpeakprominence: 'prominence',
  minpeakwidth: 'width',
  threshold: 'threshold',
}

/**
 * Map a findpeaks Name/Value tail (everything after the signal arg) to scipy
 * find_peaks kwargs. Returns `null` if any option is unmappable or the list is
 * malformed (odd length) — the caller then defers to the name-swap + flag.
 */
function mapFindpeaksOptions(rest: string[]): string[] | null {
  if (rest.length % 2 !== 0) return null
  const kwargs: string[] = []
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i].replace(/^['"]|['"]$/g, '').toLowerCase()
    const py = FINDPEAKS_OPT_MAP[name]
    if (!py) return null
    kwargs.push(`${py}=${rest[i + 1]}`)
  }
  return kwargs
}

function convertFindpeaks(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  if (!/\bfindpeaks\s*\(/.test(content)) return content

  // ── Two-output form: [pks, locs] = findpeaks(SIG) ──────────
  // (after the multi-return pre-pass this is `pks, locs = findpeaks(SIG)`;
  // the bracket form is guarded too). pks = values, locs = locations.
  const twoOut = content.match(
    /^\s*(?:\[\s*(\w+)\s*,\s*(\w+)\s*\]|(\w+)\s*,\s*(\w+))\s*=\s*findpeaks\s*\(/,
  )
  if (twoOut) {
    const pks = twoOut[1] ?? twoOut[3]
    const locs = twoOut[2] ?? twoOut[4]
    // Extract the balanced args of findpeaks(...).
    let depth = 1
    let j = twoOut[0].length
    let inStr = false
    let sc = ''
    while (j < content.length && depth > 0) {
      const c = content[j]
      if (inStr) { if (c === sc) inStr = false; j++; continue }
      if (c === "'" || c === '"') { inStr = true; sc = c; j++; continue }
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) break }
      j++
    }
    const twoArgs = splitArgsRespectingStrings(content.slice(twoOut[0].length, j)).map(s => s.trim())
    if (twoArgs.length >= 1 && twoArgs[0] !== '') {
      const sig = twoArgs[0]
      const kwargs = mapFindpeaksOptions(twoArgs.slice(1))
      // Unmappable / malformed options → leave for the generic name-swap + flag.
      if (kwargs === null) return content
      imports.add('scipy.signal')
      const callArgs = kwargs.length ? `${sig}, ${kwargs.join(', ')}` : sig
      if (sig.includes('(')) {
        flags.push({
          type: 'WARNING',
          message: 'findpeaks signal argument is evaluated twice. Assign it to a variable first if evaluation is expensive or has side effects.',
          originalLine: line.originalLineStart,
          outputLine: 0,
          originalCode: content,
        })
      }
      flags.push({
        type: 'TOOLBOX',
        message: `findpeaks (two outputs) → values + locations: \`${locs}\` are 0-based indices from signal.find_peaks; \`${pks}\` are the values at those indices. Used for indexing, ${locs} is correct; as raw position numbers it differs from MATLAB by 1.`,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
      return `${locs} = signal.find_peaks(${callArgs})[0]\n${pks} = ${sig}[${locs}]`
    }
    // Options present → leave for the generic name-swap + flag.
    return content
  }

  let rewrote = false
  let evalFlagged = false
  const result = replaceFunctionCalls(content, 'findpeaks', (full, args) => {
    const argList = splitArgsRespectingStrings(args).map(s => s.trim())
    if (argList.length === 0 || argList[0] === '') return full
    const sig = argList[0]
    // Map any Name/Value options; unmappable ones → defer to the name-swap.
    const kwargs = mapFindpeaksOptions(argList.slice(1))
    if (kwargs === null) return full
    rewrote = true
    // SIG appears twice; warn once if it's an expression with side effects.
    if (sig.includes('(') && !evalFlagged) {
      evalFlagged = true
      flags.push({
        type: 'WARNING',
        message: 'findpeaks signal argument is evaluated twice in `SIG[signal.find_peaks(SIG)[0]]`. Assign it to a variable first if evaluation is expensive or has side effects.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
    const callArgs = kwargs.length ? `${sig}, ${kwargs.join(', ')}` : sig
    return `${sig}[signal.find_peaks(${callArgs})[0]]`
  })
  if (rewrote) {
    imports.add('scipy.signal')
    flags.push({
      type: 'TOOLBOX',
      message: 'findpeaks → peak values via signal.find_peaks(x)[0] (MATLAB returns values; scipy returns indices). For Name/Value options, pass height=/distance=/prominence= to find_peaks.',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
  }
  return result
}

function transformToolboxFunctions(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
  shadowed?: Set<string>,
): string {
  let result = content

  // findpeaks needs return-shape adaptation (values vs indices) before the
  // generic name-swap below; handle the single-output form here.
  result = convertFindpeaks(result, imports, flags, line)

  for (const [matlabName, mapping] of Object.entries(TOOLBOX_MAP)) {
    // A locally-assigned variable shadows the toolbox function of the same name.
    if (shadowed?.has(matlabName)) continue
    // Use negative lookbehind to avoid matching inside already-converted dotted names (np.interp etc.)
    const pattern = new RegExp(`(?<!\\.)\\b${escapeRegex(matlabName)}\\s*\\(`, 'g')
    if (!pattern.test(result)) continue
    pattern.lastIndex = 0

    for (const imp of mapping.imports) {
      imports.add(imp)
    }

    // Simple name replacement for passthrough
    if (mapping.args === 'passthrough') {
      result = result.replace(pattern, `${mapping.python}(`)
    } else {
      result = result.replace(pattern, `${mapping.python}(`)
    }

    // Add a TOOLBOX flag with specific guidance for known differences
    const specificHelp = TOOLBOX_SPECIFIC_HELP[matlabName]
    flags.push({
      type: 'TOOLBOX',
      message: specificHelp
        ? `${matlabName} → ${mapping.python} — ${specificHelp}`
        : `${matlabName} → ${mapping.python} (${mapping.toolbox} Toolbox) — check that arguments and return values match. Some functions have different default parameters or output formats.`,
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })

    if (mapping.flag && (!mapping.flagWhen || mapping.flagWhen(content))) {
      flags.push({
        type: mapping.flag.type,
        message: mapping.flag.message,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  return result
}

// ── Constants ───────────────────────────��─────────────────

function transformConstants(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  for (const [matlabConst, mapping] of Object.entries(CONSTANT_MAP)) {
    // Only match standalone constants (not part of identifiers)
    // Skip 'i' and 'j' as they're too commonly used as loop variables
    if (matlabConst === 'i' || matlabConst === 'j') continue

    // Use negative lookbehind to avoid matching inside already-converted np.xxx
    const pattern = new RegExp(`(?<!\\.)\\b${escapeRegex(matlabConst)}\\b`, 'g')
    if (!pattern.test(result)) continue
    pattern.lastIndex = 0

    // Skip occurrences inside string literals and comments — these words
    // often appear as part of documentation or literal filenames
    // (e.g. `'-eps -level2'` must not become `'-np.finfo(float).eps ...'`).
    result = replaceInCodeOnly(result, pattern, mapping.python)

    for (const imp of mapping.imports) {
      imports.add(imp)
    }

    if (mapping.flag) {
      flags.push({
        type: mapping.flag.type,
        message: mapping.flag.message,
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  return result
}

// ── Special Constructs ───────────────────────────────��────

function transformSpecialConstructs(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
  funcParams: string[] = [],
): string {
  let result = content

  // syms x y z [assumptions] — Symbolic Math command-syntax declaration.
  // `syms theta real` → `theta = sp.symbols('theta', real=True)`.
  const symsMatch = result.match(/^\s*syms\s+([A-Za-z].*?)\s*;?\s*$/)
  if (symsMatch && !symsMatch[1].includes('=') && !symsMatch[1].includes('(')) {
    const ASSUMPTIONS = new Set([
      'real', 'positive', 'negative', 'integer', 'rational', 'complex',
      'nonnegative', 'nonpositive', 'nonzero', 'finite',
    ])
    const names: string[] = []
    const assumptions: string[] = []
    for (const tok of symsMatch[1].split(/\s+/).filter(Boolean)) {
      if (ASSUMPTIONS.has(tok)) assumptions.push(`${tok}=True`)
      else names.push(tok)
    }
    if (names.length > 0) {
      imports.add('sympy')
      const kw = assumptions.length ? `, ${assumptions.join(', ')}` : ''
      result = `${names.join(', ')} = sp.symbols('${names.join(' ')}'${kw})`
    }
  }

  // assert(cond[, msg[, fmtargs...]]) → Python assert STATEMENT. As a call,
  // `assert(cond, msg)` asserts the tuple `(cond, msg)` — always true — silently
  // disabling the check. Strip the parens; map MATLAB's printf-style message.
  {
    const am = result.match(/^(\s*)assert\s*\((.*)\)\s*;?\s*$/)
    if (am) {
      const args = splitArgsRespectingStrings(am[2]).map(s => s.trim())
      if (args.length === 1) result = `${am[1]}assert ${args[0]}`
      else if (args.length === 2) result = `${am[1]}assert ${args[0]}, ${args[1]}`
      else if (args.length >= 3) result = `${am[1]}assert ${args[0]}, ${args[1]} % (${args.slice(2).join(', ')},)`
    }
  }

  // clearvars / clear / clc — no Python equivalent, remove or comment
  if (/^\s*clearvars\b/.test(result)) {
    result = '# clearvars — not needed in Python'
  }
  if (/^\s*clear\b/.test(result) && !/clear\s+all/.test(result)) {
    result = '# clear — not needed in Python (use del for specific variables)'
  }
  if (/^\s*clc\s*$/.test(result)) {
    result = '# clc — not needed in Python'
  }

  // grid on/off
  result = result.replace(/\bgrid\s+on\b/g, 'plt.grid(True)')
  result = result.replace(/\bgrid\s+off\b/g, 'plt.grid(False)')
  if (/plt\.grid/.test(result)) imports.add('matplotlib.pyplot')

  // axis equal/tight/square/auto/normal — MATLAB command syntax
  result = result.replace(/\baxis\s+equal\b/g, "plt.axis('equal')")
  result = result.replace(/\baxis\s+tight\b/g, "plt.axis('tight')")
  result = result.replace(/\baxis\s+square\b/g, "plt.axis('square')")
  result = result.replace(/\baxis\s+auto\b/g, "plt.axis('auto')")
  result = result.replace(/\baxis\s+normal\b/g, "plt.axis('auto')")
  result = result.replace(/\baxis\s+off\b/g, "plt.axis('off')")
  result = result.replace(/\baxis\s+on\b/g, "plt.axis('on')")
  result = result.replace(/\baxis\s+image\b/g, "plt.axis('image')")
  result = result.replace(/\baxis\s+vis3d\b/g, "plt.axis('equal')")
  result = result.replace(/\baxis\s+xy\b/g, "# axis xy (matplotlib default — origin bottom-left)")
  if (/plt\.axis/.test(result)) imports.add('matplotlib.pyplot')

  // colormap — MATLAB command: colormap gray / colormap(jet) → plt.set_cmap
  result = result.replace(/\bcolormap\s+(\w+)\b/g, (_, name) => {
    imports.add('matplotlib.pyplot')
    return `plt.set_cmap('${name}')`
  })
  result = result.replace(/\bcolormap\s*\(([^)]+)\)/, (_, arg) => {
    imports.add('matplotlib.pyplot')
    return `plt.set_cmap(${arg.trim()})`
  })

  // drawnow — force render: plt.pause(0.001)
  if (/^\s*drawnow\s*$/.test(result)) {
    imports.add('matplotlib.pyplot')
    result = 'plt.pause(0.001)'
  }
  // shg — show graph window
  if (/^\s*shg\s*$/.test(result)) {
    imports.add('matplotlib.pyplot')
    result = 'plt.show()'
  }
  // clf — clear figure
  if (/^\s*clf\s*$/.test(result)) {
    imports.add('matplotlib.pyplot')
    result = 'plt.clf()'
  }
  // cla — clear axes
  if (/^\s*cla\s*$/.test(result)) {
    imports.add('matplotlib.pyplot')
    result = 'plt.cla()'
  }
  // rotate3d / zoom — interactive 3D rotation / zoom, no matplotlib equivalent
  result = result.replace(/^\s*rotate3d\s*(on|off)?\s*$/, '# rotate3d — use plt toolbar for interactive rotation')
  result = result.replace(/^\s*zoom\s*(on|off|in|out|\d+\.?\d*)?\s*$/, '# zoom — use plt toolbar for interactive zoom')

  // hold on/off — drop the line. matplotlib accumulates plots by default,
  // so the conversion is correct without further user action; no flag needed.
  if (/\bhold\s+on\b/.test(result)) {
    result = result.replace(/\bhold\s+on\b/g, '')
    result = result.trim() || '# hold on removed — matplotlib accumulates plots by default'
  }
  if (/\bhold\s+off\b/.test(result)) {
    result = result.replace(/\bhold\s+off\b/g, '')
    result = result.trim() || '# hold off removed'
  }

  // rng — random number seed: rng shuffle → np.random.seed(); rng(n) → np.random.seed(n)
  if (/^\s*rng\s+shuffle\s*$/.test(result)) {
    imports.add('numpy')
    result = 'np.random.seed()'
  }
  result = result.replace(/^\s*rng\s+(\d+)\s*$/, (_, n) => {
    imports.add('numpy')
    return `np.random.seed(${n})`
  })
  // lighting / material / camlight — 3D rendering commands, no matplotlib equivalent
  result = result.replace(/^\s*lighting\s+\w+\s*$/, '# lighting — use mpl_toolkits for 3D rendering')
  result = result.replace(/^\s*material\s+\w+\s*$/, '# material — use mpl_toolkits for 3D rendering')
  result = result.replace(/^\s*camlight\b.*$/, '# camlight — use mpl_toolkits for 3D rendering')
  // view(az, el) — 3D viewport: keep but note
  // set(gcf, ...) / set(gca, ...) — GUI object property setting
  result = result.replace(/^\s*set\s*\(\s*gcf\s*,\s*/g, '# set(gcf, ')
  result = result.replace(/^\s*set\s*\(\s*gca\s*,\s*/g, '# set(gca, ')

  // close all
  result = result.replace(/\bclose\s+all\b/g, 'plt.close(\'all\')')
  if (/plt\.close/.test(result)) imports.add('matplotlib.pyplot')

  // containers.Map() → dict()
  result = result.replace(/\bcontainers\.Map\(\)/g, 'dict()')
  // m('key') = value → m['key'] = value (dict assignment)
  result = result.replace(/\b(\w+)\(('(?:[^']*)')\)\s*=/g, '$1[$2] =')
  // m.isKey('key') → 'key' in m
  result = result.replace(/\b(\w+)\.isKey\(([^)]+)\)/g, '$2 in $1')
  // m.keys() → list(m.keys())
  result = result.replace(/\b(\w+)\.keys\(\)/g, 'list($1.keys())')
  // m.values() → list(m.values())
  result = result.replace(/\b(\w+)\.values\(\)/g, 'list($1.values())')
  // m.remove('key') → del m['key'] (balanced-paren: handles dotted
  // prefixes AND nested calls like `os.remove(os.path.join(a, b))`)
  result = rewriteDottedRemove(result)

  // format long/short/etc — MATLAB display format, no Python equivalent
  if (/^\s*format\s+\w+/.test(result)) {
    result = `# ${result.trim()} — not needed in Python`
  }

  // diary on/off — MATLAB logging, no direct equivalent
  if (/^\s*diary\b/.test(result) && !/diary\s*\(/.test(result)) {
    result = `# ${result.trim()} — use Python logging module`
  }

  // close (standalone)
  if (/^\s*close\s*$/.test(result)) {
    result = 'plt.close()'
    imports.add('matplotlib.pyplot')
  }

  // figure (standalone, no args)
  if (/^\s*figure\s*$/.test(result)) {
    result = 'plt.figure()'
    imports.add('matplotlib.pyplot')
  }

  // nextpow2(x) → int(np.ceil(np.log2(x)))
  result = result.replace(
    /\bnextpow2\(([^)]+)\)/g,
    (_, arg) => {
      imports.add('numpy')
      return `int(np.ceil(np.log2(${arg.trim()})))`
    },
  )

  // yline(y) → plt.axhline(y=y), xline(x) → plt.axvline(x=x)
  // yline(y, '--k') → plt.axhline(y=y, linestyle='--', color='k')
  result = result.replace(
    /\byline\(([^,)]+)(?:,\s*'([^']*)'\s*)?(?:,\s*'([^']*)'\s*)?\)/g,
    (_, val, styleStr, labelStr) => {
      imports.add('matplotlib.pyplot')
      const parts = [`y=${val.trim()}`]
      if (styleStr) {
        // Parse combined linespec like '--k' into linestyle and color
        const lsMatch = styleStr.match(/^(-[-.]?|:)?([a-z])?$/)
        if (lsMatch) {
          if (lsMatch[1]) parts.push(`linestyle='${lsMatch[1]}'`)
          if (lsMatch[2]) parts.push(`color='${lsMatch[2]}'`)
        } else {
          parts.push(`linestyle='${styleStr}'`)
        }
      }
      if (labelStr) parts.push(`label='${labelStr}'`)
      return `plt.axhline(${parts.join(', ')})`
    },
  )
  result = result.replace(
    /\bxline\(([^,)]+)(?:,\s*'([^']*)'\s*)?(?:,\s*'([^']*)'\s*)?\)/g,
    (_, val, styleStr, labelStr) => {
      imports.add('matplotlib.pyplot')
      const parts = [`x=${val.trim()}`]
      if (styleStr) {
        const lsMatch = styleStr.match(/^(-[-.]?|:)?([a-z])?$/)
        if (lsMatch) {
          if (lsMatch[1]) parts.push(`linestyle='${lsMatch[1]}'`)
          if (lsMatch[2]) parts.push(`color='${lsMatch[2]}'`)
        } else {
          parts.push(`linestyle='${styleStr}'`)
        }
      }
      if (labelStr) parts.push(`label='${labelStr}'`)
      return `plt.axvline(${parts.join(', ')})`
    },
  )

  // A\b → np.linalg.solve(A, b)  (matrix left divide / mldivide)
  // Walks outside strings and finds the LHS/RHS operands using balanced
  // bracket matching so it handles A.T\Xt, A\(expr), nested backslashes, etc.
  {
    const stripped = result.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')
    if (hasBackslashOutsideStrings(stripped)) {
      const before = result
      result = rewriteMatrixLeftDivide(result)
      if (result !== before && result.includes('np.linalg.solve')) {
        imports.add('numpy')
        // No flag: np.linalg.solve(A, b) is the correct equivalent for the
        // matrix mldivide form. Scalar `b\a` (uncommon) would also reach here
        // but users almost always write that as `b/a` directly.
      }
    }
  }

  // strcmp / strcmpi / strcat / contains — all 2-arg string predicates
  // that used to use `[^)]+` regex capture, which broke on strings
  // containing `)` or nested function calls. Balanced-paren matching
  // via replaceFunctionCalls handles both.
  result = replaceFunctionCalls(result, 'strcmp', (_, args) => {
    const parts = splitArgsRespectingStrings(args).map(s => s.trim())
    if (parts.length < 2) return `strcmp(${args})`
    return `${parts[0]} == ${parts[1]}`
  })
  result = replaceFunctionCalls(result, 'strcmpi', (_, args) => {
    const parts = splitArgsRespectingStrings(args).map(s => s.trim())
    if (parts.length < 2) return `strcmpi(${args})`
    return `${parts[0]}.lower() == ${parts[1]}.lower()`
  })
  result = replaceFunctionCalls(result, 'strcat', (_, args) => {
    const parts = splitArgsRespectingStrings(args).map(s => s.trim())
    if (parts.length < 2) return `strcat(${args})`
    return parts.join(' + ')
  })
  result = replaceFunctionCalls(result, 'contains', (_, args) => {
    const parts = splitArgsRespectingStrings(args).map(s => s.trim())
    if (parts.length < 2) return `contains(${args})`
    return `${parts[1]} in ${parts[0]}`
  })

  // global variable declaration. MATLAB allows space-separated names
  // (`global X Y Z`), Python requires commas (`global X, Y, Z`).
  if (/^global\s+/.test(result.trim())) {
    const vars = result.trim().replace(/^global\s+/, '')
    const names = vars.split(/[\s,]+/).filter(Boolean).join(', ')
    result = `global ${names}`
    flags.push({
      type: 'WARNING',
      message: 'global variable — Python global scoping differs from MATLAB',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
  }

  // persistent variable
  if (/^persistent\s+/.test(result.trim())) {
    flags.push({
      type: 'WARNING',
      message: 'persistent variable — use class attribute or closure in Python',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
    result = `# ⚠ WARNING: persistent variable — use class attribute or closure\n# Original: ${content}`
  }

  // eval/feval — unsupported
  if (/\beval\s*\(/.test(result) || /\bfeval\s*\(/.test(result)) {
    flags.push({
      type: 'UNSUPPORTED',
      message: 'eval/feval cannot be converted deterministically',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
    result = `# ❌ UNSUPPORTED: eval/feval cannot be converted deterministically\n# Original: ${content}`
  }

  // assignin/evalin — unsupported
  if (/\bassignin\s*\(/.test(result) || /\bevalin\s*\(/.test(result)) {
    flags.push({
      type: 'UNSUPPORTED',
      message: 'assignin/evalin — workspace manipulation has no Python equivalent',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
    result = `# ❌ UNSUPPORTED: assignin/evalin — no Python equivalent\n# Original: ${content}`
  }

  // 4A. nargin/nargout — convert to Python default parameter pattern
  if (/\bnargin\b/.test(result)) {
    // nargin < N → Nth param is None (Python idiom for optional args)
    result = result.replace(/\bnargin\s*<\s*(\d+)\b/g, (_, n) => {
      const paramIdx = parseInt(n, 10) - 1  // nargin < 3 means param index 2 (0-based)
      const paramName = funcParams[paramIdx]
      return paramName ? `${paramName} is None` : `nargin < ${n}`
    })
    result = result.replace(/\bnargin\s*==\s*(\d+)\b/g, (_, n) => {
      const paramIdx = parseInt(n, 10) - 1
      const paramName = funcParams[paramIdx]
      return paramName ? `${paramName} is not None` : `nargin == ${n}`
    })
    // nargin >= N → Nth param is not None (at least N args given); must precede > N check
    result = result.replace(/\bnargin\s*>=\s*(\d+)\b/g, (_, n) => {
      const paramIdx = parseInt(n, 10) - 1
      const paramName = funcParams[paramIdx]
      return paramName ? `${paramName} is not None` : `nargin >= ${n}`
    })
    // nargin > N → (N+1)th param is not None (more than N args given)
    result = result.replace(/\bnargin\s*>\s*(\d+)\b/g, (_, n) => {
      const paramIdx = parseInt(n, 10)
      const paramName = funcParams[paramIdx]
      return paramName ? `${paramName} is not None` : `nargin > ${n}`
    })
    // Only fire the flag when nargin couldn't be cleanly converted — i.e.,
    // `nargin` still appears after the comparison rewrites above. Clean
    // conversions (`b is None`, `c is not None`) are self-documenting; the
    // user sees the Python idiom and knows to add `param=None` to the
    // signature. Flagging every nargin occurrence blocks ~68 CLEAN files that
    // compile and have correct Python idioms but no actionable guidance left.
    if (/\bnargin\b/.test(result)) {
      result = result.replace(/\bnargin\b/g, 'len(args)')
      flags.push({
        type: 'WARNING',
        message: 'nargin used — make optional parameters default to None in your function signature (e.g. def func(a, b=None):) and check with "if b is None:" instead of counting arguments.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }
  if (/\bnargout\b/.test(result)) {
    // Python always returns the full tuple — `nargout > N` is always-true
    // for the maximum-output case. Rewrite the canonical comparison forms
    // to constants so the surrounding `if`/`elseif` becomes a no-op
    // (`if True:` always executes the protected body, which is what we
    // want — the body assigns one of the return values). Callers ignore
    // extra returns with `_`.
    const before = result
    result = result.replace(/\bnargout\s*>=?\s*\d+\b/g, 'True')
    result = result.replace(/\bnargout\s*<=?\s*\d+\b/g, 'False')
    result = result.replace(/\bnargout\s*==\s*\d+\b/g, 'True')
    result = result.replace(/\bnargout\s*~=\s*\d+\b/g, 'False')
    // Bare nargout (rare, e.g. `n = nargout`, `if nargout:`) — replace with
    // True so any trailing `:` on the line remains valid Python syntax.
    // (Using an inline comment like `1  # explanation` would eat the `:`,
    // turning `if nargout:` into unparseable `if 1  # …:`.)
    if (/\bnargout\b/.test(result)) {
      result = result.replace(/\bnargout\b/g, 'True')
    }
    if (result === before) {
      // We saw `nargout` but didn't recognize the shape — keep the flag.
      flags.push({
        type: 'TODO',
        message: 'nargout used — Python always returns all values. Remove nargout checks and always return the full tuple. Callers can ignore extra values with _ (e.g. result, _ = func()).',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  // 4B. MException property access: ME.message → str(ME), ME.identifier → flag
  result = result.replace(/(\w+)\.message\b/g, (match, varName) => {
    // Only convert if the variable looks like an exception (typically ME, err, e)
    if (/^(ME|me|err|e|ex|exc)$/.test(varName)) {
      return `str(${varName})`
    }
    return match
  })
  result = result.replace(/(\w+)\.identifier\b/g, (match, varName) => {
    if (/^(ME|me|err|e|ex|exc)$/.test(varName)) {
      flags.push({
        type: 'TODO',
        message: 'MException.identifier — no direct Python equivalent',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
      return `type(${varName}).__name__`
    }
    return match
  })

  // 4D. Dynamic field access: s.(fieldName) → s[fieldName]. Uses
  // balanced-paren walking so inner calls like `.(name.lower())` don't
  // truncate at the first inner `)`.
  result = rewriteDynamicFieldAccess(result)

  return result
}

// ── Helpers ─────────────────────────────���─────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Wrap `not <expr>` in parens when it appears as the right-hand side of
 * a comparison operator. Python rejects `a != not b` but accepts
 * `a != (not b)`. `<expr>` is found via balanced-paren walking so things
 * like `not np.isfinite(b)` or `not foo(bar, baz)` get wrapped correctly.
 */
function wrapNotAfterComparison(source: string): string {
  const re = /([=<>!&|]=?)(\s+)not\s+/g
  const inserts: Array<{ start: number; end: number; replacement: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const op = m[1]
    const ws = m[2]
    // Validate this is actually a comparison op (not part of another
    // token like `==` embedded in the middle of something). Require the
    // char before `op` to not be another op char.
    const before = source[m.index - 1] || ''
    if (/[=<>!&|]/.test(before)) continue
    // Find the start of the `not` expression (after the `not `)
    const exprStart = m.index + op.length + ws.length + 'not '.length
    // Walk a balanced expression: identifiers, dots, function calls
    let j = exprStart
    let depth = 0
    let inStr = false
    let sc = ''
    while (j < source.length) {
      const c = source[j]
      if (inStr) {
        if (c === sc) {
          if (j + 1 < source.length && source[j + 1] === sc) { j += 2; continue }
          inStr = false
        }
        j++
        continue
      }
      if (c === "'" || c === '"') { inStr = true; sc = c; j++; continue }
      if (c === '(' || c === '[' || c === '{') { depth++; j++; continue }
      if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break
        depth--
        j++
        continue
      }
      if (depth === 0 && /[\s,:]/.test(c)) break
      if (depth === 0 && /[+\-*/%<>=&|^]/.test(c)) break
      j++
    }
    if (j > exprStart) {
      const matchEnd = m.index + m[0].length // end of `...not ` prefix
      const exprText = source.slice(matchEnd, j)
      inserts.push({
        start: matchEnd,
        end: j,
        replacement: `(not ${exprText})`,
      })
    }
  }
  if (inserts.length === 0) return source
  // Apply right-to-left, accounting for the extra `(not ` + `)` we added.
  // We also need to strip the `not ` that was already in the source —
  // our capture `matchEnd` is just past `not `, so:
  //   original: `!= not EXPR` (spans m.index..j)
  //   desired : `!= (not EXPR)`
  // Replace from `matchEnd - 4` (the 'n' of 'not') to `j`.
  let result = source
  for (let k = inserts.length - 1; k >= 0; k--) {
    const ins = inserts[k]
    // Find the `not ` that immediately precedes ins.start (there must be)
    const beforeNot = ins.start - 4 // `not ` is 4 chars
    if (result.slice(beforeNot, ins.start) !== 'not ') continue
    const exprText = result.slice(ins.start, ins.end)
    result = result.slice(0, beforeNot) + `(not ${exprText})` + result.slice(ins.end)
  }
  return result
}

/**
 * Rewrite `obj.remove(args)` → `del obj[args]` with balanced-paren
 * matching. Supports dotted prefixes (`s.obj.remove(k)` → `del s.obj[k]`).
 */
function rewriteDottedRemove(source: string): string {
  const re = /\b([\w.]+)\.remove\(/g
  const matches: Array<{ start: number; end: number; name: string; args: string }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const name = m[1]
    const nameStart = m.index
    const openIdx = nameStart + name.length + '.remove('.length - 1
    let depth = 1
    let j = openIdx + 1
    let inString = false
    let sc = ''
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
      j++
    }
    if (depth === 0) {
      matches.push({
        start: nameStart,
        end: j,
        name,
        args: source.slice(openIdx + 1, j),
      })
      re.lastIndex = j + 1
    }
  }
  if (matches.length === 0) return source
  let result = source
  for (let k = matches.length - 1; k >= 0; k--) {
    const r = matches[k]
    result = result.slice(0, r.start) + `del ${r.name}[${r.args}]` + result.slice(r.end + 1)
  }
  return result
}

/**
 * Rewrite MATLAB dynamic field access `obj.(expr)` → Python `obj[expr]`
 * with balanced-paren matching so nested calls inside the expression
 * survive intact.
 */
function rewriteDynamicFieldAccess(source: string): string {
  const out: string[] = []
  let i = 0
  while (i < source.length) {
    // Look for `.(` preceded by an indexable expression end: a word char, or a
    // closing `]`/`)` (so `s_array[n].(f)` and `obj.method().(f)` convert too).
    if (i + 1 < source.length && source[i] === '.' && source[i + 1] === '(' && i > 0 && /[\w\])]/.test(source[i - 1])) {
      // Find matching `)` with balanced depth
      let depth = 1
      let j = i + 2
      let inString = false
      let sc = ''
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
        j++
      }
      if (depth === 0) {
        const inner = source.slice(i + 2, j)
        out.push('[', inner, ']')
        i = j + 1
        continue
      }
    }
    out.push(source[i])
    i++
  }
  return out.join('')
}

/**
 * Find every `funcName(...)` call in `source` using balanced-paren
 * matching. Replaces `[^)]+` capture patterns that broke on nested calls
 * like `reshape(logsumexp(s,2), rows(a), cols(b))` — the old regex
 * stopped at the first inner `)` and produced garbage.
 *
 * The handler receives the full call string and the args substring (what
 * was between the outer parens). It returns the replacement text.
 */
function replaceFunctionCalls(
  source: string,
  funcName: string,
  handler: (fullCall: string, args: string) => string,
): string {
  const nameRe = new RegExp(`\\b${escapeRegex(funcName)}\\(`, 'g')
  const matches: Array<{ start: number; end: number; args: string }> = []
  let m: RegExpExecArray | null
  while ((m = nameRe.exec(source)) !== null) {
    const nameStart = m.index
    // Skip when preceded by `.` — that's a method call on some object,
    // not a free MATLAB function (e.g. `x.reshape(...)` after an idiom
    // rewrite must not re-match as `reshape(...)`).
    if (nameStart > 0 && source[nameStart - 1] === '.') {
      nameRe.lastIndex = nameStart + 1
      continue
    }
    const openIdx = nameStart + funcName.length
    let depth = 1
    let j = openIdx + 1
    let inString = false
    let sc = ''
    while (j < source.length && depth > 0) {
      const ch = source[j]
      if (inString) {
        if (ch === sc) {
          if (j + 1 < source.length && source[j + 1] === sc) {
            j += 2
            continue
          }
          inString = false
        }
        j++
        continue
      }
      if (ch === "'" || ch === '"') { inString = true; sc = ch; j++; continue }
      if (ch === '(') depth++
      else if (ch === ')') depth--
      if (depth > 0) j++
    }
    if (depth === 0) {
      matches.push({ start: nameStart, end: j, args: source.slice(openIdx + 1, j) })
      nameRe.lastIndex = j + 1
    }
  }
  if (matches.length === 0) return source
  // Apply replacements right-to-left so earlier indexes stay valid.
  let result = source
  for (let k = matches.length - 1; k >= 0; k--) {
    const { start, end, args } = matches[k]
    const fullCall = result.slice(start, end + 1)
    const replacement = handler(fullCall, args)
    result = result.slice(0, start) + replacement + result.slice(end + 1)
  }
  return result
}

/**
 * Split an argument list on commas, respecting string literals and
 * bracket/paren nesting. Needed because registry callers (template,
 * attribute, reshape cases) previously used `args.split(',')` which
 * corrupted strings containing commas — e.g. `strsplit('a,b,c', ',')`
 * got chopped into `['a`, `b`, `c'`, `' '`].
 */
function splitArgsRespectingStrings(args: string): string[] {
  const out: string[] = []
  let current = ''
  let paren = 0
  let bracket = 0
  let brace = 0
  let inString = false
  let stringChar = ''
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]
    if (inString) {
      current += ch
      if (ch === stringChar) {
        if (i + 1 < args.length && args[i + 1] === stringChar) {
          current += args[i + 1]
          i++
        } else {
          inString = false
        }
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      inString = true
      stringChar = ch
      current += ch
      continue
    }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    if (ch === ',' && paren === 0 && bracket === 0 && brace === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.length > 0) out.push(current)
  return out
}

/**
 * Convert MATLAB fprintf/sprintf to Python print/f-string.
 * fprintf('format', a, b) → print(f'format with {a} {b}')
 * fprintf(fid, 'format', a, b) → fid.write(f'format with {a} {b}')
 * sprintf('format', a, b) → f'format with {a} {b}'
 */
/**
 * Convert MATLAB fprintf/sprintf to Python using % formatting.
 *
 * Uses Python's % operator instead of f-strings because:
 * - MATLAB and Python % format specifiers are nearly identical
 * - No need to parse and rearrange arguments into {var:spec} syntax
 * - Handles nested function calls as arguments without breaking
 *
 * Examples:
 *   fprintf('x = %d, y = %.2f\n', x, y) → print('x = %d, y = %.2f' % (x, y))
 *   sprintf('val = %f', x)               → 'val = %f' % (x,)
 *   fprintf(fid, '%s\n', name)            → fid.write('%s\n' % (name,))
 */
function convertFormatCall(funcName: string, allArgs: string): string {
  const args = splitFormatArgs(allArgs)
  if (args.length === 0) return `print(${allArgs})`

  // Detect file-handle fprintf: first arg is not a string
  let fileHandle: string | null = null
  let formatIdx = 0
  if (funcName === 'fprintf' && args.length >= 2 &&
      !args[0].trim().startsWith("'") && !args[0].trim().startsWith('"')) {
    fileHandle = args[0].trim()
    formatIdx = 1
  }

  const formatStr = args[formatIdx]?.trim()
  if (!formatStr) return `print(${allArgs})`

  const valueArgs = args.slice(formatIdx + 1).map(a => a.trim())

  // The format string stays almost as-is — Python % formatting uses
  // the same specifiers as MATLAB (%d, %f, %s, %e, etc.)
  // Only change: %i → %d (Python prefers %d)
  let pyFormatStr = formatStr.replace(/%i/g, '%d')

  // Build the tuple of values
  if (valueArgs.length === 0) {
    // No format args — just a plain string
    if (funcName === 'sprintf') {
      return pyFormatStr
    }
    if (fileHandle) {
      return `${fileHandle}.write(${pyFormatStr})`
    }
    // Check for trailing \n — print adds newline automatically
    if (pyFormatStr.includes('\\n')) {
      pyFormatStr = pyFormatStr.replace(/\\n'\s*$/, "'").replace(/\\n"\s*$/, '"')
      return `print(${pyFormatStr})`
    }
    return `print(${pyFormatStr}, end='')`
  }

  // Build value tuple
  const tupleStr = valueArgs.length === 1
    ? `(${valueArgs[0]},)`
    : `(${valueArgs.join(', ')})`

  if (funcName === 'sprintf') {
    return `${pyFormatStr} % ${tupleStr}`
  }

  if (fileHandle) {
    return `${fileHandle}.write(${pyFormatStr} % ${tupleStr})`
  }

  // fprintf to stdout — convert to print
  // Check for trailing \n in format string
  if (pyFormatStr.match(/\\n['"]\s*$/)) {
    // Strip the \n from the format string — print adds its own
    pyFormatStr = pyFormatStr.replace(/\\n(['"]\s*)$/, '$1')
    return `print(${pyFormatStr} % ${tupleStr})`
  }

  return `print(${pyFormatStr} % ${tupleStr}, end='')`
}

/** Split format call arguments, respecting strings and nested parens */
function splitFormatArgs(argsStr: string): string[] {
  const args: string[] = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]
    if (inString) {
      current += ch
      if (ch === stringChar) {
        if (i + 1 < argsStr.length && argsStr[i + 1] === stringChar) {
          current += argsStr[i + 1]
          i++
        } else {
          inString = false
        }
      }
    } else {
      if (ch === "'" || ch === '"') {
        inString = true
        stringChar = ch
        current += ch
      } else if (ch === '(' || ch === '[') {
        depth++
        current += ch
      } else if (ch === ')' || ch === ']') {
        depth--
        current += ch
      } else if (ch === ',' && depth === 0) {
        args.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  if (current.trim()) args.push(current)
  return args
}

/**
 * Replace a substring only when it appears outside of string literals.
 */
function replaceOutsideStrings(code: string, search: string, replacement: string): string {
  const result: string[] = []
  let inString = false
  let stringChar = ''
  let i = 0

  while (i < code.length) {
    if (inString) {
      if (code[i] === stringChar) {
        if (i + 1 < code.length && code[i + 1] === stringChar) {
          result.push(code[i], code[i + 1])
          i += 2
        } else {
          result.push(code[i])
          inString = false
          i++
        }
      } else {
        result.push(code[i])
        i++
      }
    } else {
      if (code[i] === "'" || code[i] === '"') {
        // Check for transpose vs string
        if (code[i] === "'" && i > 0) {
          const prev = code[i - 1]
          if (prev === ')' || prev === ']' || prev === '.' || prev === "'" ||
              /[a-zA-Z0-9_]/.test(prev)) {
            result.push(code[i])
            i++
            continue
          }
        }
        inString = true
        stringChar = code[i]
        result.push(code[i])
        i++
      } else if (code.startsWith(search, i)) {
        result.push(replacement)
        i += search.length
      } else {
        result.push(code[i])
        i++
      }
    }
  }

  return result.join('')
}

/**
 * True iff code contains a `\` character outside of string literals.
 * Used to short-circuit the mldivide rewrite for lines that don't need it.
 */
function hasBackslashOutsideStrings(code: string): boolean {
  let inString = false
  let sc = ''
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < code.length && code[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '#') return false
    if (ch === '\\') return true
  }
  return false
}

/**
 * Rewrite A\b → np.linalg.solve(A, b). The previous regex
 * `/(\b\w+)\s*\\\s*(\w+)/` could not handle:
 *   - attribute access on the LHS (A.T\b)     — it captured only `T`
 *   - parenthesized RHS (A\(expr))            — it required a bare identifier
 *   - nested backslashes (A\(B\c))            — it had no recursion
 *
 * Strategy: walk the code left-to-right, find each `\` outside strings,
 * and if its LHS/RHS atoms are themselves free of `\`, substitute. Loop
 * until no replacements are made so nested uses resolve inside-out.
 */
function rewriteMatrixLeftDivide(code: string): string {
  let guard = 30
  while (guard-- > 0) {
    const replaced = tryReplaceOneMldivide(code)
    if (replaced === null) break
    code = replaced
  }
  return code
}

function tryReplaceOneMldivide(code: string): string | null {
  let inString = false
  let sc = ''
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < code.length && code[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') {
      if (ch === "'" && i > 0) {
        const prev = code[i - 1]
        if (prev === ')' || prev === ']' || prev === '.' || prev === "'" ||
            /[a-zA-Z0-9_]/.test(prev)) continue
      }
      inString = true; sc = ch; continue
    }
    if (ch === '#') break
    if (ch !== '\\') continue
    // Skip elementwise `.\` (rare) — leave it alone
    if (i > 0 && code[i - 1] === '.') continue

    const lhsStart = findMldivLhsStart(code, i)
    const rhsEnd = findMldivRhsEnd(code, i + 1)
    if (lhsStart < 0 || rhsEnd < 0) continue

    const lhs = code.slice(lhsStart, i)
    const rhs = code.slice(i + 1, rhsEnd)
    if (hasBackslashOutsideStrings(rhs) || hasBackslashOutsideStrings(lhs)) continue

    const replacement = `np.linalg.solve(${lhs.trim()}, ${rhs.trim()})`
    return code.slice(0, lhsStart) + replacement + code.slice(rhsEnd)
  }
  return null
}

function matchOpenBracketFromClose(s: string, closeIdx: number): number {
  const ch = s[closeIdx]
  const open = ch === ')' ? '(' : ch === ']' ? '[' : ch === '}' ? '{' : ''
  if (!open) return -1
  let depth = 1
  for (let j = closeIdx - 1; j >= 0; j--) {
    if (s[j] === open) {
      depth--
      if (depth === 0) return j
    } else if (s[j] === ch) {
      depth++
    }
  }
  return -1
}

function matchCloseBracketFromOpen(s: string, openIdx: number): number {
  const ch = s[openIdx]
  const close = ch === '(' ? ')' : ch === '[' ? ']' : ch === '{' ? '}' : ''
  if (!close) return -1
  let depth = 1
  for (let j = openIdx + 1; j < s.length; j++) {
    if (s[j] === close) {
      depth--
      if (depth === 0) return j
    } else if (s[j] === ch) {
      depth++
    }
  }
  return -1
}

function findMldivLhsStart(s: string, backslashIdx: number): number {
  let i = backslashIdx
  while (i > 0 && /\s/.test(s[i - 1])) i--
  const atomEnd = i
  while (i > 0) {
    const ch = s[i - 1]
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = matchOpenBracketFromClose(s, i - 1)
      if (open < 0) return -1
      i = open
      continue
    }
    if (/[\w.]/.test(ch)) { i--; continue }
    break
  }
  return i === atomEnd ? -1 : i
}

function findMldivRhsEnd(s: string, start: number): number {
  let i = start
  while (i < s.length && /\s/.test(s[i])) i++
  const atomStart = i
  const first = s[i]
  if (first === '(' || first === '[' || first === '{') {
    const close = matchCloseBracketFromOpen(s, i)
    if (close < 0) return -1
    i = close + 1
  }
  while (i < s.length) {
    const ch = s[i]
    if (/[\w.]/.test(ch)) { i++; continue }
    if (ch === '(' || ch === '[' || ch === '{') {
      const close = matchCloseBracketFromOpen(s, i)
      if (close < 0) return -1
      i = close + 1
      continue
    }
    break
  }
  return i === atomStart ? -1 : i
}

/**
 * Convert struct('key', val, ...) → {'key': val, ...}
 * Handles nested function calls in values like ci_boot(1).
 */
function convertStructCreation(content: string): string {
  if (!/\bstruct\s*\(/.test(content)) return content
  // Convert EVERY struct(...) on the line — a cell row can hold several. The
  // old version converted only the first, leaving later ones to a `struct`→
  // `dict` fallback that produced invalid `dict('k', v, …)`.
  return replaceFunctionCalls(content, 'struct', (full, argsStr) => {
    const args = splitFormatArgs(argsStr)
    if (args.length < 2 || args.length % 2 !== 0) return full // can't parse — leave
    const pairs: string[] = []
    for (let k = 0; k < args.length; k += 2) {
      const key = args[k].trim()
      if (!(key.startsWith("'") || key.startsWith('"'))) return full // non-string key — leave
      // Recurse so a nested struct(...) value converts too.
      const val = convertStructCreation(args[k + 1].trim())
      pairs.push(`${key}: ${val}`)
    }
    return `{${pairs.join(', ')}}`
  })
}

/**
 * Walk `source` and rewrite each top-level `find(...)` call to
 * `np.flatnonzero(...)` (or its `[0]` / `[-1]` first/last variants) using
 * balanced-paren matching so nested constructs like `x(find(c))`,
 * `find(a < b & c > d)`, and `find(arr.flat)` all parse correctly.
 *
 * Skips matches that look like method calls on something else
 * (`.find(...)` — not MATLAB's free function), and matches inside
 * single- or double-quoted strings.
 */
function rewriteFindCallsToFlatnonzero(source: string, imports: Set<string>): string {
  let result = ''
  let i = 0
  let inString: '' | "'" | '"' = ''
  while (i < source.length) {
    const ch = source[i]
    if (inString) {
      result += ch
      if (ch === inString) inString = ''
      i++
      continue
    }
    if (ch === "'" || ch === '"') {
      inString = ch
      result += ch
      i++
      continue
    }
    // Match `find(` at a word boundary (not `.find(`).
    if (
      source.startsWith('find(', i) &&
      (i === 0 || !/[A-Za-z0-9_.]/.test(source[i - 1]))
    ) {
      const openIdx = i + 4 // index of `(`
      let depth = 1
      let j = openIdx + 1
      let strQ: '' | "'" | '"' = ''
      while (j < source.length && depth > 0) {
        const c = source[j]
        if (strQ) {
          if (c === strQ) strQ = ''
        } else if (c === "'" || c === '"') {
          strQ = c
        } else if (c === '(') depth++
        else if (c === ')') depth--
        if (depth === 0) break
        j++
      }
      if (depth === 0) {
        const args = source.slice(openIdx + 1, j)
        // Detect ,1,'first' / ,1,'last' suffix at the top level of the args.
        const argList = splitTopLevelArgs(args)
        imports.add('numpy')
        let replacement: string
        if (argList.length >= 3 && /^\s*1\s*$/.test(argList[1]) && /^\s*'first'\s*$/.test(argList[2])) {
          replacement = `np.flatnonzero(${argList[0].trim()})[0]`
        } else if (argList.length >= 3 && /^\s*1\s*$/.test(argList[1]) && /^\s*'last'\s*$/.test(argList[2])) {
          replacement = `np.flatnonzero(${argList[0].trim()})[-1]`
        } else {
          replacement = `np.flatnonzero(${args})`
        }
        result += replacement
        i = j + 1
        continue
      }
    }
    result += ch
    i++
  }
  return result
}

/** Split `s` on commas at depth 0, ignoring quoted strings and nested parens/brackets. */
function splitTopLevelArgs(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let inString: '' | "'" | '"' = ''
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (c === inString) inString = ''
      continue
    }
    if (c === "'" || c === '"') { inString = c; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out
}
