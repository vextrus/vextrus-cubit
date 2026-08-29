# Design Decision — S-Home (the projects home at /t/{tenant})

Route: `/t/{tenantId}` — the shell's Projects area home, grown from the shipped empty state
into the projects screen. Files: `src/app/(app)/t/[tenant]/page.tsx` (server component:
resolves the workspace, calls `projectsForHome`, branches), `projects-onboarding.tsx` (the
zero-project branch), `actions.ts` (server actions), and `src/app/(app)/t/[tenant]/home/**`
(grid, card, form, `states.ts`, `home.css`, classes `cx-home-*`). Increment inc-011-projects.
Law: R-SPINE-010/012, L-ACT-03, L-REG-07, R-UI-001/003/004/005/012/020/031/033/050/060, B-17,
B-20, Q-11, Q-17. Every convention of the earlier Decisions binds: `cx-` classes, tokens-only
colour and motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in
authored CSS. Interpretations I-1–I-30 remain in force ("workspace" is the user-facing word
for tenant, s-auth I-11). Chrome comes only from shipped primitives — core Button, Input,
Textarea, Badge, Chip, Skeleton; overlay Sheet; the one RefusalState; the shell's
`ShellEmptyState` — plus the `cx-home-*` classes this file rules. Copy lives in
`src/ui/strings/home.ts` (keys `home_…`, registry append), spread into `strings` by the
barrel; JSX carries no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-31 — creating a project is a plain write, never an act.** The creator becomes PRINCIPAL
  inside `createProject`'s own transaction with `participant_roles.actId` null — the schema's
  own comment says creation "is not an act somebody performed", and L-ACT-03's closed act
  enum holds no CREATE_PROJECT. So the screen shows no copper, no ConsequenceDialog, no
  digest line: a native form submits, the answer arrives in place. The same reading covers
  edit, archive and restore ("archive, restore, field edits" are lifecycle, guarded but not
  acts). Copper scarcity is preserved: nothing on this screen wears act colour.
- **I-32 — the card is not a door.** R-SPINE-013's project home is M1 and out of scope by
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
- **I-36 — quick stats are per card, and the zeros are counted, not typed.** S-Home's clause
  lists status, last activity and quick stats as what each grid entry carries. Each card
  renders the four counts as literal counts of the project's (empty) sheet/campaign/estimate/
  bid sets from `projectsForHome` — honest zeros the later J-000 legs fill, never a hidden
  region and never a `0` literal in JSX.
- **I-37 — last activity is an absolute date through the format seam, and it is masked.** No
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

## 1. Layout and hierarchy

The page renders in `shell-main`; rail, breadcrumb and inspector are the shell's, untouched.
One column, `cx-home`, max-width 960 px, column flex, gap `var(--space-5)`.

**Header row** — flex, space-between, align center: the shipped `<h1>`
`shell_projects_heading` (`var(--text-20)` `var(--weight-heading)`, margin 0, unchanged) and
the create door — a core primary Button, `data-testid="s-home-create-project"`, label
`home_create_project` — opening the project Sheet (below). The door renders on both branches.

**Zero-project branch** (`projects-onboarding.tsx`): below the header row, the shipped
`ShellEmptyState` exactly as the shell Decision rules it — heading
`shell_projects_empty_heading`, body `shell_projects_empty_body`, action slot holding the
SAMPLE offer (`shell-sample-offer`) with its outcome live region (`shell-sample-outcome`) —
copy, ids and behaviour preserved verbatim (R-UI-033; the shell spec's assertions must stay
green). Nothing else renders: no grid, no recent documents — a workspace with no projects has
no document sources, and two absence notices on one screen would drown the one that teaches.
The four `tests/e2e/baselines/design/shell-*.png` are re-baselined to this screen — header
row with the create door above the unchanged empty state — deliberately, under B-20.

