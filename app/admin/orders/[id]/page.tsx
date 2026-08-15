import Link from 'next/link';
import { ArrowLeft, CircleAlert, ExternalLink, ShoppingBag } from 'lucide-react';
import { notFound } from 'next/navigation';
import styles from '../../requests/requests.module.css';
import detailStyles from '../../../account/account.module.css';
import OrderStatusForm from '../OrderStatusForm';
import RefundOrderForm from '../RefundOrderForm';
import { canRefundOrder } from '../order-workflow';
import { requireAdmin } from '@/lib/auth/session';
import type { Database } from '@/lib/supabase/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LocalizedText } from '@/components/ui/LocalizedText';
import { getSiteUrl } from '@/lib/env';
import CopyGuestReceiptLinkButton from './CopyGuestReceiptLinkButton';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'product_name_vi' | 'product_name_en' | 'quantity' | 'unit_price_vnd' | 'line_total_vnd' | 'special_note'
>;
type ItemOption = Pick<
  Database['public']['Tables']['order_item_options']['Row'],
  'order_item_id' | 'option_name_vi' | 'extra_price_vnd'
>;
type StatusHistory = Pick<
  Database['public']['Tables']['order_status_history']['Row'],
  'id' | 'from_status' | 'to_status' | 'actor_type' | 'created_at'
>;
type OrderDetail = Pick<Order, 'id' | 'order_code' | 'order_number' | 'customer_name' | 'customer_phone' | 'fulfillment' | 'pickup_at' | 'delivery_address' | 'note' | 'voucher_code' | 'subtotal_vnd' | 'discount_vnd' | 'total_vnd' | 'points_applied' | 'cash_due_vnd' | 'payment_method' | 'payment_status' | 'status' | 'created_at' | 'created_via' | 'created_by_user_id' | 'receipt_token' | 'user_id'> & {
  order_items: Array<OrderItem & { order_item_options: ItemOption[] }>;
  order_status_history: StatusHistory[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};
const PAYMENT_METHOD_LABEL: Record<string, string> = { cod: 'COD', sepay_qr: 'Sepay QR' };
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán lỗi',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
};

