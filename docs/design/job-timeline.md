# Design Decision — job-timeline (the R-UI-024 job pattern)

Not a routed screen: the one job pattern in `src/ui/patterns/job-timeline` — the presentational
`JobTimeline`, the register `JobsProvider` / `useTrackedJobs` / `useJobs`, its stylesheet
`job-timeline.css` (`cx-job-timeline-*`) and its string table `src/ui/strings/job-timeline.ts`.
Increment inc-112-job-timeline. Law: R-UI-001/003/004/005/010/011/012/020/024/030/050/060,
C-SPINE-JOBS, X-1, J-010, B-17, B-19, B-20, Q-11, Q-17, ARCH-01. Two surfaces read the same
register: the **inline timeline**, rendered where the operation was started (S-Drawings today,
`docs/design/s-drawings.md` §timeline now pointing here), and the **global jobs tray** in the top
bar, whose chrome is ruled in `docs/design/shell-top-bar.md`; this file rules the reading both
surfaces share, the step row, the colour map, the copy and the motion. Every convention of the
earlier Decisions binds: `cx-` classes, tokens-only colour and motion, `cx-reticle` solely from its
single home, no `[data-theme]` selector in authored CSS; Interpretations I-1–I-106 remain in force
(core I-1 geometry constants in px, core I-2 no `transparent`, s-drawings I-92 whole-second
timings, refusal-state I-9 severity colour is presentation). Chrome comes only from shipped
primitives — the core Skeleton, the one RefusalState — plus the classes this file rules.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-107 — one timeline, one home, the same ids.** S-Drawings shipped
  `drawings/job-timeline.tsx` with the ids J-010 asserts. Leaving it beside the pattern is the
  byte-copied primitive B-17 calls a blocking defect, so the route file is retired: `job-timeline`,
  `job-timeline-step` and their data-attributes keep their names and meanings, the `cx-drawings-step*`
  and `cx-drawings-marker` rules move into `job-timeline.css` as `cx-job-timeline-*`, and the step /
  status / idle / seconds / transport-lost keys leave `drawings/strings.ts` for the pattern's table.
  The heading stays the consumer's own copy (`drawings_timeline_heading`): a shared component may not
  name a screen's region for it.
- **I-108 — the seam's words are not the screen's words, and the mapping has exactly one home.**
  `/api/events` emits `started | progress | succeeded | refused | failed`; the screen shows
  `queued | running | succeeded | failed | refused`. The retired route file accepted only the screen's
  five, so a `started` frame matched nothing and **`running` never once appeared** — a latent defect
  recorded here, not repaired in place: the register maps no event yet → `queued`, `started`/`progress`
  → `running`, the three terminal words verbatim, and an `event: fault` frame → `failed` carrying its
  `faultId`. Nothing downstream of the register knows the seam's vocabulary.
- **I-109 — `done` is a claim about a chain, so the consumer says when the chain is whole.**
  A generic "every step succeeded" reads `done` after the ingest alone, before the worker's chained
  thumbnails job has been asked for (s-drawings I-88), which would let a journey photograph a
  half-finished timeline. `JobTimeline` therefore takes `awaiting`, and while it is true the state is
  `running` however well the present steps have gone. S-Drawings sets it until a `thumbnails` step is
  among the steps. The pattern invents no chain of its own — a component cannot know which kinds
  follow which.
- **I-110 — a fault is not a refusal, and neither is answered with silence.** A refused step carries a
  registered entry and renders the one RefusalState (R-UI-020). A failed step carries a fault id and no
  registered code: fabricating a refusal card for it would put a sentence in a person's mouth that the
  taxonomy never wrote, and a screen-local refusal block is a defect anyway (B-17). It renders the fault
  id verbatim in mono beside the step's own evidence link — which is R-UI-050's error cell exactly:
  a report id and the way to try again.
- **I-111 — one watch per job id, and a lost transport is a reading, not a blank.** `JobsProvider`
  holds the register, so the inline timeline and the tray never open two streams over one job and never
  disagree. A reading that is already terminal is never re-watched. The transport order is `EventSource`
  first, `?transport=poll` (1 s cadence) when the constructor is absent or the stream errors before a
  terminal frame; a 404 or a rejected poll ends the watch, leaves the last status standing and sets
  `lost`. A watch that quietly stopped, with the last status still painted as if live, is the silence
  R-UI-020 forbids — so the timeline says so in words.
