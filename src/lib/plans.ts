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
    stripePriceId: process.env.STRIPE_PRICE_MIGRATION_PASS || 'price_1TLHrpRElJyZVpb2TIQVSzCj',
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
