# Kế hoạch hoàn thiện Beanbus

**Cập nhật:** 2026-08-13

**Trạng thái:** Performance hardening và in-app notification đã triển khai, kiểm thử local/remote; email Resend vẫn giữ tắt chờ smoke test

**Phạm vi hiện tại:** Dùng Google OAuth để tạo/đăng nhập tài khoản hội viên; tạm dừng Phone OTP/Zalo; bật SePay webhook đơn hàng; giữ reconciliation, stored-value và flash-sale ở trạng thái tắt. Cloudflare CDN/R2/Images chưa bật; giữ domain chính đi thẳng Vercel.

## 0. Increment performance đã triển khai

- [x] Public home/menu/order/events/blog và detail dùng ISR (`5 phút`, blog `1 giờ`) thay cho `force-dynamic`; lỗi dữ liệu lúc build không làm lộ catalog demo vào production sitemap.
- [x] Loại bỏ bản render no-JavaScript bị nhân đôi; giữ fallback trong `<noscript>` để giảm HTML và hydration work.
- [x] Ảnh local và Unsplash đáng tin cậy đi qua Next Image optimizer; URL ảnh động chưa được allowlist vẫn dùng `unoptimized` an toàn.
- [x] Cart storage có version `2`, tự đồng bộ snapshot sản phẩm/option/giá khi vào menu, cart hoặc checkout; giá cuối cùng vẫn do server pricing RPC quyết định.
- [x] Header notification dùng `user.id` từ AuthContext, không gọi `getClaims()` lặp; formatter ngày được memoize.
- [x] Voucher account lọc thời gian ở PostgREST và chạy song song với batch dữ liệu đầu tiên.
- [x] SePay confirmation giảm polling khi tab ẩn, backoff tối đa 30 giây và refresh ngay khi tab được focus.
- [x] CSP report-only production không còn `unsafe-eval`; chỉ development mới bật để hỗ trợ Next dev.
- [x] Production Vercel deployment đã được xác minh qua `/api/health` trả `200`, login Google-only/live smoke pass và production không bật phone auth; revision được đối chiếu tại mỗi lần release.
- [x] Provider demo toàn cục nhận `appMode`; production không hydrate/persist orders, bookings, settings hoặc flash-sale fixtures từ `localStorage`.
- [ ] Chưa bật Cloudflare reverse proxy trước Vercel. Nếu cần CDN ảnh, ưu tiên Cloudflare Images hoặc R2 với `images.beanbus.store`; không chuyển `www.beanbus.store` qua proxy trước khi đo latency/cache.
- [x] Đã apply migration `20260813010000_notification_set_based_fanout.sql` trên Supabase remote; migration inventory đạt `45/45`, helper fan-out và trigger booking/customer/order/event tồn tại, authenticated không có quyền gọi helper trực tiếp.

## 1. Mục tiêu gần nhất

Đưa các luồng public, hội viên, admin và thanh toán đơn hàng tới trạng thái có thể kiểm thử an toàn trên `https://www.beanbus.store`. Trước khi thêm tính năng mới, dự án phải sửa các lỗi có thể làm sai điểm thưởng, voucher hoặc trạng thái thanh toán.

Các nguyên tắc đang áp dụng:

- PostgreSQL/Supabase là nguồn dữ liệu tin cậy cho auth, quyền, giá, voucher, đơn hàng, thanh toán và điểm.
- Google OAuth là provider đăng nhập duy nhất được bật trong giai đoạn này.
- Không xóa mã Zalo OTP; giữ mã sau feature flag để có thể quay lại sau, nhưng dừng cả UI lẫn cấu hình remote đang chạy.
- Không bật stored-value/flash-sale cho tới khi có phê duyệt chính sách và kiểm thử thanh toán riêng.
- Mọi sửa đổi database phải là forward migration và có pgTAP cho quyền, idempotency và giá trị tiền/điểm.

