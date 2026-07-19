'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { track } from '@vercel/analytics'
import type { ConversionResult } from '@/lib/converter'
import { BatchWidget } from './batch-widget'
import { ConsentToggle } from '@/components/ConsentToggle'
import { EmailCapture } from '@/components/email-capture'
import { telemetryFields } from '@/lib/telemetry/client'
import { CONSENT_VERSION } from '@/lib/telemetry/types'

const FREE_LINE_LIMIT = 50
const EMAIL_STORAGE_KEY = 'mtp_convert_email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  exampleCode: string
}

export function ConverterWidget({ exampleCode }: Props) {
  const { isSignedIn, user } = useUser()
  const plan = (user?.publicMetadata as Record<string, unknown>)?.plan as string | undefined
  const hasPaidPlan = plan === 'pro' || plan === 'team'

  const [mode, setMode] = useState<'paste' | 'upload' | 'batch'>('paste')
  const [input, setInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Anonymous free-tier conversions require an email. Remembered locally so
  // returning visitors on the same browser don't have to retype it.
  const [email, setEmail] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(EMAIL_STORAGE_KEY)
    if (saved) setEmail(saved)
  }, [])
  const emailValid = EMAIL_RE.test(email.trim())

  const lineCount = input.split('\n').filter(l => l.trim() !== '').length

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return
    if (!isSignedIn && !emailValid) {
      setError('Enter a valid email to convert on the free tier.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    const lines = input.split('\n').length

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: input,
          mode,
          ...(!isSignedIn ? { email: email.trim() } : {}),
          ...telemetryFields(!!isSignedIn),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || data.error || 'Conversion failed')
        track('conversion_failed', { lines, reason: data.error || 'unknown' })
        return
      }

      if (!isSignedIn && typeof window !== 'undefined') {
        window.localStorage.setItem(EMAIL_STORAGE_KEY, email.trim())
      }

      setResult(data)
      track('conversion_succeeded', {
        lines,
        mode,
        flagCount: data.report?.flags?.length || 0,
        conversionRate: data.report?.conversionRate || 0,
      })
    } catch {
      setError('Network error — please try again')
      track('conversion_failed', { lines, reason: 'network' })
      // Network failures never reach the server-side telemetry mirror — post
      // the failure to the standalone sink so Supabase sees them too.
      // Consent-gated; vocabulary-only payload; failures here are swallowed.
      const tf = telemetryFields(!!isSignedIn)
      if (tf.telemetry_consent) {
        const lines_bucket =
          lines <= 100 ? '1-100' : lines <= 500 ? '101-500' : lines <= 2000 ? '501-2000' : lines <= 5000 ? '2001-5000' : '5000+'
        fetch('/api/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: tf.session_id,
            event_type: 'convert_failure',
            target: mode,
            lines_bucket,
            features_hit: [],
            warnings_emitted: [{ id: 'network', count: 1 }],
            consent_version: CONSENT_VERSION,
          }),
        }).catch(() => { /* telemetry is never load-bearing */ })
      }
    } finally {
      setLoading(false)
    }
  }, [input, mode, isSignedIn, email, emailValid])

  const handleCopy = useCallback(async () => {
    if (!result?.python) return
    await navigator.clipboard.writeText(result.python)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result?.python) return
    const pyFileName = fileName ? fileName.replace(/\.m$/i, '.py') : 'converted.py'
    const blob = new Blob([result.python], { type: 'text/x-python;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = pyFileName
    a.click()
    URL.revokeObjectURL(url)
  }, [result, fileName])

  const handleClear = useCallback(() => {
    setInput('')
    setFileName(null)
    setResult(null)
    setError(null)
  }, [])

  const handleLoadExample = useCallback(() => {
    setInput(exampleCode)
    setFileName(null)
    setResult(null)
    setError(null)
    setMode('paste')
  }, [exampleCode])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.m')) {
      setError('Only .m files are supported')
      return
    }

    setFileName(file.name)
    setError(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setInput(text)
    }
    reader.readAsText(file)
  }, [])

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-0">
        {(['paste', 'upload', 'batch'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 text-sm rounded-t-md transition-colors ${
              mode === m
                ? 'bg-[#1b1e26] text-[#eef0f4] border border-b-0 border-[#2a2e3a]'
                : 'text-[#5a5f6b] hover:text-[#9aa1ac]'
            }`}
          >
            {m === 'paste' ? 'Paste Code' : m === 'upload' ? 'Upload .m File' : 'Batch (Team)'}
          </button>
        ))}
      </div>

      {mode === 'batch' && (
        <div className="rounded-b-lg rounded-tr-lg border border-[#2a2e3a] bg-[#1b1e26] p-6">
          <BatchWidget />
        </div>
      )}

      {mode !== 'batch' && (
        <>
          {/* Editor panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-[#2a2e3a] rounded-b-lg rounded-tr-lg overflow-hidden">
            {/* MATLAB input */}
            <div className="relative border-b lg:border-b-0 lg:border-r border-[#2a2e3a]">
              <div className="flex items-center justify-between px-4 py-2 bg-[#1b1e26] border-b border-[#2a2e3a]">
                <span className="text-xs font-medium text-[#5a5f6b] uppercase tracking-wider font-[family-name:var(--font-jetbrains)]">
                  {fileName ? fileName : 'MATLAB'}
                </span>
                <span className={`text-xs font-[family-name:var(--font-jetbrains)] ${lineCount > FREE_LINE_LIMIT && !hasPaidPlan ? 'text-[#ef4444]' : 'text-[#5a5f6b]'}`}>
                  {lineCount} lines
                </span>
              </div>

              {mode === 'paste' ? (
                <textarea
                  value={input}
                  onChange={e => { setInput(e.target.value); setFileName(null) }}
                  placeholder="Paste your MATLAB code here..."
                  className="code-editor code-panel w-full h-64 lg:h-[400px] bg-[#0d1117] text-[#cbd5e1] px-4 py-3 focus:outline-none placeholder:text-[#5a5f6b]"
                  spellCheck={false}
                />
              ) : (
                <div className="w-full h-64 lg:h-[400px] bg-[#0d1117] flex items-center justify-center">
                  {!isSignedIn || !hasPaidPlan ? (
                    <div className="text-center px-8">
                      <div className="text-[#9aa1ac] text-sm mb-3">
                        File upload requires a paid plan
                      </div>
                      <a
                        href={isSignedIn ? '/pricing' : '/sign-up?redirect_url=/pricing'}
                        className="px-4 py-2 bg-[#d9662b] text-white text-sm rounded-lg hover:bg-[#b8541f] transition-colors"
                      >
                        {isSignedIn ? 'View plans' : 'Sign up to upgrade'}
                      </a>
                    </div>
                  ) : fileName ? (
                    <div className="text-center px-8">
                      <div className="text-[#10b981] text-sm mb-1">{fileName}</div>
                      <div className="text-[#5a5f6b] text-xs mb-4">{lineCount} lines loaded</div>
                      <button
                        onClick={() => { setInput(''); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                        className="text-xs text-[#5a5f6b] hover:text-[#9aa1ac] transition-colors"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-center px-8">
                      <div className="border-2 border-dashed border-[#3a3f4d] rounded-lg px-12 py-8 hover:border-[#d9662b]/50 transition-colors">
                        <div className="text-[#9aa1ac] text-sm mb-1">
                          Drop a .m file here or click to browse
                        </div>
                        <div className="text-[#5a5f6b] text-xs">
                          Accepts .m files only
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".m"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Python output */}
            <div className="relative">
              <div className="flex items-center justify-between px-4 py-2 bg-[#1b1e26] border-b border-[#2a2e3a]">
                <span className="text-xs font-medium text-[#5a5f6b] uppercase tracking-wider font-[family-name:var(--font-jetbrains)]">
                  Python
                </span>
                {result && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCopy}
                      className="text-xs text-[#9aa1ac] hover:text-[#eef0f4] transition-colors"
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={handleDownload}
                      className="text-xs text-[#d9662b] hover:text-[#e8935f] transition-colors"
                    >
                      Download .py
                    </button>
                  </div>
                )}
              </div>
              <pre className="code-editor code-panel w-full h-64 lg:h-[400px] bg-[#0d1117] text-[#cbd5e1] px-4 py-3 overflow-auto whitespace-pre">
                {result?.python || (
                  <span className="text-[#5a5f6b]">
                    Python output will appear here...
                  </span>
                )}
              </pre>
            </div>
          </div>

          {/* Anonymous free-tier email gate */}
          {!isSignedIn && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="px-3 py-1.5 border border-[#3a3f4d] rounded bg-[#15171d] text-[#eef0f4] placeholder:text-[#5a5f6b] w-56 focus:outline-none focus:ring-1 focus:ring-[#d9662b]"
              />
              <span className="text-xs text-[#5a5f6b]">Email required for free conversions</span>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleConvert}
              disabled={loading || !input.trim() || (!isSignedIn && !emailValid)}
              className="px-6 py-2.5 bg-[#d9662b] text-white text-sm font-medium rounded-lg hover:bg-[#b8541f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Converting...' : 'Convert →'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2.5 text-[#5a5f6b] text-sm hover:text-[#9aa1ac] transition-colors"
            >
              Clear
            </button>
            {!input && mode === 'paste' && (
              <button
                onClick={handleLoadExample}
                className="px-4 py-2.5 text-[#5a5f6b] text-sm hover:text-[#9aa1ac] transition-colors"
              >
                Load example
              </button>
            )}
            {result && (
              <span className="ml-auto text-xs text-[#5a5f6b] font-[family-name:var(--font-jetbrains)]">
                {result.processingMs}ms
              </span>
            )}
          </div>

          {/* Anonymous, consent-gated telemetry toggle */}
          <ConsentToggle className="mt-3" />

          {/* Error */}
          {error && (
            <div className="mt-4 px-4 py-3 border-l-4 border-[#ef4444] bg-[#1a0000] text-[#ef4444] text-sm rounded-r-lg">
              {error}
            </div>
          )}

          {/* Conversion Stats */}
          {result && <ConversionStats result={result} inputLines={lineCount} />}

          {/* Post-conversion capture — fires at peak intent (just got a working
              conversion + saw "hours saved"). Anonymous users only; signed-in
              users already have an account. This is the high-intent moment the
              funnel was leaking 100% of. */}
          {result && !isSignedIn && (
            <div className="mt-4">
              <EmailCapture
                source="convert_success"
                headline={`Nice — that's ~${Math.round((lineCount * 2) / 6) / 10}h of manual rewriting saved.`}
                sub="Get the changelog the moment conversion history, batch mode, and 500-line files ship — plus a weekly MATLAB→Python migration tip. No spam, unsubscribe any time."
                cta="Keep me posted"
              />
              <p className="mt-2 text-center text-xs text-[#5a5f6b]">
                or{' '}
                <Link
                  href="/sign-up?redirect_url=/convert"
                  className="text-[#d9662b] hover:text-[#e8935f] transition-colors"
                >
                  create a free account
                </Link>{' '}
                to save your history and convert bigger files.
              </p>
            </div>
          )}

          {/* Compatibility Report */}
          {result && <CompatibilityReport report={result.report} />}
        </>
      )}
    </div>
  )
}

