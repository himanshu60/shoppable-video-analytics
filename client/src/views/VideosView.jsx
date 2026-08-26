import { VideoTable } from '../components/VideoTable/VideoTable.jsx';
import { Pagination } from '../components/Pagination/Pagination.jsx';
import styles from './Views.module.scss';

export function VideosView({
  rows,
  meta,
  pagination,
  limit,
  sortBy,
  order,
  onSort,
  onPageChange,
  onLimitChange,
  onSelectVideo,
  selectedId,
  isLoading,
  isRefreshing,
}) {
  return (
    <div className={styles.stack}>
      <header className={styles.viewHeader}>
        <div>
          <h2 className={styles.viewTitle}>All videos</h2>
          <p className={styles.viewSubtitle}>
            Conversion rate is calculated in the browser as add-to-carts ÷ views. A video with no
            views shows — rather than 0%.
          </p>
        </div>
      </header>

      <VideoTable
        rows={rows}
        maxViews={meta?.maxViews}
        sortBy={sortBy}
        order={order}
        onSort={onSort}
        onSelect={onSelectVideo}
        selectedId={selectedId}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
      />

      <Pagination
        pagination={pagination}
        limit={limit}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
        disabled={isRefreshing}
      />
    </div>
  );
}
