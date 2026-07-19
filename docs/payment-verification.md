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

## 1. Pro grants correctly and mode is subscription
- [ ] Signed in, buy **Individual Pro**.
- [ ] Stripe CLI shows `checkout.session.completed` with `mode: subscription`.
- [ ] Clerk `publicMetadata` → `plan: "pro"`, `stripeSubscriptionId` set.
- [ ] Convert a 51-line file → allowed. Convert 5001 lines → refused (`exceeds_line_limit`).

## 2. A retired plan value degrades to free  ← 'migration_pass' was removed
- [ ] In Clerk, hand-set a user's `plan` to `migration_pass` (a plan that no longer exists).
- [ ] Convert a 200-line file → refused, limit drops to 50. The lookup must fall back to free, never return undefined.

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
- [ ] Temporarily point `STRIPE_PRICE_PRO` at a **one-time** price, restart, buy Pro → 503 `plan_misconfigured`, logs show `MISCONFIGURED: price is one-time but the plan is sold as a subscription`. Restore the recurring price after.

## Production notes (can't be tested locally)
- [ ] `STRIPE_PRICE_MIGRATION_PASS` is gone from Vercel (Production + Preview) — the plan was retired.
- [ ] Both Migration Pass prices (the old recurring one and the one-time `price_1Tv0FY…`) are **archived** in Stripe so neither is purchasable by direct link.
- [ ] Production Stripe webhook endpoint points at `/api/webhooks/stripe` and its signing secret is in Vercel.
- [ ] Preview deploys use `pk_test_`/`sk_test_` Clerk keys — production keys are domain-locked and render sign-in blank on preview URLs.
- [ ] Any customer who bought before this session's fix: check for `plan: "pro"` that should be `"team"`, and reconcile against the Stripe subscription list (the webhook fix does not repair existing users).
