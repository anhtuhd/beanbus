# Beanbus To-do

**Plan:** `tasks/plan.md`

**Cập nhật:** 2026-08-13

**Ưu tiên hiện tại:** performance hardening deploy -> notification fan-out đã apply -> deploy Resend safely -> hosted member/admin smoke.

## Trạng thái đã xác minh local

- [x] `npm run lint` pass.
- [x] `npx tsc --noEmit` pass.
- [x] `npm test` pass 295/295.
- [x] `npm run build` pass.
- [x] `npm run test:e2e:auth` pass 4/4 với Google enabled và phone disabled ở 375/768/1440px.
- [x] `npm run test:e2e` pass 33/43; 10 suite production/provider được skip đúng khi thiếu credential.
- [x] E2E customer requests pass 4/4; RSVP modal đã được port ra `document.body` để không bị ảnh hưởng bởi transform của event card.
- [x] E2E accessibility header/menu pass ổn định sau khi chuyển focus keyboard bằng `requestAnimationFrame` và chạy lặp 20 lần.
- [x] Thêm live smoke opt-in `npm run test:e2e:live`; test sẽ kiểm tra health và Google-only login trên `https://www.beanbus.store`.
- [x] Đã chạy live smoke production sau redeploy; health và assertion Google-only đều pass `1/1`.
- [x] Thêm GitHub Actions manual live smoke (`workflow_dispatch`) với `production_base_url`, bắt buộc HTTPS, không yêu cầu Gmail session hay production secret.
- [x] CI chạy tự động trên `main`, các branch `codex/**` và pull request vào `main`, tránh commit triển khai bị bỏ qua quality gate.
- [x] `npm audit --omit=dev --audit-level=high` báo 0 vulnerability.
- [x] Production build đã kiểm tra console/page error: không còn cảnh báo JSON-LD; cảnh báo native script chỉ xuất hiện trong React development overlay và phù hợp với khuyến nghị JSON-LD của Next.js.
- [x] Cài Docker CLI + Colima + `psql`, khởi động Supabase local và chạy `npm run db:lint`/pgTAP trên schema sạch; lint pass, pgTAP `24` file/`390/390` tests pass.
- [x] Đã đọc migration inventory bằng Supabase CLI với quyền remote; remote khớp đủ `45/45` migration tới `20260813010000_notification_set_based_fanout.sql`; helper/trigger/quyền fan-out đã được smoke read-only.
- [x] Apply `20260811120000_fix_loyalty_redemption_collision.sql` lên remote sau khi CI database xác nhận xanh.
- [x] Remote `db lint --fail-on error` pass với `No schema errors found` sau migration loyalty/content/SePay/flash-sale; advisor multiple-permissive-policy vẫn là backlog maintainability.
- [x] GitHub run `31621084519` trên `6772ff5` completed successfully; quality, database và toàn bộ E2E đều xanh. Demo và các production E2E dùng webpack/webpack-only CI server, env tường minh và một worker để tránh runner contention.

## 0B. Performance/UX hardening

- [x] Public routes chuyển sang ISR; giữ fallback rỗng ở production khi Supabase chưa sẵn sàng trong lúc prerender.
- [x] Giảm duplicate no-JS markup, tối ưu ảnh trusted bằng Next Image và đồng bộ lại snapshot/giá cart từ catalog.
- [x] Notification bell bỏ `getClaims()` lặp và account voucher query chạy song song với batch chính.
- [x] SePay payment confirmation pause/backoff polling khi tab ẩn và refresh khi quay lại.
- [x] CSP production report-only loại `unsafe-eval`; chưa chuyển sang enforce cho tới khi review browser reports.
- [x] Notification history có pagination 50 dòng/lần, trạng thái loading/error và production deployment đã xác nhận qua health endpoint; RLS theo người nhận.
- [x] Provider demo toàn cục nhận `appMode`; production bỏ qua hydrate/persist fixtures orders, bookings, settings và flash-sale khỏi `localStorage`.
- [ ] Cloudflare Images/R2 là lựa chọn CDN ảnh tương lai; chưa cần cài package. Giữ Vercel làm host app và chỉ thêm `images.beanbus.store` sau khi có Cloudflare account, bucket/Images delivery URL và DNS.
- [x] Apply `20260812043000_fix_notification_preference_lint.sql`, `20260812050000_staff_request_notifications.sql` và `20260813010000_notification_set_based_fanout.sql` lên Supabase remote; local lint và remote `db lint --schema public` warning pass, function/trigger/privilege smoke pass.

## 0A. Notification/Resend hardening