**Grid** (≥ 1 project): `<ul data-testid="s-home-grid">` — list-style none, margin/padding 0,
CSS grid `repeat(auto-fill, minmax(320px, 1fr))`, gap `var(--space-4)`. Order: active
projects by `updated_at` descending, then archived by the same — deterministic, archived
shown, never hidden (an archived-only workspace still renders the grid). Each
`<li data-testid="s-home-project-card" data-project={projectId} data-archived={"true"|"false"}>`:
border `var(--hairline)`, radius `var(--radius-8)`, no fill, padding `var(--space-4)`,
column flex, gap `var(--space-2)`:

- **Name row** — the project name, `<p>` `var(--text-14)` `var(--weight-heading)`
  `var(--graphite-900)`, margin 0, single line, ellipsis (text, not a link — I-32); beside it
  the code, when one is stored, in `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`;
  and on an archived card a core Badge `data-testid="s-home-project-archived-badge"` reading
  `home_status_archived` — the scan-level flag, its meaning carried by the word (never
  colour-only).
- **Meta line** — `var(--text-12)` `var(--graphite-600)`, one line: the status
  `<span data-testid="s-home-project-status" data-status={"active"|"archived"}>`
  (`home_status_active`), a `·` separator, the building type's label (§3), `·`, then
  `<span data-testid="s-home-project-last-activity">` — `home_project_updated` with the
  date through the format seam in `var(--font-mono)` `tabular-nums slashed-zero` (I-37).
  On an ARCHIVED card the status span stays — it is the card's status hook, and carries
  `data-status="archived"` — but states no word and takes no separator after it: the Badge in
  the name row above is where that word is said, and saying it twice 25 px apart tells a
  reader nothing they did not just read (I-35). The separator is drawn as a `·` that is
  `aria-hidden` PLUS a visually hidden `", "` (`.cx-home-pause`: absolutely positioned, 1 px,
  `clip-path: inset(50%)`): punctuation stays out of the accessibility tree, but a divider
  that is *only* punctuation leaves the terms announced as one run-on word
  ("ActiveCommercialUpdated 30 Aug 2026"), which is three facts read as none. The pause the
  dot draws for the eye is stated for the ear too, in the one place both are drawn.
