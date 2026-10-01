import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Auth, the subscriber store and telemetry are mocked so the route's gating
// is exercised on its own. `after` is stubbed because it only works inside a
// real request scope.
let mockUserId: string | null = null
let mockUser: unknown = null
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: mockUserId }),
  currentUser: async () => mockUser,
  clerkClient: async () => ({ users: { updateUserMetadata: async () => {} } }),
}))

let emailUsed = false
const markUsed = vi.fn()
vi.mock('@/lib/subscribers', () => ({
  isValidEmail: (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
  saveSubscriber: vi.fn(async () => ({ ok: true, storage: 'log' })),
  hasUsedMatlabFreeConversion: async () => emailUsed,
  markMatlabFreeConversionUsed: async (...a: unknown[]) => markUsed(...a),
}))

const telemetry = vi.fn()
vi.mock('@/lib/telemetry/server', () => ({ scheduleTelemetry: (a: unknown) => telemetry(a) }))

vi.mock('next/server', async (orig) => ({
  ...(await orig<typeof import('next/server')>()),
  after: (fn: () => unknown) => { fn() },
}))

const { POST } = await import('../route')
const { PREVIEW_LINES, PREVIEW_MAX_INPUT_LINES } = await import('@/lib/freePreview')

/** A MATLAB script with `n` non-blank lines. */
const matlab = (n: number) => Array.from({ length: n }, (_, i) => `x${i} = ${i} + 1;`).join('\n')

const call = (body: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/convert', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  mockUserId = null
  mockUser = null
  emailUsed = false
  markUsed.mockClear()
  telemetry.mockClear()
})

describe('free tier over the line limit', () => {
  it('gets a preview of the whole file instead of a 403', async () => {
    const res = await call({ code: matlab(120), email: 'eng@lab.edu' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.truncated).toBe(true)
    expect(data.python.split('\n').length).toBeLessThanOrEqual(PREVIEW_LINES)
    expect(data.totalLines).toBeGreaterThan(PREVIEW_LINES)
    // The report covers the whole file, not just the preview.
    expect(data.python).not.toContain('x119')
    expect(data.report.convertedCount).toBeGreaterThanOrEqual(120)
  })

  it('does not use up the free conversion', async () => {
    await call({ code: matlab(120), email: 'eng@lab.edu' })
    expect(markUsed).not.toHaveBeenCalled()
  })

  it('still previews for an email that already used its free conversion', async () => {
    emailUsed = true
    const res = await call({ code: matlab(120), email: 'eng@lab.edu' })
    expect(res.status).toBe(200)
    expect((await res.json()).truncated).toBe(true)
  })

  it('is logged as a success tagged line_limit', async () => {
    await call({ code: matlab(120), email: 'eng@lab.edu', telemetry_consent: true, session_id: 's' })
    const events = telemetry.mock.calls.map((c) => c[0] as { eventType: string; extraWarningIds?: string[] })
    expect(events.some((e) => e.eventType === 'convert_success' && e.extraWarningIds?.includes('line_limit'))).toBe(true)
    expect(events.some((e) => e.eventType === 'convert_failure')).toBe(false)
  })

  it('a signed-in free user gets the same preview', async () => {
    mockUserId = 'u_1'
    mockUser = { id: 'u_1', publicMetadata: {} }
    const res = await call({ code: matlab(120) })
    expect(res.status).toBe(200)
    expect((await res.json()).truncated).toBe(true)
  })
})

describe('everything else is unchanged', () => {
  it('a file within the limit converts in full and uses the free conversion', async () => {
    const res = await call({ code: matlab(20), email: 'eng@lab.edu' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.truncated).toBeUndefined()
    expect(data.python).toContain('x19')
    expect(markUsed).toHaveBeenCalledOnce()
  })

  it('a used email within the limit is still refused', async () => {
    emailUsed = true
    const res = await call({ code: matlab(20), email: 'eng@lab.edu' })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('free_conversion_used')
  })

  it('anonymous without an email is refused before anything converts', async () => {
    const res = await call({ code: matlab(120) })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('email_required')
  })

  it('above the preview cap the free tier is refused', async () => {
    const res = await call({ code: matlab(PREVIEW_MAX_INPUT_LINES + 1), email: 'eng@lab.edu' })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('exceeds_line_limit')
  })

  it('a paid plan over its own limit is refused, not previewed', async () => {
    mockUserId = 'u_1'
    mockUser = { id: 'u_1', publicMetadata: { plan: 'pro' } }
    const res = await call({ code: matlab(5001) })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('exceeds_line_limit')
  })

  it('upload on the free tier is refused, not previewed', async () => {
    const res = await call({ code: matlab(120), email: 'eng@lab.edu', mode: 'upload' })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('upload_not_allowed')
  })
})
