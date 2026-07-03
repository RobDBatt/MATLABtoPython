import type { StructuredLine, Flag, CleanupResult } from '../types'
import { buildImportBlock } from '../registry/imports'
import { validateAndFix } from '../validator/syntax-check'

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

  // The import block is built at the END (see below): cleanup-stage rewrites
  // (e.g. matrix literal → np.array) can add imports after the body starts, so
  // the import set isn't final until the body is fully processed.

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
      // A new def while a return is still pending means the previous function
      // had NO closing `end` (legal in MATLAB function files) — flush its
      // return before starting the new one.
      if (currentFunctionReturns) {
        outputLines.push('    '.repeat(currentFunctionIndent + 1) + `return ${currentFunctionReturns}`)
      }
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

    // Handle multi-line content (from flags that injected newlines, and from
    // Stage 3 inline-if/else expansion). Each sub-line still needs the normal
    // syntax cleanup — skipping it left `repmat(center, [N 1])` bodies with
    // raw space-separated brackets (live-batch bug).
    if (content.includes('\n')) {
      const subLines = content.split('\n')
      for (const subLine of subLines) {
        outputLines.push(indent + cleanupSyntax(subLine, imports))
      }
      continue
    }

    // Clean up MATLAB-specific syntax remnants
    content = cleanupSyntax(content, imports)

    outputLines.push(indent + content)
  }

  // A function file may omit its closing `end` entirely (legal MATLAB) — the
  // block-close return emission never fires then, and callers unpacking
  // `model, llh = f(...)` crash on the implicit None. Flush at EOF.
  if (currentFunctionReturns) {
    outputLines.push('    '.repeat(currentFunctionIndent + 1) + `return ${currentFunctionReturns}`)
    currentFunctionReturns = null
  }

  // Remove trailing empty lines
  while (outputLines.length > 0 && outputLines[outputLines.length - 1].trim() === '') {
    outputLines.pop()
  }

  // Post-processing: fix remaining syntax issues line by line
  const fixedLines: string[] = []
  for (const line of outputLines) {
    let fixed = line
    // Last-chance LHS indexing conversion: any `name(...)` on the LHS of
    // an assignment that survived Stage 4 (usually because the args
    // contained nested parens like `A(finddiag(A,k)) = v`). Python forbids
    // assigning to a function call, so parens on LHS must be indexing.
    fixed = convertLhsParenToBracket(fixed)

    // Fix comma-if: "if cond, action:" → split into two lines
    // Only match commas that are NOT inside parentheses (function calls)
    {
      const trimmedLine = fixed.trim()
      const kwMatch = trimmedLine.match(/^(if|elif|while)\s+/)
      if (kwMatch) {
        const kw = kwMatch[1]
        const afterKw = trimmedLine.slice(kwMatch[0].length)
        // Find the first comma that's at paren depth 0 (not inside a function call)
        let depth = 0
        let commaIdx = -1
        let inStr = false
        for (let ci = 0; ci < afterKw.length; ci++) {
          const ch = afterKw[ci]
          if (ch === "'" || ch === '"') { inStr = !inStr; continue }
          if (inStr) continue
          if (ch === '(' || ch === '[') depth++
          else if (ch === ')' || ch === ']') depth--
          else if (ch === ',' && depth === 0) { commaIdx = ci; break }
        }
        if (commaIdx > 0 && afterKw.trimEnd().endsWith(':')) {
          const cond = afterKw.slice(0, commaIdx).trim()
          const action = afterKw.slice(commaIdx + 1).replace(/:\s*$/, '').trim()
          if (action && !action.includes('=') || action.includes('(')) {
            const indent = fixed.match(/^(\s*)/)?.[1] || ''
            fixedLines.push(`${indent}${kw} ${cond}:`)
            // The `continue` below bypasses the rest of this loop's fixes, so
            // the action body needs the space-separated-literal pass applied
            // here (`repmat(center, [N 1])` → `[N, 1]` — live-batch bug).
            fixedLines.push(`${indent}    ${rewriteSpaceSeparatedElements(action)}`)
            continue
          }
        }
        // No-comma one-liner: MATLAB also allows `if cond body; end` with just
        // a SPACE before the body (`if isempty(mode) mode='c'; end` — the
        // voicebox house style). Find the first depth-0 space where the left
        // side is a complete condition and the right side starts a statement.
        if (commaIdx < 0 && afterKw.trimEnd().endsWith(':')) {
          const bodyStart = findInlineBodyStart(afterKw.replace(/:\s*$/, ''))
          if (bodyStart > 0) {
            const cond = afterKw.slice(0, bodyStart).trim()
            const action = afterKw.slice(bodyStart).replace(/:\s*$/, '').trim()
            const indent = fixed.match(/^(\s*)/)?.[1] || ''
            fixedLines.push(`${indent}${kw} ${cond}:`)
            fixedLines.push(`${indent}    ${rewriteSpaceSeparatedElements(action)}`)
            continue
          }
        }
      }
    }

    // Fix MATLAB colon-in-parens: var(:, expr) → var[:, expr]
    // Single pass: find `name(:`, depth-walk to the MATCHING close, and swap
    // both ends at once. (The old two-phase version replaced the opener via
    // regex, then guessed the closer by global paren counting — inside another
    // call, e.g. `np.isfinite(pts(:,1))`, the guess hit the ENCLOSING
    // function's `)` and produced mismatched brackets: `pts[:,1)]`.)
    {
      const opener = /\b(\w+)\(:/g
      let m: RegExpExecArray | null
      while ((m = opener.exec(fixed)) !== null) {
        const startIdx = m.index + m[1].length // index of the (
        let depth = 1
        let endIdx = startIdx + 1
        while (endIdx < fixed.length && depth > 0) {
          if (fixed[endIdx] === '(') depth++
          else if (fixed[endIdx] === ')') { depth--; if (depth === 0) break }
          endIdx++
        }
        if (depth !== 0) continue // unbalanced — leave it
        fixed =
          fixed.slice(0, startIdx) + '[' +
          fixed.slice(startIdx + 1, endIdx) + ']' +
          fixed.slice(endIdx + 1)
        opener.lastIndex = m.index + m[1].length + 1 // resume just past the swap
      }
    }

    // Fix bare number.method: 2.write(...) → sys.stderr.write(...)
    fixed = fixed.replace(/^\s*2\.write\(/, 'sys.stderr.write(')

    // Fix trailing colons on non-block lines (assignment, function calls)
    // Valid trailing colons: if/elif/else/for/while/def/class/try/except/finally/with
    const trimCheck = fixed.trim()
    if (trimCheck.endsWith(':') && !/^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/.test(trimCheck)) {
      fixed = fixed.replace(/:\s*$/, '')
    }

    fixedLines.push(fixed)
  }

  // Inject `pass` into empty blocks — MATLAB allows empty if/else/for/while
  // bodies but Python requires a statement. Detect any block-opening line
  // (`…:`) that isn't followed by a deeper-indented line and insert a
  // single `pass` at the expected inner indent.
  injectPassIntoEmptyBlocks(fixedLines)

  // Ensure every `try:` has a handler (MATLAB allows a bare `try ... end` with
  // no `catch`). Runs AFTER the empty-block pass so an empty try body already
  // has its `pass`.
  injectMissingExcept(fixedLines)

  // Hoist trailing local-function defs above the script body. MATLAB script
  // files may define local functions AFTER the script code; Python executes
  // top-to-bottom, so a module-level call to a function defined lower down is a
  // NameError. No-op unless a top-level def/class actually follows an executable
  // statement — normal function files and already-ordered output are untouched.
  fixedLines.splice(0, fixedLines.length, ...hoistTopLevelFunctions(fixedLines))

  // Wrap matrix parameters in np.atleast_2d
  const finalLines = wrapMatrixParameters(fixedLines, imports)
  fixedLines.splice(0, fixedLines.length, ...finalLines)

  // Build the import block now that the body — and the import set — is final.
  // Cleanup-stage rewrites (e.g. literal → np.array) may have added imports
  // after the body loop started, so building it earlier would miss them.
  let importBlock = buildImportBlock(imports)
  for (const [original, renamed] of Array.from(paramCollisions.entries())) {
    importBlock = importBlock.replace(new RegExp(`as ${original}$`, 'gm'), `as ${renamed}`)
  }
  if (importBlock) {
    fixedLines.unshift(importBlock, '') // import block + blank line
  }

  // Add trailing newline
  const initialPython = fixedLines.join('\n') + '\n'

  // Run the heuristic validator (legacy — catches issues the main passes miss)
  const syntaxIssues = validatePythonSyntax(fixedLines)
  for (const issue of syntaxIssues) {
    flags.push({
      type: 'WARNING',
      message: `Possible Python syntax issue: ${issue.message}`,
      originalLine: issue.line,
      outputLine: issue.line,
      originalCode: '',
    })
  }

  // Part 2: py_compile-equivalent validation with auto-fix loop. Catches
  // patterns the main pipeline produced that Python's parser would reject
  // (bare `end`, MATLAB `:` inside parens, raise with brackets, etc.) and
  // applies targeted rewrites. Remaining issues are surfaced as WARNINGs.
  const { python, issues: validatorIssues } = validateAndFix(initialPython)
  for (const issue of validatorIssues) {
    flags.push({
      type: 'WARNING',
      message: `Output may contain syntax errors on line ${issue.line}: ${issue.message}`,
      originalLine: issue.line,
      outputLine: issue.line,
      originalCode: '',
    })
  }

  return { python, flags }
}

/**
 * Move trailing top-level `def`/`class` blocks above the first executable
 * top-level statement, so module-level calls to MATLAB local functions (which
 * MATLAB allows to be defined after the script body) resolve in Python.
 *
 * A "top-level block" starts at a non-blank, indent-0 line; following blank or
 * indented lines belong to it. Only defs that appear AFTER the first executable
 * statement are moved (preserving their relative order); everything else — and
 * any leading comments — stays put. Returns the reordered lines.
 */
function hoistTopLevelFunctions(lines: string[]): string[] {
  type Block = { isDef: boolean; lines: string[] }
  const blocks: Block[] = []
  let cur: Block | null = null
  for (const l of lines) {
    const startsBlock = l.trim() !== '' && !/^[ \t]/.test(l)
    if (startsBlock) {
      cur = { isDef: /^(async\s+)?(def|class)\b/.test(l), lines: [l] }
      blocks.push(cur)
    } else {
      if (!cur) { cur = { isDef: false, lines: [] }; blocks.push(cur) }
      cur.lines.push(l)
    }
  }

  const isExec = (b: Block) =>
    !b.isDef && b.lines.some(l => { const t = l.trim(); return t !== '' && !t.startsWith('#') })

  let firstExec = -1
  for (let i = 0; i < blocks.length; i++) { if (isExec(blocks[i])) { firstExec = i; break } }
  if (firstExec < 0) return lines

  const trailing = new Set(
    blocks.map((b, i) => (b.isDef && i > firstExec ? i : -1)).filter(i => i >= 0),
  )
  if (trailing.size === 0) return lines // already correctly ordered

  const movedDefs = blocks.filter((_, i) => trailing.has(i))
  const rest = blocks.filter((_, i) => !trailing.has(i))
  const out: Block[] = []
  let inserted = false
  for (const b of rest) {
    if (!inserted && isExec(b)) { out.push(...movedDefs); inserted = true }
    out.push(b)
  }
  if (!inserted) out.push(...movedDefs)
  return out.flatMap(b => b.lines)
}

/**
 * Lightweight Python syntax validator.
 * Catches common issues the converter might produce.
 */
function validatePythonSyntax(lines: string[]): Array<{ line: number; message: string }> {
  const issues: Array<{ line: number; message: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const lineNum = i + 1

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue

    // Check unbalanced brackets
    let parenDepth = 0, bracketDepth = 0, braceDepth = 0
    let inString = false
    let stringChar = ''
    for (let j = 0; j < trimmed.length; j++) {
      const ch = trimmed[j]
      if (inString) {
        if (ch === stringChar && trimmed[j - 1] !== '\\') inString = false
        continue
      }
      if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
      if (ch === '(') parenDepth++
      if (ch === ')') parenDepth--
      if (ch === '[') bracketDepth++
      if (ch === ']') bracketDepth--
      if (ch === '{') braceDepth++
      if (ch === '}') braceDepth--
    }
    // Only flag if severely unbalanced (multiline expressions can be unbalanced on one line)
    if (parenDepth < -1) issues.push({ line: lineNum, message: 'too many closing parentheses' })
    if (bracketDepth < -1) issues.push({ line: lineNum, message: 'too many closing brackets' })

    // Check for square brackets on raise statement
    if (/\braise\s+\w+\[/.test(trimmed)) {
      issues.push({ line: lineNum, message: 'raise with square brackets — should use parentheses: raise Error(...)' })
    }

    // Check for stray commas before colons in if/while/for
    // Only flag commas at paren depth 0 (not inside function calls)
    if (/^(if|elif|while)\s+/.test(trimmed) && trimmed.endsWith(':')) {
      let depth = 0
      let hasStrayComma = false
      const afterKw = trimmed.replace(/^(if|elif|while)\s+/, '')
      for (const ch of afterKw) {
        if (ch === '(' || ch === '[') depth++
        else if (ch === ')' || ch === ']') depth--
        else if (ch === ',' && depth === 0) { hasStrayComma = true; break }
      }
      if (hasStrayComma) {
        issues.push({ line: lineNum, message: 'comma in condition before colon — may be unconverted MATLAB syntax' })
      }
    }

    // Check for MATLAB-style function calls with : inside parens (not slices)
    if (/\w+\(:[,)]/.test(trimmed) && !/\w+\[:/.test(trimmed)) {
      issues.push({ line: lineNum, message: 'colon inside parentheses — should use square brackets for slicing' })
    }
  }

  return issues
}

/**
 * Clean up remaining MATLAB syntax that doesn't have Python equivalents.
 */
function cleanupSyntax(content: string, imports: Set<string>): string {
  let result = content

  // Remove trailing semicolons (already mostly handled in tokenizer, but catch strays)
  result = result.replace(/;\s*$/, '')

  // Array append pattern: A = [A, x] → A = np.append(A, x)
  // MATLAB grows arrays with A = [A, newElement]
  result = result.replace(
    /^(\w+)\s*=\s*\[\1\s*,\s*(.+)\]\s*$/,
    (_, varName, val) => {
      imports.add('numpy')
      return `${varName} = np.append(${varName}, ${val})`
    }
  )
  // Also handle vertical concat: A = [A; newRow]
  result = result.replace(
    /^(\w+)\s*=\s*\[\1\s*;\s*(.+)\]\s*$/,
    (_, varName, val) => {
      imports.add('numpy')
      return `${varName} = np.append(${varName}, ${val})`
    }
  )

  // Empty bracket assignment (element/row/col deletion): A[idx] = [] → np.delete
  // 1. A[:, idx] = []
  result = result.replace(
    /^(\s*)(\w+)\[\s*:\s*,\s*([^\]]+)\]\s*=\s*\[\]\s*$/,
    (_, indent, name, idx) => {
      imports.add('numpy')
      return `${indent}${name} = np.delete(${name}, ${idx}, axis=1)`
    }
  )
  // 2. A[idx, :] = []
  result = result.replace(
    /^(\s*)(\w+)\[\s*([^\]]+)\s*,\s*:\s*\]\s*=\s*\[\]\s*$/,
    (_, indent, name, idx) => {
      imports.add('numpy')
      return `${indent}${name} = np.delete(${name}, ${idx}, axis=0)`
    }
  )
  // 3. A[idx] = []
  result = result.replace(
    /^(\s*)(\w+)\[\s*([^\]]+)\s*\]\s*=\s*\[\]\s*$/,
    (_, indent, name, idx) => {
      imports.add('numpy')
      if (name === 'mu') {
        return `${indent}${name} = np.delete(${name}, ${idx}, axis=0)`
      }
      return `${indent}${name} = np.delete(${name}, ${idx})`
    }
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


  // 3C. String concatenation in brackets — MATLAB `[str1 str2]`, `['a' var 'b']`,
  // `['<a>', label, '</a>']`. A single-row `[...]` with ≥1 top-level string
  // literal is char-array concatenation → join the elements with ` + `.
  result = convertBracketStringConcat(result)


  // MATLAB cell-content `name{:}` converts to `*name` (unpacking), which is
  // valid ONLY as a call argument. When it lands in an `in` test or as an array
  // subscript — from `isfield(s, f{:})` / `s.(f{:})` over a scalar cell — that
  // `*name` is a syntax error. Rewrite those positions to scalar access
  // `name[0]`; `func(*c)` (genuine unpacking) has `(` before `*` and is left.
  result = result.replace(/\*(\w+)(\s+in\b)/g, '$1[0]$2')           // `*f in X`  → `f[0] in X`
  result = result.replace(/([\w)\]])\[\s*\*(\w+)\s*\]/g, '$1[$2[0]]') // `s[*f]`   → `s[f[0]]`


  // Convert MATLAB string delimiters: 'text' is already valid Python
  // But MATLAB uses '' for escaping inside strings → keep as-is (Python uses \')

  // Convert MATLAB array literals: [1 2 3] → [1, 2, 3]
  // Also handles: [0 M-1] → [0, M-1], [a b c] → [a, b, c]
  // BUT skip Python indexing like .shape[0] or A[i - 1]
  result = result.replace(/(\w|\.|]|\))?(\[([^\[\]]*)\])/g, (match, prefix, bracketExpr, inner) => {
    // If preceded by a word char, dot, ] or ) — this is Python indexing, not an array literal
    if (prefix && /[\w.\])]/.test(prefix)) {
      return match
    }
    // Skip if already has commas, is empty, or contains colons (slicing)
    if (inner.includes(',') || inner.trim() === '' || inner.includes(':')) {
      return match
    }
    // Skip Python comprehensions emitted by earlier passes
    // (`[f(_x) for _x in c]`) — comma-joining their keywords destroys them.
    if (/\bfor\b/.test(inner) && /\bin\b/.test(inner)) {
      return match
    }
    // Split on spaces that separate distinct elements
    // Elements can be simple values (1, x, 3.14) or expressions (M-1, N+1, x*2)
    // Strategy: split on whitespace that's preceded by a value-end and followed by a value-start
    const trimmedInner = inner.trim()
    // Try to identify boundaries between elements:
    // A space between two "value" tokens (not an operator-space-value sequence)
    // Match tokens like: 0, M-1, x, 3.14, -5, N+1, a*b
    const elements: string[] = []
    let current = ''
    let parenDepth = 0
    for (let ci = 0; ci < trimmedInner.length; ci++) {
      const ch = trimmedInner[ci]
      if (ch === '(') { parenDepth++; current += ch; continue }
      if (ch === ')') { parenDepth--; current += ch; continue }
      if (ch === ' ' && parenDepth === 0) {
        // Check if this space separates two elements or is part of an expression
        // If previous char is alphanumeric/)/] and next non-space char is alphanumeric/(/- → element boundary
        const prev = current.trim()
        const rest = trimmedInner.slice(ci + 1).trim()
        if (prev && rest && /[\w)\]]$/.test(prev) && /^[\w('"-]/.test(rest)) {
          elements.push(current.trim())
          current = ''
          continue
        }
      }
      current += ch
    }
    if (current.trim()) elements.push(current.trim())

    if (elements.length > 1) {
      return (prefix || '') + `[${elements.join(', ')}]`
    }
    return match
  })


  // Convert MATLAB row separator in matrices: [1 2; 3 4] → np.array([[1, 2], [3, 4]])
  // Uses balanced-bracket matching so nested indexing like
  // `[0; data[:-1]==data[1:]]` still gets recognized.
  if (result.includes(';') && !result.includes('#')) {
    result = rewriteVerticalConcat(result, imports)
  }


  // Second pass: if a bracket literal still has space-separated elements
  // at depth 0 (no `;` but visible space boundaries), convert to commas.
  // Handles `[0 all(...).T]` after strings/slices have been rewritten.
  if (!result.includes('#')) {
    result = rewriteSpaceSeparatedElements(result)
  }


  // Wrap bare list literals that are operands of `*` or `/` so MATLAB
  // elementwise vector arithmetic (`[40 60]/(fs/2)`) becomes valid NumPy
  // instead of a Python list op that raises TypeError at runtime.
  if (!result.includes('#')) {
    result = wrapArithmeticListLiterals(result, imports)
  }


  return result
}

