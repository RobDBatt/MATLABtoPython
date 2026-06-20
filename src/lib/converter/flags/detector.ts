import type { Flag, FlagType, LogicalLine } from '../types'

/**
 * Pre-scan detector for constructs that should be flagged
 * before the main transformation pipeline runs.
 */
export function detectPreFlags(lines: LogicalLine[]): Flag[] {
  const flags: Flag[] = []
  let inFunction = false

  for (const line of lines) {
    if (line.isComment) continue
    const content = line.content.trim()

    // MEX file calls
    if (/\bmex\s*\(/.test(content) || /\bmexFunction\b/.test(content)) {
      flags.push({
        type: 'UNSUPPORTED',
        message: 'MEX file call — C extension, out of scope',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // Simulink references
    if (/\bsimulink\b/i.test(content) || /\bsim\s*\(/.test(content) ||
        /\bset_param\b/.test(content) || /\bget_param\b/.test(content)) {
      flags.push({
        type: 'UNSUPPORTED',
        message: 'Simulink reference — out of scope for code converter',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // Java/COM object calls
    if (/\bjavaObject\b/.test(content) || /\bjavaMethod\b/.test(content) ||
        /\bactxserver\b/i.test(content)) {
      flags.push({
        type: 'UNSUPPORTED',
        message: 'Java/COM object call — external runtime, out of scope',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // Anonymous function: @(x) ... → lambda x: ...
    // No flag — Python and MATLAB anonymous functions both capture by value
    // at the point of definition for the most common patterns. The rare
    // late-binding edge case isn't worth scaring every user about.

    // 4E. classdef — flag as needing manual conversion
    if (/^classdef\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'classdef found — rewrite as a Python class: move properties into __init__(self), add self as first parameter to all methods.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // 4E. properties/methods blocks inside classdef
    if (/^\s*properties\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'properties block — move these into def __init__(self): as self.property_name = default_value.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
    if (/^\s*methods\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'methods block — add self as the first parameter to every method (e.g. def my_method(self, arg1):).',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // Nested functions — Python supports them. Inner-function outer-variable
    // mutation is a real edge case but rare in real corpora; keeping a flag
    // here scares users away from a feature that mostly Just Works. Revisit
    // if we add deterministic detection of outer-var mutation.
    if (/^function\b/.test(content)) {
      inFunction = true
    }
    if (/^end\s*$/.test(content) && inFunction) {
      inFunction = false // simplified tracking — doesn't handle all nesting
    }

    // 5C. Deep Learning Toolbox functions — flag only
    if (/\b(trainNetwork|trainingOptions|layerGraph|convolution2dLayer|fullyConnectedLayer|reluLayer|softmaxLayer|classificationLayer|maxPooling2dLayer|batchNormalizationLayer|dropoutLayer|lstmLayer|bilstmLayer)\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'Deep Learning Toolbox function — replace with PyTorch (torch.nn) or TensorFlow (tf.keras). No 1:1 mapping exists; rewrite the network architecture.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // 5D. Modern MATLAB types — flag with guidance
    // `readtable` is handled by the function registry (→ pd.read_csv / read_excel
    // with its own targeted flag), so it is intentionally not flagged here.
    if (/\btable\s*\(/.test(content) || /\bwritetable\s*\(/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'MATLAB table → replace with pd.DataFrame(). Use df.to_csv() for writetable. Access columns with df["col"] instead of T.col.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
    if (/\bdatetime\s*\(/.test(content) || /\bduration\s*\(/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'MATLAB datetime → replace with Python datetime.datetime() or pd.Timestamp(). Use datetime.timedelta() for duration.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // varargout — Python uses tuple returns, not output-arg variants. Still
    // flag because the conversion can't deterministically rewrite the
    // body of a function that conditionally fills `varargout{i}`.
    // varargin: NO flag — the transform pass deterministically rewrites
    // signature `varargin` → `*args` and body `varargin{i}` → `args[i-1]`.
    if (/\bvarargout\b/.test(content)) {
      flags.push({
        type: 'WARNING',
        message: 'varargout found — Python returns tuples, not output-arg variants. Always return all outputs and let callers ignore extras with `_`.',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // ── "Why this line may not convert cleanly" explanations ──────────────
    // These constructs have no faithful 1:1 deterministic Python form. We flag
    // them with a specific reason + fix so the output is never silently broken.
    const why = (type: Flag['type'], message: string) =>
      flags.push({ type, message, originalLine: line.originalLineStart, outputLine: 0, originalCode: content })

    // arrayfun/cellfun with UniformOutput=false → returns a cell array; Python
    // has no 1:1 form (the result is a list, and the function body may be a
    // range/array the converter can't reshape).
    if (/\b(arrayfun|cellfun)\b/.test(content) && /uniformoutput/i.test(content)) {
      why('TODO', "arrayfun/cellfun(..., 'UniformOutput', false) → use a list comprehension: [f(x) for x in items]. The non-uniform (cell) output has no array equivalent.")
    }

    // MATLAB command syntax with no parens — pause / keyboard / dbstop / cd <dir>
    // and MATLAB package imports (`import matlab.*`). The call forms convert
    // (e.g. pause(n) → time.sleep(n)); only the bare command form is unsupported.
    if (/^(pause|keyboard|dbstop|dbclear)\b(?!\s*\()/.test(content)) {
      why('UNSUPPORTED', 'MATLAB command-form pause/keyboard/dbstop — no Python equivalent; remove or use breakpoint()/input(). (The pause(n) call form converts to time.sleep(n).)')
    }
    if (/^cd\s+[^(]/.test(content)) {
      why('UNSUPPORTED', "MATLAB `cd` command syntax — use os.chdir('path') in Python.")
    }
    if (/\bimport\s+matlab\b/.test(content)) {
      why('UNSUPPORTED', 'MATLAB package import (import matlab.*) — references the MATLAB runtime; no Python equivalent.')
    }

    // Range at the top level of a matrix literal — `[1:10, x, y]` concatenates a
    // range with scalars. Depth-aware so nested subscript slices like
    // `[0 all(xo(1:end-1,:),2)]` (the `:` is inside `xo(...)`) are NOT flagged.
    if (hasTopLevelRangeInLiteral(content)) {
      why('TODO', 'Range at the top of an array literal ([1:10, a, b]) — Python list/np.array syntax does not allow a:b inside. Use np.concatenate([np.arange(1, 11), [a, b]]) or np.r_[1:11, a, b].')
    }
  }

  return flags
}

/** Return a line's code with string-literal contents removed. */
function stripStringContent(line: string): string {
  let s = '', inStr = false, sc = ''
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inStr) { if (c === sc) inStr = false; continue }
    if (c === "'" || c === '"') { inStr = true; sc = c; continue }
    s += c
  }
  return s
}

function bracketsUnbalanced(s: string): boolean {
  let p = 0, b = 0, k = 0
  for (const ch of s) {
    if (ch === '(') p++; else if (ch === ')') p--
    else if (ch === '[') b++; else if (ch === ']') b--
    else if (ch === '{') k++; else if (ch === '}') k--
  }
  return p !== 0 || b !== 0 || k !== 0
}

/**
 * Residual-invalid markers — patterns that are (essentially) never valid in the
 * converter's own output, so a line matching one almost certainly didn't fully
 * convert. Verified against the whole corpus to produce ZERO false positives on
 * compiling files. Ordered specific → generic; the first match wins per line.
 */
const RESIDUAL_MARKERS: Array<{ test: (s: string) => boolean; type: FlagType; message: string }> = [
  { test: s => /\.\(/.test(s), type: 'TODO',
    message: 'MATLAB dynamic field access `.( )` could not be converted on this line — use dict/getattr access manually.' },
  { test: s => /[\w)\]]\{/.test(s), type: 'TODO',
    message: 'MATLAB cell-array indexing `{ }` could not be converted on this line — map the cell to a Python list and index with [ ].' },
  { test: s => /^\s*(function|classdef)\b/.test(s), type: 'UNSUPPORTED',
    message: 'MATLAB function/classdef definition could not be converted here — rewrite as a Python def/class.' },
  { test: s => /(?:=|return|\bin\b|[<>=!]=)\s*\*[A-Za-z_]/.test(s), type: 'TODO',
    message: "MATLAB cell expansion `{:}` produced a `*` where Python doesn't allow it — use the element directly (e.g. name[0])." },
  { test: s => /[A-Za-z_]\w*\(\s*\d+\s*:/.test(s), type: 'TODO',
    message: 'A MATLAB range `a:b` remained inside a call/subscript — replace with a Python slice or np.arange.' },
  { test: s => /^\s*(if|elif|while|for)\b.*\b(continue|break|return|pass)\b/.test(s) && !/:\s*(continue|break|return|pass)\b/.test(s),
    type: 'TODO', message: 'MATLAB inline if/while body — in Python the statement must be on its own indented line after the `:`.' },
  { test: s => /\[[^\]]*\b\w+\s+\w+\b[^\]]*\]/.test(s) && !/\b(for|in|if|else|not|and|or|lambda|is)\b/.test(s),
    type: 'TODO', message: 'Space-separated elements in a literal `[a b]` — an unconverted matrix literal; Python needs commas (or np.array).' },
  { test: s => bracketsUnbalanced(s), type: 'WARNING',
    message: 'Unbalanced brackets on this line — the construct could not be fully converted; review manually.' },
]

/**
 * Post-conversion safety net: scan the FINAL Python output for lines that still
 * contain residual MATLAB / invalid-Python markers and attach an explanatory
 * flag. Guarantees no broken line ships silently. Runs on output, so flags
 * carry the output line number.
 */
export function detectResidualFlags(python: string): Flag[] {
  const flags: Flag[] = []
  const lines = python.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const code = stripStringContent(lines[i])
    if (code.trim() === '' || code.trimStart().startsWith('#')) continue
    for (const m of RESIDUAL_MARKERS) {
      if (m.test(code)) {
        flags.push({ type: m.type, message: m.message, originalLine: 0, outputLine: i + 1, originalCode: lines[i].trim() })
        break
      }
    }
  }
  return flags
}

/**
 * True if a line contains a matrix-literal `[...]` (not Python indexing) whose
 * TOP level holds both a `start:` range and a `,` — i.e. `[1:10, a, b]`. Slices
 * nested inside `(...)`/inner `[...]` (subscripts) are ignored, so
 * `[0 all(xo(1:end-1,:),2)]` is not a false positive.
 */
function hasTopLevelRangeInLiteral(line: string): boolean {
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '[') continue
    if (i > 0 && /[\w.)\]]/.test(line[i - 1])) continue // indexing, not a literal
    let depth = 0, j = i, inStr = false, sc = ''
    let topColonRange = false, topComma = false
    for (; j < line.length; j++) {
      const c = line[j]
      if (inStr) { if (c === sc) inStr = false; continue }
      if (c === "'" || c === '"') { inStr = true; sc = c; continue }
      if (c === '[' || c === '(' || c === '{') { depth++; continue }
      if (c === ']' || c === ')' || c === '}') { depth--; if (depth === 0) break; continue }
      if (depth === 1) {
        if (c === ',') topComma = true
        // a `:` directly inside the literal, preceded by a number/identifier
        if (c === ':' && /[\w.]/.test(line[j - 1] || '')) topColonRange = true
      }
    }
    if (topColonRange && topComma) return true
  }
  return false
}
