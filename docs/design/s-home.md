# Design Decision — S-Home (the projects home at /t/{tenant})

Route: `/t/{tenantId}` — the shell's Projects area home, grown from the shipped empty state
into the projects screen, and REBUILT for v22 on the Dashboard template (Design Direction 00
§3.3, §5, §8's "Home / Project (2.9)"). Files: `src/app/(app)/t/[tenant]/page.tsx` (server
component: resolves the workspace, calls `projectsForHome`, branches),
`projects-onboarding.tsx` (the zero-project branch), `actions.ts` (server actions), and
`src/app/(app)/t/[tenant]/home/**` (`projects-home.tsx`, `project-row.tsx`, `project-form.tsx`,
`judgement.ts`, `states.ts`, `strings.ts`, `home.css`, classes `cx-home-*`). Increments
inc-011-projects and the v22 rebuild (U2). Law: R-SPINE-010/012, L-ACT-03, L-REG-07,
R-UI-001/003/004/005/012/020/031/033/050/060/082, B-17, B-20, Q-11, Q-17, and Direction 00 §§1,
3.3, 5, 6, 7. Where this file's geometry disagreed with §3, §3 won and the clauses below are
amended in place (Direction 00's precedence rule). Every convention of the earlier Decisions
binds: `cx-` classes, tokens-only colour and motion, `cx-reticle` solely from its single home,
no `[data-theme]` selector in authored CSS. Interpretations I-1–I-30 remain in force
("workspace" is the user-facing word for tenant, s-auth I-11). Chrome comes only from shipped
primitives — core Button, Input, Textarea, Badge, Chip, Skeleton, **Stat, EmptyState,
MoneyText, RelativeTime, CoverageChip**; **data DataTable**; overlay Sheet and DropdownMenu; the
one RefusalState — plus the `cx-home-*` classes this file rules. Copy lives in
`src/ui/strings/home.ts` (keys `home_…`, registry append), spread into `strings` by the barrel,
with the four labels §3.3 needs and that table does not hold in `home/strings.ts` beside the
screen (§3, the s-settings-ruleset I-24 idiom); JSX carries no string literal beyond test ids
and fixed attribute values.

## The screen, at 1440×900 (Design Direction 00 §3.3, the Dashboard template)

```
┌R─┬──────────────────────────────────────────────────────────────────────────┐
│  │ ws › Projects                                                ⌘K ⟳ ✉ ◉ │  top bar 40 (shell's)
│  ├──────────────────────────────────────────────────────────────────────────┤
│  │ Projects                                ⌕ Filter…        ● New project   │  title row 48
│  ├─────────────┬─────────────┬─────────────┬────────────────────────────────┤
│  │ 12          │ 84          │ 3           │ ৳ 4,20,00,000                  │  4 × 1fr × 64
│  │ Projects    │ Sheets      │ Campaigns   │ Estimated value                │  (value 20 mono,
│  ├─────────────┴─────────────┴─────────────┴────────────────────────────────┤   label 12)
│  │ Name ▸         │ Client  │ District │ Sheets │ Coverage   │ Last act │ ⋯ │  header 28, sticky
│  │ Trace Survey   │ —       │ Dhaka    │     12 │ ▰▰▰▱  82 % │ 2 h ago  │ ⋯ │  rows 28
│  │ Sattva Tower   │ Sattva  │ Ctg      │     40 │ ▰▰▱▱  41 % │ Tue      │ ⋯ │
│  │ Chandpur Front │ Meghna  │ Chandpur │      0 │ —          │ 30 Aug   │ ⋯ │
└──┴──────────────────────────────────────────────────────────────────────────┘
```

The table's header sits at 48 + 8 + 64 + 8 = **128 px below the top of `shell-main`** at both
1440×900 and 1280×800 — §3.3's "first row at y ≈ 160" from the top of the viewport, with the shell's
40 px top bar above it. Nothing else stands in main: there is no recent-documents region, no card and
no section heading over a sentence.

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| title row | `h1` 20/600 "Projects", the search over the list, the one primary ("New project") | 100 % × 48 | the search is absent with no projects to filter; the primary stands on both branches | — | — |
| stat tiles | four `Stat` — projects · sheets · campaigns · estimated value (`MoneyText`, ৳, lakh/crore) | 4 × 1fr × `--stat-h` 64 | absent on the zero-project branch (I-137); a tile with no figure states `—` | — | route `loading.tsx` bones |
| table (primary) | the one `DataTable`: Name ▸ · Client · District · Sheets · Coverage · Last act · `⋯` | flex; rows `--row-h` 28 | zero projects → `EmptyState` with the SAMPLE offer (R-UI-033); filtered to none → `EmptyState` "No matches" | delegated to the root boundary (`src/app/error.tsx`) | route `loading.tsx` bones; the grid's own skeleton rows when it is handed `loading` |
| row `⋯` | the project's three doors: Edit · Archive/Restore · View rule set | `--control-h` 28 square | — | the lifecycle refusal renders under its own row (`renderRefusal`) | the trigger reports `aria-busy` |
| form (overlay) | the create/edit `Sheet`, nine fields, one answer slot, a sticky answer-and-doors bar | 480 side sheet | — | `RefusalState` in the answer slot | submit reports loading |

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-31 — creating a project is a plain write, never an act.** The creator becomes PRINCIPAL
  inside `createProject`'s own transaction with `participant_roles.actId` null — the schema's
  own comment says creation "is not an act somebody performed", and L-ACT-03's closed act
  enum holds no CREATE_PROJECT. So the screen shows no copper, no ConsequenceDialog, no
  digest line: a native form submits, the answer arrives in place. The same reading covers
  edit, archive and restore ("archive, restore, field edits" are lifecycle, guarded but not
  acts). Copper scarcity is preserved: nothing on this screen wears act colour.
- **I-32 — the card is not a door.** *Amended by S-Project's I-131 (inc-115-project-home):
  the project home shipped, so the name IS the door — a `next/link`
  `data-testid="s-home-project-open"` to `/t/{tenantId}/p/{projectId}`, its type unchanged
  and gaining only a 1 px `var(--beam-500)` underline at `text-underline-offset: 2px` with
  hover text `var(--beam-600)` and `cx-reticle`. The reading below stands for everything
  else on the card.* R-SPINE-013's project home is M1 and out of scope by
  name, so no route exists for a card to open: the project name renders as text, never a
  link. The card's interactive elements are exactly the pin link and the lifecycle doors.
  The pin link to `/t/{t}/p/{project}/settings/ruleset` pays the visible-navigation IOU the
  s-settings-ruleset Decision recorded against inc-011 (R-UI-031); the richer breadcrumb
  trail naming the project on that route needs `src/ui/shell/**`, which this increment does
  not own — that part of the debt is re-recorded, owner: the shell's node.
- **I-33 — building type is a chip group, because no Select ships and a native `<select>`
  cannot wear the reticle.** The shipped set has no Select; a native `<select>` is a replaced
  element the reticle's single home declares no fallback for, so it would focus invisibly
  (R-UI-012) — and this screen may not add a rule to `reticle.css` (B-17). Ruling: the five
  BUILDING_TYPES render as shipped interactive Chips inside a `<fieldset>` (legend styled as
  the field label), exactly one `selected`/`aria-pressed="true"`; a hidden input carries the
  chosen value into the native form. Recorded IOU — a Select/RadioGroup primitive, owner: a
  later primitives increment; this screen adopts it when it ships.
- **I-34 — the form judges presentability locally; the taxonomy stays closed.** No registry
  code exists for a blank name, a missing choice or an unparseable number, and
  `src/core/errors.ts` grows only when a guard cannot reuse PERMISSION_NOT_HELD (the
  increment's own bar). Ruling, on the shell I-22 precedent: before calling the seam the form
  judges — the name shows visible text (`hasVisibleText`, `src/ui/shell/routes.ts`, reused
  never respelled); a building type is chosen; storeys (when given) parses as a whole number
  and target GFA (when given) as a plain decimal. A failing judgement renders one
  `role="alert"` line in the answer slot (§1) and the seam is never called. Name and building
  type are the two required fields; everything else is stored as presented (s-auth I-14).
- **I-35 — archive is reversible, so it is ghost, unconfirmed and undramatic.** Archive flips
  a marker and deletes nothing (AC-4); restore undoes it. Neither is destructive (danger) nor
  an act (copper) — plain ghost doors that answer immediately, like rename.
- **I-36 — quick stats are per card, and the zeros are counted, not typed.** *Amended by I-136:
  the counts are the workspace's tiles now. The half that stands is the second half — a zero is a
  counted empty set, never a hidden region and never a literal in JSX.* S-Home's clause
  lists status, last activity and quick stats as what each grid entry carries. Each card
  renders the four counts as literal counts of the project's (empty) sheet/campaign/estimate/
  bid sets from `projectsForHome` — honest zeros the later J-000 legs fill, never a hidden
  region and never a `0` literal in JSX.
- **I-37 — last activity is an absolute date through the format seam, and it is masked.**
  *Amended by I-139 and by S-Project's I-147: the cell is the shipped `RelativeTime`, which is
  deterministic by construction — it takes its present from an injected clock or from nothing at
  all, never from `Date.now()` in a render — so the objection this reading rested on no longer
  holds. With no clock installed it says the document date, exactly as before; the masking stands.* No
  RelativeTime ships, and a ticking "3 minutes ago" is volatile text no baseline can hold.
  The card shows `updated_at` through `src/core/format`'s date seam (DD MMM YYYY, the
  /sessions precedent); journeys mask every `s-home-project-last-activity` per V-E2E.
- **I-38 — this screen declares its own matrix; the shell's row stands.** `SHELL_STATES`
  (`src/ui/shell/states.ts`, unowned here) declared the M0 Projects home around
  `ShellEmptyState`, which this screen keeps as its empty branch, so that declaration stays
  true. The grown screen's seven cells are declared in
  `src/app/(app)/t/[tenant]/home/states.ts`, export `HOME_STATES`, in the shell matrix's cell
  shape; `tests/ui/home/state-matrix.test.ts` walks it. If the shell's own walker reddens on
  the changed page, that is an Objection to its owner, never an edit to a locked test.
- **I-39 — the sft readout is a conversion, not a second field.** Target GFA is stored in m²
  (AC-1); the sft figure is display, computed at 1 m² = 10.7639 sft through
  `src/core/format.ts` (the factor's one home), grouped by `formatUserFigure`, rounded to the
  whole sft — a target, not a measurement. It re-renders as the m² input changes and renders
  nothing while the input holds no parseable value.

### The v22 rebuild's Interpretations (U2, Direction 00 §3.3)

- **I-136 — the card grid is a table, and the four quick stats move up to the tiles.** *Amends
  I-36.* A card per project spent 320 px of width and five lines of height saying what six cells
  say in one 28 px row, and it repeated every label on every card (Direction 00 §2's STACK
  reading: "the project dashboard as four stat tiles above a table, not cards with prose"). The
  four counts a card carried per project are the WORKSPACE's totals now — a tile is what a
  dashboard states, a cell is what a row states, and no figure is drawn twice. What a card said
  and where it says it now: name → the `Name ▸` cell (still the door, I-131); code → beside the
  name, mono and muted; status → the archived `Badge` in the same cell, the word carrying the
  meaning; building type → dropped from the list (it is the form's field and the project's own
  home states it); last activity → the `Last act` cell; the pin → the row's `⋯`; the four counts →
  the tiles, summed. `s-home-project-card` is the ROW's id, kept byte-identical.
- **I-137 — the tiles are absent on the zero-project branch.** R-UI-033's teaching state is the
  one thing a new workspace is shown; four tiles of `—` above it would be four statements of
  nothing. The title row and its one primary stand on both branches, as they always did.
- **I-138 — the search field filters in the browser, over the answer already read.** It is not a
  second query and it is not remembered: it is the one control §3.3 puts in the title row beside
  the one primary, it matches on name, code, client and district — exactly what the table shows —
  and it is absent when there is nothing to filter. Filtered to nothing, the table's place holds
  an `EmptyState` reading the shipped `primitive_combobox_no_matches`: the way out is the field
  the reader just typed in, so the state offers no second door.
- **I-139 — the figure primitives are bound to SEAM-FORMAT by the screen.** `MoneyText` and
  `RelativeTime` take their conventions from a `FigureFormat`, and `src/ui` may not call the seam
  (ARCH-01) — so this screen hands one down (`FIGURES` in `projects-home.tsx`), exactly as the
  frame hands `JobsFormat` to the job pattern (job-timeline I-113). `money` answers WITHOUT the
  currency character, because `MoneyText` draws the ৳ itself; it is still `formatMoney` that
  writes it, so L-FMT-02's refusal of a badly-shaped amount is the one that fires and no grouping
  is spelled twice (B-17).
- **I-140 — the three doors live in the row's `⋯` menu.** *Amends I-32's "the card's interactive
  elements", and §8's Home/Project fix 2.* Edit, Archive/Restore and the rule-set pin were three
  differently-weighted controls on a card: two ghost buttons and a link. One 28 px trigger holds
  them now — one button style for the lifecycle doors, and the table's last column. The doors are
  the same doors: the same ids, the same plain writes (I-31), the same reversibility (I-35), and
  the pin still makes L-REG-07 visible one press away (R-UI-031). A lifecycle refusal renders
  UNDER ITS OWN ROW through the grid's `renderRefusal` — §5 rule 8's refused-row state — and the
  row is never hidden.
- **I-141 — the teaching state is the shipped `EmptyState`.** *Amends the zero-project branch of
  §1.* It was the shell's own `ShellEmptyState`, which draws the same three things without the
  glyph and outside the primitive set every other empty region now uses (Direction 00 §1's empty
  states row). The id it published — `shell-empty` — is kept byte-identical, so the state matrix,
  the journeys and the baselines still find the region they always found; the SAMPLE offer, its
  copy and its live region are untouched (R-UI-033).
- **I-142 — coverage is stated where it is known, and marked absent where it is not.** §3.3's
  table carries a coverage column. A project with no campaign has nothing measured to cover, so
  the cell wears the readout's own absent mark (`shell_status_absent`, "—") rather than a ramp
  drawn at 0 %, which would state a failure where there is only an absence (R-UI-020). Where a
  share is known the cell is §4.3's sequential ramp — one hue, five lightness steps — beside the
  shipped `CoverageChip`'s percentage: the numeral says the same thing the bar does, so neither
  colour nor length is the only carrier (Q-11). The same reading governs the estimated-value
  tile: until a project holds an estimate the tile states `—`, never `৳ 0.00` (Direction 00 §8's
  reading of `0 USD`).

## 1. Layout and hierarchy

The page renders in `shell-main`; rail, breadcrumb and inspector are the shell's, untouched.
One column, `cx-home`, the full width of main — no page measure, because the table IS the work
surface and a 960 px cap would spend a third of a 1440 viewport on nothing (§7 C1). Column flex,
`gap: var(--space-2)`: 8 px is what puts the table's header at 128 px below the top of main, and
a wider seam costs the fold (§7 C2).

**Title row** — `cx-home-title`, `height: 48px`, flex, space-between, align centre: the shipped
`<h1>` `shell_projects_heading` (`var(--text-20)` `var(--weight-heading)`, margin 0, unchanged),
and on the right `cx-home-title-controls` — the search `Input` (I-138; `aria-label`
`home_search_label`, placeholder `primitive_combobox_filter_placeholder`, 240 px, absent on the
zero-project branch) and the ONE primary, a core Button `data-testid="s-home-create-project"`,
label `home_create_project`, opening the project Sheet (below). The door renders on both
branches; nothing else on this screen is primary.

**Zero-project branch** (`projects-onboarding.tsx`): below the title row, the shipped
`EmptyState` (I-141) — heading `shell_projects_empty_heading`, body `shell_projects_empty_body`,
one primary in its action slot: the SAMPLE offer (`shell-sample-offer`) with its outcome live
region (`shell-sample-outcome`) — copy, ids and behaviour preserved verbatim (R-UI-033; the
shell spec's assertions stay green, and the region keeps the id `shell-empty`). Nothing else
renders: no tiles (I-137), no table, no documents region — a workspace with no projects has
nothing to count and no document sources, and three absence notices on one screen would drown
the one that teaches. The `tests/e2e/baselines/design/shell-*.png` images are re-baselined
against this screen, deliberately, under B-20.

**Stat tiles** (≥ 1 project) — `cx-home-tiles`, `display: grid`, `repeat(4, 1fr)`, gap
`var(--space-2)`, `data-testid="s-home-quick-stats"`. Four shipped `Stat` (value 20 mono, label
12, height `--stat-h`), left to right:

| Tile | Value | Label | Id |
|---|---|---|---|
| projects | `projects.length` through `formatUserFigure` | `shell_nav_projects` | — |
| sheets | the workspace's sum of `quickStats.sheets` | `home_stat_sheets` | `s-home-stat-sheets` |
| campaigns | the sum of `quickStats.campaigns` | `home_stat_campaigns` | `s-home-stat-campaigns` |
| estimated value | `MoneyText` in ৳, lakh/crore, 2 dp — or `—` until a project holds an estimate (I-142) | `home_stat_value` | `s-home-stat-estimates` |

Every figure is the seam's (`formatUserFigure`, `MoneyText`); no count is a literal in JSX, and
a sum over an empty set is an honest zero (I-36's reading, moved up to the tile).

**The table** (≥ 1 project) — `cx-home-table`, `data-testid="s-home-grid"`, holding the one
shipped `DataTable` (`tableId` `s-home-projects`, `aria-label` `shell_projects_heading`): 28 px
rows from the root's `--row-h`, 28 px sticky header, the frozen key column, no wrapping cell —
every cell `nowrap` + ellipsis, and the grid's own `Tooltip` on a cell that is actually clipped
(§5 rules 1–3). Order is `projectsForHome`'s: active by last activity descending, then archived,
archived shown and never hidden. The row is
`data-testid="s-home-project-card" data-project={projectId} data-archived={"true"|"false"}`, and
column state (sort, width, visibility, pinning) is remembered per reader per table.

| # | Column | Size | Cell |
|---|---|---|---|
| 1 | `home_field_name` (sortable) | 260 | the name as a `next/link` `s-home-project-open` to `/t/{t}/p/{project}` (I-131), one line, ellipsis, 1 px `var(--accent)` underline at 2 px offset, `cx-reticle`; a visually-hidden pause; the code in mono `var(--text-caption)` `var(--ink-muted)` when one is stored; `<span data-testid="s-home-project-status" data-status>` holding the archived `Badge` (`s-home-project-archived-badge`) and nothing at all when the project is active (I-35) |
| 2 | `home_field_client` | 180 | the stored text, or `—` (`cx-home-absent`) |
| 3 | `home_field_district` | 140 | the stored text, or `—` |
| 4 | `home_stat_sheets` (sortable, right) | 90 | the count in mono tabular through the seam |
| 5 | `takeoff_register_col_coverage` | 140 | §4.3's ramp bar (`cx-home-ramp`, `data-step` 0–4 over `--cov-0…4`, `aria-hidden`) beside the shipped `CoverageChip`'s percentage — or `—` where no campaign exists (I-142) |
| 6 | `home_col_last_act` (sortable) | 130 | `RelativeTime` `s-home-project-last-activity`, bound to `FIGURES` (I-139): "2 h ago" inside a day, the document date beyond it — and the document date wherever no clock is installed, which is what keeps a capture photographable twice (I-37 is amended: the cell is the primitive's, and the reading is relative where a present is known) |
| 7 | `⋯` | 56 | `ProjectRowMenu` (I-140) |

**The row menu** (`project-row.tsx`) — the shipped `DropdownMenuTrigger` (the ghost Button,
square at `--control-h`, `aria-label` `home_row_actions`, `IconMoreHorizontal`), holding three
items: `project-edit` `home_project_edit` (opens the Sheet prefilled) · by `archived`,
`project-archive` `home_project_archive` or `project-restore` `home_project_restore` (I-35) ·
`s-home-project-ruleset` `home_project_ruleset`, a `next/link` to
`/t/{t}/p/{project}/settings/ruleset` (L-REG-07 made visible). In flight the trigger reports
`aria-busy`; on success the row re-renders (badge, status, item swap) with no animation. A
settled refusal — a signed-in member who is neither tenant OWNER/ADMIN nor a participant,
PERMISSION_NOT_HELD (L-ACT-03) — renders as exactly one `RefusalState` beneath that row, through
the grid's refused-row state (`renderRefusal`, §5 rule 8), registered copy verbatim, evidence
`{ href: /t/{t}, label: home_evidence_projects }`. The doors stay enabled — a retry is never
disarmed.

**Recent documents** — deleted by the rebuild. A heading over one sentence saying nothing has
been issued is the copy §6 moves off the screen, and §3.3's Dashboard template is a title row,
four tiles and one table. The keys stay in the string table for the region that will hold them
when documents exist; nothing renders them today.

**The project form** — one component serving create and edit, in a shipped Sheet
(side right, `aria-label` = the mode's heading). Inside: `<h2>` `home_form_create_heading` /
`home_form_edit_heading` (`var(--text-16)` `var(--weight-heading)`), then
`<form data-testid="project-form">`, fields stacked gap `var(--space-4)`, each label-over-
control at gap `var(--space-1)` (label `var(--text-13)` `var(--weight-body-medium)`
`var(--graphite-700)`; s-auth's field idiom). No placeholders (the s-auth ruling). In order,
testids on the control: `project-name` (Input) · `project-code` (Input) · `project-client`
(Input) · `project-site-address` (Input) · `project-district` (Input; stored text, M0) ·
`project-building-type` — the `<fieldset>` of five Chips per I-33, wrapping row gap
`var(--space-2)` · `project-storeys` (Input, `inputMode="numeric"`) · `project-gfa-m2`
(Input, `inputMode="decimal"`) with hint `home_field_gfa_hint` (`var(--text-12)`
`var(--graphite-600)`, `aria-describedby`) and below it `<output
data-testid="project-gfa-sft">` — the sft value in `var(--font-mono)` `var(--text-13)`
`var(--graphite-900)` `tabular-nums slashed-zero` beside a shipped UnitBadge `sft`, per I-39;
empty until the m² value parses · `project-notes` (Textarea, 3 rows). Then the **answer
slot**, before the submit (the s-auth ordering): `<div data-testid="project-form-refusal">`
holding exactly one of — the I-34 alert line (`role="alert"`, `cx-home-alert`:
`var(--danger-surface)` fill, `var(--hairline)` border re-keyed `border-color:
var(--danger)`, radius `var(--radius-4)`, padding `var(--space-3)` `var(--space-4)`,
`var(--text-13)` `var(--weight-body-medium)` — the shell alert recipe; recorded IOU: one
Alert home, owner: a later primitives increment) — or one RefusalState for a settled refusal:
`SIGNED_OUT` (evidence `{ href: "/sign-in", label: shell_evidence_sign_in }`) and, on the
edit path, `PERMISSION_NOT_HELD` (evidence as the row's). The ids the form carries are
judged before they query (the shell's `scopedTenantId` precedent) — a value naming no project
of this workspace answers PERMISSION_NOT_HELD, never a driver fault. A judged submission also
MOVES FOCUS to the field that stopped it (`project-name`, the first chip of
`project-building-type`, or whichever of `project-gfa-m2` / `project-storeys` the value names):
the sheet is a scrolling column and the answer slot sits at its far end, so an alert alone can
settle below the fold with nothing saying which of nine fields is meant. Focus is both the
pointer and the way back into the form, and the browser scrolls what it focuses into view. That
field also STATES that it is the judged one: `aria-invalid="true"` — the shipped
`.cx-input[aria-invalid="true"]` / `.cx-textarea[aria-invalid="true"]` state, re-used and never
re-invented (B-17); on the chip group, whose `<fieldset>` takes no focus of its own, the group
carries it — plus `aria-describedby` naming the alert line, so a reader who lands on the control
can read the sentence that sent them there instead of hearing the label alone. The gfa field keeps
its hint in that list and gains the alert beside it. And the move re-fires per SUBMISSION, not per
distinct judgement: pressing the door twice with the same field still wrong is two events, and the
second earns the same way back as the first (the form counts its attempts; a state set to the
string it already holds would otherwise bail out of re-rendering and move nothing).
**Answer-and-doors bar** — the answer slot and the footer row are one sticky element
(`.cx-home-form-close`: `position: sticky`, `bottom: 0`, column flex gap `var(--space-4)`,
`border-block-start: var(--hairline)`, `var(--graphite-0)` — the Sheet's own surface — padding-block
`var(--space-4)`), holding the floor of the scrolling Sheet with the fields passing under it. Nine
fields already outrun a laptop's viewport, and inserting the alert grows the column by its own
height: with the doors merely last in that column, a refusal would push the sentence saying what is
wrong AND the door to press again below the fold, while focus moved the other way. Footer row, flex gap
`var(--space-2)`: primary submit `data-testid="project-form-submit"`
(`home_form_submit_create` / `home_form_submit_save`) and a secondary Button
`home_form_cancel` closing the Sheet. In flight: submit loading, fields `readOnly` +
`aria-busy` (never `disabled` — the shell's focus ruling), slot cleared. Success: the Sheet
closes, focus returns to the opening door (the primitive's own behaviour), and the grid
stands updated — the new or changed ROW is the visible answer; no toast.

## 2. States (R-UI-050), ruled cell by cell — declared in `home/states.ts` (I-38)

- **Loading** — delegated: the shipped `t/[tenant]/loading.tsx` skeletons render in
  `shell-main`, frame intact, unchanged (the file is outside this increment's ownership, and
  its heading-plus-lines shape still holds the layout).
- **Empty** — two cells, both through the shipped `EmptyState` (I-141): the zero-project branch
  (§1), whose one offer is the SAMPLE seed with the create door standing above it (R-UI-033);
  and the list filtered to nothing (I-138), whose heading is `primitive_combobox_no_matches` and
  whose way out is the field the reader typed in.
- **Error** — a render or action fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned); its Decision rules retry and records the report-id deferral.
- **Refusal** — the form's answer slot and the row's in-place RefusalState, drawn beneath the
  refused row by the grid's own refused-row state (§1, §5 rule 8); every reachable code named
  there. Silence never happens: every empty region says why.
- **Partial** — impossible as a READ: `projectsForHome` answers one query whole, and no row of
  the table can be refused while its neighbours stand. A lifecycle door refused on one row is the
  refusal cell above, rendered under that row — an answer to an act taken, not a partial answer
  to the question the screen asked.
- **Offline** — a fault of reachability (shell I-20): server-rendered page, failed
  navigation surfaces the error path; no invented banner.
- **Permission-denied** — delegated: `t/[tenant]/layout.tsx` renders the shell's frameless
  denial before this page mounts; unauthenticated is the `/sign-in` redirect. The in-place
  lifecycle denials are the refusal cell above, with the permission's holder named by the
  registered copy (a principal of the project).

## 3. Copy, verbatim (`src/ui/strings/home.ts`, and `home/strings.ts` for the four §3.3 needs)

`home_create_project` **New project** · `home_form_create_heading` **New project** ·
`home_form_edit_heading` **Edit project** · `home_field_name` **Name** · `home_field_code`
**Code** · `home_field_client` **Client** · `home_field_site_address` **Site address** ·
`home_field_district` **District** · `home_field_building_type` **Building type** ·
`home_field_storeys` **Storeys** · `home_field_gfa` **Target GFA (m²)** ·
`home_field_gfa_hint` **Stored in square metres — the square-feet equivalent shows as you
type.** · `home_field_notes` **Notes** · `home_building_type_residential` **Residential** ·
`home_building_type_commercial` **Commercial** · `home_building_type_mixed` **Mixed** ·
`home_building_type_industrial` **Industrial** · `home_building_type_infrastructure`
**Infrastructure** (the enum value travels in the hidden input; the label is prose) ·
`home_form_submit_create` **Create project** · `home_form_submit_save` **Save changes** ·
`home_form_cancel` **Cancel** · `home_form_name_refusal` **A project name needs at least one
visible character — nothing was saved.** · `home_form_type_refusal` **Choose a building type
— nothing was saved.** · `home_form_number_refusal` **Storeys and target GFA need plain
numbers — nothing was saved.** · `home_status_active` **Active** · `home_status_archived`
**Archived** · `home_project_updated` **Updated {date}** (the date is data, filled by the
string seam) · `home_project_ruleset` **View rule set** · `home_stat_sheets` **Sheets** ·
`home_stat_campaigns` **Campaigns** · `home_stat_estimates` **Estimates** · `home_stat_bids`
**Bids** · `home_project_edit` **Edit** · `home_project_archive` **Archive** ·
`home_project_restore` **Restore** · `home_documents_heading` **Recent documents** ·
`home_documents_empty` **Issued documents appear here once your projects produce them —
nothing has been issued yet.** · `home_evidence_projects` **Go to Projects**. Refusal message
and remedy are registry-owned and render as registered; the shell's empty-state and evidence
strings are reused by key, never respelled. Voice: calm, concrete, no exclamation marks, no
build vocabulary.

Reused by key from the shared tables, never respelled (B-17): `shell_projects_heading`,
`shell_nav_projects`, `shell_projects_empty_heading`, `shell_projects_empty_body`,
`shell_sample_offer`, `shell_sample_unavailable`, `shell_status_absent` (the `—` of an absent
cell), `shell_evidence_sign_in`, `primitive_combobox_filter_placeholder` (the search's hint),
`primitive_combobox_no_matches` (the filtered-to-nothing heading) and
`takeoff_register_col_coverage` (the coverage column, whose one home is the register's table).

Four labels the rebuild needs have no home in a shared table, and they are this screen's own:
they live in `src/app/(app)/t/[tenant]/home/strings.ts`, keyed `home_…` like the rest, under the
idiom S-Audit, S-Project, S-Drawings and S-Members already use for a screen's committed copy
(s-settings-ruleset I-24) — so the JSX still spells no string literal. They are
`home_col_last_act` **Last act** · `home_stat_value` **Estimated value** · `home_search_label`
**Search projects** · `home_row_actions` **Project actions**. They belong in
`src/ui/strings/home.ts` and move there, by key and unchanged, the next time that file is
opened; the copy-fidelity walker does not grade this table, because the directory holding it
holds no `page.tsx`.

Retired by the rebuild, and still in the shared table: `home_status_active` (an active project
wears no word — I-35), `home_stat_estimates`/`home_stat_bids` as per-project counts (the value
tile carries `home_stat_value` now), `home_project_updated` (the cell is `RelativeTime`'s),
`home_documents_heading`/`home_documents_empty` (the region is deleted, §1).

## 4. Motion (R-UI-004)

Sheet slide `var(--motion-panel)` `var(--ease)` and its scrim fade — the primitive's own.
Button, chip and link hover colours `var(--motion-state)` `var(--ease)`. Cards, badges,
refusals, the sft readout: no entrance — answers arrive instantly. Every duration is a token
zeroed at source under reduced motion; no bounce anywhere.

## 5. Tokens

Aliases and density/layout tokens only — a `--graphite-*` or `--beam-*` reference outside the
token source is a lint failure now (`cubit/no-primitive-token`, Direction 00 §4): `--ink` ·
`--ink-secondary` · `--ink-muted` · `--ink-link` · `--accent` · `--line` · `--surface-app` ·
`--danger`/`--danger-surface` · `--hairline` · `--cov-0/1/2/3/4` (the coverage ramp, §4.3) ·
`--space-1/2/3/4` · `--radius-4` · `--text-12/13/16/20` · `--text-caption` · `--control-h` ·
`--font-mono` · `--weight-body/--weight-body-medium/--weight-heading` ·
`--motion-state/--motion-panel/--ease`. The row height, the cell padding and the tile height are
read by the primitives from `--row-h`, `--cell-px` and `--stat-h`: this screen states none of
them, and the eight per-screen density overrides are gone (§4.2). Px literals, closed set: the
title row's 48, the search field's 240, the ramp's 56, and the underline's 1 px at 2 px offset.
Any other literal is a defect; the 10.7639 factor is code in `src/core/format.ts`, never a value
in CSS or JSX.

## 6. Themes

`home.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001), and the sheet names no primitive ramp position at all — it reads the
semantic aliases (§5). Contrast holds on founder facts in both themes: `--ink-muted` and
`--ink-secondary` on the app ground ≥ 4.5:1, `--ink` likewise, `--ink-link` ≥ 4.5:1 as link
text, the coverage ramp's steps ≥ 3:1 as a mark whose meaning the numeral beside it also states,
and the danger pair per the refusal-state ruling. Dark is the product's default ground now
(§9.1 item 2); this screen inherits it and states nothing of its own. No basis colour and no
copper appears anywhere on this screen (I-31).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}` (grown, not new) and the pin link's target
`/t/{tenant}/p/{project}/settings/ruleset` (shipped by inc-015, rendered unchanged). Test
ids, exactly the contract's thirty, on the elements ruled in §1: `s-home-grid` ·
`s-home-project-card` · `s-home-project-status` · `s-home-project-last-activity` ·
`s-home-project-ruleset` · `s-home-project-archived-badge` · `s-home-quick-stats` ·
`s-home-stat-sheets` · `s-home-stat-campaigns` · `s-home-stat-estimates` ·
`s-home-stat-bids` · `s-home-recent-documents` · `s-home-create-project` · `project-form` ·
`project-name` · `project-code` · `project-client` · `project-site-address` ·
`project-district` · `project-building-type` · `project-storeys` · `project-gfa-m2` ·
`project-gfa-sft` · `project-notes` · `project-form-submit` · `project-form-refusal` ·
`project-edit` · `project-archive` · `project-restore` · and the preserved
`shell-sample-offer` / `shell-sample-outcome` / `shell-empty`. **No id is added, renamed or
retired by the rebuild** — the registry (`src/ui/testids.ts`) is another node's file and stays
byte-identical; what moved is where an id is carried:

| Id | Was | Is |
|---|---|---|
| `s-home-grid` | the `<ul>` of cards | the region holding the one `DataTable` |
| `s-home-project-card` | the card `<li>` | the table ROW (`rowTestId`), with `data-project`/`data-archived` as before |
| `s-home-quick-stats` | a row of four spans on every card | the four `Stat` tiles of the title block, once (I-136) |
| `s-home-stat-sheets` / `-campaigns` / `-estimates` | a card's own counts | the workspace tiles; `-estimates` carries the value tile (I-142) |
| `s-home-stat-bids` | a card's fourth count | unused — §3.3 fixes four tiles, and bids are not one of them |
| `s-home-project-status` / `-archived-badge` | the card's name row and meta line | the Name cell |
| `s-home-project-last-activity` | the meta line's date | the Last act cell (`RelativeTime`) |
| `s-home-project-ruleset` · `project-edit` · `project-archive` · `project-restore` | controls on the card | items of the row's `⋯` menu, portalled to the document (I-140) |
| `s-home-recent-documents` | the documents region | unused — the region is deleted (§1) |

The grid's own ids come with the primitive and are the foundation's, used and never redefined:
`datatable`, `datatable-row-refusal`, `datatable-viewport`, `datatable-header`, `empty-state`,
`money-text`, `relative-time`, `coverage-chip`, `dropdown-content`, `tooltip-content`,
`refusal-state`. Row-level refusals are found by RefusalState's own ids inside
`datatable-row-refusal`.

Behavioural hooks without new ids: `data-project`/`data-archived` on the row; `data-status` on
the status span; `data-step` on the coverage ramp; `aria-pressed` on the building-type Chips;
`aria-busy` on loading Buttons, the row menu's trigger and in-flight fields; `role="alert"` on
the I-34 line; RefusalState's `data-code`; the pin item's `href`; the `<output>` element for the
sft readout; the row menu's trigger is its row's only `button` (how a page object opens it
without an id of its own).

What the rebuild owes the journeys (B-20, and the owner of `tests/e2e/journeys/**` makes these
edits, not this screen): `j-000` reads the four quick stats INSIDE a card and asserts the
recent-documents region is visible — the stats are the title block's now and the region is gone;
`j-003` presses `project-edit`, `project-archive`, `project-restore` and `s-home-project-ruleset`
inside the row, and they live in the portalled `⋯` menu now (`SHomePage.openRowMenu(projectId)`
opens it, and the item is addressed at the page). Every `tests/e2e/baselines/design/**` image
this screen appears in is invalidated by the rebuild and is regenerated in its own `baseline:`
commit, never by widening a tolerance.

Journeys (page object `tests/e2e/pages/s-home.page.ts`; one gate invocation per journey;
J-nnn in a title literal): `tests/e2e/journeys/j-000/m0-workspace-and-project.spec.ts` — per-run-unique
email, workspace named the fixed **Golden Path Works** through the shipped rename door,
project named the fixed **Riverside Tower**; checkpoints `j-000/workspace-named` and
`j-000/first-project-on-s-home` (grid with the card: status, date, zeros; whole segment
under 120 s measured wall time). `tests/e2e/journeys/j-003-projects.spec.ts` — own per-run
identity; create, edit a visible field, archive, restore; checkpoints
`j-003/project-edited` and `j-003/ruleset-pin-visible` (the inc-015 screen's
`ruleset-edition-identity`/`-digest`). Screenshots pass path-segment array names
(`["j-000", "first-project-on-s-home.png"]`) under the locked `snapshotPathTemplate`; masks,
per V-E2E: every `s-home-project-last-activity` and the top bar's `shell-user` trigger (the
per-run address) — nothing else on the screen is volatile. Axe serious/critical = 0 at every
checkpoint, never widened (Q-11). The four `tests/e2e/baselines/design/shell-*.png` are
regenerated against the grown page (B-20) with the journey lane scoped to the shell spec,
diffs reviewed; `shell.spec.ts` and `shell.page.ts` stay untouched. jsdom acceptance mounts
the form component with @testing-library: field roster and order, the I-33 single-selection
chips, the I-39 readout at the public factor, the I-34 judgements, and both settled-refusal
renderings via an injected perform (the s-auth `SignInForm` precedent).
