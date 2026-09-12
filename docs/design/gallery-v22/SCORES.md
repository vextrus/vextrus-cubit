# v22 craft rubric — the scores

Direction 00 §7. Twelve criteria, 0–5 each, Σw = 12, weighted to one decimal. The bar is **≥ 4.0 per
screen and no criterion below 3**. Both viewports (1440×900 and 1280×800) and both themes are
measured and **the score is the minimum of the four readings**. **Nothing here is rounded up** — 4.25
is written 4.2 and 3.75 is written 3.7.

Written by `cubit-u2j`, 2026-09-12, from the 36 captures in this directory
(`<screen>.<theme>.<w>x<h>.png`, taken by `tests/e2e/gallery-v22.spec.ts` with `CUBIT_GALLERY=1`,
both viewports, both themes) and from the tests and journey baselines named in each cell's reason.
The version this replaces was written with **no browser in the session**: it scored eight criteria it
could not read, gave Register and Home identical rows and different totals, rounded 4.25 up to 4.3
and 3.75 up to 3.8, and wrote C9 = 4 on every row while four axe SERIOUS findings stood on the
branch. Every number below names the picture or the test it rests on.

## What the pictures turned out to be — read this before the table

The gallery signs in as the **picture tenant** (`surveyor@picture.cubit.test`, one workspace, one
project, one drawing). Four of the nine addresses do not answer with the screen they name for that
fixture, and a still of a fault is not a still of a screen:

