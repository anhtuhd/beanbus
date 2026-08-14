import styles from './account.module.css';

export default function AccountLoading() {
  return (
    <main className={`wrap ${styles.accountPage} ${styles.loadingShell}`} aria-busy="true">
      <div className={styles.loadingBanner} aria-hidden="true">
        <div className={`${styles.loadingBlock} ${styles.loadingAvatar}`} />
        <div className={styles.loadingIdentity}>
          <div className={`${styles.loadingBlock} ${styles.loadingName}`} />
          <div className={`${styles.loadingBlock} ${styles.loadingMeta}`} />
        </div>
        <div className={`${styles.loadingBlock} ${styles.loadingPoints}`} />
      </div>
      <div className={styles.loadingTabs} aria-hidden="true">
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
        <div className={`${styles.loadingBlock} ${styles.loadingTab}`} />
      </div>
      <div className={`${styles.loadingBlock} ${styles.loadingContent}`} role="status" aria-live="polite">
        Đang tải dữ liệu hội viên...
      </div>
    </main>
  );
}
