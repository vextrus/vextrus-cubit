# Design Decision — shell top bar (the jobs tray occupant)

The frame's top bar, `ShellTopBar` (`src/ui/shell/shell-top-bar.tsx`, `data-testid="shell-topbar"`),
on every `/t/{tenant}/**` address. Increment inc-112-job-timeline. This Decision amends
`docs/design/shell.md` §1's top bar for one occupant R-UI-030 names and the shell shipped absent —
the **jobs tray** (`src/ui/shell/jobs-tray`, exported from the `src/ui/shell` barrel) — and rules
nothing else about the bar: breadcrumb, user menu, height, ground and hairline stand exactly as the
shell Decision left them. Law: R-UI-004/005/010/011/012/020/024/030/050/060, C-SPINE-JOBS, J-010,
B-17, B-19, B-20, Q-11. Every convention of the earlier Decisions binds: `cx-` classes, tokens-only
colour and motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in authored
CSS; Interpretations I-1–I-114 remain in force. The tray's step vocabulary, colour map, timing rule
and string table are `docs/design/job-timeline.md`'s and are cited, never re-decided, here. Copy lives
in `src/ui/strings/job-timeline.ts`; JSX carries no string literal beyond test ids and fixed attribute
values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-115 — shell I-15 is amended: the jobs tray's owner has arrived.** I-15 ruled that the bar's
  milestone-gated occupants — ⌘K, the jobs tray, notifications — ship absent until the increment that
  owns them lands, and that nothing reserves space for them. This is that increment for the tray, so
  the tray is now a permanent occupant of the bar: R-UI-030 lists it among the frame's parts, and
  R-UI-050 requires an empty state that teaches rather than a control that appears out of nowhere the
  first time a job runs. ⌘K and notifications remain absent under I-15 unchanged. Rejected: rendering
  the trigger only while jobs exist — it would spare every committed baseline, and leave the frame
  without the occupant the law names, with a control that materialises mid-task.
- **I-116 — the tray is provider-gated, not route-gated.** `JobsTray` renders `null` when `useJobs()`
  answers `null` (outside a `JobsProvider`), which is the whole of its guard: the provider is mounted
  once, in `src/app/(app)/t/[tenant]/shell-frame.tsx`, so the tray stands on every in-frame screen and
  nowhere else — not on `/sessions`, not on accept-invitation, not on a bare mount of `ShellTopBar` in
  a test or a gallery sample that lacks a provider. A route allow-list inside the tray would be a second
  home for a fact the frame already states by construction (B-17).
- **I-117 — the count is a decorative duplicate of the panel's own list.** The trigger's accessible
  name is exactly `strings.jobs_tray_label`, and its visible text is the number of tracked jobs. A
  visible numeral that the accessible name does not contain is what axe grades `label-content-name-mismatch`
  at **serious** impact, which Q-11 admits at no checkpoint, so the numeral carries `aria-hidden="true"`:
  it is a glance affordance for the eye, and the same information reaches assistive technology as words
  — one item per job, each with its kind, status and timing — the moment the panel opens. The count also
  stands on `data-count` for machines.
- **I-118 — `aria-haspopup="dialog"` is the contract's fixed attribute over a non-modal popover.** The
  panel is the shipped Popover with `modal` off and no `role="dialog"`: the modal treatment marks the
  rest of the frame `aria-hidden` while its links stay focusable, the serious `aria-hidden-focus` finding
  the shell's two menus already refuse (shell §1). The attribute announces the weight of what opens; the
  state a reader needs travels on `aria-expanded` and `aria-controls`, which the primitive sets. Recorded
  because the pair is deliberate and would otherwise read as a slip.
- **I-119 — the top bar announces nothing; the running words live where the work was started.** R-UI-060
  asks for live regions on job status, and the inline timeline's per-step status words are them
  (job-timeline §1). A live region in the frame would speak every frame of every job over whatever the
  person is actually reading, on every screen. The trigger's count and state change silently; the panel's
  content is read when it is opened.
