import { NextResponse } from 'next/server'
import { PLANS, type PlanId } from '@/lib/plans'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  }

  const hasClerk = !!process.env.CLERK_SECRET_KEY?.startsWith('sk_')
  let userId: string | null = null

  if (hasClerk) {
    const { auth } = await import('@clerk/nextjs/server')
    const session = await auth()
    userId = session.userId
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // The client sends a plan key, never a price ID. The price is resolved here
  // from PLANS, so a client can neither drift from the server's price config
  // nor name an arbitrary Stripe price to buy a paid tier with.
  const { planKey } = await req.json()
  if (!planKey || typeof planKey !== 'string') {
    return NextResponse.json({ error: 'Missing planKey' }, { status: 400 })
  }

  // Absolute base URL for Stripe's success/cancel redirects. Stripe rejects a
  // relative URL, so a missing NEXT_PUBLIC_APP_URL must not fall through to ''.
  // Fall back to the request's own origin (correct for a same-origin POST from
  // the pricing page), and only then error — never hand Stripe a bad URL.
  //
  // .trim() is load-bearing, not tidiness: the sibling site carried a trailing
  // space in this exact variable for months, which made success_url
  // "https://host /path" and had Stripe reject every checkout with
  // `url_invalid`. A prefix-only test passes such a value, so the guard below
  // also requires the whole string to be whitespace-free.
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || '')
    .trim()
    .replace(/\/+$/, '')
  if (!/^https?:\/\/\S+$/.test(baseUrl)) {
    console.error('[checkout] No absolute base URL available', {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
      origin: req.headers.get('origin'),
    })
    return NextResponse.json(
      { error: 'checkout_failed', message: 'Checkout is temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    )
  }

  const plan = PLANS[planKey as PlanId]
  if (!plan || !('stripePriceId' in plan)) {
    return NextResponse.json(
      { error: 'Unknown or non-purchasable plan' },
      { status: 400 },
    )
  }

  const planId = planKey as PlanId
  const priceId = plan.stripePriceId

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // Every plan is a subscription. Verify the configured price agrees rather
  // than assuming: Stripe rejects a checkout whose mode disagrees with the
  // price, and a one-time price wired to a monthly plan would charge the
  // customer once for something sold as recurring. Refuse loudly instead.
  // (A price cannot be converted between one-time and recurring — create a new
  // one and archive the old.)
  try {
    const price = await stripe.prices.retrieve(priceId)
    if (!price.recurring) {
      console.error('[checkout] MISCONFIGURED: price is one-time but the plan is sold as a subscription', {
        planId,
        priceId,
      })
      return NextResponse.json(
        {
          error: 'plan_misconfigured',
          message: 'This plan is temporarily unavailable. Please contact support.',
        },
        { status: 503 },
      )
    }
  } catch (err) {
    console.error('[checkout] Could not retrieve price', {
      planId,
      priceId,
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'checkout_failed' }, { status: 502 })
  }

  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/convert?upgraded=true`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: userId ? { userId, planId } : { planId },
      // Stamp the subscription itself too. `customer.subscription.*` events
      // carry no session metadata, so without this the webhook cannot tell
      // which Clerk user a cancellation belongs to.
      ...(userId ? { subscription_data: { metadata: { userId, planId } } } : {}),
    })
  } catch (err) {
    console.error('[checkout] Stripe session create failed', {
      planId,
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'checkout_failed', message: 'Could not start checkout. Please try again.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ url: session.url })
}
