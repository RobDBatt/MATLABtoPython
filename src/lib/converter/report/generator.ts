import type { Flag, CompatibilityReport } from '../types'
import { TOOLBOX_MAP, detectToolboxes } from '../registry/toolboxes'

/**
 * Generate a compatibility report from the conversion results.
 */
export function generateReport(
  originalCode: string,
  pythonCode: string,
  flags: Flag[],
  imports: Set<string>,
): CompatibilityReport {
  const originalLines = originalCode.split('\n').filter(l => l.trim() !== '').length
  const unsupportedCount = flags.filter(f => f.type === 'UNSUPPORTED').length
  const todoCount = flags.filter(f => f.type === 'TODO').length
  const flaggedCount = flags.length

  // Detect which toolbox functions were found in the original code
  const functionNames = new Set<string>()
  const words = originalCode.match(/\b\w+\b/g) || []
  for (const word of words) {
    if (TOOLBOX_MAP[word]) {
      functionNames.add(word)
    }
  }
  const detectedToolboxes = detectToolboxes(functionNames)

  // Deduplicate flags by originalLine + message
  const seen = new Set<string>()
  const uniqueFlags = flags.filter(f => {
    const key = `${f.originalLine}:${f.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const convertedCount = Math.max(0, originalLines - unsupportedCount - todoCount)
  const conversionRate = originalLines > 0
    ? Math.round((convertedCount / originalLines) * 100)
    : 100

  return {
    totalLines: originalLines,
    convertedCount,
    flaggedCount: uniqueFlags.length,
    unsupportedCount,
    flags: uniqueFlags,
    imports: Array.from(imports).sort(),
    detectedToolboxes,
    conversionRate,
  }
}
