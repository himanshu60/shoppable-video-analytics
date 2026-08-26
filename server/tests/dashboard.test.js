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
  seed(db, { events: 300 });
  app = createApp();
});

afterAll(() => closeDb());

describe('GET /api/analytics/timeseries', () => {
  it('returns one row per day, including days with no events', async () => {
    const res = await request(app).get('/api/analytics/timeseries?days=14');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(14);

    // Gap-filling is the point: a skipped quiet day would compress the
    // chart's x-axis and make a lull look like it never happened.
    for (const row of res.body.data) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isInteger(row.views)).toBe(true);
      expect(Number.isInteger(row.clicks)).toBe(true);
      expect(Number.isInteger(row.conversions)).toBe(true);
    }
  });

  it('returns dates in ascending order with no duplicates', async () => {
    const res = await request(app).get('/api/analytics/timeseries?days=30');
    const dates = res.body.data.map((row) => row.date);

    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('honours the days parameter and rejects out-of-range values', async () => {
    const short = await request(app).get('/api/analytics/timeseries?days=3');
    expect(short.body.data).toHaveLength(3);

    await expect(request(app).get('/api/analytics/timeseries?days=0')).resolves.toMatchObject({
      status: 400,
    });
    await expect(request(app).get('/api/analytics/timeseries?days=500')).resolves.toMatchObject({
      status: 400,
    });
  });

  it('never counts more events than exist in the window', async () => {
    const res = await request(app).get('/api/analytics/timeseries?days=90');
    const summed = res.body.data.reduce(
      (acc, row) => acc + row.views + row.clicks + row.conversions,
      0
    );
    const total = db.prepare('SELECT COUNT(*) AS c FROM engagement_events').get().c;

    expect(summed).toBeLessThanOrEqual(total);
  });
});

describe('GET /api/videos/:id', () => {
  it('returns the video with its metrics, series and recent events', async () => {
    const res = await request(app).get('/api/videos/1');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 1 });
    expect(res.body.data.productName).toBeTruthy();
    expect(res.body.data.timeseries).toHaveLength(14);
    expect(Array.isArray(res.body.data.recentEvents)).toBe(true);
  });

  it('detail metrics match the list endpoint for the same video', async () => {
    const list = await request(app).get('/api/analytics/videos?limit=100');
    const fromList = list.body.data.find((row) => row.id === 2);

    const detail = await request(app).get('/api/videos/2');

    expect(detail.body.data.views).toBe(fromList.views);
    expect(detail.body.data.clicks).toBe(fromList.clicks);
    expect(detail.body.data.conversions).toBe(fromList.conversions);
  });

  it('returns 404 for a video that does not exist', async () => {
    const res = await request(app).get('/api/videos/99999');
    expect(res.status).toBe(404);
  });

  it('rejects a non-numeric id', async () => {
    const res = await request(app).get('/api/videos/abc');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/events/recent', () => {
  it('returns the newest events first, joined to video and product', async () => {
    const res = await request(app).get('/api/events/recent?limit=10');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(10);

    // Ordered by when the event happened, not by insertion order: seeded
    // rows get random timestamps with sequential ids, so asserting on id
    // would pass while the feed still showed dates jumping around.
    const times = res.body.data.map((event) => event.timestamp);
    expect(times).toEqual([...times].sort().reverse());

    for (const event of res.body.data) {
      expect(event.videoTitle).toBeTruthy();
      expect(event.productName).toBeTruthy();
      expect(['view', 'click', 'add_to_cart']).toContain(event.eventType);
    }
  });

  it('reflects a newly posted event at the top of the feed', async () => {
    await request(app).post('/api/events').send({ videoId: 4, eventType: 'add_to_cart' });

    const res = await request(app).get('/api/events/recent?limit=1');

    expect(res.body.data[0]).toMatchObject({ videoId: 4, eventType: 'add_to_cart' });
  });

  it('does not shadow POST /api/events', async () => {
    // Both routers are mounted at /api/events; this asserts the feed router
    // did not capture the ingestion route when it was mounted first.
    const res = await request(app).post('/api/events').send({ videoId: 1, eventType: 'view' });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/analytics/videos meta', () => {
  it('reports the page maximum used to scale the table bars', async () => {
    const res = await request(app).get('/api/analytics/videos?limit=10&sortBy=views&order=desc');
    const highest = Math.max(...res.body.data.map((row) => row.views));

    expect(res.body.meta.maxViews).toBe(highest);
  });
});
