# AI Collaboration & Prompt Engineering Log

This document records how I used an AI assistant to build the Shoppable Video
Analytics Dashboard, as required by section 4 of the assignment brief.

**Primary tool:** Claude Code CLI (Claude Opus 5), running inside VS Code.

---

## How to read this log

Entries appear in the order the work happened, beginning with planning and
ending with the final UI revision. Each one follows the four-part structure the
brief asks for:

1. **Tool used**
2. **Context / task** — what I was trying to achieve
3. **Exact prompt used** — reproduced verbatim
4. **Outcome & adjustments** — what came back, what I changed, what I verified

**A note on the prompts.** They are pasted exactly as I typed them, including
typos and informal phrasing. I chose not to tidy them up: the brief asks for
the actual text I provided, and a log of polished prompts would not be an
honest record of the conversation. The commentary around them is my own
writing.

**A note on review.** I read every line before committing it. Where the first
answer was wrong, incomplete, or a poor fit, the correction is recorded rather
than quietly removed — the failures are the most useful part of this log, and
several of them are the parts I would most want to be asked about.

### Index

| # | Phase | What it covers |
|---|-------|----------------|
| 1 | Planning | Turning the brief into an architecture and a commit plan |
| 2 | Database | Schema design and the reasoning behind it |
| 3 | Backend | The aggregation query at the centre of the assignment |
| 4 | Debugging | A native module that would not install |
| 5 | Debugging | A configuration bug that appeared only under test |
| 6 | Workflow | Branching strategy and keeping the work reviewable |
| 7 | Frontend | Rebuilding a plain UI into a multi-view dashboard |
| — | Retrospective | What I learned about prompting on this project |

---

## 1 — Planning before any code

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** I wanted the architecture and a plan agreed before a single
file was written, rather than discovering structural problems halfway through.
I attached the assignment PDF and asked for a plan first.

**Exact prompt used:**

```
[assignment PDF attached]

i want to create an given assisment first create a plan to do this task
everything should plan properly create a repo inside
https://github.com/himanshu60?tab=repositories
```

**Outcome & adjustments:**

The assistant produced a complete plan before writing anything: an
npm-workspace monorepo, an Express and `better-sqlite3` backend, a React and
Vite frontend using SCSS Modules, a normalised three-table schema, and a
sequence of roughly fourteen commits.

Two things in that plan told me it had actually read the brief rather than
pattern-matching a generic dashboard:

- It identified the **no-Tailwind constraint** and proposed SCSS Modules
  specifically to satisfy it.
- It checked my environment first, found the GitHub CLI was not installed, and
  **asked how I wanted the repository created** instead of assuming.

**What I changed:** it offered to install the GitHub CLI through winget. I
declined, created the repository myself, and had it push to that remote — which
kept the local build moving while I handled the account side.

**What I would do differently:** my prompt did not mention the seven-to-eight
hour budget, or ask it to flag anything it considered out of scope. Stating
that up front would have saved a later conversation about how far to take the
UI.

---

## 2 — Database schema

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** Designing the normalised schema for Products, Videos and
EngagementEvents — and, more importantly, getting the reasoning behind each
decision so that I could defend it.

**Exact prompt used:**

```
Design a normalized SQL database with Products, Videos and EngagementEvents.
Metrics must be derived, not stored. Explain the indexing choices.
```

**Outcome & adjustments:**

The generated schema was sound. Three decisions I checked carefully and kept:

1. **`PRAGMA foreign_keys = ON` is applied per connection.** SQLite disables
   foreign keys by default and silently ignores `REFERENCES` clauses without
   it, which would have made the constraints purely decorative. I confirmed it
   is set in `db/index.js` on every connection open, not only in the schema
   file.

2. **No stored counters.** There is no `views` column on `videos`; every count
   is derived from the event log at query time. A denormalised counter can
   drift away from the events it claims to summarise — through a failed
   transaction, a double increment, or a manual edit — whereas a derived count
   cannot.

3. **A composite index on `(video_id, event_type)`.** I questioned whether two
   single-column indexes would serve just as well. They would not: the
   dashboard aggregation filters on both columns together, and only the
   composite index lets SQLite answer it without scanning the events table.

**Why I phrased the prompt this way:** "Explain the indexing choices" was the
important half. Asking for the schema alone would have produced working DDL
that I could not have justified in a review.

---

## 3 — The aggregation query

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** Writing the query behind `GET /api/analytics/videos` — per
video view, click and add-to-cart totals, with pagination. This is the centre
of the assignment, so I named the failure modes I wanted avoided rather than
leaving the approach open.

**Exact prompt used:**

