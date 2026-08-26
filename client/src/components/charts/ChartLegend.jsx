import styles from './ChartLegend.module.scss';

/**
 * Legend for a multi-series chart.
 *
 * Always rendered when there are two or more series: colour alone is never
 * the only identity channel. Each row keys its series with a short stroke in
 * the series colour — the text itself stays in a text token, because a light
 * categorical hue (the aqua slot) is illegible as text on the light surface.
 */
export function ChartLegend({ series, values }) {
  return (
    <ul className={styles.legend}>
      {series.map((item) => (
        <li key={item.key} className={styles.item}>
          <span className={styles.key} style={{ background: item.color }} aria-hidden="true" />
          <span className={styles.label}>{item.label}</span>
          {values?.[item.key] !== undefined && (
            <span className={styles.value}>{values[item.key].toLocaleString()}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
