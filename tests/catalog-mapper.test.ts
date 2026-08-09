import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapCatalogCategory,
  mapCatalogOption,
  mapCatalogProduct,
} from '../lib/catalog/mapper.ts';

test('maps catalog records into the existing UI contract', () => {
  const category = mapCatalogCategory({ id: 'espresso', name_vi: 'Espresso', name_en: 'Espresso' });
  const option = mapCatalogOption({
    id: 'size-l',
    group_name: 'size',
    name_vi: 'Lớn',
    name_en: 'Large',
    extra_price_vnd: 10000,
  });
  const product = mapCatalogProduct(
    {
      id: 'esp-1',
      category_id: 'espresso',
      name_vi: 'Cà phê',
      name_en: 'Coffee',
      description_vi: 'Mô tả',
      description_en: 'Description',
      price_vnd: 40000,
      image_url: 'https://example.com/coffee.jpg',
      badge: 'best',
      is_available: true,
      tasting_notes: null,
    },
    [option]
  );

  assert.deepEqual(category, { id: 'espresso', nameVi: 'Espresso', nameEn: 'Espresso' });
  assert.equal(product.price, 40000);
  assert.deepEqual(product.options, [option]);
  assert.equal(product.tastingNotes, undefined);
});

test('rejects database values outside the UI enum contract', () => {
  assert.throws(
    () => mapCatalogOption({
      id: 'bad',
      group_name: 'unknown',
      name_vi: 'Sai',
      name_en: 'Invalid',
      extra_price_vnd: 0,
    }),
    /Unsupported catalog option group/
  );
});
