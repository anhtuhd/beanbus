# Implementation Plan: Beanbus Production Readiness

**Updated:** 2026-08-10
**Status:** In progress  
**Supersedes:** The Antigravity implementation plan as the active execution plan. The old plan remains a scope reference.

## 1. Objective

Turn the current Beanbus UI prototype into a production-ready website for marketing, ordering, reservations, membership, and store operations. Preserve the existing visual language and completed screens, but move all trusted business state to the server before adding money-moving or admin features.

## 2. Baseline Review

### What already works

- Next.js 16.3 App Router project with TypeScript, CSS Modules, shared layout, responsive navigation, bilingual UI toggle, and Lucide icons.
- Public UI exists for home, about, menu, ordering, cart, checkout, confirmation, booking, events, blog, contact, account, and admin.
- Product customization, cart persistence, voucher demo, order/booking demo, membership demo, and Sepay QR demo are clickable end to end.
- `npx tsc --noEmit` passes.
- `npm run build` passes and emits 32 application and metadata routes.

### Original findings and resolution targets

| Priority | Finding | Evidence | Required outcome |
|---|---|---|---|
| P0 | Payment can be marked paid from the browser, then award points and clear the cart. | `components/ui/SepayQRModal.tsx` | Only a verified, idempotent server webhook may mark a payment paid or award value. |
| P0 | Authentication is simulated; any OTP with at least four characters logs in as the demo user. | `context/AuthContext.tsx` | Replace with real server-backed authentication and protected sessions. |
| P0 | `/admin` has no authentication or authorization guard and mutates operational state in the browser. | `app/admin/page.tsx` | Enforce server-side admin role checks and persist mutations through authorized APIs. |
| P0 | User, points, orders, bookings, and store settings trust editable `localStorage`. | `context/*.tsx` | Keep only non-sensitive preferences/cart drafts client-side; server owns business records. |
| P1 | COD awards member credit immediately when an order is placed, before payment/completion. | `app/order/checkout/page.tsx` | Award loyalty value once, after an eligible paid/completed transition. |
| P1 | Confirmation trusts `?paid=true` and fabricates a fallback order when an ID is unknown. | `app/order/confirmation/[id]/page.tsx` | Load an authorized order from the server and show not-found/forbidden states. |
| P1 | Booking, contact, event RSVP, and B2B quote forms show success without delivering data. | `app/booking`, `app/contact`, `app/events`, `app/page.tsx` | Persist or deliver submissions, validate server-side, and expose real failure states. |
| P1 | Top-up and flash-sale routes must remain disabled until stored-value policy and payment-backed inventory rules are approved. | `app/account/topup`, `app/flash-sale`, `supabase/migrations/20260810060000_stored_value.sql` | Keep links hidden by default; require owner approval, hosted migration, and verified payment callbacks before enabling. |
| P1 | Lint gate originally failed with 14 errors and 63 warnings and had no application tests. | `npm run lint`, repository inventory | The current gate passes cleanly with focused unit/E2E coverage. |
| P2 | Every page is a Client Component; page-level metadata, server rendering, and content SEO are limited. | `app/**/page.tsx` | Make static/content shells server-rendered and isolate only interactive islands as clients. |
| P2 | Remote `<img>` usage is unoptimized and image hosts are not configured. | 20 occurrences across pages/components | Define an image strategy and convert above-the-fold/product content where beneficial. |

### Review status and current progress estimate

Production paths now isolate the intentionally client-only demo behavior. Server implementations exist for auth/role guards, catalog reads and operations, server-priced orders, Sepay verification, protected receipts, customer requests, admin operations, content/SEO, loyalty ledger, member redemption, and feature-gated stored value. The current local migration set is applied through `20260810073000` on hosted Supabase; pgTAP execution, provider credentials, policy sign-off, and staging verification remain open. Stored-value remains disabled by default.

- UI and responsive implementation: about 95% complete.
- Functional demo: about 90% complete.
- Production backend/security implementation: about 75% complete.
- Automated local quality and release readiness: about 85% complete.
- Hosted integration and staging verification: about 15% complete.
- Overall production readiness: about 70%.

These percentages describe release readiness, not lines of code. The highest-risk remaining work is hosted database/provider verification, loyalty policy, observability/CI, owner content/assets, and staging sign-off.

## 3. Scope Decisions

