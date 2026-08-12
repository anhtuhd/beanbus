import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import type { Category, Product, ProductOption } from '@/data/products';
import { createPublicSupabaseClient } from '@/lib/supabase/public-server';
import { CATALOG_CACHE_TAG } from '@/lib/cache/tags';
import {
  mapCatalogCategory,
  mapCatalogOption,
  mapCatalogProduct,
} from './mapper';

export type Catalog = {
  categories: Category[];
  products: Product[];
};

const ALL_CATEGORY: Category = {
  id: 'all',
  nameVi: 'Tất Cả',
  nameEn: 'All Items',
};

async function loadCatalog(): Promise<Catalog> {
  const supabase = createPublicSupabaseClient();
  const [categoriesResult, optionsResult, productsResult] = await Promise.all([
    supabase
      .from('catalog_categories')
      .select('id, name_vi, name_en')
      .order('sort_order'),
    supabase
      .from('catalog_options')
      .select('id, option_set_id, group_name, name_vi, name_en, extra_price_vnd')
      .order('sort_order'),
    supabase
      .from('products')
      .select(
        'id, category_id, option_set_id, name_vi, name_en, description_vi, description_en, price_vnd, image_url, badge, is_available, tasting_notes'
      )
      .order('sort_order'),
  ]);

  if (categoriesResult.error || optionsResult.error || productsResult.error) {
    throw new Error('Unable to load the catalog.');
  }

  const optionsBySet = new Map<string, ProductOption[]>();
  for (const row of optionsResult.data) {
    const options = optionsBySet.get(row.option_set_id) ?? [];
    options.push(mapCatalogOption(row));
    optionsBySet.set(row.option_set_id, options);
  }

  return {
    categories: [ALL_CATEGORY, ...categoriesResult.data.map(mapCatalogCategory)],
    products: productsResult.data.map((row) =>
      mapCatalogProduct(row, row.option_set_id ? optionsBySet.get(row.option_set_id) : undefined)
    ),
  };
}

const getCachedCatalog = unstable_cache(loadCatalog, ['public-catalog'], {
  tags: [CATALOG_CACHE_TAG],
  revalidate: 300,
});

export const getCatalog = cache(getCachedCatalog);

export async function getCatalogProduct(id: string): Promise<Product | null> {
  const catalog = await getCatalog();
  return catalog.products.find((product) => product.id === id) ?? null;
}
