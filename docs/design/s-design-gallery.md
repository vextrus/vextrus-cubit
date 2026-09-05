# Design Decision — S-Design gallery (the job pattern's entries at /design)

Screen: the living gallery at `/design` (`src/app/(app)/design/page.tsx` over
`src/ui/gallery-derivation/**`), as it stands once this increment's barrel exists. Increment
inc-112-job-timeline. This Decision amends `docs/design/s-design.md` for exactly what the new
barrel adds — one new barrel section, three new entries, their state rosters and their sample data —
and re-decides nothing else: the page's structure, chrome, ordering, copy, motion, tokens, themes and
its own R-UI-050 matrix stand as that Decision rules them, and every one of its Interpretations
(I-15 mountable states · I-16 canonical composition for a part · I-17 identifiers are the copy ·
I-18 sample refusals are authored data · I-19/I-20 the closed px and media constants · I-23 no page
`main`) remains in force. Law: R-UI-004/010/011/012/024/050, B-17, B-19, C-05, Q-06, Q-11, J-004.
Interpretations I-1–I-120 of the earlier Decisions bind, `docs/design/job-timeline.md` and
`docs/design/shell-top-bar.md` chief among them: the gallery is evidence, never the consumer — it
invents no component, restyles nothing, and imports only through the barrels.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-121 — an entry may not call a hook, but it may mount a component that does.** `render()` is
  invoked outside a component, so a `useJobs()` in an entry would throw on the page's first paint. The
  job entries therefore compose *elements*: `<JobsProvider format={sampleJobsFormat}><JobsTray /></JobsProvider>`
  is a tree React mounts, and the hooks run where React allows them — inside `JobsTray`. `JobTimeline`
  needs no provider at all: it reads no context and performs no request (job-timeline I-113), so its four
  states are authored props and nothing more.
- **I-122 — a provider and the consumer it exists for share one canonical composition (I-16
  extended).** `componentExports` reflects every uppercase runtime export, so `JobsProvider` owes an
  entry as surely as `JobsTray` does, and neither mounts meaningfully alone — a provider renders no DOM,
  and a tray outside one renders `null` by design (shell-top-bar I-116). Both entries therefore render
  the same composition: the provider around an empty tray. The visible repetition is completeness
  evidence and is never deduplicated away — an absent key must stay a failing test (B-19).
- **I-123 — the gallery authors the sample strings the pattern refuses to invent.** A timing is a
  string the consumer already formatted and a heading is the consumer's own copy (job-timeline I-107,
  I-113); the gallery may not import `formatUserFigure` (ARCH-01 keeps `src/ui` value-import-free of
  `src/core`) and may not reach a route-local string table, so the sample heading, the two timing
  strings, the evidence label and the sample fault id are authored once in `src/ui/gallery-derivation`
  beside every other sample string (I-17) and referenced from the entries. They are sample data, not a
  second spelling of a shipped sentence.
- **I-124 — the gallery opens no transport.** `/design` mounts a provider with no tracked job, and
  `JobTimeline`'s four states are static props, so no `EventSource` and no poll is opened by this page —
  the evidence screen watches nothing and cannot go stale. `sampleJobsFormat` is a real implementation
  rather than a thrower (`seconds` fills `strings.job_timeline_seconds` with the whole second count;
  `refusal` answers the sample entry for a sample code and `null` otherwise), so nothing here is a stub
  that would lie if it ever ran.

## 1. Layout and hierarchy

Unchanged (s-design §1): one column, `gallery-shell` header, then one `gallery-barrel` section per key
of `galleryBarrels` in code-point order of the id, each holding its `gallery-entry` cards in
`componentExports` order, each card holding its `gallery-state` cells in declared order. This increment
adds one barrel section — `patterns/job-timeline`, which sorts between `patterns/dropzone` and
`patterns/offered-group` — and one entry inside the existing `shell` section. Nothing about the page's
own chrome moves: the barrel section's `h2` is the barrel id verbatim in mono, the entry `h3` the
export name verbatim, the state label the state name verbatim (I-17).

The new entries' cells lay in the wrapping flex row §1 already rules; the timeline samples are wide and
naturally take the full row, and the two tray samples are narrow. Neither takes the RefusalState
entry's one-track exception, which stays keyed on that entry alone.

`patterns/job-timeline` publishes three uppercase runtime exports and therefore owes exactly three
entries — `JobTimeline`, `JobsProvider` and, from the shell barrel, `JobsTray`. `useTrackedJobs` and
`useJobs` are lowercase and are not components; `TimelineStep`, `TimelineState`, `StepStatus`,
`TrackedJob`, `TrackedJobReading`, `JobsFormat` and `JobsEvidence` are types and are erased. The
merged `missingEntries()` suite compels the three; this file designs them.

## 2. State roster and sample data

- **`patterns/job-timeline/JobTimeline`** — four states, named for the `data-state` the component
  derives, in this order:
  - `idle` — `steps: []`. Renders the heading and `job-timeline-idle`.
  - `running` — the ingest step `succeeded` at **4 s**, the thumbnails step `running` with
    `timing: null` (so the 12 × 64 px Skeleton bone stands in its timing cell), and `lost: true`, so
    `job-timeline-transport-lost` renders beneath the list. The lost transport rides this state rather
    than taking a fifth: it is a modifier of a live reading, not a state of its own — a timeline whose
    stream has gone while a step is still running is precisely the reading that line exists for, and
    every other state would show it as a footnote to work already finished.
  - `done` — ingest `succeeded` at **4 s**, thumbnails `succeeded` at **11 s**.
  - `failed` — ingest `succeeded` at **4 s**; thumbnails `refused` carrying
    `sampleRefusal("FORMAT_NOT_ACCEPTED", "inline")`, which renders the one RefusalState inside its
    row; probe `failed` carrying the sample fault id, which renders `job-timeline-step-fault` and the
    step's evidence link. One cell therefore evidences both terminal causes and R-UI-050's partial
    reading — a finished step, a refused one and a failed one standing together, none hidden.

  Every state carries the sample heading; every step carries the sample evidence; the three job ids are
  the fixed sample strings `job-1`, `job-2`, `job-3` (data, never prose). The kind and status words are
  not authored here — they come from `strings.job_step_*` / `job_status_*` inside the component, which
  is the point of the entry.
