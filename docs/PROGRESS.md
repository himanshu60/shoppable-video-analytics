# Build Log

A running, plain-language record of every step taken to build this project:
what was done, **why** it was done that way, and how to verify it yourself.

Newest steps are appended at the bottom.

---

## Step 0 — Environment check

**What:** Verified the toolchain before writing any code.

| Tool | Version found |
|------|---------------|
| Node | v24.19.0 |
| npm  | 11.17.0 |
| git  | 2.38.1.windows.1 |
| GitHub CLI (`gh`) | not installed |

**Why:** The Node major version decides which SQLite driver will install
without a C++ compiler. Checking first avoided a dead end later.

**Verify:** `node --version && npm --version && git --version`

---

## Step 1 — Repository scaffold

**What:** Created `C:\Users\DELL\Projects\shoppable-video-analytics`, ran
`git init`, and added three root files:

- `package.json` — declares npm **workspaces** (`server`, `client`)
- `.gitignore` — excludes `node_modules/`, `*.db`, `.env`
- `.gitattributes` — `* text=auto eol=lf` so line endings stay consistent
  between Windows and the reviewer's machine

**Why workspaces:** One `npm install` at the root installs both the backend
and the frontend, and one `npm run dev` starts both. A reviewer cloning this
repo runs two commands total instead of four.

**Why `*.db` is ignored:** The database is a build artifact. It is rebuilt
from `schema.sql` + `seed.js` on demand. Committing a binary DB file would
bloat the repo and cause merge conflicts nobody can resolve.

**Verify:** `git show --stat 7404268`

---

## Step 2 — Dependencies (and a real problem solved)

**What:** Installed backend and frontend dependencies.

**The problem:** `better-sqlite3@11` has **no prebuilt binary for Node 24**.
npm fell back to compiling it from C++ source with `node-gyp`, which failed:

```
gyp ERR! stack Error: Could not find any Visual Studio installation to use
```

**Options considered:**

1. Install Visual Studio Build Tools (~6 GB) — works, but every reviewer
   would need it too. Rejected.
2. Switch to the `sqlite3` package — callback-based, more awkward code.
3. **Upgrade to `better-sqlite3@13`, which ships a prebuilt Node 24 binary.**

**Chosen:** option 3. No compiler needed, on this machine or a reviewer's.

**Second issue:** npm 11.17 blocks package install scripts by default, so
`esbuild` (which Vite needs) never unpacked its binary. Fixed by adding an
explicit `allowScripts` entry in the root `package.json`. Older npm versions
ignore this field harmlessly.

**Note:** `better-sqlite3`'s own install script stays *blocked* on purpose —
it exists only to trigger the source build we do not want. The prebuilt
binary ships inside the package and works without it.

**Verify:** `node -e "new (require('better-sqlite3'))(':memory:'); console.log('ok')"`

---

## Step 3 — Database schema

**What:** Wrote `server/src/db/schema.sql` with three tables and three
indexes, plus `migrate.js` to apply it.

**The schema:**

```
products          (id, name, price, created_at)
videos            (id, product_id -> products, video_url, title, created_at)
engagement_events (id, video_id -> videos, event_type, timestamp)
```

**Key design decision — metrics are never stored.** There is no `views`
column on `videos`. View/click/conversion counts are calculated from
`engagement_events` at query time. A stored counter can drift out of sync
with the events it claims to summarise (a failed transaction, a double
increment, a manual DB edit); a derived count physically cannot.

**Why the `CHECK (event_type IN (...))` constraint:** The API validates input
first, but the constraint is the last line of defence. Anything that writes
to this DB — a script, a migration, a future service — is held to the same
three event types.

**Why `PRAGMA foreign_keys = ON`:** SQLite has foreign keys **off by default**
and silently ignores `REFERENCES` clauses without it. It must be set per
connection, which `db/index.js` does on open.

**Why the composite index `(video_id, event_type)`:** Every dashboard read
groups by video and filters by type. This index lets SQLite answer the
aggregation from the index rather than scanning the whole events table.

**Verify:** `npm run db:migrate`, then inspect with any SQLite browser.

---

## Step 4 — Seed data

**What:** `server/src/db/seed.js` inserts 8 products, 12 videos, ~900 events.

**Three deliberate choices:**

1. **Weighted event types (70% view / 20% click / 10% add_to_cart).**
   A uniform random draw would give every video a ~33% conversion rate, which
   is nonsense and would make the dashboard look broken.

2. **Skewed traffic across videos**, so the sorted table has a clear head and
   tail instead of 12 near-identical rows.

3. **One video is left with zero events on purpose.** This proves the
   analytics query still returns it (the `LEFT JOIN` works) and that the UI
   handles a 0/0 conversion rate without printing `NaN`.

**Why one transaction:** `better-sqlite3` commits per statement by default,
which would turn ~900 inserts into ~900 disk syncs. Wrapping them in
`db.transaction()` makes it one.

