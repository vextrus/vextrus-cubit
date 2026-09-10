# Design Decision — S-Takeoff (the register workspace)

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
DataTable; the one RefusalState, OfferedGroups, ConsequenceDialog and JobTimeline — plus the
`cx-register-*` classes this file rules.

## 0. Interpretations (numbering continues the global chain's highest, s-scale's I-169)

- **I-170 — the workspace is a module component and its shipped chrome is injected.** ARCH-01 bars
  `src/modules` from importing `src/ui`, and B-17 bars a screen from re-implementing a shipped
  primitive. `RegisterWorkspace` therefore takes its renderers: props are exactly
  `{ view, density, permitted, offline, chrome, doors }`, where `chrome` is
  `{ Tree, DataTable, RefusalState, OfferedGroups, ConsequenceDialog, JobTimeline, Skeleton,
  BasisChip, CoverageChip }` and `doors` the six procedures plus `refusalOf`. `register-screen.tsx`
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

## 1. Layout and hierarchy

`takeoff/layout.tsx` renders `takeoff-nav` above `{children}`: `<nav data-testid="takeoff-nav"
aria-label={takeoff_nav_label}>`, one hairline baseline, flex, gap `var(--space-1)`, one `next/link`
per entry — today exactly `<a data-testid="takeoff-nav-register">` `takeoff_nav_register` to
`registerRoute(...)`, height `var(--space-8)`, padding-inline `var(--space-3)`, `var(--text-13)`
`var(--weight-body-medium)`, text `var(--graphite-700)`, hover `var(--graphite-900)`, `cx-reticle`.
The entry for the address in the browser carries `aria-current="page"`, text `var(--graphite-900)`
and a 2 px `var(--beam-500)` underline flush to the baseline (the Tabs idiom, in a nav of links —
s-project I-125's rule that a link row states where the reader is standing when it is the reader's
own screen). `takeoff/page.tsx` is a redirect and renders nothing.

The register page renders in `shell-main` as `<div class="cx-register"
data-testid="register-workspace" data-state={…} data-campaign={campaignId}>`, column flex,
`gap: var(--space-4)`, `max-width: none` — a register is read at the width of the window.