- **`patterns/job-timeline/JobsProvider`** — one state, `provided`: the provider around an empty
  `JobsTray` (I-121, I-122).
- **`shell/JobsTray`** — one state, `empty`: the same composition. The tray renders its trigger reading
  `0` with `data-state="idle"`; the panel stays **closed**, one activation away, per I-15 — a gallery
  that opened it would portal a popover over the page and photograph nothing useful. Its empty line is
  reached by opening it, which is what a visitor does.

## 3. Copy, verbatim (only what no earlier Decision fixed)

New sample data, authored in `src/ui/gallery-derivation` (I-123):

- sample heading — **Reading drawings**
- sample evidence — `{ href: "/design", label: "Add the drawing again" }` (verb-first, naming the
  destination; the href stays on the current route, the gallery's own idiom for sample evidence)
- sample timings — **4 s** · **11 s** (the shape `job_timeline_seconds` fills)
- sample fault id — **f-3d9a2c41**

No other new copy: the kind words, status words, idle line, transport-lost line and the three tray
strings are `src/ui/strings/job-timeline.ts`'s, rendered by the components as they ship; the refused
step's message and remedy are `FORMAT_NOT_ACCEPTED`'s registered sentences verbatim (I-18) — the
gallery spells no code and no refusal sentence the taxonomy does not already own. Voice: calm and
concrete, no exclamation marks; the mono identifiers and the fault id are data, not prose.

## 4. States (R-UI-050) — unchanged

The page's own matrix stands exactly as s-design §4 rules it: default is the only rendered state;
loading, refusal, partial and offline are impossible (nothing is awaited, requested or aged — and
I-124 keeps that true with a job pattern on the page); empty is impossible on a shipped tree because
`missingEntries()` empty is gate law; error is the root boundary's; permission-denied is the `(app)`
group's one door (I-22). The RefusalState inside the `failed` timeline sample, and the empty tray, are
sample data with `data-entry` ancestry — never this page's answer.

## 5. Motion (R-UI-004)

The gallery chrome still has none. The motion the new entries bring is the pattern's own, already ruled
in its Decision and its single homes: marker, connector and status colour over `var(--motion-state)`
`var(--ease)`; the running step's Skeleton pulse; the Popover's entrance if a visitor opens the tray.
Baseline captures run with `animations: "disabled"`, and the captured `gallery-shell` region contains
none of it regardless.

## 6. Tokens and themes

No token and no CSS enters `design.css` for these entries: the samples paint from
`job-timeline.css`, `shell.css` and the primitives' own stylesheets. I-19's five px constants stay
five — the timeline sample needs no demo geometry, because its rows are sized by the step content and
its one bone is the pattern's own 12 × 64 px — and I-20's single media condition stands. Both themes
arrive through token values off `html[data-theme]`; the entries branch on no theme, and the job
pattern's contrast facts (job-timeline §6, shell-top-bar §6) are what J-004 grades on this page in
light and dark.

## 7. Test hooks (closed contract, C-05)

Route: `/design`, unchanged. Test ids: none added — the page's four (`gallery-shell`,
`gallery-barrel`, `gallery-entry`, `gallery-state`) stand, and the new entries are addressed through
them: `gallery-barrel[data-barrel="patterns/job-timeline"]`,
`gallery-entry[data-entry="patterns/job-timeline/JobTimeline"]`,
`gallery-entry[data-entry="patterns/job-timeline/JobsProvider"]`,
`gallery-entry[data-entry="shell/JobsTray"]`, and the `gallery-state` cells named in §2. Inside them
the samples publish their own contracts: `job-timeline[data-state]`, `job-timeline-step[data-job]
[data-kind][data-status]`, `job-timeline-step-status`, `job-timeline-step-timing`,
`job-timeline-step-fault`, `job-timeline-transport-lost`, `refusal-state[data-code]` and
`shell-jobs-tray[data-count][data-state]`.

- Derivation suite (product-owned, `src/ui/gallery-derivation/`): `galleryBarrels` keys stay derived
  from the filesystem's barrel index files, so `patterns/job-timeline` enters by existing;
  `missingEntries()` stays empty, which is what compels the three entries; nothing here transcribes a
  count or a roster (B-19).
- jsdom acceptance mounts the page and asserts the §1 structure against the derivation. It also
  asserts what I-124 promises: mounting `/design` constructs no `EventSource` and issues no `fetch`.
- J-004 (`tests/e2e/journeys/j-004-gallery.spec.ts`): every `gallery-barrel` holds ≥ 1
  `gallery-entry` and every visible `gallery-entry` ≥ 1 `gallery-state`, in both themes; axe
  serious/critical = 0, never widened (Q-11) — the two tray triggers share one accessible name, which
  is lawful, and their panels stay closed (I-15).
- Baselines (Q-06): `gallery-shell-light.png` and `gallery-shell-dark.png` capture the header alone
  and **do not move** for this increment; the job pattern's own pictures are J-010's
  (`job-timeline-done.png`, `job-timeline-tray-open.png`), not this screen's. Should the gate report a
  moved gallery baseline, it is regenerated in its own `baseline:` commit naming the proof, like the
  rest of B-20's surface.
