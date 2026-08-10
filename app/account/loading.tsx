import styles from './account.module.css';

export default function AccountLoading() {
  return (
    <main className={`wrap ${styles.accountPage}`}>
      <div className={styles.accountStatus} role="status" aria-live="polite">
        Đang tải dữ liệu hội viên...
      </div>
    </main>
  );
}
