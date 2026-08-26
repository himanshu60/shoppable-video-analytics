import { SERIES } from './series.js';
import { formatNumber, formatPercent } from '../../utils/format.js';
import styles from './Funnel.module.scss';

/**
 * The view → click → add-to-cart funnel.
 *
 * Bars are drawn proportional to the top of the funnel, so the drop-off is
 * the shape itself rather than something the reader has to compute. Each
 * stage carries its absolute count and the step-to-step conversion, which is
 * the number a merchant actually acts on — a stage that halves is where the
 * storefront is losing people.
 */
export function Funnel({ summary }) {
  if (!summary) return null;

  const stages = [
    { ...SERIES[0], value: summary.totalViews },
    { ...SERIES[1], value: summary.totalClicks },
    { ...SERIES[2], value: summary.totalConversions },
  ];

  const top = stages[0].value || 1;

  return (
    <section className={styles.funnel} aria-label="Engagement funnel">
      <ol className={styles.stages}>
        {stages.map((stage, index) => {
          const previous = index === 0 ? null : stages[index - 1].value;
          // Guarded: a stage below an empty one would divide by zero.
          const stepRate = previous ? stage.value / previous : null;

          return (
            <li key={stage.key} className={styles.stage}>
              <p className={styles.label}>{stage.label}</p>
              <p className={styles.value}>{formatNumber(stage.value)}</p>

              <div className={styles.track}>
                <div
                  className={styles.bar}
                  style={{
                    // Floored so a non-zero stage is never invisible.
                    width: `${Math.max((stage.value / top) * 100, 1.5)}%`,
                    background: stage.color,
                  }}
                />
              </div>

              <p className={styles.step}>
                {stepRate === null ? 'entered the funnel' : `${formatPercent(stepRate)} of ${stages[index - 1].label.toLowerCase()}`}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
