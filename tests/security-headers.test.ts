import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync('next.config.ts', 'utf8');

test('Next response headers include baseline browser hardening', () => {
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /nosniff/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /DENY/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /strict-origin-when-cross-origin/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /Content-Security-Policy-Report-Only/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /productionHttps/);
  assert.match(config, /developmentScriptPolicy/);
});
