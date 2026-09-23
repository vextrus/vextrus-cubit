# Design Decision — S-Takeoff (the register workspace)

## The template, as it is built (Design Direction 00 §3.2)

This screen IS the grid workspace template — what S-BOQ, S-BBS, S-Levels and S-Schedules are cut
from in M3. Grid first: inside `shell-main` exactly two things stand above the lines table, the
36 px filter bar and nothing else, because the tabs row is the frame's own tool track and the
inspector is the frame's one right column.

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Register             ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ rcc.co… │
│  │ Register · Coverage                    rev a3f9c2 ⎘  ● Measure │ 0.405 m³│
│  ├───────────────────────────────────────────────────────────────┤ ▣ T / D │
│  │ Class·All ▾ Kind·All ▾ Level·All ▾ Basis·All ▾ Cov·All ▾  3 of 3 │ ■ 100 %│
│  ├──────┬────────────────────────────────────────────────────────┤ Formula │
│  │ tree │ Kind ▸ │ Value ▸│Unit│ Bases │ Cov │Formula│Var│Cal│Eng│Src│ live   │
│  │ ▾STR │ ▾ GF · column (4)                          1.620 m³    │ vars     │
│  │  ▾GF │ rcc.concrete  0.405  m³  ▣ T ■100 % H×(…) S-101·C1·#1F │ ─────── │
│  │   col│ rcc.concrete  0.405  m³  ▣ T ■100 % H×(…) S-101·C2·#2A │ Trace ↗ │
│  │   C1 │ …                                                      │ ▸Technical│
│  │──────│ 28 px rows · 13 px · frozen Kind · sticky header        │         │
│  │ 0 rep│                                                        │         │
│  │──────│                                                        │         │
│  │ refus│                                                        │         │
│  │ offers├───────────────────────────────────────────────────────┤         │
│  │      │ (sticky footer)                            1.620 m³    │         │
└──┴──────┴────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tabs row (frame's tool track) | the lane's seven area tabs (I-407) + right: on this surface, the pinned revision `IdChip` + the ONE primary (Measure) | 100 % × `--toolbar-h` 32, **above `shell-main`** | the revision pair is absent with no campaign; the primary stands | — | — |
| filter bar | five chips, each `Label · Value ▾` (Combobox), then the live count | 100 % × 36 | a chip whose column produced nothing offers its all-option alone | — | five 28 px chip bones |
| index rail | the object tree (discipline › level › class › object — levels open, classes closed at rest, I-467), the struck count, every sighting that produced no line, and the level-stack offers | 240 (min 160, max 320), scrolls on its own | the tree is empty and the two sections state their own zero | `RefusalState` per sighting | one rail bone |
| grid (primary) | the shipped `DataTable`: 28 px rows, sticky header, frozen Kind, group rows with per-unit subtotals, sticky totals footer | flex; ≥ 60 % of `shell-main` at both viewports | `EmptyState` in the grid's own place — no campaign, nothing registered, or nothing matching the filters | the read's fault is the screen's error cell (`register-empty`, with the report id and the retry) | the header is real, the body is bones |
| footer | the visible set's totals, exactly and per unit (B-07) — every unit's total on the face, starting under Value and running on across the footer's empty cells where they outgrow it (I-350) | 100 % × 28, sticky | no footer cell where the set adds to nothing | — | — |
| job strip | the shipped `TrackedJobTimeline` — the pattern's timeline over the runs this screen started, FOLLOWED through the frame's jobs register — **present only while a run is being watched** (R-UI-080) | 100 % × the pattern's own | absent — never an empty "Measure runs" block | the step carries its own refusal | the pattern's own |
| inspector (frame's one slot) | the selected LINE (kind, value, bases, coverage, source chips, the formula expanded with its live variables, the Trace, the Technical disclosure) or the selected OBJECT (basis, role, corroboration, Technical, Repudiate, the attributes and their two doors) | `--inspector-w` 320 (280–480) | **absent — width 0**, never a sentence saying nothing is selected | `RefusalState` in the answer slot | — |

Above the fold at 1440×900 and at 1280×800: the grid's first row is 88 px below the top of main
(24 px of the frame's padding, the 36 px bar, the 28 px header) — inside §3.2's hard rule of 240 and
inside §7 C2's own 120.

---

Routes: `/t/{tenant}/p/{project}/takeoff` (redirect) and `/t/{tenant}/p/{project}/takeoff/register`
under `src/app/(app)/t/[tenant]/p/[project]/takeoff/**`, inside the shell frame and behind the
membership guard in `t/[tenant]/layout.tsx`. Increment inc-214-register-workspace. Law: R-TO-050,
R-TO-051, L-ACT-01, L-ACT-02, R-UI-001/002/003/004/005/010/012/020/021/023/024/030/031/050/060,
S-Takeoff, J-021, B-17, B-19, B-20, Q-11, Q-17, ARCH-01. Files: `takeoff/layout.tsx`,
`takeoff/page.tsx`, `takeoff/nav.tsx`, `takeoff/register/{page.tsx,loading.tsx,register-screen.tsx,
route-address.ts,states.ts,register.css}`; the reading and the presentational
`RegisterWorkspace` in `src/modules/takeoff/register-ui/**` with its mirrored `copy.ts`; copy at
`src/ui/strings/takeoff.ts`. Every convention of the earlier Decisions binds: `cx-` classes,
variants on data-attributes, tokens-only colour and motion, `cx-reticle` solely from its single
home, no `[data-theme]` selector in authored CSS, model values verbatim in mono (ruleset I-25),
identifiers whole (I-26). Interpretations I-1–I-169 remain in force. Chrome comes only from shipped
primitives and patterns — core Button, Input, Skeleton, BasisChip, CoverageChip; data Tree and
DataTable; the one RefusalState, OfferedGroups, ConsequenceDialog and TrackedJobTimeline (the
job pattern's timeline over the runs the screen started; `JobTimeline` until 2026-09-21) — plus the
`cx-register-*` classes this file rules.

## 0. Interpretations (numbering continues the global chain's highest, s-scale's I-169)

- **I-170 — the workspace is a module component and its shipped chrome is injected.** ARCH-01 bars
  `src/modules` from importing `src/ui`, and B-17 bars a screen from re-implementing a shipped
  primitive. `RegisterWorkspace` therefore takes its renderers: props are exactly
  `{ view, density, permitted, offline, chrome, doors }`, where `chrome` is
  `{ Tree, DataTable, RefusalState, OfferedGroups, ConsequenceDialog, TrackedJobTimeline, Skeleton,
  BasisChip, CoverageChip }` and `doors` the six procedures plus `refusalOf` (and, since
  2026-09-21, the optional `onRunSucceeded` the screen binds to its own re-read). `register-screen.tsx`
  — app layer, which may reach both — binds them once. The jsdom acceptance binds the same shipped
  components, so what a test mounts is what the route renders. Rejected: hand-rolling a tree, a
  table or a refusal card inside the module (the B-17 defect the clause calls review-blocking), and
  rejected: moving the workspace into `src/ui`, which may not name `RegisterView` at all.
- **I-171 — a screen id that must name a shipped root rides a `display: contents` wrapper.** `Tree`
  and `DataTable` fix `data-testid="tree"` / `"datatable"` after their spread, so a caller cannot
  re-id them (s-project I-134's case, and its cure): `register-tree` and `register-lines` sit on
  `<div class="cx-register-mount">` (`display: contents`) wrapping exactly one primitive, adding no
  box and no line of layout. The `role="tree"` and `role="table"` those ids name are the primitive's
  own, found inside the wrapper — one element deeper, never a second one.
- **I-172 — the five filters are the screen's, not the table's.** Class and level narrow the tree
  and the lines together; a DataTable column filter cannot reach the tree, and two filter surfaces
  disagreeing about what is shown is worse than one. All five are native `<select>` controls in the
  S-Audit I-31 idiom, above the body, filtering the rows before the table is handed its `data` —
  so `register-lines-count` reads what the virtualiser was given. Options derive from the rows the
  view holds, plus one all-option each; a filter offering values the campaign cannot produce offers
  only emptiness.
- **I-173 — a repudiated object keeps its place in the tree and its lines leave the table.**
  REPUDIATE says a person judges the object to be nothing, not that the machine never read it
  (L-ACT-01: nothing is deleted, and the register still answers with the object). The object stays a
  treeitem and stays selectable; its inspector reads `register-object-corroboration
  data-standing="REPUDIATED"` and states `takeoff_register_repudiated_note` in place of the two act
  doors, because a struck object is neither corroborated nor struck a second time. Every line
  measured off it stays on record — the reading marks it `repudiated` — and is withheld from
  `register-lines`, so nothing is priced off an object the register itself says is nothing; the tree
  panel's foot counts both the objects struck and the lines withheld. Rejected: dropping the object
  from the tree, which reads as the deletion L-ACT-01 forbids and leaves a reader no way to see what
  was struck. Rejected: keeping its lines in the table, which shows quantities standing on an object
  a person has judged to be nothing.
- **I-174 — SUSPENDED is a reading of the attribute, and it is shown as one.** R-TO-051 says
  disagreements suspend and show as such. An attribute whose standing is SUSPENDED renders no value
  at all — a value beside the word would be the very claim the suspension denies — and lists every
  competing reading with its basis, precedence and source key, under one sentence naming the way out
  (a reading at a precedence that settles it). AGREED, NONE and REPUDIATED render the enum verbatim
  in mono beside the standing value where one exists.
- **I-175 — the acts are doors on the object in the inspector, one object and one attribute at a
  time.** CORROBORATE is offered on the attribute row it would speak about, because a reading that
  does not name its attribute is not a reading; REPUDIATE is offered on the object header, because
  it speaks about the whole object. Neither is a row action on the lines table: a line is a record,
  and a correction is an observation on the object (the increment's own scope). Both open the one
  ConsequenceDialog; neither commits anything itself.

### 0.1 The v22 rebuild (Design Direction 00 §3.2, §5, §6, §8's "Register (1.5)")

Numbered in a block above the chain's high-water mark, because three rebuild leaves were writing
Decisions on the same day and two of them taking the next number would be one number meaning two
things. Everything in §0 above stands except where an Interpretation here says otherwise.

- **I-230 — the tabs row is the frame's tool track, not a strip this screen draws.** §3.2 puts the
  area tabs, the pinned revision and the one primary in a single row above the filter bar. A row
  drawn inside `shell-main` would be height taken from the work surface — and `shell-main` carries
  24 px of padding besides, which would put the grid's first row 128 px below the top of main and
  break §3.2's own hard rule (§7 C2). The lane therefore mounts the row into the frame's second
  track (`useShellToolbar`, `src/ui/shell/slots.tsx`), where it is 32 px of chrome above main rather
  than 40 px of the grid's own field, and the grid's first row sits 88 px down at both viewports.
  The row is the LANE's (`takeoff/nav.tsx`, drawn above every takeoff surface) and its right-hand
  half is the SURFACE's, so the row publishes a slot of its own — `useTakeoffTabsAside` — in exactly
  the shape the frame's three slots settled: the register mounts the revision chip and the Measure
  door into it, and a surface that mounts nothing leaves it empty rather than absent-looking.
  Rejected: passing the revision down as a prop, which a layout three levels above the screen cannot
  receive; rejected: a second tabs row per surface, which is tabs of tabs (§1).
- **I-231 — the inspector is the frame's ONE right column, and it is ABSENT until something is
  selected.** R-UI-080 and §3.1: "the slot is absent — width 0, not a placeholder sentence". The
  workspace no longer renders an `<aside>` of its own and no longer selects the first object at
  mount: with nothing selected there is no column at all, and `takeoff_register_inspector_idle_*`
  are no longer rendered anywhere (they stay in the table, unspent — a string is deleted by the node
  that owns `src/ui/strings`, never by a screen). Two things can fill it: a ROW selected in the grid
  states the line, and an OBJECT chosen in the tree states the object and carries this screen's two
  act doors. The last thing selected wins, because a right column showing two subjects at once is
  two inspectors. A module may not call `useInspector` (ARCH-01), so the mount is chrome like every
  renderer (I-170), and what it is handed is memoised on what it shows — a slot is state in the
  frame, and a node with a new identity every render would set it on every render.
- **I-232 — the five filters are chips, and the bar is one line.** I-172's ruling stands in
  substance — the filters are the SCREEN's, they narrow the tree and the lines together, and they
  filter the rows before the table is handed its `data` — and its native `<select>` is withdrawn:
  §1's "no native `select`" and §3.2's "filters are chips (`Class · All ▾`) not labelled dropdown
  rows" replace the S-Audit I-31 idiom with the shipped `Combobox` in its `chip` skin. The label
  rides inside the control, so five narrowings and the count fit one 36 px row at 1280.
  *Amended session 8 (I-442):* the one line is held by the flex row and by chips that give
  their value's width back, never by clipping the bar — a clipping bar cut off every option a chip
  opened.
- **I-233 — the campaign's index stands BESIDE the grid, never under it.** The tree, the struck
  count, the sightings that produced no line and the level-stack offers were four full-width blocks
  stacked down the page; every one of them was height the grid paid for, and the refusals and the
  offers pushed the table off the fold. They are one 240 px rail in the grid's own row now — the
  region §3.2 calls `tree`, holding everything about the campaign that is not a line — each section
  scrolling inside it. Nothing is hidden and nothing is behind a disclosure: R-UI-020's rows render
  exactly as they did, in a column instead of a band.
- **I-234 — a cited key is read as chips, and the machine's own names live in Technical.** §6: "Source
  keys render as chips `S-101 · C1 · #…`" and "people see labels, never machine identifiers". The
  `source` cell and the inspector therefore state the sheet the line stands on, the mark it was read
  for and the extractor's handle; the key itself is whole in the address the link carries and whole
  inside the inspector's `<details>` disclosure, where `register-object-key` and `register-source-key`
  stand under `data-technical` (§7 C6's own sanctioned home). A key of no known grammar
  (`parseSourceKey` answers null) is not abbreviated into one: it stands whole in the chips (I-26).
  **Amended by I-287 (docs/design/s-takeoff-register.md §0):** that last clause was written for a key
  of NO grammar and it was firing on the one key every published line in fact carries — a VIEW key,
  `v:{class}:{anchor}` (L-REG-04), which stood whole in the cell and put `DXF_HANDLE:…` on the face
  of the screen against R-UI-082. A view key now reads as its class in words (`Layout plan`) and the
  key itself stands on the link's `data-key` and in Technical; a key of no grammar still stands whole.
  Every other SCREAMING value a cell held — the selecting basis, the coverage, the engine, the
  object's role and corroboration, an attribute's standing, the discipline on a tree item — is said
  in words by `EnumLabel` (or, for the Tree, which takes a string, by the rule EnumLabel says one
  by), which keeps the raw value in the DOM under `data-technical`. The one SCREAMING word left on
  the face of this screen is `BasisChip`'s own, which is R-UI-002's single home and is not this
  screen's to re-word (B-17) — recorded in §8 with its owner.
- **I-235 — the grid is DataTable v2, with its own furniture.** §5: the key column is frozen, the
  header is sticky, the rows are `--row-h` from the ROOT's density, group rows (`▾ GF · column (4)`)
  carry a subtotal per unit, the sticky footer carries the visible set's totals, no cell wraps, every
  figure is mono tabular right-aligned and grouped as the document groups one (L-FMT-01 through
  `QuantityText`), the unit is a muted `UnitBadge` in its own narrow column, and a clipped cell earns
  the table's own Tooltip. The column order is §3.2's: kind · value · unit · bases · coverage ·
  formula · variables · calibration · engine · source. The formula is ONE LINE and is expanded in the
  inspector beside the variables it was read with — never a taller row (§5 rule 2).
- **I-236 — a row is selected with the keyboard by the grid, and with the pointer by the screen.**
  §5 rule 10 sends a selection to the shell inspector, and the shipped grid raises its own
  (`onRowSelect`: Space takes a row, ⇧ extends) — but a CLICK moves its cell cursor and takes no row,
  so a reader with a pointer could never open the line inspector. Every row publishes the line it
  stands for through the table's own `rowDataOf` seam, and a click on the grid reads that attribute
  off the row it landed on. This reaches nothing of the primitive's insides: it reads an attribute
  this screen itself put there. The row a pointer took also publishes that it is taken, and is
  painted from `--surface-selected` — the same alias the grid paints its own selection with, so the
  two read as one thing. Both halves are owed to the primitive and recorded in §8.
- **I-299 — an uncorroborated outline carries a proposal, and the two acts judge it (Jev
  logic-point 6; L-QTY-04, L-AI-01, L-AI-02, L-AI-03, R-TO-051).** L-QTY-04 defers an interpreted
  outline nobody corroborated and never publishes a line from it. The machine may say, before a
  person looks, whether the outline it interpreted is the member its mark names at the size the
  drawing states — that is L-AI-03's "flag anomalies against benchmarks", and the benchmarks are the
  drawing's own: the section its schedules state for that mark, the median footprint of the plan's
  own members, and the near-anchor reach and footprint band the pinned edition states. The question
  is ONE Noul over one state of fifteen named numeric fields, every one of them found by code before
  the call (`src/modules/takeoff/partition/placement/evidence.ts`, the one home the request builder
  and the corpus recorder both read), asked once per deferred outline after the gate and never on a
  page render; what comes back is a probability and nothing else. On this screen it is three words
  and a Tooltip in the inspector, one line above the two doors that judge it — the sentence is the
  whole of what a reader is told, the figure stands in `data-probability` and on S-Audit, and an
  object nobody asked about carries no line at all. Nothing here corroborates, publishes or strikes:
  it is L-AI-02's third arm, a classification held until a person acts, and the queue item stands
  until they do. **Corroborating** the object affirms what the machine said (AFFIRMED) or overrules
  it (OVERRULED); **repudiating** it repudiates what it said (REPUDIATED) or confirms the reading it
  pointed to (CONFIRMED); each act writes that outcome in its own transaction, with the act row or
  not at all (`recordModelOutcome`, the CONFIRM_VIEW_TYPE precedent). The band between the two
  thresholds — `CORROBORATION_NO` 0.30 and `CORROBORATION_YES` 0.70, the caller's policy in
  `src/core/outline-corroboration/law.ts`, never the seam's — is the machine's own statement that it
  could not tell, and a proposal inside it is filed neither way: an outcome taken from it would
  poison the very calibration line the thresholds are read off. The act names the proposal it judged
  because the screen showed it: an act beside no proposal is exactly the act it has always been, and
  a call that is not this project's, not this question's, or that refused, files nothing. The
  proposal is not exported: an export is a published reading and a proposal is not one.
- **I-305 — a circular column is L-FRM-01's PRISM_POLY, and it is billed by its own rule (L-FRM-01,
  L-FRM-02, L-QTY-03, B-17).** L-FRM-01's geometry union is a CLOSED one — PRISM_RECT · PRISM_POLY ·
  FRUSTUM_RECT · TAPER_LINEAR · AREA_THICK — and a builder may not amend the Bible, so a round column
  is not a new member of it. It does not need to be: a circle is a plan that is no rectangle, which
  is the whole of what PRISM_POLY is for, and the precedent is landed and is cited rather than
  re-argued. `src/modules/takeoff/rails/foundations/concrete.ts:60-66` reads a bored pile exactly
  this way — "A pile's shaft is a prism over a plan that is no rectangle — a circle — so it is offered
  under L-FRM-01's PRISM_POLY like every other non-rectangular prism this leaf reads. What makes it a
  circle rather than a polygon is the RULE its line names, `rcc.pile.concrete`, whose template prints
  the π/4 · d² a reader audits (L-QTY-03)." A circular column follows it clause for clause:
  PRISM_POLY geometry, a rule of its own standing beside the rectangular one
  (`rcc.column.circular.concrete@1` against `rcc.column.concrete@1`), and a printed formula that
  states the shape it measured — `count × π × d × d × H ÷ 4`, the quarter of π d² written as a
  division rather than off a radius nobody read on a drawing, π by its digits rather than its glyph,
  and `d × d` rather than a power node the tree does not have. Two rules rather than one that took
  whichever reading it was handed, because a single method prints a sentence that does not say what
  was measured, and the difference is not decoration: a 450 circle is 78.5 % of a 450 square, which
  is the whole of what the band refuses. Where the shape comes from is not this Decision's to
  restate — the plan states the shape and the schedule states the size (viewer.md's I-304) — and what
  this one records is the consequence for the bill. And the thing being replaced must be named for
  what it is: measuring the porch column as a 450 × 450 prism because a B × D cell is all the
  schedule offered is precisely the "silent bounding-box fallback" L-FRM-01 forbids, and it has been
  shipping.
- **I-311 — an offered level stack is confirmed as its KEY, and its membership is the offer standing
  now (session 7, 2026-09-23; L-ACT-02, L-MEA-07, D-001).** L-ACT-02: "Bulk is offered, never
  assembled: the machine offers groups keyed on the fact judged (typed grouping key over a closed enum
  + resolved membership in the Consequence)". The register used to hand the browser the offer's levels
  as `{label, ordinal}` and post that list back to INSERT_LEVEL — the browser assembled the stack, and
  the drawing's own storey readings (D-001's `132 in` @1D90 on F-RCC6-BNBC's GF) never reached the act,
  so a J-000 run stood GF at 3.353 on one reading while the store held the proposal. Now the register
  posts `{kind: PROPOSED_LEVEL_STACK, drawingId, ingestId}` alone; the server resolves the offer
  (`levelsOfferedUnder` over `proposedLevelStackOf`) — members only while that drawing's standing
  partition is the same ingest and proposes a stack, else `GROUP_NOT_OFFERED`, the code every offered
  group shares — and hands the act the offer's levels WITH the readings the drawing stated (TRANSCRIBED,
  each citing its mark), the same way for preview and commit. A level inserted by hand states a label
  and an ordinal only; a reading a client states is `REQUEST_MALFORMED`, because a person's reading of
  a height belongs to AUTHOR_STOREY_HEIGHT. F-RCC6's confirm is unchanged in effect (its proposal
  carries no readings; the by-key Consequence and digest equal the old list's). **IOUs, owner named:**
  the Consequence names levels and ordinals, not the readings the offer carries, so the digest does not
  bind them (only a re-partition of the same ingest could move them between preview and commit) — the
  node that next amends INSERT_LEVEL's rendering; and a confirmed offer is still offered, so confirming
  it twice authors the stack twice — retiring an offer needs a record of which offer a stack came from
  (a migration) — the same node.

### 0.2 The craft look (session 7, 2026-09-23; R-UI-080..086, AM-08 — the later law)

Numbered `I-reg-n` rather than from the global chain: several craft implementers amended Decisions on
the same day, and one number meaning two rulings is the defect §0.1 names. The look scored the
register BELOW the bar (chromeGeometry 2, tokensAndGrid 3) on F-RCC6-BNBC's M3 campaign: 242 of 424
lines showed a blank Value with no reason, the circular column C7 printed
`0.53323979985339035022662733` and π to twenty places, `rcc.concrete`, `pile_cap` and `FOUNDATION`
stood raw on the face of the grid, and the ten columns were 1,428 px in a 1,088 px grid, so Engine
and the Source Trace were off screen at both viewports. Each ruling below amends this Decision IN
PLACE (§1, §3, §5 carry the new text); where it contradicts I-25/I-235 as first written, the later
law (R-UI-082, R-UI-083) is why.

- **I-reg-1 — a line kept with no quantity SAYS why, in its own row (L-QTY-02, R-UI-020, R-UI-002).**
  L-QTY-02 keeps a PARTIAL_DECLARED line "with every omitted component enumerated on the row", and the
  store has always held them (`quantity_lines.omitted`: `{variable, code}[]`); the reading now
  carries them (`ViewLine.omitted`). The Value cell of such a line states the variables the drawing
  did not state — `takeoff_register_value_omitted` **{variables} unstated** (`L, B, D unstated`) — in
  muted UI text, never a figure and never a zero, with the codes on `data-omitted`; a line that
  enumerated none states `takeoff_register_value_unstated` **No figure**. The inspector lists every
  omission under `takeoff_register_omitted_label` **Left out**, each variable beside the REGISTERED
  sentence of its code (never the code). The coverage cell wears the `CoverageChip` ONLY on a
  COMPLETE line: a red `0%` beside a partial line was a percentage nobody computed, and it read as
  "nothing measured"; the coverage word (`EnumLabel`) still says the coverage. Rejected: a Tooltip per
  cell (242 Radix roots for a sentence the inspector already says whole).
- **I-reg-2 — a figure's face is its kind's display precision; the exact value is one selection away
  (L-QTY-03, L-FMT-02, B-07, R-UI-082).** I-25's "never re-rounded" is kept where it is law — the
  register and every `data-value` hold the published decimal whole, and the inspector's Value states
  it whole — and withdrawn from the FACE of a grid cell, where it put 26 decimal places on screen.
  The row's figure and the sticky footer's totals are stated at the places the catalogue writes the
  kind to (`placesOf`, `placesForUnit` — the draft BOQ's own precision, so the register and the bill
  print one line alike), by the bar schedule's text-only half-up `statedAt` handed to `QuantityText`
  as its `format`; the exact sum stays in `datatable-total`'s `data-value`, where J-000 reads it. The
  footer's totals stand right-aligned under Value with their unit beside each; more than one unit
  also carries every total in the cell's Tooltip. A formula's one-line face cuts a constant written
  to more than six places at six with `…` (`3.141592…`, I-305's π) and the inspector states it whole.
  Model values that are enums are said in words (R-UI-082): the kind by the draft BOQ's one rule
  (`inWords`: `rcc.concrete` → `Concrete`) through `EnumLabel` with the stored key in its technical
  disclosure; a class in the tree, the group row and the filter chips the same way (`Pile cap`); a
  lawful-null level SLOT (`FOUNDATION`, `UNRESOLVED`) by `humaniseEnum` (`Foundation`), while a
  stack label (`GF`, `1F`) stays verbatim because it is the drawing's own word. Marks in the tree read
  in natural order (`P1, P2 … P10`), by a digit-run comparison that asks no locale (L-FMT-01).
- **I-reg-3 — eight columns that fit, and the evidence before the derivation (R-UI-080, R-UI-083,
  Direction §5 rule 3's ≤ 8 at 1280, Direction §6).** Columns and widths: `kind` 120 · `value` 116 ·
  `unit` 56 · `bases` 184 · `coverage` 128 · `source` 168 · `formula` 152 · `variables` 140 = 1,068 px,
  inside the 1,088 px grid at 1440 with nothing cut; at 1280 (928 px) every column through Source is
  whole and the grid scrolls inside its own box for the derivation (C10). Calibration and Engine
  LEAVE the grid for the line inspector, beside the formula they qualify (the engine as an
  `EnumLabel`, every calibration key as its `IdChip`), which also takes 424 copy targets out of the
  grid. Source moves ahead of Formula: the Trace is the product's evidence surface and the column a
  reader must reach without scrolling, while the formula is expanded in the inspector anyway.
  Rejected: narrowing all ten to fit (Bases and Coverage are a chip and a word, measured, and cannot
  shrink without cutting the word); rejected: keeping the ten and waiting for the table's
  `defaultHidden` (§8's IOU — the demo cannot).
  *Amended session 8 (I-468):* `source` 208 · `formula` 132 · `variables` 120, measured for the
  chip VD-1 names (`S-10 · C1 · Layout plan`); the eight add to 1,064, as the widths above always did.

### 0.3 The re-look (session 7, wave 3, 2026-09-23; R-UI-082, R-UI-083, B-07)

A vision re-look of the M3 campaign found the register at the bar by score and not demo-ready. Its
own id from the central allocation (I-350), because the `I-reg-n` run belongs to the look above.

- **I-350 — the register reads as a quantity surveyor reads it: every total on the face, every clip
  marked, every member's lines together (R-UI-083, §5 rules 1–2, I-reg-2 amended in part).**
  (a) *The footer states every total.* The sticky footer's one Value cell held `89 pcs · 372.849 m³
  · 1,898.904 m` in 116 px, flush right, so the list overflowed on the START side, under the frozen
  Kind cell: the face said `1,898.904 m` and a sliver of a badge — the whole 709-line register read
  as its boring length — and the other totals lived only in a Tooltip. The totals are now one
  unshrinking list (`cx-register-totals`, `data-units` the count) in the order the units first
  appear, one `--space-3` apart, each `QuantityText` with its unit, and the one footer cell holding
  them (`.cx-table-footercell:has(> .cx-register-totals)`, reached through the screen's own
  `register-lines` wrapper) is `justify-content: safe flex-end; overflow: visible`: right-aligned
  under Value while the list fits, and otherwise started under Value and run on across the footer's
  empty cells to its right, so the first unit is never the one lost. The Tooltip is withdrawn — a
  total a reader has to hover for is one the footer did not state. `datatable-total`'s
  `QuantityText` keeps the exact sum in `data-value` with its `UnitBadge` inside it, so the J-000 leg
  reads what it read. Rejected: one total per trailing column (a column the reader hides would take a
  total with it); rejected: flex-start with an end ellipsis (still hides every unit but the first).
  What this cannot fix, owner named: the DataTable's footer has no spanning cell, so a consumer that
  needs one reaches into `.cx-table-footercell` — the primitive's owner (`src/ui/primitives/data`)
  may give `totals` a spanning form, as the group row already has, and this rule then retires.
  (b) *A composed cell is inline text.* `cx-register-bases` and `cx-register-coverage` were
  `inline-flex` boxes sized to their content: to the table's `.cx-table-cell-text` that is one atomic
  box, and the first atomic box on a line is clipped, never ellipsised, so every row read
  `Transcribe` with no mark to say so. They are now `display: inline` (the chip and the word are the
  line's inline text, `--space-1` apart by margin, `vertical-align: middle`), so the table's own
  ellipsis ends the word and the table's own Tooltip states the cell whole — the levels grid's rule,
  for the same reason. The selecting basis carries `cx-register-selecting` and reads in
  `--ink-secondary`, in the cell and in the inspector's Bases row: the chip is the basis the figure
  rests on, the word the basis the object was selected on, and the quieter ink says which is the
  qualifier. (Naming the two in words needs a copy key the module's mirror cannot add alone — §8.)
  *Amended session 8 (I-466):* the word stands only where it differs from the chip's, and the Bases
  header's Tooltip names the two halves.
  (c) *The Source link is placed in its cell* (s-takeoff-register §1 amended): the link is a flex
  item no wider than the cell (`min-width: 0`), its label `overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap` on a `--space-6` line box (the target's own height, so the clip never takes the
  underline); the glyph, the rule, the ink and the 24 px target stay the pattern's. It read `Model ·
  P27 · Layou`, sliced. The table's Tooltip no longer fires on this cell (nothing overflows the cell's
  text box any more); the chips stand whole in the link's accessible name, beside the key on its
  `data-key`, and in the line inspector's Source row one selection away.
  (d) *The lines are in reading order.* The reading (`registerViewOf`) sorted by `published_at,
  line_id`, and one campaign publishes at one instant, so the order was the line ids': P27 Bored, P50
  Concrete, P4 Boring … across a 267-line group while the tree listed P1 … P89. It now sorts by
  `readingOrder` (`register-ui/order.ts`, pure): the level — the FOUNDATION slot below the stack, a
  stack level at its ordinal, anything the stack does not place after it — then the level's label,
  the class, the mark by the tree's own digit-run order (`markOrder`, moved into the same file so the
  tree and the grid read marks by one function), the kind, and the line id last so the order is
  total. The groups follow (the table groups in first-appearance order): `Foundation · Pile`,
  `Foundation · Pile cap`, `GF · Column`, `1F · Column` …; within a group one member's lines stand
  together, `Bored · Boring · Concrete`. A reader's own column sort still overrides it.

### 0.4 The seventh tab (session 8, S-Ask — I-230 amended in its roster, not its rule)

- **I-407 — the row holds the lane's seven surfaces, and the seventh is Ask.** I-230 ruled the row
  when it held two entries; it has since grown one surface at a time, each surface's own Decision
  adding its entry (s-levels, s-schedules, s-boq, s-bbs), while §1 here still named two. It is now
  stated whole, in the order a quantity surveyor works a takeoff: **Register · Coverage · Levels ·
  Schedules · Draft BOQ · Bar schedule · Ask** — each label from its surface's own string table, each
  address from its surface's own route builder (B-17), the rule of the row (the frame's track, the
  surface's right half through `useTakeoffTabsAside`) unchanged. Ask stands last because it reads what
  every surface before it states — the register, the levels, the schedules, the sheets — and answers
  nothing they do not hold; it is also reached by question from ⌘K (s-ask I-402), so its place in
  the row is the way back to a conversation, not its only door. **Its label is a verb on a tab**
  (Direction §6: "Verbs on buttons, nouns on tabs."), and that is read, not waived: `Ask` is the
  screen's own name (S-Ask; X-7's "Ask the drawings"), and the nouns that would stand in its place
  tell a quantity surveyor the wrong thing — "Queries" and "Questions" are the query sheet a QS sends
  the designer about an unclear drawing, which this screen is not. On Ask the right half holds the
  pinned revision alone (`ask-revision`): the screen's one primary, **Ask**, belongs to its question
  field in main, because a primary a row away from the words it sends is a door separated from its
  input. The row must stay one row at 1280: by estimate the seven labels take about 590 px with their
  padding and the widest right half the lane draws (S-BBS's revision, stock readout and export) about
  590 more, which leaves the row inside `shell-main`'s 1,232 with little to spare; the ASK-1b walk
  measures it at both viewports on S-BBS (§7 C10), and a row that does not fit is recorded against
  that surface's right half (s-bbs.md), never cured by cutting a tab. The new entry moves every
  takeoff-lane picture, which the gate re-takes in one `baseline:` commit naming the seventh tab
  (s-ask §6). Rejected: Ask as a panel over every surface (s-ask I-402 — a second right column or
  an overlay on the work surface); rejected: Ask first in the row (the register is the lane's landing
  surface and its redirect target, §1).

### 0.5 The filter chips open (session 8, wave 1; walk-0's BLOCKS_DEMO on register-trace)

walk-0 walked the served register as a QS narrowing 1,131 lines to "the pile caps" and could not:
a click on any chip swapped the whole bar for one empty `Filter…` field and showed no option. The
listbox was in the DOM (the Kind chip held 8 options, at y = 132–160), `elementFromPoint` there
returned the grid, and only a reader who typed blind, pressed ↓ and Enter could filter
(`.private/work/session-8/walk0/walk-register-trace.json`, screenshots 02, 03, 23).

- **I-442 — the bar a chip stands in clips nothing; the chip's options stand over the grid
  (I-232 amended, §1's filter bar amended).** The cause was one declaration, I-232's reading of the
  bar as `height: 36px; overflow: hidden`. The Combobox's popover is positioned against the chip's
  own box and stands below it, so a 36 px box that clipped cut every option off; and a clipping box
  is a scroll box, so focusing the popover's field (which opening does) scrolled the bar 37 px until
  the field was all it showed — the "empty Filter… box" walk-0 saw. Ruling: `.cx-register-filters`
  is `overflow: visible`; the bar stays one 36 px line by the flex row's own `nowrap` and by chips
  that give their value's width back (`.cx-register-filter { min-width: 0 }`, the value ellipsised
  by the primitive), and no box of this screen between a chip and `shell-main` clips. The popover
  stands on `--z-overlay` (200), above every layer the grid stacks (its sticky header, footer and
  frozen column top out at `--z-sticky` + 3), so an option over the header row is still the option.
  Evidence, from a static page of the bar's markup over the tree's own stylesheets in the product's
  Chromium at 1440 × 900 dark and 1280 × 800 light (the served product is the integrator's walk):
  with `hidden`, the bar's `scrollTop` read 37, every option hit-tested to the register or the index
  rail and no chip hit-tested at all; with `visible`, every option and all five chips hit-test to
  themselves, the bar reads `scrollTop` 0 and `shell-main` gains no sideways scroll. Rejected: portalling the popover (the Select keeps its list inline for the same reason —
  the surfaces a control stands in own their stacking — and a portal would put a second positioning
  scheme beside it to escape a clip this screen itself declared); rejected: `overflow-x: clip` beside
  a visible block axis (it would cut any popover that runs past the bar's end, and nothing bounds a
  popover's width to the bar).
- **I-443 — the keyboard reaches every chip and a closed list leaves the reader where they
  were (the Combobox, applied here; B-17: one control, one idea).** Opening a chip moves focus into
  its filter field, and closing it used to take that field out of the document with focus inside
  it, which drops a reader at the top of the page: the next Tab went to the document's first stop,
  not the next chip. Four facts, all the primitive's: an option taken (pointer or Enter) and Esc hand
  focus back to the chip; focus that leaves the control closes the list behind it — Tab is the
  browser's own step from the field (its last stop) to the next chip, Shift+Tab lands on the chip
  itself — as the Select's Tab already did, so no list stands over the grid behind a reader who has
  moved on, while a press inside the popover (an option, its padding, the no-matches line) is
  cancelled at `pointerdown` so focus never leaves the field under the reader's own pointer (checked
  in the product's Chromium: a cancelled `pointerdown` keeps focus, an uncancelled press on plain
  content blurs onto nothing); a press anywhere else closes the list as Esc does, query and all, so the next opening
  starts whole (it reopened on the last query); and the cursor ↑ ↓ move is asked into the list's view
  (`scrollIntoView({ block: "nearest" })`, which moves only the list — measured: 56 px for the
  eleventh level at 1280 × 800, `shell-main` 0), because the list shows nine rows and a building's
  levels run past them, and `aria-activedescendant` scrolls nothing. The list is `tabindex="-1"`: a
  browser makes a scrolling box a Tab stop of its own, and a stop between the field and the next
  chip that no key can take an option from is a stop in the way.

### 0.6 The register after the Trace (session 8, wave 2; the re-look's D5 and D6, and the rail)

VD-1 made the Source chip name the sheet a line stands on (`S-10 · C1 · Layout plan`) and its link
open that sheet. Four things the re-look and walk-0 found on the same screen remained: a pile's
Bases cell said "Transcribed" twice; the tree opened every class, so the rail was the whole campaign
(495 items on F-RCC6-BNBC) and everything below the tree stood about 14,000 px down; the rail's
heading wrapped and its copy said "rail"; and the Source column cut the chip VD-1 had just named.

- **I-466 — the basis is said once where the pair agrees, and the Bases header names the pair
  (I-350 (b) amended; pays §8's "The Bases pair names neither half").** A bored pile is read as
  TRANSCRIBED and selected as TRANSCRIBED, and its cell read `▣ Transcribed Transcribed`, the second
  word clipped at 184 px. The selecting basis is said beside the chip **only where it differs** from
  the basis the figure rests on — a word is said where it adds a fact (the copy diet of I-lev-2) — and
  both stored values stand on the cell whatever its face says (`cx-register-bases` carries
  `data-quantity-basis` and `data-selection-basis`; the inspector's Bases row the same two, beside its
  `data-basis`). One function reads the rule for the cell and the inspector alike. Where the two
  differ — most lines, whose selecting attributes default: `▣ Transcribed Defaulted` — the pair stands
  as I-350 laid it out, the word the quieter qualifier. The Bases header, and the inspector's Bases
  label, now say which half is which: each is the column's word as a focusable Tooltip trigger
  (`cx-register-hinted`, the reticle from the Tooltip's own home) whose content is
  `takeoff_register_bases_hint`. The width stays 184: the differing pair still needs it. Rejected:
  dropping the selecting basis from the grid (it is the rate's evidence — "a wrong selecting attribute
  is the right number at the wrong rate", `gate/evaluate.ts`); rejected: `Figure · Selected` labels
  inside every cell (two more words on 1,131 rows to say what one header says once).
- **I-467 — the tree stands open at its levels; a class opens on demand, and the class a Trace
  returns to opens by itself.** §1 already ruled "every discipline and level expanded by default"; the
  code opened every class besides, which departed from it, and on a measured campaign that put every
  member of the building in the rail ahead of the struck count, "Deferred and refused" and the level
  stacks (walk-0: about 14,000 px of marks). The tree now seeds its open set with its disciplines and
  levels only. The one class opened at rest is the class of the origin line — the `?line=` a Trace's
  Back returns with (I-180, I-182) — so the reader who went to the drawing lands among that member's
  marks. The shipped Tree is uncontrolled and reads `defaultExpandedIds` once, and the origin is read
  in an effect after the first paint (I-182's hydration rule), so the tree is keyed on the origin's
  class and mounts once more when the address names one; the primitive is not touched. Rejected:
  opening a class when one of its objects is selected elsewhere (the Tree takes no open set from
  outside after mount — a change to the shared primitive, recorded in §8); rejected: moving the
  refusals and offers above the tree (the index is the rail's first section, and the zero counts
  below it are now a short scroll away rather than a campaign away).
- **I-468 — the Source column is 208 px, measured (I-reg-3's widths amended).** In the product's
  Chromium, the Trace link reads 177 px for `S-10 · C1 · Layout plan` (Spline Sans Mono at 12 px, the
  basis glyph at 13 px and its 4 px gap) and 191 px with a four-character mark (`S-13 · 1B12 · Layout
  plan`, `S-101 · C12 · Layout plan`); with the compact cell's 16 px of padding the column wants 207,
  and it is 208 on the 4 px grid. At 168 the chip ended `S-10 · C1 · Layou…`. The 40 px come from the
  two columns the inspector states whole — `formula` 152 → 132 and `variables` 140 → 120 — so the eight
  still sum to **1,064** (I-reg-3 wrote 1,068; its own eight widths add to 1,064), inside the 1,088 px
  grid at 1440, and at 1280 everything through Source is 812 of the grid's 928. A longer chip — model
  space said in words (`Model space · C1 · Layout plan`, 226 px) or a `Long section strip` view — still
  ends in I-350 (c)'s ellipsis and stands whole in the link's name and the inspector's Source row. At
  the comfortable density (12 px padding) a four-character mark's chip loses its last few pixels; the
  product's default is compact. Rejected: narrowing Bases (the differing pair needs its 184).
- **I-469 — a rail heading is one line, and "rail" leaves the copy.** `takeoff_register_tree_label`
  read **Objects by discipline, level and class**, 221 px at 13 px in a 214 px heading box, and wrapped;
  **Level stacks read from the drawings** measured 217 and wrapped too. They read **Objects** and
  **Proposed level stacks** (48 and 132 px; 51 and 142 at 14 px), the tree names itself by the same
  word, and `.cx-register-panel-heading` holds one line by rule — `nowrap`, ended in an ellipsis where
  a heading would ever outgrow the rail — so a platform scrollbar in the rail clips a word rather than
  adding a line of chrome. A clipped box has no automatic minimum height, so the heading is also
  `flex: none`: without it the rail's scrolling column squeezed **Objects** to 17 px, its top half cut
  (seen in the product's Chromium over a static render of a 94-line register). The level-stack offer
  is laid out for the rail as well: the pattern sets a group as one row — sentence, count, door — and
  in 214 px that stood the sentence one word to a line and the door's label on three (walk-0's
  "Level / stack / proposed / from …"); in the rail the three stand one under another, each at its
  own width, the door never a full-width bar (`.cx-register-level-stack .cx-offered-group`, one
  `minmax(0, 1fr)` column, `justify-items: start`). The count and the door do not fit one line
  (about 70 and 150 px), so they do not share one. §3's voice already bars "rail" from what a reader
  sees; three sentences said it (the Measure hint and the two empty states of a campaign with no
  lines), and they now say what the reader gets: lines measured, quantities read, objects read from
  the drawings.
- **I-470 — Escape lets go of the selection, and the inspector with it (I-231 applied to the
  keyboard).** walk-0: "the line inspector has no close control and Escape does not deselect; only
  clicking the row again does". The frame's column is absent with nothing selected, so letting go of
  the selection is closing the inspector: Escape clears the selected line or object from anywhere on
  the page — heard on the document, because the inspector stands in the frame's slot outside this
  screen's tree, and on its way into the tree, because the shipped Tree lets no key on its rows past
  it — while something is selected and no act dialog is open. An Escape a control already answered
  stays that control's (a chip closing its list, a cell handing its cursor back, a Radix layer — each
  prevents the default), and one typed into a field stays the field's, so a reading half-written is
  never dropped with its object. A row the grid itself took with Space keeps the grid's own paint
  until the grid is told (§8's "A row taken with the pointer" — the same primitive's debt). A visible
  close control is the frame's slot's, not this screen's (§8). *Amended in the review of C4' (session 8):* "a field"
  is the shell's one reading of it — `isTextField` from the shortcut roster
  (`src/ui/shell/shortcuts/roster.ts`), handed down as chrome (`RegisterChrome.isTextField`) — never a
  second list of tags in this module (B-17); and the tree's Escape defers to a layer that answered the
  key first, as the document's does.
- **I-471 — an Escape pressed inside the inspector puts the reader back where the selection was
  taken.** Letting go takes the inspector away, and with it the control that held focus: the review
  found the reader left on the document body answering no key — the defect I-182 names for the
  Trace's Back — where before I-470 the same Escape did nothing. So when the Escape's target stands
  in the inspector, focus moves BEFORE the selection goes (the inspector unmounts on the render
  letting go causes): to the selected line's row — the grid's cursor cell if it stands in that row,
  its first cell otherwise — or to the selected object's item in the tree. A row the grid has windowed
  away, or an object whose class the reader has since closed, is not drawn; then focus goes to the
  stop that region keeps in the Tab order (the grid's cursor cell, the tree's roving item). All of it
  is read from what the page draws — the `data-line` this screen publishes on its rows, the tree's
  node id (`objectNodeOf`, the one spelling of `o:<objectKey>`), the widgets' ARIA roles — never from
  a primitive's state. An Escape from the grid or the tree needs nothing: the element holding focus
  stays. An Escape on the frame's own seam (the slot's resize separator) is the slot's to answer —
  recorded in §8 beside its close control. Rejected: remembering `document.activeElement` at the
  moment of selection (a click on a row's Source link or a cell control would put focus back on a
  control the reader never meant to return to, and a virtualised row's node is not the node it was).
- **I-472 — a composed header is named by its column's words (pays §8's "A composed header names
  its column by its id").** I-466 made the Bases header a word inside its Tooltip trigger, and the
  shipped table named a non-string header by its id in the three places no rendered header reaches —
  the column drawer (`⋯`) listed `bases` in lower case beside `Kind` and `Value`, the resize handle
  was `Resize bases` — a code in front of a reader on the demo screen (R-UI-082). The table's column
  meta takes `label` (`DataTableColumnMeta.label`, `docs/design/primitives-data.md`), which its
  `headerText` reads after a string header and before the id; the Bases column states
  `takeoff_register_col_bases` there, so the drawer, the handle and any filter say **Bases**. The
  primitive's change is additive — a column that states no label, or whose header is a string, reads
  as it did.

## 1. Layout and hierarchy

`takeoff/layout.tsx` renders `<TakeoffTabs>` around `{children}`: the lane's 40 px-of-content tabs
row, mounted into the frame's 32 px tool track (I-230), and the surface itself below it in
`shell-main`. The row is `<div class="cx-takeoff-tabs">` holding `<nav data-testid="takeoff-nav"
aria-label={takeoff_nav_label}>` — one `next/link` per surface, seven in I-407's order:
`takeoff-nav-register`, `takeoff-nav-coverage`, `takeoff-nav-levels`, `takeoff-nav-schedules`,
`takeoff-nav-boq`, `takeoff-nav-bbs` and `takeoff-nav-ask`, each label its surface's own table's and
each address its own route builder's, each 13 px `var(--weight-body-medium)` `--ink-secondary`, `cx-reticle`, the
entry for the address in the browser carrying `aria-current="page"`, `--ink` and a 2 px
`--line-accent` underline (the Tabs idiom in a nav of links, s-project I-125) — and, right-aligned,
`cx-takeoff-tabs-aside`, which is what the surface standing in the row has mounted. The register
mounts two things there and nothing else: `takeoff_register_campaign_label` over the pinned
`setRevisionId` as an `IdChip` (`data-testid="register-campaign"`, R-UI-082 — short on screen, whole
in `data-value`, one press from the clipboard), and the ONE primary this screen holds,
`<button data-testid="register-measure">` `takeoff_register_measure`, whose hint
(`takeoff_register_measure_hint`) is its Tooltip and no longer a sentence under it (§6's copy diet).
Not the act variant: enqueueing a job is not an act (offered-group I-81's reading of the copper
scarcity). `takeoff/page.tsx` is a redirect and renders nothing.

The register page renders in `shell-main` as `<div class="cx-register"
data-testid="register-workspace" data-state={…} data-campaign={campaignId}>`, a column flex of
`height: 100%` — the field is the frame's track, so the body below takes what the bar above it
leaves rather than growing the page. Its `<h1>` is `takeoff_register_heading` clipped out of sight
(`cx-register-title`, out of flow, `clip-path: inset(50%)`, no width/height/negative-margin literal):
the breadcrumb and the current tab both say *Register* where a reader can see it, and §1 forbids a
heading with a sentence under it over a work surface. `takeoff_register_caption` is therefore no
longer rendered anywhere (I-231's note on unspent strings applies to it too).

**Answer slot** — `<div data-testid="register-answer" aria-live="polite">` under the h1, empty until
a door is refused, `display: none` while it is empty. It holds exactly one RefusalState, no chrome
around it (R-UI-020): `CAMPAIGN_NOT_FOUND` from the Measure door, `READING_NOT_NUMERIC` or
`ACT_CHANGES_NOTHING` from a preview, `PERMISSION_NOT_HELD` while `permitted` is false. A preview
rejection is answered here and **no dialog opens** — a dialog that opens on nothing is a consequence
of nothing. The offline banner is its sibling, above it.

**Job strip** — `<section data-testid="register-timeline">` holding the shipped
`TrackedJobTimeline`, rendered **only while this screen is watching a run** and absent otherwise
(I-230's companion rule, R-UI-080): the "Measure runs" block that stood empty over the grid is
exactly the height §8 took this screen's first point for. One tracked job per measure run the door
answered, the job pattern rendered where the operation was started (R-UI-024). *Amended 2026-09-21
(session 3):* "tracked" is now literal — the workspace hands the pattern the JOB the door answered
(`jobId`, `kind`, the campaign as `subject`, the evidence) and never a step it wrote; the pattern
follows it through the frame's jobs register and draws what it reads, and tells the workspace when
the run succeeds (`onRunSucceeded`), which is the screen's cue to read the register again (X-1). The
register had drawn a `queued` step of its own and never followed the job: J-000's column-lines leg
read `data-status="queued"` for 240 s over a run the worker had completed at +2 s.

**Filter bar** (I-232, I-442) — `<div class="cx-register-filters">`: one row, `height: 36px`,
never wrapping, `overflow: visible` — a chip's options stand below the bar, over the grid, and a bar
that clipped cut them off. Five shipped `Combobox`es in the `chip` skin, in this order, each labelled
by its own word and placeheld by its all-option: `register-filter-class`, `register-filter-kind`,
`register-filter-level`, `register-filter-basis`, `register-filter-coverage`. Options derive from the
rows the view holds (the basis chip from the roster's own order, narrowed to what the campaign
published), plus one all-option each; a filter offering values the campaign cannot produce offers
only emptiness. Then `margin-left: auto`, `<p data-testid="register-lines-count" role="status">` —
`takeoff_register_lines_count` filled through `formatUserFigure`, 12 px `--ink-muted`, tabular,
mounted from first paint. That count line is the ONE helper line this screen spends in main (§7 C7).

**Body** — `<div class="cx-register-body">`, a flex row of `gap: var(--gap-section)` and
`min-height: 0`, taking the rest of the field; one column below `min-width: 960px` (the md token's
value, the one lawful literal in a media query — S-Audit's ruling).

- **Index rail** (I-233) — `<section class="cx-register-panel cx-register-index">`, `flex: 0 0 240px`
  (min 160, max 320), scrolling on its own. `<h2>` `takeoff_register_tree_label`, one line (every rail
  heading is `nowrap`, ended in an ellipsis — I-469), then the I-171
  wrapper `data-testid="register-tree"` around the shipped `Tree`: items nested discipline → level →
  class → object, every discipline and level expanded by default and **every class closed**, save the
  class of the origin line a Trace returned with, which opens (I-467); the discipline said in words and
  the level, class and mark verbatim (`GF`, `column`, `C1`), **no default selection** (I-231).
  `onSelect` of an object node fills the inspector and clears any selected row; a branch node selects
  and expands and changes nothing else. Under it `<div data-testid="register-repudiated-count">`
  `takeoff_register_repudiated_count` in mono 12 px — always rendered, the zero form being a counted
  empty set, never a hidden cell (I-173). Then the two sections that were bands across the page:
  `<section data-testid="register-refusals" data-count={n}>`, whose `<h2>`
  `takeoff_register_refusals_heading` carries `takeoff_register_refusals_hint` as its Tooltip rather
  than as a sentence beneath it (§6), and one `<div data-testid="register-refusal" data-code
  data-object data-kind>` per queue item and refused sighting, in the order the view answers them,
  each stating the object key and kind in mono under their labels and then **exactly one**
  RefusalState from the registered entry (`INTERPRETED_UNCORROBORATED`, `DUPLICATE_IDENTITY`) with
  evidence `{ href: …/drawings, label: takeoff_register_evidence }`; and, while `permitted`,
  `<section data-testid="register-level-stack">` with the same heading-and-Tooltip shape over the
  shipped `OfferedGroups` — one item per drawing of the pinned revision with a non-null proposal,
  `key` the `PROPOSED_LEVEL_STACK` key verbatim. The view carries that key and the count, and no
  levels. Confirming opens the one ConsequenceDialog at `actType` `INSERT_LEVEL` over
  `{ projectId, group: key }` and nothing else. For the preview and the commit alike, the door
  resolves the offer that stands at that moment: its levels, each with the readings the drawing
  states for it (F-RCC6-BNBC's GF arrives carrying `132 in` @1D90, D-001). A key whose offer no
  longer stands is answered `GROUP_NOT_OFFERED` in the dialog. The browser never assembles the
  stack (L-ACT-02). There is no `input[type=checkbox]`, no
  `[role=checkbox]` and no select-all anywhere under `register-workspace` — the asserted absence is
  the substance of R-UI-023 (offered-group I-77). No code, message or remedy is spelled anywhere else
  on the screen: outside a `refusal-state` no text node under `register-workspace` spells a refusal
  code (R-UI-020, B-17).
- **Lines** (I-235) — the I-171 wrapper `data-testid="register-lines"` around the shipped
  `DataTable`, taking the rest of the row. `tableId` `takeoff-register-lines` (the drawer the
  reader's column furniture is remembered in), `getRowId` the `lineId`, `freezeKeyColumn`,
  `group` by `level|class` labelled `Foundation · Pile cap` / `GF · Column` (I-reg-2) with a per-unit
  subtotal, `totals` the visible set's own sums (`subtotalsByUnit`, the grid's own exact addition —
  B-07, stated at display precision with the exact sum in `data-value`, I-reg-2), every unit's total on
  the footer's face in one unshrinking `cx-register-totals` list, never behind a Tooltip (I-350 (a)),
  the rows in the reading's own order — level, class, mark in natural order, kind (I-350 (d)) — `rowDataOf`
  publishing `data-line` and, on the row a pointer took, `data-line-selected` (I-236), `scrollToRowId`
  the origin (I-182), `aria-label` the screen's own word. Columns in I-reg-3's order, headers from the
  copy table, at the widths they are read at: `kind` 120 · `value` 116 (`meta.align: "right"`) ·
  `unit` 56 · `bases` 184 · `coverage` 128 · `source` 208 · `formula` 132 · `variables` 120 (I-468). The five
  that hold one scalar — `kind`, `value`, `unit`, `coverage`, `source` — carry `enableSorting` with the
  value they order by: the sort control is also the keyboard way into a virtualised scroll box, which
  R-UI-012 requires and axe checks. Cells: the kind in words through `EnumLabel` (`Concrete`, the
  stored key in its disclosure — I-reg-2); the SI value through `QuantityText` at its kind's display
  precision (grouped as the document groups a figure, exact in `data-value`), and where the coverage
  is not COMPLETE no figure but the omission said in words (`L, B, D unstated` — L-QTY-02, I-reg-1);
  the unit through `UnitBadge`; the quantity basis as a `BasisChip`, and beside it the selecting basis
  as an `EnumLabel` in `--ink-secondary` **only where it differs**, both stored values on the cell's
  `data-quantity-basis` / `data-selection-basis` (I-466) — the Bases header its word as a Tooltip
  trigger over `takeoff_register_bases_hint`, and `meta.label` the same word, so the column drawer and
  the resize handle name it (I-472); the coverage as its `EnumLabel`, with a `CoverageChip` beside it
  only on a COMPLETE line (I-reg-1) — both pairs the line's inline text, so the table's ellipsis ends
  the word and its Tooltip states the cell (I-350 (b)); the cited key as the Trace's own link over its
  source chips, placed no wider than the cell with its label ellipsised (I-234, I-350 (c), and
  `docs/design/s-takeoff-register.md` I-179–I-182, which rule the cell); the formula one line,
  ellipsised, a long constant cut at six places (I-reg-2), with the table's own Tooltip and the
  inspector's expansion; variables as `name=value unit` pairs read from `bindings`. The calibration
  keys and the engine are the line inspector's (I-reg-3). A line the reading marks `repudiated` is
  not a row here at all: it is withheld and counted at the rail's foot, and `register-lines-count`
  counts the lines the table may show (I-173). No `meta.editable` anywhere, and no checkbox column.
- **The grid's own empty cell** — where the campaign is absent, where it has registered nothing, and
  where the filters match nothing, the shipped `EmptyState` stands **in the grid's place** and the
  rail beside it is untouched (§3.2's region table). The first two carry `data-testid="register-empty"`
  and, with no campaign, the one action.

**Inspector** (I-231; Escape lets go of what it states, I-470, and from inside it puts the reader back on the row or the tree item the selection was taken from, I-471) — the node this screen mounts into the frame's slot, `<div
data-testid="register-inspector" data-object={objectKey}>` (a `<div>`, not an `<aside>`: the frame's
slot is already the landmark, and two nested asides would read as two right columns to §7 C3). With
a ROW selected, `data-line={lineId}` and: the kind in words as the title; a `<dl>` of `_col_value` →
`QuantityText` with its `UnitBadge` at FULL precision (the one place the exact value is written
whole, I-reg-2) or the omission said in words, `_col_bases` (its word the same Tooltip trigger as
the grid's header) → the chip, and the label only where it differs (I-466),
`_col_coverage` → the label (and the chip on a COMPLETE line), `takeoff_register_omitted_label` →
each omitted variable beside its code's registered sentence (only where the line omitted any,
I-reg-1), `_col_source` → the source chips, `_col_engine` → the engine's `EnumLabel`,
`_col_calibration` → each key's `IdChip` (I-reg-3); then `<h3>` `_col_formula` over the formula
whole (the expansion §5 rule 2 owes the ellipsised cell) and a `<dl>` of its variables; then the
Trace's own `EvidenceLink`; then `<details>` (the platform's own disclosure — there is no shipped one, and its `<summary>` wears
the reticle from its single home) titled `takeoff_register_object_key_label`, holding
`register-object-key` and, under `takeoff_register_source_label`, `register-source-key`, both
`data-technical`. With an OBJECT selected: the mark as the title; a `<dl>` of
`takeoff_register_basis_label` → `<dd data-testid="register-object-basis" data-basis>` a BasisChip,
`_role_label` → `<dd data-testid="register-object-role" data-role>` an `EnumLabel`,
`_corroboration_label` → `<dd data-testid="register-object-corroboration" data-standing>` an
`EnumLabel`; the same `<details>`; then, where the machine proposed something about this object,
ONE line — `<p class="cx-register-corroboration" data-reading data-probability>` carrying
`takeoff_register_corroboration_yes` / `_unsure` / `_no` by its reading, inside the shipped Tooltip
whose content is `takeoff_register_corroboration_hint` (I-299) — and none at all where it proposed
nothing; then, on a struck object, `takeoff_register_repudiated_note`, and
otherwise the core **secondary** Button `takeoff_register_repudiate` (I-175) — a door in the
inspector, never the full-width bar §8 marked — absent also while `permitted` is false.
**Attributes** — `<h3>` `takeoff_register_attributes_label`, then one `<section
data-testid="register-attribute" data-attribute data-standing>` per attribute: the attribute name,
the standing as an `EnumLabel`, the standing value where one exists as `<p
data-testid="register-reading" data-role="standing">` through `QuantityText`; under
`takeoff_register_competing_label` and `takeoff_register_overruled_label` the same `register-reading`
row shape at `data-role="competing"` / `"overruled"`; a SUSPENDED attribute renders no standing row
and carries `takeoff_register_suspended_note` above its competing list (I-174); an attribute with
nothing recorded says `takeoff_register_no_readings`. Last in the row, the core ghost Button
`takeoff_register_corroborate`, which toggles a small form in place: core Inputs labelled
`takeoff_register_corroborate_value`, `_unit` and `_precedence` (the last described by
`takeoff_register_corroborate_precedence_hint`, defaulting to `0`), and a core secondary Button
`takeoff_register_corroborate_preview` which opens the ConsequenceDialog with `actType`
`CORROBORATE`, `sourceKey` carried from the object verbatim and never typed.

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/register/states.ts` (`REGISTER_STATES`) and in `src/ui/screen-states/matrix.tsx`
under `/t/[tenant]/p/[project]/takeoff/register`; the redirect route
`/t/[tenant]/p/[project]/takeoff` declares all seven **delegated** to the register route, naming it
and the redirect as the reason — a route that renders nothing has no state of its own to invent.
`register-workspace[data-state]` is derived in this order, the first that holds winning: `loading` ·
`denied` · `offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — `loading.tsx`, frame and tabs row intact, core Skeletons keeping the layout the
  screen in fact has, never a spinner and never one on the table (R-UI-004): a 36 px bar of five
  28 × 128 chip bones with a 28 × 96 count bone at its end, then the body — a 240-wide rail bone
  beside a full bone for the grid. No bone stands for a region that is absent at rest: the tabs row
  is the frame's own track and the inspector is absent until something is selected (R-UI-080).
- **Empty** — the shipped `EmptyState` **in the grid's own place**, the rail beside it untouched,
  each of three truths saying why (R-UI-020). No campaign pinned: `takeoff_register_empty_heading` /
  `_body` and the one action, a core secondary link to `…/drawings/sets`,
  `takeoff_register_empty_action`. A campaign with nothing registered:
  `takeoff_register_empty_campaign_heading` / `_body`, no second action — `register-measure` already
  stands in the tabs row, and a duplicate door teaches a second way to do one thing. A campaign
  with objects registered and no line published, no filter set — the pin has landed and nobody has
  pressed Measure (amended 2026-09-21; before it this campaign fell into the filter cell and told a
  reader who had narrowed nothing to clear a filter): `takeoff_register_lines_unmeasured_heading` /
  `_body`, naming the door in the tabs row and never a second one. All three carry
  `data-testid="register-empty"` (`TESTIDS.register.empty`, handed down as chrome like the
  inspector's ids). A filtered-to-nothing table is not this cell: it is the same primitive stating
  `takeoff_register_lines_none`, carrying no state id, with the rail untouched.
- **Error** — `register-screen.tsx`'s own cell, which is the read's and not the register's:
  `takeoff_register_error_heading` / `_body`, the report id through an `IdChip` under
  `takeoff_register_report_label` (R-UI-082 — a fault id is read aloud to support, which is what the
  chip exists for), and the core secondary Button `<button data-testid="register-retry">`
  `takeoff_register_retry`, which re-runs `takeoff.register` in place. It keeps its own id rather
  than taking the shipped `ErrorState`'s, because `register-retry` is in the frozen registry and the
  primitive publishes ids of its own (C-05). A render fault of the surrounding screen is the root
  error boundary's, unchanged.
- **Refusal** — the one RefusalState, in `register-answer` for a door's rejection and inside each
  `register-refusal` row for a sighting's. Never a toast, never a screen-local block.
- **Partial** — rendered, never hidden: published lines, queue items and refused sightings stand
  together, and `data-state="partial"` while `register-refusals[data-count]` is above zero and the
  view otherwise answered. A struck object stands in the tree with its lines withheld and counted,
  which is a statement of what a person did rather than a cell of this state (I-173).
- **Offline** — a banner above the answer slot, `<p role="status">` `takeoff_register_offline`,
  house notice chrome (`var(--info-surface)` fill,
  `var(--info)` border, radius `var(--radius-4)`); the three act doors and the offered-group confirm
  render `disabled` while it stands. The register reads on; a read that is honest about its age is
  not a broken screen.
- **Permission-denied** — `permitted` is the viewer's MEASURE on this project, read server-side.
  Without it `data-state="denied"`, the three act doors and the group confirm do not render at all
  (a door that answers only a refusal is theatre — participants I-50), and `register-answer` holds
  a standing `takeoff_register_denied_permission` / `_holder` pair over one RefusalState from the
  registered `PERMISSION_NOT_HELD` entry, evidence the project's participants screen. Reading the
  register needs no permission beyond membership, which the shell guard settles before this route
  mounts.

## 3. Copy, verbatim (`src/ui/strings/takeoff.ts`, mirrored to the module's `copy.ts`)

`takeoff_nav_label` **Takeoff** · `takeoff_nav_register` **Register** ·
`takeoff_register_heading` **Register** · `takeoff_register_caption` **Every object this campaign
registered, the quantity lines measured from it, and what each one rests on.** ·
`takeoff_register_campaign_label` **Pinned revision** · `takeoff_register_measure` **Measure this
campaign** · `takeoff_register_measure_hint` **Queues a measure run over the pinned revision. Lines
appear here as they are measured.** (I-469) · `takeoff_register_timeline_heading` **Measure runs** ·
`takeoff_register_filter_class` **Class** · `takeoff_register_filter_kind` **Kind** ·
`takeoff_register_filter_level` **Level** · `takeoff_register_filter_basis` **Basis** ·
`takeoff_register_filter_coverage` **Coverage** · `takeoff_register_filter_any_class` **All
classes** · `_any_kind` **All kinds** · `_any_level` **All levels** · `_any_basis` **All bases** ·
`_any_coverage` **All coverages** · `takeoff_register_lines_count` **{shown} of {total} lines** ·
`takeoff_register_tree_label` **Objects** (I-469) ·
`takeoff_register_repudiated_count` **{count} objects repudiated, {lines} lines withheld** ·
`takeoff_register_col_kind`
**Kind** · `_col_value` **Value** · `_col_unit` **Unit** · `_col_formula` **Formula** ·
`_col_variables` **Variables** · `_col_bases` **Bases** · `_col_coverage` **Coverage** ·
`_col_calibration` **Calibration** · `_col_engine` **Engine** · `_col_source` **Source** ·
`takeoff_register_bases_hint` **The chip is the basis of the figure. A word beside it is the basis of
the specification that selects the bill item, shown only where the two differ.** (I-466) ·
`takeoff_register_value_omitted` **{variables} unstated** · `takeoff_register_value_unstated` **No
figure** · `takeoff_register_omitted_label` **Left out** (I-reg-1) ·
`takeoff_register_repudiated_note` **A person judged this object to be nothing. Nothing was deleted:
every reading and every line measured from it stays on record, and its lines are withheld from the
table.** · `takeoff_register_lines_none` **No line matches
these filters. Every line stays registered — clear a filter to see the rest.** ·
`takeoff_register_lines_unmeasured_heading` **Not measured yet.** ·
`takeoff_register_lines_unmeasured_body` **The objects are registered and no measure run has
published a line over them yet. Measure this campaign reads their quantities; each line stands here
with its trace as it is published.** (I-469) ·
`takeoff_register_object_key_label` **Object key** · `takeoff_register_basis_label` **Basis** ·
`takeoff_register_role_label` **Role** · `takeoff_register_corroboration_label` **Corroboration** ·
`takeoff_register_source_label` **Read from** · `takeoff_register_attributes_label` **Attributes** ·
`takeoff_register_competing_label` **Competing readings** · `takeoff_register_overruled_label`
**Overruled readings** · `takeoff_register_no_readings` **No reading has been recorded for this
attribute.** · `takeoff_register_suspended_note` **These readings disagree, so this attribute has no
standing value. Record a reading at a precedence that settles it.** ·
`takeoff_register_inspector_idle_heading` **No object selected** ·
`takeoff_register_inspector_idle_body` **Choose an object in the tree to read its basis, its role
and the readings recorded against it.** · `takeoff_register_corroborate` **Record a reading** ·
`takeoff_register_corroborate_value` **Value** · `_unit` **Unit** · `_precedence` **Precedence** ·
`takeoff_register_corroborate_precedence_hint` **Lower numbers rank first. A reading at the same
precedence as another suspends the attribute.** · `takeoff_register_corroborate_preview` **Preview
this reading** · `takeoff_register_repudiate` **Repudiate this object** ·
`takeoff_register_corroboration_yes` **The machine reads this outline as the member its mark names,
at the size the drawing states for it.** · `takeoff_register_corroboration_unsure` **The machine
could not tell whether this outline is the member its mark names.** ·
`takeoff_register_corroboration_no` **The machine reads this outline as something other than the
member its mark names.** · `takeoff_register_corroboration_hint` **A proposal, not a reading.
Nothing is corroborated until you record a reading or strike the object.** (I-299) ·
`takeoff_register_refusals_heading` **Deferred and refused** · `takeoff_register_refusals_hint`
**These sightings produced no line. Each says why, and where to resolve it.** ·
`takeoff_register_refusal_object_label` **Object** · `takeoff_register_refusal_kind_label` **Kind** ·
`takeoff_register_evidence` **Open the source drawings** ·
`takeoff_register_level_stack_heading` **Proposed level stacks** (I-469) ·
`takeoff_register_level_stack_hint` **Confirming inserts every level in the offer as one act.
Nothing is chosen row by row.** · `takeoff_register_level_stack_label` **Level stack proposed from
{drawing}** · `takeoff_register_level_stack_count` **{count} levels** ·
`takeoff_register_empty_heading` **No campaign is open on this project** ·
`takeoff_register_empty_body` **A register fills once a drawing set revision is pinned. Pin one, and
every sighting it produces appears here.** · `takeoff_register_empty_action` **Browse drawing
sets** · `takeoff_register_empty_campaign_heading` **This campaign has registered nothing yet** ·
`takeoff_register_empty_campaign_body` **Queue a measure run above, and every object it reads from
the drawings appears here.** (I-469) · `takeoff_register_error_heading` **The register could not
be read** · `takeoff_register_error_body` **Nothing was changed. Try again, and quote the report id
if it keeps happening.** · `takeoff_register_report_label` **Report id** ·
`takeoff_register_retry` **Try again** · `takeoff_register_offline` **You are offline. The register
reads as it stood when this page loaded, and nothing can be committed until the connection
returns.** · `takeoff_register_denied_permission` **Recording a reading, repudiating an object and
queueing a measure run each need the MEASURE permission on this project.** ·
`takeoff_register_denied_holder` **A project principal can grant it on the participants screen.**

**Where each of these now stands (v22).** The table is unchanged — a screen does not edit
`src/ui/strings` — but three of its lines are no longer text a reader meets on the face of the
screen, and that is a composition ruling, not a deletion: `takeoff_register_caption` (§1 — never a
heading with a sentence under it over a work surface; the one helper line this screen spends is the
count), `takeoff_register_measure_hint` (the Measure door's Tooltip, §6's "(i) popover" rule), and
`takeoff_register_inspector_idle_heading` / `_body` (I-231 — the frame's right column is ABSENT with
nothing selected, so there is nothing for an idle sentence to stand in). `_refusals_hint` and
`_level_stack_hint` are their sections' heading Tooltips for the same reason. A string the product
no longer renders is struck by the node that owns the registry, named here so the debt is visible
(§8). One string this screen WOULD spend and cannot: the filter bar's free-text search (§3.2's `⌕`)
needs a `takeoff_register_search` label, and no existing key names a search over these lines
honestly — the bar ships with its five chips and the count, and the search is recorded in §8.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "campaign", "rail",
"gate", "seam", "ingest" and every clause id appear nowhere a reader can see (the word *campaign*
survives only where it names the product's own pinned run, which the caption defines). Object keys,
source keys, marks, disciplines, classes, kinds, units, bases, coverages, engines, corroboration
states, act types, level ids, job ids and report ids are model data and render verbatim as data in
mono, never woven into a sentence (I-25). **Amended by I-reg-2 (R-UI-082, the later law):** an
identifier (object key, source key, level id, job id, report id) still stands whole — in an `IdChip`
or the Technical disclosure — but an ENUM model value (a kind, a class, a lawful-null level slot,
a basis, a coverage, an engine) is said in words on the face of the screen with its stored value
kept in `EnumLabel`'s technical disclosure; marks and stack labels stay verbatim. Registry messages
and remedies are never paraphrased.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. Filtering, selecting an object, expanding a branch, a row's arrival
and the refusal rows are instant — an answer that performs before it is read is theatre, and a table
that fades while scrolling lies about what is settled. The only transitions are inherited from
single homes: the tree chevron's 90° turn, the select and Button hover colours, and the nav link's
colour, each `var(--motion-state)` `var(--ease)`; the reticle draw in `reticle.css`; the Skeleton
pulse while `loading.tsx` holds the route or the timeline waits on a number; the ConsequenceDialog's
own entrance. Virtualised scrolling is untweened by the primitive. Every duration is a token zeroed
at source under reduced motion, so `register.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

The screen's own visually-hidden `<h1>` (`.cx-register-title`) states `font-size: var(--text-body)`
(session 5, s-bbs I-289's reading applied here): an `h1` left unstated is the user agent's 2em, a
size R-UI-003's scale does not spell, and the rubric's C11 reads it; clipped to nothing, the size
paints nothing.

Only §4.1's aliases and §4.2's density/layout tokens are consumed — a `--graphite-*` or `--beam-*`
reference outside `tokens.ts` is a lint failure since U1 (Direction §4). This screen spends:
`--surface-app` / `--surface-panel` / `--surface-sunken` / `--surface-selected` · `--ink` /
`--ink-secondary` / `--ink-muted` / `--ink-code` · `--line-accent` · `--accent-subtle` ·
`--state-info` / `--state-info-surface` · the basis palette and the coverage bands, reached only
through BasisChip, CoverageChip and EvidenceLink · `--hairline` · `--space-1/2/3/4` ·
`--gap-section` · `--space-6` (the Source label's line box, the link's own 24 px target — I-350) ·
`--radius-2/4/8` · `--text-body` / `--text-caption` / `--text-20` ·
`--font-ui` / `--font-mono` · `--leading-ui` · `--weight-body-medium` / `--weight-heading` ·
`--row-h`, `--control-h` and `--toolbar-h` through the primitives that read them (the per-screen
`[data-density]` override is deleted — density is the root's, §4.2) · `--motion-state` / `--ease`.
Px literals, closed set: the index rail's 240 and its 160/320 bounds, the filter bar's 36, the tabs
row's current-underline 2, the origin mark's 2 px inset bar, the eight column widths (`size`s, the
class their own Decision §1 lists — 120/116/56/184/128/208/132/120 since I-468), the md
media-query value, and the loading bones' 28/96/128/240.
Any other literal is a defect. No copper appears anywhere except on the ConsequenceDialog's confirm,
which is the primitive's own — the workspace commits nothing itself.

## 6. Themes

`register.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Contrast holds on the founder values in both themes: graphite-600/700/900
on graphite-0 and on the panels' graphite-50 clear 4.5:1; beam-600 link text clears 4.5:1 and the
beam-500 current-underline clears the 3:1 UI floor; the seven basis colours and the three coverage
bands are redundant to a glyph and a word in both themes, so nothing is lost in greyscale
(R-UI-002, R-UI-060). The panels stand one step off the graphite-0 field, seamed by hairlines, in
both themes; the lines table keeps the field's own fill so the numbers read on the brightest ground.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenant}/p/{project}/takeoff` (redirecting) and
`/t/{tenant}/p/{project}/takeoff/register` (`registerRoute`, `takeoffRoute`). Routes linked, all
shipped: `…/drawings` (the refusal evidence), `…/drawings/sets` (the empty state's action),
`…/settings/participants` (the denial's evidence). Test ids, exactly the contract's, on the elements
ruled in §1: `takeoff-nav` · `takeoff-nav-register` · `register-workspace` (`data-state`,
`data-campaign`) · `register-tree` · `register-inspector` (`data-object`) · `register-object-key` ·
`register-object-basis` (`data-basis`) · `register-object-role` (`data-role`) ·
`register-object-corroboration` (`data-standing`) · `register-source-key` · `register-attribute`
(`data-attribute`, `data-standing`) · `register-reading` (`data-role`, `data-basis`,
`data-precedence`) · `register-lines` · `register-lines-count` · `register-repudiated-count` ·
`register-filter-class` · `-kind` · `-level` · `-basis` · `-coverage` · `register-refusals`
(`data-count`) · `register-refusal` (`data-code`, `data-object`, `data-kind`) · `register-answer` ·
`register-empty` · `register-retry` · `register-level-stack` · `register-measure` ·
`register-timeline`, and the two masking ids §7's picture paragraph names (`register-campaign`,
`register-refusal-object`). `project-tab`, the row's six other entries (`takeoff-nav-coverage`,
`-levels`, `-schedules`, `-boq`, `-bbs` and, since I-407, `-ask`, each its own surface's
Decision's), `offered-groups`, `offered-group`, `offered-group-count`,
`offered-group-confirm`, `refusal-state`, `refusal-message`, `refusal-remedy`,
`refusal-evidence-link`, `job-timeline`, `job-timeline-step`, `consequence-dialog`, `tree`,
`tree-item`, `datatable`, `datatable-row`, `datatable-cell`, `datatable-total` (the sticky footer's
cell, whose `QuantityText` carries the visible set's exact total in `data-value` — the J-000 M3 leg
reads the campaign's figures there, storey by storey), `basis-chip`, `coverage-chip`,
`unit-badge`, `skeleton` and `screen-state` are other files' ids, used and never redefined. No
others are added: the Corroborate, Repudiate, Preview and empty-state doors, the headings and the
count line are found by role and name.

**I-299's proposal line carries no test id yet.** It is read in the unit lane by its class and its
two attributes (`.cx-register-corroboration[data-reading][data-probability]`). The id it wants is
`register-corroboration`, and it is added to `src/ui/testids.ts` and published through
`RegisterChrome.testIds` by the increment that gives the line a journey — the same increment that
gives the server read its standing proposals, since a leg clicks what a customer clicks and today no
composed view carries one (§8).

**No test id is added by the v22 rebuild, and none is renamed.** Every region it moved answers to
the id it already published: `register-measure` and `register-campaign` are found on the page rather
than under the workspace, because the tabs row is the frame's track (I-230); `register-inspector`
and everything under it likewise, because the inspector is the frame's slot (I-231);
`register-object-key` and `register-source-key` stand inside the Technical disclosure, closed at
rest, so they are text a suite reads and a picture cannot freeze (I-234); `register-empty` is the
shipped `EmptyState`'s own box; `register-timeline` exists only while a run is watched. What the
rows publish is new and is the screen's own, not the primitive's: `data-line` on every row through
`rowDataOf`, and `data-line-selected="true"` on the row a pointer took (I-236).

Behavioural hooks without new ids: `aria-current="page"` on the nav's current entry;
`role="status"` on the count line and the offline banner; `aria-live="polite"` on `register-answer`;
`role="tree"`/`role="treeitem"` and `role="table"`/`role="row"`/`role="columnheader"` inside the two
I-171 wrappers; `data-standing="REPUDIATED"` on a struck object's corroboration cell;
`data-kind="PROPOSED_LEVEL_STACK"`
and `data-drawing` on each offered group; `cx-reticle` on every focusable element; and the asserted
absences — no `input[type=checkbox]`, no `[role=checkbox]`, no select-all, no `EvidenceLink` and no
refusal code in any text node outside a `refusal-state`. Suites: `tests/ui/takeoff-register/**`
(jsdom mounts of `RegisterWorkspace` over `registerFixture()`, `linesFixture(n)`,
`refusalsFixture()`, `levelStackFixture()`, chrome bound to the shipped components per I-170 — and,
since v22, the two mounts bound to stand-ins that render in place, because there is no frame in
jsdom: what a suite reads under `register-workspace` is the node the route hands the frame).
`inspector-slot.test.ts` holds the rebuild's own properties to account: no right column at rest, a
row taken with the pointer stating its line, an object stating its doors, one column for one subject,
and a job strip that exists only while a run is watched (I-230–I-236), and Escape letting go of a
line and of an object while a field's Escape stays the field's and a layer's stays the layer's, in
the tree as on the page (I-470), and an Escape from inside the inspector landing the reader on the
line's row, on the object's tree item, or — the item no longer drawn — on the tree's own stop, never
on the body (I-471); `craft-footer-and-cells.test.ts` holds I-466, I-468, I-469 and I-472 (one
basis word where the pair agrees, the Bases hint opened from the keyboard, the drawer and the resize
handle reading `Bases`, the eight widths, the one-line rail heading and no `rail` in the copy), and
the primitive's own half of I-472 is `src/ui/primitives/data/__tests__/header-label.test.tsx`; `tree-and-lines.test.ts` holds I-467 (levels open and classes closed at rest,
the origin's class open by itself), and every suite that chooses an object opens its class first,
through the stage's `openTree`, as a reader does; `filter-chips.test.ts` holds
I-442/b (the stylesheet half: no box between a chip and main clips, the popover outranks every
layer the grid stacks; the DOM half: a click opens a chip's options in its own box and takes one, the
keyboard alone walks the bar, Tab closes a list behind the reader — the Combobox's own suite holds
the primitive's four facts),
`tests/takeoff/register-ui/**` (the reading, the doors and the two acts through
`stageRegisterCampaign()`), and `tests/takeoff/register-ui/copy-mirror.test.ts`, which fails the
build if the module's `copy.ts` and `src/ui/strings/takeoff.ts` ever differ (the viewer-inspector
§8 precedent; its IOU — a copy home both layers may read — is re-recorded here unpaid). Journey:
`tests/e2e/register.spec.ts`, titles carrying J-021 (it opens the column class before it reads the
marks, and asserts the class stood closed — I-467), page object
`tests/e2e/pages/s-takeoff.page.ts`; `tests/e2e/journeys/j-021-column-slice.spec.ts` opens the class
chip, asks the page what stands where the option and every chip PAINT (`elementFromPoint`, no
scrolling — Playwright's own click scrolls a clipped box until its target shows, which is how every
narrowing journey stayed green over walk-0's defect), presses the option with the mouse where it
stands, and walks Tab, Enter and Esc to the next chip (I-442/b; no id is added — the options
are found by role and the `data-value` the Combobox publishes); checkpoints `s-takeoff/register` and
`s-takeoff/measure-queued`, axe serious/critical = 0 at each, never widened, `masks()` over the shell breadcrumb, `shell-user`,
`shell-tenant-switcher` (the staged workspace's own name), `register-timeline` (which masks nothing
while no run is watched), `register-campaign` (the pinned revision, now the short form its `IdChip`
shows) and `register-refusal-object` (the object key repeated on each refusal row). The inspector's
`register-object-key` and `register-source-key` LEAVE that list in v22: they stand inside the
Technical disclosure, which is closed at rest, so they are no longer ink a picture could freeze —
and the inspector itself is absent until something is selected. Re-baselined under B-20:
`tests/e2e/baselines/design/s-project/home.png` (the Takeoff tab becomes a link) and
`j-003/project-edited.png` only if its bytes move.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

The Trace from a line to its entities and back (R-UI-022) is **paid**: inc-215 makes the `source`
cell an `EvidenceLink` under `docs/design/s-takeoff-register.md`, and the cited key is no longer
plain text. EvidenceLinks on queue items, refusal rows and the object inspector's readings stay
unpaid — owner: those surfaces' own leaves. Bulk corroboration of INTERPRETED sightings as an
offered group (J-040) — owner: M4. Resizable, remembered widths for the index rail (R-UI-005) —
owner: the prefs seam's node, which holds the same debt for the viewer; the inspector's own width is
now the frame's and IS remembered. A CORROBORATE that names more than one attribute, and an inline
correction on a line — deliberately absent: a line is a record.

Opened by I-299, with the node that owns the fix: **the proposal has no composed read yet.** The
screen renders what it is handed (`corroborations`, by object key) and the two acts carry the call
they judged, but no server read fills it: binding one object to the standing call needs a store keyed
(tenant, project, set revision, object), which needs a migration this increment did not take. Owner:
the increment that lands `src/core/register/corroboration.ts` and `registerViewOf`'s read of it —
with it come `register-corroboration` in `src/ui/testids.ts`, the id on the line, and the J-021 leg.

Opened by the v22 rebuild, each with the node that owns the fix:

- **A row taken with the pointer.** `DataTable` raises a selection from the keyboard (`onRowSelect`:
  Space, ⇧-range) and a click only moves its cell cursor, so §5 rule 10's "row selection → the shell
  inspector" is keyboard-only in the primitive. This screen reads the row a click landed on off its
  own `data-line` and paints it from its own `data-line-selected` (I-236). Owner: the node that owns
  `src/ui/primitives/data` — a click that takes a row, and `aria-selected` with it.
- **`BasisChip` says its value in SCREAMING.** R-UI-002's chip renders `MEASURED` beside its glyph,
  so every basis cell of every grid in the product is a §7 C6 finding that no screen can clear: the
  chip is the glyph table's single home and re-wording it at a call site is the B-17 defect. Owner:
  the node that owns `src/ui/primitives/core` — the chip should read its value the way `EnumLabel`
  does (words on the face, the raw value under `data-technical`), and §3.2's wireframe already
  writes it short (`▣ T`).
- **A search over the lines.** §3.2's filter bar carries a `⌕` beside its chips; no key in
  `src/ui/strings/takeoff.ts` names a search over these rows, and a screen may not add one. Owner:
  the node that owns `src/ui/strings` — `takeoff_register_search`, at which point the bar gains the
  field and this Decision's §1 gains a sentence.
- **Four strings the product no longer renders** (§3's note): `takeoff_register_caption`,
  `takeoff_register_inspector_idle_heading` / `_body`, and — as visible text — the three hints that
  became Tooltips. Owner: the node that owns `src/ui/strings`, to strike what the rebuild retired.
- **A column chooser default.** §5 rule 3 asks for "≤ 8 visible columns at 1280"; the shipped table
  restores the reader's own furniture but takes no default hidden set, so this register shows all
  ten and scrolls inside its own container (which C10 permits). Owner: the node that owns
  `src/ui/primitives/data` — a `defaultHidden` the table honours before anything is remembered.
- **`FigureProvider` at the frame.** `QuantityText` needs SEAM-FORMAT's conventions and `src/ui` may
  not call the seam; the tenant frame installs none today, so this screen hands the format down from
  the module (which may read core). Owner: the node that owns the tenant frame — one provider, and
  the `format` prop disappears from every call site.
- **A copy home both layers may read**, so `src/modules/takeoff/register-ui/copy.ts` need not mirror
  `src/ui/strings/takeoff.ts` — re-recorded unpaid (the viewer-inspector §8 precedent).

Opened by I-350, each with the node that owns the fix:

- ~~**The Bases pair names neither half.**~~ **Paid by I-466** (session 8): `takeoff_register_bases_hint`
  is the Bases header's Tooltip, and the inspector's Bases label's, mirrored into this module's
  `copy.ts` in the same commit.
- **A spanning footer cell.** I-350 (a) reaches into `.cx-table-footercell` so the totals can run on
  past the Value cell; the group row already spans. Owner: the node that owns
  `src/ui/primitives/data` — a spanning form of `totals`, after which the rule retires.
- **A clipped cell's Tooltip says the disclosure too.** The table states a clipped cell's
  `textContent`, which includes every `EnumLabel`'s hidden raw value (`TranscribedTRANSCRIBED`).
  Owner: the same node — read the cell's text without `[data-technical]`.
- **A clipped Source label is one selection from whole.** I-350 (c) ellipsises the link's label
  inside the cell, where the table's Tooltip cannot reach it. Owner: the node that owns
  `src/ui/patterns/evidence-link` — a link inside a grid cell that states its label on hover.
- **`Bored` beside `Boring`.** The pile's count and its bore read as two near-homonyms because
  `inWords` drops the chapter from `piling.bored` / `piling.boring`. Owner: the node that owns
  `src/core/catalogue` and `src/core/documents/kinds/boq-draft-law.ts` — a display name per kind in
  the catalogue (`Bored piles`, `Pile boring`), read by `inWords`, so the register, the bill, the
  levels roll-ups and the coverage grid all move together. Never a screen-local special case.

Opened by I-466, I-467, I-470 and I-471 (session 8), each with the node that owns the fix:

- ~~**A composed header names its column by its id.**~~ **Paid by I-472** (session 8, the review of
  C4'): `DataTableColumnMeta.label`, read by `headerText`; the Bases column states its word, and the
  drawer and the resize handle read `Bases`.
- **A class that opens from outside the tree.** The shipped Tree seeds its open set once, at mount,
  and takes no open set after it, so a class cannot open when a row of one of its objects is selected
  in the grid, and the origin's class is opened by mounting the tree again once the address is read
  (I-467). Owner: the node that owns `src/ui/primitives/data` — an `expandedIds` the Tree honours
  after mount (controlled, or a reveal of one node), after which the key comes off.
- **The offer's own narrow layout.** The register lays the pattern's group out in rows from its own
  stylesheet (I-469), reaching the pattern's `.cx-offered-group` as I-350 (a) reaches the table's
  footer cell. Owner: the node that owns `src/ui/patterns/offered-group` — a layout for a narrow
  container (a container query), after which the register's rule retires.
- **The tree keeps its own selection after Escape.** The shipped Tree holds its selection itself
  (`defaultSelectedId`, read once) and takes none from outside, so after Escape lets go of an object
  the item still says `aria-selected="true"` and wears the selected fill while the inspector is gone
  (seen in a jsdom probe in the review of C4'). Owner: the node that owns `src/ui/primitives/data` — a
  `selectedId` the Tree honours after mount, the same change as the open set above; after it the
  register hands the Tree `selectedKey` and the two agree.
- **The column drawer takes no Escape.** With the table's `⋯` drawer open and a line selected, an
  Escape from outside the drawer lets go of the line (I-470) and leaves the drawer standing, because
  the drawer answers no key of its own; with focus on one of its checkboxes the Escape is a field's
  and nothing happens. Owner: the node that owns `src/ui/primitives/data` — the drawer closes on
  Escape, prevents its default, and puts focus back on `⋯`, after which I-470 defers to it as it does
  to every layer.
- **The register's Escape is not on the ? sheet.** `SHORTCUTS` (`src/ui/shell/shortcuts/roster.ts`) is
  the one home of every R-UI-032 binding and the ? sheet lists only what it holds; I-470's Escape is
  armed by the screen and listed nowhere. Owner: the node that owns `src/ui/shell` — a `table`-scoped
  line (`Escape`, "Let go of the selection") with its label in `src/ui/strings/shortcuts.ts`, which
  moves the ? sheet's picture and is re-taken with it; not added here, because the sheet's picture is
  another journey's and no wave-2 slice owns the roster.
- **A close control on the inspector.** Escape lets go (I-470), but a pointer reader still closes
  the column only by clicking the row again. The column is the frame's slot and every screen fills it,
  so the control is the slot's — one `×` in its header that clears the claim and tells the screen —
  never a button each screen draws for itself (B-17). The same node owes where focus goes when the
  slot empties while its own seam (the resize separator) holds it: an Escape there lets go (I-470),
  and the seam leaves with the column, so the reader lands on the body — the screen can put back only
  a focus that stood in its own node (I-471). Owner: the node that owns `src/ui/shell`
  (`inspector.tsx`).
- **Focus that scrolls out of view, and "Open the register" unfiltered** (walk-0's FRICTION).
  Collapsing a group from its header leaves focus on a toggle the virtualiser scrolls away, and ↓
  scrolls rather than moving the row cursor — owner: the node that owns `src/ui/primitives/data`. The
  coverage cell's "Open the register" opens all lines; the register takes no class, level or kind from
  its address yet, so the link and the reading of it land together — owner: the coverage slice that
  re-cuts the cell inspector (COV-ALL), with this screen's address reading in the same change.
