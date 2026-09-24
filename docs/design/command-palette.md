# Design Decision — command palette (⌘K, over every `/t/{tenant}/**` screen)

The pattern `src/ui/patterns/command-palette` (`CommandPalette`, `ShortcutSheet`,
`CommandPaletteProvider`) and its top-bar occupant `CommandPaletteTrigger`
(`src/ui/shell/command-palette-trigger.tsx`, `data-testid="shell-command-palette"`), standing over
every `/t/{tenant}/**` address. Increment inc-217-command-palette. Law: R-SPINE-050, R-UI-001/003/
004/005/010/011/012/020/030/031/032/050/060, ARCH-01, B-17, B-19, C-05, Q-11. This Decision amends
`docs/design/shell.md` §1 for one occupant only (I-135) and rules nothing else about the bar; the ?
sheet is `docs/design/shortcut-sheet.md`, which this file cites and never re-decides. Every
convention of the earlier Decisions binds: `cx-` classes, tokens-only colour and motion, `cx-reticle`
solely from its single home, no `[data-theme]` selector in authored CSS; Interpretations I-1–I-134
remain in force. Chrome comes only from shipped primitives — overlay Dialog, core Input, Button, Kbd,
Skeleton, Tooltip, the one RefusalState — plus the `cx-palette-*` classes ruled here. Chrome copy is
`src/ui/strings/command-palette.ts` (keys `command_palette_…`); item and group copy arrives in props
(§3). JSX carries no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-135 — shell I-15 is amended: ⌘K's owner has arrived.** The top bar's right-hand cluster
  (`cx-shell-topbar-end`) now holds, in this document and tab order, `<CommandPaletteTrigger />`,
  then `<JobsTray />`, then the user menu — R-UI-030's own order. Notifications and the project
  switcher remain absent under I-15 unchanged, and nothing reserves space for them. Like the tray
  (I-116), the trigger is provider-gated: it renders `null` outside a `CommandPaletteProvider`, so a
  bare `ShellTopBar` mount and the shell gallery entry stand exactly as they are.
- **I-136 — no cmdk; the combobox is hand-rolled over the shipped Dialog, which is not restyled.**
  The palette is `DialogContent` at the primitive's own `min(480px, …)` measure, `var(--space-5)`
  padding, entrance and focus handling; the list is bounded (§1) so the Dialog's own overflow never
  engages. Neither this surface nor the ? sheet renders a `DialogClose` ✕: both are opened by a key
  and dismissed by Escape or the scrim, and a ✕ on the input's line would be a control competing with
  the first thing a person types into.
- **I-137 — focus stays in the input, so the reticle is drawn there.** WAI-ARIA's combobox keeps DOM
  focus in the text field and moves `aria-activedescendant`; an option therefore never matches
  `:focus-visible`, and painting reticle geometry on an element that does not hold focus would be a
  second indicator telling a reader something untrue (R-UI-012, B-17 — focus CSS has one home).
  The `j-021-palette-open` checkpoint's "focus reticle visible" is satisfied on
  `command-palette-input`; the active option is marked by the frame's own selection idiom — beam-100
  fill plus the weight shift (§1), a second channel that survives greyscale.
- **I-138 — an unavailable row is an option with its reason in place, never a disabled control, and
  availability is read rather than written.** Everything the tenant cannot reach today is listed and
  says why beside its label (R-UI-020: silence never happens, and an empty list says why it is
  empty). The rows stay arrow-reachable and carry `aria-disabled="true"`; Enter on one navigates
  nothing, closes nothing and announces nothing new — the answer was already on the row before the
  press. Availability is never a field written beside a row: an area's is read off its
  `PROJECT_AREAS.route`, an action's off its `PALETTE_ACTIONS.run`, a shortcut row's off its scope and
  action (§1) — the day a screen or an act lands, the row becomes reachable by gaining an address and
  nothing else changes (the `PROJECT_AREAS` law, I-126).
- **I-139 — the project-areas group always renders, project or not.** Outside a project every area
  row is unavailable with `command_palette_reason_no_project`; inside one, the four unbuilt areas
  carry `command_palette_reason_area_unbuilt`. A group that vanishes with context teaches a person
  that their workspace has fewer parts than it has.
- **I-140 — a chord is drawn only after a gesture.** `chordOf` reads the platform, which the server
  cannot know; a keycap rendered in the bar at first paint would either hydrate differently on an
  Apple machine or freeze the Control form as a lie. The trigger therefore wears no keycap: it states
  its key to assistive technology on `aria-keyshortcuts` and to the eye in its Tooltip, which mounts
  on hover or focus. The palette's shortcut rows, the footer and the ? sheet draw `chordOf` freely —
  none of them exists before a person acts.
