# Beanbus Release Runbook

This runbook is the handoff point between the local implementation and the owner-controlled staging or production rollout. Provider credentials, hosted Supabase access, and final content remain external configuration.

## Required Configuration

Set these values in the deployment platform. Never commit them to the repository:

- `NEXT_PUBLIC_APP_MODE=production`
- `NEXT_PUBLIC_SITE_URL=https://<approved-domain>`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` for server-only admin operations and webhooks
- `NEXT_PUBLIC_ENABLE_PHONE_AUTH` and `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `PASSWORD_RECOVERY_SECRET` when `NEXT_PUBLIC_ENABLE_PASSWORD_AUTH=true`; keep it server-only and generate a random value with `openssl rand -hex 32`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` when Zalo phone auth is enabled; the Turnstile secret stays in Supabase Auth
- `NEXT_PUBLIC_ENABLE_FORM_CAPTCHA=false` by default; when enabled, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_ENABLE_SEPAY`, `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, and `SEPAY_ACCOUNT_NAME` when Sepay is enabled
- `NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION=false` by default; `SEPAY_API_KEY` and `CRON_SECRET` are required only when reconciliation is explicitly enabled
- Commerce policy default: reserve at order creation, consume on paid SePay or completed COD, release once on cancellation/payment failure/refund; admin can change voucher release/consume, loyalty reversal, refund enable, and refund window at `/admin/policies`
- `NEXT_PUBLIC_ENABLE_STORED_VALUE=false` by default; set it to `true` only after the stored-value migration, policy approval, package/campaign review, and Sepay verification
- Approved provider, Resend sender/recipient, logo, image, privacy, terms, booking-capacity, loyalty, COD, refund, and stored-value settings

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
   Current hosted record (2026-08-13): the remote inventory matches all `45/45` local migrations through `20260813010000_notification_set_based_fanout.sql`. The new helper, fan-out triggers and authenticated privilege boundary were verified read-only on remote; local `db:lint` and pgTAP pass through Docker/Colima (`390/390`). The hosted lint command must be run with a schema-specific invocation because the CLI `--db-url` path currently fails while enabling `pgsql_check` without a selected schema.
4. Verify RLS, role membership, protected RPC transitions, and audit rows with an admin and a non-admin account.
5. Deploy the application with the production environment variables above. Production provider contexts skip demo fixture hydration and browser persistence; server-owned Supabase data remains authoritative. The CI-only hardening commits and documentation are on `main`; after every deployment, record the revision returned by `/api/health` in the release log.
   Verified code deployment (2026-08-12): login HTML exposes `phoneEnabled=false` and `googleEnabled=true`; stored-value is false and SePay is true. Public live smoke is green.
6. Verify `GET /api/health` returns `200` with `{"status":"ok"}`, a usable `x-request-id`, and (on Vercel) a 12-character `revision` matching the deployed commit SHA prefix. Do not hardcode the revision in this runbook because every documentation commit creates a new Vercel deployment; record the observed value in the release log instead.
7. Configure the Sepay webhook URL and secret only after the deployed endpoint is reachable over HTTPS.
   Current check (2026-08-12): production has SePay enabled and `POST /hooks/payment` without a signature returns `401`. Dashboard configuration remains `https://www.beanbus.store/hooks/payment`, HMAC-SHA256, money-in, code `DH_<mã hóa đơn>`. Live payment, alert, allowlist, and replay checks remain owner gates.
