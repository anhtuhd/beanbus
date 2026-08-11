# Kế hoạch hoàn thiện Beanbus

**Cập nhật:** 2026-08-11

**Trạng thái:** Đang triển khai, chưa sẵn sàng phát hành production

**Phạm vi hiện tại:** Dùng Google OAuth để tạo/đăng nhập tài khoản hội viên; tạm dừng Phone OTP/Zalo; giữ stored-value và flash-sale ở trạng thái tắt.

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
- `npm test`: 238/238 pass.
- `npm run build`: pass.
- `npm run test:e2e:auth`: 4/4 pass với Google enabled và phone disabled ở 375/768/1440px; chưa thực hiện OAuth Gmail thật.
- `npm run test:e2e`: 30/40 pass; 10 production/provider tests skipped vì chưa có hosted credentials, trong đó live smoke được chạy riêng khi có `PLAYWRIGHT_LIVE=true`.
- `npm run test:e2e:live`: fail đúng tại assertion Google-only vì production vẫn render nút `Nhận mã qua Zalo`; health check và trang login đều reachable.
- GitHub Actions đã có `workflow_dispatch` live smoke nhận `production_base_url`, bắt buộc HTTPS, chạy sau E2E và chỉ kiểm tra public production surface.
- E2E customer requests đã pass 4/4 sau khi port RSVP modal ra `document.body`, tránh overlay bị kéo theo card có hiệu ứng hover/transform.
- E2E accessibility header/menu ban đầu lộ lỗi focus không ổn định; đã sửa và xác nhận 20/20 lần lặp, sau đó full E2E pass.
- Đã thêm live smoke opt-in `npm run test:e2e:live` với `PLAYWRIGHT_BASE_URL`, nhưng chưa đánh dấu pass vì production hiện còn render login build cũ.
- Production smoke read-only: `https://www.beanbus.store/api/health` trả `200` với mode `production`; Supabase Google authorize với callback production trả `302`. Sau các commit source tới `85d0644`, production vẫn cần được Vercel redeploy để xác nhận HTML Google-only; lần kiểm tra trước còn nút Zalo/divider. Webhook `/hooks/payment` trả `401` khi thiếu HMAC, chứng minh SePay webhook production đang bật; `/api/cron/sepay-reconciliation` trả `404`, chứng minh reconciliation cron đang tắt. Gmail callback/profile/admin role thật vẫn chưa test.
- Đã bổ sung `suppressHydrationWarning` cho cả `html` và `body` để không báo lỗi khi extension/browser tooling chèn attribute trước hydration; contract test đã thêm.
- Cảnh báo React dev `Encountered a script tag while rendering React component` được xác minh là cảnh báo development khi render native JSON-LD; Next.js 16 vẫn khuyến nghị native JSON-LD script cho structured data. Production build đã kiểm tra trực tiếp, không có console warning hoặc page error, nên giữ nguyên cách triển khai hiện tại.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerability.
- Đã gọi `npm run db:lint` và `npm run db:test`, nhưng cả hai bị chặn: máy không có Docker/Postgres local và Supabase CLI không kết nối được `127.0.0.1:54322`; pgTAP chưa được thực thi runtime.
- Đã dùng Supabase CLI với connection string đã cấu hình để đối chiếu đủ 37 migration local với remote. Remote đã áp dụng tới `20260811050000_fix_flash_sale_error_precedence.sql`; truy vấn chỉ đọc xác nhận function flash-sale ưu tiên `FLASH_SALE_USER_LIMIT`, ledger SePay/voucher tồn tại và hai Zalo cron có `0` job active. `db lint --fail-on error` pass với `No schema errors found`; advisor nhiều permissive policy vẫn ở backlog P2.
- GitHub Actions run `31461207779` trên commit `a599a69` đã xanh `quality` và toàn bộ E2E; job database vẫn fail ở bước pgTAP. Artifact `pgtap-output` đã được upload để người có quyền GitHub tải log assertion; không đánh dấu database/release gate hoàn tất.

