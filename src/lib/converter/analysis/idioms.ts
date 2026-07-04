/**
 * MATLAB idiom library — pattern-based rewrites for multi-token
 * constructs that the piecewise transforms can't express correctly.
 *
 * Why it's separate: the main pipeline sees `zeros(size(X))` as "a zeros
 * call whose arg is a size call." Piecewise it becomes `np.zeros(X.shape)`
 * — correct but awkward. The idiomatic Python is `np.zeros_like(X)`,
 * which carries dtype too. These rules pattern-match *the composition*
 * before the parts get individually rewritten.
 *
 * Runs at the top of Stage 3 preTransform so each rule operates on raw
 * MATLAB text (with strings and comments already protected by
 * `resolveQuotes`). Each rule is a simple regex + replacement.
 *
 * Every rule here must produce output that is (a) semantically correct,
 * (b) valid Python, and (c) compatible with the registry transforms
 * that run afterwards (none of which should re-match the output).
 */

export interface IdiomRule {
  name: string
  pattern: RegExp
  replacement: string
  imports?: string[]
}

export const IDIOM_RULES: IdiomRule[] = [
  // ── Array construction with matching shape ────────────────

  {
    name: 'zeros(size(X)) → np.zeros_like(X)',
    pattern: /\bzeros\s*\(\s*size\s*\(\s*(\w+)\s*\)\s*\)/g,
    replacement: 'np.zeros_like($1)',
    imports: ['numpy'],
  },
  {
    name: 'ones(size(X)) → np.ones_like(X)',
    pattern: /\bones\s*\(\s*size\s*\(\s*(\w+)\s*\)\s*\)/g,
    replacement: 'np.ones_like($1)',
    imports: ['numpy'],
  },
  {
    name: 'nan(size(X)) → np.full(X.shape, np.nan)',
    pattern: /\bnan\s*\(\s*size\s*\(\s*(\w+)\s*\)\s*\)/g,
    replacement: 'np.full($1.shape, np.nan)',
    imports: ['numpy'],
  },

  // ── Reshape shortcuts ─────────────────────────────────────

  {
    name: "reshape(X, [], 1) → X.reshape(-1, 1, order='F')",
    pattern: /\breshape\s*\(\s*(\w+)\s*,\s*\[\s*\]\s*,\s*1\s*\)/g,
    replacement: "$1.reshape(-1, 1, order='F')",
  },
  {
    name: "reshape(X, 1, []) → X.reshape(1, -1, order='F')",
    pattern: /\breshape\s*\(\s*(\w+)\s*,\s*1\s*,\s*\[\s*\]\s*\)/g,
    replacement: "$1.reshape(1, -1, order='F')",
  },

  // ── Flatten (column-major) ────────────────────────────────
  //
  // X(:) in MATLAB is column-major flatten on the RHS, and slice assignment
  // on the LHS. The regex rules can't distinguish — we handle this case
  // with a line-aware pass below (rewriteFlattenCall).

  // ── Discard-first-return idioms ───────────────────────────
  //
  // MATLAB's `[~, idx] = max(X)` idiomatically wants the index only.
  // Converting piecewise gives `_, idx = np.max(X)` which is wrong
  // because `np.max` returns a scalar, not a tuple. Pattern-match the
  // whole construct and emit the right numpy function directly.

  {
    name: '[~, idx] = max(X) → idx = np.argmax(X)',
    pattern: /\[\s*~\s*,\s*([\w.(){}\[\]]+)\s*\]\s*=\s*max\s*\(\s*([^()]+(?:\([^()]*\))?)\s*\)/g,
    replacement: '$1 = np.argmax($2)',
    imports: ['numpy'],
  },
  {
    name: '[~, idx] = min(X) → idx = np.argmin(X)',
    pattern: /\[\s*~\s*,\s*([\w.(){}\[\]]+)\s*\]\s*=\s*min\s*\(\s*([^()]+(?:\([^()]*\))?)\s*\)/g,
    replacement: '$1 = np.argmin($2)',
    imports: ['numpy'],
  },
  {
    name: '[~, idx] = sort(X) → idx = np.argsort(X)',
    pattern: /\[\s*~\s*,\s*([\w.(){}\[\]]+)\s*\]\s*=\s*sort\s*\(\s*([^()]+(?:\([^()]*\))?)\s*\)/g,
    replacement: '$1 = np.argsort($2)',
    imports: ['numpy'],
  },

  // ── Dual-return max/min (value + index) ───────────────────
  //
  // MATLAB's `[v, i] = max(X)` returns the value AND its index. Python's
  // `np.max` is value-only and `np.argmax` is index-only, so emit a tuple
  // unpack. Index is 0-based (numpy convention) — consistent with the
  // `[~, idx] = max(X)` rule above; downstream index tracking treats
  // argmax results as already 0-based.

  {
    name: '[v, i] = max(X) -> v, i = np.max(X), np.argmax(X)',
    pattern: /\[\s*([\w.(){}\[\]]+)\s*,\s*([\w.(){}\[\]]+)\s*\]\s*=\s*max\s*\(\s*([^()]+(?:\([^()]*\))?)\s*\)/g,
    replacement: '$1, $2 = np.amax($3), np.argmax($3)',
    imports: ['numpy'],
  },
  {
    name: '[v, i] = min(X) -> v, i = np.min(X), np.argmin(X)',
    pattern: /\[\s*([\w.(){}\[\]]+)\s*,\s*([\w.(){}\[\]]+)\s*\]\s*=\s*min\s*\(\s*([^()]+(?:\([^()]*\))?)\s*\)/g,
    replacement: '$1, $2 = np.amin($3), np.argmin($3)',
    imports: ['numpy'],
  },

  // ── Dual-return sort (values + indices) ───────────────────
  //
  // MATLAB's `[sorted_vals, idx] = sort(X)` returns BOTH. Python's
  // `np.sort` only returns values; `np.argsort` only indices. The
  // matlabtopython-compat package provides `sort_with_index(X)` that
  // returns the pair in MATLAB semantics, so converted code reads 1:1
  // with the original.

  {
    name: '[A, I] = sort(X) → A, I = sort_with_index(X)',
    pattern: /\[\s*([\w.(){}\[\]]+)\s*,\s*([\w.(){}\[\]]+)\s*\]\s*=\s*sort\s*\(\s*([^()]+(?:\([^()]*\))?)\s*\)/g,
    replacement: '$1, $2 = sort_with_index($3)',
    imports: ['compat:sort_with_index'],
  },

  // ── Range expressions wrapped in redundant brackets ───────
  //
  // MATLAB lets you write a row vector as either `a:b:c` or `[a:b:c]`
  // — the brackets are optional. The range handler in Stage 3 handles
  // the bare form, but the bracket form survives as `[a:b:c]` and
  // Python rejects it as invalid slice syntax. Rewrite to np.arange
  // directly so it becomes valid Python.
  //
  // Only match when NOT preceded by a word char / `]` / `)` (to avoid
  // eating Python-looking indexing) and when the inner content is a
  // pure range (no commas, no semicolons).

  {
    name: '[a:step:b] → np.arange(a, b + step, step)',
    // Operands restricted like the 2-part rule below: no spaces, so a
    // space-separated concat of ranges (`[1:3 4:6]` — np.r_ territory,
    // handled in Stage 3) can't be misread as one range with step "3 4".
    pattern: /(^|[^\w)\]])\[\s*([\w.+\-*/]+)\s*:\s*([\w.+\-*/]+)\s*:\s*([\w.+\-*/]+)\s*\]/g,
    replacement: '$1np.arange($2, $4 + $3, $3)',
    imports: ['numpy'],
  },
  {
    name: '[a:b] → np.arange(a, b + 1)',
    // Operands restricted to word chars, dots, and arithmetic operators —
    // no spaces, parens, brackets, quotes. This catches `[0:N-1]`,
    // `[start:opt.n-1]`, `[i+1:j]` while rejecting `[patches patch(:)]`
    // (array concat with a flatten call) and `['msg: ' var]` (string
    // concat where a colon happens to live inside a string literal).
    // The non-`)`/non-`]` prefix guard avoids eating Python slice syntax
    // that's already valid. The 3-part `[a:s:b]` rule above runs first.
    pattern: /(^|[^\w)\]])\[\s*([\w.+\-*/]+)\s*:\s*([\w.+\-*/]+)\s*\]/g,
    replacement: '$1np.arange($2, $3 + 1)',
    imports: ['numpy'],
  },
]

