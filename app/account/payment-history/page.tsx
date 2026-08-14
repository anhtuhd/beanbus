import Link from 'next/link';
import { ArrowLeft, History, ReceiptText, WalletCards } from 'lucide-react';
import { redirect } from 'next/navigation';
import { LocalizedText } from '@/components/ui/LocalizedText';
import { requireProfile } from '@/lib/auth/session';
import { getAppMode } from '@/lib/env';
import { getMemberPaymentHistory, type MemberPaymentHistoryEntry } from '@/lib/stored-value/history';
import styles from './payment-history.module.css';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

function sourceLabel(sourceType: MemberPaymentHistoryEntry['source_type']) {
  if (sourceType === 'topup') return { vi: 'Nạp điểm', en: 'Points top-up' };
  if (sourceType === 'flash_sale') return { vi: 'Flash-sale điểm', en: 'Flash-sale points' };
  return { vi: 'Thanh toán đơn hàng', en: 'Order payment' };
}

function statusLabel(status: string) {
  const labels: Record<string, { vi: string; en: string }> = {
    pending: { vi: 'Đang chờ', en: 'Pending' },
    paid: { vi: 'Đã thanh toán', en: 'Paid' },
    failed: { vi: 'Thất bại', en: 'Failed' },
    expired: { vi: 'Hết hạn', en: 'Expired' },
    refunded: { vi: 'Đã hoàn tiền', en: 'Refunded' },
  };
  return labels[status] ?? { vi: status, en: status };
}

function pageLink(page: number): string {
  return `/account/payment-history?page=${page}`;
}

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (getAppMode() === 'demo') redirect('/account');

  const profile = await requireProfile('/account/payment-history');
  if (profile.role === 'admin') redirect('/admin');

  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const history = await getMemberPaymentHistory(Number.parseInt(rawPage ?? '1', 10));

  return (
    <main className={`wrap ${styles.page}`}>
      <Link href="/account" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        <LocalizedText vi="Về tài khoản" en="Back to account" />
      </Link>

      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}><History size={16} aria-hidden="true" /> <LocalizedText vi="Lịch sử giao dịch" en="Transaction history" /></span>
          <h1><LocalizedText vi="Thanh toán & nạp điểm" en="Payments & points top-ups" /></h1>
          <p><LocalizedText vi="Theo dõi mã giao dịch, trạng thái thanh toán và điểm đã cộng." en="Track payment codes, statuses, and credited points." /></p>
        </div>
        <Link href="/account/topup" className="btn btn-primary btn-sm">
          <WalletCards size={16} aria-hidden="true" />
          <LocalizedText vi="Nạp điểm" en="Top up points" />
        </Link>
      </header>

      {history.error ? (
        <div className={styles.statePanel} role="alert"><ReceiptText size={20} aria-hidden="true" /><LocalizedText vi={history.error} en="Payment history is temporarily unavailable." /></div>
      ) : history.items.length === 0 ? (
        <div className={styles.statePanel} role="status"><ReceiptText size={20} aria-hidden="true" /><LocalizedText vi="Chưa có giao dịch thanh toán hoặc nạp điểm." en="No payment or top-up transactions yet." /></div>
      ) : (
        <section className={styles.historyList} aria-labelledby="payment-history-title">
          <div className={styles.listHeader}>
            <h2 id="payment-history-title"><LocalizedText vi="Giao dịch của bạn" en="Your transactions" /></h2>
            <span>{history.totalCount} <LocalizedText vi="giao dịch" en="transactions" /></span>
          </div>
          <div className={styles.rows}>
            {history.items.map((item) => {
              const source = sourceLabel(item.source_type);
              const status = statusLabel(item.status);
              const isOrder = item.source_type === 'order';
              return (
                <article className={styles.row} key={`${item.source_type}-${item.reference_id}`}>
                  <div className={styles.rowMain}>
                    <strong><LocalizedText {...source} /></strong>
                    <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                  </div>
                  <div className={styles.rowMeta}>
                    <span><LocalizedText vi="Số tiền" en="Amount" /></span>
                    <strong>{formatMoney(item.amount_vnd)}</strong>
                  </div>
                  <div className={styles.rowMeta}>
                    <span><LocalizedText vi={isOrder ? 'Điểm sử dụng' : 'Điểm nhận'} en={isOrder ? 'Points used' : 'Points received'} /></span>
                    <strong>{item.points > 0 ? item.points.toLocaleString('vi-VN') : '0'}</strong>
                  </div>
                  <div className={styles.rowCode}>
                    <span><LocalizedText vi="Mã giao dịch" en="Transaction code" /></span>
                    <code>{item.payment_code ?? '—'}</code>
                  </div>
                  <span className={`${styles.status} ${styles[`status_${item.status}`]}`}>
                    <LocalizedText {...status} />
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {history.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Payment history pagination">
          {history.page > 1 ? <Link href={pageLink(history.page - 1)}><LocalizedText vi="← Trước" en="← Previous" /></Link> : <span aria-disabled="true"><LocalizedText vi="← Trước" en="← Previous" /></span>}
          <strong>{history.page} / {history.totalPages}</strong>
          {history.page < history.totalPages ? <Link href={pageLink(history.page + 1)}><LocalizedText vi="Sau →" en="Next →" /></Link> : <span aria-disabled="true"><LocalizedText vi="Sau →" en="Next →" /></span>}
        </nav>
      )}
    </main>
  );
}
