import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  applyNotificationRichTextCommand,
  notificationPlainText,
  parseNotificationRichText,
} from '../lib/notifications/rich-text.ts';

test('notification rich text parses only the supported safe formatting', () => {
  assert.deepEqual(parseNotificationRichText('Ưu đãi **20%** hôm nay\n\n- Cà phê\n- Bánh ngọt\n\n> Áp dụng tại quán'), [
    {
      type: 'paragraph',
      content: [
        { text: 'Ưu đãi ', bold: false, italic: false },
        { text: '20%', bold: true, italic: false },
        { text: ' hôm nay', bold: false, italic: false },
      ],
    },
    {
      type: 'unordered-list',
      items: [
        [{ text: 'Cà phê', bold: false, italic: false }],
        [{ text: 'Bánh ngọt', bold: false, italic: false }],
      ],
    },
    {
      type: 'quote',
      content: [{ text: 'Áp dụng tại quán', bold: false, italic: false }],
    },
  ]);
  assert.equal(notificationPlainText('<script>alert(1)</script> **An toàn**'), '<script>alert(1)</script> An toàn');
  assert.deepEqual(parseNotificationRichText('***Quan trọng***'), [{
    type: 'paragraph',
    content: [{ text: 'Quan trọng', bold: true, italic: true }],
  }]);
  assert.equal(notificationPlainText('***Quan trọng***'), 'Quan trọng');
});

test('notification editor commands wrap selections and prefix selected lines', () => {
  assert.deepEqual(applyNotificationRichTextCommand('Ưu đãi hôm nay', 7, 14, 'bold', 'văn bản'), {
    value: 'Ưu đãi **hôm nay**',
    selectionStart: 9,
    selectionEnd: 16,
  });
  assert.deepEqual(applyNotificationRichTextCommand('Cà phê\nBánh ngọt', 0, 16, 'bullet-list', 'văn bản'), {
    value: '- Cà phê\n- Bánh ngọt',
    selectionStart: 2,
    selectionEnd: 20,
  });
});

test('announcement delivery renders rich text safely across app and email surfaces', () => {
  const form = readFileSync(new URL('../app/admin/notifications/AnnouncementForm.tsx', import.meta.url), 'utf8');
  const center = readFileSync(new URL('../components/notifications/NotificationCenter.tsx', import.meta.url), 'utf8');
  const bell = readFileSync(new URL('../components/layout/NotificationBell.tsx', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../supabase/functions/dispatch-notification-emails/index.ts', import.meta.url), 'utf8');
  const pushWorker = readFileSync(new URL('../supabase/functions/dispatch-fcm-notifications/index.ts', import.meta.url), 'utf8');
  const action = readFileSync(new URL('../app/admin/notifications/actions.ts', import.meta.url), 'utf8');

  assert.match(form, /RichTextEditor/);
  assert.match(form, /NotificationRichText/);
  assert.match(center, /NotificationRichText/);
  assert.match(bell, /notificationPlainText/);
  assert.match(worker, /renderNotificationRichTextHtml/);
  assert.match(worker, /escapeHtml\(value\)/);
  assert.match(pushWorker, /notificationPlainText\(bodyViValue\)/);
  assert.match(action, /notificationPlainText\(body\)\.length < 10/);
  assert.match(action, /href\.includes\('\\\\'\)/);
  assert.doesNotMatch(center, /dangerouslySetInnerHTML/);
});
