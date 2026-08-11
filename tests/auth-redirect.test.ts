import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePostAuthPath } from '../lib/auth/redirect.ts';

test('admin always lands on the admin panel', () => {
  assert.equal(resolvePostAuthPath('admin', '/account'), '/admin');
  assert.equal(resolvePostAuthPath('admin', '/order/checkout'), '/admin');
});

test('members and staff keep their safe requested destination', () => {
  assert.equal(resolvePostAuthPath('member', '/account?tab=orders'), '/account?tab=orders');
  assert.equal(resolvePostAuthPath('staff', '/events'), '/events');
});

test('invalid destinations fall back to the member account', () => {
  assert.equal(resolvePostAuthPath('member', 'https://attacker.example'), '/account');
  assert.equal(resolvePostAuthPath('staff', '//attacker.example'), '/account');
});
