import { useState } from 'react';
import { conversionRate, formatCurrency, formatNumber, formatPercent, rateTone } from '../../utils/format.js';
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
 * Rendered as a real <table> with <caption>, <th scope> and aria-sort so it
 * is navigable by screen reader — a div grid would lose all of that.
 *
 * Scrolling happens inside the card (see the .scroll rules), not on the page,
 * which is what lets the header stay pinned while rows move under it.
 */
export function VideoTable({ rows, sortBy, order, onSort, isLoading, isRefreshing }) {
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

  return (
    <div className={styles.wrapper}>
      {/* tabIndex makes the scroll area reachable by keyboard, which a plain
          overflow container is not. */}
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
            views.
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

              return (
                <tr key={row.id}>
                  <th scope="row" className={styles.left}>
                    <span className={styles.videoTitle}>{row.title}</span>
                    <span className={styles.videoUrl}>{row.videoUrl}</span>
                  </th>
                  <td className={styles.left}>
                    <span className={styles.productName}>{row.productName}</span>
                    <span className={styles.productPrice}>{formatCurrency(row.productPrice)}</span>
                  </td>
                  <td className={styles.right}>{formatNumber(row.views)}</td>
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
