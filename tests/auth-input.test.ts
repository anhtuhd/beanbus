import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAuthEmail,
  normalizeVietnameseMobile,
  safeRedirectPath,
} from '../lib/auth/input.ts';

test('normalizeAuthEmail canonicalizes valid credentials and rejects malformed input', () => {
  assert.equal(normalizeAuthEmail(' Admin@Example.COM '), 'admin@example.com');
  assert.equal(normalizeAuthEmail('not-an-email'), null);
  assert.equal(normalizeAuthEmail(''), null);
});

test('normalizeVietnameseMobile converts local mobile numbers to E.164', () => {
  assert.equal(normalizeVietnameseMobile('0987 654 321'), '+84987654321');
  assert.equal(normalizeVietnameseMobile('+84 987-654-321'), '+84987654321');
});

test('normalizeVietnameseMobile rejects malformed or non-mobile values', () => {
  assert.equal(normalizeVietnameseMobile('1234'), null);
  assert.equal(normalizeVietnameseMobile('+849876543210'), null);
  assert.equal(normalizeVietnameseMobile('email@example.com'), null);
});

test('safeRedirectPath accepts local paths and rejects external redirects', () => {
  assert.equal(safeRedirectPath('/account?tab=orders'), '/account?tab=orders');
  assert.equal(safeRedirectPath('https://attacker.example'), '/account');
  assert.equal(safeRedirectPath('//attacker.example'), '/account');
  assert.equal(safeRedirectPath('/\\attacker.example'), '/account');
  assert.equal(safeRedirectPath(null, '/'), '/');
});