- [x] Thêm `verify_jwt=false` cho `dispatch-notification-emails`, `resend-webhook` và `email-unsubscribe`.
- [x] Tách hard suppression bounce/complaint khỏi marketing unsubscribe.
- [x] Giữ email đơn hàng luôn bật; chỉ event/store cho phép opt-in/out.
- [x] Sửa unsubscribe GET/POST và thêm Resend one-click headers.
- [x] Sửa race delivery webhook đến trước completion worker.
- [x] Thu hồi PUBLIC/anon execution khỏi notification RPC; giữ authenticated/service_role đúng phạm vi.
- [x] Gắn notification feature flag vào nav, dashboard, page và bell.
- [x] Hiển thị trạng thái lỗi cho notification page/bell thay vì im lặng.
- [x] Bổ sung contract/pgTAP assertions cho các hành vi trên.
- [x] Inline cờ notification trong client bundle; không dùng dynamic `process.env` lookup ở browser.
- [x] Re-check suppression/marketing preference khi claim outbox; hủy pending mail khi unsubscribe hoặc bounce/complaint.
- [x] Worker kiểm tra kết quả completion/failure RPC và retry an toàn khi completion bị lỗi.
- [x] Giới hạn Resend webhook ở 64 KiB, kiểm tra `Content-Type` và đọc request body theo stream.
- [x] Escape email/action URL trong HTML unsubscribe.
- [x] Khóa password recovery bằng `redirectType` do Supabase trả về, cookie HMAC theo user/expiry và xóa đúng cookie path.
- [x] Cố định timezone notification UI và đồng bộ outbox/suppression types với migration.
- [x] Sửa format mã đơn demo thành `DH-YYMMDD` + 6 ký tự và thêm regression test; E2E checkout pass.
- [x] Kiểm tra migration inventory bằng `DATABASE_URL`; apply migration notification center và staff request fan-out lên remote, xác minh bảng, trigger, cron và Realtime publication.
- [x] Chạy pgTAP trên Docker/Postgres runtime qua Colima; `24` file, `390/390` tests pass. Hosted RLS/behavior smoke vẫn cần tài khoản thật.
- [x] Booking/contact tạo in-app notification cho tất cả admin và transactional outbox; dedupe/source/kind có contract và pgTAP.
- [x] Trang danh sách/chi tiết booking và contact của admin không còn dùng `notification_status` legacy; liên kết thống nhất về `/admin/notifications`.
- [ ] Khi bật password auth, bật Supabase Auth `Require current password when changing password` và smoke mật khẩu sai/đúng trên hosted.
- [x] Migration/functions notification đã được cấu hình với Vault, `verify_jwt=false` và endpoint production; Resend DNS/webhook còn chờ owner hoàn tất/allowlist smoke test. API key hiện tại là send-only nên không đọc được domain/webhook qua API; kiểm tra các mục này trong Resend Dashboard.
- [x] Thêm workflow GitHub deploy Edge Functions thủ công, chọn từng function hoặc `all`, dùng `production` environment secrets.
- [ ] Cấu hình `SUPABASE_ACCESS_TOKEN` secret và `SUPABASE_PROJECT_REF` variable trong GitHub `production`, rồi redeploy `dispatch-notification-emails`; không bật email mode trước khi hoàn tất.
- [x] Resend accepted smoke tới hai email test và worker production `disabled=true` đã xác nhận; delivered/bounced/complained, unsubscribe và realtime vẫn chờ mailbox/provider dashboard.
- [ ] Chỉ bật `NEXT_PUBLIC_ENABLE_NOTIFICATIONS` và `NOTIFICATION_EMAIL_MODE` sau staging sign-off.

## 0. Tạm dừng Phone OTP/Zalo

- [x] Vercel Production/Preview: giữ `NEXT_PUBLIC_ENABLE_PHONE_AUTH=false`.
- [x] Supabase Auth Providers: Google đang bật và Phone đang tắt theo `GET /auth/v1/settings` (2026-08-11).
- [ ] Supabase Auth Hooks: disable/unassign Send SMS Hook nếu đang bật.
- [x] Supabase Cron: `beanbus-refresh-zalo-token` không còn job active sau migration pause.
- [x] Supabase Cron: `beanbus-clear-stale-phone-changes` không còn job active sau migration pause.
- [ ] Xác nhận Edge Function Zalo không còn invocation mới; giữ code/secrets để dùng lại sau, không đưa token vào chat/git.
- [x] SePay webhook fail-closed với mã `BT/BF`: không gọi stored-value RPC khi `NEXT_PUBLIC_ENABLE_STORED_VALUE=false`.
- [x] Supabase remote: `stored_value_policy` hiện có `enabled=false`, `topup_enabled=false`, `flash_sale_enabled=false`; stored-value/flash-sale đang bị khóa ở database.
- [x] Vercel: giữ `NEXT_PUBLIC_ENABLE_STORED_VALUE=false` và không bật stored-value/flash-sale.

