import styles from './admin.module.css';

export default function AdminLoading() {
  return (
    <main className={`wrap ${styles.adminPage} ${styles.loadingShell}`} aria-busy="true">
      <div className={styles.loadingBanner} aria-hidden="true">
        <div className={`${styles.loadingBlock} ${styles.loadingTitle}`} />
        <div className={styles.loadingActions}>
          <div className={`${styles.loadingBlock} ${styles.loadingAction}`} />
          <div className={`${styles.loadingBlock} ${styles.loadingAction}`} />
          <div className={`${styles.loadingBlock} ${styles.loadingAction}`} />
        </div>
      </div>
      <div className={styles.loadingKpis} aria-hidden="true">
        <div className={`${styles.loadingBlock} ${styles.loadingKpi}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingKpi}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingKpi}`} />
      </div>
      <div className={`${styles.loadingBlock} ${styles.loadingContent}`} role="status" aria-live="polite">
        Đang tải bảng điều hành...
      </div>
    </main>
  );
}
