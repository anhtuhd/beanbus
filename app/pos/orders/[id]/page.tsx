import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireOperator } from '@/lib/auth/session';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/supabase/database.types';
import styles from '@/app/admin/requests/requests.module.css';
import detailStyles from '@/app/account/account.module.css';
import PosOrderStatusForm from '../PosOrderStatusForm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Order = Database['public']['Tables']['orders']['Row'];

function money(value: number) { return `${value.toLocaleString('vi-VN')}đ`; }
function date(value: string) { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)); }

export default async function PosOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from('orders').select('id, order_code, customer_name, customer_phone, fulfillment, pickup_at, note, subtotal_vnd, discount_vnd, total_vnd, points_applied, cash_due_vnd, payment_method, payment_status, status, created_at, created_via, user_id, order_items(id, product_name_vi, quantity, line_total_vnd)').eq('id', id).eq('created_via', 'pos').maybeSingle();
  if (error || !data) notFound();
  const order = data as unknown as Order & { order_items: Array<{ id: string; product_name_vi: string; quantity: number; line_total_vnd: number }> };
  return <main className={`wrap ${styles.page}`}>
    <header className={styles.header}><div><Link href="/pos" className={styles.backLink}><ArrowLeft size={16} /> Quầy bán hàng</Link><span className={detailStyles.detailEyebrow}><ShoppingBag size={16} /> POS</span><h1>Đơn #{order.order_code}</h1><p>Tạo lúc {date(order.created_at)}</p></div></header>
    <section className={styles.detailWorkflow}><div className={styles.detailWorkflowHeader}><div><h2>Tiến trình xử lý</h2><p>Chuyển đơn sang bước tiếp theo bằng một nút.</p></div></div><PosOrderStatusForm orderId={order.id} currentStatus={order.status} /></section>
    <section className={detailStyles.orderDetailGrid} aria-label="Chi tiết đơn tại quầy">
      <div className={detailStyles.orderDetailPanel}><h2>Món đã đặt</h2><div className={detailStyles.detailList}>{order.order_items.map((item) => <div key={item.id}><dt>{item.product_name_vi} × {item.quantity}</dt><dd>{money(item.line_total_vnd)}</dd></div>)}</div><div className={detailStyles.detailTotals}><div><span>Tạm tính</span><strong>{money(order.subtotal_vnd)}</strong></div><div><span>Giảm giá</span><strong>-{money(order.discount_vnd)}</strong></div>{order.points_applied > 0 && <div><span>Điểm đã dùng</span><strong>-{money(order.points_applied)}</strong></div>}<div className={detailStyles.detailGrandTotal}><span>Còn thanh toán</span><strong>{money(order.cash_due_vnd)}</strong></div></div></div>
      <div className={detailStyles.orderDetailPanel}><h2>Thông tin khách hàng</h2><dl className={detailStyles.detailList}><div><dt>Khách hàng</dt><dd>{order.customer_name}</dd></div><div><dt>Số điện thoại</dt><dd>{order.customer_phone}</dd></div><div><dt>Nhận hàng</dt><dd>{order.fulfillment === 'pickup' ? 'Nhận tại quán' : 'Giao hàng'}</dd></div>{order.pickup_at && <div><dt>Thời gian nhận</dt><dd>{date(order.pickup_at)}</dd></div>}<div><dt>Thanh toán</dt><dd>{order.cash_due_vnd === 0 ? 'Bằng điểm' : `${order.payment_method} · ${order.payment_status}`}</dd></div>{order.note && <div><dt>Ghi chú</dt><dd>{order.note}</dd></div>}</dl></div>
    </section>
  </main>;
}
