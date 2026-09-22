# Session 6 ledger — Opus 5 orchestrating, branch `dev-lane-and-jev`

A timeline, written as it happened. Every run, its command, its verdict line quoted, and what I did
with it. The handoff (`docs/handoff/session-6.md`) holds the conclusions; this holds the proofs.

Tree at the start: `ec3b079e` on `dev-lane-and-jev` (main `8cf9f11f`, never touched). The owner's
untracked leavings (`.agents/`, `.idea/`, `.junie/plans/`, `AGENTS.md`) stand untracked and are not
mine.

**Tooling, said plainly for the handoff:** `mcp__builder__check`, `mcp__builder__scratch_dir` and
`mcp__builder__debt_rows` are ABSENT in this session, as they were in sessions 4 and 5. Every lane
below ran by shell. `TYPESAFE_API_KEY` stands in the owner's shell and is never printed or written.

## The gate, run first (§5A) — before any fan-out

`pnpm gate` launched 20:40 (stdout `scratchpad/s6/gate-1.out`; logs
`node_modules/.cache/cubit/gate/`). Machine: 24 cores, 26 GB, postgres on 5544, 3210/3211 free.

| lane | verdict | wall |
|---|---|---|
| verify | **RED** `FAIL unit exit=1` | 143.29 s |
| checkup | **RED** `database cubit_dev migration drift (55/56 migrations applied) — FAIL` | 0.39 s |
| golden | green — `Test Files 4 passed (4) / Tests 16 passed (16)`; pytest `104 passed in 1.35s` | 2.06 s |
| db | green — `Test Files 231 passed (231) / Tests 1369 passed (1369)` | 85.31 s |
| e2e (sweep, J-000 excluded) | **RED** `1 failed / 1 skipped / 52 passed (1.6m)` | 99.70 s |
| e2e-j000 | (running) | |
| perf | (running) | |

### Red 1 — the unit lane, three tests, and its cause

```
 Test Files  2 failed | 501 passed (503)
      Tests  3 failed | 3243 passed (3246)
```

`tests/takeoff/levels-ui/denied-doors.test.ts` ×2 and `tests/takeoff/levels-ui/screen.test.ts` ×1,
all one assertion: `one INSERT_LEVEL door in the DOM at any time — the tabs-row aside holds it
(I-246): expected +0 to be 1`.

**Cause, read in the diff, not guessed.** Session 5's `ef3bb0b5` takeoff(nav) changed
`useTakeoffTabsAside` from a hook called for its EFFECT (returning `void`) to one that ANSWERS a
portal node its caller must render — every one of the six lane screens now spells it
`return useTakeoffTabsAside(children ?? null)`. The commit touched the six screens, `nav.tsx` and
its own new test, and did NOT touch the levels stage, which still bound the mount as

```ts
bound["TabsAside"] = ({ children }) => { fill(children ?? null); return null; };
```

— the hook called for an effect it no longer has, its answer thrown away. The lane's row WAS drawn
by the stage (`inLane` stands `ShellSlotsProvider` and the real layout) and the portal's host with
it; the door simply went nowhere. A second spelling of one contract, which is the defect CLAUDE.md
says to look for first. Session 5's `pnpm test` at 19:47 predates `ef3bb0b5` (which added
`tests/ui/takeoff-register/tabs-aside-registry.test.tsx`, +1 file / +4 tests — exactly the
502→503 / 3242→3246 difference); the unit lane has been red since that commit landed at 20:55.

**Fixed** in `tests/takeoff/levels-ui/support/levels-ui-view.ts` alone — the stage renders what the
hook answers. Checked by name:

```
pnpm vitest run tests/takeoff/levels-ui/denied-doors.test.ts tests/takeoff/levels-ui/screen.test.ts
 Test Files  2 passed (2) / Tests  11 passed (11)
```

Grepped for the same stale spelling elsewhere: only `tests/ui/takeoff-schedules/work-surface-share.test.ts:139`
binds `TabsAside: () => null` (deliberately mounts nothing) and
`tests/ui/takeoff-register/support/fixtures.ts:113` names it only in `MOUNT_NAMES`. One home, fixed.

### Red 2 — checkup, the dev database

`database cubit_dev migration drift (55/56 migrations applied)`. `db/migrations/` holds 56 files
(0000–0055); `cubit_dev` never took session 5's `0055_note-clause-proposals.sql`. A state of the
owner's dev database, not of the tree — no migration is edited, none added. To be brought in step
once no lane holds the cluster.

### Red 3 — the e2e sweep, one screenshot

