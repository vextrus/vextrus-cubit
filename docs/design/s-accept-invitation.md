# Design Decision — S-AcceptInvitation (the mailed invitation door)

Route: `/accept-invitation` (new), under `src/app/(app)/accept-invitation/**` — behind the
`(app)` session door (`(app)/layout.tsx`: no live session → `redirect("/sign-in")`), outside
`/t/[tenant]`, so no workspace frame mounts. Increment inc-010b-invitations-accept. Law:
R-SPINE-002/003/006, R-UI-001/003/004/012/020/031/050/060, B-17, B-19, B-20, Q-07, Q-11,
Q-17. Every convention of the earlier Decisions binds: `cx-` classes, tokens-only colour and
motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in authored CSS.
Interpretations I-1–I-62 remain in force ("workspace" is the user-facing word for tenant,
s-auth I-11; workspace roles render verbatim mono, s-settings I-55; a guarded tenancy
mutation is not an act, I-56; nothing paints a nameless workspace — the label passes through
`workspaceLabel`, shell I-23). Chrome comes only from shipped primitives — core Button and
Skeleton, the one RefusalState, the s-auth notice idiom — plus the `cx-accept-*` classes this
file rules. Copy lives in the route table
`src/app/(app)/accept-invitation/strings.ts`, export `acceptInvitationStrings`, keys
`accept_…`; JSX carries no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-63 — a mailed door wears the auth frame, signed in, unmarked, unlisted.** The screen
  exists to spend a mailed credential, the `/verify` class: its visible navigation *is* the
  link in the invitation mail, so no rail or settings entry is owed (R-UI-031, the reading
  `/verify` shipped under), and being outside `/t/…` it gets no shell. It renders the s-auth
  centred column — the page is the card — with no brand mark: the full spark belongs to the
  unauthenticated surface (s-auth I-10) and the quiet mark to the rail (R-UI-070); a
  signed-in frameless page carries neither, the `/sessions` precedent.
- **I-64 — the workspace is named before it is joined, by the module's own judge.** AC-3 puts
  the inviting workspace's name on the form, so the page performs a token-preview read. That
  read lives inside `src/modules/spine/tenancy` and is reached only through its barrel (AC-1:
  nothing outside the module touches the invitation store); the barrel's stated export list
  is a floor, not a ceiling. The preview judges claimability with the same judge
  `acceptInvitation` applies — one invariant, one home (B-17) — so the form never arms for a
  token the accept would refuse, except by a race the submit then answers.
- **I-65 — an unclaimable answer replaces the form; a rate-limit answer keeps it armed.**
  `INVITATION_NOT_CLAIMABLE` is terminal: no retry of the same token can succeed, so the
  refusal renders **in place of** the form (the s-auth sent-notice logic — nothing is left to
  submit, and an armed button over a dead token invites a pointless resubmission). This is
  not disarming: no disabled chrome exists, the control is gone and the remedy stands where
  it was. `RATE_LIMITED` — reachable because `acceptInvitation` runs under
  `guardTenancyMutation` (R-SPINE-006) — is recoverable in stride: the form re-renders armed
  with the refusal in the answer slot, the retry never disarmed.
- **I-66 — accepting is not an act.** Joining writes no act row and voids nothing
  irreversible (a membership is removable); per I-56's class no ConsequenceDialog opens and
  nothing wears copper. The submit is a core primary (beam) Button.
