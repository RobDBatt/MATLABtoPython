import type { StructuredLine, Flag, CleanupResult } from '../types'
import { buildImportBlock } from '../registry/imports'

/**
 * Stage 5: Cleanup
 *
 * Final pass before output:
 * - Inject imports at top of file (in correct order)
 * - Apply Python indentation (4 spaces per level)
 * - Remove `end` lines (replaced by dedent)
 * - Clean up whitespace
 * - Validate basic structure
 */
export function cleanup(
  lines: StructuredLine[],
  imports: Set<string>,
): CleanupResult {
  const flags: Flag[] = []
  const outputLines: string[] = []

  // Track function context for return statement generation
  let currentFunctionReturns: string | null = null
  let currentFunctionIndent = 0

  // Track import alias → check for parameter collisions
  const importAliases = new Set<string>()
  for (const imp of Array.from(imports)) {
    const alias = getImportAlias(imp)
    if (alias) importAliases.add(alias)
  }

  // Scan for parameter names that collide with import aliases
  const paramCollisions = new Map<string, string>() // alias → renamed alias
  for (const line of lines) {
    const defMatch = line.content.match(/^def\s+\w+\(([^)]*)\)/)
    if (defMatch && defMatch[1]) {
      const params = defMatch[1].split(',').map(s => s.trim())
      for (const param of params) {
        if (importAliases.has(param)) {
          paramCollisions.set(param, `_${param}`)
        }
      }
    }
  }

  // Build import block (with alias renaming for collisions)
  let importBlock = buildImportBlock(imports)
  // Rename colliding import aliases in the import block
  for (const [original, renamed] of Array.from(paramCollisions.entries())) {
    importBlock = importBlock.replace(
      new RegExp(`as ${original}$`, 'gm'),
      `as ${renamed}`,
    )
  }
  if (importBlock) {
    outputLines.push(importBlock)
    outputLines.push('') // blank line after imports
  }

  // 1F. Switch/case: track when first case after switch should be `if` not `elif`
  let awaitingFirstCase = false

  for (const line of lines) {
    // Emit return statement before function end — only at the function's own end,
    // not at inner block ends (if/for/while). The function end is when we're back
    // to the function's indent level.
    if (line.isBlockClose && currentFunctionReturns && line.indentLevel <= currentFunctionIndent) {
      const returnIndent = '    '.repeat(currentFunctionIndent + 1)
      outputLines.push(`${returnIndent}return ${currentFunctionReturns}`)
      currentFunctionReturns = null
    }

    // Skip `end` lines — Python uses indentation instead
    if (line.isBlockClose) continue

    // Skip empty lines but preserve them for readability
    if (line.content.trim() === '') {
      outputLines.push('')
      continue
    }

    // Apply indentation
    const indent = '    '.repeat(line.indentLevel)
    let content = line.content

    // Track function returns for return statement generation
    const returnsMatch = content.match(/^def\s+\w+\([^)]*\):\s*#\s*returns\s+(.+)$/)
    if (returnsMatch) {
      currentFunctionReturns = returnsMatch[1].trim()
      currentFunctionIndent = line.indentLevel
      // Remove the returns comment from the def line, keep single colon
      content = content.replace(/:\s*#\s*returns\s+.+$/, ':')
    }

    // Apply import alias renaming for parameter collisions
    // Only rename when used as module prefix (followed by a function call)
    // e.g. signal.butter( → _signal.butter(  but NOT signal.shape or signal > 0
    for (const [original, renamed] of Array.from(paramCollisions.entries())) {
      content = content.replace(
        new RegExp(`\\b${original}\\.(\\w+)\\(`, 'g'),
        `${renamed}.$1(`,
      )
    }

    // Track switch → first case should be `if`
    if (content.includes('# switch')) {
      awaitingFirstCase = true
    }
    if (awaitingFirstCase && /^\s*elif\b/.test(content)) {
      content = content.replace(/^\s*elif\b/, 'if')
      awaitingFirstCase = false
    }

    // Handle multi-line content (from flags that injected newlines)
    if (content.includes('\n')) {
      const subLines = content.split('\n')
      for (const subLine of subLines) {
        outputLines.push(indent + subLine)
      }
      continue
    }

    // Clean up MATLAB-specific syntax remnants
    content = cleanupSyntax(content)

    outputLines.push(indent + content)
  }

  // Remove trailing empty lines
  while (outputLines.length > 0 && outputLines[outputLines.length - 1].trim() === '') {
    outputLines.pop()
  }

  // Add trailing newline
  const python = outputLines.join('\n') + '\n'

  return { python, flags }
}

