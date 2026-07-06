'use client'

import { useState, useCallback, useMemo } from 'react'

interface Flag {
  type: string
  message: string
  originalLine: number
  outputLine: number
  originalCode: string
}

interface DebugResult {
  python: string
  flags: Flag[]
  imports: string[]
  toolboxes: string[]
  conversionRate: number
  processingMs: number
  matlabLineCount: number
  pythonLineCount: number
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/x-python;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface Props {
  exampleCode: string
}

const FLAG_COLORS: Record<string, string> = {
  WARNING: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  TODO: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  INDEX: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  TOOLBOX: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  UNSUPPORTED: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

export function DebugWidget({ exampleCode }: Props) {
  const [input, setInput] = useState(exampleCode)
  const [result, setResult] = useState<DebugResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Conversion failed')
        return
      }
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [input])

  // Group flags by MATLAB source line for inline markers on the left pane
  const flagsByMatlabLine = useMemo(() => {
    if (!result) return new Map<number, Flag[]>()
    const m = new Map<number, Flag[]>()
    for (const f of result.flags) {
      if (!m.has(f.originalLine)) m.set(f.originalLine, [])
      m.get(f.originalLine)!.push(f)
    }
    return m
  }, [result])

  const matlabLines = input.split('\n')
  const pythonLines = (result?.python ?? '').split('\n')

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleConvert}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm font-medium"
        >
          {loading ? 'Converting…' : 'Run conversion'}
        </button>
        <button
          onClick={() => {
            setInput(exampleCode)
            setResult(null)
          }}
          className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
        >
          Load example
        </button>
        <button
          onClick={() => {
            setInput('')
            setResult(null)
          }}
          className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
        >
          Clear
        </button>
        {result && (
          <span className="ml-auto text-xs text-slate-500 font-mono">
            {result.matlabLineCount} MATLAB → {result.pythonLineCount} Python ·
            {' '}{result.processingMs}ms ·
            {' '}{result.conversionRate}% converted ·
            {' '}{result.flags.length} flags
          </span>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded border border-rose-500/40 bg-rose-950/40 text-rose-200 text-sm">
          {error}
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        {/* MATLAB input */}
        <div className="rounded border border-slate-700 bg-slate-950 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-between">
            <span>MATLAB source</span>
            <span className="text-slate-500">{matlabLines.length} lines</span>
          </div>
          {!result ? (
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              spellCheck={false}
              className="w-full h-[70vh] p-3 bg-slate-950 text-slate-100 font-mono text-sm resize-none outline-none"
              placeholder="Paste MATLAB code here…"
            />
          ) : (
            <div className="h-[70vh] overflow-auto font-mono text-sm">
              {matlabLines.map((line, idx) => {
                const ln = idx + 1
                const hasFlag = flagsByMatlabLine.has(ln)
                return (
                  <div
                    key={ln}
                    onMouseEnter={() => setHoveredLine(ln)}
                    onMouseLeave={() => setHoveredLine(null)}
                    className={`flex gap-2 px-3 py-0.5 ${
                      hoveredLine === ln ? 'bg-slate-800/70' : ''
                    } ${hasFlag ? 'border-l-2 border-amber-500' : 'border-l-2 border-transparent'}`}
                  >
                    <span className="w-10 text-right text-slate-600 select-none shrink-0">{ln}</span>
                    <span className="text-slate-100 whitespace-pre">{line || ' '}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Python output */}
        <div className="rounded border border-slate-700 bg-slate-950 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-mono flex items-center justify-between gap-2">
            <span>Python output</span>
            {result && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{pythonLines.length} lines</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.python)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1800)
                  }}
                  className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs"
                  title="Copy Python to clipboard"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => downloadText('converted.py', result.python)}
                  className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs"
                  title="Download as .py file"
                >
                  Download
                </button>
              </div>
            )}
          </div>
          <div className="h-[70vh] overflow-auto font-mono text-sm">
            {result ? (
              pythonLines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex gap-2 px-3 py-0.5 border-l-2 border-transparent"
                >
                  <span className="w-10 text-right text-slate-600 select-none shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-slate-100 whitespace-pre">{line || ' '}</span>
                </div>
              ))
            ) : (
              <div className="p-4 text-slate-500 italic">Output will appear here.</div>
            )}
          </div>
        </div>
      </div>

      {/* Flags + metadata */}
      {result && (
        <div className="grid grid-cols-3 gap-4 text-sm">
          {/* Flags list */}
          <div className="col-span-2 rounded border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-mono">
              Flags ({result.flags.length})
            </div>
            <div className="max-h-[40vh] overflow-auto">
              {result.flags.length === 0 ? (
                <div className="p-3 text-slate-500 italic text-sm">No flags.</div>
              ) : (
                <ul>
                  {result.flags.map((f, i) => (
                    <li
                      key={i}
                      onMouseEnter={() => setHoveredLine(f.originalLine)}
                      onMouseLeave={() => setHoveredLine(null)}
                      className="px-3 py-2 border-b border-slate-800 hover:bg-slate-900 cursor-default"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-mono border ${
                            FLAG_COLORS[f.type] || 'text-slate-400 bg-slate-800'
                          }`}
                        >
                          {f.type}
                        </span>
                        <span className="text-slate-500 text-xs font-mono">
                          MATLAB line {f.originalLine}
                        </span>
                      </div>
                      <div className="text-slate-300 text-xs">{f.message}</div>
                      {f.originalCode && (
                        <div className="mt-1 text-slate-500 text-xs font-mono truncate">
                          {f.originalCode}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Imports + toolboxes */}
          <div className="rounded border border-slate-700 bg-slate-950 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-mono">
              Pipeline summary
            </div>
            <div className="p-3 space-y-3 text-xs">
              <div>
                <div className="text-slate-500 mb-1">Imports</div>
                {result.imports.length === 0 ? (
                  <div className="text-slate-600 italic">none</div>
                ) : (
                  <ul className="font-mono text-slate-300 space-y-0.5">
                    {result.imports.map(imp => (
                      <li key={imp}>{imp}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-slate-500 mb-1">Toolboxes detected</div>
                {result.toolboxes.length === 0 ? (
                  <div className="text-slate-600 italic">none</div>
                ) : (
                  <ul className="font-mono text-slate-300 space-y-0.5">
                    {result.toolboxes.map(t => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
