import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { PLANS, type PlanId } from '@/lib/plans'

export async function GET() {
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
