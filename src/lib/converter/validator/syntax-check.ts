/**
 * Python syntax validator with auto-fix loop.
 *
 * We can't run `python -m py_compile` in Vercel's serverless runtime, so
 * this module catches the 10 most common patterns that make the
 * converter's output unparseable and applies targeted fixes. After each
 * fix pass, it re-checks; if issues remain after 3 iterations, the
 * remaining ones are surfaced as WARNING flags instead of being hidden.
 *
 * Rules are ordered from safest to most aggressive. Each rule returns a
 * mutated line and a flag of whether it changed anything so the outer
 * loop knows when to re-iterate.
 */

const MAX_ITERATIONS = 3

export interface ValidationIssue {
  line: number
  message: string
  severity: 'warning' | 'error'
}

export interface ValidationResult {
  python: string
  issues: ValidationIssue[]
  iterationsUsed: number
}

const BLOCK_KEYWORDS = /^(if|elif|else|for|while|def|class|try|except|finally|with|async)\b/

export function validateAndFix(python: string): ValidationResult {
  let current = python
  let iteration = 0

  while (iteration < MAX_ITERATIONS) {
    const { code, changed } = applyFixes(current)
    current = code
    iteration++
    if (!changed) break
  }

  const issues = detectRemainingIssues(current)

  return { python: current, issues, iterationsUsed: iteration }
}

function applyFixes(python: string): { code: string; changed: boolean } {
  const lines = python.split('\n')
  let changed = false

  for (let i = 0; i < lines.length; i++) {
    const before = lines[i]
    let after = before

    after = fixBareEndLine(after)
    after = fixBareEndInSlice(after)
    after = fixRaiseWithBrackets(after)
    after = fixStrayCommaInCondition(after)
    after = fixTrailingStrayCommaInCall(after)
    after = fixColonInsideParens(after)
    after = fixColonInsideParensNested(after)
    after = fixStrayTrailingColon(after)
    after = fixUnterminatedString(after)
    after = fixUnbalancedBracketsAtEol(after)

    if (after !== before) {
      changed = true
      lines[i] = after
    }
  }

  return { code: lines.join('\n'), changed }
}

/** Remove a stray bare `end` on its own line — leftover MATLAB closer. */
function fixBareEndLine(line: string): string {
  if (/^\s*end\s*;?\s*$/.test(line)) return ''
  return line
}

/**
 * Replace bare `end` inside a slice with the right Python equivalent:
 *   v[end]        → v[-1]
 *   v[end-N]      → v[-N]
 *   v[end-N:]     → v[-N:]
 *   v[end-N:end]  → v[-N:]
 *   v[X:end]      → v[X:]
 *   v[end, :]     → v[-1, :]
 *   v[:, end]     → v[:, -1]
 *
 * Only replaces `end` tokens that sit inside [] slice brackets, never in
 * strings or other contexts.
 */
function fixBareEndInSlice(line: string): string {
  if (!/\bend\b/.test(line)) return line

  let result = ''
  let i = 0
  let bracketDepth = 0
  let inString = false
  let stringChar = ''

  while (i < line.length) {
    const ch = line[i]

    if (inString) {
      result += ch
      if (ch === stringChar && line[i - 1] !== '\\') inString = false
      i++
      continue
    }
    if (ch === "'" || ch === '"') {
      inString = true
      stringChar = ch
      result += ch
      i++
      continue
    }

    if (ch === '[') bracketDepth++
    else if (ch === ']') bracketDepth--

    if (bracketDepth > 0 && line.slice(i, i + 3) === 'end' && !/\w/.test(line[i + 3] || '') && !/\w/.test(line[i - 1] || '')) {
      // We're inside [] and looking at a bare `end` token.
      // Find the segment of the slice this `end` belongs to: scan backward
      // for the enclosing `[`, `,`, or `:` to find the segment start; forward
      // for the matching `]`, `,`, or `:` for segment end.
      const { text, consumed } = endReplacementInSlice(line, i)
      result += text
      i += 3 + consumed
      continue
    }

    result += ch
    i++
  }

  return result
}

/**
 * Given that line[pos..pos+3] is a bare `end` token inside a slice, return the
 * correct Python replacement plus how many chars AFTER `end` to also consume.
 *
 * MATLAB `end` is the last index (length). In 0-based Python the last element
 * is `-1`, and `end-N` is `-(N+1)` — e.g. `end-1` is the second-to-last, `-2`.
 * The previous version emitted the literal `-N` (so `end-1` became `-1`),
 * an off-by-one that silently read the wrong element in multidim subscripts.
 */
