# Beanbus Project Checklist

**Active plan:** `tasks/plan.md`  
**Updated:** 2026-08-09  
**Current checkpoint:** Phase 1 — Tasks 4-5 external verification, then Task 6

## Baseline Snapshot

- [x] Public UI routes and shared layout implemented.
- [x] Menu customization, cart, checkout shell, booking, account, and admin demos implemented.
- [x] Type check passes.
- [x] Production build passes.
- [x] Lint passes; 19 image optimization warnings remain assigned to Task 13.
- [x] Application unit tests exist and pass.
- [x] Critical browser E2E smoke test exists and passes in Chromium.
- [ ] Production backend/auth/payment exists.

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
- [ ] Task 6 UI wiring: production checkout, safe confirmation receipt, and production E2E.
- [ ] Task 7: Integrate verified, idempotent Sepay payments.
- [ ] Task 8: Implement loyalty ledger and member account data.
- [ ] Task 9: Add safe `/account/topup` and `/flash-sale` flows.
- [ ] Checkpoint C: No trusted price/payment/points state comes from the browser.

## Phase 3: Operations

- [ ] Task 10: Deliver booking, contact, RSVP, and B2B submissions.
- [ ] Task 11: Replace demo admin with protected operations.
- [ ] Checkpoint D: Staff can act on real requests through authorized workflows.

## Phase 4: Release

- [ ] Task 12: Complete content detail routes and server-rendered SEO.
- [ ] Task 13: Close accessibility, responsive, and performance gaps.
- [ ] Task 14: Add observability and pass the release gate.
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