- **I-112 — a job with no id is already answered.** `TrackedJob.jobId: null` is the seam's "there was
  nothing to enqueue — this is done" (the deduplicated chain answer): it reads `succeeded` with no
  timing and opens no transport. A null id is never rendered as `data-job=""`; a machine hook never
  spells an empty identity, so the attribute is absent.
- **I-113 — the pattern formats nothing and imports no core value.** `src/ui` stays value-import-free
  of `src/core` (ARCH-01, the dropzone reading). Timings are whole elapsed seconds with the unit as copy
  (s-drawings I-92), and a refusal entry is a registry lookup — both are `JobsFormat`, bound **once** in
  `src/app/(app)/t/[tenant]/shell-frame.tsx` from `formatUserFigure` + `fill(strings.job_timeline_seconds)`
  and `refusalOf`, and handed to `JobsProvider`. `JobTimeline` itself reads no context and performs no
  request: every string it shows arrives already resolved, which is what lets the gallery and a bare
  jsdom mount render it.
- **I-114 — permission-denied is not a cell of this pattern.** The register holds the jobs this browser
  tab started, watched under the session that started them; there is no "someone else's job" to be denied
  and no permission to name. The workspace denial precedes the frame (shell I-17) and the seam's own
  refusals arrive as refused steps. Recorded rather than invented: a denial surface for a state no
  request can reach is dead copy.

## 1. Layout and hierarchy — the inline timeline

`JobTimeline` props are exactly `{ heading, steps, lost?, awaiting? }`; it renders

```
<section data-testid="job-timeline" data-state="idle|running|done|failed" aria-labelledby=…>
  <h2 …>{heading}</h2>
  <ol class="cx-job-timeline-steps">        …one <li> per step, in the order given…
  <p data-testid="job-timeline-idle">       …only when data-state="idle"…
  <p data-testid="job-timeline-transport-lost" role="status">   …only when lost…
```

