# Design Decision — S-Settings-Participants (the project participants screen)

Route: `/t/{tenantId}/p/{projectId}/settings/participants` under
`src/app/(app)/t/[tenant]/p/[project]/settings/participants/**`, inside the shell frame and
behind the membership guard in `t/[tenant]/layout.tsx`. Increment inc-012-participants. Law:
R-SPINE-011, L-ACT-02/03, R-UI-001/003/004/005/012/020/021/031/050/060, B-17, B-20, Q-11,
Q-17. Every convention of the earlier Decisions binds: `cx-` classes, tokens-only colour and
motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in authored
CSS. Interpretations I-1–I-46 remain in force ("workspace" is the user-facing word for
tenant, s-auth I-11). Chrome comes only from shipped primitives — core Button, Chip,
Skeleton; the one RefusalState; the one ConsequenceDialog (its own Decision rules everything
inside it) — plus the `cx-participants-*` classes this file rules. Copy lives in
`src/ui/strings/participants.ts` (keys `spine_participants_…`, registry append); JSX carries
no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-47 — role and direction enums render verbatim mono everywhere.** `PRINCIPAL`,
  `MEASURER`, `GRANT`, `WITHDRAW` are closed law identifiers a person must recognise across
  picker, list, history, consequence rows and one day a certificate — the BasisChip class
  (the enum value, never title-cased; core §3, ruleset I-25). They render in
  `var(--font-mono)` exactly as stored, in the chips included: a chip's content is content,
  not a restyling of the primitive. Prose around them stays prose (field labels, captions).
