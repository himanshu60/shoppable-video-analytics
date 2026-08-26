import { getDb } from '../db/index.js';

/** Columns a client is allowed to sort by, mapped to safe SQL fragments. */
const SORTABLE = {
  views: 'views',
  clicks: 'clicks',
  conversions: 'conversions',
  title: 'v.title',
  createdAt: 'v.created_at',
};

/** The conditional counts every per-video query needs, written once. */
const METRIC_COLUMNS = `
  COUNT(CASE WHEN e.event_type = 'view'        THEN 1 END) AS views,
  COUNT(CASE WHEN e.event_type = 'click'       THEN 1 END) AS clicks,
  COUNT(CASE WHEN e.event_type = 'add_to_cart' THEN 1 END) AS conversions`;

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
         v.id         AS id,
         v.title      AS title,
         v.video_url  AS videoUrl,
         v.created_at AS createdAt,
         p.id         AS productId,
         p.name       AS productName,
         p.price      AS productPrice,
         ${METRIC_COLUMNS}
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

  // The table draws a proportional bar per row, which needs a shared scale -
  // computed here so every row on the page is measured against the same max.
  const maxViews = rows.reduce((max, row) => Math.max(max, row.views), 0);

  return {
    data: rows,
    meta: { maxViews },
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

/** 'YYYY-MM-DD' for a Date, in local time (SQLite stores local-style strings). */
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Builds the full list of dates in the window, oldest first.
 *
 * Days with no events must still appear, otherwise a quiet day would be
 * skipped and the chart's x-axis would compress time - a gap would read as
 * "no time passed" rather than "no activity".
 */
function dateRange(days) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    return toIsoDate(date);
  });
}

/**
 * Daily event counts over the last `days` days, for the time-series chart.
 *
 * Filters on `timestamp >= ?` rather than `date(timestamp) >= ?` so the
 * comparison stays sargable and idx_events_timestamp can be used; wrapping the
 * column in a function would force a full scan.
 */
export function getTimeseries({ days = 14, videoId = null } = {}) {
  const db = getDb();
  const dates = dateRange(days);
  const since = `${dates[0]} 00:00:00`;

  const rows = videoId
    ? db
        .prepare(
          `SELECT date(timestamp) AS date,
             COUNT(CASE WHEN event_type = 'view'        THEN 1 END) AS views,
             COUNT(CASE WHEN event_type = 'click'       THEN 1 END) AS clicks,
             COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) AS conversions
           FROM engagement_events
           WHERE timestamp >= ? AND video_id = ?
           GROUP BY date(timestamp)`
        )
        .all(since, videoId)
    : db
        .prepare(
          `SELECT date(timestamp) AS date,
             COUNT(CASE WHEN event_type = 'view'        THEN 1 END) AS views,
             COUNT(CASE WHEN event_type = 'click'       THEN 1 END) AS clicks,
             COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) AS conversions
           FROM engagement_events
           WHERE timestamp >= ?
           GROUP BY date(timestamp)`
        )
        .all(since);

  const byDate = new Map(rows.map((row) => [row.date, row]));

  return dates.map(
    (date) => byDate.get(date) ?? { date, views: 0, clicks: 0, conversions: 0 }
  );
}

/** One video with its metrics, its product, and its own daily series. */
export function getVideoDetail(id) {
  const db = getDb();

  const video = db
    .prepare(
      `SELECT
         v.id         AS id,
         v.title      AS title,
         v.video_url  AS videoUrl,
         v.created_at AS createdAt,
         p.id         AS productId,
         p.name       AS productName,
         p.price      AS productPrice,
         ${METRIC_COLUMNS}
       FROM videos v
       INNER JOIN products p          ON p.id = v.product_id
       LEFT  JOIN engagement_events e ON e.video_id = v.id
       WHERE v.id = ?
       GROUP BY v.id`
    )
    .get(id);

  if (!video) return null;

  const recentEvents = db
    .prepare(
      `SELECT id, event_type AS eventType, timestamp
       FROM engagement_events
       WHERE video_id = ?
       ORDER BY timestamp DESC, id DESC
       LIMIT 8`
    )
    .all(id);

  return { ...video, timeseries: getTimeseries({ days: 14, videoId: id }), recentEvents };
}

/** The newest events across all videos, for the activity feed. */
export function getRecentEvents(limit = 30) {
  return getDb()
    .prepare(
      `SELECT
         e.id                AS id,
         e.event_type        AS eventType,
         e.timestamp         AS timestamp,
         v.id                AS videoId,
         v.title             AS videoTitle,
         p.name              AS productName
       FROM engagement_events e
       INNER JOIN videos v   ON v.id = e.video_id
       INNER JOIN products p ON p.id = v.product_id
       -- Ordered by when the event happened, not by insertion order. Seeded
       -- rows get random timestamps with sequential ids, so ORDER BY id would
       -- present a feed labelled 'newest first' whose dates jump around.
       ORDER BY e.timestamp DESC, e.id DESC
       LIMIT ?`
    )
    .all(limit);
}
