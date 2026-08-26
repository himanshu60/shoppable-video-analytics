import { Sparkline } from '../charts/Sparkline.jsx';
import styles from './StatCard.module.scss';

/**
 * A single headline metric: label, value, optional delta and trend.
 *
 * `tone` tints the rail and the sparkline so a card is tied to its series
 * colour — views are blue everywhere in the app, not blue here and green in
 * the chart.
 */
export function StatCard({
  label,
  value,
  hint,
  delta,
  trend,
  tone = 'accent',
  isLoading = false,
}) {
  const deltaDirection = delta == null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return (
    <article className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.head}>
        <h3 className={styles.label}>{label}</h3>
        {trend && !isLoading && (
          <Sparkline
            values={trend}
            color={`var(--viz-${tone})`}
            label={`${label} trend over the last ${trend.length} days`}
          />
        )}
      </div>

      <p className={styles.value} aria-busy={isLoading}>
        {isLoading ? <span className={styles.placeholder} aria-hidden="true" /> : value}
      </p>

      <p className={styles.foot}>
        {deltaDirection && (
          <span className={`${styles.delta} ${styles[deltaDirection]}`}>
            {/* The arrow carries direction as well as the colour, so the
                signal survives colour-blindness and greyscale printing. */}
            <span aria-hidden="true">{deltaDirection === 'up' ? '▲' : deltaDirection === 'down' ? '▼' : '—'}</span>
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className={styles.hint}>{hint}</span>}
      </p>
    </article>
  );
}
