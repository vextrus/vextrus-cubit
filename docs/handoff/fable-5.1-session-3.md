# Fable 5.1 — session 3 handoff

**Branch** `dev-lane-and-jev` (main `8cf9f11f`, never touched). Session 3 started at `54f8242d`
and ends at the commit that carries this file. Every lane in this session ran **by shell**:
`mcp__builder__check` and `mcp__builder__scratch_dir` were not available in this interactive
session, so each verdict below is the lane's own line as `pnpm <lane>` printed it.

The goal was M0–M3 proved end to end in a real browser with the product's own lanes: the shipped
journeys run, every screen walked with the probe beyond what its journey asserts, every defect
fixed test-first in its own commit, the gate met, and this document written.

## 1. What was proved, per journey

Verdicts are the last full dark sweep's (`pnpm e2e`, section 5). "Walk" is the probe's own
verdict line on the screen the journey lands on, after the fixes; the craft score is the probe's
rubric reading (twelve criteria, weights summing to 12, both viewports, the score the minimum) —
the table in section 4 carries the numbers.

| Journey | Spec | Shipped verdict (sweep) | Walk / notes |
| --- | --- | --- | --- |
| J-000 M0 | `journeys/j-000/m0-*.spec.ts` (3 legs) | green | `workspace-named.png`, `first-project-on-s-home.png` re-taken: the compact density and the top-bar mask |
| J-000 M1 | `m1-confirm-disciplines`, `m1-upload-and-open` | green | `entity-selected.png` re-taken (28 px inspector rows) |
| J-000 M2 | `m2-affirm-scale`, `m2-run-partition`, `m2-column-lines`, `m2-coverage-grid` | green — the two M2 legs were MISSING DOOR stubs at the session's start | measured campaign reached by clicks: scales affirmed, GF–ROOF inserted, 1F–5F range authored, Measure pressed, 653 objects, lines for beams, footings, pile caps, tie beams and columns |
| J-000 M3 | `m3-bill-and-schedules` | `test.fixme` — MISSING DOOR (section 7) | not built this session |
| J-000 M4 | `m4-sheet-and-manual-measure` | `test.fixme` — MISSING DOOR | not built this session |
| J-001 | `journeys/j-001-auth.spec.ts` | green | `invite-pending.png`, `switched.png` re-taken |
| J-001a | `journeys/j-001a-auth-core.spec.ts` | green | — |
| J-002 | `journeys/j-002-tenant-admin.spec.ts` | green | `panel.png`, `remove-refused.png` re-taken |
| J-003 | `journeys/j-003-projects.spec.ts`, `audit.spec.ts`, `participants.e2e.ts` | green | participants: the trail is now `ws › project ▾ › Settings › Participants`; the spec pinned the old two-entry trail and was amended to R-UI-084 |
| J-004 | `journeys/j-004-gallery.spec.ts`, `shell.spec.ts` | green | `shell-dark.png`, `shell-light.png`, `shell-user-menu-open.png`, `shell-tenant-switcher-open.png` re-taken |
| J-010 | `journeys/j-010-upload.spec.ts`, `project-home.spec.ts` | green | the sheet card is pictured with its raster served and its views classified (two new reads) |
| J-011 | `journeys/j-011-viewer.spec.ts` | green | a plain drag pans on a fresh sheet — the viewer opened in the select tool until this session |
| J-012 | `journeys/j-012-sets.spec.ts` | green | — |
| J-020 scale | `journeys/j-020-scale.spec.ts` | green | `panel-dark.png`, `panel-light.png` re-taken |
| J-020 snapping | `journeys/j-020-snapping.spec.ts` | green | — |
| J-021 | `journeys/j-021-column-slice.spec.ts`, `register.spec.ts`, `palette.spec.ts` | green | the register's picture had stood since 2026-09-12 with two tabs while the lane grew six; re-taken |
| J-022 | `journeys/j-022-coverage.spec.ts` | green | `grid.png`, `held-out.png`, `certificate.png` re-taken |
| J-030 | `documents.spec.ts` | green | every identifier a chip — and every chip the run's own; masked (I-122) |
| J-031 | `journeys/j-031-levels.spec.ts` | green | `stack.png`, `contested.png`, `reaffirmed.png` re-taken; level id chips masked |
| J-032 | `journeys/j-032-schedules-notes.spec.ts`, `schedules.spec.ts` | green | the schedules stage reads the seam's default density |
| J-033 | `boq.spec.ts` | green | — |
| J-304 / J-305 | `ruleset-author.spec.ts`, `site-facts.spec.ts` | green | — |

