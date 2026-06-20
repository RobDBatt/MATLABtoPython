import type { ConversionResult } from './types'
import { resolveQuotes } from './tokenizer/string-extractor'
import { tokenize } from './stages/01_tokenize'
import { detectStructure } from './stages/02_structure'
import { transform } from './stages/03_transform'
import { shiftIndices } from './stages/04_index'
import { cleanup } from './stages/05_cleanup'
import { detectPreFlags, detectResidualFlags } from './flags/detector'
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
export function convert(matlabCode: string): ConversionResult {
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

  // Stage 2: Detect block structure and indentation
  const structured = detectStructure(logicalLines)

  // Names a user assigned as variables that collide with a registry function
  // (e.g. `sum`, `length`, `filter`). MATLAB lets a variable shadow the
  // builtin; Stage 3 must NOT rewrite these to `np.sum(...)`, or Stage 4 would
  // produce nonsense like `np.sum[1]`. Let them flow through as plain names so
  // Stage 4 bracket-indexes them as the arrays they are.
  const shadowed = new Set(
    [...symbols.variables].filter((v) => FUNCTION_MAP[v] || TOOLBOX_MAP[v]),
  )

  // Stage 3: Apply transformation rules (operators, functions, toolboxes, constants)
  const { transformed, imports, flags: transformFlags } = transform(structured, shapeTable, shadowed, symbols.variables)

  // Stage 4: Index shifting (1-based → 0-based) — dedicated separate pass
  const { shifted, flags: indexFlags } = shiftIndices(transformed, symbols, imports)

  // Stage 5: Cleanup (inject imports, apply indentation, remove `end` lines)
  const { python, flags: cleanupFlags } = cleanup(shifted, imports)

  // Post-conversion safety net: scan the final output for residual invalid
  // constructs so a broken line never ships without an explanation.
  const residualFlags = detectResidualFlags(python)

  // Collect all flags from all stages
  const allFlags = [...preFlags, ...transformFlags, ...indexFlags, ...cleanupFlags, ...residualFlags]

  // Generate compatibility report
  const report = generateReport(matlabCode, python, allFlags, imports)

  return {
    python,
    report,
    processingMs: Math.round((performance.now() - start) * 100) / 100,
  }
}

// Re-export types for consumers
export type { ConversionResult, CompatibilityReport, Flag } from './types'
