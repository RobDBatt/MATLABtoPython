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
      <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm flex-wrap">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={state === 'submitting' || state === 'success'}
          className="px-3 py-1.5 border border-[#3a3f4d] rounded bg-[#15171d] text-[#eef0f4] placeholder:text-[#5a5f6b] w-44 focus:outline-none focus:ring-1 focus:ring-[#d9662b]"
        />
        <button
          type="submit"
          disabled={state === 'submitting' || state === 'success'}
          className="px-3 py-1.5 bg-[#d9662b] text-white rounded hover:bg-[#b8541f] disabled:opacity-40 shrink-0 transition-colors text-sm"
        >
          {state === 'submitting' ? '…' : state === 'success' ? '✓' : cta}
        </button>
        {msg && (
          <span className={`text-xs ${state === 'success' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {msg}
          </span>
        )}
      </form>
    )
  }

  // card variant
  return (
    <div className="rounded-lg border border-[#2a2e3a] bg-[#1b1e26] p-6">
      <h3 className="font-[family-name:var(--font-syne)] text-lg font-semibold text-[#eef0f4] mb-1">
        {headline}
      </h3>
      <p className="text-sm text-[#9aa1ac] mb-4 leading-relaxed">{sub}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={state === 'submitting' || state === 'success'}
          className="flex-1 min-w-0 px-4 py-2 border border-[#3a3f4d] bg-[#15171d] rounded text-[#eef0f4] placeholder:text-[#5a5f6b] focus:outline-none focus:ring-1 focus:ring-[#d9662b]"
        />
        <button
          type="submit"
          disabled={state === 'submitting' || state === 'success'}
          className="px-5 py-2 bg-[#d9662b] text-white rounded hover:bg-[#b8541f] disabled:opacity-40 font-medium transition-colors"
        >
          {state === 'submitting' ? 'Saving…' : state === 'success' ? 'Done ✓' : cta}
        </button>
      </form>
      {msg && (
        <p className={`mt-3 text-sm ${state === 'success' ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
          {msg}
        </p>
      )}
    </div>
  )
}
