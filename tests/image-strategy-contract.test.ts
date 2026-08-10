import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const dynamicImageSources = [
  'app/events/EventsClient.tsx',
  'app/events/[id]/EventDetailClient.tsx',
  'app/blog/BlogListClient.tsx',
  'app/blog/[slug]/BlogArticleClient.tsx',
  'app/menu/MenuClient.tsx',
  'app/menu/[id]/ProductDetailClient.tsx',
  'app/order/OrderClient.tsx',
  'app/order/cart/CartClient.tsx',
  'app/order/checkout/CheckoutClient.tsx',
  'components/ui/ProductCustomizerModal.tsx',
  'components/ui/CartDrawer.tsx',
  'app/HomeClient.tsx',
  'app/admin/catalog/page.tsx',
  'app/admin/content/page.tsx',
];

test('dynamic catalog and content images bypass the fixed host allowlist safely', () => {
  for (const file of dynamicImageSources) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /<Image[\s\S]*?unoptimized/, file);
  }
});