- **I-67 — success is a notice and a link, never a redirect.** The done state replaces the
  form with the status notice and offers **Open {workspace}** as a link (shell I-19's taste);
  the live tenant-switch proof stays the journey's, driven through `shell-tenant-switcher`.
  The screen never claims a bare `/` now lands in the joined workspace —
  `workspaceFor` resolves the *earliest* membership, so the joined one is entered by its URL
  or the switcher (R-SPINE-002: the active tenant is explicit in URL and session).
- **I-68 — the ui-side registries grow by shared-registry appends riding the matrix grant.**
  Declaring the row in `src/ui/screen-states/matrix.tsx` (AC-3, B-19) requires
  `refusal-entries.ts` to gain `INVITATION_NOT_CLAIMABLE` byte-identical to the register and
  `src/ui/strings/screen-states.ts` to gain the §3 mirror keys — appends in the exact class
  the increment's interfaces line grants for `src/core/errors.ts`: append-only, nothing
  existing moves, each mirror pinned byte-equal to its route twin by a test the build owns
  (the s-settings §3 mirror discipline; ARCH-01 is why the mirror exists at all).
- **I-69 — the token is a credential and is never painted.** It travels in the URL query and
  in the form's hidden input only; it appears in no text node, no visible attribute and no
  rendered link. A screenshot of this screen must be shareable without leaking the key to a
  membership.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: the session is already
judged by the `(app)` layout; reads `searchParams.token`; no token → the empty branch; else
the I-64 preview through the tenancy barrel — unclaimable → the refusal branch, claimable →
renders the form component), `actions.ts` (`acceptInvitationAction` — thin: authenticate,
mint the module ctx, build the `TenancyRequest` with the stated origin, call the barrel's
`acceptInvitation` under `guardTenancyMutation`; a marked refusal is caught and answered as
its code, anything else rethrows to the fault seam), `accept-invitation-form.tsx`
(`AcceptInvitationForm`, client component, props exactly `{ workspaceName, role, token,
action }` — jsdom-mountable, the MembersSection precedent), `loading.tsx`, `states.ts` (§2),
`strings.ts`, `accept-invitation.css`.