Các increment đã triển khai local: Google-only login UI và auth E2E, loyalty reversal forward migration, redemption idempotency key ổn định qua retry, RPC chống collision khác user, RPC phân trang request `UNION ALL` có total count/RLS, first-admin/release runbook, voucher reservation lifecycle, form CAPTCHA feature-gate, RSVP modal ổn định ngoài card hover, và SePay API v2 reconciliation feature-gated với text-key ledger, lease/checkpoint, malformed-payment retry safety, expired-payment cleanup, Vercel cron và structured operational events cho outcome/gap/counters. Đã thêm pgTAP regression tests cho loyalty, request pagination, voucher lifecycle và reconciliation. Các migration đã được reconcile/apply lên remote; provider, feature flag production và hosted user smoke vẫn chưa hoàn tất.

## 3. Tiến độ theo chức năng

| Khu vực | Trạng thái code | Việc còn thiếu trước production |
|---|---|---|
| Public site, menu, content, responsive UI | Gần hoàn chỉnh | Nội dung/ảnh chính thức, privacy/terms, browser audit cuối |
| Google Auth và session guards | Đã có | Bật provider/flag, smoke test tài khoản Gmail thật, xác minh profile trigger và logout |
| Phone OTP/Zalo | Đã code nhưng tạm dừng | Giữ flag false; vô hiệu Auth Hook/cron/provider remote nếu đã bật |
| Hội viên | Đã có profile, đơn, request, voucher, loyalty; request pagination và voucher reservation đã chuyển xuống RPC/ledger; loyalty summary lint đã sửa | Chạy pgTAP/RLS hosted; owner xác nhận refund/voucher policy |
| Admin | Đã có route guard và các màn vận hành chính | Quy trình cấp admin đầu tiên, kiểm thử role thật và vận hành hosted |
| Order/checkout | Server-priced, idempotent và có reservation/release voucher local | Chạy pgTAP/hosted E2E; xác nhận policy refund và expiry |
| SePay đơn hàng | HMAC webhook, dedupe, VietQR và reconciliation API v2 đã có dưới feature flag; schema remote đã có ledger/checkpoint | Token, live smoke, IP allowlist và cảnh báo lỗi |
| Booking/contact/RSVP/B2B | Đã lưu server và có admin workflow | Kênh thông báo cho nhân viên, chống abuse theo IP/CAPTCHA |
| Stored-value/flash-sale | Đã code sau nhiều lớp gate | Tiếp tục tắt; chưa nằm trong release hiện tại |
| Test/CI | Local gate xanh | Giảm source-regex tests, chạy pgTAP và authenticated hosted E2E |

Ước lượng hiện tại: UI/routes khoảng 95%, backend implementation khoảng 93%, nhưng production verification chỉ khoảng 55%. Release readiness tổng thể khoảng 79% và vẫn bị chặn bởi Google/role smoke, pgTAP/RLS hosted, voucher policy và payment smoke.

## 4. Findings cần xử lý

### P0 - Chặn phát hành

1. **Loyalty reversal đã có forward fix và remote lint đã pass, nhưng chưa có runtime/pgTAP sign-off.** `apply_loyalty_for_order()` hiện xử lý reversal độc lập với policy hiện tại; pgTAP regression đã thêm cho chuỗi disable policy -> cancel/refund. Chưa coi là đóng trước production cho tới khi chạy trên schema sạch và remote test account.
2. **Voucher lifecycle đã có schema remote nhưng chưa có runtime/pgTAP sign-off đầy đủ.** Migration đã có `reserved/consumed/released`, cleanup SePay expiry và audit ledger; mặc định consume khi SePay paid/COD completed, release khi cancel/payment failed/expired. Owner vẫn phải xác nhận refund có hoàn voucher hay không trước khi mở checkout production.
3. **Remote inventory đã được reconcile và apply.** 37 migration local khớp remote tới `20260811050000`; còn thiếu pgTAP/RLS runtime và backup/restore sign-off, không còn drift chưa giải thích.

### P1 - Phải hoàn thành trước mở traffic thật

