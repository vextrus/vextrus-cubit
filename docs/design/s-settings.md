# Design Decision — S-Settings (tenant slice: members, invitations, roles)

`/t/{tenantSlug}/settings` becomes tenant administration (R-SPINE-003, J-002): the members
list with role management, the invite-by-email form, and the pending-invitations list with
resend and revoke. It renders inside the shell (`docs/design/shell.md`) and supersedes shell
§4's settings placeholder (the EmptyState-only area); the `tenant.settings.title` and
`tenant.settings.empty.teach`/`.action` keys are kept — inc-009's locked test reads copy
through them — with their values re-worded here. Token names are `docs/design/datum-tokens.md`;
component anatomy is `datum-primitives.md` / `datum-patterns.md`; no colour literal anywhere
(R-UI-001). Books, templates and every Project-side pane of S-Settings are later increments.

Interpretations recorded:

1. **OWNER and ADMIN administer; MEMBER meets permission-denied.** P-ADMIN plus the role names
   fix the administrators. A MEMBER opening the route gets the R-UI-050 permission-denied
   state (§6) naming the permission `settings.members.manage`; the seam refuses their writes
   with `NOT_TENANT_ADMIN`. Shell §6's `settings.read` was a placeholder roster for states
   "minted by no route"; this screen mints the real denial and names the permission it is
   actually about. A non-member still gets the 404 (s-auth Interpretation 4, Q-12).
2. **Acts run without a ConsequenceDialog** (s-auth Interpretation 2 precedent). Removing a
   member, changing a role, resending and revoking each act on the one row the reader is
   looking at — the row is the preview. L-ACT-02's preview/commit machinery is out of scope
   this increment; blast radius the reader cannot see is exactly what the server's
   `MEMBER_HAS_ACTS` refusal protects.
3. **The refusal block is settings-local, without an EvidenceLink.** `RefusalState` requires
   `evidenceHref`, and no surface at M0 can show the blocking acts (the act log explorer is
   out of scope) — a link to a screen that cannot show the evidence would be a decoy. The
   block (§5) keeps RefusalState's exact anatomy and tokens, reads message and remedy verbatim
   from the REFUSALS register (never paraphrased), and gains the link when an act surface
   ships. Precedent: s-auth Interpretation 3.
4. **Your own row offers no acts.** The signed-in reader's row shows their role as static text
   and no Remove button: leaving a workspace and demoting yourself are acts nobody shipped,
   and last-OWNER protection is explicitly out of scope — no code is invented for either.
5. **Revoke keeps history.** A revoked invitation leaves the pending list; the row is not
   deleted from storage. The screen lists only pending invitations.
6. **The invitation mail links to `/sign-up`.** Join-by-link is a later increment; today the
   invited person creates an account with the invited address. The mail says exactly that
   (§9), and the later increment changes the URL, not this screen.
7. **"Acts on open campaigns" at M0** means every act whose `campaign_ref` is set — no
   campaign close exists yet. A seam reading, recorded here because §7's remedy copy depends
   on it.

## 1. Layout and hierarchy

Inside `shell-main`'s centred 720 px column, padding `--space-6` (shell §1). Wrapper
`data-testid="tenant-settings"`. Stacked: the `h1` `tenant.settings.title` (`--text-20`,
`--weight-heading`, `--graphite-950` — the area's one h1), `--space-2`, the lead
`tenant.settings.lead` (`--text-13`, `--graphite-600`), `--space-6`, the members section,
`--space-8`, the invitations section. Each section is a `<section>` labelled by its `h2`
(`--text-16`, `--weight-heading`, `--graphite-950`), `--space-3` above its content. Lists
dominate; chrome recedes — no cards-within-cards, no icons, no illustration. Rows are 36 px
(comfortable, R-UI-005); controls inside rows are the 28 px compact metric (primitives §1).

## 2. Members (`members-section`)

h2 `tenant.members.title`. Below it, the list card (the s-auth §8 sessions idiom): background
`--graphite-0`, hairline border `--graphite-200`, `--radius-8`, rows divided by hairlines.
`listMembers` order — membership `createdAt` ascending — so the founder reads first and the
list never reshuffles.

Each row (`data-testid="member-row"`, `data-email="<email>"`, 36 px, padding
`0 var(--space-3)`): left, the member's email (`--text-13`, `--graphite-800`, single line,
ellipsis); the signed-in reader's row carries `data-current="true"` and, `--space-2` after the
email, a neutral Badge `tenant.members.you`. Right-aligned, gap `--space-2`:

- **`member-role`** — on every other member's row, a Datum Select (primitives §6), 120 px
  wide, accessible name `tenant.members.role` with the email in the slot. Trigger text and the
  three options (`tenant.role.owner/admin/member`) render the role code verbatim — `OWNER`,
  `ADMIN`, `MEMBER` — in `--font-mono` `--text-12` `--graphite-700`: identifiers from a closed
  set, the slug treatment. No placeholder ever shows (the trigger always holds the current
  role). On the reader's own row `member-role` is a plain `<span>` in the same style
  (Interpretation 4).
- **`member-remove`** — a secondary Button `tenant.members.remove`, accessible name
  `tenant.members.removeLabel` with the email in the slot. Absent on the reader's own row.

## 3. Role change and removal

- **Role change**: selecting a different role calls `setMemberRole` as a fetch. While in
  flight the trigger sets `aria-busy="true"`, keeps showing the previous role and ignores
  reopening; on success the row re-renders with the new role and a visually hidden
  `role="status"` region announces `tenant.members.roleChanged`. The change persists — a
  reload shows the new role. On refusal, §5; on a request that never completes, the error
  line (§6) and the previous role stands.
- **Removal**: `member-remove` enters the Button loading state and calls `removeMember`. On
  success the row is removed without animation (the list reflows, s-auth §8 precedent) and
  the status region announces `tenant.members.removed`. On `MEMBER_HAS_ACTS` the button
  restores, the row **stays listed**, and the refusal block renders directly below it (§5).

## 4. Invitations (`invitations-section`)

h2 `tenant.invitations.title`. Below it, the invite form, then the pending list.

**The form** — one row, gap `--space-2`, items aligned to their bottoms; below
`--breakpoint-sm` it stacks. Each field: a `<label>` (`--text-13`, `--weight-body-medium`,
`--graphite-700`) `--space-1` above its control (the s-auth §1 field idiom).

1. `invite-email` — label `tenant.invitations.email`; an Input, `type="email"`, flexing to
   fill the row.
2. `invite-role` — label `tenant.invitations.role`; a Select, 120 px, offering the three
   roles styled as §2; `MEMBER` preselected, so no placeholder ever renders.
3. `invite-submit` — a primary Button `tenant.invitations.submit`.

Submit with an invalid or empty email sets `aria-invalid` on the field and renders the error
line (§6) with `tenant.invitations.emailInvalid`; no request is made. A valid submit puts the
button in its loading state and calls `inviteMember`; on success the new pending row appears,
the email field clears (the role keeps its choice), and the status region announces
`tenant.invitations.sent` with the address in the slot. The closed taxonomy has no
duplicate-invite code, so the form accepts any valid address and the server answers as the
seam decides. The invitation mail is §9.

**The pending list** — `--space-4` below the form, the same list card as §2, only rows with
status pending, `createdAt` ascending (a new invitation lands last). Each row
(`data-testid="invitation-row"`, `data-email="<email>"`, 36 px): left, the invited email
(`--text-13`, `--graphite-800`), `--space-2`, the invited role code (`--font-mono`,
`--text-12`, `--graphite-600`). Right-aligned, gap `--space-4`: `tenant.invitations.invited`
with the creation time in the slot (device-local, `YYYY-MM-DD HH:mm`, `.numeric` `--text-12`
`--graphite-600` — the sessions idiom), then, gap `--space-2`: a secondary Button
`tenant.invitations.resend` (`data-testid="invitation-resend"`, accessible name
`tenant.invitations.resendLabel`) and a secondary Button `tenant.invitations.revoke`
(`data-testid="invitation-revoke"`, accessible name `tenant.invitations.revokeLabel`).

- **Resend** enters loading, calls `resendInvitation` (a further outbox mail, same
  invitation); success announces `tenant.invitations.resent`.
- **Revoke** enters loading, calls `revokeInvitation`; success removes the row from the
  pending list without animation and announces `tenant.invitations.revoked`
  (Interpretation 5).
- Either act refused `INVITATION_NOT_PENDING` — the row's status changed since the list was
  loaded — restores the button and renders §5's block below the row.

**Empty (the inc-009 lock).** With no pending invitations the list card is replaced by the
patterns EmptyState (`empty-state`): title `tenant.settings.empty.title`, teach
`tenant.settings.empty.teach`, action `tenant.settings.empty.action`
(`empty-state-action`) — the action moves focus to `invite-email`. The copy renders through
the locked keys, re-worded in §8; the form above stays live (it is the taught action).

## 5. The refusal block (`settings-refusal`, R-UI-020)

