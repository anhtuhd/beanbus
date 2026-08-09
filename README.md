# Beanbus Coffee Roaster

Website thương hiệu và thương mại cho Beanbus Coffee Roaster, xây dựng bằng Next.js 16 App Router, React 19 và TypeScript.

## Trạng thái

- [x] UI public, menu, cart, checkout, booking, account và admin prototype
- [x] Type check, lint gate và production build
- [x] Test runner cho business rules
- [x] Playwright E2E smoke cho menu → cart → checkout
- [x] Supabase SSR clients, session Proxy và local migration workflow
- [ ] Supabase schema, authentication và RLS theo từng feature
- [ ] Order/payment/loyalty chạy hoàn toàn phía server
- [ ] Sepay webhook production
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

## Quality gates

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
```

Không commit `.env.local`, Supabase secret key, Sepay API key hoặc webhook secret.
