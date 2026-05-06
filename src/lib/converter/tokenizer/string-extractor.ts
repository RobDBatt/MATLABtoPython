/**
 * Quote-ambiguity resolver.
 *
 * MATLAB's `'` is overloaded: it means both "string delimiter" and
 * "transpose operator." Using heuristics per-transform is fragile.
 *
 * This module walks the source character-by-character and converts every
 * `'` that is a transpose operator into `.T`, leaving string literals
 * and comments untouched. After `resolveQuotes` runs, downstream
 * transforms can rely on:
 *   - `'` characters in the code appear only as string delimiters
 *   - string contents are preserved byte-for-byte
 *   - comments are preserved byte-for-byte
 *   - `.T` replaces every former transpose operator
 *
 * Detection rules (MATLAB-specific):
 *   - `'` immediately after `)`, `]`, `}`, word char, digit, `.`, or `'`
 *     → TRANSPOSE
 *   - `'` otherwise → STRING OPENER
 *   - `''` inside a single-quoted string → escaped quote
 *   - `"..."` → always a string (MATLAB R2016b+)
 *   - `""` inside a double-quoted string → escaped quote
 *   - `%` outside a string → line comment to end of line
 *   - `%{ ... %}` on own lines → block comment
 */

export function resolveQuotes(source: string): string {
  const lines = source.split('\n')
  const out: string[] = []
  let inBlockComment = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '%{') { inBlockComment = true; out.push(line); continue }
    if (trimmed === '%}') { inBlockComment = false; out.push(line); continue }
    if (inBlockComment) { out.push(line); continue }
    out.push(processLine(line))
  }

  return out.join('\n')
}

function processLine(line: string): string {
  let processed = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]

    // Line comment — everything after `%` is untouched
    if (ch === '%') {
      processed += line.slice(i)
      break
    }

    // Double-quoted string (MATLAB R2016b+): unambiguous
    if (ch === '"') {
      const end = findStringEnd(line, i, '"')
      processed += line.slice(i, end + 1)
      i = end + 1
      continue
    }

    // Single quote — transpose or string opener?
    if (ch === "'") {
      // Special case: `.'` is the non-conjugate transpose. If the previous
      // emitted character is `.`, replace it + this `'` with `.T` so we
      // don't end up with `..T` or `.T.T`.
      const prevEmitted = processed.length > 0 ? processed[processed.length - 1] : ''
      if (prevEmitted === '.') {
        processed = processed.slice(0, -1) + '.T'
        i++
        continue
      }

      const prev = i > 0 ? line[i - 1] : ''
      if (isTransposeContext(prev)) {
        processed += '.T'
        i++
        continue
      }
      // String opener — copy through to closing quote, converting MATLAB's
      // `''` escape (a literal single quote inside the string) into
      // something Python can parse. Three consecutive single quotes in
      // MATLAB source (e.g. `'text'''`) become `'''` in the output, which
      // Python reads as the start of a triple-quoted string and often
      // never closes. Rewrite such strings to Python double-quoted form
      // when possible, or backslash-escape when not.
      const end = findStringEnd(line, i, "'")
      const raw = line.slice(i + 1, end) // string body, no delimiters
      processed += rewriteMatlabSingleQuoted(raw)
      i = end + 1
      continue
    }

    processed += ch
    i++
  }
  return processed
}

function isTransposeContext(prev: string): boolean {
  if (!prev) return false
  return /[a-zA-Z0-9_)\]}.']/.test(prev)
}

/**
 * Convert a MATLAB single-quoted string body to a Python-safe literal.
 *
 *   Input: the body between the outer `'...'` with `''` representing a
 *          literal single quote (MATLAB escape) and `\` as a plain
 *          backslash (MATLAB single-quoted strings don't interpret
 *          escapes).
 *   Output: a complete Python string literal including delimiters.
 *
 * Rules:
 *   - A `\` in the body must become `\\` in the Python output (Python
 *     DOES interpret backslash escapes in regular strings, and `'\'`
 *     is an unterminated literal).
 *   - If the body has `''` escapes and no `"`, emit Python double-quoted
 *     form so we don't produce `'''` (which Python reads as triple-quote).
 *   - If the body has no `''` escapes and no unescaped `"` trouble,
 *     keep the original single-quoted form.
 *   - Mixed-quote content falls back to single-quoted with backslash
 *     escapes on single quotes.
 */
