import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { priceId } = await req.json()
  if (!priceId) {
    return NextResponse.json({ error: 'Missing priceId' }, { status: 400 })
  }

  const isOneTime = priceId.includes('migration')

  const session = await stripe.checkout.sessions.create({
    mode: isOneTime ? 'payment' : 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/convert?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId },
  })

  return NextResponse.json({ url: session.url })
}
