import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, closeDb } from './index.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Applies schema.sql to the given connection.
 *
 * The DDL is entirely `IF NOT EXISTS`, so running this repeatedly is safe.
 * `--fresh` drops the tables first, which is what `npm run db:reset` uses.
 */
export function migrate(database = getDb(), { fresh = false } = {}) {
  if (fresh) {
    // Child-first order so foreign key constraints are never violated.
    database.exec(`
      DROP TABLE IF EXISTS engagement_events;
      DROP TABLE IF EXISTS videos;
      DROP TABLE IF EXISTS products;
    `);
  }

  database.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return database;
}

// Only run when invoked directly (`node src/db/migrate.js`), not on import.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const fresh = process.argv.includes('--fresh');
  migrate(getDb(), { fresh });
  console.log(`Migrated ${config.databasePath}${fresh ? ' (fresh)' : ''}`);
  closeDb();
}
