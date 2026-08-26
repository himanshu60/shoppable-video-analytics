import { Funnel } from '../components/charts/Funnel.jsx';
import { AreaChart } from '../components/charts/AreaChart.jsx';
import { StatCard } from '../components/StatCard/StatCard.jsx';
import { conversionRate, formatNumber, formatPercent } from '../utils/format.js';
import styles from './Views.module.scss';

/**
 * Percent change between the two halves of the series.
 *
 * Returns null rather than 0 when the earlier half is empty: there is no
 * meaningful percentage change from zero, and rendering "+100%" for the first
 * event a video ever receives would overstate it.
 */
function periodDelta(series, key) {
  if (!series || series.length < 5) return null;

  // The final day is still in progress. Including it would compare a partial
  // day against complete ones and report a fake decline every morning.
  const complete = series.slice(0, -1);
  const half = Math.floor(complete.length / 2);

  const earlier = complete.slice(0, half).reduce((sum, row) => sum + row[key], 0);
  const later = complete.slice(half).reduce((sum, row) => sum + row[key], 0);

  // No meaningful percentage change from zero: "+100%" for the first event a
  // video ever receives would overstate it.
  if (earlier === 0) return null;
  return ((later - earlier) / earlier) * 100;
}

export function OverviewView({ summary, timeseries, topVideos, isLoading, onSelectVideo }) {
  const overallRate = summary ? conversionRate(summary.totalConversions, summary.totalViews) : null;
  // Sparklines show completed days only, for the same reason the delta does:
  // a partial final day draws a cliff that is an artefact of the clock.
  const trend = (key) => timeseries?.slice(0, -1).map((row) => row[key]);

  const completeDays = timeseries ? timeseries.length - 1 : 0;
  const half = Math.floor(completeDays / 2);

  return (
    <div className={styles.stack}>
      <section aria-label="Headline metrics" className={styles.stats}>
        <StatCard
          label="Total views"
          value={formatNumber(summary?.totalViews)}
          tone="views"
          trend={trend('views')}
          delta={periodDelta(timeseries, 'views')}
          hint={half ? `vs previous ${half} days` : null}
          isLoading={isLoading}
        />
        <StatCard
          label="Total clicks"
          value={formatNumber(summary?.totalClicks)}
          tone="clicks"
          trend={trend('clicks')}
          delta={periodDelta(timeseries, 'clicks')}
          hint={half ? `vs previous ${half} days` : null}
          isLoading={isLoading}
        />
        <StatCard
          label="Add to carts"
          value={formatNumber(summary?.totalConversions)}
          tone="conversions"
          trend={trend('conversions')}
          delta={periodDelta(timeseries, 'conversions')}
          hint={half ? `vs previous ${half} days` : null}
          isLoading={isLoading}
        />
        <StatCard
          label="Overall conversion"
          value={formatPercent(overallRate)}
          tone="accent"
          hint={summary ? `${summary.totalVideos} videos · ${summary.totalProducts} products` : null}
          isLoading={isLoading}
        />
      </section>

      <Funnel summary={summary} />

      {timeseries && (
        <AreaChart
          data={timeseries}
          title="Engagement over time"
          subtitle={`Daily events across all videos, last ${timeseries.length} days`}
        />
      )}

      <section className={styles.panel} aria-label="Top performing videos">
        <header className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Top videos by views</h3>
          <p className={styles.panelHint}>Select one to open its detail panel</p>
        </header>

        <ol className={styles.ranking}>
          {(topVideos ?? []).slice(0, 5).map((video, index) => {
            const rate = conversionRate(video.conversions, video.views);
            const max = topVideos[0]?.views || 1;

            return (
              <li key={video.id} className={styles.rankItem}>
                <span className={styles.rank}>{index + 1}</span>

                <button
                  type="button"
                  className={styles.rankBody}
                  onClick={() => onSelectVideo(video.id)}
                >
                  <span className={styles.rankTitle}>{video.title}</span>
                  <span className={styles.rankTrack} aria-hidden="true">
                    <span
                      className={styles.rankBar}
                      style={{ width: `${Math.max((video.views / max) * 100, 2)}%` }}
                    />
                  </span>
                </button>

                <span className={styles.rankMetrics}>
                  <span className={styles.rankViews}>{formatNumber(video.views)}</span>
                  <span className={styles.rankRate}>{formatPercent(rate)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