- **I-141 — recents are this browser's, per workspace, and only answer a blank query.** The provider
  stores the last eight selections under `cubit.palette.recents.<tenantId>` in `localStorage`,
  newest first, deduplicated by route. With a query typed the group is absent — the list is answering
  the query. Storage that throws or is unavailable simply yields no recents: it is never a fault and
  never a refusal, and no recent item is ever a row the reader cannot reach.
- **I-142 — the refusal entry is read from the ui-side register, and a refusal beside rows is
  partial.** ARCH-01 forbids a value import of `src/core`, so the code prop resolves through
  `REFUSAL_ENTRIES` (`src/ui/screen-states/refusal-entries.ts`); reachable codes are exactly
  `SIGNED_OUT` and `WORKSPACE_PERMISSION_NOT_HELD`. Surface is the registry's, never overridden
  (refusal-state I-8), and the palette adds no chrome around the card. `status="refused"` renders it
  in the list's place; a `refusal` arriving *beside* groups that hold rows is the partial state — the
  rows stand and the card sits under them (R-UI-050: shown, not hidden).
- **I-143 — the error cell gets one optional prop, not a fifth status arm.** `status` is fixed at
  `idle | loading | empty | refused` and names no fault; R-UI-050 still owes retry and a report id.
  The props gain exactly `fault?: { reportId: string; onRetry(): void }`, rendered in the list's
  place and outranking `status`. Renaming or widening `status` would move a name the spec fixed.
- **I-144 — the palette is portalled outside `shell-root`, so its rows keep the comfortable
  height.** `data-density` lives on `shell-root` (density-and-prefs I-35) and every overlay portals
  to `document.body`, so a `[data-density]` re-key here would resolve against nothing. R-UI-005's two
  row heights govern tables and rows of data; the palette's options stand at `var(--row-comfortable)`
  in both modes, and the preference is not copied into a second, unreachable home (B-17).

**Amended by SRCH-1 (session 8: R-SPINE-052's first cut — "⌘K finds sheet text and register marks,
and opens the viewer on them"; walk-0's "C2 finds nothing").** Law read with R-SPINE-050/052, R-TO-016,
L-CAD-02/03/05, L-CAD-07, L-ACT-03, I-179, I-421, I-142. The index is
`src/modules/takeoff/sheets/text-index.ts`; the door `src/server/spine/search.ts`.

- **I-626 — R-SPINE-052's "full-text" is a match on whole words, case-insensitively, in order.**
  A text's WORDS are its whole runs of letters and digits, upper-cased (`wordsOf`, the one spelling
  the index and a query share); a query matches where all of its words stand in order and next to
  each other inside one paragraph. No stemming, no prefix, no substring: F-RCC6-BNBC says `C3` as a
  substring in far more texts than it says it as a word, and the first of them are `PC3` — a pile cap
  answered for a column is the partial faulty answer the law forbids. The price is that a word is
  found once it is typed whole ("COLU" finds no text; the names still answer as they always did).
  Punctuation is no word, so `f'c = 3500 psi` is found by `3500 psi` and `50d` by `50d`.
