import type { LogicalLine } from '../types'

/**
 * Stage 1: Tokenize
 *
 * Converts raw MATLAB source into logical lines:
 * - Joins `...` continuation lines
 * - Splits multi-statement `;` lines into separate lines
 * - Strips trailing `;`
 * - Converts `%` comments to `#`
 * - Preserves original line number mapping
 */
export function tokenize(matlabCode: string): LogicalLine[] {
  const rawLines = matlabCode.split('\n')
  const logicalLines: LogicalLine[] = []

  let i = 0
  let inBlockComment = false

  while (i < rawLines.length) {
    let line = rawLines[i]
    const startLine = i + 1 // 1-based

    // Handle block comments: %{ ... %}
    if (line.trim() === '%{') {
      inBlockComment = true
      i++
      continue
    }
    if (line.trim() === '%}') {
      inBlockComment = false
      i++
      continue
    }
    if (inBlockComment) {
      logicalLines.push({
        content: '# ' + line,
        originalLineStart: startLine,
        originalLineEnd: startLine,
        isComment: true,
      })
      i++
      continue
    }

    // Join continuation lines (... at end of line). The `...` must be in CODE
    // position — a comment ending in dots (`% not exhaustive...`) is prose, not
    // a continuation, and joining it would swallow the next statement into the
    // comment (live-batch bug: `% ...` + `switch flag` → orphaned `case`s).
    while (
      line.trimEnd().endsWith('...') &&
      stripInlineComment(line).trimEnd().endsWith('...') &&
      i + 1 < rawLines.length
    ) {
      line = line.trimEnd().slice(0, -3).trimEnd() + ' ' + rawLines[i + 1].trimStart()
      i++
    }

    // Merge lines whose brackets/parens/braces are unbalanced at line end.
    // MATLAB treats a newline inside `[...]` as a row separator (equivalent
    // to `;`), and inside `(...)` / `{...}` as simply whitespace. Python
    // requires these to be on one logical line. Keep joining until the
    // balance is zero.
    while (i + 1 < rawLines.length && hasUnbalancedOpens(line)) {
      // Strip inline `% comments` off both sides before joining. A comment on
      // an element line of a multi-line literal would otherwise swallow the
      // rest of the joined line — including its closing bracket and remaining
      // elements — producing an unterminated `[`/`{`.
      const acc = stripInlineComment(line).trimEnd()
      const next = stripInlineComment(rawLines[i + 1]).trim()
      // Insert `;` when merging lines that are inside `[...]` so the
      // row-separator semantics survive into stage 5. Spaces are safe
      // for `(...)` and `{...}` contexts. But the `;` belongs only BETWEEN two
      // element rows — not right after an opening bracket or right before a
      // closing one (a `[` / `]` on its own line), or it injects empty rows
      // (`np.array([[], [1, 2], …])`).
      let joiner = isInsideBrackets(line) ? '; ' : ' '
      if (/[[({]$/.test(acc) || /^[\])}]/.test(next)) joiner = ' '
      line = acc + joiner + next
      i++
    }

    const endLine = i + 1 // 1-based
    i++

    // Check if this is a comment line (leading %)
    const trimmed = line.trim()
    if (trimmed === '') {
      logicalLines.push({
        content: '',
        originalLineStart: startLine,
        originalLineEnd: endLine,
        isComment: false,
      })
      continue
    }

    if (trimmed.startsWith('%')) {
      // Convert % comment to # comment
      const commentContent = trimmed.slice(1) // remove %
      logicalLines.push({
        content: '#' + commentContent,
        originalLineStart: startLine,
        originalLineEnd: endLine,
        isComment: true,
      })
      continue
    }

    // Handle inline comments: split on first % that's not inside a string
    const { code, comment } = splitInlineComment(line)

    // Split multi-statement lines on `;`
    // But NOT inside strings or if `;` is just a statement terminator
    const statements = splitStatements(code).flatMap(splitForHeaderBody)

    for (const stmt of statements) {
      const cleaned = stmt.trim()
      if (cleaned === '') continue

      logicalLines.push({
        content: cleaned,
        originalLineStart: startLine,
        originalLineEnd: endLine,
        isComment: false,
      })
    }

    // Add the inline comment as its own line if present
    if (comment) {
      logicalLines.push({
        content: '#' + comment,
        originalLineStart: startLine,
        originalLineEnd: endLine,
        isComment: true,
      })
    }
  }

  return logicalLines
}

/**
 * True when `line` has more opening brackets/parens/braces than closing
 * ones (i.e. the line continues onto the next). Respects strings so `(`
 * inside a string literal doesn't count.
 */
/**
 * Return `line` with any top-level `% comment` removed. Skips `%` inside string
 * literals (e.g. `sprintf('%d')`) and respects the transpose-vs-quote heuristic.
 * Used only when flattening multi-line literals, where an inline element comment
 * must not swallow the rest of the joined line.
 */
function stripInlineComment(line: string): string {
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
    if (ch === '%') return line.slice(0, i)
    if (ch === "'" || ch === '"') {
      if (ch === "'" && i > 0 && /[a-zA-Z0-9_)\]}.']/.test(line[i - 1])) continue
      inString = true
      sc = ch
    }
  }
  return line
}

function hasUnbalancedOpens(line: string): boolean {
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
    if (ch === '%') return paren > 0 || bracket > 0 || brace > 0 // stop at comment
    if (ch === "'" || ch === '"') {
      // Basic transpose-vs-string heuristic — match what resolveQuotes did.
      if (ch === "'" && i > 0 && /[a-zA-Z0-9_)\]}.']/.test(line[i - 1])) continue
      inString = true
      sc = ch
      continue
    }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
  }
  return paren > 0 || bracket > 0 || brace > 0
}