function endReplacementInSlice(line: string, pos: number): { text: string; consumed: number } {
  // Only fold a *numeric* offset: `end-1` → `-2`, `end-2` → `-3`. For anything
  // else (a variable, or a complex expression like `end-np.ceil(x)+1`) replace
  // just `end` with `-1` and leave the `- <expr>` in place, which yields the
  // correct `-1 - <expr>`. Consuming a partial token here (e.g. only `-np` of
  // `-np.ceil(x)`) would leave a dangling `.ceil(x)` → a syntax error.
  const numeric = line.slice(pos + 3).match(/^\s*-\s*(\d+)(?![\w.])/)
  if (numeric) {
    return { text: `-${parseInt(numeric[1], 10) + 1}`, consumed: numeric[0].length }
  }
  // Bare `end`, or `end - <expr>` (leave the `- <expr>`) → `-1`.
  return { text: '-1', consumed: 0 }
}

/** raise X[...] → raise X(...) */
function fixRaiseWithBrackets(line: string): string {
  return line.replace(/\braise\s+(\w+)\[([^\]]*)\]/g, 'raise $1($2)')
}

/**
 * `if cond,:` or `while cond,:` — stray comma before the block-opening colon.
 * Only strip commas at paren-depth 0.
 */
function fixStrayCommaInCondition(line: string): string {
  const m = line.match(/^(\s*(?:if|elif|while)\s+)(.+):(\s*)$/)
  if (!m) return line
  const [, prefix, cond, tail] = m
  let depth = 0
  let inString = false
  let stringChar = ''
  let lastCommaAtZero = -1
  for (let i = 0; i < cond.length; i++) {
    const ch = cond[i]
    if (inString) {
      if (ch === stringChar && cond[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (ch === ',' && depth === 0) lastCommaAtZero = i
  }
  if (lastCommaAtZero === cond.length - 1) {
    return `${prefix}${cond.slice(0, -1).trimEnd()}:${tail}`
  }
  return line
}

/** Trailing stray comma inside a function call: `f(a, b,)` — valid Python
 *  actually allows this, so leave it alone. Kept here as a placeholder for
 *  future fixes if we find patterns that aren't valid. */
function fixTrailingStrayCommaInCall(line: string): string {
  // Python DOES allow trailing commas in calls; no fix needed.
  return line
}

/**
 * Convert MATLAB-style `var(a:b)` or `var(a:b:c)` slice patterns that
 * slipped through the main converter into `var[a:b]` / `var[a:b:c]`.
 * Only triggers on patterns that cannot be valid Python function calls
 * (presence of `:` at paren-depth 0 inside the parens).
 */
function fixColonInsideParens(line: string): string {
  return line.replace(/\b(\w+)\(([^()]*)\)/g, (match, name, args) => {
    // Skip if args has no top-level colon
    let depth = 0
    let inString = false
    let stringChar = ''
    let hasTopColon = false
    for (let i = 0; i < args.length; i++) {
      const ch = args[i]
      if (inString) {
        if (ch === stringChar && args[i - 1] !== '\\') inString = false
        continue
      }
      if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
      if (ch === '(' || ch === '[') depth++
      else if (ch === ')' || ch === ']') depth--
      else if (ch === ':' && depth === 0) { hasTopColon = true; break }
    }
    if (!hasTopColon) return match
    // If the args contain `lambda x: expr` where expr has NO further colons,
    // the single colon is the lambda body separator, not a slice — keep parens.
    // (Two colons means `lambda x: 1:x` — range inside lambda body — allow brackets.)
    if (/\blambda\b/.test(args)) {
      const colonCount = (args.match(/:/g) || []).length
      if (colonCount === 1) return match
    }
    // Skip if `name` looks like a known function — conservative list.
    if (/^(range|slice|print|dict|set|list|tuple|map|filter|zip|enumerate|all|any|sum|min|max|len|sorted|reversed|iter|next|abs|round|isinstance|type|int|float|str|bool|bytes|hasattr|getattr|setattr|delattr|open|input|arrayfun|cellfun|structfun|spfun|addlistener)$/.test(name)) {
      return match
    }
    return `${name}[${args}]`
  })
}

/**
 * Balanced-paren version of fixColonInsideParens: handles `var(a:b)` where
 * the args themselves contain nested parens (e.g. `v(end:-np.arange(1, 2))`).
 * Iteratively finds outer `var(...)` pairs whose top-level args contain a
 * colon and rewrites to `var[...]`.
 */
function fixColonInsideParensNested(line: string): string {
  const RESERVED = /^(range|slice|print|dict|set|list|tuple|map|filter|zip|enumerate|all|any|sum|min|max|len|sorted|reversed|iter|next|abs|round|isinstance|type|int|float|str|bool|bytes|hasattr|getattr|setattr|delattr|open|input|arrayfun|cellfun|structfun|spfun|addlistener)$/
  let result = line
  let changed = true
  let guard = 0
  while (changed && guard < 10) {
    changed = false
    guard++
    for (let i = 0; i < result.length; i++) {
      if (result[i] !== '(') continue
      // Find the word immediately preceding
      const before = result.slice(0, i)
      const nameMatch = before.match(/(\w+)$/)
      if (!nameMatch) continue
      const name = nameMatch[1]
      if (RESERVED.test(name)) continue
      // NOTE: dot-preceded names are NOT skipped — `model.F_struc(a:b, :)` is
      // struct-field indexing. Method calls are excluded by the lambda guard
      // below instead.
      // Find the matching close paren. Track bracket depth separately so
      // a `:` inside an inner `[...]` subscript (like `bsxfun(X, mu[:, i])`)
      // is NOT misread as a top-level colon belonging to the outer call —
      // that misread would convert the legitimate function call to an
      // array subscript.
      let depth = 1
      let bracketDepth = 0
      let j = i + 1
      let inString = false
      let stringChar = ''
      let topColon = false
      while (j < result.length && depth > 0) {
        const ch = result[j]
        if (inString) {
          if (ch === stringChar && result[j - 1] !== '\\') inString = false
          j++
          continue
        }
        if (ch === "'" || ch === '"') { inString = true; stringChar = ch; j++; continue }
        if (ch === '(') depth++
        else if (ch === ')') depth--
        else if (ch === '[') bracketDepth++
        else if (ch === ']') bracketDepth--
        else if (ch === ':' && depth === 1 && bracketDepth === 0) topColon = true
        if (depth > 0) j++
      }
      if (depth !== 0 || !topColon) continue
      // A lambda in the args means the "top colon" is (or may be) the lambda
      // body separator — this is a CALL with a converted anonymous-function
      // arg, not indexing (mirrors the guard in fixColonInsideParens).
      if (/\blambda\b/.test(result.slice(i + 1, j))) continue
      // Rewrite: keep `name`, swap `(` → `[`, close at `j` with `]`
      result = result.slice(0, i) + '[' + result.slice(i + 1, j) + ']' + result.slice(j + 1)
      changed = true
      break
    }
  }
  return result
}

/**
 * Remove a stray trailing `:literal` suffix that appears after a complete
 * expression (e.g. `t = np.arange(0, 1/fs + 1):1`). This is what happens
 * when the 3-part range converter bails halfway through. We remove the
 * suffix so the line parses; a warning will still surface during
 * detectRemainingIssues for the user to review.
 *
 * Only triggers when:
 *   - The line is NOT a block opener (no trailing `:` after valid cond)
 *   - The `:` appears outside all brackets and at paren-depth 0
 *   - What follows looks like `<number-or-identifier>` (no more code)
 */
function fixStrayTrailingColon(line: string): string {
  if (BLOCK_KEYWORDS.test(line)) return line
  // Find the last `:` at outer depth
  let depth = 0
  let bDepth = 0
  let inString = false
  let stringChar = ''
  let lastColon = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === stringChar && line[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === '#') break
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '[') bDepth++
    else if (ch === ']') bDepth--
    else if (ch === ':' && depth === 0 && bDepth === 0) lastColon = i
  }
  if (lastColon < 0) return line
  const before = line.slice(0, lastColon)
  const after = line.slice(lastColon + 1)
  // Only remove when what comes after is a bare literal/identifier expression
  if (!/^\s*[\w.]+\s*$/.test(after)) return line
  // Don't strip a lambda body: `lambda x: expr` or `lambda: expr`
  if (/\blambda\b/.test(before)) return line
  // Don't strip a ternary-looking expression (rare) or dict entry
  return before.trimEnd()
}

/**
 * If a line contains an unterminated string literal, append a matching
 * closing quote so the file parses. The content is already corrupt; the
 * goal is only to keep Python's tokenizer happy so the rest of the file
 * validates. detectRemainingIssues will flag this as a warning.
 */
function fixUnterminatedString(line: string): string {
  // Skip comments
  const codeOnly = stripLineComment(line)
  let inString = false
  let stringChar = ''
  for (let i = 0; i < codeOnly.length; i++) {
    const ch = codeOnly[i]
    if (inString) {
      if (ch === stringChar && !isEscaped(codeOnly, i)) inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch }
  }
  if (inString) {
    return line + stringChar
  }
  return line
}

function stripLineComment(line: string): string {
  let inString = false
  let stringChar = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === stringChar && !isEscaped(line, i)) inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
    if (ch === '#') return line.slice(0, i)
  }
  return line
}