8. If reconciliation is enabled, verify the 15-minute cron can expire pending SePay payments and release their voucher reservations before advancing its checkpoint. Current production remains disabled: Vercel Hobby rejects the `*/15 * * * *` schedule, so do not replace it with a daily schedule that could miss payment windows. The repository includes a guarded GitHub Actions alternative in `.github/workflows/sepay-reconciliation.yml`; configure the `production` Environment variable `SEPAY_RECONCILIATION_ENABLED=true`, optional `SEPAY_RECONCILIATION_URL`, and secret `BEANBUS_CRON_SECRET` (the same value as Vercel `CRON_SECRET`) only after the live smoke is approved. The scheduled workflow is disabled by default and accepts only HTTPS endpoints.
   The application sends SePay API v2 date bounds as `YYYY-MM-DD HH:mm:ss` in `Asia/Ho_Chi_Minh`, matching the [official reconciliation contract](https://developer.sepay.vn/vi/sepay-webhooks/doi-soat-giao-dich). It emits bounded JSON events for `webhook_processed`, `payment_reconciliation_completed`, and `payment_reconciliation_gap`, plus correlated failure events for signature/database/provider errors. Configure production log alerts for rejected outcomes, repeated failures, and gap events; do not alert on or export payloads, payment codes, account numbers, or tokens.
9. If form CAPTCHA is enabled, verify booking, contact, and checkout reject a missing/expired token and accept one valid token; never expose `TURNSTILE_SECRET_KEY` to the browser.
10. Keep Phone provider, Send SMS Hook, Zalo refresh cron, and `NEXT_PUBLIC_ENABLE_PHONE_AUTH` disabled in the current Google-only release. Hosted public Auth settings currently show `google: true` and `phone: false`; verify the Send SMS Hook separately in the Supabase Dashboard. Use [`zalo-otp-runbook.md`](zalo-otp-runbook.md) only for a later, separately approved rollout.
   Read-only remote audit (2026-08-12) also shows both Zalo cron jobs at `0` active schedules and stored-value/top-up/flash-sale policy flags all `false`; the notification worker remains scheduled every minute.
11. When password auth is enabled, turn on Supabase Auth's **Require current password when changing password** setting and test an incorrect current password. This is separate from `secure_password_change`/reauthentication. The admin recovery link must be tested separately and must not allow a different admin session to reuse its capability.

The repository includes a manual `.github/workflows/deploy-supabase-functions.yml` workflow. Before using it, add `SUPABASE_ACCESS_TOKEN` as a masked `production` Environment secret and `SUPABASE_PROJECT_REF` as a non-secret `production` Environment variable in GitHub. It deploys only the selected function with `--no-verify-jwt`; it is never triggered by a normal push.

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
- Booking, contact, RSVP, and B2B submissions return a reference that staff can locate; new booking/contact submissions create in-app notifications for admins.
- An authorized admin can search and transition permitted records; a non-admin receives a forbidden response.
- An authorized admin can open `/admin/policies`, configure voucher/loyalty/refund behavior, and refund an eligible paid SePay order within the configured window.
- Resend API đã chấp nhận smoke send tới hai Gmail test; worker vẫn trả `disabled=true` khi feature flag tắt. Email delivery vẫn pending cho tới khi owner xác minh mailbox, accepted/delivered/bounced/complained, webhook và unsubscribe. Request `notification_status=not_configured` remains a legacy delivery field and is not the notification-center KPI.
- Read-only kiểm tra bằng API key hiện tại bị Resend giới hạn ở quyền gửi (`restricted to only send emails`), nên không thể liệt kê domain hoặc webhook qua API. Xác minh DNS/domain, webhook URL và event subscription trực tiếp trong Resend Dashboard; không mở rộng scope API key chỉ để đọc cấu hình.

## Rollback and Incidents

- For an application regression, redeploy the previous known-good build.
- For a provider incident, disable the affected feature flag or webhook integration and keep customer-facing failure messages honest.
- Do not destructively roll back an applied database migration. Restore from backup only with owner approval, or ship a forward migration.
- Use the `x-request-id` from the UI response, server log, and webhook response to correlate one incident.
- Structured operational logs include event, operation, reason, timestamp, and correlation ID. They intentionally exclude secrets, raw webhook payloads, and full customer form data.

## Owner Sign-off

Record the staging URL, migration revision, backup timestamp, provider test result, alert contact, and rollback decision before enabling real payment traffic.