- **I-627 — what "sheet text" is, and the key each is found under.** Every text a sheet shows as
  words: an original TEXT or MTEXT under its own key; a block ATTRIBUTE under its block reference's
  key (an attribute is no entity of its own, L-CAD-03 — this is how S-23's title block, whose sheet
  title is an attribute, is found); and derived text a block reference or a dimension painted, under
  the key of the original that painted it — the key the viewer holds that paint by. An MTEXT is read
  as its paragraphs with its codes stripped (`mtextLines`, core's one home of an MTEXT code) and every
  `%%` code resolved (`normaliseNotation`); spacing reads as one space. What one key says twice — a
  title block paints `DATE` twice — is ONE entry. An attribute DEFINITION is not indexed: it is the
  template a reference fills, not what the sheet says. Over F-RCC6-BNBC that is 4,292 texts, and
  "LIFT CORE" answers eleven: the ten TEXT entities the session-8 map counted, and S-23's title-block
  attribute. Each text stands on the sheet core's one resolver names (`sheetOfKey`, VD-1): the paper
  sheet it was drawn on, else the one sheet whose windows frame it (the seven model-space "LIFT CORE"
  labels land on S-13, S-14, S-15 ×2, S-19, S-20 and S-21), else model space. A block reference drawn
  in MODEL space carries no points of its own, so core stands it on model space until core places a
  reference by its paint — its text is found there, and opens there (owed, §8). A KEY IS FOUND ONCE:
  a key is what a find opens, and one key may say several different things — a title block's
  reference paints `SHEET TITLE`, `SHEET NO.` and `JOB NO.` under its one key — so a query answers
  each key once (`findInIndex`), by the text that says exactly what was asked, else the first drawn.
  Answering each text would list rows that read alike and open the same selection: over F-RCC6-BNBC,
  "SHEET" found 57 texts under 30 keys, and "NO" and "REV" likewise. (A paragraph ordinal in the row
  key would have kept the twins apart, and still listed two ways to one place.)
- **I-628 — two finds, `mark` and `text`, each opening the viewer ON what it names.** Inside a
  project the navigate group gains the register's marks and the sheets' texts beside the names. A
  `mark` find is a mark the register holds that IS what was typed, compared as the drawing's marks
  are (`dotlessUpper`, L-CAD-07: `c-2` is `C2`, and `C2` is never `C21`), over the campaign the
  register renders (the project's latest), without the rows a person struck (I-173); one find per
  mark, class and sheet, counting the rows standing on that sheet and selecting every member's
  outline and mark there — placed by the Trace's one reading of a named entity (`entitySelectionOf`
  over the revision's pinned records, core's `pinnedRecordsIn`, I-421/I-422), never a second one:
  the very selection the register's queue rows and the coverage residue open (I-632). Only
  the drawings that place in the named rows' views are read for that (`drawingsPlacingIn`): a placement key begins with its view's key (L-REG-04), so
  no other drawing can hold one, and reading every drawing of a large set would re-read and re-validate
  graphs past the four `artifactAt` keeps each time a mark is typed, retiring the ones the viewer and
  the Trace hold. A `text` find is one indexed key (I-627), labelled with what it
  says — as much of a long paragraph as one row shows, around the words asked for, marked with an
  ellipsis where it was cut. Both open `selectionAddress` on the sheet core named, with no camera, so
  the viewer selects and flies (s-viewer-inspector I-85): a model-space key standing on a paper sheet
  is held there through its window, which J-000's register leg already walks on S-10. A find no sheet
  shows leads where it can be read — a mark to the register, a text to the drawings. The second line
  is composed in the app layer from §3's copy and the format seam — the class through `humaniseEnum`,
  the count through `formatUserFigure`, the sheet by its NUMBER (I-179), "Model space" in words —
  never a sentence of the server's. A row's key names where it leads (kind, project, drawing, set,
  layout, and a find's source key), and the host keeps ONE row per key (`rowsOfHits`), the first hit
  standing for it: the pattern names an option by its key (`optionId`, `aria-activedescendant`), and
  two rows keyed alike would be one option twice — React drops one, the arrows cannot pass the pair,
  and axe reads a duplicate id. The door already answers a text once per key; the host holds the rule
  for every answer.
- **I-629 — the project is named by the address and judged by the one guard; a person not on
  it is refused BY NAME beside the names.** `shell-frame.tsx`'s one reading of the pathname
  (`projectOf`) is handed to the host, which asks `spine.search` with `{ tenantId, query, projectId }`.
  The door judges the workspace as before (a stranger is refused `WORKSPACE_PERMISSION_NOT_HELD`,
  thrown), then the project as a participant's read (`authorize({ participation: true })`, the
  question every project read asks). A workspace member who is not on the project — or who names a
  project their workspace does not hold — is answered the workspace's names with
  `refusal: PERMISSION_NOT_HELD` BESIDE them, and nothing of the project is read: the names are theirs
  to read, so refusing them too would take away what the palette always answered; the palette renders
  the registered card under the rows (I-142's partial state). I-142's reachable codes therefore gain
  `PERMISSION_NOT_HELD`, whose card the pattern already renders from the ui-side register with the
  workspace home as its evidence (§2's rule for every code that names nowhere better). The order is the names, then marks,
  then texts, all inside `SEARCH_LIMIT` (20): a project's name is painted into every title block of
  its drawings, so words ranked first would bury the project a person asked for under its own sheets.
  Texts rank a text that says exactly what was asked first, then the project's drawings in order,
  each drawing's sheets in its inventory's order with model space last, then the order they were
  drawn in.
- **I-630 — the input says what it searches.** Inside a project the placeholder reads
  `command_palette_placeholder_project`; at a workspace address it reads the names as before. The
  provider already takes `projectId` (§1); it now publishes WHETHER it stands inside one
  (`withinProject`), and nothing else of it.
- **I-631 — the index is kept apart from the graphs, and the sheet leg reads no artifact.** An
  index is kept per (tenant, content hash), 32 of them, the least recently asked retiring first, and
  built once from the validated graph (`textIndexAt`, beside `artifactAt`'s four graphs). Measured over
  the Edison set's five artifacts (structural, electrical, plumbing and the two minimal sets; 562 MB
  of JSON, 17,772 texts): the first search reads and validates all five in 3.3 s, every search after
  it answers in under a millisecond with no artifact read, and the five indexes hold 11 MB where the
  four kept graphs hold 926 MB. The same walk through the artifact cache alone costs 3.1–3.5 s on EVERY
  search, because five drawings cycle through four slots — which is what the sheet leg paid through
  `sheetIndexOf` (each artifact read twice, plus every raster row). The sheet leg now reads each
  drawing's sheet names off its stored record (`layoutNamesOf`, core's one reading of the record's
  inventory), which answers the same cards in the same order and reads no artifact — proven live
  card for card against `sheetIndexOf` (`tests/spine/search-text.test.ts`).

- **I-632 — a mark opens the viewer on the member, proven over F-RCC6-BNBC as the product stores
  it; the order of the pin and the placements is not a cause.** Session 8 reverted SRCH-1 on the
  suspicion that a stage pinning its revision before writing the members' placements left the pinned
  record without them, so a mark find came back with no drawing, sheet or selection. Placements are
  read off the record's own rows at the moment of the search (`pinnedRecordsIn` reads `placements` by
  the pinned ingest), so WHEN they were written against the pin cannot matter, and the db lane shows
  it: `tests/spine/search-bnbc.test.ts` stages BNBC through the shipped CLI, ingest and partition
  jobs, pins the set, inserts the proposed storeys and partitions AGAIN — every placement row written
  after the pin — and ⌘K `C2` answers one mark find on S-10 (the drawing, the sheet `S-10 COLUMN
  LAYOUT PLAN`, eight register rows, the sixteen outlines and marks of its eight members), with the
  members' painted labels found as text on the same sheet; SRCH-1's own mark leg passes the same test.
  The journey that failed did not fail on the mark: its log (session 8, `gate-4`, `e2e-pics4`) stops
  at the SECOND step — the text find, chosen from the viewer the mark had opened, waiting six minutes
  for the address to name the text. That step stays in J-021 as written and is walked by the
  orchestrator; its cause is not proven here (§8). The mark leg now asks `entitySelectionOf` rather
  than composing `traceCitations` itself, so the sheet and the kept keys are the Trace's one reading
  (a key that does not stand on the member's sheet is left out, as every other opener leaves it).

**Recorded Objection (ownership).** The roster's `label: StringKey` and AC-3's `strings[entry.label]`
require the copy in §3 to reach the one table, so this increment must also own
`src/ui/strings/command-palette.ts`, `src/ui/strings/shortcuts.ts` and the two import-and-spread
lines they need in `src/ui/strings/index.ts`. The ownership list names none of them. Nothing else is
claimed; if a hook denies those paths the Builder raises this Objection and stops rather than
inventing a second string home.

## 1. Layout and hierarchy

**Trigger** (`src/ui/shell/command-palette-trigger.tsx`, exported from the `src/ui/shell` barrel as a
bare identifier). The shipped Tooltip over the core ghost Button:

```
<button class="cx-btn cx-palette-trigger cx-reticle" data-variant="ghost"
        data-testid="shell-command-palette" aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K">
  <span class="cx-palette-trigger-glyph" aria-hidden="true">…12 px magnifier…</span>
  <span class="cx-palette-trigger-label">{strings.command_palette_trigger}</span>
</button>
```

Height and padding are the Button's; the row is inline flex, gap `var(--space-2)`, min-inline-size
160 px so the bar's geometry does not jump between screens. Glyph: inline SVG, 12 px, stroke
`var(--graphite-600)` at 2 px (the shell's chevron class). Label `var(--text-13)`
`var(--graphite-700)`, hover `var(--graphite-900)` — the bar's own size wins by naming `.cx-btn`
beside the class (shell §1). No `aria-label`: the visible word *Search* is the accessible name
(WCAG 2.5.3). Tooltip content: `fill(strings.command_palette_trigger_tooltip, { keys: chordOf(…) })`
(I-140). Activation opens the palette; focus returns here on close.

**Dialog.** `DialogContent` carries `data-testid="command-palette"`,
`aria-label={strings.command_palette_label}` and class `cx-palette` (column flex). Inside, in order:

- **Input** — the core Input, `data-testid="command-palette-input"`, `class="cx-input cx-reticle
  cx-palette-input"`, `role="combobox"`, `aria-expanded="true"`, `aria-controls` the list's id,
  `aria-activedescendant` the active option's id (absent when no option is active),
  `aria-autocomplete="list"`, `autocomplete="off"`, `aria-label={command_palette_input_label}`,
  placeholder `command_palette_placeholder` — `command_palette_placeholder_project` while the
  palette stands inside a project (I-630). Full width, autofocused on open (AC-1).
- **Offline notice** — only when offline (§2): `<p role="status" class="cx-palette-notice">`, the
  house notice chrome (`var(--info-surface)` fill, `var(--hairline)` re-keyed
  `border-color: var(--info)`, `var(--radius-4)`, padding `var(--space-3)` `var(--space-4)`,
  `var(--text-13)` `var(--graphite-900)`), `var(--space-3)` below the input.
- **List** — `<div id data-testid="command-palette-list" role="listbox"
  aria-label={command_palette_list_label} class="cx-palette-list">`: `margin-block-start:
  var(--space-3)`, `border-top: var(--hairline)`, `padding-block-start: var(--space-2)`,
  `max-block-size: 320 px`, `overflow: auto`. Groups in the fixed order `recent · navigate · areas ·
  actions · shortcuts`; a group with no rows does not render.
- **Footer** — `border-top: var(--hairline)`, `margin-block-start: var(--space-3)`,
  `padding-block-start: var(--space-2)`, flex, space-between, `var(--text-12)`
  `var(--graphite-600)`. Left: `<p role="status" aria-live="polite" class="cx-palette-status">`,
  always mounted (§3's four status lines; empty while a fault stands). Right: a core ghost Button
  reading `command_palette_footer_shortcuts` with a trailing `<kbd class="cx-kbd">` holding
  `chordOf` of the roster's `shortcut-sheet` entry — activating it closes the palette and opens the
  sheet. No test id: found by role and name.

**Group** — `<div role="group" data-testid="command-palette-group" data-group={id} aria-labelledby>`
over a label row (`var(--text-12)` `var(--weight-body-medium)` `var(--graphite-600)`, padding-inline
`var(--space-3)`, padding-block `var(--space-2)`, `position: sticky; top: 0`, fill
`var(--graphite-0)` so rows scroll under it).

**Option** — `<div role="option" id data-testid="command-palette-item" data-kind data-available
aria-selected aria-disabled class="cx-palette-item">`, a four-column grid (`auto minmax(0, 1fr) auto
auto`), gap `var(--space-3)`, padding-inline `var(--space-3)`, min-block-size
`var(--row-comfortable)` (I-144), radius `var(--radius-4)`. Ids are
`cx-palette-option-{group}-{key}` with every character outside `[A-Za-z0-9_-]` folded to `-`.
Columns: the **kind** word verbatim (the enum value — `project`, `drawing`, `sheet`, `set`, `mark`,
`text`, `area`, `action`, `shortcut`), 10 px `var(--font-mono)`, letter-spacing 0.12em, `var(--graphite-600)`,
min-inline-size `var(--space-12)`, read as part of the option's name, never `aria-hidden`; the
**label** `var(--text-13)` `var(--graphite-900)`, single line, ellipsis; the **meta** (a hit's
project or drawing, ellipsised; a find's second line, composed per I-628:
`command_palette_meta_mark` / `_mark_unplaced` / `command_palette_meta_text`) `var(--text-12)` `var(--graphite-600)` — replaced by
`<span data-testid="command-palette-item-reason">` on an unavailable row; and, on shortcut rows only,
a `<kbd class="cx-kbd">` holding `chordOf(entry)`. Active (`aria-selected="true"`): fill
`var(--beam-100)`, label `var(--graphite-900)` at `var(--weight-heading)`. Unavailable: label
`var(--graphite-500)` (the ≥ 3:1 disabled floor; the words carry the meaning), `cursor: not-allowed`.
Pointer hover makes a row active — one active option serves mouse and keyboard.

**Keyboard.** Open: the first option is active. ArrowDown/ArrowUp move the active option across group
boundaries and wrap at both ends; Home/End jump; a query change re-activates the first option; Enter
activates (I-138 for unavailable rows); Escape closes and returns focus to `shell-command-palette`;
options are never tab stops.

**Wiring (ARCH-01).** `CommandPaletteProvider` (ui) owns open state, the query, the global key
handler, the chord buffer and recents, and takes `{ tenantId, projectId, search, navigate, children }`.
Addresses and transport are the app layer's: `PaletteHost`
(`src/app/(app)/t/[tenant]/palette/palette-host.tsx`, mounted by `shell-frame.tsx`) calls
`spine.search` with the project the address stands inside (I-629), maps each hit's kind through
`projectHomeRoute` · `drawingsRoute` · `viewerSheetRoute` · `setRoute` — and a find through the
Trace's `selectionAddress`, else `registerRoute` or `drawingsRoute` (I-628) — imported from their
route-address homes, keys each find's row by its own source key so a sheet's many texts are many
rows, and hands `navigate`. The global handler reads
`SHORTCUTS` and only `SHORTCUTS` (`docs/design/shortcut-sheet.md` §1): `Mod+K` and Escape are honoured
inside text fields, every other entry is ignored while one has focus; a `go` step opens its address
when the roster's target resolves, and otherwise opens the palette with that area's row active and its
reason showing (I-138/I-139).

## 2. States (R-UI-050), ruled cell by cell

Declared where the suite reflects over them (B-19): `COMMAND_PALETTE_STATES`
(`src/ui/patterns/command-palette/states.ts`), rows `command-palette` and `shortcut-sheet`, each
total over `STATE_NAMES`, walked by `tests/ui/command-palette/state-matrix.test.ts`.

- **Loading** — `<div data-testid="command-palette-loading" aria-busy="true">` in the list's place:
  three rows at `var(--row-comfortable)`, each holding one 12 × 240 px core Skeleton, so the palette
  does not resize while an answer arrives. Status reads `command_palette_status_searching`. Never a
  spinner.
- **Empty** — `<div data-testid="command-palette-empty">` in the list's place: the sentence
  `command_palette_empty` filled with the query, `var(--text-13)` `var(--graphite-900)`,
  `text-wrap: pretty`, and one action — a core secondary Button `command_palette_empty_action` that
  clears the query and returns focus to the input, restoring recents, areas, actions and shortcuts.
  Reachable only with a query typed: a blank query always lists those four groups.
- **Error** — the `fault` prop (I-143), in the list's place: `<div role="alert"
  class="cx-palette-fault">` with the house alert chrome (`var(--danger-surface)` fill,
  `var(--hairline)` re-keyed `border-color: var(--danger)`), holding `command_palette_error`, then
  `fill(command_palette_error_report, { id })` in 10 px `var(--font-mono)` `var(--graphite-700)`,
  `user-select: all`, then a ghost Button `command_palette_error_retry` re-running the current query.
- **Refusal** — `<div data-testid="command-palette-refusal">` wrapping exactly one RefusalState
  (I-142), in the list's place, with evidence `{ href: "/sign-in", label: shell_evidence_sign_in }`
  for `SIGNED_OUT` and `{ href: "/", label: shell_evidence_home }` for
  `WORKSPACE_PERMISSION_NOT_HELD`. The input stays live so a correction can be retried.
- **Partial** — the same card in the same wrapper, rendered *under* the groups instead of in their
  place, whenever a refusal arrives beside rows (I-142): the hits that were answered stand.
- **Offline** — the notice in §1 plus a read-only list: the navigate group is absent (search needs
  the server), while recents, areas, actions and shortcuts stand. The provider reads `navigator.onLine`
  and the `online`/`offline` events.
- **Permission-denied** — delegated to `src/ui/patterns/refusal-state/refusal-state.tsx` with the
  registered `WORKSPACE_PERMISSION_NOT_HELD` entry, which names the permission and its holders in the
  register's own words; the palette paraphrases no registered sentence (shell I-18).

## 3. Copy, verbatim (`src/ui/strings/command-palette.ts`)

`command_palette_trigger` **Search** · `command_palette_trigger_tooltip` **Search and commands —
{keys}** · `command_palette_label` **Search and commands** · `command_palette_input_label` **Search
this workspace** · `command_palette_placeholder` **Search projects, drawings, sheets and sets** ·
`command_palette_list_label` **Results** · `command_palette_group_recent` **Recent** ·
`command_palette_group_navigate` **Go to** · `command_palette_group_areas` **Project areas** ·
`command_palette_group_actions` **Actions** · `command_palette_group_shortcuts` **Shortcuts** ·
`command_palette_empty` **Nothing in this workspace matches “{query}”.** ·
`command_palette_empty_action` **Clear the search** · `command_palette_status_searching`
**Searching…** · `command_palette_status_none` **No matches** · `command_palette_status_one` **1
match** · `command_palette_status_many` **{count} matches** · `command_palette_footer_shortcuts`
**Keyboard shortcuts** · `command_palette_error` **The search did not complete.** ·
`command_palette_error_report` **Report id {id}** · `command_palette_error_retry` **Try the search
again** · `command_palette_offline` **You are offline. Recent items, areas and shortcuts still work;
search needs a connection.** · `command_palette_action_affirm_scale` **Affirm scale…** ·
`command_palette_action_export_boq` **Export BOQ…** · `command_palette_reason_area_unbuilt` **This
area has no screen in this workspace yet.** · `command_palette_reason_no_project` **Open a project
first — areas belong to a project.** · `command_palette_reason_affirm_scale` **Scale is affirmed on a
sheet in the viewer, which this workspace does not open yet.** · `command_palette_reason_export_boq`
**A bill of quantities is exported from an estimate, and no estimate screen exists in this workspace
yet.** · `command_palette_reason_scope_viewer` **This key works in the viewer.** ·
`command_palette_reason_scope_table` **This key works in a table.** ·
`command_palette_reason_already_open` **This is the palette you are in.**

SRCH-1 (I-628, I-630): `command_palette_placeholder_project` **Search projects, drawings,
sheets, sets, marks and sheet text** · `command_palette_meta_text` **{sheet} · {drawing}** · `command_palette_meta_mark`
**{class} · {count} in the register · {sheet}** · `command_palette_meta_mark_unplaced` **{class} ·
{count} in the register** · `command_palette_model_space` **Model space** · `command_palette_elision`
**…**

Shortcut labels and scope words are `src/ui/strings/shortcuts.ts`, fixed in
`docs/design/shortcut-sheet.md` §3 — one table, one home, so a key reads identically in the palette
and in the sheet. Hit labels (project, drawing, sheet and set names) are the workspace's own data and
are rendered as they stand; so is a find's — the mark as the register holds it, the text as the sheet
says it — cut only where one row cannot hold it, and marked there with `command_palette_elision`. Voice: calm, concrete, professional; every reason says what is true and
where the thing lives, never "coming soon", never an exclamation mark, and never *pattern*, *route*,
*query*, *increment* or any other build word.

## 4. Motion (R-UI-004)

The Dialog's own entrance — scrim and content fade, content 0.98 → 1 scale, over
`var(--motion-state)` `var(--ease)`; exit instant. The active option's fill changes with **no**
transition: at ten rows a second a 160 ms fade paints the row a person has already left. Group
headers, results, the refusal card, the fault card and the empty block mount untweened — an answer
arrives as fast as a success would. Skeleton pulse, reticle draw and the Tooltip's rise live in their
single homes. Every duration is a token zeroed at source under reduced motion, so no rule here
carries a `prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-0/500/600/700/900` · `--beam-100` · `--info/--info-surface` ·
`--danger/--danger-surface` · `--hairline` · `--space-2/3/5/12` · `--radius-4` · `--text-12/13` ·
`--font-mono` · `--weight-body-medium`/`--weight-heading` · `--row-comfortable` ·
`--motion-state`/`--ease`. Dialog measure, padding, shadow and the Input's, Button's, Kbd's and
Skeleton's own paint are the primitives'. Px/em literals, closed set (core I-1's mandated class):
the trigger's 160 px minimum and its 12 px glyph at 2 px stroke, the list's 320 px cap, the 10 px
mono kind word and report id with 0.12em tracking, and the 12 × 240 px skeleton bone. Any other
literal is a defect. No copper: searching is not an act.

## 6. Themes

`src/ui/patterns/command-palette/command-palette.css` and the trigger's rules in
`src/ui/shell/shell.css` contain no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001), and the portal keeps the document-root theme. Contrast holds on the
founder values in both themes: graphite-900 labels and graphite-600 kind words, metas, reasons and
status lines on graphite-0 clear 4.5:1 (the 10 px lines included — size earns no carve-out);
graphite-900 on the beam-100 active row clears 4.5:1; graphite-500 unavailable labels hold the 3:1
floor and never carry meaning alone; the info and danger tints follow refusal-state §1. The scrim is
the app ground at 60 % (overlay I-3), so the palette reads as a lit card over a receded frame in both
themes.

## 7. Test hooks (closed contract, C-05)

Routes: none new to the router — the palette stands over every `/t/{tenant}/**` address; the one new
address is the procedure `spine.search` (GET `/api/trpc/spine.search`, input `{ tenantId, query,
projectId? }`, answering `{ hits, refusal? }` over the kinds `project`, `drawing`, `sheet`, `set`, and
— with a project named — `mark` and `text`, whose hits also carry `sourceKey`, `selection`,
`sheetLabel` and their find's own facts, I-628/d). Test ids, exactly these
ten, on the elements ruled in §1–§2: `shell-command-palette` · `command-palette` ·
`command-palette-input` · `command-palette-list` · `command-palette-group` · `command-palette-item` ·
`command-palette-item-reason` · `command-palette-empty` · `command-palette-loading` ·
`command-palette-refusal`. No others are added: the footer button, the offline notice, the fault card
and the empty block's action are found by role and name, and the refusal card is found by
RefusalState's own ids inside `command-palette-refusal`.

Behavioural hooks without new ids: `aria-haspopup="dialog"` and `aria-keyshortcuts="Meta+K Control+K"`
on the trigger, and its absence entirely when `ShellTopBar` mounts outside a provider (I-135);
`role="dialog"` on `command-palette`; `role="combobox"` with `aria-controls`, `aria-expanded` and
`aria-activedescendant` on the input; `role="listbox"`/`role="group"`/`role="option"` with
`aria-selected` and `aria-disabled`; `data-group` on each group; `data-kind`, `data-available` and
`data-shortcut` on options; `aria-busy` while loading; `role="status"` on the footer line and the
offline notice; `role="alert"` on the fault card; `cx-reticle` on trigger and input; `data-code` from
RefusalState. Suites: `tests/ui/command-palette/**` under jsdom drive `PaletteHost` inside the
provider with an injected `search` and `navigate` (fixtures in
`tests/ui/command-palette/support/**`), covering AC-1–AC-3, every §2 cell, and the roster derivation
in both directions.

Gallery (R-UI-011): `galleryBarrels` gains `patterns/command-palette`; `CommandPalette`,
`ShortcutSheet` and `CommandPaletteProvider` each get a hook-free entry, so `missingEntries()` stays
empty. Journey `tests/e2e/palette.spec.ts` (titles carrying **J-021**, page object
`tests/e2e/pages/command-palette.page.ts`): sign in → `/t/{tenant}` → Meta+K → type the project's
name → Enter on the hit → `projectHomeRoute` → `?`. Checkpoints, axe serious/critical = 0 and never
widened: **j-021-palette-open** (`palette/open-light.png`, `palette/open-dark.png`) and
**j-021-shortcut-sheet** (`palette/sheet-light.png`). The trigger moves the frame, so
`gallery-shell-*.png` and every frame picture it shifts are regenerated, each in its own `baseline:`
commit naming the run, and none regenerated that did not move (B-20).

Which pictures the trigger actually reaches is read off the lane, not assumed: every candidate is
re-taken from the standing screen with `--update-snapshots=all` (a comparison run re-blesses nothing,
because the trigger's cell is smaller than the lane's `maxDiffPixelRatio` of 0.002 over 1440×900).
Ten moved and are committed: the four `shell-*.png`, `j-003/project-edited.png`,
`j-003/ruleset-pin-visible.png`, `j-000/workspace-named.png`, `j-000/first-project-on-s-home.png`,
`s-audit/explorer.png`, `s-project/home.png`. Seven cannot move, and B-20's second half forbids
re-blessing them: `j-001-auth/invite-pending.png`, `j-001-auth/switched.png`,
`j-002-tenant-admin/panel.png` and `j-002-tenant-admin/remove-refused.png` paint `shell-topbar` over
with the mask their journeys take, so the bar's occupants are not in the picture at all and the bar's
box is unchanged; `j-001-auth/accept.png` is `/accept-invitation`, which is not under `t/[tenant]` and
so wears no frame; and `gallery-shell-*.png` is a capture of the `gallery-shell` header alone — the
gallery's `h1` and caption — while the entries the palette adds render in the barrel sections beneath
it. A new gallery entry never moves those two pictures, and the increment does not make it appear to.

SRCH-1's proofs: `tests/takeoff/sheets/text-index.test.ts` (the index over F-RCC6-BNBC read by the
shipped CLI — LIFT CORE's eleven, C3 never PC3, MTEXT codes stripped, one entry per block paint, and a
cache that reads six drawings once where `artifactAt` alone re-validates), `tests/spine/search-text.test.ts`
(the door, live: C2's mark and its text on the plan sheet; `PERMISSION_NOT_HELD` by name beside the
names for a workspace member not on the project; `WORKSPACE_PERMISSION_NOT_HELD` for a stranger),
`tests/ui/command-palette/find-rows.test.ts` (the rows, their second lines, their addresses, the
refusal beside them), and a second J-021 test in `tests/e2e/palette.spec.ts` on the register leg's
stage: ⌘K C2 lists one `mark` and one `text`, a click on the mark opens the viewer with the member's
outline and mark selected, a click on the text with the text alone. Checkpoint
**j-021-palette-finds**, axe only — no picture, because the rows carry the run's own identifiers.

## 8. Owed scope (R-SPINE-052 is not closed by SRCH-1)

- **A find chosen from the viewer itself.** J-021's second step — the text find chosen while the
  viewer stands on the sheet the mark find opened — timed out in session 8 waiting for the address to
  name the text (I-632). The mark leg is proven on the db lane; this step is proven only by the
  journey. Owner: the orchestrator's J-021 walk; where it fails again, the viewer's same-sheet
  navigation (`use-selection`'s re-read of a new `s`, `publishViewport`'s replace) is where to look.
- **Item descriptions and notes.** R-SPINE-052 searches "sheet text …, item descriptions, notes".
  Only sheet text and the register's marks are searched; a BOQ item's description and a person's
  note (the register's comments, a disposition's reason) are not. Owner: SRCH's successors — each a
  kind of its own in `SEARCH_KINDS`, read through its screen's one reader.
- **A block reference in model space, placed by its paint.** Core stands an entity by its points,
  and a block reference carries none, so a model-space reference's text (a grid bubble's letter, a
  level mark's attribute) opens on model space rather than on the plan sheet framing it (I-627).
  Owner: core's sheet resolver (`src/core/sheets/frames.ts`), for every reader at once.
- **A stacked fraction in an MTEXT.** `mtextLines` strips `\S1/2;` whole, so `3'-6\S1/2;"` reads
  `3'-6"` — the fraction is lost to search and to every other reader of an MTEXT. Owner: core's
  notation (`src/core/entitygraph/notation.ts`); a fix there moves the schedule reader's corpus too.
- **A capped answer that says so.** Twenty hits are answered at most and the list does not say more
  were found; a common word ("COLUMN") finds far more. Owner: this Decision's next increment — a
  status line for a cut answer (§3) and the find bar (SRCH-2) for the rest.
- **Text a PDF or a scan carries** (R-TO-016's OCR'd text) waits on the PDF and raster lanes, whose
  keys the viewer cannot select yet; **a find bar within one sheet** (R-TO-016) is SRCH-2, over this
  same index.
