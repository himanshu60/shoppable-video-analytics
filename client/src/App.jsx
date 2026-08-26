import { useCallback, useState } from 'react';
import { fetchRecentEvents, fetchTimeseries } from './api/client.js';
import { useAnalytics } from './hooks/useAnalytics.js';
import { useResource } from './hooks/useResource.js';
import { useTheme } from './hooks/useTheme.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { Sidebar } from './components/Sidebar/Sidebar.jsx';
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle.jsx';
import { SimulateTrafficButton } from './components/SimulateTrafficButton/SimulateTrafficButton.jsx';
import { VideoDetail } from './components/VideoDetail/VideoDetail.jsx';
import { OverviewView } from './views/OverviewView.jsx';
import { VideosView } from './views/VideosView.jsx';
import { ActivityView } from './views/ActivityView.jsx';
import styles from './App.module.scss';

const VIEW_TITLES = {
  overview: 'Overview',
  videos: 'Videos',
  activity: 'Activity',
};

export default function App() {
  const [route, navigate] = useHashRoute();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('views');
  const [order, setOrder] = useState('desc');
  const [selectedVideoId, setSelectedVideoId] = useState(null);

  const { rows, meta, pagination, summary, isInitialLoading, isRefreshing, error, refresh } =
    useAnalytics({ page, limit, sortBy, order });

  // Stable fetchers: useResource takes these as effect dependencies, so a new
  // identity each render would re-fetch in a loop.
  const timeseriesFetcher = useCallback(() => fetchTimeseries(14), []);
  const recentFetcher = useCallback(() => fetchRecentEvents(30), []);

  const timeseries = useResource(timeseriesFetcher);
  const recentEvents = useResource(recentFetcher);

  /** Clicking the active column flips direction; a new column starts descending. */
  const handleSort = useCallback(
    (column) => {
      if (column === sortBy) {
        setOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(column);
        setOrder(column === 'title' ? 'asc' : 'desc');
      }
      // Row order changes, so the current offset is meaningless — go back to
      // the first page rather than showing an arbitrary slice.
      setPage(1);
    },
    [sortBy]
  );

  const handleLimitChange = useCallback((next) => {
    setLimit(next);
    setPage(1);
  }, []);

  /** Every write path refreshes all three data sources together. */
  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), timeseries.reload(), recentEvents.reload()]);
  }, [refresh, timeseries, recentEvents]);

  return (
    <div className={styles.shell}>
      <Sidebar route={route} onNavigate={navigate} />

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div>
            <h1 className={styles.title}>{VIEW_TITLES[route]}</h1>
            <p className={styles.subtitle}>
              Engagement and conversion performance for every product video on your storefront.
            </p>
          </div>

          <div className={styles.actions}>
            <ThemeToggle theme={theme} resolvedTheme={resolvedTheme} onChange={setTheme} />
            <SimulateTrafficButton onSimulated={refreshAll} />
          </div>
        </header>

        <main className={styles.content}>
          {error && (
            <div className={styles.error} role="alert">
              <strong>Could not load analytics.</strong> {error.message}
              <button type="button" className={styles.retry} onClick={refreshAll}>
                Retry
              </button>
            </div>
          )}

          {route === 'overview' && (
            <OverviewView
              summary={summary}
              timeseries={timeseries.data}
              topVideos={rows}
              isLoading={isInitialLoading}
              onSelectVideo={setSelectedVideoId}
            />
          )}

          {route === 'videos' && (
            <VideosView
              rows={rows}
              meta={meta}
              pagination={pagination}
              limit={limit}
              sortBy={sortBy}
              order={order}
              onSort={handleSort}
              onPageChange={setPage}
              onLimitChange={handleLimitChange}
              onSelectVideo={setSelectedVideoId}
              selectedId={selectedVideoId}
              isLoading={isInitialLoading}
              isRefreshing={isRefreshing}
            />
          )}

          {route === 'activity' && (
            <ActivityView
              events={recentEvents.data}
              isLoading={recentEvents.isLoading}
              onSelectVideo={setSelectedVideoId}
            />
          )}
        </main>
      </div>

      <VideoDetail videoId={selectedVideoId} onClose={() => setSelectedVideoId(null)} />
    </div>
  );
}
