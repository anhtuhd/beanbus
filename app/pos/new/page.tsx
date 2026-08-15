import Link from 'next/link';
import { ArrowLeft, Store } from 'lucide-react';
import { PRODUCTS, type Product } from '@/data/products';
import { getAppMode } from '@/lib/env';
import { getCatalog } from '@/lib/catalog/queries';
import { requireOperator } from '@/lib/auth/session';
import AdminOrderCreator from '@/app/admin/orders/new/AdminOrderCreator';
import styles from '../../admin/requests/requests.module.css';
import pageStyles from '../../admin/orders/new/admin-order-new.module.css';

async function loadProducts(): Promise<Product[]> {
  if (getAppMode() !== 'production') return PRODUCTS;
  try { return (await getCatalog()).products.filter((product) => product.isAvailable); } catch { return []; }
}

export default async function PosNewPage() {
  await requireOperator();
  const products = await loadProducts();
  const enabled = process.env.ENABLE_POS_STAFF === 'true';
  return (
    <main className={`wrap ${styles.page} ${pageStyles.page}`}>
      <header className={styles.header}><div><Link href="/pos" className={styles.backLink}><ArrowLeft size={16} /> Quầy bán hàng</Link><h1>Tạo đơn tại quầy</h1><p>Hội viên có thể dùng điểm và voucher sau khi nhân viên xác nhận.</p></div><span className={styles.total}><Store size={16} /> POS</span></header>
      {!enabled ? <div className={styles.stateBox} role="status">POS đang tạm tắt.</div> : !products.length ? <div className={styles.stateBox} role="alert">Catalog hiện không có món đang bán.</div> : <AdminOrderCreator products={products} initialMember={null} sepayEnabled={process.env.NEXT_PUBLIC_ENABLE_SEPAY === 'true'} pointsEnabled={process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT === 'true'} mode="pos" />}
    </main>
  );
}