/**
 * Wrap a bare list literal in `np.array(...)` when it is an operand of `*`,
 * `/`, `@`, or `**` — MATLAB elementwise vector arithmetic. A Python list
 * `[40, 60] / 500` raises TypeError; `np.array([40, 60]) / 500` is correct.
 *
 * Conservative: only fires when the bracket is a genuine literal (not indexing
 * — i.e. not preceded by an identifier, `)`, or `]`), contains no quotes, and
 * sits directly adjacent to a `*`//`@` operator on either side. Leaves
 * assignment LHS (`[b, a] = ...`), argument lists, slices, and already-wrapped
 * `np.array([...])` untouched.
 */
function wrapArithmeticListLiterals(source: string, imports: Set<string>): string {
  const OPS = new Set(['*', '/', '@'])
  const prevNonSpace = (str: string, idx: number): string => {
    let j = idx - 1
    while (j >= 0 && str[j] === ' ') j--
    return j >= 0 ? str[j] : ''
  }
  const nextNonSpace = (str: string, idx: number): string => {
    let j = idx
    while (j < str.length && str[j] === ' ') j++
    return j < str.length ? str[j] : ''
  }

  let result = ''
  let i = 0
  let parenDepth = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === '(') { parenDepth++; result += ch; i++; continue }
    if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); result += ch; i++; continue }
    if (ch !== '[') { result += ch; i++; continue }

    // Genuine array literal? Not preceded by an indexable token (identifier/`)`/`]`).
    const prevChar = prevNonSpace(source, i)
    if (/[\w.\])]/.test(prevChar)) { result += ch; i++; continue }

    // Match the closing bracket (track nesting).
    let depth = 0
    let j = i
    let hasQuote = false
    for (; j < source.length; j++) {
      const cj = source[j]
      if (cj === '"' || cj === "'") hasQuote = true
      if (cj === '[') depth++
      else if (cj === ']') { depth--; if (depth === 0) break }
    }
    if (depth !== 0) { result += ch; i++; continue } // unbalanced — bail

    const literal = source.slice(i, j + 1)
    const inner = source.slice(i + 1, j)
    const after = nextNonSpace(source, j + 1)
    const rest = source.slice(j + 1).replace(/^\s+/, '')
    const isLHS = rest.startsWith('=') && !rest.startsWith('==')
    const opAdjacent = OPS.has(after) || OPS.has(prevChar)
    const topLevel = parenDepth === 0

    // MATLAB `[...]` is an array constructor. Wrap as np.array when it's a
    // top-level value OR an operand of `*`//`@`, so vector arithmetic,
    // comparison, and reductions get an ndarray instead of a Python list.
    // Skip: strings, empty `[]`, ranges/slices (colon → handled by arange),
    // multiple-return LHS (`[a, b] = ...`), and nested rows / np.array() args
    // (those are at paren-depth > 0 and not operator-adjacent).
    const wrappable =
      !hasQuote &&
      inner.trim() !== '' &&
      !hasTopLevelColon(inner) &&
      !(/\bfor\b/.test(inner) && /\bin\b/.test(inner)) && // Python comprehension — already typed
      !isLHS &&
      (opAdjacent || topLevel)

    if (wrappable) {
      imports.add('numpy') // np.array introduced here needs the numpy import
      result += `np.array(${literal})`
    } else {
      result += literal
    }
    i = j + 1
  }
  return result
}

