# Beanbus To-do

**Plan:** `tasks/plan.md`

**Cập nhật:** 2026-08-11

**Ưu tiên hiện tại:** Google-only auth -> sửa loyalty/voucher correctness -> reconcile Supabase remote -> hosted verification -> SePay hardening.

## Trạng thái đã xác minh local

- [x] `npm run lint` pass.
- [x] `npx tsc --noEmit` pass.
- [x] `npm test` pass 239/239.
- [x] `npm run build` pass.
- [x] `npm run test:e2e:auth` pass 4/4 với Google enabled và phone disabled ở 375/768/1440px.
- [x] `npm run test:e2e` pass 30/40; 10 suite production/provider được skip đúng khi thiếu credential.
- [x] E2E customer requests pass 4/4; RSVP modal đã được port ra `document.body` để không bị ảnh hưởng bởi transform của event card.
- [x] E2E accessibility header/menu pass ổn định sau khi chuyển focus keyboard bằng `requestAnimationFrame` và chạy lặp 20 lần.
- [x] Thêm live smoke opt-in `npm run test:e2e:live`; test sẽ kiểm tra health và Google-only login trên `https://www.beanbus.store`.
- [x] Đã chạy live smoke với quyền browser phù hợp; health pass nhưng assertion Google-only fail vì deployment production vẫn render nút `Nhận mã qua Zalo`.
- [x] Thêm GitHub Actions manual live smoke (`workflow_dispatch`) với `production_base_url`, bắt buộc HTTPS, không yêu cầu Gmail session hay production secret.
- [x] CI chạy tự động trên `main`, các branch `codex/**` và pull request vào `main`, tránh commit triển khai bị bỏ qua quality gate.
- [x] `npm audit --omit=dev --audit-level=high` báo 0 vulnerability.
- [x] Production build đã kiểm tra console/page error: không còn cảnh báo JSON-LD; cảnh báo native script chỉ xuất hiện trong React development overlay và phù hợp với khuyến nghị JSON-LD của Next.js.
- [ ] Chạy `npm run db:lint` và `npm run db:test` trên Docker-compatible Supabase runtime (đã thử local; hiện bị `ECONNREFUSED 127.0.0.1:54322` vì chưa có Docker/Postgres).
- [x] Đã đọc migration inventory bằng Supabase CLI với quyền remote; 37 migration hiện có trên remote khớp tới `20260811050000`.
- [ ] Apply `20260811120000_fix_loyalty_redemption_collision.sql` lên remote sau khi CI database xác nhận xanh.
- [x] Remote `db lint --fail-on error` pass với `No schema errors found` sau migration sửa loyalty/content/SePay/flash-sale warning; advisor multiple-permissive-policy vẫn là backlog maintainability.
- [ ] GitHub run `31461697461` trên `74571c7`: quality và E2E pass, database fail ở pgTAP. Artifact `pgtap-output` (`9090031114`) và job summary đã được upload; cần đọc assertion cụ thể để đóng gate.

## 0. Tạm dừng Phone OTP/Zalo

- [ ] Vercel Production/Preview: giữ `NEXT_PUBLIC_ENABLE_PHONE_AUTH=false`.
- [x] Supabase Auth Providers: Google đang bật và Phone đang tắt theo `GET /auth/v1/settings` (2026-08-11).
- [ ] Supabase Auth Hooks: disable/unassign Send SMS Hook nếu đang bật.
- [x] Supabase Cron: `beanbus-refresh-zalo-token` không còn job active sau migration pause.
- [x] Supabase Cron: `beanbus-clear-stale-phone-changes` không còn job active sau migration pause.
- [ ] Xác nhận Edge Function Zalo không còn invocation mới; giữ code/secrets để dùng lại sau, không đưa token vào chat/git.
- [x] SePay webhook fail-closed với mã `BT/BF`: không gọi stored-value RPC khi `NEXT_PUBLIC_ENABLE_STORED_VALUE=false`.
- [x] Supabase remote: `stored_value_policy` hiện có `enabled=false`, `topup_enabled=false`, `flash_sale_enabled=false`; stored-value/flash-sale đang bị khóa ở database.
- [ ] Vercel: giữ `NEXT_PUBLIC_ENABLE_STORED_VALUE=false` và không bật stored-value/flash-sale.

