# Design Decision — S-AcceptInvitation (spending a mailed invitation)

The screen a mailed invitation lands on: what workspace somebody is being asked to join, at
what role, and the single control that takes it (R-SPINE-003's ACCEPT flow, R-SPINE-002's
"one user, many tenants").

Route: `/accept-invitation` (tree key `/accept-invitation`, under the `(app)` group). It is
a signed-in screen, not a door: the account that spends an invitation must already exist,
because what an acceptance grants is a MEMBERSHIP and a membership belongs to an account. No
`(auth)` route is touched by it.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-63 — the screen is behind the `(app)` session door, not an anonymous one.** An
  invitation is claimed by the account whose address it was addressed to, so a request
  carrying no live session has nothing to be judged against. `src/app/(app)/layout.tsx`
  redirects it to `/sign-in`, which is the remedy an absent session needs; a permission
  answer would be untrue of it (ARCH-03). The token survives the round trip in the address
  bar, so the same link opens the screen again once they are signed in.
- **I-64 — the screen reads the offer through the same judgement the accept makes.**
  `offeredInvitation` and `acceptInvitation` share one law (`judgeInvitationClaim`), so the
  screen never shows an offer that pressing the control would then refuse, and the accept
  re-judges rather than trusting what was rendered — an offer withdrawn in between refuses.
- **I-65 — an unclaimable token leaves nothing to submit.** Where the token names no offer
  this account may claim, the screen renders the registered refusal ALONE: no form, no
  disabled control, no greyed-out button standing where the accept would be. R-SPINE-006
  forbids hiding a control a person may use; a control nobody may use is not hidden by being
  absent, it simply does not exist for this request, and the refusal says why with a remedy.
- **I-66 — the four ways a token fails are one answer.** Unknown, already accepted,
  withdrawn, and addressed to another key all answer `INVITATION_NOT_CLAIMABLE`. An answer
  that told them apart would tell whoever holds a token which of them it is, and a stranger
  probing addresses would learn whether an address had ever been invited.
- **I-67 — accepting lands the person inside the workspace they just joined.** The
  membership is the answer, and the place that answer is true is the workspace itself, so the
  screen navigates to `/t/{tenantId}` in the same session — no re-authentication, and the
  rail's switcher now offers both workspaces (R-SPINE-002: the active tenant is explicit in
  the URL and in the session, and updates on switch).

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: authenticates, reads the
token off the query, asks `offeredInvitation` through the tenancy barrel, renders the form —
or the registered refusal, or the empty state), `actions.ts` (`acceptInvitationAction` —
thin: authenticate, build the `TenancyRequest` with the stated origin, dispatch
`{ kind: "acceptInvitation" }` through `guardTenancyMutation` bound once with the shipped
limiter and the shipped invitation machinery), `accept-invitation-form.tsx`
(`AcceptInvitationForm`, `AcceptInvitationRefusal` and `AcceptInvitationNoToken` — client
components, props exactly the page's composed offer plus the action, jsdom-mountable, the
`MembersSection` precedent), `loading.tsx`, `states.ts` (§2), `strings.ts` (§3) and
`accept-invitation.css`.

The screen renders in `shell-main`, one column `cx-accept`: max-width 560 px (a screen with
one decision on it is narrower than a settings screen), column flex, gap `var(--space-6)`.
Rail and breadcrumb are the shell's.

**Header block** (gap `var(--space-2)`): `<h1 class="cx-accept-heading">` `accept_heading` —
`var(--text-20)` `var(--weight-heading)` `var(--graphite-900)`, margin 0 — over
`accept_caption` in `var(--text-13)` `var(--graphite-600)`.

**The offer** — `<form data-testid="accept-invitation-form">`, column flex, align-items
flex-start, gap `var(--space-3)`. Inside it a `<dl class="cx-accept-facts">` (column flex,
gap `var(--space-1)`, margin 0, padding-block `var(--space-3)`, hairline above and below,
full width) with two pairs:

- `<dt>` `accept_workspace_label`, `var(--text-12)` `var(--graphite-600)`; then
  `<dd data-testid="accept-invitation-workspace">` — the workspace's own name, verbatim as
  data and never woven into a sentence (I-55), `var(--text-16)`
  `var(--weight-body-medium)` `var(--graphite-900)`, margin 0.
- `<dt>` `accept_role_label`; then `<dd class="cx-accept-role">` — the offered role verbatim
  per I-55, `var(--font-mono)` `var(--text-13)` `var(--graphite-700)`.

Then a core primary Button `data-testid="accept-invitation-submit"`, visible label
`accept_submit`. While the accept is in flight the Button takes core's loading state and the
status line speaks; it stays enabled after a refusal — a retry is never disarmed.

**Answer slot** — `<div data-testid="accept-invitation-refusal">`, one RefusalState, entry
verbatim from the register with its `data-code`, surface as the entry hints (inline).
Evidence: `{ href: "/", label: accept_evidence_workspaces }` — whatever became of this offer,
the workspaces the person already holds are where they can still go. It stands in two
places, rendered by the same component in both (`accept-invitation-form.tsx`): alone, where
the page judged the token before drawing anything (I-65), and beneath the form, where the
offer stopped standing between the render and the press.

**No token** — an address with no link behind it is the empty state, not a refusal: nobody
presented anything to be refused. The screen renders the header with
`accept_no_token_heading` and `accept_no_token_body` and one link home, and no form.

Last, a **status line** `<p role="status" aria-live="polite">` (no testid; found by role):
`var(--text-12)` `var(--graphite-600)`, margin 0, min-height `var(--text-13)`;
`accept_status_pending` while the accept is in flight, `accept_status_done` once the
membership is held, empty otherwise. It never speaks while a refusal stands.

## 2. States (R-UI-050), ruled cell by cell

Declared twice, by law: `states.ts` (route directory) exports `ACCEPT_INVITATION_STATES` —
one row, seven cells in the shell matrix's cell shape (the `MEMBERS_STATES` shape); and
`src/ui/screen-states/matrix.tsx` gains the route key `"/accept-invitation"`. The suite
reflects over both (B-19); existing rows do not move.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout, gap
  `var(--space-3)` — 24 × 240 px (heading), 16 × 360 px (caption),
  48 × min(480 px, 100 %) (the offer), 32 × 200 px (the control). Matrix: `bones(4)`.
- **Empty** — rendered: the address with no token behind it, which teaches what is missing
  rather than showing a form with nothing in it (R-UI-020). Matrix: the `EmptyTeaching`
  shell with `state_empty_accept_heading` / `state_empty_accept_body` — the mirror of this
  route's own `accept_no_token_heading` / `accept_no_token_body`, word for word, because
  `src/ui` may never import a route table (ARCH-01) and `tests/screen-states/copy-fidelity`
  pins the two spellings equal.
- **Error** — a render, read or action fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral. Matrix: `fault(strings.error_body)`.
- **Refusal** — the answer slot above; the one reachable code is
  `INVITATION_NOT_CLAIMABLE`, rendered with `data-code`, message, remedy and evidence;
  silence never happens. Matrix: `refusal(REFUSAL_ENTRIES.INVITATION_NOT_CLAIMABLE,
  WORKSPACE_EVIDENCE)`.
- **Partial** — one offer is read and it renders whole; there is no second read to answer
  half of. Matrix: `reason(strings.state_partial_one_answer)`.
- **Offline** — a fault of reachability (shell I-20): server-rendered screen, failed
  navigation or action surfaces the error path; no invented banner. Matrix:
  `delegatedToFault(strings.state_offline_unreachable, strings.auth_fault_unreachable_body)`.
- **Permission-denied** — delegated to the `(app)` group's own layout (I-63): a request
  carrying no live session is redirected to `/sign-in` before this route mounts. Holding a
  claimable token is not a permission this screen withholds — a token it cannot claim is the
  registered refusal above. Matrix: `reasonedRefusal(strings.state_refusal_ended_session,
  REFUSAL_ENTRIES.SIGNED_OUT, SIGN_IN_EVIDENCE)`.