// ── Conversion Stats ─────────────────────────────────────

function ConversionStats({ result, inputLines }: { result: ConversionResult; inputLines: number }) {
  const { report, processingMs } = result
  const manualMinutes = Math.round(inputLines * 2)
  const hoursSaved = Math.round(manualMinutes / 6) / 10
  const reviewItems = report.flags.filter(f => f.type === 'WARNING' || f.type === 'TODO').length
  const reviewMinutes = reviewItems * 5

  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-[#1b1e26] border border-[#2a2e3a] rounded-lg px-3 py-2.5">
        <div className="text-[#10b981] font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          {report.conversionRate}%
        </div>
        <div className="text-[#5a5f6b] text-xs">Converted cleanly</div>
      </div>
      <div className="bg-[#1b1e26] border border-[#2a2e3a] rounded-lg px-3 py-2.5">
        <div className="text-[#d9662b] font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          ~{hoursSaved}h
        </div>
        <div className="text-[#5a5f6b] text-xs">Dev time saved</div>
      </div>
      <div className="bg-[#1b1e26] border border-[#2a2e3a] rounded-lg px-3 py-2.5">
        <div className="text-[#eef0f4] font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          {reviewItems > 0 ? `~${Math.round(reviewMinutes / 60 * 10) / 10}h` : '0h'}
        </div>
        <div className="text-[#5a5f6b] text-xs">
          {reviewItems > 0 ? `${reviewItems} items to review` : 'Nothing to review'}
        </div>
      </div>
      <div className="bg-[#1b1e26] border border-[#2a2e3a] rounded-lg px-3 py-2.5">
        <div className="text-[#eef0f4] font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          {processingMs < 1000 ? `${Math.round(processingMs)}ms` : `${(processingMs / 1000).toFixed(1)}s`}
        </div>
        <div className="text-[#5a5f6b] text-xs">Processing time</div>
      </div>
    </div>
  )
}

