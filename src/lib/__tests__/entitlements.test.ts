import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockUser: unknown = null
vi.mock('@clerk/nextjs/server', () => ({
  currentUser: async () => mockUser,
  clerkClient: async () => ({ users: { updateUserMetadata: async () => {} } }),
}))

const { checkConversionAllowed, getUserPlan } = await import('../entitlements')

const userWith = (meta: Record<string, unknown>) => ({ id: 'u_1', publicMetadata: meta })

beforeEach(() => { mockUser = null })

describe('entitlement gate', () => {
  it('anonymous users get the 50-line free limit', async () => {
    expect((await checkConversionAllowed(51)).allowed).toBe(false)
    expect((await checkConversionAllowed(50)).allowed).toBe(true)
  })

  it('team gets 10k lines and batch; pro does not', async () => {
    mockUser = userWith({ plan: 'team' })
    expect((await checkConversionAllowed(10000, 'batch')).allowed).toBe(true)
    mockUser = userWith({ plan: 'pro' })
    const v = await checkConversionAllowed(100, 'batch')
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe('batch_not_allowed')
  })

  it('EXPIRED migration pass falls back to free (was unenforced on the live path)', async () => {
    mockUser = userWith({ plan: 'migration_pass', migrationPassExpiresAt: '2020-01-01T00:00:00Z' })
    const v = await checkConversionAllowed(5000)
    expect(v.allowed).toBe(false)
    expect(v.limit).toBe(50)
  })

  it('unexpired migration pass still works', async () => {
    mockUser = userWith({ plan: 'migration_pass', migrationPassExpiresAt: '2099-01-01T00:00:00Z' })
    expect((await checkConversionAllowed(5000)).allowed).toBe(true)
  })

  it('team monthly cap is enforced once the counter is populated', async () => {
    mockUser = userWith({ plan: 'team', linesUsedThisMonth: 99_999, linesResetDate: new Date().toISOString() })
    const v = await checkConversionAllowed(10)
    expect(v.allowed).toBe(false)
    expect(v.reason).toBe('monthly_limit_reached')
  })

  it('a stale counter from a previous month does not carry over', async () => {
    mockUser = userWith({ plan: 'team', linesUsedThisMonth: 99_999, linesResetDate: '2020-01-01T00:00:00Z' })
    expect((await checkConversionAllowed(10)).allowed).toBe(true)
  })

  it('an unknown plan value degrades to free, not undefined', async () => {
    mockUser = userWith({ plan: 'enterprise_lol' })
    expect(await getUserPlan()).toEqual(expect.objectContaining({ name: 'Free' }))
  })
})
