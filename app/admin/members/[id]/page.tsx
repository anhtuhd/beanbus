import Link from 'next/link';
import { ArrowLeft, ExternalLink, Plus } from 'lucide-react';
import { notFound } from 'next/navigation';
import styles from '../../requests/requests.module.css';
import { requireAdmin } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import MemberRoleForm from '../MemberRoleForm';
import MemberPointsAdjustmentForm from './MemberPointsAdjustmentForm';

type Profile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'member_number' | 'full_name' | 'phone' | 'email' | 'birthday' | 'avatar_url' | 'role' | 'created_at'
>;
type LedgerRow = Pick<
  Database['public']['Tables']['loyalty_ledger']['Row'],
  'id' | 'points' | 'amount_vnd' | 'source_type' | 'source_key' | 'voucher_code' | 'note' | 'created_at'
>;
type OrderRow = Pick<
  Database['public']['Tables']['orders']['Row'],
  'id' | 'order_code' | 'order_number' | 'total_vnd' | 'status' | 'payment_status' | 'created_at'
>;
type RoleHistoryRow = Pick<
  Database['public']['Tables']['member_role_history']['Row'],
  'id' | 'from_role' | 'to_role' | 'actor_user_id' | 'created_at'
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 20;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function pageNumber(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(first(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 1;
}

function pageLink(memberId: string, ledgerPage: number, orderPage: number): string {
  return `/admin/members/${memberId}?ledgerPage=${ledgerPage}&orderPage=${orderPage}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

export default async function AdminMemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const queryParams = await searchParams;
  const ledgerPage = pageNumber(queryParams.ledgerPage);
  const orderPage = pageNumber(queryParams.orderPage);

  const supabase = await createServerSupabaseClient();
  const [profileResult, loyaltyResult, ledgerResult, ordersResult, roleHistoryResult] = await Promise.all([
    supabase.from('profiles').select('id, member_number, full_name, phone, email, birthday, avatar_url, role, created_at').eq('id', id).maybeSingle(),
    supabase.rpc('get_member_loyalty_summary_v2', { p_user_id: id }),
    supabase.from('loyalty_ledger').select('id, points, amount_vnd, source_type, source_key, voucher_code, note, created_at', { count: 'exact' }).eq('user_id', id).order('created_at', { ascending: false }).range((ledgerPage - 1) * PAGE_SIZE, ledgerPage * PAGE_SIZE - 1),
    supabase.from('orders').select('id, order_code, order_number, total_vnd, status, payment_status, created_at', { count: 'exact' }).eq('user_id', id).order('created_at', { ascending: false }).range((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE - 1),
    supabase.from('member_role_history').select('id, from_role, to_role, actor_user_id, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
  ]);

  const profile = profileResult.data as Profile | null;
  if (profileResult.error || !profile) notFound();
  const loyalty = loyaltyResult.data?.[0];
  const ledger = (ledgerResult.data ?? []) as LedgerRow[];
  const orders = (ordersResult.data ?? []) as OrderRow[];
  const roleHistory = (roleHistoryResult.data ?? []) as RoleHistoryRow[];
  const ledgerTotalPages = Math.max(1, Math.ceil((ledgerResult.count ?? 0) / PAGE_SIZE));
  const orderTotalPages = Math.max(1, Math.ceil((ordersResult.count ?? 0) / PAGE_SIZE));
  const dataError = Boolean(loyaltyResult.error || ledgerResult.error || ordersResult.error || roleHistoryResult.error);

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin/members" className={styles.backLink}><ArrowLeft size={16} /> Danh sách thành viên</Link>
          <h1>Chi tiết hội viên</h1>
          <p>Quản lý hồ sơ, phân quyền, điểm loyalty và đơn hàng theo đúng quyền truy cập.</p>
        </div>
        <div className={styles.headerActions}>
          {process.env.ENABLE_ADMIN_ASSISTED_ORDERS === 'true' && <Link href={`/admin/orders/new?memberId=${profile.id}`} className={styles.primaryLink}><Plus size={16} /> Tạo đơn cho hội viên</Link>}
          <span className={styles.total}>BB-{String(profile.member_number).padStart(8, '0')}</span>
        </div>
      </header>

      {dataError && <div className={styles.stateBox} role="alert">Một phần dữ liệu hội viên chưa thể tải.</div>}

      <section className={styles.requestList} aria-labelledby="member-profile-title">
        <article className={`${styles.requestRow} ${styles.memberRow}`}>
          <div><span className={styles.label}>Hồ sơ</span><strong id="member-profile-title">{profile.full_name || 'Chưa cập nhật tên'}</strong><small>Tham gia {formatDate(profile.created_at)}</small></div>
          <div><span className={styles.label}>Liên hệ</span><strong>{profile.phone ?? 'Chưa có số điện thoại'}</strong><small>{profile.email ?? 'Chưa có email'}</small></div>
          <div><span className={styles.label}>Ngày sinh</span><strong>{profile.birthday ? formatDate(profile.birthday) : 'Chưa cập nhật'}</strong></div>
          <div><span className={styles.label}>Quyền</span><strong>{profile.role}</strong></div>
        </article>
      </section>

      <section className={styles.memberEditPanel} aria-labelledby="member-edit-title">
        <header className={styles.sectionHeader}>
          <div>
            <h2 id="member-edit-title">Chỉnh sửa hội viên</h2>
            <p>Gom các thao tác quản trị nhạy cảm vào một nơi và ghi audit cho từng thay đổi.</p>
          </div>
          <span>Quyền và điểm</span>
        </header>
        <div className={styles.memberEditGrid}>
          <div className={styles.memberEditBlock}>
            <h3>Phân quyền</h3>
            <p>Thay đổi vai trò sẽ áp dụng qua RPC được bảo vệ và lưu lịch sử.</p>
            <MemberRoleForm userId={profile.id} role={profile.role} />
          </div>
          <div className={styles.memberEditBlock}>
            <h3 id="member-points-adjustment-title">Điều chỉnh điểm</h3>
            {profile.role === 'member' && loyalty ? (
              <MemberPointsAdjustmentForm userId={profile.id} balancePoints={Number(loyalty.balance_points)} />
            ) : (
              <p className={styles.helperText}>Chỉ hội viên có dữ liệu loyalty mới có thể cộng hoặc trừ điểm.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="member-role-history-title">
        <header className={styles.sectionHeader}><h2 id="member-role-history-title">Lịch sử quyền</h2><span>{roleHistory.length} lần thay đổi gần nhất</span></header>
        {roleHistory.length === 0 ? <div className={styles.stateBox}>Chưa có lịch sử thay đổi quyền.</div> : (
          <div className={styles.requestList}>
            {roleHistory.map((entry) => (
              <article key={entry.id} className={styles.requestRow}>
                <div><span className={styles.label}>Thời gian</span><strong>{formatDateTime(entry.created_at)}</strong></div>
                <div><span className={styles.label}>Thay đổi</span><strong>{entry.from_role} → {entry.to_role}</strong></div>
                <div><span className={styles.label}>Người thực hiện</span><strong>Admin</strong><small>{entry.actor_user_id === id ? 'Tự thao tác' : 'Quản trị viên khác'}</small></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="member-loyalty-title">
        <header className={styles.sectionHeader}><h2 id="member-loyalty-title">Loyalty</h2><span>Chỉ đọc</span></header>
        {!loyalty ? <div className={styles.stateBox}>Chưa có dữ liệu loyalty.</div> : (
          <div className={styles.requestList}>
            <article className={`${styles.requestRow} ${styles.memberRow}`}>
              <div><span className={styles.label}>Số dư thực</span><strong>{Number(loyalty.balance_points).toLocaleString('vi-VN')} điểm</strong></div>
              <div><span className={styles.label}>Khả dụng</span><strong>{Number(loyalty.available_points).toLocaleString('vi-VN')} điểm</strong><small>Nợ âm: {Number(loyalty.debt_points).toLocaleString('vi-VN')}</small></div>
              <div><span className={styles.label}>Đã nạp / Đã tích</span><strong>{Number(loyalty.topup_points).toLocaleString('vi-VN')} / {Number(loyalty.earned_points).toLocaleString('vi-VN')}</strong></div>
              <div><span className={styles.label}>Đã dùng</span><strong>{Number(loyalty.spent_points).toLocaleString('vi-VN')} điểm</strong><small>Chi tiêu {formatMoney(Number(loyalty.total_spent_vnd))}</small></div>
            </article>
          </div>
        )}
      </section>

      <section aria-labelledby="member-ledger-title">
        <header className={styles.sectionHeader}><h2 id="member-ledger-title">Lịch sử điểm</h2><span>{ledgerResult.count ?? ledger.length} giao dịch</span></header>
        {ledger.length === 0 ? <div className={styles.stateBox}>Chưa có giao dịch điểm.</div> : (
          <div className={styles.requestList}>
            {ledger.map((entry) => (
              <article key={entry.id} className={styles.requestRow}>
                <div><span className={styles.label}>Thời gian</span><strong>{formatDateTime(entry.created_at)}</strong><small>{entry.source_type}</small></div>
                <div><span className={styles.label}>Biến động</span><strong className={entry.points > 0 ? styles.positiveValue : styles.negativeValue}>{entry.points > 0 ? '+' : ''}{entry.points.toLocaleString('vi-VN')} điểm</strong></div>
                <div><span className={styles.label}>Nguồn</span><strong>{entry.voucher_code ?? entry.source_key}</strong><small>{entry.note ?? 'Không có ghi chú'}</small></div>
              </article>
            ))}
          </div>
        )}
        {ledgerTotalPages > 1 && <nav className={styles.pagination} aria-label="Phân trang lịch sử điểm">
          {ledgerPage > 1 && <Link href={pageLink(id, ledgerPage - 1, orderPage)}>Trang trước</Link>}
          <span>Trang {ledgerPage} / {ledgerTotalPages}</span>
          {ledgerPage < ledgerTotalPages && <Link href={pageLink(id, ledgerPage + 1, orderPage)}>Trang sau</Link>}
        </nav>}
      </section>

      <section aria-labelledby="member-orders-title">
        <header className={styles.sectionHeader}><h2 id="member-orders-title">Đơn hàng</h2><span>{ordersResult.count ?? orders.length} đơn</span></header>
        {orders.length === 0 ? <div className={styles.stateBox}>Chưa có đơn hàng.</div> : (
          <div className={styles.requestList}>
            {orders.map((order) => (
              <article key={order.id} className={styles.requestRow}>
                <div><span className={styles.label}>Đơn hàng</span><strong>{order.order_code}</strong><small>{formatDateTime(order.created_at)}</small></div>
                <div><span className={styles.label}>Tổng tiền</span><strong>{formatMoney(order.total_vnd)}</strong></div>
                <div><span className={styles.label}>Trạng thái</span><strong>{order.status}</strong><small>{order.payment_status}</small></div>
                <div><Link href={`/admin/orders?q=${order.order_code}`} className={styles.detailLink}>Mở trong đơn hàng <ExternalLink size={14} /></Link></div>
              </article>
            ))}
          </div>
        )}
        {orderTotalPages > 1 && <nav className={styles.pagination} aria-label="Phân trang đơn hàng hội viên">
          {orderPage > 1 && <Link href={pageLink(id, ledgerPage, orderPage - 1)}>Trang trước</Link>}
          <span>Trang {orderPage} / {orderTotalPages}</span>
          {orderPage < orderTotalPages && <Link href={pageLink(id, ledgerPage, orderPage + 1)}>Trang sau</Link>}
        </nav>}
      </section>
    </main>
  );
}
