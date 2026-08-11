# Beanbus Release Runbook

This runbook is the handoff point between the local implementation and the owner-controlled staging or production rollout. Provider credentials, hosted Supabase access, and final content remain external configuration.

## Required Configuration

Set these values in the deployment platform. Never commit them to the repository:

- `NEXT_PUBLIC_APP_MODE=production`
- `NEXT_PUBLIC_SITE_URL=https://<approved-domain>`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` for server-only admin operations and webhooks
- `NEXT_PUBLIC_ENABLE_PHONE_AUTH` and `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` when Zalo phone auth is enabled; the Turnstile secret stays in Supabase Auth
- `NEXT_PUBLIC_ENABLE_FORM_CAPTCHA=false` by default; when enabled, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_ENABLE_SEPAY`, `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, and `SEPAY_ACCOUNT_NAME` when Sepay is enabled
- `NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION=false` by default; `SEPAY_API_KEY` and `CRON_SECRET` are required only when reconciliation is explicitly enabled
- Voucher lifecycle default: reserve at order creation, consume on paid SePay or completed COD, release once on cancellation/payment failure/expired SePay payment; owner approval is required for refund behavior
- `NEXT_PUBLIC_ENABLE_STORED_VALUE=false` by default; set it to `true` only after the stored-value migration, policy approval, package/campaign review, and Sepay verification
- Approved provider, notification, logo, image, privacy, terms, booking-capacity, loyalty, COD, refund, and stored-value settings

## Pre-deploy Gate

Run from a clean checkout using the committed lockfile:

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
npm run test:e2e:auth
npm run test:e2e:checkout-production
npm run test:e2e:checkout-sepay
npm run test:e2e:requests
supabase db lint --local --level warning
supabase test db
```

The database checks require Docker and the Supabase CLI. Hosted database verification is a release-owner step and is not replaced by local checks.

## Migration and Deployment

1. Take or verify a current database backup and record the migration target.
2. Link the intended project and record the local/remote migration inventory before applying anything:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase migration list
   ```

   Stop when the remote history contains drift that is not explained by a reviewed migration.
3. Apply the reviewed migrations with `npm run db:push` against the linked hosted project.
   Current hosted record (2026-08-11): the remote inventory matches all 36 local migrations through `20260811041000_fix_remote_lint_warnings.sql`. A read-only verification confirmed the SePay reconciliation ledger and voucher reservation ledger exist, and both Zalo cron names have zero active jobs. Remote `db lint --fail-on error` passes with no schema errors. The CLI emitted a Docker catalog-cache warning after a successful remote apply; it does not invalidate the migration result.
4. Verify RLS, role membership, protected RPC transitions, and audit rows with an admin and a non-admin account.
5. Deploy the application with the production environment variables above.
   Current read-only check (2026-08-11): production flags expose Google enabled and Phone disabled, but the deployed HTML still contains the legacy disabled Zalo form. Source commit `87473ae` is now pushed on `codex/zalo-otp-integration`; do not sign off the Google-only UI until Vercel redeploys it or the commit is merged into the production branch.
6. Verify `GET /api/health` returns `200` with `{"status":"ok"}` and a usable `x-request-id`. Current read-only production check passed on 2026-08-11 and returned `mode: production`.
7. Configure the Sepay webhook URL and secret only after the deployed endpoint is reachable over HTTPS.
   Current read-only check (2026-08-11): `POST /hooks/payment` without a signature returns `401`, so SePay is currently enabled in production. Either disable it until the payment gate is signed off, or complete the live token, alert, allowlist, and small-amount smoke checklist before accepting traffic.
8. If reconciliation is enabled, verify the 15-minute cron can expire pending SePay payments and release their voucher reservations before advancing its checkpoint. Current read-only production check returns `404`, so reconciliation is currently disabled even though the webhook is enabled.
   The application sends SePay API v2 date bounds as `YYYY-MM-DD HH:mm:ss` in `Asia/Ho_Chi_Minh`, matching the [official reconciliation contract](https://developer.sepay.vn/vi/sepay-webhooks/doi-soat-giao-dich). It emits bounded JSON events for `webhook_processed`, `payment_reconciliation_completed`, and `payment_reconciliation_gap`, plus correlated failure events for signature/database/provider errors. Configure production log alerts for rejected outcomes, repeated failures, and gap events; do not alert on or export payloads, payment codes, account numbers, or tokens.
9. If form CAPTCHA is enabled, verify booking, contact, and checkout reject a missing/expired token and accept one valid token; never expose `TURNSTILE_SECRET_KEY` to the browser.
10. Keep Phone provider, Send SMS Hook, Zalo refresh cron, and `NEXT_PUBLIC_ENABLE_PHONE_AUTH` disabled in the current Google-only release. Hosted public Auth settings currently show `google: true` and `phone: false`; verify the Send SMS Hook separately in the Supabase Dashboard. Use [`zalo-otp-runbook.md`](zalo-otp-runbook.md) only for a later, separately approved rollout.

`/api/health` validates application configuration. It is not a substitute for a database readiness probe or provider transaction test.

## First Admin Bootstrap

Perform this once, with owner approval, in the hosted Supabase SQL editor or another service-role-only channel. Never run it from a browser, Server Action, or client Supabase key. Replace the placeholder with the exact email used by the first Google account; do not paste a secret into this query.

```sql
begin;

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('ADMIN_EMAIL@example.com')
  limit 1;

  if v_user_id is null then
    raise exception 'ADMIN_USER_NOT_FOUND';
  end if;

  update public.profiles
  set role = 'admin'
  where id = v_user_id;

  if not found then
    raise exception 'ADMIN_PROFILE_NOT_FOUND';
  end if;
end;
$$;

commit;
```

Verify the result from a service-role-only session, then sign in again with that account and open `/admin`. Record the email, timestamp, migration revision, and operator in the release log. All later role changes must use the audited `update_member_role` operation; never grant admin by editing browser state or user metadata. To revoke access, use the admin member operation or the same owner-controlled SQL channel, then verify the user receives the forbidden response after refreshing their session.

## Smoke Test

- Public home, menu, product detail, events, blog, booking, contact, and B2B quote pages render with canonical metadata.
- A member can sign in with Google and only access their own account and order history.
- Phone/Zalo UI and remote execution remain disabled in this release; Google remains the only enabled signup path.
- COD checkout creates a server-priced order and shows a support reference on failure.
- Sepay checkout accepts one valid signed callback, rejects invalid signatures, and remains idempotent on replay.
- Stored-value remains disabled until both the deployment flag and admin policy are enabled; after approval, verify one top-up and one flash-sale payment, including duplicate callback, expiry, sold-out, and amount-mismatch cases.
- Booking, contact, RSVP, and B2B submissions return a reference that staff can locate.
- An authorized admin can search and transition permitted records; a non-admin receives a forbidden response.

## Rollback and Incidents

- For an application regression, redeploy the previous known-good build.
- For a provider incident, disable the affected feature flag or webhook integration and keep customer-facing failure messages honest.
- Do not destructively roll back an applied database migration. Restore from backup only with owner approval, or ship a forward migration.
- Use the `x-request-id` from the UI response, server log, and webhook response to correlate one incident.
- Structured operational logs include event, operation, reason, timestamp, and correlation ID. They intentionally exclude secrets, raw webhook payloads, and full customer form data.

## Owner Sign-off

Record the staging URL, migration revision, backup timestamp, provider test result, alert contact, and rollback decision before enabling real payment traffic.
