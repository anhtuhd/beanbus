import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(new URL('../app/api/admin/media/uploads/route.ts', import.meta.url), 'utf8');

test('R2 upload session bounds the body without relying on browser Content-Length', () => {
  assert.match(route, /isTrustedMediaOrigin/);
  assert.match(route, /getCurrentProfile/);
  assert.match(route, /new TextEncoder\(\)\.encode\(rawBody\)\.byteLength/);
  assert.match(route, /JSON\.parse\(rawBody\)/);
  assert.doesNotMatch(route, /request.headers.get\('content-length'\)/);
});