`data-state` is derived in this order (the first that holds wins): `idle` when `steps` is empty;
`failed` when any step is `failed` or `refused`; `running` when any step is `queued` or `running`,
or `awaiting` is true (I-109); else `done`. The heading is `var(--text-16)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0; the list is list-style none, margin 0,
padding 0, column flex, gap 0 (the connector carries the vertical rhythm). Steps read oldest first,
down the page — the order the operations were started, which is the order they finish.

**Step row** — `<li data-testid="job-timeline-step" data-job={jobId} data-kind data-status>`:
grid `auto 1fr auto`, column gap `var(--space-3)`, align-items center, min-height
`var(--row-comfortable)`, re-keyed `var(--row-compact)` under an ancestor `[data-density="compact"]`
(R-UI-005, the dropzone I-75 mechanism). `data-job` is absent when the job id is null (I-112).

- **Marker** — an 8 px round dot, `aria-hidden` (the status word carries the meaning): queued
  `var(--graphite-300)` · running `var(--beam-500)` · succeeded `var(--success)` · failed and refused
  `var(--danger)`. A 1 px connector runs from each dot to the next in `var(--graphite-200)`, re-keyed
  `var(--success)` once the step above has succeeded. The last step draws no connector.
- **Kind** — `strings.job_step_<kind>` through a map total over `JobKind` (`ingest`, `thumbnails`,
  `probe`), `var(--text-13)` `var(--graphite-900)`. The raw kind stays on `data-kind` for machines.
- **Status** — `<span data-testid="job-timeline-step-status" aria-live="polite">` holding
  `strings.job_status_<status>`, `var(--text-12)` `var(--weight-body-medium)`, colour matching the
  marker (R-UI-060: the word is the meaning, the colour is emphasis).
- **Timing** — `<span data-testid="job-timeline-step-timing">` holding `step.timing` verbatim,
  `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`, `tabular-nums slashed-zero`,
  `justify-self: end`. A `running` step whose timing is null holds a core Skeleton of 12 × 64 px in that
  cell instead and shows no digits — the layout never shifts when the number lands, and the pulse comes
  from the Skeleton's single home (R-UI-004: skeletons, never spinners).
- **Terminal cause** — spanning all three columns beneath the row, at `var(--space-2)` above and
  `var(--space-3)` below: a **refused** step renders exactly one RefusalState (`inline` surface — the
  entry's own hint, refusal-state I-8) with the step's `evidence`; a **failed** step renders
  `<p data-testid="job-timeline-step-fault">` whose only text node is the fault id, `var(--font-mono)`
  `var(--text-12)` `var(--graphite-700)`, `user-select: all`, followed by the step's evidence as an
  `<a class="cx-job-timeline-evidence cx-reticle">` in the house evidence idiom (`var(--text-13)`
  `var(--weight-body-medium)` `var(--beam-600)`, underlined, hover `var(--beam-500)`) (I-110). A step
  with neither renders neither element.

**Idle** — `<p data-testid="job-timeline-idle">` `strings.job_timeline_idle`, `var(--text-13)`
`var(--graphite-600)`; no step renders beside it. **Transport lost** — the `role="status"` line
under the list, `strings.job_timeline_transport_lost`, `var(--text-12)` `var(--graphite-600)`;
it stands with whatever statuses were last known (I-111), never in place of them.

## 2. The register's reading (`JobsProvider`, `useTrackedJobs`, `useJobs`)

`JobsProvider` takes `{ format: JobsFormat, children }` and renders no DOM of its own. A consumer
declares what it tracks — `TrackedJob { jobId, kind, subject, evidence }` — and
`useTrackedJobs(jobs, { onSucceeded })` answers `{ steps, lost }` for exactly those jobs, in the
order given; `useJobs()` answers every tracked reading `{ jobs, state }` for the tray, and `null`
outside a provider, so a bare mount of the shell renders no tray at all. Called outside a provider,
`useTrackedJobs` throws a plain sentence naming what is missing — never a screaming-snake token, which
Q-07's scan would read as an orphan refusal code.

The reading per job: status by I-108's mapping; `timing` null until a number exists, then
`format.seconds(elapsedMs)` of the latest frame; `refusal` = `format.refusal(refusalCode)` on a
`refused` frame; `faultId` from a `failed` frame or from an `event: fault` frame. `onSucceeded` fires
once per job however often the ending frame repeats — the S-Drawings chain (I-88) asks for the
thumbnails job on it, and asking twice would enqueue twice. Transport, terminal handling and the
`lost` reading are I-111's; a `jobId: null` job is I-112's. `subject` never renders: it is the
consumer's key for what the job was about.

## 3. States (R-UI-050), ruled cell by cell

Declared in one enumerable place the suite reflects over (B-19): `src/ui/patterns/job-timeline/states.ts`
exports `JOB_TIMELINE_STATES`, two rows — `job-timeline` and `jobs-tray` — in the shell matrix's cell
shape (rendered, naming its module and the id it renders through · delegated, naming the owner and why ·
impossible, with the reason), walked by `tests/ui/job-timeline/state-matrix.test.ts`: a row with six
cells fails, and a cell claiming an id no source spells fails. `src/ui/shell/states.ts` grows **no row** —
its rows are the shell's screens — and only its top-bar wording is amended to name the tray as delegated
to this matrix (shell I-15 is amended in `docs/design/shell-top-bar.md` §0).

- **Loading** — the running step's Skeleton bone in the timing cell (§1); the steps themselves are the
  loading state of the operation, so no bone stands for the list. Never a spinner.
- **Empty** — `job-timeline-idle` with `job_timeline_idle`; the tray's is `shell-jobs-tray-empty`. The
  timeline teaches nothing beyond it: the action that starts a job is the consumer's own screen, one
  region above (S-Drawings' Dropzone), and a second "add a drawing" door here would be a duplicate.
- **Error** — a failed step: the status word `Failed`, the fault id verbatim, the evidence link (I-110).
  A render fault of the surrounding screen is the root error boundary's, unchanged.
- **Refusal** — one RefusalState inside the refused step's row, code, message, remedy and evidence
  (R-UI-020), from the one renderer.
- **Partial** — rendered, never hidden: succeeded, running and refused steps stand together in one list,
  and a refused step does not remove the ones that finished.
- **Offline** — the transport-lost line (I-111). The pattern raises no banner of its own: the consumer
  screen owns `navigator.onLine` (s-drawings I-89), and two offline sentences over one region would
  disagree about which one is the answer.
- **Permission-denied** — impossible here, with the reason recorded (I-114).

## 4. Copy, verbatim (`src/ui/strings/job-timeline.ts`, spread into `strings`)

`job_timeline_idle` **No job is running right now.** · `job_timeline_seconds` **{seconds} s** ·
`job_timeline_transport_lost` **Live progress stopped arriving. Reload the page to see where these
jobs stand.** · `job_step_ingest` **Read the drawing** · `job_step_thumbnails` **Draw the sheet
previews** · `job_step_probe` **Check that drawings can be read** · `job_status_queued` **Queued** ·
`job_status_running` **Running** · `job_status_succeeded` **Done** · `job_status_failed` **Failed** ·
`job_status_refused` **Refused** · `jobs_tray_label` **Jobs** · `jobs_tray_heading` **Jobs started in
this tab** · `jobs_tray_empty` **No job has run in this tab yet. Add a drawing to a project and its
progress appears here.**

Two copy moves this increment owns (B-20, and no committed baseline shows either sentence): the idle
line loses the word *drawing* because the table now serves every surface, and `job_step_probe` no longer
says "Check the worker" — a worker is the name of a process, not something a person asked for. Voice:
calm, concrete, professional; no exclamation marks; no build vocabulary. Fault ids, job ids and enum
values are data and render verbatim as data, never woven into a sentence (I-25's class). Registry
sentences are never paraphrased here: a refused step shows the registered message and remedy as
registered.

## 5. Motion (R-UI-004)

The timeline is X-1's animated region, and its animation is the state change itself: marker fill,
connector fill and status colour transition over `var(--motion-state)` `var(--ease)`; the running
step's Skeleton pulses from its single home and stops the instant a real number replaces it. A step
appearing, a refusal card mounting, the fault line, the transport-lost line and the tray's items
arrive with **no** entrance — an answer that performs before it is read is the theatre R-UI-004 and
refusal-state §5 both refuse. No bounce, no spinner, no travelling dot. Every duration is a token
zeroed at source under reduced motion, so `job-timeline.css` carries no `prefers-reduced-motion`
branch of its own.

## 6. Tokens and themes

`--graphite-200/300/600/700/900` · `--beam-500/600` · `--success` · `--danger` · `--space-2/3` ·
`--text-12/13/16` · `--font-mono` · `--leading-ui` · `--weight-body-medium`/`--weight-heading` ·
`--row-comfortable`/`--row-compact` · `--motion-state`/`--ease`; the refusal card's tints and the
Skeleton's fills belong to their own homes. Px literals, closed set (core I-1's class): the 8 px marker,
its 1 px connector, and the 12 × 64 px timing bone. Any other literal is a defect. No copper appears on
either surface — a job is not an act — and no basis colour appears at all.

`job-timeline.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Contrast holds on the founder values in both themes: graphite-900 and 700 on
graphite-0 clear 4.5:1, graphite-600 timings clear 4.5:1, beam-600 evidence links clear 4.5:1, and
beam-500, success, danger and the graphite-300 queued dot clear the 3:1 UI floor as markers — each
of them redundant to a word (R-UI-060).

