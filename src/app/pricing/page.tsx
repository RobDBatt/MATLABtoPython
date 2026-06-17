'use client'

import { useUser } from '@clerk/nextjs'
import { useState } from 'react'
import { track } from '@vercel/analytics'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Try the converter',
    features: [
      '50 lines per conversion',
      'Compatibility report',
      'Toolbox detection',
      'No account required',
    ],
    limits: ['No file upload', 'No batch conversion'],
    cta: 'Start converting',
    planKey: 'free' as const,
    highlight: false,
  },
  {
    name: 'Migration Pass',
    price: '$49',
    period: 'one-time / 30 days',
    description: 'For one-time migration projects',
    features: [
      '5,000 lines per conversion',
      'File upload (.m files)',
      'Python file download',
      'Compatibility report',
      'Toolbox detection',
      '30 days of full access',
    ],
    limits: [],
    cta: 'Get Migration Pass',
    planKey: 'migration_pass' as const,
    highlight: false,
  },
  {
    name: 'Individual Pro',
    price: '$19.99',
    period: '/month',
    description: 'For researchers with ongoing work',
    features: [
      '5,000 lines per conversion',
      'File upload (.m files)',
      'Python file download',
      'Compatibility report',
      'Toolbox detection',
      'Unlimited conversions',
    ],
    limits: [],
    cta: 'Start Pro',
    planKey: 'pro' as const,
    highlight: true,
  },
  {
    name: 'Team',
    price: '$79',
    period: '/month',
    description: 'For research groups and engineering teams',
    features: [
      '10,000 lines per conversion',
      'Batch folder conversion (.m → .py zip)',
      'Per-file conversion report',
      'File upload (.m files)',
      'Python file download',
      '100,000 lines/month',
      'Compatibility report',
      'Toolbox detection',
    ],
    limits: [],
    cta: 'Start Team',
    planKey: 'team' as const,
    highlight: false,
  },
]

const PRICE_IDS: Record<string, string> = {
  migration_pass: process.env.NEXT_PUBLIC_STRIPE_PRICE_MIGRATION_PASS || 'price_1TLHrpRElJyZVpb2TIQVSzCj',
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || 'price_1TLHrqRElJyZVpb2X14Ag9oY',
  team: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM || 'price_1TLHrqRElJyZVpb2ULp88N8T',
}

export default function PricingPage() {
  const { isSignedIn } = useUser()
  const [loading, setLoading] = useState<string | null>(null)

  if (typeof window !== 'undefined' && isSignedIn) {
    const pending = window.sessionStorage.getItem('pendingCheckoutPlan')
    if (pending && !loading) {
      window.sessionStorage.removeItem('pendingCheckoutPlan')
      setTimeout(() => handleCheckout(pending), 0)
    }
  }

  async function handleCheckout(planKey: string) {
    track('pricing_plan_click', { plan: planKey, signedIn: !!isSignedIn })

    if (planKey === 'free') {
      window.location.href = '/convert'
      return
    }

    if (!isSignedIn) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('pendingCheckoutPlan', planKey)
      }
      track('pricing_signup_redirect', { plan: planKey })
      window.location.href = `/sign-up?redirect_url=/pricing`
      return
    }

    setLoading(planKey)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: PRICE_IDS[planKey] }),
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        if (res.status === 401 || res.status === 403 || res.redirected) {
          window.location.href = `/sign-in?redirect_url=/pricing`
          return
        }
        alert('Unexpected response from server. Please try again.')
        return
      }

      const data = await res.json()
      if (data.url) {
        track('checkout_session_started', { plan: planKey })
        window.location.href = data.url
      } else if (data.error === 'Unauthorized') {
        window.location.href = `/sign-in?redirect_url=/pricing`
      } else {
        alert(data.error || 'Checkout failed')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Connection error — please check your internet and try again')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12">
        <h1 className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#f0f0f8] mb-3">
          Simple, honest pricing
        </h1>
        <p className="text-[#9ba3c4] max-w-lg text-sm leading-relaxed">
          Free for small conversions. Pay only when you need more lines
          or file upload. No surprise fees. MATLAB seats cost $2,190+/year —
          a $49 migration pass pays for itself in minutes.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col p-6 rounded-lg border transition-colors ${
              tier.highlight
                ? 'border-[#7c3aed] bg-[#0e1228]'
                : 'border-[#1e2547] bg-[#0e1228] hover:border-[#2d3561]'
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-5 px-3 py-0.5 bg-[#7c3aed] text-white text-xs font-medium rounded-full">
                Recommended
              </div>
            )}

            <div className="mb-4">
              <h2 className="text-[#f0f0f8] font-semibold text-base">{tier.name}</h2>
              <p className="text-[#4d5580] text-xs mt-1">{tier.description}</p>
            </div>

            <div className="mb-6">
              <span className="font-[family-name:var(--font-syne)] text-3xl font-bold text-[#f0f0f8]">
                {tier.price}
              </span>
              {tier.period && (
                <span className="text-[#4d5580] text-xs ml-1">{tier.period}</span>
              )}
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-[#9ba3c4]">
                  <span className="text-[#10b981] mt-0.5 shrink-0">+</span>
                  {f}
                </li>
              ))}
              {tier.limits.map((l) => (
                <li key={l} className="flex items-start gap-2 text-xs text-[#4d5580]">
                  <span className="mt-0.5 shrink-0">–</span>
                  {l}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(tier.planKey)}
              disabled={loading === tier.planKey}
              className={`block w-full text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tier.highlight
                  ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9]'
                  : 'border border-[#2d3561] text-[#9ba3c4] hover:border-[#7c3aed]/50 hover:text-[#f0f0f8]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading === tier.planKey ? 'Loading...' : tier.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-20 max-w-2xl">
        <h2 className="font-[family-name:var(--font-syne)] text-xl font-semibold text-[#f0f0f8] mb-8">
          Common questions
        </h2>
        <div className="space-y-6 text-sm">
          {[
            {
              q: 'How are lines counted?',
              a: 'Only non-empty lines of MATLAB code are counted. Comments count as lines. Blank lines don\'t. A typical MATLAB function is 50–200 lines.',
            },
            {
              q: 'What happens when I hit the line limit?',
              a: 'The converter tells you exactly how many lines your code has and which plan covers it. You can upgrade instantly without losing your work.',
            },
            {
              q: 'Is my code sent to an AI service?',
              a: 'No. The converter is 100% deterministic and rule-based. Your code is processed entirely on our server and never sent to any third-party AI API. Same input, same output, every time.',
            },
            {
              q: 'What\'s the difference between Migration Pass and Pro?',
              a: 'Migration Pass is a one-time 30-day purchase for engineers doing a single migration project. Pro is a monthly subscription for researchers who regularly convert MATLAB scripts.',
            },
            {
              q: 'Which toolboxes are supported?',
              a: 'Signal Processing (scipy.signal), Statistics (scipy.stats), Image Processing (scikit-image), Optimization (scipy.optimize), Control Systems (python-control), Symbolic Math (SymPy), Wavelets (PyWavelets), and Curve Fitting (scipy.interpolate).',
            },
          ].map(({ q, a }) => (
            <div key={q} className="border-l border-[#1e2547] pl-4">
              <h3 className="text-[#f0f0f8] font-medium mb-1.5">{q}</h3>
              <p className="text-[#9ba3c4] leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
