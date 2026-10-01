import { PLANS } from './plans'

/**
 * Free-tier preview for code over the free line limit.
 *
 * Before this, pasting more than 50 lines on the free tier returned a 403 and
 * showed nothing. Every free-tier failure in usage_events (Sept 2026) was that
 * line limit, on 100–2,000-line scripts: the visitors with a real file to
 * migrate were the ones who saw no output at all. Now the whole file is
 * converted, the full compatibility report is returned, and the Python is cut
 * to the first PREVIEW_LINES lines.
 */

/** Output lines shown on a preview: the imports plus the start of the code. */
export const PREVIEW_LINES = 30

/** Largest input that gets a preview. Above this the 403 stands. /api/convert
 *  has no rate limit and anyone with an email can ask for a preview, so this is
 *  kept well under Pro's 5,000: a 5,000-line convert takes ~3s of CPU, 2,000
 *  about 1.4s. Every over-limit free attempt in Sept 2026 was 2,000 lines or fewer. */
export const PREVIEW_MAX_INPUT_LINES = 2000

/** Whether a refused conversion should get a preview instead of an error. */
export function isPreviewable(
  verdict: { allowed: boolean; reason: string | null; limit: number },
  lineCount: number,
): boolean {
  return (
    !verdict.allowed &&
    verdict.reason === 'exceeds_line_limit' &&
    verdict.limit === PLANS.free.linesPerConversion &&
    lineCount <= PREVIEW_MAX_INPUT_LINES
  )
}

/** Cut converted Python to the preview length. */
export function previewPython(python: string): { python: string; totalLines: number } {
  const lines = python.split('\n')
  return { python: lines.slice(0, PREVIEW_LINES).join('\n'), totalLines: lines.length }
}
