import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isStoredValueConfigured } from '../lib/stored-value/config.ts';
import { parseStoredValueIntentInput } from '../lib/stored-value/input.ts';
import { resolveStoredValuePaymentCode } from '../lib/payments/sepay.ts';

const migration = readFileSync('supabase/migrations/20260810060000_stored_value.sql', 'utf8');
const expiryMigration = readFileSync('supabase/migrations/20260811014925_fix_stored_value_expiry_ambiguity.sql', 'utf8');
const precedenceMigration = readFileSync('supabase/migrations/20260811050000_fix_flash_sale_error_precedence.sql', 'utf8');
const secureCodeMigration = readFileSync('supabase/migrations/20260814100000_secure_stored_value_codes_and_history.sql', 'utf8');
const expiryStatusMigration = readFileSync('supabase/migrations/20260814110000_expire_stored_value_payments.sql', 'utf8');
const compactCodeMigration = readFileSync('supabase/migrations/20260814120000_compact_sepay_transfer_codes.sql', 'utf8');
const databaseTest = readFileSync('supabase/tests/database/stored_value.test.sql', 'utf8');
const action = readFileSync('app/account/stored-value-actions.ts', 'utf8');
const client = readFileSync('app/account/StoredValueClient.tsx', 'utf8');
const webhook = readFileSync('app/api/webhooks/sepay/route.ts', 'utf8');
const adminPage = readFileSync('app/admin/stored-value/page.tsx', 'utf8');
const adminActions = readFileSync('app/admin/stored-value/actions.ts', 'utf8');
const accountClient = readFileSync('app/account/AccountClient.tsx', 'utf8');
const historyPage = readFileSync('app/account/payment-history/page.tsx', 'utf8');

test('stored value is fail-closed behind production, Sepay, and explicit feature gates', () => {
  assert.equal(isStoredValueConfigured({ NEXT_PUBLIC_APP_MODE: 'demo', NEXT_PUBLIC_ENABLE_SEPAY: 'true', NEXT_PUBLIC_ENABLE_STORED_VALUE: 'true' }), false);
  assert.equal(isStoredValueConfigured({ NEXT_PUBLIC_APP_MODE: 'production', NEXT_PUBLIC_ENABLE_SEPAY: 'false', NEXT_PUBLIC_ENABLE_STORED_VALUE: 'true' }), false);
  assert.equal(isStoredValueConfigured({ NEXT_PUBLIC_APP_MODE: 'production', NEXT_PUBLIC_ENABLE_SEPAY: 'true', NEXT_PUBLIC_ENABLE_STORED_VALUE: 'false' }), false);
  assert.equal(isStoredValueConfigured({ NEXT_PUBLIC_APP_MODE: 'production', NEXT_PUBLIC_ENABLE_SEPAY: 'true', NEXT_PUBLIC_ENABLE_STORED_VALUE: 'true' }), true);
});

test('stored value intent input accepts only UUID identifiers and idempotency keys', () => {
  const valid = parseStoredValueIntentInput({
    itemId: '00000000-0000-4000-8000-000000000101',
    idempotencyKey: '00000000-0000-4000-8000-000000000201',
  });
  assert.equal(valid.ok, true);
  assert.equal(parseStoredValueIntentInput({ itemId: 'package', idempotencyKey: 'key' }).ok, false);
  assert.equal(parseStoredValueIntentInput(null).ok, false);
});

