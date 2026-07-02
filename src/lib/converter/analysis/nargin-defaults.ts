import type { StructuredLine, BlockType } from '../types'

/**
 * Function-scope pre-pass: detect the canonical MATLAB optional-arg idiom
 *
 *     function y = foo(a, b, c)
 *         if nargin < 3
 *             c = 5;
 *         end
 *         if nargin < 2, b = 'hi'; end
 *
 * and lift each `paramN = default` into a Python default parameter on the
 * function signature, eliding the `if`/body/`end` lines from the output.
 *
 * Why this is worth a dedicated pre-pass: the line-by-line transform sees
 * each line in isolation and can't know that a body line is part of a
 * nargin-default block. Without this, we either (a) emit `def foo(a, b, c):`
 * with no defaults — calling `foo(1, 2)` then crashes — or (b) leave
 * `if b is None: b = 'hi'` blocks around with no `=None` in the signature
 * to feed them. Either path forces a flag and a CLEAN regression. Lifting
 * to a real signature default makes the conversion drop-in usable.
 *
 * Patterns handled:
 *   - `if nargin < N \n param = expr \n end`  (multi-line, the canonical form)
 *   - `if nargin < N, param = expr; end`       (one-liner with comma/semi)
 *   - `if nargin < N; param = expr; end`       (one-liner with semi)
 *
 * Constraints (kept tight to avoid wrong rewrites):
 *   - Only `nargin < N` (not `<=`, `==`, `~=`, compound conditions).
 *   - Body must be exactly one assignment to the Nth param (1-indexed).
 *   - The if-block must not have an else/elseif branch.
 *   - The default expression must not span multiple lines.
 */

export interface NarginPassResult {
  /** Defaults string keyed by the original line of the `function` def. */
  paramsWithDefaultsByLine: Map<number, string>
  /** Original-line numbers whose content should be elided from output. */
  linesToRemove: Set<number>
}

