import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const authSession = readFileSync('lib/auth/session.ts', 'utf8');
const authContext = readFileSync('context/AuthContext.tsx', 'utf8');
const rootLayout = readFileSync('app/layout.tsx', 'utf8');
const header = readFileSync('components/layout/Header.tsx', 'utf8');
const headerStyles = readFileSync('components/layout/Header.module.css', 'utf8');
const supabaseProxy = readFileSync('lib/supabase/proxy.ts', 'utf8');
const orderDetail = readFileSync('app/admin/orders/[id]/page.tsx', 'utf8');
const requestsPage = readFileSync('app/admin/requests/page.tsx', 'utf8');
const vouchersPage = readFileSync('app/admin/vouchers/page.tsx', 'utf8');
const migrations = readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .map((file) => readFileSync(`supabase/migrations/${file}`, 'utf8'))
  .join('\n');

test('private auth resolves the RLS-owned profile in one data request', () => {
  assert.match(authSession, /rpc\('get_current_profile'\)/);
  assert.doesNotMatch(authSession, /auth\.getClaims\(\)/);
  assert.match(authContext, /rpc\('get_current_profile'\)/);
  assert.match(authContext, /auth\.getSession\(\)/);
  assert.ok(authContext.indexOf('auth.getSession()') < authContext.indexOf("rpc('get_current_profile')"));
  assert.doesNotMatch(authContext, /auth\.getClaims\(\)/);
  assert.match(migrations, /create or replace function public\.get_current_profile\(\)/i);
  assert.match(migrations, /security invoker/i);
});

test('global shell avoids eager font congestion and auth-driven header shifts', () => {
  assert.match(rootLayout, /const montserrat = localFont\([\s\S]*?preload: false/);
  assert.match(rootLayout, /const poppins = localFont\([\s\S]*?preload: false/);
  assert.match(header, /styles\.notificationSlot/);
  assert.match(headerStyles, /\.notificationSlot\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;/);
  assert.match(supabaseProxy, /if \(!hasAuthCookie\) return response/);
  assert.ok(supabaseProxy.indexOf('if (!hasAuthCookie) return response') < supabaseProxy.indexOf('const supabase = createSupabaseServerClient'));
});

test('slow admin routes use bounded, single-round-trip reads', () => {
  assert.match(orderDetail, /order_items\([\s\S]*?order_item_options\(/);
  assert.match(orderDetail, /order_status_history\(/);
  assert.equal((orderDetail.match(/\.from\(/g) ?? []).length, 1);
  assert.match(requestsPage, /from\('admin_request_feed'\)/);
  assert.doesNotMatch(requestsPage, /queryFrom/);
  assert.match(migrations, /create or replace view public\.admin_request_feed/i);
  assert.match(migrations, /orders_status_created_idx/i);
});

test('voucher list hydrates at most one editor selected by the URL', () => {
  assert.match(vouchersPage, /const edit = first\(params\.edit\)/);
  assert.match(vouchersPage, /editingVoucher/);
  assert.equal((vouchersPage.match(/<VoucherEditorForm/g) ?? []).length, 1);
});
