# Design Decision — S-Project (the project home)

Route: `/t/{tenantId}/p/{projectId}` under `src/app/(app)/t/[tenant]/p/[project]/**`, inside the
shell frame and behind the membership guard in `t/[tenant]/layout.tsx`. Increment
inc-115-project-home, REBUILT for v22 on the Dashboard template (Design Direction 00 §3.3, §5,
§8's "Home / Project (2.9)"). Law: R-SPINE-013, S-Project, R-AI-005, C-SPINE-PROJECT, L-FMT-02,
R-UI-001/003/004/005/012/020/030/031/050/060/082, J-010, B-17, B-19, B-20, Q-11, Q-17, and
Direction 00 §§1, 3.3, 5, 6, 7. Where this file's geometry disagreed with §3, §3 won and the
clauses below are amended in place (Direction 00's precedence rule). Every convention of the
earlier Decisions binds: `cx-` classes, tokens-only colour and motion, `cx-reticle` solely from its
single home, no `[data-theme]` selector in authored CSS. Interpretations I-1–I-142 remain in force
("workspace" is the user-facing word for tenant, s-auth I-11; copy lives in `strings.ts` beside the
page, s-settings-ruleset I-24) — with two of this screen's own amended by the rebuild below: enum
values no longer render verbatim as words (I-146 amends participants I-47), and a date is a
`RelativeTime` reading rather than a bare absolute one (I-147 amends s-home I-37). Chrome comes
only from shipped primitives — core Badge, UnitBadge, Skeleton, **Stat, EmptyState, EnumLabel,
IdChip, RelativeTime, Tooltip**; **data DataTable**; the one RefusalState — plus the `cx-project-*`
classes this file rules. The screen is a reader: it commits no act, so no copper, no
ConsequenceDialog and no server action appear anywhere on it.

## The screen, at 1440×900 (Design Direction 00 §3.3, the Dashboard template, project as subject)

```
┌R─┬─────────────────────────────────────────────────────────────────────────────┐
│  │ ws › Sattva Court ▾ › Project                                   ⌘K ⟳ ✉ ◉ │  top bar 40 (shell's)
│  ├─────────────────────────────────────────────────────────────────────────────┤
│  │ Sattva Court          ● Add drawings  Browse drawing sets  Manage particip… │  title row 48
│  │ Client Sattva Holdings · District Dhaka · Zones R-3 C-1 · GFA 8,400 m² …    │  facts line 24
│  ├─────────────────────────────────────────────────────────────────────────────┤
│  │ Drawings │ Takeoff │ Assure │ Estimate │ Bid │ Activity │ Settings          │  area tabs 32
│  ├─────────────┬─────────────┬─────────────┬───────────────────────────────────┤   (4 disabled,
│  │ 12          │ 3           │ 18.42  USD  │ 4                                 │    tooltip)
│  │ Sheets      │ Campaigns   │ AI cost …   │ Participants                      │  4 × 1fr × 64
│  ├─────────────┴─────────────┴─────────────┴───────────────────────────────────┤
│  │ Recent activity                                                 All activity │  region head 24
│  │ Act                  │ Who               │ When      │ Subject               │  header 28
│  │ Assign participant…  │ rafiq@cubit.test  │ 2 h ago   │ 22222222 ⎘            │  rows 28
│  │ Confirm discipline   │ mina@cubit.test   │ Tue       │ 22222222 ⎘            │
│  │ Participants                                                                 │
│  │ Member               │ Role                                                  │
│  │ rafiq@cubit.test     │ Principal                                             │
│  │ 1,234 model calls · 41 proposals, 7 refused · Open the model ledger          │  the ONE line
└──┴─────────────────────────────────────────────────────────────────────────────┘
```

The activity table's header sits at 24 (the frame's own padding on `shell-main`) + 48 + 24 + 32 +
64 + 24 and five 4 px seams = **232 px below the top of `shell-main`** at both 1440×900 and
1280×800 — inside §7 C2's 240. There is exactly ONE `<p>` in main, and it stands at the FOOT: a
sentence between the tiles and the table would push the work surface down by its own height, and
this one is a readout of the tile above it rather than a heading for anything below (§7 C2, C7). No
section sits over a sentence.

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| title row | `h1` 20/600 the project's stored name, the archived `Badge` when it wears one, and the three doors — one primary (`Add drawings`) and two secondary | 100 % × 48 | — | — | `loading.tsx`: one 32 × 320 bone |
| facts line | one line of `Stat`-style facts: Client · District · Zones (`Badge` per zone) · Target GFA (m² and sft, each with its `UnitBadge`) | 100 % × 24, `nowrap`, per-cell ellipsis | a fact the project states nothing for reads `project_home_unstated`; no book pinned reads `project_home_zones_none` | — | a row of four 16 × 160 bones |
| area tabs | the seven areas as links over one hairline; an area with no screen is `aria-disabled`, focusable, and says its condition in a `Tooltip` | 100 % × 32 | — | — | one 32 × min(1080, 100 %) bone |
| stat tiles | four `Stat` — sheets · campaigns · AI cost so far (figure + `USD` badge) · participants | 4 × 1fr × `--stat-h` 64 | a tile with no figure states `—`: AI at zero calls, participants when the roster refused | — | bones |
| the one line (foot) | the screen's single helper line, last in main: model calls · outcomes · the ledger link — or, at zero calls, `project_home_ai_none` and the ledger link | 100 % × 20 | at zero calls it IS the empty statement (R-UI-020) | — | — |
| activity (primary) | `DataTable`: Act (`EnumLabel`) · Who · When (`RelativeTime`) · Subject (`IdChip`), newest first, capped at `RECENT_ACTIVITY_LIMIT` | flex; rows `--row-h` 28 | `EmptyState` — `state_empty_project_home_heading` over `project_home_activity_empty` | delegated to the root boundary | grid skeleton rows |
| participants | `DataTable`: Member · Role (`EnumLabel`) | rows 28 | the roster always holds a principal (R-SPINE-011) | — | bones |
| — refused | the roster's `RefusalState` in the table's own place (I-129): message, remedy, evidence | in place | — | PERMISSION_NOT_HELD | — |

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-125 — the seven tabs are links, and they are not the Tabs primitive.** R-UI-031 makes the URL
  the source of truth: activating an area is navigation, not a panel switch, so there is no
  `value`, no `TabsContent` and nothing for Radix Tabs to manage — mounting it here would ship its
  machinery with none of its behaviour in use (S-Audit I-36's class). `cx-project-tabs` is a `<nav>`
  of links over one hairline baseline and it restates none of `.cx-tabs`: in particular **no tab is
  ever marked current and no beam underline renders in the row**, because the screen the reader is
  on is the home above the row, not one of the seven. A row that painted a selection would claim a
  place the reader is not standing in.
- **I-126 — an area with no route is a non-control, not a disabled control.** *Amended by I-143:
  it is a disabled control with a tooltip, and the words move off the row into the hint.* Four of the seven have
  no screen yet. A `<button disabled>` or a link with `href="#"` is a door that answers nothing; the
  tab renders as a `<span aria-disabled="true">` with no `href`, no role, no tab stop and no
  tooltip, and states its condition in words beside its label (`project_home_tab_unavailable`) —
  colour is never the carrier (R-UI-060). The four are shown, never hidden: the clause's seven areas
  are what this project has, and an area a reader cannot see is an area they cannot plan around.
- **I-127 — the header names the subject, so the `<h1>` is `var(--text-24)`.** *Amended by I-144:
  the `<h1>` is `var(--text-20)`, the one page-title size §1 allows, and the facts are one line.* Every other screen's
  `<h1>` is a page title at `var(--text-20)`; here the heading is the project itself and all six
  regions are statements about it. The facts under it are a `<dl>` — labelled cells, not prose —
  because four independent facts read as four, and a title block is the idiom of the people who read
  drawings. Only `Project.name`, `client`, `district` → zones and `targetGfaM2` render: code,
  site address, storeys, building type and notes are C-SPINE-PROJECT's edit form's, not S-Project's.
- **I-128 — the ledger's money is a figure and a unit, never `formatMoney`.** *Amended by I-145
  for the zero case: no call made is an absence, stated as one, not a `0` beside a `USD` badge.* `attributedCost` is an
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
- **I-132 — five is the screen's number and it is named once.** *The cap stands; I-147 amends only
  how a date is written — `RelativeTime`, which is deterministic and says the document date where
  no clock is installed.* `RECENT_ACTIVITY_LIMIT = 5` lives
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

### The v22 rebuild's Interpretations (U2, Direction 00 §3.3)

- **I-143 — an area with no screen yet is a DISABLED control with a tooltip, not inline grey
  words.** *Amends I-126.* The old reading was right that a door which answers nothing must not be
  a link, and wrong about where it says so: "Not available yet" printed beside four of seven
  labels put four sentences in a 32 px row, which §8's Home/Project fix 2 names as a defect. The
  tab stays a `<span>` with no `href` and `aria-disabled="true"`, and it becomes FOCUSABLE
  (`tabIndex=0`, `role="link"`) inside the shipped `Tooltip` whose content is
  `project_home_tab_unavailable`: a hint only a pointer can reach is not a hint (R-UI-012). The
  condition is still carried by words, never by colour (R-UI-060), and the four are still shown
  and never hidden.
- **I-144 — the facts are ONE line, and the doors stand in the title row.** *Amends I-127.* Four
  labelled cells stacked over a 200 px auto-fit grid were a block; §3.3's title row is "name +
  client · district → zone badges · GFA (one line of `Stat`-style facts, not four labelled
  paragraphs)". The `<dl>` stays — they are labelled cells and not prose — laid out as one
  `nowrap` line at 24 px, each cell ellipsising inside its own share of it. The `<h1>` returns to
  `var(--text-20)`, the one page-title size §1 allows per screen: the project is the subject of
  the screen, which the breadcrumb and the title row already say, and a 24 px heading made a
  second type size for one word. The "Quick actions" section — a heading over three equal
  secondary buttons — is gone: its three doors are the title row's, ONE of them primary (`Add
  drawings`) and two secondary, which is what "≤ 1 primary button per region" means here.
- **I-145 — `0 USD` is an absence, and an absence is stated as one.** *Amends I-128.* The ledger
  records an exact USD decimal and converting it to ৳ is still out of scope by name, so the tile
  carries the figure and a `USD` `UnitBadge` exactly as I-128 ruled — WHERE THERE IS A FIGURE.
  With no call made, "0 USD" beside a currency badge reads as a measured nothing: §8's fix 3 asks
  for `MoneyText` in ৳ *or* the honest one line, and the honest one line is the truthful half
  here. So at zero calls the tile states the readout's absent mark (`shell_status_absent`) and the
  screen's one helper line says `project_home_ai_none` — **No model calls yet** — with the ledger
  link beside it. AC-3's three figures are still on the screen wherever there is a spend to state:
  cost in the tile, calls and outcomes in the line.
- **I-146 — every SCREAMING enum renders through `EnumLabel`, and every opaque identifier through
  `IdChip`.** *Amends participants I-47 and ruleset I-25 FOR THIS SCREEN.* `PRINCIPAL` is what the
  store holds; "Principal" is what a person reads (§6, §7 C6). The raw value is not deleted — it
  stays in the DOM inside the primitive's `[data-technical]` disclosure and on `data-role` /
  `data-act-type`, so an engineer, an export and a suite all still find it — it is simply not what
  the screen says out loud. The same reading covers an act's subject: a uuid as body text is a C6
  finding, so it renders as an `IdChip` — seven characters on screen, whole in `data-value`, one
  press from the clipboard (R-UI-082).
- **I-147 — recent activity and the roster are 28 px tables, not lists of rows.** *Amends the
  activity and participants clauses of §1.* §3.3 asks for "Recent activity as a 28 px table (act,
  who, when, subject) — not a card with a sentence", and the same is true of a roster of members
  and roles: they are the shipped `DataTable`, which brings the sticky header, the frozen key
  column, no-wrap cells with a tooltip where one is actually clipped, and the remembered column
  furniture (§5). The three card panels are gone with the cards; each region is a 24 px head (its
  `h2` at 14/600, and for activity the evidence link at its right) over its table. The dates are
  `RelativeTime` bound to the screen's `FIGURES` (I-139's binding, S-Home): "2 h ago" within a
  day, the document's date beyond it — and the document's date wherever no clock is installed,
  which is what keeps a capture photographable twice (this amends s-home I-37's "never a relative
  one": the primitive is deterministic by construction, so the objection the old reading rested on
  no longer holds).
- **I-148 — the screen states one helper line and no section explanations.** §7 C7 counts `<p>`
  elements in main outside an empty or refusal state; this screen renders exactly one, the AI
  line. `project_home_activity_hint`, `project_home_participants_hint` and
  `project_home_ai_cost_caption` are not rendered any more — a table whose columns are named does
  not need a sentence saying what the table is. They stay in the copy table for the popovers §6
  moves such explanations into, and rendering none of them is what C7 grades.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments, judges
`projectHeld` per I-130, calls `projectsForHome`, `projectParticipants`, `projectAiSpendOf` and
`getAuditSurfaces(...).acts`, hands one `ProjectHomeData` to the client component), `loading.tsx`,
`home/project-home.tsx` (`"use client"`, exports `ProjectHome({ data })`, mountable bare under jsdom
— `next/link` only, never `useRouter`), `home/areas.ts` (`PROJECT_AREAS`, `QUICK_ACTIONS`,
`RECENT_ACTIVITY_LIMIT`, the route builders), `home/states.ts` (§2), `home/strings.ts` (keys
`project_home_…`), `home/project-home.css`.

The page renders in `shell-main`, one column `cx-project`, the full width of main — the 1080 px
measure is retired, because the table IS the work surface and a cap spends a third of a 1440
viewport on nothing (§7 C1). Column flex, `gap: var(--space-1)` — one seam step, because this is
instrument chrome and every 4 px of it is 4 px the work surface does not get (§7 C2's arithmetic
above). Rail and breadcrumb are the
shell's (ruleset I-30): `areaOf` answers Projects, the rail row carries `aria-current="true"`. The
root is `<div data-testid="project-home" data-project={projectId}>`.

**Title row** — `<header data-testid="project-home-header">` holding `cx-project-title-row`
(`height: 48px`, flex, align centre): `<h1 data-testid="project-home-name">` the stored name
verbatim, `var(--text-20)` `var(--weight-heading)` `var(--ink)`, margin 0, one line with ellipsis
(I-144); the shipped `Badge` reading `home_status_archived` when the project wears that status, and
nothing at all when it does not (the s-home I-35 reading, by the same key); then, pushed right,
`cx-project-title-controls` `data-testid="project-quick-actions"` — the three `QUICK_ACTIONS` as
`next/link`s wearing the core Button (`class="cx-btn cx-reticle"`, the `sheet-card-open` precedent,
B-17), `data-testid="project-quick-action" data-action={key}`: `upload-drawings`
`project_home_action_upload` → the drawings route, at `data-variant="primary"` — the screen's one
primary — then `browse-sets` `project_home_action_sets` → the sets route and
`manage-participants` `project_home_action_participants` → the participants route, both
`data-variant="secondary"`.

**Facts line** — under the title row, the `<dl class="cx-project-facts">` (margin 0), one flex line
at `min-height: 24px`, `white-space: nowrap`, `overflow: hidden`, gap `var(--space-4)`; each cell a
`<div class="cx-project-fact">` of `<dt>` (`var(--text-caption)` `var(--ink-muted)`) beside `<dd>`
(margin 0, `var(--ink)`), ellipsising inside its own share of the line (I-144). In order:

- **Client** — `project_home_client_label` over `<dd data-testid="project-home-client">`: the
  stored text, or `project_home_unstated` in `var(--ink-muted)` (I-133).
- **District** — `project_home_district_label` over `<dd data-testid="project-home-district">`,
  same two truths.
- **Zones** — `project_home_zones_label` over `<dd data-testid="project-home-zones"
  data-count={zones.length}>`: one shipped Badge `data-testid="project-home-zone-badge" data-book
  data-zone` per `ZoneBadge`, its content the zone verbatim and its `aria-label`
  `project_home_zone_label` filled with zone and book; with none, the single short line
  `project_home_zones_none` in `var(--ink-muted)` (I-133 stands; the sentence is four words now,
  because a line of facts has room for a fact and not for a paragraph — §6).
- **Target GFA** — `project_home_gfa_label` over a cell holding `<span
  data-testid="project-home-gfa">` — `formatUserFigure(targetGfaM2)` in `var(--font-mono)`
  `tabular-nums slashed-zero` beside a `UnitBadge` `project_home_unit_m2` — then `<span
  data-testid="project-home-gfa-sft">` — `formatSquareFeet(targetGfaM2)` in the same ramp at
  `var(--ink-secondary)` beside a `UnitBadge` `project_home_unit_sft`. With `targetGfaM2` null,
  `project-home-gfa` holds `project_home_unstated` alone and `project-home-gfa-sft` does not
  render: a conversion of nothing is nothing.

**Area tabs** (I-125, I-143) — `<nav data-testid="project-tabs"
aria-label={project_home_tabs_label}>`: flex, gap `var(--space-1)`, one hairline baseline, no tab
ever marked current — the screen the reader is on is the home above the row, not one of the seven.
One child per entry of `PROJECT_AREAS`, in clause order, each `data-testid="project-tab"
data-area={key} data-available={"true"|"false"}`, `height: 32px`, padding-inline `var(--space-3)`,
`var(--text-body)` `var(--weight-body-medium)`. Available (`drawings`, `takeoff`, `activity`,
`settings`): a `next/link` `<a>`, `var(--ink-secondary)`, hover `var(--ink)`, no underline,
`cx-reticle`. Unavailable: a `<span role="link" aria-disabled="true" tabIndex={0}>` with no `href`,
`var(--ink-disabled)` (the ≥ 3:1 floor), `cursor: not-allowed`, inside the shipped `Tooltip` whose
content is `project_home_tab_unavailable` — and NO inline condition text (I-143).

**Stat tiles** — `cx-project-tiles`, `display: grid`, `repeat(4, 1fr)`, gap `var(--space-2)`. Four
shipped `Stat` (value 20 mono, label 12, height `--stat-h`):

| Tile | Value | Label | Id |
|---|---|---|---|
| sheets | `quickStats.sheets` through the figure seam | `home_stat_sheets` | — |
| campaigns | `quickStats.campaigns` | `home_stat_campaigns` | — |
| AI cost so far | `formatUserFigure(spend.attributedCost)` beside the `USD` `UnitBadge` on the I-134 `display: contents` wrapper — or `—` at zero calls (I-145) | `project_home_ai_heading` | `project-home-ai-spend`, with `project-home-ai-cost` and `project-home-ai-cost-unit` inside it |
| participants | the roster's length — or `—` where the roster refused (I-129) | `project_home_participants_heading` | — |

**Recent activity** (I-147, I-132) — `<section aria-labelledby>`: a 24 px head with `<h2>`
`project_home_activity_heading` (`var(--text-14)` `var(--weight-heading)`) and, at its right, `<a
data-testid="project-home-activity-all">` to the audit route, `project_home_activity_all`, in the
evidence-link idiom. Then `cx-project-table` `data-testid="project-home-activity"` holding the
shipped `DataTable` (`tableId` `s-project-activity`, `aria-labelledby` the heading): rows
`--row-h`, `rowTestId="project-home-activity-row"`, `data-act-type` per row, at most
`RECENT_ACTIVITY_LIMIT` rows in the answered order, newest first, never re-sorted here.

| Column | Size | Cell |
|---|---|---|
| `project_home_col_act` | 230 | `EnumLabel` over `actType` — "Assign participant role", with the raw value in the primitive's technical disclosure (I-146) |
| `project_home_col_who` | 220 | the actor's label, `cx-project-member-label`, one line, ellipsis |
| `project_home_col_when` | 130 | `RelativeTime` `cx-project-activity-when`, bound to the screen's `FIGURES` (I-147) |
| `project_home_col_subject` | 170 | one `IdChip` per subject the act names (I-146) |

With no act, in the table's place the shipped `EmptyState`
`data-testid="project-home-activity-empty"`: heading `state_empty_project_home_heading` (four
words), body `project_home_activity_empty` — the sentence this screen committed and the matrix
mirrors — and no action of its own, because the one it would offer (Add drawings) stands 150 px
above it in the title row.

**Participants** (I-147, I-129) — the same shape: a 24 px head with `<h2>`
`project_home_participants_heading`, then `cx-project-table`
`data-testid="project-home-participants"` holding either the `DataTable` (`tableId`
`s-project-participants`, `rowTestId="project-home-participant"`, `data-user` per row; columns
`spine_participants_field_member` — the member's label in `cx-project-member-label`, from the
fold's own read-back, a digest-keyed account rendering `spine_participants_member_unnamed` — and
`spine_participants_field_role`, one `EnumLabel data-testid="project-home-participant-role"
data-role={role}` per role, I-146) or, with `{ refusal }`, exactly one `RefusalState` from the
registered entry, evidence `{ href: the participants route, label:
project_home_evidence_participants }`. Nothing else on the page changes and no other region is
withheld; the two denial lines that stood above the refusal are the registered entry's own message
and remedy, which `RefusalState` already renders (§7 C7: the region says it once).

**The one line, at the foot** (§7 C7, C2, R-AI-005) — last in main, after the two tables — `<p class="cx-project-line">`, `var(--text-caption)`
`var(--ink-muted)`, the ONLY `<p>` in main. Above zero calls: `<span
data-testid="project-home-ai-calls">` the count in mono, the word `project_home_ai_calls_caption`,
a `·` that is `aria-hidden` beside a visually-hidden pause (`cx-project-pause` — punctuation stays
out of the accessibility tree, but a divider that is only punctuation leaves the terms announced as
one run-on word), `<span data-testid="project-home-ai-outcomes">` `project_home_ai_outcomes` filled
with both counts through the seam, and last `<a data-testid="project-home-ai-ledger">` to the audit
route, `project_home_ai_ledger`, in the evidence-link idiom. At zero calls: `<span
data-testid="project-home-ai-none">` `project_home_ai_none` and the same ledger link, and neither
the calls nor the outcomes span renders — there are no outcomes of nothing to enumerate (I-145).

It stands last because the fold belongs to the work surface: the same sentence between the tiles
and the table pushes the table down by its own height, for a line that is a readout of the tile
above it and a heading for nothing below it. The Direction's own instinct is the same one — a
narrow band of facts at the bottom of an instrument's display (§1's status readout).


## 2. States (R-UI-050), ruled cell by cell

Declared in `home/states.ts`, export `PROJECT_HOME_STATES` — one row, seven cells in the shell
matrix's cell shape — and in `src/ui/screen-states/matrix.tsx` under the key
`/t/[tenant]/p/[project]`, whose refusal and permission-denied cells are
`REFUSAL_ENTRIES.PERMISSION_NOT_HELD` with the participants evidence. `tests/screen-states/**`
reflects over both.

- **Loading** — `loading.tsx`, frame intact, core Skeletons keeping the layout, gap
  `var(--space-3)`, never a spinner (R-UI-004): 32 × 320 px (the name), a row of four 16 × 160 px
  (the fact cells), 32 × min(1080 px, 100 %) (the tab row), a row of three 32 × 160 px (the doors),
  then two bones — the two tables. The file stands unchanged by the rebuild (it is not this node's,
  and its bones still hold a title, a line of facts, a tab row and two blocks); the last row's two
  side-by-side bones now stand for the two tables rather than for two columns, and the owner of
  `loading.tsx` is owed that one-line correction.
- **Empty** — per region, each saying why (R-UI-020): `project-home-activity-empty` teaches that
  acts record themselves and points at the one action already standing above it (Add drawings);
  `project-home-ai-none` states that no model has been called (and the tile beside it states the
  absent mark rather than a zero — I-145); `project_home_zones_none` names the missing book pin. The screen as a whole cannot be empty — a project always has a name, and the
  roster always holds a principal (R-SPINE-011).
- **Error** — a render or read fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned); its Decision rules retry and records the report-id deferral.
- **Refusal** — the participants table's RefusalState, `PERMISSION_NOT_HELD`, with message, remedy
  and the evidence link to the setting that resolves it. It is the one reachable code: the screen
  runs no procedure and commits no act.
- **Partial** — rendered, per I-129: the roster refuses while the title, the facts, the areas, the
  tiles, the one line and the activity table all answer, and the refusal stands in the roster's own
  place rather than replacing the page. The participants TILE states `—` in the same breath: a
  count of a roster nobody may read is not zero, it is unknown (I-145's reading, applied twice).
- **Offline** — a fault of reachability (shell I-20): server-rendered read, failed navigation
  surfaces the error path; no invented banner, no data ageing on screen.
- **Permission-denied** — the I-129 in-place branch naming `ADMINISTER_PROJECT` and its holders; a
  workspace the session does not hold is the shell's frameless denial before this route mounts;
  unauthenticated is the `/sign-in` redirect; a project this workspace does not hold is absent
  (I-130).

## 3. Copy, verbatim (`home/strings.ts`, keys `project_home_…`)

`project_home_client_label` **Client** · `project_home_district_label` **District** ·
`project_home_zones_label` **Zones** · `project_home_gfa_label` **Target GFA** ·
`project_home_unstated` **Not stated** · `project_home_zones_none` **No book pinned** (four words,
because it stands inside one line of facts — the reason in full is the Decision's, not the
screen's; §6, I-144) · `project_home_zone_label` **Zone {zone}
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
`project_home_ai_none` **No model calls yet** (§8's own words for this line, I-145)
· `project_home_ai_ledger` **Open the model ledger** · `project_home_activity_heading` **Recent
activity** · `project_home_activity_hint` **The five newest acts on this project, newest first.** ·
`project_home_activity_empty` **No acts have been recorded on this project yet. Add drawings above;
every act appears here the moment it is committed.** · `project_home_activity_all` **All activity**
· `project_home_participants_heading` **Participants** · `project_home_participants_hint` **Who
holds which role on this project.** · `project_home_evidence_participants` **Open the project's
participants** · and the four column names the rebuild's two tables need (I-147):
`project_home_col_act` **Act** · `project_home_col_who` **Who** · `project_home_col_when` **When** ·
`project_home_col_subject` **Subject**.

Committed but not rendered today, and kept in the table for the popovers §6 moves explanations
into (I-148): `project_home_actions_heading` (the "Quick actions" heading is gone with the
section; the string is the `⋯`-style accessible name any later menu of those doors would take),
`project_home_activity_hint`, `project_home_participants_hint`, `project_home_ai_cost_caption`.

Reused by key from the shared tables, never respelled (B-17): `spine_participants_member_unnamed`,
`spine_participants_field_member`, `spine_participants_field_role` (the roster's two column names —
their one home is the participants screen), `home_status_archived` (the flag S-Home's own row wears
for the same fact), `home_stat_sheets`, `home_stat_campaigns` (the two tiles' labels),
`shell_status_absent` (the `—` of an absent figure), `state_empty_project_home_heading` (the
activity empty state's title), and the registered `PERMISSION_NOT_HELD` message and remedy.
`spine_participants_denied_permission` and `spine_participants_denied_holder` are no longer
rendered above the refusal: the registered entry's own message and remedy say the same two things,
and a region that says them twice is the copy §7 C7 counts (I-148).
`src/ui/strings/screen-states.ts` mirrors, word for word (ARCH-01 bars `src/ui` from importing the
route table): `state_empty_project_home_heading` **No acts recorded yet** ·
`state_empty_project_home_body` ≡ `project_home_activity_empty` · `state_project_home_action` ≡
`project_home_action_upload` · `state_project_home_evidence` ≡
`project_home_evidence_participants`. Matrix-only: `state_partial_project_home` **The header, the
areas, the AI cost and the recent activity all answer even when the participants roster is refused:
that refusal renders in the roster's own place, and nothing else is withheld.**

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary in prose. Zone and
book names, model figures and the project's own stored text are data and render verbatim as data
(ruleset I-25's class), never woven into sentences — but an act type and a role are CLOSED ENUMS,
and those render in words through `EnumLabel` with the raw value kept in the technical disclosure
(I-146 amends I-47/I-25 for this screen).

## 4. Motion (R-UI-004)

Nothing on this screen animates: it is a read, and every region arrives complete. The only
transitions are inherited from single homes — tab, door, evidence-link and row-hover colour
over `var(--motion-state)` `var(--ease)`; the reticle draw in `reticle.css`; the Skeleton pulse
while `loading.tsx` holds the route. No entrance on the header, the cards, the rows or the refusal;
no bounce, no spinner. Every duration is a token zeroed at source under reduced motion, so
`project-home.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

Aliases and density/layout tokens only — a `--graphite-*` or `--beam-*` reference outside the token
source is a lint failure now (`cubit/no-primitive-token`, Direction 00 §4): `--ink` ·
`--ink-secondary` · `--ink-muted` · `--ink-disabled` · `--ink-link` · `--accent` · `--hairline` ·
`--space-1/2/3/4` · `--text-14/20` · `--text-body` · `--text-caption` · `--font-mono` ·
`--leading-ui` · `--weight-body-medium`/`--weight-heading` · `--motion-state`/`--ease`. The row
height, the cell padding and the tile height are read by the primitives from `--row-h`, `--cell-px`
and `--stat-h`: this screen states none of them, and the per-screen `[data-density]` re-keying of
the two row heights is deleted with the rows it re-keyed (§4.2). Px literals, closed set: the title
row's 48, the facts line's 24, the tab row's 32, the region head's 24, and the loading leg's bones
(16/32/200 × 160/320/720/1080, in `loading.tsx`). The 1080 px page measure, the 320 px right column,
the 200 px fact-cell minimum, the card-name underline and the md media query are all retired with
the two-column body. Any other literal is a defect; the m² → sft factor is code in
`src/core/format.ts` and is spelled nowhere else. No basis colour, no semantic tint and no copper
appears anywhere on this screen — reading a project is never an act.

## 6. Themes

`project-home.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001), and the sheet names no primitive ramp position at all — it reads the
semantic aliases (§5). Contrast holds in both themes: `--ink-muted`/`--ink-secondary`/`--ink` on
the app ground clear 4.5:1; `--ink-disabled` holds the 3:1 floor for the four unavailable tabs,
whose condition is carried by the tooltip's words in any case (I-143); `--ink-link` clears 4.5:1 as
link text. The tiles stand one step off the field on `--surface-raised`, seamed by hairlines, in
both themes; dark is the product's default ground now (§9.1 item 2) and this screen inherits it,
stating nothing of its own.

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
`s-home-project-card` are other files' ids, used and never redefined. **No id is added, renamed or
retired by the rebuild** — the registry (`src/ui/testids.ts`) is another node's file and stays
byte-identical; what moved is where an id is carried: `project-home-ai-spend` is the AI TILE (with
`project-home-ai-cost` and `project-home-ai-cost-unit` inside it) rather than a card;
`project-home-ai-calls` and `project-home-ai-outcomes` are spans of the one helper line, and
neither renders at zero calls (I-145); `project-home-activity` and `project-home-participants` are
the regions holding the two `DataTable`s, and `project-home-activity-row` /
`project-home-participant` are those tables' `rowTestId`s; `project-home-activity-empty` is the
shipped `EmptyState`; `project-quick-actions` is the title row's door group. The grid's and the
primitives' own ids come with them and are the foundation's, used and never redefined: `datatable`,
`datatable-viewport`, `datatable-header`, `empty-state`, `enum-label` (unset — `EnumLabel` carries
the caller's id), `id-chip`, `relative-time`, `tooltip-content`. No others are added; the headings
are found by role and name.

Behavioural hooks without new ids: `data-project` on the root · `data-count` on
`project-home-zones`, equal to the badges it holds · `data-book`/`data-zone` on each badge ·
`data-area` and `data-available` on each tab, with `aria-disabled="true"` and no `href` on the four
· `data-variant` (`primary` on exactly one), `data-action` and `href` on each quick action ·
`tabIndex=0`, `role="link"` and the tooltip trigger's own `data-state` on each unavailable tab
(I-143) · `data-act-type` on each activity row · `data-user` on each participant row and
`data-role` on each role · `data-value` on every `EnumLabel` and `IdChip`, which is where the raw
enum and the whole identifier stay (I-146) · RefusalState's `data-code` inside the participants
region · `cx-reticle` on every link · `[data-density]` at the ROOT, which is the one switch the
two tables read `--row-h` from (§4.2). The masked handles are frozen names:
`.cx-project-activity-when` and `.cx-project-member-label`, both still carried by the cells that
hold those two per-run texts.

Journey: `tests/e2e/project-home.spec.ts`, every title beginning **J-010** and no other tag in the
file, so `pnpm e2e --journey J-010` collects it beside the two upload specs and `--journey J-000`
keeps walking unchanged. Page objects `tests/e2e/pages/s-project.page.ts` and
`tests/e2e/pages/s-home.page.ts`.

What the rebuild owes that journey (B-20, and the owner of `tests/e2e/**` specs makes these edits,
not this screen): the checkpoint asserts `aiCost` matches `/\d/` and `aiCostUnit` reads `USD` on a
project with NO model call — at zero calls the tile states `—` and wears no currency badge (I-145),
so those two lines become the absent-mark reading; and it asserts a participant role reads
`PRINCIPAL` as visible text, which is now "Principal" with `PRINCIPAL` in the technical disclosure
and on `data-role` (I-146). Every `tests/e2e/baselines/design/s-project/**` image is invalidated by
the rebuild and is regenerated in its own `baseline:` commit, never by widening a tolerance. Checkpoints, axe serious/critical = 0 at each, never widened
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
