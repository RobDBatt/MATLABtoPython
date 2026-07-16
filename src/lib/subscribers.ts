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

/**
 * Has this email already used its one free MATLABtoPython conversion?
 * Fails OPEN (returns false) when Supabase isn't configured or the query
 * errors — a transient DB hiccup must never block a legitimate conversion;
 * worst case someone gets an extra free run, which is the same tradeoff
 * `saveSubscriber` already makes for the no-DB case.
 */
export async function hasUsedMatlabFreeConversion(email: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return false

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/subscribers?email=eq.${encodeURIComponent(email)}&select=matlab_free_conversion_used_at`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    )
    if (!res.ok) return false
    const rows = (await res.json()) as Array<{ matlab_free_conversion_used_at: string | null }>
    return rows.length > 0 && rows[0].matlab_free_conversion_used_at !== null
  } catch (err) {
    console.error('[free-conversion-gate] network error', err)
    return false
  }
}

/**
 * Record that this email has now used its free conversion.
 *
 * Delegates to an atomic upsert (see 0004_mark_free_conversion_atomic.sql).
 * This ran as a PATCH-then-INSERT until it lost a race with `saveSubscriber`'s
 * concurrent INSERT — Next's `after()` fires its callbacks in parallel — and
 * silently left the flag NULL for every first-time email. The gate never
 * engaged. Keep the write as one statement; a read-then-write from here
 * reopens that window.
 *
 * The timestamp is Postgres `now()`, not a client clock, so it can't disagree
 * with `created_at`.
 */
export async function markMatlabFreeConversionUsed(email: string, source: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.log('[free-conversion-gate] (no-db)', { email, ts: new Date().toISOString() })
    return
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/mark_matlab_free_conversion_used`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_email: email, p_source: source }),
    })
    if (!res.ok) {
      // Never swallow this silently again — a failure here means the gate
      // didn't engage, which is exactly the bug this function used to hide.
      const errText = await res.text().catch(() => '')
      console.error('[free-conversion-gate] rpc failed', res.status, errText)
    }
  } catch (err) {
    console.error('[free-conversion-gate] network error', err)
  }
}
