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
  menus?: CatalogMenu[];
  storeClosed?: boolean;
};

export type CatalogMenu = {
  id: string;
  nameVi: string;
  nameEn: string;
  isOpen: boolean;
  products: Product[];
  categories: Category[];
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

  const products = productsResult.data.map((row) =>
    mapCatalogProduct(row, row.option_set_id ? optionsBySet.get(row.option_set_id) : undefined)
  );
  const baseCatalog = {
    categories: [ALL_CATEGORY, ...categoriesResult.data.map(mapCatalogCategory)],
    products,
  };

  if (process.env.CATALOG_MENU_MODE !== 'scheduled') return baseCatalog;

  const supabaseForMenus = createPublicSupabaseClient();
  const [menusResult, schedulesResult, sectionsResult, itemsResult] = await Promise.all([
    supabaseForMenus.from('catalog_menus').select('id, name_vi, name_en, sort_order').eq('is_active', true).order('sort_order'),
    supabaseForMenus.from('catalog_menu_schedules').select('menu_id, day_of_week, starts_at, ends_at'),
    supabaseForMenus.from('catalog_menu_sections').select('id, menu_id, category_id, sort_order').order('sort_order'),
    supabaseForMenus.from('catalog_menu_items').select('section_id, product_id, sort_order').eq('is_visible', true).order('sort_order'),
  ]);
  if (menusResult.error || schedulesResult.error || sectionsResult.error || itemsResult.error) throw new Error('Unable to load scheduled catalog.');

  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[part('weekday')] ?? 0;
  const nowMinutes = Number(part('hour')) * 60 + Number(part('minute'));
  const toMinutes = (value: string) => { const [hour, minute] = value.slice(0, 5).split(':').map(Number); return hour * 60 + minute; };
  const categoryMap = new Map(categoriesResult.data.map((row) => [row.id, mapCatalogCategory(row)]));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const menus: CatalogMenu[] = menusResult.data.map((menu) => {
    const isOpen = schedulesResult.data.some((schedule) => schedule.menu_id === menu.id && schedule.day_of_week === weekday && toMinutes(schedule.starts_at) <= nowMinutes && nowMinutes < toMinutes(schedule.ends_at));
    const menuSections = sectionsResult.data.filter((section) => section.menu_id === menu.id).sort((a, b) => a.sort_order - b.sort_order);
    const menuProducts = menuSections.flatMap((section) => itemsResult.data.filter((item) => item.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order).map((item) => productMap.get(item.product_id)).filter((product): product is Product => Boolean(product)));
    const uniqueProducts = [...new Map(menuProducts.map((product) => [product.id, product])).values()];
    const menuCategories = menuSections.map((section) => categoryMap.get(section.category_id)).filter((category): category is Category => Boolean(category));
    return { id: menu.id, nameVi: menu.name_vi, nameEn: menu.name_en, isOpen, products: uniqueProducts, categories: [ALL_CATEGORY, ...menuCategories] };
  });
  const currentMenu = menus.find((menu) => menu.isOpen);
  return { categories: currentMenu?.categories ?? [ALL_CATEGORY], products: currentMenu?.products ?? [], menus, storeClosed: !currentMenu };
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
