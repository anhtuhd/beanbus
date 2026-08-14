import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import styles from '../requests/requests.module.css';
import { normalizeVietnameseMobile } from '@/lib/auth/input';
import { requireAdmin } from '@/lib/auth/session';
import { boundedPage } from '@/lib/pagination';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import MemberRoleForm from './MemberRoleForm';
import { LocalizedText } from '@/components/ui/LocalizedText';

type MemberRow = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'member_number' | 'full_name' | 'phone' | 'email' | 'birthday' | 'role' | 'created_at'
>;
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const PAGE_SIZE = 20;
const ROLES = ['all', 'member', 'staff', 'admin'];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function membersLink(role: string, page: number, search: string): string {
  const params = new URLSearchParams({ role, page: String(page) });
  if (search) params.set('q', search);
  return `/admin/members?${params.toString()}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export default async function AdminMembersPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const requestedRole = first(params.role);
  const role = ROLES.includes(requestedRole) ? requestedRole : 'all';
  const search = first(params.q).trim().slice(0, 80);
  const requestedPage = Number.parseInt(first(params.page), 10);
  const page = boundedPage(requestedPage);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createServerSupabaseClient();
  let query = supabase.from('profiles')
    .select('id, member_number, full_name, phone, email, birthday, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (role !== 'all') query = query.eq('role', role as MemberRow['role']);
  if (search) {
    const phone = normalizeVietnameseMobile(search);
    if (/^\d{1,12}$/.test(search)) query = query.eq('member_number', Number(search));
    else if (phone) query = query.eq('phone', phone);
    else if (search.includes('@')) query = query.eq('email', search.toLowerCase());
    else query = query.ilike('full_name', `%${escapeLike(search)}%`);
  }
  const result = await query.range(from, from + PAGE_SIZE - 1);
  const members: MemberRow[] = result.data ?? [];
  const count = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const { data: balanceRows } = members.length > 0
    ? await supabase.rpc('get_admin_member_point_balances', { p_user_ids: members.map((member) => member.id) })
    : { data: [] };
  const balances = new Map((balanceRows ?? []).map((row) => [row.user_id, row]));

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin" className={styles.backLink}><ArrowLeft size={16} /> Tổng quan</Link>
          <h1>Member Directory</h1>
          <p>Danh bạ chỉ đọc; quyền truy cập và giá trị loyalty không chỉnh sửa tại đây.</p>
        </div>
        <span className={styles.total}>{count} tài khoản</span>
      </header>

      <form className={styles.searchForm} action="/admin/members" method="get">
        <input type="hidden" name="role" value={role} />
        <label htmlFor="member-search">Tìm theo mã hội viên, số điện thoại, email hoặc tên</label>
        <div>
          <input id="member-search" name="q" defaultValue={search} maxLength={80} />
          <button><Search size={16} /> <LocalizedText vi="Tìm" en="Search" /></button>
          {search && <Link href={membersLink(role, 1, '')}>Xóa lọc</Link>}
        </div>
      </form>
      <div className={styles.filters} aria-label="Lọc quyền tài khoản">
        {ROLES.map((item) => (
          <Link key={item} href={membersLink(item, 1, search)} className={role === item ? styles.activeFilter : ''}>{item === 'all' ? 'Tất cả' : item}</Link>
        ))}
      </div>

      {result.error ? <div className={styles.stateBox} role="alert">Không thể tải danh sách thành viên.</div> : members.length === 0 ? (
        <div className={styles.stateBox}>Không có thành viên phù hợp.</div>
      ) : (
        <div className={styles.requestList}>
          {members.map((member) => (
            <article key={member.member_number} className={`${styles.requestRow} ${styles.memberRow}`}>
              <div><span className={styles.label}>Hội viên</span><Link href={`/admin/members/${member.id}`} className={styles.detailLink}><strong>BB-{String(member.member_number).padStart(8, '0')}</strong></Link><small>{member.full_name || 'Chưa cập nhật tên'}</small></div>
              <div><span className={styles.label}>Liên hệ</span><strong>{member.phone ?? 'Chưa có số điện thoại'}</strong><small>{member.email ?? 'Chưa có email'}</small></div>
              <div><span className={styles.label}>Ngày sinh</span><strong>{member.birthday ? formatDate(member.birthday) : 'Chưa cập nhật'}</strong></div>
              <div><span className={styles.label}>Điểm khả dụng</span><strong>{Number(balances.get(member.id)?.available_points ?? 0).toLocaleString('vi-VN')} điểm</strong><small>Số dư thực: {Number(balances.get(member.id)?.balance_points ?? 0).toLocaleString('vi-VN')}</small></div>
              <div><span className={styles.label}>Quyền / Ngày tham gia</span><MemberRoleForm userId={member.id} role={member.role} /><small>{formatDate(member.created_at)}</small></div>
            </article>
          ))}
        </div>
      )}
      {totalPages > 1 && <nav className={styles.pagination} aria-label="Phân trang thành viên">
        {page > 1 && <Link href={membersLink(role, page - 1, search)}>Trang trước</Link>}
        <span>Trang {Math.min(page, totalPages)} / {totalPages}</span>
        {page < totalPages && <Link href={membersLink(role, page + 1, search)}>Trang sau</Link>}
      </nav>}
    </main>
  );
}
