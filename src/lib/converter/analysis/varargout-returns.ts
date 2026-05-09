import type { StructuredLine, BlockType } from '../types'

/**
 * Pre-pass: convert `varargout{N} = expr` assignments inside functions that
 * return `varargout` into individual named temporaries `_vout_0`, `_vout_1`,
 * …, and update the `# returns` comment on the function def so Stage 5 emits
 * the correct `return _vout_0, _vout_1, ...` tuple.
 *
 * Input pattern (already tokenised; Stage 4 will shift indices later):
 *
 *   function varargout = myfun(x)
 *     varargout{1} = x;
 *     varargout{2} = x * 2;
 *   end
 *
 * After this pass, the structured lines are rewritten to:
 *
 *   function varargout = myfun(x)   ← content unchanged; handled in Stage 3 transform
 *   _vout_0 = x
 *   _vout_1 = x * 2
 *   end
 *
 * The function def line's `blockType` info tells Stage 3 that it returns
 * `varargout`; Stage 3's `transformControlFlow` will emit
 * `def myfun(x):  # returns _vout_0, _vout_1` once we provide the
 * override via `varargoutReturnsByLine`.
 *
 * Limitations (conservative to avoid wrong rewrites):
 *   - Only handles `varargout{<integer literal>} = expr` forms.
 *   - The assigned index must start at 1 (MATLAB 1-based).
 *   - Indices must be consecutive starting from 1; gaps cause the function to
 *     be left unchanged (too risky to guess missing slots).
 *   - Lines with `varargout` in any other context (e.g. `varargout{i}` with a
 *     variable index) are left unchanged and flagged.
 */

export interface VarargoutPassResult {
  /**
   * Maps the original line-start of a `function … = name(…)` definition to
   * the replacement `# returns` string (e.g. `"_vout_0, _vout_1"`).
   * Stage 3's transformControlFlow uses this instead of `varargout`.
   */
  varargoutReturnsByLine: Map<number, string>
  /**
   * Maps original-line-start of a `varargout{N} = expr` line to the
   * replacement content `_vout_{N-1} = expr`.
   */
  varargoutLineReplacements: Map<number, string>
}

export function extractVarargoutReturns(lines: StructuredLine[]): VarargoutPassResult {
  const varargoutReturnsByLine = new Map<number, string>()
  const varargoutLineReplacements = new Map<number, string>()

  const blockKinds: BlockType[] = []

  type FuncCtx = {
    defLine: number
    isVarargout: boolean
    /** Map from 1-based MATLAB index → {lineNum, expr} */
    assignments: Map<number, { lineNum: number; expr: string }>
  }
  const fnStack: FuncCtx[] = []

  const commitFunc = (ctx: FuncCtx) => {
    if (!ctx.isVarargout || ctx.assignments.size === 0) return

    // Validate indices form a consecutive run 1..N
    const indices = Array.from(ctx.assignments.keys()).sort((a, b) => a - b)
    if (indices[0] !== 1) return  // doesn't start at 1
    for (let k = 1; k < indices.length; k++) {
      if (indices[k] !== indices[k - 1] + 1) return  // gap — bail out
    }

    // Build replacement lines and the returns comment.
    const retNames: string[] = []
    for (const idx of indices) {
      const slot = idx - 1  // 0-based Python name
      const name = `_vout_${slot}`
      retNames.push(name)
      const { lineNum, expr } = ctx.assignments.get(idx)!
      varargoutLineReplacements.set(lineNum, `${name} = ${expr}`)
    }

    varargoutReturnsByLine.set(ctx.defLine, retNames.join(', '))
  }

  for (const line of lines) {
    if (line.isComment) continue
    const content = line.content.trim()

    if (line.isBlockClose) {
      const closed = blockKinds.pop()
      if (closed === 'function') {
        const ctx = fnStack.pop()
        if (ctx) commitFunc(ctx)
      }
      continue
    }

    if (content === '') continue

    if (line.isBlockOpen && line.blockType) {
      blockKinds.push(line.blockType)
    }

    // Function definition: push context.
    if (line.isBlockOpen && line.blockType === 'function') {
      const isVarargout = /^function\s+varargout\s*=/.test(content)
      fnStack.push({
        defLine: line.originalLineStart,
        isVarargout,
        assignments: new Map(),
      })
      continue
    }

    if (fnStack.length === 0) continue
    const ctx = fnStack[fnStack.length - 1]
    if (!ctx.isVarargout) continue

    // Match `varargout{<integer>} = <expr>;?`
    const m = content.match(/^varargout\{(\d+)\}\s*=\s*(.+?)\s*;?\s*$/)
    if (m) {
      const idx = parseInt(m[1], 10)
      const expr = m[2].trim()
      ctx.assignments.set(idx, { lineNum: line.originalLineStart, expr })
    }
    // Variable-index form (varargout{i} = ...) — leave for manual review.
  }

  // Commit script-style functions (no closing end).
  while (fnStack.length > 0) {
    const ctx = fnStack.pop()!
    commitFunc(ctx)
  }

  return { varargoutReturnsByLine, varargoutLineReplacements }
}
