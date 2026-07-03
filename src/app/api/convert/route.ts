import { NextRequest, NextResponse } from 'next/server'
import { convert } from '@/lib/converter'
import { auth, currentUser } from '@clerk/nextjs/server'
import { scheduleTelemetry } from '@/lib/telemetry/server'
import type { Target } from '@/lib/telemetry/types'

const FREE_LINE_LIMIT = 50

export async function POST(req: NextRequest) {
  // Hoisted so the catch block can emit convert_failure telemetry. When
  // req.json() itself throws these stay at their defaults and logServerEvent's
  // guards (consent !== true / empty code) skip the emission silently.
  let code: unknown
  let lineCount = 0
  let telemetryConsent = false
  let telemetrySession: string | undefined
  let telemetryMode: Target = 'paste'
  try {
    const body = await req.json()
    code = body?.code
    // Optional, consent-gated anonymous telemetry fields (never required).
    telemetryConsent = body?.telemetry_consent === true
    telemetrySession = typeof body?.session_id === 'string' ? body.session_id : undefined
    telemetryMode = (body?.mode === 'upload' || body?.mode === 'batch' ? body.mode : 'paste') as Target

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "code" field' },
        { status: 400 },
      )
    }

    lineCount = code.split('\n').filter((l: string) => l.trim() !== '').length

    // Every real attempt is logged (consent-gated), so Supabase shows true
    // rates instead of survivorship bias — pairs with convert_success below.
    scheduleTelemetry({
      eventType: 'convert_attempt',
      code,
      flagTypes: [],
      lineCount,
      sessionId: telemetrySession,
      consent: telemetryConsent,
      target: telemetryMode,
    })

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
      scheduleTelemetry({
        eventType: 'convert_failure',
        code,
        flagTypes: [],
        lineCount,
        sessionId: telemetrySession,
        consent: telemetryConsent,
        target: telemetryMode,
        extraWarningIds: ['line_limit'],
      })
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
    // Failure telemetry — the survivorship-bias fix. If req.json() itself
    // threw, code/consent are still defaults and logServerEvent's guards skip
    // this silently; scheduleTelemetry can never throw into the response path.
    scheduleTelemetry({
      eventType: 'convert_failure',
      code: typeof code === 'string' ? code : '',
      flagTypes: [],
      lineCount,
      sessionId: telemetrySession,
      consent: telemetryConsent,
      target: telemetryMode,
      extraWarningIds: ['internal_error'],
    })
    return NextResponse.json(
      { error: 'internal_error', message: 'Conversion failed unexpectedly' },
      { status: 500 },
    )
  }
}