## 1. Cho phép tạo hội viên bằng Gmail

- [x] Supabase Auth: Google provider đã bật; Client ID/Secret không được đọc lại từ API public.
- [x] Read-only OAuth check: Supabase Google authorize với callback `https://www.beanbus.store/auth/callback` trả HTTP 302; chưa hoàn tất Gmail callback thật.
- [ ] Google Console: Authorized redirect URI là `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Supabase URL Configuration: Site URL là `https://www.beanbus.store`; allow redirect `https://www.beanbus.store/auth/callback` và preview URL đã duyệt.
- [x] Vercel Production: `/api/health` trả `200`, mode `production`; production login render `googleEnabled=true`, `phoneEnabled=false`.
- [x] Commit/push source Google-only và các milestone plan tới `8d55557` trên `codex/zalo-otp-integration`.
- [x] Vercel Production: redeploy từ `origin/main`, không merge Zalo changes của branch hiện tại; login production hiện có `phoneEnabled=false` và `googleEnabled=true`.
- [x] Chạy live smoke trên `https://www.beanbus.store`: health và Google-only login pass `1/1`.
- [x] Vercel Preview: set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`, giữ phone/stored-value false.
- [x] Sửa login UI: khi phone disabled, không render phone form/divider; Google là primary action.
- [x] Cập nhật E2E để kiểm tra Google-only login screen thay vì hai provider đều disabled.
- [ ] Smoke bằng Gmail mới: OAuth callback thành công, `auth.users` và `profiles` có row, vào được `/account`.
- [ ] Smoke logout, login lại và expired-session redirect.
- [ ] Xác nhận member thường vào `/admin` nhận forbidden/redirect đúng.
- [x] Supabase remote read-only check xác nhận Gmail admin đã có profile với role `admin`; không lưu email/PII vào repository.
- [ ] Thử cấp/revoke role qua server/SQL có audit; hiện admin đã được bootstrap và chỉ cần smoke test quyền.

## 2. P0 - Sửa loyalty và voucher

- [x] Tạo forward migration để reversal loyalty chạy kể cả policy hiện đã disabled hoặc `earn_bps=0`.
- [x] Thêm pgTAP: earn -> disable policy -> cancel; duplicate transition không reverse hai lần. GitHub database job và local Docker runtime đều pass.
- [x] Implement local lifecycle `reserved/consumed/released` với reservation ledger và audit state.
- [x] Mặc định local: reserve khi tạo đơn; consume khi SePay paid hoặc COD completed; release một lần khi cancel/payment failed/expired.
- [x] Cleanup pending SePay payment hết hạn nối với order payment failed và voucher release.
- [x] Thêm pgTAP/contract test cho cancellation, payment expiry, quota release và service-only ledger.
- [x] Sửa precedence lỗi flash-sale để user đã đạt `max_per_user` nhận `FLASH_SALE_USER_LIMIT` ổn định ngay cả khi campaign đồng thời hết quota; migration forward mới cần được apply lên remote trước khi bật stored-value.
- [x] Thêm admin `/admin/policies` để cấu hình voucher cancel/refund, loyalty reversal và refund window; thêm `refund_order_payment` cho SePay.
- [ ] Owner xác nhận mốc consume, timeout COD, và policy release/consume đã chọn trước khi mở checkout production.
- [x] Thêm test concurrent usage limit, refund policy và one-time reward voucher trên Postgres runtime; pgTAP local `24` file/`390/390` pass. Owner vẫn cần xác nhận policy live.
- [ ] Xác nhận `BEANBUS10` và `WELCOMEVIP` có phải promotion live không; read-only remote check cho thấy cả hai đang `is_active=true`, không có `starts_at/ends_at`, giới hạn lần lượt 1000/500.
- [ ] Nếu chưa phê duyệt, tạo forward migration disable hai voucher seed trước khi mở checkout production.

## 3. P1 - Sửa redemption idempotency

- [x] Client giữ nguyên redemption idempotency key qua retry; chỉ rotate sau success đã xác nhận.
- [x] RPC forward migration chỉ trả duplicate redemption khi `source_key` và `user_id` cùng khớp; khác user trả conflict không lộ voucher code.
- [x] Behavioral retry được mô phỏng bằng repeated RPC với cùng idempotency key: trả lại voucher cũ và không tạo ledger/voucher thứ hai; case cross-user collision cũng được kiểm tra.
- [x] Thêm pgTAP cho retry cùng user và collision key khác user; GitHub database job đã pass, còn hosted member smoke/RLS cần tài khoản thật.
- [x] Cập nhật contract test để yêu cầu key ổn định qua retry thay vì UUID mới ở mọi submit.

## 4. Reconcile và kiểm thử Supabase

- [ ] `npx supabase link --project-ref <project-ref>` vẫn chưa lưu link CLI; đã dùng `--db-url` của project được cấu hình local.
- [x] `npx supabase migration list` xác nhận đủ 45 migration local khớp remote tới `20260813010000`, không có drift chưa giải thích.
- [x] Review P0 forward migrations và apply theo thứ tự; backup/restore drill vẫn cần owner xác nhận.
- [x] Apply migration tới `20260813010000_notification_set_based_fanout.sql`; remote hiện đã có đủ 45 migration và set-based fan-out.
- [x] Sau CI pass, apply và kiểm tra migration `20260811120000_fix_loyalty_redemption_collision.sql`; remote inventory khớp và lint không có schema error.
- [x] Chạy toàn bộ `npm run db:lint` và `npm run db:test` trên schema sạch qua Colima: lint pass, pgTAP `24` file/`390/390` tests pass.
- [ ] Chạy lại pgTAP trên staging/remote theo release runbook.
- [ ] Test RLS bằng hai member và một admin: profiles, orders, requests, ledger, vouchers, history.
- [x] Read-only hosted RLS smoke với một member, một admin và một UUID không tồn tại: member chỉ thấy profile của mình, admin thấy dữ liệu được cấp, UUID lạ thấy `0` rows trên profiles/orders/requests/notifications; full two-member smoke vẫn còn chờ.
- [x] Cập nhật `README.md` và `docs/release-runbook.md` bằng trạng thái remote đã kiểm chứng.

## 5. Commerce và SePay

- [x] Xác nhận quyết định SePay production: webhook được bật và production `/hooks/payment` trả `401` khi thiếu HMAC.
- [x] Thêm `NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION=false` mặc định; cron chỉ chạy khi cả SePay và reconciliation cùng bật.
- [x] Production read-only: `/api/cron/sepay-reconciliation` trả `404`, xác nhận reconciliation cron đang tắt; webhook SePay vẫn bật và yêu cầu HMAC.
- [x] Vercel env đã có webhook HMAC, bank code/account/name; không in secret ra log/chat.
- [ ] SePay Dashboard: webhook live `https://www.beanbus.store/hooks/payment`, HMAC-SHA256, money-in, mã `DH_<mã hóa đơn>`.
- [ ] Chạy live smoke số tiền nhỏ và kiểm tra amount/account/code/direction/timestamp.
- [ ] Replay cùng provider event và xác nhận không có side effect lần hai.
- [ ] Cấu hình IP allowlist cho webhook ở lớp edge/firewall phù hợp.
- [x] Cấp SePay API v2 token và tạo `CRON_SECRET` dạng Hidden trong Vercel Production; không ghi secret vào repository.
- [x] Thêm job reconciliation mỗi 15 phút với API v2, text provider key, lease, cursor/checkpoint, idempotent replay và structured event counters; migration hosted đã áp dụng.
- [x] Thêm workflow GitHub external scheduler `*/15 * * * *`, guarded bởi `SEPAY_RECONCILIATION_ENABLED`; nhận `BEANBUS_CRON_SECRET` qua production Environment và không tự bật.
- [ ] Nâng Vercel lên Pro hoặc cấu hình external scheduler tương đương; Hobby không cho cron `*/15 * * * *`, nên giữ reconciliation flag tắt để không bỏ sót giao dịch.
- [x] Reconciliation không tiến checkpoint qua transaction mang mã Beanbus nhưng malformed; giao dịch ngân hàng không liên quan vẫn được bỏ qua an toàn.
- [x] Cleanup pending SePay payment hết hạn và nối với voucher release; pending COD timeout còn chờ policy.
- [x] Bổ sung structured events cho webhook outcome, signature/webhook failure và reconciliation completion/gap; không log payload/token/PII.
- [ ] Cấu hình dashboard/alert production cho rejected/mismatch, signature failure, webhook failure và reconciliation gap; cần quyền Vercel/Supabase và kênh cảnh báo.