/**
 * Walk all top-level `[...]` literals (not Python indexing) and convert
 * space-separated elements to commas. Balanced-bracket aware.
 *
 * `[0 var]`         → `[0, var]`
 * `[0 expr.T]`      → `[0, expr.T]`
 * `[A(i) B(j)]`     → `[A(i), B(j)]`
 * `[a:b c:d]`       → left alone — ranges inside need separate treatment
 *                     and the idiom library handles the single-range
 *                     case before cleanup runs.
 */
function rewriteSpaceSeparatedElements(source: string): string {
  const out: string[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    // Handle both `[...]` array literals and `{...}` cell literals —
    // MATLAB uses the same space-separation rules for both. In Python
    // both become list literals after earlier passes convert `{}` to
    // list form; until then we treat `{` as a parallel case.
    if (ch !== '[' && ch !== '{') {
      out.push(ch)
      i++
      continue
    }
    const closeChar = ch === '[' ? ']' : '}'
    // Skip if this is Python indexing / dict access (`name[`, `)[`, `.[`, `][`)
    const prev = i > 0 ? source[i - 1] : ''
    if (/[\w.)\]]/.test(prev)) {
      out.push(ch)
      i++
      continue
    }
    // Find matching close with depth tracking
    let depth = 1
    let j = i + 1
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
      if (c === ch) depth++
      else if (c === closeChar) { depth--; if (depth === 0) break }
      j++
    }
    if (depth !== 0) {
      out.push(ch)
      i++
      continue
    }
    const inner = source.slice(i + 1, j)
    // Skip if this literal is a pure slice (e.g. `[1:2:10]` or contains `:`
    // outside of strings at top level — that's either np.arange territory
    // or already-converted Python slicing).
    if (hasTopLevelColon(inner)) {
      out.push(source.slice(i, j + 1))
      i = j + 1
      continue
    }
    // Skip Python comprehensions emitted by earlier passes (`[f(_x) for _x
    // in c]`) — comma-joining their keywords destroys them.
    if (/\bfor\b/.test(inner) && /\bin\b/.test(inner)) {
      out.push(source.slice(i, j + 1))
      i = j + 1
      continue
    }
    // Skip if this literal is a multi-return LHS like `[a, b] = ...` —
    // we need to detect `=` immediately after close.
    const after = source.slice(j + 1).trimStart()
    if (after.startsWith('=') && !after.startsWith('==')) {
      out.push(source.slice(i, j + 1))
      i = j + 1
      continue
    }
    // A cell literal with `;` row separators (`{'a' 'b'; 'c' 16}`) becomes a
    // list of row lists: [['a', 'b'], ['c', 16]].
    if (ch === '{' && hasTopLevelSemicolon(inner)) {
      const rows = splitTopLevelSemicolons(inner).map(r => `[${splitAllElements(r).join(', ')}]`)
      out.push(`[${rows.join(', ')}]`)
      i = j + 1
      continue
    }
    // Split inner by top-level commas AND whitespace into elements,
    // re-emit with commas. The output wrapper stays as `[` for both
    // `[...]` and `{...}` inputs — MATLAB cell literals map to Python
    // lists in every context the earlier passes haven't already
    // converted.
    const elements = splitAllElements(inner)
    if (elements.length <= 1 || elements.every(e => /^[A-Za-z_]\w*$/.test(e))) {
      const wasAlreadyCommaSeparated = !/\s/.test(inner.trim()) || /,/.test(inner)
      if (wasAlreadyCommaSeparated && elements.length <= 1) {
        out.push(source.slice(i, j + 1))
        i = j + 1
        continue
      }
    }
    out.push(`[${elements.join(', ')}]`)
    i = j + 1
  }
  return out.join('')
}

