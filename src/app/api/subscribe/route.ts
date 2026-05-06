import { NextRequest, NextResponse } from 'next/server'

/**
 * Email capture endpoint.
 *
 * Writes to Supabase via REST (no SDK dependency) when `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY` are configured. Otherwise logs to the server
 * (still captured in Vercel logs) so the site never hard-fails if env
 * vars aren't set yet.
 *
 * Client sends `{ email, source }`. Source is free-form ('footer', 'homepage-cta',
 * 'article-matlab-to-numpy-cheat-sheet', etc.) so we can later see which
 * placements converted.
 *
 * Expected Supabase table:
 *   create table subscribers (
 *     id bigserial primary key,
 *     email text unique not null,
 *     source text,
 *     created_at timestamp with time zone default now()
 *   );
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const source = (body.source || 'unknown').trim().slice(0, 80)

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  // If Supabase isn't configured, log and succeed. Lets the form work
  // end-to-end in dev without failing; Vercel logs preserve the lead so
  // Rob can export manually until DB wiring is complete.
  if (!supabaseUrl || !supabaseKey) {
    console.log('[subscribe] (no-db)', { email, source, ts: new Date().toISOString() })
    return NextResponse.json({ ok: true, storage: 'log' })
  }

  try {
    // Plain insert; unique constraint on `email` means a repeat signup
    // fails with 409, which we map to an idempotent "already subscribed"
    // response. Don't use PostgREST upsert here — it requires SELECT
    // access on the target row, which we don't grant to the anon role.
    const res = await fetch(`${supabaseUrl}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email, source }),
    })

    if (res.ok || res.status === 201 || res.status === 204) {
      return NextResponse.json({ ok: true, storage: 'db' })
    }
    if (res.status === 409) {
      return NextResponse.json({ ok: true, storage: 'db', duplicate: true })
    }
    const errText = await res.text().catch(() => '')
    console.error('[subscribe] supabase error', res.status, errText)
    return NextResponse.json({ error: 'storage_error' }, { status: 502 })
  } catch (err) {
    console.error('[subscribe] network error', err)
    return NextResponse.json({ error: 'network_error' }, { status: 502 })
  }
}
