import { SERIES_BY_KEY } from '../charts/series.js';
import styles from './ActivityFeed.module.scss';

/** Maps a stored event_type onto its series slot, so colour stays consistent. */
const SERIES_KEY_FOR_EVENT = {
  view: 'views',
  click: 'clicks',
  add_to_cart: 'conversions',
};

const EVENT_LABEL = {
  view: 'Viewed',
  click: 'Clicked',
  add_to_cart: 'Added to cart',
};

/** '3m ago' / '2h ago' — the feed is about recency, not exact wall-clock time. */
function relativeTime(timestamp) {
  // SQLite returns 'YYYY-MM-DD HH:MM:SS' with no zone; treating it as UTC
  // keeps the arithmetic consistent with how the server wrote it.
  const then = new Date(`${timestamp.replace(' ', 'T')}Z`);
  const seconds = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ActivityFeed({ events, isLoading, onSelectVideo }) {
  if (isLoading) {
    return (
      <ul className={styles.skeleton} aria-label="Loading activity">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className={styles.skeletonRow} />
        ))}
      </ul>
    );
  }

  if (!events?.length) {
    return <p className={styles.empty}>No events recorded yet. Try the Simulate traffic button.</p>;
  }

  return (
    <ol className={styles.feed}>
      {events.map((event) => {
        const seriesKey = SERIES_KEY_FOR_EVENT[event.eventType];
        const series = SERIES_BY_KEY[seriesKey];

        return (
          <li key={event.id} className={styles.item}>
            {/* The dot carries identity; the verb beside it says the same
                thing in words, so the feed is readable without colour. */}
            <span className={styles.dot} style={{ background: series?.color }} aria-hidden="true" />

            <span className={styles.body}>
              <span className={styles.action}>{EVENT_LABEL[event.eventType]}</span>{' '}
              <button
                type="button"
                className={styles.videoLink}
                onClick={() => onSelectVideo?.(event.videoId)}
              >
                {event.videoTitle}
              </button>
              <span className={styles.product}>{event.productName}</span>
            </span>

            <time className={styles.time} dateTime={event.timestamp}>
              {relativeTime(event.timestamp)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