## 1. Cho phép tạo hội viên bằng Gmail

- [x] Supabase Auth: Google provider đã bật; Client ID/Secret không được đọc lại từ API public.
- [x] Read-only OAuth check: Supabase Google authorize với callback `https://www.beanbus.store/auth/callback` trả HTTP 302; chưa hoàn tất Gmail callback thật.
- [ ] Google Console: Authorized redirect URI là `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Supabase URL Configuration: Site URL là `https://www.beanbus.store`; allow redirect `https://www.beanbus.store/auth/callback` và preview URL đã duyệt.
- [x] Vercel Production: `/api/health` trả `200`, mode `production`; production login render `googleEnabled=true`, `phoneEnabled=false`.
- [x] Commit/push source Google-only và các milestone plan tới `74571c7` trên `codex/zalo-otp-integration`.
- [ ] Vercel Production: build hiện tại vẫn render form Zalo disabled/divider cũ dù props đã là `phoneEnabled=false`; cần redeploy branch này hoặc merge commit vào production branch.
- [ ] Chạy `npm run test:e2e:live` sau khi redeploy; lần kiểm tra curl hiện tại đã chứng minh build cũ còn form Zalo.
- [ ] Vercel Preview: set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`, giữ phone/stored-value false và redeploy.
- [x] Sửa login UI: khi phone disabled, không render phone form/divider; Google là primary action.
- [x] Cập nhật E2E để kiểm tra Google-only login screen thay vì hai provider đều disabled.
- [ ] Smoke bằng Gmail mới: OAuth callback thành công, `auth.users` và `profiles` có row, vào được `/account`.
- [ ] Smoke logout, login lại và expired-session redirect.
- [ ] Xác nhận member thường vào `/admin` nhận forbidden/redirect đúng.
- [x] Supabase remote read-only aggregate hiện có 1 profile mang role `admin` (không đọc email/PII); vẫn cần owner xác nhận đó là Gmail admin và thử cấp/revoke có audit.
- [ ] Chọn email admin đầu tiên và thử runbook cấp/revoke role qua server/SQL có audit.

## 2. P0 - Sửa loyalty và voucher

- [x] Tạo forward migration để reversal loyalty chạy kể cả policy hiện đã disabled hoặc `earn_bps=0`.
- [x] Thêm pgTAP: earn -> disable policy -> cancel; duplicate transition không reverse hai lần. Runtime execution vẫn chờ Docker/Supabase.
- [x] Implement local lifecycle `reserved/consumed/released` với reservation ledger và audit state.
- [x] Mặc định local: reserve khi tạo đơn; consume khi SePay paid hoặc COD completed; release một lần khi cancel/payment failed/expired.
- [x] Cleanup pending SePay payment hết hạn nối với order payment failed và voucher release.
- [x] Thêm pgTAP/contract test cho cancellation, payment expiry, quota release và service-only ledger.
- [x] Sửa precedence lỗi flash-sale để user đã đạt `max_per_user` nhận `FLASH_SALE_USER_LIMIT` ổn định ngay cả khi campaign đồng thời hết quota; migration forward mới cần được apply lên remote trước khi bật stored-value.
- [ ] Owner xác nhận mốc consume, timeout COD, và refund có hoàn voucher hay không trước khi mở checkout production.
- [ ] Thêm test concurrent usage limit, refund policy và one-time reward voucher trên Postgres runtime.
- [ ] Xác nhận `BEANBUS10` và `WELCOMEVIP` có phải promotion live không; read-only remote check cho thấy cả hai đang `is_active=true`, không có `starts_at/ends_at`, giới hạn lần lượt 1000/500.
- [ ] Nếu chưa phê duyệt, tạo forward migration disable hai voucher seed trước khi mở checkout production.

## 3. P1 - Sửa redemption idempotency

- [x] Client giữ nguyên redemption idempotency key qua retry; chỉ rotate sau success đã xác nhận.
- [x] RPC forward migration chỉ trả duplicate redemption khi `source_key` và `user_id` cùng khớp; khác user trả conflict không lộ voucher code.
- [ ] Thêm behavioral test mô phỏng request commit nhưng response bị mất.
- [x] Thêm pgTAP cho retry cùng user và collision key khác user; runtime execution còn chờ Postgres.
- [x] Cập nhật contract test để yêu cầu key ổn định qua retry thay vì UUID mới ở mọi submit.

## 4. Reconcile và kiểm thử Supabase

- [ ] `npx supabase link --project-ref <project-ref>` vẫn chưa lưu link CLI; đã dùng `--db-url` của project được cấu hình local.
- [x] `npx supabase migration list` xác nhận đủ 37 migration local khớp remote tới `20260811050000`, không có drift chưa giải thích.
- [x] Review P0 forward migrations và apply theo thứ tự; backup/restore drill vẫn cần owner xác nhận.
- [x] Apply migration tới `20260811050000_fix_flash_sale_error_precedence.sql`; truy vấn remote xác nhận 37 migration đã có.
- [ ] Sau CI pass, apply và kiểm tra read-only migration `20260811120000_fix_loyalty_redemption_collision.sql`.
- [ ] Chạy toàn bộ `npm run db:lint` và `npm run db:test` trên schema sạch.
- [ ] Chạy lại pgTAP trên staging/remote theo release runbook.
- [ ] Test RLS bằng hai member và một admin: profiles, orders, requests, ledger, vouchers, history.
- [x] Cập nhật `README.md` và `docs/release-runbook.md` bằng trạng thái remote đã kiểm chứng.

## 5. Commerce và SePay

- [ ] Xác nhận quyết định SePay production: webhook live hiện trả `401` khi thiếu HMAC, chứng minh `NEXT_PUBLIC_ENABLE_SEPAY` đang bật; nếu chưa mở payment traffic thì tắt flag, nếu giữ live thì hoàn tất smoke/alert/token.
- [x] Thêm `NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION=false` mặc định; cron chỉ chạy khi cả SePay và reconciliation cùng bật.
- [x] Production read-only: `/api/cron/sepay-reconciliation` trả `404`, xác nhận reconciliation cron đang tắt; webhook SePay vẫn bật và yêu cầu HMAC.
- [ ] Xác nhận Vercel secrets: webhook HMAC, bank code/account/name; không in secret ra log/chat.
- [ ] SePay Dashboard: webhook live `https://www.beanbus.store/hooks/payment`, HMAC-SHA256, money-in, mã `DH_<mã hóa đơn>`.
- [ ] Chạy live smoke số tiền nhỏ và kiểm tra amount/account/code/direction/timestamp.
- [ ] Replay cùng provider event và xác nhận không có side effect lần hai.
- [ ] Cấu hình IP allowlist cho webhook ở lớp edge/firewall phù hợp.
- [ ] Cấp SePay API v2 token trong secret store khi owner quyết định bật reconciliation, không dùng API v1 cho integration mới.
- [x] Thêm job reconciliation mỗi 15 phút với API v2, text provider key, lease, cursor/checkpoint, idempotent replay và structured event counters; migration hosted đã áp dụng, token và alert wiring còn chờ.
- [x] Reconciliation không tiến checkpoint qua transaction mang mã Beanbus nhưng malformed; giao dịch ngân hàng không liên quan vẫn được bỏ qua an toàn.
- [x] Cleanup pending SePay payment hết hạn và nối với voucher release; pending COD timeout còn chờ policy.
- [x] Bổ sung structured events cho webhook outcome, signature/webhook failure và reconciliation completion/gap; không log payload/token/PII.
- [ ] Cấu hình dashboard/alert production cho rejected/mismatch, signature failure, webhook failure và reconciliation gap; cần quyền Vercel/Supabase và kênh cảnh báo.

