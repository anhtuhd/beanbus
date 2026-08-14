import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const migration = readFileSync('supabase/migrations/20260810025416_member_account_access.sql', 'utf8');
const loyaltyMigration = readFileSync('supabase/migrations/20260810032413_loyalty_ledger.sql', 'utf8');
const query = readFileSync('lib/account/queries.ts', 'utf8');
const page = readFileSync('app/account/page.tsx', 'utf8');
const accountClient = readFileSync('app/account/AccountClient.tsx', 'utf8');
const accountStyles = readFileSync('app/account/account.module.css', 'utf8');
const detailPage = readFileSync('app/account/orders/[id]/page.tsx', 'utf8');
const reorderDetailForm = readFileSync('app/account/orders/ReorderOrderForm.tsx', 'utf8');
const requestDetailPage = readFileSync('app/account/requests/[id]/page.tsx', 'utf8');
const reorderAction = readFileSync('app/account/reorder-actions.ts', 'utf8');
const cartContext = readFileSync('context/CartContext.tsx', 'utf8');
const cartClient = readFileSync('app/order/cart/CartClient.tsx', 'utf8');

test('member account exposes only active vouchers through an authenticated read policy', () => {
  assert.match(migration, /create policy "Members read active vouchers"[\s\S]*for select[\s\S]*to authenticated/i);
  assert.match(migration, /is_active[\s\S]*starts_at[\s\S]*ends_at/i);
});

