# Design Decision — S-AcceptInvitation (spending a mailed invitation)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │  24 px ← the datum
│                     ┌────────────────────────────────┐                     │
│                     │ Join a workspace               │   360 wide          │
│                     │ ────────────────────────────── │   --surface-panel   │
│                     │ Workspace                      │   hairline, r8      │
│                     │ Ashuganj Works                 │   the name, verbatim│
│                     │ Role you would hold            │                     │
│                     │ Member                         │   EnumLabel         │
│                     │ ────────────────────────────── │                     │
│                     │ ┌────────────────────────────┐ │                     │
│                     │ │ ●  Accept the invitation   │ │   one act button    │
│                     │ └────────────────────────────┘ │                     │
│                     │ ‹answer slot: RefusalState›    │                     │
│                     └────────────────────────────────┘                     │
│              /accept-invitation  ●  Joining the workspace…                 │  12 px readout
└────────────────────────────────────────────────────────────────────────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| mark | **absent.** R-UI-070 gives the full spark to sign-in and to certificates, and s-auth I-10 reads that as the unauthenticated surface; this screen is behind the `(app)` session door, like `/sessions`, which carries no mark either | — | — | — | — |
| card (primary) | what is being joined, at what role, and the one act that takes it | 360 × auto, top edge at 24 px from the top of `main` — there is no 88 px mark lead to hold, so the card stands at the datum itself | the no-token leg: the heading, one sentence, one link home | `RefusalState` inside the card, alone where the page judged the token first (I-65), under the offer where the accept refused | `loading.tsx`: three bones inside the same card |
| foot | the readout: where you are, what the last attempt came to, and what that is in words while it is happening | one line, 12 px, centred, 16 px under the card; the address in mono, the sentence in the interface face | route cell, idle dot, no sentence | the dot at `--state-danger`, echoing the refusal in the card | the dot at `--accent` and `accept_status_pending` in the `role="status"` cell |

Built on Design Direction 00 §3.7's Auth template, with the two adjustments the S-Auth Decision
records for the same reasons (the readout is 12 px because R-UI-003's scale has no 10; its first
cell is the route because no build reference is stamped). §3.7's "**Join _Foundry_** as the title"
is **not** built: it needs a string with a `{workspace}` slot, `src/ui/strings` is another node's
file this increment may not add a key to, and weaving a workspace's name into a sentence is what
I-55 forbids anyway. The heading stays `accept_heading` and the workspace's name is the first fact
inside the card, verbatim as data. **Owed by the increment that may touch the string registry:** a
heading key of this route's own carrying the words "Join {workspace}", which this heading then takes
(it is not ruled in §3 below, because a Decision fixes copy that exists).

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
- **I-68 — the screen wears no shell, and therefore owes its own landmark and heading.** The
  shell is the frame of a WORKSPACE (`/t/{tenant}/…`): its rail switches between workspaces,
  its breadcrumb names a place inside one, and both are read from the tenant in the address.
  This route has no tenant in its address and, for the person it is written for, no
  membership to name yet — the whole point of the screen is that they do not hold the
  workspace it is about. Wrapping it in the shell would mean picking some other workspace of
  theirs to frame the decision with, or none at all. So it stands on its own, exactly as
  `ShellDenied` does: it carries the page's single `<main>` itself, its own measure and
  padding, and an `<h1>` in every state — including the state where a refusal is the only
  thing on the page, because an alert with no page identity above it is what a screen reader
  would otherwise land on straight out of the email.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: authenticates, reads the
token off the query, asks `offeredInvitation` through the tenancy barrel, renders the form —
or the registered refusal, or the empty state), `actions.ts` (`acceptInvitationAction` —
thin: authenticate, build the `TenancyRequest` with the stated origin, dispatch
`{ kind: "acceptInvitation" }` through `guardTenancyMutation` bound once with the shipped
limiter and the shipped invitation machinery), `accept-invitation-form.tsx`
(`AcceptInvitationForm`, `AcceptInvitationRefusal`, `AcceptInvitationUnclaimable` and
`AcceptInvitationNoToken` — client
components, props exactly the page's composed offer plus the action, jsdom-mountable, the
`MembersSection` precedent), `loading.tsx`, `states.ts` (§2), `strings.ts` (§3) and
`accept-invitation.css`.