## 2. Phạm vi review

Review này dùng các skill `code-review-and-quality`, `security-and-hardening`, `supabase`, `supabase-postgres-best-practices`, `frontend-ui-engineering`, `planning-and-task-breakdown` và `ponytail`.

Đã đọc các vùng chính:

- Next.js routes, Server Actions, auth callback/proxy và feature flags.
- Supabase migrations, RLS, security-definer RPC, pgTAP và Edge Functions.
- Public UI, account, admin, order/checkout, SePay, loyalty, voucher và request workflows.
- Test suite, Playwright, CI, environment contract và release docs.

Kết quả local tại thời điểm review:

- `npm run lint`: pass.
- `npx tsc --noEmit`: pass.
- `npm test`: 295/295 pass.
- `npm run build`: pass.
- `npm run test:e2e:auth`: 4/4 pass với Google enabled và phone disabled ở 375/768/1440px; chưa thực hiện OAuth Gmail thật.
- `npm run test:e2e`: 33/43 pass; 10 production/provider tests skipped vì chưa có hosted credentials, trong đó live smoke được chạy riêng khi có `PLAYWRIGHT_LIVE=true`.
- `npm run test:e2e:live`: lần trước fail do deployment cũ; sau đó production đã redeploy từ `origin/main` và curl xác nhận `phoneEnabled=false`, `googleEnabled=true`.
- GitHub Actions đã có `workflow_dispatch` live smoke nhận `production_base_url`, bắt buộc HTTPS, chạy sau E2E và chỉ kiểm tra public production surface.
- E2E customer requests đã pass 4/4 sau khi port RSVP modal ra `document.body`, tránh overlay bị kéo theo card có hiệu ứng hover/transform.
- E2E accessibility header/menu ban đầu lộ lỗi focus không ổn định; đã sửa và xác nhận 20/20 lần lặp, sau đó full E2E pass.
- Đã thêm live smoke opt-in `npm run test:e2e:live` với `PLAYWRIGHT_BASE_URL`; Gmail callback/profile/admin role thật vẫn chưa test.
- Production smoke: `https://www.beanbus.store/api/health` trả `200` và revision được đối chiếu với commit deploy; live smoke `1/1` pass; login HTML có `phoneEnabled=false` và `googleEnabled=true`; webhook `/hooks/payment` trả `401` khi thiếu HMAC; `/api/cron/sepay-reconciliation` trả `404`. Remote Auth settings cũng xác nhận Google bật, Phone tắt; Send SMS Hook vẫn cần kiểm tra riêng trong Supabase Dashboard.
- Đã bổ sung `suppressHydrationWarning` cho cả `html` và `body` để không báo lỗi khi extension/browser tooling chèn attribute trước hydration; contract test đã thêm.
- Cảnh báo React dev `Encountered a script tag while rendering React component` được xác minh là cảnh báo development khi render native JSON-LD; Next.js 16 vẫn khuyến nghị native JSON-LD script cho structured data. Production build đã kiểm tra trực tiếp, không có console warning hoặc page error, nên giữ nguyên cách triển khai hiện tại.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerability.
- Đã cài Docker CLI, Colima và `libpq`/`psql`; Colima đang cung cấp Docker runtime cho Supabase local. `npx supabase db lint --local --level warning --fail-on warning` trả `No schema errors found`.
- Đã dùng Supabase CLI với connection string đã cấu hình để apply migration commerce policy, SePay order expiry, notification center, notification lint, staff request fan-out và set-based fan-out. Remote đã xác minh migration inventory khớp `45/45`, trigger booking/customer/order/event, bảng notification/outbox, notification worker cron và Realtime publication; `db lint --db-url ... --schema public --level warning --fail-on warning` và local lint đều trả `No schema errors found`.
- pgTAP local trên schema sạch đã pass `24` file, `390/390` tests; smoke transaction trên remote xác nhận booking/contact tạo notification admin và rollback sạch.
- GitHub Actions run `31623250915` trên commit `620d058` đã completed/success ở quality, database và toàn bộ E2E (Demo, Auth, checkout thường, SePay contract, customer requests). Local hiện pass `npm test` 295/295, pgTAP 390/390 và build. Live smoke workflow không chạy trong push event; Gmail OAuth callback thật vẫn chưa test.