/**
 * For a no-comma inline `if`/`while` one-liner, find the index where the BODY
 * begins: the first depth-0 space whose left side is a plausible complete
 * condition (balanced, not ending in an operator) and whose right side starts
 * a statement (assignment, flow keyword, or bare call). Returns -1 when the
 * line reads as a plain condition (no split).
 *
 *   `len(mode) == 0 mode='c'`      → index of `mode='c'`
 *   `(indx<=0 or indx>m) continue` → index of `continue`
 *   `x < np.max(a) * 2`            → -1 (operator follows the call — no body)
 */
function findInlineBodyStart(s: string): number {
  const OP_WORDS = /(?:\band\b|\bor\b|\bnot\b|\bin\b|\bis\b|\bif\b|\belse\b)\s*$/
  const OP_CHARS = /[+\-*/%<>=&|^~,(:@]\s*$/
  const STMT_START = /^(?:\w+\s*=(?!=)|continue\b|break\b|return\b|pass\b|raise\b|[A-Za-z_][\w.]*\()/
  let depth = 0
  let inStr = false
  let sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === sc) inStr = false
      continue
    }
    if (ch === "'" || ch === '"') { inStr = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ' ' && depth === 0) {
      const prefix = s.slice(0, i).trimEnd()
      const rest = s.slice(i + 1).trimStart()
      if (!prefix || !rest) continue
      if (OP_WORDS.test(prefix) || OP_CHARS.test(prefix)) continue
      if (STMT_START.test(rest)) return i + 1
    }
  }
  return -1
}

