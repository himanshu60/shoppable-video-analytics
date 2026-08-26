import { useState } from 'react';
import {
  conversionRate,
  formatCurrency,
  formatNumber,
  formatPercent,
  rateTone,
} from '../../utils/format.js';
import styles from './VideoTable.module.scss';

const COLUMNS = [
  { key: 'title', label: 'Video', sortable: true, align: 'left' },
  { key: 'product', label: 'Product', sortable: false, align: 'left' },
  { key: 'views', label: 'Views', sortable: true, align: 'right' },
  { key: 'clicks', label: 'Clicks', sortable: true, align: 'right' },
  { key: 'conversions', label: 'Conversions', sortable: true, align: 'right' },
  { key: 'rate', label: 'Conversion Rate', sortable: false, align: 'right' },
];

function SortIndicator({ active, order }) {
  if (!active) return <span className={styles.sortIcon} aria-hidden="true" />;
  return (
    <span className={styles.sortIconActive} aria-hidden="true">
      {order === 'asc' ? '▲' : '▼'}
    </span>
  );
}

/**
 * The dashboard's data table.
 *
 * A real <table> with <caption>, <th scope> and aria-sort, so it is navigable
 * by screen reader — and it doubles as the table view that the light-mode
 * charts owe under the relief rule, since the aqua series sits below 3:1
 * contrast on white.
 *
 * Scrolling is contained here (see .scroll) rather than on the page, which is
 * what lets the header stay pinned while rows move under it.
 */
export function VideoTable({
  rows,
  maxViews,
  sortBy,
  order,
  onSort,
  onSelect,
  selectedId,
  isLoading,
  isRefreshing,
}) {
  const [hasScrolled, setHasScrolled] = useState(false);

  if (isLoading) {
    return (
      <div className={styles.wrapper}>
        <ul className={styles.skeleton} aria-label="Loading video metrics">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className={styles.skeletonRow} />
          ))}
        </ul>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>No videos yet</p>
        <p className={styles.emptyBody}>
          Seed the database with <code>npm run db:seed</code>, then reload this page.
        </p>
      </div>
    );
  }

  const scale = maxViews || 1;

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.scroll}
        tabIndex="0"
        role="region"
        aria-label="Video metrics table"
        onScroll={(event) => setHasScrolled(event.currentTarget.scrollTop > 0)}
      >
        <table
          className={[styles.table, isRefreshing && styles.dimmed, hasScrolled && styles.scrolled]
            .filter(Boolean)
            .join(' ')}
        >
          <caption className={styles.caption}>
            Engagement metrics per shoppable video. Conversion rate is add-to-carts divided by
            views. Select a row to open its detail panel.
          </caption>

          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const isActive = sortBy === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={styles[column.align]}
                    aria-sort={isActive ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => onSort(column.key)}
                      >
                        {column.label}
                        <SortIndicator active={isActive} order={order} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const rate = conversionRate(row.conversions, row.views);
              const tone = rateTone(rate);
              const isSelected = row.id === selectedId;

              return (
                <tr
                  key={row.id}
                  className={`${styles.row} ${isSelected ? styles.selected : ''}`}
                  onClick={() => onSelect?.(row.id)}
                >
                  <th scope="row" className={styles.left}>
                    {/* The button is the accessible affordance; the row click
                        is a convenience on top of it, not the only way in. */}
                    <button
                      type="button"
                      className={styles.videoTitle}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect?.(row.id);
                      }}
                    >
                      {row.title}
                    </button>
                    <span className={styles.videoUrl}>{row.videoUrl}</span>
                  </th>

                  <td className={styles.left}>
                    <span className={styles.productName}>{row.productName}</span>
                    <span className={styles.productPrice}>{formatCurrency(row.productPrice)}</span>
                  </td>

                  <td className={styles.right}>
                    <span className={styles.metric}>{formatNumber(row.views)}</span>
                    {/* Every bar on the page shares one scale (the page's
                        highest view count), so bar lengths are comparable
                        down the column. */}
                    <span className={styles.barTrack} aria-hidden="true">
                      <span
                        className={styles.bar}
                        style={{ width: `${Math.max((row.views / scale) * 100, row.views ? 2 : 0)}%` }}
                      />
                    </span>
                  </td>

                  <td className={styles.right}>{formatNumber(row.clicks)}</td>
                  <td className={styles.right}>{formatNumber(row.conversions)}</td>

                  <td className={styles.right}>
                    <span className={`${styles.rate} ${styles[tone]}`}>
                      {formatPercent(rate)}
                      {rate === null && <span className={styles.srOnly}> no views recorded</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