test('stored-value webhook codes contain DH and use an unpredictable random suffix', () => {
  assert.equal(resolveStoredValuePaymentCode('DHTP0123456789ABCDEF0123', ''), 'DHTP0123456789ABCDEF0123');
  assert.equal(resolveStoredValuePaymentCode('DH-TP-0123456789ABCDEF0123', ''), 'DHTP0123456789ABCDEF0123');
  assert.equal(resolveStoredValuePaymentCode(null, 'paid DHFSABCDEF0123456789ABCD'), 'DHFSABCDEF0123456789ABCD');
  assert.equal(resolveStoredValuePaymentCode('DH-260812ABC123', ''), null);
  assert.match(secureCodeMigration, /extensions\.gen_random_bytes\(10\)/i);
  assert.match(compactCodeMigration, /DHTP/);
  assert.match(compactCodeMigration, /DHFS/);
  assert.match(compactCodeMigration, /replace\(payment_code, '-'/i);
});

test('stored-value UI does not expose the payment provider label', () => {
  assert.doesNotMatch(client, /Sepay/i);
});

test('stored-value header keeps navigation separate from the page title', () => {
  assert.match(client, /className={styles\.headerContent}/);
  assert.match(client, /className={styles\.headerNav}/);
  assert.match(client, /className={`eyebrow \$\{styles\.eyebrow\}`}/);
});

test('stored value migration isolates payments, locks quota, and credits only from verified webhooks', () => {
  assert.match(migration, /create table public\.stored_value_payments/i);
  assert.match(migration, /check \(\(topup_id is not null\) <> \(flash_sale_purchase_id is not null\)\)/i);
  assert.match(migration, /alter table public\.loyalty_ledger add constraint[\s\S]*topup_credited[\s\S]*flash_sale_credited/i);
  assert.match(migration, /select \* into v_campaign[\s\S]*for update/i);
  assert.match(migration, /v_campaign\.quota_reserved \+ v_campaign\.quota_sold >= v_campaign\.quota_total/i);
  assert.match(migration, /wallet_topups[\s\S]*set status = 'expired'[\s\S]*expires_at <= now\(\)/i);
  assert.match(migration, /stored_value_payments where topup_id = v_topup\.id/i);
  assert.match(migration, /create function public\.process_stored_value_webhook/i);
  assert.match(migration, /insert into public\.loyalty_ledger[\s\S]*topup_credited/i);
  assert.match(migration, /insert into public\.loyalty_ledger[\s\S]*flash_sale_credited/i);
  assert.match(migration, /on conflict \(source_key\) do nothing/i);
});

test('stored value has a database replay, quota, and authorization test plan', () => {
  assert.match(databaseTest, /select plan\(41\)/);
  assert.match(databaseTest, /TOPUP_DISABLED/);
  assert.match(databaseTest, /stored-value payment creation retry is idempotent/);
  assert.match(databaseTest, /duplicate top-up webhook does not duplicate points/);
  assert.match(databaseTest, /paid flash-sale consumes one sold quota/);
  assert.match(databaseTest, /FLASH_SALE_USER_LIMIT/);
  assert.match(databaseTest, /has_table_privilege\('authenticated', 'public\.wallet_topups', 'SELECT'\)/);
});

test('stored-value expiry is bounded, service-only, and visible without a scheduler', () => {
  assert.match(expiryStatusMigration, /expire_pending_stored_value_payments\(p_limit integer default 100\)/i);
  assert.match(expiryStatusMigration, /for update skip locked/i);
  assert.match(expiryStatusMigration, /grant execute on function public\.expire_pending_stored_value_payments\(integer\) to service_role/i);
  assert.match(expiryStatusMigration, /payments\.status = 'pending'[\s\S]*payments\.expires_at <= now\(\)/i);
  assert.match(expiryStatusMigration, /case when payments\.status = 'pending' and payments\.expires_at <= now\(\)/i);
  assert.match(action, /expire_pending_stored_value_payments/);
  assert.match(historyPage, /getMemberPaymentHistory/);
});

test('top-up expiry cleanup qualifies the table timestamp', () => {
  assert.match(expiryMigration, /update public\.wallet_topups as topup[\s\S]*topup\.expires_at <= now\(\)/i);
});

test('flash-sale expiry cleanup qualifies the table timestamp', () => {
  assert.match(expiryMigration, /update public\.flash_sale_purchases as purchase[\s\S]*purchase\.expires_at <= now\(\)/i);
});

test('flash-sale reports a member limit before campaign sold-out state', () => {
  const userLimit = precedenceMigration.indexOf("raise exception 'FLASH_SALE_USER_LIMIT'");
  const soldOut = precedenceMigration.indexOf("raise exception 'FLASH_SALE_SOLD_OUT'");
  assert.ok(userLimit >= 0 && soldOut >= 0 && userLimit < soldOut);
});

test('server action owns payment configuration and client has no payment-success mutation', () => {
  assert.match(action, /createAdminSupabaseClient/);
  assert.match(action, /create_stored_value_payment/);
  assert.match(action, /buildSepayQrUrl/);
  assert.match(client, /toTransferMemo/);
  assert.match(client, /getStoredValuePaymentStatus/);
  assert.doesNotMatch(client, /updateOrderStatus/);
  assert.doesNotMatch(client, /addPoints/);
  assert.match(webhook, /process_stored_value_webhook/);
  assert.match(webhook, /resolveStoredValuePaymentCode/);
  assert.match(webhook, /isStoredValueCode && !isStoredValueConfigured\(\)/);
  assert.match(webhook, /feature_disabled/);
  assert.match(historyPage, /getMemberPaymentHistory/);
  assert.match(historyPage, /payment-history-title/);
});

test('admin stored-value controls are guarded and audited through RPC boundaries', () => {
  const featureGate = adminPage.indexOf('if (!isStoredValueConfigured())');
  const adminGuard = adminPage.indexOf('await requireAdmin()');
  assert.equal(featureGate, -1, 'admin can access stored-value controls while the feature is disabled');
  assert.ok(adminGuard >= 0, 'stored-value route remains protected by admin auth');
  assert.match(adminPage, /get_admin_stored_value_catalog/);
  assert.match(adminPage, /StoredValuePolicyForm/);
  assert.match(adminPage, /FlashSaleCampaignForm/);
  assert.match(adminActions, /await requireAdmin\(\)/g);
  assert.match(adminActions, /update_stored_value_policy/);
  assert.match(adminActions, /admin_upsert_topup_package/);
  assert.match(adminActions, /admin_upsert_flash_sale_campaign/);
  assert.match(adminPage, /policyHistory/);
  assert.match(accountClient, /topup_credited/);
  assert.match(accountClient, /flash_sale_credited/);
});
