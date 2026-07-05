/**
 * Shared subscriber persistence — used by /api/subscribe (newsletter) and
 * /api/convert (email-gate for anonymous free-tier conversions).
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return !!email && email.length <= 254 && EMAIL_RE.test(email)
}

export async function saveSubscriber(
  email: string,
  source: string,
): Promise<{ ok: boolean; duplicate?: boolean; storage: 'db' | 'log'; error?: string }> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  // If Supabase isn't configured, log and succeed — same no-hard-fail
  // behavior as the original /api/subscribe endpoint.
  if (!supabaseUrl || !supabaseKey) {
    console.log('[subscribe] (no-db)', { email, source, ts: new Date().toISOString() })
    return { ok: true, storage: 'log' }
  }

  try {
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
      return { ok: true, storage: 'db' }
    }
    if (res.status === 409) {
      return { ok: true, storage: 'db', duplicate: true }
    }
    const errText = await res.text().catch(() => '')
    console.error('[subscribe] supabase error', res.status, errText)
    return { ok: false, storage: 'db', error: 'storage_error' }
  } catch (err) {
    console.error('[subscribe] network error', err)
    return { ok: false, storage: 'db', error: 'network_error' }
  }
}