## 3. Copy, verbatim

Route table (`strings.ts`, export `acceptInvitationStrings`, keys `accept_…`):
`accept_heading` **Join a workspace** · `accept_caption` **Somebody has invited the address
you are signed in with to work in their workspace. Accepting adds it to the workspaces you
can switch between; the one you already have is untouched.** · `accept_workspace_label`
**Workspace** · `accept_role_label` **Role you would hold** · `accept_submit` **Accept the
invitation** · `accept_no_token_heading` **This page needs an invitation link** ·
`accept_no_token_body` **Open the link from the invitation email itself — it carries the
token that says which workspace you were asked to join.** · `accept_status_pending`
**Joining the workspace…** · `accept_status_done` **Done. You now hold a membership of that
workspace.** · `accept_evidence_workspaces` **See the workspaces you hold**.

Registry copy, appended once to `src/core/errors.ts` by this increment and rendered verbatim
(never re-worded here or anywhere):

| code | severity | surface | message | remedy |
| --- | --- | --- | --- | --- |
| INVITATION_NOT_CLAIMABLE | error | inline | This invitation cannot be accepted — it was never issued, has already been accepted, or was withdrawn. | Ask an owner of that workspace to send a fresh invitation to the address you are signed in with. |

Mirror (the s-settings discipline): `src/ui/strings/screen-states.ts` gains
`state_empty_accept_heading` and `state_empty_accept_body`, byte-identical to
`accept_no_token_heading` and `accept_no_token_body`, pinned equal by
`tests/screen-states/copy-fidelity.test.ts`. Voice throughout: calm, concrete, no
exclamation marks; workspace names and role words are data, never woven into sentences
(I-55).

## 4. Motion (R-UI-004)

None beyond the inherited idioms: Button and link colour over `var(--motion-state)`
`var(--ease)`, the reticle draw and the Skeleton pulse in their single homes. The offer, the
refusal and the status line mount with no entrance — answers arrive instantly. Every
duration is a token zeroed at source under reduced motion; no bounce anywhere.

## 5. Tokens

`--graphite-600/700/900` · `--beam-500/600` (the link home; the refusal card's own tokens are
RefusalState's) · `--hairline` · `--space-1/2/3/6` · `--text-12/13/16/20` · `--font-mono` ·
`--weight-body-medium/--weight-heading` · `--motion-state/--ease`. Px literals, closed set
(core I-1's class): the 560 px column measure, and the skeleton bones 24/16/48/32 ×
240/360/480/200. Any other literal is a defect.

## 6. Themes

`accept-invitation.css` contains no `[data-theme]` selector; every light/dark difference
arrives through token values (R-UI-001). Contrast holds on founder facts in both themes:
graphite-600/700/900 on graphite-0 ≥ 4.5:1, beam-600 on graphite-0 ≥ 4.5:1, and the refusal
card's pair inside RefusalState per its own Decision. No basis colour and no copper appears
anywhere on this surface.

## 7. Test hooks (closed contract, C-05)

Route: `/accept-invitation` (new; tree key `/accept-invitation`). Test ids, exactly the
contract's, on the elements ruled in §1: `accept-invitation-form` ·
`accept-invitation-workspace` · `accept-invitation-submit` · `accept-invitation-refusal`. No
others are added. Server action: `acceptInvitationAction`. Behavioural hooks without new
ids: `role="status"` on the status line, RefusalState's own ids and `data-code` inside
`accept-invitation-refusal`, `cx-reticle` on the Button and the link, the `<h1>`/`<dl>`
hierarchy, and the address the accept navigates to.

Journey checkpoints (axe serious/critical = 0 at each, never widened): **j-001-auth/accept**
— the invitee, signed in, standing on the mailed link with the inviting workspace named in
`accept-invitation-workspace` and the accept control armed; **j-001-auth/switched** — the
same session inside `/t/{invitingTenant}` after the switch, the rail's switcher listing both
memberships. The live proof drives the shipped route doors in a browser against a provisioned
scratch database, no mocked module.
