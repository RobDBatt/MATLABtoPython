import { currentUser } from '@clerk/nextjs/server'
import { PLANS, type PlanId } from './plans'

interface UserMetadata {
  plan?: PlanId
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  migrationPassExpiresAt?: string
  linesUsedThisMonth?: number
  linesResetDate?: string
}

export async function getUserPlan() {
  const user = await currentUser()
  if (!user) return PLANS.free

  const meta = user.publicMetadata as UserMetadata
  const planId = meta?.plan || 'free'

  // Check migration pass expiry
  if (planId === 'migration_pass' && meta.migrationPassExpiresAt) {
    if (new Date(meta.migrationPassExpiresAt) < new Date()) {
      return PLANS.free
    }
  }

  return PLANS[planId]
}

export async function checkConversionAllowed(lineCount: number) {
  const plan = await getUserPlan()

  if (lineCount > plan.linesPerConversion) {
    return {
      allowed: false,
      reason: 'exceeds_line_limit' as const,
      limit: plan.linesPerConversion,
    }
  }

  if (plan.linesPerMonth !== Infinity) {
    const user = await currentUser()
    const meta = user?.publicMetadata as UserMetadata
    const used = meta?.linesUsedThisMonth || 0
    if (used + lineCount > plan.linesPerMonth) {
      return {
        allowed: false,
        reason: 'monthly_limit_reached' as const,
        limit: plan.linesPerMonth,
      }
    }
  }

  return { allowed: true, reason: null, limit: plan.linesPerConversion }
}
