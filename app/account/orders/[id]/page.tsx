import Link from 'next/link';
import { ArrowLeft, CircleAlert, History, ShoppingBag } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getMemberAccountOrder } from '@/lib/account/queries';
import { requireProfile } from '@/lib/auth/session';
import ReorderOrderForm from '../ReorderOrderForm';
import styles from '../../account.module.css';

function formatDate(value: string | null): string {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang pha chế',
    ready: 'Sẵn sàng nhận',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };
  return labels[status] ?? status;
}

export default async function MemberOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile('/account');
  const { id } = await params;
  const order = await getMemberAccountOrder(id);
  if (!order) notFound();

  return (
    <main className={`wrap ${styles.accountPage}`}>
      <Link href="/account" className={styles.accountBackLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        Quay lại tài khoản
      </Link>

      <header className={styles.orderDetailHeader}>
        <div>
          <span className={styles.detailEyebrow}><ShoppingBag size={16} /> Lịch sử đơn hàng</span>
          <h1>Đơn #{order.code}</h1>
          <p>Tạo lúc {formatDate(order.createdAt)}</p>
        </div>
        <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
          {statusLabel(order.status)}
        </span>
      </header>

      <ReorderOrderForm orderId={order.id} />

      <section className={styles.orderDetailGrid}>
        <div className={styles.orderDetailPanel}>
          <h2>Món đã đặt</h2>
          <div className={styles.orderItems}>
            {order.items.map((item) => (
              <div key={item.id} className={styles.itemLine}>
                <span>{item.nameVi} x{item.quantity}</span>
                <strong>{item.lineTotalVnd.toLocaleString('vi-VN')}đ</strong>
              </div>
            ))}
          </div>
          <div className={styles.detailTotals}>
            <div><span>Tạm tính</span><strong>{order.subtotalVnd.toLocaleString('vi-VN')}đ</strong></div>
            <div><span>Giảm giá</span><strong>-{order.discountVnd.toLocaleString('vi-VN')}đ</strong></div>
            {order.pointsApplied > 0 && <div><span>Điểm đã dùng</span><strong>-{order.pointsApplied.toLocaleString('vi-VN')}đ</strong></div>}
            <div className={styles.detailGrandTotal}><span>Còn thanh toán</span><strong>{order.cashDueVnd.toLocaleString('vi-VN')}đ</strong></div>
          </div>
        </div>

        <div className={styles.orderDetailPanel}>
          <h2>Thông tin đơn hàng</h2>
          <dl className={styles.detailList}>
            <div><dt>Hình thức</dt><dd>{order.fulfillment === 'pickup' ? 'Nhận tại quán' : 'Giao hàng'}</dd></div>
            <div><dt>Thanh toán</dt><dd>{order.cashDueVnd === 0 ? 'Thanh toán bằng điểm' : `${order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'} (${order.paymentMethod})`}</dd></div>
            <div><dt>Người nhận</dt><dd>{order.customerName} · {order.customerPhone}</dd></div>
            {order.deliveryAddress && <div><dt>Địa chỉ giao</dt><dd>{order.deliveryAddress}</dd></div>}
            {order.pickupAt && <div><dt>Thời gian nhận</dt><dd>{formatDate(order.pickupAt)}</dd></div>}
            {order.voucherCode && <div><dt>Voucher</dt><dd>{order.voucherCode}</dd></div>}
            {order.note && <div><dt>Ghi chú</dt><dd>{order.note}</dd></div>}
          </dl>
        </div>
      </section>

      <section className={styles.loyaltyHistory} aria-labelledby="order-history-title">
        <div className={styles.loyaltyHistoryHeader}>
          <h2 id="order-history-title"><History size={17} /> Lịch sử trạng thái</h2>
          <span>{order.statusHistory.length} lần thay đổi</span>
        </div>
        {order.statusHistory.length === 0 ? <p className={styles.emptyState}>Chưa có lần cập nhật trạng thái.</p> : (
          <div className={styles.loyaltyEntryList}>
            {order.statusHistory.map((entry) => (
              <div key={entry.id} className={styles.loyaltyEntry}>
                <div><strong>{statusLabel(entry.fromStatus)} → {statusLabel(entry.toStatus)}</strong><small>{entry.actorType === 'admin' ? 'Beanbus Operations' : 'Hệ thống'}</small></div>
                <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
              </div>
            ))}
          </div>
        )}
      </section>

      {order.status === 'cancelled' && (
        <p className={styles.accountStatus} role="status"><CircleAlert size={16} /> Đơn hàng này đã được hủy.</p>
      )}
    </main>
  );
}
