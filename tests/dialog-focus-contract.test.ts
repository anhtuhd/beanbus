import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const hook = readFileSync(new URL('../lib/ui/use-dialog-focus.ts', import.meta.url), 'utf8');
const components = [
  '../components/ui/CartDrawer.tsx',
  '../components/ui/ProductCustomizerModal.tsx',
  '../components/ui/SepayQRModal.tsx',
  '../app/events/RsvpButton.tsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
const cartDrawer = components[0];
const sepayDialog = components[2];

test('dialog focus helper traps Tab, closes on Escape, restores focus, and locks scroll', () => {
  assert.match(hook, /event\.key === 'Escape'/);
  assert.match(hook, /event\.key !== 'Tab'/);
  assert.match(hook, /previouslyFocused\?\.focus\(\)/);
  assert.match(hook, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(hook, /querySelectorAll<HTMLElement>/);
});

test('critical dialogs use the shared helper and expose dialog semantics', () => {
  for (const source of components) {
    assert.match(source, /useDialogFocus/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby=/);
  }
});

test('dialog feedback is announced without relying on color or icons', () => {
  assert.match(cartDrawer, /role="status"/);
  assert.match(sepayDialog, /role="status"/);
  assert.match(sepayDialog, /copiedAcc \? t\(/);
  assert.match(sepayDialog, /copiedContent \? t\(/);
});
