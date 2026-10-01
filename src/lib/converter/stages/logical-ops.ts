/**
 * Elementwise logic: MATLAB's `~`, `&` and `|` on arrays.
 *
 * MATLAB `~` is logical NOT for scalars and arrays alike. Python `not` only
 * works on scalars (`not arr` raises "truth value of an array is ambiguous"),
 * and Python `~` on a plain bool is bitwise (`~True == -2`). So the right
 * spelling depends on the operand:
 *
 *   `~isnan(v)`, `~any(A, 2)`        → `~np.isnan(v)`   (always a NumPy bool)
 *   `~mask` inside a subscript        → `A[~mask]`
 *   `~mask` elsewhere                 → `np.logical_not(mask)` (scalar-safe)
 *   `~(a > 0 & b < 1)`                → `np.logical_not(...)`
 *   `if ~x` / `while ~x` at top level → `not x` (unchanged; scalar test)
 *
 * MATLAB also binds comparisons tighter than `&` / `|`; Python binds them
 * looser, so `v > 2 & v < 5` must be emitted as `(v > 2) & (v < 5)`.
 */

/** Marks a `~` that must stay elementwise, so the `~ → not` pass skips it. */
export const ELEMENTWISE_NOT = '\u0001'

/** MATLAB functions whose converted form always returns a NumPy bool/array.
 *  (`isspace`/`isletter`/`isprime` map to plain Python bools, where `~` is wrong.) */
const LOGICAL_CALL = /^(isnan|isinf|isfinite|ismember|logical|any|all|true|false)\s*\(/

interface Frame { index: boolean }

/** Index of the bracket closing the one at `open`, or -1. Skips strings. */
function closeAt(s: string, open: number): number {
  let depth = 0
  let inString = false, sc = ''
  for (let i = open; i < s.length; i++) {
    const ch = s[i]
    if (inString) { if (ch === sc) inString = false; continue }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

/** Top-level single `&` or `|` (not `&&` / `||`) in an expression. */
function hasElementwiseAndOr(expr: string): boolean {
  let depth = 0
  let inString = false, sc = ''
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (inString) { if (ch === sc) inString = false; continue }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue }
    if (depth !== 0) continue
    if ((ch === '&' || ch === '|') && expr[i + 1] !== ch && expr[i - 1] !== ch) return true
  }
  return false
}

/**
 * Rewrite the `~` occurrences in one raw MATLAB line that must stay
 * elementwise. Runs BEFORE the generic `~ → not` rewrite; anything it leaves
 * alone gets the existing `not` treatment.
 */
export function rewriteElementwiseNot(
  content: string,
  masks: Set<string>,
  arrays: Set<string>,
): { content: string; usedNumpy: boolean } {
  if (!content.includes('~')) return { content, usedNumpy: false }
  const isCondition = /^\s*(if|elseif|while)\b/.test(content)
  const stack: Frame[] = []
  let out = ''
  let usedNumpy = false
  let inString = false, sc = ''

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      out += ch
      if (ch === sc) inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; out += ch; continue }
    if (ch === '%' || ch === '#') { out += content.slice(i); break }

    if (ch === '(') {
      const ident = content.slice(0, i).match(/([A-Za-z_]\w*)$/)
      stack.push({ index: !!ident && arrays.has(ident[1]) })
      out += ch
      continue
    }
    if (ch === '[' || ch === '{') { stack.push({ index: false }); out += ch; continue }
    if (ch === ')' || ch === ']' || ch === '}') { stack.pop(); out += ch; continue }

    if (ch !== '~' || content[i + 1] === '=') { out += ch; continue }

    // `[~, idx] = ...` discard placeholder.
    const before = content.slice(0, i).trimEnd()
    const afterTilde = content.slice(i + 1).trimStart()
    if (/[[,]$/.test(before) && /^[,\]]/.test(afterTilde)) { out += ch; continue }

    // A top-level `if ~x` / `while ~x` is a scalar truth test: keep `not`.
    if (isCondition && stack.length === 0) { out += ch; continue }

    const inIndex = stack.length > 0 && stack[stack.length - 1].index
    const j = i + 1 + (content.slice(i + 1).length - afterTilde.length)

    if (LOGICAL_CALL.test(afterTilde)) {
      out += ELEMENTWISE_NOT
      i = j - 1
      continue
    }

    const id = afterTilde.match(/^[A-Za-z_]\w*/)
    if (id) {
      const name = id[0]
      const next = content[j + name.length]
      if (next === '(' || next === '.') {
        // `~mask(3)` indexes a mask → a NumPy bool; a call we know nothing about stays `not`.
        if (masks.has(name) || inIndex) { out += ELEMENTWISE_NOT; i = j - 1; continue }
        out += ch
        continue
      }
      if (masks.has(name) && inIndex) { out += ELEMENTWISE_NOT; i = j - 1; continue }
      if (masks.has(name) || inIndex) {
        out += `np.logical_not(${name})`
        usedNumpy = true
        i = j + name.length - 1
        continue
      }
      out += ch
      continue
    }

    if (afterTilde.startsWith('(')) {
      const close = closeAt(content, j)
      const inner = close > j ? content.slice(j + 1, close) : ''
      if (inIndex || hasElementwiseAndOr(inner)) {
        out += 'np.logical_not'
        usedNumpy = true
        i = j - 1
        continue
      }
    }
    out += ch
  }
  return { content: out, usedNumpy }
}

