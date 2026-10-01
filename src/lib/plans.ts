/**
 * A Stripe price ID from the environment, trimmed. Production's
 * STRIPE_PRICE_PRO carried a trailing newline (Oct 2026), so every
 * prices.retrieve went to `/v1/prices/price_…%0A` and failed — /api/checkout
 * answered 502 for every buyer — and the webhook could never have matched a
 * purchased price to a plan either. Same class of bug as the trailing space in
 * NEXT_PUBLIC_APP_URL noted in /api/checkout.
 */
function priceId(fromEnv: string | undefined, fallback: string): string {
  return (fromEnv?.trim() || fallback)
}

export const PLANS = {
  free: {
    name: 'Free',
    linesPerConversion: 50,
    linesPerMonth: Infinity,
    fileUpload: false,
    batchUpload: false,
  },
  pro: {
    name: 'Individual Pro',
    linesPerConversion: 5000,
    linesPerMonth: Infinity,
    fileUpload: true,
    batchUpload: false,
    priceUsd: 19.99, // monthly; must match the price on /pricing and in Stripe
    stripePriceId: priceId(process.env.STRIPE_PRICE_PRO, 'price_1TLHrqRElJyZVpb2X14Ag9oY'),
  },
  team: {
    name: 'Team',
    linesPerConversion: 10000,
    linesPerMonth: 100000,
    fileUpload: true,
    batchUpload: true,
    priceUsd: 79, // monthly; must match the price on /pricing and in Stripe
    stripePriceId: priceId(process.env.STRIPE_PRICE_TEAM, 'price_1TLHrqRElJyZVpb2ULp88N8T'),
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