export function extractNarginDefaults(lines: StructuredLine[]): NarginPassResult {
  const paramsWithDefaultsByLine = new Map<number, string>()
  const linesToRemove = new Set<number>()

  type FuncCtx = {
    defLine: number
    params: string[]
    defaults: Map<string, string>
    /** Smallest caller arity implied by any nargin comparison in the body
     *  (Infinity when the body never compares nargin). Params at index >=
     *  minArity are optional and get `=None` unless a default was lifted. */
    minArity: number
  }
  const fnStack: FuncCtx[] = []

  // Independent block-kind stack. Stage 2 sets blockType=null on close
  // lines, so we can't read the kind off the structured line; we maintain
  // it ourselves by pushing on every isBlockOpen and popping on every
  // isBlockClose. The top element tells us what kind of block an `end`
  // is closing.
  const blockKinds: BlockType[] = []

  // State machine for the multi-line if-nargin pattern.
  type State =
    | { kind: 'IDLE' }
    | { kind: 'OPEN'; ifLine: number; expectedParam: string }
    | { kind: 'BODY_OK'; ifLine: number; bodyLine: number; paramName: string; expr: string }
  let state: State = { kind: 'IDLE' }

  const commitFunc = (ctx: FuncCtx) => {
    // Dispatch-arity optionality: `if nargin == 2 ... elseif nargin == 3 ...`
    // means callers may legally pass as few as minArity args — every later
    // param needs a `=None` default or Python raises TypeError at call time.
    if (Number.isFinite(ctx.minArity)) {
      for (let j = Math.max(0, ctx.minArity); j < ctx.params.length; j++) {
        const p = ctx.params[j]
        if (p && p !== 'varargin' && !ctx.defaults.has(p)) ctx.defaults.set(p, 'None')
      }
    }
    if (ctx.defaults.size === 0) return
    // Python requires defaulted params to form a contiguous suffix. If
    // the user defaulted, say, param[1] but left param[2] non-defaulted,
    // injecting `def foo(a, b=5, c):` is a syntax error. Drop any lifted
    // default that lies left of the longest defaulted suffix.
    let cutoff = ctx.params.length - 1
    while (cutoff >= 0 && ctx.defaults.has(ctx.params[cutoff])) cutoff--
    for (let j = 0; j <= cutoff; j++) {
      ctx.defaults.delete(ctx.params[j])
    }
    if (ctx.defaults.size === 0) return
    const newParams = ctx.params
      .map((p) => {
        const def = ctx.defaults.get(p)
        return def !== undefined ? `${p}=${def}` : p
      })
      .join(', ')
    paramsWithDefaultsByLine.set(ctx.defLine, newParams)
  }

  /**
   * Whether a MATLAB default expression is safe to inject verbatim into a
   * Python `def foo(x=...)` signature. Conservative: reject anything that
   * needs MATLAB→Python translation (function handles `@f`, brackets,
   * function calls, MATLAB constants like `pi`/`inf`/`nan`, operators that
   * differ in semantics). Accept numeric literals, single-quoted strings,
   * `true`/`false`, and the empty array `[]`.
   */
  const isSafeDefault = (expr: string): boolean => {
    const e = expr.trim()
    if (e === '') return false
    // Numeric literal: optional sign, optional decimal, optional exponent.
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(e)) return true
    // Single-quoted string with no embedded `'`. Python and MATLAB agree.
    if (/^'[^']*'$/.test(e)) return true
    // Double-quoted string (rare in MATLAB defaults but valid Python).
    if (/^"[^"]*"$/.test(e)) return true
    // Booleans and empty-array sentinel get normalized below; allow here.
    if (e === 'true' || e === 'false' || e === '[]') return true
    return false
  }

  const normalizeDefault = (expr: string): string => {
    const e = expr.trim()
    if (e === 'true') return 'True'
    if (e === 'false') return 'False'
    if (e === '[]') return 'None'
    return e
  }

  for (const line of lines) {
    if (line.isComment) continue
    const content = line.content.trim()

    // Track the smallest caller arity any nargin comparison implies for the
    // enclosing function (drives dispatch-arity `=None` defaults).
    if (fnStack.length > 0 && /\bnargin\b/.test(content)) {
      const ctx = fnStack[fnStack.length - 1]
      for (const m of content.matchAll(/\bnargin\s*(==|<=|<|>=|>)\s*(\d+)/g)) {
        const n = parseInt(m[2], 10)
        // `< N` handles arity N-1; `<= N`/`== N` handle arity N; a `>= N` or
        // `> N` GUARD implies arities below N-1 / N occur unguarded.
        const implied = m[1] === '<' || m[1] === '>=' ? n - 1 : n
        if (implied < ctx.minArity) ctx.minArity = implied
      }
    }

    // Block-close: pop block-kind stack. If we just closed a function, also
    // pop the function-context stack and commit its defaults.
    if (line.isBlockClose) {
      const closed = blockKinds.pop()

      // Inside a confirmed BODY_OK pattern, an `if` close commits the lift —
      // either as a Python signature default, or as a pure deletion when
      // the body was just validation (error/assert/throw).
      if (state.kind === 'BODY_OK' && closed === 'if') {
        const ctx = fnStack[fnStack.length - 1]
        if (state.expr === '__VALIDATION_ONLY__') {
          // Validation body: drop the whole if/body/end without setting a
          // default. Python's signature enforces required-arg semantics.
          linesToRemove.add(state.ifLine)
          linesToRemove.add(state.bodyLine)
          linesToRemove.add(line.originalLineStart)
        } else if (ctx && !ctx.defaults.has(state.paramName) && isSafeDefault(state.expr)) {
          ctx.defaults.set(state.paramName, normalizeDefault(state.expr))
          linesToRemove.add(state.ifLine)
          linesToRemove.add(state.bodyLine)
          linesToRemove.add(line.originalLineStart)
        }
        state = { kind: 'IDLE' }
      } else if (state.kind !== 'IDLE') {
        // We were mid-pattern but a different block closed first — abort.
        state = { kind: 'IDLE' }
      }

      if (closed === 'function') {
        const ctx = fnStack.pop()
        if (ctx) commitFunc(ctx)
      }
      continue
    }

    if (content === '') continue

    // Block-open: register on our stack so we can identify the matching close.
    if (line.isBlockOpen && line.blockType) {
      blockKinds.push(line.blockType)
    }

    // Function definition: open a new function scope.
    const funcMatch = content.match(
      /^function\s+(?:\[[^\]]*\]\s*=\s*|\w+\s*=\s*)?(\w+)\s*(?:\(([^)]*)\))?/,
    )
    if (funcMatch && /^function\b/.test(content)) {
      const params = (funcMatch[2] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      fnStack.push({ defLine: line.originalLineStart, params, defaults: new Map(), minArity: Infinity })
      state = { kind: 'IDLE' }
      continue
    }

    if (fnStack.length === 0) continue
    const ctx = fnStack[fnStack.length - 1]

    // ── Standalone nargin validation lines that Python's signature already
    // enforces — delete them outright.
    //   `assert(nargin <op> N, …)`             — caller-arity assertion
    //   `assert(nargin <op> N || nargin <op> M, …)` — assertion with OR
    //   `error(nargchk(...))` / `nargchk(...)`  — MATLAB arg-count helpers
    if (
      /^assert\s*\(\s*nargin\b[^)]*\)\s*;?\s*$/.test(content) ||
      /^error\s*\(\s*nargchk\s*\(/.test(content) ||
      /^nargchk\s*\(/.test(content) ||
      /^narginchk\s*\(/.test(content)
    ) {
      linesToRemove.add(line.originalLineStart)
      continue
    }

    // One-liner forms collapsed to a single logical line, all four shapes:
    //   if <guard>, param = expr; end
    //   if <guard>; param = expr; end
    //   if <guard>, param = expr, end
    //   etc.
    // <guard> is `nargin < N`, `isempty(p)`, `~exist('p','var')`, or any
    // top-level `||` combination of those that names the same param.
    const oneLiner = content.match(
      /^if\s+(.+?)\s*[,;]\s*(\w+)\s*=\s*(.+?)\s*[,;]?\s*end\s*$/,
    )
    if (oneLiner && state.kind === 'IDLE') {
      const cond = oneLiner[1]
      const paramName = oneLiner[2]
      const expr = oneLiner[3].replace(/;$/, '').trim()
      const guarded = extractGuardedParam(cond, ctx.params)
      if (
        guarded &&
        guarded === paramName &&
        !ctx.defaults.has(paramName) &&
        isSafeDefault(expr)
      ) {
        ctx.defaults.set(paramName, normalizeDefault(expr))
        linesToRemove.add(line.originalLineStart)
      }
      // Pop the `if` we pushed above — the one-liner self-closes.
      if (line.isBlockOpen && line.blockType === 'if') {
        blockKinds.pop()
      }
      continue
    }

    // One-liner validation: `if nargin <op> N, error(...), end`. The
    // Python signature without defaults will already raise TypeError if
    // a required arg is missing — delete the redundant guard.
    const oneLinerError = content.match(
      /^if\s+nargin\b[^,;]*[,;]\s*error\s*\([^)]*\)\s*[,;]?\s*end\s*$/,
    )
    if (oneLinerError && state.kind === 'IDLE') {
      linesToRemove.add(line.originalLineStart)
      if (line.isBlockOpen && line.blockType === 'if') blockKinds.pop()
      continue
    }

    // State machine for the multi-line block form, plus the Stage-1-split
    // variant of the one-liner (`if <guard>; param = expr; end` → two
    // lines: open-if with inline body, then bare `end`).
    if (state.kind === 'IDLE') {
      // Open-if with inline body (Stage-1-split one-liner):
      //   `if <guard>, param = expr` (close `end` lands on next line)
      const inlineBody = content.match(
        /^if\s+(.+?)\s*[,;]\s*(\w+)\s*=\s*(.+?)\s*;?\s*$/,
      )
      if (inlineBody && line.isBlockOpen && line.blockType === 'if') {
        const cond = inlineBody[1]
        const paramName = inlineBody[2]
        const expr = inlineBody[3].replace(/;$/, '').trim()
        const guarded = extractGuardedParam(cond, ctx.params)
        if (guarded && guarded === paramName && !ctx.defaults.has(paramName)) {
          state = {
            kind: 'BODY_OK',
            ifLine: line.originalLineStart,
            bodyLine: line.originalLineStart,
            paramName,
            expr,
          }
        }
        continue
      }
      // Open-if with NO inline body: body lands on the next line.
      const openOnly = content.match(/^if\s+(.+?)\s*$/)
      if (openOnly && line.isBlockOpen && line.blockType === 'if') {
        const guarded = extractGuardedParam(openOnly[1], ctx.params)
        if (guarded && !ctx.defaults.has(guarded)) {
          state = { kind: 'OPEN', ifLine: line.originalLineStart, expectedParam: guarded }
        }
        continue
      }
      continue
    }

    if (state.kind === 'OPEN') {
      // Body of the if-block. Must be exactly `expectedParam = <expr>;`.
      const bodyMatch = content.match(/^(\w+)\s*=\s*(.+?);?\s*$/)
      const looksLikeAssignment =
        bodyMatch &&
        !content.includes('==') &&
        !content.startsWith('elseif') &&
        !content.startsWith('else')
      if (looksLikeAssignment && bodyMatch[1] === state.expectedParam) {
        state = {
          kind: 'BODY_OK',
          ifLine: state.ifLine,
          bodyLine: line.originalLineStart,
          paramName: bodyMatch[1],
          expr: bodyMatch[2].replace(/;$/, '').trim(),
        }
        continue
      }
      // Validation-only body: the if-block raises an error rather than
      // setting a default. Python's signature already enforces required
      // args, so the whole block is redundant — mark for removal.
      if (
        /^error\s*\(/.test(content) ||
        /^throw\s*\(/.test(content) ||
        /^assert\s*\(/.test(content)
      ) {
        state = {
          kind: 'BODY_OK',
          ifLine: state.ifLine,
          bodyLine: line.originalLineStart,
          paramName: state.expectedParam,
          expr: '__VALIDATION_ONLY__',
        }
        continue
      }
      // Anything else means the block isn't a pure default-setter — abort.
      state = { kind: 'IDLE' }
      continue
    }

    if (state.kind === 'BODY_OK') {
      // Should not see another body line — if-block had multi-statement body.
      // Abort the lift; the close handler above will pop the if normally.
      state = { kind: 'IDLE' }
    }
  }

  // Functions without a closing `end` (script-style top-level functions).
  while (fnStack.length > 0) {
    const ctx = fnStack.pop()!
    commitFunc(ctx)
  }

  return { paramsWithDefaultsByLine, linesToRemove }
}

/**
 * Given a MATLAB if-condition string and the current function's parameter
 * names, decide whether the condition is guarding a single-parameter
 * default-setter and return that parameter name. Returns null if the
 * condition is something else (the lift can't safely happen).
 *
 * Patterns recognized (canonical "I haven't been given this arg" guards):
 *   - `nargin < N`             → params[N - 1]
 *   - `isempty(p)`             → p
 *   - `~exist('p', 'var')`     → p
 *   - top-level `||` of any of the above, all naming the SAME parameter
 *
 * `&&` compounds are intentionally rejected — they typically guard real
 * logic, not optional-arg defaulting.
 */
function extractGuardedParam(cond: string, params: string[]): string | null {
  const t = cond.trim()
  if (t === '') return null

  // nargin < N
  let m = t.match(/^nargin\s*<\s*(\d+)$/)
  if (m) {
    const n = parseInt(m[1], 10)
    return params[n - 1] ?? null
  }
  // nargin == N  → guard for "no args at index N+1+", i.e. params[N]
  // (rare but valid: `if nargin == 1; b = ...; end` for 2-arg fn)
  m = t.match(/^nargin\s*==\s*(\d+)$/)
  if (m) {
    const n = parseInt(m[1], 10)
    return params[n] ?? null
  }
  // isempty(p)
  m = t.match(/^isempty\s*\(\s*(\w+)\s*\)$/)
  if (m && params.includes(m[1])) return m[1]
  // ~exist('p', 'var')
  m = t.match(/^~\s*exist\s*\(\s*['"](\w+)['"]\s*,\s*['"]var['"]\s*\)$/)
  if (m && params.includes(m[1])) return m[1]
  // !exist('p', 'var')  (defensive — MATLAB doesn't use ! but some code does)
  m = t.match(/^!\s*exist\s*\(\s*['"](\w+)['"]\s*,\s*['"]var['"]\s*\)$/)
  if (m && params.includes(m[1])) return m[1]

  // Compound `||` — split at top level and recurse. All parts must agree.
  const parts = splitTopLevelOr(t)
  if (parts.length > 1) {
    const guards = parts.map((p) => extractGuardedParam(p, params))
    const first = guards[0]
    if (first && guards.every((g) => g === first)) return first
  }

  return null
}

/** Split `s` on top-level `||` (depth 0, outside strings). */
function splitTopLevelOr(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let inString: '' | "'" | '"' = ''
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (c === inString) inString = ''
      continue
    }
    if (c === "'" || c === '"') { inString = c; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === '|' && s[i + 1] === '|' && depth === 0) {
      out.push(s.slice(start, i).trim())
      start = i + 2
      i++
    }
  }
  out.push(s.slice(start).trim())
  return out
}
