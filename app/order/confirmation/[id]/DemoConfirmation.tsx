'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useOrders } from '@/context/OrderContext';
import styles from './confirmation.module.css';

export function DemoConfirmation() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id as string;
  const isPaidParam = searchParams.get('paid') === 'true';
  const { orders } = useOrders();
  const { t, lang } = useLanguage();

  const order = orders.find((candidate) => candidate.id === orderId) || {
    id: orderId || 'DH-260809A1B2C3',
    customerName: 'Nguyễn Văn Bean',
    customerPhone: '0987 654 321',
    orderType: 'pickup' as const,
    pickupTime: '2026-08-09T11:30',
    items: [],
    subtotal: 105000,
    discountAmount: 10500,
    finalTotal: 94500,
    paymentMethod: 'sepay_qr' as const,
    paymentStatus: isPaidParam ? ('paid' as const) : ('pending' as const),
    status: isPaidParam ? ('confirmed' as const) : ('pending' as const),
    createdAt: new Date().toISOString(),
    sepayCode: 'DH-260809A1B2C3',
  };

  const steps = [
    { key: 'pending', labelVi: 'Đã nhận đơn', labelEn: 'Submitted' },
    { key: 'confirmed', labelVi: 'Đã xác nhận', labelEn: 'Confirmed' },
    { key: 'preparing', labelVi: 'Đang pha chế', labelEn: 'Preparing' },
    { key: 'ready', labelVi: 'Sẵn sàng nhận', labelEn: 'Ready' },
    { key: 'completed', labelVi: 'Hoàn thành', labelEn: 'Completed' },
  ];
  const currentStepIdx = steps.findIndex((step) => step.key === order.status);

  return (
    <div className={`wrap ${styles.container}`}>
      <div className={styles.headerBox}>
        <div className={styles.successBadge}>
          <CheckCircle2 size={48} color="#10b981" />
        </div>
        <h1>{t('Đặt Hàng Thành Công!', 'Order Placed Successfully!')}</h1>
        <p className={styles.orderIdText}>
          {t('Mã đơn hàng:', 'Order ID:')} <strong>{order.id}</strong>
        </p>
        {order.paymentStatus === 'paid' && (
          <div className={styles.paidBadge}>
            {t('Thanh toán Sepay QR đã được ghi nhận!', 'Sepay QR Payment Verified!')}
          </div>
        )}
      </div>

      <div className={styles.trackingCard}>
        <h3>{t('Trạng thái đơn hàng thực tế', 'Live Order Status')}</h3>
        <div className={styles.stepsGrid}>
          {steps.map((step, index) => {
            const isDone = index <= currentStepIdx;
            const isCurrent = index === currentStepIdx;
            return (
              <div
                key={step.key}
                className={`${styles.stepItem} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
              >
                <div className={styles.stepDot}>
                  {isDone ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                <span className={styles.stepLabel}>{t(step.labelVi, step.labelEn)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.detailsGrid}>
        <div className={styles.infoCard}>
          <h3>{t('Thông tin giao/nhận', 'Fulfillment Details')}</h3>
          <div className={styles.row}>
            <span>{t('Hình thức:', 'Type:')}</span>
            <strong>
              {order.orderType === 'pickup'
                ? t('Tự đến lấy tại quán', 'Self Pickup')
                : t('Giao hàng tận nơi', 'Delivery')}
            </strong>
          </div>
          {order.orderType === 'pickup' && (
            <div className={styles.row}>
              <span>{t('Giờ hẹn lấy:', 'Pickup Time:')}</span>
              <strong>{order.pickupTime?.replace('T', ' ')}</strong>
            </div>
          )}
          {order.orderType === 'delivery' && (
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
            <span>{t('Phương thức TT:', 'Payment Method:')}</span>
            <strong>{order.paymentMethod === 'sepay_qr' ? 'Sepay VietQR Code' : 'Tiền mặt COD'}</strong>
          </div>
        </div>

        <div className={styles.infoCard}>
          <h3>{t('Danh sách đồ uống', 'Items List')}</h3>
          <div className={styles.itemsList}>
            {order.items.map((item) => (
              <div key={item.cartItemId} className={styles.itemRow}>
                <span>{lang === 'en' ? item.product.nameEn : item.product.nameVi} x{item.quantity}</span>
                <strong>{item.itemTotal.toLocaleString('vi-VN')}đ</strong>
              </div>
            ))}
          </div>
          <div className={styles.totalsBox}>
            <div className={styles.tRow}>
              <span>{t('Tạm tính:', 'Subtotal:')}</span>
              <span>{order.subtotal.toLocaleString('vi-VN')}đ</span>
            </div>
            {order.discountAmount > 0 && (
              <div className={`${styles.tRow} ${styles.discount}`}>
                <span>{t('Giảm giá:', 'Discount:')}</span>
                <span>-{order.discountAmount.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            <div className={`${styles.tRow} ${styles.final}`}>
              <span>{t('Tổng tiền:', 'Total Paid:')}</span>
              <span className={styles.finalPrice}>{order.finalTotal.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionsRow}>
        <Link href="/account" className="btn btn-dark btn-lg">
          <span>{t('Xem Lịch Sử Đơn Tại Tài Khoản', 'View Order History')}</span>
        </Link>
        <Link href="/menu" className="btn btn-primary btn-lg">
          <ShoppingBag size={18} />
          <span>{t('Đặt Thêm Đồ Uống Khác', 'Order More Drinks')}</span>
        </Link>
      </div>
    </div>
  );
}
