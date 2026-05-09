import type { StructuredLine, BlockType } from '../types'

/**
 * Pre-pass: strip MATLAB R2019b+ `arguments` validation blocks and lift
 * simple default values into Python signature defaults.
 *
 * An `arguments` block looks like:
 *
 *     function y = foo(x, n, opts)
 *       arguments
 *         x double
 *         n (1,1) double = 10
 *         opts.verbose (1,1) logical = false
 *       end
 *       ...
 *     end
 *
 * What we do:
 * - Mark every line inside the `arguments` block for elision.
 * - Extract simple numeric/bool/string defaults (like `n = 10`) and lift
 *   them into the Python `def` signature (parallel to `extractNarginDefaults`).
 * - For `opts.field = default` entries, lift `field` as a keyword arg and
 *   remove `opts` from the positional parameter list if every opts.* entry
 *   has a default.  Otherwise leave `opts` in the signature and just strip
 *   the block.
 *
 * Constraints (kept tight to avoid wrong rewrites):
 * - Only the first `arguments` block immediately after the function signature
 *   is processed (nested/repeat blocks are rare and just stripped).
 * - Default expressions must be numeric literals, boolean literals, string
 *   literals, or `[]`.  Complex defaults (function calls, expressions) cause
 *   the line to be stripped but no default to be lifted.
 */

export interface ArgumentsPassResult {
  /** New param string keyed by the original line of the `function` def. */
  paramsWithDefaultsByLine: Map<number, string>
  /** Original-line numbers to elide from output. */
  linesToRemove: Set<number>
}

export function extractArgumentsDefaults(lines: StructuredLine[]): ArgumentsPassResult {
  const paramsWithDefaultsByLine = new Map<number, string>()
  const linesToRemove = new Set<number>()

  // Independent block-kind stack so we can detect which block an `end` closes.
  const blockKinds: BlockType[] = []
  let functionBlockCount = 0  // O(1) substitute for blockKinds.filter(==='function')

  type FuncCtx = {
    defLine: number
    params: string[]        // original positional params from the function signature
    defaults: Map<string, string>   // param → Python default expression
    optsKwargs: Map<string, string> // opts.field → Python default expression
    optsParamName: string | null    // name of the opts parameter ("opts" normally)
  }
  const fnStack: FuncCtx[] = []

  // Whether we are currently inside an `arguments` block for the top function.
  let inArgumentsBlock = false

  const isSafeDefault = (expr: string): boolean => {
    const e = expr.trim()
    if (!e) return false
    if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(e)) return true
    if (/^'[^']*'$/.test(e)) return true
    if (/^"[^"]*"$/.test(e)) return true
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

  const commitFunc = (ctx: FuncCtx) => {
    // Build the new parameter list.
    // For positional params: apply any extracted defaults.
    // For opts params: splice in as keyword args after the last positional param,
    //   and remove the `opts` positional param if all opts.* entries have defaults.

    const positional = ctx.params.filter(p => p !== ctx.optsParamName)
    const newParams: string[] = positional.map(p => {
      const def = ctx.defaults.get(p)
      return def !== undefined ? `${p}=${def}` : p
    })

    // Append opts.* kwargs (sorted by insertion order = declaration order)
    for (const [field, defVal] of ctx.optsKwargs) {
      newParams.push(`${field}=${defVal}`)
    }

    if (newParams.join(', ') !== ctx.params.join(', ')) {
      paramsWithDefaultsByLine.set(ctx.defLine, newParams.join(', '))
    }
  }

  for (const line of lines) {
    if (line.isComment) continue
    const content = line.content.trim()

    if (line.isBlockClose) {
      const closed = blockKinds.pop()
      if (closed === 'function') functionBlockCount--

      if (closed === 'arguments') {
        linesToRemove.add(line.originalLineStart)
        inArgumentsBlock = false
        continue
      }

      if (closed === 'function') {
        const ctx = fnStack.pop()
        if (ctx) commitFunc(ctx)
        inArgumentsBlock = false
      }
      continue
    }

    if (content === '') continue

    if (line.isBlockOpen && line.blockType) {
      blockKinds.push(line.blockType)
      if (line.blockType === 'function') functionBlockCount++
    }

    // Function definition: push new context.
    if (line.isBlockOpen && line.blockType === 'function') {
      const funcMatch = content.match(
        /^function\s+(?:\[[^\]]*\]\s*=\s*|\w+\s*=\s*)?(\w+)\s*(?:\(([^)]*)\))?/,
      )
      if (funcMatch) {
        const rawParams = (funcMatch[2] || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
        fnStack.push({
          defLine: line.originalLineStart,
          params: rawParams,
          defaults: new Map(),
          optsKwargs: new Map(),
          optsParamName: null,
        })
        inArgumentsBlock = false
      }
      continue
    }

    if (fnStack.length === 0) continue
    const ctx = fnStack[fnStack.length - 1]

    // Beginning of an `arguments` block for this function.
    if (line.isBlockOpen && line.blockType === 'arguments') {
      // functionBlockCount was just incremented above for this 'arguments' push —
      // but 'arguments' is not 'function', so the count reflects open function
      // blocks. If it equals fnStack.length, this arguments block is directly
      // inside the innermost function (not nested inside a sub-block).
      inArgumentsBlock = functionBlockCount === fnStack.length
      linesToRemove.add(line.originalLineStart)
      continue
    }

    // Inside an arguments block: strip the line and optionally extract default.
    if (inArgumentsBlock) {
      linesToRemove.add(line.originalLineStart)

      // Parse the declaration:
      //   param [(size)] type [= default]
      //   opts.field [(size)] type [= default]
      const withDefault = content.match(
        /^(\w+)(?:\.(\w+))?\s+(?:\([^)]*\)\s+)?(?:\w+(?:\s+\w+)*)?\s*=\s*(.+?)\s*;?\s*$/,
      )
      if (withDefault) {
        const baseParam = withDefault[1]
        const fieldName = withDefault[2]  // present for opts.field patterns
        const rawDefault = withDefault[3].replace(/;$/, '').trim()

        if (fieldName) {
          // opts.field pattern
          if (isSafeDefault(rawDefault)) {
            ctx.optsParamName = baseParam
            ctx.optsKwargs.set(fieldName, normalizeDefault(rawDefault))
          }
        } else {
          // Regular param default
          if (isSafeDefault(rawDefault) && !ctx.defaults.has(baseParam)) {
            ctx.defaults.set(baseParam, normalizeDefault(rawDefault))
          }
        }
      }
      // Declaration without default (just type annotation) — strip only.
      continue
    }
  }

  // Commit any functions that had no closing `end` (script-style).
  while (fnStack.length > 0) {
    const ctx = fnStack.pop()!
    commitFunc(ctx)
  }

  return { paramsWithDefaultsByLine, linesToRemove }
}
