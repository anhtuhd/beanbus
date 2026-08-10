'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useOrders } from '@/context/OrderContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useDialogFocus } from '@/lib/ui/use-dialog-focus';
import { X, Copy, CheckCircle, RefreshCw, ShieldCheck, QrCode } from 'lucide-react';
import styles from './SepayQRModal.module.css';

interface Props {
  orderId: string;
  sepayCode: string;
  finalTotal: number;
  onClose: () => void;
}

export const SepayQRModal: React.FC<Props> = ({ orderId, sepayCode, finalTotal, onClose }) => {
  const router = useRouter();
  const { t } = useLanguage();
  const { updateOrderStatus } = useOrders();
  const { clearCart } = useCart();
  const { addPoints } = useAuth();

  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);

  const bankName = 'MBBank (Ngân hàng Quân Đội)';
  const accNumber = '0937936688';
  const accName = 'BEANBUS COFFEE ROASTER';
  const qrUrl = `https://img.vietqr.io/image/MB-0937936688-compact2.png?amount=${finalTotal}&addInfo=${sepayCode}&accountName=BEANBUS%20COFFEE%20ROASTER`;

  const copyToClipboard = (text: string, type: 'acc' | 'content') => {
    navigator.clipboard.writeText(text);
    if (type === 'acc') {
      setCopiedAcc(true);
      setTimeout(() => setCopiedAcc(false), 2000);
    } else {
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  const handleSimulatePaymentSuccess = () => {
    setIsSimulating(true);
    setTimeout(() => {
      // Update order in state to confirmed + paid
      updateOrderStatus(orderId, 'confirmed', 'paid');
      // Reward user loyalty points
      addPoints(finalTotal);
      clearCart();
      onClose();
      router.push(`/order/confirmation/${orderId}?paid=true`);
    }, 1200);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={dialogRef} className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sepay-dialog-title" tabIndex={-1}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <QrCode className={styles.icon} />
            <h3 id="sepay-dialog-title">{t('Thanh Toán QR Code Sepay', 'Sepay QR Payment')}</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('Đóng thanh toán QR', 'Close QR payment')}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          <div className={styles.topInfo}>
            <span className={styles.badge}>⚡ Sepay Gateway Auto Check</span>
            <p className={styles.guide}>
              {t(
                'Mở ứng dụng ngân hàng hoặc ví điện tử bất kỳ (MoMo, ZaloPay, Vietcombank...) để quét mã QR.',
                'Open any mobile banking or e-wallet app to scan QR code.'
              )}
            </p>
          </div>

          <div className={styles.contentGrid}>
            {/* QR CODE BOX */}
            <div className={styles.qrBox}>
              <Image src={qrUrl} alt="VietQR Sepay Payment" width={320} height={320} unoptimized className={styles.qrImage} />
              <span className={styles.scanHint}>{t('Quét mã để tự điền thông tin', 'Scan to auto-fill payment')}</span>
            </div>

            {/* TRANSFER DETAILS */}
            <div className={styles.detailsBox}>
              <div className={styles.detailRow}>
                <span className={styles.label}>{t('Ngân hàng', 'Bank')}</span>
                <span className={styles.valueBold}>{bankName}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>{t('Chủ tài khoản', 'Account Name')}</span>
                <span className={styles.valueBold}>{accName}</span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>{t('Số tài khoản', 'Account No.')}</span>
                <div className={styles.copyValue}>
                  <span className={styles.highlight}>{accNumber}</span>
                  <button onClick={() => copyToClipboard(accNumber, 'acc')} aria-label={t('Sao chép số tài khoản', 'Copy account number')}>
                    {copiedAcc ? <CheckCircle size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>{t('Số tiền', 'Amount')}</span>
                <span className={styles.priceHighlight}>
                  {finalTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.label}>{t('Nội dung CK (Bắt buộc)', 'Transfer Note')}</span>
                <div className={styles.copyValue}>
                  <span className={styles.codeHighlight}>{sepayCode}</span>
                  <button onClick={() => copyToClipboard(sepayCode, 'content')} aria-label={t('Sao chép nội dung chuyển khoản', 'Copy transfer note')}>
                    {copiedContent ? <CheckCircle size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* LIVE WEBHOOK STATUS */}
          <div className={styles.statusBanner}>
            <RefreshCw className={styles.spinIcon} size={18} />
            <div className={styles.statusText}>
              <strong>{t('Đang lắng nghe sự kiện từ Sepay...', 'Listening for Sepay payment...')}</strong>
              <span>{t('Hệ thống sẽ tự động cập nhật ngay khi tiền về tài khoản.', 'System updates automatically upon payment.')}</span>
            </div>
          </div>
          <p className={styles.copyStatus} role="status" aria-live="polite">
            {copiedAcc ? t('Đã sao chép số tài khoản.', 'Account number copied.') : ''}
            {copiedContent ? t('Đã sao chép nội dung chuyển khoản.', 'Transfer note copied.') : ''}
          </p>
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSimulatePaymentSuccess}
            disabled={isSimulating}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isSimulating ? (
              <span>{t('Đang xác thực thanh toán...', 'Verifying Payment...')}</span>
            ) : (
              <>
                <ShieldCheck size={18} />
                <span>{t('Xác Nhận Đã Chuyển Khoản (Sepay Webhook)', 'Confirm Paid (Simulate Webhook)')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