```
✘ 39 [dark] › tests/e2e/register.spec.ts:25:3 › J-021 — the register workspace
  Error: expect(page).toHaveScreenshot(expected) failed
  14156 pixels (ratio 0.02 of all image pixels) are different.
  Snapshot: s-takeoff/register.png
```

Exactly the picture session 5's handoff §4 said a lawful change had moved and left un-re-taken (the
register's view key in words with IdChips, `86888a70`/`ff6a0571`). The gate's to re-take through
`pnpm e2e:retake`, never `--update-snapshots`, in its own `baseline:` commit. The failure's diff
artifacts did not survive: the `e2e-j000` lane cleans `test-results/` as it starts.

## The golden band, quoted from session 5's own run (ledger, run 11)

```
COLUMN|RCC_CONCRETE|GF:    product 16.975 · golden 16.828 · +0.87 %
                   1F/2F:  product 15.433 · golden 15.225 · +1.37 %
                   3F/4F:  product 12.224 · golden 12.017 · +1.72 %
                   5F/6F:  product  9.967 · golden  9.761 · +2.11 %
```

L-QTY-06's band tolerates under, never over; every one of these is over. The two doors and their
arithmetic, to be re-measured against `fixtures/rcc6-bnbc/model.json` before either is designed:

- **GF, +0.146 m³** — C7 is "%%C450 PORCH COLUMN" (T-NOT-PCTC: `%%C` is Ø) and is measured as a
  450 × 450 prism: (0.45² − π·0.45²/4) × 3.3528 = 0.1458.
- **1F..6F, +0.206 m³ each** — the product carries C7 over every storey (0.617 m³ at h = 3.0476 m)
  and lacks C5 (0.4115 m³, i.e. 0.135 m² × 3.0476 — a 450 × 300 section); 0.617 − 0.4115 = 0.2055.
  C5's own note is "C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)" and the porch column stands on GF
  alone; the layout plan's authored range GF–6F expands every mark alike.

### Red 4 — the perf lane, and it was MINE

```
✘ 2 [dark] › tests/e2e/viewer-perf.spec.ts:39:3 › PERF-011
  Error: the median frame of a scripted zoom and pan holds 60 fps at 100000 entities, within the
  instrument's tolerance (PB-3)
  Expected: <= 16.75
  Received:    16.800000000745058
```

0.05 ms over, which is one tick of the instrument and not a measurement I may shrug at.
`VIEWER_BUDGETS` (tests/e2e/viewer/s-viewer.page.ts:44) says why the number is what it is:
`performance.now()` in headless Chromium is coarsened to 100 µs with cross-origin isolation off, and
`frameMedianToleranceMs` is 0.05 — HALF of one coarse tick, which the Decision states outright is
"smaller than one" quantum. So near the bound the instrument can answer only 16.7 (pass) or 16.8
(fail). 16.800000000745058 is exactly one quantum over 16.7.

**Cause, and it is mine.** I launched an eleven-agent read-only orientation fan-out at 20:43 while
the gate was still running, judging greps cheap against 24 cores. The gate's perf lane ran at 20:50
inside that window. Re-measured on a quiet box (load 0.64, no node processes), twice:

```
pnpm test:perf   ✓ PERF-011 … (16.9s)   2 passed (20.0s)   wall-time 20.34s
pnpm test:perf   ✓ PERF-011 … (17.4s)   2 passed (20.5s)   wall-time 20.84s
```

Two for two green. The lane is not red; the box was loaded, by me. **The rule this buys, for §6 of
the next prompt:** a fan-out of any size is a heavy lane for the purposes of "two heavy lanes never
at once" when the gate's `e2e`, `e2e-j000` or `perf` lanes are in flight. Read-only agents are not
free — they are node processes on the same cores the frame ledger is timing. Fan out before the
gate or after it, never across it.

## What the gate's four reds came to

| red | verdict | what it was |
|---|---|---|
| verify / unit ×3 | **fixed**, `d4aa70e7` | `ef3bb0b5` left the levels stage a second spelling of the tabs-row hook's contract |
| checkup / dev-db | **fixed**, no commit | `pnpm db:migrate:dev` → `database cubit_dev present at migration head (56/56 migrations applied)` |
| e2e / `s-takeoff/register.png` | **re-taken**, `4407612d` | the picture session 5's handoff §4 said was moved and not re-taken |
| perf / PERF-011 | **not a red** | my own fan-out loading the box during the lane; green twice quiet |

Nothing in the product moved to make the gate green: one test stage, one picture, one dev database.