function hasTopLevelSemicolon(s: string): boolean {
  return splitTopLevelSemicolons(s).length > 1
}

/** Split on depth-0, outside-string semicolons (cell/matrix row separators). */
function splitTopLevelSemicolons(s: string): string[] {
  const rows: string[] = []
  let cur = ''
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      cur += ch
      if (ch === sc) {
        if (i + 1 < s.length && s[i + 1] === sc) { cur += s[++i]; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; cur += ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === ';' && depth === 0) { rows.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) rows.push(cur.trim())
  return rows
}

function hasTopLevelComma(s: string): boolean {
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < s.length && s[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) return true
  }
  return false
}

function hasTopLevelColon(s: string): boolean {
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < s.length && s[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ':' && depth === 0) return true
  }
  return false
}

/**
 * Split `inner` on top-level commas and whitespace boundaries into
 * element strings, respecting strings and nesting.
 */
function splitAllElements(inner: string): string[] {
  const out: string[] = []
  let cur = ''
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (inString) {
      cur += ch
      if (ch === sc) {
        if (i + 1 < inner.length && inner[i + 1] === sc) { cur += inner[i + 1]; i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; cur += ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; cur += ch; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; cur += ch; continue }
    if (depth === 0 && /\s/.test(ch)) {
      const trimmedCur = cur.trim()
      // Don't split on a space that is part of a binary expression (arithmetic or comparison).
      // Rule 1: If cur ends with an operator (arithmetic or comparison), keep accumulating.
      //   `b + ` — cur = 'b +' → space after `+`, next is 'd' → don't split
      //   `x > ` — cur = 'x >' → space after `>`, next is `1` → don't split
      if (trimmedCur !== '' && /[+\-*/%^<>!~=]$/.test(trimmedCur)) {
        cur += ch; continue
      }
      // Rule 2: If the next non-space token starts with an operator FOLLOWED BY another space,
      //   it is a binary operator context — don't split.
      //   Covers arithmetic (+,-,*,/,%,^) and comparison (>,<,>=,<=,==,!=,~=).
      const nextStr = inner.slice(i + 1).trimStart()
      const nextCh = nextStr[0] || ''
      if (trimmedCur !== '' && /^[+\-*/%^]/.test(nextCh) && nextStr.length > 1 && /\s/.test(nextStr[1])) {
        cur += ch; continue
      }
      // Comparison operators `> 1`, `< 0`, `>= x`, `<= y` — always binary
      if (trimmedCur !== '' && /^[<>!~=]/.test(nextCh)) {
        cur += ch; continue
      }
      if (trimmedCur !== '') out.push(trimmedCur)
      cur = ''
      continue
    }
    if (depth === 0 && ch === ',') {
      if (cur.trim() !== '') out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim() !== '') out.push(cur.trim())
  return out
}

/**
 * Find each `[...]` that contains a top-level `;` (the MATLAB row
 * separator) and rewrite to `np.array([[row1], [row2]])`. Unlike a
 * simple `[^\[\]]*;[^\[\]]*` regex, this walks with balanced brackets so
 * inner slices like `data[:-1]` don't confuse the matcher.
 */
/**
 * Convert MATLAB char-array concatenation `[...]` into Python `+` joins.
 *
 * Detection is reliable (a single-row bracket literal with ≥1 top-level string
 * literal is concatenation). The risk is in SPLITTING — MATLAB spaces are
 * ambiguous. So this is operator-aware (never splits at a space when the next
 * token begins with a binary operator, e.g. `'%5.2f' % (v,)`) and all-or-
 * nothing: if any element wouldn't be a clean Python expression, the bracket is
 * left untouched rather than emitting a partially-joined, broken result.
 */
function convertBracketStringConcat(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch !== '[') { out += ch; i++; continue }
    // Python indexing `name[...]` / `)[...]` / `][...]` — not a matrix literal.
    if (i > 0 && /[\w.)\]]/.test(source[i - 1])) { out += ch; i++; continue }
    let depth = 1, j = i + 1, inStr = false, sc = '', hasSemi = false
    while (j < source.length && depth > 0) {
      const c = source[j]
      if (inStr) {
        if (c === sc) { if (source[j + 1] === sc) { j += 2; continue } inStr = false }
        j++; continue
      }
      if (c === "'" || c === '"') { inStr = true; sc = c; j++; continue }
      if (c === '[') depth++
      else if (c === ']') { depth--; if (depth === 0) break }
      else if (c === ';' && depth === 1) hasSemi = true
      j++
    }
    if (depth !== 0 || hasSemi) { out += ch; i++; continue }
    const inner = source.slice(i + 1, j)
    const els = splitConcatElements(inner)
    const ok = els.length > 1 &&
      els.some(e => /^['"]/.test(e)) &&        // at least one string literal
      els.every(isCleanConcatElement)          // every element is a clean expr
    if (ok) { out += els.join(' + '); i = j + 1; continue }
    out += ch; i++ // bail: leave for numeric-array handling (never partial)
  }
  return out
}

