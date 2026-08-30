# Design Decision — S-Audit (act log explorer, model ledger, jobs)

Route: `/t/{tenantId}/p/{projectId}/audit` under
`src/app/(app)/t/[tenant]/p/[project]/audit/**`, inside the shell frame and behind the
membership guard in `t/[tenant]/layout.tsx`. Increment inc-016-audit-surfaces. Law:
R-SPINE-081, L-ACT-01, R-UI-001/003/004/005/012/020/031/050/060, B-17, Q-11, Q-17. Every
convention of the primitives-core Decision binds: `cx-` classes, tokens-only colour and
motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in authored
CSS. Interpretations I-1–I-30 of the earlier Decisions remain in force ("workspace" is the
user-facing word for tenant, s-auth I-11; copy lives in `strings.ts` beside the page,
s-settings-ruleset I-24; model values render verbatim in mono, I-25; digests render whole,
I-26; the rail states the area, I-30). Chrome comes only from shipped primitives — the core
Input, Button and Skeleton — plus the `cx-audit-*` classes this file rules. The screen is a
reader: the act seam stays the sole writer (L-ACT-01), so no act, no copper, no
ConsequenceDialog appears anywhere on it.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-31 — the closed-choice filters are native `<select>` elements.** The contract asks a
  person to *choose* an act type and an actor; the shipped barrels hold no Select, and
  `src/ui/primitives/**` is another node's, so building a Radix Select here would be the
  B-17 defect. The platform's `<select>` is the accessible closed choice: label-in-name,
  keyboard, AT support for free. It wears this screen's control chrome via tokens
  (`cx-audit-select`, §1) — the Input *idiom*, not the Input's CSS — and keeps the UA's own
  drop indicator: a redrawn chevron would need a background-image whose colour no token can
  reach. Options derive from the given rows (the distinct `actType`s; the distinct
  `actorId`s labelled by `actorLabel`), plus one all-option each; a filter over values the
  list does not hold would offer choices that can only produce emptiness.
- **I-32 — the subject filter compares whole identifiers.** "Acts whose subjects include
  it" is array membership: an act matches when the trimmed entered value equals one of its
  subjects exactly. A subject is an identifier, and a fragment match would show an act as
  citing evidence the person did not name (the I-26 class: identifiers compare whole, never
  in part). A blank or whitespace-only entry is no filter.
- **I-33 — the empty answer lives inside the region and has two truths.** `audit-acts-empty`
  renders in the list's place, beside the filters that stay the screen's content — the
  shell's `ShellEmptyState` is the centred teaching frame of a screen with nothing on it,
  wrong at region scale, so a compact block is not a re-implementation of it. Two variants,
  chosen by cause, each saying why it is empty (R-UI-020): **no acts recorded** teaches that
  the log fills itself and there is nothing to set up — no action renders, because no action
  on a reader commits an act, and a link pretending otherwise would teach a falsehood;
  **no act matches** names the filters as the cause and carries the region's one action, a
  ghost Button that clears all three.
- **I-34 — occurred-at renders the date seam's date, and order carries recency.** SEAM-FORMAT
  offers `formatDate` (DD MMM YYYY) and no time-of-day rendering; `src/core/format` is
  another node's, so this screen invents none (the sessions-screen precedent: local
  wall-clock parts from the timestamp, through `formatDate`). Newest-first order is what
  disambiguates two acts of one day. Recorded IOU, owner `src/core/format`'s node: a
  BD_DOCUMENT time-of-day rendering, adopted here when it exists.
- **I-35 — a disarmed panel is a state, not a failure.** The panels' posture comes from a
  live per-call probe of `AUDIT_PANEL_TABLES` — never a frozen roster, never memoised at
  module load — and `{ armed: false }` means the installation holds no such table yet. That
  is rendered as calm copy in the panel's own place: not an error, not a refusal (the
  taxonomy registers no code for it), not an empty table pretending the ledger exists.