**Header** — `<header>`: `<h1>` `takeoff_register_heading`, `var(--text-20)`
`var(--weight-heading)` `var(--graphite-900)`, over `takeoff_register_caption` in `var(--text-13)`
`var(--graphite-600)`. Right of it (`margin-left: auto`, flex, `gap: var(--space-3)`, align end):
the pinned revision as `takeoff_register_campaign_label` over the `setRevisionId` whole in
`var(--font-mono)` `var(--text-12)` `var(--graphite-700)` `user-select: all`; then the core primary
Button `<button data-testid="register-measure">` `takeoff_register_measure`, with
`takeoff_register_measure_hint` beneath it in `var(--text-12)` `var(--graphite-600)`. Not the act
variant: enqueueing a job is not an act (offered-group I-81's reading of the copper scarcity).
Below the header, `<section data-testid="register-timeline">` holding the shipped `JobTimeline`
with heading `takeoff_register_timeline_heading` and one tracked job per measure run the door
answered — the job pattern rendered where the operation was started (R-UI-024).

**Answer slot** — `<div data-testid="register-answer" aria-live="polite">` directly under the
header, empty until a door is refused. It holds exactly one RefusalState, no chrome around it
(R-UI-020): `CAMPAIGN_NOT_FOUND` from the Measure door, `READING_NOT_NUMERIC` or
`ACT_CHANGES_NOTHING` from a preview, `PERMISSION_NOT_HELD` while `permitted` is false. A preview
rejection is answered here and **no dialog opens** — a dialog that opens on nothing is a consequence
of nothing.

**Filter bar** (I-172) — `<div class="cx-register-filters">`: flex, wrap, `gap: var(--space-3)`,
align-items end. Five controls, in this order, each a visible `<label for>` (`var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-700)`) over `<select class="cx-input cx-reticle
cx-register-select">` — the core Input's own chrome worn by taking `.cx-input` itself, never
restated (B-17), plus `min-width: 160px`: `register-filter-class`, `register-filter-kind`,
`register-filter-level`, `register-filter-basis`, `register-filter-coverage`. A chosen model value
renders in `var(--font-mono)`; the all-option, which is the control's own chrome, in
`var(--font-ui)`. Then `margin-left: auto`, `<p data-testid="register-lines-count" role="status">`
— `takeoff_register_lines_count` filled through `formatUserFigure`, `var(--font-ui)`
`var(--text-12)` `var(--graphite-600)` `tabular-nums`, mounted from first paint.

**Body** — `<div class="cx-register-body">`, grid `280px minmax(0, 1fr) 340px`,
`gap: var(--space-4)`, `align-items: stretch`; one column below `min-width: 960px` (the md token's
value, the one lawful literal in a media query — S-Audit's ruling). The centre dominates: the tree
and the inspector are `var(--graphite-50)` panels bordered `var(--hairline)`, radius
`var(--radius-8)`; the lines table sits on `var(--graphite-0)` and takes the height.

- **Tree panel** — `<h2>` `takeoff_register_tree_label` (`var(--text-13)`
  `var(--weight-heading)`, padding `var(--space-2)` `var(--space-3)`, `border-bottom:
  var(--hairline)`), then the I-171 wrapper `data-testid="register-tree"` around the shipped `Tree`:
  `items` nested discipline → level → class → object, labels verbatim (`STRUCTURAL`, `GF`, `column`,
  `C1`), every discipline and level expanded by default, `defaultSelectedId` the first object so the
  inspector is filled at mount. `onSelect` of an object node fills the inspector; a branch node
  selects and expands and changes nothing else. Foot: `<p data-testid="register-repudiated-count">`
  `takeoff_register_repudiated_count`, `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`,
  always rendered — the zero form is a counted empty set, never a hidden cell (I-173).
- **Lines** — the I-171 wrapper `data-testid="register-lines"` around the shipped `DataTable`,
  `density` from the frame's `data-density`, `getRowId` the `lineId`, virtualised as it ships (50 000
  rows cost one screenful). Columns in exactly this order, headers from the copy table: `kind`,
  `value` (`meta.align: "right"`), `unit`, `formula`, `variables`, `bases`, `coverage`,
  `calibration`, `engine`, `source`. Cells: the SI value verbatim; the unit through the shipped
  UnitBadge; the formula verbatim, wrapping, mono; variables as `name=value unit` pairs read from
  `bindings`, space separated; bases as `quantityBasis/selectionBasis`, each a BasisChip so the
  glyph travels with the word (R-UI-002); coverage as its enum word beside a CoverageChip;
  calibration keys joined by a space, whole; the engine verbatim; the cited source key verbatim,
  `user-select: all` — **text, not a link**: the Trace is inc-215's. A line the reading marks
  `repudiated` is not a row here at all: it is withheld and counted at the tree panel's foot, and
  `register-lines-count` counts the lines the table may show (I-173). No `meta.editable` anywhere,
  and no checkbox column.
- **Inspector** — `<aside data-testid="register-inspector" data-object={objectKey}>`, the tree
  panel's chrome exactly. Header: `<p data-testid="register-object-key">` the key whole, wrapping,
  `user-select: all`, `var(--font-mono)` `var(--text-13)` `var(--graphite-900)` (I-26), preceded by
  a visually hidden `takeoff_register_object_key_label`. Then a `<dl>` grid `auto 1fr`, gap
  `var(--space-1)` `var(--space-3)`, labels `var(--text-12)` `var(--graphite-600)`:
  `takeoff_register_basis_label` → `<dd data-testid="register-object-basis" data-basis>` a BasisChip;
  `takeoff_register_role_label` → `<dd data-testid="register-object-role" data-role>` the standing
  verbatim in mono; `takeoff_register_corroboration_label` → `<dd
  data-testid="register-object-corroboration" data-standing>` the state verbatim in mono;
  `takeoff_register_source_label` → `<dd data-testid="register-source-key">` the source key whole,
  mono, select-all. Then, on a struck object, `<p>` `takeoff_register_repudiated_note`
  (`var(--text-12)` `var(--graphite-600)`, `var(--graphite-100)` fill, `var(--hairline)`, radius
  `var(--radius-4)`); otherwise the core secondary Button `takeoff_register_repudiate` (I-175),
  absent also while `permitted` is false.
  **Attributes** — `<h3>` `takeoff_register_attributes_label`, then one `<section
  data-testid="register-attribute" data-attribute data-standing>` per attribute, `border-top:
  var(--hairline)`, padding-block `var(--space-2)`: the attribute name in `var(--text-13)`
  `var(--weight-body-medium)`; the standing state verbatim in mono; the standing value where one
  exists as `<p data-testid="register-reading" data-role="standing" data-basis data-precedence>` —
  value and unit in mono beside a BasisChip and the reading's own source key. Under
  `takeoff_register_competing_label` and `takeoff_register_overruled_label`, the same
  `register-reading` row shape at `data-role="competing"` / `"overruled"`, text
  `var(--graphite-700)`; a SUSPENDED attribute renders no standing row and carries
  `takeoff_register_suspended_note` above its competing list (I-174); an attribute with nothing
  recorded says `takeoff_register_no_readings`. Last in the row, the core ghost Button
  `takeoff_register_corroborate`, which toggles a small form in place: core Inputs labelled
  `takeoff_register_corroborate_value`, `_unit` and `_precedence` (the last described by
  `takeoff_register_corroborate_precedence_hint`, defaulting to `0`), and a core secondary Button
  `takeoff_register_corroborate_preview` which opens the ConsequenceDialog with `actType`
  `CORROBORATE`, `sourceKey` carried from the object verbatim and never typed.
  **Idle** — with no object selected: `takeoff_register_inspector_idle_heading` over
  `takeoff_register_inspector_idle_body`, no button.

**Refusals** — `<section data-testid="register-refusals" data-count={n}>` beneath the body: `<h2>`
`takeoff_register_refusals_heading` over `takeoff_register_refusals_hint`, then one `<div
data-testid="register-refusal" data-code data-object data-kind>` per queue item and refused sighting,
in the order the view answers them, `border-top: var(--hairline)`, padding-block `var(--space-3)`.
Each row is the object key and kind in mono under their labels, then **exactly one** RefusalState
from the registered entry (`INTERPRETED_UNCORROBORATED`, `DUPLICATE_IDENTITY`) with evidence
`{ href: /t/{tenant}/p/{project}/drawings, label: takeoff_register_evidence }`. No code, message or
remedy is spelled anywhere else on the screen: outside a `refusal-state` no text node under
`register-workspace` spells a refusal code (R-UI-020, B-17).

**Level stack** — `<section data-testid="register-level-stack">`: `<h2>`
`takeoff_register_level_stack_heading` over `takeoff_register_level_stack_hint`, then the shipped
`OfferedGroups` — one item per drawing of the pinned revision with a non-null proposal, `key` the
`PROPOSED_LEVEL_STACK` key verbatim, `label` `takeoff_register_level_stack_label` filled with the
drawing, `count` `takeoff_register_level_stack_count` filled through `formatUserFigure`. Confirming
opens the one ConsequenceDialog at `actType` `INSERT_LEVEL` with the offer's levels verbatim. There
is no `input[type=checkbox]`, no `[role=checkbox]` and no select-all anywhere under
`register-workspace` — the asserted absence is the substance of R-UI-023 (offered-group I-77).

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/register/states.ts` (`REGISTER_STATES`) and in `src/ui/screen-states/matrix.tsx`
under `/t/[tenant]/p/[project]/takeoff/register`; the redirect route
`/t/[tenant]/p/[project]/takeoff` declares all seven **delegated** to the register route, naming it
and the redirect as the reason — a route that renders nothing has no state of its own to invent.
`register-workspace[data-state]` is derived in this order, the first that holds winning: `loading` ·
`denied` · `offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — `loading.tsx`, frame and nav intact, core Skeletons keeping the layout, never a
  spinner and never one on the table (R-UI-004): 24 × 240 (heading), a row of five 32 × 160 (the
  filters), then three bones side by side — 480 × 280, 480 × min(100 %, 1080) and 480 × 340.
- **Empty** — `<div data-testid="register-empty">` in the body's place, two truths, each saying why
  (R-UI-020). No campaign pinned: `takeoff_register_empty_heading` / `_body` and the one action, a
  core secondary Button worn as a link to `…/drawings/sets`, `takeoff_register_empty_action`. A
  campaign with nothing registered: `takeoff_register_empty_campaign_heading` / `_body`, no second
  action — `register-measure` already stands in the header, and a duplicate door teaches a second
  way to do one thing. A filtered-to-nothing table is not this cell: it renders
  `takeoff_register_lines_none` in the table's place with the tree and inspector untouched.
- **Error** — `<div data-testid="register-empty">`'s sibling `<div>` holding
  `takeoff_register_error_heading` / `_body`, the report id verbatim in mono under
  `takeoff_register_report_label`, and the core secondary Button `<button data-testid=
  "register-retry">` `takeoff_register_retry`, which re-runs `takeoff.register` in place. A render
  fault of the surrounding screen is the root error boundary's, unchanged.
- **Refusal** — the one RefusalState, in `register-answer` for a door's rejection and inside each
  `register-refusal` row for a sighting's. Never a toast, never a screen-local block.
- **Partial** — rendered, never hidden: published lines, queue items and refused sightings stand
  together, and `data-state="partial"` while `register-refusals[data-count]` is above zero and the
  view otherwise answered. A struck object stands in the tree with its lines withheld and counted,
  which is a statement of what a person did rather than a cell of this state (I-173).
- **Offline** — a banner above the header, `<p data-testid="register-answer">`'s sibling
  `<p role="status">` `takeoff_register_offline`, house notice chrome (`var(--info-surface)` fill,
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
appear as each rail publishes them.** · `takeoff_register_timeline_heading` **Measure runs** ·
`takeoff_register_filter_class` **Class** · `takeoff_register_filter_kind` **Kind** ·
`takeoff_register_filter_level` **Level** · `takeoff_register_filter_basis` **Basis** ·
`takeoff_register_filter_coverage` **Coverage** · `takeoff_register_filter_any_class` **All
classes** · `_any_kind` **All kinds** · `_any_level` **All levels** · `_any_basis` **All bases** ·
`_any_coverage` **All coverages** · `takeoff_register_lines_count` **{shown} of {total} lines** ·
`takeoff_register_tree_label` **Objects by discipline, level and class** ·
`takeoff_register_repudiated_count` **{count} objects repudiated, {lines} lines withheld** ·
`takeoff_register_col_kind`
**Kind** · `_col_value` **Value** · `_col_unit` **Unit** · `_col_formula` **Formula** ·
`_col_variables` **Variables** · `_col_bases` **Bases** · `_col_coverage` **Coverage** ·
`_col_calibration` **Calibration** · `_col_engine` **Engine** · `_col_source` **Source** ·
`takeoff_register_repudiated_note` **A person judged this object to be nothing. Nothing was deleted:
every reading and every line measured from it stays on record, and its lines are withheld from the
table.** · `takeoff_register_lines_none` **No line matches
these filters. Every line stays registered — clear a filter to see the rest.** ·
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
`takeoff_register_refusals_heading` **Deferred and refused** · `takeoff_register_refusals_hint`
**These sightings produced no line. Each says why, and where to resolve it.** ·
`takeoff_register_refusal_object_label` **Object** · `takeoff_register_refusal_kind_label` **Kind** ·
`takeoff_register_evidence` **Open the source drawings** ·
`takeoff_register_level_stack_heading` **Level stacks read from the drawings** ·
`takeoff_register_level_stack_hint` **Confirming inserts every level in the offer as one act.
Nothing is chosen row by row.** · `takeoff_register_level_stack_label` **Level stack proposed from
{drawing}** · `takeoff_register_level_stack_count` **{count} levels** ·
`takeoff_register_empty_heading` **No campaign is open on this project** ·
`takeoff_register_empty_body` **A register fills once a drawing set revision is pinned. Pin one, and
every sighting it produces appears here.** · `takeoff_register_empty_action` **Browse drawing
sets** · `takeoff_register_empty_campaign_heading` **This campaign has registered nothing yet** ·
`takeoff_register_empty_campaign_body` **Queue a measure run above, and every object the rails
register appears here as they publish.** · `takeoff_register_error_heading` **The register could not
be read** · `takeoff_register_error_body` **Nothing was changed. Try again, and quote the report id
if it keeps happening.** · `takeoff_register_report_label` **Report id** ·
`takeoff_register_retry` **Try again** · `takeoff_register_offline` **You are offline. The register
reads as it stood when this page loaded, and nothing can be committed until the connection
returns.** · `takeoff_register_denied_permission` **Recording a reading, repudiating an object and
queueing a measure run each need the MEASURE permission on this project.** ·
`takeoff_register_denied_holder` **A project principal can grant it on the participants screen.**

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "campaign", "rail",
"gate", "seam", "ingest" and every clause id appear nowhere a reader can see (the word *campaign*
survives only where it names the product's own pinned run, which the caption defines). Object keys,
source keys, marks, disciplines, classes, kinds, units, bases, coverages, engines, corroboration
states, act types, level ids, job ids and report ids are model data and render verbatim as data in
mono, never woven into a sentence (I-25). Registry messages and remedies are never paraphrased.

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

`--graphite-0/50/200/600/700/900` · `--beam-500/600` · `--info`/`--info-surface` · the basis palette
and the coverage bands, reached only through BasisChip and CoverageChip · `--hairline` ·
`--space-1/2/3/4` · `--radius-4/8` · `--text-12/13/20` · `--font-ui`/`--font-mono` ·
`--leading-ui` · `--weight-body-medium`/`--weight-heading` · `--row-comfortable`/`--row-compact`
(through the table's density and the `[data-density]` re-keying of the refusal and attribute rows,
R-UI-005) · `--motion-state`/`--ease`. Px literals, closed set (core I-1's mandated class): the
body's 280 px and 340 px side columns, the filter's 160 px minimum, the nav's 2 px current-underline,
the md media-query value, and the loading bones 24/32/480 × 160/240/280/340/1080. Any other literal
is a defect. No copper appears anywhere except on the ConsequenceDialog's confirm, which is the
primitive's own — the workspace commits nothing itself.

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
`register-refusal-object`). `project-tab`, `offered-groups`, `offered-group`, `offered-group-count`,
`offered-group-confirm`, `refusal-state`, `refusal-message`, `refusal-remedy`,
`refusal-evidence-link`, `job-timeline`, `job-timeline-step`, `consequence-dialog`, `tree`,
`tree-item`, `datatable`, `datatable-row`, `datatable-cell`, `basis-chip`, `coverage-chip`,
`unit-badge`, `skeleton` and `screen-state` are other files' ids, used and never redefined. No
others are added: the Corroborate, Repudiate, Preview and empty-state doors, the headings and the
count line are found by role and name.

Behavioural hooks without new ids: `aria-current="page"` on the nav's current entry;
`role="status"` on the count line and the offline banner; `aria-live="polite"` on `register-answer`;
`role="tree"`/`role="treeitem"` and `role="table"`/`role="row"`/`role="columnheader"` inside the two
I-171 wrappers; `data-standing="REPUDIATED"` on a struck object's corroboration cell;
`data-kind="PROPOSED_LEVEL_STACK"`
and `data-drawing` on each offered group; `cx-reticle` on every focusable element; and the asserted
absences — no `input[type=checkbox]`, no `[role=checkbox]`, no select-all, no `EvidenceLink` and no
refusal code in any text node outside a `refusal-state`. Suites: `tests/ui/takeoff-register/**`
(jsdom mounts of `RegisterWorkspace` over `registerFixture()`, `linesFixture(n)`,
`refusalsFixture()`, `levelStackFixture()`, chrome bound to the shipped components per I-170),
`tests/takeoff/register-ui/**` (the reading, the doors and the two acts through
`stageRegisterCampaign()`), and `tests/takeoff/register-ui/copy-mirror.test.ts`, which fails the
build if the module's `copy.ts` and `src/ui/strings/takeoff.ts` ever differ (the viewer-inspector
§8 precedent; its IOU — a copy home both layers may read — is re-recorded here unpaid). Journey:
`tests/e2e/register.spec.ts`, titles carrying J-021, page object
`tests/e2e/pages/s-takeoff.page.ts`; checkpoints `s-takeoff/register` and `s-takeoff/measure-queued`,
axe serious/critical = 0 at each, never widened, `masks()` over the shell breadcrumb, `shell-user`,
`register-timeline` and `register-source-key` — the per-run texts. Two ids exist for that masking
and for nothing else, because this screen states two more surrogates verbatim and a surrogate is
per-run ink: `register-campaign` (the pinned revision beside its label) and
`register-refusal-object` (the object key on a refusal row). The picture is deterministic only once
`masks()` covers them, the inspector's `register-object-key` and the rail's
`shell-tenant-switcher` (the staged workspace's own name) — recorded as this increment's Objection,
since the page object is the Verifier's. Re-baselined under B-20:
`tests/e2e/baselines/design/s-project/home.png` (the Takeoff tab becomes a link) and
`j-003/project-edited.png` only if its bytes move.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

The Trace column and the EvidenceLink from a line to its entities and back (R-UI-022) — owner:
inc-215; this node renders the cited source key as text. The Coverage nav entry beside Register —
owner: inc-216, which extends `takeoff-nav`. Bulk corroboration of INTERPRETED sightings as an
offered group (J-040) — owner: M4. Resizable, remembered panel widths for the three regions
(R-UI-005) — owner: the prefs seam's node, which holds the same debt for the viewer. Column pin,
resize and sort persistence on the lines table — owner: the same node. A CORROBORATE that names more
than one attribute, and an inline correction on a line — deliberately absent: a line is a record.
