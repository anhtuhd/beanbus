import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Eye } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseCatalogSnapshot } from '@/lib/catalog/release';
import styles from '../../requests/requests.module.css';

export default async function CatalogPreviewPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('catalog_releases').select('snapshot, lock_version').eq('status', 'draft').single();
  const snapshot = parseCatalogSnapshot(data?.snapshot);
  const productMap = new Map((snapshot?.products ?? []).map((product) => [product.id, product]));
  const categoryMap = new Map((snapshot?.categories ?? []).map((category) => [category.id, category]));

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin/catalog/menus" className={styles.backLink}><ArrowLeft size={16} /> Menu Builder</Link>
          <h1><Eye size={24} /> Preview bản nháp</h1>
          <p>Đây là bản xem trước, chưa ảnh hưởng menu công khai và không cho đặt món.</p>
        </div>
        {data && <span className={styles.total}>Draft v{data.lock_version}</span>}
      </header>
      {error || !snapshot ? <div className={styles.stateBox} role="alert">Không thể tải bản xem trước.</div> : (
        <div className={styles.previewMenus}>
          {snapshot.menus.map((menu) => <section key={menu.id} className={styles.previewMenu}>
            <div className={styles.previewMenuHeading}><div><h2>{menu.nameVi}</h2><p>{menu.nameEn} · {menu.isActive ? 'Đang hoạt động / Active' : 'Tạm tắt / Inactive'}</p></div><span>{menu.schedules.length} khung giờ</span></div>
            <div className={styles.previewSections}>
              {menu.sections.map((section) => <section key={section.id} className={styles.previewSection}><h3>{categoryMap.get(section.categoryId)?.nameVi ?? section.categoryId}</h3><div className={styles.previewProducts}>{section.productIds.map((productId) => { const product = productMap.get(productId); return product ? <article key={product.id} className={styles.previewProduct}><Image src={product.imageUrl} alt="" width={64} height={64} unoptimized /><div><strong>{product.nameVi}</strong><small>{product.nameEn}</small><span>{product.priceVnd.toLocaleString('vi-VN')}đ</span></div></article> : null; })}</div></section>)}
            </div>
          </section>)}
        </div>
      )}
    </main>
  );
}
