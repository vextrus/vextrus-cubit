# Design Decision — S-Audit (act log explorer, model-call ledger, job history)

`/t/{tenantSlug}/p/{projectId}/audit` and its `/models` and `/jobs` siblings are the project's
audit surfaces (R-SPINE-081, C-SPINE-PLATFORM): the recorded acts of the project, newest first,
each with its consequence and its cited evidence; the model-call ledger and the job history as
teaching empty states, since no model call or job has a store in M0. All three render inside the
shell (`docs/design/shell.md`) in `shell-main`'s centred 720 px column, under the project chrome
the participants increment decided (breadcrumb tenant / project / pane, `rail-nav-projects`
current — s-project-settings-… Interpretations 5 and 13). Token names are
`docs/design/datum-tokens.md`; anatomy is `datum-primitives.md` / `datum-patterns.md`; no colour
literal anywhere (R-UI-001).

Interpretations recorded:

1. **The screen performs no act and mints no refusal.** Reading the log is tenant membership,
   nothing more; no control here can raise a register code. Non-member, cross-tenant and unknown
   project ids answer the standard 404 the project segment layout already gives (Q-12,
   s-project-settings.md Interpretation 7). No permission-denied exists on these routes.
2. **One key per pane names it everywhere.** `project.audit.nav.acts` / `.models` / `.jobs` are
   at once the sub-nav labels, the breadcrumb pane crumbs (the layout's new `paneLabels`
   entries) and each page's h1 — one word set, three places, never drifting apart.
3. **Filters are native `<select>`s in a GET form** (the s-home Interpretation 10 /
   participants Interpretation 12 reading: a closed set's options must be in the served
   document, and Radix mounts options only while open). The URL is the whole filter state
   (R-UI-031): submitting navigates to `?type=&actor=&subject=`; an empty-valued or absent
   param means unfiltered; params AND together server-side. A param value naming nothing (a
   hand-edited URL) filters honestly — the empty outcome of §3, never an error — while the
   select, finding no matching option, shows its "all" option.
4. **Actor and subject options are the participant roster, twice.** Every M0 act's actor and
   subject are participants, and the founding grant guarantees the roster at least one row.
   Both selects list `participantRoster`'s emails in roster order (first-grant ascending, never
   reshuffling); option value = option text = the email.
5. **An entry's time is the seam's date plus the Dhaka wall-clock time.** The date renders
   through SEAM-FORMAT — `formatDate(dhakaDateParts(epochMs))`, `24 Aug 2026` — and, after one
   space, the same instant's Asia/Dhaka `HH:mm` (24-hour, zero-padded, read from the zone the
   way `dhakaDateParts` reads it — never from ambient-zone arithmetic). The seam formats no
   time of day, and an audit record whose same-day entries were indistinguishable would say
   less than the log knows. Recorded divergence: role history stamps device-local
   `YYYY-MM-DD HH:mm`; the audit surface is the record and reads the document clock.
6. **The unfiltered log is never empty** — the founding PRINCIPAL grant is always there
   (participants Interpretation 7) — so `act-log-empty` exists only as a filter outcome, and
   the models/jobs empty states are those panes' whole M0 content.
