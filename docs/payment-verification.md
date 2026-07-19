# Payment verification checklist

End-to-end proof for the entitlement/checkout/webhook path. None of this is
covered by `vitest` — the unit tests mock Clerk and Stripe. Run this against a
**test-mode** Stripe key + test Clerk instance before trusting a payment deploy.

Setup:
```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copy the whsec_… it prints into STRIPE_WEBHOOK_SECRET, then `npm run dev`
```
Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.

## 1. Migration Pass grants correctly and mode is one-time  ← the fix that was misconfigured
- [ ] Signed in, buy **Migration Pass**.
- [ ] Stripe CLI shows `checkout.session.completed` with `mode: payment` (NOT subscription). If it says subscription, the price is still recurring — stop.
- [ ] Clerk `publicMetadata` → `plan: "migration_pass"`, `migrationPassExpiresAt` ≈ 30 days out.
- [ ] Convert a 51-line file → allowed. Convert 5001 lines → refused (`exceeds_line_limit`).

## 2. Migration Pass expiry actually enforces  ← was dead code before this session
- [ ] In Clerk, hand-edit `migrationPassExpiresAt` to a past date.
- [ ] Convert a 200-line file → refused, limit drops to 50 (free). This is the check that lived in `entitlements.ts` but was never called.

## 3. Team resolves to Team, not Pro  ← the P0 substring bug
- [ ] Buy **Team**. Clerk → `plan: "team"` (NOT `"pro"`).
- [ ] Batch conversion allowed; 10,000-line file allowed.

## 4. Team monthly cap enforces  ← counter was write-only before
- [ ] As Team, convert enough to approach 100,000 lines/month (or hand-set `linesUsedThisMonth` in Clerk to 99,999 with `linesResetDate` = today).
- [ ] Next conversion → refused (`monthly_limit_reached`).
- [ ] Set `linesResetDate` to last month → conversion allowed again (counter resets on new period).

## 5. Subscription cancellation revokes  ← was unhandled before
- [ ] As a Pro/Team subscriber, cancel in Stripe (`stripe subscription cancel <id>` or dashboard).
- [ ] CLI shows `customer.subscription.deleted`. Clerk → `plan: "free"`, `stripeSubscriptionId: null`.
- [ ] `past_due` must NOT revoke — trigger a failed renewal and confirm plan stays.

## 6. Checkout input validation
- [ ] `POST /api/checkout` with `{"planKey":"free"}` → 400 (non-purchasable).
- [ ] With `{"planKey":"enterprise"}` → 400 (unknown).
- [ ] With a valid planKey while signed out → 401.

## 7. Misconfiguration is loud, not silent
- [ ] Temporarily point `STRIPE_PRICE_MIGRATION_PASS` at a **recurring** price, restart, buy Migration Pass → 503 `plan_misconfigured`, logs show `MISCONFIGURED: Migration Pass price is recurring`. Restore the one-time price after.

## Production notes (can't be tested locally)
- [ ] Vercel Production + Preview both have `STRIPE_PRICE_MIGRATION_PASS = price_1Tv0FYRElJyZVpb2R4sSXFa2` (the one-time price).
- [ ] Old recurring Migration Pass price is **archived** in Stripe.
- [ ] Production Stripe webhook endpoint points at `/api/webhooks/stripe` and its signing secret is in Vercel.
- [ ] Preview deploys use `pk_test_`/`sk_test_` Clerk keys — production keys are domain-locked and render sign-in blank on preview URLs.
- [ ] Any customer who bought before this session's fix: check for `plan: "pro"` that should be `"team"`, and reconcile against the Stripe subscription list (the webhook fix does not repair existing users).