// ── Compatibility Report ─────────────────────────────────

function groupFlags(flags: ConversionResult['report']['flags']): Array<{ type: string; message: string; lines: number[] }> {
  const groups = new Map<string, { type: string; message: string; lines: number[] }>()
  for (const flag of flags) {
    const key = `${flag.type}:${flag.message}`
    const existing = groups.get(key)
    if (existing) {
      existing.lines.push(flag.originalLine)
    } else {
      groups.set(key, { type: flag.type, message: flag.message, lines: [flag.originalLine] })
    }
  }
  return Array.from(groups.values())
}

function CompatibilityReport({ report }: { report: ConversionResult['report'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-4 border border-[#2a2e3a] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#1b1e26] hover:bg-[#232733] transition-colors"
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[#10b981]">
            {report.convertedCount} converted
          </span>
          {report.flaggedCount > 0 && (
            <span className="text-[#f59e0b]">
              {report.flaggedCount} flagged
            </span>
          )}
          {report.unsupportedCount > 0 && (
            <span className="text-[#ef4444]">
              {report.unsupportedCount} unsupported
            </span>
          )}
          <span className="text-[#5a5f6b]">
            {report.conversionRate}% converted
          </span>
        </div>
        <span className="text-[#5a5f6b] text-xs">
          {expanded ? 'Hide' : 'Show'} details
        </span>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 text-sm bg-[#15171d]">
          {report.detectedToolboxes.length > 0 && (
            <div>
              <span className="text-[#5a5f6b]">Detected toolboxes: </span>
              <span className="text-[#9aa1ac]">
                {report.detectedToolboxes.join(', ')}
              </span>
            </div>
          )}

          {report.imports.length > 0 && (
            <div>
              <span className="text-[#5a5f6b]">Imports added: </span>
              <span className="text-[#e8935f] font-[family-name:var(--font-jetbrains)] text-xs">
                {report.imports.join(', ')}
              </span>
            </div>
          )}

          {report.flags.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#2a2e3a]">
              {groupFlags(report.flags).map((group, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <FlagBadge type={group.type} />
                  <div>
                    <span className="text-[#5a5f6b]">
                      {group.lines.length === 1
                        ? `Line ${group.lines[0]}: `
                        : `Lines ${group.lines.join(', ')}: `}
                    </span>
                    <span className="text-[#9aa1ac]">{group.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FlagBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    WARNING: 'bg-[#78450a]/30 text-[#f59e0b] border border-[#78450a]',
    INDEX:   'bg-[#3b1f6e]/30 text-[#a78bfa] border border-[#3b1f6e]',
    TOOLBOX: 'bg-[#1e3a5f]/30 text-[#60a5fa] border border-[#1e3a5f]',
    TODO:    'bg-[#2a2e3a]/50 text-[#9aa1ac] border border-[#3a3f4d]',
    UNSUPPORTED: 'bg-[#3b0f0f]/30 text-[#ef4444] border border-[#3b0f0f]',
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase whitespace-nowrap ${styles[type] || styles.TODO}`}>
      {type}
    </span>
  )
}