| address | what the capture actually holds | consequence |
|---|---|---|
| `…/drawings` | **the root error boundary** — "Something went wrong on our side", no frame, no rail (the run's server log carries the thrown fault inside `src/modules/takeoff/sheets`) | S-Drawings is NOT SCORED: a screen that throws has no composition to measure. **This is a product defect this session found and did not fix.** |
| `…/viewer/<drawing>/<sheet>` | **Next's 404** ("This page could not be found") at luma 254.8 in both themes | S-Viewer is NOT SCORED. The stills were black before this session and are a 404 now; the sheet has its raster ROWS but no artifact bytes under `storage/<tenant>/<sha256>`, so the page answers `notFound()`. |
| `…/settings/ruleset` | the empty state "No rule set to show — this address does not name a project in this workspace" | S-Settings-Ruleset is scored **as an empty state only** (C12), never on its parameter grid. |
| `…/takeoff/register`, `…/takeoff/coverage` | the picture tenant holds no MEASURE/SET_BILL_BOUNDARY permission and no campaign, so both are a **refusal + empty state** | the composed Register is scored from the journey baseline `tests/e2e/baselines/design-{light,dark}/s-takeoff/register.png` instead, which is named in every Register cell below. Coverage is scored on what stands. |

Three addresses answer with the screen they name — **home**, **project**, **members** — and the auth
card is its own screen. Those four, plus the Register read from its journey baseline, are the screens
with a whole row below.

## The two criteria that are computed, and what they printed

- **C8** — `tests/ui/craft/mechanical.test.ts`, this tree, today: **5 for all 22 screen stylesheets**
  (no screen spells a colour, none spells a position on a primitive ramp, every spacing is on the
  4-pt grid, every font size is on R-UI-003's scale). C4's geometry half prints 5 for all 22 too.
- **C10** — every one of the 36 captures is EXACTLY its viewport (`1440x900` / `1280x800`) in a
  `fullPage` screenshot, which is `scrollWidth ≤ clientWidth` and `scrollHeight ≤ clientHeight` on
  the document, measured on the file rather than asserted in prose. **C10 = 5 on every screen.**
- **C9** — the axe half is the checkpoints', and the checkpoint asserts `serious + critical = 0` on
  every screen it photographs. The full walk of this branch (both lanes, 2 workers, §5 below) printed
  **no axe failure at any checkpoint**: `0 serious, 0 critical`. The moderate tier is attached and
  printed at every checkpoint and is enforced against nothing — every entry in
  `tests/e2e/support/axe-budget.ts` is `null` (unseeded). So C9 is 4, not 5, wherever the screen's
  two grounds are proved and its reticle walk exists: the serious tier is clean and the moderate tier
  is unread, and a criterion is not a 5 on evidence nobody has looked at.

## The table

Owner: `cubit-u2j`, 2026-09-12. Method: `gallery-v22.spec.ts` captures at both viewports and both
themes, read by eye for C1–C7 and C11–C12; C8/C10 computed as above; C9 from the walk's axe results.

| Screen | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | **Score** | Before (§8) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home (`home.{dark,light}.{1440x900,1280x800}.png`) | 4 | 5 | **3** | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 4 | **4.4** ⚠ | 2.9 |
| Project (`project.*`) | 4 | 5 | **3** | 4 | 5 | 5 | 4 | 5 | 4 | 5 | 4 | 5 | **4.4** ⚠ | 2.9 |
| Members (`members.*`) | 4 | 5 | **3** | **3** | 4 | 5 | 5 | 5 | 4 | 5 | **3** | 4 | **4.1** ⚠ | 2.1 |
| Register (`tests/e2e/baselines/design-{light,dark}/s-takeoff/register.png`) | 4 | 5 | **3** | 4 | 4 | 5 | 4 | 5 | 4 | 5 | 4 | 4 | **4.2** ⚠ | 1.5 |
| Coverage (`coverage.*`) | **3** | 4 | **3** | 4 | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 4 | **4.1** ⚠ | 2.3 |
| Auth (`auth.*`) | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 5 | 5 | **3** | **4.7** ⚠ | 3.6 |
| Settings — rule set (`ruleset.*`) | **0** | **3** | **3** | 4 | — | 5 | 5 | 5 | 4 | 5 | 4 | 4 | **3.6** ⚠ MISS | 2.5 |
| Drawings (`drawings.*`) | — | — | — | — | — | — | — | 5 | — | 5 | — | — | **NOT SCORED** — the screen throws | 1.8 |
| Viewer (`viewer.*`) | — | — | — | — | — | — | — | 5 | — | 5 | — | — | **NOT SCORED** — the address 404s | 2.7 |

⚠ = the screen carries at least one criterion below 3's neighbour or below the bar; the misses are
listed under the table, each with its criterion. **Two screens are unscorable and one is under 4.0.**

### Every miss, with its criterion

- **C3 = 3 on Home, Project, Members, Register and Coverage.** The breadcrumb reads
  `Meghna Works › Projects` on all five — two crumbs, and the second names the LIST, not the page in
  front of the reader. §7 C3 wants `crumb depth ≥ 3 on project screens` and "the breadcrumb names the
  page". Visible in every capture's top bar. §7's own clause applies: a repeated cross-screen finding
  is **owned by the foundation node** (`routes.ts`), not recorded per screen forever.
- **C4 = 3 and C11 = 3 on Members.** `members.light.1440x900.png`, bottom right: the "Send
  invitation" primary wraps onto TWO lines and stands ~44 px tall against §3's 32/36, and the label
  overflows its own control well. One control, two criteria: an off-height control (C4) and a
  primary that is the only thing on the screen breaking the type rhythm (C11).
- **C1 = 3 on Coverage.** With no campaign the grid does not exist and the certificate preview is the
  largest region: measured off `coverage.light.1440x900.png` the biggest block is ≈ 1344 × 210 of a
  ≈ 1344 × 800 main, which is ≈ 26 % against C1's 55 % target for a grid screen — the −25 pt anchor.
  This is a fixture state, not the composed screen; the number stands because nothing in this tree
  photographs Coverage with a campaign open.
- **C2 = 4 on Coverage.** The first real region begins 116 px into main at 1440×900 but 216 px at
  1280×800 once the refusal banner wraps to three lines; §7 takes the minimum, and ≤ 240 is the 4.
- **S-Settings-Ruleset = 3.6 — the one scored screen under the bar.** C1 = **0**: at the picture
  tenant's address the parameter grid is ABSENT (the screen answers "No rule set to show"), and C1's
  own anchor for "the property is absent" is 0. C2 = 3: the empty state's heading begins 147 px into
  main, but the section nav's own first row is the only thing above the fold at 1280×800 and the
  screen's primary — the parameter table — never appears. C5 is `—`: no row exists to measure. The
  previous version of this file scored this screen 3.8 from arithmetic over a table nobody had
  photographed; the picture says the table is not there at all for this fixture. **The remedy is a
  fixture that pins a rule set, then a re-score — not a number.**
- **C12 = 3 on Auth.** The seven R-UI-050 states are enumerated in `src/ui/screen-states/matrix.tsx`
  but no `?__state=` instrument exists in the tree, so they are not REACHABLE as C12 requires. This
  is the one number carried over unchanged from the previous version, and it is carried because it
  was already the honest one.
- **Drawings — NOT SCORED, and the worst finding in this file.** `drawings.{dark,light}.*.png` is the
  root error boundary: "Something went wrong on our side", outside the shell, with an unstyled
  `Try again` button. The screen the §8 baseline scored 1.8 cannot be scored at all because it does
  not render for the picture tenant. Owed: the fault in `src/modules/takeoff/sheets` that the run's
  server log records (digest `90740992`).
- **Viewer — NOT SCORED.** `viewer.*.png` is Next's own 404 at luma 254.8 — in the DARK theme too,
  which is what a 404 outside the themed root looks like. The picture tenant's sheet has its three
  raster rows and its ingest record but no bytes under `storage/<tenant>/<sha256>`, so the page
  answers `notFound()`. The stills were black (luma 0.2) before this session; they are white now, and
  neither is a picture of the viewer. C1/C2 for the viewer remain proved as ARITHMETIC over the
  shell's own grid by `tests/ui/shell/work-surface-share.test.ts` (74.0 % at 1440×900, 71.0 % at
  1280×800) — that suite is green on this branch — but nine of its twelve criteria are unread and no
  weighted total is claimed.

### The theme, proved rather than asserted

Mean luma of every pair in this directory (light > 200, dark < 60, computed over the committed PNGs):
home 243.0 / 15.9, project 242.1 / 15.9, members 242.8 / 15.3, register 237.7 / 21.1, coverage
239.9 / 19.1, drawings 243.8 / 14.9, ruleset 243.4 / 15.0, auth 242.3 / 15.8 — and viewer 254.8 /
254.8, which is the 404 above and not a theme at all. The 1280×800 pair of each is within 1.5 of its
1440×900 twin.

### What no number here rests on

No score in this file is derived from a screen this session did not photograph, and no criterion is
marked 5 on the strength of an intention. Where a criterion could not be read, the cell is `—` and
the screen carries no total. The three lowest criteria per screen are, for every scored screen,
**C3, C9 and the screen's own miss above**; C3 belongs to `routes.ts` and C9 to the axe moderate tier
nobody has seeded yet.
