/**
 * Conversion rate = add-to-carts / views.
 *
 * Returns `null` rather than 0 when there are no views. The two cases are
 * genuinely different — "nobody converted" vs "nobody watched" — and showing
 * 0.0% for a video with no traffic would misrepresent it as underperforming.
 * The UI renders null as an em dash.
 *
 * The assignment specifies this is calculated on the frontend, so the API
 * returns raw counts and this is the only place the ratio is derived.
 */
export function conversionRate(conversions, views) {
  if (!views) return null;
  return conversions / views;
}

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return percentFormatter.format(ratio);
}

const numberFormatter = new Intl.NumberFormat();

/** Thousands separators, using the viewer's locale. */
export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(value);
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
});

export function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return currencyFormatter.format(value);
}

/**
 * Buckets a conversion rate for colour-coding.
 *
 * Thresholds are illustrative benchmarks for shoppable video, not a hard
 * rule; they exist so the table communicates at a glance instead of making
 * the reader compare twelve percentages by eye.
 */
export function rateTone(ratio) {
  if (ratio === null || ratio === undefined) return 'neutral';
  if (ratio >= 0.15) return 'strong';
  if (ratio >= 0.08) return 'steady';
  return 'weak';
}