- Keep Next.js App Router, TypeScript, CSS Modules, existing design tokens, and Lucide React.
- Use Supabase PostgreSQL/Auth/Storage as proposed by the original plan, subject to owner approval and project credentials before implementation.
- Treat PostgreSQL as the source of truth for users, catalog, prices, vouchers, orders, payments, points, bookings, content, and admin settings.
- Keep `localStorage` only for anonymous cart drafts and low-risk display preferences. Server recalculates price, discount, stock, and totals at checkout.
- Use database-generated UUIDs plus a separate human-readable order number. Do not use random four-digit IDs as unique keys.
- Mark Sepay payments paid only after a verified webhook. The webhook must be idempotent and must match amount, transfer content/reference, and an existing pending transaction.
- Keep Vietnamese as the canonical indexed locale for the first production release. Retain the current English toggle, but do not add locale-prefixed routing until the owner explicitly requires separate English SEO URLs.
- Do not introduce a rich-text editor, charting library, or generalized design-system package in the first release. Use existing controls and simple structured content.

## 4. Dependency Order

```text
Phase 0 quality baseline
  -> Supabase/env foundation
     -> Auth + roles
     -> Catalog read model
        -> Server-priced orders
           -> Sepay payment + loyalty ledger
              -> Wallet/top-up/flash sale
     -> Booking/contact/RSVP
     -> Account views
     -> Protected admin operations
  -> Content/SEO/accessibility
  -> End-to-end release gate
```

## 5. Definition of Done

Every implementation task must meet all applicable items below before its checkbox is marked complete:

- Acceptance criteria are demonstrated with a focused automated test or an explicit manual check.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- New forms validate on the server and expose loading, success, empty, and failure states.
- Protected data has authentication, authorization, and ownership/RLS tests.
- Payment or points mutations are idempotent and auditable.
- Changed UI is checked at 375 px, 768 px, and 1440 px with keyboard navigation.
- No secrets, Supabase privileged keys, or personal data are committed or logged.

## 6. Task Plan

### Phase 0: Stabilize the Prototype

## Task 1: Restore the quality baseline

**Description:** Fix current ESLint errors, remove unused code that obscures review, and make route behavior honest while the app is still a demo.

**Acceptance criteria:**
- [x] `npm run lint` exits cleanly with no warnings.
- [x] Missing-route links are hidden or replaced with non-navigating unavailable states until their features ship.
- [x] Demo-only payment/auth/admin surfaces are visibly identified in development and cannot be mistaken for production behavior.

**Verification:**
- [x] Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- [x] Crawl all visible internal links and confirm no expected navigation returns 404.

**Dependencies:** None  
**Estimated scope:** Medium, split into focused lint and navigation changes.

## Task 2: Establish the test and environment contract

**Description:** Add the minimum test harness for pure business rules and browser-critical flows, plus a documented environment template with fail-fast validation.

**Acceptance criteria:**
- [x] Repository has a `test` script for business logic and an E2E script for critical browser flows.
- [x] `.env.example` lists names only, and server startup fails clearly when required production variables are missing.
- [x] CI-ready unit-test commands do not depend on a developer's persisted browser or `localStorage` state.

**Verification:**
- [x] Run the new unit test command against at least one pricing or status-transition test.
- [x] Run one smoke E2E test for menu -> cart -> checkout shell.

**Dependencies:** Task 1  
**Estimated scope:** Medium, 3-5 files.

### Checkpoint A

- [x] Type check, lint, unit smoke, E2E smoke, and production build are green.
- [x] Owner approved completing UI/server with Supabase and leaving third-party credentials feature-gated for later configuration.

### Phase 1: Trusted Data Foundation

## Task 3: Add Supabase server/browser infrastructure

**Description:** Configure Supabase clients using the Next.js 16 guidance, cookie-backed server sessions, typed environment access, and a migration workflow. This task does not yet migrate feature data.

**Acceptance criteria:**
- [x] Browser, server, and privileged clients are separated; the Supabase secret key cannot enter the client bundle.
- [x] Session refresh/cookie handling follows the installed Next.js and Supabase documentation.
- [x] A repeatable migration command and local/preview setup are documented.

**Verification:**
- [x] Automated tests prove public configuration validation, server client construction, and cookie policy.
- [x] Build output contains no Supabase secret key; authenticated cookies are `secure` in production and `sameSite=lax`.

