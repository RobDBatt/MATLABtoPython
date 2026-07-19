import { PLANS } from './plans'

/**
 * Whether a plan key stamped into Stripe metadata is one this site sells.
 *
 * Stripe delivers every event on an account to every endpoint registered on
 * it, and signs each delivery with the *destination* endpoint's secret — so a
 * sibling product's checkout passes our signature check and then fails on a
 * user id that was never ours. Checkout stamps `planId`, so its absence (or an
 * unknown value) identifies an event that does not belong to this site.
 *
 * Uses hasOwnProperty rather than `in`: `'constructor' in PLANS` is true.
 */
export function isOwnPlan(planId: string | undefined): planId is string {
  return !!planId && Object.prototype.hasOwnProperty.call(PLANS, planId)
}

/** A Clerk 404 is permanent — no number of Stripe retries will conjure the user. */
export function isClerkUserNotFound(err: unknown): boolean {
  const e = err as { status?: number; errors?: Array<{ code?: string }> } | null
  return (
    e?.status === 404 &&
    Array.isArray(e?.errors) &&
    e.errors.some((x) => x?.code === 'resource_not_found')
  )
}

/**
 * Run a Clerk write, tolerating a user that does not exist in this instance.
 *
 * Such an event can never succeed, so it is acknowledged (200) instead of
 * throwing — a 500 makes Stripe retry, and repeated failures get the endpoint
 * disabled, which would silently break real purchases. Every other failure is
 * rethrown so Stripe *does* retry, since those are usually transient.
 */
export async function tolerateMissingUser(
  op: () => Promise<unknown>,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    await op()
  } catch (err) {
    if (isClerkUserNotFound(err)) {
      console.error(
        '[stripe-webhook] No such user in this Clerk instance — acknowledging without granting',
        context,
      )
      return
    }
    throw err
  }
}