/** True when the unbalanced context is inside `[...]` (row-separator semantics). */
function isInsideBrackets(line: string): boolean {
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
    if (ch === '%') break
    if (ch === "'" || ch === '"') {
      if (ch === "'" && i > 0 && /[a-zA-Z0-9_)\]}.']/.test(line[i - 1])) continue
      inString = true
      sc = ch
      continue
    }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
    else if (ch === '{') brace++
    else if (ch === '}') brace--
  }
  // Prefer bracket context when all three are open — rare but `[{(`
  // combos go to bracket since that has the row-separator meaning.
  return bracket > 0
}

/**
 * Split a line into code and inline comment parts.
 * Respects string literals — `%` inside '...' is not a comment.
 */
function splitInlineComment(line: string): { code: string; comment: string | null } {
  let inString = false
  let stringChar = ''

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inString) {
      // Check for escaped quote (MATLAB uses '' inside strings)
      if (ch === stringChar) {
        if (i + 1 < line.length && line[i + 1] === stringChar) {
          i++ // skip escaped quote
        } else {
          inString = false
        }
      }
    } else {
      if (ch === "'" || ch === '"') {
        // Distinguish transpose operator from string start
        // Transpose: preceded by ), ], ., digit, letter, or '
        if (ch === "'" && i > 0) {
          const prev = line[i - 1]
          if (prev === ')' || prev === ']' || prev === '.' || prev === "'" ||
              /[a-zA-Z0-9_]/.test(prev)) {
            continue // this is transpose, not string start
          }
        }
        inString = true
        stringChar = ch
      } else if (ch === '%') {
        return {
          code: line.slice(0, i).trimEnd(),
          comment: line.slice(i + 1),
        }
      }
    }
  }

  return { code: line, comment: null }
}

/**
 * Split a code string on `;` to separate multiple statements.
 * Respects strings and parentheses.
 */
/** Index of the first top-level (depth-0) comma in `s`, or -1. Respects parens,
 *  brackets, braces, and strings — so `f(a,b)` / `[a,b]` commas don't count. */
function topLevelComma(s: string): number {
  let p = 0, b = 0, c = 0, inStr = false, sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) { if (ch === sc) inStr = false; continue }
    if (ch === "'" || ch === '"') { inStr = true; sc = ch }
    else if (ch === '(') p++
    else if (ch === ')') p--
    else if (ch === '[') b++
    else if (ch === ']') b--
    else if (ch === '{') c++
    else if (ch === '}') c--
    else if (ch === ',' && p === 0 && b === 0 && c === 0) return i
  }
  return -1
}

/** Split top-level commas into parts (respecting nesting/strings). */
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = []
  let rest = s, ci: number
  while ((ci = topLevelComma(rest)) >= 0) { out.push(rest.slice(0, ci)); rest = rest.slice(ci + 1) }
  out.push(rest)
  return out
}

/**
 * Split a one-line `for`/`parfor` whose body sits on the header line into the
 * header plus its body statement(s), so the structure stage can build the block.
 *   `for i=1:n, disp(i)`      → ['for i=1:n', 'disp(i)']       (comma form)
 *   `for i=1:niter max(x)`    → ['for i=1:niter', 'max(x)']    (space form)
 * A normal multi-line header (`for k=1:10`) is returned unchanged.
 */
function splitForHeaderBody(stmt: string): string[] {
  const m = stmt.match(/^(\s*)(for|parfor)\s+(\w+)\s*=\s*(.+)$/)
  if (!m) return [stmt]
  const [, indent, kw, v, rest] = m
  let range: string
  let body: string[]
  const ci = topLevelComma(rest)
  if (ci >= 0) {
    // comma form: `<range>, <body>[, <body>...]`
    range = rest.slice(0, ci)
    body = splitTopLevelCommas(rest.slice(ci + 1))
  } else {
    // space form: range is the first whitespace-delimited token containing `:`,
    // the body is the rest. No match (e.g. `for k = 1:10`) → no inline body.
    const sm = rest.match(/^(\S*:\S*)\s+(\S.*)$/)
    if (!sm) return [stmt]
    range = sm[1]
    body = [sm[2]]
  }
  body = body.map(s => s.trim()).filter(Boolean)
  if (!body.length) return [stmt]
  return [`${indent}${kw} ${v} = ${range.trim()}`, ...body]
}

function splitStatements(code: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false
  let stringChar = ''
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0

  for (let i = 0; i < code.length; i++) {
    const ch = code[i]

    if (inString) {
      current += ch
      if (ch === stringChar) {
        if (i + 1 < code.length && code[i + 1] === stringChar) {
          current += code[i + 1]
          i++
        } else {
          inString = false
        }
      }
    } else {
      if (ch === "'" || ch === '"') {
        if (ch === "'" && i > 0) {
          const prev = code[i - 1]
          if (prev === ')' || prev === ']' || prev === '.' || prev === "'" ||
              /[a-zA-Z0-9_]/.test(prev)) {
            current += ch
            continue
          }
        }
        inString = true
        stringChar = ch
        current += ch
      } else if (ch === '(') {
        parenDepth++
        current += ch
      } else if (ch === ')') {
        parenDepth--
        current += ch
      } else if (ch === '[') {
        bracketDepth++
        current += ch
      } else if (ch === ']') {
        bracketDepth--
        current += ch
      } else if (ch === '{') {
        // `;` inside a cell literal is a ROW separator, not a statement end
        // (`pv={'a' 'b'; 'c' 16};` is ONE statement).
        braceDepth++
        current += ch
      } else if (ch === '}') {
        braceDepth--
        current += ch
      } else if (ch === ';' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        // Statement separator (or terminator)
        statements.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  if (current.trim()) {
    statements.push(current)
  }

  return statements
}
