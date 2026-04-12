import type { StructuredLine, Flag, TransformResult } from '../types'
import { FUNCTION_MAP } from '../registry/functions'
import { TOOLBOX_MAP } from '../registry/toolboxes'
import { OPERATOR_MAP } from '../registry/operators'
import { CONSTANT_MAP } from '../registry/constants'

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
export function transform(lines: StructuredLine[]): TransformResult {
  const imports = new Set<string>()
  const flags: Flag[] = []
  const transformed: StructuredLine[] = []

  for (const line of lines) {
    if (line.isComment || line.content.trim() === '' || line.isBlockClose) {
      transformed.push(line)
      continue
    }

    let content = line.content
    const lineFlags: Flag[] = []

    // 0. Pre-transform: MATLAB syntax that needs converting before everything else
    content = preTransform(content, imports, lineFlags, line)

    // 1. Control flow transformations
    content = transformControlFlow(content, line, lineFlags)

    // 2. Operators (order matters — element-wise before matrix)
    content = transformOperators(content, lineFlags, line)

    // 3. Known functions
    content = transformFunctions(content, imports, lineFlags, line)

    // 4. Toolbox functions
    content = transformToolboxFunctions(content, imports, lineFlags, line)

    // 5. Constants (only standalone words, not parts of identifiers)
    content = transformConstants(content, imports, lineFlags, line)

    // 6. Special constructs
    content = transformSpecialConstructs(content, imports, lineFlags, line)

    // 7. Post-transform: convert remaining MATLAB indexing syntax
    content = postTransform(content, imports, lineFlags, line)

    flags.push(...lineFlags)
    transformed.push({ ...line, content })
  }

  return { transformed, imports, flags }
}

// ── Pre-Transform (MATLAB syntax normalization) ───────────

