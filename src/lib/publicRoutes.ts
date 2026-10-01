/**
 * Routes a signed-out visitor can reach. Everything else goes through
 * Clerk's auth.protect(), which sends a page request to sign-in and answers
 * an API request with a 404.
 *
 * /api/telemetry and /privacy(.*) were missing until Oct 2026. Every guest
 * paywall_shown / upgrade_clicked / checkout_started event the widget sent
 * got the 404 page instead of the handler, so usage_events had none of them
 * for this site, and the "Learn more" link under the telemetry toggle sent
 * guests to sign-in.
 *
 * /api/checkout is public so a visitor can pay without making an account
 * first; the route itself handles both signed-in and guest buyers.
 */
export const PUBLIC_ROUTES = [
  '/',
  '/convert',
  '/pricing',
  '/learn(.*)',
  '/toolboxes(.*)',
  '/examples(.*)',
  '/privacy(.*)',
  '/feed.xml',
  '/robots.txt',
  '/sitemap.xml',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/debug',
  '/api/checkout',
  '/api/convert',
  '/api/debug',
  '/api/health',
  '/api/subscribe',
  '/api/telemetry',
  '/api/webhooks(.*)',
]