// ── `&` / `|` precedence (Python output) ──────────────────────────────────

const BLOCK_KEYWORDS = new Set(['and', 'or', 'not', 'if', 'elif', 'else', 'while', 'return', 'lambda', 'yield', 'assert', 'del', 'in', 'for'])

/** Whether `s` has a top-level comparison operator (`<`, `>`, `<=`, `>=`, `==`, `!=`). */
function hasTopComparison(s: string): boolean {
  let depth = 0
  let inString = false, sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) { if (ch === '\\') { i++; continue } if (ch === sc) inString = false; continue }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue }
    if (depth !== 0) continue
    const two = s.slice(i, i + 2)
    if (two === '<<' || two === '>>' || two === '->') { i++; continue }
    if (two === '==' || two === '!=' || two === '<=' || two === '>=') return true
    if (ch === '<' || ch === '>') return true
  }
  return false
}

/** Wrap each comparison operand of a top-level `&` / `|` chain in parens. */
function fixSegment(seg: string): string {
  // Split on top-level single `&` / `|` (not augmented `&=` / `|=`).
  const parts: string[] = []
  const ops: string[] = []
  let depth = 0
  let inString = false, sc = ''
  let start = 0
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i]
    if (inString) { if (ch === '\\') { i++; continue } if (ch === sc) inString = false; continue }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue }
    if (depth !== 0) continue
    if ((ch === '&' || ch === '|') && seg[i + 1] !== '=') {
      parts.push(seg.slice(start, i))
      ops.push(ch)
      start = i + 1
    }
  }
  if (ops.length === 0) return seg
  parts.push(seg.slice(start))
  if (!parts.some(hasTopComparison)) return seg
  const wrapped = parts.map((p) => {
    if (!hasTopComparison(p)) return p
    const lead = p.match(/^\s*/)![0]
    const trail = p.match(/\s*$/)![0]
    return `${lead}(${p.trim()})${trail}`
  })
  let res = wrapped[0]
  for (let k = 0; k < ops.length; k++) res += ops[k] + wrapped[k + 1]
  return res
}

/**
 * Process one bracket level: recurse into every (), [], {} group, then split
 * this level into segments at `,`, `:`, assignment `=` and keywords
 * (`and`, `or`, `if`, …) — the operators that bind looser than a comparison —
 * and fix each segment.
 */
function fixLevel(s: string): string {
  // 1. Recurse into groups.
  let rebuilt = ''
  let inString = false, sc = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inString) {
      rebuilt += ch
      if (ch === '\\' && i + 1 < s.length) { rebuilt += s[++i]; continue }
      if (ch === sc) inString = false
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; rebuilt += ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') {
      const close = closeAt(s, i)
      if (close < 0) { rebuilt += s.slice(i); break }
      rebuilt += ch + fixLevel(s.slice(i + 1, close)) + s[close]
      i = close
      continue
    }
    rebuilt += ch
  }

  // 2. Split this level into segments and fix each.
  const out: string[] = []
  let depth = 0
  inString = false
  let segStart = 0
  const flush = (end: number) => { out.push(fixSegment(rebuilt.slice(segStart, end))) }
  for (let i = 0; i < rebuilt.length; i++) {
    const ch = rebuilt[i]
    if (inString) { if (ch === '\\') { i++; continue } if (ch === sc) inString = false; continue }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue }
    if (depth !== 0) continue
    let sepLen = 0
    if (ch === ',' || ch === ':' || ch === ';') sepLen = 1
    else if (ch === '=' && !/[=!<>+\-*/%&|^@]/.test(rebuilt[i - 1] ?? '') && rebuilt[i + 1] !== '=') sepLen = 1
    else if (/[A-Za-z_]/.test(ch) && !/[\w.]/.test(rebuilt[i - 1] ?? '')) {
      const word = rebuilt.slice(i).match(/^[A-Za-z_]\w*/)![0]
      if (BLOCK_KEYWORDS.has(word)) sepLen = word.length
      else { i += word.length - 1; continue }
    }
    if (sepLen) {
      flush(i)
      out.push(rebuilt.slice(i, i + sepLen))
      segStart = i + sepLen
      i += sepLen - 1
    }
  }
  flush(rebuilt.length)
  return out.join('')
}

/**
 * `m = v > 2 & v < 5` → `m = (v > 2) & (v < 5)`. Applies to one line of
 * emitted Python; comments are left alone. A no-op on lines without a
 * single `&` or `|`.
 */
export function parenthesizeBitwiseComparisons(line: string): string {
  if (!/[&|]/.test(line)) return line
  // Split off a trailing comment.
  let code = line
  let comment = ''
  {
    let inString = false, sc = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inString) { if (ch === '\\') { i++; continue } if (ch === sc) inString = false; continue }
      if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
      if (ch === '#') { code = line.slice(0, i); comment = line.slice(i); break }
    }
  }
  if (!/[&|]/.test(code)) return line
  const indent = code.match(/^\s*/)![0]
  return indent + fixLevel(code.slice(indent.length)) + comment
}