test('member account queries use RLS-owned orders and pass server data to the UI', () => {
  assert.match(query, /from\('orders'\)[\s\S]*order_items\(id, order_id/i);
  assert.match(query, /getCurrentProfile/);
  assert.match(query, /\.eq\('user_id', profile\.id\)/i);
  assert.match(page, /getMemberAccountData\(/);
  assert.match(page, /initialTab=\{initialTab\}/);
  assert.match(page, /initialOrders=\{accountData\.orders\}/);
  assert.match(page, /availableVouchers=\{accountData\.vouchers\}/);
  assert.match(page, /rewards=\{accountData\.rewards\}/);
  assert.match(page, /memberRequests=\{accountData\.requests\}/);
  assert.match(page, /totalOrders=\{accountData\.totalOrders\}/);
  assert.match(page, /totalRequests=\{accountData\.totalRequests\}/);
  assert.match(accountClient, /const accountOrderCount = production \? totalOrders : orders\.length/);
  assert.match(accountClient, /const accountRequestCount = production \? totalRequests : bookings\.length/);
});

test('member account paginates orders and protects order details through RLS-owned queries', () => {
  assert.match(query, /requestedPage/);
  assert.match(query, /requestedLoyaltyPage/);
  assert.match(query, /requestedRequestPage/);
  assert.match(query, /requestedVoucherPage/);
  assert.match(query, /loyaltyTotalPages/);
  assert.match(query, /requestTotalPages/);
  assert.match(query, /voucherTotalPages/);
  assert.match(query, /count: 'exact'/);
  assert.match(query, /getMemberAccountOrder/);
  assert.match(query, /eq\('user_id', profile\.id\)/i);
  assert.match(detailPage, /requireProfile/);
  assert.match(detailPage, /notFound\(\)/);
  assert.match(reorderAction, /'use server'/);
  assert.match(reorderAction, /\.eq\('user_id', profile\.id\)/i);
  assert.match(reorderAction, /getCatalogProduct/);
  assert.match(requestDetailPage, /requireProfile\('\/account'\)/);
  assert.match(requestDetailPage, /from\('booking_requests'\)[\s\S]*\.eq\('user_id', profile\.id\)/);
  assert.match(requestDetailPage, /from\('customer_requests'\)[\s\S]*\.eq\('user_id', profile\.id\)/);
  assert.match(requestDetailPage, /booking_request_status_history/);
  assert.match(requestDetailPage, /customer_request_status_history/);
  assert.match(requestDetailPage, /StatusHistoryList/);
  assert.match(query, /from\('order_status_history'\)/);
  assert.match(query, /statusHistory/);
  assert.match(detailPage, /Lịch sử trạng thái/);
  assert.match(detailPage, /ReorderOrderForm/);
  assert.match(reorderDetailForm, /loadReorderItems/);
  assert.match(reorderDetailForm, /addToCart\(item\.product/);
  assert.match(reorderDetailForm, /href="\/order\/cart"/);
  assert.match(requestDetailPage, /notFound\(\)/);
  assert.match(accountClient, /\/account\/requests\/\$\{request\.id\}\?kind=\$\{request\.kind\}/);
});

test('loyalty summary is ledger-backed and policy-gated', () => {
  assert.match(loyaltyMigration, /create table public\.loyalty_ledger/i);
  assert.match(loyaltyMigration, /source_key text not null unique/i);
  assert.match(loyaltyMigration, /create trigger orders_apply_loyalty/i);
  assert.match(loyaltyMigration, /on conflict \(source_key\) do nothing/i);
  assert.match(loyaltyMigration, /create function public\.get_member_loyalty_summary/i);
  assert.match(query, /get_member_loyalty_summary/);
  assert.match(query, /from\('loyalty_ledger'\)/);
  assert.match(page, /loyalty=\{accountData\.loyalty\}/);
  assert.match(page, /loyaltyEntries=\{accountData\.loyaltyEntries\}/);
  assert.match(page, /loyaltyPage=\{accountData\.loyaltyPage\}/);
  assert.match(page, /loyaltyTotalPages=\{accountData\.loyaltyTotalPages\}/);
  assert.match(page, /requestPage=\{accountData\.requestPage\}/);
  assert.match(page, /requestTotalPages=\{accountData\.requestTotalPages\}/);
  assert.match(page, /voucherPage=\{accountData\.voucherPage\}/);
  assert.match(page, /voucherTotalPages=\{accountData\.voucherTotalPages\}/);
  assert.match(query, /from\('loyalty_rewards'\)/);
  assert.match(query, /rpc\('get_member_requests'/);
  assert.match(query, /rpc\('get_member_request_count'/);
  assert.match(query, /requests: MemberRequest\[\]/);
  assert.match(query, /Promise\.all\(\[[\s\S]*from\('vouchers'\)/);
  assert.match(query, /starts_at\.is\.null,starts_at\.lte/);
  assert.match(query, /ends_at\.is\.null,ends_at\.gt/);
});

test('account date rendering is timezone-stable for hydration', () => {
  assert.match(accountClient, /new Intl\.DateTimeFormat\('vi-VN', \{ dateStyle: 'short', timeZone: 'Asia\/Ho_Chi_Minh' \}\)/);
  assert.doesNotMatch(accountClient, /new Date\([^)]*\)\.toLocaleDateString/);
});

test('production rewards tab remains visible so empty state is reachable', () => {
  assert.match(accountClient, /activeTab === 'rewards'/);
  assert.match(accountClient, /Hiện chưa có phần thưởng khả dụng/);
  assert.doesNotMatch(accountClient, /!production \|\| rewards\.length > 0/);
});

test('member order and request statuses use user-facing labels', () => {
  assert.match(accountClient, /function statusLabel\(/);
  assert.match(accountClient, /in_progress: \['Đang xử lý', 'In progress'\]/);
  assert.match(accountClient, /statusLabel\(order\.status, t\)/);
  assert.match(accountClient, /statusLabel\(request\.status, t\)/);
});

test('member account tabs expose accessible tab and panel semantics', () => {
  assert.match(accountClient, /role="tablist"/);
  assert.match(accountClient, /role="tab"/);
  assert.match(accountClient, /aria-selected=\{activeTab === 'membership'\}/);
  assert.match(accountClient, /role="tabpanel"/);
  assert.match(accountClient, /aria-controls="orders-panel"/);
  assert.match(accountClient, /aria-labelledby="orders-tab"/);
  assert.match(accountClient, /handleTabKeyDown/);
  assert.match(accountClient, /ArrowRight/);
  assert.match(accountClient, /ArrowLeft/);
  assert.match(accountClient, /event\.key === 'Home'/);
  assert.match(accountClient, /tabIndex=\{activeTab === 'membership' \? 0 : -1\}/);
  assert.match(accountClient, /tabRefs\.current\[nextTab\]\?\.focus\(\)/);
  assert.match(accountClient, /Phân trang lịch sử điểm/);
  assert.match(accountClient, /Phân trang yêu cầu/);
  assert.match(accountClient, /Phân trang voucher/);
  assert.match(accountClient, /initialTab/);
  assert.match(accountClient, /accountHref/);
  assert.match(accountClient, /tab: activeTab/);
});

test('member dashboard places stored-value routes beside account tabs without duplicating the old links', () => {
  assert.match(accountClient, /className=\{styles\.accountNavigation\}/);
  assert.match(accountClient, /href="\/account\/topup" className=\{styles\.navLink\}/);
  assert.match(accountClient, /href="\/flash-sale" className=\{styles\.navLink\}/);
  assert.match(accountClient, /href="\/account\/payment-history" className=\{styles\.navLink\}/);
  assert.match(accountClient, /storedValueConfigured/);
  assert.doesNotMatch(accountClient, /styles\.featureLinks|styles\.featureLink/);
  const pointsNavigation = accountClient.match(/<div className=\{styles\.navLinks\}[\s\S]*?<\/div>/)?.[0] ?? '';
  assert.doesNotMatch(pointsNavigation, /ArrowRight/);
});

test('member dashboard navigation stays aligned across desktop and mobile', () => {
  assert.match(accountStyles, /\.accountNavigation\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(accountStyles, /\.navTabs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,/);
  assert.match(accountStyles, /\.navLinks\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
  assert.match(accountStyles, /@media \(max-width: 900px\)[\s\S]*?grid-template-columns: repeat\(2,/);
});

test('demo account profile editing stays client-owned while production uses the server action', () => {
  assert.match(accountClient, /handleDemoProfileSubmit/);
  assert.match(accountClient, /action=\{production \? profileAction : undefined\}/);
  assert.match(accountClient, /onSubmit=\{production \? \(\) => \{ profileRefreshApplied\.current = false; \} : handleDemoProfileSubmit\}/);
  assert.match(accountClient, /updateProfile\(\{/);
});

test('production profile updates refresh server-owned member data after success', () => {
  assert.match(accountClient, /profileRefreshApplied/);
  assert.match(accountClient, /profileState\.status !== 'success'/);
  assert.match(accountClient, /router\.refresh\(\)/);
});

test('member actions announce demo results in-page instead of using blocking alerts', () => {
  assert.match(accountClient, /demoActionMessage/);
  assert.match(accountClient, /aria-live="polite"/);
  assert.doesNotMatch(accountClient, /alert\(/);
});

test('member vouchers can be sent to the cart while server checkout remains authoritative', () => {
  assert.match(cartContext, /applyVoucherDetails/);
  assert.match(accountClient, /handleUseVoucher/);
  assert.match(accountClient, /router\.push\('\/order\/cart'\)/);
  assert.match(accountClient, /Dùng voucher/);
  assert.match(cartClient, /Đã lưu mã/);
  assert.match(cartClient, /role="status"/);
});

test('member reward redemption keeps a key through retries and rotates after success', () => {
  const rewardForm = readFileSync('app/account/RewardRedeemForm.tsx', 'utf8');
  assert.match(rewardForm, /const idempotencyKey = useRef<string \| null>\(null\)/);
  assert.match(rewardForm, /const key = idempotencyKey\.current \?\? crypto\.randomUUID\(\)/);
  assert.match(rewardForm, /idempotencyKey\.current = null/);
  assert.match(rewardForm, /onSubmit=\{handleSubmit\}/);
});
