import { NextRequest, NextResponse } from 'next/server'
import { convert } from '@/lib/converter'

/**
 * Debug endpoint — no auth, no line limit. Used by the /debug page to
 * inspect converter behavior on arbitrary input. Returns everything the
 * converter knows about the transformation so the UI can render a full
 * diagnostic view.
 *
 * Not indexed. Not linked from the public site. For internal debugging.
 */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    if (typeof code !== 'string') {
      return NextResponse.json({ error: 'code must be a string' }, { status: 400 })
    }
    const result = convert(code)
    return NextResponse.json({
      python: result.python,
      flags: result.report.flags,
      imports: result.report.imports,
      toolboxes: result.report.detectedToolboxes,
      conversionRate: result.report.conversionRate,
      processingMs: result.processingMs,
      matlabLineCount: code.split('\n').length,
      pythonLineCount: result.python.split('\n').length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'conversion failed' },
      { status: 500 },
    )
  }
}