7. **Each pane's read-only region is a labelled tab stop** — `tabIndex={0}`,
   `datum-focus-ring`, `aria-label` from its pane key — the ruleset params-table precedent, so
   a keyboard reader can reach and scroll a long log and axe's scrollable-region rule stays
   green (AC-1's parenthetical).
8. **Act-type text always comes from the seam's `ACT_TYPE` names table** — entry headline,
   `data-act-type` value, filter option text and value alike; a quoted SCREAMING_SNAKE literal
   under `src/` is a Q-07 defect. Codes render mono (participants Interpretation 8).
9. **Consequence is the derived pair, said the history's way.** The `participant_roles` row
   joined on `act_id` gives role + grantee, and the sentence echoes role history's
   "{actor} set {member} to {role}" idiom in its passive half, so the same fact reads the same
   on both screens.

## 1. Layout and hierarchy

Guarded by `tenantContext(slug)` before any byte; project resolved under RLS or 404; no
`loading.tsx` exists under `/t` (shell Interpretation 4 stands). Inside `shell-main`'s centred
720 px column, padding `--space-6`. The audit segment's own layout renders first the sub-nav
(§2), `--space-6`, then the pane page: its one h1 (`--text-20` `--weight-heading`
`--graphite-950`), `--space-2`, its lead (`--text-13` `--graphite-600`), `--space-6`, content.
The act log dominates its pane; filters sit above it as one quiet row; the two empty panes are a
single centred state block each. Nothing here is a DataTable — the log is a list card read top
to bottom, the M0 idiom of role history.

## 2. The audit sub-nav (`audit-nav`)

The `project-settings-nav` idiom verbatim (s-project-settings-… §1): a `<nav>`, accessible name
`project.audit.nav`, anchors as 32 px items, `--text-13` `--weight-body-medium`, inactive
`--graphite-600`, hover `--graphite-800`, on a full-width hairline `--graphite-200`; the open
pane's anchor is `--graphite-900` with a 2 px `--cobalt-500` underline and
`aria-current="page"`. Items, in order: `audit-nav-acts` → `/audit` (current on exactly that
address), `audit-nav-models` → `/audit/models`, `audit-nav-jobs` → `/audit/jobs`. Labels are
the pane keys (Interpretation 2). The layout also hands the shell `paneLabels` entries `audit`,
`models`, `jobs` carrying the same three strings, so the breadcrumb's pane crumb names the open
pane.

## 3. Act log pane (`/audit`)

h1 `project.audit.nav.acts`; lead `project.audit.acts.lead` with the project name and, in
`--font-mono` `--text-12`, its code.

**Filter row** — a GET `<form>` addressed to the acts route, one row, gap `--space-2`, control
bottoms aligned, wrapping below `--breakpoint-sm`. Each select wears the Datum control surface
with its label `--space-1` above (`--text-12` `--graphite-600`, the field idiom):

1. `act-filter-type` — `name="type"`, label `project.audit.filter.type`, text `--font-mono`
   `--text-13` (its vocabulary is codes): first option `project.audit.filter.anyType`
   (value empty), then one option per `ACT_TYPE` name — in M0, exactly
   ASSIGN_PARTICIPANT_ROLE (Interpretation 8).
2. `act-filter-actor` — `name="actor"`, label `project.audit.filter.actor`:
   `project.audit.filter.anyActor`, then the roster emails (Interpretation 4).
3. `act-filter-subject` — `name="subject"`, label `project.audit.filter.subject`:
   `project.audit.filter.anySubject`, then the same roster emails.
4. `act-filter-apply` — a secondary Button `project.audit.filter.apply`, `type="submit"`
   (filtering is a read, not an act; Enter in any select also submits, the native form law).

Each select preselects the current URL param's value, or its "all" option when the param is
empty, absent or unmatched (Interpretation 3).

**The log** (`act-log`) — `--space-4` below the filter row: an `<ol>` in the list card surface
(background `--graphite-0`, hairline border `--graphite-200`, `--radius-8`), a labelled tab
stop per Interpretation 7 (`aria-label` = `project.audit.nav.acts`). Entries newest first, one
`<li>` per act from `actLog`, `data-testid="act-log-entry"`, `data-act-type` = the act's type
code, padding `--space-3`, hairline dividers between entries, contents stacked with `--space-2`
gap:

- **Header line**, flex, baselines aligned: left, the act type code — `--font-mono` `--text-13`
  `--weight-body-medium` `--graphite-900`, the entry's headline fact; right, the time in a
  `<time dateTime={at}>` — Interpretation 5's `24 Aug 2026 14:05` shape, `.numeric` `--text-12`
  `--graphite-600`.
- **Four definition rows**, grid, gap `--space-1`; each a 96 px label (`--text-12`
  `--graphite-600`, the ruleset pin-card metric) beside its value:
  1. `project.audit.filter.actor` — the actor's email, `--text-13` `--graphite-800`,
     single line, ellipsis.
  2. `project.audit.filter.subject` — the subject's email, same treatment.
  3. `project.audit.entry.consequence` — `data-testid="act-consequence"`:
     `project.audit.entry.setRole` with the subject email and the role code in its slots,
     `--text-13` `--graphite-800`, the role in `--font-mono` `--text-12` (Interpretation 9).
  4. `project.audit.entry.evidence` — `data-testid="act-evidence"`:
     `project.audit.entry.evidenceNone`, `--text-13` `--graphite-600` — an absence, taught,
     never a blank cell (R-UI-020; `evidence` is `readonly []` in M0).

**Filtered-empty** (`act-log-empty`) — when the filtered read returns nothing, the card body
renders the state block (patterns §6: centred column, max-width 360 px, padding `--space-8`):
title `project.audit.acts.empty.title` (`--text-14` `--weight-body-medium` `--graphite-900`),
teach `project.audit.acts.empty.teach` (`--text-13` `--graphite-600`), `--space-4`, then an
anchor `project.audit.acts.empty.clear` to the acts route with no params, styled as
EvidenceLink (underlined `--cobalt-500`, `datum-focus-ring`). The filter row stays above it
with the offending selections still shown — the reader sees what filtered everything out.

## 4. Model calls pane (`/audit/models`)

h1 `project.audit.nav.models`; lead `project.audit.models.lead`. Content: the wrapper
`model-ledger` (a labelled tab stop, `aria-label` = `project.audit.nav.models`) holding the
state block `model-ledger-empty`: title `project.audit.models.empty.title`, teach
`project.audit.models.empty.teach` — R-SPINE-081's own words: calls, cost, outcome. No action
button: nothing a reader does today creates a model call. No card surface — the bare state
block, the shell area idiom.

## 5. Job history pane (`/audit/jobs`)

Same anatomy: h1 `project.audit.nav.jobs`; lead `project.audit.jobs.lead`; wrapper
`job-history` (labelled tab stop) holding `job-history-empty`: title
`project.audit.jobs.empty.title`, teach `project.audit.jobs.empty.teach`. No action. When jobs
exist (M1, R-UI-024), the run list replaces the block inside this same wrapper.

## 6. States roster (R-UI-050)

- **loading** — nothing streams: the guard answers first and each pane renders synchronously
  from server reads (shell Interpretation 4). Were a later increment to stream, the skeleton is
  ShellAreaState's area shape.
- **empty** — §3's filtered-empty is the only empty the act log can show (Interpretation 6);
  §4 and §5 are teaching empty states by design, each naming what will appear and why nothing
  does yet (R-UI-033).
- **error** — a failed read throws into the shell boundary
  (`src/app/t/[tenantSlug]/error.tsx` → ErrorState with report id and retry, shell §6).
- **refusal** — none minted (Interpretation 1); RefusalState's anatomy stands ready for the
  ledger's later refusal-bearing rows.
- **partial** — none: `actLog` is one whole read; the seam refuses whole reads, not rows.
- **offline** — the shell's OfflineBanner above the pane; every pane is already read-only, so
  nothing further degrades. Applying a filter offline fails as a navigation, which the browser
  reports; the shown log stands.
- **permission-denied** — minted by no path: viewing is membership, outsiders get the 404
  (Interpretation 1).

## 7. Copy, verbatim

Joins `TENANT_STRINGS` in `src/app/t/strings.ts` (frozen, typed). No string literal in JSX
except test ids and codes; act-type codes reach the page only through `ACT_TYPE`
(Interpretation 8).

| Key | Value |
|---|---|
| `project.audit.nav` | Audit |
| `project.audit.nav.acts` | Act log |
| `project.audit.nav.models` | Model calls |
| `project.audit.nav.jobs` | Job history |
| `project.audit.acts.lead` | Every recorded act on {name} ({code}), newest first. Each entry shows who acted, who it concerned, what it changed and what it cited. |
| `project.audit.filter.type` | Act type |
| `project.audit.filter.actor` | Actor |
| `project.audit.filter.subject` | Subject |
| `project.audit.filter.anyType` | All act types |
| `project.audit.filter.anyActor` | All actors |
| `project.audit.filter.anySubject` | All subjects |
| `project.audit.filter.apply` | Apply filters |
| `project.audit.entry.consequence` | Consequence |
| `project.audit.entry.evidence` | Evidence |
| `project.audit.entry.setRole` | {member} was set to {role}. |
| `project.audit.entry.evidenceNone` | No evidence cited. When acts cite drawings and documents, the citations appear here. |
| `project.audit.acts.empty.title` | No acts match these filters. |
| `project.audit.acts.empty.teach` | Widen a filter, or clear them all to see every recorded act. |
| `project.audit.acts.empty.clear` | Clear filters |
| `project.audit.models.lead` | The model calls made for this project — every call, its cost and its outcome. |
| `project.audit.models.empty.title` | No model calls yet. |
| `project.audit.models.empty.teach` | When this project uses a model, each call is recorded here with its cost and its outcome. |
| `project.audit.jobs.lead` | The runs of this project's long-running work — imports, partitions, document renders. |
| `project.audit.jobs.empty.title` | No job runs yet. |
| `project.audit.jobs.empty.teach` | When this project runs a job — importing a drawing, running a partition, rendering a document — each run appears here with its outcome. |

Calm, concrete, sentence case, no exclamation marks; "recorded act" is the participants lead's
established plain-English weight; seams, tables and stores are never named on screen. The
actor/subject filter labels double as the entry rows' labels — the Bible's own two words, used
identically in both places.

## 8. Motion (R-UI-004)

None new. The panes are static served HTML; the only motion is what the composed pieces already
carry — nav-anchor and button hover per primitives, select and focus-ring behaviour per
primitives §15. Navigation between panes is instant, no transition (shell §8's law). Reduced
motion is trivially satisfied; nothing loops or moves.

## 9. Tokens

Only names already on the sheet: surfaces `--graphite-0/50`, hairlines `--graphite-200`, text
`--graphite-600/800/900/950`, `--cobalt-500` (nav underline, EvidenceLink, focus via
`datum-focus-ring`), `--cobalt-600` (link hover), type `--text-12/13/14/20` with
`--weight-heading` / `--weight-body-medium`, `--font-mono` + `.numeric` (act-type codes, role
codes, project code, times), spacing `--space-1/2/3/4/6/8`, `--radius-8`,
`--breakpoint-sm`. The 96 px entry label, 32 px nav items, 360 px state block and 720 px column
are layout dimensions, not token roles.

## 10. Both themes

Every rule reads role-stable tokens; no forked CSS under `src/app/t/**` or
`src/modules/spine/audit/**`. The list card on `--graphite-0` with hairline edges, the mono
codes at `--graphite-600`+ (the placeholder-contrast amendment's floor), the `--cobalt-500`
underline and links all carry their own dark values with contrast held by the token sheet.
Native select popups are the platform's in both themes — the control surface, not the option
list, is Datum's to paint.

## 11. Test hooks (C-05)

Routes: `/t/{tenantSlug}/p/{projectId}/audit`, `…/audit/models`, `…/audit/jobs` — each
deep-linkable by fresh GET with a session cookie, fully present in served HTML, 404 for
outsiders. Contract ids: `audit-nav`, `audit-nav-acts`, `audit-nav-models`, `audit-nav-jobs`
(§2); `act-log`, `act-log-entry` (with `data-act-type`, newest first), `act-filter-type`,
`act-filter-actor`, `act-filter-subject`, `act-filter-apply`, `act-consequence`,
`act-evidence`, `act-log-empty` (§3); `model-ledger`, `model-ledger-empty` (§4); `job-history`,
`job-history-empty` (§5). This document introduces no id beyond the contract's. URL params
`type` / `actor` / `subject`, actor and subject valued as participant emails; an `ActLogEntry`'s
`evidence` is an empty array in M0. Journey: `tests/e2e/audit.spec.ts` under the S-AUDIT title,
page object `tests/e2e/pages/audit.ts`; J-000 and J-003 untouched. Axe: scans run on each of
the three routes as served (no overlays exist here); every pane keeps a focusable, labelled
region inside `shell-main` (Interpretation 7), so the scrollable-region trap does not arise.
