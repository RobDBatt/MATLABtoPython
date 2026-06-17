'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { getConsent, setConsent } from '@/lib/telemetry/client'

/**
 * Telemetry consent switch (mirrors VBAtoPython). Sits near the Convert button.
 * Defaults: unsigned-in ON (free tier, anonymous signal), signed-in OFF
 * (paying — don't presume). Persisted in localStorage by the client lib; this
 * component just renders + flips the state.
 *
 * Renders nothing until mounted (consent lives in localStorage — avoids a
 * hydration mismatch). No source code or identity is involved.
 */
export function ConsentToggle({ className = '' }: { className?: string }) {
  const { isSignedIn, isLoaded } = useUser()
  const [mounted, setMounted] = useState(false)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    setMounted(true)
    setOn(getConsent(!!isSignedIn))
  }, [isLoaded, isSignedIn])

  if (!mounted) return null

  const toggle = () => {
    const next = !on
    setOn(next)
    setConsent(next)
  }

  return (
    <div className={`flex items-center gap-2 text-[11px] text-[#4d5580] ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[#7c3aed]' : 'bg-[#2d3561]'}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </button>
      <span className="leading-snug">
        Help improve coverage by sharing which MATLAB functions and toolboxes your code uses. No source code is stored.{' '}
        <Link href="/privacy/telemetry" className="underline underline-offset-2 hover:text-[#9ba3c4]">
          Learn more
        </Link>
      </span>
    </div>
  )
}
