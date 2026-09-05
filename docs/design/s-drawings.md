# Design Decision — S-Drawings (the project's sheet index)

Route: `/t/{tenantId}/p/{projectId}/drawings` under
`src/app/(app)/t/[tenant]/p/[project]/drawings/**`, inside the shell frame and behind the
membership guard in `t/[tenant]/layout.tsx`. Increment inc-108-sheet-index. Law: R-TO-004,
R-TO-001, L-ACT-01/02, L-REG-03, L-AI-03, R-UI-001/003/004/005/011/012/020/021/023/024/031/
050/060, X-1, J-010, B-17, B-19, B-20, Q-11, Q-17. Every convention of the earlier Decisions
binds: `cx-` classes, tokens-only colour and motion, `cx-reticle` solely from its single
home, no `[data-theme]` selector in authored CSS; Interpretations I-1–I-82 remain in force
("workspace" is the user-facing word for tenant, s-auth I-11; copy lives in `strings.ts`
beside the page, s-settings-ruleset I-24; machine identifiers render verbatim in mono, I-25;
identifiers render whole, I-26; the rail states the area, I-30). Chrome comes only from
shipped primitives and patterns — core Input, Button, Badge, Chip, Skeleton; the one
Dropzone; the one OfferedGroups; the one ConsequenceDialog; the one RefusalState — plus the
`cx-drawings-*` classes this file rules. Copy lives in `strings.ts` beside the page (keys
`drawings_…`); JSX carries no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-83 — a proposal basis is not an R-UI-002 basis.** `GRAMMAR` / `NONE` / `CONFIRMED` say
  who judged this sheet's discipline, not how a quantity was obtained. No BasisChip, no basis
  colour and no basis glyph appears on this screen: adopting that palette would teach that
  `GRAMMAR` is a peer of `MEASURED`. The cell publishes `data-basis` for machines and one
  plain sentence for people (§3).
- **I-84 — the single-sheet chooser offers every discipline, with the proposal
  preselected.** L-REG-03 makes discipline machine-proposed, human-confirmed, failing closed:
  a sheet the grammar read wrongly, or could not read at all (basis `NONE`), must still be
  confirmable or it can never be measured. The `SHEET` key carries a discipline, so the offer
  test is "carried by a current record and unconfirmed"; the value is the person's judgement
  inside the closed enum, and nothing is overwritten — the proposal is not stored, and the
  confirmation is an append-only row with its own act (L-ACT-01). Bulk stays offered, never
  assembled: a group of one is still a typed key with server-resolved membership, and no
  multi-select exists anywhere on the screen. A confirmed sheet renders no chooser.
- **I-85 — every fidelity fact renders, zeros included.** A fact suppressed at zero would
  make "no badge" mean both "nothing was lost" and "this build forgot the fact". All five
  `FIDELITY_FACTS` names render on every card; a non-zero or true fact adds
  `data-notable="true"` and a warn border — a second channel behind the number, which is the
  primary one (refusal-state I-9). No danger colour: a truncation is a fact, not a failure.
- **I-86 — the group sentence is composed here; the module answers a name.**
  `OfferedGroup.label` is the subject's *name* — the drawing's stored file name for a
  `PROPOSED_DISCIPLINE` key, the sheet's proposed title for a `SHEET` key — and this screen
  fills `drawings_group_label_discipline` / `_sheet` with it and the key's discipline. A
  module writing sentences would put user copy where no string table reaches it (I-24).
- **I-87 — the thumbnail element always renders; a missing raster is shown, not hidden.**
  `thumbnail` is null until the raster job lands, so the card renders the same box either way
  — `<img>` with a tier, else a placeholder carrying `data-pending="true"` and one line. The
  grid does not reflow as rasters arrive, and R-UI-050's partial cell is real per card.
- **I-88 — the second timeline step is asked for, never invented.** The worker chains
  thumbnails after a record lands, so the browser never holds that job id. When the ingest
  step succeeds the screen calls `requestThumbnailsFor` for that drawing and adds the
  answered job as the next step; `deduplicated: true` is the normal answer — the worker got
  there first — and is not reported as anything. A client-side job id would subscribe to a
  stream that does not exist.
