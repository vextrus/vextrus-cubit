# Design Decision — S-Project (the project home)

Route: `/t/{tenantId}/p/{projectId}` under `src/app/(app)/t/[tenant]/p/[project]/**`, inside the
shell frame and behind the membership guard in `t/[tenant]/layout.tsx`. Increment
inc-115-project-home. Law: R-SPINE-013, S-Project, R-AI-005, C-SPINE-PROJECT, L-FMT-02,
R-UI-001/003/004/005/012/020/030/031/050/060, J-010, B-17, B-19, B-20, Q-11, Q-17. Every
convention of the earlier Decisions binds: `cx-` classes, tokens-only colour and motion,
`cx-reticle` solely from its single home, no `[data-theme]` selector in authored CSS.
Interpretations I-1–I-124 remain in force ("workspace" is the user-facing word for tenant, s-auth
I-11; copy lives in `strings.ts` beside the page, s-settings-ruleset I-24; enum values and machine
identifiers render verbatim in mono, participants I-47 / ruleset I-25; dates are absolute through
the format seam, s-home I-37; roles render verbatim, participants I-47). Chrome comes only from
shipped primitives — core Button, Badge, UnitBadge, Skeleton; the one RefusalState — plus the
`cx-project-*` classes this file rules. The screen is a reader: it commits no act, so no copper, no
ConsequenceDialog and no server action appear anywhere on it.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-125 — the seven tabs are links, and they are not the Tabs primitive.** R-UI-031 makes the URL
  the source of truth: activating an area is navigation, not a panel switch, so there is no
  `value`, no `TabsContent` and nothing for Radix Tabs to manage — mounting it here would ship its
  machinery with none of its behaviour in use (S-Audit I-36's class). `cx-project-tabs` is a `<nav>`
  of links over one hairline baseline and it restates none of `.cx-tabs`: in particular **no tab is
  ever marked current and no beam underline renders in the row**, because the screen the reader is
  on is the home above the row, not one of the seven. A row that painted a selection would claim a
  place the reader is not standing in.
- **I-126 — an area with no route is a non-control, not a disabled control.** Four of the seven have
  no screen yet. A `<button disabled>` or a link with `href="#"` is a door that answers nothing; the
  tab renders as a `<span aria-disabled="true">` with no `href`, no role, no tab stop and no
  tooltip, and states its condition in words beside its label (`project_home_tab_unavailable`) —
  colour is never the carrier (R-UI-060). The four are shown, never hidden: the clause's seven areas
  are what this project has, and an area a reader cannot see is an area they cannot plan around.
- **I-127 — the header names the subject, so the `<h1>` is `var(--text-24)`.** Every other screen's
  `<h1>` is a page title at `var(--text-20)`; here the heading is the project itself and all six
  regions are statements about it. The facts under it are a `<dl>` — labelled cells, not prose —
  because four independent facts read as four, and a title block is the idiom of the people who read
  drawings. Only `Project.name`, `client`, `district` → zones and `targetGfaM2` render: code,
  site address, storeys, building type and notes are C-SPINE-PROJECT's edit form's, not S-Project's.
- **I-128 — the ledger's money is a figure and a unit, never `formatMoney`.** `attributedCost` is an
  exact USD decimal string; the money seam renders ৳ under BD document law, and converting is out of
  scope by name. L-FMT-02 already separates the two: "a unit renders from the enum, separately from
  its quantity". Ruling: `formatUserFigure(spend.attributedCost)` in the mono ramp beside a shipped
  UnitBadge reading `USD` from the string table. No ৳ appears anywhere on this screen.
- **I-129 — the participants refusal is this screen's partial cell, and the page still answers.**
  The home composes four independent doors; only `projectParticipants` refuses (its L-ACT-03 guard,
  `PERMISSION_NOT_HELD`, participants I-50). The refusal renders in the roster's own place, in
  place and never hidden (R-UI-020), and the header, tabs, quick actions, AI cost and activity all
  render exactly as they would otherwise. A page-wide denial for a refused roster would withhold
  four answers the reader is entitled to.
- **I-130 — a project the workspace does not hold is absent, not refused.** `projectHeld` false —
  including a segment that is no uuid, judged before any query (the shell's `scopedTenantId`
  precedent) — answers Next's `notFound()`, which wears the root layout. Existence and membership
  stay one answer (Q-12, the viewer's reading); no refusal code is registered for it.
- **I-131 — s-home I-32 is amended: the card is a door.** I-32 ruled the project name plain text
  because no home existed to open. It does now, so on S-Home each card's name becomes a `next/link`
  `s-home-project-open` to `/t/{tenantId}/p/{projectId}` (R-UI-031 paid for the card). Its type is
  unchanged — `var(--text-14)` `var(--weight-heading)` `var(--graphite-900)` — and it gains only a
  1 px `var(--beam-500)` underline at `text-underline-offset: 2px`, hover text `var(--beam-600)`,
  `cx-reticle`. The card's other doors are untouched. Deliberate under B-20; the drift the underline
  costs the committed `j-000/**` and `j-003/**` pictures is inside `maxDiffPixelRatio` 0.002, and if
  it is not, those baselines are regenerated in their own `baseline:` commit, never by widening a
  tolerance.
- **I-132 — five is the screen's number and it is named once.** `RECENT_ACTIVITY_LIMIT = 5` lives
  beside `PROJECT_AREAS` in `home/areas.ts`, imported by the page and by the acceptance, so the cap
  is one fact and no test transcribes it (B-19). Order is `getAuditSurfaces`' own — newest first —
  and each act's date renders absolute through `formatDate(dhakaDateParts(occurredAt))`; no
  RelativeTime, no ticking, out of scope by name.
- **I-133 — a zone list with no book says why it is empty.** `zonesOf` answers the empty roster
  today. Silence never happens (R-UI-020): `project-home-zones` renders `data-count="0"`, no badge,
  and one line `project_home_zones_none` naming the missing pin. The same discipline covers a null
  client, district or GFA — `project_home_unstated` inside the cell, never a blank element and never
  a `0`, which would read as a stated quantity of nothing.
- **I-134 — a screen id that must name a shipped badge rides a `display: contents` wrapper.**
  `UnitBadge` fixes `data-testid="unit-badge"` after its spread, so a caller cannot re-id it, and
  re-drawing the badge to carry `project-home-ai-cost-unit` is the B-17 defect. Ruling: the contract
  id sits on a `<span class="cx-project-unit">` (`display: contents`) wrapping the primitive — it
  adds no box, no chrome and no line of layout, and its text is the badge's text.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments, judges
`projectHeld` per I-130, calls `projectsForHome`, `projectParticipants`, `projectAiSpendOf` and
`getAuditSurfaces(...).acts`, hands one `ProjectHomeData` to the client component),
`loading.tsx`, `home/project-home.tsx` (`"use client"`, exports `ProjectHome({ data })`, mountable
bare under jsdom — `next/link` only, never `useRouter`), `home/areas.ts` (`PROJECT_AREAS`,
`RECENT_ACTIVITY_LIMIT`, the route builders), `home/states.ts` (§2), `home/strings.ts` (keys
`project_home_…`), `home/project-home.css`.

The page renders in `shell-main`, one column `cx-project` — max-width 1080 px (the S-Audit measure),
column flex, `gap: var(--space-5)`. Rail and breadcrumb are the shell's (ruleset I-30): `areaOf`
answers Projects, the rail row carries `aria-current="true"`. The root is
`<div data-testid="project-home" data-project={projectId}>`.

**Header** — `<header data-testid="project-home-header">`, column flex, `gap: var(--space-3)`:
`<h1 data-testid="project-home-name">` the stored name verbatim, `var(--text-24)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0, wrapping. Then the fact block, a `<dl>`
(margin 0) laid out `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`, column gap
`var(--space-5)`, row gap `var(--space-3)`; each cell is a `<div>` of `<dt>` over `<dd>` (margin 0),
`gap: var(--space-1)`. `<dt>`: `var(--text-12)` `var(--graphite-600)`. `<dd>`: `var(--text-13)`
`var(--graphite-900)`. In order:

- **Client** — `project_home_client_label` over `<dd data-testid="project-home-client">`: the stored
  text, or `project_home_unstated` in `var(--graphite-600)` (I-133).
- **District** — `project_home_district_label` over `<dd data-testid="project-home-district">`, same
  two truths.
- **Zones** — `project_home_zones_label` over `<dd data-testid="project-home-zones"
  data-count={zones.length}>`: inline flex, wrap, `gap: var(--space-2)`, one shipped Badge
  `data-testid="project-home-zone-badge" data-book data-zone` per `ZoneBadge`, its content the zone
  verbatim in `var(--font-mono)` and its `aria-label` `project_home_zone_label` filled with zone and
  book; with none, the single line `project_home_zones_none` in `var(--graphite-600)`.
- **Target GFA** — `project_home_gfa_label` over a column cell: `<span
  data-testid="project-home-gfa">` — `formatUserFigure(targetGfaM2)` in `var(--font-mono)`
  `var(--graphite-900)` `tabular-nums slashed-zero` beside a UnitBadge `project_home_unit_m2` —
  then `<span data-testid="project-home-gfa-sft">` — `formatSquareFeet(targetGfaM2)` in the same
  ramp at `var(--graphite-700)` beside a UnitBadge `project_home_unit_sft`. With `targetGfaM2` null,
  `project-home-gfa` holds `project_home_unstated` alone and `project-home-gfa-sft` does not render:
  a conversion of nothing is nothing, and saying "not stated" twice in one cell tells a reader
  nothing they did not just read (the s-home archived-status precedent).

**Tabs** (I-125/I-126) — `<nav data-testid="project-tabs" aria-label={project_home_tabs_label}>`:
flex, wrap, `gap: var(--space-1)`, `border-bottom: var(--hairline)`. One child per entry of
`PROJECT_AREAS`, in clause order, each `data-testid="project-tab" data-area={key}
data-available={"true"|"false"}`, height `var(--space-8)`, padding-inline `var(--space-3)`,
align-items center, `var(--text-13)` `var(--weight-body-medium)`. Available (`drawings` → the
drawings route, `activity` → the audit route, `settings` → the ruleset route): a `next/link` `<a>`,
text `var(--graphite-700)`, hover `var(--graphite-900)`, no underline, `cx-reticle`. Unavailable: a
`<span aria-disabled="true">` with no `href`, text `var(--graphite-500)` (the ≥ 3:1 disabled floor),
`cursor: not-allowed`, its label followed by `project_home_tab_unavailable` in `var(--text-12)`
`var(--graphite-600)`.

**Quick actions** — `<section data-testid="project-quick-actions" aria-labelledby>`: `<h2>`
`project_home_actions_heading` (`var(--text-16)` `var(--weight-heading)` `var(--graphite-900)`,
margin 0), then a flex row, wrap, `gap: var(--space-2)`: exactly three `next/link` `<a
data-testid="project-quick-action" data-action={…} class="cx-btn cx-reticle"
data-variant="secondary">` — the core secondary Button worn as a link (the `sheet-card-open`
precedent, B-17), no underline — `upload-drawings` `project_home_action_upload` → the drawings
route · `browse-sets` `project_home_action_sets` → the sets route · `manage-participants`
`project_home_action_participants` → the participants route.

**Body** — `<div class="cx-project-body">`: grid `minmax(0, 1fr) 320px`, `gap: var(--space-4)`,
`align-items: start`; one column below `min-width: 960px` (the md token's value, the one lawful
literal in a media query — S-Audit's ruling). Left column: AI cost, then recent activity. Right
column: participants. Each region is a `<section aria-labelledby>` card: fill `var(--graphite-50)`,
border `var(--hairline)`, radius `var(--radius-8)`, padding `var(--space-4)`, column flex,
`gap: var(--space-3)` — the S-Audit panel chrome, reused.

- **AI cost so far** (`data-testid="project-home-ai-spend"`, R-AI-005) — `<h2>`
  `project_home_ai_heading`. Then two figure tiles, flex row, `gap: var(--space-6)`: `<p
  data-testid="project-home-ai-cost">` `formatUserFigure(spend.attributedCost)` in
  `var(--font-mono)` `var(--text-24)` `var(--weight-heading)` `var(--graphite-900)` `tabular-nums
  slashed-zero`, beside the I-134 wrapper `data-testid="project-home-ai-cost-unit"` holding a
  UnitBadge `project_home_ai_cost_unit`, over the caption `project_home_ai_cost_caption`
  (`var(--text-12)` `var(--graphite-600)`); and `<p data-testid="project-home-ai-calls">`
  `formatUserFigure(String(spend.calls))` in the same ramp over `project_home_ai_calls_caption`.
  Then `<p data-testid="project-home-ai-outcomes">` — `project_home_ai_outcomes` filled with
  `spend.proposed` and `spend.refused` through `formatUserFigure`, `var(--font-ui)` `var(--text-13)`
  `var(--graphite-700)` `tabular-nums` (a sentence about the calls, so it takes the UI face with
  tabular figures — S-Audit's count-line ruling). With `spend.calls` 0 the three figures still
  render their zeros and `<p data-testid="project-home-ai-none">` `project_home_ai_none` follows in
  `var(--text-13)` `var(--graphite-600)`; above zero that line is absent. Last, `<a
  data-testid="project-home-ai-ledger">` to the audit route, `project_home_ai_ledger`, in the
  evidence-link idiom (`var(--text-13)` `var(--weight-body-medium)` `var(--beam-600)`, underlined,
  hover `var(--beam-500)`, `cx-reticle`), `align-self: start`.
- **Recent activity** (`data-testid="project-home-activity"` on the `<ol>`) — `<h2>`
  `project_home_activity_heading`, hint `project_home_activity_hint` (`var(--text-12)`
  `var(--graphite-600)`), then the list: list-style none, margin 0, padding 0, at most
  `RECENT_ACTIVITY_LIMIT` rows in the answered order. Each `<li
  data-testid="project-home-activity-row" data-act-type={actType}>`: min-height
  `var(--row-comfortable)`, re-keyed `var(--row-compact)` under an ancestor
  `[data-density="compact"]` (the dropzone I-75 mechanism, R-UI-005), `border-top: var(--hairline)`
  after the first, flex, baseline, `gap: var(--space-3)`: the act type verbatim in
  `var(--font-mono)` `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`; the actor
  label `var(--text-13)` `var(--graphite-700)`, ellipsis; then, `margin-left: auto`, the date
  (I-132) in `class="cx-project-activity-when"` `var(--font-mono)` `var(--text-12)`
  `var(--graphite-600)` `tabular-nums slashed-zero`. With no acts, in the list's place `<p
  data-testid="project-home-activity-empty">` `project_home_activity_empty` (`var(--text-13)`
  `var(--graphite-600)`) and no row. In every case the region ends with `<a
  data-testid="project-home-activity-all">` to the audit route, `project_home_activity_all`, the
  evidence-link idiom, `align-self: start`.
- **Participants** (`data-testid="project-home-participants"` on the `<ul>`) — `<h2>`
  `project_home_participants_heading`, hint `project_home_participants_hint`. With a roster: list-
  style none, margin 0, padding 0; one `<li data-testid="project-home-participant"
  data-user={userId}>` per entry in the roster's order, min-height `var(--row-comfortable)` (compact
  as above), `border-top: var(--hairline)` after the first, column flex, `gap: var(--space-1)`: the
  member's label in `class="cx-project-member-label"` `var(--text-13)`
  `var(--weight-body-medium)` `var(--graphite-900)`, ellipsis — from the fold's own read-back
  (participants I-51, imported, never respelled; a digest-keyed account renders
  `spine_participants_member_unnamed`) — then the roles, inline flex, `gap: var(--space-2)`, one
  `<span data-testid="project-home-participant-role" data-role={role}>` each, verbatim in
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` (participants I-47). With
  `{ refusal }` (I-129): in the list's place, `<p>` `spine_participants_denied_permission` and `<p>`
  `spine_participants_denied_holder` (`var(--text-13)` `var(--graphite-700)`, gap
  `var(--space-2)`, both reused by key), then exactly one RefusalState from the registered entry,
  evidence `{ href: the participants route, label: project_home_evidence_participants }`. Nothing
  else in the card changes and no other region is withheld.

## 2. States (R-UI-050), ruled cell by cell

Declared in `home/states.ts`, export `PROJECT_HOME_STATES` — one row, seven cells in the shell
matrix's cell shape — and in `src/ui/screen-states/matrix.tsx` under the key
`/t/[tenant]/p/[project]`, whose refusal and permission-denied cells are
`REFUSAL_ENTRIES.PERMISSION_NOT_HELD` with the participants evidence. `tests/screen-states/**`
reflects over both.

- **Loading** — `loading.tsx`, frame intact, core Skeletons keeping the layout, gap
  `var(--space-3)`, never a spinner (R-UI-004): 32 × 320 px (the name), a row of four 16 × 160 px
  (the fact cells), 32 × min(1080 px, 100 %) (the tab row), a row of three 32 × 160 px (the quick
  actions), then two bones side by side — 200 × min(720 px, 100 %) and 200 × 320 px (the body's two
  columns).
- **Empty** — per region, each saying why (R-UI-020): `project-home-activity-empty` teaches that
  acts record themselves and points at the one action already standing above it (Add drawings);
  `project-home-ai-none` states that no model has been called; `project_home_zones_none` names the
  missing book pin. The screen as a whole cannot be empty — a project always has a name, and the
  roster always holds a principal (R-SPINE-011).
- **Error** — a render or read fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned); its Decision rules retry and records the report-id deferral.
- **Refusal** — the participants card's RefusalState, `PERMISSION_NOT_HELD`, with message, remedy
  and the evidence link to the setting that resolves it. It is the one reachable code: the screen
  runs no procedure and commits no act.