## 6. Hội viên và admin còn thiếu

- [x] Sửa account request pagination bằng RPC `UNION ALL`, stable ordering, page bounds, indexes và total count; pgTAP/CI đã pass, còn hosted RLS smoke cần tài khoản thật.
- [ ] Test hosted account: profile, order detail/reorder, request cancel, loyalty history, reward, voucher ownership.
- [ ] Test hosted admin: dashboard, orders, requests, catalog, content, members, role, loyalty, vouchers, rewards.
- [x] Viết runbook first-admin, revoke role, audit role changes và account recovery; owner execution/sign-off còn chờ hosted access.
- [x] Chọn Gmail làm kênh tạm thời cho booking/contact/RSVP/B2B.
- [x] Booking/contact đã có in-app notification cho admin; email Resend dùng transactional outbox nhưng vẫn giữ feature flag tắt tới khi allowlist/delivery smoke pass. Không dùng `notification_status` placeholder làm KPI notification center.
- [x] Thêm feature-gated Turnstile cho order, booking và contact; server-side Siteverify fail-closed, mặc định vẫn tắt.
- [ ] Owner chốt booking capacity, COD eligibility, loyalty earn rate, timeout COD, refund window và release/consume policy trong `/admin/policies`.

## 7. UI, security và maintainability

