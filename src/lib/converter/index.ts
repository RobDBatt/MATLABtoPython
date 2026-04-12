import type { ConversionResult } from './types'
import { tokenize } from './stages/01_tokenize'
import { detectStructure } from './stages/02_structure'
import { transform } from './stages/03_transform'
import { shiftIndices } from './stages/04_index'
import { cleanup } from './stages/05_cleanup'
import { detectPreFlags } from './flags/detector'
import { generateReport } from './report/generator'

/**
 * Convert MATLAB code to Python.
 *
 * Pure function — same input always produces the same output.
 * No randomness, no API calls, no side effects.
 * 100% deterministic, runs entirely on the server.
 */
export function convert(matlabCode: string): ConversionResult {
  const start = performance.now()

  // Pre-scan for unsupported constructs
  const tokenized = tokenize(matlabCode)
  const preFlags = detectPreFlags(tokenized)

  // Stage 1: Tokenize (already done above)
  const logicalLines = tokenized

  // Stage 2: Detect block structure and indentation
  const structured = detectStructure(logicalLines)

  // Stage 3: Apply transformation rules (operators, functions, toolboxes, constants)
  const { transformed, imports, flags: transformFlags } = transform(structured)

  // Stage 4: Index shifting (1-based → 0-based) — dedicated separate pass
  const { shifted, flags: indexFlags } = shiftIndices(transformed)

  // Stage 5: Cleanup (inject imports, apply indentation, remove `end` lines)
  const { python, flags: cleanupFlags } = cleanup(shifted, imports)

  // Collect all flags from all stages
  const allFlags = [...preFlags, ...transformFlags, ...indexFlags, ...cleanupFlags]

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