```
Write the aggregation for GET /api/analytics/videos: per-video totals for
view, click and add_to_cart, joined to the product, with LIMIT/OFFSET
pagination. Videos with zero events must still appear. Avoid a join fan-out
and avoid three separate subqueries. Explain each clause.
```

**Outcome & adjustments:**

It produced a single-pass query using `COUNT(CASE WHEN ... THEN 1 END)` with a
`LEFT JOIN`, and explained each clause. Points I verified independently:

- **`LEFT JOIN` rather than `INNER JOIN`.** An inner join silently drops videos
  that have no events. I confirmed the behaviour against the seeded zero-event
  video.
- **`COUNT(CASE ...)` rather than `SUM(CASE ... ELSE 0)`.** `COUNT` ignores
  `NULL`, so a video with no events returns `0` instead of `NULL`.
- **The fan-out risk.** Joining products *and* events without `GROUP BY v.id`
  produces one row per event and inflates every metric. I wrote a regression
  test that sums the page metrics and compares them against `COUNT(*)` on the
  events table, so this cannot silently return.

**Two corrections I made:**

1. The first version ordered only by `views DESC`. That is non-deterministic
   when two videos have equal view counts — SQLite may order them differently
   between the page-one and page-two requests, so a row can appear twice or be
   skipped entirely. I added `v.id ASC` as a tiebreaker.

2. The total row count is fetched as a separate `COUNT(*)` rather than
   `COUNT(*) OVER ()` inside the main query, which would force SQLite to
   materialise every group before `LIMIT` could take effect.

**Prompting note:** naming the two anti-patterns I wanted avoided produced a
better first answer than asking for "an efficient aggregation" would have.
Constraints are easier for a model to act on than adjectives.

---

## 4 — Debugging: a native module that would not install

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** `npm install` failed while building `better-sqlite3`.

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

**Outcome & adjustments:**

It diagnosed the cause correctly: `better-sqlite3@11` publishes no prebuilt
binary for Node 24, so npm fell back to compiling from source. It offered three
options — install the Build Tools, switch to the `sqlite3` package, or upgrade
to `better-sqlite3@13`, which ships Node 24 prebuilds.

I chose the upgrade. It keeps the clean synchronous API and, more importantly,
removes the toolchain requirement for anyone cloning the repository. I verified
the fix by opening an in-memory database and running a real insert before
moving on.

**A related issue found in the same session:** npm 11.17 blocks package install
scripts by default, so `esbuild` never unpacked the binary that Vite depends
on. I resolved it with an explicit `allowScripts` entry in the root
`package.json`. Notably, `better-sqlite3`'s own install script is left blocked
on purpose — it exists only to trigger the source build we are avoiding, and
the prebuilt binary works without it.