Never a toast. A `role="alert"` block rendered directly below the row whose act was refused,
inside the list card, full width, arriving with a `--motion-state-duration` fade: background
`--graphite-50`, hairline top divider, padding `--space-4`, stacked with `--space-2` gaps —
RefusalState's §8 anatomy (datum-patterns) minus the EvidenceLink (Interpretation 3):

1. `refusal-code` — the code verbatim, `--font-mono` `--text-12` `--graphite-600`.
2. `refusal-message` — `REFUSALS[code].message` verbatim, `--text-13` `--graphite-900`.
3. `refusal-remedy` — `REFUSALS[code].remedy` verbatim, `--text-13` `--graphite-600`.

At most one renders at a time — a newer refusal replaces it; any subsequent act in either
section, or navigation, clears it. If the refused row is no longer listed (the list changed
under the reader), the block renders above the affected section's list card instead. The
refused row itself is shown, never hidden: after `MEMBER_HAS_ACTS`, worker@ remains listed
with both controls live.

## 6. States roster (R-UI-050)

- **loading** — no route under `/t` streams (shell Interpretation 4 stands); the guard
  answers before any byte and the lists render server-side. In-flight acts use the
  primitives' busy states (§3, §4). Should a later increment stream this screen, its skeleton
  is ShellAreaState's area shape (shell §6).
- **empty** — §4's invitations EmptyState. The members list is structurally never empty:
  viewing requires a membership, so the reader's own row always renders.
- **error** — a render/data failure hits the shell's boundary
  (`src/app/t/[tenantSlug]/error.tsx` → ErrorState with report id and retry, shell §6). An
  act whose request never completes renders the error line: `role="alert"`,
  `data-testid="settings-error"`, `--text-13` `--danger`, copy
  `tenant.settings.actionFailed`, arriving with a `--motion-state-duration` fade — directly
  below the form row for a form failure, directly above the affected list card otherwise.
  At most one renders; the next act clears it.
- **refusal** — §5. Codes reaching this screen: `MEMBER_HAS_ACTS` (remove),
  `INVITATION_NOT_PENDING` (resend/revoke), and `NOT_TENANT_ADMIN` if a stale page acts
  after a role change stripped the reader's admin rights.
- **partial** — none minted: each list is one seam query and the seam refuses whole
  operations, not rows. PartialNotice's bar-above-rows anatomy (patterns §7) stands ready.
- **offline** — the shell's OfflineBanner mounts above the area content (shell §6); the
  lists stay readable; an act attempted offline fails into `settings-error` with
  `tenant.settings.actionFailed`.
- **permission-denied** — a MEMBER viewer: both sections are replaced by the patterns
  PermissionDenied (`permission-denied`); the h1 and lead stay. `permission` =
  `tenant.settings.permission` (`settings.members.manage`, rendered `--font-mono` per the
  pattern); `holder` = `tenant.settings.permissionHolder`. Copy is the patterns register
  (`patterns.permission.*`).

## 7. Refusal register entries (R-SPINE-062, verbatim)

Registered in a new module under `src/core/errors/`, folded into `REFUSALS` by the barrel.
On-screen text is these fields verbatim — the block never paraphrases:

| Code | Message | Remedy | Severity | Surface |
|---|---|---|---|---|
| `NOT_TENANT_ADMIN` | Managing members needs the OWNER or ADMIN role in this workspace. | Ask a workspace owner or admin to make the change, or to grant you the role. | block | page |
| `MEMBER_HAS_ACTS` | This member holds acts on open campaigns and cannot be removed. | Their acts keep them part of the workspace record. Removal becomes available once no act of theirs sits on an open campaign. | block | page |
| `INVITATION_NOT_PENDING` | This invitation is no longer pending. | Only a pending invitation can be resent or revoked. Reload the page to see where it stands. | block | page |

## 8. Copy, verbatim

Joins `TENANT_STRINGS` in `src/app/t/strings.ts` (frozen, typed as the table is). No string
literal in JSX except test ids and refusal codes. Keys marked ⊙ exist today and are
re-worded here; the key names are locked (inc-009).

