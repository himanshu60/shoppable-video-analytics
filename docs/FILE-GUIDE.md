# File guide

What every file in this repository is for, and why it exists. Read top to
bottom to understand the shape of the project.

---

## Root

| File | Purpose |
|------|---------|
| `README.md` | Setup instructions, API reference, schema, design decisions. The reviewer's entry point. |
| `AI_PROMPTING.md` | Required by the brief: the log of AI interactions, with the real prompts and what was changed after review. |
| `package.json` | Root of the npm **workspace**. Declares `server` and `client` as sub-packages and holds the orchestration scripts (`npm run dev` starts both). |
| `package-lock.json` | Exact dependency versions, so a clone installs what was tested. Committed on purpose. |
| `.gitignore` | What must never reach the repository — see the section at the bottom. |
| `.gitattributes` | `* text=auto eol=lf` — keeps line endings consistent between Windows and the reviewer's machine. |
| `render.yaml` | Deployment blueprint for Render: build command, start command, health check, environment. |

---

## `server/` — the API

### Entry points

| File | Purpose |
|------|---------|
| `src/server.js` | Boots the app: runs migrations, seeds if the database is empty, binds the port. The only file that opens a network socket. |
| `src/app.js` | Builds the Express app **without** binding a port. Separated so tests can drive it in-process — no free port needed, no server to start and stop. |
| `src/config.js` | Reads environment variables once and exposes typed settings. Also holds `EVENT_TYPES`, the single source of truth for the three allowed event types. |
| `src/schemas.js` | Zod schemas for every request shape. Validation lives here rather than in route handlers, so the rules are readable in one place. |

### `src/db/` — everything that touches SQLite

| File | Purpose |
|------|---------|
| `schema.sql` | The tables, constraints and indexes, as plain SQL. Kept as `.sql` rather than JavaScript so it reads as a schema. |
| `index.js` | Opens and memoises the connection. Enables foreign keys and WAL mode — both are per-connection settings in SQLite, not schema settings. |
| `migrate.js` | Applies `schema.sql`. Idempotent; `--fresh` drops the tables first. |
| `seed.js` | Loads sample data: 8 products, 12 videos, ~900 weighted events. |
| `inspect.js` | Read-only CLI for looking at the data (`npm run db:inspect`). Opened read-only so it cannot corrupt anything while the API runs. |
| `add.js` | CLI for adding a product or video (`npm run db:add`). A script rather than an endpoint, so the HTTP surface stays limited to analytics reads. |

### `src/routes/` — HTTP shape only

| File | Purpose |
|------|---------|
| `events.routes.js` | `POST /api/events`. Validates, checks the video exists, delegates to the service. |
| `analytics.routes.js` | `GET /api/analytics/videos`, `/summary`, `/timeseries`, plus the video and event-feed routes. |

Routes decide *status codes and shapes*. They contain no SQL.

### `src/services/` — the business logic

| File | Purpose |
|------|---------|
| `analytics.service.js` | **The most important file in the project.** Holds the aggregation query behind the dashboard, plus the time-series and detail queries. |
| `events.service.js` | Inserting an event, and checking a video exists. |

Services own the SQL. This is why the aggregation can be read and reasoned
about without wading through HTTP handling.

### `src/middleware/`

| File | Purpose |
|------|---------|
| `validate.js` | Runs a Zod schema against part of a request and replaces it with the parsed result, so handlers receive coerced values rather than raw strings. |
| `errors.js` | `HttpError`, the 404 handler, and the central error handler. One place decides how errors are shaped, and 5xx stack traces are logged but never sent to the client. |

### `tests/`

| File | Purpose |
|------|---------|
| `events.test.js` | Event ingestion: valid writes, bad event types, missing fields, unknown video ids. |
| `analytics.test.js` | The aggregation: correctness, pagination completeness, sorting, the join fan-out regression test, and a SQL-injection probe on `sortBy`. |
| `dashboard.test.js` | The newer endpoints: time series gap-filling, video detail, the events feed. |
| `vitest.config.js` | Points the suite at an in-memory database so tests never touch real data. |

---

## `client/` — the dashboard