## 2. What was fixed (commit · clause · test)

In order of landing. Each commit's message carries the finding, the reading and the proof.

| Commit | What | Clause | Test |
| --- | --- | --- | --- |
| `69f6147f` | the journeys' server, worker and seed are handed STORAGE_ROOT and the model-fixture root from one home; J-011/J-020 were red with "the store holds no object" | V-E2E, L-AI-01, ARCH-02 | `tests/journeys/journey-server-env.test.ts` |
| `c09f8c86` | the invitations helper polls for the row it just made | B-19, AM-09 §4 | `tests/invitations/invitations-live.test.ts` |
| `d28707c9` | the live acceptance suites share one build of the tree under a lock (db-lane contention) | V-DB, ARCH-02 | `tests/support/acceptance-build.test.ts` |
| `506b3591` | **the re-expansion door**: a pin, a level, a typical range re-expand the stored partition, so a customer's clicks reach a measurable campaign (J-000 M2 was MISSING DOOR) | L-CAD-07, L-REG-03/06 | `tests/takeoff/partition/expansion/reexpand-live.test.ts` |
| `dc17c05a` | **the signed object door** `GET /storage/v1/[tenant]/[address]`: the thumbnails every card carried 404'd; no lane saw it | R-SPINE-021/022, Q-12 | `src/app/storage/__tests__/route.db.test.ts` |
| `66e6545f` | the register follows its measure run through the pattern's tracked timeline (the run stood `queued` for 240 s) | R-UI-024 | `tests/ui/takeoff-register/measure-runs.test.ts`, `tests/ui/job-timeline/tracked-timeline.test.ts` |
| `185e4fd0` | the J-000 M2 legs walked: column lines, coverage grid | AM-09 §2, R-TO-021 | the legs themselves |
| `67c61272`, `542b7abf` | inside a project the third crumb is the project's own area, never the workspace's; the settings area's crumb opens its first section; every project screen names its page | R-UI-084, AM-08 | `src/ui/shell/routes-in-project.test.ts`, `participants.e2e.ts` |
| `a53c760c` | a campaign with objects and no lines is "not measured yet", not "no line matches these filters"; the register's copy mirror gains the pin its header promised | R-UI-020, R-UI-050 | `tests/ui/takeoff-register/unmeasured-empty.test.ts`, `tests/takeoff/register-ui/copy-mirror.test.ts` |
| `3e85ebbc` | the cad lane's regeneration leaves a proof of the bytes it ran over; the same bytes buy the skip (`LANE cad` was 137 s against a 60 s ceiling) | V-VERIFY | `tests/toolchain/cad-lane.test.ts`, `tests/toolchain/verify-waves.test.ts` |
| `4c5a1da3` | the default density is the compact 28 px row (every new account met 36 px rows); migration 0053 moves the column default | R-UI-083, AM-08, Direction §4.2 | `tests/ui/density-prefs/default-density.test.ts` |
| `dacbc7f1` | the sheet opens in the pan tool: a plain drag pans, V takes select | viewer.md §5, R-UI-032 | `j-011-viewer.spec.ts` (reads `data-tool`, no marquee, the camera moved) |
| `d6e7410f` | the sheet card is pictured with its raster served and its views classified | R-SPINE-021, L-CAD-07 | `j-010-upload.spec.ts` |
| `d31d5c3f` | every screen picture masks the top bar whole and the run's own ids through one home; the schedules stage's missing import | I-122, R-UI-082, B-17 | the sweep (rounds 3–6) |
| `1daa1e08` | a J-000 leg that needs the campaign before Measure asks for it; a replaced worker no longer inherits a measured run | AM-09 §2, B-19 | `m2-affirm-scale.spec.ts` |
| `905e8c64` | the dev lane replays model answers from `fixtures/model` (it pointed at the drawing corpus) and cites only law the Bible carries (`AM-19` did not exist) | L-AI-01, F-MODEL, ARCH-02, C-06 | `tests/toolchain/dev-lane.test.ts` (db lane) |
| `375c2daa` | the gate's unit lane: the tracked timeline catalogued in the S-Design gallery, the viewer test reading the pan default, a page-object comment spelling no id | R-UI-011, viewer.md §5, AM-09 §1 | `src/ui/gallery-derivation/gallery-derivation.test.ts`, `tests/takeoff/viewer/viewer-screen.test.tsx`, `src/ui/testids.test.ts` |
| `8776cd7b` | the gate's db lane: the density seam's and the store's default read compact | R-UI-083 | `db/__tests__/density-seam.live.test.ts`, `db/__tests__/user-prefs.migration.test.ts` |
| baseline commits `e602d2c3`, `404120bb`, `b27567f1`, `632125c1` | the fork-point manifest, the refusal roster freeze, and the forty-six design pictures the lawful changes moved — each copied from its run's `-actual.png` after its diff was read | AM-09 §4 | `tests/ui/project-settings/hotfix-304a-reproduction.test.ts`, `tests/hotfix-j000/*` |

