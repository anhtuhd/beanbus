# Beanbus Project Checklist

**Active plan:** `tasks/plan.md`  
**Updated:** 2026-08-09  
**Current checkpoint:** Phase 4 — Task 14 local release gate complete; strict no-JS audit and hosted Supabase/provider verification remain queued

## Baseline Snapshot

- [x] Public UI routes and shared layout implemented.
- [x] Menu customization, cart, checkout shell, booking, account, and admin demos implemented.
- [x] Type check passes.
- [x] Production build passes.
- [x] Lint passes; 3 provider-controlled image warnings remain pending approved production hosts.
- [x] Application unit tests exist and pass.
- [x] Critical browser E2E smoke test exists and passes in Chromium.
- [x] Production backend/auth/payment implementation exists behind environment/provider gates.
- [ ] Production backend/auth/payment has been exercised against hosted Supabase and real providers.

## Phase 0: Stabilize

- [x] Task 1: Restore lint and navigation quality baseline.
- [x] Task 2: Add test harness and environment contract.
- [x] Checkpoint A: All local quality gates pass; provider credentials remain feature-gated.

## Phase 1: Trusted Data

- [x] Task 3: Add Supabase server/browser infrastructure.
- [ ] Task 4: Ship real authentication and role authorization.
- [x] Task 4 implementation: auth actions/callback, profile RLS, session DAL, and route guards.
- [ ] Task 4 external verification: configure a provider and run pgTAP/member/admin paths.
- [ ] Task 5: Migrate catalog and add `/menu/[id]`.
- [x] Task 5 implementation: catalog schema/read model, product details, responsive UI, and E2E.
- [ ] Task 5 external verification: run catalog migration/pgTAP and production queries on Supabase.
- [ ] Checkpoint B: Auth/RLS/catalog pass tests and browser checks.

## Phase 2: Commerce

- [ ] Task 6: Create server-priced, idempotent orders.
- [x] Task 6 pricing core: private schema, ownership RLS, canonical pricing RPC, and contract tests.
- [x] Task 6 action contract: narrow payload validation and one-call pricing RPC.
- [x] Task 6 UI wiring: production checkout, safe confirmation receipt, responsive demo E2E, and production provider gating.
- [ ] Task 6 external verification: apply migrations and run pgTAP plus production pickup/delivery flows on Supabase.
- [x] Task 7 implementation: service-only ledger, HMAC webhook, dedupe/audit, expiring VietQR, polling UI, and tests.
- [ ] Task 7 external verification: run pgTAP and Sepay Test mode/Live transfer with owner credentials.
- [ ] Task 8: Implement loyalty ledger and member account data.
- [ ] Task 9: Add safe `/account/topup` and `/flash-sale` flows.
- [ ] Checkpoint C: No trusted price/payment/points state comes from the browser.

## Phase 3: Operations

- [ ] Task 10: Deliver booking, contact, RSVP, and B2B submissions.
- [x] Task 10 booking slice: pending requests, consent, idempotency, serialized rate limiting, RLS, reference receipt, and responsive UI.
- [x] Task 10 lead slice: persist contact, RSVP, and B2B forms with honest delivery states.
- [ ] Task 10 external verification: run pgTAP and confirm booking capacity policy.
- [ ] Task 11: Replace demo admin with protected operations.
- [x] Task 11 request operations slice: protected booking/lead lists, pagination, audited status state machines, and responsive controls.
- [x] Task 11 order operations slice: protected search/filter/pagination, payment-safe transitions, and admin/system audit history.
- [x] Task 11 catalog operations slice: protected search/filter/pagination, audited availability/publication RPC, and responsive controls.
- [x] Task 11 content operations slice: protected event/blog search/filter/pagination and audited publication RPCs.
- [x] Task 11 member directory slice: protected read-only profile search/filter/pagination with no role or loyalty mutation.
- [ ] Task 11 external verification: execute pgTAP and browser-check member/admin sessions against configured Supabase.
- [ ] Checkpoint D: Staff can act on real requests through authorized workflows.

## Phase 4: Release

- [x] Task 12 content/backend slice: event/blog schema, public production queries, deep links, metadata, not-found and loading/error states.
- [x] Task 12 discovery slice: canonical/Open Graph metadata, Product/Event/Blog/LocalBusiness JSON-LD, sitemap and robots policy.
- [ ] Task 12 final content verification: owner-approved assets/content and interactive-island/no-JS audit.
- [x] Task 13 local implementation: focus trap/return, keyboard navigation, status announcements, responsive route smoke tests, screenshots, and optimized catalog/content media.
- [ ] Task 13 external audit: screen reader/WCAG scan, Core Web Vitals, and authenticated account/admin keyboard workflows.
- [x] Task 14 local implementation: bounded correlation logging, support references, health endpoint, security headers, CI quality/E2E/database jobs, and release runbook.
- [x] Task 14 local verification: 113 unit/contract tests, production build, lint, type check, dependency audit, demo E2E, and auth-gated E2E pass locally.
- [ ] Task 14 hosted verification: run CI database job, hosted Supabase migrations/pgTAP, provider callbacks, and staging smoke test with owner credentials.
- [ ] Final checkpoint: Staging sign-off with no open P0/P1 findings.

## Owner Decisions

- [x] Approve Supabase architecture and access method; hosted credentials pending.
- [ ] Confirm phone OTP, Google login, or both.
- [ ] Provide/approve Sepay production contract and credentials.
- [ ] Approve loyalty, COD, refund, and stored-value rules.
- [ ] Confirm booking capacity and lead notification owners.
- [ ] Provide/approve domain, logo, owned images, privacy policy, and terms.
- [ ] Decide whether English needs separate indexable URLs.

## Required Commands Per Task

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Run the focused E2E command added by Task 2 for every affected customer workflow.

## Commit Checklist

- [ ] Stage the completed release milestone after the final diff and secret scan.
- [ ] Commit the release milestone with a descriptive message.
- [ ] Push `main` to `origin` and confirm the remote commit list.