The screen is its own frame (I-68), rebuilt on the Auth template (Design Direction 00 §3.7 — §3
outranks this Decision's geometry, and this section is the amendment it asks for). One page ground
`<main class="cx-accept">`: `display: flex`, `flex-direction: column`, `align-items: center`,
`min-height: 100vh`, `padding: var(--space-6) var(--space-4)`, on `var(--surface-app)`. Inside it
one column `.cx-accept-column` at `min(360px, calc(100vw - var(--space-8)))` — §3.7's measure, and
narrower than the 560 this screen used before, because what stands in it is one decision. There is
no rail and no breadcrumb: the route sits outside `/t/{tenant}` and names no workspace to put in
either — it is the idiom `cx-shell-denied` already keeps for the other signed-in screen that stands
without a frame. Every state of this screen is laid in that column and carries that one `<main>`:
the form, the refusal standing alone, the empty state and the loading bones. Nothing on this route
paints outside a landmark, and every state opens with the `<h1>`.

**The card** `.cx-accept-card` is the screen's one object, and every state stands in it:
`var(--surface-panel)`, `var(--hairline)`, `var(--radius-8)`, `padding: var(--space-5)`, a column at
`gap: var(--space-4)`, rendered as `<section aria-labelledby="accept-invitation-title">` so the card
is a region named by the page's own heading. It opens with `<h1 class="cx-accept-heading">`
`accept_heading` — `var(--text-20)` `var(--weight-heading)` `var(--ink)`, margin 0.

The two-sentence caption under the heading is **deleted**, not moved: §6 of the Direction allows one
line of helper copy on a screen and this screen's one line belongs to the state that needs teaching
(the no-token leg). What the caption explained — that accepting adds a workspace rather than
replacing one — is what the offer itself shows, and the key `accept_caption` is retired from the
route table with it.

**The offer** — `<form data-testid="accept-invitation-form">`, column flex, gap `var(--space-4)`.
Inside it a `<dl class="cx-accept-facts">` (column flex, gap `var(--space-1)`, margin 0,
padding-block `var(--space-3)`, hairline above and below) with two pairs:

- `<dt>` `accept_workspace_label`, `var(--text-12)` `var(--ink-muted)`; then
  `<dd data-testid="accept-invitation-workspace">` — the workspace's own name, verbatim as
  data and never woven into a sentence (I-55), `var(--text-16)`
  `var(--weight-body-medium)` `var(--ink)`, margin 0.
- `<dt>` `accept_role_label`; then `<dd>` holding an **`EnumLabel`** for the offered role: the
  screen says **Member**, never `MEMBER` (§3.7, §6), and the primitive keeps the raw value in the
  DOM inside its own `[data-technical]` span, so an engineer and a suite still find it. This
  replaces the mono `MEMBER` the screen used to print: a SCREAMING enum as body text is §7 C6's
  identifier exposure, and an English word in the mono face is C11's own defect.

Then the one act: a core Button `data-testid="accept-invitation-submit"`, `variant="act"`, full
width, visible label `accept_submit`. It is `act` rather than `primary` because accepting mints a
membership — a consequence — and the 7 px copper dot is what this product says that with (§1,
R-UI-040); it is the only copper on the screen, and the screen carries exactly one of it. While the
accept is in flight the Button takes core's loading state and the readout speaks; it stays enabled
after a refusal — a retry is never disarmed.

**Answer slot** — `<div data-testid="accept-invitation-refusal">`, one RefusalState, entry
verbatim from the register with its `data-code`, surface as the entry hints (inline).
Evidence: `{ href: "/", label: accept_evidence_workspaces }` — whatever became of this offer,
the workspaces the person already holds are where they can still go. It stands in two
places, rendered by the same component in both (`accept-invitation-form.tsx`): alone, where
the page judged the token before drawing anything (I-65), and beneath the form, where the
offer stopped standing between the render and the press. Standing alone it is laid in the
same card under the same `<h1>` (`AcceptInvitationUnclaimable`, I-68), so the answer keeps the
screen's measure instead of running edge to edge and the page still says what page it is.

**No token** — an address with no link behind it is the empty state, not a refusal: nobody
presented anything to be refused. The card renders `accept_no_token_heading` as its `<h1>`,
`accept_no_token_body` as the one line of helper copy this screen is allowed, and one link home.
The `EmptyState` primitive is deliberately not used here: I-68 makes the page's `<h1>` the empty
state's own title, and EmptyState's `<h2>` heading would say those words a second time.

**The foot readout** `.cx-accept-foot` — one line under the card, `margin-block-start:
var(--space-4)`, centred, `min-height: var(--space-5)` so nothing jumps when the sentence arrives:
the address `/accept-invitation` in `var(--font-mono)` `var(--text-12)` with tabular figures, the
status dot, and the status sentence in the interface face at `var(--text-12)` `var(--ink-muted)`.
The sentence is the old status line, kept with its `role="status" aria-live="polite"` and its copy —
`accept_status_pending` while the accept is in flight, `accept_status_done` once the membership is
held, empty otherwise, and never while a refusal stands. It is the interface face and not mono
because English words in the mono face read as a leaked debug style (R-UI-004). The dot takes
`--ink-disabled` idle, `--accent` in flight, `--state-success` settled, `--state-danger` refused;
it is `aria-hidden`, because it repeats what the sentence and the card already say — no meaning
rides on that colour alone (R-UI-060).

## 2. States (R-UI-050), ruled cell by cell

Declared twice, by law: `states.ts` (route directory) exports `ACCEPT_INVITATION_STATES` —
one row, seven cells in the shell matrix's cell shape (the `MEMBERS_STATES` shape); and
`src/ui/screen-states/matrix.tsx` gains the route key `"/accept-invitation"`. The suite
reflects over both (B-19); existing rows do not move.

- **Loading** — `loading.tsx`: core Skeletons keeping the layout, inside the same card the offer
  will fill, in the screen's own column and its own `<main>` (there is no frame above to stay
  intact — I-68), wrapped in `cx-accept-skeletons` with gap `var(--space-3)`, which is this route's
  own rule because this route loads its own stylesheet and no other — 24 × 180 px (heading),
  48 × 100 % (the offer), 32 × 100 % (the control): three bones, because the caption they stood for
  is gone (§1). Matrix: `bones(4)` — the matrix cell is the shell's shape and is not this route's
  to move.