**Prompting note:** stating the constraint ("a reviewer shouldn't need them
either") is what produced three ranked options instead of "install Build
Tools" — an answer that would have solved my problem and created one for
everybody else.

---

## 5 — Debugging: a bug that appeared only under test

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** The entire test suite failed on its first run, while the
application itself worked normally.

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

**Outcome & adjustments:**

A genuine bug, and one that surfaced only because the tests run under a
different configuration than development does. `config.js` called
`path.resolve(SERVER_ROOT, databasePath)` unconditionally, which turned the
SQLite sentinel `:memory:` into a literal path — `C:\...\server\:memory:` —
which is not a legal Windows filename.

The fix was to special-case `:memory:` before resolving. All tests passed
afterwards.

**Why this entry is here:** it makes the case for running tests under a
configuration that differs from the one you develop in. A path-handling bug
that development would never have surfaced was caught on the first test run.

**Prompting note:** I supplied the symptom, the environment difference, and the
fact that the normal path worked. Framing the question as "what is different
under test?" pointed the assistant at the configuration layer immediately,
rather than at the database code the stack trace named.

---

## 6 — Workflow: branching and reviewability

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** Keeping feature work off `main` so the project reads as a
reviewable pull request, and getting the working files visible in my editor.

**Exact prompt used:**

```
continue changes and it should visible in my vs code every changes and make
not comit in main repo create seprate branch and everytime up to date no
conflict no those changes you done i am unable to see and every step should
be noted and i want proper understanding of every step
```

**Outcome & adjustments:**

It moved the existing commits onto `feature/analytics-dashboard` and rewound
`main` to the initial scaffold commit, leaving `main` as a clean baseline. It
then verified that the feature branch was **zero commits behind** `main` and
explained why that guarantees a fast-forward merge with no possibility of
conflict — which is what I had asked for, stated as a property rather than a
promise.

It also diagnosed why the files were invisible in my editor: the VS Code
workspace was open at `C:\Users\DELL`, my entire home folder, while the project
sat in a subfolder I had never opened.

**This prompt also produced `docs/PROGRESS.md`,** the step-by-step build log
recording what was done at each stage, why that approach was chosen, and how to
verify it.

**A later consequence worth recording:** when I created the GitHub repository,
I initialised it with a README, which meant the remote held a commit unrelated
to my local history and a plain push would have been rejected. Rather than
force-pushing over my own commit, the assistant rebased the entire local
history onto it and resolved the single resulting `README.md` conflict in
favour of the full version. The repository root is still my original "Initial
commit".

---

## 7 — Rebuilding the UI into a multi-view dashboard

**Tool used:** Claude Code CLI (Claude Opus 5)

**Context / task:** The first dashboard met every requirement in the brief but
looked plain — four large, mostly empty stat cards, a single table, no data
visualisation, and everything on one screen.

**Exact prompt used:**

```
but still UI not looks good and verify everything is covered as per
assignment because on ui i am only able to see single screen I am using a
premium model but ui looks very simple like as a beginner develop
```

**Outcome & adjustments:**

It first re-checked the brief and confirmed that every technical requirement
was already implemented — the criticism was about presentation, not
completeness — and then asked which direction I wanted before building
anything. I chose the multi-view option.

What it delivered: three new API endpoints (a daily time series with
zero-filled gaps, a video detail endpoint, and a recent-events feed), a set of
hand-written inline SVG charts with no charting library, a funnel visual,
sparklines in the stat cards, magnitude bars in the table, and a slide-over
detail panel for each video.

**The part of this session I most want to be asked about.** It captured
screenshots of every view in both themes and found three defects by examining
the rendered output — all of which had passed the full test suite:

1. **The activity feed was ordered by insertion id while displaying
   timestamps.** Seeded rows receive random timestamps with sequential ids, so
   a feed labelled "newest first" showed dates jumping around: 25/8, 25/8,
   16/8, 03/8, 29/7. The query now orders by timestamp.

   The more useful half of this finding: my existing test asserted that the
   returned **ids** were descending. It passed the entire time the feed was
   visibly wrong, because it was asserting the wrong property. The test now
   asserts on timestamps.

2. **The chart collapsed at its right edge.** The final day of the window is
   still in progress, so a partial count sat directly beside completed days and
   read as a crash — and drove a false "−25.4%" on the views card. That final
   segment is now drawn dashed and labelled, and is excluded from both the
   period delta and the sparklines.

3. **The trend line was flat and lifeless,** because seed timestamps were
   distributed uniformly across thirty days. They are now skewed toward the
   present, which is both more realistic for a storefront gaining traction and
   gives the period-over-period comparison something real to report.

**An adjustment I asked for:** I did not want the chart colours chosen by eye.
It ran a palette validator for colour-blind separation against both the light
and dark surfaces — all-pairs CVD ΔE 9.2 light and 9.4 dark — and flagged that
the aqua series sits at 2.82:1 contrast on the white card, below the 3:1
threshold. That is why the charts ship direct labels and a table view rather
than relying on hue alone.

**Prompting note:** this is the one place where a vague prompt worked in my
favour. "Looks like a beginner developed it" carries no specification, and the
assistant responded by asking a single clarifying question with three concrete
options rather than guessing. Had it guessed, I would probably have received
polish on a layout I wanted replaced.

---

## Retrospective: what I learned about prompting

Since the brief is explicitly assessing how I work with these tools, this is
what I would carry into the next project.

**Constraints beat adjectives.** "Avoid a join fan-out and avoid three separate
subqueries" produced a better first answer than "write an efficient query"
would have. Naming the failure modes gives the model something to check its own
output against.

**Ask for the reasoning, not just the code.** Appending "explain each clause"
or "explain the indexing choices" cost nothing, and it is the reason I can
defend these decisions in a review. It also surfaces flawed reasoning early: an
explanation that does not hold up is a signal to look harder at the code
beneath it.

**State the constraint behind the request.** Saying "a reviewer cloning this
repository shouldn't need Visual Studio either" turned a one-line answer into
three ranked options, and led to the choice that was right for everyone rather
than only for my machine.

**Describe the difference, not just the failure.** "The application works
normally but every test fails, and the tests set `DATABASE_PATH=:memory:`"
located a configuration bug immediately. The stack trace alone pointed at the
database layer, which was not where the fault lay.

**A passing test suite is not evidence that the result is correct.**
Twenty-nine tests were green while the activity feed displayed dates out of
order, because the test asserted on ids rather than on the timestamps actually
being rendered. Those defects were found by generating screenshots and looking
at them. I now treat "render it and look at it" as a required step rather than
an optional one.
