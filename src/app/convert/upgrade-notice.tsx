'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'

/**
 * Stripe sends every buyer back to /convert?upgraded=true. Nothing used to
 * acknowledge the payment. A guest buyer also needs to be told how to get to
 * the plan: it sits on the account for the email they gave Stripe, and they
 * reach it by signing in with that address (Clerk emails a code).
 */
export function UpgradeNotice() {
  const params = useSearchParams()
  const { isLoaded, isSignedIn } = useUser()
  if (params.get('upgraded') !== 'true' || !isLoaded) return null

  if (isSignedIn) {
    return (
      <div className="mb-6 rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 px-4 py-3 text-sm text-[#eef0f4]">
        Payment received. Your plan is on this account.
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#10b981]/40 bg-[#10b981]/10 px-4 py-3 text-sm text-[#eef0f4]">
      <p>
        Payment received. Sign in with the email you gave at checkout. We send a
        code to it, and your plan is on that account.
      </p>
      <Link
        href="/sign-in?redirect_url=/convert"
        className="shrink-0 px-4 py-2 rounded-lg bg-[#d9662b] text-white text-sm font-medium hover:bg-[#b8541f] transition-colors"
      >
        Sign in →
      </Link>
    </div>
  )
}
