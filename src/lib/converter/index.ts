import type { ConversionResult } from './types'
import { resolveQuotes } from './tokenizer/string-extractor'
import { tokenize } from './stages/01_tokenize'
import { detectStructure } from './stages/02_structure'
import { transform } from './stages/03_transform'
import { shiftIndices } from './stages/04_index'
import { cleanup } from './stages/05_cleanup'
import { detectPreFlags, detectResidualFlags } from './flags/detector'
import { renderFlagsInline } from './flags/render'
import { generateReport } from './report/generator'
import { buildSymbolTable } from './analysis/scope'
import { buildRenameMap, applyRenames, renameReservedFields } from './analysis/rename-reserved'
import { importedAliasesForSource } from './registry/imports'
import { buildShapeTable } from './analysis/shape-table'
import { FUNCTION_MAP } from './registry/functions'
import { TOOLBOX_MAP } from './registry/toolboxes'

/**
 * Convert MATLAB code to Python.
 *
 * Pure function — same input always produces the same output.
 * No randomness, no API calls, no side effects.
 * 100% deterministic, runs entirely on the server.
 */
export interface ConvertOptions {
  /**
   * Names of USER functions defined in sibling files of the same project
   * (multi-file conversion). These are treated as known function calls —
   * never registry-mapped (`smooth.m` in the repo beats the Curve Fitting
   * mapping, matching MATLAB's path precedence) and never bracket-indexed
   * by Stage 4.
   */
  externalFunctions?: string[]
}

export function convert(matlabCode: string, options?: ConvertOptions): ConversionResult {
  const start = performance.now()

  // Stage 0: Resolve MATLAB's `'` ambiguity. The string extractor replaces
  // every `'...'` and `"..."` literal with a placeholder, converts every
  // remaining `'` (unambiguously transpose) to `.T`, then restores the
  // strings. After this, downstream transforms see MATLAB source where
  // `'` can only be a string delimiter.
  const disambiguated = resolveQuotes(matlabCode)

  // Pre-scan for unsupported constructs
  const tokenized = tokenize(disambiguated)
  const preFlags = detectPreFlags(tokenized)

  // Build symbol table (variables vs functions) from the raw tokenized form
  // so that every `A(i)` disambiguation downstream uses the same facts.
  const symbols = buildSymbolTable(tokenized)

  // Sibling-file user functions (multi-file conversion): known calls, exactly
  // like local functions — Stage 4 must not bracket-index them.
  const externals = new Set(options?.externalFunctions ?? [])
  for (const f of externals) symbols.functions.add(f)

  // Build shape table (scalar vs matrix) for the * → @ rewrite in Stage 3.
  const shapeTable = buildShapeTable(tokenized)

  // Rename MATLAB identifiers that collide with Python reserved words
  // (`lambda`, `class`, `in`, etc.). Apply to every tokenized line and
  // also update the symbol table so downstream stages see the new names.
  const renames = buildRenameMap(symbols.variables, importedAliasesForSource(matlabCode))
  const logicalLines = tokenized.map((l) => ({
    ...l,
    // Don't rewrite identifiers inside comments — renaming a word like
    // `signal` that merely appears in a comment is wrong (and noisy).
    content: l.isComment ? l.content : renameReservedFields(applyRenames(l.content, renames)),
  }))
  for (const [oldName, newName] of renames) {
    symbols.variables.delete(oldName)
    symbols.variables.add(newName)
  }

  // Desugar struct variables to dicts: a var that gets a field assignment
  // (`s.f = ...`) or is built with `struct(...)` is a MATLAB struct, which the
  // engine models as a Python dict. Initialize it (`s = Struct()`) before its first
  // field write — MATLAB auto-vivifies, Python doesn't — and rewrite that var's
  // `s.f` accesses to `s['f']`. Scoped to detected struct names, so real object
  // attributes (`A.shape`, module access) are untouched.
  const { desugared, hasStructs } = desugarStructs(logicalLines)

  // Stage 2: Detect block structure and indentation
  const structured = detectStructure(desugared)

  // Names a user assigned as variables that collide with a registry function
  // (e.g. `sum`, `length`, `filter`). MATLAB lets a variable shadow the
  // builtin; Stage 3 must NOT rewrite these to `np.sum(...)`, or Stage 4 would
  // produce nonsense like `np.sum[1]`. Let them flow through as plain names so
  // Stage 4 bracket-indexes them as the arrays they are.
  // Names converted by dedicated rewriters rather than registry entries —
  // they need the same shadowing protection (gramm assigns `xline` as a plain
  // vector variable).
  const SPECIAL_REWRITE_NAMES = new Set(['xline', 'yline'])
  const shadowed = new Set(
    [...symbols.variables].filter(
      (v) => FUNCTION_MAP[v] || TOOLBOX_MAP[v] || SPECIAL_REWRITE_NAMES.has(v),
    ),
  )
  // A sibling-file user function also shadows any registry mapping of the
  // same name — MATLAB path precedence puts project files first.
  for (const f of externals) shadowed.add(f)

  // Stage 3: Apply transformation rules (operators, functions, toolboxes, constants)
  const { transformed, imports, flags: transformFlags } = transform(structured, shapeTable, shadowed, symbols.variables)
  if (hasStructs) {
    imports.add('compat:Struct')
  }

  // Stage 4: Index shifting (1-based → 0-based) — dedicated separate pass
  const { shifted, flags: indexFlags } = shiftIndices(transformed, symbols, imports, shapeTable)

  // Stage 5: Cleanup (inject imports, apply indentation, remove `end` lines)
  const { python, flags: cleanupFlags } = cleanup(shifted, imports)

  // Post-conversion safety net: scan the final output for residual invalid
  // constructs so a broken line never ships without an explanation.
  const residualFlags = detectResidualFlags(python)

  // Collect all flags from all stages
  const allFlags = [...preFlags, ...transformFlags, ...indexFlags, ...cleanupFlags, ...residualFlags]

  // Generate compatibility report
  const report = generateReport(matlabCode, python, allFlags, imports)

  // Annotated output — flag explanations rendered inline (additive; `python`
  // stays clean so existing consumers are unaffected).
  const annotated = renderFlagsInline(python, allFlags)

  return {
    python,
    annotated,
    report,
    processingMs: Math.round((performance.now() - start) * 100) / 100,
  }
}