/**
 * Clean up remaining MATLAB syntax that doesn't have Python equivalents.
 */
function cleanupSyntax(content: string): string {
  let result = content

  // Remove trailing semicolons (already mostly handled in tokenizer, but catch strays)
  result = result.replace(/;\s*$/, '')

  // Array append pattern: A = [A, x] → A.append(x)
  // MATLAB grows arrays with A = [A, newElement]
  result = result.replace(
    /^(\w+)\s*=\s*\[\1\s*,\s*(.+)\]\s*$/,
    '$1.append($2)',
  )
  // Also handle vertical concat: A = [A; newRow]
  result = result.replace(
    /^(\w+)\s*=\s*\[\1\s*;\s*(.+)\]\s*$/,
    '$1.append($2)',
  )

  // Legend argument fix: legend('a', 'b', ...) → plt.legend(['a', 'b'], ...)
  // When legend has multiple string args followed by named args, wrap strings in list
  result = result.replace(
    /plt\.legend\(('(?:[^']*)'(?:\s*,\s*'(?:[^']*)')+)((?:\s*,\s*\w+=.*)?\))/,
    (match, strings, rest) => {
      // Count the string arguments
      const strArgs = strings.match(/'[^']*'/g)
      if (strArgs && strArgs.length >= 2) {
        return `plt.legend([${strArgs.join(', ')}]${rest}`
      }
      return match
    },
  )

  // 3C. String concatenation in brackets: ['hello' ' world'] → 'hello' + ' world'
  // Detect bracket contents that are all string literals
  result = result.replace(/\[\s*('(?:[^']|'')*'(?:\s+'(?:[^']|'')*')+)\s*\]/g, (_, inner) => {
    const parts = inner.match(/'(?:[^']|'')*'/g)
    if (parts && parts.length > 1) {
      return parts.join(' + ')
    }
    return `[${inner}]`
  })

  // Convert MATLAB string delimiters: 'text' is already valid Python
  // But MATLAB uses '' for escaping inside strings → keep as-is (Python uses \')

  // Convert MATLAB array literals: [1 2 3] → [1, 2, 3]
  // Match content inside [] that contains spaces but no commas
  // BUT skip Python indexing like .shape[0] or A[i - 1]
  result = result.replace(/(\w|\.|]|\))?(\[([^\[\]]*)\])/g, (match, prefix, bracketExpr, inner) => {
    // If preceded by a word char, dot, ] or ) — this is Python indexing, not an array literal
    if (prefix && /[\w.\])]/.test(prefix)) {
      return match
    }
    // Skip if already has commas or is empty
    if (inner.includes(',') || inner.trim() === '' || inner.includes(':')) {
      return match
    }
    // Skip if it contains operators (likely an expression, not an array)
    if (/[+\-*/]/.test(inner) && !/^\s*[\w.]+(\s+[\w.]+)+\s*$/.test(inner)) {
      return match
    }
    // Check if it looks like a space-separated array of simple values
    const parts = inner.trim().split(/\s+/)
    if (parts.length > 1 && parts.every((p: string) => /^-?[\w.]+$/.test(p))) {
      return (prefix || '') + `[${parts.join(', ')}]`
    }
    return match
  })

  // Convert MATLAB row separator in matrices: [1 2; 3 4] → np.array([[1, 2], [3, 4]])
  // This is a common pattern but complex — flag it rather than attempt full conversion
  if (/\[.*;\s*.*\]/.test(result) && !result.includes('#')) {
    // Simple 2D matrix literal
    result = result.replace(/\[([^\[\]]*;[^\[\]]*)\]/g, (_, inner) => {
      const rows = inner.split(';').map((row: string) => {
        const vals = row.trim().split(/[\s,]+/).filter(Boolean)
        return `[${vals.join(', ')}]`
      })
      return `np.array([${rows.join(', ')}])`
    })
  }

  return result
}

/** Extract the Python alias from an import key */
function getImportAlias(importKey: string): string | null {
  const aliasMap: Record<string, string> = {
    'numpy': 'np',
    'scipy.signal': 'signal',
    'scipy.stats': 'stats',
    'scipy.optimize': 'optimize',
    'scipy.ndimage': 'ndi',
    'scipy.io': 'sio',
    'scipy.integrate': 'integrate',
    'scipy.sparse': 'scipy',
    'control': 'control',
    'matplotlib.pyplot': 'plt',
    'pandas': 'pd',
    'statsmodels': 'sm',
    'soundfile': 'sf',
    'sympy': 'sp',
    'pywt': 'pywt',
  }
  return aliasMap[importKey] || null
}
