import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoOrderCode } from '../lib/orders/demo-order-code.ts';

test('demo order codes use DH-YYMMDD plus six alphanumeric characters', () => {
  const code = createDemoOrderCode(new Date('2026-08-12T10:00:00.000Z'));

  assert.match(code, /^DH-260812[A-Z0-9]{6}$/);
});
