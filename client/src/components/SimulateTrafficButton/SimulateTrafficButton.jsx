import { useState } from 'react';
import { fetchVideos, postEvent } from '../../api/client.js';
import styles from './SimulateTrafficButton.module.scss';

/**
 * Weighted funnel, matching the seed script.
 *
 * A uniform draw across the three types would produce a ~33% conversion rate
 * and make the dashboard meaningless. Real shoppable-video traffic is mostly
 * passive views, so views dominate.
 */
const EVENT_WEIGHTS = [
  { type: 'view', weight: 0.7 },
  { type: 'click', weight: 0.2 },
  { type: 'add_to_cart', weight: 0.1 },
];

function pickEventType() {
  const roll = Math.random();
  let cumulative = 0;
  for (const { type, weight } of EVENT_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return type;
  }
  return EVENT_WEIGHTS[0].type;
}

const BURST_SIZE = 25;

/**
 * Fires randomised engagement events at POST /api/events, then asks the
 * dashboard to refresh.
 *
 * The video list is fetched once and cached in state: the target must be a
 * real video id, and re-fetching the list on every click would be wasteful.
 */
export function SimulateTrafficButton({ onSimulated }) {
  const [videos, setVideos] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState(null);

  async function getVideos() {
    if (videos) return videos;
    const response = await fetchVideos();
    setVideos(response.data);
    return response.data;
  }

  async function simulate(count) {
    setIsSending(true);
    setStatus(null);

    try {
      const list = await getVideos();

      if (!list.length) {
        setStatus({ tone: 'error', message: 'No videos to simulate against. Seed the database first.' });
        return;
      }

      const payloads = Array.from({ length: count }, () => ({
        videoId: list[Math.floor(Math.random() * list.length)].id,
        eventType: pickEventType(),
      }));

      // Sent in parallel: these are independent inserts and SQLite serialises
      // the writes anyway, so awaiting each one in turn would only add latency.
      await Promise.all(payloads.map(postEvent));

      const last = payloads.at(-1);
      const target = list.find((video) => video.id === last.videoId);

      setStatus({
        tone: 'success',
        message:
          count === 1
            ? `Sent "${last.eventType}" for ${target.title}`
            : `Sent ${count} random events across ${new Set(payloads.map((p) => p.videoId)).size} videos`,
      });

      // Refresh only after every write has landed, so the table cannot show
      // a partially-applied burst.
      await onSimulated();
    } catch (error) {
      setStatus({ tone: 'error', message: error.message });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => simulate(1)}
          disabled={isSending}
        >
          {isSending ? 'Sending…' : 'Simulate traffic'}
        </button>

        <button
          type="button"
          className={styles.secondary}
          onClick={() => simulate(BURST_SIZE)}
          disabled={isSending}
          title={`Fire ${BURST_SIZE} random events at once`}
        >
          Burst ×{BURST_SIZE}
        </button>
      </div>

      {/* role="status" announces the result to screen readers without
          stealing focus from the button. */}
      <p className={`${styles.status} ${status ? styles[status.tone] : ''}`} role="status">
        {status?.message ?? 'Fires a random engagement event at POST /api/events.'}
      </p>
    </div>
  );
}
