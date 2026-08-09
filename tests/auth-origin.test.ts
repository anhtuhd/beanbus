import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAuthOrigin } from '../lib/auth/origin.ts';

test('uses the configured HTTP origin without paths', () => {
  assert.equal(
    resolveAuthOrigin({ configuredUrl: 'https://beanbus.vn/account', production: true }),
    'https://beanbus.vn'
  );
});

test('fails closed when production has no configured site URL', () => {
  assert.equal(
    resolveAuthOrigin({ fallbackOrigin: 'https://attacker.example', production: true }),
    null
  );
});

test('uses the request origin during local development', () => {
  assert.equal(
    resolveAuthOrigin({ fallbackOrigin: 'http://127.0.0.1:3100', production: false }),
    'http://127.0.0.1:3100'
  );
});

test('rejects malformed and non-HTTP URLs', () => {
  assert.equal(resolveAuthOrigin({ configuredUrl: 'not a URL', production: true }), null);
  assert.equal(resolveAuthOrigin({ configuredUrl: 'javascript:alert(1)', production: true }), null);
});