/**
 * Detect MATLAB struct variables and desugar them to Python dicts.
 *
 * A struct var is one that gets a field assignment (`s.f = ...`) or is built
 * with `struct(...)`. For those names: emit `s = {}` before the first field
 * write (MATLAB auto-vivifies; Python would NameError), and rewrite `s.f` →
 * `s['f']`. Scoped to detected names, and the field rewrite is string- and
 * identifier-boundary-aware, so real attribute access (`A.shape`, module calls)
 * and struct names appearing inside string literals are left untouched.
 */
function desugarStructs<T extends { content: string; isComment?: boolean }>(
  lines: T[],
): { desugared: T[]; hasStructs: boolean } {
  const fieldAssign = /^\s*([A-Za-z_]\w*)\.[A-Za-z_]\w*\s*=(?!=)/
  const structCtor = /^\s*([A-Za-z_]\w*)\s*=\s*struct\s*\(/

  const structVars = new Set<string>()
  for (const l of lines) {
    if (l.isComment) continue
    const a = l.content.match(fieldAssign); if (a) structVars.add(a[1])
    const c = l.content.match(structCtor); if (c) structVars.add(c[1])
  }
  if (structVars.size === 0) return { desugared: lines, hasStructs: false }

  const inited = new Set<string>()
  const desugared: T[] = []
  for (const l of lines) {
    if (l.isComment) { desugared.push(l); continue }
    const content = l.content
    // `s = struct(...)` whole-assigns the var → already initialized.
    const ctor = content.match(structCtor)
    if (ctor && structVars.has(ctor[1])) inited.add(ctor[1])
    // First field write on a not-yet-initialized struct var → `s = Struct()` first.
    const fw = content.match(fieldAssign)
    if (fw && structVars.has(fw[1]) && !inited.has(fw[1])) {
      inited.add(fw[1])
      const indent = content.match(/^\s*/)![0]
      desugared.push({ ...l, content: `${indent}${fw[1]} = Struct()` })
    }
    desugared.push({ ...l, content: rewriteStructFields(content, structVars) })
  }
  return { desugared, hasStructs: true }
}

/** Rewrite `<structvar>.<field>` → `<structvar>['<field>']` outside string
 *  literals, only at identifier boundaries (so `a.b.c` and mid-tokens are safe). */
function rewriteStructFields(content: string, structVars: Set<string>): string {
  let out = ''
  let i = 0
  let inStr = false
  let q = ''
  while (i < content.length) {
    const ch = content[i]
    if (inStr) {
      out += ch
      if (ch === q) inStr = false
      i++
      continue
    }
    if (ch === "'" || ch === '"') { inStr = true; q = ch; out += ch; i++; continue }
    const prev = out.length ? out[out.length - 1] : ''
    // Only start matching at a fresh identifier (not after a word char or a dot —
    // the latter keeps `a.b` from treating `b` as its own struct variable).
    if (/[A-Za-z_]/.test(ch) && !/[\w.]/.test(prev)) {
      const m = /^([A-Za-z_]\w*)(\.[A-Za-z_]\w*)?/.exec(content.slice(i))!
      const name = m[1]
      if (m[2] && structVars.has(name)) {
        out += `${name}['${m[2].slice(1)}']`
        i += m[0].length
        continue
      }
      out += name
      i += name.length
      continue
    }
    out += ch
    i++
  }
  return out
}

// Re-export types for consumers
export type { ConversionResult, CompatibilityReport, Flag } from './types'