## Measured before briefing — where the circular door actually is

A reader warned that no test covers the bare `%%C450` case and told me to measure it rather than
brief on it. Measured (`node --import tsx -e`, the string built with `String.fromCharCode(37,37)` so
no shell could collapse the doubled percent):

```
"%%C450"                   norm="Ø450"                   parseSizePair = null
"%%c450"                   norm="Ø450"                   parseSizePair = null
"%%C450 PORCH COLUMN"      norm="Ø450 PORCH COLUMN"      parseSizePair = null
"C7 %%C450 PORCH COLUMN"   norm="C7 Ø450 PORCH COLUMN"   parseSizePair = null
"Ø450"                     norm="Ø450"                   parseSizePair = null
"450x450"                                                parseSizePair = {width:450, depth:450, unit:null}
"12\" x 24\""                                            parseSizePair = {width:12, depth:24, unit:"in"}
```

So the control code is ALREADY decoded — `%%C` reads as `Ø` today — and the gap is one step later
than the door's name suggests: there is no production that reads a DIAMETER, and nothing for one to
be stored as. The brief says "a diameter production and a circular shape", not "teach it `%%C`".

A second thing the same reader measured, which a brief must carry: the control-code table is spelled
TWICE — `src/core/entitygraph/notation.ts:5-8` declares itself the single home ("A second control-code
table would be two answers to what %%d says (B-17)") and `grammar.ts:70-76` is a larger second copy.
`NAMED_LEVELS` is a third undeclared doubling (`grammar.ts:187` / `index.ts:277`). Two spellings of
one fact, which is the defect to look for first.

## The second door was mis-framed, and the owner ruled on it

The orientation's completeness critic refused the map's own framing and was right. Measured against
the committed corpus and the generator, not the prose:

- **`stack` and `mark` are two namespaces that both spell `C<n>`.** Stack C5 carries mark C4; stack
  C7 does not exist. The doors are by MARK: mark C7 = stack **C7X**, mark C5 = stack **B4**. Code
  filtering `.stack === "C5"` silently takes the wrong eight members.
- **S-10 carries no C5 mark.** Its 28 `family:"mark"` strings are C2×8, C4×7, C3×6, C1×3, C6×1,
  C7×1, C-4×1, C-2×1. The generator tags only the GF columns (`cols.py:34`, `draw_columns(view, ctx,
  "GF", tags=False)` then one mark text per GF column) and mark C5 has no GF member. So there is no
  C5 placement to narrow — the door must MINT one. That moves it from the expansion resolver to the
  placement detector, and makes it materially bigger than the spec's wording implies.
- **"the porch column standing on GF alone" is false.** `model.json` carries `COL:C7X@FDN` and
  `COL:C7X@GF`. FDN drops out of the PUBLISHED set only because the journey authors the range GF→6F
  by clicks (`golden-run.ts:530`) — a click, not a law. The sentence stands in two places
  (`m3-bill-and-schedules.spec.ts:19`, `fixme-roster.test.ts:34`) and both must move together or it
  re-enters as a third spelling.
- **The per-storey percentages the spec prints are wrong at the low end.** Computed from the model:
  GF 0.87, 1F/2F **1.35**, 3F/4F 1.71, 5F/6F 2.11. The spec's "1.37" reproduces from nothing.

### What the drawing actually carries, read in the generator

`fixtures/gen/rcc6_bnbc/emit/sheets/cols.py:41-48`:

```python
# the porch column is circular, and the floating column starts at 1F on TG1
porch = next(m for m in ctx.at("COLUMN", "GF") if ctx.stacks[m["stack"]].get("porch"))
view.circle((f(porch["cx"]), f(porch["cy"])), f(porch["b"]) / 2, "S-COLS")
view.text("C7 %%C450 PORCH COLUMN", ..., "S-TEXT2")
fl = next(m for m in ctx.at("COLUMN", "1F") if ctx.stacks[m["stack"]].get("floating_on"))
view.rect(..., "S-COLS", linetype="DASHED")
view.text("C5 FLOATING COLUMN OVER TG1 (STARTS AT 1F)", ..., "S-TEXT2")
```

So door A has TWO independent evidences — the plan draws an actual **circle** on `S-COLS`, and the
note says `%%C450`. Door B's C5 has a **dashed** rect and a note naming its own range.

**And the gap neither reader closed: no sheet in the set states a storey range for C7.** I searched
every one of the 3,102 corpus strings: S-10 has the mark `C7` (handle 9AF) and the note `C7 %%C450
PORCH COLUMN` (9BA); S-11 gives C7 `450x450` under **all four** band headers, so the schedule bounds
it not at all and `bandedLevels` can make no cut. The only word standing between C7 and the sixth
floor is "PORCH".

### The owner's ruling (asked, because the readings differ materially)

> **I-303 — a plan note that names a mark and distinguishes that member from the plan's typical is
> evidence about the MEMBER, not about the plan.** A member so noted is not expanded by the view's
> authored typical range: it stands on the level the plan draws, or over the range its own note
> states. C7 → GF alone; C5 → 1F..6F.

After both doors, GF..6F match the golden cell for cell. `COLUMN|RCC_CONCRETE|FDN` (3.060) and
`|ROOF` (0.617) remain unpublished — and **unasserted**, because `matrix.declared` is computed and
attached at `m3-bill-and-schedules.spec.ts:190,272` and never asserted. 3.677 m³, 3.9 % of the
golden's 94.511, that the band does not see. Named here so the handoff cannot pretend otherwise.

## The Jev seam: the handoff's defect is real, and its implied fix is impossible

The session-5 handoff (§7 item 2) and the session-6 prompt both say `answerJudgmentOf` "reads a
Noul's probability as its confidence — fix before reading any threshold". The first half is exactly
what `src/core/model/typesafe.ts:155` does:

```ts
const stated = primitive === "noul" ? value : probability(confidence);
```

The second half assumes the provider states a confidence the seam is throwing away. **It does not.**
Four independent sources, found by the implementer when its brief's own stop condition fired:

- TypeSafe's skill doc: "Probability of yes; **no separate confidence**".
- The tree's own quotation of the docs, `src/core/model/typesafe-arms/outline-corroboration.ts:14-17`:
  "There is no separate `confidence` value for a Noul, unlike a Choice or a Score".
- Session 5's own ledger, written by the operator who read the three primitive pages: "noul: a
  probability of yes with no confidence field".
- The repo's model of the wire: `typesafe-jev.test.ts:204` authors a raw Noul as
  `{ type: "noul", noul: 0.12 }` — no confidence key.

So deleting the ternary would read an absent key and answer null. The substitution is deliberate and
spelled in three places. **The defect is not a mis-read; it is that a call's confidence is
`Math.min` over a quantity one of its answers does not have.** Ruled: a Noul states no confidence,
the call's confidence is the minimum over the answers that state one, and null where none does
(L-AI-02 — nothing supplied where the provider supplied nothing). The probability keeps its own home
on the answer's `value`, where all 194 recorded Noul answers already carry it.

### The finding that matters more: a fixture holds OUR judgment, not the provider's words

`src/core/model/mint.ts` files `answer.judgment` — the OUTPUT of `answerJudgmentOf` — and
`fixture.ts:31` hands it straight back on replay. Audited across all 243 files: 240 carry a
judgment, 194 Noul answers, **194 with `confidence === value`, zero exceptions.**

Two consequences the handoff must carry:

1. **This change is not provable against the recorded corpus.** Every lane replays fixtures (no
   session has web access), so replay keeps serving the old judgments. The schedule-cell confidences
   of 0.01–0.18 that motivated the item stay exactly as they are until someone re-records — a live
   call, a `baseline:` commit, and the owner's spend.
2. **More generally, the corpus cannot prove any change to how the seam reads an answer,** because it
   stores the reading rather than the thing read. Q-08 calls every committed fixture deliberate
   corpus and L-AI-01 puts fixture replay inside verify; a corpus of our own transforms satisfies
   neither for a transform change. Recorded as an item for the owner, not fixed tonight.

Four readers take `judgment.confidence`, not the two the prompt implies: `outline-corroboration/
outcome.ts:46` (bands it 0.7/0.3 — repointed to the answer's `value`), `model-calibration.ts:79`
(would silently drop outline-corroboration from the very line AS-05 says a threshold is calibrated
on — made to speak instead), `spine/audit/index.ts:244` (a visible screen state), and
`takeoff/coverage/server.ts:116` (choice-only, unaffected).

## The design, and the three things it found that the doors alone do not fix

Six designers over disjoint questions, then a max-effort integrator whose hard constraint was a file
partition in which no two slices share a file. Eight slices cut by LAYER, not by door — because both
doors touch `rows.ts`, `detect.ts`, the placements schema, migration 0056, `schema-aggregate.test.ts`,
the spec and the fixme roster. Three findings changed the increment:

### 1. The drawn circle cannot decide the shape

A designer read the DXF bytes rather than the generator's intent. At the porch centre, layer
`Column`, there is BOTH an LWPOLYLINE (handle `994`, four vertices, 450.0 × 450.0) AND a CIRCLE
(handle `9B9`, r 225.0) — because `circular: True` lives on the MARK spec (`model.py:202`) while
`draw_columns` branches on the STACK, which carries only `porch: True`. Both are closed rings that
clear `outlineOf`, they share a centre, and `mergedByMark` keeps "the FIRST of the group in the
artifact's own order" — the square. **So the note is the evidence and the circle is cited nowhere.**
My own earlier reading ("the plan draws a circle, two independent evidences") was true and not
usable. I-304 is written to that measured fact.

### 2. The bar-schedule fixme is blocked by a THIRD door

Neither of this increment's doors touches `REBAR_SCHEDULE_UNREAD`, which stands on every column, and
the BBS leg asserts `rowsRendered > 0` and `compared.length > 0`. Since `j-000-roster.test.ts:252-256`
forbids any `test(` running while `/MISSING DOOR:/` matches anywhere **in that file**, the only
release path is to move the BBS test whole into its own `m3-bar-schedule.spec.ts` keeping a docblock
that names the rebar reader alone.

### 3. Both doors landing perfectly still leaves the band RED — and the cause is the document

The golden rounds each cell once; the XLSX carries each LINE already rounded to three places and
`bandMatrix` sums 26 of them. `src/modules/takeoff/export/boq-xlsx/spec.ts:4-6` states the contract
outright: *"The figures are the draft payload's — already rounded once, at the edge, by the emission
(L-MEA-05) … a workbook that re-rounded a quantity would be a second draft of the same campaign."*
`fractionDigits` is a display mask; `workbook.ts:71` coerces the already-rounded string.

Computed from `model.json` with the golden's own area rule, over the roster each storey has AFTER
both doors:

```
level  n   sum of rounded lines   true sum    golden    over      over %
GF     26  16.829000              16.827848   16.828    +0.001    0.0059
1F     26  15.227000              15.224760   15.225    +0.002    0.0131
2F     26  15.227000              15.224760   15.225    +0.002    0.0131
3F     26  12.018000              12.016740   12.017    +0.001    0.0083
4F     26  12.018000              12.016740   12.017    +0.001    0.0083
5F     26   9.761000               9.761220    9.761    +0.000    0.0000
6F     26   9.761000               9.761220    9.761    +0.000    0.0000
```

`insideBand` admits `+1e-9`, so **five of seven cells fail on rounding alone**. This also settles a
disagreement between two designers: `rail-measure` predicted 5F/6F would be the failures on the
assumption that full precision reaches the cell — those are the only two that pass.

The lawful remedy is the document's own presentation slack, not a loosened band: a cell summing `n`
figures each stated to `p` places can exceed the true sum by at most `n × 0.5 × 10⁻ᵖ`, and the golden
adds one more half-ulp of its own. At 26 lines and 3 places that is 0.013 m³ — 0.08 % of the GF cell,
two orders inside L-QTY-06's 3 % arm, so the band keeps its whole meaning. The precedent is already
in the tree (`halfUlp`, `tests/takeoff/rails/rebar/rcc6-bnbc-column-band.test.ts:104-107`).

### The long pole every design but one missed

A new MethodPair makes `enumerateMethods()` answer 37 where the standing platform edition
IS1200_IN @ 2027.02 cites 36. Editions are immutable (`seed/index.ts:7-15`: "a method landing in the
tree is a NEW edition rather than an edit to the standing one"), so a re-mint is owed, and a re-mint
is a MIGRATION — inside 0056, the only number available. `0051_ruleset-edition-slabs.sql` is the
92-line precedent.

## The increment, first half — `67059246`

Four implementers on disjoint files, then four rulings of mine, then one commit over a green tree
(unit 504/3280, db 231/1392, drift clean, lint 0 errors, tsc 0, 8 manifests matching).

### The ruling that mattered: the remainder fence

S0 refused to paper over a conflict between the law I briefed and the code S3 wrote. My I-303 text
admitted FOUR answers (no storey word → drawn level; `STARTS` + one → that storey upward; one alone →
that storey alone; two or more → between first and last) while `bandStatedIn` implemented two. S0 was
right that the gap was dangerous, and its reasoning is the part worth keeping: **a note stating no
range is not inert** — the first arm pins its member to the level the plan draws and takes every other
storey away. So under the four-answer law a mark-headed sentence with two incidental floor words
would pin seven C4 placements to 3F–4F.

Ruled DOWN to two answers, with a fence: **a note is read only where its remainder states a SHAPE or a
`STARTS`-bounded range; everything else leaves its member expanding exactly as today.** Consequences,
each verified in the suite:

| string | before the fence | after |
|---|---|---|
| `C7 %%C450 PORCH COLUMN` | note, no range → GF alone | unchanged ✓ |
| `C5 … (STARTS AT 1F)` | note, 1F→top | unchanged ✓ |
| `C4 SEE DETAIL 3/S-12` | note, no range → **pinned to GF** | not a note ✓ |
| `C4 3RD-4TH BARS REVISED; ISSUED FO` | note, no range → **pinned to GF** | not a note ✓ |
| `C2 GF TO 2ND:` | note, no range → **pinned to GF** | not a note ✓ |
| `SW1 L=2563` ×3 (S-23) | note; guard had to catch it | not a note ✓ |

The last row is the one I care about most: the singularity guard is now belt-and-braces rather than
the only thing standing between this rule and 24 members of shear wall. And every one of those
refusals is now by the text's own WORDS rather than by the accident that two of them are drawn in
paper space and on a schedule sheet — fences that are true of THIS drawing and guarantee nothing
about the next.

### Three more things the implementers found that the plan had wrong

- **The PI hoist does not move the foundations digest.** `scripts/method-hashes.mjs` hashes the
  manifest's own recorded entries, never module content. Proved by running it. Budget nothing for a
  foundations baseline.
- **`MEMBER_SHAPES` was declared twice within the hour** — once by the note reader, once by the
  schema. ARCH-01 forbids `src/core` importing `src/modules`, proved with a lint probe rather than
  read, so the roster's one home is the seam's and the placement law NAMES its members the way
  `../grid/law` names `GRID_FAMILIES`. Folded before the commit.
- **`SEED_VERSION` stood in FOUR places** outside `tests/rulesets/support/editions.ts`; three went red
  the moment the edition moved. Bumped, and recorded as a debt row — folding them is a sweep, not
  this increment.

### The edition, verified rather than transcribed

`enumerateMethods()` answers 37 where IS1200_IN @ 2027.02 cites 36, so a re-mint is owed and it is a
migration. I computed `editionDigest(SEED_EDITION_CONTENT)` myself — `0475191d92d306ace55deca166fe31fda56fbb8111f8be596931dab5e4a9bdcf` — and diffed the migration's 37-pair
list against the module programmatically: identical, with the circular pair at index 12 between
`rcc.beam.formwork@1` and `rcc.column.concrete@1`.

`COLUMNS_DIGEST_BEFORE` moved once, `d5bc069b…` → `67ccfde8…`, read off the failing run. It rides in
the increment's own commit rather than a `baseline:` one, on this tree's precedent: `dd203d29`
carried migration 0055 and its digest re-baseline together.

### One thing the gate already settled about the pictures

Session 5's handoff wondered whether the sets, schedules and BBS pictures had moved too. They had
not: the sweep compared all 54 specs (52 passed, 1 failed, 1 skipped) and `e2e-j000` was green, so
`s-takeoff/register.png` was the only one. No further re-take is owed.

## The increment, second half — `a7c4c176` and `a46408b0`

**S5, the stage that reads the notes** (single agent, 332,539 tokens, 112 tool uses, 29 min). It
verified the only over-measurement path in the increment against the REAL EntityGraph rather than
the generator, and found my brief wrong in the safe direction:

```
reach (0.9 × min grid spacing 2438.40)       2194.56
closed outlines on S-10's view                    29      mark-anchored 28, never anchored 1 (9BB)
note 9BC → 9BB                                806.23
note 9BC → next-nearest outline of any kind   3466.4      (my brief said 2082 — it is OUT of reach)
```

So within the floating note's reach there is exactly one ring in the whole plan and no mark claims
it. Census `noted: 2, minted: 1`; placements 204 → 205; S-10's instance rows still 182 (26×7 before,
25×7 + 1 + 6 after). It touched one file off its list (`runs.ts`, `note: null` — the REQUIRED field
made it a compile error, which is the mechanism working), added the near-anchor reach to the
BINDING phase on I-303 statement (5)'s own words, and made an unplaceable note band cut to nothing
rather than fall back to the view's span (the under direction). I ACCEPTED all three.

A fast green is not a green until it is read: the four S5 db-lane suites came back in 5.61 s, which
is too fast for a suite that stages the corpus twice through the pipeline. `--reporter=verbose`
showed all six new I-303 cases had run (the artifact is cached per process, 1.3 s). Then the whole
db lane: `Test Files 231 passed (231) / Tests 1403 passed (1403)` 81.01 s. Committed `a7c4c176`.

**S6, the rail** (single agent, parallel to S5 on disjoint files, 193,381 tokens, 117 tool uses,
14 min). Drove the rail directly and read three batches whole: RECT byte-identical to before; ROUND
`rcc.column.circular.concrete` PRISM_POLY `count/d/H`, `d` 450 mm off the cell; MISMATCH one
`SECTION_NOT_CIRCULAR` and no offer. Confirmed nothing else moves: column FORMWORK is not a lawful
cell (`bears.ts` has no `{column, rcc.formwork}` row), and column REBAR reads the section only in
`linksOf`, which reads the variant and bails before that on a declared-empty `dimensions` seam. It
STOPPED on one question rather than picking: I-304 said `DXF_HANDLE:9BA` "is the source key a
circular C7 line stands on", and no `Offer` field publishes it. Ruled: `d`'s figure and unit are the
cell's (the note states `Ø450` with no unit, and a unitless section is what `SECTION_UNIT_UNSTATED`
already refuses), so citing the note there would be a false provenance; I-304 corrected to say the
key is CARRIED and not yet CITED, an IOU. db lane `231 passed / 1407 passed` 81.12 s. Committed
`a46408b0`.

## The owner's meeting, and the demo

Mid-session the owner said he had told his team J-000 M3 was complete and asked for it in a browser.
Said plainly before anything else: it was not, and the bar-schedule half cannot be made green tonight
by anyone (a third door — the rebar schedule reader). The owner then asked for something in the
browser rather than more fixing. Delivered:

```
pnpm e2e:clean
pnpm e2e --journeys J-000 --workers 1 m3-levels-and-notes.spec.ts m3-measure-and-register.spec.ts
  ✓ m3-levels-and-notes (1.7m)   ✓ m3-measure-and-register (34.9s)   2 passed (2.7m)
pnpm probe:server                                     → 127.0.0.1:3211, HTTP 200
pnpm probe signin j000-legs-mucxf7547jfm@cubit.test …  → OK signin
```

The password is derivable from the run file's email (`golden-run.ts:273-274`:
`j000-legs-<stamp>@cubit.test` / `golden-path-legs-<stamp>`) — the run file records no password.