- **I-120 — the tray holds the jobs this tab tracked, and says so.** The job log carries no workspace
  column, so a "jobs of this workspace" query does not exist and is out of scope; what the tray can
  honestly show is what `useTrackedJobs` registered under the frame's provider. The provider survives
  every in-frame navigation, so a job started on the drawings screen is still listed after a move to
  Settings; a hard reload empties the tray (recorded IOU, owner: the increment that gives the tray a
  durable store — `sessionStorage` or a workspace query). The heading and the empty line therefore say
  *in this tab* rather than implying a complete record.

## 1. Layout and hierarchy

**The bar.** Unchanged: `<header class="cx-shell-topbar" data-testid="shell-topbar">`, height
`var(--space-12)`, fill `var(--graphite-0)`, border-bottom `var(--hairline)`, padding-inline
`var(--space-5)`, flex, space-between. Its right-hand child is now a cluster,
`<div class="cx-shell-topbar-end">` — inline flex, `align-items: center`, gap `var(--space-3)` —
holding, in this document and tab order: **`<JobsTray />`**, then the user menu exactly as shell §1
rules it. Breadcrumb, ground and hairline are untouched, and no space is reserved for any other
occupant (I-115).

**Trigger.** The shipped Popover's trigger rendered `asChild` over the core ghost Button, so the bar
restyles no primitive (B-17):

```
<button class="cx-btn cx-jobs-tray-trigger cx-reticle" data-variant="ghost"
        data-testid="shell-jobs-tray" aria-haspopup="dialog"
        aria-label={strings.jobs_tray_label} data-count={String(count)} data-state=…>
  <span class="cx-jobs-tray-dot" aria-hidden="true" />
  <span class="cx-jobs-tray-count" aria-hidden="true">{count}</span>
</button>
```

Height `var(--space-8)` and padding-inline `var(--space-3)` come from the Button; the row is inline
flex, gap `var(--space-2)`. The dot is the timeline's 8 px marker geometry and colour map keyed on
`data-state` — `idle` `var(--graphite-300)` · `running` `var(--beam-500)` · `done` `var(--success)` ·
`failed` `var(--danger)` (job-timeline §1) — presentation, not meaning: the words are one activation
away, in the panel, and colour never stands alone as information (refusal-state I-9, R-UI-060). The
count is `var(--font-mono)` `var(--text-12)` `var(--graphite-700)` `tabular-nums slashed-zero`.
`data-state` is derived exactly as the timeline's, from the one register (`useJobs().state`), so a
tray and an inline timeline over the same jobs can never disagree.

**Panel.** The shipped `PopoverContent`, portalled where the bar's user menu portals — `document.body`,
with the shell's I-22 reading of axe's moderate `region` finding standing unchanged — `align="end"`,
the primitive's own `sideOffset`, card chrome, `var(--shadow-2)`, padding `var(--space-4)`, its own
280 px measure (core I-1's tooltip measure; nothing here widens a primitive). Inside, column flex,
gap `var(--space-3)`:

- `<h2 class="cx-jobs-tray-heading">` `strings.jobs_tray_heading`, `var(--text-13)`
  `var(--weight-heading)` `var(--graphite-900)`, margin 0; the content is labelled by it.
- `<ol class="cx-jobs-tray-list" data-testid="shell-jobs-tray-panel">` — list-style none, margin 0,
  padding 0 — holding one item per tracked job, **newest first** by `startedAt`. A timeline is a chain
  read downward, so it runs oldest first; a tray is a log, where the job just started is the one being
  looked for.
- `<li data-testid="shell-jobs-tray-item" data-job data-kind data-status>` — grid, marker column
  `auto` spanning both rows then a `1fr` text column, column gap `var(--space-3)`, row gap
  `var(--space-1)`, min-height `var(--row-comfortable)` re-keyed `var(--row-compact)` under
  `[data-density="compact"]` (R-UI-005), padding-block `var(--space-2)`, and `border-top
  var(--hairline)` on every item but the first. The marker is the trigger's dot at the step's own
  status colour. Line one is the kind word `strings.job_step_<kind>`, `var(--text-13)`
  `var(--graphite-900)`. Line two is the status word `strings.job_status_<status>` (`var(--text-12)`
  `var(--weight-body-medium)`, colour matching the marker) then the timing verbatim in
  `var(--font-mono)` `var(--text-12)` `var(--graphite-600)` `tabular-nums slashed-zero`, gap
  `var(--space-2)`; a running job with no timing yet holds the timeline's 12 × 64 px core Skeleton in
  the timing's place instead of digits.
- Empty: in the list's place, `<p data-testid="shell-jobs-tray-empty">` `strings.jobs_tray_empty`,
  `var(--text-13)` `var(--graphite-600)`, `text-wrap: pretty`, and no `<li>` at all.

No refusal card, no fault id and no evidence link renders in the panel: a refused or failed job is
answered in place, where it was started, by the inline timeline's own row (R-UI-020, job-timeline
§1) — the tray says which job stands how and takes the reader there; two answers to one refusal in
one frame is the second dialect B-17 forbids. The panel holds no control beyond its own dismissal:
no retry, no cancel, no clear (out of scope, and each is an act that owes a consequence).

