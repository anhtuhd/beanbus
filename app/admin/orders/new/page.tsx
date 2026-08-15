import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { PRODUCTS, type Product } from '@/data/products';
import { getAppMode } from '@/lib/env';
import { getCatalog } from '@/lib/catalog/queries';
import { requireAdmin } from '@/lib/auth/session';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import styles from '../../requests/requests.module.css';
import pageStyles from './admin-order-new.module.css';
import AdminOrderCreator from './AdminOrderCreator';
import type { AdminOrderMember } from './actions';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loadCatalogProducts(): Promise<Product[]> {
  if (getAppMode() !== 'production') return PRODUCTS;
  try {
    return (await getCatalog()).products.filter((product) => product.isAvailable);
  } catch {
    return [];
  }
}

async function loadMember(memberId: string | undefined): Promise<AdminOrderMember | null> {
  if (!memberId || !UUID.test(memberId)) return null;
  const supabase = await createServerSupabaseClient();
  const [profileResult, balanceResult] = await Promise.all([
    supabase.from('profiles').select('id, member_number, full_name, email, phone').eq('id', memberId).eq('role', 'member').maybeSingle(),
    supabase.rpc('get_admin_member_point_balances', { p_user_ids: [memberId] }),
  ]);
  if (profileResult.error || !profileResult.data) return null;
  return {
    id: profileResult.data.id,
    memberNumber: profileResult.data.member_number,
    fullName: profileResult.data.full_name,
    email: profileResult.data.email,
    phone: profileResult.data.phone,
    availablePoints: Math.max(0, Number(balanceResult.data?.[0]?.available_points ?? 0)),
  };
}

export default async function AdminNewOrderPage({ searchParams }: { searchParams: Promise<{ memberId?: string | string[] }> }) {
  await requireAdmin();
  const params = await searchParams;
  const memberId = Array.isArray(params.memberId) ? params.memberId[0] : params.memberId;
  const [products, member] = await Promise.all([loadCatalogProducts(), loadMember(memberId)]);
  const featureEnabled = process.env.ENABLE_ADMIN_ASSISTED_ORDERS === 'true';
  const sepayEnabled = process.env.NEXT_PUBLIC_ENABLE_SEPAY === 'true';
  const pointsEnabled = process.env.NEXT_PUBLIC_ENABLE_POINTS_PAYMENT === 'true';

  return (
    <main className={`wrap ${styles.page} ${pageStyles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin/orders" className={styles.backLink}><ArrowLeft size={16} /> Danh sách đơn hàng</Link>
          <h1>Tạo đơn hàng</h1>
          <p>Admin tạo đơn hộ hội viên hoặc khách vãng lai bằng catalog và giá server.</p>
        </div>
        <span className={styles.total}><Plus size={16} /> Đơn admin</span>
      </header>

      {!featureEnabled ? (
        <div className={styles.stateBox} role="status">Tính năng tạo đơn hộ đang tạm tắt.</div>
      ) : products.length === 0 ? (
        <div className={styles.stateBox} role="alert">Catalog hiện không có món đang bán trong menu hoạt động.</div>
      ) : (
        <AdminOrderCreator
          products={products}
          initialMember={member}
          sepayEnabled={sepayEnabled}
          pointsEnabled={pointsEnabled}
        />
      )}
    </main>
  );
}
