# Design Decision — Shell (the persistent tenant workspace frame)

The one layout every signed-in `/t/{tenantSlug}` route renders inside (R-UI-030): collapsible
left rail, top bar, main area, right inspector. The URL is the source of truth (R-UI-031);
empty states teach the next action (R-UI-033). Token names are `docs/design/datum-tokens.md`;
component anatomy is `datum-primitives.md` / `datum-patterns.md`; no colour literal anywhere
(R-UI-001). S-Auth §5's minimal top bar is superseded by this shell; s-auth §6 (tenant home),
§7 (404, error) and §8 (sessions) content stands and now renders inside `shell-main`.

Interpretations recorded:

1. **Sign out stays a directly visible control.** J-001's page object clicks `auth-sign-out`
   with no surface open (`tests/e2e/pages/auth.ts`, not in ownership), so the user slot is a
   group holding the account identity and a visible Sign out button — not a closed menu.
2. **Later-milestone top-bar slots are live triggers with an honest empty answer**: project
   switcher, ⌘K, jobs and notifications each open a Popover stating what the slot will hold
   and what to do today — never a disabled, dead or silent control (R-UI-020).
3. **A non-member still gets the 404** (s-auth Interpretation 4, Q-12). No M0 route mints
   permission-denied; `ShellAreaState` renders it for tests and later increments.
4. **No `loading.tsx` exists anywhere under `/t`** (s-auth Interpretation 5). The guard
   answers before any byte; every M0 area renders synchronously after it, so no route shows
   `shell-skeleton` today and a signed-out request never receives shell bytes.
5. **Rail collapse is per-tab, in memory.** Default expanded; persistence joins the density
   preference in a later increment (R-UI-005). Collapsing changes no part of the URL.
6. **Projects' empty-state action opens a dialog, honestly.** Project creation and the SAMPLE
   offer (D-02) are deferred; the dialog states that plainly (§4) while the teach line still
   names the true next action (R-UI-033).
7. **Sessions is an area with no rail item** — R-UI-030 fixes the rail's four slots. It
   renders inside the shell, reachable by URL and from Settings' empty state; its breadcrumb
   is tenant name / Sessions.

## 1. Layout and hierarchy

Viewport-height frame, `--font-ui`, `--leading-ui`, compact control metric (R-UI-005): the
rail, then a column of top bar over main + inspector. Main content dominates; chrome recedes
onto `--graphite-50`.

- **Rail** (`shell-rail`, a `nav`, accessible name `shell.rail.label`): full height, background
  `--graphite-50`, hairline right border `--graphite-200`, padding `--space-2`, own scroll;
  240 px expanded, 48 px collapsed; `data-collapsed="true" | "false"` on the element.
