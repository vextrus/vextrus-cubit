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
  placeholder `command_palette_placeholder`. Full width, autofocused on open (AC-1).
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
Columns: the **kind** word verbatim (the enum value — `project`, `drawing`, `sheet`, `set`, `area`,
`action`, `shortcut`), 10 px `var(--font-mono)`, letter-spacing 0.12em, `var(--graphite-600)`,
min-inline-size `var(--space-12)`, read as part of the option's name, never `aria-hidden`; the
**label** `var(--text-13)` `var(--graphite-900)`, single line, ellipsis; the **meta** (a hit's
project or drawing, ellipsised) `var(--text-12)` `var(--graphite-600)` — replaced by
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
`spine.search`, maps each hit's kind through `projectHomeRoute` · `drawingsRoute` · `viewerSheetRoute`
· `setRoute` imported from their route-address homes, and hands `navigate`. The global handler reads
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

Shortcut labels and scope words are `src/ui/strings/shortcuts.ts`, fixed in
`docs/design/shortcut-sheet.md` §3 — one table, one home, so a key reads identically in the palette
and in the sheet. Hit labels (project, drawing, sheet and set names) are the workspace's own data and
are rendered as they stand. Voice: calm, concrete, professional; every reason says what is true and
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
address is the procedure `spine.search` (GET `/api/trpc/spine.search`, input `{ tenantId, query }`,
answering `{ hits }` over the kinds `project`, `drawing`, `sheet`, `set`). Test ids, exactly these
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
