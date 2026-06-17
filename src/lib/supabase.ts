// Lightweight Supabase REST client (no SDK dependency).
// Talks to the PostgREST API directly. Shared with the subscribe route's
// env var contract: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
//
// NOTE: MATLABtoPython shares the `vbatopython` Supabase project for the
// `usage_events` table (rows are tagged `site = 'matlab'`). Point these env
// vars at that project in the MATLABtoPython Vercel environment.

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

interface SupabaseInsertOptions {
  table: string
  data: Record<string, unknown>
}

export async function supabaseInsert({ table, data }: SupabaseInsertOptions): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    // Graceful fallback: log to stdout if Supabase isn't configured (dev / preview).
    console.log(`[${table.toUpperCase()}]`, JSON.stringify(data))
    return false
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[Supabase] Insert to ${table} failed:`, err)
      return false
    }
    return true
  } catch (err) {
    console.error(`[Supabase] Insert to ${table} error:`, err)
    return false
  }
}
