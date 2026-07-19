import { NextRequest, NextResponse, after } from 'next/server'
import { convert } from '@/lib/converter'
import { auth } from '@clerk/nextjs/server'
import { scheduleTelemetry } from '@/lib/telemetry/server'
import type { Target } from '@/lib/telemetry/types'
import { isValidEmail, saveSubscriber, hasUsedMatlabFreeConversion, markMatlabFreeConversionUsed } from '@/lib/subscribers'
import { checkConversionAllowed, recordLinesUsed, type ConversionVerdict } from '@/lib/entitlements'

const FREE_LINE_LIMIT = 50

/** User-facing copy for a refused conversion. */
function gateMessage(
  reason: Exclude<ConversionVerdict['reason'], null>,
  limit: number,
  lineCount: number,
  signedIn: boolean,
): string {
  switch (reason) {
    case 'monthly_limit_reached':
      return `You've reached your plan's monthly limit of ${limit.toLocaleString()} lines.`
    case 'upload_not_allowed':
      return 'File upload requires a paid plan.'
    case 'batch_not_allowed':
      return 'Batch conversion requires a Team-tier account.'
    case 'exceeds_line_limit':
      return signedIn
        ? `Your plan allows ${limit} lines per conversion. This code has ${lineCount} lines.`
        : `Free tier allows ${FREE_LINE_LIMIT} lines. This code has ${lineCount} lines. Sign in to upgrade.`
  }
}

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
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

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
    const { userId } = await auth()

    // Free-tier (anonymous) conversions require a valid email — turns
    // otherwise-invisible free usage into a lead we can follow up with.
    // Signed-in users already gave Clerk an email, so they're exempt.
    if (!userId) {
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: 'email_required', message: 'Enter a valid email to convert on the free tier.' },
          { status: 403 },
        )
      }
      // One free conversion per email. Checked before the line-limit test
      // below so a repeat email gets the clearest, most relevant error.
      // Marked as used only after a successful convert() (see below) — a
      // failed attempt (line limit, internal error) doesn't burn it.
      if (await hasUsedMatlabFreeConversion(email)) {
        return NextResponse.json(
          {
            error: 'free_conversion_used',
            message: 'This email has already used its free conversion. Sign up or upgrade to convert more.',
          },
          { status: 403 },
        )
      }
      after(() => saveSubscriber(email, 'convert_gate').catch(() => { /* best-effort; never blocks conversion */ }))
    }

    // Single entitlement gate. This must stay a call into lib/entitlements —
    // the plan checks were previously duplicated inline here, which left the
    // migration-pass expiry check in entitlements.ts dead and unreachable.
    const gate = await checkConversionAllowed(lineCount, telemetryMode)

    if (!gate.allowed) {
      scheduleTelemetry({
        eventType: 'convert_failure',
        code,
        flagTypes: [],
        lineCount,
        sessionId: telemetrySession,
        consent: telemetryConsent,
        target: telemetryMode,
        extraWarningIds: [gate.reason === 'monthly_limit_reached' ? 'monthly_limit' : 'line_limit'],
      })
      return NextResponse.json(
        {
          error: gate.reason,
          message: gateMessage(gate.reason, gate.limit, lineCount, !!userId),
          limit: gate.limit,
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

    if (!userId && email) {
      after(() => markMatlabFreeConversionUsed(email, 'convert_gate').catch(() => { /* best-effort */ }))
    }

    // Bill the lines against the monthly quota. Deferred so the Clerk write
    // never adds latency, and no-ops for plans without a finite monthly cap.
    if (userId) {
      after(() => recordLinesUsed(lineCount).catch(() => { /* best-effort; never blocks conversion */ }))
    }

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
