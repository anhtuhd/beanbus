# Implementation Plan: Beanbus Production Readiness

**Updated:** 2026-08-09  
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
- `npm run build` passes and emits 15 application routes.

### Required findings

| Priority | Finding | Evidence | Required outcome |
|---|---|---|---|
| P0 | Payment can be marked paid from the browser, then award points and clear the cart. | `components/ui/SepayQRModal.tsx` | Only a verified, idempotent server webhook may mark a payment paid or award value. |
| P0 | Authentication is simulated; any OTP with at least four characters logs in as the demo user. | `context/AuthContext.tsx` | Replace with real server-backed authentication and protected sessions. |
| P0 | `/admin` has no authentication or authorization guard and mutates operational state in the browser. | `app/admin/page.tsx` | Enforce server-side admin role checks and persist mutations through authorized APIs. |
| P0 | User, points, orders, bookings, and store settings trust editable `localStorage`. | `context/*.tsx` | Keep only non-sensitive preferences/cart drafts client-side; server owns business records. |
| P1 | COD awards member credit immediately when an order is placed, before payment/completion. | `app/order/checkout/page.tsx` | Award loyalty value once, after an eligible paid/completed transition. |
| P1 | Confirmation trusts `?paid=true` and fabricates a fallback order when an ID is unknown. | `app/order/confirmation/[id]/page.tsx` | Load an authorized order from the server and show not-found/forbidden states. |
| P1 | Booking, contact, event RSVP, and B2B quote forms show success without delivering data. | `app/booking`, `app/contact`, `app/events`, `app/page.tsx` | Persist or deliver submissions, validate server-side, and expose real failure states. |
| P1 | Header/account links point to missing `/account/topup` and `/flash-sale` routes; planned detail routes are also absent. | `components/layout/Header.tsx` | Remove premature links or implement the routes only when their backing flow exists. |
| P1 | Lint gate fails with 14 errors and 63 warnings; there are no application tests. | `npm run lint`, repository inventory | Restore a green lint gate and add focused unit/integration plus critical E2E coverage. |
| P2 | Every page is a Client Component; page-level metadata, server rendering, and content SEO are limited. | `app/**/page.tsx` | Make static/content shells server-rendered and isolate only interactive islands as clients. |
| P2 | Remote `<img>` usage is unoptimized and image hosts are not configured. | 20 occurrences across pages/components | Define an image strategy and convert above-the-fold/product content where beneficial. |

### Current progress estimate

- UI prototype: about 75% complete.
- Functional demo: about 60% complete.
- Production backend/security: about 10% complete.
- Automated quality and launch readiness: about 15% complete.
- Overall production readiness: about 30%.

These percentages describe readiness, not lines of code. Existing UI is useful and should be retained; the main remaining work is trusted data flow and verification.

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
- No secrets, service-role keys, or personal data are committed or logged.

## 6. Task Plan

### Phase 0: Stabilize the Prototype

## Task 1: Restore the quality baseline

**Description:** Fix current ESLint errors, remove unused code that obscures review, and make route behavior honest while the app is still a demo.

**Acceptance criteria:**
- [x] `npm run lint` exits successfully; the remaining 19 image optimization warnings are assigned to Task 13.
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
- [ ] Repository has a `test` script for business logic and an E2E script for critical browser flows. Unit test script is complete; E2E remains.
- [x] `.env.example` lists names only, and server startup fails clearly when required production variables are missing.
- [x] CI-ready unit-test commands do not depend on a developer's persisted browser or `localStorage` state.

**Verification:**
- [x] Run the new unit test command against at least one pricing or status-transition test.
- [ ] Run one smoke E2E test for menu -> cart -> checkout shell.

**Dependencies:** Task 1  
**Estimated scope:** Medium, 3-5 files.

### Checkpoint A

- [ ] Type check, lint, unit smoke, E2E smoke, and production build are green.
- [ ] Owner approves Supabase, authentication methods, and the Sepay production path before external integration work begins.

### Phase 1: Trusted Data Foundation

## Task 3: Add Supabase server/browser infrastructure

**Description:** Configure Supabase clients using the Next.js 16 guidance, cookie-backed server sessions, typed environment access, and a migration workflow. This task does not yet migrate feature data.

**Acceptance criteria:**
- [ ] Browser, server, and privileged clients are separated; service-role access cannot enter the client bundle.
- [ ] Session refresh/cookie handling follows the installed Next.js and Supabase documentation.
- [ ] A repeatable migration command and local/preview setup are documented.

**Verification:**
- [ ] Automated test proves public and server client construction with valid/invalid environment states.
- [ ] Build output contains no service-role secret and authenticated session cookies are `httpOnly`, `secure` in production, and `sameSite`.

**Dependencies:** Task 2; owner approval/credentials  
**Estimated scope:** Medium, 3-5 files.

## Task 4: Ship real authentication and role authorization