- **I-89 — the offline banner over a live queue (paying the dropzone Decision's IOU).** This
  is the first screen with a live transfer queue and a live job stream. Offline is entered
  when `navigator.onLine` is false (`online`/`offline` events) or both event transports have
  failed; the banner stands at the top of the upload region. The Dropzone stays armed — the
  protocol resumes from the last acknowledged offset, so a frozen row beats a disarmed door —
  and "read-only" binds the acts: a confirm door pressed offline opens no dialog and renders
  the local notice, because a preview from a server that cannot be reached is not a preview.
- **I-90 — permission-denied is in-frame, read-only, and still tells the truth.** Reading the
  index needs workspace membership; confirming needs `MEASURE`. A member without it keeps the
  whole index and the whole group list — knowledge is not permission, and hiding the groups
  would hide what the project is waiting for — while the choosers and `sheet-confirm` do not
  render (a control that can only refuse is theatre, participants I-50). One banner
  `PERMISSION_NOT_HELD` names the permission and its holders from first paint; a group door
  pressed answers that same registered refusal in the region's slot, and stays armed.
- **I-91 — an empty index always says which emptiness it is.** Three causes, one element:
  `no-drawings`, `awaiting-ingest` (drawings stored, no current record yet), `no-match`.
  Silence never happens (R-UI-020), and only the last carries an action — nothing a person
  presses makes an ingest finish sooner (the S-Audit I-33 reading).
- **I-92 — the timeline's motion is the state change, and its timings are whole seconds.**
  X-1 asks the timeline to animate; R-UI-004 bans spinners and bounce. Marker colour, status
  colour and the connector transition over `var(--motion-state)`, and a `running` step holds
  a core Skeleton in its timing cell until a duration exists — the pulse comes from its
  single home and stops the moment a real number does. SEAM-FORMAT has no duration rendering
  (the S-Audit I-34 class), so a timing is elapsed whole seconds through `formatUserFigure`
  with the unit as copy; recorded IOU, owner `src/core/format`'s node. Cards mount with no
  entrance: sheets fanning out are an answer, and X-1's honesty is the answer arriving.
- **I-93 — cited entity keys render whole.** `cited` is the evidence for the proposal
  (R-TO-004, L-AI-03), and evidence is shown whole, wrapping, select-all (S-Audit I-26),
  never truncated behind a "+3 more". No test id of its own: the contract is closed, and the
  line is found by its class inside `sheet-card`.
- **I-94 — search folds case and matches fragments; the filter reads the effective
  discipline.** A title is prose, so a fragment match is right (unlike S-Audit I-32, where a
  whole identifier was the point): `toLowerCase()`-folded substrings of the two lines the card
  publishes as its name — the proposed title and the sheet number — and of nothing a reader
  cannot see (the layout name is the sheet id's tail, not a heading, and matching it would
  narrow to cards whose visible words do not hold the text); blank or whitespace-only is no
  filter; no `Intl`, no `localeCompare`. The chips compare the confirmed discipline where a sheet has one and the
  proposed one otherwise — the same value the card publishes as `data-discipline`.

Recorded IOU — visible navigation (R-UI-031), owner: the node owning the shell's project
navigation (the S-Audit and participants precedent, unpaid). Until it lands the route is
journey- and URL-reachable, and `drawingsRoute()` in `route-address.ts` is its one address.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments,
calls `sheetIndexOf` and `offeredGroupsOf` from `src/modules/takeoff/sheets`, resolves the
actor's `MEASURE` standing, renders the sections), `sheet-index.tsx` (client `SheetIndex` —
search, filter, cards, groups, dialog handoff — mountable under jsdom with injected data and
perform), `sheet-card.tsx`, `job-timeline.tsx`, `actions.ts`, `route-address.ts`,
`loading.tsx`, `states.ts` (§2), `strings.ts`, `drawings.css`. A segment that is no uuid
names no project and is judged before any query (the shell's `scopedTenantId` precedent):
the module answers an empty index.

The page renders in `shell-main`, one column `cx-drawings`: max-width `var(--breakpoint-lg)`,
column flex, gap `var(--space-6)`. Rail and breadcrumb are the shell's (I-30). Header block
(`gap: var(--space-2)`): `<h1>` `drawings_heading` — `var(--text-20)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0 — over `drawings_caption`,
`var(--text-13)` `var(--graphite-600)`.

### Add drawings (`<section aria-labelledby>`)

`<h2>` `drawings_upload_heading` (`var(--text-16)` `var(--weight-heading)`), hint
`drawings_upload_hint` (`var(--text-12)` `var(--graphite-600)`); then, while offline (I-89),
`<div class="cx-drawings-offline" role="status">` with `drawings_offline` in the house notice
chrome (`var(--warn-surface)` fill, `var(--hairline)` re-keyed `border-color: var(--warn)`,
radius `var(--radius-4)`, padding `var(--space-3)` `var(--space-4)`, `var(--text-13)`
`var(--graphite-900)`), region width. Then the one Dropzone, its own Decision ruling
everything inside it. A row reaching `stored` hands its drawing id to `requestSheetsFor`;
the answered jobs open the timeline.

Directly below the Dropzone, the region's **answer slot** `<div class="cx-drawings-answer">`
(no test id; the contract is closed), the same slot chrome the offered-groups region uses:
exactly one RefusalState, carrying the code `requestSheetsFor` or `requestThumbnailsFor`
answered with. A stored drawing the seam refuses to read enqueues no job, so it takes no
timeline step, and a row that will never be read may not be answered with silence
(R-UI-020) — the refusal belongs beside the queue whose row produced it rather than beside
the confirm doors, which is why this region has a slot of its own.

### The job timeline (R-UI-024, inline where it was started)

**Superseded by `docs/design/job-timeline.md` (inc-112-job-timeline, I-107).** The region below is
now the shared job pattern — `src/ui/patterns/job-timeline` — rendered by this screen rather than
drawn by it: the ids, data attributes, marker, connector, timings and transports are that Decision's
§§ 1–2 verbatim, its stylesheet is `job-timeline.css` (`cx-job-timeline-*`), and the step, status,
idle, seconds and transport-lost copy left `drawings/strings.ts` for
`src/ui/strings/job-timeline.ts`. What stays this screen's own: the heading
(`drawings_timeline_heading`), the evidence a step resolves at
(`{ href: drawingsRoute(…), label: drawings_evidence_upload_again }`), the I-88 chain through
`useTrackedJobs`' `onSucceeded`, and `awaiting` — set until a `thumbnails` step is among the steps,
which is how the `done` rule below is kept (job-timeline I-109). The paragraphs that follow record
the region as this screen shipped it and are read as history, not as a second ruling.

`<section data-testid="job-timeline" data-state="idle|running|done|failed"
aria-labelledby>`: `<h2>` `drawings_timeline_heading`, then `<ol class="cx-drawings-steps">`
(list-style none, margin 0, padding 0). `data-state` is derived — `failed` if any step
failed or was refused, `done` when every step is `succeeded` and a `thumbnails` step is among
them, `running` while any step is live, else `idle`, which renders `drawings_timeline_idle`
(`var(--text-13)` `var(--graphite-600)`) and no steps.

Each `<li data-testid="job-timeline-step" data-kind={jobKind} data-status="queued|running|
succeeded|failed|refused">`: grid `auto 1fr auto`, gap `var(--space-3)`, min-height
`var(--row-comfortable)`, re-keyed `var(--row-compact)` under an ancestor
`[data-density="compact"]` (the dropzone I-75 mechanism).

- **Marker** — an 8 px round dot, `var(--graphite-300)` queued, `var(--beam-500)` running,
  `var(--success)` succeeded, `var(--danger)` failed and refused, with a 1 px connector to
  the next step in `var(--graphite-200)` re-keyed `var(--success)` once the step above has
  succeeded. `aria-hidden`: the status word carries the meaning.
- **Name** — the kind through the string table's total map over `JOB_KINDS`
  (`drawings_step_ingest` / `_thumbnails` / `_probe`), `var(--text-13)`
  `var(--graphite-900)`; the raw kind stays on `data-kind`.
- **Status and timing** — the status word (`drawings_status_…`, `var(--text-12)`
  `var(--weight-body-medium)`, `aria-live="polite"`, colour matching the marker), then the
  timing per I-92 in `var(--font-mono)` `var(--text-12)` `var(--graphite-600)` `tabular-nums
  slashed-zero`; while `running` a 12 × 64 px core Skeleton stands in the timing's place.
- **A failed or refused step** renders exactly one RefusalState below its row when the job's
  terminal answer carries a registered code, evidence `{ href: drawingsRoute(…), label:
  drawings_evidence_upload_again }`.

Transports: `EventSource` on `/api/events?jobId={jobId}`, falling back to
`…&transport=poll`; when both fail the list keeps its last known statuses and
`drawings_timeline_transport_lost` renders under it (`var(--text-12)` `var(--graphite-600)`,
`role="status"`). Each transition to `succeeded` refreshes the server data, so cards fan out
when the record lands and thumbnails appear when the rasters do.

### Sheets (`<section aria-labelledby>`)

`<h2>` `drawings_sheets_heading`, hint `drawings_sheets_hint`. Then, for a reader without
`MEASURE` (I-90): `<p>` `drawings_denied_permission` and `<p>` `drawings_denied_holder`
(`var(--text-13)` `var(--graphite-700)`, gap `var(--space-2)`) over one banner-surface
RefusalState from the registered `PERMISSION_NOT_HELD`, evidence `{ href: the project's
participants route, label: drawings_evidence_participants }`.

**Controls row** — flex, wrap, gap `var(--space-3)`, align-items end, `padding-block-end
var(--space-2)` so the reticle a focused field draws 4 px outside its box (R-UI-012) never
meets the line below the row:

- **Search** — the core Input, `data-testid="sheet-search"`, width 240 px, visible
  `<label for…>` `drawings_search_label` (`var(--text-13)` `var(--weight-body-medium)`
  `var(--graphite-700)`), no placeholder (the s-auth ruling); matching per I-94.
- **Discipline** — a `<fieldset>` (legend `drawings_filter_legend`, styled as the field
  label) of shipped interactive Chips (participants I-48), one
  `data-testid="sheet-filter-option"` per option with `data-value`: `ALL` first, label
  `drawings_filter_all`, then the five `DISCIPLINES` in declared order, each rendering its
  enum value verbatim in `var(--font-mono)` (I-47). Exactly one `aria-pressed="true"`; `ALL`
  by default.
- **Count line** — `<p role="status">`, `margin-left: auto`, `align-self: center`:
  `drawings_sheet_count` filled with `{shown}` and `{total}` through `formatUserFigure`,
  `var(--text-12)` `var(--graphite-600)` `tabular-nums`.

**Offered groups** — hint `drawings_groups_hint` (`var(--text-12)` `var(--graphite-600)`),
then the one OfferedGroups holding every group `offeredGroupsOf` answered, `label` composed
per I-86 and `count` `drawings_group_count` filled through `formatUserFigure`; its Decision
rules everything inside it. Directly below, the region's **answer slot**
`<div class="cx-drawings-answer">` (no test id; the contract is closed): exactly one
RefusalState, or the `role="alert"` notice `drawings_offline_notice` in the house alert
chrome when a door was pressed offline (I-89).

**The grid** — `<div data-testid="sheet-index">`, `display: grid`,
`grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr))`, gap
`var(--space-4)`, `align-items: start`. One `<article data-testid="sheet-card"
data-sheet={sheetId} data-discipline={effective} data-confirmed="true|false">` per card in
the module's layout-inventory order: fill `var(--graphite-50)`, border `var(--hairline)`,
radius `var(--radius-8)`, padding `var(--space-3)`, column flex, gap `var(--space-2)`.

- **Thumbnail** (I-87) — `aspect-ratio: 4 / 3`, fill `var(--graphite-100)`, border
  `var(--hairline)`, radius `var(--radius-4)`, `object-fit: contain`:
  `<img data-testid="sheet-card-thumbnail" data-pending="false">` with the `thumb` tier url,
  its intrinsic `width`/`height` and `alt` = `drawings_thumbnail_alt` filled with the
  proposed title; pending, a `<div data-testid="sheet-card-thumbnail" data-pending="true">`
  centring `drawings_thumbnail_pending`, `var(--text-12)` `var(--graphite-600)`.
- **Title** — `<h3 data-testid="sheet-card-title">`, `var(--text-13)`
  `var(--weight-body-medium)` `var(--graphite-900)`, wrapping.
- **Number** — `<p data-testid="sheet-card-number">`: the number verbatim in
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero`, or
  `drawings_number_none` in `var(--font-ui)` `var(--graphite-600)` when null — prose for
  absence, never a dash (the consequence-dialog `none` precedent).
- **Badges** — flex, gap `var(--space-2)`: the shipped Badge twice,
  `data-testid="sheet-card-format"` and `"sheet-card-scheme"`, content the stored value
  verbatim in `var(--font-mono)` (`dxf`, `DXF_HANDLE` — the extractor's own words, never
  up-cased, I-25), each carrying `aria-label` `drawings_format_label` /
  `drawings_scheme_label` filled with that value so its kind is spoken.
- **Discipline cell** — `<p data-testid="sheet-card-discipline" data-basis="GRAMMAR|NONE|
  CONFIRMED">`: the effective discipline verbatim, `var(--font-mono)` `var(--text-13)`
  `var(--weight-body-medium)` `var(--graphite-900)`, then the basis sentence
  (`drawings_basis_grammar` / `_none` / `_confirmed`), `var(--text-12)`
  `var(--graphite-600)` (I-83). Under it, when `cited` is non-empty,
  `<p class="cx-drawings-cited">`: label `drawings_cited_label`, then every key whole,
  wrapping, `user-select: all`, `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`
  (I-93).
- **Scale and views** — `<p data-testid="sheet-card-scale" data-scale={state}>` carrying
  `drawings_scale_unaffirmed` / `_affirmed` / `_unplaceable`, and `<p
  data-testid="sheet-card-views" data-views={count ?? ""}>` carrying
  `drawings_views_unclassified` when null, else `drawings_views_count` through
  `formatUserFigure`. Both `var(--text-12)` `var(--graphite-700)`.
- **Fidelity facts** — flex, wrap, gap `var(--space-2)`: one `<span data-testid="sheet-fact"
  data-fact={name} data-value={String(value)} data-notable="true|false">` per name of
  `FIDELITY_FACTS` in declared order (I-85): fill `var(--graphite-0)`, border
  `var(--hairline)`, radius `var(--radius-4)`, padding-inline `var(--space-2)`; the label
  (`drawings_fact_…`) `var(--text-12)` `var(--graphite-700)`, then the value —
  `formatUserFigure` for a number, `drawings_fact_yes` / `_no` for a boolean — in
  `var(--font-mono)` `var(--graphite-900)` `tabular-nums slashed-zero`. Notable facts re-key
  the border to `var(--warn)`.
- **Confirm block** — only on an unconfirmed card for a reader holding `MEASURE` (I-84,
  I-90): a `<fieldset>` (legend `drawings_confirm_legend`) of five Chips,
  `data-testid="sheet-discipline-option"` with `data-value`, the proposal preselected; then a
  core secondary Button `data-testid="sheet-confirm"`, label `drawings_sheet_confirm`,
  `align-self: start`; below it the card's own answer slot holding exactly one RefusalState
  when this door was refused.

**Empty** (I-91) — in the grid's place, `<div data-testid="sheets-empty"
data-cause="no-drawings|awaiting-ingest|no-match">`: column flex, gap `var(--space-2)`,
padding-block `var(--space-6)`, border-top `var(--hairline)`; heading line `var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-900)` over a body line `var(--text-13)`
`var(--graphite-600)`. `no-match` sets one more line between them (`var(--text-13)`
`var(--graphite-700)`) naming the filter it is empty under — `drawings_empty_no_match_search`,
`drawings_empty_no_match_discipline` or `drawings_empty_no_match_both`, the searched text
verbatim and the chipped discipline as the enum data it is — because an empty index that does
not name its own filter reads as "this project has no sheets". Only `no-match` adds an action:
a core ghost Button
`drawings_empty_clear` clearing search and filter in place and moving focus to the search
field as it unmounts itself (the S-Audit precedent — a control that deletes its own focus
target drops a keyboard reader to `<body>`).

**Confirming** — a `sheet-confirm` or `offered-group-confirm` press judges offline first
(I-89), then awaits `previewConfirmDiscipline` (participants I-49: refusals before open
belong to the screen). A refusal renders as one RefusalState in the pressed door's answer
slot — `GROUP_NOT_OFFERED` evidence `{ href: drawingsRoute(…), label:
drawings_evidence_reload }`, `PERMISSION_NOT_HELD` evidence the participants route,
`SIGNED_OUT` `{ href: "/sign-in", label: shell_evidence_sign_in }` — and no dialog opens on
nothing. A consequence opens the one ConsequenceDialog (`actType: "CONFIRM_DISCIPLINE"`,
injected `preview`/`commit` closing over the group key, rendering through the shipped
`SUBJECTS` arm: one row per sheet, before `none`, after the discipline). While the pre-check
is in flight the pressed door takes core's loading state and the status line
`<p role="status" aria-live="polite">` below the answer slot reads
`drawings_confirm_pending`. On `onCommitted` the dialog closes, focus returns per the
primitive, the screen refreshes — the confirmed cards and the emptied group are the visible
answer, no toast — and the status line reads `drawings_confirm_committed`. Every door stays
armed after a refusal.

## 2. States (R-UI-050), ruled cell by cell

Declared in `states.ts`, export `DRAWINGS_STATES` — one row, seven cells in the shell
matrix's cell shape (rendered / delegated / impossible, each naming its module, hook or
reason); `tests/screen-states/matrix.test.ts` reflects over it.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout, gap
  `var(--space-3)` — 24 × 240 px (heading), 16 × 360 px (caption), 160 × min(720 px, 100 %)
  (upload region), two 32 × 200 px (controls), six 220 × min(280 px, 100 %) card bones in the
  grid's own columns. Never a spinner (R-UI-004).
- **Empty** — `sheets-empty` with its three causes (I-91); the Dropzone's empty queue is its
  own Decision's.
- **Error** — a render, read or action fault surfaces the root error boundary
  (`src/app/error.tsx`), whose Decision rules retry and the report id. A failed job is not an
  error state of the screen: it is a `failed` step with its named refusal.
- **Refusal** — the three answer slots (the upload region's, the offered-groups region's and
  the card's) and, once the dialog holds focus, its slot and stale notice. Reachable codes:
  `GROUP_NOT_OFFERED`, `PERMISSION_NOT_HELD`, `CONSEQUENCES_NOT_CARRIED` (the dialog's stale
  re-render, never a card), `ACT_CHANGES_NOTHING`, `SIGNED_OUT`, the request codes of the
  upload region's slot — `WORKSPACE_PERMISSION_NOT_HELD`, `SHEET_NOT_INGESTABLE`,
  `RASTER_NOT_AVAILABLE` — the Dropzone's five row codes, and any registered code
  a job answers. Each renders in place with message, remedy and evidence.
- **Partial** — rendered, never hidden: a record that dropped layouts still yields cards for
  the layouts it carried and says so through `dropped_layouts` (I-85); a card whose raster
  has not landed shows the pending thumbnail (I-87); a drawing with no current record is
  named by the `awaiting-ingest` cause rather than silently absent.
- **Offline** — the I-89 banner over the live queue and the local notice on any act door;
  the timeline keeps its last known statuses and says live progress stopped arriving.
- **Permission-denied** — the I-90 in-frame branch naming `MEASURE` and its holders; a
  workspace the session does not hold is the shell's frameless denial before this route
  mounts; unauthenticated is the `/sign-in` redirect.

## 3. Copy, verbatim (`strings.ts`, keys `drawings_…`)

`drawings_heading` **Drawings** · `drawings_caption` **Every sheet this project holds, as
the extractor read it. A sheet is measured only after its discipline is confirmed.** ·
`drawings_upload_heading` **Add drawings** · `drawings_upload_hint` **A stored drawing is
read straight away. The steps below report how far that has got.** ·
`drawings_timeline_heading` **Reading drawings** — the timeline's other copy (the idle line, the
step and status words, the seconds and the transport-lost sentence) moved to
`src/ui/strings/job-timeline.ts` with the pattern and is fixed by
`docs/design/job-timeline.md` § 4 (I-107). · `drawings_sheets_heading` **Sheets** · `drawings_sheets_hint`
**Sheet numbers, titles and disciplines are read from each title block. Confirm a discipline
from a group the product offers — there is no select-all.** · `drawings_search_label`
**Search sheets** · `drawings_filter_legend` **Discipline** · `drawings_filter_all` **All
disciplines** · `drawings_sheet_count` **{shown} of {total} sheets** · `drawings_groups_hint`
**Confirmation is offered as groups the product names. A group is confirmed exactly as it is
named.** · `drawings_group_label_discipline` **{discipline} proposed from the title block on
{subject}** · `drawings_group_label_sheet` **{discipline} proposed for {subject}** ·
`drawings_group_count` **{count} sheets** · `drawings_thumbnail_alt` **Sheet preview of
{sheet}** · `drawings_thumbnail_pending` **Preview not drawn yet** · `drawings_number_none`
**No sheet number** · `drawings_format_label` **File format {value}** ·
`drawings_scheme_label` **Source scheme {value}** · `drawings_basis_grammar` **Read from the
title block** · `drawings_basis_none` **No title-block text to read** ·
`drawings_basis_confirmed` **Confirmed** · `drawings_cited_label` **Cited entities** ·
`drawings_scale_unaffirmed` **Scale not affirmed** · `drawings_scale_affirmed` **Scale
affirmed** · `drawings_scale_unplaceable` **Scale unplaceable — this layout carries no extent
or no drawing units** · `drawings_views_unclassified` **Views not classified yet** ·
`drawings_views_count` **{count} views** · `drawings_fact_strays_rejected` **Strays
rejected** · `drawings_fact_explode_truncated` **Explode truncated** ·
`drawings_fact_explode_losses` **Explode losses** · `drawings_fact_flatten_capped` **Flatten
capped** · `drawings_fact_dropped_layouts` **Dropped layouts** · `drawings_fact_yes` **yes**
· `drawings_fact_no` **no** · `drawings_confirm_legend` **Discipline to confirm** ·
`drawings_sheet_confirm` **Preview this confirmation** · `drawings_confirm_pending` **Working
out what this confirmation would do…** · `drawings_confirm_committed` **Recorded. Those
sheets now carry a confirmed discipline.** · `drawings_empty_no_drawings_heading` **No
drawings yet** · `drawings_empty_no_drawings_body` **Add a drawing above; its sheets appear
here as soon as it has been read.** · `drawings_empty_awaiting_heading` **No sheets read
yet** · `drawings_empty_awaiting_body` **This project holds drawings that have not been read
through. Each one's sheets appear here as it finishes.** · `drawings_empty_no_match_heading`
**No sheet matches this search** · `drawings_empty_no_match_search` **No sheet's title or
number contains {search}.** · `drawings_empty_no_match_discipline` **No sheet stands as
{discipline}.** · `drawings_empty_no_match_both` **No sheet stands as {discipline} with a
title or number containing {search}.** · `drawings_empty_no_match_body` **Every sheet stays
in the index — clear the search or choose All disciplines to see the rest.** ·
`drawings_empty_clear` **Clear search and filter** · `drawings_offline` **The connection to
the product is gone. An upload already running continues when it returns, and nothing can be
confirmed until then.** · `drawings_offline_notice` **Nothing was previewed: the connection
to the product is gone.** · `drawings_denied_permission` **Confirming a sheet's discipline
needs the MEASURE permission on this project, and your account does not hold it.** ·
`drawings_denied_holder` **This project's principals and measurers hold it; a principal
grants it on the participants screen.** · `drawings_evidence_participants` **Open the
project's participants** · `drawings_evidence_reload` **Reload the sheet index** ·
`drawings_evidence_upload_again` **Add the drawing again**.

Registry copy this increment fixes (`src/core/errors.ts` append, the refusal-state §3 rules
binding): **GROUP_NOT_OFFERED** · severity error · surface inline · message **This group is
not one the project offers now, so nothing was confirmed.** · remedy **Reload the sheet index
and confirm from a group it offers.**

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary in prose. Enum
values, formats, schemes and entity keys are data and render verbatim as data (I-25's class),
never woven into sentences.

## 4. Motion (R-UI-004)

The timeline is the only animated region (I-92): marker colour, connector fill and status
colour transition over `var(--motion-state)` `var(--ease)`, and a running step's Skeleton
pulses from its single home. Everything else is instant — cards mount with no entrance,
search and filter show and hide rows untweened, a group leaving after a commit unmounts at
once, refusals and the offline banner arrive without theatre. The Dropzone's dragging
transition, the ConsequenceDialog's entrance, Chip and Button hover and the reticle draw live
in their single homes. No bounce, no spinner anywhere. Every duration is a token zeroed at
source under reduced motion, so `drawings.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-0/50/100/200/300/600/700/900` · `--beam-500` · `--success` ·
`--warn`/`--warn-surface` · `--danger` · `--hairline` · `--space-2/3/4/6` · `--radius-4/8` ·
`--text-12/13/16/20` · `--font-ui`/`--font-mono` · `--leading-ui` ·
`--weight-body-medium`/`--weight-heading` · `--row-comfortable`/`--row-compact` ·
`--breakpoint-lg` (the page measure, read as a token) · `--motion-state`/`--ease`. Px
literals, closed set (core I-1's mandated class): the grid's 280 px column minimum, the
240 px search field, the 8 px marker and its 1 px connector, the thumbnail's 4 / 3 ratio, and
the skeleton bones 12/16/24/32/160/220 × 64/240/360/200/720/280. Any other literal is a
defect. No copper appears on the screen itself — it lives only on the ConsequenceDialog's
confirm, where its own Decision puts it (R-UI-001's scarcity) — and no basis colour appears
at all (I-83).

## 6. Themes

`drawings.css` contains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001). Contrast holds on the founder values in both themes:
graphite-600/700/900 on graphite-0 and on the cards' graphite-50 clear 4.5:1; the fact
badges' graphite-0 fill stands one step off the card in both themes, seamed by hairlines;
beam-500, success, warn and danger clear the 3:1 UI floor as markers and borders, and carry
no meaning the words do not repeat (R-UI-060). The thumbnail's graphite-100 well keeps a
white-paper raster legible in dark without inverting it — a drawing is shown as it is.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenantId}/p/{projectId}/drawings`; the timeline addresses
`/api/events?jobId={jobId}` and `/api/events?jobId={jobId}&transport=poll`, the Dropzone
`/api/upload` and `/api/upload/{uploadId}`.

