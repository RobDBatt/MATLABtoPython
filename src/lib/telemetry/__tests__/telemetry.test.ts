import { describe, it, expect } from 'vitest'
import { buildEvent, sanitizeEvent } from '../event'
import { EVENT_TYPES } from '../types'
import { KNOWN_FEATURE_IDS } from '../catalog'

// Coverage for the failure-telemetry additions (Clerk-404/telemetry fix):
// convert_attempt joins the event vocabulary, and failure-reason warning ids
// ('line_limit', 'internal_error', 'network') flow through buildEvent while
// anything outside the closed catalog is still dropped by sanitizeEvent.

const SESSION = '123e4567-e89b-42d3-a456-426614174000'

describe('EVENT_TYPES', () => {
  it('includes convert_attempt alongside the existing types', () => {
    expect(EVENT_TYPES).toContain('convert_attempt')
    expect(EVENT_TYPES).toContain('convert_success')
    expect(EVENT_TYPES).toContain('convert_failure')
    expect(EVENT_TYPES).toContain('preflight')
  })
})

describe('failure warning ids', () => {
  it('line_limit / internal_error / network are in the closed vocabulary', () => {
    for (const id of ['line_limit', 'internal_error', 'network']) {
      expect(KNOWN_FEATURE_IDS.has(id)).toBe(true)
    }
  })

  it('buildEvent merges extraWarningIds into warnings_emitted', () => {
    const e = buildEvent({
      eventType: 'convert_failure',
      sessionId: SESSION,
      code: 'x = 1;',
      flagTypes: [],
      lineCount: 60,
      target: 'paste',
      extraWarningIds: ['line_limit'],
    })
    expect(e).not.toBeNull()
    expect(e!.warnings_emitted).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'line_limit' })]),
    )
  })

  it('unknown extra ids are DROPPED by sanitization (leakage guard)', () => {
    const e = buildEvent({
      eventType: 'convert_failure',
      sessionId: SESSION,
      code: 'x = 1;',
      flagTypes: [],
      lineCount: 10,
      extraWarningIds: ['secret_user_string', 'line_limit'],
    })
    expect(e).not.toBeNull()
    const ids = e!.warnings_emitted.map((w) => w.id)
    expect(ids).toContain('line_limit')
    expect(ids).not.toContain('secret_user_string')
  })

  it('convert_attempt events sanitize cleanly', () => {
    const e = sanitizeEvent({
      session_id: SESSION,
      event_type: 'convert_attempt',
      target: 'paste',
      lines_bucket: '1-100',
      features_hit: [],
      warnings_emitted: [],
      consent_version: 1,
    })
    expect(e).not.toBeNull()
    expect(e!.event_type).toBe('convert_attempt')
  })
})