const BINARY_OP_START = /^[-+*/%<>=&|^@]/
function isCleanConcatElement(el: string): boolean {
  const t = el.trim()
  if (t === '' || t === ',') return false
  if (BINARY_OP_START.test(t)) return false                 // dangling left operand
  if (/[-+*/%<>=&|^,@]$/.test(t)) return false              // dangling right operand
  let depth = 0
  for (const c of t) { if ('([{'.includes(c)) depth++; else if (')]}'.includes(c)) depth--; if (depth < 0) return false }
  return depth === 0
}

/**
 * Split a bracket's inner text into top-level elements: on every top-level
 * comma, and on a top-level space ONLY when it cleanly separates two values —
 * the previous token ends a value and the next token starts one and is NOT a
 * binary operator. This keeps `'%5.2f' % (v,)` and `a - b` as single elements
 * while still splitting `func(x) '.m'` and `conf.dir name '_x'`.
 */
function splitConcatElements(inner: string): string[] {
  const els: string[] = []
  let cur = '', depth = 0, inStr = false, sc = ''
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (inStr) {
      cur += c
      if (c === sc) { if (inner[i + 1] === sc) { cur += inner[++i]; continue } inStr = false }
      continue
    }
    if (c === "'" || c === '"') { inStr = true; sc = c; cur += c; continue }
    if (c === '(' || c === '[' || c === '{') { depth++; cur += c; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; cur += c; continue }
    if (c === ',' && depth === 0) { if (cur.trim()) els.push(cur.trim()); cur = ''; continue }
    if (c === ' ' && depth === 0) {
      const next = inner.slice(i + 1).trim()
      const prevEndsValue = /[\w)\]'"}]$/.test(cur)
      if (cur.trim() && prevEndsValue && next && !BINARY_OP_START.test(next) && next[0] !== ')') {
        els.push(cur.trim()); cur = ''; continue
      }
    }
    cur += c
  }
  if (cur.trim()) els.push(cur.trim())
  return els
}

