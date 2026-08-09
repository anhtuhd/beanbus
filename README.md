# Beanbus Coffee Roaster

Website thương hiệu và thương mại cho Beanbus Coffee Roaster, xây dựng bằng Next.js 16 App Router, React 19 và TypeScript.

## Trạng thái

- [x] UI public, menu, cart, checkout, booking, account và admin prototype
- [x] Type check, lint gate và production build
- [x] Test runner cho business rules
- [x] Playwright E2E smoke cho menu → cart → checkout
- [x] Supabase SSR clients, session Proxy và local migration workflow
- [x] Supabase profile schema, authentication shell và role-based RLS
- [x] Catalog schema, production read model và route chi tiết sản phẩm
- [x] Order schema, server-priced transaction, production checkout và receipt xác nhận có capability token
- [ ] Xác minh auth provider và RLS trên Supabase runtime có credential
- [ ] Xác minh order migration/pgTAP trên Supabase runtime có credential
- [ ] Payment/loyalty chạy hoàn toàn phía server
- [x] Sepay payment ledger, HMAC webhook và VietQR UI được feature-gate
- [ ] Xác minh Sepay Test mode/production bằng credential của chủ dự án
- [ ] Admin production, SEO, accessibility và release gate

Theo dõi task chi tiết tại [`tasks/todo.md`](tasks/todo.md) và kiến trúc tại [`tasks/plan.md`](tasks/plan.md).

## Chạy local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Mặc định ứng dụng chạy ở `demo` mode; các credential Supabase và Sepay sẽ được cấu hình sau.

## Supabase local

Supabase CLI `2.113.0` được ghim trong `devDependencies`. Cần Docker-compatible runtime để chạy stack local.

```bash
npm run supabase:start
npm run db:reset
```

Sau khi `supabase:start` hoàn tất, lấy Project URL và Publishable key từ output rồi điền vào `.env.local`. Giữ `SUPABASE_SECRET_KEY` (`sb_secret_...`) ở server; tuyệt đối không thêm tiền tố `NEXT_PUBLIC_` cho key này.

Workflow schema:

```bash
npm run db:new -- ten_migration
npm run db:reset
npm run db:lint
npm run db:test
```

Khi đã có Supabase project và đăng nhập CLI, dùng `npx supabase link --project-ref <project-ref>` một lần, sau đó `npm run db:push` để đẩy migration đã review. Không chỉnh schema production trực tiếp trên Dashboard nếu thay đổi đó chưa được lưu thành migration.

## Cấu hình đăng nhập

Hai provider đều được tắt mặc định để production không hiển thị luồng chưa cấu hình:

```dotenv
NEXT_PUBLIC_ENABLE_PHONE_AUTH=false
NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=false
```

Để bật SMS OTP, cấu hình một SMS provider trong Supabase Auth rồi đổi `NEXT_PUBLIC_ENABLE_PHONE_AUTH=true`. Để bật Google, cấu hình Google Client ID/Secret trong Supabase Auth, thêm `<NEXT_PUBLIC_SITE_URL>/auth/callback` vào danh sách redirect URL cho phép, rồi đổi `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true`.

Credential của SMS provider và Google chỉ nhập trong Supabase Dashboard hoặc secret store của môi trường triển khai; không đưa chúng vào biến `NEXT_PUBLIC_*` hay commit vào repo.

## Cấu hình Sepay

Sepay tắt mặc định. Khi đã có tài khoản ngân hàng liên kết, điền các biến server trong secret store rồi mới bật cờ public:

```dotenv
NEXT_PUBLIC_ENABLE_SEPAY=true
SEPAY_WEBHOOK_SECRET=
SEPAY_BANK_CODE=
SEPAY_BANK_ACCOUNT=
SEPAY_ACCOUNT_NAME=
```

Trên Sepay Dashboard, tạo webhook `Money in` dạng JSON tới `<NEXT_PUBLIC_SITE_URL>/api/webhooks/sepay`, chọn `HMAC-SHA256`, và dùng cùng `SEPAY_WEBHOOK_SECRET`. Cấu hình payment-code prefix `BB` với suffix số để Sepay trích mã như `BB123`; không chọn chế độ không xác thực ở production. Contract HMAC và payload bám theo [tài liệu xác thực webhook](https://developer.sepay.vn/en/sepay-webhooks/xac-thuc) và [tài liệu tích hợp webhook](https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook).

`SUPABASE_SECRET_KEY` cũng bắt buộc khi bật Sepay để Route Handler gọi transaction đối soát service-only. `SEPAY_API_KEY` chưa bắt buộc; chỉ cần sau này khi bật reconciliation API.

## Quality gates

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:checkout-production
npm run test:e2e:checkout-sepay
```

Không commit `.env.local`, Supabase secret key, Sepay API key hoặc webhook secret.
