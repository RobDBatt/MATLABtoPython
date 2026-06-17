/**
 * Telemetry event construction + sanitization (mirrors VBAtoPython).
 *
 * The single privacy chokepoint. Every event — whether built server-side from
 * a conversion or received from an untrusted client at /api/telemetry — passes
 * through `sanitizeEvent`, which drops anything that isn't an allowed enum
 * value or a known catalog vocabulary id (see catalog.ts). By construction no
 * source code, identifier, or unsupported-function name can reach the table.
 */
import type { FlagType } from '../converter/types'
import { KNOWN_FEATURE_IDS, FLAG_WARNING_ID, scanFeatures } from './catalog'
import {
  CONSENT_VERSION, EVENT_TYPES, LINES_BUCKETS, SITE, TARGETS,
  type EventType, type IdCount, type LinesBucket, type Target,
  type UsageEvent, type UsageEventRow,
} from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS = 200
const MAX_COUNT = 1_000_000

/** Coarse line bucket — never the raw count (prevents size-fingerprinting). */
export function linesBucket(lineCount: number): LinesBucket {
  if (lineCount <= 100) return '1-100'
  if (lineCount <= 500) return '101-500'
  if (lineCount <= 2000) return '501-2000'
  if (lineCount <= 5000) return '2001-5000'
  return '5000+'
}

/** Keep only `{id,count}` entries whose id is a known vocabulary word; clamp counts. */
function cleanIdCounts(raw: unknown): IdCount[] {
  if (!Array.isArray(raw)) return []
  const out: IdCount[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (out.length >= MAX_IDS) break
    if (!item || typeof item !== 'object') continue
    const id = (item as Record<string, unknown>).id
    const count = (item as Record<string, unknown>).count
    if (typeof id !== 'string' || !KNOWN_FEATURE_IDS.has(id) || seen.has(id)) continue
    const n = typeof count === 'number' && Number.isFinite(count)
      ? Math.min(Math.max(1, Math.floor(count)), MAX_COUNT)
      : 1
    seen.add(id)
    out.push({ id, count: n })
  }
  return out
}

/**
 * Coerce arbitrary (possibly hostile) input into a clean UsageEvent, or null if
 * it can't be made valid. THE leakage guard: anything not an allowed enum or a
 * known catalog id is dropped — no raw string survives.
 */
export function sanitizeEvent(raw: unknown): UsageEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const session_id = typeof r.session_id === 'string' && UUID_RE.test(r.session_id) ? r.session_id : null
  if (!session_id) return null

  const event_type = EVENT_TYPES.includes(r.event_type as EventType) ? (r.event_type as EventType) : null
  if (!event_type) return null

  const target = TARGETS.includes(r.target as Target) ? (r.target as Target) : null
  const lines_bucket = LINES_BUCKETS.includes(r.lines_bucket as LinesBucket) ? (r.lines_bucket as LinesBucket) : null

  return {
    session_id,
    event_type,
    target,
    lines_bucket,
    features_hit: cleanIdCounts(r.features_hit),
    warnings_emitted: cleanIdCounts(r.warnings_emitted),
    consent_version: typeof r.consent_version === 'number' && Number.isFinite(r.consent_version)
      ? Math.floor(r.consent_version) : CONSENT_VERSION,
  }
}

/** Tally raw converter flag types into the closed warning vocabulary. */
function tallyWarnings(flagTypes: readonly FlagType[]): IdCount[] {
  const m = new Map<string, number>()
  for (const t of flagTypes) {
    const id = FLAG_WARNING_ID[t]
    if (id) m.set(id, (m.get(id) ?? 0) + 1)
  }
  return [...m].map(([id, count]) => ({ id, count }))
}

/**
 * Build an event from a conversion. `features_hit` is every recognized
 * construct detected in the source; `warnings_emitted` is the tally of flag
 * types the converter raised (the "what users paste but we don't fully handle"
 * signal). Routes through sanitize so server-built and client-sent events are
 * identical in shape and equally leakage-proof.
 */
export function buildEvent(args: {
  eventType: EventType
  sessionId: string
  code: string
  flagTypes: readonly FlagType[]
  lineCount: number
  target?: Target | null
}): UsageEvent | null {
  return sanitizeEvent({
    session_id: args.sessionId,
    event_type: args.eventType,
    target: args.target ?? null,
    lines_bucket: linesBucket(args.lineCount),
    features_hit: scanFeatures(args.code),
    warnings_emitted: tallyWarnings(args.flagTypes),
    consent_version: CONSENT_VERSION,
  })
}

/** Map a sanitized event to the Supabase row (column names per the migration). */
export function eventToRow(e: UsageEvent): UsageEventRow {
  return {
    session_id: e.session_id,
    event_type: e.event_type,
    target: e.target,
    lines_bucket: e.lines_bucket,
    features: e.features_hit,
    warnings: e.warnings_emitted,
    consent_v: e.consent_version,
    site: SITE,
  }
}