/**
 * Whether the quote at `s[i]` is backslash-escaped. A quote is escaped iff
 * the count of consecutive backslashes immediately preceding it is odd —
 * `\'` is escaped, `\\'` is two literal backslashes followed by a real
 * closing quote, `\\\'` is `\\` + escaped quote, etc.
 */
function isEscaped(s: string, i: number): boolean {
  let backslashes = 0
  for (let k = i - 1; k >= 0 && s[k] === '\\'; k--) backslashes++
  return backslashes % 2 === 1
}

/**
 * If a line ends with unmatched `)` from a paren that should have been `]`,
 * and the line contains a `[...:` pattern earlier, fix the closer.
 */
function fixUnbalancedBracketsAtEol(line: string): string {
  // Only act when we see `[X:` somewhere without a matching `]`
  if (!/\[[^[\]]*:/.test(line)) return line
  let depth = 0
  let bDepth = 0
  let inString = false
  let stringChar = ''
  const chars = line.split('')
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (inString) {
      if (ch === stringChar && !isEscaped(line, i)) inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
    if (ch === '(') depth++
    else if (ch === ')') {
      if (depth === 0 && bDepth > 0) {
        chars[i] = ']'
        bDepth--
      } else {
        depth--
      }
    } else if (ch === '[') bDepth++
    else if (ch === ']') bDepth--
  }
  return chars.join('')
}

/**
 * After auto-fix passes, scan for patterns we can't repair but want to
 * surface as warnings so the user knows the output may not parse.
 */
function detectRemainingIssues(python: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const lines = python.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Unterminated string literal — odd number of unescaped quotes
    if (hasUnterminatedString(trimmed)) {
      issues.push({
        line: i + 1,
        message: 'unterminated string literal — converter output may be corrupted',
        severity: 'error',
      })
    }

    // Bare `end` still present outside a string — we couldn't replace it
    if (/\bend\b/.test(stripStrings(trimmed)) && !BLOCK_KEYWORDS.test(trimmed)) {
      issues.push({
        line: i + 1,
        message: 'bare `end` keyword remained after conversion — not a Python identifier',
        severity: 'error',
      })
    }

    // Stray `:` at paren-depth 0 outside slice brackets
    if (hasStrayColon(trimmed)) {
      issues.push({
        line: i + 1,
        message: 'unexpected `:` outside of slice/block context',
        severity: 'error',
      })
    }
  }

  return issues
}