**The frame** (`cx-accept`): one centred column, width
`min(380px, calc(100vw - var(--space-8)))`, on the bare `var(--graphite-0)` page ground — no
card, no border, no shadow, no mark (I-63). Block padding top 96 px on ≥ sm,
`var(--space-8)` below sm. Vertical order, gaps in `var(--space-…)`: `<h1>` · 2 · caption ·
5 · the body · 4 · footer link. `<h1>` `accept_title` — `var(--text-20)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0. Caption `accept_caption` —
`var(--text-13)` `var(--graphite-600)`.

**The body** holds exactly one of three occupants:

- **The form** — `<form data-testid="accept-invitation-form">`, column flex, gap
  `var(--space-4)`; a hidden input carrying the token (I-69). First the invitation block,
  two labelled lines (label over value, gap `var(--space-1)`; labels `var(--text-13)`
  `var(--weight-body-medium)` `var(--graphite-700)`):
  - `accept_workspace_label` over
    `<span data-testid="accept-invitation-workspace">` — the inviting workspace's label
    through `workspaceLabel` (I-23; B-17 — never a second blankness judgement), in
    `var(--text-16)` `var(--weight-heading)` `var(--graphite-900)`. The name is what the
    person is deciding about: it dominates the screen, wraps freely and is never ellipsized.
  - `accept_role_label` over the invited role, verbatim per I-55: `var(--font-mono)`
    `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`,
    `tabular-nums slashed-zero`.

  Then **the answer slot** — between the block and the submit, the answer reads before the
  retry (the s-auth §1 ruling). While a refusal stands it holds
  `<div data-testid="accept-invitation-refusal">` wrapping exactly one RefusalState, entry
  read off the register in value position (Q-07), code travelling in `data-code`, never
  respelled; empty otherwise. Last, the submit: a full-width core Button
  `data-variant="primary"` `data-testid="accept-invitation-submit"`, label `accept_submit`,
  submitting the native form (Enter submits). In flight it takes core's loading state
  (`aria-busy`, no spinner) and the answer slot clears; after `RATE_LIMITED` the form
  re-enables, values intact (I-65).
- **The refusal, standing alone** (unclaimable at load, or answered by the submit) — the
  same `accept-invitation-refusal` wrapper and single RefusalState, in the form's place
  (I-65). Evidence: `{ href: "/", label: accept_evidence_workspace }` — no route of the
  invitee's can revive the token; their own workspace is where they stand while a fresh
  invitation is asked for. `RATE_LIMITED` inside the armed form instead carries
  `{ href: the current URL, query intact, label: accept_evidence_try_again }` — after the
  window, the same door is the resolving place (the s-auth evidence ruling).
- **The notice** — the s-auth notice idiom, `role="status"`: fill `var(--info-surface)`,
  border 1 px solid `var(--info)`, radius `var(--radius-4)`, padding `var(--space-3)`
  `var(--space-4)`, text `var(--text-13)` `var(--graphite-900)`. Two occasions: the done
  state — the `<h1>` becomes `accept_done_title` and the notice reads `accept_done_notice`
  with `{workspace}` filled by the joined workspace's label — and the missing-token state,
  notice `accept_no_token` under the unchanged title.

**The footer link** — one real `<a>` in the evidence-link idiom (`var(--text-13)`
`var(--weight-body-medium)` `var(--beam-600)`, underlined at rest, hover `var(--beam-500)`
over `var(--motion-state)` `var(--ease)`, reticle on focus, `align-self: start`): in the
done state `accept_open_workspace` (`{workspace}` filled) → `/t/{joinedSlug}`; in every
other state `accept_evidence_workspace` → `/`.

## 2. States (R-UI-050), ruled cell by cell

Declared twice, by law (AC-3, B-19): `states.ts` exports `ACCEPT_INVITATION_STATES` — one
row, seven cells in the shell matrix's cell shape (the MEMBERS_STATES shape); and
`src/ui/screen-states/matrix.tsx` gains the route key `"/accept-invitation"` (appended; no
existing row moves). The mirror keys are I-68's; `TRY_AGAIN_EVIDENCE` and
`SIGN_IN_EVIDENCE` are the existing statics.

- **Loading** — `loading.tsx`, frame intact: three core Skeletons, gap `var(--space-3)` —
  24 × 240 px (heading), 48 × min(380 px, 100 %) (invitation block), 36 × min(380 px, 100 %)
  (the submit). Matrix: `bones(3)`.
- **Empty** — the missing-token branch: title, `accept_no_token` notice, footer link — the
  empty state teaches the next action: open the mailed link. Matrix:
  `EmptyTeaching(state_accept_title, state_accept_no_token, state_accept_evidence_workspace)`.
- **Error** — a render, preview or action fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and the report id. Matrix:
  `fault(strings.error_body)`.
- **Refusal** — I-65's two branches; reachable codes are exactly `RATE_LIMITED` and
  `INVITATION_NOT_CLAIMABLE`, each with code (`data-code`), message, remedy and evidence;
  silence never happens. Matrix: the two stacked in the guard's judging order — the rate
  window is judged before the mutation reads the token — `RATE_LIMITED` with
  `TRY_AGAIN_EVIDENCE`, then `INVITATION_NOT_CLAIMABLE` with
  `{ href: "/", label: strings.state_accept_evidence_workspace }`.
- **Partial** — impossible: one token, one answer. Matrix:
  `reason(strings.state_partial_one_answer)`.
- **Offline** — a fault of reachability (shell I-20): server-drawn page, failed navigation
  or action surfaces the error path; no invented banner. Matrix:
  `delegatedToFault(strings.state_offline_unreachable, strings.auth_fault_unreachable_body)`.
- **Permission-denied** — a signed-out request never reaches the screen: the `(app)` door
  redirects it to `/sign-in` (AC-3); a session lapsing mid-action meets the same redirect
  (the density I-34 door). The invitation itself withholds nothing here — an unclaimable
  token is the refusal cell, not a permission. Matrix:
  `reasonedRefusal(strings.state_denied_accept_session, REFUSAL_ENTRIES.SIGNED_OUT,
  SIGN_IN_EVIDENCE)`.

## 3. Copy, verbatim

Route table (`strings.ts`, export `acceptInvitationStrings`, keys `accept_…`):
`accept_title` **Join a workspace** · `accept_caption` **Accepting adds this workspace to
your account — the workspaces you already belong to are unchanged.** · `accept_workspace_label`
**Workspace** · `accept_role_label` **Your role** · `accept_submit` **Accept invitation** ·
`accept_done_title` **Invitation accepted** · `accept_done_notice` **You are now a member of
{workspace}.** · `accept_open_workspace` **Open {workspace}** (both `{workspace}` slots are
data — the joined workspace's label per I-23, filled by the string seam's `fill`) ·
`accept_no_token` **This page needs the invitation link from your email — open the link to
continue.** (the `/verify` voice, kept) · `accept_evidence_workspace` **Go to your
workspace** · `accept_evidence_try_again` **Try again**.

Registry entry, appended once to `src/core/errors.ts` (the interfaces grant) and rendered
verbatim everywhere — here, and in the members panel's `invitations-refusal` when a resend
or revoke meets a dead token (that slot is the s-settings revision's to place):

| code | severity | surface | message | remedy |
|---|---|---|---|---|
| INVITATION_NOT_CLAIMABLE | error | inline | **This invitation cannot be accepted — it may have been revoked, already accepted, or sent to a different email address.** | **Ask the person who invited you to send a new invitation to the address you sign in with.** |

One code for every dead-token cause (unknown, spent, revoked, addressed to another key) —
the door never discloses which, so holding a stray token teaches nothing about what exists
(the sent-notice non-disclosure, transposed). It is `error`: refused, and resolved only by a
new invitation. The copy obeys the refusal-state rules: present tense, remedy verb-first, no
code in any sentence, no build vocabulary.

Mirrors (I-68), appended to `src/ui/strings/screen-states.ts`: `state_accept_title` **Join a
workspace** · `state_accept_no_token` **This page needs the invitation link from your email —
open the link to continue.** · `state_accept_evidence_workspace` **Go to your workspace** —
each byte-identical to its route twin above, pinned equal by a test — plus the matrix-only
reason `state_denied_accept_session` **Any signed-in account may open this page; a request
carrying no session is sent to sign-in before it is reached.** And `refusal-entries.ts`
gains `INVITATION_NOT_CLAIMABLE` byte-identical to the register's entry, its code joining
the `DeclaredCode` union. Voice throughout: calm, concrete, no exclamation marks; the
workspace name and role are data, never woven into sentences (I-55).

## 4. Motion (R-UI-004)

None beyond the inherited idioms: Button and link colour over `var(--motion-state)`
`var(--ease)`, the reticle draw and the Skeleton pulse in their single homes. The form,
refusal, notice and done state mount with no entrance — an answer arrives instantly
(the RefusalState ruling). Every duration is a token zeroed at source under reduced motion;
no bounce anywhere.

## 5. Tokens

`--graphite-0/600/700/900` · `--beam-500/600` (links; the Button's own tokens are core's) ·
`--info`/`--info-surface` (the notice) · `--space-1/2/3/4/5/8` · `--radius-4` ·
`--text-13/16/20` · `--font-mono` · `--weight-body-medium/--weight-heading` ·
`--motion-state/--ease`. Px literals, closed set (core I-1's class): the 380 px column
measure, the 96 px ≥ sm top padding, and the skeleton bones 24/48/36 × 240/380. Any other
literal is a defect. The refusal card's tints are RefusalState's own; no copper appears
anywhere on this surface (I-66).

## 6. Themes

`accept-invitation.css` contains no `[data-theme]` selector; every light/dark difference
arrives through token values (R-UI-001): page ground, graphite text roles, beam links,
`info-surface`/`info` on the notice, the refusal tints per RefusalState's Decision. Contrast
holds on the founder facts in both themes: graphite-600 captions and graphite-700 labels
≥ 4.5:1 on graphite-0, beam-600 on graphite-0 and on info-surface ≥ 4.5:1, graphite-900 on
info-surface per the s-auth notice precedent.

## 7. Test hooks (closed contract, C-05)

Route: `/accept-invitation` (tree key `/accept-invitation`); the mailed URL is
`/accept-invitation?token=<token>`, read with `newestMail(email, "invitation")`. Test ids,
exactly the contract's four, on the elements ruled in §1: `accept-invitation-form` (the
`<form>`) · `accept-invitation-workspace` (the name span) · `accept-invitation-submit` (the
core Button) · `accept-invitation-refusal` (wrapper of one RefusalState — the component's
ids and `data-code` nest inside; `data-code` is `INVITATION_NOT_CLAIMABLE` for every
dead-token cause). No others are added. Server action: `acceptInvitationAction`. Behavioural
hooks without new ids: `role="status"` on the notice, `aria-busy` on the loading submit, the
`<h1>` swapping `accept_title` → `accept_done_title` on success, the token in no rendered
text (I-69), the footer link's resolved href per state.

Journey hooks: a signed-out request to `/accept-invitation` lands on `/sign-in` (AC-3).
Checkpoint `j-001-auth/accept` — the claimable form with the workspace named and the submit
armed; `accept-invitation-workspace` carries a run-suffixed name and is masked per V-E2E's
per-journey masks; axe serious/critical = 0. jsdom acceptance mounts `AcceptInvitationForm`
with an injected `action`: a settled `INVITATION_NOT_CLAIMABLE` renders the §3 message and
remedy in place of the form; a settled `RATE_LIMITED` renders in the answer slot with the
form still armed — two branches, both through the one RefusalState (I-65). The live proof
drives the shipped route against a provisioned scratch database, no mocked module.
