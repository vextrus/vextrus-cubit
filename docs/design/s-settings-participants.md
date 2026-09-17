# Design Decision — S-Settings-Participants (the project participants screen)

```
┌R─┬─────────────┬──────────────────────────────────────────────────────────────┐
│  │ ws › Projects › Participants                              ⌘K ⟳ ✉ ◉         │
│  ├─────────────┼──────────────────────────────────────────────────────────────┤
│  │Participants◂│ Participants  (i)                                            │  header 40
│  │Rule set     │ Current roles  2                                             │  section 28
│  │Taxonomy     │ ┌────────────────────────┬──────────────────────────┐        │
│  │Tax          │ │ Member                 │ Role                     │        │  28 px rows
│  │             │ │ j003p-…@cubit.test     │ Principal  Measurer      │        │
│  │             │ └────────────────────────┴──────────────────────────┘        │
│  │             │ Assign a role  (i)                                           │  section 28
│  │             │ Member    [ j003p-… ] [ other@… ]                            │  chips, 28 px
│  │             │ Role      [ PRINCIPAL ] [ MEASURER ] [ REVIEWER ]            │
│  │             │ Direction [ GRANT ] [ WITHDRAW ]                             │
│  │             │ ‹answer slot: the judged line, or one RefusalState›          │
│  │             │ ● Preview this change                                        │  one primary
│  │             │ Role history  3  (i)                                         │  section 28
│  │             │ ┌──────────┬────────────┬──────────────┬──────────────────┐  │
│  │             │ │ Direction│ Role       │ Member       │ Recorded         │  │  28 px rows
│  │             │ │ Grant    │ Principal  │ j003p-…      │ on 12 Sep 2026   │  │
│  │             │ └──────────┴────────────┴──────────────┴──────────────────┘  │
└──┴─────────────┴──────────────────────────────────────────────────────────────┘
       160                              the content pane
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| section nav | the project's settings areas; Participants carries `aria-current` | 160 × 100 % (`--drawer-w-min`), rows `--control-h` | — (an area with no screen is shown disabled with its reason in a tooltip) | — | — |
| header | the title and the `(i)` that holds the caption | 100 % × 40 | — | — | — |
| current roles (primary) | who holds which role, in force now | flex × `--row-h` rows | impossible — a project holds at least one PRINCIPAL at every moment | the root boundary (`src/app/error.tsx`) | `loading.tsx` bones at the row height |
| assign form | the one act: three single-selection chip groups, the answer slot, the one primary | 100 % × auto, controls `--control-h` | — | the judged line, then `RefusalState` in the slot; once the dialog holds focus, the dialog's own slot | the submit's loading state |
| role history | every grant and withdrawal, oldest first, with who recorded it and when | flex × `--row-h` rows | impossible — the creating grant is always on the record | the root boundary | bones at the row height |
| permission-denied | the header, and one `RefusalState` saying why nothing else stands | 100 % × auto | — | — | — |

Built on Design Direction 00 §3.6's Settings template, whose geometry outranks this file where the
two disagree (§3's precedence); what the rebuild changed is recorded as I-209–I-212 below.


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

- **I-209 — the screen is drawn in the settings TEMPLATE.** Design Direction 00 §3.6 rules
  settings a two-pane template, and its one home is
  `src/app/(app)/t/[tenant]/settings/settings-pane.tsx` (members' I-198). `page.tsx` renders
  `SettingsPane` with the project's own areas — this screen and Rule set are the two that are
  built — so the nav is also the visible navigation between them that ruleset I-30's IOU
  recorded, and the section itself stays free of the frame.
- **I-210 — the two lists are the shipped DataTable.** §5 makes it the one grid: the roles in
  force and the record are 28 px grids with frozen key columns, the truncation contract and the
  remembered column furniture, and their rows keep the ids and the `data-` attributes the `<ul>`
  and `<ol>` published — `participants-row` with `data-user`, `participants-history-row` with
  `data-direction` and `data-role` — so the journey that drives this screen is untouched by the
  change of instrument. The record's second line becomes its fourth column, **Recorded**, which
  is the one heading this rebuild had to author (§3).
- **I-211 — I-47 is a statement about the CHANNEL, not about the glyphs.** A role and a
  direction still render in full in the DOM, but through `EnumLabel`: a person reads "Principal"
  and "Grant", and `PRINCIPAL` and `GRANT` travel in the primitive's technical channel, which is
  where the act's own taxonomy, the journeys and the exports read them from (§6, and the rubric's
  C6). The one place the enum's own glyphs stay on screen is the assign form's chips: there a
  person is choosing FROM the closed taxonomy, and I-47's reason — that the word chosen and the
  word recorded must be the same word — still holds.
- **I-212 — the three helper sentences are behind `(i)` popovers, the denied screen's two
  included.** §6 allows at most one helper line per screen and this screen has none: the caption,
  the assign hint and the history hint are the disclosures on the headings they explain, and on
  the permission-denied branch the two sentences that name the permission and who holds it are
  the header's, leaving the `RefusalState` to be the one answer on the screen.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments, calls
`projectParticipants`, `roleHistory` and `assignableSubjects` from
`src/modules/spine/participants`, branches per I-50, renders the section inside `SettingsPane`
— I-209), `participants-section.tsx` (client component `ParticipantsSection`, mountable under
jsdom with injected data and settlements — the s-auth `SignInForm` precedent), `actions.ts`
(`previewAssignRole`, `commitAssignRole` server actions reaching the one act seam, B-17),
`loading.tsx`, `states.ts` (§2), `strings.ts` (§3's one authored heading), `participants.css`.

The screen renders in the template's content pane, one column `cx-participants`, gap
`var(--gap-section)`. Rail and breadcrumb are the shell's: `areaOf` answers `projects`, the
Projects rail row carries `aria-current="true"` and the Projects crumb links back (ruleset
I-30, unchanged); which SETTINGS area a reader is standing in is what the section nav says.

**The header** (40 px): `<h1>` `spine_participants_heading` at `var(--text-20)`
`var(--weight-heading)`, then the `(i)` holding `spine_participants_caption` (I-212). No
subtitle, and no standing sentence anywhere on the screen.

### Current roles (`<section aria-labelledby>`)

A section line (`--control-h`): `<h2>` `spine_participants_current_heading` at
`var(--text-14)` `var(--weight-heading)`, then the count of participants as a mono figure
beside the words it counts. Then one `DataTable` (table id `participants-roster`) inside
`<div data-testid="participants-list">`: one 28 px row per participant, in the module's own
order, carrying `data-testid="participants-row"` and `data-user`, two columns —

- **Member** (320, the frozen key column) — the member's label (I-51), 13 px
  `--weight-body-medium`, one line, ellipsis, the grid's tooltip on truncation.
- **Role** (360) — every role in force for them (I-52) through `EnumLabel`, in the role enum's
  declared order, gap `var(--space-2)`: a person reads "Principal", and `PRINCIPAL` travels in
  the technical channel (I-211).

Nothing in this grid is interactive: a role moves by act, and the act is the form below.

### Assign a role (`<section aria-labelledby>`)

A section line: `<h2>` `spine_participants_assign_heading` with the `(i)` holding
`spine_participants_assign_hint` beside it (I-212). Then
`<form data-testid="participants-assign-form">`, fieldsets stacked at gap `var(--space-2)`,
each one a `--control-h` line of `minmax(0, 160px) 1fr` — the legend in `var(--text-13)`
`var(--ink-muted)` in the first column, a wrapping chip row at gap `var(--space-1)` in the
second, so the three fields read as three lines of a compact form rather than three stacked
blocks (I-48):

- `participants-assign-subject` (fieldset, legend `spine_participants_field_member`) — one
  Chip per entry of `assignableSubjects` (the tenant's members), content the member's label.
- `participants-assign-role` (fieldset, legend `spine_participants_field_role`) — one Chip
  per role of the closed enum, in declared order, content the enum value per I-47.
- `participants-assign-direction` (fieldset, legend `spine_participants_field_direction`) —
  two Chips, `GRANT` (preselected) and `WITHDRAW`, content verbatim per I-47.

Then the **answer slot** `<div data-testid="participants-refusal">` (before the submit, the
s-auth ordering), then a core primary Button, no testid (the contract is closed; journeys
find it by role and name), label `spine_participants_assign_submit`, `align-self: start`.

Last in the form, a **status line** `<p role="status" aria-live="polite">` (no testid; the
contract is closed): `var(--text-12)` `var(--graphite-600)`, margin 0, min-height
`var(--text-13)` so the form does not jump as it fills and empties. It says
`spine_participants_assign_pending` while the pre-check is in flight and
`spine_participants_assign_committed` once the dialog has committed; otherwise it is empty.
It is announcement, not answer: the visible answer to a commit remains the new history row
(below), and no toast ships — a reader who cannot see the record grow is told in words that
an irreversible act was recorded, which R-UI-050's written cell and R-UI-012 together owe
them. The refusal slot above is unaffected; the two never speak at once (in flight, neither
the judged sentence nor a settled refusal stands).

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

A section line: `<h2>` `spine_participants_history_heading`, the count of movements as a mono
figure, and the `(i)` holding `spine_participants_history_hint`. Then one `DataTable` (table id
`participants-history`) inside `<div data-testid="participants-history">`: the seam's order,
oldest first, newest last (I-52), one 28 px row per movement carrying
`data-testid="participants-history-row"`, `data-direction` and `data-role`, four columns —

- **Direction** (140) — `GRANT` or `WITHDRAW` through `EnumLabel` (I-211). The direction carries
  its meaning in the word, never in colour (Q-11): no semantic tint distinguishes a withdrawal.
- **Role** (180) — the role through `EnumLabel`, `--weight-body-medium`.
- **Member** (280) — the subject's label, one line, ellipsis.
- **Recorded** (240, headed `participants_col_recorded`) — `spine_participants_history_by` with
  the acting member's label and the day through `src/core/format`'s date seam (DD MMM YYYY, the
  s-home I-37 class), `tabular-nums slashed-zero`. A grant a project's creation installed was
  performed by nobody — L-ACT-03 makes the creating PRINCIPAL a bootstrap rather than an act — so
  the cell says when it happened and stops; "by an unnamed member" would name a performer that
  does not exist, which is worse than saying less (B-21).

### Permission-denied branch (I-50)

The template and the header stand unchanged, with the header's `(i)` carrying
`spine_participants_denied_permission` and `spine_participants_denied_holder` — the two
sentences that name the permission and who holds it (I-212) — and then
`<div data-testid="participants-refusal">` wrapping one RefusalState: the registered
`PERMISSION_NOT_HELD`, banner surface, evidence `{ href: /t/{t}, label:
home_evidence_projects }`. It is the one answer on the screen; list, form and history do not
render, because a rail of controls that would all refuse is theatre.

## 2. States (R-UI-050), ruled cell by cell

Declared in `states.ts` (route directory), export `PARTICIPANTS_STATES`, one row, seven
cells in the shell matrix's cell shape; the increment's jsdom acceptance walks it.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout the grids will
  take, gap `var(--space-2)` — 24 × 240 px for the header's title, then six bones at the row
  height (28 × min(700–880 px, 100 %)) standing for the roster's rows and the record's. A bone
  that kept a height the answer does not keep is a layout that moves under the reader
  (§5 rule 8).
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
— nothing was previewed.** · `spine_participants_assign_pending` **Working out what this
change would do…** · `spine_participants_assign_committed` **Recorded. The change is on the
record below.** · `spine_participants_history_heading` **Role history** ·
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

The one heading this rebuild authored, in the route directory C-13 puts a screen's own copy in
(`strings.ts`, export `participantsScreenStrings`): `participants_col_recorded` **Recorded** —
the record's fourth column (I-210). It lives there rather than in the shared table because
`src/ui/strings/participants.ts` is another node's file this pass; the table also mirrors the
sentence the R-UI-050 matrix says for this screen's empty cell, byte-identical to
`state_empty_project_principal`, under the members Decision's own mirror discipline (re-wording
one without the other is the drift C-13 forbids). **Owed by the increment that may touch the
string registry:** both keys folded into `src/ui/strings/participants.ts`.

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

Semantic aliases only (§4's rule 3 — no `--graphite-*`/`--beam-*` reference outside the token
source): `--ink` / `--ink-secondary` / `--ink-muted` · `--state-danger(-surface)` (the judged
line's own chrome) · `--line` through `--hairline` · the density and layout tokens the screen is
drawn at — `--row-h`, `--control-h`, `--gap-section`, `--drawer-w-min` (the assign form's label
column, which is the nav's measure and therefore the same column of the page) · `--space-1/2/3`
· `--radius-4` · `--text-12/13` · `--font-mono` · `--weight-body-medium` · `--motion-state` /
`--ease`. Px literals: NONE — every measure on this screen is a token or a grid column's own
width. `tests/ui/craft/mechanical.test.ts` scores this file for both.

## 6. Themes

`participants.css` and the template's `settings.css` contain no `[data-theme]` selector; every
light/dark difference arrives through token values (R-UI-001), and dark is the default the
screen is first seen in. Contrast holds on founder facts in both themes: every ink alias used
here on the app surface ≥ 4.5:1, the danger pair per the refusal-state ruling, the current nav
row's ink on `--surface-selected` ≥ 4.5:1. No basis colour appears; copper appears only inside
the ConsequenceDialog's confirm, where its own Decision puts it — the screen's own one primary
is the preview door, which opens the dialog rather than committing anything.

## 7. Test hooks (closed contract, C-05)

Route introduced: `/t/{tenantId}/p/{projectId}/settings/participants`. Test ids, exactly
the contract's — the same closed roster, on the elements §1 now rules: `participants-list`
(the roster grid's container) · `participants-row` (each grid row, `data-user`) ·
`participants-history` (the record grid's container) · `participants-history-row`
(`data-direction`, `data-role`, both verbatim enum values) · `participants-assign-form` ·
`participants-assign-subject` · `participants-assign-role` ·
`participants-assign-direction` (the three fieldsets) · `participants-refusal` (the answer
slot, and the same id wrapping the I-50 denied branch — one id, the screen's one in-place
answer surface) — plus the ConsequenceDialog's five, ruled in its own Decision. No others
are added; the grids' own ids are the DataTable's, ruled by its Decision. Behavioural hooks
without new ids: `aria-pressed` on the Chips (exactly one per group),
`aria-invalid`/`aria-describedby` on a judged fieldset, `role="alert"` on the local line,
`role="status"`/`aria-live="polite"` on the form's status line, `aria-busy` on the loading
submit, `data-technical` on every enum's stored word, `aria-current` on the nav's current row,
RefusalState's own ids and `data-code` inside `participants-refusal`.

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

- 2026-09-18 — inc-304a-ruleset-authoring-ui: the project settings frame moved into `settings/layout.tsx` over `PROJECT_SETTINGS_AREAS` (`settings/areas.ts`), and `projectSettingsNav` — the second spelling of that roster — is deleted (B-17). The nav now holds four rows: Rule set · Participants · Site facts · Author edition, each carrying `data-testid="settings-area"` and `data-area`, availability read off the entry's `route` (`site-facts` ships with `route: null` for inc-304b). I-198/I-204/I-209 are re-pointed at the layout; the pages below it render their own content and none of the frame.
