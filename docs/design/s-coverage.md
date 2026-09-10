# Design Decision — S-Coverage (the coverage grid)

Route `/t/{tenant}/p/{project}/takeoff/coverage`, widened by `?cell={kind}:{class}:{levelId}`, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/coverage/**`, inside the takeoff nav, the shell frame
and the membership guard. Increment inc-216-coverage-grid. Law: X-3, R-TO-052, L-QTY-05, L-QTY-07,
L-ACT-02, L-ACT-03, R-UI-001/002/003/004/005/010/012/020/021/030/031/032/050/060, J-022, J-000,
B-17, B-19, B-20, Q-11, ARCH-01, C-05. Files: `takeoff/layout.tsx` (one nav entry added),
`takeoff/coverage/{page.tsx,loading.tsx,coverage-screen.tsx,route-address.ts,states.ts,coverage.css}`
and the reading, the presentational `CoverageWorkspace`, the SVG grid, the glyph map and `copy.ts` in
`src/modules/takeoff/coverage/**`. Every convention of the earlier Decisions binds: `cx-` classes,
variants on data-attributes, tokens-only colour and motion, no `[data-theme]` selector in authored
CSS, model values verbatim in mono (I-25) and whole (I-26), the module takes its shipped chrome as
injected renderers (I-170) on a `display: contents` mount where a shipped root fixes its own id
(I-171). Interpretations I-1–I-187 remain in force. Chrome comes only from shipped primitives and
patterns — core Button, Skeleton; the one RefusalState; the one ConsequenceDialog — plus the SVG grid
this file rules and the `cx-coverage-*` classes beside it.

## 0. Interpretations (numbering continues the global chain's highest, s-viewer-inspector's I-187)

- **I-188 — the heat is the registry's severity; the cause is the glyph.** Each cause is registered in
  `REFUSALS` with a severity, and that severity paints the cell: `error` → `--danger-surface`,
  `warning` → `--warn-surface`, `info` → `--info-surface`, and a cell with published quantity →
  `--success-surface`. So three causes share the info tint and two share the warn tint, deliberately:
  colour states the *temperature* — measured, needs attention, something was lost, settled by a
  person — and the glyph states which cause, in one mark per cause. Nothing is carried by colour
  alone (R-UI-060), and no second table of cause colours exists to drift from the registry.
- **I-189 — one cell, two axes, two marks.** L-QTY-05's axes are orthogonal, so a cell may be both
  unmeasured and held out of the bill and must say both. The measurement axis is the fill and the
  centred glyph; the bill axis is a 45° hairline hatch over the whole cell plus a second, smaller
  glyph in the lower-right corner. Both marks carry `data-testid="coverage-cell-glyph"` with their
  own `data-cause`, so a cell holds one glyph, or two when it is held out. Rejected: a single glyph
  showing whichever axis lost, which would hide a measurement cause behind a bill decision.
- **I-190 — the grid is drawn, so its focus reticle is drawn.** `cx-reticle` renders through `::after`
  and an SVG `<g>` hosts no pseudo-element. R-UI-012 offers a 2 px outline fallback for exactly this
  case, but SVG can express the corner ticks precisely, so the cell draws them: four paths, 2 px beam
  stroke, 8 px arms, 4 px outside the cell box — the law's own numbers (core I-1's mandated class),
  read from one home `coverage-reticle.tsx`. This is not a second dialect of the reticle; it is the
  only surface where the single CSS home cannot reach.
- **I-191 — a cause is a reading of the project, not a refusal of a request.** The inspector states the
  cause and its remedy as its own two lines, `coverage-inspector-cause` and
  `coverage-inspector-remedy`, taking their words verbatim from the registry entry — one home for the
  words (R-SPINE-062), never paraphrased. `RefusalState` stays the one renderer of refusals *of a
  request*: a refused door in `coverage-answer`, a refused preview or commit inside the dialog's own
  slot. No code is rendered as text and no card chrome is imitated, so this is not the screen-local
  refusal block B-17 forbids.
- **I-192 — arm order governs both axes, and a beaten declaration is marked, not hidden.** A
  declaration that a cell is absent, over a cell that now bears published lines, is beaten on its own
  axis: the cell reads `data-measurement="QUANTITY_BEARING"` (or `data-bill="IN_BILL"`) and
  `data-contradicted="true"`, the inspector states it in a sentence, and both statements omit the
  cell — a certificate never prints a boundary the lines deny. The row stays; nothing is withdrawn.
- **I-193 — a cell replaces the address, never pushes it.** Selecting a cell `history.replaceState`s
  `?cell={kind}:{class}:{levelId}`, so the address is shareable and Back leaves the screen instead of
  walking a reader backwards through fifty clicks. On mount the named cell is selected and holds the
  grid's one tab stop; a `cell` this residue does not hold selects nothing and says nothing — no code
  is invented for a stale address (s-takeoff-register I-182's idiom).
- **I-194 — a door stands only where it could be carried.** Both doors are absent — not disabled — on
  a cell whose axis already reads QUANTITY_BEARING, on a cell whose declaration of that cause is
  already in force (a second one refuses `ACT_CHANGES_NOTHING`), on a kind-grain row, and while the
  permission is not held: a door that can answer only a refusal is theatre (participants I-50). They
  render `disabled` while offline, which is a connection, not a judgement.
- **I-195 — the legend names meanings, never codes.** Codes are machine-readable only (refusal-state
  §7), so a legend entry renders the cause's mark, its registered message as its name and its
  registered remedy beneath, with the code on `data-cause`. The entries are exactly the six causes;
  the measured mark is stated on one line above them, outside the enumerated set, because it is not a
  cause and belongs in no list of them.
- **I-196 — a kind with no cell is a row, and the screen is `partial` while one stands.** A work item
  no class bears, and a borne kind no sighted class bears, cannot be celled out — they are rendered
  at the head of the grid as kind-grain rows spanning the class-and-level extent, with
  `data-grain="KIND"` and `data-class=""` `data-level=""`, and the screen reads `partial`. Shown,
  never hidden (R-UI-050).
- **I-197 — coverage's copy is the coverage module's own.** `src/ui/strings/takeoff.ts` is another
  node's file and is not touched: every key here, the nav entry's included, lives in
  `src/modules/takeoff/coverage/copy.ts` and is read by the app layer, which may reach both. Rejected:
  appending to the register's string table.
- **I-198 — the cause a cell is READ under is the axis a person moved.** A cell may carry a cause on
  each axis at once (I-189), so a single reading has to be chosen for its accessible name and for the
  inspector's `data-cause`, message and remedy. `causeRead(cell)` in `grid.tsx` answers the bill
  cause where the cell is held out of this bill and the measurement cause everywhere else: a person
  who has just drawn a boundary is told about the boundary they drew, not about the absence it was
  drawn around. Rejected: naming the measurement cause always, which would make the hold-out act read
  as though it had done nothing.
- **I-199 — both boundary acts sit under `SET_BILL_BOUNDARY`.** L-ACT-03 names only
  `HOLD_OUT_OF_BILL` under that permission, but `DECLARE_NOT_IN_PROJECT_SCOPE` is the same LEAD-held
  judgement about where this bill's boundary falls, and the graph's notes place it there. Rejected: a
  new permission — L-ACT-03's enum is closed, and a screen cannot open it.
- **I-200 — each act declares its own cause on its own axis.** `HOLD_OUT_OF_BILL` writes
  `NOT_IN_THIS_BILL` on the bill axis (L-QTY-05 names the axis's cause, R-TO-052 names the act) and
  `DECLARE_NOT_IN_PROJECT_SCOPE` writes `NOT_IN_PROJECT_SCOPE` on the measurement axis. Rejected:
  one act with a cause argument, which would let a caller put either cause on either axis.
- **I-201 — a contradiction needs no state.** An act over a cell that later bears quantity still
  stands as a row: arm order beats it, the cell reads `data-contradicted="true"`, and the statements
  omit it. The Consequence an actor confirms reads the arm THIS act writes first, so a declaration
  already in force is the `before` reading and asking again moves nothing (`ACT_CHANGES_NOTHING`);
  only where none stands does the display's arm order speak, which is how an actor declaring over a
  measured cell sees the contradiction they are about to author. Rejected: refusing the act at
  preview when lines exist — the doors are absent for a `QUANTITY_BEARING` cell (I-194), so the
  contradiction arises only when lines land after the act, and refusing then would erase a judgement
  a person made in good faith.
- **I-202 — "attributed through the parent chain" is the sheet's ingest facts.** A cell is
  `INGESTION_TRUNCATED` when every sighting it rests on lands on a sheet whose ingest facts carry
  `explode_truncated=true`: sighting → (`drawingId`, `layoutName`) → `ingests.facts`. Rejected:
  attributing truncation to a class as a whole, which would blame cells no truncated sheet touched.
- **I-203 — the six causes are registered in `REFUSALS`.** The leaf's "Codes → `src/core/errors.ts`"
  and L-ACT-01's closed cause shared with machine refusals put them there, and it is the registry
  that gives every cause a remedy (X-3) for the legend and the inspector to render. Rejected: a
  second cause table beside the registry, which would be a second answer to what a cause means
  (B-17).
- **I-204 — the `NOT EXISTS` ban is a committed scan, not an ESLint rule.** `scripts/eslint/**` is
  locked at M2, so the ban is proved the way the view-type-literals ban is: a scan test with a
  declared corpus under `tests/lint-fixtures/residue-not-exists/`, named in `SCAN_CORPORA`. Rejected:
  a lint rule, which this increment may not author.

## 1. Layout and hierarchy

**Nav.** `takeoff/layout.tsx` gains a second `next/link`, `<a data-testid="takeoff-nav-coverage">`
`takeoff_nav_coverage`, after `takeoff-nav-register`; every attribute of the entry — height, padding,
type, `aria-current="page"`, the 2 px `--beam-500` underline — is the register entry's, unchanged
(s-takeoff §1). This pays that Decision's §8 IOU.

The page renders in `shell-main` as `<div class="cx-coverage" data-testid="coverage-screen"
data-state={…} data-campaign={campaignId}>`, column flex, `gap: var(--space-4)`.

**Header** — `<h1>` `takeoff_coverage_heading` (`var(--text-20)` `var(--weight-heading)`
`var(--graphite-900)`) over `takeoff_coverage_caption` (`var(--text-13)` `var(--graphite-600)`);
right (`margin-left: auto`) the pinned revision as `takeoff_coverage_revision_label` over the
`setRevisionId` whole in `var(--font-mono)` `var(--text-12)` `--graphite-700` `user-select: all`,
class `cx-coverage-revision` (§7's mask). **Answer slot** — `<div data-testid="coverage-answer"
aria-live="polite">`, empty until a door is refused, then exactly one RefusalState and no chrome
around it (R-UI-020).

**Body** — `<div class="cx-coverage-body">`, grid `minmax(0, 1fr) 340px`, `gap: var(--space-4)`; one
column below `min-width: 960px` (the md token's value, S-Audit's one lawful media-query literal), the
inspector following the grid.

**The grid** — `<section>` headed `<h2 id="cx-coverage-grid-label">`
`takeoff_coverage_grid_label`, then a horizontally scrollable box holding one custom
`<svg data-testid="coverage-grid" role="grid" aria-labelledby="cx-coverage-grid-label">`. Geometry:
a 200 px kind gutter, then one square cell per class × level of side `var(--row-comfortable)` /
`var(--row-compact)` (R-UI-005 — density moves the grid itself, not a padding), cells seamed by a
1 px `--graphite-200` stroke, a `var(--space-2)` break between classes. Two header rows: a class band
(`role="columnheader"`, the class verbatim, mono 12, `--graphite-700`) over a level row (the level's
`label` verbatim, mono 12, `--graphite-600`). Columns run by class in `compareCanonical` order and,
within a class, by level ordinal ascending. Rows: `<g data-testid="coverage-kind-row" role="row"
data-kind>` — kind-grain rows (I-196) first, then one per borne kind in canonical order, the kind
verbatim in mono 13 `--graphite-900` in the gutter.

Each cell is `<g data-testid="coverage-cell" role="gridcell" data-kind data-class data-level
data-grain data-measurement data-bill data-contradicted tabindex={active ? 0 : -1}
aria-label={…} aria-selected={…}>` holding: the severity-tinted `<rect>` (I-188); the hatch `<rect
fill="url(#cx-coverage-hatch)">` when `data-bill="NOT_IN_THIS_BILL"`; one centred
`<g data-testid="coverage-cell-glyph" data-cause>` for the measurement reading and, when held out, a
second at 8 px in the lower-right corner for the bill reading (I-189); a 1.5 px `--danger` stroke when
`data-contradicted="true"`, which the aria-label and the inspector also state in words. The glyphs are
drawn geometry, never font characters, from one total map over the cause union — a cause without a
mark is a compile error — on a 16 px viewBox, 1.5 px stroke, `currentColor`:

| reading | mark |
|---|---|
| QUANTITY_BEARING | filled disc, r 4 |
| NOT_ESTABLISHED | open ring, r 4 |
| INGESTION_TRUNCATED | open ring with a 90° gap at the upper right |
| NOT_IN_PROJECT_SCOPE | open ring struck by a diagonal bar, corner to corner |
| NOT_IN_THIS_BILL | open ring crossed by a horizontal bar |
| NO_BEARER_SIGHTED | open ring, dashed 2/2 |
| KIND_NOT_YET_SEEDED | three dots in a row |

Keyboard (R-UI-032): the grid takes one tab stop on the active cell; arrows move focus, Home/End to
the row's ends, Enter or Space selects — arrowing never fills the inspector, because selection that
follows focus rewrites the address on every keystroke. Hover paints a 1.5 px inset `--beam-500`
stroke, selection a 2 px one beside `aria-selected="true"`, focus the drawn reticle (I-190). No
tooltip: the mark's words live in the legend and the inspector, and a tooltip would be a third home.

**Legend** — `<div data-testid="coverage-legend">` under the grid: `<h3>`
`takeoff_coverage_legend_heading`, then `takeoff_coverage_measured_note` beside the filled disc
(I-195), then six `<div data-testid="coverage-legend-entry" data-cause>` in the cause set's declared
order, each the mark, the registered message (`var(--text-13)` `--graphite-900`) and the registered
remedy beneath (`var(--text-13)` `--graphite-700`).

**Inspector** — `<aside data-testid="coverage-inspector" data-cell="{kind}:{class}:{levelId}">`, the
register panel's chrome exactly (`--graphite-50`, `var(--hairline)`, `var(--radius-8)`). Header: kind,
class and level verbatim in mono under `takeoff_coverage_kind_label` / `_class_label` / `_level_label`
(a kind-grain row reads `takeoff_coverage_kind_grain_label` in place of class and level). Then `<h3>`
`takeoff_coverage_cause_heading` over `<p data-testid="coverage-inspector-cause" data-cause data-act>`
— the registered message, with `takeoff_coverage_declared_label` and the act id whole in mono
(class `cx-coverage-act-id`) where a declaration is in force — and `<p
data-testid="coverage-inspector-remedy">`, the registered remedy (I-191); `takeoff_coverage_
contradicted_note` follows on a contradicted cell (I-192). Then `<h3>`
`takeoff_coverage_sightings_heading` and one `<div data-testid="coverage-inspector-sighting"
data-channel>` per Sighting — channel, drawing, view and source key verbatim in mono under their
labels, the key `user-select: all`, class `cx-coverage-source-key` — or
`takeoff_coverage_sightings_none`. Then `<h3>` `takeoff_coverage_observations_heading` over
`takeoff_coverage_observations_hint`, and one `<div data-testid="coverage-inspector-observation"
data-rail>` per rail observation — the rail verbatim in mono, the reason as prose — or
`takeoff_coverage_observations_none`. Foot (I-194): `takeoff_coverage_doors_hint`, then core secondary
Buttons `<button data-testid="coverage-hold-out">` and `<button
data-testid="coverage-declare-out-of-scope">`, each opening the shipped ConsequenceDialog at
`actType` `HOLD_OUT_OF_BILL` / `DECLARE_NOT_IN_PROJECT_SCOPE`, `container` the screen root (I-167).
Neither commits anything itself. Idle: `takeoff_coverage_inspector_idle_heading` over `_idle_body`.

**Certificate preview** — `<section data-testid="coverage-certificate-preview">` beneath the body,
full width: `<h2>` `takeoff_coverage_certificate_heading` over `_hint`, then exactly two `<section
data-testid="coverage-statement" data-statement>` in this order and never merged — `MEASUREMENT` then
`BILL`, each with its own title and hint and never a shared cause column (L-QTY-07). Each holds a
`<ul>` of `<li data-testid="coverage-statement-row" data-kind data-class data-level data-cause>` in
`compareCanonical` order over (kind, class, level): the three model values verbatim in mono, then the
registered message as prose. An empty statement renders `<p data-testid="coverage-statement-none">`
with its own sentence. The statements print in `var(--font-doc)` at `var(--text-13)` on
`--graphite-0` inside a hairline border, `max-width: 72ch` — this is document text previewed as
document text. No count appears anywhere in this section (L-QTY-07), asserted as an absence.

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/coverage/states.ts` (`COVERAGE_STATES`) and appended to
`src/ui/screen-states/matrix.tsx` under `/t/[tenant]/p/[project]/takeoff/coverage`.
`coverage-screen[data-state]` derives in this order, first holding wins: `loading` · `denied` ·
`offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — `loading.tsx`, frame and nav intact, core Skeletons keeping the layout, never a
  spinner: 24 × 240 (heading), 480 × min(100 %, 720) (the grid), 340 × 280 (the inspector),
  480 × 200 (the preview).
- **Empty** — `<div data-testid="coverage-empty">` in the body's place, two truths, each saying why.
  No campaign pinned: `takeoff_coverage_empty_heading` / `_body` and one action, a core secondary
  Button worn as a link to `…/drawings/sets`, `_empty_action`. A campaign that has sighted nothing:
  `_empty_campaign_heading` / `_body` and one action to the register, `_empty_campaign_action`.
- **Error** — `takeoff_coverage_error_heading` / `_body`, the report id verbatim in mono under
  `_report_label`, and the core secondary Button `<button data-testid="coverage-retry">`
  `takeoff_coverage_retry`, re-running `takeoff.coverage` in place.
- **Refusal** — the one RefusalState in `coverage-answer` for a door's rejection, and the dialog's own
  slot for a preview or commit refused while it holds focus. Never a toast, never a local block.
- **Partial** — the kind-grain rows (I-196), rendered at the head of the grid with their causes, plus
  `takeoff_coverage_partial_note` under the grid heading. Rows are shown, never dropped.
- **Offline** — a `<p role="status">` banner above the header, `takeoff_coverage_offline`, house
  notice chrome (`--info-surface` fill, `--info` border, `var(--radius-4)`); both doors `disabled`.
  The grid reads on: a read honest about its age is not a broken screen.
- **Permission-denied** — `permitted` is the viewer's SET_BILL_BOUNDARY on this project, read
  server-side. Without it `data-state="denied"`, both doors do not render at all, and
  `coverage-answer` holds a standing `takeoff_coverage_denied_permission` / `_denied_holder` pair over
  one RefusalState from the registered `PERMISSION_NOT_HELD` entry, evidence the participants screen.
  Reading coverage needs membership only, which the shell guard settled before the route mounted.

## 3. Copy, verbatim

### 3.1 The six registry entries (`REFUSALS`, `src/core/errors.ts`), surface `inline`

- **NOT_ESTABLISHED** · warning · **No line has been published for this kind on this class and level,
  and nothing explains the absence.** · **Measure this kind on this class and level, or declare it out
  of the project scope so the certificate can state why it is unmeasured.**
- **INGESTION_TRUNCATED** · error · **Every sighting of this cell stands on a sheet that was read only
  in part, so nothing can be measured from it.** · **Upload the sheet again from its source file, then
  measure the campaign once it has been read whole.**
- **NOT_IN_PROJECT_SCOPE** · info · **A person declared this kind out of the project scope on this
  class and level.** · **Measure this kind to bring it back: published lines take precedence, and the
  declaration is then shown as contradicted.**
- **NO_BEARER_SIGHTED** · warning · **No class sighted in this campaign bears this kind, so the
  residue holds no cell for it.** · **Pin a revision whose drawings show a class that bears this kind,
  then measure the campaign.**
- **KIND_NOT_YET_SEEDED** · info · **This work item is in the catalogue, but no class has been recorded
  as bearing it.** · **Record the class that bears this work item in the ruleset, then measure the
  campaign.**
- **NOT_IN_THIS_BILL** · info · **A person held this kind out of this bill on this class and level.** ·
  **Measure this kind to bring it back into the bill: published lines take precedence, and the hold is
  then shown as contradicted.**

### 3.2 The screen (`src/modules/takeoff/coverage/copy.ts`, keys `takeoff_coverage_*`)

`takeoff_nav_coverage` **Coverage** · `takeoff_coverage_heading` **Coverage** · `_caption` **What this
campaign measured, what it did not, and why — one cell for every kind a sighted class bears, on every
level it was sighted.** · `_revision_label` **Pinned revision** · `_grid_label` **Kinds by class and
level** · `_measured_note` **A filled mark is a cell with published quantity.** · `_legend_heading`
**What each mark means** · `_partial_note` **Some work items bear no cell in this grid. They stand at
the head of it, each with the reason it bears none.** · `_kind_label` **Kind** · `_class_label`
**Class** · `_level_label` **Level** · `_kind_grain_label` **Every class and level** · `_cause_heading`
**Why this cell reads as it does** · `_declared_label` **Declared by act** · `_contradicted_note`
**Lines have been published for this cell since this declaration was made, so the published quantity
stands and the declaration is not printed on the certificate.** · `_sightings_heading` **Sighted in** ·
`_channel_label` **Channel** · `_drawing_label` **Drawing** · `_view_label` **View** · `_source_label`
**Read at** · `_sightings_none` **No channel sighted this class on this level.** ·
`_observations_heading` **What the rails observed** · `_observations_hint` **An observation is
evidence for the reader, never the cause on the certificate.** · `_observations_none` **Nothing was
observed for this cell.** · `_doors_hint` **Each door opens a preview of exactly what it changes.
Nothing is committed until you confirm.** · `_hold_out` **Hold out of this bill** ·
`_declare_out_of_scope` **Declare out of project scope** · `_inspector_idle_heading` **No cell
selected** · `_inspector_idle_body` **Choose a cell in the grid to read what was sighted for it, what
the rails observed, and why it stands as it does.** · `_certificate_heading` **Certificate preview** ·
`_certificate_hint` **The two boundary statements as they will print: each an enumeration, in the
certificate's own order, without counts.** · `_statement_measurement_title` **Statement of the
measurement boundary** · `_statement_measurement_hint` **Every kind, class and level this campaign did
not measure, and the reason each stands unmeasured.** · `_statement_measurement_none` **This campaign
measured every kind borne by every class it sighted, on every level.** · `_statement_bill_title`
**Statement of the bill boundary** · `_statement_bill_hint` **Every kind, class and level a person
held out of this bill.** · `_statement_bill_none` **Nothing has been held out of this bill.** ·
`_cell_label` **{kind} on {class}, {level}: {cause}** · `_cell_label_kind_grain` **{kind}, every class
and level: {cause}** · `_cell_label_measured` **Quantity is published for this cell.** ·
`_cell_label_held` **Held out of this bill.** · `_cell_label_contradicted` **A declaration over this
cell is contradicted by published lines.** · `_empty_heading` **No campaign is open on this project** ·
`_empty_body` **Coverage is read from a pinned drawing set revision. Pin one, and every cell it bears
appears here.** · `_empty_action` **Browse drawing sets** · `_empty_campaign_heading` **This campaign
has sighted nothing yet** · `_empty_campaign_body` **No class has been sighted in the pinned revision,
so the grid bears no cell. Run a measure run from the register, and the cells appear as the rails
publish.** · `_empty_campaign_action` **Open the register** · `_error_heading` **Coverage could not be
read** · `_error_body` **Nothing was changed. Try again, and quote the report id if it keeps
happening.** · `_report_label` **Report id** · `_retry` **Try again** · `_offline` **You are offline.
Coverage reads as it stood when this page loaded, and nothing can be committed until the connection
returns.** · `_denied_permission` **Holding a kind out of this bill and declaring one out of the
project scope each need the SET_BILL_BOUNDARY permission on this project.** · `_denied_holder` **A
project principal can grant it on the participants screen.**

The cell's accessible name is `_cell_label` (or `_cell_label_kind_grain`) filled with the kind, class
and level verbatim and `{cause}` filled with the registered message, or with `_cell_label_measured`;
`_cell_label_held` and `_cell_label_contradicted` are appended, in that order, where they hold — so
the name says the kind, the class, the level and the cause in words, and never a code (AC-5, I-195).
Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "rail" survives only
where the product already names its own publishers (s-takeoff §3), and "seam", "ingest", "manifest",
"residue" and every clause id appear nowhere a reader can see. Kinds, classes, levels, channels,
drawings, views, source keys, act ids, permission names and report ids are model data, rendered
verbatim in mono, never woven into a sentence (I-25). Registry messages and remedies are never
paraphrased.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. The grid paints at once, the inspector's content swaps instantly when
a cell is selected — a panel that slides while a reader is comparing cells is theatre in front of a
fact — and the statements arrive untweened. The only transitions: a cell's hover stroke and the nav
link's colour over `var(--motion-state)` `var(--ease)`; the drawn reticle's opacity over
`var(--motion-reticle)` `var(--ease)` (I-190); the Skeleton pulse while `loading.tsx` holds the route;
the ConsequenceDialog's own entrance. Horizontal scrolling of the grid box is the browser's, never
`behavior: "smooth"`. Every duration is a token zeroed at source under reduced motion, so
`coverage.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-0/50/200/500/600/700/900` · `--beam-500` · `--success`/`--success-surface` ·
`--warn`/`--warn-surface` · `--danger`/`--danger-surface` · `--info`/`--info-surface` · `--hairline` ·
`--space-1/2/3/4` · `--radius-4/8` · `--text-12/13/20` · `--font-ui`/`--font-mono`/`--font-doc` ·
`--leading-ui` · `--weight-body-medium`/`--weight-heading` · `--row-comfortable`/`--row-compact` (the
cell's side, R-UI-005) · `--motion-state`/`--motion-reticle`/`--ease`. Px literals, closed set (core
I-1's mandated class): the reticle's 2/8/4, the glyph viewBox's 16 and the bill glyph's 8, the cell
seam's 1, the selection and contradiction strokes' 1.5 and 2, the hatch's 4 px pitch, the gutter's
200, the inspector's 340, the md media-query value 960, and the loading bones 24/200/240/280/340/480/
720. Any other literal is a defect. No copper appears anywhere except on the ConsequenceDialog's
confirm, which is the pattern's own — the grid commits nothing itself, and a cause is never an act.

## 6. Themes

`coverage.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001), and the SVG inherits both through `currentColor` and the tinted `<rect>`s' token
fills. Contrast holds on the founder values in both themes: graphite-600/700/900 on graphite-0 and on
the panel's graphite-50 clear 4.5:1; each semantic colour on its own surface tint clears 4.5:1, so
every glyph is legible on its cell; the beam-500 selection stroke and the graphite-500 hatch clear the
3:1 UI floor on all four tints. In greyscale the four tints collapse and nothing is lost: the mark,
the hatch and the accessible name each say the whole reading (R-UI-060).

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenant}/p/{project}/takeoff/coverage` (`coverageRoute`) and its widened form
`…/takeoff/coverage?cell={kind}:{class}:{levelId}` (`CELL_PARAM = "cell"`, a kind-grain row addressed
as `{kind}::`). Routes linked, all shipped: `…/takeoff/register`, `…/drawings/sets`,
`…/settings/participants` (the denial's evidence), `…/settings/ruleset` (KIND_NOT_YET_SEEDED's).

Test ids, exactly the contract's, on the elements ruled in §1: `takeoff-nav-coverage` ·
`coverage-screen` (`data-state`, `data-campaign`) · `coverage-grid` · `coverage-kind-row`
(`data-kind`) · `coverage-cell` (`data-kind`, `data-class`, `data-level`, `data-grain`,
`data-measurement`, `data-bill`, `data-contradicted`) · `coverage-cell-glyph` (`data-cause`) ·
`coverage-legend` · `coverage-legend-entry` (`data-cause`) · `coverage-inspector` (`data-cell`) ·
`coverage-inspector-cause` (`data-cause`, `data-act`) · `coverage-inspector-remedy` ·
`coverage-inspector-sighting` (`data-channel`) · `coverage-inspector-observation` (`data-rail`) ·
`coverage-hold-out` · `coverage-declare-out-of-scope` · `coverage-answer` · `coverage-empty` ·
`coverage-retry` · `coverage-certificate-preview` · `coverage-statement` (`data-statement`) ·
`coverage-statement-row` (`data-kind`, `data-class`, `data-level`, `data-cause`) ·
`coverage-statement-none`. `takeoff-nav`, `takeoff-nav-register`, `refusal-state`, `refusal-message`,
`refusal-remedy`, `refusal-evidence-link`, `consequence-dialog`, `consequence-confirm`,
`consequence-digest-line`, `skeleton` and `screen-state` are other files' ids, used and never
redefined. No others are added: the headings, the two doors and the empty-state actions are found by
role and name.

Behavioural hooks without new ids: `role="grid"`/`row`/`columnheader`/`gridcell` and
`aria-labelledby` on the SVG; `aria-selected="true"` on exactly the selected cell and `tabindex="0"`
on exactly one cell; `aria-current="page"` on the nav's current entry; `role="status"` on the offline
banner; `aria-live="polite"` on `coverage-answer`; `data-density` re-keying the cell side. Asserted
absences: no `NOT EXISTS` reaches the screen's words and no refusal code appears in any text node
under `coverage-screen`; no count of any kind inside `coverage-certificate-preview`; no
`coverage-hold-out` or `coverage-declare-out-of-scope` on a QUANTITY_BEARING cell, on a kind-grain
row, on a cell whose declaration is in force, or while `data-state="denied"` (I-194); no statement row
for a cell reading `data-contradicted="true"` (I-192); no `<title>`/tooltip on a cell.

Suites: `tests/takeoff/coverage/**` — jsdom mounts of `CoverageWorkspace` over
`coverageFixture()`/`residueFixture()` with chrome bound to the shipped components (I-170) for the
grid, the two glyphs, the legend's six entries, the inspector, the doors, the address and the seven
state cells; and the reading and the two acts through the router. Each of the six causes is exercised
by name. Journeys: `tests/e2e/journeys/j-022-coverage.spec.ts` through
`tests/e2e/pages/s-coverage.page.ts`, staged by `tests/e2e/takeoff/coverage-stage.ts`, checkpoints
`j-022-coverage/{grid,held-out,certificate}`; `tests/e2e/journeys/j-000-coverage.spec.ts`, checkpoints
`j-000/{column-lines,coverage-grid}`. axe serious/critical = 0 at each, never widened. `masks()`
covers the shell breadcrumb, `shell-user`, `shell-tenant-switcher` and this screen's three per-run
texts by class — `.cx-coverage-revision`, `.cx-coverage-act-id`, `.cx-coverage-source-key` — which
exist for that masking and are not ids, because the contract is closed. Re-baselined under B-20, in
its own `baseline:` commit naming the nav entry as the proof: `s-takeoff/register.png`,
`s-takeoff/measure-queued.png` and the j-021 pictures that show `takeoff-nav`, whose bytes move only
because the nav gains a second entry.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Withdrawing or superseding a scope declaration, and the REPIN consequence over one — owner: the act's
own later leaf; `in_force` is written true here and never flipped, and the screen offers no door that
would. The Part A declared-disagreement row a contradicted cell owes (L-QTY-09) — owner: M7's review
queue; here the cell is marked and omitted from the statements, and no queue row is written. An
`EvidenceLink` from a sighting row to the sheet it was sighted on — owner: a later leaf, once the
pattern admits a sighting, which carries no basis to colour it by. A frozen kind gutter and sticky
header rows for a project whose class-and-level extent outgrows the viewport — owner: a later leaf;
the box scrolls both ways today. The class-grain appendix (a sighted class bearing no kind), the
sheet-grain fidelity block, and the certificate document itself — owner: M7, per L-QTY-07. Bulk
declarations as an offered group (R-UI-023) — deliberately absent: a declaration is one act over one
cell. Folding `takeoff_nav_coverage` into `src/ui/strings/takeoff.ts` beside its sibling — owner: that
file's node, when it next opens (I-197).