- **Partial** — rendered, per I-129: the roster refuses while the other five regions answer, and the
  refusal stands in the roster's own place rather than replacing the page.
- **Offline** — a fault of reachability (shell I-20): server-rendered read, failed navigation
  surfaces the error path; no invented banner, no data ageing on screen.
- **Permission-denied** — the I-129 in-place branch naming `ADMINISTER_PROJECT` and its holders; a
  workspace the session does not hold is the shell's frameless denial before this route mounts;
  unauthenticated is the `/sign-in` redirect; a project this workspace does not hold is absent
  (I-130).

## 3. Copy, verbatim (`home/strings.ts`, keys `project_home_…`)

`project_home_client_label` **Client** · `project_home_district_label` **District** ·
`project_home_zones_label` **Zones** · `project_home_gfa_label` **Target GFA** ·
`project_home_unstated` **Not stated** · `project_home_zones_none` **No book is pinned to this
project yet, so no zone is derived from its district.** · `project_home_zone_label` **Zone {zone}
under {book}** · `project_home_unit_m2` **m²** · `project_home_unit_sft` **sft** ·
`project_home_tabs_label` **Project areas** · `project_home_tab_drawings` **Drawings** ·
`project_home_tab_takeoff` **Takeoff** · `project_home_tab_assure` **Assure** ·
`project_home_tab_estimate` **Estimate** · `project_home_tab_bid` **Bid** ·
`project_home_tab_activity` **Activity** · `project_home_tab_settings` **Settings** ·
`project_home_tab_unavailable` **Not available yet** · `project_home_actions_heading` **Quick
actions** · `project_home_action_upload` **Add drawings** · `project_home_action_sets` **Browse
drawing sets** · `project_home_action_participants` **Manage participants** ·
`project_home_ai_heading` **AI cost so far** · `project_home_ai_cost_unit` **USD** ·
`project_home_ai_cost_caption` **attributed to this project** · `project_home_ai_calls_caption`
**model calls** · `project_home_ai_outcomes` **{proposed} proposals, {refused} refused** ·
`project_home_ai_none` **No model has been called on this project yet, so nothing has been spent.**
· `project_home_ai_ledger` **Open the model ledger** · `project_home_activity_heading` **Recent
activity** · `project_home_activity_hint` **The five newest acts on this project, newest first.** ·
`project_home_activity_empty` **No acts have been recorded on this project yet. Add drawings above;
every act appears here the moment it is committed.** · `project_home_activity_all` **All activity**
· `project_home_participants_heading` **Participants** · `project_home_participants_hint` **Who
holds which role on this project.** · `project_home_evidence_participants` **Open the project's
participants**.

