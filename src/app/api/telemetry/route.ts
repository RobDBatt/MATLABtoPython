import { NextRequest, NextResponse } from 'next/server'
import { sanitizeEvent, eventToRow } from '@/lib/telemetry/event'
import { supabaseInsert } from '@/lib/supabase'

export const maxDuration = 10

/**
 * /api/telemetry — standalone anonymous usage-event sink (mirrors VBAtoPython).
 *
 * The same vocabulary-only events the convert route mirrors server-side can
 * also be POSTed here directly. Defense in depth:
 *   1. body-size cap (no large payloads),
 *   2. best-effort in-memory rate limit 1 req/sec/IP (no KV dependency;
 *      fail-OPEN — telemetry is never load-bearing),
 *   3. `sanitizeEvent` strips everything that isn't an allowed enum or a known
 *      catalog vocabulary id, so no source-derived string can ever be stored.
 *
 * IP is used only as an ephemeral rate-limit key; it is never written to the table.
 */
const MAX_BODY_BYTES = 16 * 1024

// Per-instance limiter. Serverless instances are short-lived, so this is a
// soft cap, not a guarantee — adequate given the sanitize chokepoint behind it.
const lastSeen = new Map<string, number>()

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const prev = lastSeen.get(ip)
  if (prev && now - prev < 1000) return true
  lastSeen.set(ip, now)
  // Opportunistic cleanup so the map can't grow unbounded.
  if (lastSeen.size > 5000) {
    for (const [k, t] of lastSeen) if (now - t > 60_000) lastSeen.delete(k)
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    if (rateLimited(clientIp(req))) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    let parsed: unknown
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const event = sanitizeEvent(parsed)
    if (!event) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    await supabaseInsert({
      table: 'usage_events',
      data: eventToRow(event) as unknown as Record<string, unknown>,
    })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[telemetry] /api/telemetry failed:', err)
    // Never surface an error that might make the client retry-storm; 204.
    return new NextResponse(null, { status: 204 })
  }
}
