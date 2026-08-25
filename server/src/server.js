import { createApp } from './app.js';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';

const db = getDb();

// Apply the schema on boot so a fresh clone (or a fresh deployment) works
// without a manual migration step; the DDL is idempotent.
migrate(db);

// Seed only when the database is genuinely empty. Hosts with an ephemeral
// filesystem reset the file on every restart, so this keeps a deployed demo
// populated - while never overwriting data that already exists.
if (config.seedOnBoot) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM videos').get();
  if (count === 0) {
    const result = seed(db);
    console.log(`Seeded ${result.products} products and ${result.videos} videos on boot`);
  }
}

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