## 6. Hội viên và admin còn thiếu

- [x] Sửa account request pagination bằng RPC `UNION ALL`, stable ordering, page bounds, indexes và total count; pgTAP runtime còn chờ Postgres.
- [ ] Test hosted account: profile, order detail/reorder, request cancel, loyalty history, reward, voucher ownership.
- [ ] Test hosted admin: dashboard, orders, requests, catalog, content, members, role, loyalty, vouchers, rewards.
- [x] Viết runbook first-admin, revoke role, audit role changes và account recovery; owner execution/sign-off còn chờ hosted access.
- [ ] Chọn kênh thông báo nhân viên cho booking/contact/RSVP/B2B.
- [ ] Implement delivery worker/webhook và update `notification_status` theo kết quả thật.
- [x] Thêm feature-gated Turnstile cho order, booking và contact; server-side Siteverify fail-closed, mặc định vẫn tắt.
- [ ] Quyết định booking capacity, COD eligibility, loyalty earn rate, refund và voucher reuse policy.

## 7. UI, security và maintainability

- [x] Browser-check Google-only login ở 375/768/1440 px và keyboard focus; screen reader audit hosted còn chờ.
- [x] Thêm CSP dạng report-only với Cloudflare/Google/Supabase origins cần thiết; chuyển enforce sau browser report review.
- [x] HSTS chỉ bật khi production site URL là HTTPS; hosted owner vẫn cần xác nhận subdomain policy.
- [ ] Thay dần source-regex tests ở auth/payment/loyalty/voucher bằng behavior tests.
- [x] Remote `db lint` không còn lỗi schema hoặc warning; advisor multiple-permissive-policy để tối ưu sau khi correctness/runtime gate hoàn tất.
- [ ] Tách `AccountClient.tsx` theo tab sau khi correctness fixes đã merge.
- [ ] Tách `HomeClient.tsx` và CSS lớn theo workflow khi có thay đổi chức năng liên quan.
- [ ] Kiểm tra accessibility, Core Web Vitals và console/network errors trên staging (production build local đã sạch console; hosted staging vẫn cần kiểm tra).
- [ ] Hoàn thiện privacy policy, terms, logo, owned images và social links.