- **I-36 — the log is a list, not a DataTable and not a fixed-height table.** No sort, no
  column operations, no inline edit, no virtualisation (pagination is out of scope by name),
  and the contract's filters are external controls, not column filters — DataTable would be
  machinery with none of its behaviour in use (the I-29 class). An entry carries a digest
  and a subjects set that render whole and wrap (I-26), so entries are variable-height
  blocks separated by hairlines; R-UI-005's fixed row heights bind data tables, and its
  hairline-divider discipline is kept.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments,
calls `getAuditSurfaces({ tenantId }, projectId)` from `src/modules/spine/audit`, renders
the sections), `loading.tsx`, `act-log-explorer.tsx` (exports the client component
`ActLogExplorer({ acts })`, mountable under jsdom — filtering is in-component over the given
rows), `audit-panels.tsx` (server-rendered panel pair), `strings.ts` (keys `audit_…`, I-24),
`states.ts` (§2), `audit.css`. A segment that is no uuid names no project and is judged
before any query (the shell's `scopedTenantId` precedent) — the module answers the same
`AuditSurfaces` shape with no acts, never a 22P02 driver fault.

The page renders in `shell-main`, one column `cx-audit`: `max-width: 1080px`, column flex,
`gap: var(--space-6)`. Rail and breadcrumb are the shell's, per I-30: `areaOf` reads this
address as Projects, the rail row carries `aria-current="true"`, the Projects crumb links
back, and no crumb names this screen. Recorded IOU: visible navigation to this route
(R-UI-031) is owed by the node that owns the shell's project navigation — the increment's
own scope names the shell entry as another node's — until then the route is journey- and
URL-reachable, and that debt is recorded here, not silently absorbed.

Header block (`gap: var(--space-2)`): `<h1>` `audit_heading` — `var(--text-20)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0 — over the caption `audit_caption`
in `var(--text-13)` `var(--graphite-600)`.

### Act log explorer (`<section aria-labelledby>`)

`<h2>` `audit_acts_heading` (`var(--text-16)` `var(--weight-heading)` `var(--graphite-900)`,
margin 0), then the **filter row**: flex, wrap, `gap: var(--space-3)`, align-items end. Each
control is label over field, `gap: var(--space-1)`, `<label for…>` `var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-700)`:

- **Act type** — `<select data-testid="audit-filter-type" class="cx-input cx-reticle
  cx-audit-select">` (I-31): the core Input's own chrome — height, fill, border, radius,
  padding-inline, `var(--text-14)` `var(--graphite-900)`, hover `var(--graphite-400)`,
  disabled and invalid — is worn by taking `.cx-input` itself, never restated here (B-17);
  `.cx-audit-select` adds min-width 180 px and nothing else. Focus: the reticle fallback (a
  replaced element hosts no `::after`). **While an act type is chosen** the control also
  takes `.cx-audit-select-mono` — `var(--font-mono)` `tabular-nums slashed-zero` — because a
  chosen act type is a source key rendered verbatim (I-25); with the all-option showing it
  reads in `var(--font-ui)`, since that option is the control's own chrome and not a model
  value, and two adjacent filters must not disagree on typeface over chrome. First option
  `audit_filter_any_type`, value empty; then the distinct `actType`s of the given rows,
  code-point order, each its own verbatim label and value.
- **Actor** — `<select data-testid="audit-filter-actor">`, same chrome, always in
  `var(--font-ui)` (an actor label is prose, not a source key). First option
  `audit_filter_any_actor`; then the distinct actors, option label `actorLabel`, option
  value `actorId`.
- **Subject** — the core Input, `data-testid="audit-filter-subject"`, width 240 px,
  labelled `audit_filter_subject_label`, no placeholder (the s-auth ruling). Matching per
  I-32, conjunctive with both selects.
