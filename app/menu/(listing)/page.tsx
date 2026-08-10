import type { Metadata } from 'next';
import Link from 'next/link';
import MenuClient from '../MenuClient';
import { CATEGORIES, PRODUCTS } from '@/data/products';
import type { Product } from '@/data/products';
import { getCatalog } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';
import CatalogUnavailable from '@/components/catalog/CatalogUnavailable';
import styles from '../page.module.css';

export const metadata: Metadata = {
  title: 'Menu đồ uống và bánh tươi | Beanbus Coffee',
  description: 'Khám phá cà phê đặc sản, cold brew, trà và bánh tươi tại Beanbus Coffee Roaster Hải Phòng.',
};

function MenuNoScript({ products }: { products: Product[] }) {
  return (
    <div className={styles.noScriptFallback}>
      <div className="wrap">
        <p className="eyebrow eyebrow-green">Thực đơn Beanbus</p>
        <h1>Menu Đồ Uống &amp; Bánh Tươi</h1>
        <p>Khám phá cà phê đặc sản, cold brew, trà và bánh tươi tại Beanbus Coffee Roaster Hải Phòng.</p>
        <div className={styles.noScriptList}>
          {products.map((product) => (
            <article key={product.id} className={styles.noScriptItem}>
              <Link href={`/menu/${product.id}`}><strong>{product.nameVi}</strong><span>{product.descriptionVi}</span><b>{product.price.toLocaleString('vi-VN')}đ</b></Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function MenuPageView({ categories, products }: { categories: typeof CATEGORIES; products: Product[] }) {
  return <><MenuClient categories={categories} products={products} /><MenuNoScript products={products} /></>;
}

async function ProductionMenuPage() {
  let catalog;
  try {
    catalog = await getCatalog();
  } catch {
    return (
      <CatalogUnavailable
        retryHref="/menu"
        title="Chưa thể tải thực đơn"
        description="Dữ liệu món đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút."
      />
    );
  }
  return <MenuPageView categories={catalog.categories} products={catalog.products} />;
}

export default function MenuPage() {
  if (getAppMode() === 'demo') return <MenuPageView categories={CATEGORIES} products={PRODUCTS} />;
  return <ProductionMenuPage />;
}
