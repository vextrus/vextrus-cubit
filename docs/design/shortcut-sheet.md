# Design Decision — shortcut sheet (the `?` sheet) and the shortcut roster

`ShortcutSheet` (`src/ui/patterns/command-palette`, `data-testid="shortcut-sheet"`), opened by `?`
over every `/t/{tenant}/**` address, and the one roster it reads,
`src/ui/shell/shortcuts/roster.ts` (`SHORTCUTS`). Increment inc-217-command-palette; §1b of the
command-palette Decision, which rules the surrounding pattern, the trigger, the provider and the key
handler — `docs/design/command-palette.md` is cited here and never re-decided. Law: R-UI-001/003/004/
005/010/011/012/020/032/050/060, ARCH-01, B-17, B-19, C-05, Q-11. Every earlier convention binds:
`cx-` classes, tokens-only colour and motion, `cx-reticle` solely from its single home, no
`[data-theme]` selector in authored CSS; Interpretations I-1–I-144 remain in force. Chrome comes only
from shipped primitives — overlay Sheet, core Kbd — plus the `cx-shortcut-*` classes ruled here. Copy
is `src/ui/strings/shortcuts.ts` (keys `shortcut_…`), under the ownership Objection recorded in
command-palette §0.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-145 — the sheet is the shipped Sheet, side right.** R-UI-032 calls it a sheet and the surface
  is a reference list read beside the work that raised the question, not a decision to be made:
  `SheetContent` at its own `min(420px, …)` measure, `side="right"`, `aria-label` =
  `shortcut_sheet_label` (the primitive exports no title part and requires the label). It is a
  `role="dialog"` like the palette, and like the palette it renders no ✕: Escape and the scrim
  dismiss it (command-palette I-136). Opening the sheet closes the palette, and the two are never
  open together — one modal surface at a time.
- **I-146 — the roster is grouped by scope, and the grouping is derived rather than trusted.** The
  sheet renders one section per entry of `SHORTCUT_SCOPES`, in that order, holding that scope's
  entries in roster order — which equals `SHORTCUTS` order document-wide only because the roster is
  authored with its scopes contiguous. That is the roster's own invariant, asserted by walking
  `SHORTCUTS` and refusing a scope that reappears after another has begun (B-19), not by transcribing
  today's nineteen rows. A reader needs to know where a key works before the key itself; a flat list
  would put that fact on every row or nowhere.
- **I-147 — `?` is honoured outside text fields, and the roster is the only reader of the keys.**
  The provider's one handler answers `?` (Shift+/ on most layouts — the step is the printed
  `KeyboardEvent.key`, so no layout arithmetic happens anywhere) when the event's target is not an
  `input`, `textarea`, `select` or `[contenteditable]`. `Mod+K` and Escape are the only entries
  honoured inside a text field (command-palette §1). Documented and bound keys cannot differ because
  there is nothing else to read: the palette's shortcut rows, this sheet and the handler all take
  `SHORTCUTS`, and no surface spells a key beside it.
- **I-148 — the sheet documents keys this increment does not bind, and says where each one works.**
  The viewer's tools and table navigation are bound by the screens that own them (ARCH-01 forbids a
  module importing `src/ui`, so the viewer's binding is inc-206's). A key the roster names and no
  screen binds yet is still a key the product promises: it is listed under its scope heading, which
  states plainly where it works, and the palette's copy of the same row carries
  `command_palette_reason_scope_viewer` / `_table`. Hiding them until they bind would leave R-UI-032's
  own list undocumented.
- **I-149 — `chordOf` is display, never matching.** `chordOf(shortcut)` renders `Mod+k` as **⌘K** on
  Apple platforms and **Ctrl K** elsewhere, single letters uppercased, `Escape` as **Esc**, `Enter`,
  `Tab` and **Down arrow** by name, and joins a sequence's steps with **&nbsp;then&nbsp;** — for
  reading aloud as much as for the eye. Matching is `matchStep(event, step)`'s alone: `Mod+k` matches
  `metaKey || ctrlKey` with `key` `k` case-insensitively, and a plain step matches `event.key`
  case-insensitively with no Meta, Control or Alt held. Both are drawn only after a gesture
  (command-palette I-140).

## 1. Layout and hierarchy

**The roster** (`src/ui/shell/shortcuts/roster.ts` — no `index.ts` beside it, so the barrel scan is
untouched). `Shortcut = { id, scope, keys, label, action, target? }`,
`SHORTCUT_SCOPES = ['global','viewer','table']`, `CHORD_TIMEOUT_MS = 1000`. The nineteen entries, in
roster order, with their keys and actions:

