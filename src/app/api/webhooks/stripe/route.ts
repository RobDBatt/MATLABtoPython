import { NextResponse } from 'next/server'
import Stripe from 'stripe'

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
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            linesUsedThisMonth: 0,
          },
        })
      } else {
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
  }

  return NextResponse.json({ received: true })
}
