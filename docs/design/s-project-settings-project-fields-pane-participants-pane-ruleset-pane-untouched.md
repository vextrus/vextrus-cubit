# Design Decision — S-Project-Settings (project fields pane + participants pane; ruleset pane untouched)

Two new panes of project settings: `/t/{tenantSlug}/p/{projectId}/settings/project` (the
R-SPINE-010 fields, edit and archive) and `/t/{tenantSlug}/p/{projectId}/settings/participants`
(R-SPINE-011: roster, assignment by act with preview → consequence, role history, last
PRINCIPAL protected — R-UI-021, J-003). Both render inside the shell in `shell-main`'s centred
720 px column. The ruleset pane at `/settings/ruleset` is untouched:
`docs/design/s-project-settings.md` governs it in full. The create form whose fields this
pane's edit form repeats is `docs/design/s-home.md` §5 ("s-home"). Token names are
`docs/design/datum-tokens.md`; anatomy is `datum-primitives.md` / `datum-patterns.md`; no
colour literal anywhere (R-UI-001).

Interpretations recorded:

1. **Edit and archive are not acts.** The most defensible L-ACT-01 reading: project metadata
   moves nothing the machine derives, so `updateProject`/`archiveProject` write directly, no
   ConsequenceDialog, no act row — and no permission check outside the seam is built: any
   member of the tenant who reaches the pane may edit and archive. RLS and the membership
   guard are the whole gate.
2. **The act dialog is composed from the Dialog primitive, per datum-patterns §9.** The frozen
   `ConsequenceDialog` (src/ui is out of ownership) carries only `{label, count}` lines and no
   refusal slot; this act's consequence is a person, two roles and one count, and the contract
   requires an in-dialog refusal (`consequence-refusal`). So the participants pane builds its
   dialog on primitives §11, keeping every §9 law verbatim — server-computed content only,
   confirm carries the displayed digest, loading confirm stays focusable, stale restatement
   keyed on digest, failed line, Escape/cancel close without confirming and clear the episode
   — and the shared ids `consequence-dialog`, `consequence-confirm`, `consequence-cancel`,
   `consequence-stale` so the pattern reads identically everywhere.
3. **The last-PRINCIPAL refusal arrives at confirm, in place.** The seam previews
   `principalsAfter: 0` honestly (a refused preview could never be shown) and its guard
   refuses the commit. The dialog therefore shows the zero like any other count, and
   `PROJECT_WOULD_HAVE_NO_PRINCIPAL` renders inside the open dialog on confirm (§6), register
   copy verbatim, confirm staying live — a re-confirm asks the server again and gets the same
   honest answer. Nothing changes; roster and history stand (J-003 checkpoint).
4. **`PERMISSION_NOT_HELD` renders as the pane's refusal block** (s-settings §5 idiom, no
   EvidenceLink — its Interpretation 3 precedent): previewing is the act's first server touch,
   so a participant without ADMINISTER_PROJECT meets the refusal below the assign row, not a
   dead control. Viewing the pane needs only tenant membership.
5. **Shell derivation for project routes** (resolving s-project-settings.md Interpretation 6;
   supersedes shell §3's tenant-only breadcrumb here and Interpretation 2's switcher copy once
   projects exist). Breadcrumb on `/p/{projectId}/…`: the tenant name as anchor to
   `/t/{slug}`, `/`, the project name as anchor to `/t/{slug}/p/{id}/settings/project`
   (`--text-13` `--graphite-600`, hover `--graphite-900`), `/`, the pane label as plain text
   (`project.settings.nav.*`). `rail-nav-projects` carries `aria-current="page"` on every
   `/p/**` route. `topbar-project-switcher`'s trigger shows the open project's name (max-width
   160 px, ellipsis) instead of `shell.topbar.project.none`; its Popover body is
   `shell.topbar.project.current` with the name in the slot, action link unchanged; with no
   project open the body is the re-worded `shell.topbar.project.empty` (⊙ §8).
6. **Non-member, cross-tenant and unknown project ids answer the standard 404** and no
   permission-denied is minted for viewing (s-project-settings.md Interpretation 7, Q-12).
7. **Roster and history are never empty** — the founding grant guarantees one PRINCIPAL row
   and one history entry; no empty copy exists for either list.
8. **Roles render as verbatim mono codes** (`PRINCIPAL`, `MEASURER`, …) — identifiers from a
   closed set, the s-settings §2 treatment. Human sentences never inflect them.
