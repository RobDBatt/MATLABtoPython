import { NextResponse } from 'next/server'
import { PLANS, type PlanId } from '@/lib/plans'

export async function GET() {
  const hasClerk = !!process.env.CLERK_SECRET_KEY?.startsWith('sk_')

  if (!hasClerk) {
    return NextResponse.json({ plan: PLANS.free, user: null })
  }

  const { currentUser } = await import('@clerk/nextjs/server')
  const user = await currentUser()

  if (!user) {
    return NextResponse.json({ plan: PLANS.free, user: null })
  }

  const meta = user.publicMetadata as { plan?: PlanId }
  const planId = meta?.plan || 'free'
  const plan = PLANS[planId]

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
    },
    plan,
    planId,
  })
}