- **Empty** — rendered: the address with no token behind it, which teaches what is missing
  rather than showing a form with nothing in it (R-UI-020). Matrix: the `EmptyTeaching`
  shell with `state_empty_accept_heading` / `state_empty_accept_body` — the mirror of this
  route's own `accept_no_token_heading` / `accept_no_token_body`, word for word, because
  `src/ui` may never import a route table (ARCH-01) and `tests/screen-states/copy-fidelity`
  pins the two spellings equal.
- **Error** — a render, read or action fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral. Matrix: `fault(strings.error_body)`.
- **Refusal** — the answer slot above, rendered with `data-code`, message, remedy and
  evidence; silence never happens. The code this screen is ABOUT is
  `INVITATION_NOT_CLAIMABLE`, and it is the one the matrix exhibits:
  `refusal(REFUSAL_ENTRIES.INVITATION_NOT_CLAIMABLE, WORKSPACE_EVIDENCE)`. One further
  registered code reaches this slot from the guarded entry the accept goes through, and is
  ruled here rather than left unsaid — the I-57 precedent, where a door's own answer renders
  through a screen's slot without joining the exhibited matrix cell:
  - `RATE_LIMITED` — the accept spends the `tenancyAdmin` door's allowance like every other
    tenancy mutation (R-SPINE-006: "tenant-admin actions carry rate limits", and a mailed
    token is a credential a burst may not be allowed to grind against). A burst of presses
    answers the register's own words in this slot, with its `data-code`, and the control
    stays armed for the retry the remedy names.
  It is neither silence nor invented copy: it is a registered entry rendered by the same one
  renderer, which is what R-UI-020 asks of the slot.
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
`accept_heading` **Join a workspace** · `accept_workspace_label`
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

The semantic aliases only (§4.1 — after U1 a screen consumes no primitive ramp position):
`--surface-app/--surface-panel` · `--ink/--ink-muted/--ink-disabled/--ink-link` · `--accent` ·
`--state-success/--state-danger` · `--hairline` · `--radius-8` · `--space-1/2/3/4/5/6/8` ·
`--text-12/13/16/20` · `--font-mono` · `--weight-body-medium/--weight-heading` ·
`--motion-state/--ease` (the link's colour and the dot's). Px literals, closed set (core I-1's
class): the 360 px column measure, and the skeleton bones 24/48/32 × 180. Any other literal is a
defect. The column's gutter is not a literal at all —
`calc(100vw - var(--space-8))` is the viewport minus a spacing token, the same expression
`cx-shell-denied` uses.

## 6. Themes

`accept-invitation.css` contains no `[data-theme]` selector; every light/dark difference
arrives through token values (R-UI-001). Contrast holds on founder facts in both themes:
the ink roles on `--surface-panel` ≥ 4.5:1, `--ink-link` on it ≥ 4.5:1, and the refusal
card's pair inside RefusalState per its own Decision. No basis colour appears anywhere on this
surface. Copper appears exactly once, and only since the §3.7 rebuild: the act button's 7 px dot,
which is what this product says "this commits" with — the earlier ruling that no copper appeared
here is amended, not broken, because the control it governs changed from `primary` to `act`.

## 7. Test hooks (closed contract, C-05)

Route: `/accept-invitation` (new; tree key `/accept-invitation`). Test ids, exactly the
contract's, on the elements ruled in §1: `accept-invitation-form` ·
`accept-invitation-workspace` · `accept-invitation-submit` · `accept-invitation-refusal`. No
others are added. Server action: `acceptInvitationAction`. The §3.7 rebuild adds **no id**: the card, the readout and its status cell are found by
structure, role or attribute. Behavioural hooks without new
ids: `role="status"` on the readout's sentence cell, RefusalState's own ids and `data-code` inside
`accept-invitation-refusal`, `cx-reticle` on the Button and the link, the `<h1>`/`<dl>`
hierarchy, `aria-labelledby` from the card region to the `<h1>`, `data-value` on the role's
EnumLabel (the raw `MEMBER` a suite matches on), `data-status` on the readout's dot, `act-dot`
inside the act button, and the address the accept navigates to.

Journey checkpoints (axe serious/critical = 0 at each, never widened): **j-001-auth/accept**
— the invitee, signed in, standing on the mailed link with the inviting workspace named in
`accept-invitation-workspace` and the accept control armed; **j-001-auth/switched** — the
same session inside `/t/{invitingTenant}` after the switch, the rail's switcher listing both
memberships. The live proof drives the shipped route doors in a browser against a provisioned
scratch database, no mocked module.
