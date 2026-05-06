import type { Flag, LogicalLine } from '../types'

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
    if (/\btable\s*\(/.test(content) || /\breadtable\s*\(/.test(content) || /\bwritetable\s*\(/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'MATLAB table → replace with pd.DataFrame(). Use pd.read_csv() for readtable and df.to_csv() for writetable. Access columns with df["col"] instead of T.col.',
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
  }

  return flags
}
