import styles from './StatCard.module.scss';

/**
 * A single headline metric. `tone` tints the accent bar so the funnel stages
 * (views -> clicks -> conversions) are distinguishable at a glance.
 */
export function StatCard({ label, value, hint, tone = 'neutral', isLoading = false }) {
  return (
    <article className={`${styles.card} ${styles[tone]}`}>
      <h3 className={styles.label}>{label}</h3>
      <p className={styles.value} aria-busy={isLoading}>
        {isLoading ? <span className={styles.placeholder} aria-hidden="true" /> : value}
      </p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </article>
  );
}
