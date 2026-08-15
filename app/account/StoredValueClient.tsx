'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, Clock3, Copy, History, LoaderCircle, QrCode, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { toTransferMemo } from '@/lib/payments/transfer-code';
import { createStoredValuePayment, getStoredValuePaymentStatus, type StoredValueActionResult } from './stored-value-actions';
import type { StoredValueCatalogItem, StoredValueKind } from '@/lib/stored-value/queries';
import styles from './stored-value.module.css';

type Purchase = NonNullable<Extract<StoredValueActionResult, { ok: true }>['purchase']>;
type Payment = NonNullable<Extract<StoredValueActionResult, { ok: true }>['payment']>;

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function formatDate(value: string | null, lang: 'vi' | 'en'): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

export default function StoredValueClient({
  kind,
  enabled,
  items,
  error,
}: {
  kind: StoredValueKind;
  enabled: boolean;
  items: StoredValueCatalogItem[];
  error?: string;
}) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [activeItem, setActiveItem] = useState<StoredValueCatalogItem | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);
  const { lang, t } = useLanguage();
  const router = useRouter();
  const pollingRef = useRef(false);
  const idempotencyKeysRef = useRef<Record<string, string>>({});
  const paymentStatus = purchase?.payment_status ?? purchase?.purchase_status ?? null;
  const transferMemo = purchase?.payment_code ? toTransferMemo(purchase.payment_code) : '';

  useEffect(() => {
    if (!purchase?.purchase_id || paymentStatus === 'paid' || paymentStatus === 'expired' || paymentStatus === 'failed') return;
    const timer = window.setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const latest = await getStoredValuePaymentStatus(purchase.purchase_id);
        if (latest) {
          setPurchase(latest);
        }
      } finally {
        pollingRef.current = false;
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paymentStatus, purchase]);

  useEffect(() => {
    if (paymentStatus !== 'paid') return;
    const timer = window.setTimeout(() => router.replace('/account'), 1200);
    return () => window.clearTimeout(timer);
  }, [paymentStatus, router]);

  const handleCreate = async (item: StoredValueCatalogItem) => {
    if (pendingItemId) return;
    setActiveItem(item);
    setPendingItemId(item.id);
    setActionError('');
    idempotencyKeysRef.current[item.id] ??= crypto.randomUUID();
    const result = await createStoredValuePayment(kind, {
      itemId: item.id,
      idempotencyKey: idempotencyKeysRef.current[item.id],
    });
    if (!result.ok) {
      setActionError(result.error);
    } else {
      setPurchase(result.purchase);
      setPayment(result.payment);
    }
    setPendingItemId(null);
  };

  const retryPayment = () => {
    if (!activeItem || pendingItemId) return;
    idempotencyKeysRef.current[activeItem.id] = crypto.randomUUID();
    void handleCreate(activeItem);
  };

  const copyCode = async () => {
    if (!payment || !navigator.clipboard) return;
    await navigator.clipboard.writeText(transferMemo);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const title = kind === 'topup' ? t('Nạp điểm hội viên', 'Member points top-up') : t('Flash-sale điểm thưởng', 'Bonus points flash sale');
  const description = kind === 'topup'
    ? t('Chọn gói, chuyển khoản đúng số tiền và chờ hệ thống xác nhận.', 'Choose a package, transfer the exact amount, then wait for confirmation.')
    : t('Suất flash-sale được giữ trong thời gian ngắn và chỉ cộng điểm sau giao dịch đã xác minh.', 'A flash-sale slot is held briefly and points are added only after payment is verified.');
  const statusText = (status: string): string => {
    if (status === 'paid') return t('Đã ghi nhận thanh toán và cộng điểm.', 'Payment recorded and points added.');
    if (status === 'expired') return t('Yêu cầu đã hết hạn. Bạn có thể tạo yêu cầu mới.', 'This request expired. You can create a new one.');
    if (status === 'failed') return t('Thanh toán không thành công.', 'Payment was unsuccessful.');
    return t('Đang chờ hệ thống xác nhận giao dịch.', 'Waiting for transaction confirmation.');
  };

  return (
    <div className="wrap">
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <nav className={styles.headerNav} aria-label={t('Điều hướng tài khoản', 'Account navigation')}>
            <Link href="/account" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" /> {t('Về tài khoản', 'Back to account')}</Link>
            <Link href="/account/payment-history" className={styles.backLink}><History size={16} aria-hidden="true" /> {t('Lịch sử giao dịch', 'Transaction history')}</Link>
          </nav>
          <p className={`eyebrow ${styles.eyebrow}`}>Beanbus Member</p>
          <h1>{title}</h1>
          <p className={styles.lede}>{description}</p>
        </div>
        <div className={styles.headerIcon} aria-hidden="true"><ShieldCheck size={24} /></div>
      </div>

      {!enabled ? (
        <div className={styles.statusPanel} role="status">
          <Clock3 size={20} />
          <div>
            <strong>{t('Chức năng chưa được kích hoạt', 'This feature is not enabled')}</strong>
            <p>{t('Chương trình sẽ chỉ mở sau khi chính sách điểm và thanh toán được phê duyệt.', 'This programme opens after its points and payment policy is approved.')}</p>
          </div>
        </div>
      ) : error ? (
        <div className={styles.statusPanel} role="alert"><strong>{error}</strong></div>
      ) : purchase && payment ? (
        <div className={styles.paymentLayout}>
          <section className={styles.paymentPanel} aria-labelledby="stored-value-payment-title">
            <div className={styles.sectionHeading}>
              <QrCode size={20} />
              <div>
                <h2 id="stored-value-payment-title">{t('Thanh toán chuyển khoản', 'Bank transfer payment')}</h2>
                <p>{t('Không xác nhận thủ công. Hệ thống chỉ cộng điểm sau webhook hợp lệ.', 'There is no manual confirmation. Points are added only after a valid payment callback.')}</p>
              </div>
            </div>
            <div className={styles.qrWrap}>
              <Image src={payment.qrUrl} alt={t('Mã QR thanh toán', 'Payment QR code')} width={280} height={280} unoptimized />
            </div>
            <div className={styles.paymentDetails}>
              <div><span>{t('Ngân hàng', 'Bank')}</span><strong>{payment.bankCode}</strong></div>
              <div><span>{t('Số tài khoản', 'Account number')}</span><strong>{payment.accountNumber}</strong></div>
              <div><span>{t('Số tiền', 'Amount')}</span><strong>{formatMoney(purchase.amount_vnd)}</strong></div>
              <div>
                <span>{t('Nội dung chuyển khoản', 'Transfer memo')}</span>
                <strong className={styles.codeValue}>{transferMemo}
                  <button type="button" onClick={copyCode} aria-label={t('Sao chép nội dung chuyển khoản', 'Copy transfer memo')} title={t('Sao chép nội dung chuyển khoản', 'Copy transfer memo')}>
                    {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
                  </button>
                </strong>
              </div>
            </div>
            <div className={paymentStatus === 'paid' ? styles.successStatus : paymentStatus === 'expired' || paymentStatus === 'failed' ? styles.errorStatus : styles.waitingStatus} role="status" aria-live="polite">
              {paymentStatus === 'paid' ? <CheckCircle size={18} /> : paymentStatus === 'expired' || paymentStatus === 'failed' ? <Clock3 size={18} /> : <LoaderCircle size={18} className={styles.spin} />}
              <div>
                <strong>{statusText(paymentStatus ?? 'pending')}</strong>
                <span>{t('Hết hạn', 'Expires')}: {formatDate(purchase.expires_at, lang)}</span>
                {(paymentStatus === 'expired' || paymentStatus === 'failed') && activeItem && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={retryPayment} disabled={pendingItemId !== null}>
                    {pendingItemId === activeItem.id ? <LoaderCircle size={15} className={styles.spin} /> : <QrCode size={15} />}
                    {pendingItemId === activeItem.id ? t('Đang khởi tạo...', 'Initializing...') : t('Tạo mã mới', 'Create a new code')}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <>
          {actionError && <div className={styles.errorStatus} role="alert">{actionError}</div>}
          <div className={styles.itemGrid}>
            {items.length === 0 ? (
              <div className={styles.statusPanel} role="status"><Clock3 size={20} /><div><strong>{t('Chưa có gói khả dụng', 'No package is available yet')}</strong><p>{t('Vui lòng quay lại sau khi chương trình được cập nhật.', 'Please check back after the programme is updated.')}</p></div></div>
            ) : items.map((item) => (
              <article className={styles.item} key={item.id}>
                <div className={styles.itemTop}><span>{kind === 'topup' ? t('Gói nạp', 'Top-up package') : t('Suất giới hạn', 'Limited slot')}</span><strong>{formatMoney(item.amountVnd)}</strong></div>
                <h2>{lang === 'en' ? item.nameEn : item.nameVi}</h2>
                <p>{lang === 'en' ? item.nameVi : item.nameEn}</p>
                <div className={styles.points}>{item.points.toLocaleString(lang === 'en' ? 'en-GB' : 'vi-VN')} {t('điểm', 'points')}</div>
                {item.remainingQuantity !== null && <small>{t('Còn', 'Remaining')} {item.remainingQuantity} {t('suất', 'slots')}</small>}
                <button type="button" className="btn btn-primary" onClick={() => handleCreate(item)} disabled={pendingItemId !== null}>
                  {pendingItemId === item.id ? <LoaderCircle size={16} className={styles.spin} /> : <QrCode size={16} />}
                  {pendingItemId === item.id ? t('Đang khởi tạo...', 'Initializing...') : t('Tạo mã thanh toán', 'Create payment code')}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
