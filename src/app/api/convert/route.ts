import { NextRequest, NextResponse } from 'next/server'
import { convert } from '@/lib/converter'
import { auth, currentUser } from '@clerk/nextjs/server'

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

    return NextResponse.json(result)
  } catch (err) {
    console.error('Conversion error:', err)
    return NextResponse.json(
      { error: 'internal_error', message: 'Conversion failed unexpectedly' },
      { status: 500 },
    )
  }
}
