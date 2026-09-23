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
- **I-32 — the subject filter compares whole identifiers.** *Amended by I-38 (session 7): a
  person also finds a subject by the name the row shows for it, compared whole.* "Acts whose subjects include
  it" is array membership: an act matches when the trimmed entered value equals one of its
  subjects exactly. A subject is an identifier, and a fragment match would show an act as
  citing evidence the person did not name (the I-26 class: identifiers compare whole, never
  in part). A blank or whitespace-only entry is no filter. Since the evidence chips read by
  what a key names, a pasted key still matches itself whole, and a typed entry ALSO matches
  a subject whose presented name — or one whole fact of it, split at ` · ` — equals it,
  case-insensitively: "C1" finds `C1 · GF` and never `C10 · GF`, and "LAP" finds every lap
  note. A whole key a person must paste is a box nobody can use (R-UI-020); comparing facts
  whole keeps I-26's rule that nothing matches in part.
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
  *Amended (session 7):* the copy says only what the disarmed posture proves. Jobs DO run on
  an installation that ingests drawings — their event log is `cubit_jobs.job_events`, outside
  the tenant schema, and it carries no project column — so "this installation does not run
  recorded background jobs" was false on every project with a drawing (R-UI-020). The jobs
  panel's disarmed line now states the fact that holds: job history is not kept per project
  yet (`audit_jobs_disarmed`). Arming it on the job log, joined to a project through the job's
  key, is the jobs node's (C-SPINE-JOBS) — `AUDIT_PANEL_TABLES.jobs` is re-pointed there under
  B-20, never here.