- **The count line** — `<p role="status">`, margin 0, `align-self: center`,
  `margin-left: auto`: `audit_count` filled by the string seam's `fill` with `{shown}` and
  `{total}` through `formatUserFigure`, `var(--font-ui)` `var(--text-12)`
  `var(--graphite-600)` `tabular-nums` — a sentence about the list rather than a value out of
  the store, so it takes the UI face with the tabular figures every UI number takes
  (C-SPINE-PLATFORM). Mounted from first paint, so a filter
  change is announced without a second live region.

Then `var(--space-3)`, then `<ol data-testid="audit-acts">` — list-style none, margin 0,
padding 0, border-top `var(--hairline)` — the project's acts newest-first (`occurredAt`
descending, `actId` descending as the tiebreak so the order is total). Rows that fail the
conjunction of the three filters are not rendered; clearing a filter restores them. Each
`<li data-testid="audit-act-row" data-act-type={actType} data-actor-id={actorId}>`:
padding-block `var(--space-3)`, border-bottom `var(--hairline)`, column flex
`gap: var(--space-1)`:

- **Meta line** — flex, baseline, `gap: var(--space-3)`: the act type verbatim in
  `var(--font-mono)` `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`;
  the `actorLabel` in `var(--text-13)` `var(--graphite-700)`; then, `margin-left: auto`,
  occurred-at per I-34 in `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`
  `tabular-nums slashed-zero`.
- **Consequence line** — flex, baseline, `gap: var(--space-2)`: the label
  `audit_consequence_label` (`var(--text-12)` `var(--graphite-600)`, min-width 96 px so the
  two labels column-align) then `<span data-testid="audit-act-consequence">` — the digest
  whole, wrapping (`overflow-wrap: anywhere`), `user-select: all`, `var(--font-mono)`
  `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero` (I-26; the M0 stored
  consequence is its digest, per the increment's recorded Interpretation).
- **Evidence line** — same grid, label `audit_evidence_label`, then
  `<span data-testid="audit-act-evidence">`: inline flex, wrap, `gap: var(--space-2)`, one
  `<span>` per subject verbatim, `var(--font-mono)` `var(--text-12)` `var(--graphite-700)`,
  `user-select: all` each — the act's cited evidence is its subjects array, shown whole.

**Empty** (I-33): in the `<ol>`'s place, `<div data-testid="audit-acts-empty">` — column
flex, `gap: var(--space-2)`, padding-block `var(--space-6)`, border-top `var(--hairline)`:
heading line `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`, body line
`var(--text-13)` `var(--graphite-600)`. With no acts at all: `audit_empty_none_heading` /
`audit_empty_none_body`, nothing else. With acts but no match: `audit_empty_filtered_heading`
/ `audit_empty_filtered_body`, then `var(--space-2)` and a core ghost Button, label
`audit_empty_clear`, `align-self: start`, which resets all three filters in place. Clearing
unmounts this block and with it the button that was pressed, so the clearing moves focus to
the act-type filter: a control that deletes its own focus target would drop a keyboard reader
to `<body>` and back to the top of the document, and a visible focus indicator is never
optional (R-UI-012).

### The panels

Below the explorer: `<div class="cx-audit-panels">`, grid two equal columns,
`gap: var(--space-4)`, one column below the md breakpoint (`min-width: 960px` — a media
query cannot consume `var()`, so the token's value is the one lawful literal). Each panel is
a `<section aria-labelledby>` card: fill `var(--graphite-50)`, border `var(--hairline)`,
radius `var(--radius-8)`, padding `var(--space-4)`, column flex `gap: var(--space-2)` —
`data-testid="audit-panel-model-ledger"` / `"audit-panel-jobs"`, each carrying
`data-armed="true"|"false"` from its live probe (I-35).

- `<h2>` `audit_ledger_heading` / `audit_jobs_heading` — `var(--text-16)`
  `var(--weight-heading)` `var(--graphite-900)`, margin 0.
Armed means the panel can be answered for the reader in front of it: the catalogue holds the
table AND the tenant handle asking holds `select` on it. The catalogue answers about relations
a role has no privilege on, so arming on existence alone would let the row count raise a
permission fault and take the whole screen to the error boundary — and a posture is never a
fault (I-35).

- **Disarmed** (`data-armed="false"`, the M0 shipped answer): one body line,
  `audit_ledger_disarmed` / `audit_jobs_disarmed`, `var(--text-13)` `var(--graphite-600)`.
- **Armed** (`data-armed="true"`): the row count — `formatUserFigure(String(rowCount))` in
  `var(--font-mono)` `var(--text-24)` `var(--weight-heading)` `var(--graphite-900)`
  `tabular-nums slashed-zero` — over its caption `audit_ledger_count_caption` /
  `audit_jobs_count_caption` in `var(--text-12)` `var(--graphite-600)`. Nothing more: the
  ledger's columns and job detail are those increments' surfaces, not this slice's.

## 2. States (R-UI-050), ruled cell by cell

Declared in the enumerable home `states.ts` (route directory), export `AUDIT_STATES` — one
row, seven cells in the shell matrix's cell shape (rendered / delegated / impossible, each
naming its module, hook or reason); the held-out acceptance reflects over it.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the page's layout, gap
  `var(--space-3)` — 24 × 240 px (heading), 16 × 360 px (caption), a row of three 32 × 200 px
  bones (the filter controls), four 48 × min(1080 px, 100 %) bones (act entries), then a row
  of two 96 × min(520 px, 100 %) bones (the panels).
- **Empty** — the two-variant in-region block (§1, I-33); the fresh-project truth is that
  the log fills itself, the filtered truth carries the one clearing action.
- **Error** — a render or read fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned here); its Decision rules retry and records the report-id deferral.
- **Refusal** — delegated to the root error boundary: the screen performs no procedure and
  registers no code; its formatting goes through the seam, whose `PRECISION_NOT_APPLIED`
  throw on an inconsistent store is a read fault, not an answer (the I-28 class).
