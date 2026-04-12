import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
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
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const client = await clerkClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (!userId) break

      if (session.mode === 'payment') {
        // Migration Pass — one-time, 30 days
        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            plan: 'migration_pass',
            stripeCustomerId: session.customer,
            migrationPassExpiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            linesUsedThisMonth: 0,
          },
        })
      } else {
        // Subscription (Pro or Team)
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        )
        const priceId = sub.items.data[0].price.id
        const plan = priceId.includes('team') ? 'team' : 'pro'

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

    case 'customer.subscription.deleted': {
      // Downgrade to free when subscription ends
      // Would need to look up userId by stripeCustomerId
      break
    }

    case 'invoice.paid': {
      // Reset monthly line counter on subscription renewal
      break
    }
  }

  return NextResponse.json({ received: true })
}