9. **The sft conversion is pinned:** sft = m² ÷ `0.09290304` (0.3048², the exact ft–m
   definition), computed in decimal.js, rounded half-up to the nearest whole sft, the integer
   grouped through `formatNumber(…, 'count')` (L-FMT-01). 1000 → `10,764 sft`. No float
   anywhere (B-07).
10. **An archived project stays editable.** Archive changes visibility on S-Home, not
    writability; the same control restores it.
11. **The pane nav is a layout, not a component each pane renders** (recorded by the build,
    inc-014). §1's nav sits above all three panes including the ruleset pane, which is
    otherwise untouched; a nav every pane had to import would be a nav the next pane forgets.
12. **The two assign Selects are native `<select>`s wearing the Datum control surface**, the
    same reading s-home Interpretation 10 records: a closed set's options have to be in the
    document the server sends, and a Radix Select mounts its options only while it is open.
13. **The project's chrome is drawn by the project's own layout.** A Next layout is handed the
    dynamic params of the segments above it and no deeper, so a single layout at
    `/t/{tenantSlug}` cannot know which project is open — and Interpretation 5 needs the name.
    The workspace areas therefore sit in an `(area)` route group with a layout of their own and
    `/p/{projectId}` has a sibling one; the group names no URL segment, so every address
    R-UI-031 fixed is exactly where it was. Both draw the same frame; only what they tell it
    about the open project differs.

## 1. Pane frame (both routes)

Guarded by `tenantContext(slug)` before any byte; project resolved under RLS or 404. Wrapper
per pane (§2, §4). First, the pane nav `data-testid="project-settings-nav"` — a `<nav>`,
accessible name `project.settings.nav`, the Tabs visual idiom rendered as anchors (these are
routes, not panels): 32 px items, `--text-13` `--weight-body-medium`, inactive
`--graphite-600`, hover `--graphite-800`, on a full-width hairline; the open pane's anchor is
`--graphite-900` with a 2 px `--cobalt-500` underline and `aria-current="page"`. Items, in
order: `project.settings.nav.project` → `/settings/project`, `.participants` →
`/settings/participants`, `.ruleset` → `/settings/ruleset` — this nav is how J-003 reaches
the pin (its "pin visible" checkpoint). The ruleset pane gains the nav above its existing
content; nothing else there changes. Below the nav, `--space-6`, the pane's one h1
(`--text-20` `--weight-heading` `--graphite-950`), `--space-2`, its lead (`--text-13`
`--graphite-600`), `--space-6`, content.

## 2. Fields pane (`project-settings-fields`)

Wrapper `data-testid="project-settings-fields"`. h1 `project.fields.title`; lead
`project.fields.lead` with the name and, in `--font-mono` `--text-12`, the code.

**Status row** — one 36 px row above the form: label `project.fields.status` (`--text-12`
`--graphite-600`), `--space-2`, `data-testid="project-status"`: a neutral Badge,
`project.home.status.active` / `.archived` (s-home §8), `data-status` attribute. Right-aligned,
`data-testid="project-archive"`: a secondary Button — `project.fields.archive` when active,
`project.fields.restore` when archived (one id, the state names the action). Click enters
loading, calls `archiveProject` (or the restore), re-renders the row and announces
`project.fields.archivedDone` / `.restoredDone` in a visually hidden `role="status"` region.
While archived, an info line (`--text-13`, `--info`, background `--info-surface`, padding
`var(--space-2) var(--space-3)`, `--radius-4`, `role="status"`) renders below the row:
`project.fields.archivedNote`.