- **Partial** — impossible: one read, answered whole; no refusable rows. A disarmed panel
  is not a partial answer — it is the whole truthful answer (I-35).
- **Offline** — a fault of reachability (shell I-20): server-rendered read, failed
  navigation surfaces the error path; no invented banner, no data aging on screen.
- **Permission-denied** — delegated: `t/[tenant]/layout.tsx` renders the shell's frameless
  denial surface before this route mounts; unauthenticated is the `/sign-in` redirect.

## 3. Copy, verbatim (`strings.ts`, keys `audit_…`)

`audit_heading` **Audit** · `audit_caption` **Every act committed on this project, with its
consequence and the evidence it cited.** · `audit_acts_heading` **Act log** ·
`audit_filter_type_label` **Act type** · `audit_filter_actor_label` **Actor** ·
`audit_filter_subject_label` **Subject** · `audit_filter_any_type` **All act types** ·
`audit_filter_any_actor` **All actors** · `audit_count` **{shown} of {total} acts** ·
`audit_consequence_label` **Consequence** · `audit_evidence_label` **Cited evidence** ·
`audit_empty_none_heading` **No acts recorded yet** · `audit_empty_none_body` **Acts are
recorded here the moment they are committed anywhere in this project — there is nothing to
set up.** · `audit_empty_filtered_heading` **No acts match these filters** ·
`audit_empty_filtered_body` **Every act stays recorded — clear a filter to see the rest.** ·
`audit_empty_clear` **Clear filters** · `audit_ledger_heading` **Model ledger** ·
`audit_ledger_disarmed` **This installation does not record model calls yet, so there is
nothing to list. When it does, every call appears here with its cost and outcome.** ·
`audit_ledger_count_caption` **recorded model calls** · `audit_jobs_heading` **Jobs** ·
`audit_jobs_disarmed` **This installation does not run recorded background jobs yet, so
there is no history to list. When it does, every job appears here.** ·
`audit_jobs_count_caption` **recorded jobs**.

