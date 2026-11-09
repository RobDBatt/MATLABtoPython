import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'

const call = (body: unknown) => POST(new NextRequest('http://localhost/api/subscribe', {
  method: 'POST',
  body: JSON.stringify(body),
}))

describe('subscriber capture', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reports unavailable storage and avoids logging the email', async () => {
    vi.stubEnv('SUPABASE_URL', '')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await call({ email: 'person@example.com' })
    expect(response.status).toBe(503)
    expect((await response.json()).error).toBe('storage_unavailable')
    expect(JSON.stringify(log.mock.calls)).not.toContain('person@example.com')
  })

  it('confirms a successful database write', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test.example')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture-key')
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    const response = await call({ email: ' Person@EXAMPLE.com ', source: 'footer' })
    expect(await response.json()).toEqual({ ok: true, storage: 'db' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ email: 'person@example.com', source: 'footer' })
  })

  it('rejects a non-string email', async () => {
    expect((await call({ email: 123 })).status).toBe(400)
  })
})
