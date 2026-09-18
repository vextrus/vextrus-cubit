# Design Decision — S-Settings (the workspace members surface)

```
┌R─┬────────┬──────────────────────────────────────────────────────────────────────┐
│  │ ws › Settings › Members                                       ⌘K ⟳ ✉ ◉        │
│  ├────────┼──────────────────────────────────────────────────────────────────────┤
│  │General │ Members  (i)                                    ⌕ Search the roster   │  header 40
│  │Members◂│ ┌──────────────────┬──────────┬──────────────────┬────────┬────┐      │
│  │Books   │ │ Member           │ Role     │ Role history     │Projects│ ⋯  │      │  28 px rows
│  │Rule set│ │ j002-owner@…     │ Owner  ▾ │ Granted Principal│      1 │ ⋯  │      │  first row y≈104
│  │Taxonomy│ │ j002-member@…    │ Admin  ▾ │ No role movement…│      0 │ ⋯  │      │
│  │Tax     │ │ ⚠ j002-member@…  │ Member ▾ │ Granted Measurer │      1 │ ⋯  │      │  partial row
│  │        │ │   ┌────────────────────────────────────────┐   │        │    │      │
│  │        │ │   │ This member holds recorded acts …      │   │        │    │      │  RefusalState
│  │        │ │   │ Remove them once those campaigns close…│   │        │    │      │  in the row
│  │        │ │   │ Go to Projects →                       │   │        │    │      │
│  │        │ │   └────────────────────────────────────────┘   │        │    │      │
│  │        │ └──────────────────┴──────────┴──────────────────┴────────┴────┘      │
│  │        │ No member of this workspace matches that.   Done. …            (i)     │  foot 28
│  │        │ Invitations  2   (i)            [invitee@…            ] ● Send invit.  │  section 28
│  │        │ ┌──────────────────┬──────────┬───────────────────────────┐            │
│  │        │ │ Email address    │ Role     │ Resend · Withdraw         │            │  28 px rows
│  │        │ │ j002-invitee@…   │ Member   │ Resend   Withdraw         │            │
│  │        │ └──────────────────┴──────────┴───────────────────────────┘            │
└──┴────────┴──────────────────────────────────────────────────────────────────────┘
       160                                   the content pane
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| section nav | the workspace's settings areas; Members is `settings-members-link` and carries `aria-current` | 160 × 100 % (`--drawer-w-min`), rows `--control-h` | — (an area with no screen is shown disabled with its reason in a tooltip) | — | — |
| header | the title, the `(i)` that holds the caption, the search | 100 % × 40 | — | — | — |
| roster (primary) | who belongs, the role each holds, the record, the count of projects, the row menu | flex × `--row-h` rows | impossible — seeing the roster needs membership, so it always holds the reader | the root boundary (`src/app/error.tsx`) | `loading.tsx` bones at the row height |
| row refusal | `RefusalState` in the refused row's own member cell (§5 rule 8's partial row: ⚠ on the row, the answer beneath it) | row × auto | — | — | — |
| row menu | the `⋯`, holding the screen's single danger item | `--control-h` square | — | — | — |
| roster foot | the search's honest none, the live status line, the roster's `(i)` | 100 % × `--control-h` | "No member of this workspace matches that." | — | — |
| invitations head | what the second table holds, how many stand, and the screen's ONE primary | 100 % × `--control-h` | — | — | — |
| invitations (second table) | the offers that still stand, with Resend and Withdraw in the row | flex × `--row-h` rows | "No invitation is waiting to be accepted." one line | `invitations-refusal` | — |

Above the fold: the first roster row stands at y ≈ 104 at 1440×900 and at 1280×800 — the frame's
40 px top bar, `shell-main`'s 24 px padding and this screen's 40 px header, and nothing else.

Built on Design Direction 00 §3.6's Settings template, whose geometry outranks this file where
the two disagree (§3's precedence); what the rebuild changed is recorded as I-198–I-203 below.

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

- **I-198 — the settings TEMPLATE is one component, and this screen is drawn in it.**
  Design Direction 00 §3.6 rules settings a two-pane template: a 160 px section nav and a
  content pane whose primary is a table. The frame lives once, in
  `src/app/(app)/t/[tenant]/settings/settings-pane.tsx` (`SettingsPane`, `SettingsHeader`,
  `SettingsAbout`, `workspaceSettingsNav`) with `settings.css` beside
  it, and the workspace's and the project's settings screens are all rendered inside it —
  a second spelling of the nav or of the 40 px header would be the copy B-17 forbids.
  **Amended 2026-09-18 (inc-304a-ruleset-authoring-ui):** the project's side of that nav is no
  longer a function of this template that each project screen calls. The project settings areas are
  a frame — `src/app/(app)/t/[tenant]/p/[project]/settings/layout.tsx` over the roster in
  `settings/areas.ts` — which Next mounts once around every area, so the nav is rendered exactly
  once however many project settings screens there come to be, and `projectSettingsNav` is deleted
  rather than left as a second way to draw it. The frame keeps this template's own `settings.css`:
  the 160 px pane, the 40 px header and the row chrome are still spelled here, once.
- **I-199 — the nav row IS the door to this screen (discharging I-60).** The landing's
  `SettingsMembersLink` section is deleted: `settings-members-link` is the nav's Members
  row, which stands on every settings screen, carries `aria-current` on this one, and is
  what a person activates from the landing (R-UI-031 — no screen is reached only by a
  typed URL). A second link to the same place on the same page would be two elements
  answering to one id.
- **I-200 — the roster is the shipped DataTable, and the answer stays in the row.** §5 makes
  the DataTable the one grid; §5 rule 8 makes a refused row the PARTIAL pattern — the row
  shown with a ⚠ and a compact `RefusalState` beneath it, never hidden. I-57's "in the row
  that asked" is kept literally: the answer renders inside the refused row's own member
  cell, so the refusal and the row are one element for a reader and for a suite. Two rules
  in `members.css` are what make that true and they are the only two that reach into the
  grid's chrome: the refused row grows to `height: auto` while its other cells keep the
  28 px line, and a cell's `overflow` is `visible` so the inline `Select`'s listbox is not
  clipped by the row it belongs to (the cell's own `.cx-table-cell-text` keeps §5 rule 2's
  ellipsis, so no truncation law is given up).
- **I-201 — one role control per row, and the store's word in the technical channel.** The
  role is an inline `Select` at `--control-h` whose options read "Owner", "Admin", "Member"
  through the primitive's own humanising rule (§6: people see labels, never machine
  identifiers). The store's own word is published, unchanged, on
  `<span data-testid="members-row-role" data-technical>` — the channel §6 and the rubric's
  C6 both name — so `OWNER` is still what a suite, an operator and an export read. The
  confirm stands only when a different role has been stated, or while a refusal is the
  row's last answer, because a retry is never disarmed (R-SPINE-006).
- **I-202 — one danger style, in the row's `⋯` menu.** Removal is irreversible, so it is not
  a red button sitting in a list somebody is scrolling: the row's last cell is a `⋯` ghost
  trigger (`members-remove-submit`, named for the move it carries) over a menu whose single
  item is the danger one. The item asks the row's own `members-remove-form` to submit, so
  the path a person takes and the path a suite takes are one path (B-17). The invitations
  table's Withdraw is NOT danger-styled: an offer nobody has accepted can be made again.
- **I-203 — the helper prose is behind the `(i)`, and the record is a column.** §6 allows at
  most one helper line per screen and this screen has none: the caption lives in the
  header's `(i)` popover, the I-59 scope sentence in the roster foot's. The record keeps
  its own column — one `members-role-history` list per row, one `members-history-entry` per
  movement, its project id on `data-project` and never as body text — so what the module
  answered is on the screen, one line per row, given back whole by the grid's own
  truncation tooltip (§5 rule 2).

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: authenticates, mints the
`TenancyActor`, calls `membersOf` then `memberRoleHistories` once for the whole roster from
`src/modules/spine/tenancy`, resolves labels per I-58, renders the section and the panel
inside `SettingsPane`), `actions.ts` (`changeMemberRoleAction`, `removeMemberAction` —
thin: authenticate, mint ctx, build the `TenancyRequest` with the stated origin, call the
barrel under `guardTenancyMutation`, revalidate this route; a marked refusal is caught and
answered as its code, anything else rethrows to the fault seam), `members-section.tsx`
(`MembersSection`, client component, props exactly the page's composed rows plus the two
actions, jsdom-mountable — the RulesetSettingsSection precedent), `loading.tsx`, `states.ts`
(§2), `strings.ts`, `members.css`. The template it is drawn in is I-198's, one directory up.

**The template** (I-198). `SettingsPane` is a CSS grid of `var(--drawer-w-min)` and the rest:
the nav is a `<nav aria-label>` of `<li>` rows, each row `--control-h` tall, 13 px, radius 4,
hover `--surface-hover`; the row for the area a reader is standing in carries
`aria-current="page"`, `--surface-selected` and R-UI-030's 3 px inset beam bar. An area with
a screen is a `next/link` (Members is `settings-members-link`, I-199; Books is the shell's own
`books` area); an area with none — Rule set, Taxonomy, Tax — is a `<span aria-disabled>` in a
`Tooltip` saying `settings_nav_unbuilt`, so it is neither hidden nor broken (§3.3's "disabled
with a tooltip instead of inline text"). The content pane is a column, gap `--gap-section`.

**The header** (40 px, one per screen): `<h1>` `members_heading` at `var(--text-20)`
`var(--weight-heading)`, then the `(i)` — a ghost `PopoverTrigger` one `--control-h` square
holding `members_caption` — then, pushed to the trailing edge, the search: the shipped
`Input` at `--control-h`, 240 px, named and hinted by `members_search_label`. The search
filters the rows this screen was handed by address and by role, in the browser: it is a
reading of a roster already on the page, never a second read (B-17).

### Roster (`<section aria-labelledby data-testid="members-section">`)

The section is named by `members_roster_heading` and holds one `DataTable` in a
`<div data-testid="members-list">` — table id `members-roster`, rows at `--row-h`, the first
column frozen, column furniture remembered per reader (§5 rule 3). One row per member, in
exactly `membersOf`'s order (the store's own, never re-sorted, never localeCompare), carrying
`data-testid="members-row"` and `data-user`, five columns:

- **Member** (280, the frozen key column, so it is the row's `rowheader`) — the label (I-58),
  13 px `--weight-body-medium`, one line, ellipsis, the grid's tooltip on truncation. When a
  refusal stands for this row the answer slot is mounted here, under the label: one
  `<span data-testid="members-refusal" data-user>` holding one `RefusalState`, entry verbatim
  from the register with its `data-code`, max 420 px (I-200). The row itself carries
  `data-refused` and the grid draws the ⚠ on this cell.
- **Role** (200) — `<form data-testid="members-role-form">`: the hidden `subjectUserId`, the
  shipped `Select` (`members-role-select`) at `--control-h` with `aria-label`
  `members_role_label` filled with the row's member and the three roles as options in
  `WORKSPACE_ROLES`' order, read as words (I-201); the store's own word on
  `<span data-testid="members-row-role" data-technical>`; and the secondary confirm
  (`members-role-submit`, label `members_role_submit`, `aria-label`
  `members_role_submit_label` filled with the row's member) exactly when I-201 says it stands.
- **Role history** (260) — `<ol data-testid="members-role-history">`, always rendered, one
  `<li data-testid="members-history-entry" data-project data-direction data-role>` per
  movement in the module's own order: the direction and the role as words, then
  `members_history_by` filled with the actor's label (I-58; `members_member_unnamed` when
  null) and the day through `src/core/format`'s `formatDate`. Entries are separated by a
  hairline, the line never wraps, and a member with no movements reads
  `members_history_none` beside an empty list (I-203).
- **Projects** (96, right-aligned, mono tabular) — how many distinct projects the reader's own
  record names for that member: a figure derived from the record already on the row, not a
  second read.
- **`⋯`** (48) — `<form data-testid="members-remove-form">` holding the hidden
  `subjectUserId` and the menu I-202 rules: the ghost trigger `members-remove-submit`,
  `aria-label` `members_remove_submit_label` filled with the row's member, over a
  `DropdownMenuContent` whose single `danger` item reads `members_remove_submit`.

Every control on a row names the member it acts on: the roster repeats the same controls, and
a name that does not say whom it acts on is the same name N times to anyone reading the page
through the accessibility tree — a removal is irreversible, so the control that carries one
says whose membership it takes away. The visible words are the first words of the spoken name.
While a move is in flight its control takes core's loading state and the foot's status line
speaks; controls stay enabled after any refusal — a retry is never disarmed.

**The roster foot** (`--control-h`): the search's honest none (`members_search_none`, only
while the filter matches nothing), the status line — `<p role="status" aria-live="polite">`,
`members_status_pending` while a move is in flight, `members_status_done` after a commit
re-renders the roster, empty otherwise, and never speaking while a refusal stands — and, at
the trailing edge, the roster's own `(i)` holding I-59's scope sentence `members_roster_hint`.

### Invitations (I-61, authored — the panel's own layout and copy)

After the roster, in this order (I-61's own): the invite form, then the pending list. Both
live inside one `<div class="cx-invitations">` — column flex, gap `var(--space-2)` — which
stands as the second block of the content pane.

**The section line** (`--control-h`, the roster's own idiom): `<h2>` `invitations_heading` at
`var(--text-14)` `var(--weight-heading)`, then the count of standing offers as a mono figure
beside the words it counts (a number is data and is never woven into a sentence), then the
`(i)` holding `invitations_hint` and `invitations_email_hint` — the two sentences this panel
used to print as a header block and a field hint (§6). At the trailing edge of the same line,
the invite form.

**Invite form** — `<form data-testid="members-invite-form" aria-labelledby={the heading}>`,
flex, gap `var(--space-2)`: the core Input `data-testid="invitations-email"` (`type="email"`,
`--control-h`, 240 px, named AND hinted by `invitations_email_label`, which is the same
wording the pending table heads its first column with — one home for the words, B-17) and the
screen's ONE primary, a core primary Button `data-testid="invitations-submit"` labelled
`invitations_submit`. It is the only primary on this screen and the only copper on it; the
roster's controls are secondary and ghost, and the single danger style is I-202's menu item.
No control in this panel ever takes core's loading state: that state swallows the button's own
activation, and a press swallowed here is an attempt the server's allowance never counts — the
answer to a burst is the door's `RATE_LIMITED` in the answer slot, which the door can only give
if every press reaches it (R-SPINE-006). Presses are queued in the order they were made and
sent one at a time; while any move is in flight the panel's status line speaks. The field
clears when an invitation landed and nothing else is queued behind it — never under an address
already typed for the next press. Controls stay enabled during a move and after any refusal —
a retry is never disarmed.

**Pending list** — `<section data-testid="members-pending-invitations" aria-labelledby>`,
holding one `DataTable` (table id `members-invitations`, named `invitations_pending_heading`)
while an offer stands. One row per standing offer, in the module's own order (newest first,
settled by the invitation id — never re-sorted, never localeCompare: the offer just made is
the one the reader is looking for), carrying `data-testid="invitations-row"` and
`data-invitation`, three columns:

- **Email address** (320, the frozen key column) — the invitee's address read back through the
  fold's one home (I-58; `invitations_invitee_unnamed` when the key carries none), 13 px
  `--weight-body-medium`, one line, ellipsis.
- **Role** (140) — the offered role through `EnumLabel`: a person reads "Member", and the
  store's own word travels in the primitive's technical channel (§6, and the reason I-55's
  "verbatim mono" is now a statement about the CHANNEL rather than about the glyphs).
- **Resend · Withdraw** (200) — two ghost Buttons in the row, `data-testid="invitations-resend"`
  and `data-testid="invitations-revoke"`, visible labels `invitations_resend` and
  `invitations_revoke`, `aria-label`s `invitations_resend_label` and `invitations_revoke_label`
  filled with the row's invitee. Every control on a row names the invitation it acts on, for
  the reason the roster's do: a list read aloud is N distinct controls, not N identical ones.
  Withdraw is NOT the danger style (I-202): an offer nobody has accepted can be made again, and
  one screen carries one danger treatment.
- **No pending offer** — `<p data-testid="invitations-none">` `invitations_none`,
  `var(--text-12)` `var(--ink-muted)`, standing where the table would be. Never silence
  (R-UI-020); it steps aside the moment a row stands.

**Answer slot** (I-57) — `<div data-testid="invitations-refusal">`, mounted only while a
refusal stands, after the pending list and full panel width: one RefusalState, entry
verbatim from the register with its `data-code`, surface as the entry hints. The reachable
codes are `WORKSPACE_PERMISSION_NOT_HELD` (a role that does not administer the workspace, or
an offer of a rank above the inviter's), `RATE_LIMITED` (the tenant-admin door's allowance)
and `INVITATION_NOT_CLAIMABLE` (a resend or a withdrawal of an offer that stopped standing).
A fourth is reachable only on a misconfigured deployment: `LINK_NOT_SENDABLE`, which is the
answer every mailing door in this tree already gives when the deployment has named no address
of its own — an invitation link with no origin in front of it is a path a mail client cannot
follow, so nothing is sent and nothing is written down (`canSendLinks`, R-SPINE-001). It is
named here because a code a person can reach is a code this Decision owes a ruling, not
because an operator should ever see it.
Evidence for all of them: `{ href: this route, label: members_evidence_roster }` — the roster
above names the owners, and the role form above is where an owner is made. They render
through the register lookup in this slot and do not join the exhibited matrix four (I-57's
precedent, and the reason `MEMBERS_STATES` and the matrix's members row do not move).

Last in the panel, a **status line** `<p role="status" aria-live="polite">` (no testid;
found by role): `var(--text-12)` `var(--ink-muted)`, margin 0, min-height `var(--text-13)`;
`invitations_status_pending` while any queued move is in flight, `invitations_status_done`
after a commit re-renders the list and no refusal stands, empty otherwise. The done line never
speaks over a refusal: the answer slot is the answer.

Route files under `members/invitations/`: `strings.ts` (§3), `actions.ts`
(`inviteMemberAction`, `resendInvitationAction`, `revokeInvitationAction` — thin:
authenticate, mint the actor, build the `TenancyRequest` with the stated origin, dispatch
`{ kind: "createInvitation" | "resendInvitation" | "revokeInvitation" }` through
`guardTenancyMutation` bound once with the shipped limiter and the shipped invitation
machinery, revalidate this route), `invitations-panel.tsx` (`InvitationsPanel`, client
component, props exactly the page's composed rows plus the three actions, jsdom-mountable)
and `invitations.css`.

## 2. States (R-UI-050), ruled cell by cell

Declared twice, by law: `states.ts` (route directory) exports `MEMBERS_STATES` — one row,
seven cells in the shell matrix's cell shape (the PARTICIPANTS_STATES shape); and
`src/ui/screen-states/matrix.tsx` gains the route key `"/t/[tenant]/settings/members"`,
spread over `workspaceCells` with the overrides below (I-62). The suite reflects over both
(B-19); existing rows do not move.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout the grid will
  take, gap `var(--space-2)` — one 24 × 240 px bone for the header, then six bones at the
  row height (28 × min(880 px, 100 %)), which is what a table of 28 px rows looks like before
  it arrives. Matrix: `bones(6)`.
- **Empty** — impossible, by law: seeing the roster needs membership (`membersOf` refuses a
  stranger rather than answering an empty list), so the list always holds at least the
  reader. Matrix: `reason(strings.state_empty_members_reader)`.
- **Error** — a render, read or action fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral. Matrix: `workspaceCells`.
- **Refusal** — the I-57 answer slot, in the refused row's own member cell, as §5 rule 8's
  partial row (I-200): the row stands with its ⚠ and the answer reads beneath it, and no row
  is ever hidden by a refusal. Reachable codes are exactly the register's four —
  `MEMBER_HAS_ACTS`, `WORKSPACE_WOULD_HAVE_NO_OWNER`, `SELF_REMOVAL_NOT_ALLOWED`,
  `WORKSPACE_PERMISSION_NOT_HELD` — each rendered with code (`data-code`), message, remedy
  and evidence; silence never happens. Matrix: the four stacked in that judging order, with
  §1's evidence pairs; `REFUSAL_ENTRIES` gains the four entries byte-identical to the
  register's own.
- **Partial** — the history reads answer only the projects the reader may read, and the
  roster's `(i)` says so on every render (I-59, I-203); every row the module answered renders
  whole and none is hidden. The row-level partial — a refused row shown with its ⚠ and its
  answer — is the refusal cell above, which is where §5 rule 8 puts it. Matrix: `reason(strings.state_partial_members_scope)`.
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
each member holds, and every role movement on its projects.** (the caption is what the
header's `(i)` holds, never a subtitle — §6) · `members_roster_heading` **Roster** ·
`members_roster_hint` **Every member, in the store's own order. Each role history lists
movements on the projects you may read.** · `members_role_label` **Role for {member}** ·
`members_role_submit` **Change role** · `members_role_submit_label` **Change role for
{member}** · `members_remove_submit` **Remove** · `members_remove_submit_label` **Remove
{member}** (the three `{member}` slots are data — the row's own label per I-58) ·
`members_col_member` **Member** · `members_col_role` **Role** · `members_col_projects`
**Projects** · `members_search_label` **Search the roster** · `members_search_none` **No
member of this workspace matches that.** · `members_history_label` **Role history** ·
`members_history_by` **by {actor} on {date}**
(both slots are data) · `members_history_none` **No role movements on this workspace's
projects yet.** · `members_member_unnamed` **Unnamed member** · `members_status_pending`
**Carrying the change out…** · `members_status_done` **Done. The roster shows the result.**
· `members_evidence_roster` **See the members list**.

Invitations panel table (`invitations/strings.ts`, export `invitationsStrings`, keys
`invitations_…`): `invitations_heading` **Invitations** · `invitations_hint` **Offers of
membership this workspace has made that nobody has accepted yet. An invitation is one live
link at a time: resending replaces the last one, and withdrawing ends it.** ·
`invitations_email_label` **Email address** (the field's name and the pending table's first
column, one home for the words) · `invitations_col_role` **Role** · `invitations_email_hint` **The address the
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

None beyond the inherited idioms: Button, nav row and link colour over `var(--motion-state)`
`var(--ease)`, the Select's listbox, the row menu and the `(i)` popover in the shipped
primitives' own motion, the reticle draw and the Skeleton pulse in their single homes. Rows,
refusals, history and the status line mount with no entrance — answers arrive instantly. Every
duration is a token zeroed at source under reduced motion; no bounce anywhere.

## 5. Tokens

Semantic aliases only (§4's rule 3 — no `--graphite-*`/`--beam-*` reference outside the token
source): `--ink` / `--ink-secondary` / `--ink-muted` / `--ink-disabled` / `--ink-code` ·
`--surface-hover` / `--surface-selected` · `--line` through `--hairline` · `--line-accent`
(the nav's current row) · `--state-danger(-surface)` (inside the shipped danger menu item) ·
the density and layout tokens the template is drawn at — `--row-h`, `--control-h`,
`--drawer-w-min`, `--gap-section`, `--cell-py` · `--space-1/2/4` · `--text-12/13/14/20` ·
`--font-mono` · `--weight-body-medium` / `--weight-heading` · `--radius-4` ·
`--motion-state` / `--ease`. Px literals, closed set: the header's 40, the search and the
address field's 240 measure, the row refusal's 420, and R-UI-030's 3 px selection bar. Any
other literal is a defect, and `tests/ui/craft/mechanical.test.ts` scores this file for it.

## 6. Themes

`members.css`, `invitations.css` and the template's `settings.css` contain no `[data-theme]`
selector; every light/dark difference arrives through token values (R-UI-001), and dark is the
default the screen is first seen in. Contrast holds on founder facts in both themes: the ink
aliases on the app surface ≥ 4.5:1, `--ink-link` on it ≥ 4.5:1, the current nav row's ink on
`--surface-selected` ≥ 4.5:1, the danger pair inside the shipped menu item and RefusalState per
their own Decisions. The one copper on this surface is the invite primary (I-56 keeps role moves
plain: they write no act row, so nothing else wears an act colour).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/settings` (the template's General area, which carries the nav row) and
`/t/{tenant}/settings/members` (tree key `/t/[tenant]/settings/members`). Test ids, exactly the
contract's — the same closed roster, on the elements §1 now rules: `settings-members-link` (the
nav's Members row, I-199) · `members-section` · `members-list` (the roster grid's own container) ·
`members-row` (`data-user`) · `members-row-role` · `members-role-history` ·
`members-history-entry` (`data-project`, `data-direction`, `data-role`) ·
`members-role-form` · `members-role-select` · `members-role-submit` ·
`members-remove-form` · `members-remove-submit` (the row's `⋯` trigger, I-202) ·
`members-refusal` (in the refused row's own member cell, I-200) — plus I-61's two slots:
`members-invite-form` · `members-pending-invitations`. No others are
added at this level; the ids INSIDE those two slots are the invitations panel's own closed
set, ruled in §1 above and listed there rather than here, so this roster stays exactly the
one the members page object holds. Server actions: `changeMemberRoleAction`,
`removeMemberAction`, and the panel's `inviteMemberAction`, `resendInvitationAction`,
`revokeInvitationAction`. Behavioural hooks without new ids:
`role="status"` on the status line, `aria-label` on the Select and on the `⋯` from the strings
table, `data-user` on the answer slot so a refusal is addressable by the member it answers,
`data-technical` on the role's stored word, `data-refused` on the refused row, `aria-current`
on the nav's current row, RefusalState's own ids and `data-code` inside `members-refusal`,
`cx-reticle` on every focusable, the `<h1>`/`<h2>` hierarchy, and the nav row's resolved href.

Page objects: `tests/members/support/members-page.ts` and `members-stage.ts`. Journey
checkpoints (axe serious/critical = 0 at each, never widened): **members-by-navigation** —
from the settings landing, activating the visible `settings-members-link` (never a typed
URL) lands on the roster with roles and histories rendered; browser back returns to the
landing (R-UI-031). **refusal-in-place** — an ADMIN opens an OWNER's row menu and takes its one danger item; the
registered `WORKSPACE_PERMISSION_NOT_HELD` message and remedy render inside `members-refusal`
in that row, under the member it answers, and the roster is unchanged. jsdom acceptance
mounts `MembersSection` with injected rows and actions and walks `MEMBERS_STATES`; the
live proof drives the shipped route doors against a provisioned scratch database, no
mocked module.