**Description:** Replace demo OTP/Google login with Supabase Auth, add profiles and roles, protect account ownership, and protect admin routes on the server.

**Acceptance criteria:**
- [ ] Phone OTP and/or Google login uses the approved provider and persists no auth token in `localStorage`.
- [ ] Account routes require a session; admin routes require an admin role in both route access and mutation authorization.
- [ ] RLS tests prove users cannot read another member's profile/orders/points and non-admins cannot mutate store data.

**Verification:**
- [ ] Test unauthenticated, member, and admin access paths.
- [ ] Manually verify login, logout, expired session, and forbidden admin navigation.

**Dependencies:** Task 3  
**Estimated scope:** Split into auth shell and authorization/RLS subtasks, each Medium.

## Task 5: Migrate the catalog and complete product details

**Description:** Move categories, products, and product options from TypeScript seed data to PostgreSQL, retain the existing filters/customizer, and add `/menu/[id]` as a server-backed detail route.

**Acceptance criteria:**
- [ ] Menu and product detail use server-fetched catalog data with loading, empty, unavailable, and not-found states.
- [ ] Product options and availability are represented by typed records and seeded from the current catalog.
- [ ] `/menu/[id]` exposes product metadata and can add a valid configuration to the existing cart draft.

**Verification:**
- [ ] Test catalog mapping and option-price display with seeded data.
- [ ] Browser-check menu filters, detail deep links, customizer, and add-to-cart at all target widths.

**Dependencies:** Task 3  
**Estimated scope:** Split migration/read model and UI route into two Medium subtasks.

### Checkpoint B

- [ ] Auth, role enforcement, catalog queries, and catalog UI pass automated and browser checks.
- [ ] Static product data remains only as migration seed/fixture, not a runtime source of truth.

### Phase 2: Commerce and Payments

## Task 6: Create server-priced orders

**Description:** Add order/order-item/voucher persistence and a server action or route that validates customer input and recalculates all commercial values from trusted catalog data.

**Acceptance criteria:**
- [ ] Client sends product IDs, option IDs, quantities, fulfillment details, and voucher code; server returns canonical prices/totals.
- [ ] Invalid options, unavailable products, stale prices, expired vouchers, excessive quantities, and malformed contact data are rejected.
- [ ] Order creation is idempotent and generates a collision-safe ID plus a readable order number.

**Verification:**
- [ ] Unit/integration tests cover pricing, voucher bounds, duplicate submission, and unavailable products.
- [ ] E2E test covers menu -> cart -> checkout -> pending order for pickup and delivery.

**Dependencies:** Tasks 4 and 5  
**Estimated scope:** Split schema/rules, API, and checkout integration into Medium subtasks.

## Task 7: Integrate Sepay with an idempotent payment ledger

**Description:** Replace the browser simulation with server-generated payment instructions and a verified webhook that owns payment state transitions.

**Acceptance criteria:**
- [ ] QR details originate from a pending server payment linked to one order and expire according to an explicit policy.
- [ ] Webhook authentication/signature or approved Sepay verification is enforced; amount/reference mismatches are rejected.
- [ ] Duplicate webhook delivery has no duplicate payment, points, inventory, or notification side effects.

**Verification:**
- [ ] Integration tests cover valid, invalid, mismatched, duplicate, and out-of-order webhook events.
- [ ] E2E test proves the UI cannot mark itself paid and reflects server payment state after a verified event.

**Dependencies:** Task 6; Sepay credentials and current official integration contract  
**Estimated scope:** Split ledger/webhook and UI status integration into Medium subtasks.

## Task 8: Implement the loyalty ledger and member account

**Description:** Replace mutable point balances with an append-only points ledger derived from eligible order/payment events, then connect profile, order history, vouchers, and reorder UI to authorized server data.

**Acceptance criteria:**
- [ ] Point balance equals the ledger sum; every credit/debit has a source, actor, timestamp, and idempotency key.
- [ ] COD earns rewards only after the approved completion/payment transition; cancelled/refunded orders cannot retain rewards.
- [ ] Account screens show only the signed-in member's profile, transactions, orders, and vouchers with pagination/empty states.

**Verification:**
- [ ] Tests cover earn, redeem, cancellation/reversal, duplicate event, insufficient balance, and ownership.
- [ ] Browser-check account login redirect, history, voucher state, and reorder behavior.

**Dependencies:** Tasks 4, 6, and 7  
**Estimated scope:** Split ledger rules/API and account UI into Medium subtasks.

## Task 9: Add safe top-up and flash-sale purchase flows

**Description:** Implement `/account/topup` and `/flash-sale` only after the payment ledger is live. Reuse the payment transaction path and enforce package inventory and campaign dates on the server.

**Acceptance criteria:**
- [ ] Top-up credits points only after a verified payment event and exactly once.
- [ ] Flash-sale eligibility, dates, quota, price, and bonus are server-controlled and transactionally reserved/consumed.
- [ ] Routes show pending, expired, sold-out, paid, and failed states without client-side balance mutation.

