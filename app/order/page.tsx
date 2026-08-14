import Link from 'next/link';
import OrderClient from './OrderClient';
import { CATEGORIES, PRODUCTS, type Product } from '@/data/products';
import { getCatalog, type CatalogMenu } from '@/lib/catalog/queries';
import { getAppMode } from '@/lib/env';
import CatalogUnavailable from '@/components/catalog/CatalogUnavailable';
import styles from './order.module.css';

export const revalidate = 300;

function OrderNoScript({ products }: { products: Product[] }) {
  return (
    <div className={styles.noScriptFallback}>
      <div className="wrap">
        <p className={styles.eyebrow}>Đặt món Beanbus</p>
        <h1>Chọn món cho hôm nay</h1>
        <p>JavaScript đang tắt. Bạn vẫn có thể xem thực đơn và mở chi tiết sản phẩm.</p>
        <div className={styles.noScriptList}>
          {products.map((product) => (
            <article key={product.id} className={styles.noScriptItem}>
              <Link href={`/menu/${product.id}`}>
                <strong>{product.nameVi}</strong>
                <span>{product.descriptionVi}</span>
                <b>{product.price.toLocaleString('vi-VN')}đ</b>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderPageView({ categories, products, menus, storeClosed }: { categories: typeof CATEGORIES; products: Product[]; menus?: CatalogMenu[]; storeClosed?: boolean }) {
  return <><OrderClient categories={categories} products={products} menus={menus} storeClosed={storeClosed} /><noscript><OrderNoScript products={products} /></noscript></>;
}

function DemoOrderPage() {
  return <OrderPageView categories={CATEGORIES} products={PRODUCTS} />;
}

async function ProductionOrderPage() {
  let catalog;
  try {
    catalog = await getCatalog();
  } catch {
    return (
      <CatalogUnavailable
        retryHref="/order"
        title="Chưa thể tải thực đơn đặt món"
        description="Dữ liệu món đang tạm thời chưa sẵn sàng. Vui lòng thử lại sau ít phút."
      />
    );
  }
  return <OrderPageView categories={catalog.categories} products={catalog.products} menus={catalog.menus} storeClosed={catalog.storeClosed} />;
}

export default function OrderPage() {
  return getAppMode() === 'demo' ? <DemoOrderPage /> : <ProductionOrderPage />;
}
