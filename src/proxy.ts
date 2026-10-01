import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { PUBLIC_ROUTES } from '@/lib/publicRoutes'

const isPublicRoute = createRouteMatcher(PUBLIC_ROUTES)

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  // Run middleware on every non-static request. The old extension-based
  // exclusion skipped bot requests like `/fake.css` — but a NON-EXISTENT
  // static path still SSRs the app 404 page through <ClerkProvider>, whose
  // auth() then crashed without middleware context (72 Vercel runtime errors
  // on /_not-found). Real files in public/ are served by the CDN before
  // middleware, so this only adds middleware runs on requests that would 404
  // anyway.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
