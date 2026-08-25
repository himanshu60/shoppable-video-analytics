import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSummary, fetchVideoAnalytics } from '../api/client.js';

/**
 * Owns all dashboard data fetching: the current page of video metrics, the
 * site-wide summary, and the loading/error state around them.
 *
 * Kept as a hook so App stays a layout component and the fetching logic is
 * testable and reusable on its own.
 */
export function useAnalytics({ page, limit, sortBy, order }) {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  // Distinguishes the very first load (show skeleton) from a background
  // refresh after simulating traffic (keep the table, dim it slightly).
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Guards against a slow earlier request resolving after a newer one and
  // overwriting fresh data with stale rows.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async ({ background = false } = {}) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      if (background) setIsRefreshing(true);
      setError(null);

      try {
        const [analytics, summaryResponse] = await Promise.all([
          fetchVideoAnalytics({ page, limit, sortBy, order }),
          fetchSummary(),
        ]);

        if (requestIdRef.current !== requestId) return; // superseded

        setRows(analytics.data);
        setPagination(analytics.pagination);
        setSummary(summaryResponse.data);
      } catch (err) {
        if (requestIdRef.current !== requestId) return;
        setError(err);
      } finally {
        if (requestIdRef.current === requestId) {
          setIsInitialLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [page, limit, sortBy, order]
  );

  useEffect(() => {
    load();
  }, [load]);

  /** Re-fetch without clearing the table, e.g. after simulating traffic. */
  const refresh = useCallback(() => load({ background: true }), [load]);

  return { rows, pagination, summary, isInitialLoading, isRefreshing, error, refresh };
}