| id | scope | keys | action / target |
|---|---|---|---|
| `palette` | global | `Mod+k` | open-palette |
| `shortcut-sheet` | global | `?` | open-sheet |
| `go-projects` | global | `g` `p` | go / `projects` |
| `go-drawings` | global | `g` `d` | go / `drawings` |
| `go-takeoff` | global | `g` `t` | go / `takeoff` |
| `go-estimate` | global | `g` `e` | go / `estimate` |
| `go-bid` | global | `g` `b` | go / `bid` |
| `viewer-select` · `viewer-pan` · `viewer-measure` · `viewer-count` · `viewer-linear` · `viewer-area` · `viewer-snap` · `viewer-fit` | viewer | `v` · `h` · `m` · `c` · `l` · `a` · `s` · `f` | viewer |
| `viewer-escape` | viewer | `Escape` | viewer |
| `table-move` · `table-edit` · `table-next` | table | `ArrowDown` · `Enter` · `Tab` | table |

`go` targets are `PROJECT_AREAS` keys, or `projects` for the workspace home; the addresses they
resolve to are the app layer's (command-palette §1's wiring paragraph), never spelled in `src/ui`.

**The sheet.** `SheetContent` carries `data-testid="shortcut-sheet"` and class `cx-shortcut-sheet`
(column flex, gap `var(--space-5)`; padding is the primitive's `var(--space-5)`). In order:

- `<h2 class="cx-shortcut-sheet-heading">` `shortcut_sheet_heading`, `var(--text-16)`
  `var(--weight-heading)` `var(--graphite-900)`, margin 0 — the same words as the `aria-label`, so a
  speech-input user can say what they see.
- `<p class="cx-shortcut-sheet-hint">` `shortcut_sheet_hint`, `var(--text-12)`
  `var(--graphite-600)`, `text-wrap: pretty`.
- One `<section class="cx-shortcut-scope" data-scope={scope} aria-labelledby>` per
  `SHORTCUT_SCOPES` entry (I-146), each opening with `<h3>` `shortcut_scope_{scope}` —
  `var(--text-12)` `var(--weight-body-medium)` `var(--graphite-600)`, `var(--space-2)` below — over a
  `<dl class="cx-shortcut-rows">`, margin 0.
- **Row** — `<div data-testid="shortcut-sheet-row" data-shortcut={id} data-scope={scope}
  class="cx-shortcut-row">`: grid `minmax(0, 1fr) auto`, column gap `var(--space-4)`, align-items
  centre, min-block-size `var(--row-comfortable)` (command-palette I-144 — the sheet is portalled
  too), `border-top: var(--hairline)` on every row but the first of its section. `<dt>` holds
  `strings[entry.label]`, `var(--text-13)` `var(--graphite-900)`, wrapping. `<dd
  data-testid="shortcut-sheet-keys">`, margin 0, holds exactly one `<kbd class="cx-kbd">` whose text
  is exactly `chordOf(entry)` — so the cell's own text is that string character for character, and
  the keycap is the shipped Kbd rather than a second cap chrome (B-17).

Rendering is the derivation, never a hand list: sections from `SHORTCUT_SCOPES`, rows from
`SHORTCUTS` filtered by scope. Nothing is focusable inside the sheet, so Tab is the primitive's own
trap and Escape closes, returning focus to whatever opened it — the trigger when the palette's footer
button did, the document's active element when `?` did.

## 2. States (R-UI-050), ruled cell by cell

Declared in the `shortcut-sheet` row of `COMMAND_PALETTE_STATES`
(`src/ui/patterns/command-palette/states.ts`), total over `STATE_NAMES` and walked by
`tests/ui/command-palette/state-matrix.test.ts` (command-palette §2).

- **Loading** — impossible, with the reason recorded: the sheet renders a frozen roster held in the
  bundle. Nothing is awaited, so a skeleton would be theatre (R-UI-004, s-design's precedent).
- **Empty** — impossible: `SHORTCUTS` is non-empty by construction and the suite asserts a row for
  every entry in both directions (AC-3). A roster that lost its last entry fails the derivation test
  before it can ship an empty sheet.
- **Error** — a render fault mounts the root error boundary (`src/app/error.tsx`); this surface adds
  nothing to it, and has no request that can fail.
- **Refusal** — impossible: the sheet asks the server for nothing. A key that cannot act *here* is
  not refused, it is scoped, and the scope heading says so in words (I-148).
- **Partial** — impossible for the same reason: every roster entry renders, and none can be
  withheld.
- **Offline** — indistinguishable by design: the roster is local, so the sheet reads identically
  offline and no banner is invented (shell I-20's honesty).
- **Permission-denied** — impossible: knowing which keys the product binds needs no permission, and
  a key whose destination a session cannot reach is answered by that destination's own screen.

## 3. Copy, verbatim (`src/ui/strings/shortcuts.ts`)

Sheet chrome: `shortcut_sheet_label` **Keyboard shortcuts** · `shortcut_sheet_heading` **Keyboard
shortcuts** · `shortcut_sheet_hint` **Every key this workspace binds, and where each one works.** ·
`shortcut_scope_global` **Anywhere in the workspace** · `shortcut_scope_viewer` **In the viewer** ·
`shortcut_scope_table` **In a table**.

Entry labels, in roster order: `shortcut_palette` **Open the command palette** ·
`shortcut_shortcut_sheet` **Show keyboard shortcuts** · `shortcut_go_projects` **Go to Projects** ·
`shortcut_go_drawings` **Go to Drawings** · `shortcut_go_takeoff` **Go to Takeoff** ·
`shortcut_go_estimate` **Go to Estimate** · `shortcut_go_bid` **Go to Bid** ·
`shortcut_viewer_select` **Select tool** · `shortcut_viewer_pan` **Pan tool** ·
`shortcut_viewer_measure` **Open the measure menu** · `shortcut_viewer_count` **Count tool** ·
`shortcut_viewer_linear` **Linear measurement** · `shortcut_viewer_area` **Area measurement** ·
`shortcut_viewer_snap` **Toggle snapping** · `shortcut_viewer_fit` **Fit the sheet to the view** ·
`shortcut_viewer_escape` **Cancel the current tool** · `shortcut_table_move` **Move to the next
row** · `shortcut_table_edit` **Edit the focused cell** · `shortcut_table_next` **Move to the next
cell**.

`chordOf`'s display words — **Esc**, **Enter**, **Tab**, **Down arrow**, **then** — are part of
`roster.ts`'s one home rather than a second table, because they are the roster's own reading of its
own steps (I-149); every one of them is a plain English key name. Voice: each label is verb-first
where the key does something and a plain noun where it selects a tool; no exclamation marks, no
build vocabulary — the sheet never says *bind*, *handler*, *scope key* or *roster*, and the word
*shortcut* appears only where a person would use it.

## 4. Motion (R-UI-004)

The Sheet's own entrance from its edge — translateX 100 % → 0 over `var(--motion-panel)`
`var(--ease)` while the scrim fades over `var(--motion-state)`; exit instant. Nothing inside animates:
rows, sections and keycaps mount untweened, and no row highlights on hover — the sheet is a document
to read, not a set of controls. The reticle's draw and the Kbd's paint are their single homes'. Every
duration is a token zeroed at source under reduced motion, so no rule here carries a
`prefers-reduced-motion` branch.

## 5. Tokens

`--graphite-600/900` · `--hairline` · `--space-2/4/5` · `--text-12/13/16` ·
`--weight-body-medium`/`--weight-heading` · `--row-comfortable` · `--motion-panel`/`--motion-state`/
`--ease`. The Sheet's measure, fill, shadow and inner-edge hairline, and the Kbd's cap chrome
(`--graphite-50` fill, `--graphite-300` border, `--font-mono` `--text-12`), are the primitives' own
token reads. No px literal is authored here at all. No copper: documentation is not an act, and no
colour carries meaning on this surface — every fact on it is a word.

## 6. Themes

`src/ui/patterns/command-palette/command-palette.css` holds the sheet's rules and contains no
`[data-theme]` selector; every light/dark difference arrives through token values (R-UI-001), and the
portal keeps the document-root theme. Contrast holds on the founder values in both themes:
graphite-900 labels on graphite-0 and graphite-600 scope headings, hint and keycap text on
graphite-0/50 all clear 4.5:1; the hairline row seams and the keycap border are structure, not
meaning. The only light/dark character change is the Sheet's own deepening shadow (`--shadow-4`).
Both themes are captured: `palette/sheet-light.png` is the checkpoint, and the gallery's
`ShortcutSheet` entry stands in the dark gallery baseline.

## 7. Test hooks (closed contract, C-05)

Routes: none — the sheet stands over every `/t/{tenant}/**` address and introduces no address of its
own. Test ids, exactly these three, on the elements ruled in §1: `shortcut-sheet` (the
`SheetContent`, `role="dialog"`, labelled `shortcut_sheet_label`) · `shortcut-sheet-row` (each row,
`data-shortcut`, `data-scope`) · `shortcut-sheet-keys` (the `<dd>` whose text is exactly
`chordOf(entry)`). No others are added; headings are found by role and name.

Behavioural hooks without new ids: one row per `SHORTCUTS` entry and one entry per row, asserted in
both directions and in roster order (AC-3, B-19 — the suite enumerates the roster, never a frozen
nineteen); `data-scope` matching the entry's scope and the section it sits in; the palette's
`command-palette-group[data-group="shortcuts"]` holding one
`command-palette-item[data-kind="shortcut"][data-shortcut=<id>]` per entry, derived from the same
roster; `chordOf` and `matchStep` unit-tested against each other so a documented chord is the chord
that matches (`Mod+k` under both Meta and Control, `g` then `p` inside `CHORD_TIMEOUT_MS`, the same
sequence outside it matching nothing). Suites: `tests/ui/command-palette/**` under jsdom, fixtures in
`tests/ui/command-palette/support/**`.

Gallery (R-UI-011): the `ShortcutSheet` entry renders the sheet **open** with the shipped roster —
the entry is hook-free and takes `open` as authored data — so `missingEntries()` stays empty and both
gallery baselines carry it. Journey: the **j-021-shortcut-sheet** checkpoint of
`tests/e2e/palette.spec.ts` (J-021) opens the sheet with `?` after the palette walk, asserts one row
per roster entry with its chord and scope, holds axe serious/critical at 0, and captures
`palette/sheet-light.png`.
