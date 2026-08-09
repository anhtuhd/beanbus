import type { Metadata } from 'next';
import MenuClient from './MenuClient';
import { CATEGORIES, PRODUCTS } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Menu đồ uống và bánh tươi | Beanbus Coffee',
  description: 'Khám phá cà phê đặc sản, cold brew, trà và bánh tươi tại Beanbus Coffee Roaster Hải Phòng.',
};

export default async function MenuPage() {
  const catalog = getAppMode() === 'demo'
    ? { categories: CATEGORIES, products: PRODUCTS }
    : await getCatalog();

  return <MenuClient categories={catalog.categories} products={catalog.products} />;
}
