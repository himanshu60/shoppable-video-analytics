import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './index.js';
import { migrate } from './migrate.js';
import { config, EVENT_TYPES } from '../config.js';

const PRODUCTS = [
  { name: 'Aurora Linen Shirt', price: 89.0 },
  { name: 'Nomad Leather Backpack', price: 219.5 },
  { name: 'Cirrus Running Shoes', price: 134.99 },
  { name: 'Terra Ceramic Mug Set', price: 42.0 },
  { name: 'Halo Wireless Earbuds', price: 179.0 },
  { name: 'Drift Denim Jacket', price: 156.75 },
  { name: 'Ember Cast Iron Skillet', price: 68.0 },
  { name: 'Lumen Desk Lamp', price: 95.25 },
];

// Two videos per product for the first four, one each for the rest: gives a
// realistic mix and enough rows (12) to exercise pagination at limit=10.
const VIDEO_TITLES = [
  'Styling the Aurora Shirt 3 Ways',
  'Aurora Shirt: Fabric Close-Up',
  'What Fits in the Nomad Backpack',
  'Nomad Backpack Airport Run',
  'Cirrus Shoes: 10km First Impressions',
  'Cirrus Shoes Unboxing',
  'Terra Mugs Morning Routine',
  'Terra Mug Set Gift Wrap Idea',
  'Halo Earbuds Noise Cancelling Test',
  'Drift Jacket Autumn Lookbook',
  'Ember Skillet Steak Sear',
  'Lumen Lamp Desk Setup Tour',
];

const PRODUCT_FOR_VIDEO = [1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7, 8];

/**
 * Weighted funnel. Real shoppable-video traffic is mostly passive views, so a
 * uniform random event type would produce nonsense conversion rates.
 */
const EVENT_WEIGHTS = { view: 0.7, click: 0.2, add_to_cart: 0.1 };

export function pickWeightedEventType(random = Math.random) {
  const roll = random();
  let cumulative = 0;
  for (const type of EVENT_TYPES) {
    cumulative += EVENT_WEIGHTS[type];
    if (roll < cumulative) return type;
  }
  return EVENT_TYPES[0];
}

/**
 * A random timestamp within the last `days` days, in SQLite's format.
 *
 * Ages are skewed toward the present (`random()` raised to a power > 1 pulls
 * the distribution toward zero) rather than spread uniformly. A uniform spread
 * draws a flat, lifeless trend line; a storefront that is gaining traction
 * looks like a curve, and it gives the dashboard's period-over-period delta
 * something real to report.
 */
function randomTimestamp(days = 30) {
  const skewedAge = Math.random() ** 1.8 * days;
  const then = Date.now() - skewedAge * 24 * 60 * 60 * 1000;
  return new Date(then).toISOString().replace('T', ' ').slice(0, 19);
}

export function seed(database = getDb(), { events = 900 } = {}) {
  const insertProduct = database.prepare('INSERT INTO products (name, price) VALUES (?, ?)');
  const insertVideo = database.prepare(
    'INSERT INTO videos (product_id, video_url, title) VALUES (?, ?, ?)'
  );
  const insertEvent = database.prepare(
    'INSERT INTO engagement_events (video_id, event_type, timestamp) VALUES (?, ?, ?)'
  );

  // One transaction for the whole seed: better-sqlite3 commits per statement
  // otherwise, which turns ~900 inserts into ~900 fsyncs.
  const run = database.transaction(() => {
    const productIds = PRODUCTS.map((p) => insertProduct.run(p.name, p.price).lastInsertRowid);

    const videoIds = VIDEO_TITLES.map((title, i) => {
      const productId = productIds[PRODUCT_FOR_VIDEO[i] - 1];
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return insertVideo.run(productId, `https://cdn.videoselz.example/${slug}.mp4`, title)
        .lastInsertRowid;
    });

    // Skew traffic towards the first videos so the sorted dashboard has an
    // obvious head and tail rather than a flat distribution.
    for (let i = 0; i < events; i += 1) {
      const weightedIndex = Math.floor(Math.abs(Math.random() - Math.random()) * videoIds.length);
      insertEvent.run(videoIds[weightedIndex], pickWeightedEventType(), randomTimestamp());
    }

    // One video is left with zero events on purpose: it proves the analytics
    // LEFT JOIN still returns it and that the UI handles a 0/0 conversion rate.
    database.prepare('DELETE FROM engagement_events WHERE video_id = ?').run(videoIds.at(-1));

    return { products: productIds.length, videos: videoIds.length };
  });

  return run();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const database = getDb();
  migrate(database, { fresh: true });
  const result = seed(database);
  const eventCount = database.prepare('SELECT COUNT(*) AS c FROM engagement_events').get().c;
  console.log(
    `Seeded ${result.products} products, ${result.videos} videos, ${eventCount} events into ${config.databasePath}`
  );
  closeDb();
}