Reused by key, never respelled (B-17): `spine_participants_denied_permission`,
`spine_participants_denied_holder`, `spine_participants_member_unnamed`
(`src/ui/strings/participants.ts`), and the registered `PERMISSION_NOT_HELD` message and remedy.
`src/ui/strings/screen-states.ts` mirrors, word for word (ARCH-01 bars `src/ui` from importing the
route table): `state_empty_project_home_heading` **No acts recorded yet** ·
`state_empty_project_home_body` ≡ `project_home_activity_empty` · `state_project_home_action` ≡
`project_home_action_upload` · `state_project_home_evidence` ≡
`project_home_evidence_participants`. Matrix-only: `state_partial_project_home` **The header, the
areas, the AI cost and the recent activity all answer even when the participants roster is refused:
that refusal renders in the roster's own place, and nothing else is withheld.**

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary in prose. Act types,
role names, zone and book names, model figures and the project's own stored text are data and
render verbatim as data (ruleset I-25's class), never woven into sentences.

## 4. Motion (R-UI-004)

Nothing on this screen animates: it is a read, and every region arrives complete. The only
transitions are inherited from single homes — tab, quick-action, evidence-link and card-name colour
over `var(--motion-state)` `var(--ease)`; the reticle draw in `reticle.css`; the Skeleton pulse
while `loading.tsx` holds the route. No entrance on the header, the cards, the rows or the refusal;
no bounce, no spinner. Every duration is a token zeroed at source under reduced motion, so
`project-home.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-50/500/600/700/900` · `--beam-500/600` · `--hairline` · `--space-1/2/3/4/5/6/8` ·
`--radius-8` · `--text-12/13/16/24` · `--font-ui`/`--font-mono` · `--leading-ui` ·
`--weight-body-medium`/`--weight-heading` · `--row-comfortable`/`--row-compact` ·
`--motion-state`/`--ease`. Px literals, closed set (core I-1's class): the 1080 px page measure, the
320 px right column, the 200 px fact-cell minimum, the card-name underline's 1 px and 2 px offset,
the md media-query value, and the skeleton bones 16/32/200 × 160/320/720/1080. Any other literal is
a defect; the m² → sft factor is code in `src/core/format.ts` and is spelled nowhere else. No basis
colour, no semantic tint and no copper appears anywhere on this screen — reading a project is never
an act.

## 6. Themes

`project-home.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Contrast holds on the founder values in both themes: graphite-600/700/900
on graphite-0 and on the cards' graphite-50 clear 4.5:1; graphite-500 on the card holds the 3:1
disabled floor for the unavailable tabs, whose meaning is carried by their words in any case;
beam-600 clears 4.5:1 as link text (words take beam-600, never beam-500) and the beam-500 card-name
underline clears the 3:1 UI floor. The cards stand one step off the graphite-0 field, seamed by
hairlines, in both themes.

## 7. Test hooks (closed contract, C-05)

Route introduced: `/t/{tenantId}/p/{projectId}`. Routes linked, all shipped: `/t/{tenantId}`,
`/t/{tenantId}/p/{projectId}/drawings`, `…/drawings/sets`, `…/audit`, `…/settings/ruleset`,
`…/settings/participants`. Test ids, exactly the contract's, on the elements ruled in §1:
`project-home` · `project-home-header` · `project-home-name` · `project-home-client` ·
`project-home-district` · `project-home-zones` · `project-home-zone-badge` · `project-home-gfa` ·
`project-home-gfa-sft` · `project-tabs` · `project-tab` · `project-quick-actions` ·
`project-quick-action` · `project-home-ai-spend` · `project-home-ai-cost` ·
`project-home-ai-cost-unit` · `project-home-ai-calls` · `project-home-ai-outcomes` ·
`project-home-ai-none` · `project-home-ai-ledger` · `project-home-activity` ·
`project-home-activity-row` · `project-home-activity-empty` · `project-home-activity-all` ·
`project-home-participants` · `project-home-participant` · `project-home-participant-role` · and,
on S-Home, `s-home-project-open` (I-131). `unit-badge`, `refusal-state`, `refusal-message`,
`refusal-remedy`, `refusal-evidence-link`, `screen-state`, `sheet-index`, `skeleton` and
`s-home-project-card` are other files' ids, used and never redefined. No others are added; the
headings are found by role and name.

Behavioural hooks without new ids: `data-project` on the root · `data-count` on
`project-home-zones`, equal to the badges it holds · `data-book`/`data-zone` on each badge ·
`data-area` and `data-available` on each tab, with `aria-disabled="true"` and no `href` on the four
· `data-action` and `href` on each quick action · `data-act-type` on each activity row ·
`data-user` on each participant row and `data-role` on each role · RefusalState's `data-code`
inside the participants card · `cx-reticle` on every link · `[data-density]` re-keying the two row
heights. The masked handles are frozen names: `.cx-project-activity-when` and
`.cx-project-member-label`.

Journey: `tests/e2e/project-home.spec.ts`, every title beginning **J-010** and no other tag in the
file, so `pnpm e2e --journey J-010` collects it beside the two upload specs and `--journey J-000`
keeps walking unchanged. Page objects `tests/e2e/pages/s-project.page.ts` and
`tests/e2e/pages/s-home.page.ts`. Checkpoints, axe serious/critical = 0 at each, never widened
(Q-11): **s-project/home** — sign in, open S-Home, follow `s-home-project-open` on the journey
project's card, and at 1440×900 assert the header (name, client, district, `data-count="0"` zones,
GFA in m² and sft), seven tabs with three `data-available="true"`, three quick actions, the AI
figures with the `USD` badge and the none line, activity, and the roster holding the creator as
`PRINCIPAL`; then `toHaveScreenshot` against `tests/e2e/baselines/design/s-project/home.png`
(`["s-project", "home.png"]`, animations disabled, maxDiffPixelRatio 0.002) with `masks()` over the
shell breadcrumb, `shell-user`, `.cx-project-activity-when` and `.cx-project-member-label` — the
per-run texts, and nothing else on the screen is volatile · **s-project/drawings-via-tab** — Tab
travel to the `drawings` tab and Enter: the URL is the drawings route and `sheet-index` is visible
(R-UI-031's visible navigation into J-010's first screen). `tests/e2e/baselines/design/j-003/**` and
`j-000/first-project-on-s-home.png` are owned here for the I-131 underline (B-20). jsdom acceptance
(`tests/ui/project-home/**`) mounts `ProjectHome` bare over injected data: the header's three
absence branches, the zone-count invariant, both GFA figures against the format seam, the seven
tabs' order and availability derived from `PROJECT_AREAS`, the three quick actions' hrefs, the AI
region at zero and above zero, the `RECENT_ACTIVITY_LIMIT` cap over six acts and the empty branch,
and the roster's two arms including the RefusalState's code, remedy and evidence href.
