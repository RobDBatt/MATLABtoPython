export const PLANS = {
  free: {
    name: 'Free',
    linesPerConversion: 50,
    linesPerMonth: Infinity,
    fileUpload: false,
    batchUpload: false,
  },
  migration_pass: {
    name: 'Migration Pass',
    linesPerConversion: 5000,
    linesPerMonth: Infinity,
    fileUpload: true,
    batchUpload: false,
    stripePriceId: process.env.STRIPE_PRICE_MIGRATION_PASS || 'price_1Tv0FYRElJyZVpb2R4sSXFa2',
    durationDays: 30,
  },
  pro: {
    name: 'Individual Pro',
    linesPerConversion: 5000,
    linesPerMonth: Infinity,
    fileUpload: true,
    batchUpload: false,
    stripePriceId: process.env.STRIPE_PRICE_PRO || 'price_1TLHrqRElJyZVpb2X14Ag9oY',
  },
  team: {
    name: 'Team',
    linesPerConversion: 10000,
    linesPerMonth: 100000,
    fileUpload: true,
    batchUpload: true,
    stripePriceId: process.env.STRIPE_PRICE_TEAM || 'price_1TLHrqRElJyZVpb2ULp88N8T',
  },
} as const

export type PlanId = keyof typeof PLANS

/**
 * Resolve a Stripe price ID to the plan it grants.
 *
 * Stripe price IDs are opaque (`price_1TLHrq…`), so they can never be matched
 * by substring — an earlier `priceId.includes('team')` check silently resolved
 * every Team subscriber to 'pro'. Always match the configured ID exactly.
 *
 * Returns null for an unrecognised price. Callers MUST treat null as "grant
 * nothing" rather than falling back to a paid plan.
 */
export function planIdForPriceId(priceId: string): PlanId | null {
  for (const [id, plan] of Object.entries(PLANS)) {
    if ('stripePriceId' in plan && plan.stripePriceId === priceId) {
      return id as PlanId
    }
  }
  return null
}
