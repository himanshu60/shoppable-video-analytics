import { useEffect, useRef, useState } from 'react';

/**
 * Tracks an element's rendered width.
 *
 * Charts are drawn in real pixels rather than scaled from a fixed viewBox:
 * a scaled viewBox stretches stroke widths and label text along with the
 * geometry, so a 2px line stops being 2px and the type goes soft.
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    // ResizeObserver rather than a window resize listener: the container also
    // changes width when the sidebar collapses, which fires no window event.
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
