import { getDb } from '../db/index.js';

/** Columns a client is allowed to sort by, mapped to safe SQL fragments. */
const SORTABLE = {
  views: 'views',
  clicks: 'clicks',
  conversions: 'conversions',
  title: 'v.title',
  createdAt: 'v.created_at',
};

/**
 * Aggregated metrics for one page of videos.
 *
 * A single LEFT JOIN with conditional COUNTs walks the event index once.
 * The obvious alternatives are both worse:
 *   * three correlated subqueries -> three passes over engagement_events;
 *   * joining products AND events without GROUP BY -> one row per event,
 *     i.e. the classic fan-out that inflates every metric.
 *
 * COUNT(CASE WHEN ... THEN 1 END) is used rather than SUM(CASE ... ELSE 0)
 * because COUNT ignores NULL, so a video with no events yields 0, not NULL.
 */
export function getVideoAnalytics({ page = 1, limit = 10, sortBy = 'views', order = 'desc' } = {}) {
  const db = getDb();

  const sortColumn = SORTABLE[sortBy] ?? SORTABLE.views;
  const sortDirection = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = db
    .prepare(
      `SELECT
         v.id                                                      AS id,
         v.title                                                   AS title,
         v.video_url                                               AS videoUrl,
         v.created_at                                              AS createdAt,
         p.id                                                      AS productId,
         p.name                                                    AS productName,
         p.price                                                   AS productPrice,
         COUNT(CASE WHEN e.event_type = 'view'        THEN 1 END)  AS views,
         COUNT(CASE WHEN e.event_type = 'click'       THEN 1 END)  AS clicks,
         COUNT(CASE WHEN e.event_type = 'add_to_cart' THEN 1 END)  AS conversions
       FROM videos v
       INNER JOIN products p          ON p.id = v.product_id
       LEFT  JOIN engagement_events e ON e.video_id = v.id
       GROUP BY v.id
       ORDER BY ${sortColumn} ${sortDirection}, v.id ASC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  // Counted separately: adding COUNT(*) OVER () to the query above would make
  // SQLite materialise every group before the LIMIT could take effect.
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM videos').get();

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: offset + rows.length < total,
      hasPreviousPage: page > 1,
    },
  };
}

/** Site-wide totals, so the dashboard header does not have to sum a page. */
export function getSummary() {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM videos)   AS totalVideos,
         (SELECT COUNT(*) FROM products) AS totalProducts,
         COUNT(CASE WHEN event_type = 'view'        THEN 1 END) AS totalViews,
         COUNT(CASE WHEN event_type = 'click'       THEN 1 END) AS totalClicks,
         COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) AS totalConversions
       FROM engagement_events`
    )
    .get();
}

/** Minimal video list; the frontend uses it to pick a random target. */
export function listVideos() {
  return getDb().prepare('SELECT id, title FROM videos ORDER BY id').all();
}