## 3. What was built

- **The re-expansion door** (`src/modules/takeoff/partition/expansion/reexpand.ts`): the partition
  job's own expansion stage, run over the store after a pin, a level insert or repudiation, or an
  authored typical range. Nothing is re-read from an artifact and nothing of the cad lane runs.
- **The signed object door** (`src/app/storage/v1/[tenant]/[address]/route.ts`): serves what
  SEAM-STORAGE mints, refusing by name (`RASTER_URL_INVALID`, `RASTER_URL_EXPIRED`,
  `RASTER_NOT_FOUND`), content-type by the bytes' own signature, never cached.
- **The tracked measure run** on the register (`TrackedJobTimeline`), and the register's third
  empty truth ("Not measured yet.").
- **The breadcrumb law inside a project** (`PROJECT_AREAS`, `projectAreaOf`, `projectAreaHref`,
  `projectSettingsHref`, `isProjectAreaHome`; `useShellPage` on every project screen).
- **The cad lane's regeneration proof** (`node_modules/.cache/cubit/cad-regeneration.json`,
  machine-local) and verify's `onGreen`.
- **The journeys' one env home** (`tests/e2e/support/journey-env.ts`) and the shared acceptance
  build for the db lane's live suites.
- **The J-000 M2 legs** and `measuredRun` in the golden run.

## 4. The craft table

The probe's rubric over a measured golden project (a J-000 worker's run, cookies reused), both
themes, both viewports, after every fix in section 2. The score is the minimum over the four
captures; the bar is ≥ 4.0 with no criterion below 3.

Walked on 2026-09-21 over the golden project of J-000 worker 0 (a measured campaign: levels
GF–ROOF, lines for beams, footings, pile caps, tie beams and columns), signed in with the run's
own cookies. `total` and `min` are the lowest of the four captures; "below 3" names the criteria
the probe computed under the bar in any capture, with the score it read.

| Screen | Route | total | min | below 3 (criterion = score) | Verdict |
| --- | --- | --- | --- | --- | --- |
| S-Home | `/t/{tenant}` | 4.58 | 2 | states = 2 | RED |
| S-Project | `/p/{project}` | 4.50 | 2 | identifierExposure = 2 | RED |
| S-Drawings | `/drawings` | 3.38 | 0 | aboveTheFold = 1, identifierExposure = 0, copyDiet = 1 | RED |
| S-Sets (index) | `/drawings/sets` | 3.08 | 0 | workSurface = 0, aboveTheFold = 0, states = 2 | RED |
| S-Set (browser) | `/drawings/sets/{set}` | 2.79 | 0 | workSurface = 0, aboveTheFold = 0, identifierExposure = 2, states = 2 | RED |
| S-Viewer | `/viewer/{drawing}/FOUNDATION PLAN` | 3.54 | 0 | identifierExposure = 0, states = 2 | RED |
| S-Takeoff (register) | `/takeoff/register` | 4.29 | 0 | identifierExposure = 0 (the refused rows' object keys, painted by the Decision's own exception) | RED |
| S-Coverage | `/takeoff/coverage` | 4.54 | 3 | — | OK |
| S-Levels | `/takeoff/levels` | 4.75 | 3 | — | OK |
| S-Schedules | `/takeoff/schedules` | 4.25 | 2 | workSurface = 2 | RED |
| S-BOQ | `/takeoff/boq` | 4.33 | 1 | aboveTheFold = 1 | RED |
| S-BBS | `/takeoff/bbs` | 3.50 | 0 | workSurface = 0, aboveTheFold = 0 (the empty cell — this campaign publishes no bars) | RED |
| S-Documents | `/documents` | 3.58 | 0 | workSurface = 0, aboveTheFold = 0 (the empty cell — nothing issued) | RED |
| S-Audit | `/audit` | 2.63 | 0 | workSurface = 0, aboveTheFold = 0, identifierExposure = 0, states = 2 | RED |
| S-Settings › Rule set | `/settings/ruleset` | 4.00 | 2 | identifierExposure = 2, states = 2 | RED |
| S-Settings › Participants | `/settings/participants` | 4.25 | 1 | workSurface = 1, states = 2 | RED |
| S-Settings › Site facts | `/settings/site-facts` | 4.83 | 3 | — | OK |
| S-Settings › Author edition | `/settings/ruleset-author` | 4.75 | 3 | — | OK |