Các increment đã triển khai local: Google-only login UI và auth E2E, loyalty reversal forward migration, redemption idempotency key ổn định qua retry, RPC chống collision khác user, RPC phân trang request `UNION ALL` có total count/RLS, first-admin/release runbook, voucher reservation lifecycle, commerce policy có audit và RPC hoàn tiền SePay theo thời hạn, form CAPTCHA feature-gate, RSVP modal ổn định ngoài card hover, SePay API v2 reconciliation feature-gated, set-based notification fan-out cho order/booking/customer/event/store announcement. Provider, hosted user smoke, Gmail/Resend delivery và live payment smoke vẫn chưa hoàn tất.

## 3. Tiến độ theo chức năng

| Khu vực | Trạng thái code | Việc còn thiếu trước production |
|---|---|---|
| Public site, menu, content, responsive UI | Gần hoàn chỉnh | Nội dung/ảnh chính thức, privacy/terms, browser audit cuối |
| Google Auth và session guards | Đã có | Bật provider/flag, smoke test tài khoản Gmail thật, xác minh profile trigger và logout |
| Phone OTP/Zalo | Đã code nhưng tạm dừng | Giữ flag false; vô hiệu Auth Hook/cron/provider remote nếu đã bật |
| Hội viên | Đã có profile, đơn, request, voucher, loyalty và policy reversal | Gmail/UI smoke bằng tài khoản thật; owner xác nhận voucher seed và Resend notification; hosted RLS transaction smoke đã pass |
| Admin | Đã có route guard, catalog/voucher/loyalty/rewards và màn `Chính sách`; Auth/Profile đã có admin Gmail | OAuth/session browser smoke và test policy/refund trên hosted runtime |
| Order/checkout | Server-priced, idempotent, reservation/release voucher và admin refund policy/RPC | Hosted E2E; live refund test nhỏ và xác nhận expiry |
| SePay đơn hàng | HMAC webhook production đã bật; reconciliation API v2 đang tắt | Live smoke, IP allowlist, alert; API v2 token chỉ cần khi bật reconciliation |
| Booking/contact/RSVP/B2B | Đã lưu server, có admin workflow và in-app notification cho admin | Email Resend/recipient allowlist và chống abuse theo IP/CAPTCHA |
| Stored-value/flash-sale | Đã code sau nhiều lớp gate | Tiếp tục tắt; chưa nằm trong release hiện tại |
| Test/CI | Local gate và CI database/E2E xanh | Giảm source-regex tests và chạy authenticated hosted E2E |

Ước lượng hiện tại: UI/routes khoảng 96%, backend implementation khoảng 97%; production verification đã đóng thêm hosted lint và RLS ownership nhưng vẫn chưa đủ release sign-off. Release readiness tổng thể vẫn bị chặn bởi Google/role smoke, Resend delivery, Send SMS Hook confirmation, payment smoke và backup/monitoring sign-off.

## 4. Findings cần xử lý

### P0 - Chặn phát hành

1. **Loyalty reversal đã có forward fix, runtime pgTAP và remote lint sign-off.** `apply_loyalty_for_order()` xử lý reversal độc lập với policy hiện tại; pgTAP regression cho chuỗi disable policy -> cancel/refund đã pass. Hosted user smoke và owner sign-off vẫn còn.
2. **Voucher/loyalty/refund policy đã có màn admin, migration remote và pgTAP/runtime coverage.** Mặc định consume khi SePay paid/COD completed, release khi cancel/payment failed/refund; admin có thể đổi hành vi release/consume, bật/tắt refund, đặt cửa sổ 1–720 giờ và bật/tắt reversal điểm. Chỉ còn owner xác nhận policy live bằng văn bản.
3. **Remote inventory đã được reconcile và apply.** Remote đã khớp `45/45` migration tới `20260813010000`; helper/trigger/quyền fan-out, hosted `db lint` schema `public` và RLS ownership transaction smoke đã được kiểm tra, không có schema warning. Vẫn cần UI/provider behavior bằng tài khoản thật và backup/restore sign-off.