**The Windows browser could not reach it** (`ERR_CONNECTION_RESET`). `/etc/wsl.conf` sets no
`networkingMode`, so WSL2 runs NAT, and `scripts/e2e-server.mjs:51` binds `--hostname 127.0.0.1`:
the server listened on the VM's loopback only. Fixed without touching a toolchain script — a second
listener on the VM's LAN address, forwarding to the same process, on the SAME port so any absolute
link keeps its port:

```
socat TCP-LISTEN:3211,bind=172.21.129.206,fork,reuseaddr TCP:127.0.0.1:3211   → HTTP 200
```

The permanent fix is the owner's machine config, not the repo: `[wsl2] networkingMode=mirrored` in
`%UserProfile%\.wslconfig` (Windows side). Recorded, not done.

## The defect the journey found — and its cause, established

The journey's own database, scoped to the demo project (an unscoped query first read OTHER runs'
rows and nearly misled me — scope every query to the project):

```
placements 205, with note 2:   C5  DXF_HANDLE:9BC  from 1F   ·   C7  DXF_HANDLE:9BA  ROUND
register_objects:               C5  GF..6F, MEASURED at GF   ·   C7  GF..6F, MEASURED at GF
quantity_lines:                 column rcc.concrete COMPLETE 189 lines 94.196 m³
```