| File | Purpose |
|------|---------|
| `index.html` | Page shell. Also carries the inline script that applies the saved theme **before first paint**, so dark-mode users get no white flash. |
| `vite.config.js` | Dev server config, including the `/api` proxy to port 4000 — which is why client code uses origin-relative paths and needs no CORS in development. |
| `src/main.jsx` | Mounts React. |
| `src/App.jsx` | The shell: sidebar, top bar, routing between views, and the shared data state. |

### `src/api/`

`client.js` — the only file that knows about HTTP. One `request()` wrapper
handles errors consistently; everything else calls named functions like
`fetchVideoAnalytics()`. Changing an endpoint touches this file alone.

### `src/hooks/`

| File | Purpose |
|------|---------|
| `useAnalytics.js` | Owns the dashboard's main data fetch and its loading/error state. |
| `useResource.js` | Generic single-resource fetcher used by the chart and feed. |
| `useTheme.js` | Auto / light / dark preference, persisted to `localStorage`. |
| `useHashRoute.js` | ~30-line hash router. Three routes did not justify a routing dependency. |
| `useElementWidth.js` | Reports a container's width so charts render in real pixels rather than a scaled viewBox. |

### `src/components/`

One folder per component, each with its `.jsx` and its `.module.scss` beside
it — so a component and its styles move, and are deleted, together.

| Component | Purpose |
|-----------|---------|
| `VideoTable/` | The data table: metrics, conversion rate, sortable headers, inline bars. |
| `StatCard/` | One headline metric with a sparkline and a period delta. |
| `Pagination/` | Page controls, driven entirely by the server's pagination metadata. |
| `SimulateTrafficButton/` | Fires weighted random events at `POST /api/events`, then refreshes. |
| `ActivityFeed/` | The live event list. |
| `VideoDetail/` | The slide-over panel for one video. |
| `Sidebar/` | Navigation between the three views. |
| `ThemeToggle/` | Auto / Light / Dark switch. |
| `charts/` | `AreaChart`, `Sparkline`, `Funnel`, `ChartLegend`, and `series.js` — which fixes each metric's colour so a series never changes hue between views. |

### `src/views/`

`OverviewView`, `VideosView`, `ActivityView` — each arranges components into a
page. They hold layout, not fetching.

### `src/utils/`

`format.js` — number, currency and percentage formatting, and the
**conversion-rate calculation**. The brief requires this on the frontend, so
this is the only place the ratio is derived.

### `src/styles/`

| File | Purpose |
|------|---------|
| `_tokens.scss` | Colour palettes as mixins. The dark palette is defined once and emitted into both the `prefers-color-scheme` block and the `[data-theme]` block. |
| `_mixins.scss` | Breakpoints, `visually-hidden`, focus ring. |
| `global.scss` | Resets, base typography, and the three-state theme wiring. |

---

## `docs/`

| File | Purpose |
|------|---------|
| `PROGRESS.md` | The build log: every step, why that approach was chosen, and how to verify it. |
| `FILE-GUIDE.md` | This file. |

---

## What `.gitignore` excludes, and why

| Pattern | Why it must not be committed |
|---------|------------------------------|
| `node_modules/` | Reinstallable from `package-lock.json`. Committing it would add tens of thousands of files. |
| `*.db`, `*.db-wal`, `*.db-shm`, `server/data/` | The database is a **build artifact**, rebuilt by `npm run db:reset`. A binary file in git bloats history and produces conflicts nobody can resolve. |
| `dist/`, `build/` | Compiled output. Regenerated by `npm run build`. |
| `.env`, `.env.local` | Secrets and machine-specific settings. `server/.env.example` is committed instead, documenting the variables without their values. |
| `*.log` | Noise. |
| `coverage/` | Generated by the test runner. |
| `.vite/` | Vite's dev cache. |
| `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db` | Editor and OS files. Personal to a machine, not to the project. |
| `*-transcript.md`, `*.local.md`, `notes/` | Local working notes. `AI_PROMPTING.md` is the curated log the brief asks for; a raw transcript is working material, not a deliverable. |

The rule behind all of these: **if a command can regenerate it, or it is
specific to one machine, it does not belong in the repository.**
