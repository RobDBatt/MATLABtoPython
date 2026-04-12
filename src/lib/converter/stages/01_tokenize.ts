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

    // Join continuation lines (... at end of line)
    while (line.trimEnd().endsWith('...') && i + 1 < rawLines.length) {
      line = line.trimEnd().slice(0, -3).trimEnd() + ' ' + rawLines[i + 1].trimStart()
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
    const statements = splitStatements(code)

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
function splitStatements(code: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false
  let stringChar = ''
  let parenDepth = 0
  let bracketDepth = 0

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
      } else if (ch === ';' && parenDepth === 0 && bracketDepth === 0) {
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