So the store holds both notes correctly and the register ignores them. `notedLevels` is correct and
its `band === null` arm is an unconditional filter to the drawn level — it cannot produce seven rows
for C7 — so whatever registered those rows never called it. `storedPlacementsOf` is a bare select
and `placementRowOf` reads the note, so the re-expansion is sound.

**The cause: `src/core/acts/author-typical-range.ts` is a THIRD spelling of the expansion.** It
imports `placements`, `memberTypeVariants` and `registerObjects` from `../db` directly, re-does the
band cut itself with `bandCovers`/`bandJudgeable`/`bandOpen`/`placedBy`, and registers each
placeholder's keys over the authored range with the drawn level MEASURED — never importing
`resolveExpansion`, `placementRowOf`, or a note column. It lives in `src/core`, which ARCH-01 forbids
from importing the module S5 fixed, so it could not have reached the fix. And register objects are
NEVER retracted (`expansion/store.ts`), so its GF..6F rows stand whatever the resolver registers
after it. The db lane could not see this: its expansion suites drive `resolveExpansion` and
`reexpandProject`, and no suite authors a range over a NOTED placement through the act.

The two lawful shapes for the fix, in order of preference: (a) the act stops registering objects —
it writes the `typical_ranges` row and retires the placeholders, and the router's
`reexpandProject` (already called at `takeoff.ts:445,483,520`) registers through the one resolver;
(b) the cut moves to ONE home in `src/core` (pure — `notedLevels`/`lowestOf` beside `bandCovers` in
`core/offers`) and both the act and the resolver import it. Either way the proof is a db-lane case
that authors a range over a noted placement THROUGH THE ACT and reads the register back, then the
journey. **Not fixed: the owner said to stop fixing and give him the browser.**

