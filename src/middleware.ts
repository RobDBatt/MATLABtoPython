import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')

export default async function middleware(req: NextRequest) {
  if (!hasClerk) return NextResponse.next()

  // Dynamically import Clerk middleware only when keys are present
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server')

  const isPublicRoute = createRouteMatcher([
    '/',
    '/convert',
    '/pricing',
    '/learn(.*)',
    '/toolboxes(.*)',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/convert',
    '/api/health',
    '/api/webhooks(.*)',
  ])

  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  })(req, {} as any)
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
