import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkout = readFileSync(new URL('../app/order/checkout/CheckoutClient.tsx', import.meta.url), 'utf8');
const confirmation = readFileSync(
  new URL('../app/order/confirmation/[id]/page.tsx', import.meta.url),
  'utf8'
);

test('production checkout sends catalog identifiers instead of browser-computed prices', () => {
  const actionCall = checkout.match(/createProductionOrder\(\{([\s\S]*?)\n\s*\}\);/)?.[1] ?? '';

  assert.match(actionCall, /productId: item\.product\.id/);
  assert.match(actionCall, /optionIds: item\.selectedOptions/);
  assert.doesNotMatch(actionCall, /(subtotal|discountAmount|finalTotal|itemTotal|unitPrice)\s*[:,]/);
});

test('production confirmation requires the server-issued receipt capability', () => {
  assert.match(confirmation, /typeof query\.receipt === 'string'/);
  assert.match(confirmation, /getOrderReceipt\(id, receiptToken\)/);
  assert.match(confirmation, /if \(!order\) notFound\(\)/);
  assert.doesNotMatch(confirmation, /searchParams.*paid|paid.*searchParams/i);
});
