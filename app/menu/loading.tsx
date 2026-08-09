import styles from './page.module.css';

export default function MenuLoading() {
  return (
    <div className={styles.menuPage} aria-busy="true">
      <div className={styles.pageHeader} />
      <div className={`wrap ${styles.loadingGrid}`}>
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.loadingCard} />
        ))}
      </div>
    </div>
  );
}
