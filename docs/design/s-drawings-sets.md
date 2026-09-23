# Design Decision — S-Drawings-Sets (the sets index and the set browser)

Routes: `/t/{tenantId}/p/{projectId}/drawings/sets` (the sets index) and
`/t/{tenantId}/p/{projectId}/drawings/sets/{setId}` (the set browser), under
`src/app/(app)/t/[tenant]/p/[project]/drawings/sets/**`, inside the shell frame and behind the
membership guard in `t/[tenant]/layout.tsx`. Increment inc-109-sets-revisions. Law: R-TO-005,
L-REG-06, L-ACT-01/02/03, R-UI-001/003/004/005/010/012/020/021/030/031/050/060, Q-07, Q-11,
Q-17, B-17, B-19, J-012. Every convention of the earlier Decisions binds: `cx-` classes,
tokens-only colour and motion, `cx-reticle` solely from its single home, no `[data-theme]`
selector in authored CSS; Interpretations I-1–I-94 remain in force ("workspace" is the
user-facing word for tenant, s-auth I-11; copy lives in `strings.ts` beside the page, ruleset
I-24; machine identifiers render verbatim in mono, I-25; a digest renders whole, wrapping,
select-all, I-26; the rail states the area, I-30; the pre-check before a dialog opens belongs
to the screen, participants I-49; permission-denied is in-frame and read-only, s-drawings
I-90). Chrome comes only from shipped primitives and patterns — core Button, Input and
Skeleton; the shell's `ShellEmptyState`; the one ConsequenceDialog; the one RefusalState —
plus the `cx-sets-*` classes this file rules. One `strings.ts` beside `sets/` serves both
screens (keys `sets_…`); JSX carries no string literal beyond test ids and fixed attribute
values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-95 — the lineage is the drawing, and the screen renders the ordinals it is given.** A
  drawing is the lineage of `drawings` rows one project stores under one presented name
  (increment interpretation I-A); the browser lists lineages, never rows. Each revision
  renders as its ordinal (mono, tabular) and its sha256 whole — wrapping, `user-select: all`
  (I-26's class) — oldest first, the newest carrying `data-current="true"`. Which revision is
  current is said in words (`sets_revision_current`), never by colour alone (R-UI-060).
- **I-96 — membership is a draft, so its control is a door, not an act.** Nothing is derived
  from a draft (increment I-B), so a toggle writes at once: one core Button per lineage with
  `aria-pressed`, no dialog, no digest, no consequence. The pin is the one act on this screen,
  and it is keyed on the set alone — membership is resolved server-side (L-ACT-02: offered,
  never assembled). No multi-select exists on either screen.
- **I-97 — one `set-empty` element, in the column between the pin section and the pinned
  revisions, with a fixed cause precedence.** Three
  causes, one element, judged in this order: `no-drawings` (the project holds no drawings, so
  this set can name none), then `no-revisions` (nothing pinned yet), then `no-members` (the set
  has pinned revisions but names no drawing now, so pinning as it stands would refuse). A
  second empty element would make a journey's `set-empty` ambiguous, and a set with no members
  and no pin has one honest thing to teach — how to get a first pin — not two. It stands in the
  column and not inside `<section>` "Pin this set": the empty state carries a heading of its own
  (ShellEmptyState's), and nesting it under the pin heading makes a screen reader's outline say
  the pin section is the empty one, when what is empty is the drawings the set may name. It
  renders whether or not this reader holds `PIN_SET` — a denial takes the pin section away,
  never the answer to why there is nothing here.
- **I-98 — a pinned revision is shown as pinned, never reconciled.** The manifest is the
  citation list (L-REG-06): every member it held renders exactly as it was pinned, including a
  drawing the set no longer names and a revision that has since been superseded. Nothing is
  recomputed against today's membership, nothing is greyed out, nothing is hidden. That
  standing-as-pinned citation is this screen's R-UI-050 partial cell.
- **I-99 — the digest is the identity and renders whole in both places.** `set-revision-digest`
  and `set-row-digest` hold the digest character-for-character — their labels sit outside the
  test-id element, so the text equals `data-digest` exactly. An unpinned set renders the prose
  none-line with `data-digest=""` (the consequence-dialog `none` precedent: prose stands for
  absence, never a dash and never a fake hex value).
- **I-100 — no timestamp renders on either screen.** Recency is carried by order: sets newest
  first, set revisions newest first, drawing revisions oldest first with ordinals. `createdAt`
  and `pinnedAt` are read by the module and rendered nowhere, so no date formatter is owed and
  no locale reaches these screens.
- **I-101 — permission-denied is in-frame, read-only, and names PIN_SET.** Reading the sets of
  a project needs workspace membership; creating, toggling and pinning need `PIN_SET`
  (L-ACT-03). A member without it keeps both screens whole — every set, every member, every
  pinned revision and every digest — while `set-create-form`, `set-member-toggle` and `set-pin`
  do not render (a control that can only refuse is theatre, participants I-50). One
  banner-surface `PERMISSION_NOT_HELD` names the permission and its holders from first paint.
- **I-102 — offline is a fault of reachability here, and no banner is invented.** Neither
  screen carries a transfer queue or an event stream, so s-drawings I-89's condition is absent
  and the audit/participants reading holds (shell I-20): a server-rendered page whose action
  cannot reach the server surfaces the root error boundary rather than a banner claiming a
  state the screen cannot observe.
- **I-103 — the pin's pre-check belongs to the screen; the dialog owns what arrives while it
  holds focus.** `set-pin` awaits `previewPin` before opening: `SET_NOT_PINNABLE`,
  `PERMISSION_NOT_HELD` and `SIGNED_OUT` render in the pin region's answer slot and no dialog
  opens on nothing. `ACT_CHANGES_NOTHING` (a re-pin of an identical manifest) and every other
  commit refusal render in the dialog's own slot; `CONSEQUENCES_NOT_CARRIED` is the dialog's
  stale re-render (consequence-dialog I-44), never a card of ours.

- **I-104 — every region of the browser says why it is empty, and only one of them carries the
  test id.** R-UI-020's "silence never happens" binds each region, not the screen as a whole: a
  heading and a hint over blank space teaches nothing and reads as an unfinished page. So the
  drawings list and the pinned-revisions list each carry their own one-line sentence
  (`sets_members_none`, `sets_revisions_none`, the hint idiom, no test id) where the void is,
  while I-97's single `set-empty` element stands once per screen, in the column, its cause
  precedence unchanged. A sentence is not an empty state: it adds no
  heading, no action and nothing a journey could mistake for `set-empty`.
- **I-105 — a commit is answered by the re-read, and nothing is said into a region that is
  about to be discarded.** The screen answers a pinned revision by standing at the address
  again (R-UI-021's platform navigation), which replaces the document; a status line written in
  the same tick is torn down before any assistive technology announces it, so copy for it would
  be authored, keyed, rendered in principle and observable by nobody. The pin region's live
  region therefore carries the pre-check's `sets_pin_pending` and nothing after a commit — the
  answer is the new revision at the top of `set-revisions`, which is what the Decision said the
  answer was from the start.
- **I-106 — the set browser names the set in its tab.** Every shell screen names itself in the
  document title; a set's own name is the only thing that tells two open sets apart, so
  `generateMetadata` reads the set behind the page's own guard (a session, then membership of
  the project) and titles the tab with the name verbatim, falling back to `sets_heading` where
  the reader holds no such set. A name is never published to an account that may not read the
  project.

Recorded IOU — visible navigation (R-UI-031), owner: the node owning the shell's project
navigation (the S-Drawings and S-Audit precedent, unpaid). Until it lands both routes are
journey- and URL-reachable, and `route-address.ts` (`setsRoute`, `setRoute`) is their one
address; `set-drawings-link` keeps the sheet index one click away from both *(amended by I-360: the
shell's breadcrumb carries a **Drawings** crumb on both routes now, and `set-drawings-link` marks only
the empty states' link there)*.
- **I-107 — the screen states itself on its root, and every identifier renders through the IdChip (session 4, AM-08 Part 2's rubric read as CLAUDE.md reads it).** The index's current-digest cell, the browser's per-revision sha256, the pinned revision's digest (`set-revision-digest`) and each citation's sha256 are IdChips; `set-row-digest` wraps the chip and keeps `data-digest`. Both roots — `cx-sets` and `cx-set` — state `ready`, the index `empty` where it lists no set. The root carries `data-screen-root` and a `data-state` a reader of the DOM can take after `settled()` — `ready`, `empty`, or the screen's own word — which is the rubric's twelfth criterion and was unstated here. An identifier a person meets on this screen (an account id, a content digest, a source key) is an IdChip: the chip measure on screen, the whole value in `data-value`, on the tooltip and on the clipboard, never a raw uuid, hex digest or handle in body text (R-UI-082). Where an earlier Interpretation of this file ruled a digest rendered whole in the document, this one amends it: the whole value is the chip's DATA and the copy it hands over, and the document shows the measure.
- **I-285 — the sets index is a GRID, and the tracks above it are single rows (session 5, AM-08 Part 2's rubric read as CLAUDE.md's grid law reads it).** A register of sets is a reference surface, and CLAUDE.md rules what a reference surface is: compact 28 px rows, a sticky header, a frozen key column, no wrapping, tabular right-aligned numerals. The `<ul>` this file first ruled was none of those, and it was no candidate the craft rubric measures either — so the screen was graded on a primary work surface it did not have (session 4 read it at 3.58, `workSurface` 0 and `aboveTheFold` 0). The sets therefore stand in the one shipped `DataTable`, inside the region whose id the closed contract already named: `sets-index` moves from the `<ul>` to the frame around the grid, and no test id is added, renamed or retired by this reading (§7 stands word for word). Two consequences follow and are ruled above: the counts and the digest label stop being lines of a card and become COLUMNS — the count-line keys are retired, kept declared, and rendered nowhere — and the header and create tracks become single rows, so the grid starts within 240 px of the top of `shell-main` at 1440x900 and at 1280x800 alike. Nothing is rendered to move a score: a grid is what a list of sets with four facts each was always trying to be, and the rubric only says so.
- **I-286 — the drawings a set may name are a GRID; the revisions it has been pinned at stay a LIST** *(its eighteen-row frame and its column widths amended by I-324)*. The membership surface is the browser's primary region by I-285's reasoning, one row per lineage, and its frame is `calc(var(--row-h) * 18)` deep whatever the project holds (I-214's precedent), so the surface reads the same for a project with two drawings and one with forty and the region is the primary at both viewports. The per-drawing revisions become one non-wrapping run in a cell of that row — a cell is one line (R-UI-083), and the shipped table clips it with its own tooltip. The membership toggle stands in a control well, and where the reader may not pin the COLUMN is not built at all (I-101): an empty well would still be a column of the grid. The pinned revisions are NOT a grid and are not rebuilt as one: a pinned revision is a citation list nested under a manifest digest (I-98), a nested citation is no row, and the rubric measures the PRIMARY surface — making the secondary region a second grid would put two frames in competition on one screen for no reader's benefit.
- **I-324 — the set browser's grid takes the height the column leaves, and the pin and its evidence stand beside it (session 7, amending I-286 and I-106's crumb; R-UI-080, R-UI-081, R-UI-084).**
  The 2026-09-23 craft look read the browser as "at the bar by score but not demo-ready": I-286's
  frame, fixed at eighteen rows whatever the project holds, stood about 440 px of empty grid between
  a one-drawing project's only row and the pin, and at 1280x800 the pinned revisions — the evidence
  the pin produces — fell below the fold; its `workSurface` score came from padding. Sizing the frame
  to its rows instead would have failed R-UI-080 (a primary grid of one row is a few percent of
  `shell-main`, a mechanical score of 1). So the browser takes I-285's treatment and a second column:
  `cx-set` is a full-height column (`height: 100%`, `min-height: 0`) at the page measure it was ruled
  at, and under its header track (and the denial banner, where it stands) its body `cx-set-body` is a
  grid of two columns, `minmax(0, 1fr)` and 280 px, gap `var(--space-6)`. The left is the members
  section, whose grid region takes every row the column leaves (`flex: 1 1 auto`, at least six rows
  deep); the right, `cx-set-side`, a column (gap `var(--gap-section)`) that scrolls within itself,
  holds the pin section, the one `set-empty` where a cause stands, and the pinned revisions. The door
  and its evidence now stand in the fold beside the grid at both viewports, and the grid is still the
  primary surface the rubric measures (over half of `shell-main` at both). The members grid's
  column widths are narrowed to 280/96/320/160 so all four stand inside it beside the side column at
  1280 as at 1440 — at the old 320/120/420/160 the membership toggle was the column a reader had to
  scroll sideways to reach. In the side column the pin and revisions hints are no longer a clipped
  line beside the heading — at 280 px the ellipsis took the whole sentence — but each section's
  accessible description (`aria-describedby`, the hint clipped from sight): R-UI-081 puts section
  explanations in popovers and empty states, and the `no-revisions` empty state already says what the
  pin records. The members hint stays on its track. The breadcrumb's page crumb is the set's own name
  (`useShellPage(set.name)`), the words its h1 and its tab already carry (I-106): "Drawing sets" named
  the index, not this page (R-UI-084). A crumb step back to the index is the shell's to give in
  `routes.ts`; until it does, `sets_sets_link` in the header track is that way back. What it costs:
  the revisions list is 280 px wide, so a long drawing name wraps inside its citation. *(The header's
  `set-drawings-link` left the header by I-360 point 3; the crumb step and the page crumb's cap are
  listed for the shell's owner there.)*
- **I-360 — the two screens answer the 2026-09-23 re-look of the M3 project: one name for the pin's
  fingerprint, one helper line a screen, navigation spelled once, and a cell that states its value
  (session 7; amends I-99's and I-285's labels and columns, I-96's toggle, I-324's header, §1, §3, §5
  and §7; R-UI-081, R-UI-083, R-UI-084, Direction §6).** The re-look read both screens at the bar by
  score and not demo-ready. Each finding was a clause of this file:
  1. **One name for one value (CLAUDE.md: a second spelling of the same document is a defect).** The
     index called the current manifest digest **Current digest** and the browser's pinned revision
     called the same value **Manifest digest**; a reader moving between the screens could not tell
     they were one fact, and neither name is a quantity surveyor's word. Both now read **Pin
     fingerprint** (`sets_col_digest`, `sets_revision_digest_label`). `data-digest`, the IdChip and every
     hook keep the value; only the label a person reads moved. `sets_pin_hint` says "a fingerprint of
     that list" for the same reason.
  2. **One helper line a screen (Direction §6, R-UI-081).** The index showed three sentences — the
     caption and two section hints, one of them "The digest fingerprints the revision each set stands
     pinned at". The caption stays the one visible line; `sets_create_hint` and `sets_list_hint` become
     their sections' accessible descriptions (`aria-describedby`, the hint clipped from sight in
     `cx-set-described`), exactly as I-324 did for the pin and revisions hints; and `sets_list_hint` is
     re-worded without build vocabulary: **Newest set first. A pin fingerprint names the exact revision
     of every drawing a set was pinned at.**
  3. **Navigation is spelled once (R-UI-083: the key column is the row's door; R-UI-084).** The set's
     name was plain text beside a 140 px **Open** well holding **Open set**; the name is now the row's
     door — a `next/link` to `setRoute(…)` carrying the contract's `set-open`, wrapping the
     `set-row-name` it always carried, in the S-Home name-link idiom — and the Open column is retired
     (`sets_col_open`, `sets_open` kept declared, rendered nowhere). The index header's `set-drawings-link`
     ("Open this project's drawings") repeated the breadcrumb's **Drawings** crumb directly above it and
     is gone from both headers; the contract's `set-drawings-link` now marks the one link to the sheet
     index that is not the crumb — the empty index's action for a reader without `PIN_SET`, and the
     browser's `no-drawings` empty action. The browser's header keeps `sets_sets_link` back to the index
     until the trail can say **Drawing sets** (below).
  4. **The "In this set" cell states its value (R-UI-083; Direction §6, state before verb).** The cell
     held only a verb — **Remove from set** — so membership was read from the action, and the secondary
     28 px button filled the 28 px compact row edge to edge, its border on the row's hairlines. The well
     still holds ONE control that fills it (a gridcell is a pointer target of its own, SC 2.5.8, the
     control-well ruling), now ghost — no border — reading the state first, **In set** / **Not in set**
     (`sets_member_in` / `sets_member_out`, the state `var(--ink)` at `var(--weight-body-medium)` when
     pressed, `var(--ink-muted)` otherwise), then the verb, **Remove** / **Add** (`sets_member_remove` /
     `sets_member_add`, shortened from **Remove from set** / **Add to set**: the state beside it names the
     set), `var(--text-12)` in the link voice, underlined. `aria-pressed`, the drawing-named `aria-label`
     (`sets_member_remove_label` / `_add_label`, unchanged), `data-drawing` and the row's `data-member`
     move together as I-96 ruled.
  5. **The browser takes the width the index takes (R-UI-080).** `cx-set` drops the page measure
     `var(--breakpoint-lg)` it kept under I-324, so its side column stands at the frame's right edge
     rather than about 88 px short of it at 1440 — the same reading s-drawings I-359 makes of the sheet
     index.
  **Listed for their owners, not made here** (the files are not this screen's): the page crumb is
  clipped at `.cx-breadcrumb-label`'s `max-width: calc(var(--drawer-w) - var(--space-8))` in
  `src/ui/primitives/core/core.css` whether or not it is the current page — lift the cap for the
  crumb carrying `aria-current="page"` (let it flex-shrink against the trail's free width) so "Golden
  Path Set (F-RCC6-BNBC)" reads whole; and `src/ui/shell/routes.ts`'s `shellCrumbs` should admit an
  intermediate step between the area and the page (Drawings › Drawing sets › {set}), after which
  `sets_sets_link` leaves the browser's header and I-324's crumb clause is closed. What this costs:
  a reader who never opened the index learns what a pin fingerprint is from the index's description
  or the pin's, not from a visible line; the membership verb is one word.

## 1. Layout and hierarchy

Files: `page.tsx` (thin server component: reads the two segments, calls `setsOf`, resolves the
actor's `PIN_SET` standing, renders `SetsIndex`), `sets-index.tsx`, `[set]/page.tsx` (calls
`setOf` and `drawingLineagesOf`; a set the project does not hold is Next's 404; its
`generateMetadata` titles the tab with the set's name behind the same guard, I-106),
`[set]/set-browser.tsx`, `actions.ts`, `route-address.ts`, `strings.ts`, `states.ts` ×2,
`loading.tsx` ×2, `rows-drawn.ts` (the one reading of a grid's own drawn-row count, worn by
both screens, B-17), `sets.css`. A segment that is no uuid names nothing and is judged before
any query (the shell's `scopedTenantId` precedent). Both pages render in `shell-main`, one
column (`cx-sets`, `cx-set`): column flex, gap `var(--gap-section)`. Amended by I-285 and
I-286: `cx-sets` is a full-height column (`height: 100%`, `min-height: 0`, no page measure) so
its grid takes what the tracks above it leave; `cx-set` kept the page measure
`var(--breakpoint-lg)` it was ruled at until I-360 point 5 retired it (no page measure on either
screen now), and is, by I-324, the same full-height column, its body two
columns — the members grid and a 280 px side column holding the pin and the pinned revisions. Every section is a head TRACK of one row — its `<h2>`
beside its hint, both clipped rather than wrapped (`cx-sets-track`, gap `var(--space-4)`) —
over whatever that section holds, with `var(--space-2)` between the two; a stack of headings
and sentences is what put the work surface below the fold (AM-08 Part 2's C1 and C2).

### The sets index

Header **track** — ONE row (flex, baseline, gap `var(--space-4)`, amended by I-285): `<h1>`
`sets_heading` — `var(--text-20)` `var(--weight-heading)` `var(--ink)`, margin 0 — then
`sets_caption` (`var(--text-13)` `var(--ink-muted)`, one line, clipped with an ellipsis where
the measure is short of it) — the screen's ONE visible helper line (I-360 point 2). *Amended by I-360
point 3:* the header no longer carries the `next/link` `<a data-testid="set-drawings-link">` to
`drawingsRoute(…)` — the breadcrumb's **Drawings** crumb directly above is that way. The
evidence-link idiom it wore (`var(--text-13)` `var(--weight-body-medium)` `var(--ink-link)`,
underlined, hover `var(--accent)`, `cx-reticle`) is still every `cx-sets-link`'s.

**Create a set** (`<section aria-labelledby aria-describedby>`) — a head track of one row
(`cx-sets-track`): `<h2>` `sets_create_heading` (`var(--text-16)` `var(--weight-heading)`); its hint
`sets_create_hint` is the section's description, clipped from sight (`cx-set-described`, I-360 point
2 — formerly a visible clipped line beside the heading); then
`<form data-testid="set-create-form">`: flex, wrap, gap `var(--space-3)`, align-items center,
`padding-block-end var(--space-2)` (reticle clearance) — the visible `<label for…>`
`sets_name_label` (`var(--text-13)` `var(--weight-body-medium)` `var(--ink-secondary)`), the
core Input `data-testid="set-name-input"`, width 280 px, no placeholder (the s-auth ruling),
and the core primary Button `data-testid="set-create"`, label `sets_create_submit`, all on the
one row. While the action is in flight the door takes core's loading state and
`<p role="status" aria-live="polite">` `sets_create_pending` renders below the form. On
`{ created: true }` the client navigates to `setRoute(tenantId, projectId, setId)` — the new
set standing open is the answer, no toast. Below the form the region's **answer slot**
`<div class="cx-sets-answer">` (no test id; the contract is closed) holds exactly one
RefusalState. This whole section is absent for a reader without `PIN_SET` (I-101).

**Sets** (`<section aria-labelledby aria-describedby>`, `flex: 1 1 auto`) — a head track of one row:
`<h2>` `sets_list_heading`, its hint `sets_list_hint` the section's clipped description (I-360 point
2); then the GRID (I-285), which takes every
pixel the tracks above it leave. `<div data-testid="sets-index" data-rows-rendered={drawn}>`
is the region a retrying read waits on — the id the contract already named, now on the frame
around the grid rather than on a `<ul>` — and `drawn` is the shipped table's own
`data-rows-rendered`, read back through the region rather than restated from the data. Inside
it one `DataTable` (`tableId` `s-drawings-sets`, `density="compact"`, `getRowId` the set id,
`aria-labelledby` the `<h2>`, `rowTestId` `set-row`, `rowDataOf` `data-set={setId}`
`data-name={name}`), one row per set in the module's order (newest first), four columns (five until
I-360 retired **Open**):

- **Set** (`sets_col_name`, 320 px) — the frozen key column, so it is each row's `rowheader`, and
  the row's door (I-360 point 3): the `next/link` `<a data-testid="set-open" class="cx-sets-row-link">`
  to `setRoute(…)` — the name's own `var(--ink)`, underlined in `var(--accent)`, `var(--ink-link)` on
  hover, clipped with an ellipsis, `cx-reticle` — wrapping `<span data-testid="set-row-name">` the name
  verbatim, `var(--weight-body-medium)` `var(--ink)`, never wrapping.
- **Drawings** (`sets_col_members`, 120 px) and **Pinned revisions** (`sets_col_revisions`,
  160 px) — right-aligned tabular figures through `formatUserFigure`, the table's own mono
  numerals.
- **Pin fingerprint** (`sets_col_digest`, 220 px; **Current digest** until I-360 point 1) —
  `<span data-testid="set-row-digest"
  data-digest={digest ?? ""}>` holding one IdChip (I-99, I-107), or `sets_row_digest_none` in
  `var(--font-ui)` `var(--ink-muted)` when the set has no pinned revision.
- **Open** — RETIRED by I-360 point 3. It was a 140 px CONTROL WELL holding
  `<a data-testid="set-open">`, label `sets_open`; the id now stands on the name's link above.

**Empty** — in the list's place, one `ShellEmptyState` (its own `shell-empty` ids nest inside)
wrapped in `<div data-testid="sets-empty">`: heading `sets_empty_heading`, body
`sets_empty_body`, action slot a core **secondary** Button `sets_empty_action` moving focus to
`set-name-input` (it does not unmount itself, so no focus target is destroyed — the S-Audit
ruling). Secondary and not ghost: inside the empty state's centred column a ghost Button
carries no border and no fill, so the one control the state exists to offer reads as a third
line of body copy; the border and surface say it is pressable without taking the create door's
primary weight (R-UI-001's scarcity, R-UI-010). For a reader without `PIN_SET` the action slot instead holds the `set-drawings-link`
idiom pointing at the sheet index, since naming a set is not theirs to do — and, by I-360 point 3,
carries the `set-drawings-link` id itself.

### The set browser

`<div data-testid="set-browser" data-set={setId}>`, same column. Header **track** — ONE row
(flex, baseline, gap `var(--space-4)`, amended by I-286): `<h1 data-testid="set-heading">` the
set name verbatim (`var(--text-20)`), the caption `sets_set_caption` (one line, clipped), then
the way back to `setsRoute(…)`, label `sets_sets_link` (no test id — found by role and name), in the
evidence-link idiom. *Amended by I-360 point 3:* the header's `<a data-testid="set-drawings-link">`
to `drawingsRoute(…)` is gone — the breadcrumb's **Drawings** crumb is that way — and
`sets_sets_link` leaves too once `routes.ts` gives the trail its **Drawing sets** step.

**Drawings in this set** (`<section aria-labelledby>`) — a head track of one row: `<h2>`
`sets_members_heading` beside its hint `sets_members_hint`; then the GRID (I-286).
`<div data-testid="set-drawings" data-rows-rendered={drawn}>` is the region a retrying read
waits on — the id the contract already named, now on the frame around the grid rather than on
a `<ul>` — and its frame takes every row the column leaves, at least `calc(var(--row-h) * 6)`
deep (I-324, amending I-286's eighteen rows whatever the project holds). Inside it one
`DataTable` (`tableId` `s-drawings-set-members`, `density="compact"`, `getRowId` the drawing
id, `aria-labelledby` the `<h2>`, `rowTestId` `set-drawing`, `rowDataOf`
`data-drawing={drawingId}` `data-member="true|false"`
`data-current-sha256={current.sha256}`), one row per lineage in the module's order, four
columns (three where the reader may not pin):

- **Drawing** (`sets_col_drawing`, 280 px, I-324) — the frozen key column, so it is each row's
  `rowheader`: `<span data-testid="set-drawing-name">` the stored presented name verbatim
  (`var(--weight-body-medium)` `var(--ink)`, never wrapping).
- **Revisions** (`sets_col_revision_count`, 96 px, I-324) — `<span
  data-testid="set-drawing-revision-count">` the figure through `formatUserFigure`,
  right-aligned and tabular.
- **Revision history** (`sets_col_revision_history`, 320 px, I-324) — one run that never wraps
  (`cx-sets-revision-run`, gap `var(--space-4)`; the cell clips it and the table's own tooltip
  says the rest), holding one `<span data-testid="set-drawing-revision"
  data-revision={revisionId} data-sha256={sha256} data-ordinal={ordinal}
  data-current="true|false">` per revision, oldest first: the ordinal in `var(--font-mono)`
  `var(--text-12)` `var(--ink-muted)` `tabular-nums slashed-zero`, min-width 24 px so ordinals
  column-align; the sha256 as one IdChip (I-95, I-107); then `sets_revision_current` or
  `sets_revision_superseded` in `var(--font-ui)` `var(--text-12)`, `var(--ink)` for the
  current one at `var(--weight-body-medium)`, `var(--ink-muted)` otherwise.
- **In this set** (`sets_col_member`, 160 px) — a CONTROL WELL (`meta.control`) holding
  `<Button data-testid="set-member-toggle" data-drawing={drawingId} aria-pressed={member}
  class="cx-set-member-toggle">`, variant `ghost` in both states (I-360 point 4; was `secondary`
  when a member), reading the state first — `sets_member_in` / `sets_member_out` in a
  `cx-set-member-state` span — then the verb `sets_member_remove` / `sets_member_add` in a
  `cx-set-member-verb` span, the two at the well's two ends; `aria-label` `sets_member_remove_label` /
  `sets_member_add_label` filled
  with the drawing's name. A press calls `toggleMember` at once (I-96); the row's
  `data-member`, the state, the verb and the pressed state move together. The COLUMN is not built at all
  for a reader without `PIN_SET` (I-101) — an empty well would still be a column.

Where the project holds no drawings the grid stands with its header and no rows, and directly
under it — inside this region, so it is read where the void is — `<p class="cx-sets-silence">`
`sets_members_none` (`var(--text-12)` `var(--ink-muted)`, the hint idiom). It carries no test
id and is no second empty state: I-97's one `set-empty` element stands in the column, and this
line is what R-UI-020 owes a region that would otherwise be silent (I-104).

Below it the region's **answer slot** `<div class="cx-sets-answer cx-shell-live">`: exactly one
RefusalState, the code `toggleMember` answered. Every answer slot and status line on both
screens wears the shell's shipped `cx-shell-live`, which takes an empty one out of flow and
never out of the tree — the rule has one home and is worn, never re-spelled (B-17).

**Pin this set** (`<section aria-labelledby aria-describedby>`, in the side column by I-324) —
`<h2>` `sets_pin_heading`, hint `sets_pin_hint` as the section's description, clipped from sight
(I-324), then a core Button `data-testid="set-pin"`, variant `secondary`, label
`sets_pin_submit`, `align-self: start` (the act colour lives on the dialog's confirm alone,
R-UI-001's scarcity); while the pre-check is in flight it takes core's loading state and
`<p role="status" aria-live="polite">` reads `sets_pin_pending` — and nothing else, ever: a
commit re-reads the screen from the server, so a post-commit sentence written into this region
is discarded with the document before it can be announced, and the answer to a pin is the new
pinned revision standing at the top of the list (I-105). The status line wears `cx-shell-live`,
so while it is empty it is out of flow and never out of the tree. Below it the pin region's own
**answer slot** (I-103), worn the same way. The whole section is absent for a reader without
`PIN_SET`.

Then, in the column and not inside that section, when it applies:
`<div data-testid="set-empty" data-cause="no-drawings|no-members|no-revisions">` wrapping one
`ShellEmptyState` — heading and body per §3's cause table, action slot the `set-drawings-link`
idiom for `no-drawings` (carrying the `set-drawings-link` id itself, I-360 point 3) and, for the other
two, the `sets_sets_link` idiom back to the sets
index (there is nothing to press that pins a set with no members). It renders whether or not
this reader holds `PIN_SET`, and its own heading is nobody else's region's (I-97).

Pressing `set-pin` opens the one ConsequenceDialog (`actType: "PIN_DRAWING_SET"`, injected
`preview`/`commit` closing over the set key), which renders through the shipped `SUBJECTS`
arm: one row per member of the union of current members and the last manifest's members,
label the drawing's name, before and after the cited sha256 values verbatim — 64-hex runs the
dialog's own mono columns already wrap. On `onCommitted` the dialog closes, focus returns per
the primitive, the screen refreshes, and the new pinned revision standing at the top of the
list is the answer.

**Pinned revisions** (`<section aria-labelledby aria-describedby>`, in the side column by I-324) —
`<h2>` `sets_revisions_heading`, hint `sets_revisions_hint` (I-98) as the section's description,
clipped from sight (I-324), then — where the set has never been pinned, in the list's place —
`<p class="cx-sets-silence">` `sets_revisions_none` (I-104), and otherwise
`<ol data-testid="set-revisions">` (list-style none, margin
0, padding 0), one `<li data-testid="set-revision" data-set-revision={setRevisionId}
data-digest={digest} data-current="true|false">` newest first: padding `var(--space-3)`, fill
`var(--surface-panel)`, border `var(--hairline)`, radius `var(--radius-8)`, column flex, gap
`var(--space-2)`, `var(--space-3)` between cards. Head line: `sets_revision_current` /
`sets_revision_superseded` (`var(--text-12)`, weights and greys as above), then the label
`sets_revision_digest_label` (**Pin fingerprint**, the index column's own words, I-360 point 1) and
`<span data-testid="set-revision-digest">` — the digest
character-for-character, `var(--font-mono)` `var(--text-12)` `var(--ink-secondary)`
`tabular-nums slashed-zero`, whole, wrapping, select-all (I-99). Then `<ul>` of citations, one
`<li data-testid="set-revision-member" data-drawing={drawingId} data-revision={revisionId}
data-sha256={sha256}>` per manifest member in the manifest's canonical order: the member's
name (`var(--text-12)` `var(--ink)`) then its sha256 whole in `var(--font-mono)`
`var(--text-12)` `var(--ink-muted)`, wrapping, select-all.

For a reader without `PIN_SET`, one banner-surface RefusalState from the registered
`PERMISSION_NOT_HELD` stands directly under the header block on both screens, preceded by
`<p>` `sets_denied_permission` and `<p>` `sets_denied_holder` (`var(--text-13)`
`var(--ink-secondary)`, gap `var(--space-2)`), evidence `{ href: the project's participants
route, label: sets_evidence_participants }`.

## 2. States (R-UI-050), ruled cell by cell

Declared in `states.ts` beside each page — exports `SETS_INDEX_STATES` and
`SET_BROWSER_STATES`, one row of seven cells each in the shell matrix's cell shape — and in
`src/ui/screen-states/matrix.tsx` under the keys `/t/[tenant]/p/[project]/drawings/sets` and
`/t/[tenant]/p/[project]/drawings/sets/[set]`, whose refusal cells are
`REFUSAL_ENTRIES.SET_NAME_NOT_USABLE` and `REFUSAL_ENTRIES.SET_NOT_PINNABLE` and whose
permission-denied cells are `PermissionDenied` naming PIN_SET.

- **Loading** — `loading.tsx` per route, frame intact, core Skeletons keeping the layout, gap
  `var(--space-3)`. Re-cut for the grids (I-285, I-286): one bone per TRACK, then the grid's
  own rows at the compact row height, so the shape that arrives is the shape that was held.
  Index: 24 × 360 px (the header track), 32 × 280 px (the create row), eight
  28 × min(720 px, 100 %) row bones. Browser: 24 × 360 px (the header track), eight
  28 × min(720 px, 100 %) drawing rows, 32 × 160 px (the pin door), three
  96 × min(720 px, 100 %) revision bones. Never a spinner (R-UI-004).
- **Empty** — index: `sets-empty`, whose one action names the first set. Browser: `set-empty`
  with its three causes (I-97). Both teach the next step and say why they are empty (R-UI-020).
- **Error** — a render, read or action fault surfaces the root error boundary
  (`src/app/error.tsx`), whose Decision rules retry and the report id.
- **Refusal** — the three answer slots (create, members, pin) and, once the dialog holds focus,
  its slot and its stale notice. Reachable codes: `SET_NAME_NOT_USABLE`,
  `SET_MEMBER_NOT_IN_PROJECT`, `SET_NOT_PINNABLE`, `PERMISSION_NOT_HELD`,
  `ACT_CHANGES_NOTHING`, `CONSEQUENCES_NOT_CARRIED` (the dialog's stale re-render) and
  `SIGNED_OUT`. Each renders in place with message, remedy and evidence; every door stays armed
  after a refusal.
- **Partial** — rendered, never hidden (I-98): a pinned revision cites members the set no
  longer names and revisions since superseded, and shows them exactly as pinned beside a
  members list that has moved on.
- **Offline** — delegated to the root error boundary (I-102): no live queue, so an action that
  cannot reach the server is a fault of reachability, not a banner.
- **Permission-denied** — the I-101 in-frame branch naming `PIN_SET` and its holders; a
  workspace the session does not hold is the shell's frameless denial before the route mounts;
  unauthenticated is the `/sign-in` redirect.

## 3. Copy, verbatim (`strings.ts`, keys `sets_…`)

`sets_heading` **Drawing sets** · `sets_caption` **A set names the drawings a campaign
measures. Pinning a set records exactly which revision of each drawing it holds.** ·
`sets_drawings_link` **Open this project's drawings** · `sets_sets_link` **See this project's
sets** · `sets_create_heading` **Create a set** · `sets_create_hint` **Give the set a name no
other set of this project carries. Which drawings it names is chosen on the set itself.** ·
`sets_name_label` **Set name** · `sets_create_submit` **Create set** · `sets_create_pending`
**Creating the set…** · `sets_list_heading` **Sets** · `sets_list_hint` **Newest set first. A pin
fingerprint names the exact revision of every drawing a set was pinned at.** (I-360; was **Newest set
first. The digest fingerprints the revision each set stands pinned at.**) · the two grids' column
headers (I-285, I-286): `sets_col_name` **Set** · `sets_col_members` **Drawings** ·
`sets_col_revisions` **Pinned revisions** · `sets_col_digest` **Pin fingerprint** (I-360; was
**Current digest**) · `sets_col_drawing` **Drawing** · `sets_col_revision_count`
**Revisions** · `sets_col_revision_history` **Revision history** · `sets_col_member` **In this
set** · `sets_row_digest_none` **Not pinned yet** · `sets_empty_heading` **No sets yet** · `sets_empty_body` **A set
names the drawings a campaign measures. Name the first one above, then choose its drawings on
the set itself.** · `sets_empty_action` **Name the first set** · `sets_set_caption` **Choose
the drawings this set names, then pin it to record the revision each one stands at.** ·
`sets_members_heading` **Drawings in this set** · `sets_members_hint` **Every drawing this
project holds is listed, whether or not the set names it. A drawing brings its sheets with
it.** · `sets_members_none` **This project holds no drawings yet, so there is nothing here for
this set to name.** · `sets_revision_current` **Current** ·
`sets_revision_superseded` **Superseded** · `sets_member_in` **In set** · `sets_member_out` **Not
in set** (both I-360) · `sets_member_add` **Add** · `sets_member_remove` **Remove** (I-360; were
**Add to set** / **Remove from set**) · `sets_member_add_label` **Add {drawing} to this
set** · `sets_member_remove_label` **Remove {drawing} from this set** · `sets_pin_heading`
**Pin this set** · `sets_pin_hint` **Pinning records a set revision: every member with the
revision it stands at now, and a fingerprint of that list. What is already pinned never changes.**
(I-360; was "a digest of that list")
· `sets_pin_submit` **Preview this pin** · `sets_pin_pending` **Working out what this pin
would record…** · `sets_revisions_heading` **Pinned revisions** · `sets_revisions_hint` **Newest
first. A pinned revision cites every member it held — including a drawing the set no longer
names, and the revision a member stood at then — and never changes afterwards.** ·
`sets_revisions_none` **This set has never been pinned, so it cites nothing yet.** ·
`sets_revision_digest_label` **Pin fingerprint** (I-360; was **Manifest digest**) ·
`sets_empty_no_drawings_heading` **No
drawings to name yet** · `sets_empty_no_drawings_body` **This project holds no drawings, so
this set can name none. Add one on the drawings screen; it is listed here as soon as it is
stored.** · `sets_empty_no_revisions_heading` **Nothing pinned yet** ·
`sets_empty_no_revisions_body` **Add drawings to this set, then pin it. Pinning records the
revision each member stands at, and that record never changes.** ·
`sets_empty_no_members_heading` **This set names no drawings now** ·
`sets_empty_no_members_body` **Its pinned revisions stand exactly as they were pinned. Add at
least one drawing before pinning this set again.** · `sets_denied_permission` **Creating a
set, changing what it names and pinning it need the PIN_SET permission on this project, and
your account does not hold it.** · `sets_denied_holder` **This project's principals and leads
hold it; a principal grants it on the participants screen.** · `sets_evidence_participants`
**Open the project's participants** · `sets_evidence_reload` **Reload this project's sets** ·
`sets_evidence_set` **Reload this set**.

Evidence by code: `SET_NAME_NOT_USABLE` → `{ setsRoute(…), sets_evidence_reload }` ·
`SET_MEMBER_NOT_IN_PROJECT`, `SET_NOT_PINNABLE`, `ACT_CHANGES_NOTHING` →
`{ setRoute(…), sets_evidence_set }` · `PERMISSION_NOT_HELD` → the participants route with
`sets_evidence_participants` · `SIGNED_OUT` → `{ "/sign-in", shell_evidence_sign_in }`.

Registry copy this increment fixes (`src/core/errors.ts`, mirrored word for word in
`REFUSAL_ENTRIES`; the refusal-state §3 copy rules binding), all severity **error**, surface
**inline**:

- **SET_NOT_PINNABLE** · message **This set names no members of this project, so no revision
  was pinned.** · remedy **Add at least one drawing to the set, then pin it.**
- **SET_NAME_NOT_USABLE** · message **The set name is blank or already names a set of this
  project, so no set was created.** · remedy **Give the set a name no other set of this
  project carries.**
- **SET_MEMBER_NOT_IN_PROJECT** · message **That drawing is not one of this project's, so the
  set was not changed.** · remedy **Reload the set and toggle a drawing the project holds.**

`src/ui/strings/screen-states.ts` mirrors, word for word (ARCH-01 bars `src/ui` from importing
the route table): `state_empty_sets_heading` ≡ `sets_empty_heading` ·
`state_empty_sets_body` ≡ `sets_empty_body` · `state_empty_sets_action` ≡ `sets_empty_action`
· `state_empty_set_heading` ≡ `sets_empty_no_revisions_heading` · `state_empty_set_body` ≡
`sets_empty_no_revisions_body` · `state_denied_sets_permission` ≡ `sets_denied_permission` ·
`state_denied_sets_holder` ≡ `sets_denied_holder` · `state_sets_evidence_reload` ≡
`sets_evidence_reload`. Matrix-only: `state_partial_sets` **A pinned set revision cites every
member it held, including a drawing the set no longer names and a revision since superseded;
those citations are shown exactly as they were pinned, never recomputed.**

RETIRED by I-285 and I-286, and kept DECLARED in `strings.ts` word for word so a reader of the
table by key still finds what this section fixed — `sets_row_members` **{count} drawings** ·
`sets_row_revisions` **{count} pinned revisions** · `sets_row_digest_label` **Current
digest** · `sets_revision_count` **{count} revisions**. Each was a count line of a card; the
figure is a column of its own now and the label is that column's header, so nothing renders
them. RETIRED by I-360 on the same terms: `sets_col_open` **Open** and `sets_open` **Open set** — the
set's name is the row's door, so the Open column is gone. A retired key is deleted by the increment
that proves no suite reads it.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary in prose.
Digests, sha256 values, ordinals, drawing names and the act type are data and render verbatim
as data (I-25's class), never woven into sentences. `PIN_SET` in the denial copy is the
permission's own name (L-ACT-03), rendered as the identifier it is.

## 4. Motion (R-UI-004)

Nothing here animates beyond the inherited idioms: the member toggle's fill, text colour and
the link colours transition over `var(--motion-state)` `var(--ease)`; the Skeleton pulse, the
reticle draw, core Button's states and the ConsequenceDialog's entrance live in their single
homes. A row's membership flip, a new pinned revision and every refusal mount with no
entrance — an answer arrives instantly, and theatre in front of an immutable record reads as
persuasion. No bounce, no spinner. Every duration is a token zeroed at source under reduced
motion, so `sets.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

The semantic aliases `--ink`/`--ink-secondary`/`--ink-muted`/`--ink-link` · `--accent` ·
`--surface-panel` · `--hairline` · `--space-2/3/4/6` · `--gap-section` · `--radius-8` ·
`--text-12/13/16/20` · `--font-ui`/`--font-mono` · `--leading-ui` ·
`--weight-body-medium`/`--weight-heading` · `--weight-body` (the membership well's resting state,
I-360) · the density tokens `--row-h`, `--control-h` and
`--cell-px` · (`--breakpoint-lg`, the browser's page measure, is no longer read: I-360 point 5) ·
`--motion-state`/`--ease`. Px literals, closed set (core I-1's mandated class): the 280 px
name field, the 24 px ordinal column, the two grids' column widths — 320/120/160/220 on
the index (the Open column's 140 left with it, I-360) and 280/96/320/160 on the browser (I-324), which are the tables' own `size` and are
spelled beside the columns, never in the stylesheet — the browser's 280 px side column (I-324) — and
the skeleton bones 24/28/32/96 ×
160/280/360/720. Any other literal is a defect. No copper appears on either screen — it lives only on the ConsequenceDialog's
confirm, where its own Decision puts it — and no basis colour appears at all: a revision is
not a basis.

## 6. Themes

`sets.css` contains no `[data-theme]` selector; every light/dark difference arrives through
token values (R-UI-001). Contrast holds on the founder values in both themes: graphite-600,
700 and 900 on graphite-0 and on the revision cards' graphite-50 clear 4.5:1 (the mono 12 px
digest included — size earns no carve-out); beam-600 links clear 4.5:1 and stay underlined, so
they never ride colour alone; the pressed member toggle is core Button's own secondary paint
plus a changed label, so membership survives greyscale. The semantic tints inside a refusal
card are RefusalState's own.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenantId}/p/{projectId}/drawings/sets` and
`/t/{tenantId}/p/{projectId}/drawings/sets/{setId}`; both link to
`/t/{tenantId}/p/{projectId}/drawings`. Server actions: `createSet`, `toggleMember`,
`previewPin`, `commitPin` in `sets/actions.ts`.

Test ids, exactly the contract's, on the elements ruled in §1 — index: `sets-index` ·
`set-row` (`data-set`, `data-name`) · `set-row-name` · `set-row-digest` (`data-digest`) ·
`set-open` (on the name's link in the key column since I-360) · `set-create-form` ·
`set-name-input` · `set-create` · `sets-empty`. Browser:
`set-browser` (`data-set`) · `set-heading` · `set-drawings-link` (on the empty states' link to the
sheet index since I-360, both screens) · `set-drawings` ·
`set-drawing` (`data-drawing`, `data-member`, `data-current-sha256`) · `set-drawing-name` ·
`set-drawing-revision-count` · `set-drawing-revision` (`data-revision`, `data-sha256`,
`data-ordinal`, `data-current`) · `set-member-toggle` (`data-drawing`) · `set-pin` ·
`set-revisions` · `set-revision` (`data-set-revision`, `data-digest`, `data-current`) ·
`set-revision-digest` · `set-revision-member` (`data-drawing`, `data-revision`,
`data-sha256`) · `set-empty` (`data-cause`) — plus the mounted patterns' own: RefusalState's
four, ConsequenceDialog's five, ShellEmptyState's two. No others are added; the counts lines,
the status lines, the back link and the empty actions are found by role and name.

Behavioural hooks without new ids: `aria-pressed` on every `set-member-toggle` and the
`aria-label` naming its drawing; `role="status"` with `aria-live="polite"` on the create and
pin status lines; a visible `<label for…>` on `set-name-input`; `cx-reticle` on every button,
input and link; `aria-busy` on a door awaiting its answer; `set-row-digest`'s text equal to its
`data-digest` and `set-revision-digest`'s text equal to its `data-digest`, character for
character (I-99); exactly one `set-empty` in the DOM at a time (I-97); the absence of
`set-create-form`, `set-member-toggle` and `set-pin` for a reader without `PIN_SET`, asserted
rather than assumed.

jsdom acceptance (AC-5, `@testing-library/react` + `user-event`, injected data and actions)
mounts `SetsIndex` and `SetBrowser`: the row and card anatomy with every data-attribute, the
digest and none-line, the three `set-empty` causes and their precedence, the toggle's single
call and flipped state, the pin's pre-check refusal in place with no dialog opened, the dialog
handoff carrying `PIN_DRAWING_SET` and the set key, and the denied branch. `pnpm verify` and
the three new codes named by their registries in `tests/takeoff/sets/refusals.test.ts` (Q-07).

Journey `tests/e2e/journeys/j-012-sets.spec.ts` (no page object added, no worker spawned,
locators in a local `S_SETS` const), checkpoints **j-012-set-created** · **j-012-set-pinned**
· **j-012-revision-added** · **j-012-repinned** exactly as the increment spec words them, axe
serious/critical = 0 at each, never widened (Q-11). No `toHaveScreenshot` baseline is taken:
every fact these screens are graded on is a digest, an ordinal or a sha256 that changes per
run, so a picture would be masked down to chrome the gallery already covers (B-20: no existing
baseline, token, copy or contract moves). `pnpm e2e --journey J-000` still exits 0.
