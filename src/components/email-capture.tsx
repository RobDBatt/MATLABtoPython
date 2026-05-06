'use client'

import { useState, useCallback } from 'react'
import { track } from '@vercel/analytics'

interface Props {
  source: string
  variant?: 'inline' | 'card' | 'footer'
  headline?: string
  sub?: string
  cta?: string
}

/**
 * Reusable email capture component. `source` identifies where the form
 * was placed so conversion per-placement can be measured later.
 *
 * Variants tune the visual weight:
 *   - inline: single-line form, for footer-like spots
 *   - card: boxed with headline + sub, for CTA sections
 *   - footer: minimal, monospace, for the site footer
 */
export function EmailCapture({
  source,
  variant = 'card',
  headline = 'MATLAB-to-Python tips, once a week',
  sub = 'New toolbox mappings, migration gotchas, and release notes from the converter. No spam, unsubscribe any time.',
  cta = 'Subscribe',
}: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!email.trim() || state === 'submitting') return
      setState('submitting')
      setMsg(null)
      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), source }),
        })
        const data = await res.json()
        if (res.ok && data.ok) {
          setState('success')
          setMsg(data.duplicate ? "You're already subscribed. Thanks!" : "Thanks — you're on the list.")
          track('email_subscribe', { source, duplicate: !!data.duplicate })
          setEmail('')
        } else {
          setState('error')
          setMsg(
            data.error === 'invalid_email'
              ? 'That email address looks off — double-check and try again.'
              : 'Something went wrong saving your email. Try again in a minute.',
          )
        }
      } catch {
        setState('error')
        setMsg('Network issue — please try again.')
      }
    },
    [email, source, state],
  )

  if (variant === 'inline' || variant === 'footer') {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={state === 'submitting' || state === 'success'}
          className={`px-3 py-1.5 border rounded ${
            variant === 'footer'
              ? 'bg-transparent border-slate-300 text-slate-700 placeholder:text-slate-400 w-48'
              : 'border-gray-300 bg-white text-slate-900 placeholder:text-slate-400 flex-1 min-w-0'
          } focus:outline-none focus:ring-2 focus:ring-purple-400`}
        />
        <button
          type="submit"
          disabled={state === 'submitting' || state === 'success'}
          className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-40 shrink-0"
        >
          {state === 'submitting' ? '…' : state === 'success' ? '✓' : cta}
        </button>
        {msg && (
          <span
            className={`text-xs ${
              state === 'success' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {msg}
          </span>
        )}
      </form>
    )
  }

  // card variant
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
      <h3 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-slate-900 mb-1">
        {headline}
      </h3>
      <p className="text-sm text-slate-600 mb-4">{sub}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={state === 'submitting' || state === 'success'}
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 bg-white rounded text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          type="submit"
          disabled={state === 'submitting' || state === 'success'}
          className="px-5 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-40 font-medium"
        >
          {state === 'submitting' ? 'Saving…' : state === 'success' ? 'Done' : cta}
        </button>
      </form>
      {msg && (
        <p
          className={`mt-3 text-sm ${
            state === 'success' ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  )
}
