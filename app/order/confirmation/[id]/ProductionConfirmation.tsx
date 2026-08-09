'use client';

import Link from 'next/link';
import { CheckCircle2, CircleAlert, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import type { OrderReceipt } from '@/lib/orders/receipt-data';
import styles from './confirmation.module.css';

const steps = [
  { key: 'pending', labelVi: 'Đã nhận đơn', labelEn: 'Submitted' },
  { key: 'confirmed', labelVi: 'Đã xác nhận', labelEn: 'Confirmed' },
  { key: 'preparing', labelVi: 'Đang pha chế', labelEn: 'Preparing' },
  { key: 'ready', labelVi: 'Sẵn sàng nhận', labelEn: 'Ready' },
  { key: 'completed', labelVi: 'Hoàn thành', labelEn: 'Completed' },
] as const;

function formatOrderNumber(order: OrderReceipt) {
  const year = new Date(order.createdAt).getFullYear();
  return `BB-${year}-${String(order.number).padStart(6, '0')}`;
}

function formatPickupTime(value: string, lang: 'vi' | 'en') {
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function ProductionConfirmation({ order }: { order: OrderReceipt }) {
  const { t, lang } = useLanguage();
  const currentStepIndex = steps.findIndex((step) => step.key === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className={`wrap ${styles.container}`}>
      <div className={styles.headerBox}>
        <div className={isCancelled ? styles.cancelledBadgeIcon : styles.successBadge}>
          {isCancelled
            ? <CircleAlert size={48} aria-hidden="true" />
            : <CheckCircle2 size={48} aria-hidden="true" />}
        </div>
        <h1>{isCancelled ? t('Đơn hàng đã hủy', 'Order Cancelled') : t('Đã nhận đơn hàng', 'Order Received')}</h1>
        <p className={styles.orderIdText}>
          {t('Mã đơn hàng:', 'Order ID:')} <strong>{formatOrderNumber(order)}</strong>
        </p>
        {order.paymentStatus === 'paid' && (
          <div className={styles.paidBadge}>{t('Thanh toán đã được xác nhận', 'Payment confirmed')}</div>
        )}
      </div>

      {!isCancelled && (
        <div className={styles.trackingCard}>
          <h3>{t('Trạng thái đơn hàng', 'Order Status')}</h3>
          <div className={styles.stepsGrid}>
            {steps.map((step, index) => {
              const isDone = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              return (
                <div
                  key={step.key}
                  className={`${styles.stepItem} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
                >
                  <div className={styles.stepDot}>
                    {isDone ? <CheckCircle2 size={16} aria-hidden="true" /> : index + 1}
                  </div>
                  <span className={styles.stepLabel}>{t(step.labelVi, step.labelEn)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.detailsGrid}>
        <div className={styles.infoCard}>
          <h3>{t('Thông tin giao/nhận', 'Fulfillment Details')}</h3>
          <div className={styles.row}>
            <span>{t('Hình thức:', 'Type:')}</span>
            <strong>{order.fulfillment === 'pickup' ? t('Tự đến lấy tại quán', 'Self Pickup') : t('Giao hàng tận nơi', 'Delivery')}</strong>
          </div>
          {order.pickupAt && (
            <div className={styles.row}>
              <span>{t('Giờ hẹn lấy:', 'Pickup Time:')}</span>
              <strong>{formatPickupTime(order.pickupAt, lang)}</strong>
            </div>
          )}
          {order.deliveryAddress && (
            <div className={styles.row}>
              <span>{t('Địa chỉ giao:', 'Address:')}</span>
              <strong>{order.deliveryAddress}</strong>
            </div>
          )}
          <div className={styles.row}>
            <span>{t('Người nhận:', 'Recipient:')}</span>
            <strong>{order.customerName} ({order.customerPhone})</strong>
          </div>
          <div className={styles.row}>
            <span>{t('Thanh toán:', 'Payment:')}</span>
            <strong>{order.paymentMethod === 'sepay_qr' ? 'Sepay VietQR' : t('Tiền mặt COD', 'Cash on delivery')}</strong>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3>{t('Danh sách đồ uống', 'Items List')}</h3>
          <div className={styles.itemsList}>
            {order.items.map((item) => (
              <div key={item.id} className={styles.itemRow}>
                <span>{lang === 'en' ? item.nameEn : item.nameVi} x{item.quantity}</span>
                <strong>{item.lineTotalVnd.toLocaleString('vi-VN')}đ</strong>
              </div>
            ))}
          </div>
          <div className={styles.totalsBox}>
            <div className={styles.tRow}>
              <span>{t('Tạm tính:', 'Subtotal:')}</span>
              <span>{order.subtotalVnd.toLocaleString('vi-VN')}đ</span>
            </div>
            {order.discountVnd > 0 && (
              <div className={`${styles.tRow} ${styles.discount}`}>
                <span>{t('Giảm giá:', 'Discount:')}</span>
                <span>-{order.discountVnd.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            <div className={`${styles.tRow} ${styles.final}`}>
              <span>{t('Tổng thanh toán:', 'Order total:')}</span>
              <span className={styles.finalPrice}>{order.totalVnd.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionsRow}>
        <Link href="/account" className="btn btn-dark btn-lg">
          <span>{t('Xem đơn trong tài khoản', 'View account orders')}</span>
        </Link>
        <Link href="/menu" className="btn btn-primary btn-lg">
          <ShoppingBag size={18} aria-hidden="true" />
          <span>{t('Đặt thêm đồ uống', 'Order more drinks')}</span>
        </Link>
      </div>
    </div>
  );
}
