# AI Collaboration & Prompt Engineering Log

A running log of the AI interactions used to build this project, as required
by section 4 of the assignment brief.

**Primary tool:** Claude Code CLI (Claude Opus 5) running inside VS Code.

Every line of generated code was reviewed before being committed. Where the
AI's first output was wrong or suboptimal, the correction is recorded below
rather than quietly edited out — the failures are the interesting part.

---

## Entry 1 — Project planning and architecture

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / Task:** Turn the assignment PDF into a concrete technical plan
before writing any code — stack selection, folder structure, schema design
and a commit sequence.

**Exact prompt used:**

```
[assignment PDF attached]

i want to create an given assisment first create a plan to do this task
everything should plan properly create a repo inside
https://github.com/himanshu60?tab=repositories
```

**Outcome & Adjustments:**

The AI produced a full plan: npm-workspace monorepo, Express + `better-sqlite3`
backend, React + Vite frontend with SCSS Modules, and a ~14-commit progression.

It correctly picked up the two hard constraints in the brief — SQLite, and
**no Tailwind** — and proposed SCSS Modules to satisfy the styling rule.

Before starting it checked the environment and found the GitHub CLI was not
installed, then asked how the repo should be created rather than assuming.
I chose to create the empty GitHub repo myself and have it push to that remote.

Adjustment I made: it offered to install the GitHub CLI via winget; I declined
and opted to create the repo manually, keeping the local build unblocked.

---

## Entry 2 — Database schema design

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / Task:** Design the normalised schema for Products, Videos and
EngagementEvents.

**Prompt (part of the planning instruction above; the AI proposed and I
reviewed the design):**

```
Design a normalized SQL database with Products, Videos and EngagementEvents.
Metrics must be derived, not stored. Explain the indexing choices.
```

**Outcome & Adjustments:**

The generated schema was sound. Three details I specifically checked and kept:

1. **`PRAGMA foreign_keys = ON` set per connection.** SQLite disables foreign
   keys by default and silently ignores `REFERENCES` clauses without it. Easy
   thing to leave out and never notice — I confirmed it is applied in
   `db/index.js` on every connection open, not just in the schema file.

2. **No stored counters.** No `views` column on `videos`. I agreed with this:
   a denormalised counter can drift from the event log it summarises.

3. **Composite index on `(video_id, event_type)`.** I questioned whether two
   single-column indexes would do. They would not — the aggregation filters on
   both columns together, so the composite index is what lets SQLite serve the
   query from the index instead of scanning the events table.

---

## Entry 3 — The SQL aggregation query

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / Task:** Write the aggregation behind
`GET /api/analytics/videos` — per-video view/click/conversion totals with
pagination.

**Exact prompt used:**

```
Write the aggregation for GET /api/analytics/videos: per-video totals for
view, click and add_to_cart, joined to the product, with LIMIT/OFFSET
pagination. Videos with zero events must still appear. Avoid a join fan-out
and avoid three separate subqueries. Explain each clause.
```

**Outcome & Adjustments:**

The AI produced a single-pass query using `COUNT(CASE WHEN ... THEN 1 END)`
with a `LEFT JOIN`, and explained the tradeoffs. Points I verified myself:

- **`LEFT JOIN` vs `INNER JOIN`** — with `INNER JOIN`, videos with no events
  disappear entirely. Confirmed against the seeded zero-event video.
- **`COUNT(CASE ...)` vs `SUM(CASE ... ELSE 0)`** — `COUNT` skips `NULL`, so
  an eventless video yields `0`, not `NULL`.
- **The fan-out risk** — joining products *and* events without `GROUP BY v.id`
  yields one row per event and inflates every metric. I wrote a regression test
  that sums all page metrics and compares against `COUNT(*)` on the events
  table, so this can never silently regress.

**One change I made:** the first version had `ORDER BY views DESC` alone.
That is non-deterministic when two videos have equal view counts — SQLite may
order them differently between the page-1 and page-2 requests, so a row can
appear twice or be skipped. I added `v.id ASC` as a tiebreaker.

**Second change:** total count is a separate `COUNT(*)` rather than
`COUNT(*) OVER ()` in the main query, which would force SQLite to materialise
every group before `LIMIT` could take effect.

---

## Entry 4 — Debugging: native module build failure

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / Task:** `npm install` failed while building `better-sqlite3`.

**The error:**

```
gyp ERR! stack Error: Could not find any Visual Studio installation to use
gyp ERR! cwd ...\node_modules\better-sqlite3
gyp ERR! node -v v24.19.0
```

**Exact prompt used:**

```
npm install fails building better-sqlite3 with "Could not find any Visual
Studio installation to use" on Node 24, Windows. I don't want to install
Visual Studio Build Tools — a reviewer cloning this repo shouldn't need them
either. What are the options?
```

**Outcome & Adjustments:**

The AI identified the cause correctly: `better-sqlite3@11` publishes no
prebuilt binary for Node 24, so npm fell back to compiling from source. It
gave three options — install Build Tools, switch to the `sqlite3` package, or
upgrade to `better-sqlite3@13`, which ships Node 24 prebuilds.

I chose the upgrade: it keeps the clean synchronous API and removes the
toolchain requirement for anyone cloning the repo. Verified by opening an
in-memory database and running a real insert before moving on.

**Follow-on issue found during the same session:** npm 11.17 blocks package
install scripts by default, so `esbuild` (required by Vite) never unpacked its
binary. Resolved with an explicit `allowScripts` entry in the root
`package.json`. Notably, `better-sqlite3`'s install script is left blocked on
purpose — it only triggers the source build we are avoiding, and the prebuilt
binary works without it.

---

## Entry 5 — Debugging: `:memory:` treated as a file path

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / Task:** The entire test suite failed on first run.

**The error:**

```
SqliteError: unable to open database file
 ❯ new Database ../node_modules/better-sqlite3/lib/database.js:58:27
 ❯ getDb src/db/index.js:22:8
```

**Exact prompt used:**

```
All 17 tests fail with "unable to open database file". The tests set
DATABASE_PATH=:memory:. The app works fine when run normally against the
file-backed database. What is different under test?
```

**Outcome & Adjustments:**

Genuine bug, caught only because the tests run under a different
configuration than development does. `config.js` was calling
`path.resolve(SERVER_ROOT, databasePath)` unconditionally, which turned the
SQLite sentinel `:memory:` into a literal path — `C:\...\server\:memory:` —
which is not a legal Windows filename.

Fix: special-case `:memory:` before resolving. All 17 tests passed afterwards.

I kept this entry in the log because it is a good argument for running tests
under a non-default configuration: a file-path bug that development would
never surface.

---

## Entry 6 — Workflow: branching and visibility

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / Task:** Restructure the repository so no feature work lands
directly on `main`, and make the working files visible in the editor.

**Exact prompt used:**

```
continue changes and it should visible in my vs code every changes and make
not comit in main repo create seprate branch and everytime up to date no
conflict no those changes you done i am unable to see and every step should
be noted and i want proper understanding of every step
```

**Outcome & Adjustments:**

The AI moved all six existing commits onto `feature/analytics-dashboard` and
rewound `main` to the initial scaffold commit, leaving `main` as a clean
baseline. It verified the branch is **0 commits behind** `main`, which is why
merging later is a fast-forward with no possibility of conflict.

It also diagnosed why the files were invisible in the editor: the VS Code
workspace was open at `C:\Users\DELL` (the whole home folder) while the
project sits in a subfolder that had never been opened. Fixed by opening the
project folder directly.

This prompt is also what produced `docs/PROGRESS.md`, the step-by-step build
log explaining the reasoning behind each decision.

---