function rewriteVerticalConcat(source: string, imports: Set<string>): string {
  const out: string[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch !== '[') {
      out.push(ch)
      i++
      continue
    }
    // Skip Python indexing: `name[...]` or `)[...]` — the `[` there is
    // slicing, not a MATLAB matrix literal.
    const prev = i > 0 ? source[i - 1] : ''
    if (/[\w.)\]]/.test(prev)) {
      out.push(ch)
      i++
      continue
    }
    // Find matching `]` with bracket depth
    let depth = 1
    let j = i + 1
    let inString = false
    let sc = ''
    const semicolons: number[] = []
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
      if (c === '[') depth++
      else if (c === ']') { depth--; if (depth === 0) break }
      else if (c === ';' && depth === 1) semicolons.push(j)
      j++
    }
    if (depth !== 0 || semicolons.length === 0) {
      out.push(ch)
      i++
      continue
    }
    // Extract rows by splitting on the collected semicolon positions.
    const inner = source.slice(i + 1, j)
    const rowTexts: string[] = []
    let prevPos = 0
    for (const pos of semicolons) {
      rowTexts.push(source.slice(i + 1, pos))
      prevPos = pos - (i + 1) + 1
    }
    // Re-split using string offsets relative to `inner`
    const relativeSplits = semicolons.map(p => p - (i + 1))
    const rows: string[] = []
    let start = 0
    for (const sp of relativeSplits) {
      rows.push(inner.slice(start, sp).trim())
      start = sp + 1
    }
    rows.push(inner.slice(start).trim())

    // Map each row to a Python list literal. Preserves existing content
    // (commas, expressions, nested brackets) — we only restructure the
    // MATLAB `;` separator.
    const pyRows = rows.map(row => {
      // Split each row into top-level elements. `splitAllElements` is depth-
      // aware, so it separates space-delimited elements even when they contain
      // nested commas/brackets (e.g. `x[1:2, 1:2] [0, 0].T` → two elements) and
      // also handles already-comma-separated rows. This is the matrix-literal
      // SyntaxError fix: rows with nested `[...]` were previously left unsplit.
      const vals = splitAllElements(row)
      return vals
    })
    const allSingle = pyRows.every(r => r.length === 1)
    if (allSingle) {
      imports.add('numpy')
      const flatRows = pyRows.map(r => r[0])
      out.push(`np.vstack([${flatRows.join(', ')}])`)
    } else {
      const rowStrings = pyRows.map(r => `[${r.join(', ')}]`)
      const isBlockMatrix = rowStrings.some(row => {
        return row.includes('@') || row.includes('.T') || /\b(Sigma|off|v|Phi|X|A|B|C|D)\b/.test(row)
      })
      if (isBlockMatrix) {
        out.push(`np.block([${rowStrings.join(', ')}])`)
      } else {
        out.push(`np.array([${rowStrings.join(', ')}])`)
      }
    }
    i = j + 1
  }
  return out.join('')
}

/**
 * Split a string on whitespace that sits at paren/bracket-depth 0 and
 * outside string literals. Used by the row-rewriter above.
 */
