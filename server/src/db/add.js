/**
 * Adds a product and a video from the command line.
 *
 * Deliberately a script rather than an API endpoint: the brief specifies two
 * endpoints, and catalogue management is a merchant-admin concern, not part
 * of an analytics read model. Keeping it out of the HTTP surface means there
 * is no unauthenticated write path to the catalogue.
 *
 * Usage:
 *   npm run db:add -- --product "Name" --price 49.99 --video "Video title"
 *   npm run db:add -- --video "Second video" --product-id 3
 */
import Database from 'better-sqlite3';
import { config } from '../config.js';

/** Parses `--flag value` pairs into an object keyed by camelCase flag name. */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag?.startsWith('--')) continue;
    const key = flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[key] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.video) {
  console.error(`
Adds a product and/or a video to the catalogue.

  npm run db:add -- --product "Aurora Scarf" --price 39.00 --video "Scarf styling reel"
  npm run db:add -- --video "Another reel" --product-id 3

Options:
  --product     Name of a new product to create
  --price       Price for the new product (default 0)
  --video       Title of the video to create (required)
  --url         Video URL (default: generated from the title)
  --product-id  Attach the video to an existing product instead of creating one
`);
  process.exit(1);
}

const db = new Database(config.databasePath, { fileMustExist: true });
db.pragma('foreign_keys = ON');

const slug = args.video
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

// One transaction: a video whose product insert failed would be an orphan,
// and the foreign key would reject it anyway - better to fail as a unit.
const run = db.transaction(() => {
  let productId = args.productId ? Number(args.productId) : null;

  if (productId) {
    const exists = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
    if (!exists) throw new Error(`No product with id ${productId}`);
  } else {
    if (!args.product) throw new Error('Provide --product to create one, or --product-id to reuse one');
    productId = db
      .prepare('INSERT INTO products (name, price) VALUES (?, ?)')
      .run(args.product, Number(args.price) || 0).lastInsertRowid;
  }

  const videoId = db
    .prepare('INSERT INTO videos (product_id, video_url, title) VALUES (?, ?, ?)')
    .run(productId, args.url || `https://cdn.videoselz.example/${slug}.mp4`, args.video)
    .lastInsertRowid;

  return { productId, videoId };
});

try {
  const { productId, videoId } = run();
  const product = db.prepare('SELECT name, price FROM products WHERE id = ?').get(productId);

  console.log(`\nAdded video #${videoId} "${args.video}"`);
  console.log(`  product #${productId} — ${product.name} (${product.price})`);
  console.log('\nRefresh the dashboard; it appears with zero metrics until events arrive.\n');
} catch (error) {
  console.error(`\nFailed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  db.close();
}
