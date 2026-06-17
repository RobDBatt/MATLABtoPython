import { NextRequest, NextResponse } from 'next/server'
import { convert } from '@/lib/converter'
import { auth, currentUser } from '@clerk/nextjs/server'
import { scheduleTelemetry } from '@/lib/telemetry/server'
import type { Target } from '@/lib/telemetry/types'

const FREE_LINE_LIMIT = 50

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body
    // Optional, consent-gated anonymous telemetry fields (never required).
    const telemetryConsent = body?.telemetry_consent === true
    const telemetrySession = typeof body?.session_id === 'string' ? body.session_id : undefined
    const telemetryMode = (body?.mode === 'upload' || body?.mode === 'batch' ? body.mode : 'paste') as Target

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "code" field' },
        { status: 400 },
      )
    }

    const lineCount = code.split('\n').filter((l: string) => l.trim() !== '').length

    // Check auth and plan limits
    let lineLimit = FREE_LINE_LIMIT
    const { userId } = await auth()

    if (userId) {
      const user = await currentUser()
      const meta = user?.publicMetadata as Record<string, unknown> | undefined
      const plan = meta?.plan as string | undefined

      if (plan === 'team') {
        lineLimit = (meta?.linesPerConversion as number) || 10000
      } else if (plan === 'pro' || plan === 'migration_pass') {
        lineLimit = 5000
      }
    }

    if (lineCount > lineLimit) {
      return NextResponse.json(
        {
          error: 'line_limit_exceeded',
          message: userId
            ? `Your plan allows ${lineLimit} lines per conversion. This code has ${lineCount} lines.`
            : `Free tier allows ${FREE_LINE_LIMIT} lines. This code has ${lineCount} lines. Sign in to upgrade.`,
          limit: lineLimit,
          actual: lineCount,
        },
        { status: 403 },
      )
    }

    const result = convert(code)

    // Fire-and-forget anonymous telemetry AFTER the response (consent-gated).
    // Never affects latency or the conversion result.
    scheduleTelemetry({
      eventType: 'convert_success',
      code,
      flagTypes: result.report.flags.map((f) => f.type),
      lineCount,
      sessionId: telemetrySession,
      consent: telemetryConsent,
      target: telemetryMode,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Conversion error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Conversion failed unexpectedly' },
      { status: 500 },
    )
  }
}
