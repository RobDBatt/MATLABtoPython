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

/** How the code reached us. `upload`/`batch` are gated on paid plans. */
export type ConversionMode = 'paste' | 'upload' | 'batch'

type ClerkUser = Awaited<ReturnType<typeof currentUser>>

/**
 * Resolve a plan from an already-fetched user. Synchronous so callers can
 * fetch the user once and reuse it — `currentUser()` is a network call.
 */
function planForUser(user: ClerkUser) {
  if (!user) return PLANS.free

  const meta = user.publicMetadata as UserMetadata
  const planId = meta?.plan || 'free'

  // A migration pass is a one-time 30-day purchase, so it must be re-checked
  // on every conversion — nothing else expires it.
  if (planId === 'migration_pass' && meta.migrationPassExpiresAt) {
    if (new Date(meta.migrationPassExpiresAt) < new Date()) {
      return PLANS.free
    }
  }

  // Guard the lookup: a stale or hand-edited metadata value would otherwise
  // return undefined and throw at the call site.
  return PLANS[planId] ?? PLANS.free
}

export async function getUserPlan() {
  return planForUser(await currentUser())
}

export type ConversionVerdict =
  | { allowed: true; reason: null; limit: number }
  | {
      allowed: false
      reason: 'exceeds_line_limit' | 'monthly_limit_reached' | 'upload_not_allowed' | 'batch_not_allowed'
      limit: number
    }

/**
 * The single entitlement gate for conversions. Route handlers must call this
 * rather than re-implementing plan checks inline — two gates means one of them
 * drifts, and the drifting one is usually the one enforcing expiry.
 */
export async function checkConversionAllowed(
  lineCount: number,
  mode: ConversionMode = 'paste',
): Promise<ConversionVerdict> {
  const user = await currentUser()
  const plan = planForUser(user)

  if (mode === 'upload' && !plan.fileUpload) {
    return { allowed: false, reason: 'upload_not_allowed', limit: plan.linesPerConversion }
  }

  if (mode === 'batch' && !plan.batchUpload) {
    return { allowed: false, reason: 'batch_not_allowed', limit: plan.linesPerConversion }
  }

  if (lineCount > plan.linesPerConversion) {
    return { allowed: false, reason: 'exceeds_line_limit', limit: plan.linesPerConversion }
  }

  if (plan.linesPerMonth !== Infinity) {
    const meta = user?.publicMetadata as UserMetadata | undefined
    const used = isCurrentPeriod(meta?.linesResetDate) ? meta?.linesUsedThisMonth || 0 : 0
    if (used + lineCount > plan.linesPerMonth) {
      return { allowed: false, reason: 'monthly_limit_reached', limit: plan.linesPerMonth }
    }
  }

  return { allowed: true, reason: null, limit: plan.linesPerConversion }
}

/** Whether a stored reset date falls in the current calendar month. */
function isCurrentPeriod(resetDate: string | undefined): boolean {
  if (!resetDate) return false
  const d = new Date(resetDate)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}

/**
 * Add a successful conversion to the user's monthly total.
 *
 * Without this the counter is only ever written as 0, which makes every
 * `linesPerMonth` cap unenforceable. Only plans with a finite monthly cap are
 * tracked, so this costs a Clerk write on Team conversions and nothing else.
 *
 * Call from `after()` — it must never add latency to the conversion itself.
 */
export async function recordLinesUsed(lineCount: number): Promise<void> {
  const user = await currentUser()
  if (!user) return

  const meta = (user.publicMetadata || {}) as UserMetadata
  const plan = planForUser(user)
  if (plan.linesPerMonth === Infinity) return

  const inPeriod = isCurrentPeriod(meta.linesResetDate)
  const used = inPeriod ? meta.linesUsedThisMonth || 0 : 0

  const { clerkClient } = await import('@clerk/nextjs/server')
  const client = await clerkClient()

  // Spread the existing metadata rather than writing only the two changed
  // fields — this stays correct whether updateUserMetadata merges or replaces.
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: {
      ...meta,
      linesUsedThisMonth: used + lineCount,
      linesResetDate: inPeriod ? meta.linesResetDate : new Date().toISOString(),
    },
  })
}