- **Archived cards recede.** An archived project is shown, never hidden (§1's ordering), but
  it may not carry the presence of a live one or a grid holding both reads as one class of
  thing: `[data-archived="true"]` softens the hairline to `var(--graphite-100)` and the name
  to `var(--graphite-700)` `var(--weight-body-medium)`. Nothing moves and nothing is filled,
  so restoring costs no reflow — and the meaning is still carried by the word (the Badge),
  never by the softening alone (Q-11).
- **Pin link** — `<a data-testid="s-home-project-ruleset">` to
  `/t/{t}/p/{projectId}/settings/ruleset`, a `next/link` move inside the frame, in the
  evidence-link idiom (`var(--text-13)` `var(--weight-body-medium)` `var(--beam-600)`,
  underlined, hover `var(--beam-500)`, `cx-reticle`), label `home_project_ruleset` (L-REG-07
  made visible: every project shows its pin, I-32 pays the reachability IOU).
- **Quick stats** — `<div data-testid="s-home-quick-stats">`, flex row, gap `var(--space-4)`:
  four `<span>`s, testids `s-home-stat-sheets` / `s-home-stat-campaigns` /
  `s-home-stat-estimates` / `s-home-stat-bids`, each the count in `var(--font-mono)`
  `var(--text-13)` `var(--graphite-900)` `tabular-nums slashed-zero` then the label
  (§3) in `var(--text-12)` `var(--graphite-600)` (I-36).
- **Doors row** — `var(--space-1)` above, flex gap `var(--space-2)`, ghost core Buttons:
  `project-edit` `home_project_edit` (opens the Sheet prefilled) and, by `archived`,
  `project-archive` `home_project_archive` or `project-restore` `home_project_restore`
  (I-35). In flight the pressed Button takes core's loading state; on success the card
  re-renders (badge, status, doors swap) with no animation. A settled refusal — a signed-in
  member who is neither tenant OWNER/ADMIN nor a participant, PERMISSION_NOT_HELD (L-ACT-03)
  — renders below the row as exactly one RefusalState (its own ids; no new wrapper id),
  registered copy verbatim, evidence `{ href: /t/{t}, label: home_evidence_projects }`. The
  doors stay enabled — a retry is never disarmed.

**Recent documents** (≥ 1 project branch): `<section data-testid="s-home-recent-documents"
aria-labelledby>` — `<h2>` `home_documents_heading` (`var(--text-16)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0) over one line
`home_documents_empty`, `var(--text-13)` `var(--graphite-600)` — the honest M0 region: it
says why it is empty (R-UI-020) and promises no action, because none exists yet.

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
edit path, `PERMISSION_NOT_HELD` (evidence as the card's). The ids the form carries are
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
stands updated — the new or changed card is the visible answer; no toast.

## 2. States (R-UI-050), ruled cell by cell — declared in `home/states.ts` (I-38)

- **Loading** — delegated: the shipped `t/[tenant]/loading.tsx` skeletons render in
  `shell-main`, frame intact, unchanged (the file is outside this increment's ownership, and
  its heading-plus-lines shape still holds the layout).
- **Empty** — the zero-project branch (§1): the shipped teaching empty state, its one offer
  the SAMPLE seed, with the create door standing above it (R-UI-033).
- **Error** — a render or action fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned); its Decision rules retry and records the report-id deferral.
- **Refusal** — the form's answer slot and the card's in-place RefusalState (§1); every
  reachable code named there. Silence never happens: both empty regions say why.
- **Partial** — impossible: `projectsForHome` answers one query whole; there are no
  refusable rows.
- **Offline** — a fault of reachability (shell I-20): server-rendered page, failed
  navigation surfaces the error path; no invented banner.
- **Permission-denied** — delegated: `t/[tenant]/layout.tsx` renders the shell's frameless
  denial before this page mounts; unauthenticated is the `/sign-in` redirect. The in-place
  lifecycle denials are the refusal cell above, with the permission's holder named by the
  registered copy (a principal of the project).

## 3. Copy, verbatim (`src/ui/strings/home.ts`)

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

## 4. Motion (R-UI-004)

Sheet slide `var(--motion-panel)` `var(--ease)` and its scrim fade — the primitive's own.
Button, chip and link hover colours `var(--motion-state)` `var(--ease)`. Cards, badges,
refusals, the sft readout: no entrance — answers arrive instantly. Every duration is a token
zeroed at source under reduced motion; no bounce anywhere.

## 5. Tokens

`--graphite-600/700/900` · `--beam-500/600` · `--danger/--danger-surface` · `--hairline` ·
`--space-1/2/3/4/5` · `--radius-4/8` · `--text-12/13/14/16/20` · `--font-mono` ·
`--weight-body-medium/--weight-heading` · `--motion-state/--motion-panel/--ease`. Px
literals, closed set (core I-1's class): the 960 px page measure and the grid's 320 px
column minimum. Any other literal is a defect; the 10.7639 factor is code in
`src/core/format.ts`, never a value in CSS or JSX.

## 6. Themes

`home.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Contrast holds on founder facts in both themes: graphite-600 and
700 on graphite-0 ≥ 4.5:1, graphite-900 likewise, beam-600 on graphite-0 ≥ 4.5:1, the
danger pair per the refusal-state ruling. No basis colour and no copper appears anywhere on
this screen (I-31).

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
`shell-sample-offer` / `shell-sample-outcome`. No others are added; card-level refusals are
found by RefusalState's own ids inside `s-home-project-card`.

Behavioural hooks without new ids: `data-project`/`data-archived` on the card;
`data-status` on the status span; `aria-pressed` on the building-type Chips; `aria-busy` on
loading Buttons and in-flight fields; `role="alert"` on the I-34 line; RefusalState's
`data-code`; the pin link's `href`; the `<output>` element for the sft readout.

Journeys (page object `tests/e2e/pages/s-home.page.ts`; one gate invocation per journey;
J-nnn in a title literal): `tests/e2e/journeys/j-000-golden-path.spec.ts` — per-run-unique
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