| Key | Value |
|---|---|
| ⊙ `tenant.settings.title` | Settings |
| `tenant.settings.lead` | The people in this workspace and the invitations awaiting an answer. |
| ⊙ `tenant.settings.empty.title` | No pending invitations. |
| ⊙ `tenant.settings.empty.teach` | Invite someone by email. Their invitation waits here until it is accepted or revoked. |
| ⊙ `tenant.settings.empty.action` | Invite a member |
| `tenant.settings.actionFailed` | The request did not complete. Check your connection and try again. |
| `tenant.settings.permission` | settings.members.manage |
| `tenant.settings.permissionHolder` | a workspace owner or admin |
| `tenant.members.title` | Members |
| `tenant.members.you` | You |
| `tenant.members.role` | Role of {email} |
| `tenant.members.remove` | Remove |
| `tenant.members.removeLabel` | Remove {email} |
| `tenant.members.roleChanged` | Role updated. |
| `tenant.members.removed` | Member removed. |
| `tenant.role.owner` | OWNER |
| `tenant.role.admin` | ADMIN |
| `tenant.role.member` | MEMBER |
| `tenant.invitations.title` | Invitations |
| `tenant.invitations.email` | Email |
| `tenant.invitations.role` | Role |
| `tenant.invitations.submit` | Send invitation |
| `tenant.invitations.emailInvalid` | Enter a valid email address. |
| `tenant.invitations.invited` | Invited {time} |
| `tenant.invitations.resend` | Resend |
| `tenant.invitations.resendLabel` | Resend the invitation to {email} |
| `tenant.invitations.revoke` | Revoke |
| `tenant.invitations.revokeLabel` | Revoke the invitation to {email} |
| `tenant.invitations.sent` | Invitation sent to {email}. |
| `tenant.invitations.resent` | Invitation sent again. |
| `tenant.invitations.revoked` | Invitation revoked. |

Calm, concrete, sentence case, no exclamation marks, no build or internal vocabulary — the
outbox, seam and tables are never named on screen. `tenant.settings.empty.action` was "View
sessions"; sessions stay reachable from the tenant home's empty state and by URL, so no
teaching is lost.

## 9. The invitation mail

Sent by `inviteMember` and re-sent verbatim by `resendInvitation` through the existing mail
seam (`src/server/mail.ts`), landing in the outbox as auth mail does. Keys live beside the
tenant table (server-rendered copy, same voice):

| Key | Value |
|---|---|
| `tenant.mail.invite.subject` | You are invited to {tenant} on Cubit |
| `tenant.mail.invite.body` | {inviter} invited you to join {tenant} as {role}. Create an account with this email address to accept: {url} |

`{inviter}` is the inviting account's email, `{role}` the invited role code, `{url}` the
absolute sign-up URL (Interpretation 6).

## 10. Motion (R-UI-004)

| Where | Duration | Easing |
|---|---|---|
| `settings-refusal` and `settings-error` arrival (fade) | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Row hover fills, control states | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Select content, Button busy bar | per primitives §15 | — |

Row removal (member removed, invitation revoked) is instant — the list reflows, s-auth
precedent. Nothing slides, nothing bounces. Reduced motion: token durations zero via
tokens.css; nothing here loops.

## 11. Tokens

Only names already on the sheet: surfaces `--graphite-0/50`, hover `--graphite-100`,
hairlines `--graphite-200`, text `--graphite-600/700/800/900/950`, `--danger` (error line),
type `--text-12/13/16/20` with weights, `--font-mono` + `.numeric` (role codes, times),
spacing `--space-1/2/3/4/6/8`, `--radius-8`, row height 36 px (`--row-comfortable`),
`--breakpoint-sm`, the §10 motion tokens, focus via `datum-focus-ring`. The 120 px select
width is a layout dimension, not a token role.

## 12. Both themes

Every rule reads role-stable tokens; no forked CSS in `src/app/t/[tenantSlug]/settings/**`.
The list cards sit on `--graphite-0` with hairline edges in both themes exactly as the
sessions list does; the refusal block's `--graphite-50` inset, the mono identifiers at
`--graphite-600`+ (the placeholder-contrast amendment's floor) and `--danger` all carry their
own dark values with contrast held by the token sheet.

## 13. Test hooks (C-05)

Route: `/t/{tenantSlug}/settings`. Test ids: `tenant-settings` (§1); `members-section`,
`member-row` (with `data-email`, and `data-current="true"` on the reader's row),
`member-role`, `member-remove` (§2); `invitations-section`, `invite-email`, `invite-role`,
`invite-submit`, `invitation-row` (with `data-email`), `invitation-resend`,
`invitation-revoke` (§4); `settings-refusal` with `refusal-code`, `refusal-message`,
`refusal-remedy` inside (§5); `settings-error` (§6, the one id this document introduces
beyond the increment contract); the patterns ids `empty-state`, `empty-state-action`,
`permission-denied` (§4, §6). Journey: `tests/e2e/j-002-tenant-admin.spec.ts` (`J-002`),
page object `tests/e2e/pages/settings.ts`. Server-rendered claims (lists, empty state,
permission-denied) are readable from served HTML with a session cookie. Axe scans run with
every Select closed and after `getAnimations()` settles.
