import { useCallback, useState } from 'react';
import { useAnalytics } from './hooks/useAnalytics.js';
import { useTheme } from './hooks/useTheme.js';
import { StatCard } from './components/StatCard/StatCard.jsx';
import { VideoTable } from './components/VideoTable/VideoTable.jsx';
import { Pagination } from './components/Pagination/Pagination.jsx';
import { SimulateTrafficButton } from './components/SimulateTrafficButton/SimulateTrafficButton.jsx';
import { ThemeToggle } from './components/ThemeToggle/ThemeToggle.jsx';
import { conversionRate, formatNumber, formatPercent } from './utils/format.js';
import styles from './App.module.scss';

export default function App() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('views');
  const [order, setOrder] = useState('desc');
  const { theme, resolvedTheme, setTheme } = useTheme();

  const { rows, pagination, summary, isInitialLoading, isRefreshing, error, refresh } = useAnalytics(
    { page, limit, sortBy, order }
  );

  /** Clicking the active column flips direction; a new column starts descending. */
  const handleSort = useCallback(
    (column) => {
      if (column === sortBy) {
        setOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(column);
        setOrder(column === 'title' ? 'asc' : 'desc');
      }
      // Row order changes, so the current offset is meaningless - go back to
      // the first page rather than showing an arbitrary slice.
      setPage(1);
    },
    [sortBy]
  );

  const handleLimitChange = useCallback((next) => {
    setLimit(next);
    setPage(1);
  }, []);

  const overallRate = summary ? conversionRate(summary.totalConversions, summary.totalViews) : null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Videoselz</p>
          <h1 className={styles.title}>Shoppable Video Analytics</h1>
          <p className={styles.subtitle}>
            Engagement and conversion performance for every product video on your storefront.
          </p>
        </div>

        <div className={styles.headerActions}>
          <ThemeToggle theme={theme} resolvedTheme={resolvedTheme} onChange={setTheme} />
          <SimulateTrafficButton onSimulated={refresh} />
        </div>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          <strong>Could not load analytics.</strong> {error.message}
          <button type="button" className={styles.retry} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      <section className={styles.stats} aria-label="Overall performance">
        <StatCard
          label="Total views"
          value={formatNumber(summary?.totalViews)}
          tone="views"
          isLoading={isInitialLoading}
        />
        <StatCard
          label="Total clicks"
          value={formatNumber(summary?.totalClicks)}
          tone="clicks"
          isLoading={isInitialLoading}
        />
        <StatCard
          label="Add to carts"
          value={formatNumber(summary?.totalConversions)}
          tone="conversions"
          isLoading={isInitialLoading}
        />
        <StatCard
          label="Overall conversion"
          value={formatPercent(overallRate)}
          hint={summary ? `${summary.totalVideos} videos · ${summary.totalProducts} products` : null}
          tone="accent"
          isLoading={isInitialLoading}
        />
      </section>

      <main>
        <VideoTable
          rows={rows}
          sortBy={sortBy}
          order={order}
          onSort={handleSort}
          isLoading={isInitialLoading}
          isRefreshing={isRefreshing}
        />

        <Pagination
          pagination={pagination}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={handleLimitChange}
          disabled={isRefreshing}
        />
      </main>

      <footer className={styles.footer}>
        <p>
          Conversion rate is calculated in the browser as add-to-carts ÷ views. Videos with no
          recorded views show — rather than 0%.
        </p>
      </footer>
    </div>
  );
}
