'use client'

import { useState, useCallback } from 'react'
import JSZip from 'jszip'
import { useUser } from '@clerk/nextjs'

interface BatchFile {
  name: string
  status: 'pending' | 'converting' | 'done' | 'error'
  message?: string
  lineCount?: number
  flagCount?: number
}

export function BatchWidget() {
  const { isSignedIn, user } = useUser()
  const plan = (user?.publicMetadata as Record<string, unknown>)?.plan as string | undefined
  const isTeam = plan === 'team'

  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<BatchFile[]>([])
  const [running, setRunning] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const mFiles = selected.filter(f => f.name.toLowerCase().endsWith('.m'))
    if (mFiles.length === 0) {
      alert('No .m files selected. Use Ctrl-click or Shift-click to select multiple.')
      return
    }
    setFiles(mFiles)
    setProgress(mFiles.map(f => ({ name: f.name, status: 'pending' })))
    setDownloadUrl(null)
    setSummary(null)
  }, [])

  const handleConvertAll = useCallback(async () => {
    if (files.length === 0 || running) return
    setRunning(true)
    setDownloadUrl(null)
    setSummary(null)

    const zip = new JSZip()
    const convertedDir = zip.folder('converted')!
    const reportRows: string[] = [
      '# Batch Conversion Report',
      '',
      `Total files: ${files.length}`,
      '',
      '| File | Status | Lines (MATLAB → Python) | Flags |',
      '|---|---|---|---|',
    ]

    let passCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(prev => {
        const next = [...prev]
        next[i] = { ...next[i], status: 'converting' }
        return next
      })

      const text = await file.text()
      let pyOutput = ''
      let flagCount = 0
      let lineCount = 0
      let status: BatchFile['status'] = 'done'
      let errorMsg = ''

      try {
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: text }),
        })
        const data = await res.json()
        if (!res.ok) {
          status = 'error'
          errorMsg = data.message || data.error || 'conversion failed'
        } else {
          pyOutput = data.python
          flagCount = data.report?.flagged?.length ?? data.report?.flags?.length ?? 0
          lineCount = pyOutput.split('\n').length
          passCount++
        }
      } catch (err) {
        status = 'error'
        errorMsg = (err as Error).message
      }

      const pyName = file.name.replace(/\.m$/i, '.py')
      if (status === 'done') {
        convertedDir.file(pyName, pyOutput)
      }
      const matlabLineCount = text.split('\n').length
      reportRows.push(
        `| \`${file.name}\` | ${status === 'done' ? 'OK' : 'FAIL'} | ${matlabLineCount} → ${lineCount} | ${flagCount} |`,
      )

      setProgress(prev => {
        const next = [...prev]
        next[i] = {
          name: file.name,
          status,
          message: errorMsg || undefined,
          lineCount,
          flagCount,
        }
        return next
      })
    }

    reportRows.push('')
    reportRows.push(`**${passCount}/${files.length} files converted successfully.**`)
    reportRows.push('')
    reportRows.push('Review any file with non-zero flags before running in production — the converter emits `# TODO`, `# INDEX`, and `# WARNING` markers where human judgment is needed.')

    zip.file('REPORT.md', reportRows.join('\n'))

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    setDownloadUrl(url)
    setSummary(`${passCount} of ${files.length} files converted. Click to download.`)
    setRunning(false)
  }, [files, running])

  if (!isSignedIn) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-slate-600 mb-4">Batch conversion requires a Team-tier account.</p>
        <a
          href="/sign-in?redirect_url=/convert"
          className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
        >
          Sign in
        </a>
      </div>
    )
  }

  if (!isTeam) {
    return (
      <div className="rounded-lg border border-purple-300 bg-purple-50 p-8 text-center">
        <h3 className="font-semibold text-slate-900 mb-2">Batch conversion is a Team-tier feature</h3>
        <p className="text-slate-600 mb-4">
          Upload a folder of .m files and get a zip of converted .py files back, with a per-file
          conversion report. $79/month for up to 100,000 lines.
        </p>
        <a
          href="/pricing"
          className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
        >
          See pricing
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <label className="inline-block cursor-pointer">
          <span className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500">
            Select .m files
          </span>
          <input
            type="file"
            accept=".m"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
        <p className="text-xs text-slate-500 mt-3">
          Select multiple files with Ctrl-click (Cmd-click on Mac). Each file goes through the
          converter one at a time, counted against your Team-tier line quota.
        </p>
      </div>

      {progress.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 bg-gray-100 text-sm font-medium text-slate-700 flex items-center justify-between">
            <span>Files ({progress.length})</span>
            <button
              onClick={handleConvertAll}
              disabled={running || files.length === 0}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded disabled:opacity-40 hover:bg-purple-500"
            >
              {running ? 'Converting…' : 'Convert all'}
            </button>
          </div>
          <ul className="divide-y divide-gray-200 max-h-80 overflow-auto bg-white">
            {progress.map((p, i) => (
              <li key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="font-mono truncate text-slate-700">{p.name}</span>
                <span className="ml-4 shrink-0">
                  {p.status === 'pending' && <span className="text-slate-400">queued</span>}
                  {p.status === 'converting' && <span className="text-amber-600">converting…</span>}
                  {p.status === 'done' && (
                    <span className="text-emerald-600">
                      {p.lineCount} lines · {p.flagCount} flags
                    </span>
                  )}
                  {p.status === 'error' && (
                    <span className="text-rose-600" title={p.message}>
                      error
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {downloadUrl && summary && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 flex items-center justify-between">
          <span className="text-sm text-emerald-900">{summary}</span>
          <a
            href={downloadUrl}
            download="matlab-to-python-batch.zip"
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-500"
          >
            Download zip
          </a>
        </div>
      )}
    </div>
  )
}