function splitSpaceSeparatedAtTopLevel(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      cur += ch
      if (ch === sc) {
        if (i + 1 < s.length && s[i + 1] === sc) { cur += s[i + 1]; i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; cur += ch; continue }
    if (ch === '(' || ch === '[') { depth++; cur += ch; continue }
    if (ch === ')' || ch === ']') { depth--; cur += ch; continue }
    if (/\s/.test(ch) && depth === 0 && cur.trim() !== '') {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/**
 * Inject `pass` into empty Python blocks (mutates `lines` in place).
 *
 * MATLAB allows an empty if/else/for/while/try body:
 *   if cond
 *   end
 * Python rejects this — every block needs at least one statement. Scan
 * for block-opening lines (ending in `:`) whose immediately-following
 * non-blank line is at an equal-or-shallower indent, and insert `pass`
 * at the expected inner indent.
 */
function injectPassIntoEmptyBlocks(lines: string[]): void {
  const BLOCK_OPEN = /^(\s*)(if|elif|else|for|while|def|class|try|except|finally|with|async\s+def|async\s+for|async\s+with)\b[^:]*:\s*(?:#.*)?$/
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(BLOCK_OPEN)
    if (!match) continue
    const indent = match[1]
    // Scan forward: skip blank lines AND comment-only lines that are inside
    // the block (deeper-indented). Track where to insert `pass` if needed.
    let j = i + 1
    let insertAfter = i  // default: right after the opener
    while (j < lines.length) {
      const trimmed = lines[j].trim()
      if (trimmed === '') { j++; continue }
      if (trimmed.startsWith('#')) {
        const lineIndent = lines[j].match(/^(\s*)/)?.[1] ?? ''
        if (lineIndent.length > indent.length) {
          // Comment inside the block — note position and keep scanning.
          // Python requires at least one real statement even when comments exist.
          insertAfter = j
          j++; continue
        }
      }
      break  // found a non-blank, non-comment line — stop scanning
    }
    const next = j < lines.length ? lines[j] : null
    const nextIndent = next ? next.match(/^(\s*)/)?.[1] ?? '' : ''
    const isDeeperIndent = next && nextIndent.length > indent.length
    if (!isDeeperIndent) {
      // Block has no real statements — inject `pass` after last in-block comment
      lines.splice(insertAfter + 1, 0, `${indent}    pass`)
      i++  // skip the injected line to avoid re-processing it as a block opener
    }
  }
}

/**
 * Ensure every `try:` block has a handler. MATLAB allows a bare `try ... end`
 * with no `catch` (it silently swallows errors); the control-flow pass only
 * emits an `except` when it sees a `catch`, so the no-catch form leaves a
 * `try:` with no `except`/`finally` — a SyntaxError that kills the whole file.
 * When a try block closes without a same-indent handler, inject
 * `except Exception:` / `pass`.
 */
function injectMissingExcept(lines: string[]): void {
  const TRY_OPEN = /^(\s*)try\s*:\s*(?:#.*)?$/
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TRY_OPEN)
    if (!m) continue
    const indent = m[1]
    // Walk past the try body: blank lines, or lines indented deeper than `try`.
    let j = i + 1
    while (j < lines.length) {
      const t = lines[j].trim()
      if (t === '') { j++; continue }
      const lineIndent = lines[j].match(/^(\s*)/)?.[1] ?? ''
      if (lineIndent.length > indent.length) { j++; continue }
      break
    }
    // lines[j] is the first line at indent <= the try's indent (or EOF).
    const handler = j < lines.length ? lines[j] : ''
    const handlerIndent = handler.match(/^(\s*)/)?.[1] ?? ''
    const hasHandler =
      handlerIndent.length === indent.length && /^(except|finally)\b/.test(handler.trim())
    if (!hasHandler) {
      lines.splice(j, 0, `${indent}except Exception:`, `${indent}    pass`)
    }
  }
}

/**
 * Convert `name(args) = value` on the LHS of `=` to `name[args] = value`.
 * Stage 4 handles the common case already; this runs in cleanup to catch
 * leftovers (typically LHS with nested parens in the arg list, like
 * `A(finddiag(A, k)) = v`).
 */
function convertLhsParenToBracket(line: string): string {
  // Fast rejection: line must have both `(` and `=` outside strings.
  if (!line.includes('(') || !line.includes('=')) return line

  // Find the assignment `=` (not `==`, `<=`, `>=`, `!=`, `~=`).
  let eq = -1
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
    if (ch === '#') return line
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '=' && paren === 0 && bracket === 0 && brace === 0) {
      const prev = line[i - 1] || ''
      const next = line[i + 1] || ''
      if (next === '=') return line
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') return line
      eq = i
      break
    }
  }
  if (eq < 0) return line

  const lhs = line.slice(0, eq)
  const rhs = line.slice(eq)

  // Find each top-level `name(...)` in LHS via balanced paren matching,
  // rewrite to `name[...]`. Right-to-left so indexes stay valid.
  type Repl = { start: number; end: number; text: string }
  const repls: Repl[] = []
  let i = 0
  let inStr = false, sc2 = ''
  let parenDepth = 0, bracketDepth = 0
  while (i < lhs.length) {
    const ch = lhs[i]
    if (inStr) {
      if (ch === sc2) {
        if (i + 1 < lhs.length && lhs[i + 1] === sc2) { i += 2; continue }
        inStr = false
      }
      i++
      continue
    }
    if (ch === "'" || ch === '"') { inStr = true; sc2 = ch; i++; continue }
    if (ch === '[') bracketDepth++
    else if (ch === ']') bracketDepth--
    else if (ch === '(') {
      if (i > 0 && /\w/.test(lhs[i - 1]) && bracketDepth === 0 && parenDepth === 0) {
        // Find matching close paren
        let depth = 1
        let j = i + 1
        let inS = false, scc = ''
        while (j < lhs.length && depth > 0) {
          const c = lhs[j]
          if (inS) {
            if (c === scc) {
              if (j + 1 < lhs.length && lhs[j + 1] === scc) { j += 2; continue }
              inS = false
            }
            j++
            continue
          }
          if (c === "'" || c === '"') { inS = true; scc = c; j++; continue }
          if (c === '(') depth++
          else if (c === ')') depth--
          if (depth > 0) j++
        }
        if (depth === 0) {
          const args = lhs.slice(i + 1, j)
          // Skip Python method calls with keyword args — e.g.
          // `.flatten(order="F")` must NOT become `.flatten[order="F"]`.
          // A top-level `=` in the arg list signals `kwarg=value`.
          if (argsContainTopLevelEquals(args)) { i++; continue }
          repls.push({ start: i, end: j, text: `[${args}]` })
          i = j + 1
          continue
        }
      }
      parenDepth++
    }
    else if (ch === ')') parenDepth--
    i++
  }

  if (repls.length === 0) return line

  let newLhs = lhs
  for (let k = repls.length - 1; k >= 0; k--) {
    const r = repls[k]
    newLhs = newLhs.slice(0, r.start) + r.text + newLhs.slice(r.end + 1)
  }
  return newLhs + rhs
}

/**
 * True if `args` contains a `=` at depth 0 that isn't part of a comparison
 * (`==`, `<=`, `>=`, `!=`, `~=`). Used to distinguish Python kwarg calls
 * like `.flatten(order="F")` from MATLAB LHS indices like `A(i)`.
 */
function argsContainTopLevelEquals(args: string): boolean {
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < args.length && args[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === '=' && depth === 0) {
      const prev = args[i - 1] || ''
      const next = args[i + 1] || ''
      if (next === '=') { i++; continue }
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') continue
      return true
    }
  }
  return false
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

/** Automatically wrap uppercase matrix parameters in np.atleast_2d if used in matrix operations */
function wrapMatrixParameters(lines: string[], imports: Set<string>): string[] {
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    result.push(line)
    i++

    const defMatch = line.match(/^(\s*)def\s+\w+\s*\(([^)]*)\):/)
    if (defMatch) {
      const indent = defMatch[1]
      const params = defMatch[2].split(',').map(p => p.trim())
      // Find candidate parameters: uppercase names (like X, Y, A, B, Phi, Sigma)
      const candidates = params.filter(p => /^[A-Z]\w*$/.test(p))
      if (candidates.length === 0) continue

      // Scan the function body to see if candidates are used in matrix operations
      let bodyEnd = i
      const bodyLines: string[] = []
      while (bodyEnd < lines.length) {
        const nextLine = lines[bodyEnd]
        if (nextLine.trim() === '') {
          bodyLines.push(nextLine)
          bodyEnd++
          continue
        }
        const nextIndent = nextLine.match(/^(\s*)/)?.[1] || ''
        if (nextIndent.length <= indent.length) break
        bodyLines.push(nextLine)
        bodyEnd++
      }

      // Check which candidates are used in matrix operations (@, .T, np.linalg)
      const toWrap = candidates.filter(c => {
        const pattern = new RegExp('\\b' + c + '\\b')
        const alreadyWrapped = bodyLines.some(l => l.includes(`${c} = np.atleast_2d(${c})`))
        if (alreadyWrapped) return false
        return bodyLines.some(l => pattern.test(l) && (l.includes('@') || l.includes('.T') || l.includes('np.linalg') || l.includes('np.dot')))
      })

      if (toWrap.length > 0) {
        imports.add('numpy')
        const wrapIndent = indent + '    '
        for (const c of toWrap) {
          result.push(`${wrapIndent}${c} = np.atleast_2d(${c})`)
        }
      }
    }
  }
  return result
}