- [x] Browser-check Google-only login ở 375/768/1440 px và keyboard focus; screen reader audit hosted còn chờ.
- [x] Thêm CSP dạng report-only với Cloudflare/Google/Supabase origins cần thiết; chuyển enforce sau browser report review.
- [x] HSTS chỉ bật khi production site URL là HTTPS; hosted owner vẫn cần xác nhận subdomain policy.
- [ ] Thay dần source-regex tests ở auth/payment/loyalty/voucher bằng behavior tests.
- [x] Remote `db lint --schema public` không còn lỗi schema hoặc warning sau migration fan-out; advisor multiple-permissive-policy để tối ưu sau khi correctness/runtime gate hoàn tất.
- [ ] Tách `AccountClient.tsx` theo tab sau khi correctness fixes đã merge.
- [ ] Tách `HomeClient.tsx` và CSS lớn theo workflow khi có thay đổi chức năng liên quan.
- [ ] Kiểm tra accessibility, Core Web Vitals và console/network errors trên staging (production build local đã sạch console; hosted staging vẫn cần kiểm tra).
- [ ] Hoàn thiện privacy policy, terms, logo, owned images và social links.

## 8. Release gate

- [ ] Không còn finding P0/P1 mở.
- [ ] Phone/Zalo và stored-value xác nhận vẫn tắt ở UI lẫn remote execution; Zalo cron đã xác nhận `0`, còn Auth Provider/Hook và Vercel flags cần owner kiểm tra.
- [ ] Google login/logout/profile/admin role smoke pass bằng tài khoản thật.
- [x] Lint, typecheck, 295/295 unit-contract tests, build và pgTAP local `390/390` pass; GitHub CI run `31621084519` của commit `6772ff5` completed/success ở quality, database và toàn bộ E2E. Hosted Google OAuth thật và owner sign-off còn thiếu.
- [ ] Sepay webhook + reconciliation live smoke pass nếu bật payment.
- [ ] Monitoring, backup, rollback và incident contacts đã được thử.
- [ ] Owner ký xác nhận staging ở desktop/mobile.

## Thông tin/quyết định cần chủ dự án cung cấp

- [x] Đã có quyền truy vấn/apply Supabase remote qua secret store local; không gửi secret qua chat.
- [ ] Quyền Vercel để kiểm tra Production/Preview env và redeploy.
- [x] Đã nhận Gmail admin và Gmail member test; admin đã tồn tại trong Auth/profile, member cần đăng nhập Google lần đầu để tự tạo account/profile.
- [ ] Email nhận thông báo nhân viên và Resend sender/allowlist; không lưu API key trong repository.
- [ ] Xác nhận hai mã `BEANBUS10`, `WELCOMEVIP`: live hay phải tắt.
- [ ] Chính sách loyalty/COD/refund/voucher reuse bằng văn bản ngắn hoặc chỉnh trực tiếp trong `/admin/policies` sau khi bootstrap admin.
- [x] Kênh in-app nhận thông báo booking/contact của admin đã triển khai; email recipient/allowlist Resend vẫn cần owner xác nhận.
- [x] SePay API v2 token và `CRON_SECRET` đã nhập trực tiếp vào Vercel Production secret store; reconciliation vẫn chờ scheduler phù hợp.
- [ ] Privacy policy, terms, logo và ảnh có quyền sử dụng.