**The form** — s-home §5's fields verbatim: same order, labels, pairing, test ids
(`project-field-*`), validation rules and error copy, prefilled with the saved values;
building type shows the saved option or its placeholder when unset. One addition: directly
under the GFA field, `data-testid="project-gfa-sft"` (`--text-12` `--graphite-600`, value in
`.numeric`): `project.fields.gfaSft` with the Interpretation 9 conversion of the **saved**
value in the slot — e.g. `≈ 10,764 sft` — or `project.fields.gfaSftNone` when no GFA is
saved (silence is never lawful). The footer replaces s-home's: right-aligned,
`data-testid="project-save"`, a primary Button `project.fields.save`, `type="submit"` so that
Enter in any field saves (s-home §5's rule, same reason). Save enters loading,
calls `updateProject`; success re-renders the saved values (the sft line follows) and shows
`project.fields.saved` — `role="status"`, `data-testid="project-saved"`, `--text-13`
`--success`, fading in over `--motion-state-duration`; the next edit clears it. A request
that never completes renders `project.form.failed` in the s-home §5 alert idiom
(`project-form-error`). Those two are the whole outcome set: **this pane mints no refusal
block.** Neither saving nor archiving is an act (Interpretation 1), so nothing on the path can
raise a code from the register — and `participants-refusal` is §7's id, belonging to the other
pane. A block here would be unreachable markup wearing a name that is already spoken for.

## 3. Participants pane frame (`participants-pane`)

Wrapper `data-testid="participants-pane"`. h1 `project.participants.title`; lead
`project.participants.lead`. Stacked: the assign row (§4), `--space-4`, the roster (§4),
`--space-8`, role history (§5).

## 4. Assign and roster (R-SPINE-011)

**Assign row** — one row, gap `--space-2`, bottoms aligned; stacks below `--breakpoint-sm`.
Labels `--space-1` above controls (the field idiom):

1. `participant-assign-member` — Select (Interpretation 12), label
   `project.participants.member`, one option per
   tenant member (from `listMembers`, membership order), option text the email; preselected:
   the first member who is not the reader.
2. `participant-assign-role` — Select (Interpretation 12), label `project.participants.role`,
   160 px, six options
   `PRINCIPAL`, `MEASURER`, `REVIEWER`, `LEAD`, `ESTIMATOR`, `BID_MANAGER` (the vocabulary,
   verbatim, mono per Interpretation 8); `MEASURER` preselected — no placeholder ever shows.
3. `participant-assign` — a primary Button `project.participants.assign`. Click enters
   loading, calls the acts router's preview; on answer the dialog (§6) opens.
   `PERMISSION_NOT_HELD` → the refusal block (§7) below this row. A request that never
   completes → the error line (§8).

**Roster** (`participants-roster`) — the list card (background `--graphite-0`, hairline border
`--graphite-200`, `--radius-8`, hairline row dividers), one 36 px row per participant from
`participantRoster`, first-grant time ascending (the founder first, never reshuffling). Each
row (`data-testid="participant-row"`, `data-email`, `data-role`): the email (`--text-13`
`--graphite-800`, ellipsis); the reader's own row adds a neutral Badge
`project.participants.you` after it; right-aligned, the current role code, `--font-mono`
`--text-12` `--graphite-700`. Rows are display only — assignment goes through the act, so the
controls live in the assign row, not the rows.

## 5. Role history (`role-history`)

`<h2>` `project.participants.historyTitle` (`--text-16` `--weight-heading` `--graphite-950`),
`--space-3`, the list card holding an `<ol>` `data-testid="role-history"` of every
`ASSIGN_PARTICIPANT_ROLE` act on the project from `roleHistory`, newest first. Each `<li>`
(`data-testid="role-history-entry"`, 36 px, padding `0 var(--space-3)`, hairline dividers):
left, `project.participants.historyEntry` with actor email, member email and the mono role
code in its slots (`--text-13` `--graphite-800`, emails ellipsized); right, the act's time,
device-local `YYYY-MM-DD HH:mm`, `.numeric` `--text-12` `--graphite-600`. The founding grant
reads like any other entry: the creator assigned themselves PRINCIPAL (Interpretation 7).

## 6. The consequence dialog (R-UI-021, L-ACT-02)

Opened only with a preview in hand. A Dialog (primitives §11); inner wrapper
`data-testid="consequence-dialog"`. Title: `project.participants.dialogTitle` with the role
code and email in its slots, then a DialogDescription `project.participants.dialogLead` — a
modal is named by its title *and* says what it is for, and a Dialog without a Description is
one Radix itself complains about. Below, `data-testid="consequence-summary"` — the server's
typed consequence and nothing computed by the UI. **Every row carries
`data-testid="consequence-line"`** (datum-patterns §9, verbatim: one per consequence row), so
a scan that knows the pattern reads this act's lines like any other's:

1. Three definition rows (28 px, hairline dividers; 120 px label `--text-12` `--graphite-600`;
   values `--text-13` `--graphite-900`): `project.participants.summary.person` — the email;
   `.current` — the current role code in mono, or `project.participants.summary.currentNone`
   when `currentRole` is null; `.proposed` — the proposed role code in mono.
2. One count line (patterns §9 anatomy): label `project.participants.summary.principals`
   left, `principalsAfter` right in `.numeric` `--graphite-900` through the count seam —
   including an honest 0 (Interpretation 3).

Footer, right-aligned, gap `--space-2`: secondary Button `project.participants.cancel`
(`consequence-cancel`), primary Button `project.participants.confirm` (`consequence-confirm`).
Confirm enters loading (`aria-busy`, focusable) and commits carrying exactly the displayed
digest. Outcomes:

- **Committed** — the dialog closes; the roster row updates (or appears), history gains its
  entry, and a visually hidden `role="status"` region announces
  `project.participants.committed`.
- **`CONSEQUENCES_NOT_CARRIED`** — the pane re-runs the preview and restates the open dialog
  from it: every changed line takes `data-changed` on its row (background `--warn-surface`,
  `--motion-state-duration` fade) and `data-testid="consequence-stale"` on the value that
  moved, in `--warn` — the pattern's own anatomy, where the row is the line and the mark sits
  on the fact that changed, so a row is never made to wear two ids. A restatement where two
  facts moved marks two values (R-UI-021's plural; arbitration of 2026-08-24). A
  `role="status"` line in `--warn` `--text-13` above the summary renders
  `project.participants.stale`, and the next confirm carries the new digest (§9 law, kept).
- **`PROJECT_WOULD_HAVE_NO_PRINCIPAL`** — `data-testid="consequence-refusal"`, a
  `role="alert"` block between summary and footer, `--motion-state-duration` fade:
  RefusalState's anatomy without the EvidenceLink (Interpretation 4 precedent) — the code
  (`refusal-code`, mono `--text-12` `--graphite-600`), `REFUSALS` message (`refusal-message`,
  `--text-13` `--graphite-900`) and remedy (`refusal-remedy`, `--text-13` `--graphite-600`)
  verbatim: "This would leave the project with no principal, and every project must have
  one." / "Assign another participant as principal first, then change this one." Confirm
  stays live (Interpretation 3).
- **Never answered** — confirm leaves loading; a `role="alert"` line
  `project.participants.failed` in `--danger` `--text-13` above the summary; same digest next
  time.

Cancel, Escape, scrim and the close button close without confirming; closing clears stale
marks, refusal and failure — a reopened dialog starts from a fresh preview.

**Focus on the way out.** This Dialog is controlled by the open preview and has no
`DialogTrigger` above it, so Radix restores focus to a trigger that does not exist and drops
the reader on `<body>` — the whole shell to tab through again to get back to where they were.
Every exit — Escape, the scrim, Cancel, the corner close, and the commit that closes the
surface itself — prevents that default and gives focus back to `participant-assign`, the
control the dialog was opened from (R-UI-060, WCAG 2.4.3; the same law s-home Interpretation 8
states for the create surface). Neither axe nor the journey's `toBeHidden` can see this, so it
is claimed in a component test beside the pane.

## 7. Refusal block and 8. states (R-UI-050)

**`participants-refusal`** — s-settings §5's block verbatim (role="alert", `--graphite-50`,
`refusal-code/-message/-remedy`, register copy, no EvidenceLink), below the assign row. Codes
reaching it: `PERMISSION_NOT_HELD` (Interpretation 4). At most one; the next act or
navigation clears it.

- **loading** — nothing streams (shell Interpretation 4); both panes render server-side.
  In-flight writes use the primitives' busy states.
- **empty** — fields form shows saved emptiness per field; roster and history are never empty
  (Interpretation 7); unset GFA answers `project.fields.gfaSftNone`.
- **error** — render failures hit the shell boundary; a write that never completes renders
  `project-form-error` (§2) or, on participants, `data-testid="participants-error"`
  (`role="alert"`, `--text-13` `--danger`, copy `project.form.failed`) below the assign row.
- **refusal** — §6 in-dialog, §7 in-pane; never a toast, always code + remedy in place
  (R-UI-020).
- **partial** — none minted: whole reads, whole refusals. PartialNotice stands ready.
- **offline** — the shell's OfflineBanner; panes stay readable; writes fail into their error
  lines.
- **permission-denied** — minted by no path (Interpretation 6): viewing is membership, and
  the act's denial is the seam's named refusal, which is the better answer.

## 8. Copy, verbatim

Joins `TENANT_STRINGS`; switcher keys join `SHELL_STRINGS`. ⊙ = existing key re-worded.

| Key | Value |
|---|---|
| `project.settings.nav` | Project settings |
| `project.settings.nav.project` | Project |
| `project.settings.nav.participants` | Participants |
| `project.settings.nav.ruleset` | Rule set |
| `project.fields.title` | Project |
| `project.fields.lead` | The details of {name} ({code}). Documents cite the project by them; measurements never read them. |
| `project.fields.status` | Status |
| `project.fields.archive` | Archive project |
| `project.fields.restore` | Restore project |
| `project.fields.archivedDone` | Project archived. |
| `project.fields.restoredDone` | Project restored. |
| `project.fields.archivedNote` | This project is archived and stays off the workspace home. Restore it to bring it back. |
| `project.fields.gfaSft` | ≈ {sft} sft |
| `project.fields.gfaSftNone` | No target GFA set. |
| `project.fields.save` | Save changes |
| `project.fields.saved` | Changes saved. |
| `project.participants.title` | Participants |
| `project.participants.lead` | The people on this project and the roles they hold. A role is assigned by a recorded act; the history below is that record. |
| `project.participants.member` | Member |
| `project.participants.role` | Role |
| `project.participants.assign` | Preview assignment |
| `project.participants.you` | You |
| `project.participants.dialogTitle` | Assign {role} to {email} |
| `project.participants.dialogLead` | The server worked out what this assignment would do. Confirming applies exactly what is shown below. |
| `project.participants.summary.person` | Participant |
| `project.participants.summary.current` | Current role |
| `project.participants.summary.currentNone` | Not a participant yet |
| `project.participants.summary.proposed` | Proposed role |
| `project.participants.summary.principals` | Principals after this change |
| `project.participants.cancel` | Cancel |
| `project.participants.confirm` | Confirm |
| `project.participants.stale` | The preview changed while this dialog was open. Review the updated values; confirming applies what is shown now. |
| `project.participants.failed` | This could not be confirmed — the request did not complete. Nothing was changed. Try confirming again. |
| `project.participants.committed` | Role assigned. |
| `project.participants.historyTitle` | Role history |
| `project.participants.historyEntry` | {actor} set {member} to {role} |
| `shell.topbar.project.current` | You are working in {name}. |
| ⊙ `shell.topbar.project.empty` | No project is open. Choose one from the Projects list. |

Calm, concrete, sentence case, no exclamation marks; seams, acts-as-machinery and tables are
never named on screen — "recorded" is the plain-English weight of the act log. Refusal copy is
the register's, never paraphrased.

## 9. Motion, tokens, both themes

Motion: refusal/error/saved/stale arrivals fade over `--motion-state-duration` with
`--motion-ease`; the dialog and Selects move per primitives §15; row updates are instant
reflows. Reduced motion: token durations zero; nothing loops. Tokens — only sheet names:
surfaces `--graphite-0/50/100`, hairlines `--graphite-200`, text `--graphite-600/700/800/900/
950`, `--cobalt-500` (nav underline, focus), `--success`, `--info`/`--info-surface`,
`--warn`/`--warn-surface`, `--danger`, type `--text-12/13/16/20` with weights, `--font-mono` +
`.numeric` (codes, roles, counts, times, sft), spacing `--space-1/2/3/4/6/8`, `--radius-4/8`,
36 px rows, `--breakpoint-sm`. The 120/160 px widths are layout dimensions. Both themes:
role-stable tokens throughout, no forked CSS under `src/app/t/**`; the warn/info/success
surfaces and mono floors hold contrast per the sheet.

## 10. Test hooks (C-05)

Routes: `/t/{tenantSlug}/p/{projectId}/settings/project` and `…/settings/participants`
(fresh-GET deep links; 404 for outsiders); `…/settings/ruleset` untouched but gaining the
§1 nav. Contract ids: `project-settings-fields`, `project-status` (with `data-status`),
`project-gfa-sft`, `project-save`, `project-archive`, the shared `project-field-*` +
`project-form` ids (s-home §5), `participants-pane`, `participants-roster`, `participant-row`
(`data-email`, `data-role`), `participant-assign`, `consequence-dialog`,
`consequence-summary`, `consequence-confirm`, `consequence-stale`, `consequence-refusal`,
`role-history`, `role-history-entry`. Introduced here: `project-settings-nav` (§1),
`project-saved` (§2), `participant-assign-member`, `participant-assign-role` (§4),
`consequence-cancel` (§6, the patterns name), `participants-refusal`, `participants-error`
(§7) — with `refusal-code/-message/-remedy` inside both refusal surfaces. Journey: J-003
(`tests/e2e/j-003-projects.spec.ts`, page object `tests/e2e/pages/projects.ts`). Axe: scans on
the participants pane run with Selects closed and the dialog closed, and separately with the
dialog open (a Dialog brings no overlay axe rule); animations settle first; both panes keep
focusable content inside `shell-main`, so the scrollable-region trap does not arise.
