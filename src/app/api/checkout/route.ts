import { NextResponse } from 'next/server'

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

  const { priceId } = await req.json()
  if (!priceId) {
    return NextResponse.json({ error: 'Missing priceId' }, { status: 400 })
  }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const isOneTime = priceId.includes('migration')

  const session = await stripe.checkout.sessions.create({
    mode: isOneTime ? 'payment' : 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/convert?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/pricing`,
    metadata: userId ? { userId } : {},
  })

  return NextResponse.json({ url: session.url })
}
