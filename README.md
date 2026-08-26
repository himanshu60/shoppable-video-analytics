# Shoppable Video Analytics Dashboard

A dashboard for e-commerce merchants to track how their shoppable product
videos perform: views, clicks, add-to-cart conversions and conversion rate.

Built as a take-home project — an Express + SQLite REST API and a React
dashboard, in one npm-workspace monorepo.

---

## ⚠️ TODO before submitting

These are the only things not yet filled in. Replace each placeholder below
and delete this section.

- [ ] **YouTube pitch (30s, unlisted)** — record and paste the link in
      [Submission links](#submission-links)
- [ ] **Loom / screen walkthrough (3–5 min)** — record and paste the link
- [ ] **Other public repositories** — add links to your open-source and
      personal project work
- [ ] Push to GitHub and confirm the repo is **public**

---

## Submission links

| Item | Link |
|------|------|
| GitHub repository | `https://github.com/himanshu60/shoppable-video-analytics` |
| 30-second YouTube pitch | _TODO: paste unlisted YouTube link_ |
| 3–5 minute technical walkthrough | _TODO: paste Loom link_ |

### Other public repositories

Required by the brief: links to public repositories showing significant
open-source or personal project contributions.

- GitHub profile: https://github.com/himanshu60

_TODO: list your strongest two or three repositories individually, with a
one-line description of each. If this project is your main public work, say so
in one line rather than padding the list — a short honest answer reads better
than a long thin one._

---

## Tech stack

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Backend | Node.js + Express 4 | Required by the brief |
| Database | SQLite via `better-sqlite3` v13 | Required by the brief. v13 ships prebuilt binaries for Node 24, so no C++ toolchain is needed to install |
| Validation | Zod | Schema-driven request validation with field-level error messages |
| Tests | Vitest + Supertest | Drives the Express app in-process against an in-memory database |
| Frontend | React 18 + Vite | Fast dev server, standard tooling |
| Styling | **SCSS Modules** | The brief rules out Tailwind. Scoped class names, semantic HTML, design tokens as CSS custom properties |

**No Tailwind or any utility-class framework is used**, per the styling
constraint in the brief.

---

## Quick start

**Requirements:** Node.js 20 or newer (built and tested on 24), npm 10+.
No database server and no C++ build tools required.

```bash
# 1. Install dependencies for both workspaces
npm install

# 2. Create the database schema and load sample data
npm run db:reset

# 3. Start the API (port 4000) and the dashboard (port 5173)
npm run dev
```

Open **http://localhost:5173**.

> **npm 11.17+ note:** if Vite fails to start with an esbuild error, run
> `npm approve-scripts esbuild` once and re-run `npm install`. Newer npm
> blocks package install scripts by default; the root `package.json` already
> declares the needed `allowScripts` entry.

### Available scripts

Run from the repository root:

| Command | What it does |
|---------|--------------|
| `npm install` | Installs both workspaces |
| `npm run db:migrate` | Creates tables and indexes (safe to re-run) |
| `npm run db:seed` | Loads 8 products, 12 videos, ~900 events |
| `npm run db:reset` | Drops everything, re-migrates, re-seeds |
| `npm run dev` | Runs API + dashboard together |
| `npm run dev:server` | API only, on port 4000 |
| `npm run dev:client` | Dashboard only, on port 5173 |
| `npm test` | Runs the backend test suite (17 tests) |
| `npm run build` | Production build of the dashboard |

### Configuration

The API reads optional environment variables; every one has a working
default, so no `.env` file is required. See `server/.env.example`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` | API port |
| `DATABASE_PATH` | `data/analytics.db` | SQLite file, relative to `server/` |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed browser origin |

---

## Database design

Normalised to third normal form.

```
┌──────────────┐        ┌──────────────┐        ┌─────────────────────┐
│  products    │        │   videos     │        │  engagement_events  │
├──────────────┤        ├──────────────┤        ├─────────────────────┤
│ id       PK  │───┐    │ id       PK  │───┐    │ id             PK   │
│ name         │   └──<─│ product_id FK│   └──<─│ video_id       FK   │
│ price        │        │ video_url    │        │ event_type          │
│ created_at   │        │ title        │        │ timestamp           │
└──────────────┘        │ created_at   │        └─────────────────────┘
                        └──────────────┘
```

**Metrics are never stored.** There is no `views` column on `videos` — every
count is derived from `engagement_events` at query time. A denormalised
counter can drift out of sync with the event log it claims to summarise; a
derived count cannot.

**Constraints and indexes**

- `event_type` has a `CHECK (event_type IN ('view','click','add_to_cart'))`
  constraint — the API validates first, but this is the last line of defence
  for anything else that writes to the database.
- `PRAGMA foreign_keys = ON` is set on every connection. SQLite disables
  foreign keys by default and silently ignores `REFERENCES` without it.
- Composite index on `engagement_events (video_id, event_type)` — the exact
  shape of the dashboard aggregation, so SQLite serves it from the index
  instead of scanning the events table.
- `ON DELETE CASCADE` stops the event log outliving its video.

---

## API reference

Base URL: `http://localhost:4000`

### `POST /api/events`

Ingests one engagement event, standing in for storefront webhook traffic.

```bash
curl -X POST http://localhost:4000/api/events \
  -H "Content-Type: application/json" \
  -d '{"videoId": 1, "eventType": "add_to_cart"}'
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `videoId` | integer | yes | Accepts `1` or `"1"` |
| `eventType` | enum | yes | `view` \| `click` \| `add_to_cart` |
| `timestamp` | ISO 8601 string | no | Defaults to now; lets a webhook replay historical events |

**`201 Created`**

```json
{ "data": { "id": 902, "videoId": 1, "eventType": "add_to_cart", "timestamp": "2026-08-25 20:00:53" } }
```

**Errors** — `400` invalid body (with per-field `details`), `404` unknown
`videoId`. The video is checked explicitly so a bad id returns a clear 404
rather than a raw `SQLITE_CONSTRAINT_FOREIGNKEY` surfacing as a 500.

### `GET /api/analytics/videos`

Videos with aggregated metrics, paginated.

```bash
curl "http://localhost:4000/api/analytics/videos?page=1&limit=10&sortBy=views&order=desc"
```

| Param | Default | Allowed |
|-------|---------|---------|
| `page` | `1` | ≥ 1 |
| `limit` | `10` | 1–100 (capped so one request cannot pull the whole table) |
| `sortBy` | `views` | `views`, `clicks`, `conversions`, `title`, `createdAt` |
| `order` | `desc` | `asc`, `desc` |

**`200 OK`**

```json
{
  "data": [
    {
      "id": 1,
      "title": "Styling the Aurora Shirt 3 Ways",
      "videoUrl": "https://cdn.videoselz.example/styling-the-aurora-shirt-3-ways.mp4",
      "productId": 1,
      "productName": "Aurora Linen Shirt",
      "productPrice": 89,
      "views": 93,
      "clicks": 31,
      "conversions": 18
    }
  ],
  "pagination": {
    "page": 1, "limit": 10, "total": 12, "totalPages": 2,
    "hasNextPage": true, "hasPreviousPage": false
  }
}
```

### Supporting endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/analytics/summary` | Site-wide totals for the dashboard header |
| `GET /api/videos` | `id` + `title` only; the dashboard uses it to pick a random simulation target |
| `GET /health` | Liveness check |

---

## The aggregation query

The core of the assignment, in `server/src/services/analytics.service.js`:

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

Why it is written this way:

- **`LEFT JOIN` on events** — an `INNER JOIN` would silently drop videos with
  zero traffic, which a merchant still needs to see.
- **`COUNT(CASE WHEN …)` rather than `SUM(CASE … ELSE 0)`** — `COUNT` ignores
  `NULL`, so an eventless video yields `0`, not `NULL`.
- **One pass, not three subqueries** — three correlated subqueries would scan
  `engagement_events` three times; this scans the index once.
- **`GROUP BY v.id` is essential** — joining products *and* events without it
  produces one row per event, inflating every metric. There is a regression
  test that sums all page metrics against `COUNT(*)` on the events table.
- **`ORDER BY …, v.id ASC`** — the tiebreaker makes ordering deterministic.
  Without it two videos with equal views can swap between the page-1 and
  page-2 requests, so a row appears twice or is skipped.
- **`sortBy` is whitelisted, never interpolated.** SQL cannot bind a
  parameter in `ORDER BY`, so user input is mapped through a fixed allowlist.
  A test asserts `?sortBy=id;DROP TABLE videos` returns 400 and leaves the
  table intact.

Total row count is a separate `COUNT(*)`, not `COUNT(*) OVER ()`, which would
force SQLite to materialise every group before `LIMIT` takes effect.

---

## Frontend notes

- **Conversion rate is calculated in the browser** (`add_to_cart ÷ views`), as
  the brief specifies. The API returns raw counts only.
- **A video with zero views shows `—`, not `0.0%`.** "Nobody converted" and
  "nobody watched" are different facts, and rendering 0% would misrepresent
  an untrafficked video as underperforming. The seed data deliberately
  includes one such video so this path is always visible.
- **Simulate traffic** fires a weighted random event (70% view / 20% click /
  10% add-to-cart) at `POST /api/events`, then refreshes the table. A uniform
  draw would give every video a ~33% conversion rate and make the dashboard
  meaningless. `Burst ×25` fires 25 at once for a visible jump.
- **Refresh dims the table rather than emptying it**, so numbers stay readable
  while new ones load. A request-id guard prevents a slow earlier response
  from overwriting newer data.
- **Accessibility** — real `<table>` semantics with `scope`, `aria-sort`, a
  visually-hidden `<caption>`, `role="status"` for simulation feedback, and
  visible focus rings. `prefers-reduced-motion` disables all transitions.
- **Scrolling is contained inside the table card**, on both axes. The card
  caps its height so rows scroll in place rather than pushing the pagination
  controls off-screen, and the column headers are `position: sticky` so they
  stay visible. The page body never scrolls sideways.
- **Light / dark theme** with a three-state switch — Auto (follows your OS),
  Light, Dark — persisted in `localStorage`. An inline script in `index.html`
  applies the saved choice before first paint, so dark-mode users never see a
  white flash. Design tokens are CSS custom properties defined once as a SCSS
  mixin and emitted for both `prefers-color-scheme` and `[data-theme]`.
- **Responsive** — stat cards reflow via an `auto-fit` grid; the theme
  switch drops to icons only on phones.

---

## Testing

```bash
npm test
```

17 tests, run against an in-memory SQLite database so they never touch your
development data.

Coverage includes event ingestion and validation, 404 on unknown video,
aggregation correctness, the join fan-out regression test, pagination
completeness (no repeated or dropped rows across pages), sort ordering, and
the SQL-injection probe on `sortBy`.

---

## Project structure

```
shoppable-video-analytics/
├── README.md
├── AI_PROMPTING.md          # required log of AI interactions
├── docs/PROGRESS.md         # step-by-step build log with reasoning
├── package.json             # npm workspaces + orchestration scripts
├── server/
│   ├── src/
│   │   ├── app.js           # express app factory (no port binding)
│   │   ├── server.js        # entrypoint
│   │   ├── config.js
│   │   ├── schemas.js       # zod request schemas
│   │   ├── db/              # schema.sql, migrate, seed, connection
│   │   ├── routes/
│   │   ├── services/        # the aggregation lives here
│   │   └── middleware/      # validation + error handling
│   └── tests/
└── client/
    └── src/
        ├── App.jsx
        ├── api/client.js
        ├── hooks/useAnalytics.js
        ├── utils/format.js
        ├── components/      # StatCard, VideoTable, Pagination, SimulateTrafficButton
        └── styles/          # design tokens + mixins
```

---

## Trade-offs and what I would do next

Deliberately out of scope for a take-home, and what would come first in a
real build:

- **No authentication or multi-tenancy.** A real merchant dashboard scopes
  every query by store id; that would be the first schema change.
- **Aggregation is computed per request.** Correct and fast at this data
  volume, but at millions of events per video the read would move to a rollup
  table refreshed on a schedule, with the live query kept as the source of
  truth for reconciliation.
- **No date-range filter.** The `timestamp` index is already in place for it.
- **Frontend has no component tests.** Backend correctness was the higher
  risk, so the test budget went there.
- **Polling, not streaming.** The table refreshes on demand; live updates
  would use SSE or WebSockets.

---

## Deployment

The whole project deploys as **one service**: in production the Express
process serves the built React app as well as the API, so there is a single
URL and no CORS configuration.

**Serverless hosts do not work for this.** Vercel and Netlify functions have an
ephemeral filesystem, so the SQLite file is discarded between invocations and
the dashboard would lose data unpredictably. A long-running Node service is
required.

### Render (free tier)

The repository includes `render.yaml`, so Render can configure itself:

1. Push the branch to GitHub.
2. On https://render.com choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml` and creates the service. Click **Apply**.

Or configure a Web Service manually:

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Build command | `npm install --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` |
| Env var | `NODE_ENV=production` |

### How production differs from development

| | Development | Production |
|---|---|---|
| Frontend | Vite dev server on :5173 with HMR | Static build served by Express |
| Origins | Two (proxy handles `/api`) | One |
| Database | `npm run db:reset` by hand | Migrated on boot, seeded if empty |

`NODE_ENV=production` switches on static file serving and seed-on-boot.

### The ephemeral filesystem caveat

Render's free tier resets the disk on every restart and redeploy, so the
SQLite file does not survive. The server handles this by seeding on boot
**only when the database is empty** — a redeployed demo is always populated,
and existing data is never overwritten.

Events created by the Simulate Traffic button therefore persist for the life
of the instance, not beyond it. For durable storage, attach a Render disk
mounted at `server/data` and set `SEED_ON_BOOT=false`.

Free instances also sleep after ~15 minutes idle, so the first request after a
quiet period takes 30–60 seconds to wake. Worth mentioning to anyone you share
the link with.