## The Opus 5.5 transition, and what the settings did not say

The owner switched the session to Opus 5.5 (`claude-opus-5-5`, released 2026-09-22; verified from
the harness, not assumed). Read before writing the next prompt: the announcement, the overview,
what's new, the migration guide. `~/.claude/settings.json` had `"model": "opus"` but
`CLAUDE_CODE_SUBAGENT_MODEL` still `claude-opus-5` — every worker would have run on the old model —
and no `modelSettings` entry for `claude-opus-5-5`, whose default effort is `medium` where Opus 5's
was `high`. Both corrected (see the handoff).

Two measurements for the product, not the tooling:
- **The model ledger's rates are the product's own and they are wrong.** AS-05
  (`cubit.bible.xml:873`) names only the ids; `src/core/model-ledger.types.ts:23-26` prices
  `claude-opus-5` at $15/$75 and `claude-sonnet-5` at $3/$15 per MTok against the published $5/$25
  and $2/$10. Every AI cost the project home shows (R-AI-005) is overstated 3× and 1.5×.
- **Opus 5.5's breaking changes do not reach the product's seam as it stands**: no `tool_choice`,
  `budget_tokens` or disabled thinking under `src/core/model` or `src/modules/ai`, and no Anthropic
  SDK dependency in `package.json`. Moving the product's pin to `claude-opus-5-5` is an AS-05
  amendment plus a migration re-closing `model_calls.model_id` — the same shape as `jev-latest`.

