import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { PLANS, planIdForPriceId } from '@/lib/plans'

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only process Clerk metadata updates when Clerk is configured
  const hasClerk = !!process.env.CLERK_SECRET_KEY?.startsWith('sk_')

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId || !hasClerk) break

      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await clerkClient()

      if (session.mode === 'payment') {
        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            plan: 'migration_pass',
            stripeCustomerId: session.customer,
            migrationPassExpiresAt: new Date(
              Date.now() + PLANS.migration_pass.durationDays * 24 * 60 * 60 * 1000,
            ).toISOString(),
            linesUsedThisMonth: 0,
          },
        })
      } else {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        )
        const priceId = sub.items.data[0].price.id
        const plan = planIdForPriceId(priceId)

        // An unrecognised price must not grant anything. The previous
        // `includes('team') ? 'team' : 'pro'` fell through to 'pro' for every
        // price, which both downgraded Team buyers and handed Pro to anyone
        // who checked out with an arbitrary price ID.
        if (!plan) {
          console.error('[stripe-webhook] Unrecognised priceId, no plan granted', {
            priceId,
            userId,
            subscriptionId: session.subscription,
          })
          break
        }

        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            plan,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            linesUsedThisMonth: 0,
            linesResetDate: new Date().toISOString(),
          },
        })
      }
      break
    }

    // Revoke access when a subscription ends. Without these, a cancelled
    // customer kept their paid plan in Clerk forever.
    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription

      // 'past_due' is deliberately excluded — Stripe is still retrying payment
      // and the customer has not actually lost the subscription yet.
      const revoked =
        event.type === 'customer.subscription.deleted' ||
        sub.status === 'canceled' ||
        sub.status === 'unpaid'

      if (!revoked || !hasClerk) break

      // Set on the subscription at checkout. Subscriptions created before that
      // change carry no userId and cannot be resolved here — they need the
      // one-off reconciliation against Stripe.
      const userId = sub.metadata?.userId
      if (!userId) {
        console.error('[stripe-webhook] Cannot revoke: subscription has no userId metadata', {
          subscriptionId: sub.id,
          customerId: sub.customer,
          status: sub.status,
        })
        break
      }

      const { clerkClient } = await import('@clerk/nextjs/server')
      const client = await clerkClient()

      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          plan: 'free',
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: null,
          linesUsedThisMonth: 0,
        },
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
