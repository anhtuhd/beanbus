# Beanbus Project Checklist

**Active plan:** `tasks/plan.md`  
**Updated:** 2026-08-10
**Current checkpoint:** Phase 4 — Task 14 local release gate complete; stored-value top-up/flash-sale code is now behind explicit production and admin policy gates, while owner content and hosted Supabase/provider verification remain queued

## Baseline Snapshot

- [x] Public UI routes and shared layout implemented.
- [x] Menu customization, cart, checkout shell, booking, account, and admin demos implemented.
- [x] Type check passes.
- [x] Production build passes.
- [x] Lint passes cleanly with no warnings.
- [x] Application unit tests exist and pass.
- [x] Critical browser E2E smoke test exists and passes in Chromium.
- [x] Production backend/auth/payment implementation exists behind environment/provider gates.
- [ ] Production backend/auth/payment has been exercised against hosted Supabase and real providers.
- [x] Reconcile and apply the current local migration set to hosted Supabase; remote now matches local through `20260810073000` (14 migrations applied, including member booking and customer-request cancellation).

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
- [x] Task 5 implementation: catalog schema/read model, server-backed homepage and order catalog, product details, responsive UI, and E2E.
- [ ] Task 5 external verification: run catalog pgTAP and production queries on Supabase; catalog migration is applied remotely.
- [ ] Checkpoint B: Auth/RLS/catalog pass tests and browser checks.

## Phase 2: Commerce

- [ ] Task 6: Create server-priced, idempotent orders.
- [x] Task 6 pricing core: private schema, ownership RLS, canonical pricing RPC, and contract tests.
- [x] Task 6 action contract: narrow payload validation and one-call pricing RPC.
- [x] Task 6 UI wiring: production checkout, safe confirmation receipt, responsive demo E2E, and production provider gating.
- [ ] Task 6 external verification: run pgTAP plus production pickup/delivery flows on Supabase; order migrations are applied remotely.
- [x] Task 7 implementation: service-only ledger, HMAC webhook, dedupe/audit, expiring VietQR, polling UI, and tests.
- [ ] Task 7 external verification: run pgTAP and Sepay Test mode/Live transfer with owner credentials.
- [x] Task 8: Implement loyalty ledger and member account data.
- [x] Task 8 account slice: profile editing, server-owned order history/timeline, paginated loyalty/request/voucher history, active vouchers, pagination, protected order/request details, validated reorder, member-owned request history/timeline, and direct voucher-to-cart handoff.
- [x] Task 8 order detail slice: protected reorder action reloads only available catalog items and links members to the cart.
- [x] Task 8 demo browser slice: member tabs, profile update, voucher view, voucher-to-cart handoff, selected-tab deep links, and local account interactions pass Playwright smoke coverage.
- [x] Task 8 demo request slice: member request tab exposes local booking history and preserves the selected-tab deep link.
- [x] Task 8 demo booking action slice: member can cancel an active local booking request with accessible feedback.
- [x] Task 8 production booking action slice: member can cancel owned `pending`/`confirmed` booking requests from list/detail views through an audited, idempotent RPC.
- [x] Task 8 production booking cancellation test plan: contract coverage plus a dedicated pgTAP ownership/transition/audit test is committed; execution remains hosted-runtime work.
- [x] Task 8 production customer-request cancellation: active member-owned contact/RSVP/B2B requests can be withdrawn through an audited RPC with idempotent retry and terminal-state protection.
- [x] Task 8 loyalty foundation: append-only ledger, idempotent order earn/reversal trigger, policy audit, summary RPC, and production display.
- [x] Task 8 loyalty policy admin: protected `/admin/loyalty` policy read/update UI and audit history.
- [x] Task 8 voucher operations: protected `/admin/vouchers` create/edit/activate UI, bounded search/pagination, and audit RPC.
- [x] Task 8 loyalty redemption: admin reward catalog with bounded search/pagination, owned voucher issuance, idempotent point debit, voucher ownership enforcement, and member redeem UI.
- [x] Task 8 member loyalty history: server-owned recent ledger transactions with empty/error states in the production account tab.
- [x] Task 8 pagination hardening: member order, loyalty, request, voucher, and admin list pages cap URL-driven pagination at 100 pages.
- [x] Task 8 pagination totals: member order/request tab badges use server counts instead of the current page length.
- [ ] Task 8 external verification/policy sign-off: approve earning/COD/refund/expiry rules, run pgTAP/browser checks against hosted Supabase; migrations are applied remotely.
- [ ] Task 9: Add safe `/account/topup` and `/flash-sale` flows.
- [x] Task 9 implementation: server-authoritative top-up and flash-sale intents, quota reservation, separate Sepay payment ledger, verified webhook credit, polling UI, and admin policy/package/campaign controls.
- [x] Task 9 navigation gate: member and admin stored-value links remain hidden until both stored-value and Sepay deployment flags are enabled.
- [ ] Task 9 external verification: approve stored-value policy and run duplicate payment, expiry, quota, amount mismatch, and real Sepay checks on Supabase; stored-value migration is applied but the feature remains disabled.
- [ ] Checkpoint C: No trusted price/payment/points state comes from the browser.