Test ids, exactly the contract's, on the elements ruled in §1: `sheet-index` · `sheet-card`
(`data-sheet`, `data-discipline`, `data-confirmed`) · `sheet-card-thumbnail`
(`data-pending`) · `sheet-card-title` · `sheet-card-number` · `sheet-card-format` ·
`sheet-card-scheme` · `sheet-card-scale` (`data-scale`) · `sheet-card-views` ·
`sheet-card-discipline` (`data-basis`) · `sheet-fact` (`data-fact`, `data-value`,
`data-notable`) · `sheet-discipline-option` (`data-value`) · `sheet-confirm` ·
`sheet-search` · `sheet-filter-option` (`data-value`) · `sheets-empty` (`data-cause`) ·
`job-timeline` (`data-state`) · `job-timeline-step` (`data-kind`, `data-status`) — plus the
mounted patterns' own: the Dropzone's six, OfferedGroups' four, ConsequenceDialog's five,
RefusalState's four. No others are added; the clear button, the count line and the status
line are found by role and name.

Behavioural hooks without new ids: exactly one `aria-pressed="true"` per chip group;
`role="status"` on the count, status and transport lines; `aria-live="polite"` on each step's
status word; a visible `<label for…>` on the search; `cx-reticle` on every chip, button,
input and link; `aria-busy` on a door awaiting its pre-check; the absence of
`sheet-discipline-option` and `sheet-confirm` on a confirmed card and for a reader without
`MEASURE`; RefusalState's `data-code` inside either answer slot.

Journey: `tests/e2e/journeys/j-010-upload.spec.ts` (page object
`tests/e2e/pages/s-drawings.page.ts`, worker spawned by `tests/e2e/support/worker.ts`),
checkpoints **j-010-sheets-uploaded** · **j-010-timeline-done** · **j-010-sheets-fanned-out**
· **j-010-discipline-confirmed** exactly as the increment spec words them, axe
serious/critical = 0 at each, never widened (Q-11). One baseline (B-20, reason recorded
here): at j-010-sheets-fanned-out, `toHaveScreenshot` on the first `sheet-card`, name
`"j-010-sheet-card.png"` — the bare file name, since the locked `snapshotPathTemplate`
already carries the `design/` segment — animations disabled, maxDiffPixelRatio 0.002, mask on
`sheet-card-thumbnail`: those pixels are the raster increment's evidence, and a toolchain
version moving them must not red this screen's picture. jsdom acceptance mounts `SheetIndex`
with injected cards, groups and perform: the card anatomy and its data-attributes, all five
facts including zeros, the three empty causes, search and filter per I-94, the chooser's
single selection, both settled-refusal renderings, and the dialog handoff carrying exactly
the pressed group's key. `pnpm e2e --journey J-000` still exits 0.