Voice: calm and concrete, no exclamation marks, no build vocabulary in prose — act types,
actor ids, subjects and digests are model data and render verbatim as data (I-25's class),
never woven into sentences.

## 4. Motion (R-UI-004)

Filtering is instant: rows appear and leave with no transition — a filter is an answer, not
theatre. The only motion is inherited from single homes: control border/colour over
`var(--motion-state)` `var(--ease)` (the select mirrors the Input's hover), Button hover,
the reticle draw, the Skeleton pulse. Sections and panels appear with no entrance. Every
duration is a token zeroed at source under reduced motion.

## 5. Tokens

`--graphite-0/50/100/300/400/600/700/900` · `--hairline` · `--space-1/2/3/4/6/8` ·
`--radius-4/8` · `--text-12/13/14/16/20/24` · `--font-mono` ·
`--weight-body-medium/--weight-heading` · `--motion-state/--ease`. Px literals, closed set
(core I-1's class): the 1080 px page measure, filter min-widths 180/240, the 96 px label
column, skeleton bones 24/16/32/48/96 × 240/360/200/1080/520, and the md media-query value.
Any other literal is a defect.

## 6. Themes

`audit.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). The panels' graphite-50 cards stand one step off the graphite-0
field, seamed by hairlines, in both themes (the shell's recorded light-end perceptual note
applies here too and has the same owner). Contrast holds on founder facts: graphite-600 and
700 on graphite-0 and graphite-50 ≥ 4.5:1, graphite-900 likewise, in both themes. No basis
colour, no semantic tint and no copper appears anywhere on this screen.

## 7. Test hooks (closed contract, C-05)

Route introduced: `/t/{tenantId}/p/{projectId}/audit`. Test ids, exactly the ten of the
contract, on the elements ruled in §1: `audit-acts` (the `<ol>`) · `audit-act-row` (each
`<li>`, `data-act-type`, `data-actor-id`) · `audit-act-consequence` · `audit-act-evidence`
· `audit-acts-empty` · `audit-filter-type` · `audit-filter-actor` · `audit-filter-subject`
· `audit-panel-model-ledger` · `audit-panel-jobs` (each `<section>`, `data-armed`). No
others are added; the clear-filters Button and the count line are found by role and name.

Behavioural hooks without new ids: newest-first document order of the rows; `role="status"`
on the count line; visible `<label for…>` on all three filters; the `<h1>`/`<h2>` hierarchy
per §1; `cx-reticle` on both selects, the Input and the Button.

Journey: `tests/e2e/audit.spec.ts`, titles carrying "J-003"; page object
`tests/e2e/pages/s-audit.page.ts`. It signs in with the fixture identity idempotently
(cubit_e2e is additive), reaches a fixed-name project by creating or reusing it, opens this
route, and at checkpoint `["s-audit", "explorer.png"]` passes axe (serious/critical = 0,
never widened) and matches the committed Linux baseline under
`tests/e2e/baselines/design/s-audit/**` (`toHaveScreenshot`, maxDiffPixelRatio 0.002) —
volatile regions masked: the shell breadcrumb (workspace name) and, defensively, the
occurred-at column's region should the reused project ever hold acts; the explorer itself is
deterministic (the fresh project's no-acts empty state, both panels `data-armed="false"`).
`GATE_JOURNEYS` in `tests/journeys/e2e-journey-tags-breaker.test.ts` is re-baselined to
`["J-000", "J-001", "J-003"]` (B-20), and `pnpm e2e --journey J-000` stays green. jsdom
acceptance mounts `ActLogExplorer` over fixture rows and drives all of AC-2's filter
behaviour; the live AC-5/AC-6 proofs drive `getAuditSurfaces` db-lane style through the
seam, never a driver.
