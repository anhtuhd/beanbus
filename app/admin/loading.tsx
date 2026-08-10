import styles from './admin.module.css';

export default function AdminLoading() {
  return (
    <main className={`wrap ${styles.adminPage}`}>
      <div className={styles.dashboardNotice} role="status" aria-live="polite">
        Đang tải bảng điều hành...
      </div>
    </main>
  );
}
