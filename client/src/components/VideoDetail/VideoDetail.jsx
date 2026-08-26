import { useCallback, useEffect } from 'react';
import { fetchVideoDetail } from '../../api/client.js';
import { useResource } from '../../hooks/useResource.js';
import { AreaChart } from '../charts/AreaChart.jsx';
import { SERIES } from '../charts/series.js';
import { conversionRate, formatCurrency, formatNumber, formatPercent } from '../../utils/format.js';
import styles from './VideoDetail.module.scss';

function EventPill({ type }) {
  const series = SERIES.find((s) => s.key === (type === 'add_to_cart' ? 'conversions' : `${type}s`));
  return (
    <span className={styles.pill}>
      <span className={styles.pillKey} style={{ background: series?.color }} aria-hidden="true" />
      {type.replace(/_/g, ' ')}
    </span>
  );
}

/**
 * Slide-over panel for one video.
 *
 * A panel rather than a separate route: the reader is comparing this video
 * against the table behind it, and a full page navigation would throw away
 * that context along with their scroll position and sort order.
 */
export function VideoDetail({ videoId, onClose }) {
  const fetcher = useCallback(() => fetchVideoDetail(videoId), [videoId]);
  const { data, isLoading, error } = useResource(fetcher, { enabled: Boolean(videoId) });

  // Escape closes the panel — expected of anything that overlays the page.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!videoId) return null;

  const rate = data ? conversionRate(data.conversions, data.views) : null;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />

      <aside className={styles.panel} role="dialog" aria-modal="true" aria-label="Video detail">
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Video detail</p>
            <h2 className={styles.title}>{data?.title ?? 'Loading…'}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close detail panel">
            ✕
          </button>
        </header>

        {error && (
          <p className={styles.error} role="alert">
            {error.message}
          </p>
        )}

        {isLoading && <p className={styles.loading}>Loading video metrics…</p>}

        {data && (
          <div className={styles.body}>
            <dl className={styles.meta}>
              <div>
                <dt>Product</dt>
                <dd>{data.productName}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{formatCurrency(data.productPrice)}</dd>
              </div>
              <div>
                <dt>Added</dt>
                <dd>{data.createdAt?.slice(0, 10)}</dd>
              </div>
            </dl>

            <ul className={styles.metrics}>
              {[
                { label: 'Views', value: data.views, key: 'views' },
                { label: 'Clicks', value: data.clicks, key: 'clicks' },
                { label: 'Add to carts', value: data.conversions, key: 'conversions' },
              ].map((metric) => (
                <li key={metric.key} className={styles.metric}>
                  <span className={styles.metricLabel}>
                    <span
                      className={styles.metricKey}
                      style={{ background: `var(--viz-${metric.key})` }}
                      aria-hidden="true"
                    />
                    {metric.label}
                  </span>
                  <span className={styles.metricValue}>{formatNumber(metric.value)}</span>
                </li>
              ))}
              <li className={styles.metric}>
                <span className={styles.metricLabel}>Conversion rate</span>
                <span className={styles.metricValue}>{formatPercent(rate)}</span>
              </li>
            </ul>

            <AreaChart
              data={data.timeseries}
              title="Engagement over time"
              subtitle="Last 14 days for this video"
            />

            <section className={styles.events}>
              <h3 className={styles.sectionTitle}>Latest events</h3>
              {data.recentEvents.length === 0 ? (
                <p className={styles.emptyEvents}>No events recorded for this video yet.</p>
              ) : (
                <ul className={styles.eventList}>
                  {data.recentEvents.map((event) => (
                    <li key={event.id} className={styles.event}>
                      <EventPill type={event.eventType} />
                      <time className={styles.eventTime}>{event.timestamp}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className={styles.url}>{data.videoUrl}</p>
          </div>
        )}
      </aside>
    </>
  );
}
