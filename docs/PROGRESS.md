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

## Step 8 - Frontend architecture

**What:** React 18 + Vite dashboard, styled with SCSS Modules.

**Why SCSS Modules and not Tailwind:** the brief explicitly rules out
utility-class frameworks. SCSS Modules give locally-scoped class names (no
global collisions), real semantic HTML, and nesting/mixins where they help.

**Layer split:**

| File | Responsibility |
|------|----------------|
| `api/client.js` | One fetch wrapper; the only place that knows about HTTP |
| `hooks/useAnalytics.js` | All data fetching + loading/error state |
| `utils/format.js` | Conversion rate and number/currency formatting |
| `components/*` | Presentation only |
| `App.jsx` | Layout and URL-ish state (page, limit, sort) |

**Why a Vite proxy instead of a hard-coded API URL:** `vite.config.js` proxies
`/api` to `localhost:4000`. Client code uses origin-relative paths, so there
is no CORS preflight in development and nothing to change when the app is
deployed behind a single origin.

**Three details worth calling out:**

1. **Request-id guard in `useAnalytics`.** If a slow request resolves after a
   newer one, it is discarded. Without this, clicking through pages quickly
   can leave stale rows on screen.

2. **Two loading states.** First load shows a skeleton; a background refresh
   after simulating traffic dims the existing table instead. Flashing an empty
   table on every refresh reads as a bug.

3. **Zero views renders an em dash, not 0.0%.** "Nobody converted" and
   "nobody watched" are different facts. The seed data includes a zero-event
   video so this path is always visible.

**Verify:** `npm run build` (compiles with no warnings)

---

## Step 9 - End-to-end verification

**What:** Ran both servers and tested the real request path.

| Check | Result |
|-------|--------|
| `GET :4000/health` | 200 |
| `GET :5173/` (Vite) | 200 |
| `GET :5173/api/analytics/summary` (through proxy) | 200, real data |
| `POST :5173/api/events` then re-read summary | conversions 86 -> 87 |

**Why test through port 5173 rather than 4000:** that is the path the browser
actually takes. Testing the backend directly would not prove the proxy works.

**Verify:** `npm run dev`, then open http://localhost:5173

---

## Step 10 - Documentation

**What:** Wrote `README.md` (setup, API reference, schema diagram, query
walkthrough, trade-offs) and `AI_PROMPTING.md` (the assignment-required log of
AI interactions, including both debugging sessions).

The README opens with a TODO checklist for the three things only you can
supply: the YouTube pitch link, the Loom walkthrough link, and links to your
other public repositories.

---

## Step 11 - UI corrections: scroll containment and theming

**Feedback:** the scroll area was outside the table, and the theme needed an
explicit light/dark control.

### Scroll containment

**Before:** the container had `overflow-x: auto` only. Long result sets pushed
the pagination controls off the bottom of the page, and the column headers
scrolled out of sight.

**After:** the scroll container sits inside the card and owns **both** axes:

```scss
.scroll {
  max-height: min(65vh, 34rem);
  overflow: auto;
  overscroll-behavior: contain;
}
```

- `max-height` caps the table so rows scroll in place and the pagination bar
  stays put.
- `overflow: hidden` on the parent card clips the scrollbar to the rounded
  corners, so it renders inside the card instead of running past its edge.
- `overscroll-behavior: contain` stops a scroll that reaches the bottom of the
  table from continuing on to scroll the whole page.

**Sticky header.** Column labels stay pinned via `position: sticky; top: 0` on
the `<th>` cells. This only works because the container above is the scroll
parent - sticky positions against the nearest scrolling ancestor.

**One non-obvious fix:** the table had to move from `border-collapse: collapse`
to `separate`. Under `collapse`, cell borders are painted by the *table*, not
by the cell, so a sticky header's bottom border scrolls away with the rows and
leaves the header floating with no edge. With `separate`, the header keeps its
own border. The border itself is drawn with `inset box-shadow` rather than
`border-bottom`, because a sticky cell's real border can sub-pixel-shift during
scroll and flicker.

### Light / dark theme

**Three states, not two:** Auto / Light / Dark. A two-way toggle cannot express
"follow my OS", which is what most people actually want, so the control is a
`radiogroup` rather than a switch.

**How it works:**