Supabase SSR intentionally keeps auth cookies readable by its browser client so refresh-token rotation works; `HttpOnly` is therefore not part of this architecture. Authorization still relies on verified claims and RLS, never on cookie contents alone. See the [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide#how-do-i-make-the-cookies-httponly).

**Dependencies:** Task 2; owner-approved Supabase architecture. Hosted credentials remain deferred.
**Estimated scope:** Medium, 3-5 files.

## Task 4: Ship real authentication and role authorization

**Description:** Replace demo OTP/Google login with Supabase Auth, add profiles and roles, protect account ownership, and protect admin routes on the server.

**Implementation status:** Auth actions, OAuth callback, cookie-backed profile lookup, role guards, provider feature flags, profile migration, and deny-by-default profile RLS are implemented. Hosted provider login and pgTAP execution remain blocked on owner credentials and a Docker-compatible local runtime.

**Acceptance criteria:**
- [ ] Phone OTP and/or Google login uses the approved provider and persists no auth token in `localStorage`.
- [x] Account routes require a session; admin routes require an admin role. Production admin mutations remain absent until their server resources ship.
- [ ] RLS tests prove users cannot read another member's profile/orders/points and non-admins cannot mutate store data.

**Verification:**
- [x] Production-mode E2E proves anonymous account/admin requests redirect to the provider-gated login screen.
- [ ] Execute the written pgTAP member/admin profile tests against a Supabase runtime; add order/points/store cases with those schemas.
- [ ] Manually verify login, logout, expired session, and forbidden admin navigation.

**Dependencies:** Task 3  
**Estimated scope:** Split into auth shell and authorization/RLS subtasks, each Medium.

## Task 5: Migrate the catalog and complete product details

**Description:** Move categories, products, and product options from TypeScript seed data to PostgreSQL, retain the existing filters/customizer, and add `/menu/[id]` as a server-backed detail route.

**Implementation status:** Catalog schema/seed/RLS, typed production queries, mode-aware home/menu/order data, server-backed homepage best-seller and `/order` catalog rendering, loading/error/empty states, and product detail UI are implemented. The static fixture is used only in demo mode. Supabase runtime verification remains blocked on a Docker-compatible runtime and hosted credentials.

**Acceptance criteria:**
- [x] In production mode, menu and product detail use server-fetched catalog data with loading, empty, unavailable, and not-found states.
- [x] Product options and availability are represented by typed records and seeded from the current catalog.
- [x] `/menu/[id]` exposes product metadata and can add a valid configuration to the existing cart draft.

**Verification:**
- [x] Contract/unit tests cover catalog RLS structure, seed completeness, mapping, and option prices.
- [x] Browser-check menu filters, detail deep links, customizer, and add-to-cart at 375 px, 768 px, and 1440 px.
- [ ] Run catalog pgTAP and production queries against a configured Supabase runtime.

**Dependencies:** Task 3  
**Estimated scope:** Split migration/read model and UI route into two Medium subtasks.

### Checkpoint B

- [ ] Auth, role enforcement, catalog queries, and catalog UI pass automated and browser checks.
- [ ] Static product data remains only as migration seed/fixture, not a runtime source of truth.

### Phase 2: Commerce and Payments

## Task 6: Create server-priced orders

**Description:** Add order/order-item/voucher persistence and a server action or route that validates customer input and recalculates all commercial values from trusted catalog data.

**Implementation status:** The private order/voucher schema, idempotent `create_server_priced_order` transaction, narrow input parser, provider-gated Next.js Server Action, production checkout wiring, and capability-protected server receipt are implemented. Demo checkout remains isolated; production exposes only configured payment methods. Database execution remains blocked on a Docker-compatible runtime or hosted Supabase credentials.

**Acceptance criteria:**
- [x] Client sends product IDs, option IDs, quantities, fulfillment details, and voucher code; server returns canonical prices/totals.
- [x] The database transaction rejects invalid options, unavailable products, expired/exhausted vouchers, excessive quantities, and malformed fulfillment/contact data.
- [x] Order creation is idempotent and generates a collision-safe UUID plus a readable identity number.

**Verification:**
- [x] Contract tests cover pricing ownership, voucher bounds, idempotency, and catalog trust boundaries.
- [ ] Run the written pgTAP pricing, duplicate submission, and unavailable-product cases on Supabase.
- [x] Browser tests cover demo menu -> cart -> checkout -> COD confirmation, responsive checkout, and production payment-method gating.
- [ ] Run production pickup/delivery creation and receipt retrieval against a configured Supabase runtime.

**Dependencies:** Tasks 4 and 5  
**Estimated scope:** Split schema/rules, API, and checkout integration into Medium subtasks.

## Task 7: Integrate Sepay with an idempotent payment ledger

**Description:** Replace the browser simulation with server-generated payment instructions and a verified webhook that owns payment state transitions.

**Implementation status:** The service-only payment ledger/RPC, HMAC raw-body Route Handler, deduplicated webhook event audit, 30-minute VietQR instructions, production polling UI, and provider gating are implemented. Applying pgTAP and exercising Sepay Test mode/Live remain blocked on external runtime and owner credentials.

**Acceptance criteria:**
- [x] QR details originate from a pending server payment linked to one order and expire according to an explicit policy.
- [x] HMAC-SHA256, timestamp freshness, inbound direction, destination account, payment code, amount, and expiry are enforced.
- [x] Duplicate webhook delivery has no duplicate payment, points, inventory, or notification side effects.

**Verification:**
- [x] Unit/contract tests cover valid/invalid HMAC, malformed payloads, route ordering, and trusted matching rules; pgTAP covers valid, mismatched, duplicate, outbound, and expired events.
- [x] Browser tests prove Sepay UI is absent when disabled and available only after server configuration is enabled.
- [ ] Run pgTAP and an end-to-end Sepay Test mode transfer to prove the UI reflects a verified server event.

**Dependencies:** Task 6; Sepay credentials and current official integration contract  
**Estimated scope:** Split ledger/webhook and UI status integration into Medium subtasks.

## Task 8: Implement the loyalty ledger and member account

**Description:** Replace mutable point balances with an append-only points ledger derived from eligible order/payment events, then connect profile, order history, vouchers, and reorder UI to authorized server data.

**Implementation status:** Member profile editing, server-owned production order history with server-counted pagination totals, protected order/request detail pages, detail-page reorder with catalog availability checks, member-owned booking/customer request history and status timeline, owned booking and customer-request cancellation with locked/audited RPCs and written pgTAP coverage, active voucher reads, paginated order history, server-validated reorder, direct voucher-to-cart handoff, append-only ledger with member transaction history, idempotent order earn/reversal trigger, policy audit/configuration UI, voucher administration, reward catalog administration, owned voucher issuance, idempotent point redemption, production summary/redeem UI, and an explicit production rewards empty state are implemented. The hosted migration is applied through `20260810073000`; owner policy sign-off, pgTAP execution, and hosted runtime verification remain open.

**Acceptance criteria:**
- [x] Point balance equals the ledger sum; every credit/debit has a source, actor, timestamp, and idempotency key.
- [x] COD earns rewards only after the configured completion/payment transition; cancelled/refunded orders cannot retain rewards.
- [x] Account screens show only the signed-in member's profile, transactions, orders, rewards, and vouchers with pagination/empty states.

**Verification:**
- [x] Contract tests cover earn, redeem, cancellation/reversal, duplicate event, insufficient balance, and ownership.
- [x] Member and admin list pagination is bounded server-side at 100 pages to prevent unbounded URL offsets.
- [x] Demo browser-check covers account tabs, profile update, booking-request history, booking cancellation, voucher handoff, selected-tab deep links, and demo booking status changes.
- [x] Production member booking cancellation uses an owned server action/RPC from both request list and detail views, with accessible pending/success/error feedback.
- [x] Production member customer requests can be withdrawn while `pending/in_progress`; cancellation is audited and exposed in list/detail views with status feedback.
- [ ] Hosted browser-check covers account login redirect, production history, voucher state, and reorder behavior.

**Dependencies:** Tasks 4, 6, and 7  
**Estimated scope:** Split ledger rules/API and account UI into Medium subtasks.

## Task 9: Add safe top-up and flash-sale purchase flows

**Description:** Implement `/account/topup` and `/flash-sale` only after the payment ledger is live. Reuse the payment transaction path and enforce package inventory and campaign dates on the server.

**Implementation status:** Feature-gated `/account/topup` and `/flash-sale` routes, server-created intents, separate stored-value payment records, idempotent Sepay webhook credit, flash-sale quota reservation, member polling UI, and admin policy/package/campaign controls are implemented. Member links and admin navigation/dashboard links now stay hidden unless both stored-value and Sepay deployment flags are enabled. The policy and deployment flag default to disabled; the hosted migration is applied, while policy approval and real Sepay verification remain open.

**Acceptance criteria:**
- [x] Top-up credits points only after a verified payment event and exactly once.
- [x] Flash-sale eligibility, dates, quota, price, and bonus are server-controlled and transactionally reserved/consumed.
- [x] Routes show pending, expired, sold-out, paid, and failed states without client-side balance mutation.

**Verification:**
- [x] Contract and pgTAP tests cover duplicate payment boundaries, expiration, quota reservation, amount matching, server-only payment creation, authorization, and verified webhook credit; database execution remains external.
- [x] Demo E2E proves the routes stay disabled and the admin route remains protected without production credentials.

**Dependencies:** Tasks 7 and 8; owner-approved stored-value policy and Sepay contract
**Estimated scope:** Split top-up and campaign purchase into Medium subtasks.

### Checkpoint C

- [ ] A user can place and pay for an order without any trusted amount/status coming from the browser.
- [ ] Payment and points replay tests pass; audit records explain every balance change.

### Phase 3: Operations and Customer Requests

## Task 10: Deliver booking, contact, RSVP, and B2B quote submissions

**Description:** Convert the four success-only forms into validated server submissions. Store requests first; add outbound email/SMS only after a provider is approved.

**Implementation status:** Booking, contact, RSVP, and B2B quote submissions are implemented with discriminated server validation, pending-only idempotent RPCs, serialized phone rate limiting, consent storage, private member/admin RLS, honest reference receipts, member-owned withdrawal for active customer requests, responsive loading/error/retry states, protected admin operations, admin-visible notification delivery state, notification-failure filtering, an all-sources request view, and protected detail drill-down. RSVP event existence, open-window, and capacity enforcement now run server-side under a per-event advisory lock; applying pgTAP against Supabase, configuring a notification provider, and owner approval of the broader booking capacity policy remain open.

**Acceptance criteria:**
- [x] Each form validates field shape/length, rate-limits abuse, persists consent-aware contact data, and returns a real reference ID.
- [x] Booking begins as `pending` unless an explicit capacity rule confirms it; no UI claims an SMS/Zalo was sent unless delivery succeeded.
- [x] Admin can view and update request status through authorized operations.

**Verification:**
- [x] Contract tests cover validation, rate limiting, duplicate submission, capacity conflict, and authorization; hosted pgTAP execution remains open.
- [x] Browser-check loading, success, validation, network failure, and retry states for each form.

Contract/unit tests cover discriminated validation, serialized rate limiting, idempotency, RSVP capacity conflict handling, and RLS structure for every form. Written pgTAP covers valid contact/RSVP/B2B submissions plus member/admin authorization. Browser E2E covers each demo success receipt, 375 px layouts, and production loading/network-failure/retry behavior. Hosted execution and configured production success remain deferred until the owner confirms capacity rules and Supabase is available.

**Dependencies:** Tasks 3 and 4  
**Estimated scope:** Split booking and lead/RSVP forms into separate Medium subtasks.

## Task 11: Replace the demo admin page with protected operations

**Description:** Split the single admin demo into focused dashboard, orders, catalog, bookings/leads, members, events, and blog routes backed by authorized server mutations.

**Implementation status:** Production request, order list/detail, catalog, content, member directory/detail, member-role, loyalty-policy, reward-catalog, voucher, safe catalog archive, and dashboard notification-failure visibility are implemented at their focused admin routes: guarded narrow queries, shared production navigation with stored-value feature gating, request status filters including member-cancelled leads, search/filters, bounded pagination, responsive rows, protected request/member/order drill-down, line-item and status-history views, notification delivery visibility, `useActionState` feedback with assertive error and polite success announcements, locked RPCs, payment-boundary enforcement, historical-reference preservation, actor/system audit history, and an explicit demo-mode warning for the legacy browser fixture. The demo fixture also supports booking status updates, while hosted migration execution and browser verification against the configured Supabase project remain open.

**Acceptance criteria:**
- [x] Admin routes call the server role guard and every mutation repeats authorization in both Server Action and locked RPC boundaries.
- [x] Order and booking state transitions follow explicit allowed-transition rules with actor/audit history.
- [x] Lists support search/filter/pagination and remain usable on mobile without relying on wide tables alone.

**Verification:**
- [x] Contract tests and written pgTAP cover forbidden access, invalid transitions, idempotency, and audit records; pgTAP execution remains external verification.
- [x] Local browser checks cover shared production admin navigation contracts, admin demo keyboard/mobile tabs, demo booking status updates, and all production admin route redirects when no provider session exists.
- [ ] Browser-check desktop/mobile admin workflows with an admin and a non-admin session.

**Dependencies:** Tasks 4, 5, 6, 8, and 10  
**Estimated scope:** Deliver one admin vertical slice per focused session.

### Checkpoint D

- [ ] Customer submissions arrive in the database and are actionable by authorized staff.
- [ ] Admin operations are audited, paginated, responsive, and protected at route and mutation boundaries.

### Phase 4: Content, UX, and Release

## Task 12: Complete content routes and server-rendered SEO

**Description:** Add `/events/[id]`, make blog/event content server-backed, add not-found handling and page metadata, and convert static page shells to Server Components where practical.

**Implementation status:** Event/blog content schema, public-only RLS, production query layer, seeded current content, `/events/[id]`, real blog not-found behavior, loading/error states, canonical/Open Graph metadata for content routes including the server-shell About, Booking, Contact, Cart, and Checkout pages, Product/Event/Blog/LocalBusiness JSON-LD, dynamic sitemap, robots policy, audited publication controls, and audited event/blog create/edit are implemented. Public listing loading boundaries are isolated in route groups, while event/blog/product detail pages now include server-rendered Vietnamese fallbacks that preserve no-JavaScript deep-link navigation; owner-approved final assets/content and a full client-component/island audit remain open.

**Acceptance criteria:**
- [x] Product, event, and blog detail deep links render useful indexed content with canonical metadata and not-found behavior.
- [x] Sitemap, robots policy, Open Graph assets, and local business/product/event structured data derive URLs from production configuration and published content.
- [x] Route pages are Server Components with client behavior isolated to interactive islands; Vietnamese canonical content remains available without client JavaScript on public discovery routes.

**Verification:**
- [x] Build route output plus representative product/event/blog canonical metadata, JSON-LD, sitemap, robots, 404s, and 375 px overflow are browser-tested.
- [ ] Validate structured data and check no stale placeholder domain/content remains.

**Dependencies:** Tasks 5 and 10; content ownership decision  
**Estimated scope:** Split content model/routes and SEO infrastructure into Medium subtasks.

## Task 13: Close accessibility, responsive, and performance gaps

**Description:** Finish modal/drawer focus management, keyboard navigation, form semantics, responsive admin/data views, and image/loading performance.

**Implementation status:** Shared dialog focus management now covers Escape, focus trap/return, scroll lock, accessible names, and status announcements, including the legacy admin product modal. Header dropdown/mobile navigation is keyboard-operable. Action forms across member and admin workflows announce failures assertively and successes politely. Public routes and the admin demo pass 375/768/1440 overflow checks, and catalog/content/account/admin/payment media uses `next/image` with stable dimensions; external provider images are explicitly marked unoptimized where the URL is dynamic.

**Acceptance criteria:**
- [x] Header menus, dialogs, cart drawer, customizer, and Sepay dialog support keyboard, Escape, focus trap/return, and accessible names/status announcements.
- [x] Representative public/admin views have no horizontal overflow at 375, 768, and 1440 px; the mobile admin fixture remains scannable.
- [x] Above-the-fold and catalog media use the Next.js 16 image strategy with stable dimensions and explicit LCP loading.

**Verification:**
- [x] Automated keyboard checks cover header, cart, customizer, RSVP, B2B, gallery, and Sepay dialogs.
- [x] Responsive screenshots cover home/admin plus order, booking, and request workflows; the browser suite exposed and now guards a broken catalog image URL.
- [x] Member/admin action feedback uses accessible alert/status semantics for error and success states.
- [ ] Complete a screen-reader/automated WCAG scan, Core Web Vitals baseline, and keyboard-only account/admin workflow with configured member/admin sessions.

**Dependencies:** Feature UI tasks complete  
**Estimated scope:** Deliver per workflow in Medium subtasks.

## Task 14: Add observability and pass the release gate

**Description:** Add privacy-aware error/transaction logging, deployment checks, backup/rollback notes, and a final browser regression suite.

**Implementation status:** Bounded structured failure logging, request correlation propagation, support references, an uncached health endpoint, baseline browser security headers, deterministic demo/production Playwright environment selection, GitHub Actions quality/E2E/database jobs, and a deployment/rollback runbook are implemented. Hosted Supabase/provider execution and final staging sign-off remain owner-controlled.

**Acceptance criteria:**
- [x] Order/payment/webhook/admin failures have correlation IDs and actionable logs without secrets or full PII.
- [x] CI runs type check, lint, tests, production build, dependency audit, critical E2E, and local database checks.
- [x] Deployment runbook covers environment variables, migrations, webhook setup, smoke checks, backup, rollback, and incident contacts.

**Verification:**
- [x] Local gates pass: 193 unit/contract tests, lint, type check, production build, 30/36 full demo E2E tests, 6/6 focused member/admin demo E2E tests, 2/4 order/checkout E2E tests with 2 provider-gated skips, protected admin-route redirect checks, bounded member/admin pagination checks, stored-value disabled-route E2E, selected-tab account deep link, public no-JavaScript navigation, and dynamic external-image strategy checks; 6 provider-gated tests remain skipped.
- [ ] Run the complete CI command set from a clean install against the committed lockfile, execute hosted database checks, and record the migration revision already applied through `20260810073000`.
- [ ] Execute a staging smoke test for auth, order, payment callback, booking, account, and admin authorization.

**Dependencies:** Tasks 1-13  
**Estimated scope:** Split instrumentation, CI, and release runbook into Small/Medium subtasks.

### Final Checkpoint

- [ ] All Definition of Done items pass in staging.
- [ ] No P0/P1 review findings remain.
- [ ] Owner signs off on content, real transaction test, data retention, and production launch.

## 7. Parallelization

After Checkpoint A and API contracts are fixed:

- Catalog UI and booking/contact backend can run in parallel.
- Content routes/SEO can run alongside order backend work if shared data contracts are already defined.
- Accessibility can be reviewed incrementally after each stable feature slice.
- Payment, loyalty, and wallet work must remain sequential because they share the same transaction ledger and idempotency rules.
- Admin feature work starts only after the underlying customer-facing resource and authorization policy exist.

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Prototype behavior accidentally ships as real auth/payment | Critical | Block production with environment validation; remove client success controls; require server verification tests. |
| Client price or voucher tampering | High | Recalculate all totals from database records in one server transaction. |
| Duplicate Sepay webhooks create duplicate value | Critical | Unique provider reference, idempotency key, transactional state transition, replay tests. |
| RLS or admin role mistake leaks customer data | Critical | Deny-by-default RLS, separate admin policy tests, server authorization on every mutation. |
| Scope grows through admin/content tooling | Medium | Ship minimal structured forms and tables; defer rich editors/charts. |
| Remote placeholder images fail or hurt LCP | Medium | Define owned assets and image domains before launch; migrate priority media first. |
| English toggle conflicts with SEO expectations | Medium | Treat VI as canonical for v1; decide locale URLs before building a routing layer. |

## 9. Owner Decisions Required

1. Confirm Supabase as the production database/auth provider and provide project access through the approved secret-management path.
2. Choose production login methods: phone OTP, Google, or both; confirm the SMS provider/cost for phone OTP.
3. Provide the current official Sepay webhook/API contract, production bank account, credentials, refund policy, and payment timeout.
4. Confirm the loyalty rule: earning rate, when COD becomes eligible, expiry, refund reversal, and whether points represent stored monetary value.
5. Confirm whether top-up/flash-sale wallet is legally and operationally in scope for v1; it should be deferred if stored-value obligations are unclear.
6. Confirm branch/capacity rules for bookings and who receives contact, RSVP, and B2B leads.
7. Provide owned logo, photography, social links, domain, privacy policy, and terms; or approve a separate asset/content task.
8. Confirm whether English needs separate indexable URLs or remains a convenience toggle for v1.

## 10. Explicitly Deferred Until Approved

- Stored-value top-ups and flash-sale bonuses before payment/loyalty policy approval.
- Automatic SMS/Zalo/email sending before a provider and consent/retention policy are approved.
- Multi-branch inventory, delivery-provider integration, refunds, rich-text editing, analytics charts, and locale-prefixed routing.
- Production deployment before Supabase RLS, Sepay replay tests, and admin authorization checks pass.
