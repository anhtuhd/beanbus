import styles from './confirmation.module.css';

export default function OrderConfirmationLoading() {
  return (
    <main className={`wrap ${styles.container}`} aria-busy="true" aria-label="Đang tải thông tin đơn hàng">
      <div className={styles.loadingHeader}>
        <span className={styles.loadingCircle} />
        <span className={`${styles.loadingLine} ${styles.loadingTitle}`} />
        <span className={`${styles.loadingLine} ${styles.loadingSubtitle}`} />
      </div>
      <div className={`${styles.loadingPanel} ${styles.loadingPayment}`} />
      <div className={`${styles.loadingPanel} ${styles.loadingTracking}`} />
      <div className={styles.loadingColumns}>
        <div className={styles.loadingPanel} />
        <div className={styles.loadingPanel} />
      </div>
    </main>
  );
}