Read as it stands: **four of eighteen screens meet the bar** (coverage, levels, site facts, author
edition). `rowHeight` reads 5 on every grid now (28 px rows, `4c5a1da3`); before the session it
read 3 everywhere. The criteria that fail are the same few on many screens: `states` — the
screen's root publishes no `data-state` for the probe to read (site facts and author edition do:
`state=…=ready`); `identifierExposure` — raw ids as body text (the drawings index's 29 handles,
the audit log's act and subject ids, the viewer's entity keys); `workSurface` / `aboveTheFold` —
the primary region stands low or small, which on documents and the bar schedule is the empty
cell of a project with nothing to show and on the audit, sets and set-browser screens is the
layout itself. Axe: 0 serious / 0 critical on every capture; one moderate on the register.
The rubric blocks like a failing test; this session did not lift these screens and section 7
names their owners.

Before the session's fixes the first walk read: S-Drawings **3.38 / min 0** (above the fold 1,
identifier exposure 0 — 29 raw handles as body text — copy diet 1), S-Takeoff register **3.5 / min 0**
(work surface 0, above the fold 0: the register read "0 of 0 lines" on a campaign nobody could
measure), S-Home 4.58 / min 2 (states 2), S-Project 4.33, S-Levels 4.33, S-Coverage 4.67 — with
`rowHeight = 3` on every grid (36 px rows).

## 5. The gate, verbatim

Every lane by shell, one at a time, never while another server was up. Lines are the lanes' own.

