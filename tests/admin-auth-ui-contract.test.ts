import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const headerSource = await readFile(new URL('../components/layout/Header.tsx', import.meta.url), 'utf8');

test('admin header is identified by the server-resolved profile role', () => {
  assert.match(headerSource, /const isAdmin = user\?\.role === 'admin'/);
  assert.match(headerSource, /isAdmin \? t\('Quản trị'/);
});

test('admin header hides member-only tier and points affordances', () => {
  assert.match(headerSource, /!isAdmin && \(/);
  assert.match(headerSource, /user\?\.points !== undefined/);
  assert.match(headerSource, /isAdmin \? '\/admin' : isLoggedIn \? '\/account'/);
  assert.match(headerSource, /isLoggedIn && !isAdmin/);
});

test('authenticated header exposes logout for desktop and mobile menus', () => {
  assert.match(headerSource, /isLoggedIn && \(/);
  assert.match(headerSource, /className=\{`\$\{styles\.accountDropItem\} \$\{styles\.accountDropButton\}`\}/);
  assert.match(headerSource, /className=\{`\$\{styles\.mobileNavLink\} \$\{styles\.mobileLogout\}`\}/);
  assert.match(headerSource, /onClick=\{logout\}/);
});

test('member header exposes top-up only when stored value and SePay are enabled', () => {
  assert.match(headerSource, /NEXT_PUBLIC_ENABLE_STORED_VALUE === 'true'/);
  assert.match(headerSource, /NEXT_PUBLIC_ENABLE_SEPAY === 'true'/);
  assert.match(headerSource, /href="\/account\/topup"/);
});

test('unauthenticated member button links directly to login without a dropdown', () => {
  assert.match(headerSource, /\{!isLoggedIn \? \(/);
  assert.match(headerSource, /<Link href="\/login" className=\{styles\.accountBtn\}/);
  assert.match(headerSource, /\) : \(/);
});