- **I-48 — the pickers are chip fieldsets, s-home I-33 transposed.** No Select ships and a
  native `<select>` cannot wear the reticle, so member, role and direction each render as a
  `<fieldset>` (legend styled as the field label) of shipped interactive Chips, exactly one
  `selected`/`aria-pressed="true"` per group; hidden inputs carry the chosen values.
  Direction defaults to `GRANT` (the seam's own default for an absent direction); member and
  role default to nothing — choosing is the point. The Select IOU stays recorded against the
  later primitives increment; this screen adopts it when it ships.
- **I-49 — the screen pre-checks the preview; the dialog opens only on a consequence.** The
  ConsequenceDialog Decision's I-41 division: refusals before open belong to the screen. The
  submit handler awaits the one preview wrapper (over `previewAssignRole`); a refusal
  renders in `participants-refusal` in place and the dialog never opens on nothing — the
  journey's last-PRINCIPAL checkpoint reads exactly this surface. The dialog then computes
  its own preview on open (its I-41 currency guarantee; the second computation is deliberate
  and cheap). Refusals arriving once the dialog holds focus render in its slot.
- **I-50 — a refused read is this screen's permission-denied state, in-frame.** L-ACT-03's
  one seam guard refuses `roleHistory` to a signed-in tenant member who neither participates
  nor holds OWNER/ADMIN, naming missing permission `ADMINISTER_PROJECT` and no act type
  (the increment's recorded reading). The workspace membership itself holds, so the frame
  stays (unlike the shell's frameless workspace denial): the header renders, then the two
  detail lines and one banner RefusalState — and nothing else. A rail of controls that would
  all refuse is theatre; the screen's list, form and history do not render.
- **I-51 — member labels come from the fold's read-back; nothing paints a nameless member.**
  `users.email` stores the folded key, not an address (shell I-21), so subject and actor
  labels are the presented address read back through the fold's own computed prefix — the
  mechanism's one home, imported, never respelled (B-17); if reusing it requires the shared
  helper to move out of the shell's seam, that is an ownership question for the plan, never
  a copy. A digest-keyed account has no address to show and renders
  `spine_participants_member_unnamed` (the I-23 class).
- **I-52 — history is a ledger and reads like one: oldest first, newest last.** AC-3 fixes
  newest last; an append-only record reads downward, and the newest row arriving at the
  bottom is the visible append. Withdrawn roles stay on the record; the current-roles list
  shows effective roles (grants minus withdrawals) only.
- **I-53 — this route has no visible door yet; the debt is recorded, not papered.** R-UI-031
  owes every screen visible navigation. The surfaces that could carry the link — the s-home
  project card, a project-settings sub-nav, the shell — are other nodes' files. Recorded
  IOU, owner: the node owning the project card / project settings chrome (the
  s-settings-ruleset precedent, whose own debt the s-home pin link later paid). Until then
  the route is journey- and URL-reachable. Consequently no owned
  `tests/e2e/baselines/design/j-003/**` baseline shifts: this increment repaints nothing
  those pictures show, and B-20's answer is "no re-baseline owed" — recorded so the absence
  is deliberate.
- **I-54 — re-granting a withdrawn role is out of scope and faults honestly.** The
  `participant_roles_role_once` constraint still blocks a second grant row; the fault seam
  answers the 23505 as an unmarked fault on the root error boundary. Recorded IOU for a
  later participants increment (the increment spec's own words); no local guard pretends
  otherwise, and the form resets after a commit (below) so the surface does not invite it.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments,
calls `roleHistory` and `assignableSubjects` from `src/modules/spine/participants`,
branches per I-50, renders the section), `participants-section.tsx` (client component
`ParticipantsSection`, mountable under jsdom with injected data and perform — the s-auth
`SignInForm` precedent), `actions.ts` (`previewAssignRole`, `commitAssignRole` server
actions reaching the one act seam, B-17), `loading.tsx`, `states.ts` (§2), `participants.css`.

The page renders in `shell-main`, one column `cx-participants`: max-width 800 px, column
flex, gap `var(--space-6)` (the settings-screen measure, ruleset §1). Rail and breadcrumb
are the shell's: `areaOf` answers `projects`, the Projects rail row carries
`aria-current="true"` and the Projects crumb links back (ruleset I-30, unchanged).

Header block (`gap: var(--space-2)`): `<h1>` `spine_participants_heading` —
`var(--text-20)` `var(--weight-heading)` `var(--graphite-900)`, margin 0 — over
`spine_participants_caption` in `var(--text-13)` `var(--graphite-600)`.

### Current roles (`<section aria-labelledby>`)

`<h2>` `spine_participants_current_heading` (`var(--text-16)` `var(--weight-heading)`
`var(--graphite-900)`, margin 0), then `<ul data-testid="participants-list">` — list-style
none, margin 0, padding 0. One `<li data-testid="participants-row" data-user={userId}>` per
participant: min-height `var(--row-comfortable)`, border-top `var(--hairline)` after the
first, align-items center, grid `minmax(0, 1fr) auto`, column gap `var(--space-4)`: the
member's label (I-51) `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`,
single line, ellipsis; then the effective roles (I-52), each verbatim in `var(--font-mono)`
`var(--text-12)` `var(--graphite-700)`, joined with `var(--space-2)` gaps, in the role
enum's declared order. Nothing here is interactive and no hover fill renders.

### Assign a role (`<section aria-labelledby>`)

`<h2>` `spine_participants_assign_heading`, hint `spine_participants_assign_hint`
(`var(--text-12)` `var(--graphite-600)`), then
`<form data-testid="participants-assign-form">`, fieldsets stacked at gap `var(--space-4)`,
each legend `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-700)` over a
wrapping chip row at gap `var(--space-2)` (I-48):

- `participants-assign-subject` (fieldset, legend `spine_participants_field_member`) — one
  Chip per entry of `assignableSubjects` (the tenant's members), content the member's label.
- `participants-assign-role` (fieldset, legend `spine_participants_field_role`) — one Chip
  per role of the closed enum, in declared order, content the enum value per I-47.
- `participants-assign-direction` (fieldset, legend `spine_participants_field_direction`) —
  two Chips, `GRANT` (preselected) and `WITHDRAW`, content verbatim per I-47.

Then the **answer slot** `<div data-testid="participants-refusal">` (before the submit, the
s-auth ordering), then a core primary Button, no testid (the contract is closed; journeys
find it by role and name), label `spine_participants_assign_submit`, `align-self: start`.

**Submission** (I-49): the handler first judges locally (s-home I-34's class) — a member and
a role are chosen, else one `role="alert"` line `spine_participants_assign_refusal` renders
in the slot wearing the house alert chrome (`var(--danger-surface)` fill, `var(--hairline)`
border re-keyed `border-color: var(--danger)`, radius `var(--radius-4)`, padding
`var(--space-3)` `var(--space-4)`, `var(--text-13)` `var(--weight-body-medium)`), focus
moves to the first chip of the offending fieldset, the group carries `aria-invalid="true"`
and `aria-describedby` naming the line, re-fired per submission (s-home §1's rulings,
reused). Judged good, the handler awaits the preview wrapper: a refusal renders in the slot
as exactly one RefusalState, registered copy verbatim — reachable codes and evidence:
`PROJECT_WOULD_HAVE_NO_PRINCIPAL` `{ href: the current route, label:
spine_participants_evidence_assign }` (the resolution is this screen's own form; the
current-route evidence is the s-design warning-cell precedent) · `PERMISSION_NOT_HELD`
`{ href: /t/{t}, label: home_evidence_projects }` · `SIGNED_OUT` `{ href: "/sign-in",
label: shell_evidence_sign_in }`. A consequence opens the ConsequenceDialog
(`actType: "ASSIGN_PARTICIPANT_ROLE"`; injected `preview`/`commit` close over the submitted
`{ subjectUserId, role, direction }` and call the two server actions), clearing the slot.
While the pre-check is in flight the submit takes core's loading state. On `onCommitted` the
dialog closes, focus returns per the primitive, the screen refreshes so the list and
history re-render — the new row is the visible answer, no toast — and the form resets to
its defaults (I-54). The submit stays enabled after any refusal: a retry is never disarmed.

### Role history (`<section aria-labelledby>`)

`<h2>` `spine_participants_history_heading`, hint `spine_participants_history_hint`, then
`<ol data-testid="participants-history">` — list-style none, margin 0, padding 0 — in the
seam's order, oldest first, newest last (I-52). Each `<li
data-testid="participants-history-row" data-direction={direction} data-role={role}>`:
padding-block `var(--space-2)`, border-top `var(--hairline)` after the first, two lines:

- Line one, flex, baseline, gap `var(--space-3)`: the direction verbatim
  (`var(--font-mono)` `var(--text-12)` `var(--graphite-600)`, min-width 88 px so the column
  aligns — the ruleset scope-column precedent) · the role verbatim (`var(--font-mono)`
  `var(--text-13)` `var(--weight-body-medium)` `var(--graphite-900)`) · the subject's label
  (`var(--text-13)` `var(--graphite-700)`, ellipsis).
- Line two: `spine_participants_history_by` with the acting user's label and the date
  through `src/core/format`'s date seam (DD MMM YYYY, the s-home I-37 class; the date
  renders `var(--font-mono)` `tabular-nums slashed-zero`), `var(--text-12)`
  `var(--graphite-600)`. Direction carries its meaning in the word, never in colour (Q-11):
  no semantic tint distinguishes a withdrawal.

### Permission-denied branch (I-50)

Header block unchanged, then `<div data-testid="participants-refusal">` wrapping: `<p>`
`spine_participants_denied_permission` and `<p>` `spine_participants_denied_holder` (both
`var(--text-13)` `var(--graphite-700)`, margin 0, gap `var(--space-2)`), then one
RefusalState — the registered `PERMISSION_NOT_HELD`, banner surface, evidence
`{ href: /t/{t}, label: home_evidence_projects }`. List, form and history do not render.

## 2. States (R-UI-050), ruled cell by cell

Declared in `states.ts` (route directory), export `PARTICIPANTS_STATES`, one row, seven
cells in the shell matrix's cell shape; the increment's jsdom acceptance walks it.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout, gap
  `var(--space-3)` — 24 × 240 px (heading), two 16 × 360 px (list rows), four
  16 × min(640 px, 100 %) (form and history).
- **Empty** — impossible, by law: a project holds at least one effective PRINCIPAL at every
  moment (R-SPINE-011), so the list always has a row, the history always holds the creating
  grant, and the member picker always holds the session's own account.
- **Error** — a render, read or action fault (I-54's 23505 included) surfaces the root
  error boundary; its Decision rules retry and records the report-id deferral.
- **Refusal** — the answer slot (§1) and, once the dialog holds focus, its own slot and
  stale notice (the ConsequenceDialog Decision rules those). Every reachable code is named
  in §1; silence never happens.
- **Partial** — impossible: one guard answers the whole read (AC-3); there are no
  per-row refusals.
- **Offline** — a fault of reachability (shell I-20): server-rendered page, failed
  navigation surfaces the error path; no invented banner.
- **Permission-denied** — the I-50 branch for a member without standing; a request for a
  workspace the session does not hold is the shell's frameless denial before this route
  mounts; unauthenticated is the `/sign-in` redirect.

## 3. Copy, verbatim (`src/ui/strings/participants.ts`)

`spine_participants_heading` **Participants** · `spine_participants_caption` **Who holds
which role on this project. Roles change only by act — previewed first, then committed —
and every change stays on the record below.** · `spine_participants_current_heading`
**Current roles** · `spine_participants_assign_heading` **Assign a role** ·
`spine_participants_assign_hint` **Granting or withdrawing opens a preview of exactly what
will change. Nothing is committed until you confirm it there.** ·
`spine_participants_field_member` **Member** · `spine_participants_field_role` **Role** ·
`spine_participants_field_direction` **Direction** · `spine_participants_assign_submit`
**Preview this change** · `spine_participants_assign_refusal` **Choose a member and a role
— nothing was previewed.** · `spine_participants_history_heading` **Role history** ·
`spine_participants_history_hint` **Every grant and withdrawal on this project, oldest
first. Withdrawn roles stay on the record — nothing here is edited or deleted.** ·
`spine_participants_history_by` **by {actor} on {date}** (both slots are data) ·
`spine_participants_member_unnamed` **Unnamed member** ·
`spine_participants_denied_permission` **Seeing who holds which role needs participation on
this project or ownership of the workspace; the permission your account is missing is
ADMINISTER_PROJECT.** · `spine_participants_denied_holder` **The project's participants and
the workspace's owners and admins can see it.** · `spine_participants_evidence_assign`
**Grant another member PRINCIPAL first**. Shell and home keys are reused by key, never
respelled.

Registry copy this increment fixes (`src/core/errors.ts` append, the refusal-state §3
rules binding): **PROJECT_WOULD_HAVE_NO_PRINCIPAL** · severity error · surface inline ·
message **This withdrawal would leave the project with no principal, so it was not carried
out.** · remedy **Make another member a principal first, then withdraw this one.** The
owner-installed trigger's raised message contains the code for machines; the code appears
in no rendered copy. Voice throughout: calm, concrete, no exclamation marks; enum values
are data, not prose (I-47).

## 4. Motion (R-UI-004)

The ConsequenceDialog's entrance is the Dialog primitive's own; chip and button hover
colours transition over `var(--motion-state)` `var(--ease)`; reticle and Skeleton live in
their single homes. List rows, history rows, refusals and the denied branch mount with no
entrance — answers arrive instantly. Every duration is a token zeroed at source under
reduced motion; no bounce anywhere.

## 5. Tokens

`--graphite-600/700/900` · `--danger/--danger-surface` · `--hairline` ·
`--space-2/3/4/6` · `--radius-4` · `--text-12/13/16/20` · `--font-mono` ·
`--weight-body-medium/--weight-heading` · `--row-comfortable` ·
`--motion-state/--ease`. Px literals, closed set (core I-1's class): the 800 px page
measure, the 88 px direction column, and the skeleton bones 24/16 × 240/360/640. Any other
literal is a defect.

## 6. Themes

`participants.css` contains no `[data-theme]` selector; every light/dark difference
arrives through token values (R-UI-001). Contrast holds on founder facts in both themes:
graphite-600/700/900 on graphite-0 ≥ 4.5:1, the danger pair per the refusal-state ruling.
No basis colour appears; copper appears only inside the ConsequenceDialog's confirm, where
its own Decision puts it — nothing on the page itself wears act colour.

## 7. Test hooks (closed contract, C-05)

Route introduced: `/t/{tenantId}/p/{projectId}/settings/participants`. Test ids, exactly
the contract's, on the elements ruled in §1: `participants-list` · `participants-row`
(`data-user`) · `participants-history` · `participants-history-row`
(`data-direction`, `data-role`, both verbatim enum values) · `participants-assign-form` ·
`participants-assign-subject` · `participants-assign-role` ·
`participants-assign-direction` (the three fieldsets) · `participants-refusal` (the answer
slot, and the same id wrapping the I-50 denied branch — one id, the screen's one in-place
answer surface) — plus the ConsequenceDialog's five, ruled in its own Decision. No others
are added. Behavioural hooks without new ids: `aria-pressed` on the Chips (exactly one per
group), `aria-invalid`/`aria-describedby` on a judged fieldset, `role="alert"` on the local
line, `aria-busy` on the loading submit, RefusalState's own ids and `data-code` inside
`participants-refusal`.

Journey: `tests/e2e/journeys/j-003-projects.spec.ts` extended (page object
`tests/e2e/pages/s-participants.page.ts`), navigating to the route directly (I-53).
Checkpoints, axe serious/critical = 0 at each, never widened: **j-003-role-granted** — the
creator selects themself, `MEASURER`, `GRANT`, submits, sees the digest line inside the
open dialog, confirms; a `GRANT` history row with `data-role="MEASURER"` appears ·
**j-003-consequence-dialog-open** — at the open-dialog moment, `toHaveScreenshot` on the
primitive's `dialog-content`, name `"consequence-dialog-open.png"` — the bare file name,
because the locked `snapshotPathTemplate` already carries the `design/` segment
(`tests/e2e/baselines/design/{arg}{ext}`), so an array form would write the segment twice
and strand the committed baseline — animations disabled, maxDiffPixelRatio 0.002, masks on
`consequence-digest-line` and `.cx-consequence-subject-label` (the two per-run texts;
role names and chrome stay unmasked) · **j-003-last-principal-protected** — subject self,
`PRINCIPAL`, `WITHDRAW`, submit: the registered PROJECT_WOULD_HAVE_NO_PRINCIPAL message
and remedy render inside `participants-refusal`, and no dialog opens (I-49). `pnpm e2e
--journey J-003` and `--journey J-000` each exit 0; per I-53 no existing `j-003/**`
baseline shifts, and the one new baseline's reason is this Decision (B-20). jsdom
acceptance mounts `ParticipantsSection` with injected data and perform: list and history
rendering (order, data attributes, the unnamed-member fallback), the I-48 single-selection
groups, the local judgement, both settled-refusal renderings, and the dialog handoff with
the wrapper's input snapshot.