## 2. States (R-UI-050), ruled cell by cell

Declared, not asserted in prose: the `jobs-tray` row of `JOB_TIMELINE_STATES`
(`src/ui/patterns/job-timeline/states.ts`, job-timeline §3), walked by
`tests/ui/job-timeline/state-matrix.test.ts`. `SHELL_STATES` gains no row — its rows are the shell's
screens, and the tray is an occupant of the frame; only its top-bar wording is amended to name the
tray as delegated here (I-115).

- **Loading** — never a skeleton of the tray: the register answers synchronously from what this tab
  tracked (I-120), so the trigger renders its true count at first paint. A job whose timing has not
  arrived shows the Skeleton bone in its item's timing cell (§1).
- **Empty** — `shell-jobs-tray-empty`, the panel's own teaching line, naming where a job comes from
  (§3). The trigger is present and reads `0`; the tray is never hidden to hide its emptiness.
- **Error** — a failed job stands in the list as `Failed` with its timing; its fault id, evidence link
  and the way to try again are the inline timeline's error cell (job-timeline I-110, §3). A render fault
  of the frame is the root error boundary's, unchanged.
- **Refusal** — a refused job stands in the list as `Refused`; the code, message, remedy and evidence
  are rendered by the one RefusalState in the timeline that started it (§1's last paragraph).
- **Partial** — rendered, never hidden: succeeded, running and refused items stand in one list, and a
  transport lost on one job leaves every other item's reading standing (job-timeline I-111).
- **Offline** — no banner in the frame: the tray holds no data of its own that ages, and a job whose
  stream is gone keeps its last status while the screen that started it says so in words (shell I-20,
  s-drawings I-89).
- **Permission-denied** — impossible, with the reason recorded: the tray lists the jobs this tab
  started under this session (I-120, job-timeline I-114). A workspace the session does not hold never
  reaches the frame at all (shell I-17).

## 3. Copy, verbatim

The three keys the tray renders, fixed in `docs/design/job-timeline.md` §4 and repeated here as they
stand — one table, one home (`src/ui/strings/job-timeline.ts`):

`jobs_tray_label` **Jobs** · `jobs_tray_heading` **Jobs started in this tab** · `jobs_tray_empty`
**No job has run in this tab yet. Add a drawing to a project and its progress appears here.**

The item's kind and status words are `job_step_*` / `job_status_*`, unchanged from the timeline's, so
one job reads identically in both surfaces. Voice: calm, concrete, professional; the empty line says
what is true and names the one thing that starts a job today, without a control the tray cannot
honestly offer (it knows no project). No exclamation marks, no build vocabulary: the tray never says
*queue*, *worker*, *stream* or *poll*.

## 4. Motion (R-UI-004)

The panel is the shipped Popover's entrance — opacity 0 → 1 with a 2 px rise over
`var(--motion-state)` `var(--ease)`, exit instant — from its single home; nothing here restyles it.
The trigger's dot and the item's status colour transition over `var(--motion-state)` `var(--ease)`;
the count changes with no animation — a number that counts up draws the eye away from the work. No
badge pulse, no bounce, no spinner. Items appearing and leaving the list are untweened. Every
duration is a token zeroed at source under reduced motion, so the tray's rules carry no
`prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-0/300/600/700/900` · `--beam-500` · `--success` · `--danger` · `--hairline` ·
`--space-1/2/3/4/5/8/12` · `--text-12/13` · `--font-mono` · `--weight-body-medium`/`--weight-heading` ·
`--row-comfortable`/`--row-compact` · `--motion-state`/`--ease`; the panel's fill, radius and shadow
are the Popover's own token reads. Px literals, closed set (core I-1's class): the 8 px dot and the
12 × 64 px timing bone, both already in job-timeline §6's set. Any other literal is a defect. No
copper: a job is not an act.