function formatDate(value: string | null): string {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function statusLabel(status: string | null): string {
  return status ? STATUS_LABEL[status] ?? status : 'Chưa cập nhật';
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerSupabaseClient();
  const orderResult = await supabase
    .from('orders')
    .select(`
      id, order_code, order_number, customer_name, customer_phone, fulfillment,
      pickup_at, delivery_address, note, voucher_code, subtotal_vnd, discount_vnd,
      total_vnd, points_applied, cash_due_vnd, payment_method, payment_status, status, created_at,
      created_via, created_by_user_id, receipt_token, user_id,
      order_items(
        id, product_name_vi, product_name_en, quantity, unit_price_vnd,
        line_total_vnd, special_note,
        order_item_options(order_item_id, option_name_vi, extra_price_vnd)
      ),
      order_status_history(id, from_status, to_status, actor_type, created_at)
    `)
    .eq('id', id)
    .maybeSingle();
  if (orderResult.error || !orderResult.data) notFound();
  const order = orderResult.data as unknown as OrderDetail;
  const items = order.order_items ?? [];
  const history = [...(order.order_status_history ?? [])]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));

  return (
    <main className={`wrap ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <Link href="/admin/orders" className={styles.backLink}><ArrowLeft size={16} /> Danh sách đơn hàng</Link>
          <span className={detailStyles.detailEyebrow}><ShoppingBag size={16} /> Order Operations</span>
          <h1>Đơn #{order.order_code}</h1>
          <p>Tạo lúc {formatDate(order.created_at)}</p>
        </div>
        {order.created_via === 'admin_panel' && order.user_id === null && order.receipt_token && (
          <div className={styles.headerActions}>
            <CopyGuestReceiptLinkButton url={`${getSiteUrl()}/order/confirmation/${order.id}?receipt=${encodeURIComponent(order.receipt_token)}`} />
          </div>
        )}
      </header>

      <section className={styles.detailWorkflow} aria-labelledby="order-workflow-title">
        <div className={styles.detailWorkflowHeader}>
          <div>
            <h2 id="order-workflow-title"><LocalizedText vi="Tiến trình xử lý đơn" en="Order workflow" /></h2>
            <p><LocalizedText vi="Bấm hành động chính để chuyển đơn sang bước kế tiếp." en="Use the primary action to move the order to its next step." /></p>
          </div>
          {canRefundOrder(order.status, order.payment_method, order.payment_status, order.cash_due_vnd, order.points_applied) && <RefundOrderForm orderId={order.id} amountVnd={order.cash_due_vnd} />}
        </div>
        <OrderStatusForm orderId={order.id} currentStatus={order.status} paymentMethod={order.payment_method} paymentStatus={order.payment_status} />
      </section>

      <section className={detailStyles.orderDetailGrid} aria-label="Chi tiết đơn hàng">
        <div className={detailStyles.orderDetailPanel}>
          <h2>Món đã đặt</h2>
          {items.length === 0 ? <div className={styles.stateBox}>Không có dòng sản phẩm.</div> : (
            <div className={detailStyles.detailList}>
              {items.map((item) => (
                <div key={item.id}>
                  <dt>{item.product_name_vi} x{item.quantity}</dt>
                  <dd>{formatMoney(item.line_total_vnd)}<small>{item.unit_price_vnd.toLocaleString('vi-VN')}đ / món{item.special_note ? ` · ${item.special_note}` : ''}{item.order_item_options.map((option) => ` · ${option.option_name_vi}`).join('')}</small></dd>
                </div>
              ))}
            </div>
          )}
          <div className={detailStyles.detailTotals}>
            <div><span>Tạm tính</span><strong>{formatMoney(order.subtotal_vnd)}</strong></div>
            <div><span>Giảm giá</span><strong>-{formatMoney(order.discount_vnd)}</strong></div>
            {order.points_applied > 0 && <div><span>Điểm đã dùng</span><strong>-{formatMoney(order.points_applied)}</strong></div>}
            <div className={detailStyles.detailGrandTotal}><span>Còn thanh toán</span><strong>{formatMoney(order.cash_due_vnd)}</strong></div>
          </div>
        </div>

        <div className={detailStyles.orderDetailPanel}>
          <h2>Thông tin khách hàng</h2>
          <dl className={detailStyles.detailList}>
            <div><dt>Khách hàng</dt><dd>{order.customer_name}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{order.customer_phone}</dd></div>
            <div><dt>Nhận hàng</dt><dd>{order.fulfillment === 'pickup' ? 'Nhận tại quán' : 'Giao hàng'}</dd></div>
            {order.pickup_at && <div><dt>Thời gian nhận</dt><dd>{formatDate(order.pickup_at)}</dd></div>}
            {order.delivery_address && <div><dt>Địa chỉ</dt><dd>{order.delivery_address}</dd></div>}
            <div><dt>Thanh toán</dt><dd>{order.cash_due_vnd === 0 ? 'Thanh toán bằng điểm' : `${PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method} · ${PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}`}</dd></div>
            {order.voucher_code && <div><dt>Voucher</dt><dd>{order.voucher_code}</dd></div>}
            {order.note && <div><dt>Ghi chú</dt><dd>{order.note}</dd></div>}
          </dl>
        </div>
      </section>

      <section aria-labelledby="order-history-title">
        <header className={styles.sectionHeader}><h2 id="order-history-title">Lịch sử trạng thái</h2><span>{history.length} lần thay đổi</span></header>
        {history.length === 0 ? <div className={styles.stateBox}>Chưa có lịch sử thay đổi.</div> : (
          <div className={styles.requestList}>
            {history.map((entry) => (
              <article key={entry.id} className={styles.requestRow}>
                <div><span className={styles.label}>Thời gian</span><strong>{formatDate(entry.created_at)}</strong></div>
                <div><span className={styles.label}>Chuyển trạng thái</span><strong>{statusLabel(entry.from_status)} → {statusLabel(entry.to_status)}</strong></div>
                <div><span className={styles.label}>Nguồn</span><strong>{entry.actor_type === 'admin' ? 'Admin' : 'System'}</strong></div>
                <div><Link href="/admin/orders" className={styles.detailLink}>Danh sách đơn <ExternalLink size={14} /></Link></div>
              </article>
            ))}
          </div>
        )}
      </section>

      {order.status === 'cancelled' && <p className={styles.stateBox} role="status"><CircleAlert size={16} /> Đơn hàng này đã bị hủy.</p>}
    </main>
  );
}
