-- Shoppable Video Analytics - schema
--
-- Design notes:
--   * Normalised to 3NF. A video belongs to exactly one product; an
--     engagement event belongs to exactly one video.
--   * Aggregate metrics (views / clicks / conversions) are deliberately NOT
--     stored as columns. They are derived from engagement_events at query
--     time, so there is no counter that can drift out of sync with the
--     underlying event log.
--   * ON DELETE CASCADE keeps the event log from outliving its video.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  price      REAL    NOT NULL CHECK (price >= 0),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  video_url  TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS engagement_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id   INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  -- CHECK constraint is the last line of defence; the API validates first.
  event_type TEXT    NOT NULL CHECK (event_type IN ('view', 'click', 'add_to_cart')),
  timestamp  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Every dashboard read groups events by video and filters by type, so a
-- composite index on (video_id, event_type) lets SQLite satisfy the
-- aggregation from the index instead of scanning the events table.
CREATE INDEX IF NOT EXISTS idx_events_video_type ON engagement_events (video_id, event_type);

-- Supports future time-window filters ("last 7 days") without a full scan.
CREATE INDEX IF NOT EXISTS idx_events_timestamp  ON engagement_events (timestamp);

CREATE INDEX IF NOT EXISTS idx_videos_product    ON videos (product_id);
