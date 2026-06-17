/**
 * Telemetry vocabulary — the privacy chokepoint.
 *
 * The ONLY strings that may ever be logged are drawn from this closed set,
 * which is built at module-load time from the converter's own registries
 * (function + toolbox names) plus a small, hand-listed set of language
 * constructs and the five fixed flag-type IDs. Anything a user types that
 * isn't already one of these known words is never recorded — so no source
 * code, identifier, or unsupported-function name can leak.
 */
import { FUNCTION_MAP } from '../converter/registry/functions'
import { TOOLBOX_MAP } from '../converter/registry/toolboxes'
import type { FlagType } from '../converter/types'
import type { IdCount } from './types'

/** Flag-type → warning vocabulary id (the closed warnings namespace). */
export const FLAG_WARNING_ID: Record<FlagType, string> = {
  WARNING: 'warning',
  INDEX: 'index',
  TOOLBOX: 'toolbox',
  TODO: 'todo',
  UNSUPPORTED: 'unsupported',
}

/** Language constructs that aren't plain function names — matched by regex. */
interface ConstructPattern {
  id: string
  pattern: RegExp
}
const LANGUAGE_CONSTRUCTS: ConstructPattern[] = [
  { id: 'lc:transpose', pattern: /'(?=\s|$|\))/ },
  { id: 'lc:elementwise', pattern: /\.(?:\*|\/|\^|\\)/ },
  { id: 'lc:colon-range', pattern: /\b\w+\s*:\s*\w+/ },
  { id: 'lc:end-index', pattern: /\(\s*end\b/ },
  { id: 'lc:cell-array', pattern: /\{[^}]*\}/ },
  { id: 'lc:anon-fn', pattern: /@\s*\(/ },
  { id: 'lc:struct-field', pattern: /\w+\.\w+\s*=/ },
  { id: 'lc:global', pattern: /\bglobal\b/ },
  { id: 'lc:nargin', pattern: /\bnarg(?:in|out)\b/ },
  { id: 'lc:command-syntax', pattern: /^\s*(?:hold|grid|axis|clc|clear|close)\b/m },
]

/** Every function/toolbox name the converter recognizes — closed vocabulary. */
const FUNCTION_IDS: ReadonlySet<string> = new Set([
  ...Object.keys(FUNCTION_MAP),
  ...Object.keys(TOOLBOX_MAP),
])

/** The full allowed vocabulary: functions + language constructs + flag types. */
export const KNOWN_FEATURE_IDS: ReadonlySet<string> = new Set<string>([
  ...FUNCTION_IDS,
  ...LANGUAGE_CONSTRUCTS.map((c) => c.id),
  ...Object.values(FLAG_WARNING_ID),
])

const MAX_IDS = 200
const MAX_COUNT = 1_000_000

/**
 * Remove block comments (%{ … %}), string literals ("…" and '…'), and line
 * comments (% … EOL) so feature words inside comments/strings don't inflate
 * counts. Best-effort — telemetry counts, not a parser.
 */
function stripNoise(src: string): string {
  let s = src.replace(/^[ \t]*%\{[\s\S]*?^[ \t]*%\}/gm, ' ') // block comments
  s = s.replace(/"(?:[^"]|"")*"/g, ' ') // double-quoted strings
  s = s.replace(/'(?:[^']|'')*'/g, ' ') // single-quoted strings (best-effort vs transpose)
  s = s.replace(/%[^\n]*/g, ' ') // line comments
  return s
}

/** Count word-boundary occurrences of every known function id, plus constructs. */
export function scanFeatures(code: string): IdCount[] {
  if (typeof code !== 'string' || !code.trim()) return []
  const stripped = stripNoise(code)

  const wordCounts = new Map<string, number>()
  const words = stripped.match(/\b[A-Za-z_]\w*\b/g) || []
  for (const w of words) {
    if (FUNCTION_IDS.has(w)) wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1)
  }

  const out: IdCount[] = []
  for (const [id, count] of wordCounts) {
    if (out.length >= MAX_IDS) break
    out.push({ id, count: Math.min(count, MAX_COUNT) })
  }

  // Language constructs use the original (transpose detection needs raw `'`).
  for (const c of LANGUAGE_CONSTRUCTS) {
    if (out.length >= MAX_IDS) break
    const re = new RegExp(c.pattern.source, c.pattern.flags.includes('g') ? c.pattern.flags : c.pattern.flags + 'g')
    const m = stripped.match(re)
    if (m && m.length) out.push({ id: c.id, count: Math.min(m.length, MAX_COUNT) })
  }

  return out
}
