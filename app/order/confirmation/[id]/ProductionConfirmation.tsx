'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, CircleAlert, Copy, QrCode, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { toTransferMemo } from '@/lib/payments/transfer-code';
import type { OrderReceipt } from '@/lib/orders/receipt-data';
import styles from './confirmation.module.css';

const steps = [
  { key: 'pending', labelVi: 'Đã nhận đơn', labelEn: 'Submitted' },
  { key: 'confirmed', labelVi: 'Đã xác nhận', labelEn: 'Confirmed' },
  { key: 'preparing', labelVi: 'Đang pha chế', labelEn: 'Preparing' },
  { key: 'ready', labelVi: 'Sẵn sàng nhận', labelEn: 'Ready' },
  { key: 'completed', labelVi: 'Hoàn thành', labelEn: 'Completed' },
] as const;

function formatPickupTime(value: string, lang: 'vi' | 'en') {
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type PaymentDisplay = { accountName: string; qrUrl: string } | null;

export function ProductionConfirmation({
  order,
  paymentDisplay,
  receiptToken,
}: {
  order: OrderReceipt;
  paymentDisplay: PaymentDisplay;
  receiptToken: string;
}) {
  const { t, lang } = useLanguage();
  const [copied, setCopied] = useState<'account' | 'code' | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [liveStatus, setLiveStatus] = useState({
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentDetailStatus: order.payment?.status ?? null,
  });
  const currentStepIndex = steps.findIndex((step) => step.key === liveStatus.status);
  const isCancelled = liveStatus.status === 'cancelled';
  const payment = order.payment
    ? { ...order.payment, status: liveStatus.paymentDetailStatus ?? order.payment.status }
    : null;
  const transferMemo = payment ? toTransferMemo(payment.code) : '';
  const isPaymentPending = liveStatus.paymentStatus === 'pending' && payment?.status === 'pending';

  useEffect(() => {
    if (!order.payment) return;
    const updateExpiry = () => {
      const remaining = Math.max(0, new Date(order.payment!.expiresAt).getTime() - Date.now());
      setRemainingMs(remaining);
      setIsExpired(remaining === 0);
    };
    updateExpiry();
    const timer = window.setInterval(updateExpiry, 1000);
    return () => window.clearInterval(timer);
  }, [order.payment]);

  useEffect(() => {
    if (!isPaymentPending || isExpired) return;
    let timer: number | null = null;
    let delay = 5_000;

    const refreshStatus = async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}/status?receipt=${encodeURIComponent(receiptToken)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const data = await response.json() as {
          status?: OrderReceipt['status'];
          paymentStatus?: OrderReceipt['paymentStatus'];
          payment?: { status?: NonNullable<OrderReceipt['payment']>['status'] } | null;
        };
        if (!data.status || !data.paymentStatus) return;
        setLiveStatus({
          status: data.status,
          paymentStatus: data.paymentStatus,
          paymentDetailStatus: data.payment?.status ?? null,
        });
      } catch {
        // The next scheduled check is the fallback for transient network failures.
      }
    };

    const scheduleRefresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!document.hidden) {
          void refreshStatus();
          delay = Math.min(30_000, Math.round(delay * 1.5));
        }
        scheduleRefresh();
      }, document.hidden ? 15_000 : delay);
    };
    const refreshOnFocus = () => {
      if (!document.hidden) {
        delay = 5_000;
        void refreshStatus();
        scheduleRefresh();
      }
    };

    scheduleRefresh();
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [isExpired, isPaymentPending, order.id, receiptToken]);

  const copyValue = async (value: string, key: 'account' | 'code') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

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
          {t('Mã đơn hàng:', 'Order ID:')} <strong>{order.orderCode}</strong>
        </p>
        {liveStatus.paymentStatus === 'paid' && (
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

      {payment && paymentDisplay && isPaymentPending && !isExpired && (
        <section className={styles.paymentCard} aria-labelledby="payment-title">
          <div className={styles.paymentHeader}>
            <QrCode size={22} aria-hidden="true" />
            <div>
              <h2 id="payment-title">{t('Thanh toán VietQR', 'VietQR payment')}</h2>
              <p>{t('Chuyển đúng số tiền và nội dung trước thời hạn.', 'Use the exact amount and transfer memo before expiry.')}</p>
            </div>
          </div>
          <div className={styles.paymentGrid}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic VietQR URL is the payment artifact. */}
            <img src={paymentDisplay.qrUrl} alt={t('Mã VietQR thanh toán đơn hàng', 'Order payment VietQR')} className={styles.qrImage} />
            <div className={styles.paymentDetails}>
              <div className={styles.paymentRow}>
                <span>{t('Ngân hàng', 'Bank')}</span>
                <strong>{payment.bankCode}</strong>
              </div>
              {paymentDisplay.accountName && (
                <div className={styles.paymentRow}>
                  <span>{t('Chủ tài khoản', 'Account holder')}</span>
                  <strong>{paymentDisplay.accountName}</strong>
                </div>
              )}
              <div className={styles.paymentRow}>
                <span>{t('Số tài khoản', 'Account number')}</span>
                <span className={styles.copyGroup}>
                  <strong>{payment.accountNumber}</strong>
                  <button type="button" onClick={() => copyValue(payment.accountNumber, 'account')} aria-label={t('Sao chép số tài khoản', 'Copy account number')}>
                    {copied === 'account' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </span>
              </div>
              <div className={styles.paymentRow}>
                <span>{t('Số tiền', 'Amount')}</span>
                <strong className={styles.paymentAmount}>{order.cashDueVnd.toLocaleString('vi-VN')}đ</strong>
              </div>
              <div className={styles.paymentRow}>
                <span>{t('Nội dung', 'Transfer memo')}</span>
                <span className={styles.copyGroup}>
                  <strong className={styles.paymentCode}>{transferMemo}</strong>
                  <button type="button" onClick={() => copyValue(transferMemo, 'code')} aria-label={t('Sao chép nội dung chuyển khoản', 'Copy transfer memo')}>
                    {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </span>
              </div>
              <p className={styles.expiryText}>
                {t('Có hiệu lực đến', 'Valid until')} {formatPickupTime(payment.expiresAt, lang)}
              </p>
              <p className={styles.countdownText} role="timer" aria-live="polite">
                {t('Đếm ngược', 'Time left')}: <strong>{formatCountdown(remainingMs)}</strong>
              </p>
            </div>
          </div>
        </section>
      )}

      {payment && (payment.status === 'expired' || isExpired) && liveStatus.paymentStatus !== 'paid' && (
        <div className={styles.paymentNotice} role="status">
          <CircleAlert size={20} aria-hidden="true" />
          <span>{t('Mã thanh toán đã hết hạn. Vui lòng đặt lại đơn hoặc liên hệ Beanbus nếu bạn đã chuyển khoản.', 'This payment code has expired. Place a new order or contact Beanbus if you already transferred.')}</span>
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
            <strong>{order.cashDueVnd === 0
              ? t('Thanh toán bằng điểm', 'Paid with points')
              : order.paymentMethod === 'sepay_qr' ? t('Thanh toán QR', 'QR payment') : t('Tiền mặt COD', 'Cash on delivery')}</strong>
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
            {order.pointsApplied > 0 && (
              <div className={`${styles.tRow} ${styles.discount}`}>
                <span>{t('Điểm đã dùng:', 'Points used:')}</span>
                <span>-{order.pointsApplied.toLocaleString('vi-VN')}đ</span>
              </div>
            )}
            <div className={`${styles.tRow} ${styles.final}`}>
              <span>{t('Còn thanh toán:', 'Cash due:')}</span>
              <span className={styles.finalPrice}>{order.cashDueVnd.toLocaleString('vi-VN')}đ</span>
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
