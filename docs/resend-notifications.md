# Resend và trung tâm thông báo

## Phạm vi

Migration `20260812040545_notification_center.sql` tạo notification center, email outbox, delivery event và cron worker. Migration đã được apply lên Supabase remote cùng migration retry SePay ngày 2026-08-12; migration không backfill dữ liệu cũ. Khi `NOTIFICATION_EMAIL_MODE` chưa là `enabled`, worker trả về thành công nhưng không claim queue; có thể bật lại mà không mất outbox.

## DNS và Resend

Với Resend Free, chỉ xác thực một custom domain. Dùng `notify.beanbus.store` cho cả
Supabase Auth và notification center; các địa chỉ sender khác nhau vẫn dùng được
miễn là cùng nằm dưới domain đã xác thực.

- `notify.beanbus.store`: domain duy nhất cần verify trong Resend.
- `no-reply@notify.beanbus.store`: Supabase Auth SMTP.
- `orders@notify.beanbus.store`: email giao dịch đơn hàng.
- `news@notify.beanbus.store`: sự kiện và tin cửa hàng.

Email trạng thái đơn hàng là transactional và luôn được bật. Email sự kiện/tin cửa hàng mới chịu preference opt-in và liên kết unsubscribe.

Tạo webhook Resend tới:

```text
https://<supabase-project-ref>.supabase.co/functions/v1/resend-webhook
```

Chọn các sự kiện gửi, delivered, bounced và complained. Không đưa API key hoặc webhook secret vào Git, Vercel client environment, hay biến `NEXT_PUBLIC_*`.
Function `resend-webhook` dùng chữ ký Svix của Resend; Supabase Gateway không yêu cầu JWT cho webhook. Liên kết unsubscribe dùng HMAC riêng; GET chỉ hiển thị trang xác nhận, POST mới hủy đăng ký.

## Supabase secrets

Đặt các secret sau trong Edge Function Secrets. Giá trị `SUPABASE_URL` và service key cần có sẵn theo project; không expose service key cho trình duyệt.

```text
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
RESEND_NOTIFY_FROM=Beanbus <orders@notify.beanbus.store>
RESEND_NEWS_FROM=Beanbus <news@notify.beanbus.store>
EMAIL_UNSUBSCRIBE_SECRET=<random-32-byte-secret>
NOTIFICATION_WORKER_SECRET=<random-32-byte-secret>
APP_SITE_URL=https://www.beanbus.store
NOTIFICATION_EMAIL_MODE=disabled
```

Sau khi migration chạy, ghi hai giá trị vào Supabase Vault để pg_cron gọi worker:

- `project_url`: URL project Supabase, ví dụ `https://<project-ref>.supabase.co`.
- `notification_worker_secret`: trùng với `NOTIFICATION_WORKER_SECRET`.

Có thể tạo secret ngẫu nhiên bằng:

```bash
openssl rand -hex 32
```

Chỉ sau khi thử nghiệm allowlist thành công mới đổi `NOTIFICATION_EMAIL_MODE=enabled`.

## Supabase Auth SMTP

Trong Auth SMTP Settings:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key
- Sender name: `Beanbus`
- Sender email: `no-reply@notify.beanbus.store`

Dùng API key riêng cho SMTP/Auth nếu quy trình vận hành yêu cầu tách quyền. Reset password, email xác thực Supabase và notification center đều dùng domain `notify.beanbus.store`.

## Vercel và phát hành

Đặt trên Vercel:

```text
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
```

Không đặt `NOTIFICATION_EMAIL_MODE`, Resend API key, webhook secret hoặc unsubscribe secret ở Vercel nếu worker chạy trên Supabase. Bật feature flag UI sau khi migration và Edge Functions đã deploy.

Rollback nhanh:

```text
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=false
NOTIFICATION_EMAIL_MODE=disabled
```

Dữ liệu notification/outbox vẫn được giữ để điều tra; worker không lấy thêm email khi bị tắt.

## Deploy và kiểm tra

```bash
npx supabase db push
npx supabase functions deploy dispatch-notification-emails
npx supabase functions deploy resend-webhook
npx supabase functions deploy email-unsubscribe
```

Ba function đã được deploy lên project production `jbxzdvunnqjlmsozkvwm`.
Health-check sau deploy trả lần lượt `405`, `400` và `400`; cron worker trả `200`
định kỳ sau khi Vault được cấu hình.

Kiểm tra theo thứ tự: tạo đơn test để xác nhận admin nhận notification, đổi trạng thái để xác nhận hội viên nhận notification, công bố event/store announcement, sau đó bật worker cho hai email allowlist. Cuối cùng gửi email bounce/complaint giả lập từ Resend và xác nhận địa chỉ bị suppression không được gửi lại.

Bounce/complaint là hard suppression cho mọi loại email. Unsubscribe marketing chỉ tắt event/store và có thể bật lại từ `/account/notifications`; nó không chặn email đơn hàng.

## Hardening đã triển khai

- Client chỉ bật chuông khi cờ public được Next.js inline tĩnh trong bundle.
- Worker kiểm tra kết quả completion/failure RPC; lỗi completion sẽ quay lại retry flow với idempotency key giữ nguyên.
- Queue re-check suppression và preference lúc claim; email marketing pending được đánh dấu `cancelled` sau unsubscribe hoặc hard suppression.
- Webhook chỉ nhận JSON và giới hạn body 64 KiB trước khi xác minh chữ ký Svix.
- Trang xác nhận unsubscribe escape email và action URL trước khi đưa vào HTML.
