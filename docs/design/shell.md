# Design Decision — shell (workspace frame, Projects home, Books shell, Settings)

Routes: `/t/{tenant}` (Projects home), `/t/{tenant}/books`, `/t/{tenant}/settings` under
`src/app/(app)/t/[tenant]/**`, plus the signed-in branch of `/` (`src/app/page.tsx`).
Increment inc-013-shell. Law: R-UI-001/003/004/005/012/020/030/031/033/050/060/070, Q-11,
J-004, B-17. Every convention of the primitives-core Decision binds: `cx-` classes, tokens-only
colour and motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in
authored CSS. Interpretations I-1–I-14 of the earlier Decisions remain in force ("workspace"
is the user-facing word for tenant, per s-auth I-11). All shell copy lives in
`src/ui/strings/shell.ts` (keys `shell_…`), spread into `strings` by the barrel; JSX carries
no string literal beyond test ids and fixed attribute values. Chrome comes only from shipped
primitives (core Button/Input/Skeleton, overlay DropdownMenu, the one RefusalState) plus the
`src/ui/shell` components this file rules.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-15 — milestone-gated occupants ship absent.** R-UI-030 lists ⌘K (M2), jobs tray (M1),
  notifications (M2), project switcher (inc-011) and the viewer's status readout (the viewer's
  screen) among the frame's occupants. The shell ships no dead controls: those regions arrive
  with their owning increments, and nothing here reserves visual space for them.
- **I-16 — one no-spark asset, both themes, referenced verbatim.** The vendored set holds a
  single `vextrus-mark-nospark.svg` (light-indigo facets) and no dark or quiet-chrome
  sibling; the geometry is never redrawn (R-UI-070), so the rail renders that one file in
  both themes via `<img>` static import — decorative (`alt=""` `aria-hidden`), so no
  contrast floor binds it. Recorded IOU, owner: the increment owning `src/ui/brand/**`
  (B-24) — a dark/quiet-chrome sibling, adopted via the s-auth I-10 display swap.
  The debt is visible, not theoretical: R-UI-070's colour states give the DARK surface the
  primary-dark facets `#564BA8`/`#6E63C8`, and the one vendored no-spark asset carries the
  primary-light pair `#3A2F86`/`#5A4FB0`, so the committed dark baseline shows a dark indigo
  mark on the dark rail ground. It is left standing deliberately: the geometry is never
  redrawn (R-UI-070, B-24) and no dark no-spark asset is vendored, so recolouring the mark
  from the shell would be the worse defect. The fix is the vendored sibling, and it belongs
  to `src/ui/brand/**`.
- **I-17 — the un-membered denial is frameless and registry-answered.** A person denied the
  workspace is not shown a rail of links into it: a signed-in request for a tenant the
  session does not hold renders the §2 denial surface in place of the frame, built on the
  registered `PERMISSION_NOT_HELD` entry — the shell owns no `src/core/errors.ts` and
  registers nothing. That entry's "project" wording is registry-owned and renders as
  registered; the shell's own lines (§3) name the workspace permission and its holders.
- **I-18 — the contract's "rename refusal" and "permission-denied" strings are caller-side
  copy.** Refusal message and remedy are registry-owned (R-SPINE-062); a consumer lawfully
  supplies evidence (href + label) and the screen's own prose. The `shell_` keys for those
  states are the evidence labels and the two denial detail lines — never a second spelling
  of a registry sentence.
