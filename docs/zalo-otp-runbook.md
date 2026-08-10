# Zalo OTP Runbook

Beanbus giữ Supabase Auth làm nơi sinh, hết hạn và xác minh OTP. Edge Function `send-zalo-otp` chỉ chuyển OTP sang ZBS Template Message qua số điện thoại; đây là tin trong ứng dụng Zalo, không phải SMS nhà mạng và chỉ tới số đã liên kết tài khoản Zalo.

## Trước Khi Deploy

- OA Beanbus đã xác thực, có gói OpenAPI và liên kết ZBS Account còn số dư.
- Zalo App đã kích hoạt, liên kết OA và được cấp quyền gửi template qua số điện thoại.
- Template loại OTP đã duyệt, không CTA, tham số chính xác là `otp`.
- Có OA Access Token, Refresh Token ban đầu và thời điểm phát hành token.
- Có Cloudflare Turnstile Site Key/Secret Key.
- Google OAuth vẫn bật làm fallback trong suốt rollout.

Không gửi App Secret hoặc token qua chat, không đặt chúng trong `.env.local`, và không dán chúng vào issue/commit/log.

## Thứ Tự Deploy

1. Giữ `NEXT_PUBLIC_ENABLE_PHONE_AUTH=false` trên Vercel.
2. Review rồi áp dụng migration `20260810120000_zalo_otp_auth.sql`.
3. Deploy hai function không xác minh JWT; mỗi function tự xác minh caller bằng hook/job secret:

```bash
npx supabase functions deploy send-zalo-otp --no-verify-jwt
npx supabase functions deploy refresh-zalo-token --no-verify-jwt
```

4. Trong Supabase Edge Function Secrets, nhập trực tiếp:

```text
ZALO_APP_ID
ZALO_APP_SECRET
ZALO_TEMPLATE_ID
ZALO_OTP_PARAM=otp
SEND_SMS_HOOK_SECRET
ZALO_REFRESH_JOB_SECRET
```

`SUPABASE_URL` và service-role credential do Edge Runtime cung cấp. Không tạo biến `NEXT_PUBLIC_*` cho bất kỳ giá trị nào ở trên. `ZALO_REFRESH_JOB_SECRET` phải là chuỗi ngẫu nhiên mạnh và giống giá trị Vault ở bước kế tiếp.

5. Trong Supabase Vault UI, tạo trực tiếp bốn secret có đúng tên:

```text
zalo_oa_access_token
zalo_oa_refresh_token
project_url
zalo_refresh_job_secret
```

`project_url` có dạng `https://<project-ref>.supabase.co`. Sau khi hai token đã nằm trong Vault, chạy trong SQL Editor bằng quyền quản trị, với thời điểm hết hạn thật của Access Token:

```sql
select public.initialize_zalo_oauth_state('<access-token-expiry-utc>'::timestamptz);
```

Không đặt token vào lời gọi RPC. Migration thu hồi quyền Vault trực tiếp của `anon`, `authenticated` và `service_role`; Edge Function chỉ đọc/cập nhật token qua các RPC hẹp chạy `security definer`.

6. Trong Supabase Auth:

- Bật Phone Signups và Phone Confirmations để `updateUser({ phone })` luôn đi qua OTP `phone_change`.
- Đặt OTP 6 số, hết hạn 300 giây, resend tối thiểu 60 giây.
- Giữ giới hạn ban đầu 30 OTP/giờ và theo dõi trước khi tăng.
- Bật Bot Protection với provider Turnstile và nhập Secret Key.
- Tạo HTTP `Send SMS Hook` tới `https://<project-ref>.supabase.co/functions/v1/send-zalo-otp`.
- Dùng cùng `SEND_SMS_HOOK_SECRET` cho chữ ký Standard Webhooks.

7. Trên Vercel thêm `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; chưa bật phone feature flag.

Cron `beanbus-refresh-zalo-token` chạy lúc phút 17 mỗi 12 giờ. Job chỉ refresh khi Access Token còn tối đa 14 giờ, nhận lease 5 phút, và cập nhật Access/Refresh Token mới trong cùng transaction sau khi Zalo trả thành công. Cron `beanbus-clear-stale-phone-changes` xóa pending phone change quá 15 phút.

## Staging Gate

Dùng ít nhất hai số Việt Nam `+84` có tài khoản Zalo thật để kiểm tra:

- Đăng ký mới bằng OTP, resend chỉ mở sau 60 giây, mã hết hạn bị từ chối.
- Đăng nhập lại bằng số đã có và kiểm tra profile chỉ hiển thị số đã xác minh.
- Đăng nhập Google, thêm số mới, đổi số, và xác minh bằng `phone_change`.
- Thử liên kết số đang thuộc tài khoản khác; UI phải trả lỗi chung và không gộp tài khoản.
- Làm Zalo trả lỗi/timeout; UI phải giữ Google fallback và log không chứa OTP, token hoặc toàn bộ số.
- Chạy hai lần refresh đồng thời; chỉ một lease được cấp và Refresh Token không bị dùng hai lần.

Sau khi cả đăng nhập mới và liên kết số Google thành công, đặt `NEXT_PUBLIC_ENABLE_PHONE_AUTH=true` trên staging trước, rồi production.

## Rollback Và Mất Token

- Rollback ứng dụng: đặt `NEXT_PUBLIC_ENABLE_PHONE_AUTH=false`; Google OAuth tiếp tục hoạt động.
- Provider incident kéo dài: tắt Send SMS Hook trong Supabase Auth để dừng yêu cầu gửi mới.
- Không rollback migration bằng thao tác phá hủy; phát hành forward migration nếu cần đổi schema.
- Nếu mất chuỗi refresh xoay vòng: tắt phone flag, cấp lại Access/Refresh Token bằng Zalo API Explorer, thay hai secret trong Vault UI, gọi lại `initialize_zalo_oauth_state()` với expiry mới, chạy staging gate rồi mới bật lại.

Tài liệu nền: [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [Phone Login](https://supabase.com/docs/guides/auth/phone-login), [Rate Limits](https://supabase.com/docs/guides/auth/rate-limits), [Vault](https://supabase.com/docs/guides/database/vault), [Zalo gửi template qua SĐT](https://developers.zalo.me/docs/zbs-template-message/gui-tin-template-qua-sdt/api-gui-tin-qua-sdt/api-gui-tin), [Zalo OA OAuth](https://developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new).