## 8. Release gate

- [ ] Không còn finding P0/P1 mở.
- [ ] Phone/Zalo và stored-value xác nhận vẫn tắt ở UI lẫn remote execution; Zalo cron đã xác nhận `0`, còn Auth Provider/Hook và Vercel flags cần owner kiểm tra.
- [ ] Google login/logout/profile/admin role smoke pass bằng tài khoản thật.
- [ ] Lint, typecheck, 239/239 unit-contract tests, build, pgTAP và focused E2E đều xanh.
- [ ] Sepay webhook + reconciliation live smoke pass nếu bật payment.
- [ ] Monitoring, backup, rollback và incident contacts đã được thử.
- [ ] Owner ký xác nhận staging ở desktop/mobile.

## Thông tin/quyết định cần chủ dự án cung cấp

- [x] Đã có quyền truy vấn/apply Supabase remote qua secret store local; không gửi secret qua chat.
- [ ] Quyền Vercel để kiểm tra Production/Preview env và redeploy.
- [ ] Email Gmail dùng làm admin đầu tiên và ít nhất một Gmail member test.
- [ ] Xác nhận hai mã `BEANBUS10`, `WELCOMEVIP`: live hay phải tắt.
- [ ] Chính sách loyalty/COD/refund/voucher reuse bằng văn bản ngắn.
- [ ] Kênh nhận thông báo booking/contact của nhân viên.
- [ ] SePay API v2 token nhập trực tiếp vào secret store khi bắt đầu reconciliation.
- [ ] Privacy policy, terms, logo và ảnh có quyền sử dụng.
