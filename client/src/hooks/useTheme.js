import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'svd-theme';
export const THEMES = ['system', 'light', 'dark'];

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    // Private browsing and some hardened settings make localStorage throw on
    // access rather than returning null, so reads must be guarded.
    return 'system';
  }
}

/**
 * Theme preference: 'system', 'light' or 'dark'.
 *
 * The choice is written to the <html> element as data-theme, which the CSS in
 * global.scss keys off. 'system' removes the attribute entirely so the
 * prefers-color-scheme media query takes over again.
 */
export function useTheme() {
  const [theme, setTheme] = useState(readStoredTheme);
  // Tracks what 'system' currently resolves to, so the toggle can show which
  // mode is actually active.
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  );

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Preference simply will not persist; the app still works.
    }
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;

    const onChange = (event) => setSystemPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  /** Cycles system -> light -> dark -> system. */
  const cycleTheme = useCallback(() => {
    setTheme((current) => THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
  }, []);

  return { theme, resolvedTheme, setTheme, cycleTheme };
}
