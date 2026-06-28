import type { Flag } from '../types'
import { FLAG_PREFIXES } from './messages'

/**
 * Produce an annotated copy of the converted Python where every flag's
 * explanation travels with the code:
 *  - flags that map to a specific OUTPUT line (the residual "this line didn't
 *    convert" markers) get an inline comment directly above that line;
 *  - construct-level flags (table/classdef/datetime/…) that only know their
 *    MATLAB source line collect into a header "Conversion notes" block.
 *
 * Pure/additive — the caller keeps the clean `python` and exposes this as a
 * separate field, so nothing that consumes the raw output changes.
 */
export function renderFlagsInline(python: string, flags: Flag[]): string {
  if (flags.length === 0) return python
  const lines = python.split('\n')

  // Inline: insert bottom-up so earlier line numbers stay valid as we splice.
  const inline = flags
    .filter(f => typeof f.outputLine === 'number' && f.outputLine > 0)
    .sort((a, b) => (b.outputLine as number) - (a.outputLine as number))
  const placed = new Set<string>()
  for (const f of inline) {
    const idx = (f.outputLine as number) - 1
    if (idx < 0 || idx >= lines.length) continue
    const key = `${f.outputLine}|${f.message}`
    if (placed.has(key)) continue
    placed.add(key)
    const indent = (lines[idx].match(/^[ \t]*/) || [''])[0]
    lines.splice(idx, 0, `${indent}${FLAG_PREFIXES[f.type]} ${f.message}`)
  }

  // Header notes block for construct-level flags (no reliable output line).
  const header = flags.filter(f => !(typeof f.outputLine === 'number' && f.outputLine > 0))
  if (header.length) {
    const seen = new Set<string>()
    const block: string[] = ['# === ⚠ Conversion notes — review before running ===']
    for (const f of header) {
      const key = `${f.type}|${f.message}`
      if (seen.has(key)) continue
      seen.add(key)
      const where = f.originalLine ? ` (MATLAB line ${f.originalLine})` : ''
      block.push(`${FLAG_PREFIXES[f.type]}${where} ${f.message}`)
    }
    block.push('')
    lines.unshift(...block)
  }

  return lines.join('\n')
}
