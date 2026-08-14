import Link from 'next/link';
import { ArrowLeft, LayoutList } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { parseCatalogSnapshot } from '@/lib/catalog/release';
import MenuBuilder from '../MenuBuilder';
import styles from '../../requests/requests.module.css';

export default async function AdminCatalogMenusPage() {
  await requireAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from('catalog_releases').select('snapshot, lock_version').eq('status', 'draft').single();
  const snapshot = parseCatalogSnapshot(data?.snapshot);

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1><LayoutList size={24} /> Menu Builder</h1>
          <p>Chỉnh sửa bản nháp, xem trước và xuất bản cấu trúc menu theo giờ.</p>
        </div>
        <nav className={styles.catalogTabs} aria-label="Catalog sections">
          <Link href="/admin/catalog">Món</Link>
          <Link href="/admin/catalog/menus" className={styles.activeFilter}>Menu Builder</Link>
        </nav>
      </header>
      {error || !snapshot || !data ? (
        <div className={styles.stateBox} role="alert">Không thể tải bản nháp catalog. Hãy chạy migration Menu Builder trước.</div>
      ) : <MenuBuilder initialSnapshot={snapshot} initialLockVersion={data.lock_version} />}
    </main>
  );
}
