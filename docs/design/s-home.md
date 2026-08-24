# Design Decision — S-Home (projects grid, create project, recent documents)

`/t/{tenantSlug}` becomes the workspace home the Bible's S-Home names: the projects grid with
status, last activity and quick stats, the create-project affordance, and recent documents
(R-SPINE-010, R-UI-033, J-000, J-003). It renders inside the shell (`docs/design/shell.md`) in
`shell-main`'s centred 720 px column and supersedes shell §4's tenant-home bullet (the
sessions-teaching EmptyState) and shell §4's projects-area placeholder dialog. This file also
decides `/t/{tenantSlug}/projects` and the create form at `/t/{tenantSlug}/projects/new`,
because the three routes share one region. Token names are `docs/design/datum-tokens.md`;
component anatomy is `datum-primitives.md` / `datum-patterns.md`; no colour literal anywhere
(R-UI-001). The project-settings panes are `docs/design/s-project-settings-project-fields-pane-participants-pane-ruleset-pane-untouched.md` ("the panes file").

Interpretations recorded:

1. **The wrapper keeps `tenant-home` and the h1 stays the tenant name.** J-001's page object
   waits on `tenant-home` at every landing, and shell.spec reads the breadcrumb against the
   page's first heading — on `/t/{slug}` the breadcrumb is the tenant name alone. Neither file
   is in ownership, so both facts are law: S-Home's wrapper carries
   `data-testid="tenant-home"` and its one h1 is the tenant name, slug beneath in `--font-mono`
   `--text-12` `--graphite-600` (the s-auth §6 head, kept).
2. **`/projects/new` is the projects area with the create Dialog open.** shell.spec asserts the
   projects empty-state action produces a visible `dialog-content`; the URL is the source of
   truth (R-UI-031); both are honoured at once by making the form a route-driven Dialog over
   the `/t/{slug}/projects` area. Every path to creation navigates there; a fresh GET renders
   the area with the Dialog already open; closing it (Escape, scrim, Cancel, close button)
   navigates back to `/t/{slug}/projects`. The `tenant.projects.*` key names are kept and
   re-worded (⊙ in §8, the s-settings precedent); `tenant.projects.create.sample` keeps its
   value but is no longer rendered — the SAMPLE offer is deferred out of scope.
3. **Required fields are name and code; every other R-SPINE-010 field is optional.** A project
   is citable by name and code from birth; client, site address, district, building type,
   storeys, target GFA and notes can be added later from the project pane. Building type is
   the closed enum residential | commercial | mixed | industrial | infrastructure, stored
   verbatim, displayed as §5's human labels; storeys must be a whole number; target GFA is a
   decimal string end to end (B-07 — no float anywhere).
4. **Last activity is the act log's newest row for the project.** Every project has at least
   its founding `ASSIGN_PARTICIPANT_ROLE` act, so the line always has a value; metadata edits
   are not acts (panes file Interpretation 1) and do not move it.
5. **The default grid is unarchived only; `?archived=1` reveals the rest.** Archived projects
   stay reachable: when any exist, `home-show-archived` toggles the query param (R-UI-031) and
   archived cards join the grid carrying their Archived status. AC-3's "leaves the default
   S-Home grid" is exactly the unqualified URL.
6. **A card is one anchor to `/t/{slug}/p/{id}/settings/project`.** R-SPINE-013's project home
   is M1; settings is the project's only destination today, and one anchor per card keeps the
   grid clean for axe and keyboard. Creation also lands there — the saved fields on screen are
   the confirmation.
7. **Quick stats are true zeros.** No sheets, campaigns, estimates or bids tables exist at M0;
   the four counts render 0 through the count seam because zero is the fact, not a mock.
8. **Closing the create Dialog moves focus to the create affordance** of the page it returns
   to (`empty-state-action` or `home-create-project`). A route-driven Dialog has no Radix
   trigger to restore focus to, and stranding focus on `<body>` is a known defect of the
   controlled pattern; the landing page sets it after the Dialog unmounts.

## 1. Layout and hierarchy — `/t/{tenantSlug}`