**Why 12 videos:** More than the default page size of 10, so pagination is
actually exercised by the seeded data.

**Verify:** `npm run db:seed`

---

## Step 5 — REST API

**What:** Express app with the required endpoints, plus two helpers.

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/events` | Ingest one engagement event (simulates webhook traffic) |
| GET | `/api/analytics/videos` | Paginated videos + aggregated metrics |
| GET | `/api/analytics/summary` | Site-wide totals for the dashboard header |
| GET | `/api/videos` | id + title only; used to pick a random simulation target |
| GET | `/health` | Liveness check |

**The aggregation query — the core of the assignment:**

```sql
SELECT v.id, v.title, p.name AS productName,
  COUNT(CASE WHEN e.event_type = 'view'        THEN 1 END) AS views,
  COUNT(CASE WHEN e.event_type = 'click'       THEN 1 END) AS clicks,
  COUNT(CASE WHEN e.event_type = 'add_to_cart' THEN 1 END) AS conversions
FROM videos v
INNER JOIN products p          ON p.id = v.product_id
LEFT  JOIN engagement_events e ON e.video_id = v.id
GROUP BY v.id
ORDER BY views DESC, v.id ASC
LIMIT ? OFFSET ?;
```

Line by line:

- **`LEFT JOIN` on events** — an `INNER JOIN` would silently drop videos with
  zero events. A merchant who uploaded a video that got no traffic still
  needs to see it in the dashboard.
- **`COUNT(CASE WHEN ...)` not `SUM(CASE ... ELSE 0)`** — `COUNT` ignores
  `NULL`, so a video with no events returns `0` rather than `NULL`.
- **One join, not three subqueries** — three correlated subqueries would mean
  three passes over `engagement_events`. This does one.
- **`GROUP BY v.id` is essential** — joining products *and* events without it
  produces one row per event (a fan-out), inflating every number. There is a
  regression test for exactly this.
- **`ORDER BY ..., v.id ASC`** — the tiebreaker makes ordering deterministic.
  Without it, two videos with equal views could swap places between the page-1
  and page-2 requests, making a row appear twice or vanish entirely.
- **`LIMIT ? OFFSET ?` as bound parameters** — never string interpolation.

**Sort keys are whitelisted**, mapped through a lookup object. `ORDER BY`
cannot take a bound parameter in SQL, so the only safe way to accept a
user-supplied sort column is to validate it against a fixed allowlist.

**Why `createApp()` is separate from `server.js`:** The factory returns the
app without binding a port, so the test suite can drive it in-process via
supertest. No test needs a free TCP port or a running server.

**Error handling:** `POST /api/events` checks the video exists and returns
**404** with a clear message, rather than letting a raw
`SQLITE_CONSTRAINT_FOREIGNKEY` bubble up as a 500. 5xx responses log the
stack server-side but never leak it to the client.

**Verify:** `npm run dev:server`, then
`curl "http://localhost:4000/api/analytics/videos?limit=3"`

---

## Step 6 — Tests

**What:** 17 tests across two files, run with Vitest + supertest against an
in-memory SQLite database.

**Why in-memory:** Each test file gets a throwaway DB. Tests never touch the
real `analytics.db`, and they cannot leak state into each other.

**The two tests that matter most:**

1. **Fan-out regression test** — sums views + clicks + conversions across all
   pages and asserts it equals `COUNT(*)` on `engagement_events`. If someone
   later "optimises" the query into a cartesian product, this fails loudly.

2. **SQL injection probe** — requests `?sortBy=id;DROP TABLE videos`, asserts
   a 400 response, then asserts the `videos` table still exists.

**A real bug this caught:** `config.js` was running `path.resolve()` on the
database path unconditionally, which turned the SQLite sentinel `:memory:`
into a literal file path like `C:\...\server\:memory:` — an illegal Windows
filename. Every test failed with `unable to open database file`. Fixed by
special-casing `:memory:` before resolving. Exactly the kind of bug that only
appears under a different configuration than the one you develop in.

**Verify:** `npm test`

---

## Step 7 — Branching strategy

**What:** Moved all feature work off `main` onto `feature/analytics-dashboard`.

```
* 1a8858b (feature/analytics-dashboard)  test: cover ingestion + aggregation
* af32640  feat(api): event ingestion and paginated analytics
* 12d8d0e  feat(db): seed data
* a5662f4  feat(db): schema and migrations
* 701ec21  chore: workspaces and dependencies
* 7404268 (main)  chore: scaffold monorepo
```

**Why:** `main` stays a clean baseline; all work is reviewable as a single
pull request.

**Why there can be no merge conflicts:** the feature branch is **0 commits
behind** `main`. It is a direct descendant, so merging is a fast-forward —
git has nothing to reconcile. A conflict is only possible when two branches
change the same lines *after* they diverge, and these never diverged.

**Verify:** `git log --oneline --graph --all --decorate`

---
