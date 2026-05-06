import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/convert',
  '/pricing',
  '/learn(.*)',
  '/toolboxes(.*)',
  '/examples(.*)',
  '/feed.xml',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/debug',
  '/api/convert',
  '/api/debug',
  '/api/health',
  '/api/subscribe',
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)',
    '/(api|trpc)(.*)',
  ],
}
