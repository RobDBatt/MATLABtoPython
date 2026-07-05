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
  let body: { email?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const source = (body.source || 'unknown').trim().slice(0, 80)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const result = await saveSubscriber(email, source)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, storage: result.storage, duplicate: result.duplicate })
}