/**
 * Apply every idiom rule to the source. Returns the rewritten text plus
 * the imports any firing rule requires.
 */
export function applyIdioms(source: string): { code: string; imports: Set<string> } {
  const imports = new Set<string>()
  let code = source

  // Line-aware flatten rewrite: X(:) becomes .flatten(order="F") only on
  // the RHS of an assignment. LHS occurrences (e.g. `last(:) = ...` or
  // `[~, label(:)] = max(...)`) are left alone so the paren→bracket pass
  // can turn them into slice assignments.
  //
  // MUST run BEFORE the bracket-range idiom rules below. The 3-part
  // `[a:step:b]` rule's permissive char class (`[^\[\],;]+?`) allows
  // parens and colons, so on a space-separated row of flatten calls like
  // `[a(:) b(:)]` it would read the colons inside `(:)` as range
  // separators and mangle the line into `np.arange(a(, ) + ) b(...)`.
  // Resolving `(:)` → `.flatten(order="F")` first removes those colons so
  // the range rules can't misfire.
  code = code.split('\n').map(rewriteFlattenCall).join('\n')

  for (const rule of IDIOM_RULES) {
    const before = code
    code = code.replace(rule.pattern, rule.replacement)
    if (code !== before && rule.imports) {
      for (const imp of rule.imports) imports.add(imp)
    }
  }

  return { code, imports }
}

function rewriteFlattenCall(line: string): string {
  const eqIdx = findTopLevelAssignment(line)
  const rhsStart = eqIdx >= 0 ? eqIdx + 1 : 0
  const prefix = line.slice(0, rhsStart)
  const rhs = line.slice(rhsStart)
  const newRhs = rhs.replace(/\b(\w+)\(\s*:\s*\)/g, '$1.flatten(order="F")')
  return prefix + newRhs
}

/**
 * Find the index of the top-level `=` assignment operator in a line.
 * Ignores `==`, `<=`, `>=`, `!=`, `~=` and anything inside strings or
 * brackets. Returns -1 if no plain assignment exists.
 */
function findTopLevelAssignment(line: string): number {
  let depth = 0
  let inString = false
  let sc = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inString) {
      if (ch === sc) {
        if (i + 1 < line.length && line[i + 1] === sc) { i++; continue }
        inString = false
      }
      continue
    }
    if (ch === "'" || ch === '"') { inString = true; sc = ch; continue }
    if (ch === '#') return -1
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === '=' && depth === 0) {
      const prev = line[i - 1] || ''
      const next = line[i + 1] || ''
      if (next === '=') { i++; continue }
      if (prev === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '~') continue
      return i
    }
  }
  return -1
}