Inside `shell-main`'s centred 720 px column, padding `--space-6`. Wrapper
`data-testid="tenant-home"`. Stacked: the h1 (tenant name, `--text-20` `--weight-heading`
`--graphite-950`), the slug line, `--space-6`, the projects section (§2–§3), `--space-8`, the
recent-documents section (§6). The grid dominates; chrome recedes. The route stays guarded by
`tenantContext(slug)` before any byte; no `loading.tsx` exists under `/t` (shell
Interpretation 4 stands).

**Projects section head** — one row, `<h2>` `project.home.projectsTitle` (`--text-16`
`--weight-heading` `--graphite-950`) left; right-aligned, `data-testid="home-create-project"`:
an anchor styled as a primary Button, label `project.home.create`, to
`/t/{slug}/projects/new`. Always rendered, projects or none — creation is never more than one
click from home (R-UI-033).

## 2. The grid (`home-projects`)

`--space-3` below the head. A CSS grid, two equal columns at `--breakpoint-sm` and up, one
below, gap `--space-3`. One `project-card` per project in scope (§ Interpretation 5), ordered
by last activity descending — the working set first, ties by `createdAt` descending.

**`project-card`** — an `<a>` to the project's settings pane (Interpretation 6), carrying
`data-project-id` and `data-status="active" | "archived"`: background `--graphite-0`, hairline
border `--graphite-200`, `--radius-8`, padding `--space-3`, `datum-focus-ring`; hover fill
`--graphite-100` over `--motion-state-duration`. Stacked with `--space-2` gaps:

