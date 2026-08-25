import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the server/ workspace root. */
export const SERVER_ROOT = path.resolve(__dirname, '..');

const rawDatabasePath = process.env.DATABASE_PATH || 'data/analytics.db';
const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT) || 4000,
  // ':memory:' is a SQLite sentinel, not a path - resolving it against the
  // server root would turn it into a real (and uncreatable) file name.
  databasePath:
    rawDatabasePath === ':memory:' ? ':memory:' : path.resolve(SERVER_ROOT, rawDatabasePath),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
  isTest: process.env.NODE_ENV === 'test',
  isProduction,
  // In production this one process also serves the built React app, so the
  // whole project deploys as a single service on a single origin.
  serveClient: isProduction,
  // A fresh deployment starts with an empty database; seeding on boot means
  // the shared link shows a populated dashboard instead of an empty table.
  seedOnBoot: process.env.SEED_ON_BOOT !== 'false' && isProduction,
};

/** The only event types the system accepts, in funnel order. */
export const EVENT_TYPES = ['view', 'click', 'add_to_cart'];
