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

    // Anonymous function with closure potential
    if (/@\s*\(/.test(content)) {
      flags.push({
        type: 'WARNING',
        message: 'Anonymous function — Python lambda captures by reference (MATLAB captures by value)',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // 4E. classdef — flag as needing manual conversion
    if (/^classdef\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'classdef — convert to Python class manually (properties → __init__, methods → class methods)',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // 4E. properties/methods blocks inside classdef
    if (/^\s*properties\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'properties block — define as __init__ attributes in Python class',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
    if (/^\s*methods\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'methods block — define as class methods in Python (add self parameter)',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // 4E. Nested functions — function inside a function
    if (/^function\b/.test(content)) {
      if (inFunction) {
        flags.push({
          type: 'WARNING',
          message: 'Nested function — Python supports nested defs but closure scoping differs from MATLAB',
          originalLine: line.originalLineStart,
          outputLine: 0,
          originalCode: content,
        })
      }
      inFunction = true
    }
    if (/^end\s*$/.test(content) && inFunction) {
      inFunction = false // simplified tracking — doesn't handle all nesting
    }

    // 5C. Deep Learning Toolbox functions — flag only
    if (/\b(trainNetwork|trainingOptions|layerGraph|convolution2dLayer|fullyConnectedLayer|reluLayer|softmaxLayer|classificationLayer|maxPooling2dLayer|batchNormalizationLayer|dropoutLayer|lstmLayer|bilstmLayer)\b/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'Deep Learning Toolbox function — use PyTorch (torch.nn) or TensorFlow (tf.keras) equivalent',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // 5D. Modern MATLAB types — flag with guidance
    if (/\btable\s*\(/.test(content) || /\breadtable\s*\(/.test(content) || /\bwritetable\s*\(/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'MATLAB table → use pandas DataFrame (pd.DataFrame, pd.read_csv, df.to_csv)',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
    if (/\bdatetime\s*\(/.test(content) || /\bduration\s*\(/.test(content)) {
      flags.push({
        type: 'TODO',
        message: 'MATLAB datetime → use Python datetime module or pd.Timestamp',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }

    // varargin/varargout
    if (/\bvarargin\b/.test(content) || /\bvarargout\b/.test(content)) {
      flags.push({
        type: 'WARNING',
        message: 'varargin/varargout → use *args/**kwargs in Python function signature',
        originalLine: line.originalLineStart,
        outputLine: 0,
        originalCode: content,
      })
    }
  }

  return flags
}
