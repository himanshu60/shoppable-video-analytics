import styles from './Pagination.module.scss';

/**
 * Page controls for the analytics table.
 *
 * Reads its state entirely from the server's pagination metadata rather than
 * recomputing totals on the client, so the two can never disagree.
 */
export function Pagination({ pagination, limit, onPageChange, onLimitChange, disabled }) {
  if (!pagination) return null;

  const { page, total, totalPages, hasNextPage, hasPreviousPage } = pagination;

  const firstRow = total === 0 ? 0 : (page - 1) * pagination.limit + 1;
  const lastRow = Math.min(page * pagination.limit, total);

  return (
    <nav className={styles.bar} aria-label="Table pagination">
      <p className={styles.summary}>
        Showing <strong>{firstRow}</strong>–<strong>{lastRow}</strong> of <strong>{total}</strong>{' '}
        videos
      </p>

      <div className={styles.controls}>
        <label className={styles.perPage}>
          <span>Rows</span>
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            disabled={disabled}
          >
            {[5, 10, 25, 50].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.pager}>
          <button
            type="button"
            className={styles.button}
            onClick={() => onPageChange(page - 1)}
            disabled={!hasPreviousPage || disabled}
          >
            ← Previous
          </button>

          {/* aria-live so a screen reader announces the new page after the
              button press, which otherwise gives no audible feedback. */}
          <span className={styles.position} aria-live="polite">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            className={styles.button}
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNextPage || disabled}
          >
            Next →
          </button>
        </div>
      </div>
    </nav>
  );
}