## Phase 3: Operations

- [ ] Task 10: Deliver booking, contact, RSVP, and B2B submissions.
- [x] Task 10 booking slice: pending requests, consent, idempotency, serialized rate limiting, RLS, reference receipt, and responsive UI.
- [x] Task 10 lead slice: persist contact, RSVP, and B2B forms with honest delivery states, admin-visible notification status, protected detail drill-down, and member/admin request status timelines.
- [x] Task 10 member withdrawal slice: member customer requests support explicit `cancelled` state instead of overloading `rejected`.
- [x] Task 10 RSVP capacity slice: server-side event existence, open-window, quota checks with per-event advisory locking and honest `EVENT_FULL`/`EVENT_CLOSED` UI states.
- [ ] Task 10 external verification: run pgTAP and confirm booking capacity policy.
- [ ] Task 11: Replace demo admin with protected operations.
- [x] Task 11 request operations slice: protected all/booking/lead lists, pagination, notification-failure filtering, audited status state machines, responsive controls, and request detail drill-down.
- [x] Task 11 cancelled-request visibility: admin filters and status badges include member-withdrawn customer requests.
- [x] Task 11 order operations slice: protected search/filter/pagination, payment-safe transitions, and admin/system audit history.
- [x] Task 11 order detail slice: guarded line items, options, voucher/payment context, and status-history drill-down.
- [x] Task 11 catalog operations slice: protected search/filter/pagination, audited availability/publication RPC, and responsive controls.
- [x] Task 11 catalog create/edit slice: audited upsert RPC and responsive inline editor.
- [x] Task 11 catalog archive/delete policy: archive products through an audited status RPC; physical deletion remains unavailable so historical orders retain their references.
- [x] Task 11 content operations slice: protected event/blog search/filter/pagination and audited publication RPCs.
- [x] Task 11 event editor slice: audited create/edit RPC and responsive admin form.
- [x] Task 11 blog editor slice: audited create/edit RPC and responsive admin form.
- [x] Task 11 member directory slice: protected read-only profile search/filter/pagination with no role or loyalty mutation.
- [x] Task 11 member detail slice: guarded read-only profile, paginated loyalty/order drill-down, and role-change audit timeline.
- [x] Task 11 demo browser slice: legacy admin tabs, menu creation, and availability toggle pass Playwright smoke coverage.
- [x] Task 11 demo booking slice: admin can update local booking status with accessible success feedback.
- [x] Task 11 production navigation slice: shared protected menu links dashboard, operations, catalog, content, members, loyalty, vouchers, rewards, and stored-value routes.
- [x] Task 11 feature-gated navigation: disabled stored-value is omitted from the production admin menu and dashboard actions.
- [x] Task 11 admin menu visibility: production dashboard actions use a responsive high-contrast grid so all links remain readable at desktop/mobile widths.
- [x] Task 11 local protection/UI slice: all focused admin routes redirect without a production session; demo admin keyboard navigation and 375px overflow pass.
- [x] Task 11 local feedback slice: admin action forms announce errors assertively and successes politely.
- [ ] Task 11 external verification: execute pgTAP and browser-check member/admin sessions against configured Supabase.
- [ ] Checkpoint D: Staff can act on real requests through authorized workflows.

## Phase 4: Release

- [x] Task 12 content/backend slice: event/blog schema, public production queries, deep links, metadata, not-found and loading/error states.
- [x] Task 12 discovery slice: canonical/Open Graph metadata, Product/Event/Blog/LocalBusiness JSON-LD, sitemap and robots policy.
- [ ] Task 12 final content verification: owner-approved assets/content remains open.
- [x] Task 12 no-JavaScript audit: home, menu, order, events, blog, and canonical deep-link navigation pass with JavaScript disabled.
- [x] Task 12 route shell slice: booking and contact retain client forms behind server metadata/canonical shells.
- [x] Task 12 commerce shell slice: cart and checkout retain client interactions behind private server metadata shells; route pages are no longer full Client Components.
- [x] Task 13 local implementation: focus trap/return, keyboard navigation, status announcements, responsive route smoke tests, screenshots, optimized catalog/content media, and the legacy admin product modal.
- [x] Task 13 action feedback slice: member/admin form errors use alert semantics and successful actions use polite status announcements.
- [ ] Task 13 external audit: screen reader/WCAG scan, Core Web Vitals, and authenticated account/admin keyboard workflows.
- [x] Task 14 local implementation: bounded correlation logging, support references, health endpoint, security headers, CI quality/E2E/database jobs, and release runbook.
- [x] Task 14 local verification: 193 unit/contract tests, production build, lint, type check, 30/36 full demo E2E tests, 6/6 focused member/admin demo E2E tests, and 2/4 order/checkout E2E tests pass locally; protected admin-route redirects, bounded member/admin pagination, account deep-link, public no-JavaScript navigation, and dynamic external-image strategy checks pass; 6 provider-gated E2E tests remain skipped without hosted credentials.
- [ ] Task 14 hosted verification: run CI database job/pgTAP, provider callbacks, and staging smoke test with owner credentials; hosted migrations are applied through `20260810073000`.
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
