# Design Decision — S-Settings (the workspace members surface)

Routes: `/t/{tenant}/settings` (existing, shell inc-013/inc-014) gains one members link;
`/t/{tenant}/settings/members` is new, under `src/app/(app)/t/[tenant]/settings/members/**`
(the tree spelling `/t/[tenant]/settings/members`), inside the shell frame and behind the
membership guard in `t/[tenant]/layout.tsx`. Increment inc-010a2-members-screen. Law:
R-SPINE-003, R-SPINE-006, R-SPINE-060, R-UI-001/003/004/005/012/020/031/050/060, B-17,
B-19, Q-11, Q-17. Every convention of the earlier Decisions binds: `cx-` classes,
tokens-only colour and motion, `cx-reticle` solely from its single home, no `[data-theme]`
selector in authored CSS. Interpretations I-1–I-54 remain in force ("workspace" is the
user-facing word for tenant, s-auth I-11; model values render verbatim in mono, I-25/I-47;
identifiers render whole, I-26; the native `<select>` is the closed choice while no Select
primitive ships, audit I-31). Chrome comes only from shipped primitives — core Button and
Skeleton — plus the one RefusalState and the `cx-members-*` classes this file rules. Copy
lives in the route table `src/app/(app)/t/[tenant]/settings/members/strings.ts`, export
`membersStrings`, keys `members_…` (ruleset I-24); JSX carries no string literal beyond
test ids and fixed attribute values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-55 — workspace roles are model data and render verbatim mono, in rank order.**
  `OWNER`, `ADMIN`, `MEMBER` are the store's closed words (`WORKSPACE_ROLES`,
  `src/core/db`, declared highest rank first): they render in `var(--font-mono)` exactly as
  stored, never title-cased, everywhere they appear — role cell, select options (in
  `WORKSPACE_ROLES`' own order), history role words. Prose around them stays prose.
- **I-56 — a role move is a guarded mutation, not an act: no copper, no dialog, no hiding.**
  Role changes write no act row (the tenancy barrel's own ruling, SEAM-ACT), so no
  ConsequenceDialog opens and nothing wears act colour. The judges are the server's guards,
  reached only through `guardTenancyMutation` (origin, rate limit, two-sided role law — a
  transport-local guard is the B-17 defect). Both forms render on every row for every
  member whatever their own role: R-SPINE-006 forbids UI hiding, so an ADMIN sees the
  remove control on an OWNER's row and the server's refusal is the answer.
- **I-57 — one answer slot, mounted in the row that asked.** `members-refusal` renders
  inside the row whose submission was refused, below its forms, as exactly one RefusalState
  with the entry read off `refusalOf` in value position (Q-07) — the code travels in
  `data-code`, never respelled. At most one refusal stands; the next submission from any
  row clears it. A lapsed session mid-action answers the `/sign-in` redirect (the density
  I-34 door); any other registered code the guard answers — `RATE_LIMITED` included —
  renders through the same slot and the same register lookup.
- **I-58 — member labels come from the fold's read-back; nothing paints a nameless
  member.** `emailKey` is the folded key, not an address (shell I-21), so every member and
  actor label is `presentedValue(emailKey)` (`src/server/auth/folded-key.ts`, the one home,
  imported by the page, never respelled — B-17); a `null` key or `null` read-back renders
  `members_member_unnamed` (the I-23/I-51 class).
- **I-59 — the history is reader-scoped, and the copy says so instead of pretending.**
  `memberRoleHistory` answers only the projects the asking member may read and passes the
  rest over without a marker, so the screen cannot flag what it was never told; honesty is
  standing copy — the roster hint states the scope on every render. Entries render in the
  module's own order; a member with no movements gets `members_history_none`, never silence
  (R-UI-020). The `projectId` renders whole, verbatim mono (I-26) — no project name reaches
  this module's answer, and the screen invents no second read to fetch one.
- **I-60 — the landing link is a section owned by the members glob.** The settings landing
  gains `SettingsMembersLink` (exported from the members route directory, imported by
  `settings/page.tsx` — the only change to that file), mounted between the workspace-name
  and density sections: identity, then people, then preference. The 380 px settings-landing
  measure and label/hint idiom (density §1) bind it.
- **I-61 — the invitation panels are fixed here and rendered by inc-010b.** The ids
  `members-invite-form` and `members-pending-invitations` and their places in §1's order
  are contract now (C-05); this increment renders neither, and no placeholder, disabled
  chrome or "coming soon" copy stands where they will (Q-17). Their internal layout and
  copy are authored when inc-010b revises this file, before its acceptance is written (C-13).
- **I-62 — the matrix speaks this workspace's own register.** The screen's
  permission-denied is the workspace-worded `WORKSPACE_PERMISSION_NOT_HELD`, not the
  project-worded entry the shared cells carry, so the members declaration overrides that
  cell; its refusal cell mounts all four reachable refusals in the removal guard's judging
  order, so the screen's whole refusal vocabulary is on exhibit and every appended
  `REFUSAL_ENTRIES` entry has its consumer. Existing matrix rows and entries do not move
  (append-only, per the increment's grant).

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: authenticates, mints the
`TenancyActor`, calls `membersOf` then `memberRoleHistory` per member from
`src/modules/spine/tenancy`, resolves labels per I-58, renders the section), `actions.ts`
(`changeMemberRoleAction`, `removeMemberAction` — thin: authenticate, mint ctx, build the
`TenancyRequest` with the stated origin, call the barrel under `guardTenancyMutation`,
revalidate this route; a marked refusal is caught and answered as its code, anything else
rethrows to the fault seam), `members-section.tsx` (`MembersSection`, client component,
props exactly the page's composed rows plus the two actions, jsdom-mountable — the
RulesetSettingsSection precedent), `members-link.tsx` (I-60), `loading.tsx`, `states.ts`
(§2), `strings.ts`, `members.css`.

**The landing link** (`/t/{tenant}/settings`, I-60): `<section class="cx-members-link">`,
max-width 380 px, column flex, gap `var(--space-1)`, margin-top `var(--space-6)`: label
`members_link_label` (`var(--text-13)` `var(--weight-body-medium)` `var(--graphite-700)`),
hint `members_link_hint` (`var(--text-12)` `var(--graphite-600)`, margin 0), then
`<a data-testid="settings-members-link" class="cx-reticle">` — next/link, href
`/t/{tenant}/settings/members`, label `members_link_action`, the evidence-link idiom:
`var(--text-13)` `var(--weight-body-medium)` `var(--beam-600)`, underlined at rest, hover
`var(--beam-500)`, `align-self: start`.

**The members page** renders in `shell-main`, one column `cx-members`: max-width 800 px
(the settings-screen measure), column flex, gap `var(--space-6)`. Rail and breadcrumb are
the shell's: `areaOf` answers `settings`, the Settings rail row carries `aria-current`, and
browser back returns to the landing (R-UI-031). Header block (gap `var(--space-2)`): `<h1>`
`members_heading` — `var(--text-20)` `var(--weight-heading)` `var(--graphite-900)`, margin
0 — over `members_caption` in `var(--text-13)` `var(--graphite-600)`.

### Roster (`<section aria-labelledby data-testid="members-section">`)

`<h2>` `members_roster_heading` (`var(--text-16)` `var(--weight-heading)`
`var(--graphite-900)`, margin 0), hint `members_roster_hint` (`var(--text-12)`
`var(--graphite-600)`, carries the I-59 scope sentence), then
`<ul data-testid="members-list">` — list-style none, margin 0, padding 0, border-top
`var(--hairline)`. One `<li data-testid="members-row" data-user={userId}>` per member, in
exactly `membersOf`'s order (the store's own, userId ascending — never re-sorted, never
localeCompare), padding-block `var(--space-3)`, border-bottom `var(--hairline)`, column
flex gap `var(--space-2)` — variable-height blocks with hairline seams (the audit I-36
class; no DataTable: no sort, no columns, no virtualisation to use):

- **Identity line** — flex, baseline, gap `var(--space-3)`: the member's label (I-58) in
  `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`, single line,
  ellipsis; then `<span data-testid="members-row-role">` — the role verbatim per I-55,
  `var(--font-mono)` `var(--text-12)` `var(--graphite-700)`. Left-packed; the trailing
  space falls at the end of the row (participants §1's reading ruling).
- **Controls line** — flex, wrap, gap `var(--space-3)`, align-items center:
  `<form data-testid="members-role-form">` — inline flex gap `var(--space-2)`: a hidden
  input carrying `subjectUserId`; `<select data-testid="members-role-select"
  class="cx-input cx-reticle cx-members-select">` (the audit I-31 idiom: `.cx-input` worn
  whole, `.cx-members-select` adds min-width 140 px and `var(--font-mono)`
  `tabular-nums slashed-zero` — a role is always chosen, so the mono face always applies;
  focus is the reticle fallback), `aria-label` `members_role_label` filled with the row's
  member, options the three roles per I-55, the member's current role preselected; then a
  core secondary Button `data-testid="members-role-submit"`, visible label
  `members_role_submit` and `aria-label` `members_role_submit_label` filled with the row's
  member. Beside it, `<form data-testid="members-remove-form">` — the hidden `subjectUserId`
  and a core danger Button `data-testid="members-remove-submit"`, visible label
  `members_remove_submit` and `aria-label` `members_remove_submit_label` filled with the
  row's member. Every control on a row names the member it acts on: the roster repeats the
  same two controls, and a name that does not say whom it acts on is the same name N times
  to anyone reading the page through the accessibility tree — a removal is irreversible, so
  the button that carries one says whose membership it takes away. The visible words are the
  first words of the spoken name, so what is read and what is said never disagree. While an
  action is in flight its Button takes core's loading state and the section's status line
  speaks; controls stay enabled after any refusal — a retry is never disarmed.
- **Answer slot** (I-57) — `<div data-testid="members-refusal">`, mounted only while a
  refusal stands, full row width: one RefusalState, entry verbatim from the register,
  surface as the entry hints (banner for `WORKSPACE_PERMISSION_NOT_HELD`, inline for the
  other three). Evidence: `MEMBER_HAS_ACTS` → `{ href: /t/{tenant}, label:
  home_evidence_projects }` (the open campaigns live in Projects); the other three →
  `{ href: this route, label: members_evidence_roster }` (the roster above names the
  owners, and the role form above is where an owner is made — the s-design
  warning-cell current-route precedent).
- **Role history** — a label `<span id>` `members_history_label` (`var(--text-12)`
  `var(--weight-body-medium)` `var(--graphite-600)`), then
  `<ol data-testid="members-role-history" aria-labelledby={that id}>` — list-style none,
  margin 0, padding 0. Each `<li data-testid="members-history-entry"
  data-project={projectId} data-direction={direction} data-role={role}>`, padding-block
  `var(--space-1)`, two lines (the participants §1 anatomy): line one — flex, baseline, gap
  `var(--space-3)`: the direction verbatim (`var(--font-mono)` `var(--text-12)`
  `var(--graphite-600)`, min-width 88 px), the role verbatim (`var(--font-mono)`
  `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`), the `projectId`
  whole (`var(--font-mono)` `var(--text-12)` `var(--graphite-600)`, `user-select: all`).
  Line two, indented past the 88 px ruler plus its gap (stated once as the row's custom
  property): `members_history_by` filled with the actor's label (I-58;
  `members_member_unnamed` when null) and the date through `src/core/format`'s `formatDate`
  (DD MMM YYYY, mono `tabular-nums slashed-zero`), `var(--text-12)` `var(--graphite-600)`.
  Direction carries its meaning in the word, never in colour (Q-11). No movements: one line
  `members_history_none`, `var(--text-12)` `var(--graphite-600)`, in the `<ol>`'s place.

Last in the section, a **status line** `<p role="status" aria-live="polite">` (no testid;
found by role): `var(--text-12)` `var(--graphite-600)`, margin 0, min-height
`var(--text-13)`; `members_status_pending` while an action is in flight,
`members_status_done` after a commit re-renders the roster (the changed row is the visible
answer, no toast), empty otherwise. It never speaks while a refusal stands.

### Invitations (I-61, authored — the panel's own layout and copy)

After the roster, in this order: `<form data-testid="members-invite-form">` (invite by
email) and `<section data-testid="members-pending-invitations">` (the pending list with
resend and revoke). Both live inside one `<div class="cx-invitations">` — column flex, gap
`var(--space-3)` — which stands as the second block of the page column
(`cx-members-page`: column flex, gap `var(--space-6)`, max-width 800 px, the settings-screen
measure the roster already uses).

Header block (gap `var(--space-1)`): `<h2 class="cx-invitations-heading">`
`invitations_heading` — `var(--text-16)` `var(--weight-heading)` `var(--graphite-900)`,
margin 0 — over `invitations_hint` in `var(--text-12)` `var(--graphite-600)`. The panel's
`<h2>` sits beside the roster's, one level under the screen's `<h1>`.

**Invite form** — `<form data-testid="members-invite-form" aria-labelledby={the heading}>`,
column flex gap `var(--space-1)`: a `<label>` `invitations_email_label` (`var(--text-13)`
`var(--weight-body-medium)` `var(--graphite-700)`) bound to the field by id; a hint
`invitations_email_hint` (`var(--text-12)` `var(--graphite-600)`, margin 0) which the field
names through `aria-describedby`; then a row (flex, wrap, align-items center, gap
`var(--space-2)`, margin-top `var(--space-1)`): the core Input
`data-testid="invitations-email"` (`type="email"`, `.cx-input .cx-reticle` worn whole,
`flex: 1 1 320px`, min-width 240 px) and a core primary Button
`data-testid="invitations-submit"` labelled `invitations_submit`. While a submission is in
flight the Button takes core's loading state and the panel's status line speaks; the field
clears only when the invitation landed. Controls stay enabled after any refusal — a retry is
never disarmed (R-SPINE-006).

**Pending list** — `<section data-testid="members-pending-invitations" aria-labelledby>`,
column flex gap `var(--space-2)`: `<h3 class="cx-invitations-pending-heading">`
`invitations_pending_heading` (`var(--text-13)` `var(--weight-body-medium)`
`var(--graphite-700)`, margin 0), then `<ul class="cx-invitations-list">` — list-style none,
margin 0, padding 0, border-top `var(--hairline)` only when it holds a row. One
`<li data-testid="invitations-row" data-invitation={invitationId}>` per standing offer, in
the module's own order (newest first, settled by the invitation id — never re-sorted, never
localeCompare: the offer just made is the one the reader is looking for), flex wrap, align-items center, justify-content space-between, gap
`var(--space-3)`, padding-block `var(--space-3)`, border-bottom `var(--hairline)`:

