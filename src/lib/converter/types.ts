// ============================================================
// MATLABtoPython Converter — Core Types
// 100% deterministic, no AI API calls
// ============================================================

/** A single logical line after tokenization (continuations joined, multi-statements split) */
export interface LogicalLine {
  content: string
  originalLineStart: number
  originalLineEnd: number
  isComment: boolean
}

/** Block types that MATLAB uses with `end` to close */
export type BlockType =
  | 'function'
  | 'for'
  | 'while'
  | 'if'
  | 'elseif'
  | 'else'
  | 'switch'
  | 'case'
  | 'otherwise'
  | 'try'
  | 'catch'
  | 'classdef'
  | 'parfor'
  | 'arguments'

/** A logical line enriched with structural/indentation info */
export interface StructuredLine extends LogicalLine {
  indentLevel: number
  blockType: BlockType | null
  isBlockOpen: boolean
  isBlockClose: boolean
}

/** Flag severity types */
export type FlagType = 'WARNING' | 'INDEX' | 'TOOLBOX' | 'TODO' | 'UNSUPPORTED'

/** A flag emitted during conversion */
export interface Flag {
  type: FlagType
  message: string
  originalLine: number
  outputLine: number
  originalCode: string
}

/** The compatibility report summarizing conversion quality */
export interface CompatibilityReport {
  totalLines: number
  convertedCount: number
  flaggedCount: number
  unsupportedCount: number
  flags: Flag[]
  imports: string[]
  detectedToolboxes: string[]
  conversionRate: number
}

/** The full result returned by convert() */
export interface ConversionResult {
  python: string
  /** `python` with every flag's explanation rendered inline as a comment
   *  (residual line markers above their line; construct-level notes in a header
   *  block). Equals `python` when there are no flags. Serve this to end users so
   *  the "why it can't be Python" guidance travels with the code. */
  annotated: string
  report: CompatibilityReport
  processingMs: number
}

// ============================================================
// Registry Types
// ============================================================

/** How function arguments should be transformed */
export type ArgTransform =
  | 'passthrough'      // args transfer directly
  | 'reshape'          // array dims need tuple wrapping: zeros(3,4) → np.zeros((3,4))
  | 'rand_shape'       // separate dim args (no tuple) + de-2-D row/col vec: rand(1,n) → np.random.rand(n)
  | 'tile'             // array + reps tuple: repmat(A,2,3) → np.tile(A, (2,3))
  | 'attribute'        // becomes property access: size(A) → A.shape
  | 'template'         // string template with {}: numel(A) → A.size
  | 'format_convert'   // fprintf format string conversion
  | 'custom'           // requires special handling logic

/** A single function mapping entry */
export interface FunctionMapping {
  python: string
  args: ArgTransform
  imports: string[]
  /**
   * Optional positional-argument permutation applied after the name swap.
   * MATLAB and the NumPy/SciPy/`re` equivalent often order args differently
   * (`interp1(x,y,xi)` → `np.interp(xi,x,y)`); `argReorder` is the index map of
   * output position → source index. Only applied when the call's arg count
   * exactly equals `argReorder.length` (other arities are left untouched, and
   * may be gated by `flagWhen`), so partial / variadic forms never get a wrong
   * silent reorder.
   */
  argReorder?: number[]
  flag?: {
    type: FlagType
    message: string
  }
  /**
   * Optional gate: emit `flag` only when this returns true. Receives the
   * full original line so the predicate can inspect arg counts (e.g.
   * `dot(x, y, dim)` 3-arg form) or return-shape patterns (e.g.
   * `[U, p] = chol(...)`).
   */
  flagWhen?: (content: string) => boolean
}

/** An operator mapping entry — order matters for processing */
export interface OperatorMapping {
  matlab: string
  python: string
  note: string
  flag?: {
    type: FlagType
    message: string
  }
}

/** A constant mapping entry */
export interface ConstantMapping {
  python: string
  imports: string[]
  flag?: {
    type: FlagType
    message: string
  }
}

/** A toolbox function mapping — like FunctionMapping but with toolbox metadata */
export interface ToolboxMapping extends FunctionMapping {
  toolbox: string
}

// ============================================================
// Stage Output Types
// ============================================================

/** Output from Stage 3: Transform */
export interface TransformResult {
  transformed: StructuredLine[]
  imports: Set<string>
  flags: Flag[]
}

/** Output from Stage 4: Index Shifting */
export interface IndexShiftResult {
  shifted: StructuredLine[]
  flags: Flag[]
}

/** Output from Stage 5: Cleanup */
export interface CleanupResult {
  python: string
  flags: Flag[]
}