## 7. Test hooks (closed contract, C-05)

Routes read (introduced by the jobs seam, not here): `GET /api/events?jobId={jobId}` (SSE `job` and
`fault` frames, closed by the server after the terminal event) and
`GET /api/events?jobId={jobId}&transport=poll` (`{ events, done }`, 404 for an unknown id). The product
consumer is `/t/{tenant}/p/{project}/drawings`; the gallery reflects the barrel at `/design`
(`docs/design/s-design-gallery.md`).

Test ids, exactly these six on the elements ruled in §1: `job-timeline` (`data-state`) ·
`job-timeline-idle` · `job-timeline-step` (`data-job`, `data-kind`, `data-status`) ·
`job-timeline-step-status` · `job-timeline-step-timing` · `job-timeline-step-fault` ·
`job-timeline-transport-lost` — plus the mounted RefusalState's own four (`refusal-state` with
`data-code`, `refusal-message`, `refusal-remedy`, `refusal-evidence-link`). The tray's four ids are
`docs/design/shell-top-bar.md`'s. No others are added; the failed step's evidence link is found by
role and name.

Behavioural hooks without new ids: `aria-live="polite"` on each status word; `role="status"` on the
transport-lost line; `aria-hidden` on markers and connectors; the Skeleton's own id in a running
timing cell; `cx-reticle` on the evidence link; exactly one `EventSource` per job id, and none for a
terminal reading or a null job id. Suites: `tests/ui/job-timeline/**` and
`src/ui/patterns/job-timeline/__tests__/**` under jsdom (`@testing-library/react` + `user-event`,
a controllable fake `EventSource` and a stubbed `fetch`) cover §1's rendering, §2's mapping, the
`onSucceeded` once-per-job rule and the three transport outcomes. J-010's `j-010-timeline-done`
checkpoint stands unchanged on these ids and re-baselines
`tests/e2e/baselines/design/job-timeline-done.png` with `job-timeline-step-timing` masked (B-20 —
the section is now the pattern's, and the timings are elapsed real time).