function stripStrings(line: string): string {
  let out = ''
  let inString = false
  let stringChar = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === stringChar && line[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
    out += ch
  }
  return out
}

function hasUnterminatedString(line: string): boolean {
  let inString = false
  let stringChar = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === stringChar && line[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === '#') return false  // rest is comment
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
  }
  return inString
}

function hasStrayColon(line: string): boolean {
  // Allow block-opening `:` at end of line for if/for/etc. and valid slices
  if (BLOCK_KEYWORDS.test(line) && line.trimEnd().endsWith(':')) return false
  // Allow dict literal context — presence of `{` anywhere is a soft bail
  if (line.includes('{')) return false

  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let inString = false
  let stringChar = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === stringChar && line[i - 1] !== '\\') inString = false
      continue
    }
    if (ch === '#') break
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue }
    if (ch === '(') parenDepth++
    else if (ch === ')') parenDepth--
    else if (ch === '[') bracketDepth++
    else if (ch === ']') bracketDepth--
    else if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    else if (ch === ':' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      // This colon is at the outermost level. Valid only if it's the
      // block-opening colon at the very end of the line, OR part of a lambda.
      const rest = line.slice(i + 1).trim()
      if (rest === '' || rest.startsWith('#')) return false
      // lambda x: expr — colon separates params from body, not a stray colon
      if (/\blambda\b/.test(line.slice(0, i + 1))) return false
      return true
    }
  }
  return false
}
