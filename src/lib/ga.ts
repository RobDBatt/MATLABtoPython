import { PLANS, type PlanId } from './plans'

/**
 * Google Analytics events. GA used to receive page views only — every
 * custom event here goes to Vercel Analytics — so it had nothing to count as
 * a conversion. `purchase` is a GA4 key event by default; `begin_checkout`
 * can be starred in Admin → Events.
 */
export function gaEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  sendWhenReady(name, params, 50)
}

/**
 * gtag is defined by an afterInteractive script, which can run after a
 * component's mount effect — the purchase on Stripe's redirect fires on
 * mount. An event queued before gtag's `config` may never be sent, so wait
 * for gtag (polling up to 10s) rather than pushing onto dataLayer early. If
 * GA never loads (blocked), the event is dropped.
 */
function sendWhenReady(name: string, params: Record<string, unknown>, triesLeft: number): void {
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag
  if (gtag) {
    gtag('event', name, params)
    return
  }
  if (triesLeft > 0) setTimeout(() => sendWhenReady(name, params, triesLeft - 1), 200)
}

/** The plan's price, for the `value` GA reports revenue from. */
export function gaPlanValue(planId: string | null): { currency: 'USD'; value: number } | Record<string, never> {
  const plan = planId && Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId as PlanId] : null
  return plan && 'priceUsd' in plan ? { currency: 'USD', value: plan.priceUsd } : {}
}
