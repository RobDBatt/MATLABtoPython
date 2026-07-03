/**
 * Server-side telemetry logging (mirrors VBAtoPython). Called from the convert
 * route via Next's `after()` so it runs AFTER the response is sent — telemetry
 * can never add latency to, or break, a conversion.
 *
 * Only closed-vocabulary IDs are ever recorded (see catalog.ts); the raw MATLAB
 * never leaves this function. Every error is swallowed; conversions are sacred.
 */
import { after } from 'next/server'
import type { FlagType } from '../converter/types'
import { supabaseInsert } from '../supabase'
import { buildEvent, eventToRow } from './event'
import type { EventType, Target } from './types'

export interface ServerEventArgs {
  eventType: EventType
  code: string
  flagTypes: readonly FlagType[]
  lineCount: number
  sessionId?: unknown
  consent?: unknown
  target?: Target | null
  /** Failure-reason ids from the closed catalog vocabulary (e.g. 'line_limit'). */
  extraWarningIds?: readonly string[]
}

/**
 * Schedule a telemetry event to log AFTER the response is sent. `after()` only
 * works inside a request scope — outside one (e.g. unit tests) it throws, so we
 * swallow that too. Telemetry can never affect, delay, or fail a conversion.
 */
export function scheduleTelemetry(args: ServerEventArgs): void {
  try {
    after(() => logServerEvent(args))
  } catch {
    // No request scope (tests / non-request context) — skip silently.
  }
}

export async function logServerEvent(args: ServerEventArgs): Promise<void> {
  try {
    // Only log when the caller passed explicit consent + a session id.
    if (args.consent !== true || typeof args.sessionId !== 'string') return
    if (typeof args.code !== 'string' || !args.code.trim()) return

    const event = buildEvent({
      eventType: args.eventType,
      sessionId: args.sessionId,
      code: args.code,
      flagTypes: args.flagTypes ?? [],
      lineCount: args.lineCount,
      target: args.target ?? null,
      extraWarningIds: args.extraWarningIds,
    })
    if (!event) return

    await supabaseInsert({
      table: 'usage_events',
      data: eventToRow(event) as unknown as Record<string, unknown>,
    })
  } catch (err) {
    // Telemetry must NEVER affect a conversion. Swallow everything.
    console.error('[telemetry] logServerEvent failed:', err)
  }
}
