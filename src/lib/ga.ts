import { PLANS, type PlanId } from './plans'

/**
 * Google Analytics events. GA used to receive page views only — every
 * custom event here goes to Vercel Analytics — so it had nothing to count as
 * a conversion. `purchase` is a GA4 key event by default; `begin_checkout`
 * can be starred in Admin → Events.
 */
export function gaEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
  if (w.gtag) {
    w.gtag('event', name, params)
    return
  }
  // gtag.js loads after hydration; queue the call the way its own stub does.
  // The queue only accepts an Arguments object, not an array.
  w.dataLayer = w.dataLayer || []
  const queue = w.dataLayer
  const push = function () {
    // eslint-disable-next-line prefer-rest-params
    queue.push(arguments)
  } as (...args: unknown[]) => void
  push('event', name, params)
}

/** The plan's price, for the `value` GA reports revenue from. */
export function gaPlanValue(planId: string | null): { currency: 'USD'; value: number } | Record<string, never> {
  const plan = planId && Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId as PlanId] : null
  return plan && 'priceUsd' in plan ? { currency: 'USD', value: plan.priceUsd } : {}
}