1. **Redemption idempotency đã có forward fix ở local, chưa được runtime/remote xác nhận.** UI giữ key qua retry; RPC scope duplicate theo `user_id` và trả conflict chung cho collision khác user. Cần pgTAP/runtime hosted trước khi coi là đóng.
2. **Hai voucher seed đang active không thời hạn.** `BEANBUS10` và `WELCOMEVIP` có thể trở thành khuyến mãi production ngoài ý muốn. Chủ dự án phải phê duyệt hoặc tắt bằng forward migration.
3. **Google happy path chưa được kiểm thử và production deployment còn stale.** E2E local chứng minh Google-only UI; hosted authorize trả `302`, nhưng chưa chứng minh Gmail mới tạo `auth.users`, `profiles`, session và logout đúng. Các commit source tới `85d0644` đã được push; build production cần Vercel redeploy/merge vào production branch.
4. **Tắt flag phone chưa đủ để dừng toàn bộ Zalo remote.** Hai cron đã được xác nhận không active sau migration pause, nhưng owner vẫn phải kiểm tra Phone provider và Send SMS Hook trên Supabase Dashboard.
5. **SePay webhook production đang bật nhưng reconciliation cron đang tắt.** Webhook chưa có HMAC trả `401`; cron trả `404`, nên chưa cần token cron. Nếu giữ webhook live, vẫn cần live smoke/alert/IP allowlist; nếu bật reconciliation sau này, cấp API v2 token và hoàn tất gate trước. SePay khuyến nghị đối soát 15-30 phút/lần: [bảo mật webhook](https://developer.sepay.vn/vi/sepay-webhooks/bao-mat), [API giao dịch v2](https://developer.sepay.vn/vi/sepay-api/v2/giao-dich/danh-sach).
6. **Anonymous mutation đã có Turnstile feature-gate ở local.** Booking/contact/order gọi Cloudflare Siteverify trước khi ghi khi `NEXT_PUBLIC_ENABLE_FORM_CAPTCHA=true`; production vẫn cần owner cấp key, bật flag và kiểm tra abuse/alert.
7. **Booking/contact chưa thông báo cho nhân viên.** Dữ liệu được lưu trung thực với `notification_status=not_configured`, nhưng vận hành phải chủ động mở admin để thấy yêu cầu mới.

### P2 - Hardening và maintainability

1. 54/69 file unit test đọc source bằng `readFileSync` và regex. Chúng hữu ích cho contract tĩnh nhưng không thay thế runtime behavior; vùng loyalty/redemption/request pagination/voucher lifecycle đã có regression contract và pgTAP, nhưng vẫn cần chạy Postgres thật.
2. Account request pagination đã chuyển sang RPC `UNION ALL` với stable ordering, bounded page size, total count và RLS-aware access. Cần chạy pgTAP trên Postgres runtime để xác nhận SQL thực thi đúng.
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
- [x] Dùng Supabase CLI với connection string được cấp, so sánh đủ 37 migration và apply các forward migration đã review; migration cuối dọn warning lint, sửa precedence flash-sale và giữ pause hai Zalo cron.

**Exit criteria:** Một tài khoản Gmail thật hoàn thành account flow; phone/Zalo không còn UI hay remote execution; có migration inventory được lưu trong checklist phát hành.

### Phase 1 - Sửa giá trị tiền, điểm và voucher

**Mục tiêu:** Không có retry hoặc chuyển trạng thái nào làm cộng/trừ sai giá trị.

- [x] Forward migration sửa loyalty: xử lý reversal độc lập với policy hiện tại; earn mới vẫn tuân policy. Đã thêm pgTAP cho chuỗi `completed -> disable policy -> cancelled/refunded` và replay.
- [x] Giữ một redemption idempotency key qua retry, chỉ rotate sau success đã xác nhận. RPC duplicate lookup scope theo `user_id`; đã thêm contract regression cho cross-user collision.
- [x] Triển khai local state `reserved/consumed/released`: reserve khi tạo đơn, consume khi SePay paid hoặc COD completed, release đúng một lần khi đơn hủy/payment failed/expired; có ledger và cleanup RPC.
- Owner xác nhận mốc consume, refund có hoàn voucher hay không, và thời gian giữ reservation trước khi mở checkout production.
- Tắt hai voucher seed bằng forward migration trừ khi chủ dự án xác nhận chúng là campaign live.
- [x] Thêm pgTAP cho cancellation, payment expiry, quota release và giới hạn usage; runtime execution, refund policy và one-time reward voucher vẫn cần kiểm tra/ quyết định owner.

**Exit criteria:** Các test race/retry/status-transition pass trên Supabase runtime; không còn open P0.

### Phase 2 - Xác minh hosted auth, account và admin

**Mục tiêu:** Role/RLS đúng với user thật và nhân viên có quy trình vận hành lặp lại được.

- Chạy toàn bộ pgTAP trên schema remote đã reconcile.
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
- Thêm IP allowlist ở edge/firewall khi hạ tầng hỗ trợ, vẫn giữ HMAC/timestamp/data validation là bắt buộc.
- [x] Thêm cleanup pending SePay payment hết hạn và nối với voucher release trigger; pending COD vẫn cần owner chốt timeout vận hành.

**Exit criteria:** Webhook và reconciliation cùng hội tụ về một transaction idempotent; có alert cho mismatch/failure; owner ký xác nhận live smoke.

### Phase 4 - Vận hành, security và UI cuối

**Mục tiêu:** Nhân viên nhận được yêu cầu, public forms chống abuse và UI sẵn sàng phát hành.

- Chọn một kênh thông báo nhân viên cho booking/contact/RSVP/B2B; update `notification_status` theo delivery thật và retry có giới hạn.
- [x] Thêm Turnstile feature-gate cho anonymous order, booking và contact; server-side validation fail-closed, key server-only và default false.
- Owner cấp key/bật flag và chạy abuse smoke; edge/IP rate limit vẫn là hardening sau khi có traffic thật.
- [x] Thêm CSP report-only với allowlist tối thiểu cho app, Supabase, Google map/OAuth và Turnstile; HSTS conditional khi production URL là HTTPS.
- Owner review CSP reports và xác nhận subdomain policy trước khi enforce CSP.
- Ẩn phone UI hoàn toàn; tối ưu Google-only login và kiểm tra keyboard/mobile.
- Tách các component lớn theo workflow, không đổi behavior trong cùng commit với sửa nghiệp vụ.
- Thay dần regex contract tests ở vùng tiền/điểm/quyền bằng unit behavior, pgTAP và Playwright thật.
- Hoàn thiện privacy, terms, owner assets, monitoring, backup/restore và rollback checklist.

**Exit criteria:** CI quality/database/E2E xanh, staging sign-off ở 375/768/1440 px, không có P0/P1 mở, rollback đã được diễn tập.

## 6. Không nằm trong release hiện tại

- Phone OTP, Zalo ZBS hoặc SMS provider khác.
- Stored-value top-up và flash-sale.
- Inventory đa chi nhánh, loyalty tiers phức tạp hoặc ứng dụng mobile.
- Rich-text editor, analytics dashboard lớn hoặc thay design system.

## 7. Definition of Done

Một task chỉ được đánh dấu hoàn thành khi:

- Có test behavior phù hợp; thay đổi DB có pgTAP và migration forward-only.
- `npm run lint`, `npx tsc --noEmit`, `npm test` và `npm run build` pass.
- Luồng UI bị ảnh hưởng được test keyboard và mobile; không có loading/error/empty state giả.
- Auth/RLS/ownership được kiểm thử bằng ít nhất hai user khác nhau.
- Payment/points/voucher mutation idempotent, auditable và không log secret/OTP/full PII.
- Có rollback hoặc feature flag rõ ràng cho integration external.
- Trạng thái remote được kiểm chứng từ `migration list`, `db lint --fail-on error` và truy vấn chỉ đọc hiện tại, không suy ra từ tài liệu cũ.
