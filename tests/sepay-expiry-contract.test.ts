import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(
  new URL('../app/api/cron/sepay-reconciliation/route.ts', import.meta.url),
  'utf8'
);

test('reconciliation cleans up expired payments before advancing its checkpoint', () => {
  assert.match(route, /rpc\('expire_pending_sepay_payments'\)/i);
  assert.ok(
    route.indexOf("rpc('expire_pending_sepay_payments')")
      < route.indexOf("from('sepay_reconciliation_state')"),
    'expiry cleanup runs before the checkpoint is read'
  );
});