- **I-37 — the model ledger reads itself: the outcome beside each call, and a calibration line
  per question (session 4's Jev programme; L-AI-01, L-AI-02, R-AI-005).** An armed ledger panel
  that holds rows no longer stops at a count. Beneath the count it lists the project's newest
  calls (the ledger's window, 200) as a DataTable v2 grid — call id through IdChip, the closed
  question the call put, model and transport, the OUTCOME as the ledger spelled it and then as a
  person did (`model_call_outcomes`: CONFIRMED, OVERRULED, REPUDIATED, AFFIRMED; a refused call
  shows its refusal code; a proposal nobody has judged reads `audit_ledger_outcome_awaiting`),
  the provider's confidence to three places, tokens in / out, cost, and the day — and beneath the
  grid one line per question read over the same rows: proposed, confirmed, overruled, repudiated,
  affirmed, awaiting, refused, and the mean confidence where a person agreed against where a
  person did not. The derivation is `src/core/model-calibration.ts` and nothing on this screen
  re-derives it (B-17). Why a grid here and a list for the log (I-36): a ledger row is fixed-height
  tabular data with numerals to right-align, which is what R-UI-005 binds a DataTable to. The panel
  with rows spans both columns (`cx-audit-panel-ledger`), because a nine-column grid in half a
  1080 px measure would ellipsise every cell; with no rows it keeps its half. The zero-row
  rendering is byte-identical to the one before this Interpretation, so the committed picture
  (a fresh project) did not move. An outcome is never written by this screen: it is a record the
  disposition writes or an act carries (L-ACT-01), and the screen stays a reader.
- **I-38 — the log is a 28 px grid, and its identifiers are IdChips (session 4, AM-08 Part 2's
  rubric as CLAUDE.md reads it; amends I-36 and I-26).** The act log is the screen's primary
  region and is measured as one: a DataTable v2 (`tableId` `audit-acts`, labelled by the section's
  `<h2>`) inside `<div data-testid="audit-acts" data-rows>`, columns **Act type**
  (`audit_col_type`, verbatim mono, 220) · **Actor** (`audit_col_actor`, the label, or an IdChip
  where the log names the actor by account id, 160) · **Occurred** (`audit_col_occurred`, the day
  per I-34, 120) · **Consequence** (`audit_consequence_label`, the digest as an IdChip carrying
  `audit-act-consequence`, 140) · **Cited evidence** (`audit_evidence_label`, one IdChip per
  subject on one line inside `audit-act-evidence`; a `scheme:key` subject shows its key as the
  measure, 360). Rows keep `audit-act-row` with `data-act-type` and `data-actor-id`; the filters,
  the count line and the empty block are unchanged. A digest or a subject is shown whole as the
  chip's value, on its tooltip and on the clipboard, never as body text; the screen drops the 1080 px
  page measure so the grid fills the work surface (§1 amended: `max-width: none`).

  *Amended in place (session 7, the craft look; R-UI-082/083/084, AM-08 — the later law, which wins
  over I-25 for this screen as S-Project's I-146 already ruled for the same field).* The look found
  identifiers as body text in three of five columns on every row, and the act type spelled two ways
  on two screens. So:
  - **Act type** (220) is the shipped `EnumLabel` (`cx-audit-act-type`, the UI face at
    `var(--weight-body-medium)`), not verbatim mono: "Author typical range", with the stored value
    kept on the row's `data-act-type` and in the primitive's `[data-technical]` disclosure. The
    Act-type filter's options are labelled in the same words (their VALUES stay the stored act
    types, so a choice is exact), and the select reads in the UI face whatever is chosen — the
    `cx-audit-select-mono` class is retired.
  - **Actor** (220) is the label the project's roster names the person by — the page reads the
    roster through `projectParticipants`' own guarded door and hands `getAuditSurfaces` its
    `people` (account id → address); an actor the roster cannot name (a refused reader, a person
    no longer attached, a digest-keyed account) is the IdChip of the id the log recorded. The Actor
    filter's options read the same label, or the id's short form.
  - **Cited evidence** (420) is `SubjectChips` (`subject-chips.tsx`, shared with S-Project): ONE
    presenter over the key schemes an act records, parsed in `src/modules/spine/audit/subjects.ts`
    and named from the store by `getAuditSurfaces` (`names`: level labels, drawing names, view
    captions, the roster). Each subject is still an IdChip whose VALUE is the whole key; its
    measure is what the key names — a placement `C1 · GF` (mark · level; an unresolved level says
    nothing), a note reading `LAP · S-02` (kind · sheet number), a storey-height reading its level,
    a view its caption, a sheet its number, a level INSERT_LEVEL proposed `Proposed level {n}`
    (`audit_subject_proposed_level`; the key carries the proposal's index and nothing else, so
    the screen does not guess which minted level it became), and a bare surrogate the level,
    drawing or person the store names by it. A key the presenter cannot read keeps the chip's own
    short form. At most three chips show; the rest fold into `+{count}` (`audit_subject_more`), a
    tab stop whose tooltip lists their names and which keeps each folded key in the DOM as a
    hidden `data-value` — ellipsis plus a count, never silent loss (R-UI-084). The cell clips with
    an ellipsis, never mid-glyph.
- **I-347 — the presenter reads what the log actually cites, and a row never shows one name twice
  (session 7, wave 3, the craft re-look; R-UI-082/083/084, B-17; amends I-38 as amended, and S-Project's
  I-146 through the shared `SubjectChips`).** The re-look found four rows of the M3 project's log
  that I-38's presenter did not read:
  - **A view in the partition's own spelling.** AFFIRM_SCALE and CONFIRM_VIEW_TYPE cite a view by
    the key the partition writes (`partitionViewKey`: `<CLASS>:<anchor source key>`, e.g.
    `DETAIL:DXF_HANDLE:2266`), not by L-REG-04's `v:`-prefixed identity key — which is the same key
    under the prefix (`viewAddressOf`). The parse knew only `v:`, so Affirm scale read
    `DETAIL:` `DETAIL:` `LAYOUT_` +7, and `subjects.ts` said in its own comment that those acts cite
    `v:` — a second spelling of one fact. `parseSubject` now reads both spellings as one view whose
    `viewKey` is the PARTITION's (the key `partition_views` holds its caption under), recognised by
    shape — a SCREAMING class, then a SCREAMING source-key scheme and its id — as the `v:` key always
    was, because the vocabulary's one home is a module this client-side parse may not reach
    (ARCH-01). `names.views` is keyed the same way, so the caption read by `getAuditSurfaces` now
    names the `v:` spelling too (it had asked the store by a key the store never holds). A bare
    source key (`DXF_HANDLE:2A0`) is not a view and stays opaque.
  - **Model space.** A CONFIRM_DISCIPLINE sheet key whose layout is the artifact's name for model
    space (`model`, `vextrus_cad.ingest.MODEL_SPACE`) carries no sheet number; it reads
    `audit_subject_model_space` **Model space**, not the lower-case layout name beside `S-03`.
  - **One name, many subjects.** AUTHOR_TYPICAL_RANGE cites a placeholder per placement, at the
    unresolved level slot, so each reads by its mark alone and the row read `C1 · C1 · C1 +24` —
    three chips a reader cannot tell apart, which read as a rendering bug (on S-Project's Recent
    activity too). Subjects that READ the same are grouped, in the order each name is first cited,
    into ONE chip reading `audit_subject_repeated` **{name} ×{count}** (`C1 ×9`). The chip's value —
    its tooltip and its copy — is the first key it stands for; every other key it folds stays in the
    DOM beside it as a hidden `data-value`, as the `+k`'s do. The cap of three counts NAMES; the `+k`
    counts the SUBJECTS past it (as `data-count` does) and its tooltip lists the names with their
    counts.
  - **A chip cut mid-glyph.** `text-overflow` on the evidence box did nothing to a row of inline-flex
    chips: Insert level read `Proposed level 1 · Proposed level 2 · Proposed le` with no ellipsis.
    Inside these chips alone the IdChip's measure is a one-line block that ends in an ellipsis
    (`subject-chips.css`); a name is capped at 24 characters so two chips and the count stand whole
    in the narrowest cell the rubric reads (this column at 1280, 484 px); and the LAST chip shown
    (`cx-subject-chip-tail`) is the one that gives up width when a cell is short, down to its copy
    target and a glyph or two. The count never shrinks.
  - **Cited evidence takes the band.** At 420 the column stopped ~230 px short of a header that runs
    to the grid's edge while its third chip was cut; it is the log's last column and now takes the
    width the four before it leave (`audit.css`), 420 being its floor (s-home I-140 as amended, the
    same reading of the band).
- **I-36 — the log is a list, not a DataTable and not a fixed-height table.** *Amended by I-38.* No sort, no
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

The page renders in `shell-main`, one column `cx-audit`: no page measure (I-38 — the act log is the
screen's primary grid and fills the work surface), column flex, `gap: var(--space-6)`. Rail and breadcrumb are the shell's, per I-30: `areaOf` reads this
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
  replaced element hosts no `::after`). *Amended by I-38 (session 7):* the control reads in
  the UI face throughout — `.cx-audit-select-mono` is retired, because an act type is read in
  words now and not as a source key. First option `audit_filter_any_type`, value empty; then
  the distinct `actType`s of the given rows, code-point order of the value, each labelled by
  the words its row's `EnumLabel` reads and valued by the stored act type.
- **Actor** — `<select data-testid="audit-filter-actor">`, same chrome, always in
  `var(--font-ui)` (an actor label is prose, not a source key). First option
  `audit_filter_any_actor`; then the distinct actors, option label `actorLabel` (the
  roster's label, or the recorded id's short form — I-38), option value `actorId`.
- **Subject** — the core Input, `data-testid="audit-filter-subject"`, width 240 px,
  labelled `audit_filter_subject_label`, no placeholder (the s-auth ruling). Matching per
  I-32 as amended — a pasted key whole, or a chip's presented name or one whole fact of it —
  conjunctive with both selects.
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
  `audit_jobs_count_caption` in `var(--text-12)` `var(--graphite-600)`. Job detail is that
  increment's surface, not this slice's.
- **Armed with rows, the model ledger only** (I-37; `data-rows` > 0 on the section, which takes
  `cx-audit-panel-ledger` and spans both columns): after the count and caption, `<div
  class="cx-audit-ledger">` — column flex, `gap: var(--space-3)`, `margin-top: var(--space-2)`:
  - `<div data-testid="audit-ledger-grid" data-rows>` holding a DataTable v2 (`tableId`
    `audit-ledger`, labelled by the panel's `<h2>`; max-height 360 px, scrolls within): columns
    **Call** (`audit_ledger_col_call`, IdChip short, 120) · **Question**
    (`audit_ledger_col_question`, the question name verbatim in mono, 150) · **Model**
    (`audit_ledger_col_model`, mono, 150) · **Transport** (`audit_ledger_col_transport`,
    EnumLabel, 100) · **Outcome** (`audit_ledger_col_outcome`, 180: EnumLabel of the person's
    newest outcome; else EnumLabel of the refusal code where the ledger's outcome is `refused`;
    else `audit_ledger_outcome_awaiting` in `var(--ink-muted)`) · **Confidence**
    (`audit_ledger_col_confidence`, right, mono, three places, `audit_ledger_no_confidence` where
    none, 110) · **Tokens in / out** (`audit_ledger_col_tokens`, right, mono, 140) · **Cost**
    (`audit_ledger_col_cost`, right, mono, `formatUserFigure`, 110) · **Called**
    (`audit_ledger_col_called`, the day per I-34, mono, 120). Each row
    `data-testid="audit-ledger-row"` carries `data-call`, `data-question`, `data-judged`.
  - `<dl data-testid="audit-ledger-calibration" class="cx-audit-calibration">`: `<dt>`
    `audit_ledger_calibration_heading` (`var(--text-13)` `var(--weight-body-medium)`
    `var(--ink)`), then one `<dd data-testid="audit-ledger-calibration-line" data-question>` per
    question in code-point order — flex, wrap, baseline, `gap: var(--space-2) var(--space-3)`,
    `var(--text-12)` `var(--ink-muted)`: the question name in mono `var(--ink)`, the counts
    sentence `audit_ledger_calibration_counts` (every figure through `formatUserFigure`), then the
    confidence clause: `audit_ledger_calibration_confidence` where both means exist,
    `audit_ledger_calibration_confidence_partial` where one does,
    `audit_ledger_calibration_no_confidence` where none.

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
`audit_col_type` **Act type** · `audit_col_actor` **Actor** · `audit_col_occurred` **Occurred** ·
`audit_consequence_label` **Consequence** · `audit_evidence_label` **Cited evidence** ·
`audit_subject_proposed_level` **Proposed level {n}** · `audit_subject_model_space` **Model
space** (I-347) · `audit_subject_repeated` **{name} ×{count}** (I-347) · `audit_subject_more`
**+{count}** ·
`audit_empty_none_heading` **No acts recorded yet** · `audit_empty_none_body` **Acts are
recorded here the moment they are committed anywhere in this project — there is nothing to
set up.** · `audit_empty_filtered_heading` **No acts match these filters** ·
`audit_empty_filtered_body` **Every act stays recorded — clear a filter to see the rest.** ·
`audit_empty_clear` **Clear filters** · `audit_ledger_heading` **Model ledger** ·
`audit_ledger_disarmed` **This installation does not record model calls yet, so there is
nothing to list. When it does, every call appears here with its cost and outcome.** ·
`audit_ledger_count_caption` **recorded model calls** · `audit_jobs_heading` **Jobs** ·
`audit_jobs_disarmed` **Job history is not kept per project yet, so none is listed here.**
(I-35 as amended) ·
`audit_jobs_count_caption` **recorded jobs** · `audit_ledger_col_call` **Call** ·
`audit_ledger_col_question` **Question** · `audit_ledger_col_model` **Model** ·
`audit_ledger_col_transport` **Transport** · `audit_ledger_col_outcome` **Outcome** ·
`audit_ledger_col_confidence` **Confidence** · `audit_ledger_col_tokens` **Tokens in / out** ·
`audit_ledger_col_cost` **Cost** · `audit_ledger_col_called` **Called** ·
`audit_ledger_outcome_awaiting` **Awaiting a person** · `audit_ledger_no_confidence` **—** ·
`audit_ledger_calibration_heading` **Calibration by question** ·
`audit_ledger_calibration_counts` **{proposed} proposed · {confirmed} confirmed · {overruled}
overruled · {repudiated} repudiated · {affirmed} affirmed · {awaiting} awaiting a person ·
{refused} refused** · `audit_ledger_calibration_confidence` **Confidence {right} when a person
agreed, {wrong} when a person did not.** · `audit_ledger_calibration_confidence_partial`
**Confidence {stated} where a person has judged; the other side has no figure yet.** ·
`audit_ledger_calibration_no_confidence` **No judged call stated a confidence.**

Voice: calm and concrete, no exclamation marks, no build vocabulary in prose — digests and
subject keys are model data and stay whole as data (I-25's class), never woven into
sentences; an act type is read in words and a subject by what its key names (I-38 as
amended).

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

Route introduced: `/t/{tenantId}/p/{projectId}/audit`. Test ids, exactly the fourteen of the
contract — C-05's ten and the ledger's four (I-37) — on the elements ruled in §1: `audit-acts`
(the `<ol>`) · `audit-act-row` (each `<li>`, `data-act-type`, `data-actor-id`) ·
`audit-act-consequence` · `audit-act-evidence` · `audit-acts-empty` · `audit-filter-type` ·
`audit-filter-actor` · `audit-filter-subject` · `audit-panel-model-ledger` · `audit-panel-jobs`
(each `<section>`, `data-armed`; the ledger's also `data-rows`) · `audit-ledger-grid`
(`data-rows`) · `audit-ledger-row` (`data-call`, `data-question`, `data-judged`) ·
`audit-ledger-calibration` · `audit-ledger-calibration-line` (`data-question`). No others are
added; the clear-filters Button and the count line are found by role and name.

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
