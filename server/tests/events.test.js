import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDb, closeDb } from '../src/db/index.js';
import { migrate } from '../src/db/migrate.js';
import { seed, pickWeightedEventType } from '../src/db/seed.js';

let app;
let db;

beforeAll(() => {
  db = getDb();
  migrate(db, { fresh: true });
  seed(db, { events: 50 });
  app = createApp();
});

afterAll(() => closeDb());

const countEvents = () => db.prepare('SELECT COUNT(*) AS c FROM engagement_events').get().c;

describe('POST /api/events', () => {
  it('stores a valid event and returns it with 201', async () => {
    const before = countEvents();
    const res = await request(app).post('/api/events').send({ videoId: 1, eventType: 'add_to_cart' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ videoId: 1, eventType: 'add_to_cart' });
    expect(res.body.data.timestamp).toBeTruthy();
    expect(countEvents()).toBe(before + 1);
  });

  it('accepts a numeric string videoId from webhook-style payloads', async () => {
    const res = await request(app).post('/api/events').send({ videoId: '2', eventType: 'view' });

    expect(res.status).toBe(201);
    expect(res.body.data.videoId).toBe(2);
  });

  it('rejects an unknown event type without writing', async () => {
    const before = countEvents();
    const res = await request(app).post('/api/events').send({ videoId: 1, eventType: 'purchase' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('eventType');
    expect(countEvents()).toBe(before);
  });

  it('rejects a missing videoId', async () => {
    const res = await request(app).post('/api/events').send({ eventType: 'view' });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe('videoId');
  });

  it('returns 404 for a video that does not exist', async () => {
    const before = countEvents();
    const res = await request(app).post('/api/events').send({ videoId: 99999, eventType: 'view' });

    expect(res.status).toBe(404);
    expect(countEvents()).toBe(before);
  });

  it('is reflected in the analytics aggregation immediately', async () => {
    const before = await request(app).get('/api/analytics/videos?limit=100');
    const target = before.body.data.find((r) => r.id === 3);

    await request(app).post('/api/events').send({ videoId: 3, eventType: 'view' });

    const after = await request(app).get('/api/analytics/videos?limit=100');
    const updated = after.body.data.find((r) => r.id === 3);

    expect(updated.views).toBe(target.views + 1);
  });
});

describe('pickWeightedEventType', () => {
  it('maps the whole 0..1 range onto a valid event type', () => {
    // Deterministic probes at the weight boundaries (0.7 / 0.9).
    expect(pickWeightedEventType(() => 0)).toBe('view');
    expect(pickWeightedEventType(() => 0.69)).toBe('view');
    expect(pickWeightedEventType(() => 0.7)).toBe('click');
    expect(pickWeightedEventType(() => 0.89)).toBe('click');
    expect(pickWeightedEventType(() => 0.9)).toBe('add_to_cart');
    expect(pickWeightedEventType(() => 0.999)).toBe('add_to_cart');
  });
});

describe('misc routes', () => {
  it('GET /health reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });
});
