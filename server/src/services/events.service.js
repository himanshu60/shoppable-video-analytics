import { getDb } from '../db/index.js';

export function videoExists(videoId) {
  return Boolean(getDb().prepare('SELECT 1 FROM videos WHERE id = ?').get(videoId));
}

/**
 * Records an engagement event.
 *
 * `timestamp` is optional so a real webhook can replay events with the
 * originating time; when omitted SQLite's DEFAULT datetime('now') applies.
 */
export function createEvent({ videoId, eventType, timestamp }) {
  const db = getDb();

  const info = timestamp
    ? db
        .prepare('INSERT INTO engagement_events (video_id, event_type, timestamp) VALUES (?, ?, ?)')
        .run(videoId, eventType, timestamp)
    : db
        .prepare('INSERT INTO engagement_events (video_id, event_type) VALUES (?, ?)')
        .run(videoId, eventType);

  return db
    .prepare(
      `SELECT id, video_id AS videoId, event_type AS eventType, timestamp
       FROM engagement_events WHERE id = ?`
    )
    .get(info.lastInsertRowid);
}
