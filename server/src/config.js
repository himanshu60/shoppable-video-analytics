import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the server/ workspace root. */
export const SERVER_ROOT = path.resolve(__dirname, '..');

const rawDatabasePath = process.env.DATABASE_PATH || 'data/analytics.db';

export const config = {
  port: Number(process.env.PORT) || 4000,
  // ':memory:' is a SQLite sentinel, not a path - resolving it against the
  // server root would turn it into a real (and uncreatable) file name.
  databasePath: rawDatabasePath === ':memory:'
    ? ':memory:'
    : path.resolve(SERVER_ROOT, rawDatabasePath),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
  isTest: process.env.NODE_ENV === 'test',
};

/** The only event types the system accepts, in funnel order. */
export const EVENT_TYPES = ['view', 'click', 'add_to_cart'];