- **I-19 — the signed-in `/` swaps its doors.** The nameplate stays one screen with two
  branches: anonymous renders exactly the two auth doors (unchanged); signed-in renders
  exactly one door, `root-home-workspace-door`, in the same link idiom, in their place — a
  link, never a redirect (J-001a's `toHaveURL('/')` stands).
- **I-20 — offline is a fault of reachability** (s-auth I-12 transposed). The shell's pages
  are server-rendered; a navigation that cannot reach the server surfaces the error state,
  never silence and never an invented banner. The R-UI-050 offline banner binds screens that
  hold data which can age; the shell's M0 screens hold none.
- **I-21 — the stored key is not the address, so the shell reads it back through the fold.**
  `users.email` holds the folded key an account is looked up under (`as presented …` /
  `digest of …`), not an address: rendered raw, the user menu would show a person a tag they
  never typed. The read-back therefore lives in the shell's own viewer seam
  (`src/server/shell/viewer.ts`), because `src/server/auth/**` is another node's file and a
  Decision may not widen this node's ownership. It is still not a second copy of the invariant
  (B-17): the tag is not restated but *computed by the fold itself* —
  `const PRESENTED_PREFIX = foldedKey("", true)` — so a change to the tagging in its one home
  carries into the read-back and cannot drift from it. A digest key stands for an address no
  column could carry: there is nothing to show, and the trigger falls back to
  `shell_user_account`.
- **I-22 — "an entered name" is a name with something visible in it.** R-UI-033 asks the
  workspace to be *named*, and the contract names a rename-refusal string of its own, so the
  rename door judges blankness: a submission whose name shows nothing is answered inline at
  `shell-rename-refusal` with `shell_rename_refusal`, and `renameWorkspace` is never called —
  the stored name is untouched by construction. "Shows nothing" is perceptual, and `trim()` is
  not it: `trim()` strips only the ECMAScript whitespace set, so a name of a single U+200B ZERO
  WIDTH SPACE (or ZWNJ, ZWJ, the BOM, a Hangul filler, an empty Braille cell) would pass the door
  and then paint a link with no glyph in it — the exact failure this interpretation exists to
  prevent. `hasVisibleText()` (`src/ui/shell/routes.ts`) is the one home of the standard: it
  removes whitespace, the Unicode format and control categories, lone surrogates and the
  blank-by-design glyphs, and asks whether anything is left. Both guards read it — the door here
  and `workspaceLabel` in I-23 — so they cannot disagree about the same string. The judgement is the door's, not the taxonomy's:
  no `RefusalCode` is registered for it (`src/core/errors.ts` is another node's, and R-SPINE-062
  is closed), and `RenameAnswer` keeps its settled two arms — the form's own state gains a third,
  `{ renamed: false, blankName: true }`. The rejected alternative was s-auth I-13's "take it as
  presented" carried over from the auth doors: it stores a nameless workspace, and the frame then
  paints a breadcrumb link with no discernible name — a serious Q-11 axe failure written from
  data. The `required` attribute is gone from `shell-rename-input` for the same reason: an empty
  submission must reach the door and be answered by it, not stopped by a browser bubble.
- **I-23 — nothing paints a nameless workspace.** `workspaceLabel(workspace)`
  (`src/ui/shell/routes.ts`) is the one home for the name the frame shows — the breadcrumb link,
  the switcher trigger and its one membership item all read it. A stored name with nothing
  visible in it — judged by I-22's `hasVisibleText`, not by `trim()` — shows as
  `shell_workspace_unnamed`; anything else shows exactly as it stands.
  Sign-up still takes its `tenantName` as presented (R-SPINE-002 is another node's door), so the
  guard is reachable and is not dead code.

## 1. Layout and hierarchy

**Guards.** `src/app/(app)/layout.tsx`: no live session → `redirect("/sign-in")` — an
unauthenticated `/t/…` request never paints workspace content (AC-3). `t/[tenant]/layout.tsx`
resolves `workspaceFor(sessionToken)`; when the answer's `tenantId` differs from the URL
segment (or is null), it renders the denial surface (§2) instead of the frame.

**The frame** (`AppShell`, class `cx-shell`): `<div data-testid="shell-root">`, grid
`auto 1fr`, `minHeight: 100dvh`, ground `var(--graphite-0)`. Left column full-height rail;
right column stacks top bar over a row of main + inspector.

**Rail** (`ShellRail`, `data-testid="shell-rail"`): an `<aside>` `aria-label` =
`shell_rail_label` — the rail is a landmark, so the collapse toggle and the switcher are
controls inside a region rather than orphans at the document root; it is the frame's second
complementary region and carries a name the inspector's does not. Width 240 px expanded,
48 px collapsed (panel measures are px per core I-1), fill `var(--graphite-50)`,
border-right `var(--hairline)`, column flex. Top row, height `var(--space-12)`,
padding-inline `var(--space-3)`, mark left and collapse toggle right; collapsed, that row
stacks (column, `gap: var(--space-2)`, padding-block `var(--space-3)`, no padding-inline,
auto height) so that mark AND toggle stay inside the 48 px box — at 240 px spacing they
would push the toggle out of the rail, leaving the only control that expands it painted
nowhere.

- **Mark** — `<span data-testid="shell-rail-mark" aria-hidden="true">` wrapping `QuietMark`
  (`src/ui/brand-usage`): `<img>` of the vendored `src/ui/brand/vextrus-mark-nospark.svg`
  at exactly 26 × 26 px, `alt=""` (I-16). Never any other size or asset here.
- **Collapse toggle** — `data-testid="shell-rail-collapse"`, ghost square button
  (`var(--space-8)`), `cx-reticle`, `aria-label` = `shell_rail_collapse_label`,
  `aria-expanded` `"true"`/`"false"`, `aria-controls` the rail's `id`. Glyph: inline-SVG
  chevron (12 px, stroke `var(--graphite-600)` at 2 px, `aria-hidden`) pointing left when
  expanded, right when collapsed, rotating over `var(--motion-state)` `var(--ease)`.
  Collapsed, the rail keeps only mark and toggle; switcher and nav unmount (labels have no
  icon stand-ins in M0 — a truncated letter column would be guesswork). State is component
  state, default expanded, not persisted across sessions (the per-user preference seam ships
  with the density control, not here). It does hold across the very next click: every move
  inside the frame — the three nav rows, the switcher's membership item and the breadcrumb's
  workspace link — goes through `next/link`, so the shared workspace layout (and the rail's
  state with it) survives the navigation instead of being re-mounted expanded by a fresh
  document load. A collapse that reverts the moment a person navigates is not an affordance.
  Doors that leave the frame (`/sessions`, sign-out's `/sign-in`) stay plain anchors.

Below the top row: **tenant switcher** (`data-testid="shell-tenant-switcher"`) — a shipped
DropdownMenu whose trigger is a full-width ghost button, height `var(--space-9)`,
padding-inline `var(--space-3)`, text left, showing the workspace name (`var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-900)`, single line, ellipsis) with a
chevron-down glyph. The trigger carries NO `aria-label`: the workspace name is its only
visible text, and an override would leave its accessible name holding none of the words a
speech-input user can see and say (WCAG 2.5.3, label-in-name) — the same rule the user
trigger already keeps by naming itself with the visible address. `shell_tenant_switcher_label`
names the menu the trigger opens (`aria-label` on the menu content), which is where the
control's purpose belongs. Both shell menus are `modal={false}`: the modal treatment marks
the rest of the frame `aria-hidden` while its links stay focusable, which axe reports as a
serious `aria-hidden-focus` on every open menu — inadmissible under Q-11, and nothing in
either menu needs the page inert. The menu lists the
memberships the seam returns — one today — each item the workspace name, activating a
navigation to `/t/{tenantId}`. Then `var(--space-4)`, then **nav** (`<nav>` `aria-label` =
`shell_rail_nav_label`): three full-width link rows (`data-testid` `shell-nav-projects` /
`shell-nav-books` / `shell-nav-settings` → `/t/{t}`, `/t/{t}/books`, `/t/{t}/settings`),
height `var(--space-9)`, padding-inline `var(--space-3)`, gap `var(--space-1)`, radius 0
(flush, so the beam bar sits on the rail's edge), `var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-700)`, `cx-reticle`. Hover: fill
`var(--graphite-100)`, text `var(--graphite-900)`. Selected (the entry whose route matches
the URL — URL is the source of truth, R-UI-031): `aria-current="page"`, row fill
`var(--beam-100)`, text `var(--graphite-900)` at `var(--weight-heading)` (the non-colour
second channel), and a 3 px inset beam bar — an absolutely positioned 3 px strip, full row
height, flush left, fill `var(--beam-500)` (R-UI-030 verbatim).

**Top bar** (`ShellTopBar`, `data-testid="shell-topbar"`): height `var(--space-12)`, fill
`var(--graphite-0)`, border-bottom `var(--hairline)`, padding-inline `var(--space-5)`, flex,
space-between. Left: **breadcrumb** (`data-testid="shell-breadcrumb"`) — `<nav>` `aria-label`
= `shell_breadcrumb_label` over an `<ol>`: the workspace name as an `<a>` to `/t/{t}`
(`var(--text-13)` `var(--graphite-700)`, hover `var(--graphite-900)`, `cx-reticle`), a `›`
separator (`aria-hidden`, `var(--graphite-500)`), then the area crumb — `shell_nav_projects`
/ `shell_nav_books` / `shell_nav_settings` per route — as plain text `var(--graphite-900)`
`var(--weight-body-medium)` with `aria-current="page"`. Right: **user menu**
(`data-testid="shell-user"`) — a DropdownMenu whose ghost trigger shows the signed-in email
(`var(--text-13)` `var(--graphite-700)`, ellipsis past 280 px); the visible address is the
accessible name. The address is the value the account presented, read back out of the folded
key `users.email` stores it under (I-21); an account whose key is a digest has no address to
show and the trigger is named `shell_user_account`. Both items wear the menu's own idiom
(`cx-shell-menu-item`: no underline; the colour is the menu item's own) — an item that happens to be a link
may not arrive underlined beside one that is not, or the pair reads as one hovered row and
one plain sentence rather than as peers. The same class carries the switcher's link item.
Items, in order: `shell-user-sessions` — a link item to `/sessions`, label
`shell_user_sessions` (paying s-auth's recorded R-UI-031 debt) · `shell-user-signout` —
label `shell_user_signout`, invoking the sign-out server action; on success the person lands
on `/sign-in`, which is itself the visible way back in (AC-2). The open menu is portalled into
the top bar itself, not to `document.body`: a menu parked at the document root is page content
outside every landmark, which axe reports as `region` the moment `shell-user` is opened, and the
bar is the landmark the menu belongs to. The shipped DropdownMenu takes the container as an
optional prop (default `document.body`, unchanged for every other caller) and portals the
popper's own `position: fixed` box `asChild`, so the container contributes no layout and nothing
is rendered in the bar while the menu is closed — the frame's baselines are untouched.

**Main** (`data-testid="shell-main"`): the routed page, `<main>`, padding `var(--space-6)`,
`overflow: auto`. **Inspector** (`ShellInspector`, `data-testid="shell-inspector"`):
`<aside>` `aria-label` = `shell_inspector_label`, width 280 px, border-left
`var(--hairline)`, padding `var(--space-5)`, rendered only at the lg breakpoint and up
(`min-width: 1280px` — a media query cannot consume `var()`, so the breakpoint token's value
appears as the one lawful literal). Context-sensitive detail arrives with the screens that
select things; in M0 it holds one line, `shell_inspector_empty`, `var(--text-13)`
`var(--graphite-600)`. Below lg it is absent, so `shell-main` breathes at 200 % zoom
(R-UI-060).

**Projects home** (`/t/{t}`): `<h1>` `shell_projects_heading`, `var(--text-20)`
`var(--weight-heading)`, margin 0. Below, `var(--space-5)`, the empty state
(`ShellEmptyState`, `data-testid="shell-empty"`): centred column, `text-align: center`,
padding-top `var(--space-12)`, max-width 420 px, margin-inline auto — `<h2>`
`shell_projects_empty_heading` (`var(--text-16)` `var(--weight-heading)`
`var(--graphite-900)`) · body `shell_projects_empty_body` (`var(--text-13)`
`var(--graphite-600)`) · `var(--space-4)` · the action slot, a `<div
data-testid="shell-empty-action">` holding this screen's one action: the SAMPLE offer —
a core primary Button, `data-testid="shell-sample-offer"`, label `shell_sample_offer`
(the label carries the word SAMPLE, from the string table). Clicking invokes the exported
`sampleSeed` seam through a server action; while pending the Button takes core's loading
state (`aria-busy`, no spinner). The answer's home is an always-mounted, initially empty
live region (`cx-shell-live`: `aria-live="polite"`; while empty it is taken out of flow —
`:empty { position: absolute; inline-size: 0; block-size: 0 }` — so it adds no row and none of
the column's gaps, and it keeps a box, because `display: contents` removes an element from the
box tree and engines have dropped such elements and their ARIA from the accessibility tree, in
which case the region would announce nothing) — a region has to be observed empty before its text
arrives or the answer may never be announced (Q-11), and the same wrapper carries the
settings screen's saved notice. Inside it the answer renders at
`<div data-testid="shell-sample-outcome" role="status">`, `var(--space-3)` below the slot:
for `{ available: false }` (the M0 shipped answer) the s-auth notice chrome — fill
`var(--info-surface)`, border 1 px solid `var(--info)`, radius `var(--radius-4)`, padding
`var(--space-3)` `var(--space-4)`, text `var(--text-13)` `var(--graphite-900)` — reading
`shell_sample_unavailable`; never a fault, never a refusal code. For `{ seeded: true, goTo }`
(I-003, M1) the client navigates to `goTo`; no outcome text renders. The offer stays enabled
after an unavailable answer — a retry is never disarmed.

**Books shell** (`/t/{t}/books`): `<h1>` `shell_books_heading`, then `ShellEmptyState` —
`<h2>` `shell_books_empty_heading` · body `shell_books_empty_body` · action slot holding a
real `<a>` to `/t/{t}` in the evidence-link idiom (`var(--text-13)`
`var(--weight-body-medium)` `var(--beam-600)`, underlined, hover `var(--beam-500)`,
`cx-reticle`), label `shell_books_empty_action` — the honest next action lives in Projects.

**Settings** (`/t/{t}/settings`): `<h1>` `shell_settings_heading`, then `var(--space-5)`,
then `<section data-testid="shell-settings-name">` (aria-labelledby its label), column,
max-width 380 px, gap `var(--space-1)`: `<label for…>` `shell_settings_name_label`
(`var(--text-13)` `var(--weight-body-medium)` `var(--graphite-700)`) · hint
`shell_settings_name_hint` (`var(--text-12)` `var(--graphite-600)`, `text-wrap: pretty` so the
sentence does not leave its last word alone on a second line at this measure, wired via
`aria-describedby`) · the core Input, `data-testid="shell-rename-input"`, prefilled with the
current workspace name, with no `required` and no other client rule — every submission,
empty included, reaches the door and is answered there (I-22) · the answer slot · `var(--space-3)` · a core primary
Button `data-testid="shell-rename-submit"`, label `shell_rename_submit`, `align-self: start`,
submitting the native `<form>` whose server action calls `renameWorkspace`. In flight: Button
loading, Input `readOnly` and `aria-busy` (never `disabled` — the form is submittable with Enter
from the field itself, and disabling the focused element mid-transition removes it from the tab
order and drops focus to the body, so the answer would arrive with focus nowhere; Q-11 asks for a
focus destination), slot cleared. Success: the saved name re-renders in Input, switcher
and breadcrumb, and the slot's live region (`cx-shell-live`, mounted empty from first paint)
receives a `role="status"` notice (the §1 notice chrome) reading
`shell_rename_saved`. The wrapper is `aria-live`, not `role="status"`, so what a journey finds
by role inside `shell-settings-name` is the notice itself and only when there is one. A blank or whitespace-only name renders in the slot as `<div
data-testid="shell-rename-refusal">` wrapping one `role="alert"` line reading
`shell_rename_refusal` (I-22) — the door's own copy, no registry entry. That line wears the
ALERT chrome (`cx-shell-alert`: `var(--danger-surface)` fill, 1 px `var(--danger)` border,
`var(--radius-4)`, padding `var(--space-3) var(--space-4)`, `var(--weight-body-medium)`),
never the notice chrome: the notice belongs to the saved answer and the sample outcome, and
a rejected save that wears it differs from a completed one only in its sentence. A settled refusal
renders in the same slot wrapping exactly one RefusalState — reachable codes:
`SIGNED_OUT`, evidence `{ href: "/sign-in", label: shell_evidence_sign_in }`, and
(defensively — membership cannot lapse in the one-membership M0 world, but the seam checks
it) `PERMISSION_NOT_HELD`, evidence `{ href: "/", label: shell_evidence_home }`. The workspace
the form carries is a caller-writable hidden field over a `uuid` column, so `renameWorkspace`
judges it before it queries: a value that is no uuid names no tenant this session is a member
of and is answered `PERMISSION_NOT_HELD` — refused as the handle is taken, the shape
`scopedTenantId` takes, rather than a 22P02 driver error the seam would have to answer as an
unmarked fault. The form
re-enables with the value intact. Renaming is a plain write, not an act: no copper, no
ConsequenceDialog.

**The signed-in `/` door** (I-19): after the nameplate's tagline, one `<a
data-testid="root-home-workspace-door" href={/t/{tenantId}}>` in exactly the anonymous
doors' idiom (`cx-reticle`, `var(--text-14)` `var(--weight-body-medium)` `var(--beam-600)`,
underlined), label `shell_home_workspace_door`. `HomePage` resolves the branch through
`workspaceFor` server-side.

## 2. States (R-UI-050), ruled cell by cell

The cells are ruled here and **declared in one enumerable place the suite reflects over**:
`src/ui/shell/states.ts` exports `SHELL_STATES`, one row per shipped screen and one cell per
one of R-UI-050's seven states, each cell saying it is rendered (naming its module and its
hook), delegated (naming the owner and why) or impossible (with the reason).
`tests/ui/shell/state-matrix.test.ts` walks it: a screen that declares six states fails, a
row for an area the shell does not ship fails, and a cell claiming a hook no source spells
fails. Prose alone would make a missing state a review note, which is what the clause
forbids; this section is the ruling, `SHELL_STATES` is the same ruling in a walkable form.

- **Loading** — one `loading.tsx` at `t/[tenant]/` renders in `shell-main`, frame intact:
  three core Skeletons keeping the page's layout — 24 px × 240 px (the heading line), then
  two 16 px × min(480 px, 100 %), gap `var(--space-3)`. The frame itself never skeletons:
  `workspaceFor` resolves server-side before paint. Buttons' in-flight legs are `aria-busy`.
- **Empty** — Projects home and Books are the ruled empty states (§1); in M0 they are the
  only content states (project creation is inc-011, Books content M5). Each teaches its next
  action with exactly one action. Settings cannot be empty — a workspace always has a name.
- **Error** — a render or action fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned here); its Decision rules retry, and its recorded I-1 defers the visible report id.
- **Refusal** — the settings answer slot (§1). Projects home and Books request nothing
  refusable; the sample outcome is a notice, deliberately not a refusal.
- **Partial** — impossible on every shell screen: no M0 shell screen renders refusable rows.
- **Offline** — I-20: the fault path, honestly.
- **Permission-denied** — the frameless denial surface (I-17): `<main
  data-testid="shell-permission-denied">`, centred column `min(560px, calc(100vw -
  var(--space-8)))`, padding-top `var(--space-12)` doubled on ≥ sm (the s-auth frame),
  column gap `var(--space-4)`: `<h1>` `shell_denied_heading` (`var(--text-20)`
  `var(--weight-heading)`) · `<p data-testid="shell-denied-permission">`
  `shell_denied_permission` · `<p data-testid="shell-denied-holder">` `shell_denied_holder`
  (both `var(--text-13)` `var(--graphite-700)`, margin 0) · one RefusalState with the
  registered `PERMISSION_NOT_HELD` entry (banner surface, column width), evidence
  `{ href: /t/{their tenantId}, label: shell_denied_evidence }` — or, for a session holding
  no workspace at all, `{ href: "/", label: shell_evidence_home }` — the visible way onward.
  Unauthenticated is never this state: it is the `/sign-in` redirect (AC-3).

## 3. Copy, verbatim (`src/ui/strings/shell.ts`)

`shell_home_workspace_door` **Open your workspace** · `shell_rail_label` **Workspace
sidebar** · `shell_rail_collapse_label` **Sidebar**
· `shell_rail_nav_label` **Main navigation** · `shell_tenant_switcher_label` **Switch
workspace** · `shell_nav_projects` **Projects** · `shell_nav_books` **Books** ·
`shell_nav_settings` **Settings** · `shell_breadcrumb_label` **Breadcrumb** ·
`shell_user_account` **Your account** · `shell_user_sessions` **Sessions** ·
`shell_user_signout` **Sign out** ·
`shell_inspector_label` **Details** · `shell_inspector_empty` **Details of what you select
appear here.** · `shell_projects_heading` **Projects** · `shell_projects_empty_heading`
**No projects yet** · `shell_projects_empty_body` **A project holds your drawings and
everything measured from them. The SAMPLE project is a small, clearly marked example to look
around in.** · `shell_sample_offer` **Add the SAMPLE project** · `shell_sample_unavailable`
**The SAMPLE project is not available yet — nothing was added to your workspace.** ·
`shell_books_heading` **Books** · `shell_books_empty_heading` **Nothing in Books yet** ·
`shell_books_empty_body` **Financial records appear here once your projects produce them.**
· `shell_books_empty_action` **Go to Projects** · `shell_settings_heading` **Settings** ·
`shell_settings_name_label` **Workspace name** · `shell_settings_name_hint` **The name
appears in the sidebar and on every screen of this workspace.** · `shell_rename_submit`
**Save name** · `shell_rename_saved` **The workspace name is saved.** ·
`shell_rename_refusal` **A workspace name needs at least one visible character — nothing was
saved.** · `shell_workspace_unnamed` **Unnamed workspace** ·
`shell_denied_heading` **You do not have access to this workspace** ·
`shell_denied_permission` **Seeing it needs membership of the workspace this address names,
which your account does not hold.** · `shell_denied_holder` **Its existing members hold that
membership.** · `shell_denied_evidence` **Go to your workspace** · `shell_evidence_sign_in`
**Go to sign-in** · `shell_evidence_home` **Go to the home page**.

`src/ui/brand-usage/index.ts` also exports `BRAND_USAGE`, the enumerable R-UI-070 table —
`{ variant; minSizePx; sparkRule: "never" | "at-or-above-32"; surface; neverWith }`, one row
per thing R-UI-070 places on a surface — all four of its usage sentences, not two:
`("mark-nospark", 16, "never", "rail")` · `("mark", 32, "at-or-above-32", "sign-in")` ·
`("mark", 32, "at-or-above-32", "certificates")` · `("lockup-light", 104, "never",
"issued-pdf")` · `("watermark-quiet", 16, "never", "issued-pdf")` · `("draft-banner", 16,
"never", "issued-pdf")`. Two corrections the clause forces: an issued PDF carries the light
lockup **and the quiet watermark**, so the watermark is a row; and the lockup is quiet, because
the full spark mark appears **only** on sign-in and on certificates — a `sparkRule` of
`at-or-above-32` on the PDF row said otherwise. `neverWith` carries the clause's one
co-occurrence rule, "a DRAFT banner never shares a page with the spark", from both sides: the
two spark-bearing rows bar `draft-banner`, and the banner's own row bars `mark`. The unit
tests reflect: the rail's only row is the no-spark variant; spark never appears below 32 px;
spark-bearing surfaces are exactly sign-in and certificates — copper's one scarcity, shared
with act — nothing on an issued PDF carries a spark, and the DRAFT bar is readable from
either row (`tests/ui/shell/brand-usage-completeness.test.ts`).

## 4. Motion (R-UI-004)

Rail width collapse/expand: `var(--motion-panel)` `var(--ease)` (contents unmount without
transition). Chevron turns, row/link/button hover colours: `var(--motion-state)`
`var(--ease)`. Menus, reticle, Skeleton: their own single homes. Route changes, empty
states, notices, refusals: no entrance — answers arrive instantly. Every duration is a
token zeroed at source under reduced motion; no bounce anywhere.

## 5. Tokens

`--graphite-0/50/100/500/600/700/900` · `--beam-100/500/600` · `--info/--info-surface` ·
`--danger/--danger-surface` · `--hairline` · `--space-1/3/4/5/6/8/9/12` · `--radius-4` ·
`--text-12/13/14/16/20` · `--weight-body-medium/--weight-heading` ·
`--motion-state/--motion-panel/--ease`. Px
literals, closed set (core I-1's class): rail 240/48, inspector 280, mark 26, beam bar 3,
chevron 12 with 2 px stroke, trigger ellipsis 280, column measures min(380/420/480/560px …),
skeleton bones 24/16 × 240/480, the lg media-query value, and the 1 px width of the notice's
and the alert's own border. That last one is not an omission being covered over: `--hairline`
is a whole shorthand (`1px solid var(--graphite-200)`) and cannot carry a `--info` or
`--danger` edge, so a coloured 1 px border is spelled `1px solid var(--token)` exactly as the
tree spells it everywhere else it draws one (`refusal-state.css`, `s-auth.css`, `core.css`) —
which §1 already prescribes for both. Any other literal is a defect.

## 6. Themes

No authored `[data-theme]` selector anywhere in `src/ui/shell` or the app routes; every
light/dark difference arrives through token values (R-UI-001). Visible character: the rail's
graphite-50 stands one step off the graphite-0 main field in both themes, seamed by
hairlines; selection is beam-100 fill + beam-500 bar in both. The one theme-stable element
is the mark (I-16): fixed indigo facets in both themes, decorative. Contrast holds on
founder facts: graphite-700 and 600 on graphite-0/50 ≥ 4.5:1, graphite-900 on beam-100,
beam-600 on graphite-0 and info-surface ≥ 4.5:1, beam-500 bar ≥ 3:1 as UI.

**Recorded, not fixed here: the theme resolves once, at document load.** `src/app/layout.tsx`
sets `data-theme` at first paint from a one-shot `matchMedia` read with no `change` listener,
so a person who flips their OS theme with the app open keeps the stale theme until a full
navigation. The root layout is another node's (`src/app/layout.tsx` is outside this
increment's ownership), so this is recorded rather than repaired — and it is not repairable
from here even with the file in hand, for two standing reasons. `docs/design/root-document.md`
settles the resolver's code verbatim and puts the behaviour out of scope by name: it "registers
no change listener — a user-facing theme setting, persistence, and live reaction to OS changes
after first paint are out of scope by name". And `tests/e2e/j-000-golden-path.e2e.ts` asserts
the resolver's own source contains no `addEventListener` (with `DOMContentLoaded`, `onload`,
`setTimeout`, `requestAnimationFrame`, `requestIdleCallback`) — the guarantee that it runs
inline rather than from a deferred callback — so putting the subscription inside the resolver
turns another node's shipped journey red. A subscription elsewhere would be a second writer of
the one root attribute, in a layer that covers `/t/**` and leaves `/` and `/sign-in` stale
(B-17). The live reaction therefore belongs to the root-document node, as one change to the
resolver's settled contract plus its own acceptance.

What this increment owes and holds instead: the shell branches on no theme, so a document that
states `[data-theme=dark]` paints dark through token values alone — J-004's dark checkpoint
proves it, and the baseline is captured on a FRESH LOAD under the emulated preference, since
flipping the emulation on an already-open page re-photographs the light shell.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/[tenantId]` · `/t/[tenantId]/books` · `/t/[tenantId]/settings`
(`{tenantId}` is `tenants.tenantId`, the sign-up-minted uuid). Test ids, exactly the
twenty-seven, on the elements ruled above: `root-home-workspace-door` · `shell-root` ·
`shell-rail` · `shell-rail-mark` · `shell-rail-collapse` · `shell-tenant-switcher` ·
`shell-nav-projects` · `shell-nav-books` · `shell-nav-settings` · `shell-topbar` ·
`shell-breadcrumb` · `shell-user` · `shell-user-sessions` · `shell-user-signout` ·
`shell-main` · `shell-inspector` · `shell-empty` · `shell-empty-action` ·
`shell-sample-offer` · `shell-sample-outcome` · `shell-permission-denied` ·
`shell-denied-permission` · `shell-denied-holder` · `shell-settings-name` ·
`shell-rename-input` · `shell-rename-submit` · `shell-rename-refusal`. No others are added;
the rename-saved notice is found by `role="status"` inside `shell-settings-name`.

Behavioural hooks without new ids: `aria-expanded`/`aria-controls` on `shell-rail-collapse`;
`aria-current="page"` on the selected rail entry and the current crumb; `aria-busy` on
loading Buttons; `role="status"` on sample outcome and rename notice; RefusalState's own
ids/`data-code` inside `shell-rename-refusal` and the denial surface; menu semantics from
the shipped DropdownMenu. Painted selection is graded by resolving `var(--beam-100)`/
`var(--beam-500)` through an in-page probe element, never a literal. AC-1's "never redrawn"
is bound by source: the tree holds no second spelling of the mark's path geometry outside
`src/ui/brand/`.

Journey: `tests/e2e/shell.spec.ts`, titles containing "J-004"; page object
`tests/e2e/pages/shell.page.ts`. It signs up a fresh account with a fixed email and the
fixed workspace name **Datum Works** (scratch DB per run, so both are deterministic — no
volatile text, no masks). Checkpoints (axe serious/critical = 0 at each, never widened):
**j004-shell-light** — `/t/{t}` light, baseline `shell-light` · **j004-shell-dark** — the
same under `[data-theme=dark]` emulation, baseline `shell-dark` · **j004-shell-onboarding**
— the empty Projects home, SAMPLE offer visible and labelled, and after a click the
unavailable notice at `shell-sample-outcome` · **j004-shell-deeplink** — direct load of
`/t/{t}/books` with `shell-nav-books` carrying `aria-current="page"`, then browser back
restoring the prior URL and selection. Baselines live at
`tests/e2e/baselines/design/shell-*.png` via the `snapshotPathTemplate` added to
`playwright.config.ts` (`toHaveScreenshot`, maxDiffPixelRatio 0.002, Linux). `pnpm e2e
--journey J-000` stays green unchanged; `tests/app/root-document.test.tsx` re-asserts both
`/` branches (anonymous: exactly the two doors; signed-in: the one workspace door);
`tests/ui/shell/**` covers the frame, guards' surfaces, empty states, rename answers and
the `BRAND_USAGE` reflection under jsdom.