- **Top bar** (`shell-topbar`, a `header` — the page's banner): 48 px, background
  `--graphite-50`, hairline bottom border, padding `0 var(--space-4)`, contents vertically
  centred; breadcrumb left, the slot cluster right.
- **Main** (`shell-main`, the `main` landmark): background `--graphite-0`, own vertical
  scroll; area content in a centred column, `max-width: 720px`, padding `--space-6` (the
  s-auth rhythm, unchanged for sessions and home). Each area page carries exactly one `h1`
  (`--text-20`, `--weight-heading`, `--graphite-950`).
- **Inspector** (`shell-inspector`, an `aside` — complementary, accessible name
  `shell.inspector`): 280 px, background `--graphite-50`, hairline left border, padding
  `--space-4`, own scroll; at M0 it renders its empty state (§5). Below `--breakpoint-md` it
  is `display: none` (the element stays in the DOM); the rail remains and collapses manually.

## 2. The rail

Top to bottom: tenant switcher, `--space-2`, hairline Separator, `--space-2`, the nav items,
a flexible spacer, the collapse toggle. No wordmark — the brand lives on the auth cards.

- **Tenant switcher** (`rail-tenant-switcher`): a DropdownMenu trigger, full rail width,
  36 px, `--radius-4`, hover fill `--graphite-100`, `datum-focus-ring`. Contents: a 20 px
  tile (`--radius-4`, fill `--cobalt-100`, the tenant name's first character uppercase,
  `--text-12` `--weight-body-medium` `--graphite-900`), `--space-2`, the tenant name
  (`--text-13`, `--weight-body-medium`, `--graphite-900`, single line, ellipsis — the
  accessible name), a right chevron (16 px, `--graphite-600`). Menu (overlay surface,
  `--shadow-2`, min-width 200 px, accessible name `shell.rail.tenants`): one `menuitemradio`
  per membership (`tenant-switcher-item`), 28 px, the tenant name, `aria-checked="true"` on
  the current tenant with a 16 px `--cobalt-500` check glyph at the left; activating an item
  navigates to `/t/{slug}`. Memberships come from the new server read
  `membershipsFor(db, userId)` in `src/server/tenancy.ts` — `{ slug, name }` ordered by
  membership `createdAt` ascending, the order `activeTenantSlugFor` trusts, so the list
  never reshuffles.
- **Nav items** (`rail-nav-projects`, `rail-nav-books`, `rail-nav-settings`): anchors to
  `/t/{slug}/projects|books|settings`, 28 px, `--radius-4`, padding `0 var(--space-2)`, gap
  `--space-2`; a 16 px inline-SVG line icon (1.5 px stroke, `currentColor`) then the label
  (`shell.nav.*`, `--text-13`). Icons: Projects — a sheet (rectangle, folded top-right
  corner); Books — two upright spines; Settings — three horizontal slider lines with offset
  dots. Rest `--graphite-700`; hover fill `--graphite-100`, text `--graphite-950`; current
  area `aria-current="page"`, fill `--cobalt-100`, text `--graphite-900`
  `--weight-body-medium` — weight and `aria-current` carry the meaning, never tint alone
  (R-UI-060).
- **Collapsed width (48 px)**: the switcher shrinks to its centred tile, nav items to their
  centred icons; every accessible name is unchanged, and each collapsed item shows a Tooltip
  (primitives §9) with its label on hover and focus. Focus rings stay visible and unclipped
  in both widths.
- **Toggle** (`rail-toggle`): an IconButton (28 × 28) at the rail's bottom — chevron-left
  when expanded, chevron-right when collapsed; `aria-expanded` states the width, and the
  accessible name is `shell.rail.collapse` expanded, `shell.rail.expand` collapsed.

## 3. The top bar

- **Breadcrumb** (`topbar-breadcrumb`): a `nav`, accessible name `shell.breadcrumb`. Crumbs:
  the tenant name as an anchor to `/t/{slug}` (`--text-13`, `--graphite-600`, hover
  `--graphite-900`, no underline at rest, `datum-focus-ring`), then, when an area is open, a
  `/` separator (`--graphite-400`, margin `0 var(--space-2)`) and the area label as plain
  text (`--text-13`, `--weight-body-medium`, `--graphite-900`) — `shell.nav.*` for the three
  areas, `tenant.sessions.title` for sessions. On tenant home the breadcrumb is the tenant
  name alone, as text, not a link. The crumbs derive from the URL, nothing else (R-UI-031).
- **Right cluster**, gap `--space-2`, in order. Every Popover below: width 280 px, body
  `--text-13` `--graphite-600` (Interpretation 2).
  1. **Project switcher** (`topbar-project-switcher`): a ghost Button, text
     `shell.topbar.project.none` in `--graphite-600` with a 16 px chevron; Popover body
     `shell.topbar.project.empty`, `--space-3` below it an anchor
     `shell.topbar.project.action` → `/t/{slug}/projects`, styled as EvidenceLink
     (underlined `--cobalt-500`).
  2. **⌘K** (`topbar-command`): a ghost Button holding two Kbds — "⌘" and "K" — accessible
     name `shell.topbar.command`; Popover body `shell.topbar.command.empty`.
  3. **Jobs** (`topbar-jobs`): a 28 × 28 IconButton, clock-face icon, name
     `shell.topbar.jobs`; Popover body `shell.topbar.jobs.empty`.
  4. **Notifications** (`topbar-notifications`): IconButton, bell icon, name
     `shell.topbar.notifications`; Popover body `shell.topbar.notifications.empty`.
  5. **User** (`topbar-user`): a `role="group"`, accessible name `shell.user`, holding the
     account email (`--text-13`, `--graphite-600`, max-width 160 px, ellipsis, full address
     in `title`) and a ghost Button `tenant.signOut` carrying `data-testid="auth-sign-out"` —
     exactly s-auth §5's behaviour: loading state, end the session via fetch, navigate to
     `/sign-in` (Interpretation 1).

## 4. Areas and routes (R-UI-031, R-UI-033)

Server-guarded via `tenantContext(slug)` before any byte: `'signed-out'` → 303 to
`SIGN_IN_PATH`; `'not-found'` → the s-auth §7 404. Every route below is deep-linkable by a
fresh GET and reachable by rail navigation; browser back walks the history exactly (AC-2).

- **`/t/{slug}`** — tenant home, s-auth §6 verbatim inside `shell-main`: `tenant-home`
  wrapper, h1 = tenant name, slug in `--font-mono` `--text-12` `--graphite-600`, then the
  EmptyState `tenant.home.empty.*` with action → `/t/{slug}/sessions`. Unchanged.
- **`/t/{slug}/projects`** — h1 `tenant.projects.title`. With no projects (all of M0): the
  EmptyState `tenant.projects.empty.*`, whose action (`empty-state-action`) opens a Dialog
  (primitives §11): Title `tenant.projects.create.title`, Description
  `tenant.projects.create.body`, then `tenant.projects.create.sample` as a second `--text-13`
  `--graphite-600` line. The Dialog's built-in close is the only control; Escape and the
  scrim close it. Honest today; the real form replaces the dialog body in the projects
  increment (Interpretation 6).
- **`/t/{slug}/books`** — h1 `tenant.books.title`. EmptyState — `tenant.books.empty.title` /
  `.teach`; action `tenant.books.empty.action` navigates to `/t/{slug}/projects`.
- **`/t/{slug}/settings`** — h1 `tenant.settings.title`. EmptyState —
  `tenant.settings.empty.title` / `.teach`; action `tenant.settings.empty.action` navigates
  to `/t/{slug}/sessions` (the one real destination today, AC-3).
- **`/t/{slug}/sessions`** — s-auth §8 verbatim inside `shell-main` (`session-row`,
  `session-revoke`, the revoke behaviour, the alert line). No rail item (Interpretation 7).

## 5. The inspector at M0

The patterns EmptyState — title `shell.inspector.empty.title`, teach
`shell.inspector.empty.teach`, no action (the remedy is selecting something, and nothing is
selectable yet). Entity/line/item detail arrives with the viewer and register increments,
rendered through `ShellAreaState` inside this region.

## 6. ShellAreaState — the seven states (R-UI-050)

`src/ui/shell/index.ts` exports `AppShell` and `ShellAreaState`, which takes `state:
'loading' | 'empty' | 'error' | 'refusal' | 'partial' | 'offline' | 'permission-denied'`
plus per-state substance, composing only the existing `src/ui/patterns` exports and the
Skeleton primitive — no re-implementation:

| State | Renders | Substance props |
|---|---|---|
| loading | `shell-skeleton`: wrapper `aria-busy="true"` with a visually hidden `role="status"` line `shell.loading`; Skeletons (`aria-hidden`): area shape — one 200 × 20 bar, `--space-4`, four full-width × 36 px bars with `--space-2` gaps; inspector shape (`shape="inspector"`) — one 120 × 14 bar, two full-width × 12 px bars | `shape?: 'area' \| 'inspector'` |
| empty | EmptyState (`empty-state`, `empty-state-action`) | `title`, `teach`, `actionLabel?`, `onAction?` |
| error | ErrorState (`error-state`, `error-state-report-id`, `error-state-retry`), patterns register copy | `reportId`, `onRetry` |
| refusal | RefusalState (`refusal-state`, `refusal-code`, `refusal-remedy`) — registered codes only | `code`, `evidenceHref`, `evidenceLabel?` |
| partial | PartialNotice (`partial-notice`) above `children`, shown not hidden | `refusedCount`, `children` |
| offline | OfflineBanner (`offline-banner`) above `children` | `children` |
| permission-denied | PermissionDenied (`permission-denied`) | `permission`, `holder` |

Where each state surfaces (varying copy is the substance; the rest is the patterns register):

- **loading**: no M0 route streams it (Interpretation 4); the shapes stand ready for areas
  that will fetch. The inspector uses the inspector shape.
- **empty**: §4 and §5 copy — every area's empty state teaches its next action.
- **error**: a new boundary at `src/app/t/[tenantSlug]/error.tsx` renders the error state
  inside the intact shell; `reportId` is the error digest, or the literal `SHELL-0000` when
  the runtime provides none; retry calls the boundary's reset. The existing
  `src/app/t/error.tsx` stays for failures above the shell.
- **refusal**: none minted at M0; tests exercise the registered code `STORAGE_URL_EXPIRED`
  (the s-design precedent). Renders in place, never a toast.
- **partial**: none minted at M0 (no list is part-refused); the bar-above-rows anatomy is
  fixed here for the register and queue screens to inherit.
- **offline**: the browser's `offline`/`online` events mount OfflineBanner full-width at the
  top of `shell-main`, above the area content, on every shell screen; content stays visible,
  and the only M0 writes (revoke, sign-out) fail into their existing alert lines.
- **permission-denied**: minted by no route (Interpretation 3). Permission names for later
  increments: home `workspace.read`, Projects `project.read`, Books `book.read`, Settings
  `settings.read`, inspector its area's; `holder` copy `tenant.permission.holder`.

## 7. Copy, verbatim

`src/ui/shell/strings.ts` exports `SHELL_STRINGS` (frozen, typed as the sibling tables are);
area copy joins `TENANT_STRINGS` in `src/app/t/strings.ts`. No string literal in JSX except
test ids and the code `SHELL-0000`.

| Key | Value |
|---|---|
| `shell.rail.label` | Workspace |
| `shell.rail.tenants` | Switch workspace |
| `shell.rail.collapse` | Collapse the rail |
| `shell.rail.expand` | Expand the rail |
| `shell.nav.projects` | Projects |
| `shell.nav.books` | Books |
| `shell.nav.settings` | Settings |
| `shell.breadcrumb` | Breadcrumb |
| `shell.topbar.project.none` | No project |
| `shell.topbar.project.empty` | No projects exist in this workspace yet. The first project will appear here. |
| `shell.topbar.project.action` | Go to Projects |
| `shell.topbar.command` | Search and commands |
| `shell.topbar.command.empty` | The command palette is not available yet. Use the rail to move between areas. |
| `shell.topbar.jobs` | Jobs |
| `shell.topbar.jobs.empty` | No jobs are running. Long-running work reports its progress here. |
| `shell.topbar.notifications` | Notifications |
| `shell.topbar.notifications.empty` | Nothing needs your attention. Notifications will appear here. |
| `shell.user` | Account |
| `shell.inspector` | Details |
| `shell.inspector.empty.title` | Nothing is selected. |
| `shell.inspector.empty.teach` | Select an item and its details appear here. |
| `shell.loading` | Loading this area. |
| `tenant.projects.title` | Projects |
| `tenant.projects.empty.title` | No projects yet. |
| `tenant.projects.empty.teach` | Create a project, then upload a drawing to start measuring. |
| `tenant.projects.empty.action` | Create a project |
| `tenant.projects.create.title` | Create a project |
| `tenant.projects.create.body` | Creating projects is not available yet. A project will start with a name and its first drawing upload. |
| `tenant.projects.create.sample` | A sample project, clearly labelled SAMPLE, will also be available to explore. |
| `tenant.books.title` | Books |
| `tenant.books.empty.title` | No books yet. |
| `tenant.books.empty.teach` | A book prices a project's measured work. Create a project first; its books appear here. |
| `tenant.books.empty.action` | Go to Projects |
| `tenant.settings.title` | Settings |
| `tenant.settings.empty.title` | Nothing to configure yet. |
| `tenant.settings.empty.teach` | Workspace settings will appear here. The one thing to manage today is your signed-in sessions. |
| `tenant.settings.empty.action` | View sessions |
| `tenant.permission.holder` | the workspace owner |

Calm, concrete, sentence case, no exclamation marks, no build or internal vocabulary.
`tenant.signOut`, `tenant.sessions.*`, `tenant.home.empty.*` and `tenant.notFound.*` stand
unchanged from s-auth §10.

## 8. Motion (R-UI-004)

| Where | Duration | Easing |
|---|---|---|
| Rail width 240 ↔ 48 | `--motion-panel-duration` (240 ms) | `--motion-ease` |
| Rail labels leaving/arriving (opacity) | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Nav/item hover fills, breadcrumb hover | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Menus, Popovers, Tooltips, the create Dialog | per primitives §15 | — |

Navigation between areas is instant — no page transition, no fade. Reduced motion: token
durations zero via tokens.css; the rail snaps between widths.

## 9. Tokens

Only names already on the sheet: surfaces `--graphite-0/50/100`, hairlines `--graphite-200`,
text `--graphite-400/600/700/900/950`, active tint `--cobalt-100`, interactive/focus
`--cobalt-500/600` via `datum-focus-ring`, type `--text-12/13/20` with weights, spacing
`--space-2/3/4/6`, `--radius-4`, `--z-sticky` (top bar), `--breakpoint-md`, the motion
tokens of §8, `--font-mono` + `.numeric` for the slug and any count. `src/ui/shell/shell.css`
is imported by the shell barrel and holds no literal colour (R-UI-001); the px dimensions
named here (240/48 rail, 280 inspector, 48 bar, 720 column, skeletons) are layout
dimensions, not token roles.

## 10. Both themes

Every rule reads role-stable tokens; no forked CSS in `src/ui/shell/**` or `src/app/t/**`.
Chrome (`--graphite-50`) recedes behind content (`--graphite-0`) in both themes, hairlines
carrying the seams; `--cobalt-100` under `--graphite-900` text holds contrast in both by the
token sheet's values. Overlays and the scrim fork only where primitives already fork them.

## 11. Test hooks (C-05)

Routes: `/t/{tenantSlug}`, `/t/{tenantSlug}/projects`, `/books`, `/settings`, `/sessions`
(unchanged), `/sign-in` (unchanged redirect target). Test ids, all from the increment
contract: `shell-rail` (with `data-collapsed`), `rail-toggle` (with `aria-expanded`),
`rail-tenant-switcher`, `tenant-switcher-item`, `rail-nav-projects/books/settings` (current
area carries `aria-current="page"`), `shell-topbar`, `topbar-breadcrumb`,
`topbar-project-switcher`, `topbar-command`, `topbar-jobs`, `topbar-notifications`,
`topbar-user`, `shell-main`, `shell-inspector`, `shell-skeleton`, plus the reused
`tenant-home`, `session-row`, `auth-sign-out` and the patterns ids of §6. `empty-state`
renders in both `shell-main` and `shell-inspector` at once, so locators scope by region.
Journey: `tests/e2e/shell.spec.ts`, titles grep-match `J-000`; page object
`tests/e2e/pages/shell.ts`. Axe scans and computed-style reads settle animations first; no
scan runs while a menu or popover is open.
