import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the server/ workspace root. */
export const SERVER_ROOT = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 4000,
  databasePath: path.resolve(SERVER_ROOT, process.env.DATABASE_PATH || 'data/analytics.db'),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
  isTest: process.env.NODE_ENV === 'test',
};

/** The only event types the system accepts, in funnel order. */
export const EVENT_TYPES = ['view', 'click', 'add_to_cart'];
