# Design Decision — S-BOQ (the unpriced draft, by taxonomy section)

Route `/t/{tenant}/p/{project}/takeoff/boq` — the **fifth** tab of the takeoff lane, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/boq/**`, inside the shell frame and behind
`authorizePage({ tenant, project })`. Increment inc-311a-taxonomy-boq. Law: L-BD-08, AM-14, AM-16,
AM-05, L-QTY-07, R-TO-053, A-BOQ-PDF, S-BOQ, J-033, R-UI-002/003/004/005/010/012/020/024/030/031/
050/060/080/081/082/083/084/085/086, B-17, B-19, B-20, C-05, C-13.

Cut from the **grid workspace template** (Direction §3.2) and re-deciding nothing it settled: the
tabs row is the frame's tool track (s-takeoff I-230), the grid is DataTable v2 with its own furniture
(I-235), the one RefusalState and the one JobTimeline are the shipped patterns. The template's tree
and inspector are **absent by scope**: the draft is read whole, nothing on it is selectable, and the
Trace lives on the register (out of scope by name). Files: `takeoff/layout.tsx` (one nav entry);
`takeoff/boq/{page.tsx,boq-screen.tsx,route-address.ts,states.ts,demonstration.ts,boq.css}`; copy at
`src/ui/strings/boq.ts`. Chrome is shipped primitives only — DataTable v2, IdChip, EnumLabel,
BasisChip, CoverageChip, UnitBadge, EmptyState, Button, Skeleton, Tooltip, the one RefusalState, the
one JobTimeline — plus the `cx-boq-*` classes this file rules. No pattern is invented, so no gallery
entry is added.

## 0. Interpretations (continuing the chain above s-documents' I-264)

- **I-265 — the screen says *sections*, never the other word.** AM-05 forbids calling an unsigned
  draft by the name of the signed thing, in the UI and in file names alike. Every heading, label and
  sentence on this screen and in the rendered PDF says **section**, **draft** or **line**; the word
  the law reserves appears in no text node, no string key and no class name. `data-bill` keeps it,
  because an attribute is machine vocabulary and never reaches a reader.
- **I-266 — the six sections are the order, and Unclassified stands after them.** `BILLS` order is
  the render order and a section holding no line is not rendered (scope). `UNCLASSIFIED` is not a
  seventh section and never sorts among the six: it stands last, labelled, each of its rows stating
  its reason (`NO_TAXONOMY_ROW`, `LEVEL_NOT_IN_STACK`) as words. It is kept and visible, which is
  L-BD-08's whole point, and it is not a place a failed mapping can hide.
- **I-267 — an item number belongs to a numbered line, so an unclassified row carries none.** S.G.I is
  derived from the section's ordinal in `BILLS`; a row outside `BILLS` has no S and may not be given
  one. Its row carries NO `data-item` at all, and its item cell holds the reason in words instead.
  What it does carry is this screen's line identity: a kept line is a published, measured line
  (L-BD-08), so it is a `boq-line` under `boq-bill[data-bill="UNCLASSIFIED"]` with `data-reason`, and
  a reader — or a suite — that asks a section for its lines is answered by every line standing in it.
  Rejected: numbering Unclassified 7.x.y (a seventh section by the back door); `data-item=""` (a
  machine hook spelling an empty identity — job-timeline I-112); and withholding the `boq-line` name
  from the kept rows, which made the block visible to a reader and invisible to every lookup.
- **I-268 — no grand total, and the absence is stated once in words.** Under incomplete coverage
  L-QTY-07 allows only a labelled measured-scope subtotal. Each section ends in one subtotal row per
  unit, labelled **Measured-scope subtotal**; the screen carries no footer that adds sections
  together, and one status line above the grid says why. Silence about a missing figure would be the
  silence R-UI-020 forbids; a hidden figure would be a claim the coverage does not support.
- **I-269 — the item number is derived on both faces by one function.** The screen and the document
  both call `numberItems` over the same payload order, so a number a reader sees and a number the PDF
  prints cannot differ. Nothing stores it; a register that changes renumbers freely.
- **I-270 — exporting is a keyed job, not an act.** A draft is unsigned by definition, so there is no
  consequence to preview and no copper on this screen: `boq-export` runs `takeoffBoq.exportDraft`
  (permission MEASURE), which enqueues under `boqDraftJobKey` and files the issue in Documents. While
  the job is watched the inline `boq-jobs` timeline stands where the button was pressed (R-UI-024);
  when it succeeds the link to the issue appears beside it and no reload happens.
- **I-271 — the quantity a reader sees is the quantity the document prints.** Every figure on this
  screen is the register's value rounded half-even at the kind's `documentPrecision`, right-aligned
  tabular mono with lakh/crore grouping. The register keeps full precision and is reached from the
  register screen, not re-derived here: the draft reads lines and never re-measures.

## 1. Layout and hierarchy (1440 × 900)

```
┌R─┬──────────────────────────────────────────────────────────────────────────────┐
│▲ │ ws › Sattva Court ▾ › Takeoff › Draft BOQ                      ⌘K ⟳ ✉ ◉ │ 40
│  ├──────────────────────────────────────────────────────────────────────────────┤
│▦ │ Register · Coverage · Levels · Schedules · Draft BOQ                         │ 32
│▤ │            rev a3f9c2 ⎘ · taxonomy 2026-09-16 ⎘ · Draft — unsigned  ● Export │
│⚙ ├──────────────────────────────────────────────────────────────────────────────┤
│  │ Coverage is incomplete, so each section states a measured-scope subtotal …   │ 28
│  ├───────┬──────────────────────────┬────────┬──────────┬────┬────────┬─────────┤
│  │ Item  │ Description              │ Level  │ Quantity │Unit│ Basis  │ Coverage│ 28 sticky
│  │ 1 Substructure                                                               │ 28
│  │ ▾ Pile cap · Concrete by grade                 12.480  CUM                   │ 28 group
│  │ 1.1.1 │ Pile cap · Concrete by grade │ FDN   │   4.160 │CUM │◆ M ▣ T│  100%   │ 28 line
│  │ 1.1.2 │ Pile cap · Concrete by grade │ FDN   │   4.160 │CUM │◆ M ▣ T│  100%   │
│  │ ▾ Column · Concrete by grade                    2.430  CUM                   │
│  │ 1.2.1 │ Column · Concrete by grade   │ PILE  │   0.810 │CUM │◆ M ▣ T│   67%   │
│  │       │ Measured-scope subtotal                14.910  CUM                   │ 28 subtotal
│  │ 2 Superstructure                                                             │
│  │ 2.1.1 │ Column · Concrete by grade   │ GF    │   0.405 │CUM │◆ M ▣ T│   100%  │
│  │ 2.2.1 │ Brick wall · Brickwork 250   │ GF    │   8.640 │CUM │◆ M ✎ E│    82%  │
│  │       │ Measured-scope subtotal                 9.045  CUM                   │
│  │ 3 Finishes                          28 px rows · 13 px · frozen Item column   │
│  └───────┴──────────────────────────────────────────────────────────────────────┘
└──┴──────────────────────────────────────────────────────────────────────────────┘
        (no right column: nothing here is selectable — R-UI-080, scope)
```

Above the fold: the grid's sticky header stands 24 (the frame's padding on `shell-main`) + 28 (the
status line) + 4 = **56 px** below the top of main and its first row at **84 px**, at 1440 × 900 and
at 1280 × 800 alike — inside §7 C2's 120. Work-surface share: the grid is 1344 × 748 of main's
1392 × 804 = **90 %**; at 1280 × 800, 1184 × 648 of 1232 × 704 = **88 %**. The grid scrolls inside
its own viewport with the Item column frozen; the page never scrolls sideways (§7 C10).

| Region | What it holds | Width / height rule | Tokens | State when empty |
|---|---|---|---|---|
| tabs row (frame's track) | `takeoff-nav-register` · `-coverage` · `-levels` · `-schedules` · `takeoff-nav-boq` (`aria-current="page"` here); in `useTakeoffTabsAside`: `boq-revision` and `boq-taxonomy-version` as `IdChip`s, `boq-draft` as the standing word, and the ONE primary `boq-export` | 100 % × `--toolbar-h` 32 | `--ink-secondary`, `--ink`, `--ink-muted`, `--line-accent`, `--surface-panel`, `--accent` through Button | the aside carries the tabs alone while no campaign is pinned; the primary does not render |
| answer slot (`boq-answer`) | one RefusalState from a refused door; the offline banner above it; the denial pair | 100 % × auto; `display:none` while empty | `--state-info(-surface)`, `--state-warn(-surface)` through RefusalState, `--radius-4`, `--hairline` | absent (no box) |
| status line | the ONE helper line, `<p role="status">`, `boq_coverage_incomplete` or `boq_coverage_complete` | 100 % × 28 | `--ink-muted`, `--text-body` | absent with the grid |
| job strip (`boq-jobs`) | the shipped `JobTimeline` for the render job, present only while a run is watched; `boq-render-draft` is its step; `boq-document-link` follows a success | 100 % × the pattern's own, between the status line and the grid | the pattern's own | absent — never an empty box |
| grid (primary) | `boq-grid`: DataTable v2, `tableId` `s-boq`, one `boq-bill` section per section holding a line (`BILLS` order, then `UNCLASSIFIED`), `datatable-group-row` per (class · kind) group with its `datatable-group-subtotal`, `boq-line` rows, each section closed by `boq-subtotal` per unit | `flex: 1 1 auto`; ≥ 55 % of main; rows `--row-h` 28, header 28 sticky, first column frozen, no wrapping cell | `--surface-app`, `--surface-sunken` (header, group and subtotal rows), `--ink`, `--ink-code`, `--font-mono`, `--cell-px`, `--cell-py`, `--hairline`, basis palette through BasisChip | not rendered at all: `boq-empty` stands in its place |
| empty (in the grid's place) | the shipped `EmptyState` `boq-empty`: heading, one sentence, one action to the drawing sets | max-width 520, centred in the grid's box | `--ink`, `--ink-muted`, `--accent` through Button | this IS the empty state |
| error (in the grid's place) | `error-state`: heading, one sentence, `error-state-report` (`IdChip` under the primitive's own report label), `error-state-retry` | 100 % × auto, max-width 520 | `--ink`, `--ink-muted`, `--hairline`, `--radius-4` | — |
| inspector (frame's one slot) | nothing ever mounts it here | **absent — width 0** | — | absent |

**Columns**, left to right, widths multiples of 4:

| # | Header | Width | Cell |
|---|---|---|---|
| 1 | `boq_col_item` | 96, **frozen**, `meta.align: 'right'` | the S.G.I string in `--font-mono` tabular; on an unclassified row, the reason in words (I-267) |
| 2 | `boq_col_description` | remainder, min 320 | the class and the kind as words through two `EnumLabel`s joined by ` · `; raw keys on `data-class` / `data-kind` |
| 3 | `boq_col_level` | 120 | the level label verbatim; `data-level` and `data-ordinal` on the row |
| 4 | `boq_col_quantity` | 140, `meta.align: 'right'` | the rounded figure, `--font-mono` tabular slashed-zero, lakh/crore grouped (I-271) |
| 5 | `boq_col_unit` | 80 | one `unit-badge` |
| 6 | `boq_col_basis` | 184 | exactly two `basis-chip`s — the quantity basis then the selection basis, in that order |
| 7 | `boq_col_coverage` | 112, `meta.align: 'right'` | one `coverage-chip` |

A section header row carries the ordinal and the label (`1 Substructure`). A group row carries the
class · kind words and the group's per-unit subtotal in the Quantity and Unit cells, no parenthesised
count. A subtotal row carries `boq_subtotal_measured` in the Description cell and one row per unit.
A provisional sum, when an act exists to author one, is the last `boq-line` of its section, labelled
`boq_provisional_sum`, `data-scope="PROVISIONAL"`, excluded from the subtotal — data only at M3.

## 2. States (R-UI-050), ruled cell by cell

`BOQ_STATES` in `takeoff/boq/states.ts` = `["loading","denied","offline","error","refused","empty",
"partial","ready"]`; `boq-screen[data-state]` derives in that order, first holding wins. A watched
render is NOT a state of the screen: the job strip stands beside a grid that reads on in full, so the
draft a reader is looking at never stops being ready, partial or refused while bytes are made. The
seven R-UI-050 cells are declared in `src/ui/screen-states/matrix.tsx` under
`/t/[tenant]/p/[project]/takeoff/boq`, and `…/takeoff/boq?__state=<name>` stands this screen in each —
by the screen's own name or by the matrix's (`refusal` opens `refused`, `permission-denied` opens
`denied`) — through `./demonstration` where the evidence instrument is armed; a name neither roster
declares is answered `REQUEST_MALFORMED` through the one RefusalState.

- **Loading** — root at `data-state="loading"`, frame, tabs row and status line intact: the DataTable
  in its `loading` posture over the same `BOQ_COLUMNS` — the header real, the body two section-header
  bones each over eight 28 px row bones at `--row-h`. The aside's two chips render as 28 × 96 bones;
  the primary does not render. Never a spinner on a table (R-UI-004).
- **Empty** — the project has no published line on its pinned campaign, or no campaign is pinned.
  `boq-empty` fills the grid's place, the grid and the status line do not render, and the one action
  is `boq_empty_action` → `/t/{tenant}/p/{project}/drawings/sets`. The chain a draft is read through
  starts at the drawing sets, and the takeoff lane already offers that step under one word on two
  screens (`takeoff_register_empty_action`, `takeoff_coverage_empty_action`); this screen says it in
  the same word, to the same address. The sentence that leads to the register is its own
  (`boq_register_link`), because it answers a different question — where a REFUSED draft is resolved.
- **Partial** — rendered, never hidden. `data-state="partial"` and `data-coverage="INCOMPLETE"` while
  the coverage statement holds an entry or any line reads `PARTIAL_DECLARED`: every section stands
  with its measured-scope subtotal, each such line keeps its `coverage-chip` below 100 %, and the
  status line states the rule. An unclassified row makes the screen partial too — a line the taxonomy
  could not place is a gap in the draft, said in words.
- **A watched render** — not a cell of its own (see the roster above). `boq-jobs` stands between the
  status line and the grid, `boq-export` renders `aria-disabled="true"` with `data-job` beside it, and
  every section reads on in full under its own `data-state`. A second press enqueues nothing: the key
  is the campaign's. It is reached by pressing the primary, which is where a reader meets it.
- **Error** — the read threw. `page.tsx` reports it once and hands the `faultId` down; `error-state`
  stands in the grid's place with `boq_error_heading`, `boq_error_body`, the id through
  `error-state-report` under the label the shipped error state says a report id by
  (`primitive_error_report` — one sentence, one home, so every fault on this product is quoted the
  same way), and `error-state-retry` re-running the read in place.
- **Refusal** — the one RefusalState in `boq-answer` for a refused door (`REQUEST_MALFORMED`,
  `PERMISSION_NOT_HELD`, `BOQ_NO_PUBLISHED_LINE`, `BOQ_TAXONOMY_VERSION_MOVED`), and inside the job
  timeline's own step for a refused render. Never a toast, never a screen-local block (R-UI-020).
- **Offline** — a `<p role="status">` banner above the answer slot carrying `boq_offline`;
  `boq-export` renders `aria-disabled="true"` while it stands. The sections read on.
- **Permission-denied** — `boq-export` does NOT render: a denial is the state, and a screen standing
  in it keeps no door open on other evidence (I-194's precedent). The answer slot carries the denial
  over the one registered `PERMISSION_NOT_HELD` entry, evidence the project's participants screen,
  with `boq_denied_export` beneath it naming the permission the absent door would need. Every section,
  line and subtotal reads in full — reading the draft needs membership and nothing more.
- **Ready** — `data-state="ready"`, `data-coverage="COMPLETE"` only where the measurement statement
  is empty and no line reads `PARTIAL_DECLARED`; even then no element carries `data-scope="GRAND"`.

## 3. Copy, verbatim (`src/ui/strings/boq.ts`, keys `boq_…`)

`takeoff_nav_boq` **Draft BOQ** (the fifth tab and `shell-crumb-page`) · `boq_revision_label`
**Pinned revision** · `boq_taxonomy_label` **Taxonomy** · `boq_draft_standing` **Draft — unsigned** ·
`boq_export` **Export the draft** · `boq_coverage_incomplete` **Coverage is incomplete, so each
section states a measured-scope subtotal over what was measured, and no figure is stated for the
project.** · `boq_coverage_complete` **Every section states a measured-scope subtotal over what was
measured.** · `boq_grid_label` **Draft lines by section** · `boq_col_item` **Item** ·
`boq_col_description` **Description** · `boq_col_level` **Level** · `boq_col_quantity` **Quantity** ·
`boq_col_unit` **Unit** · `boq_col_basis` **Basis** · `boq_col_coverage` **Coverage** ·
`boq_section_substructure` **Substructure** · `boq_section_superstructure` **Superstructure** ·
`boq_section_finishes` **Finishes** · `boq_section_electrical` **Electrical** ·
`boq_section_plumbing` **Plumbing** · `boq_section_external` **External** ·
`boq_section_unclassified` **Unclassified** · `boq_subtotal_measured` **Measured-scope subtotal** ·
`boq_provisional_sum` **Provisional sum** · `boq_reason_no_taxonomy_row` **No taxonomy row places
this kind.** · `boq_reason_level_not_in_stack` **This line's level is not in the level stack.** ·
`boq_jobs_heading` **Rendering the draft** · `boq_document_link` **Open the issued draft** ·
`boq_empty_heading` **Nothing published yet** · `boq_empty_body` **A draft lists every published line
of the pinned campaign, grouped into sections by the project's taxonomy. Pin a drawing set revision,
measure from the takeoff register, and the sections appear here.** · `boq_empty_action` **Browse
drawing sets** · `boq_register_link` **Go to the takeoff register** · `boq_error_heading` **The draft could not be read** · `boq_error_body` **Nothing was changed. Try
again, and quote the report id if it keeps happening.** ·
`boq_retry` **Try again** · `boq_offline` **You are offline. The sections read as they stood when
this page loaded, and nothing can be exported until the connection returns.** · `boq_denied_export`
**Exporting the draft needs the MEASURE permission on this project.** · `boq_denied_holder` **A
project principal can grant it on the participants screen.**

Registry entries this increment adds to `src/core/errors/boq.ts` (refusal-state §3's copy rules bind;
the code is never rendered as text):

| code | severity | surface | message | remedy | evidence label |
|---|---|---|---|---|---|
| `BOQ_NO_PUBLISHED_LINE` | info | inline | **This campaign has published no line to draft.** | **Measure and publish from the takeoff register — a draft states what was published and assumes nothing.** | **Go to the takeoff register** |
| `BOQ_TAXONOMY_VERSION_MOVED` | warning | inline | **The taxonomy has changed since this draft was issued.** | **Export the draft again — an issued document states the taxonomy it was drafted under and never follows a later one.** | **Open the documents list** |

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "seam", "rail",
"gate", "resolver", "job kind" and every clause id appear nowhere a reader can see. Levels, marks,
units and item numbers are model data and render verbatim in mono; digests, campaign ids and document
ids render only through `IdChip`; classes, kinds, bases and reasons render as words through
`EnumLabel`, the raw key kept on the row's attributes and in the technical disclosure (R-UI-082).
`MEASURE` inside the denial line is the product's law, quoted as the seam quotes it. The rendered
PDF's own words are the document kind's, held to AM-05: **DRAFT — UNSIGNED** on every page, the
taxonomy version, the section labels, `Measured-scope subtotal`, and no surveyor, credential or
certificate anywhere.

## 4. Motion (R-UI-004)

Nothing on this screen eases in: it is a read, and every section arrives complete. The only
transitions are inherited from single homes — row hover fill, the chip's copy state, the Button's and
the nav link's colour over `var(--motion-state)` `var(--ease)`; the Tooltip's own entrance; the job
strip's arrival and its step rows over `var(--motion-state)` from the pattern's own stylesheet; the
reticle draw at `var(--motion-reticle)` from `reticle.css`; the Skeleton pulse in `loading`. No
entrance on the grid, the status line, the empty state or the error block; no bounce, no spinner, no
shimmer beyond one skeleton cycle. Every duration is a token zeroed at source under
`prefers-reduced-motion`, so `boq.css` carries no reduced-motion branch.

## 5. Tokens

Only the semantic alias group and the density/layout tokens (Direction §4.1, §4.2); a `--graphite-*`
or `--beam-*` reference outside `tokens.ts` is a lint failure (R-UI-086). This screen spends:
`--surface-app` · `--surface-panel` · `--surface-sunken` · `--surface-hover` · `--ink` ·
`--ink-secondary` · `--ink-muted` · `--ink-code` · `--line` · `--line-accent` · `--hairline` ·
`--accent` (only through the Button in the aside and in the empty state) · `--state-info(-surface)`
and `--state-warn(-surface)` reached only through RefusalState · the basis palette reached only
through `BasisChip` · `--state-danger` / `--state-warn` / `--state-success` reached only through
`CoverageChip`'s own banding · `--space-1/2/3/4` · `--gap-section` · `--radius-2/4` · `--text-20` ·
`--text-body` · `--text-caption` · `--text-12` · `--font-ui` · `--font-mono` · `--leading-ui` ·
`--weight-body-medium` / `--weight-heading` · `--motion-state` / `--motion-reticle` / `--ease`; and,
read by the primitives rather than stated here, `--row-h`, `--cell-px`, `--cell-py`, `--control-h`,
`--toolbar-h`. Px literals, closed set: the status line's 28, the 520 measure the empty state and the
error block both stand at, the seven column widths (96/320/120/140/80/184/112), the tabs-row current
underline's 2, and the loading leg's bones (28/96). Any other literal is a defect. **No copper
anywhere**: a draft commits nothing and signs nothing (I-270).

## 6. Themes

`boq.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). Dark is the default and light is complete; both are captured, the light picture by
`emulateTheme(page, "light")` inside the dark lane. Contrast holds on the founder values in both:
`--ink` and `--ink-secondary` on `--surface-app` and on the sticky header's and subtotal rows'
`--surface-sunken` clear 4.5:1; `--ink-muted` (graphite-600) clears 4.5:1 as the status line, the
Level cell and the standing word; the beam-500 current-tab underline clears the 3:1 UI floor; each
basis colour rides the chip's glyph and border at ≥ 3:1 while the chip's label rides graphite-700, so
a section dense with chips is still a table of readable words. Nothing carries meaning by colour
alone: a basis is a glyph and a word (R-UI-002), coverage is a numeral, a section is a heading, and a
subtotal is a label — all survive greyscale (R-UI-060).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/takeoff/boq` (`boqRoute`, the one spelling; crumbs in `routes.ts`,
`shell-crumb-page` reads **Draft BOQ**) and the file route
`/t/[tenant]/p/[project]/takeoff/boq` (the matrix key). Linked, all shipped:
`/t/{tenant}/p/{project}/documents` (the issue, and `BOQ_TAXONOMY_VERSION_MOVED`'s evidence),
`…/takeoff/register` (the empty state's action and `BOQ_NO_PUBLISHED_LINE`'s evidence),
`…/settings/participants` (the denial's evidence). Procedures: `takeoffBoq.exportDraft`. Reads:
`boqViewOf`, `boqDraftPayloadOf`, `resolveBill`, `plinthBoundaryOf`, `numberItems`, `listDocuments`.

Test ids, exactly the registry's spellings, on the elements ruled in §1: `boq-screen` (`data-state`,
`data-campaign`, `data-coverage`, `data-taxonomy-version`) · `boq-answer` · `boq-revision`
(an `id-chip`, `data-value` the whole revision) · `boq-taxonomy-version` (an `id-chip`, `data-value`
the whole `BILL_TAXONOMY.version`) · `boq-draft` (the standing word, `data-state="UNSIGNED"`) ·
`boq-export` (`data-permission`, `data-job`) · `boq-jobs` (`data-job`) · `boq-render-draft` (the job's
step, `data-kind="boq-draft"`, `data-state`) · `boq-document-link` (`data-document`) · `boq-grid`
(`data-rows-rendered`) · `boq-bill` (`data-bill`, `data-ordinal`, `data-rows-rendered`) · `boq-line`
(`data-line`, `data-item`, `data-bill`, `data-group`, `data-class`, `data-kind`, `data-level`,
`data-ordinal`, `data-quantity`, `data-unit`, `data-quantity-basis`, `data-selection-basis`,
`data-coverage`, `data-decided-by`, `data-scope` only on a provisional line; `data-item` on a numbered
row and `data-reason` on a kept one, never both — I-267) · `boq-subtotal`
(`data-scope="MEASURED"`, `data-bill`, `data-unit`, `data-quantity`) · `boq-empty`. Used and never
redefined, other files' ids: `takeoff-nav`, `takeoff-nav-boq` (`aria-current="page"` here),
`datatable-header`, `datatable-row` (the primitive's own name, which `rowTestId` replaces on every row
this screen renders — placed and kept alike, I-267), `datatable-group-row` (`data-group`), `datatable-group-subtotal` (`data-unit`,
`data-quantity`), `basis-chip` (`data-basis`), `basis-glyph`, `coverage-chip`, `unit-badge`,
`id-chip` (`data-value`), `enum-label`, `empty-state`, `error-state`, `error-state-report`,
`error-state-retry`, `refusal-state`, `skeleton`, `shell-crumb-page`, `shell-main`,
`shell-tenant-switcher`, `shell-user`, `documents-row` (`data-kind="boq-draft"` on S-Documents, whose
only change here is the one kind label `documents_kind_boq_draft` **Draft BOQ**). `boq-draft` also
names the document kind's own fixture root; `draft-every-page` is the document lane's hook on the
frame that prints the banner (`documents/base/frame.typ`), read by `tests/docs/boq-draft/**` through
`tests/docs/support/seam.ts`, and it appears in no DOM.

Behavioural hooks without new ids: `[data-density]` at the ROOT, the one switch the grid reads
`--row-h` from · `data-technical` on every raw enum, taxonomy key and `decidedBy.key` kept beside its
`EnumLabel` · `role="status"` on the status line and the offline banner · `aria-live="polite"` on
`boq-answer` · `aria-label` `boq_grid_label` on the grid · `aria-disabled="true"` on `boq-export`
while a render is watched or the connection is gone (unpermitted renders no primary at all) ·
`cx-reticle` on every focusable. Asserted absences: no element
with `data-scope="GRAND"` anywhere (I-268); no inspector and no second right column (R-UI-080); no
native `select` or `input[type=date]` (R-UI-083); no `data-item` that is not `^[1-9]\d*\.[1-9]\d*\.[1-9]\d*$`
(a kept line carries none at all — I-267); no NUMBERED `boq-line` carrying other than exactly two `basis-chip`s and one
`coverage-chip`; no `boq-bill` for a section holding no line; no `boq-grid` while `boq-empty` stands;
no `boq-jobs` at rest; no wrapping cell; no uuid or digest as a text node outside an `IdChip`.

Suites and evidence. Unit: `tests/takeoff/boq/taxonomy.test.ts`, `…/numbering.test.ts` and
`tests/takeoff/boq/support/**` (no duration is asserted in any of them — AM-10 §3). Docs:
`tests/docs/boq-draft/{payload.json,golden.pdf,render.test.ts}` under `pnpm test:docs`. Perf:
`tests/e2e/boq-draft-perf.spec.ts`, titles carrying **PERF-311**, collected only by `pnpm test:perf`.
Journey `tests/e2e/boq.spec.ts`, every title carrying **J-033**, staged by
`tests/e2e/takeoff/boq-stage.ts` (`stageBoq`, `stageBareProject`) over `signInAsSeededTenant`; page
objects `tests/e2e/pages/s-boq.page.ts` and `tests/e2e/pages/s-documents.page.ts`; checkpoints
**s-boq/sections** (dark), **s-boq/sections-light** (by `emulateTheme`) and **s-boq/empty**, axe
serious/critical = 0 at each, never widened; baselines
`tests/e2e/baselines/design-dark/s-boq/{sections,sections-light,empty}.png`, `masks()` over the shell
breadcrumb, `shell-user` and `shell-tenant-switcher` — every other text is staged and fixed.
Re-baselined under B-20 in its own `baseline:`-subject commit naming the fifth tab as the proof:
`design-dark/{s-takeoff,j-021-column-slice,j-022-coverage,j-031-levels,s-schedules}/**`.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

- **A line's Trace on this screen.** Every figure here came from a drawing, and R-UI-022 will want an
  EvidenceLink on the Quantity cell and an inspector behind it. Out of scope by name; the register
  carries the Trace meanwhile. Owner: the M4 BOQ leaf.
- **A-BOQ-XLSX and every other export channel.** One door, one kind at M3. Owner: inc-311b.
- **Electrical, Plumbing, External and provisional sums.** Their taxonomy rows exist and no rail
  publishes into them, so those sections never render today and no act authors a provisional sum.
  Owners: the network rail's node and the provisional-sum authoring leaf.
- **The certificate, the signature and the closing of the draft path.** AM-05 keeps the draft lawful
  only while unsigned; the moment a signature exists this path closes for that campaign. Owner: M7.
- **Rebar and BBS lines in the draft.** Not until the rebar kind is in `KINDS`. Owner: inc-309.
