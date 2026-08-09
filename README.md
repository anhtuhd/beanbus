# Beanbus Coffee Roaster

Website thương hiệu và thương mại cho Beanbus Coffee Roaster, xây dựng bằng Next.js 16 App Router, React 19 và TypeScript.

## Trạng thái

- [x] UI public, menu, cart, checkout, booking, account và admin prototype
- [x] Type check, lint gate và production build
- [x] Test runner cho business rules
- [x] Playwright E2E smoke cho menu → cart → checkout
- [ ] Supabase database, authentication và RLS
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

## Quality gates

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Không commit `.env.local`, Supabase service-role key, Sepay API key hoặc webhook secret.
