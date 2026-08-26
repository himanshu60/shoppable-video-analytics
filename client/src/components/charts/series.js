/**
 * The three funnel stages, in fixed order.
 *
 * Categorical hues are assigned by slot and never cycled: `views` is always
 * blue, `clicks` always orange, `conversions` always aqua — in every chart,
 * legend, stat card and table. Colour follows the entity, never its rank, so
 * filtering or re-sorting can never repaint a series.
 *
 * The hexes live in CSS custom properties (see styles/_tokens.scss) so light
 * and dark each get their own validated step.
 */
export const SERIES = [
  { key: 'views', label: 'Views', color: 'var(--viz-views)' },
  { key: 'clicks', label: 'Clicks', color: 'var(--viz-clicks)' },
  { key: 'conversions', label: 'Add to cart', color: 'var(--viz-conversions)' },
];

export const SERIES_BY_KEY = Object.fromEntries(SERIES.map((s) => [s.key, s]));
