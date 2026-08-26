import { useCallback, useEffect, useState } from 'react';

const DEFAULT_ROUTE = 'overview';
const ROUTES = ['overview', 'videos', 'activity'];

function readHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.includes(raw) ? raw : DEFAULT_ROUTE;
}

/**
 * Minimal hash router.
 *
 * Hash routing rather than the History API because this deploys as a static
 * bundle behind one Express process — with real paths, a hard refresh on
 * /videos would need a server-side rewrite for every view. It also keeps the
 * app dependency-free: react-router would be ~10kB for three routes.
 *
 * The trade-off is uglier URLs (#/videos), which is the right price for
 * deep-links that survive a refresh anywhere.
 */
export function useHashRoute() {
  const [route, setRoute] = useState(readHash);

  useEffect(() => {
    const onHashChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next) => {
    window.location.hash = `/${next}`;
  }, []);

  return [route, navigate];
}
