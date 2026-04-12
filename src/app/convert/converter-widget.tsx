'use client'

import { useState, useCallback } from 'react'
import type { ConversionResult } from '@/lib/converter'

const FREE_LINE_LIMIT = 50

interface Props {
  exampleCode: string
}

export function ConverterWidget({ exampleCode }: Props) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ConversionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const lineCount = input.split('\n').filter(l => l.trim() !== '').length

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || data.error || 'Conversion failed')
        return
      }

      setResult(data)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [input])

  const handleCopy = useCallback(async () => {
    if (!result?.python) return
    await navigator.clipboard.writeText(result.python)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleClear = useCallback(() => {
    setInput('')
    setResult(null)
    setError(null)
  }, [])

  const handleLoadExample = useCallback(() => {
    setInput(exampleCode)
    setResult(null)
    setError(null)
  }, [exampleCode])

  return (
    <div>
      {/* Editor panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-navy-800 rounded-lg overflow-hidden">
        {/* MATLAB input */}
        <div className="relative border-b lg:border-b-0 lg:border-r border-navy-800">
          <div className="flex items-center justify-between px-4 py-2 bg-navy-900 border-b border-navy-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              MATLAB
            </span>
            <span className={`text-xs ${lineCount > FREE_LINE_LIMIT ? 'text-red-400' : 'text-slate-500'}`}>
              {lineCount}/{FREE_LINE_LIMIT} lines
            </span>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste your MATLAB code here..."
            className="code-editor code-panel w-full h-80 lg:h-[480px] bg-navy-950 text-slate-300 px-4 py-3 focus:outline-none placeholder:text-slate-500/60"
            spellCheck={false}
          />
        </div>

        {/* Python output */}
        <div className="relative">
          <div className="flex items-center justify-between px-4 py-2 bg-navy-900 border-b border-navy-800">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Python
            </span>
            {result && (
              <button
                onClick={handleCopy}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <pre className="code-editor code-panel w-full h-80 lg:h-[480px] bg-navy-950 text-slate-300 px-4 py-3 overflow-auto whitespace-pre">
            {result?.python || (
              <span className="text-slate-500/60">
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
          className="px-6 py-2.5 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Converting...' : 'Convert'}
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2.5 text-slate-400 text-sm hover:text-white transition-colors"
        >
          Clear
        </button>
        {!input && (
          <button
            onClick={handleLoadExample}
            className="px-4 py-2.5 text-slate-500 text-sm hover:text-slate-300 transition-colors"
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
        <div className="mt-4 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Compatibility Report */}
      {result && <CompatibilityReport report={result.report} />}
    </div>
  )
}

function CompatibilityReport({ report }: { report: ConversionResult['report'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-6 border border-navy-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-navy-900 hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-400">
            {report.convertedCount} converted
          </span>
          {report.flaggedCount > 0 && (
            <span className="text-gold-400">
              {report.flaggedCount} flagged
            </span>
          )}
          {report.unsupportedCount > 0 && (
            <span className="text-red-400">
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
              <span className="text-slate-300">
                {report.detectedToolboxes.join(', ')}
              </span>
            </div>
          )}

          {/* Imports */}
          {report.imports.length > 0 && (
            <div>
              <span className="text-slate-500">Imports added: </span>
              <span className="text-slate-300 font-[family-name:var(--font-jetbrains)] text-xs">
                {report.imports.join(', ')}
              </span>
            </div>
          )}

          {/* Flags */}
          {report.flags.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-navy-800">
              {report.flags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <FlagBadge type={flag.type} />
                  <span className="text-slate-400">Line {flag.originalLine}:</span>
                  <span className="text-slate-300">{flag.message}</span>
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
    WARNING: 'bg-gold-400/10 text-gold-400',
    INDEX: 'bg-purple-500/10 text-purple-400',
    TOOLBOX: 'bg-blue-500/10 text-blue-400',
    TODO: 'bg-slate-500/10 text-slate-400',
    UNSUPPORTED: 'bg-red-400/10 text-red-400',
  }

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${styles[type] || styles.TODO}`}>
      {type}
    </span>
  )
}
