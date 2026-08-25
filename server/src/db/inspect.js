/**
 * Prints the contents of the database to the terminal.
 *
 * A convenience for development and for demoing the data layer without
 * installing a GUI. Read-only by construction, so it cannot corrupt the
 * database while the API is running against it.
 *
 * Usage:
 *   npm run db:inspect                     -- summary of every table
 *   npm run db:inspect -- products         -- one table in full
 *   npm run db:inspect -- "SELECT ..."     -- an arbitrary read-only query
 */
import Database from 'better-sqlite3';
import { config } from '../config.js';

const TABLES = ['products', 'videos', 'engagement_events'];

const db = new Database(config.databasePath, { readonly: true, fileMustExist: true });

const [arg] = process.argv.slice(2);

function printTable(rows) {
  if (!rows.length) {
    console.log('  (no rows)\n');
    return;
  }
  console.table(rows);
}

if (!arg) {
  console.log(`\nDatabase: ${config.databasePath}\n`);

  for (const table of TABLES) {
    const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
    console.log(`=== ${table} (${count} rows, showing up to 10) ===`);
    printTable(db.prepare(`SELECT * FROM ${table} LIMIT 10`).all());
  }

  console.log('=== aggregated metrics per video (what the dashboard shows) ===');
  printTable(
    db
      .prepare(
        `SELECT v.id, v.title,
           COUNT(CASE WHEN e.event_type = 'view'        THEN 1 END) AS views,
           COUNT(CASE WHEN e.event_type = 'click'       THEN 1 END) AS clicks,
           COUNT(CASE WHEN e.event_type = 'add_to_cart' THEN 1 END) AS conversions
         FROM videos v
         LEFT JOIN engagement_events e ON e.video_id = v.id
         GROUP BY v.id
         ORDER BY views DESC`
      )
      .all()
  );

  console.log('Tip: npm run db:inspect -- products');
  console.log('     npm run db:inspect -- "SELECT * FROM engagement_events ORDER BY id DESC LIMIT 5"\n');
} else if (TABLES.includes(arg)) {
  console.log(`\n=== ${arg} (all rows) ===`);
  printTable(db.prepare(`SELECT * FROM ${arg}`).all());
} else {
  // The connection is opened readonly, so SQLite itself rejects any statement
  // that would write - no need to parse the SQL to decide whether it is safe.
  try {
    printTable(db.prepare(arg).all());
  } catch (error) {
    console.error(`\nQuery failed: ${error.message}\n`);
    console.error(`Known tables: ${TABLES.join(', ')}\n`);
    process.exitCode = 1;
  }
}

db.close();