**Verification:**
- [ ] Tests cover duplicate payment, expired/sold-out package, quota race, and amount mismatch.
- [ ] E2E test covers creating a top-up and receiving credit after a simulated verified server event.

**Dependencies:** Tasks 7 and 8  
**Estimated scope:** Split top-up and campaign purchase into Medium subtasks.

### Checkpoint C

- [ ] A user can place and pay for an order without any trusted amount/status coming from the browser.
- [ ] Payment and points replay tests pass; audit records explain every balance change.

### Phase 3: Operations and Customer Requests

## Task 10: Deliver booking, contact, RSVP, and B2B quote submissions

**Description:** Convert the four success-only forms into validated server submissions. Store requests first; add outbound email/SMS only after a provider is approved.

**Acceptance criteria:**
- [ ] Each form validates field shape/length, rate-limits abuse, persists consent-aware contact data, and returns a real reference ID.
- [ ] Booking begins as `pending` unless an explicit capacity rule confirms it; no UI claims an SMS/Zalo was sent unless delivery succeeded.
- [ ] Admin can view and update request status through authorized operations.

**Verification:**
- [ ] Tests cover validation, rate limiting, duplicate submission, capacity conflict, and authorization.
- [ ] Browser-check loading, success, validation, network failure, and retry states for each form.

**Dependencies:** Tasks 3 and 4  
**Estimated scope:** Split booking and lead/RSVP forms into separate Medium subtasks.

## Task 11: Replace the demo admin page with protected operations

**Description:** Split the single admin demo into focused dashboard, orders, catalog, bookings/leads, members, events, and blog routes backed by authorized server mutations.

**Acceptance criteria:**
- [ ] Admin pages are unreachable to anonymous/member users and every mutation repeats authorization server-side.
- [ ] Order and booking state transitions follow explicit allowed-transition rules with actor/audit history.
- [ ] Lists support search/filter/pagination and remain usable on mobile without relying on wide tables alone.

**Verification:**
- [ ] Authorization and state-machine tests cover forbidden and invalid transitions.
- [ ] Browser-check desktop/mobile admin workflows with an admin and a non-admin session.

**Dependencies:** Tasks 4, 5, 6, 8, and 10  
**Estimated scope:** Deliver one admin vertical slice per focused session.

### Checkpoint D

- [ ] Customer submissions arrive in the database and are actionable by authorized staff.
- [ ] Admin operations are audited, paginated, responsive, and protected at route and mutation boundaries.

### Phase 4: Content, UX, and Release

## Task 12: Complete content routes and server-rendered SEO

**Description:** Add `/events/[id]`, make blog/event content server-backed, add not-found handling and page metadata, and convert static page shells to Server Components where practical.

**Acceptance criteria:**
- [ ] Product, event, and blog detail deep links render useful indexed content with canonical metadata and not-found behavior.
- [ ] Sitemap, robots policy, Open Graph assets, and local business/product/event structured data reflect production URLs/content.
- [ ] Client Components are limited to interactive islands; Vietnamese canonical content remains available without client JavaScript.

**Verification:**
- [ ] Build route output and generated metadata are inspected for representative pages.
- [ ] Validate structured data and check no stale placeholder domain/content remains.

**Dependencies:** Tasks 5 and 10; content ownership decision  
**Estimated scope:** Split content model/routes and SEO infrastructure into Medium subtasks.

## Task 13: Close accessibility, responsive, and performance gaps

**Description:** Finish modal/drawer focus management, keyboard navigation, form semantics, responsive admin/data views, and image/loading performance.

**Acceptance criteria:**
- [ ] Header menus, dialogs, cart drawer, customizer, and Sepay dialog support keyboard, Escape, focus trap/return, and accessible names/status announcements.
- [ ] No overlap or horizontal overflow at 375, 768, and 1440 px; admin data remains scannable on mobile.
- [ ] Above-the-fold and catalog media use an approved optimized image strategy with stable dimensions.

**Verification:**
- [ ] Run automated accessibility checks on critical routes and manually complete keyboard-only order/account/admin flows.
- [ ] Capture responsive screenshots and inspect console/network errors and Core Web Vitals baseline.

**Dependencies:** Feature UI tasks complete  
**Estimated scope:** Deliver per workflow in Medium subtasks.

## Task 14: Add observability and pass the release gate

**Description:** Add privacy-aware error/transaction logging, deployment checks, backup/rollback notes, and a final browser regression suite.

**Acceptance criteria:**
- [ ] Order/payment/webhook/admin failures have correlation IDs and actionable logs without secrets or full PII.
- [ ] CI runs type check, lint, tests, production build, and critical E2E against an isolated environment.
- [ ] Deployment runbook covers environment variables, migrations, webhook setup, smoke checks, backup, rollback, and incident contacts.

**Verification:**
- [ ] Run the complete CI command set from a clean install against the committed lockfile.
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