**`pnpm e2e`** (the full dark sweep, after the last commit's baselines):

```
  3 skipped
  62 passed (1.9m)
e2e workers=4 wall-time 117.16s
e2e exit 0
```

The three skipped are the roster's `test.fixme` legs — `MISSING DOOR:` J-000 M3, J-000 M4, and
J-011's "the selection is repainted after the fly-to settles" leg — admitted by
`tests/journeys/fixme-roster.test.ts`.

**`pnpm e2e --journeys J-000`**:

```
  2 skipped
  9 passed (35.3s)
JOURNEY J-000 green workers=4
e2e J-000 workers=4 wall-time 35.65s
e2e exit 0
```

**`pnpm verify`** — two runs, both quoted. The first (after `632125c1`) came back `FAIL unit
exit=1` on three latent findings the slices' own suites had not run — the tracked timeline
uncatalogued, the viewer test pinning the old select default, a page-object comment spelling an
id — fixed in `375c2daa`; its cad lane paid the ~80 s regeneration (`LANE cad 135.08s`) and left
the proof. The second run, after that commit:

```
RUN typegen
LANE typegen 0.19s
RUN types
RUN lint
RUN unit
RUN schema-drift
RUN method-hash
RUN catalogue-drift
RUN golden
RUN cad
cad: fixture regeneration skipped — its inputs digest d3031fbbc5be, the tree a green regeneration proved at 2026-09-21T08:30:44.805Z (node_modules/.cache/cubit/cad-regeneration.json; the golden lane still checks the committed corpus)
LANE catalogue-drift 0.03s
LANE method-hash 0.05s
LANE schema-drift 2.07s
LANE golden 2.86s
LANE types 5.65s
LANE lint 29.11s
LANE cad 46.95s
LANE unit 48.24s
RUN build
LANE build 5.91s
verify wall-time 54.34s
verify exit 0
```

Ten lanes green; V-VERIFY's 60 s ceiling met (`verify wall-time 54.34s`), the cad lane inside it
(`LANE cad 46.95s`, the regeneration deselected by the proof `3e85ebbc` leaves — the first run on
a fresh machine pays it once). ESLint: 0 errors; the warnings are the pre-existing roster, with
the literal-test-id count under `src/modules` frozen at 70 (it fell from 71 in `a53c760c`). TypeScript:
0 errors (`tsc --noEmit --incremental false`). Ruff: clean (the cad lane's first command).

**`pnpm checkup`** — the first run refused: `database cubit_dev migration drift (53/54 migrations
applied) — FAIL`, the dev database on this machine standing one behind the chain after
migration 0053 (`4c5a1da3`); `node scripts/db-migrate.mjs` against `cubit_dev` applied it, and the
second run:

```
RUN dev-db
checkup wall-time 0.31s
checkup exit 0
```

(every probe green: node 24.19.0, pnpm 10.34.5, postgres reachable, roles, uv 0.12.5, typst
0.15.1 at its pin's sha256, libredwg 0.13.3, ports 3210/3211 free, both storage roots writable,
`.env.example` declares all 7 variables.)

**`pnpm test:golden`**:

```
 Test Files  4 passed (4)
      Tests  16 passed (16)
104 passed in 1.41s
golden exit 0
```

**`pnpm test:db`** (the whole lane, one run, no e2e server up):

Two runs. The first came back `3 failed | 1291 passed (1294)`: the two inc-014 suites that
pinned `comfortable` as the default (amended in `8776cd7b`), and
`tests/invitations/invitations-live.test.ts` AC-2 at `locator.waitFor: Timeout 60000ms exceeded`
waiting for the members screen of the served app — green alone (`pnpm test:db …invitations-live…`,
3 files, 19 tests, 7.95 s) and green in the second whole run: the box under 219 files, not the
product (the lane-contention class the session-2 handoff records; the shared acceptance build of
`d28707c9` took the build out of it, the first paint of a served screen under full load still
has 60 s). The second whole run, after `8776cd7b`:

```
RUN test:db
 Test Files  219 passed (219)
      Tests  1294 passed (1294)
   Duration  62.89s (transform 8.38s, setup 0ms, import 21.37s, tests 453.96s, environment 4.33s)
test:db wall-time 63.28s
test:db exit 0
```

**`pnpm test:perf`**:

```
  ✓  1 [dark] › tests/e2e/boq-draft-perf.spec.ts:34:3 › PERF-311 — the unpriced draft renders 5,000 lines inside PB-6 › PERF-311: a 5,000-line draft renders through the pinned renderer inside PB-6, and the cost is recorded
  ✓  2 [dark] › tests/e2e/viewer-perf.spec.ts:39:3 › PERF-011 — a 100 000-entity sheet is opened, drawn, navigated and deep-linked › PERF-011: the viewer opens a 100k sheet within budget, lists its layers, holds 60 fps, deep-links its viewport
  2 passed (46.5s)
e2e PERF- workers=4 wall-time 46.79s
test:perf exit 0
```

Run alone, after the db lane, with nothing else on the box (a PERF- figure measured under
another heavy lane measures the box, not the product).

## 6. Declined by law

- **Jev's rate.** TypeSafe Jev System One is not among AS-05's closed model ids, so no rate is
  written into the ledger's tables and the adapter stays behind `TYPESAFE_API_KEY` opt-in
  (`src/core/model/typesafe.ts`). Objection recorded: a live model whose cost the ledger cannot
  state is a spend the project home cannot show (R-AI-005); the amendment that admits Jev to AS-05
  with its rate is the Bible's owner's. Without a key the seam replays from `fixtures/model` and
  posts nothing — `src/core/model/__tests__/callmodel.acceptance.test.ts` holds the injected fetch
  at zero calls, a missing fixture included ("a missing fixture is never a network call, L-AI-01").
- **F-RCC6 is byte-frozen at v1.1 (AM-01).** Nothing regenerated it and nothing worked around it;
  the golden run walks it as uploaded.
- **`--update-snapshots`** was never used. Every moved picture was copied from the run's own
  `-actual.png` after its diff was read (the diff regions were located pixel by pixel with a
  scratch tool), and committed in `baseline:` commits naming the run.
- **The TypeSafe key in history** (`d4bc0da3`, `61a9632b`) was not printed, used or
  reintroduced; rotation is the owner's.
- **The `.env.example` / dev lane** changes carry the `toolchain` tag and name their files.

## 7. What remains, and who owns it

1. **J-000 M3 leg** (`m3-bill-and-schedules.spec.ts`, `MISSING DOOR`): transcribe the levels and
   schedules, run the structural campaign on F-RCC6-BNBC (27 sheets), review the register, emit
   the unpriced BOQ and BBS as DRAFT — UNSIGNED and open the XLSX with exceljs. The doors exist
   (`boq-export`, `/api/exports/{sha}`); the leg is the next session's, with the roster moving
   `m3` from ANNOUNCED to SHIPPED. Owner: the golden path.
2. **J-000 M4 leg** — likewise. Owner: the golden path.
3. **S-Drawings v22 deviation** (craft 3.38 / min 0 before; see the table for after): the grid
   stands at 518 px, raw handles are body text, copy is multi-line. A rebuild against
   `docs/design/s-drawings.md`. Owner: S-Drawings.
4. **`viewer-status` carries no rendered contract**; **`takeoff/layout.tsx` spells literal test
   ids** (the module count is frozen at 70 and may only fall); **the project home's member label
   is a raw id** (masked in pictures, wrong on the screen — R-UI-082). Owners: the viewer, the
   takeoff frame, S-Project.
5. **Reference sheets** (`~/vextrus-builder/docs/design/reference/*.dwg` — never committed): the
   Edison Lavinia 22k-entity sheet at 60 fps, the General Note whole and in order, the BNBC 53
   viewports were not walked this session; **`ARCHITECTURE.dwg`** still refuses
   `HANDLES_NOT_UNIQUE` (ten LWPOLYLINEs twice) — a repair is lawful only with L-CAD-09's count
   and a byte-identical proof. Owner: the cad lane.
6. **Uploads over plain HTTP — SHA-256 parity and `DIGEST_MISMATCH`** stand in
   `tests/spine/uploads/protocol.test.ts` and `refusals.test.ts` (db lane, green in the gate); a
   probe walk that tampers a byte on the wire was not made. Owner: the spine.
7. **Design pictures were stable only by accident** until I-122: four screens' pictures embedded
   run-minted ids and the crumb's width. The light lane (`CUBIT_E2E_LIGHT=1`) was not run; the
   light pictures the dark lane itself takes were re-taken. Owner: the gallery walk (J-004).
8. **The craft debt** (section 4): fourteen screens below the bar by the probe's mechanical
   reading. The same three criteria carry most of it, and each has one home: a `data-state` on
   every screen's root (the `states` criterion — the screen-state pattern site facts and the
   author edition already use); ids through `IdChip` and never as body text (`identifierExposure`
   — the drawings index, the audit log, the viewer's inspector, the set browser); the primary
   region within 116 px of the top of main and filling the work surface (`workSurface`,
   `aboveTheFold` — the audit, sets, set-browser, BOQ and participants layouts, and the empty
   cells of documents and the bar schedule). Owners: each screen's Decision; the `states`
   criterion is the foundation's (AM-08: a repeated cross-screen finding).
9. **`ELIFECYCLE` on a red sweep** prints after the verdict lines — cosmetic; the exit code is
   the contract.

## 8. Reproducing each proof

```
pnpm verify                                   # ten lanes, LANE <id> <seconds> each
pnpm checkup
pnpm test:golden
pnpm test:db                                  # whole lane, one run, no e2e server up
pnpm e2e                                      # the full dark sweep
pnpm e2e --journeys J-000
pnpm test:perf
pnpm vitest run tests/ui/takeoff-register tests/takeoff/register-ui tests/ui/density-prefs \
  src/ui/shell tests/toolchain/cad-lane.test.ts tests/toolchain/verify-waves.test.ts
pnpm test:db tests/toolchain/dev-lane.test.ts
```

The probe (scratch only, never committed): `node probe/server.mjs` (the journeys' own database
and roots, port 3211; `--stop`), `node probe/probe.mjs walk --themes dark,light
--viewports 1440x900,1280x800 --shot --out out/<dir> <routes…>`; the craft walk is
`bash probe/craft-walk.sh test-results/j-000-golden-run.dark.w<N>.json out/craft` after a J-000 run.
