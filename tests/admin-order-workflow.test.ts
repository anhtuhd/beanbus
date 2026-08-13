import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ACTIVE_ORDER_STEPS,
  canCancelOrder,
  getNextOrderStatus,
} from '../app/admin/orders/order-workflow.ts';

test('order workflow exposes the linear kitchen progression', () => {
  assert.deepEqual(ACTIVE_ORDER_STEPS, ['pending', 'confirmed', 'preparing', 'ready', 'completed']);
  assert.equal(getNextOrderStatus('pending', 'cod', 'pending'), 'confirmed');
  assert.equal(getNextOrderStatus('confirmed', 'cod', 'pending'), 'preparing');
  assert.equal(getNextOrderStatus('preparing', 'cod', 'pending'), 'ready');
  assert.equal(getNextOrderStatus('ready', 'cod', 'pending'), 'completed');
  assert.equal(getNextOrderStatus('completed', 'cod', 'paid'), null);
  assert.equal(getNextOrderStatus('cancelled', 'cod', 'pending'), null);
});

test('unpaid Sepay orders wait for verified payment before confirmation', () => {
  assert.equal(getNextOrderStatus('pending', 'sepay_qr', 'pending'), null);
  assert.equal(getNextOrderStatus('pending', 'sepay_qr', 'paid'), 'confirmed');
});

test('paid and terminal orders cannot use the direct cancellation action', () => {
  assert.equal(canCancelOrder('pending', 'pending'), true);
  assert.equal(canCancelOrder('ready', 'pending'), true);
  assert.equal(canCancelOrder('ready', 'paid'), false);
  assert.equal(canCancelOrder('completed', 'pending'), false);
  assert.equal(canCancelOrder('cancelled', 'pending'), false);
});

test('admin order controls use progress steps and one-click actions instead of a status select', () => {
  const source = readFileSync(new URL('../app/admin/orders/OrderStatusForm.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /<select/);
  assert.match(source, /aria-current=\{stepState === 'current' \? 'step'/);
  assert.match(source, /name="status" value=\{nextStatus\}/);
  assert.match(source, /name="status" value="cancelled"/);
});
