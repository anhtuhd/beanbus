import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_OUTPUT_BYTES,
  MEDIA_PRESETS,
  isAllowedSourceType,
  isManagedMediaKey,
  isManagedMediaUrl,
  validateMediaUploadMetadata,
} from '../lib/media/r2-validation.ts';

test('validates cropped WebP metadata per media kind', () => {
  assert.deepEqual(validateMediaUploadMetadata({
    kind: 'product', contentType: 'image/webp', size: 120_000, width: 1600, height: 1200,
  })?.kind, 'product');
  assert.equal(validateMediaUploadMetadata({
    kind: 'product', contentType: 'image/webp', size: MAX_OUTPUT_BYTES + 1, width: 1600, height: 1200,
  }), null);
  assert.equal(validateMediaUploadMetadata({
    kind: 'event', contentType: 'image/webp', size: 120_000, width: 1200, height: 675,
  }), null);
  assert.equal(validateMediaUploadMetadata({
    kind: 'event', contentType: 'image/webp', size: 120_000, width: 1600, height: 900,
  })?.kind, 'event');
  assert.deepEqual(MEDIA_PRESETS.blog, { width: 1600, height: 900, minWidth: 1280, minHeight: 720 });
});

test('restricts source types and public media URLs', () => {
  assert.equal(isAllowedSourceType('image/jpeg'), true);
  assert.equal(isAllowedSourceType('image/svg+xml'), false);
  assert.equal(isManagedMediaKey('media/product/2026/08/8b4f7a5c-4f2d-4c5d-a1fd-a55d9b7c1f1e.webp'), true);
  assert.equal(isManagedMediaKey('media/order/2026/08/8b4f7a5c-4f2d-4c5d-a1fd-a55d9b7c1f1e.jpg'), true);
  assert.equal(isManagedMediaKey('media/product/2026/08/../../secret.webp'), false);
  assert.equal(isManagedMediaUrl('https://images.beanbus.store/media/product/2026/08/8b4f7a5c-4f2d-4c5d-a1fd-a55d9b7c1f1e.webp', 'https://images.beanbus.store'), true);
  assert.equal(isManagedMediaUrl('https://evil.example/media/product/2026/08/image.webp', 'https://images.beanbus.store'), false);
});
