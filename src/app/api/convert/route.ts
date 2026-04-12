import { NextRequest, NextResponse } from 'next/server'
import { convert } from '@/lib/converter'

const FREE_LINE_LIMIT = 50

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "code" field' },
        { status: 400 },
      )
    }

    const lineCount = code.split('\n').filter((l: string) => l.trim() !== '').length

    // For now (no auth), enforce free tier limit
    if (lineCount > FREE_LINE_LIMIT) {
      return NextResponse.json(
        {
          error: 'line_limit_exceeded',
          message: `Free tier allows ${FREE_LINE_LIMIT} lines. This code has ${lineCount} lines.`,
          limit: FREE_LINE_LIMIT,
          actual: lineCount,
        },
        { status: 403 },
      )
    }

    const result = convert(code)

    return NextResponse.json(result)
  } catch (err) {
    console.error('Conversion error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Conversion failed unexpectedly' },
      { status: 500 },
    )
  }
}