Before the session closed: the demo server and the relay stopped (they held 3211, and the next
session's gate refuses its db lane while 3211 is held). `pkill -f` with the relay's argument
matched its own shell's command line and killed the shell — `pgrep -ax socat` is the safe read.

## The orchestration, accounted

| run | shape | agents | subagent tokens | tool uses | wall |
|---|---|---|---|---|---|
| `session-6-orientation` `wf_58e79a18-0b1` | 11 readers + completeness critic | 12 | 1,474,997 | 685 | 16.7 min |
| `m3-doors-design` `wf_2e4e3c8c-9b5` | 6 designers + max-effort integrator | 7 | 1,242,811 | 488 | 30.9 min |
| `m3-doors-phase-1` `wf_1e1154a0-0b2` | 4 implementers, disjoint | 4 | 381,126 | 207 | 8.9 min |
| Jev seam (single agent, resumed once) | stop-then-implement | 1 | 214,111 | 123 | 25 min |
| S4 store (single agent) | implement | 1 | 139,744 | 67 | 11.9 min |
| S5 placement + expansion (single agent) | implement | 1 | 332,539 | 112 | 29.0 min |
| S6 rail (single agent, parallel to S5) | implement | 1 | 193,381 | 117 | 13.9 min |
| **total** | | **27** | **≈ 3.98 M** | **1,799** | |

What paid for itself, in order: the completeness critic (it refused the map's framing of the second
door and was right — C5 has no mark); the design integrator (it contradicted a designer with
arithmetic, and named the edition re-mint every design but one missed); every worker's stop
condition (the Jev agent's "the provider states no confidence", S0's refusal to write prose over a
four-vs-two conflict, S2's hour-one check, S6's refusal to invent a citation). What cost: the
orientation fan-out run DURING the gate (PERF-011, my red); my four-answer I-303 (S0 caught it); the
brief's generator-derived distances (S5 corrected them); an unscoped database query.

## Commits, session 6

`d4aa70e7` test(levels-ui) · `4407612d` baseline(s-takeoff) · `7689a117` ai(seam) · `67059246`
partition(law, notation, placement), rulesets(columns) · `a7c4c176` partition(placement, expansion) ·
`a46408b0` rails(columns), offers — and the documents commit that carries this ledger.
