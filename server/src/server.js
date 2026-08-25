import { createApp } from './app.js';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { migrate } from './db/migrate.js';

// Apply the schema on boot so a fresh clone works after `npm run dev` alone;
// the DDL is idempotent, so this is a no-op once the tables exist.
migrate(getDb());

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
