import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  'supabase/migrations/20260811025637_fix_loyalty_reversal_idempotency.sql',
  'utf8'
);

test('loyalty reversal does not depend on the current earning policy', () => {
  assert.match(migration, /if found and v_policy\.enabled and v_policy\.earn_bps > 0[\s\S]*and new\.status = 'completed'/);
  assert.match(migration, /if new\.status = 'cancelled' or new\.payment_status = 'refunded' then/);
  assert.doesNotMatch(migration, /if not found or not v_policy\.enabled or v_policy\.earn_bps = 0 then return new;/);
});
