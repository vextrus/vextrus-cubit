# Design Decision — Shell frame (rail, switcher, denied screen), the many-membership frame

The workspace frame at `/t/{tenant}` and every screen inside it, as inc-010b's merge left it and
as this hotfix (inc-010b-invitations-accept-hotfix) must keep it. Files:
`src/app/(app)/t/[tenant]/layout.tsx` (the guard and the three answers),
`src/app/(app)/t/[tenant]/shell-frame.tsx` (the frame, told where it is),
`src/ui/shell/app-shell.tsx` · `shell-rail.tsx` · `shell-top-bar.tsx` · `shell-denied.tsx` ·
`routes.ts`. Law: R-UI-001/003/004/005/012/020/030/031/033/050/060/070, R-SPINE-002/003, Q-11,
B-17, B-20. The shell Decision (`docs/design/shell.md`) remains in force in every particular this
file does not refine — its Interpretations I-15–I-23, its `cx-` classes, its px closed set, its
copy table. This file rules what inc-010b changed — the switcher gone live over many memberships,
admission by the named membership, the denied screen's evidence resolution — and binds the
hotfix's one design constraint: **the frame's paint does not change.** All copy is the shipped
`src/ui/strings/shell.ts`; a copy change is out of scope by the increment's own words.

## 0. Interpretations (recorded per the Law section of CLAUDE.md; numbering continues shell.md's)

