import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDb, closeDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

let app;
let db;

beforeAll(() => {
  db = getDb();
  migrate(db, { fresh: true });
  seed(db, { events: 200 });
  app = createApp();
});

afterAll(() => closeDb());

describe('GET /api/analytics/videos', () => {
  it('returns aggregated metrics with pagination metadata', async () => {
    const res = await request(app).get('/api/analytics/videos');

    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 10, total: 12, totalPages: 2 });
    expect(res.body.data).toHaveLength(10);

    for (const row of res.body.data) {
      expect(row).toHaveProperty('productName');
      expect(Number.isInteger(row.views)).toBe(true);
      expect(Number.isInteger(row.clicks)).toBe(true);
      expect(Number.isInteger(row.conversions)).toBe(true);
    }
  });

  it('counts each event exactly once (no join fan-out)', async () => {
    // Sum the page totals and compare against the raw event table. A
    // cartesian product between products and events would inflate these.
    const all = await request(app).get('/api/analytics/videos?limit=100');
    const summed = all.body.data.reduce(
      (acc, r) => acc + r.views + r.clicks + r.conversions,
      0
    );
    const actual = db.prepare('SELECT COUNT(*) AS c FROM engagement_events').get().c;

    expect(summed).toBe(actual);
  });

  it('includes videos that have no events at all', async () => {
    const res = await request(app).get('/api/analytics/videos?limit=100');
    const empty = res.body.data.filter((r) => r.views === 0 && r.clicks === 0 && r.conversions === 0);

    expect(empty.length).toBeGreaterThan(0);
  });

  it('paginates without repeating or dropping rows', async () => {
    const first = await request(app).get('/api/analytics/videos?page=1&limit=5');
    const second = await request(app).get('/api/analytics/videos?page=2&limit=5');
    const third = await request(app).get('/api/analytics/videos?page=3&limit=5');

    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map((r) => r.id);

    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(second.body.pagination.hasPreviousPage).toBe(true);
    expect(third.body.pagination.hasNextPage).toBe(false);
  });

  it('sorts by the requested column and direction', async () => {
    const res = await request(app).get('/api/analytics/videos?sortBy=clicks&order=asc&limit=100');
    const clicks = res.body.data.map((r) => r.clicks);

    expect(clicks).toEqual([...clicks].sort((a, b) => a - b));
  });

  it('rejects an unknown sort column instead of interpolating it', async () => {
    const res = await request(app).get('/api/analytics/videos?sortBy=id;DROP TABLE videos');

    expect(res.status).toBe(400);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='videos'").get()).toBeTruthy();
  });

  it('rejects out-of-range pagination values', async () => {
    await expect(request(app).get('/api/analytics/videos?page=0')).resolves.toMatchObject({
      status: 400,
    });
    await expect(request(app).get('/api/analytics/videos?limit=500')).resolves.toMatchObject({
      status: 400,
    });
  });
});

describe('GET /api/analytics/summary', () => {
  it('totals match the event table', async () => {
    const res = await request(app).get('/api/analytics/summary');
    const { totalViews, totalClicks, totalConversions } = res.body.data;
    const actual = db.prepare('SELECT COUNT(*) AS c FROM engagement_events').get().c;

    expect(totalViews + totalClicks + totalConversions).toBe(actual);
  });
});
