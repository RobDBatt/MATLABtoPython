import { describe, it, expect, vi, afterEach } from 'vitest'

// Production's STRIPE_PRICE_PRO ended in "\n" (Oct 2026): every checkout 502'd
// on prices.retrieve, and the webhook's exact-match lookup could never have
// resolved the purchased price to a plan.
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('Stripe price IDs from the environment', () => {
  it('are trimmed, so checkout and the webhook use the real ID', async () => {
    vi.stubEnv('STRIPE_PRICE_PRO', 'price_123\n')
    vi.stubEnv('STRIPE_PRICE_TEAM', '  price_456 ')
    const { PLANS, planIdForPriceId } = await import('../plans')
    expect(PLANS.pro.stripePriceId).toBe('price_123')
    expect(PLANS.team.stripePriceId).toBe('price_456')
    expect(planIdForPriceId('price_123')).toBe('pro')
  })

  it('fall back to the built-in IDs when unset or blank', async () => {
    vi.stubEnv('STRIPE_PRICE_PRO', '   ')
    const { PLANS } = await import('../plans')
    expect(PLANS.pro.stripePriceId).toBe('price_1TLHrqRElJyZVpb2X14Ag9oY')
  })
})