- **I-24 — admission is the membership the address names, never the earliest.** R-SPINE-002 puts
  the active tenant in the URL; R-SPINE-003 gives one user many tenants. The layout therefore
  admits by `namedWorkspaceFor(presented, tenant)` — does this session hold a membership of the
  tenant the URL names — and never by comparing the URL against `workspaceFor`'s single
  earliest-membership answer, which would deny a joiner every workspace but their first (the
  R-SPINE-003 defect class this frame's merged ground exists to prevent). `workspaceFor` keeps its
  one lawful frame job: naming a *default* workspace where no URL names one — the signed-in `/`
  door and nothing in this layout. A repair inside `src/server/shell/workspace.ts` may change how
  an answer is computed, never which membership admits.
- **I-25 — the switcher can never be empty and never omits where the reader is.** The rail offers
  `workspaces` when the caller names any, else `[workspace]` — so the menu always holds at least
  the workspace the frame is showing. Order is `workspacesFor`'s (`created_at`, then `tenant_id`):
  the personal workspace first, joined workspaces in the order they were joined — stable across
  renames, never re-sorted client-side (no-raw-intl also bars `localeCompare` here). The current
  workspace's item is not marked or disabled: every item is the same navigation, and activating
  the current one is a lawful no-op move to its Projects home.
- **I-26 — the hotfix paints nothing.** The two J-000 checkpoints (`j-000/workspace-named`,
  `j-000/first-project-on-s-home`) are graded pixel-identical to the committed pre-hotfix
  baselines, and J-000's grading surface is byte-frozen at 7af2a17. Therefore the repair is
  state-side and server-side by construction: no token, geometry, copy or DOM-order change to any
  element those baselines photograph. If J-001/J-002 lawfully show a difference, that re-baselines
  under B-20 (`baseline:` commits naming the proof, no weakened assertion); a repair that *needs*
  a J-000 repaint contradicts the plan and stops the increment with a named reason — it is never
  made quietly.
- **I-27 — a deeper screen selects the area as ancestor, not as page.** shell.md ruled
  `aria-current="page"` on the selected rail entry when the frame's only screens were the area
  homes. With `/t/{t}/settings/members` shipped, the claim splits (Q-11, R-UI-031): at the area's
  own home the rail entry and the area crumb say `aria-current="page"`; deeper inside the area the
  rail entry says `aria-current="true"` (current item of the set) and the crumb becomes a link
  back to the area home. Both wear the selection paint; only one claims to be where the reader is.
  `isAreaHome` (`src/ui/shell/routes.ts`) is the one home of the judgement.
- **I-28 — the frame is fed above the fold, once.** `layout.tsx` resolves session → viewer →
  memberships → named workspace → density server-side before paint; `AppShell` publishes the
  density as `data-density` on `shell-root` and holds no data of its own. The frame never
  skeletons and never fetches: a repair that makes the frame ask the client for its workspace list
  is a design defect, not a fix.

## 1. Layout and hierarchy

Unchanged from shell.md §1 in geometry, fill and type — rail 240/48 px on `var(--graphite-50)`,
top bar `var(--space-12)` on `var(--graphite-0)`, main + inspector, hairline seams — with these
refinements now shipped:

**The guard, in order** (`layout.tsx`): no live session → `redirect("/sign-in")` (an ended
session is a session problem, not a permission problem — ARCH-03). Session held but
`namedWorkspaceFor` answers null → the denied screen (§2's permission-denied cell) in place of
the frame — frameless, no rail of links into a workspace the account does not hold (I-17).
Membership held → the frame, handed `workspace` (the named one), `workspaces` (all held),
`email`, `density`.

**Switcher** (`shell-tenant-switcher`, in the rail below the mark row): the shipped DropdownMenu,
`modal={false}`, trigger a full-width ghost button showing `workspaceLabel(workspace)`
(`var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`, single line, ellipsis) with
the 12 px chevron-down. No `aria-label` on the trigger — the workspace name is its visible text
and its accessible name (WCAG 2.5.3); `shell_tenant_switcher_label` names the menu content. The
menu lists one item per held workspace (I-25), each a `next/link` in the `cx-shell-menu-item`
idiom to `shellHref(held.tenantId, "projects")`, text `workspaceLabel(held)` — a nameless stored
name shows as `shell_workspace_unnamed`, never a blank row (I-23). Activating an item is a
frame-internal navigation: the layout re-resolves, the breadcrumb and rail re-key to the chosen
workspace, and the session's active tenant follows the URL (R-SPINE-002) — the switcher is "live"
by navigation, never by client state.

**Rail selection**: three entries (Projects, Books, Settings) per the `SHELL_AREAS` roster;
selection per I-27. Selected paint unchanged: `var(--beam-100)` row fill, `var(--weight-heading)`
text, the 3 px inset `var(--beam-500)` bar (R-UI-030 verbatim). Collapse toggle, chevron and the
`data-collapsed` / `aria-expanded` / `aria-controls` mechanics stand as shell.md rules them;
collapse state survives every in-frame navigation because all in-frame moves are `next/link`.

**Breadcrumb** (`shell-breadcrumb`): `<nav>` labelled `shell_breadcrumb_label` over an `<ol>` —
workspace name as a link to the workspace's Projects home, `›` separator (`aria-hidden`), then
the area crumb: plain text with `aria-current="page"` at the area home, a link deeper in (I-27).
The workspace crumb wears `workspaceLabel`'s answer — at J-000's `workspace-named` checkpoint,
verbatim **Golden Path Works**.

**Zero-project empty state** (`shell-empty`, on the Projects home): exactly as shell.md §1 rules
it — heading, teaching body, and the one action in `shell-empty-action`: the SAMPLE offer
(R-UI-033). It appears in this contract because J-000's `workspace-named` checkpoint photographs
it; it is graded ground here, not redesigned ground.

## 2. States (R-UI-050), ruled cell by cell

Declared in `src/ui/shell/states.ts` (`SHELL_STATES`), reflected by
`tests/ui/shell/state-matrix.test.ts` — the enumerable place the clause demands.

- **Loading** — `t/[tenant]/loading.tsx` skeletons inside `shell-main` (24×240 heading bone, two
  16×min(480px,100%) lines, gap `var(--space-3)`); the frame itself never skeletons (I-28).
- **Empty** — the frame delegates to its routed screens; the switcher menu cannot be empty by
  construction (I-25).
- **Error** — the root error boundary (`src/app/error.tsx`, its own Decision). A failed sign-out
  is handed to that boundary through the top bar's failure hand-off, never swallowed behind a
  closing menu (ARCH-03, B-21).
- **Refusal** — the frame raises none of its own; refusals belong to the screens inside it. The
  one register entry the frame renders is the denied screen's `PERMISSION_NOT_HELD`, below.
- **Partial** — impossible: the frame renders no refusable rows.
- **Offline** — I-20 stands: server-rendered pages surface the error state on unreachability;
  the frame holds no data that can age, so no banner is invented.
- **Permission-denied** — `ShellDenied` in place of the frame:
  `<main data-testid="shell-permission-denied">`, centred column `min(560px, calc(100vw -
  var(--space-8)))`, padding-top `var(--space-12)` doubled ≥ sm, gap `var(--space-4)`. `<h1>`
  `shell_denied_heading` · `<p data-testid="shell-denied-permission">` `shell_denied_permission`
  (which permission: membership of the workspace the address names) ·
  `<p data-testid="shell-denied-holder">` `shell_denied_holder` (who holds it: its existing
  members) · one RefusalState with the registered `PERMISSION_NOT_HELD` entry. Evidence is the
  way onward the person can actually take: their first held workspace's Projects home with label
  `shell_denied_evidence` — `workspacesFor`'s first answer, the personal workspace R-SPINE-002
  guarantees — or, defensively for a session holding none, `{ href: "/", label:
  shell_evidence_home }`. Unauthenticated is never this state; it is the `/sign-in` redirect.
  The recorded vocabulary clash between the shell's lines and the registry's "project" wording
  (shell.md §2) stands recorded; the registry is another node's and nothing here paraphrases it.

## 3. Copy, verbatim (`src/ui/strings/shell.ts` — shipped keys, no change and no addition)

`shell_rail_label` **Workspace sidebar** · `shell_rail_collapse_label` **Toggle sidebar** ·
`shell_rail_nav_label` **Main navigation** · `shell_tenant_switcher_label` **Switch workspace** ·
`shell_nav_projects` **Projects** · `shell_nav_books` **Books** · `shell_nav_settings`
**Settings** · `shell_breadcrumb_label` **Breadcrumb** · `shell_workspace_unnamed` **Unnamed
workspace** · `shell_user_account` **Your account** · `shell_user_sessions` **Sessions** ·
`shell_user_signout` **Sign out** · `shell_denied_heading` **You do not have access to this
workspace** · `shell_denied_permission` **Seeing it needs membership of the workspace this
address names, which your account does not hold.** · `shell_denied_holder` **Its existing
members hold that membership.** · `shell_denied_evidence` **Go to your workspace** ·
`shell_evidence_home` **Go to the home page**. The empty state's `shell_projects_empty_*` and
`shell_sample_offer` lines bind as shell.md §3 spells them. `PERMISSION_NOT_HELD`'s message and
remedy render as registered (`src/core/errors.ts`) — registry-owned, never respelled here.

## 4. Motion (R-UI-004)

Unchanged: rail collapse/expand over `var(--motion-panel)` `var(--ease)` (contents unmount
without transition); chevron turn and hover colours over `var(--motion-state)` `var(--ease)`;
menus and reticle from their single homes. The switcher menu and the denied screen have no
entrance — an answer arrives instantly. Every duration is a token zeroed at source under
reduced motion; no bounce.

## 5. Tokens

`--graphite-0/50/100/500/600/700/900` · `--beam-100/500/600` · `--danger/--danger-surface` (the
denied RefusalState's own severity chrome) · `--hairline` · `--space-1/2/3/4/5/8/9/12` ·
`--radius-4` · `--text-13/14/20` · `--weight-body-medium/--weight-heading` ·
`--motion-state/--motion-panel/--ease`. Px literals stay shell.md §5's closed set (rail 240/48,
mark 26, beam bar 3, chevron 12 at 2 px stroke, the min(…560px…) denied column, skeleton bones,
the lg media value). This hotfix adds no literal and no token use; a new one is a defect (I-26).

## 6. Themes

No authored `[data-theme]` selector anywhere in these files; every light/dark difference arrives
through token values (R-UI-001). The one theme-stable element remains the vendored no-spark mark
(shell.md I-16, debt recorded there, owner `src/ui/brand/**`). Contrast holds on founder facts:
graphite-700/600 on graphite-0/50 ≥ 4.5:1, graphite-900 on beam-100 ≥ 4.5:1, beam-500 bar ≥ 3:1
as UI, and the RefusalState's pairs per its own Decision, in both themes.

## 7. Test hooks (closed contract, C-05)

Routes introduced by this increment: **none** — `/t/[tenant]` and its children stand as merged.
Test ids this Decision binds (all shipped; none added): `shell-root` (carries `data-density`) ·
`shell-rail` (carries `data-collapsed`) · `shell-tenant-switcher` · `shell-breadcrumb` ·
`shell-permission-denied` · `shell-denied-permission` · `shell-empty` · `shell-empty-action`.
The rest of shell.md §7's twenty-seven ids remain in force unaltered.

Behavioural hooks without new ids: the switcher menu's items are found by role `menuitem` inside
the menu labelled `shell_tenant_switcher_label` — one per held workspace, `href` =
`shellHref(tenantId, "projects")`, count and order per I-25; `aria-current` `"page"`/`"true"`
per I-27 on rail entries and the area crumb; `data-code="PERMISSION_NOT_HELD"` on the denied
screen's RefusalState with the evidence link's `href` naming the first held workspace (or `/`).
Selection paint is graded by resolving `var(--beam-100)`/`var(--beam-500)` through an in-page
probe, never a literal.

Grading surfaces this hotfix answers to, not edits: J-000's three tests and checkpoints
(`j-000/workspace-named`, `j-000/first-project-on-s-home` — pixel-identical to pre-hotfix
baselines, I-26); J-001/J-002 stay green, re-baselined only under B-20's `baseline:` discipline;
the regression file `src/modules/spine/tenancy/__tests__/j000-hotfix-regression.test.ts` (AC-1)
pins the mechanism before the repair. jsdom coverage of the frame's mechanics lives in
`tests/ui/shell/**` and, for hotfix acceptance, `tests/hotfix-j000/**`.
