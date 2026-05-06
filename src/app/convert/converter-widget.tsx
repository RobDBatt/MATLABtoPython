'use client'

import { useState, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { track } from '@vercel/analytics'
import type { ConversionResult } from '@/lib/converter'
import { BatchWidget } from './batch-widget'

const FREE_LINE_LIMIT = 50

interface Props {
  exampleCode: string
}

export function ConverterWidget({ exampleCode }: Props) {
  const { isSignedIn, user } = useUser()
  const plan = (user?.publicMetadata as Record<string, unknown>)?.plan as string | undefined
  const hasPaidPlan = plan === 'pro' || plan === 'team' || plan === 'migration_pass'

  const [mode, setMode] = useState<'paste' | 'upload' | 'batch'>('paste')
  const [input, setInput] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const lineCount = input.split('\n').filter(l => l.trim() !== '').length

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    const lines = input.split('\n').length

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || data.error || 'Conversion failed')
        track('conversion_failed', { lines, reason: data.error || 'unknown' })
        return
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
    } finally {
      setLoading(false)
    }
  }, [input, mode])

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
      {/* Tab bar: Paste / Upload / Batch */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setMode('paste')}
          className={`px-4 py-1.5 text-sm rounded-t-lg transition-colors ${
            mode === 'paste'
              ? 'bg-gray-50 text-slate-900 border border-gray-200 border-b-0'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Paste Code
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`px-4 py-1.5 text-sm rounded-t-lg transition-colors ${
            mode === 'upload'
              ? 'bg-gray-50 text-slate-900 border border-gray-200 border-b-0'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Upload .m File
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`px-4 py-1.5 text-sm rounded-t-lg transition-colors ${
            mode === 'batch'
              ? 'bg-gray-50 text-slate-900 border border-gray-200 border-b-0'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Batch (Team)
        </button>
      </div>

      {mode === 'batch' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <BatchWidget />
        </div>
      )}

      {mode !== 'batch' && (
      <>
      {/* Editor panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-gray-200 rounded-lg overflow-hidden">
        {/* MATLAB input */}
        <div className="relative border-b lg:border-b-0 lg:border-r border-gray-200">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              {fileName ? fileName : 'MATLAB'}
            </span>
            <span className={`text-xs ${lineCount > FREE_LINE_LIMIT && !hasPaidPlan ? 'text-red-600' : 'text-slate-500'}`}>
              {lineCount} lines
            </span>
          </div>

          {mode === 'paste' ? (
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); setFileName(null) }}
              placeholder="Paste your MATLAB code here..."
              className="code-editor code-panel w-full h-64 lg:h-[360px] bg-[#1e1e2e] text-[#cbd5e1] px-4 py-3 focus:outline-none placeholder:text-[#64748b]"
              spellCheck={false}
            />
          ) : (
            <div className="w-full h-64 lg:h-[360px] bg-[#1e1e2e] flex items-center justify-center">
              {!isSignedIn || !hasPaidPlan ? (
                <div className="text-center px-8">
                  <div className="text-slate-500 text-sm mb-3">
                    File upload requires a paid plan
                  </div>
                  <a
                    href={isSignedIn ? '/pricing' : '/sign-up?redirect_url=/pricing'}
                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 transition-colors"
                  >
                    {isSignedIn ? 'View plans' : 'Sign up to upgrade'}
                  </a>
                </div>
              ) : fileName ? (
                <div className="text-center px-8">
                  <div className="text-green-400 text-sm mb-1">{fileName}</div>
                  <div className="text-slate-500 text-xs mb-4">{lineCount} lines loaded</div>
                  <button
                    onClick={() => { setInput(''); setFileName(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer text-center px-8">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg px-12 py-8 hover:border-purple-400 transition-colors">
                    <div className="text-slate-400 text-sm mb-1">
                      Drop a .m file here or click to browse
                    </div>
                    <div className="text-slate-600 text-xs">
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
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              Python
            </span>
            {result && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="text-xs text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs text-purple-600 hover:text-purple-500 transition-colors"
                >
                  Download .py
                </button>
              </div>
            )}
          </div>
          <pre className="code-editor code-panel w-full h-64 lg:h-[360px] bg-[#1e1e2e] text-[#cbd5e1] px-4 py-3 overflow-auto whitespace-pre">
            {result?.python || (
              <span className="text-[#64748b]">
                Python output will appear here...
              </span>
            )}
          </pre>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleConvert}
          disabled={loading || !input.trim()}
          className="px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Converting...' : 'Convert'}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2.5 text-slate-600 text-sm hover:text-slate-900 transition-colors"
        >
          Clear
        </button>
        {!input && mode === 'paste' && (
          <button
            onClick={handleLoadExample}
            className="px-4 py-2.5 text-slate-500 text-sm hover:text-slate-700 transition-colors"
          >
            Load example
          </button>
        )}
        {result && (
          <span className="ml-auto text-xs text-slate-500">
            {result.processingMs}ms
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Conversion Stats */}
      {result && <ConversionStats result={result} inputLines={lineCount} />}

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
  // Time estimate: an engineer manually converts ~30 lines/hour
  const manualMinutes = Math.round(inputLines * 2) // ~2 min per line manually
  const hoursSaved = Math.round(manualMinutes / 6) / 10 // round to 1 decimal
  const reviewItems = report.flags.filter(f => f.type === 'WARNING' || f.type === 'TODO').length
  const reviewMinutes = reviewItems * 5 // ~5 min per review item

  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <div className="text-green-600 font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          {report.conversionRate}%
        </div>
        <div className="text-slate-500 text-xs">Converted cleanly</div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <div className="text-purple-600 font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          ~{hoursSaved}h
        </div>
        <div className="text-slate-500 text-xs">Dev time saved</div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <div className="text-slate-700 font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          {reviewItems > 0 ? `~${Math.round(reviewMinutes / 60 * 10) / 10}h` : '0h'}
        </div>
        <div className="text-slate-500 text-xs">
          {reviewItems > 0 ? `${reviewItems} items to review` : 'Nothing to review'}
        </div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <div className="text-slate-700 font-[family-name:var(--font-jetbrains)] text-lg font-bold">
          {processingMs < 1000 ? `${Math.round(processingMs)}ms` : `${(processingMs / 1000).toFixed(1)}s`}
        </div>
        <div className="text-slate-500 text-xs">Processing time</div>
      </div>
    </div>
  )
}

// ── Compatibility Report ─────────────────────────────────

/** Group duplicate flag messages, collecting line numbers */
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
    <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600">
            {report.convertedCount} converted
          </span>
          {report.flaggedCount > 0 && (
            <span className="text-amber-600">
              {report.flaggedCount} flagged
            </span>
          )}
          {report.unsupportedCount > 0 && (
            <span className="text-red-600">
              {report.unsupportedCount} unsupported
            </span>
          )}
          <span className="text-slate-500">
            {report.conversionRate}% converted
          </span>
        </div>
        <span className="text-slate-500 text-xs">
          {expanded ? 'Hide' : 'Show'} details
        </span>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 text-sm">
          {/* Detected toolboxes */}
          {report.detectedToolboxes.length > 0 && (
            <div>
              <span className="text-slate-500">Detected toolboxes: </span>
              <span className="text-slate-700">
                {report.detectedToolboxes.join(', ')}
              </span>
            </div>
          )}

          {/* Imports */}
          {report.imports.length > 0 && (
            <div>
              <span className="text-slate-500">Imports added: </span>
              <span className="text-slate-700 font-[family-name:var(--font-jetbrains)] text-xs">
                {report.imports.join(', ')}
              </span>
            </div>
          )}

          {/* Flags — grouped by message to avoid duplicates */}
          {report.flags.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-200">
              {groupFlags(report.flags).map((group, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <FlagBadge type={group.type} />
                  <div>
                    <span className="text-slate-600">
                      {group.lines.length === 1
                        ? `Line ${group.lines[0]}: `
                        : `Lines ${group.lines.join(', ')}: `}
                    </span>
                    <span className="text-slate-700">{group.message}</span>
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
    WARNING: 'bg-amber-50 text-amber-600',
    INDEX: 'bg-purple-50 text-purple-600',
    TOOLBOX: 'bg-blue-50 text-blue-600',
    TODO: 'bg-gray-100 text-slate-600',
    UNSUPPORTED: 'bg-red-50 text-red-600',
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${styles[type] || styles.TODO}`}>
      {type}
    </span>
  )
}