## 6. Themes

The tray's rules live in `src/ui/shell/shell.css` and `src/ui/shell/jobs-tray/*.css` and contain no
`[data-theme]` selector; every light/dark difference arrives through token values (R-UI-001). Contrast
holds on the founder values in both themes: graphite-700 count and graphite-900 kind words on
graphite-0 clear 4.5:1, graphite-600 timings and the empty line clear 4.5:1, and the dot's four
colours clear the 3:1 UI floor. The panel's `var(--graphite-0)` fill against the dark ground is
separated by the primitive's own hairline, and inherits the overlay Decision's recorded IOU about
that border verbatim — nothing here keeps a corrected copy of it.

## 7. Test hooks (closed contract, C-05)

Routes introduced: none — the tray stands on every existing `/t/{tenant}/**` address. Test ids,
exactly these four, on the elements ruled in §1: `shell-jobs-tray` (the trigger, `data-count`,
`data-state`, `aria-haspopup="dialog"`) · `shell-jobs-tray-panel` (the list inside the open popover) ·
`shell-jobs-tray-item` (`data-job`, `data-kind`, `data-status`) · `shell-jobs-tray-empty`.
`shell-topbar` exists already; no other id is added, and the panel heading is found by role and name.

Behavioural hooks without new ids: `aria-expanded`/`aria-controls` on the trigger from the primitive;
`aria-hidden` on the dot and the count (I-117); `cx-reticle` on the trigger; the absence of any
`shell-jobs-tray` element when `ShellTopBar` is mounted outside a `JobsProvider` (I-116); the
Skeleton's own id in an item's timing cell; `data-state` on the trigger equal to the inline timeline's
`data-state` over the same jobs. Suites: `src/ui/shell/shell-top-bar.test.tsx` (bare mount — no tray)
and `tests/ui/job-timeline/**` under jsdom drive the tray inside a provider with a test `format`, open
it with `user-event`, and assert the ordering, the count, the empty line and the derived state.

Journey (J-010, `tests/e2e/journeys/j-010-upload.spec.ts`, page objects
`tests/e2e/pages/shell.page.ts` and `s-drawings.page.ts`): new checkpoint **j-010-jobs-tray-open** —
`shell-jobs-tray[data-count="2"][data-state="done"]` in the bar, opened, `shell-jobs-tray-panel`
listing the ingest and thumbnails items both `succeeded`, captured as
`tests/e2e/baselines/design/job-timeline-tray-open.png` with the timing cells masked, axe
serious/critical = 0, never widened (Q-11).

Re-baselines this occupant owes (B-20 — every full-frame picture now shows the tray), each generated
by its own journey and committed in its own `baseline:` commit naming the proof:
`shell-light.png` · `shell-dark.png` · `shell-tenant-switcher-open.png` · `shell-user-menu-open.png`
(J-004 and J-003 both write these names) · `j-001-auth/*.png` (in-frame pictures only —
`accept.png` is outside the frame and moves only if it differs) · `j-002-tenant-admin/*.png` ·
`j-003/*.png` · `s-audit/explorer.png` · the shared `j-000/*.png`. `pnpm e2e --journey J-000` exits 0
with the Golden Path otherwise unchanged; the gallery's `gallery-shell-*.png` capture the gallery
header alone and do not move.
