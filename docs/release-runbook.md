# Beanbus Release Runbook

This runbook is the handoff point between the local implementation and the owner-controlled staging or production rollout. Provider credentials, hosted Supabase access, and final content remain external configuration.

## Required Configuration

Set these values in the deployment platform. Never commit them to the repository:

- `NEXT_PUBLIC_APP_MODE=production`
- `NEXT_PUBLIC_SITE_URL=https://<approved-domain>`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` for server-only admin operations and webhooks
- `NEXT_PUBLIC_ENABLE_PHONE_AUTH` and `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_ENABLE_SEPAY`, `SEPAY_WEBHOOK_SECRET`, `SEPAY_BANK_CODE`, `SEPAY_BANK_ACCOUNT`, and `SEPAY_ACCOUNT_NAME` when Sepay is enabled
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
2. Apply the reviewed migrations with `npm run db:push` against the linked hosted project.
3. Verify RLS, role membership, protected RPC transitions, and audit rows with an admin and a non-admin account.
4. Deploy the application with the production environment variables above.
5. Verify `GET /api/health` returns `200` with `{"status":"ok"}` and a usable `x-request-id`.
6. Configure the Sepay webhook URL and secret only after the deployed endpoint is reachable over HTTPS.

`/api/health` validates application configuration. It is not a substitute for a database readiness probe or provider transaction test.

## Smoke Test

- Public home, menu, product detail, events, blog, booking, contact, and B2B quote pages render with canonical metadata.
- A member can sign in and only access their own account and order history.
- COD checkout creates a server-priced order and shows a support reference on failure.
- Sepay checkout accepts one valid signed callback, rejects invalid signatures, and remains idempotent on replay.
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