function preTransform(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

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
  result = result.replace(
    /\bstruct\(([^)]+)\)/g,
    (match, argsStr) => {
      // Try to parse as key-value pairs
      const args = splitFormatArgs(argsStr)
      if (args.length >= 2 && args.length % 2 === 0) {
        const pairs: string[] = []
        let allKeysAreStrings = true
        for (let idx = 0; idx < args.length; idx += 2) {
          const key = args[idx].trim()
          const val = args[idx + 1].trim()
          if (!(key.startsWith("'") || key.startsWith('"'))) {
            allKeysAreStrings = false
            break
          }
          pairs.push(`${key}: ${val}`)
        }
        if (allKeysAreStrings && pairs.length > 0) {
          return `{${pairs.join(', ')}}`
        }
      }
      return match // can't parse, leave as-is
    },
  )

  // 1A + Multiple return assignment: [a, b] = func() → a, b = func()
  // Also handles tilde discard: [~, idx] → _, idx
  result = result.replace(
    /^\s*\[([^\]]+)\]\s*=\s*/,
    (_, vars) => {
      const varList = vars.split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map((v: string) => v === '~' ? '_' : v)
      return `${varList.join(', ')} = `
    },
  )

  // Inline range expressions (not in for loops): (0:N-1) → np.arange(0, N)
  // Match (start:end) but ONLY when NOT preceded by a word char (which would be indexing)
  // e.g. "(0:L-1)" is a range, but "y2(N/2:end)" is indexing
  if (!/^\s*(for|parfor)\b/.test(content)) {
    // Two-part range: (expr:expr)
    result = result.replace(
      /([^a-zA-Z0-9_]|^)\(([^()]*?):([^()]*?)\)/g,
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
      /([^a-zA-Z0-9_]|^)\(([^()]*?):([^()]*?):([^()]*?)\)/g,
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

function postTransform(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  // Convert MATLAB plot named arguments: 'LineWidth', 1.5 → linewidth=1.5
  result = convertMatlabNamedArgs(result)

  // Convert MATLAB indexing: varName(expr:end) → varName[expr:]
  result = convertMatlabIndexing(result, content)

  // Convert complex standalone range expressions: -(N/2):(N/2)-1 → np.arange(...)
  result = convertComplexRanges(result, imports, flags, line)

  // Flag any remaining colon `:` outside of strings/slices that looks like a MATLAB range
  if (/:/.test(result) && !result.includes('#') && !/^\s*(for|elif|else|if|while|def|try|except|case)/.test(result)) {
    const stripped = result.replace(/\[[^\]]*\]/g, '').replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')
    if (/:/.test(stripped) && !/:\s*$/.test(stripped)) {
      flags.push({
        type: 'TODO',
        message: 'Line contains MATLAB range expression (:) — convert to np.arange() or slice manually',
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

  // Match MATLAB name-value pairs: 'PropertyName', value
  // Property names are CamelCase starting with uppercase (LineWidth, MarkerSize, etc.)
  // Process from right to left to avoid consuming data arguments as property names
  // Pattern: 'UpperCamelCase', followed by value
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
function convertComplexRanges(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  if (!/^\s*(for|parfor|def|if|elif|while)\b/.test(content) && !content.includes('#') && !content.includes('lambda')) {
    // Look for colon that's NOT inside brackets, strings, or already converted
    // Strategy: find bare colons and check if they look like range expressions
    let result = content

    // Pattern: expr1:expr2 where neither side contains = or comparison operators
    // and the line isn't a slice (no [ before the colon)
    const stripped = result.replace(/'[^']*'/g, 'STR').replace(/"[^"]*"/g, 'STR').replace(/\[[^\]]*\]/g, 'BRK')

    // Find colons that are range operators (not in slices, not in Python syntax)
    if (/:/.test(stripped) && !/:\s*$/.test(stripped)) {
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
  ])
  return KNOWN.has(name)
}

// ── Control Flow ──────────────────────────────────────────

function transformControlFlow(
  content: string,
  line: StructuredLine,
  flags: Flag[],
): string {
  const trimmed = content.trim()

  // function [out1, out2] = name(in1, in2)
  const funcMatch = trimmed.match(
    /^function\s+(?:\[([^\]]*)\]\s*=\s*|(\w+)\s*=\s*)?(\w+)\s*\(([^)]*)\)/,
  )
  if (funcMatch) {
    const outputs = funcMatch[1] || funcMatch[2] || ''
    const name = funcMatch[3]
    const inputs = funcMatch[4] || ''
    if (outputs) {
      const outVars = outputs.split(',').map(s => s.trim()).filter(Boolean)
      const returnPart = outVars.length === 1 ? outVars[0] : outVars.join(', ')
      return `def ${name}(${inputs}):  # returns ${returnPart}`
    }
    return `def ${name}(${inputs}):`
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

  // while
  if (/^while\b/.test(trimmed)) {
    const cond = trimmed.replace(/^while\s+/, '').trim()
    return `while ${cond}:`
  }

  // if
  if (/^if\b/.test(trimmed)) {
    const cond = trimmed.replace(/^if\s+/, '').trim()
    return `if ${cond}:`
  }

  // elseif
  if (/^elseif\b/.test(trimmed)) {
    const cond = trimmed.replace(/^elseif\s+/, '').trim()
    return `elif ${cond}:`
  }

  // else
  if (/^else\s*$/.test(trimmed)) {
    return 'else:'
  }

  // switch
  if (/^switch\b/.test(trimmed)) {
    const expr = trimmed.replace(/^switch\s+/, '').trim()
    flags.push({
      type: 'WARNING',
      message: 'switch/case converted to if/elif chain for broad Python compatibility',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: trimmed,
    })
    return `# switch ${expr}  → converted to if/elif`
  }

  // case
  if (/^case\b/.test(trimmed)) {
    const val = trimmed.replace(/^case\s+/, '').trim()
    // First case becomes if, subsequent cases become elif
    // We'll handle this simply — output elif and fix up in cleanup if needed
    return `elif ${val}:`  // Note: first case should be 'if' — handled in cleanup
  }

  // otherwise
  if (/^otherwise\s*$/.test(trimmed)) {
    return 'else:'
  }

  // try
  if (/^try\s*$/.test(trimmed)) {
    return 'try:'
  }

  // catch
  if (/^catch\b/.test(trimmed)) {
    const errVar = trimmed.replace(/^catch\s*/, '').trim()
    if (errVar) {
      return `except Exception as ${errVar}:`
    }
    return 'except Exception:'
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
  const parts = expr.split(':').map(s => s.trim())

  if (parts.length === 2) {
    // start:end → range(start-1, end) for 1-based to 0-based
    const [start, end] = parts
    // If start is 1, simplify to range(end)
    if (start === '1') {
      return `range(${end})`
    }
    return `range(${start}, ${end} + 1)`
  }

  if (parts.length === 3) {
    // start:step:end → range(start, end+1, step)
    const [start, step, end] = parts
    flags.push({
      type: 'INDEX',
      message: 'for loop range with step — verify bounds are correct',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: expr,
    })
    return `range(${start}, ${end} + 1, ${step})`
  }

  // Fallback — complex expression, pass through
  return `range(${expr})  # 📋 TODO: verify range conversion`
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

    // Use careful replacement to avoid breaking strings
    result = replaceOutsideStrings(result, op.matlab, op.python)

    if (op.flag) {
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

function transformFunctions(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  for (const [matlabName, mapping] of Object.entries(FUNCTION_MAP)) {
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
        const reshapePattern = new RegExp(
          `\\b${escapeRegex(matlabName)}\\(([^)]+)\\)`,
          'g',
        )
        result = result.replace(reshapePattern, (_, args) => {
          const argList = args.split(',').map((s: string) => s.trim())
          if (argList.length > 1) {
            return `${mapping.python}((${argList.join(', ')}))`
          }
          return `${mapping.python}(${args})`
        })
        break
      }

      case 'attribute': {
        // size(A) → A.shape
        const attrPattern = new RegExp(
          `\\b${escapeRegex(matlabName)}\\(([^)]+)\\)`,
          'g',
        )
        result = result.replace(attrPattern, (_, args) => {
          const argList = args.split(',').map((s: string) => s.trim())
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
        const tmplPattern = new RegExp(
          `\\b${escapeRegex(matlabName)}\\(([^)]+)\\)`,
          'g',
        )
        result = result.replace(tmplPattern, (_, args) => {
          const firstArg = args.split(',')[0].trim()
          return mapping.python.replace(/\{\}/g, firstArg)
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

      default:
        // 'custom' — just do name replacement, flag if needed
        result = result.replace(pattern, `${mapping.python}(`)
        break
    }

    // Add flag if mapping specifies one
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

// ── Toolbox Functions ─────────��───────────────────────────

function transformToolboxFunctions(
  content: string,
  imports: Set<string>,
  flags: Flag[],
  line: StructuredLine,
): string {
  let result = content

  for (const [matlabName, mapping] of Object.entries(TOOLBOX_MAP)) {
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

    // Always add a TOOLBOX flag for toolbox functions
    flags.push({
      type: 'TOOLBOX',
      message: `${matlabName} → ${mapping.python} (${mapping.toolbox}) — verify behavior matches`,
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })

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

    result = result.replace(pattern, mapping.python)

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
): string {
  let result = content

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

  // hold on/off — remove with warning
  if (/\bhold\s+on\b/.test(result)) {
    result = result.replace(/\bhold\s+on\b/g, '')
    result = result.trim() || '# hold on removed — matplotlib accumulates plots by default'
    flags.push({
      type: 'WARNING',
      message: 'hold on removed — matplotlib accumulates plots by default',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
  }
  if (/\bhold\s+off\b/.test(result)) {
    result = result.replace(/\bhold\s+off\b/g, '')
    result = result.trim() || '# hold off removed'
  }

  // close all
  result = result.replace(/\bclose\s+all\b/g, 'plt.close(\'all\')')
  if (/plt\.close/.test(result)) imports.add('matplotlib.pyplot')

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

  // global variable declaration
  if (/^global\s+/.test(result.trim())) {
    const vars = result.trim().replace(/^global\s+/, '')
    result = `global ${vars}`
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

  // 4A. nargin/nargout — flag with guidance
  if (/\bnargin\b/.test(result)) {
    result = result.replace(/\bnargin\b/g, 'len(args)')
    flags.push({
      type: 'WARNING',
      message: 'nargin → len(args) — function signature needs *args parameter, or use default parameter values',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
  }
  if (/\bnargout\b/.test(result)) {
    flags.push({
      type: 'TODO',
      message: 'nargout — Python does not have an equivalent; restructure return logic manually',
      originalLine: line.originalLineStart,
      outputLine: 0,
      originalCode: content,
    })
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

  // 4D. Dynamic field access: s.(fieldName) → s[fieldName]
  result = result.replace(/(\w+)\.\(([^)]+)\)/g, '$1[$2]')

  return result
}

// ── Helpers ─────────────────────────────���─────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
