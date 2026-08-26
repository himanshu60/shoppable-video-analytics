import { ActivityFeed } from '../components/ActivityFeed/ActivityFeed.jsx';
import { ChartLegend } from '../components/charts/ChartLegend.jsx';
import { SERIES } from '../components/charts/series.js';
import styles from './Views.module.scss';

export function ActivityView({ events, isLoading, onSelectVideo }) {
  // Counts for the legend come from the feed itself, so the numbers always
  // describe exactly the events shown below rather than a wider window.
  const counts = {
    views: events?.filter((e) => e.eventType === 'view').length ?? 0,
    clicks: events?.filter((e) => e.eventType === 'click').length ?? 0,
    conversions: events?.filter((e) => e.eventType === 'add_to_cart').length ?? 0,
  };

  return (
    <div className={styles.stack}>
      <header className={styles.viewHeader}>
        <div>
          <h2 className={styles.viewTitle}>Live activity</h2>
          <p className={styles.viewSubtitle}>
            The {events?.length ?? 0} most recent engagement events, newest first. Use Simulate
            traffic to add more.
          </p>
        </div>
        <ChartLegend series={SERIES} values={counts} />
      </header>

      <ActivityFeed events={events} isLoading={isLoading} onSelectVideo={onSelectVideo} />
    </div>
  );
}