- **Identity line** — flex, baseline, gap `var(--space-3)`, margin 0: the invitee's address
  read back through the fold's one home (I-58; `invitations_invitee_unnamed` when the key
  carries none) in `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`,
  single line, ellipsis; then the offered role verbatim per I-55, `var(--font-mono)`
  `var(--text-12)` `var(--graphite-700)`.
- **Controls** — flex, wrap, gap `var(--space-2)`: a core secondary Button
  `data-testid="invitations-resend"`, visible label `invitations_resend` and `aria-label`
  `invitations_resend_label` filled with the row's invitee; beside it a core danger Button
  `data-testid="invitations-revoke"`, visible label `invitations_revoke` and `aria-label`
  `invitations_revoke_label` filled with the row's invitee. Every control on a row names the
  invitation it acts on, for the reason the roster's do: a list read aloud is N distinct
  controls, not N identical ones. The visible words are the first words of the spoken name.
- **No pending offer** — `<p data-testid="invitations-none">` `invitations_none`,
  `var(--text-12)` `var(--graphite-600)`, standing where the rows would be. Never silence
  (R-UI-020); it steps aside the moment a row stands.

**Answer slot** (I-57) — `<div data-testid="invitations-refusal">`, mounted only while a
refusal stands, after the pending list and full panel width: one RefusalState, entry
verbatim from the register with its `data-code`, surface as the entry hints. The reachable
codes are `WORKSPACE_PERMISSION_NOT_HELD` (a role that does not administer the workspace, or
an offer of a rank above the inviter's), `RATE_LIMITED` (the tenant-admin door's allowance)
and `INVITATION_NOT_CLAIMABLE` (a resend or a withdrawal of an offer that stopped standing).
Evidence for all three: `{ href: this route, label: members_evidence_roster }` — the roster
above names the owners, and the role form above is where an owner is made. They render
through the register lookup in this slot and do not join the exhibited matrix four (I-57's
precedent, and the reason `MEMBERS_STATES` and the matrix's members row do not move).

Last in the panel, a **status line** `<p role="status" aria-live="polite">` (no testid;
found by role): `var(--text-12)` `var(--graphite-600)`, margin 0, min-height
`var(--text-13)`; `invitations_status_pending` while a move is in flight,
`invitations_status_done` after a commit re-renders the list, empty otherwise. It never
speaks while a refusal stands.

Route files added under `members/invitations/`: `strings.ts` (§3), `actions.ts`
(`inviteMemberAction`, `resendInvitationAction`, `revokeInvitationAction` — thin:
authenticate, mint the actor, build the `TenancyRequest` with the stated origin, dispatch
`{ kind: "createInvitation" | "resendInvitation" | "revokeInvitation" }` through
`guardTenancyMutation` bound once with the shipped limiter and the shipped invitation
machinery, revalidate this route), `invitations-panel.tsx` (`InvitationsPanel`, client
component, props exactly the page's composed rows plus the three actions, jsdom-mountable)
and `invitations.css`. `page.tsx` changes only to read `pendingInvitations`, resolve each
invitee's label, and mount the panel after the roster.

## 2. States (R-UI-050), ruled cell by cell

Declared twice, by law: `states.ts` (route directory) exports `MEMBERS_STATES` — one row,
seven cells in the shell matrix's cell shape (the PARTICIPANTS_STATES shape); and
`src/ui/screen-states/matrix.tsx` gains the route key `"/t/[tenant]/settings/members"`,
spread over `workspaceCells` with the overrides below (I-62). The suite reflects over both
(B-19); existing rows do not move.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout, gap
  `var(--space-3)` — 24 × 240 px (heading), 16 × 360 px (caption), four
  48 × min(720 px, 100 %) (member blocks). Matrix: `bones(6)`.
- **Empty** — impossible, by law: seeing the roster needs membership (`membersOf` refuses a
  stranger rather than answering an empty list), so the list always holds at least the
  reader. Matrix: `reason(strings.state_empty_members_reader)`.
- **Error** — a render, read or action fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral. Matrix: `workspaceCells`.
- **Refusal** — the I-57 answer slot; reachable codes are exactly the register's four —
  `MEMBER_HAS_ACTS`, `WORKSPACE_WOULD_HAVE_NO_OWNER`, `SELF_REMOVAL_NOT_ALLOWED`,
  `WORKSPACE_PERMISSION_NOT_HELD` — each rendered with code (`data-code`), message, remedy
  and evidence; silence never happens. Matrix: the four stacked in that judging order, with
  §1's evidence pairs; `REFUSAL_ENTRIES` gains the four entries byte-identical to the
  register's own.
- **Partial** — the history reads answer only the projects the reader may read, and the
  roster hint says so on every render (I-59); every row the module answered renders whole
  and none is hidden. Matrix: `reason(strings.state_partial_members_scope)`.
- **Offline** — a fault of reachability (shell I-20): server-rendered page, failed
  navigation or action surfaces the error path; no invented banner. Matrix:
  `workspaceCells`.
- **Permission-denied** — a request for a workspace the session does not hold meets the
  shell's frameless denial before this route mounts; a member whose role does not carry a
  mutation is I-57's in-place refusal, never hiding. Matrix override (I-62): the `Denial`
  shell with `REFUSAL_ENTRIES.WORKSPACE_PERMISSION_NOT_HELD` and `WORKSPACE_EVIDENCE` —
  the workspace role's permission, held by the workspace's owners, which is what the
  entry's message and remedy say.

## 3. Copy, verbatim

Route table (`strings.ts`, export `membersStrings`, keys `members_…`):
`members_heading` **Members** · `members_caption` **Who belongs to this workspace, the role
each member holds, and every role movement on its projects.** · `members_link_label`
**Members** · `members_link_hint` **Who belongs to this workspace and what each member may
do.** · `members_link_action` **Manage members** · `members_roster_heading` **Roster** ·
`members_roster_hint` **Every member, in the store's own order. Each role history lists
movements on the projects you may read.** · `members_role_label` **Role for {member}** ·
`members_role_submit` **Change role** · `members_role_submit_label` **Change role for
{member}** · `members_remove_submit` **Remove** · `members_remove_submit_label` **Remove
{member}** (the three `{member}` slots are data — the row's own label per I-58) ·
`members_history_label` **Role history** · `members_history_by` **by {actor} on {date}**
(both slots are data) · `members_history_none` **No role movements on this workspace's
projects yet.** · `members_member_unnamed` **Unnamed member** · `members_status_pending`
**Carrying the change out…** · `members_status_done` **Done. The roster shows the result.**
· `members_evidence_roster` **See the members list**.

Invitations panel table (`invitations/strings.ts`, export `invitationsStrings`, keys
`invitations_…`): `invitations_heading` **Invitations** · `invitations_hint` **Offers of
membership this workspace has made that nobody has accepted yet. An invitation is one live
link at a time: resending replaces the last one, and withdrawing ends it.** ·
`invitations_email_label` **Email address** · `invitations_email_hint` **The address the
invitation is mailed to. It becomes a membership when the person signs in and accepts it.**
· `invitations_submit` **Send invitation** · `invitations_pending_heading` **Pending** ·
`invitations_resend` **Resend** · `invitations_resend_label` **Resend the invitation to
{invitee}** · `invitations_revoke` **Withdraw** · `invitations_revoke_label` **Withdraw the
invitation to {invitee}** (both `{invitee}` slots are data — the row's own label per I-58) ·
`invitations_none` **No invitation is waiting to be accepted.** ·
`invitations_invitee_unnamed` **Unnamed address** · `invitations_status_pending` **Carrying
the invitation out…** · `invitations_status_done` **Done. The list shows the result.** The
panel's refusal evidence reuses the roster's own `members_evidence_roster`, which is the
same link to the same place: one sentence, one home (B-17).

Registry copy, already committed in `src/core/errors.ts` and rendered verbatim (never
re-worded here or anywhere): **WORKSPACE_PERMISSION_NOT_HELD** · error · banner · *Your
role in this workspace does not carry the permission this action needs.* / *Ask an owner of
the workspace to carry it out, or to give you a role that carries it.* ·
**SELF_REMOVAL_NOT_ALLOWED** · error · inline · *You cannot remove yourself from a
workspace.* / *Ask another owner to remove you, so somebody is left who can undo it.* ·
**WORKSPACE_WOULD_HAVE_NO_OWNER** · error · inline · *This would leave the workspace with
no owner, so it was not carried out.* / *Make another member an owner first, then try
again.* · **MEMBER_HAS_ACTS** · error · inline · *This member holds recorded acts on open
campaigns, so their membership was not removed.* / *Remove them once those campaigns close
— the record keeps its author until then.*

Mirror (the risk note's discipline): `src/ui/strings/screen-states.ts` gains
`state_members_evidence_roster` **See the members list** — byte-identical to
`members_evidence_roster`, pinned equal by a test in `tests/members/**` — plus the
matrix-only reasons `state_empty_members_reader` **Seeing the roster needs membership of
the workspace, so the list always holds at least the person reading it.** and
`state_partial_members_scope` **The role histories answer only the projects the reader may
read, and the roster's hint says so; every answered row renders.** Voice throughout: calm,
concrete, no exclamation marks; role words, directions, ids and dates are data, never
woven into sentences (I-55).

## 4. Motion (R-UI-004)

None beyond the inherited idioms: Button and link colour over `var(--motion-state)`
`var(--ease)`, the select's border mirroring the Input's hover, the reticle draw and the
Skeleton pulse in their single homes. Rows, refusals, history and the status line mount
with no entrance — answers arrive instantly. Every duration is a token zeroed at source
under reduced motion; no bounce anywhere.

## 5. Tokens

`--graphite-600/700/900` · `--beam-500/600` (the landing link; the refusal card's own
tokens are RefusalState's) · `--hairline` · `--space-1/2/3/6` · `--text-12/13/16/20` ·
`--font-mono` · `--weight-body-medium/--weight-heading` · `--motion-state/--ease`. Px
literals, closed set (core I-1's class): the 800 px page measure, the 380 px landing
section, the 140 px select min-width, the 88 px direction column, and the skeleton bones
24/16/48 × 240/360/720. Any other literal is a defect.

## 6. Themes

`members.css` contains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001). Contrast holds on founder facts in both themes:
graphite-600/700/900 on graphite-0 ≥ 4.5:1, beam-600 on graphite-0 ≥ 4.5:1, the danger
pair inside the shipped danger Button and RefusalState per their own Decisions. No basis
colour and no copper appears anywhere on this surface (I-56).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/settings` (gains the link only) and `/t/{tenant}/settings/members`
(new; tree key `/t/[tenant]/settings/members`). Test ids, exactly the contract's, on the
elements ruled in §1: `settings-members-link` · `members-section` · `members-list` ·
`members-row` (`data-user`) · `members-row-role` · `members-role-history` ·
`members-history-entry` (`data-project`, `data-direction`, `data-role`) ·
`members-role-form` · `members-role-select` · `members-role-submit` ·
`members-remove-form` · `members-remove-submit` · `members-refusal` — plus I-61's two outer
slots, now rendered: `members-invite-form` · `members-pending-invitations`. No others are
added at this level; the ids INSIDE those two slots are the invitations panel's own closed
set, ruled in §1 above and listed there rather than here, so this roster stays exactly the
one the members page object holds. Server actions: `changeMemberRoleAction`,
`removeMemberAction`, and the panel's `inviteMemberAction`, `resendInvitationAction`,
`revokeInvitationAction`. Behavioural hooks without new ids:
`role="status"` on the status line, `aria-label` on the select from the strings table,
RefusalState's own ids and `data-code` inside `members-refusal`, `cx-reticle` on link,
select and Buttons, the `<h1>`/`<h2>` hierarchy, the link's resolved href.

Page objects: `tests/members/support/members-page.ts` and `members-stage.ts`. Journey
checkpoints (axe serious/critical = 0 at each, never widened): **members-by-navigation** —
from the settings landing, activating the visible `settings-members-link` (never a typed
URL) lands on the roster with roles and histories rendered; browser back returns to the
landing (R-UI-031). **refusal-in-place** — an ADMIN submits an OWNER's remove form and the
registered `WORKSPACE_PERMISSION_NOT_HELD` message and remedy render inside
`members-refusal` through the one RefusalState; the roster is unchanged. jsdom acceptance
mounts `MembersSection` with injected rows and actions and walks `MEMBERS_STATES`; the
live proof drives the shipped route doors against a provisioned scratch database, no
mocked module.