### P1 - Phải hoàn thành trước mở traffic thật

1. **Redemption idempotency đã có forward fix và CI/remote migration sign-off.** UI giữ key qua retry; RPC khóa theo source key, scope duplicate theo `user_id` và trả conflict chung cho collision khác user. Vẫn cần behavioral smoke bằng hai tài khoản thật trước khi đóng hosted gate.
2. **Hai voucher seed đang active không thời hạn.** Read-only remote check xác nhận `BEANBUS10` (limit 1000) và `WELCOMEVIP` (limit 500) đều `is_active=true` và không có cửa sổ thời gian; chúng có thể trở thành khuyến mãi production ngoài ý muốn. Chủ dự án phải phê duyệt hoặc tắt bằng forward migration.
3. **Google happy path chưa được kiểm thử bằng Gmail thật.** E2E local và production HTML đã xác nhận Google-only UI; vẫn chưa chứng minh Gmail mới tạo `auth.users`, `profiles`, session và logout đúng.
4. **Tắt flag phone chưa đủ để dừng toàn bộ Zalo remote.** Hai cron đã được xác nhận không active sau migration pause, nhưng owner vẫn phải kiểm tra Phone provider và Send SMS Hook trên Supabase Dashboard.
5. **SePay webhook production đang bật nhưng reconciliation cron đang tắt.** Vercel Hobby từ chối lịch `*/15 * * * *`; không đổi thành lịch mỗi ngày vì có thể bỏ sót cửa sổ thanh toán. `SEPAY_API_KEY` và `CRON_SECRET` đã nằm trong Vercel secret store; route và workflow external scheduler đã có, còn chờ cấu hình/enable có chủ ý. SePay khuyến nghị đối soát 15-30 phút/lần: [bảo mật webhook](https://developer.sepay.vn/vi/sepay-webhooks/bao-mat), [API giao dịch v2](https://developer.sepay.vn/vi/sepay-api/v2/giao-dich/danh-sach).
6. **Anonymous mutation đã có Turnstile feature-gate ở local.** Booking/contact/order gọi Cloudflare Siteverify trước khi ghi khi `NEXT_PUBLIC_ENABLE_FORM_CAPTCHA=true`; production vẫn cần owner cấp key, bật flag và kiểm tra abuse/alert.
7. **In-app notification cho staff request đã hoàn tất.** Trigger booking/contact fan-out notification và email outbox transactional cho admin; email chưa gửi khi feature flag tắt, còn cần Resend sender/allowlist và delivery smoke. `notification_status` của request vẫn là trạng thái delivery legacy, không dùng làm KPI notification center.

### P2 - Hardening và maintainability

1. 54/69 file unit test đọc source bằng `readFileSync` và regex. Chúng hữu ích cho contract tĩnh nhưng không thay thế runtime behavior; vùng loyalty/redemption/request pagination/voucher lifecycle đã có regression contract và pgTAP runtime, nhưng vẫn cần hosted behavior smoke.
2. Account request pagination đã chuyển sang RPC `UNION ALL` với stable ordering, bounded page size, total count và RLS-aware access; pgTAP và hosted two-member ownership smoke đã pass. Hosted UI behavior vẫn còn.
3. Phone UI đã được ẩn hoàn toàn khi feature tắt; còn thiếu browser/accessibility check trên staging ở các kích thước màn hình.
4. Security headers đã có CSP report-only và HSTS conditional cho production HTTPS; cần review browser reports trước khi chuyển CSP sang enforce.
5. Một số client/UI module quá lớn (`AccountClient.tsx` 742 dòng, `HomeClient.tsx` 542 dòng). Chỉ tách sau khi sửa correctness, theo các tab/workflow hiện có.
6. Runbook first-admin, migration inventory và rollback/provider outage đã được bổ sung; owner vẫn phải thực hiện bootstrap và ghi sign-off trên hosted project.
7. Remote advisors cảnh báo nhiều permissive RLS policy trên các bảng public. Đây là tối ưu hiệu năng/độ rõ policy, không thay thế kiểm thử ownership; xử lý sau khi đóng các release gate.
8. JSON-LD native script có cảnh báo trong React development overlay nhưng không lỗi production. Đây là hành vi cảnh báo của React dev runtime, không phải hydration mismatch; production build console đã sạch và không nên đổi sang `next/script` vì JSON-LD không phải executable JavaScript.

## 5. Kế hoạch thực thi

### Phase 0 - Chốt Google-only và inventory remote

**Mục tiêu:** Có thể tạo hội viên bằng Gmail mà không kích hoạt bất kỳ luồng phone/Zalo nào.

- Giữ `NEXT_PUBLIC_ENABLE_PHONE_AUTH=false` và `NEXT_PUBLIC_ENABLE_STORED_VALUE=false` ở tất cả environment.
- Kiểm tra Supabase Auth: public Auth settings xác nhận Google bật và Phone tắt; Send SMS Hook vẫn cần xác nhận trong Dashboard. Hai cron Zalo đã được unschedule bằng migration pause. Có thể giữ Edge Functions/secrets nhưng không để job gọi chúng.
- SePay webhook cũng fail-closed với mã stored-value `BT/BF` khi `NEXT_PUBLIC_ENABLE_STORED_VALUE=false`, nên việc tạm dừng không chỉ phụ thuộc vào UI/Server Action.
- Bật Google provider trong Supabase và `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` trên Vercel.
- Google Console dùng Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback`; Supabase Redirect URLs cho phép `https://www.beanbus.store/auth/callback` và URL preview được duyệt.
- [x] Ẩn phone form khi feature bị tắt; thêm test cho login Google-only.
- Test Gmail mới: login, profile auto-create, account access, logout, login lại; test member bị chặn admin.
- [x] Dùng Supabase CLI với connection string được cấp, so sánh migration inventory và apply các forward migration đã review tới `20260813010000`; remote helper/trigger/privilege smoke và `db lint --schema public` pass, hai Zalo cron vẫn được pause.

**Exit criteria:** Một tài khoản Gmail thật hoàn thành account flow; phone/Zalo không còn UI hay remote execution; có migration inventory được lưu trong checklist phát hành.

### Phase 1 - Sửa giá trị tiền, điểm và voucher

**Mục tiêu:** Không có retry hoặc chuyển trạng thái nào làm cộng/trừ sai giá trị.

- [x] Forward migration sửa loyalty: xử lý reversal độc lập với policy hiện tại; earn mới vẫn tuân policy. Đã thêm pgTAP cho chuỗi `completed -> disable policy -> cancelled/refunded` và replay.
- [x] Giữ một redemption idempotency key qua retry, chỉ rotate sau success đã xác nhận. RPC duplicate lookup scope theo `user_id`; đã thêm contract regression cho cross-user collision.
- [x] Triển khai local state `reserved/consumed/released`: reserve khi tạo đơn, consume khi SePay paid hoặc COD completed, release đúng một lần khi đơn hủy/payment failed/expired; có ledger và cleanup RPC.
- [x] Thêm admin `/admin/policies` để cấu hình voucher cancel/refund, loyalty reversal và refund window; thêm `refund_order_payment` cho SePay.
- Owner xác nhận mốc consume, refund có hoàn voucher hay không, thời gian giữ reservation và cửa sổ refund bằng policy đã tạo.
- Tắt hai voucher seed bằng forward migration trừ khi chủ dự án xác nhận chúng là campaign live.
- [x] Thêm pgTAP cho cancellation, payment expiry, quota release, giới hạn usage và collision redemption; GitHub database job đã pass trên schema sạch. Refund policy và one-time reward voucher vẫn cần kiểm tra/quyết định owner.

**Exit criteria:** Các test race/retry/status-transition pass trên Supabase runtime; không còn open P0.

### Phase 2 - Xác minh hosted auth, account và admin

**Mục tiêu:** Role/RLS đúng với user thật và nhân viên có quy trình vận hành lặp lại được.

- Chạy hosted RLS/behavior smoke trên schema remote đã reconcile; pgTAP đã pass trong GitHub CI trên database ephemeral.
- Read-only smoke remote đã xác nhận member chỉ thấy dữ liệu sở hữu, admin thấy dữ liệu được cấp và UUID lạ không thấy profiles/orders/requests/notifications; cần thêm member thứ hai và mutation/ownership smoke thật trước khi đóng gate.
- Tạo runbook cấp admin bằng thao tác server/SQL được audit; không có UI tự nâng quyền.
- Test hai Gmail: member thường và admin; kiểm tra profile, orders, requests, loyalty, voucher ownership, forbidden routes và logout/expired session.
- Tách Google E2E thành test cấu hình giả trong CI và smoke checklist thật trên staging, vì OAuth thật không nên phụ thuộc vào CI thông thường.
- [x] Sửa account request pagination bằng RPC `UNION ALL` có total count, stable ordering, page bounds, indexes và RLS-aware access.

**Exit criteria:** Member không đọc được dữ liệu người khác; admin thao tác được các workflow được cấp; runbook bootstrap/revoke đã được thử.

### Phase 3 - Hoàn thiện commerce và SePay

**Mục tiêu:** Đơn hàng live không phụ thuộc duy nhất vào webhook và có bằng chứng đối soát.

- Chạy pgTAP order/payment và E2E pickup, delivery, COD, SePay trên hosted Supabase.
- Live smoke với số tiền nhỏ: đúng `DH_<mã hóa đơn>`, đúng account/amount/direction, duplicate webhook không tạo side effect.
- [x] Thêm SePay API v2 reconciliation 15 phút/lần, cursor/checkpoint, lease, idempotent replay, secret server-only, đúng định dạng ngày giờ Việt Nam và structured log counters cho completion/gap. Hosted migration đã áp dụng; còn cần token, dashboard/alert wiring và live verification.
- [x] Chuẩn bị GitHub Actions external scheduler `*/15 * * * *` với HTTPS endpoint, cron secret qua production Environment và feature gate; workflow không chạy khi `SEPAY_RECONCILIATION_ENABLED` chưa bật.
- Thêm IP allowlist ở edge/firewall khi hạ tầng hỗ trợ, vẫn giữ HMAC/timestamp/data validation là bắt buộc.
- [x] Thêm cleanup pending SePay payment hết hạn và nối với voucher release trigger; pending COD vẫn cần owner chốt timeout vận hành.

**Exit criteria:** Webhook và reconciliation cùng hội tụ về một transaction idempotent; có alert cho mismatch/failure; owner ký xác nhận live smoke.

### Phase 4 - Vận hành, security và UI cuối

**Mục tiêu:** Nhân viên nhận được yêu cầu, public forms chống abuse và UI sẵn sàng phát hành.

- Resend là kênh email cho booking/contact/RSVP/B2B; in-app notification đã có, còn thiếu allowlist/delivery smoke và redeploy worker sau khi cấp CLI access token.
- [x] Thêm Turnstile feature-gate cho anonymous order, booking và contact; server-side validation fail-closed, key server-only và default false.
- Owner cấp key/bật flag và chạy abuse smoke; edge/IP rate limit vẫn là hardening sau khi có traffic thật.
- [x] Thêm CSP report-only với allowlist tối thiểu cho app, Supabase, Google map/OAuth và Turnstile; HSTS conditional khi production URL là HTTPS.
- Owner review CSP reports và xác nhận subdomain policy trước khi enforce CSP.
- Ẩn phone UI hoàn toàn; tối ưu Google-only login và kiểm tra keyboard/mobile.
- Tách các component lớn theo workflow, không đổi behavior trong cùng commit với sửa nghiệp vụ.
- Thay dần regex contract tests ở vùng tiền/điểm/quyền bằng unit behavior, pgTAP và Playwright thật.
- Hoàn thiện privacy, terms, owner assets, monitoring, backup/restore và rollback checklist.

**Exit criteria:** CI quality/database/E2E xanh, staging sign-off ở 375/768/1440 px, không có P0/P1 mở, rollback đã được diễn tập.

## 6. Notification và Resend: trạng thái triển khai

### Đã hoàn tất trong source local

- [x] Ba Edge Function notification dùng cơ chế xác thực riêng; Supabase gateway không yêu cầu JWT cho cron, Resend webhook và unsubscribe endpoint.
- [x] Hard suppression chỉ gồm bounce/complaint; unsubscribe marketing chỉ tắt email sự kiện và tin cửa hàng.
- [x] Email cập nhật đơn hàng luôn bật ở database và UI.
- [x] Unsubscribe GET chỉ hiển thị xác nhận; POST mới thay đổi preference; email marketing có one-click unsubscribe headers.
- [x] Completion RPC đối soát delivery event đến trước hoặc sau worker, ưu tiên bounce/complaint hơn delivered.
- [x] Client notification flag được Next.js inline tĩnh; không phụ thuộc dynamic env lookup trong browser bundle.
- [x] Worker kiểm tra kết quả completion/failure RPC; queue re-check suppression và marketing opt-out trước khi claim.
- [x] Outbox pending marketing bị hủy khi unsubscribe hoặc bounce/complaint; trạng thái `cancelled` tách khỏi `failed`.
- [x] Resend webhook kiểm tra content type, giới hạn body 64 KiB và đọc stream bounded trước khi verify chữ ký.
- [x] Trang unsubscribe escape email và action URL trước khi render HTML.
- [x] Password recovery chỉ nhận biết bằng `exchangeCodeForSession().data.redirectType`; capability cookie HMAC theo user/expiry và xóa đúng path.
- [x] Notification date rendering cố định `Asia/Ho_Chi_Minh`; generated database types khớp trạng thái migration; worker xác nhận `failure RPC` trả `true`.
- [x] Thu hồi quyền RPC khỏi PUBLIC/anon; chỉ authenticated hoặc service_role được cấp đúng hàm.
- [x] Feature flag notification bao phủ bell, admin navigation, dashboard KPI và các page.
- [x] UI hiển thị lỗi tải notification thay vì biến lỗi thành danh sách rỗng.
- [x] Contract và pgTAP đã bổ sung kiểm tra gateway, suppression, preference, quyền anon và race webhook/outbox.
- [x] Migration `20260812050000_staff_request_notifications.sql` bổ sung trigger fan-out booking/contact cho admin; migration `20260813010000_notification_set_based_fanout.sql` chuyển fan-out sang `INSERT ... SELECT`; worker dùng sender transactional `RESEND_NOTIFY_FROM`, không gửi nhầm qua sender news.
- [x] Admin request list/detail đã bỏ bộ lọc và nhãn `notification_status` legacy; notification center là điểm truy cập thống nhất.
- [x] Thêm workflow GitHub `Deploy Supabase Edge Functions` chạy thủ công theo `production` environment; hỗ trợ deploy từng function hoặc cả bộ, không tự chạy theo push.

### Còn phải làm trước production

- [x] Kiểm tra migration inventory remote bằng `DATABASE_URL` và apply các migration SePay/notification tới `20260813010000_notification_set_based_fanout.sql`; remote inventory khớp `45/45`, CLI chưa link project nhưng `db push --db-url` đã thành công.
- [x] Chạy pgTAP trên schema sạch bằng Supabase local/Colima: `24` file, `390/390` tests pass; smoke transaction remote xác nhận trigger booking/contact và hosted RLS hai member/admin, tất cả rollback sạch. Hosted UI/provider behavior vẫn cần tài khoản thật.
- [x] Ba Edge Function notification đã được tạo/deploy trước đó với `verify_jwt=false`, Vault, Resend webhook endpoint và DNS sender; bản worker mới đổi sender transactional cần redeploy sau khi CLI có access token.
- [x] Resend send smoke tới hai Gmail test được provider chấp nhận; worker production trả `disabled=true` đúng feature flag. Delivered/bounced/complained, webhook và unsubscribe thực tế vẫn cần xác minh từ mailbox/provider dashboard.
- [ ] Cấu hình `SUPABASE_ACCESS_TOKEN` secret và `SUPABASE_PROJECT_REF` variable trong GitHub `production` environment, sau đó chạy workflow deploy worker mới.
- [x] Xác nhận pg_cron/pg_net gọi worker mỗi phút sau khi secrets Vault đã có; worker production trả HTTP 200; chưa bật `NOTIFICATION_EMAIL_MODE` trước smoke test.
- [ ] Chạy Playwright bằng admin/member thật cho badge realtime, mark read, announcement, preference và notification booking/contact.
- [ ] Khi bật password auth, bật Supabase Auth `Require current password when changing password` và smoke password update/recovery trên hosted.
- [ ] Sau khi sign-off mới bật `NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true` và `NOTIFICATION_EMAIL_MODE=enabled`.

### Backlog sau release gate

- [x] Chuyển fan-out order/booking/customer/event/announcement từ vòng lặp row-by-row sang helper `INSERT ... SELECT` set-based trong migration `20260813010000_notification_set_based_fanout.sql`; dedupe, preference, suppression và transactional outbox vẫn được giữ.
- [x] Bổ sung pagination cho notification history; browser accessibility audit hosted vẫn chờ tài khoản test thật.
- [ ] Thay dần source-regex contract bằng behavior/integration test chạy PostgreSQL thật.

## 7. Không nằm trong release hiện tại

- Phone OTP, Zalo ZBS hoặc SMS provider khác.
- Stored-value top-up và flash-sale.
- Inventory đa chi nhánh, loyalty tiers phức tạp hoặc ứng dụng mobile.
- Rich-text editor, analytics dashboard lớn hoặc thay design system.

## 8. Definition of Done

Một task chỉ được đánh dấu hoàn thành khi:

- Có test behavior phù hợp; thay đổi DB có pgTAP và migration forward-only.
- `npm run lint`, `npx tsc --noEmit`, `npm test` (295/295), `npm run build`, pgTAP local (390/390), live smoke production (1/1) và GitHub CI run `31623250915` trên `620d058` pass; production health đã xác nhận `mode: production` và revision khớp deployment tại thời điểm kiểm tra; live-smoke của workflow này được thiết kế opt-in qua `workflow_dispatch`.
- Luồng UI bị ảnh hưởng được test keyboard và mobile; không có loading/error/empty state giả.
- Auth/RLS/ownership được kiểm thử bằng ít nhất hai user khác nhau.
- Payment/points/voucher mutation idempotent, auditable và không log secret/OTP/full PII.
- Có rollback hoặc feature flag rõ ràng cho integration external.
- Trạng thái remote được kiểm chứng từ `migration list`, `db lint --fail-on error` và truy vấn chỉ đọc hiện tại, không suy ra từ tài liệu cũ.