function rewriteMatlabSingleQuoted(body: string): string {
  // Narrow backslash-fix: only escape a trailing `\` so that `'...\'`
  // doesn't leave the literal unterminated. We deliberately DON'T
  // double every `\`, because MATLAB single-quoted strings often carry
  // format-specifier content (`\n`, `\t`) meant to pass through
  // sprintf/print. When the body contains a hard Python escape error
  // (`\x`, `\u`, `\N` without valid trailing chars), emit as a raw
  // string so Python accepts it.
  let safe = body
  if (safe.endsWith('\\') && !safe.endsWith('\\\\')) {
    safe = safe.slice(0, -1) + '\\\\'
  }

  const hasHardEscape = /\\x(?![0-9a-fA-F]{2})|\\u(?![0-9a-fA-F]{4})|\\N(?!\{)/.test(safe)
  // Raw strings can't contain the delimiter, end with an odd number of
  // backslashes, or have `''` escapes we still need to decode.
  if (hasHardEscape && !safe.includes("'") && !safe.endsWith('\\') && !safe.includes("''")) {
    return "r'" + safe + "'"
  }

  if (!safe.includes("''")) {
    return "'" + safe + "'"
  }
  const decoded = safe.replace(/''/g, "'")
  if (!decoded.includes('"')) {
    return '"' + decoded + '"'
  }
  const escaped = decoded.replace(/'/g, "\\'")
  return "'" + escaped + "'"
}

/**
 * Given a string literal starting at line[start] with delimiter `delim`,
 * return the index of the closing delimiter. `delim delim` inside the
 * string is treated as an escape. If the string is unterminated, returns
 * line.length - 1 so callers include the rest of the line.
 */
function findStringEnd(line: string, start: number, delim: string): number {
  let i = start + 1
  while (i < line.length) {
    if (line[i] === delim) {
      if (i + 1 < line.length && line[i + 1] === delim) {
        i += 2
        continue
      }
      return i
    }
    i++
  }
  return line.length - 1
}

/**
 * Apply a regex replacement only to non-string, non-comment portions of
 * the code. Useful for keyword-level transforms (like `\beps\b` →
 * `np.finfo(float).eps`) that must not corrupt string contents.
 *
 * Strategy: walk char-by-char, splitting into alternating (code, literal)
 * segments. Run the replace on each code segment, concatenate with the
 * untouched literals.
 */
export function replaceInCodeOnly(
  content: string,
  regex: RegExp,
  replacement: string | ((match: string, ...args: unknown[]) => string),
): string {
  // Fast path: no strings or comments, replace directly
  if (!/['"%#]/.test(content)) {
    // @ts-expect-error — String.replace accepts either form
    return content.replace(regex, replacement)
  }

  const parts: string[] = []
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf.length === 0) return
    // @ts-expect-error — overload union OK at runtime
    parts.push(buf.replace(regex, replacement))
    buf = ''
  }

  while (i < content.length) {
    const ch = content[i]

    // Python line comment (the content at this stage sometimes already
    // has `#` comments from tokenize). Skip to end-of-line.
    if (ch === '#') {
      flush()
      const nl = content.indexOf('\n', i)
      const end = nl === -1 ? content.length : nl
      parts.push(content.slice(i, end))
      i = end
      continue
    }

    // MATLAB comment (raw source before tokenize).
    if (ch === '%') {
      flush()
      const nl = content.indexOf('\n', i)
      const end = nl === -1 ? content.length : nl
      parts.push(content.slice(i, end))
      i = end
      continue
    }

    if (ch === "'" || ch === '"') {
      flush()
      let j = i + 1
      while (j < content.length) {
        if (content[j] === ch) {
          if (j + 1 < content.length && content[j + 1] === ch) {
            j += 2
            continue
          }
          break
        }
        if (content[j] === '\n') break // unterminated — stop at newline
        j++
      }
      parts.push(content.slice(i, Math.min(j + 1, content.length)))
      i = j + 1
      continue
    }

    buf += ch
    i++
  }
  flush()
  return parts.join('')
}