| State | Mechanism |
|-------|-----------|
| Auto | no `data-theme` attribute -> `prefers-color-scheme` applies |
| Light | `data-theme="light"` on `<html>` |
| Dark | `data-theme="dark"` on `<html>` |

The dark palette has to exist in two CSS blocks - one inside the media query,
one under `[data-theme="dark"]`. Rather than duplicating forty declarations,
they are defined once as a SCSS mixin in `_tokens.scss` and included twice.
The media-query block is guarded with `:not([data-theme="light"])` so an
explicit light choice beats a dark OS setting.

**Flash of wrong theme:** a small inline script in `index.html` reads
`localStorage` and sets the attribute *before* first paint. Without it, a dark
-mode user sees a white flash while the React bundle downloads. Every
`localStorage` access is wrapped in try/catch, because private-browsing modes
make it throw rather than return null.

**Also themed:** scrollbars, via `scrollbar-color` and the WebKit
pseudo-elements. Left alone, the table's new scroll area renders as a bright
grey strip inside a dark card.

### Authentication - confirmed not required

Re-read the brief: no mention of users, accounts, login or signup anywhere.
The only entities specified are Products, Videos and EngagementEvents. Adding
auth would be unrequested scope and would complicate the reviewer's setup. It
is listed in the README as a deliberate omission.

---

## Step 12 - Multi-view dashboard

**Feedback:** the UI was functional but plain, and everything sat on one
screen.

**What changed:** three views behind a sidebar, plus a detail panel.

| View | Contents |
|------|----------|
| Overview | Funnel, sparkline stat cards with period deltas, engagement-over-time chart, top-5 videos |
| Videos | The data table, now with inline magnitude bars and click-through rows |
| Activity | Live event feed, newest first |
| Detail panel | Opens over any view: per-video metrics, its own 14-day chart, its latest events |

**Three new endpoints** back these: `/api/analytics/timeseries` (daily counts
with zero-filled gaps), `/api/videos/:id` (detail), `/api/events/recent`
(feed).

### Charts are hand-rolled SVG

No chart library. Recharts or Chart.js would each add 50-150 kB for four
simple forms, and writing them directly means the mark specs are exactly as
intended: 2px lines, 10% area washes, 4px rounded bar ends square at the
baseline, hairline solid gridlines, markers with a 2px surface ring.

**Colour was computed, not chosen.** The three series use categorical slots
1-3 (blue / orange / aqua), validated against both surfaces for colour-blind
separation: all-pairs CVD dE 9.2 light and 9.4 dark, normal-vision dE 24.0 /
20.9. The aqua slot sits at 2.82:1 contrast on the white card, below the 3:1
bar - which is why the charts ship direct labels and a table view rather than
relying on the hue alone. Each series keeps its hue in every chart, stat card,
legend and feed row: colour follows the entity, never its rank.

### Three bugs found by looking at the rendered output

Screenshots were taken of every view in both themes. All three of these
passed the test suite and were only visible on screen:

1. **The feed was sorted by insertion id but displayed timestamps.** Seeded
   rows get random timestamps with sequential ids, so a feed labelled "newest
   first" showed dates jumping around. The test asserting descending ids
   passed the whole time - it was testing the wrong property, and was
   rewritten to assert on timestamps.

2. **The chart nosedived at the right edge.** The last day is still in
   progress, so its partial count sat beside complete days and read as a
   crash - and drove a fake "-25.4%" on the views card. The final segment is
   now dashed with a note, and excluded from both the delta and the
   sparklines. Note the dashed stroke here is a *data qualifier*; the
   gridlines stay solid, because dashed chrome competes with the data.

3. **The trend line was flat.** Seed timestamps were spread uniformly across
   30 days. They are now skewed toward the present, which is more realistic
   and gives the period-over-period delta something real to report.

**The lesson:** a passing test suite says the code does what it was told to.
It says nothing about whether the result is right to look at. Rendering the
output and examining it caught three defects that 29 green tests did not.

### Routing

A ~30-line hash router rather than react-router: three routes do not justify
the dependency, and hash routes survive a hard refresh behind a static bundle
with no server-side rewrite. The trade-off is uglier URLs (`#/videos`).

**Verify:** `npm run dev`, then click through Overview / Videos / Activity and
select any video row.

---