1. Name row: the project name (`--text-14` `--weight-body-medium` `--graphite-950`, single
   line, ellipsis — the anchor's accessible name), then right-aligned
   `data-testid="project-card-status"`: a neutral Badge, `project.home.status.active` /
   `.archived` per the row's status. Words carry the meaning, never tint (R-UI-060).
2. The code, `--font-mono` `--text-12` `--graphite-600` — the identifier treatment.
3. `data-testid="project-card-stats"`: one 20 px row, `--text-12` `--graphite-600`, four
   pairs separated by `--space-3`: label (`project.home.stats.sheets/campaigns/estimates/
   bids`) then its count in `.numeric` `--graphite-800` through the count seam — all 0 at M0
   (Interpretation 7).
4. Last activity: `project.home.lastActivity` with the time slot device-local
   `YYYY-MM-DD HH:mm` in `.numeric` (the sessions idiom), `--text-12` `--graphite-600`.

**`home-show-archived`** — rendered `--space-3` below the grid only when archived projects
exist: an anchor styled as a ghost Button, `project.home.showArchived` with the archived count
(count seam) in the slot, to the same path with `?archived=1`; on the qualified URL its label
is `project.home.hideArchived` and it links back without the param.

## 3. The teaching empty state (`home-empty`, R-UI-033)

When no unarchived project exists, the grid is replaced by a wrapper
`data-testid="home-empty"` holding the patterns EmptyState: title `tenant.home.empty.title`,
teach `tenant.home.empty.teach`, action `tenant.home.empty.action` (`empty-state-action`)
navigating to `/t/{slug}/projects/new`. The keys are s-auth §10's, re-worded (⊙ §8). If
archived projects exist, `home-show-archived` renders below it — an empty grid with hidden
members still says where they are (R-UI-020).

## 4. `/t/{tenantSlug}/projects` and `/t/{tenantSlug}/projects/new`

The projects area renders §2–§3's region verbatim (same test ids) under its own h1
`tenant.projects.title`, breadcrumb and `aria-current` per shell §3–§4 — minus the
recent-documents section, which is home's alone. Its EmptyState keeps the locked keys
`tenant.projects.empty.*` (values stand, still true) and its action now navigates to
`/t/{slug}/projects/new` (Interpretation 2).

`/t/{slug}/projects/new` renders that same area with the Dialog (primitives §11) open:
width `min(480px, calc(100vw - var(--space-8)))`, Title `tenant.projects.create.title`,
Description `tenant.projects.create.body`, then the form (§5). Internal scroll when the
viewport is short; the Title stays visible.

## 5. The create form (`project-form`)

A `<form>`, `--space-3` below the Description, stacked rows gap `--space-3`. Each field: a
`<label>` (`--text-13` `--weight-body-medium` `--graphite-700`) `--space-1` above its control
(the s-auth field idiom); paired rows split the width with gap `--space-2` and stack below
`--breakpoint-sm`. In order:

1. `project-field-name` — Input, label `project.form.name`. Required.
2. Pair: `project-field-code` — Input, label `project.form.code`, value styled `--font-mono`
   (an identifier). Required. · `project-field-client` — Input, label `project.form.client`.
3. `project-field-site-address` — Input, label `project.form.siteAddress`.
4. Pair: `project-field-district` — Input, label `project.form.district` (stored and
   displayed only; zone derivation is M5). · `project-field-building-type` — Select, label
   `project.form.buildingType`, placeholder `project.form.buildingTypePlaceholder`, five
   options labelled `project.buildingType.residential` Residential / `.commercial` Commercial
   / `.mixed` Mixed / `.industrial` Industrial / `.infrastructure` Infrastructure — values
   the closed enum verbatim.
5. Pair: `project-field-storeys` — NumberInput, label `project.form.storeys`, no unit. ·
   `project-field-gfa-m2` — NumberInput, label `project.form.gfaM2`, unit
   `project.form.unitM2` (m²).
6. `project-field-notes` — Textarea, label `project.form.notes`, three lines.
7. Footer, right-aligned, gap `--space-2`: a secondary Button `project.form.cancel` (closes
   per Interpretation 2), then `project-submit` — a primary Button `project.form.submit`.

**Validation, client-side, no request made:** empty name → `project.form.nameRequired`; empty
code → `project.form.codeRequired`; storeys with a fraction → `project.form.storeysWhole`.
Each renders `--text-12` `--danger` directly under its field with `aria-invalid` on the
control (primitives §3) and a `--motion-state-duration` fade; the first invalid field takes
focus. **Submit:** the button enters its loading state and calls `createProject`; success
navigates to `/t/{slug}/p/{id}/settings/project` (Interpretation 6). A request that never
completes renders `project.form.failed` (`role="alert"`, `data-testid="project-form-error"`,
`--text-13` `--danger`) above the footer; nothing was created, the entries stand.

## 6. Recent documents (`home-recent-documents`)

`<h2>` `project.home.documentsTitle` (`--text-16` `--weight-heading` `--graphite-950`),
`--space-3`, then the region `data-testid="home-recent-documents"`: the list-card surface
(background `--graphite-0`, hairline border `--graphite-200`, `--radius-8`) holding, at M0,
one quiet line `project.home.documentsNone` (`--text-13` `--graphite-600`, padding
`--space-4`) — the designed M0 state: no documents table exists, and the line says what will
arrive rather than sitting silent (R-UI-020). Rows of real documents are a later increment's
design.

## 7. States roster (R-UI-050)

- **loading** — nothing streams (shell Interpretation 4); the grid renders server-side from
  one `listProjects` read. Should a later increment stream it, the skeleton is card-shaped:
  four 108 px bordered blocks in the §2 grid, Skeleton bars inside, ShellAreaState's
  announcement idiom.
- **empty** — §3; on `/projects` the area's locked EmptyState (§4). Recent documents' empty
  is §6's line.
- **error** — a failed read hits the shell boundary (`ErrorState`, report id, retry, shell
  §6). The form's own failure is §5's alert line.
- **refusal** — none minted: reading the grid is membership, creation performs no act (the
  founding grant is inside `createProject`, refusable only by the seam's own guards, which no
  M0 form input can trip).
- **partial** — none: one query, whole answers. PartialNotice stands ready.
- **offline** — the shell's OfflineBanner above the area; cards stay readable; a submit while
  offline fails into §5's alert line.
- **permission-denied** — minted by no path: membership is the read right; a non-member gets
  the 404 (Q-12).

## 8. Copy, verbatim

Joins `TENANT_STRINGS` in `src/app/t/strings.ts` (frozen, typed). ⊙ = key exists, value
re-worded here; key names locked. No string literal in JSX except test ids.

| Key | Value |
|---|---|
| ⊙ `tenant.home.empty.title` | No projects yet. |
| ⊙ `tenant.home.empty.teach` | Create the first project. It starts with a name and a code; drawings and measurement follow from there. |
| ⊙ `tenant.home.empty.action` | Create a project |
| ⊙ `tenant.projects.create.body` | Name the project and give it a code. Everything else here is optional and can be changed later in the project's settings. |
| `project.home.projectsTitle` | Projects |
| `project.home.create` | New project |
| `project.home.status.active` | Active |
| `project.home.status.archived` | Archived |
| `project.home.stats.sheets` | Sheets |
| `project.home.stats.campaigns` | Campaigns |
| `project.home.stats.estimates` | Estimates |
| `project.home.stats.bids` | Bids |
| `project.home.lastActivity` | Last activity {time} |
| `project.home.showArchived` | Show archived ({count}) |
| `project.home.hideArchived` | Hide archived |
| `project.home.documentsTitle` | Recent documents |
| `project.home.documentsNone` | No documents yet. Uploaded drawings and generated documents will appear here. |
| `project.form.name` | Name |
| `project.form.code` | Code |
| `project.form.client` | Client |
| `project.form.siteAddress` | Site address |
| `project.form.district` | District |
| `project.form.buildingType` | Building type |
| `project.form.buildingTypePlaceholder` | Select a type |
| `project.buildingType.residential` | Residential |
| `project.buildingType.commercial` | Commercial |
| `project.buildingType.mixed` | Mixed |
| `project.buildingType.industrial` | Industrial |
| `project.buildingType.infrastructure` | Infrastructure |
| `project.form.storeys` | Storeys |
| `project.form.gfaM2` | Target GFA |
| `project.form.unitM2` | m² |
| `project.form.notes` | Notes |
| `project.form.cancel` | Cancel |
| `project.form.submit` | Create project |
| `project.form.nameRequired` | Enter a name. |
| `project.form.codeRequired` | Enter a code. |
| `project.form.storeysWhole` | Storeys must be a whole number. |
| `project.form.failed` | The request did not complete. Check your connection and try again. |

Calm, concrete, sentence case, no exclamation marks, no build or internal vocabulary.
`tenant.projects.empty.*`, `tenant.projects.title` and `tenant.projects.create.title/sample`
keep their shell §7 values.

## 9. Motion (R-UI-004)

| Where | Duration | Easing |
|---|---|---|
| Card hover fill, validation-line arrival, form alert arrival | `--motion-state-duration` (160 ms) | `--motion-ease` |
| The create Dialog enter/exit | per primitives §11/§15 | — |

Nothing else moves; grid reflow on archive-toggle is instant (a navigation). Reduced motion:
token durations zero via tokens.css; nothing loops.

## 10. Tokens

Only names already on the sheet: surfaces `--graphite-0/50/100`, hairlines `--graphite-200`,
text `--graphite-600/700/800/950`, `--danger` (validation, alert), type `--text-12/13/14/16/20`
with weights, `--font-mono` + `.numeric` (code, counts, times), spacing `--space-1/2/3/4/6/8`,
`--radius-8`, `--breakpoint-sm`, §9's motion tokens, focus via `datum-focus-ring`. The 720
column, two-column grid, 480 dialog and 20 px stat row are layout dimensions, not token roles.

## 11. Both themes

Every rule reads role-stable tokens; no forked CSS under `src/app/t/**`. Cards sit on
`--graphite-0` with hairline edges in both themes exactly as the settings list cards do; mono
identifiers hold the `--graphite-600` contrast floor; the Badge and Dialog fork only where
primitives already fork them.

## 12. Test hooks (C-05)

Routes: `/t/{tenantSlug}` (S-Home), `/t/{tenantSlug}/projects` (same region, area chrome),
`/t/{tenantSlug}/projects/new` (create form; fresh GET renders `project-form`). Test ids from
the increment contract: `home-projects`, `project-card` (with `data-project-id`,
`data-status`), `project-card-status`, `project-card-stats`, `home-create-project`,
`home-recent-documents`, `home-empty`, `project-form`, `project-field-name/-code/-client/
-site-address/-district/-building-type/-storeys/-gfa-m2/-notes`, `project-submit`. Introduced
here: `home-show-archived` (§2), `project-form-error` (§5); retained: `tenant-home`
(Interpretation 1), `empty-state`/`empty-state-action` inside `home-empty` and the projects
area, `dialog-content` around the form. Journeys: J-000 (create in the first segment), J-003
(create/edit). Axe on `/t/{slug}` and `/projects/new` after animations settle, Select closed;
the grid's anchors keep `shell-main`'s scroll container focusable content (the known
scrollable-region trap does not arise).
