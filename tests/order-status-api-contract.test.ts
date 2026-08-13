import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const route = readFileSync('app/api/orders/[id]/status/route.ts', 'utf8');
const confirmation = readFileSync('app/order/confirmation/[id]/ProductionConfirmation.tsx', 'utf8');

test('order status endpoint returns only the live payment state and disables caching', () => {
  assert.match(route, /getOrderReceipt\(id, receipt\)/);
  assert.match(route, /status: order\.status/);
  assert.match(route, /paymentStatus: order\.paymentStatus/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(route, /customerName|customerPhone|deliveryAddress|totalVnd/);
});

test('confirmation polling refreshes status without rebuilding the full RSC page', () => {
  assert.match(confirmation, /\/api\/orders\/\$\{order\.id\}\/status/);
  assert.match(confirmation, /cache: 'no-store'/);
  assert.doesNotMatch(confirmation, /router\.refresh\(\)/);
});
