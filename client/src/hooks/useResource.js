import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fetches one resource and tracks its loading/error state.
 *
 * `fetcher` must be stable (wrap it in useCallback at the call site) — it is
 * the effect's dependency, so a new function identity on every render would
 * re-fetch in a loop.
 */
export function useResource(fetcher, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState(null);

  // Discards a response whose request has already been superseded, so a slow
  // earlier fetch cannot overwrite newer data.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetcher();
      if (requestIdRef.current === requestId) setData(response.data);
    } catch (err) {
      if (requestIdRef.current === requestId) setError(err);
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, [fetcher, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
