import { NextRequest, NextResponse } from 'next/server'
import { isValidEmail, saveSubscriber } from '@/lib/subscribers'

/**
 * Email capture endpoint.
 *
 * Client sends `{ email, source }`. Source is free-form ('footer', 'homepage-cta',
 * 'article-matlab-to-numpy-cheat-sheet', etc.) so we can later see which
 * placements converted.
 */

export async function POST(req: NextRequest) {
  let body: { email?: unknown; source?: unknown } | null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const source = (typeof body?.source === 'string' ? body.source.trim().slice(0, 80) : '') || 'unknown'

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const result = await saveSubscriber(email, source)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'storage_unavailable' ? 503 : 502 })
  }
  return NextResponse.json({ ok: true, storage: result.storage, duplicate: result.duplicate })
}
