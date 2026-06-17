/**
 * Telemetry types (mirrors the VBAtoPython telemetry design).
 *
 * An event NEVER contains source code, identity, IPs, or any user-derived
 * string — only vocabulary IDs drawn from the converter's own closed registry
 * (function/toolbox names) plus a fixed set of flag-type IDs, an anonymous
 * monthly-rotating session id, and coarse buckets.
 *
 * Rows are written to the shared `usage_events` table (vbatopython Supabase
 * project) and tagged `site = 'matlab'` so the two products stay separable.
 */

export const SITE = 'matlab' as const

export const EVENT_TYPES = ['preflight', 'convert_success', 'convert_failure'] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** Repurposes the shared table's `target` column as the conversion mode. */
export const TARGETS = ['paste', 'upload', 'batch'] as const
export type Target = (typeof TARGETS)[number]

export const LINES_BUCKETS = ['1-100', '101-500', '501-2000', '2001-5000', '5000+'] as const
export type LinesBucket = (typeof LINES_BUCKETS)[number]

/** A single feature/warning tally — `id` is always a known vocabulary word. */
export interface IdCount {
  id: string
  count: number
}

export interface UsageEvent {
  session_id: string
  event_type: EventType
  target: Target | null
  lines_bucket: LinesBucket | null
  /** Known registry construct IDs detected in the source (vocabulary, not user data). */
  features_hit: IdCount[]
  /** Flag-type IDs the converter emitted (the "needs review / can't convert" signal). */
  warnings_emitted: IdCount[]
  consent_version: number
}

/** The Supabase `usage_events` row shape (column names per the migration). */
export interface UsageEventRow {
  session_id: string
  event_type: EventType
  target: Target | null
  lines_bucket: LinesBucket | null
  features: IdCount[]
  warnings: IdCount[]
  consent_v: number
  site: typeof SITE
}

export const CONSENT_VERSION = 1
