# Design Decision — datum-patterns

Not a routed screen. This document fixes the anatomy, states, copy, motion and tokens of the
data layer (`src/ui/data`: DataTable, BasisChip, CoverageChip, UnitBadge) and the pattern layer
(`src/ui/patterns`: RefusalState, ConsequenceDialog, EvidenceLink, EmptyState, ErrorState,
PartialNotice, OfflineBanner, PermissionDenied). It is the contract the components are built and
graded against. Token names are the Datum sheet (`docs/design/datum-tokens.md`); primitive
behaviour it composes (Button, Checkbox, Dialog, Skeleton) is `docs/design/datum-primitives.md`;
no colour literal anywhere (R-UI-001).

## 1. Shared laws

- **Module shape.** Each barrel imports its own stylesheet (`src/ui/data/data.css`,
  `src/ui/patterns/patterns.css`), so styles arrive with the components. Each module carries its
  own frozen string table (`src/ui/data/strings.ts` → `DATA_STRINGS`,
  `src/ui/patterns/strings.ts` → `PATTERNS_STRINGS`), typed exactly as
  `src/ui/primitives/strings.ts` types its table. Components read only their table; no string
  literal in JSX except test ids. Copy with `{slots}` is a template in the table; the component
  fills the slots — it never composes sentences from loose words.
- **Numerals.** Every number these modules render — cell values marked numeric, coverage,
  counts, report ids, consequence counts — is `--font-mono` via the `.numeric` utility
  (R-UI-003). Every integer count goes through `formatNumber(String(n), 'count')` from
  `src/core/format.ts` — stringified first, because the seam takes exactly 0 fraction digits
  for `count` and refuses any other shape. The value is rounded to the nearest whole number
  first, so a caller's fractional count reads as a count instead of throwing a seam error from
  inside a chip, a notice or a consequence line.
- **Focus (R-UI-012).** Every interactive element carries `datum-focus-ring` from primitives.css
  — sort buttons, row checkboxes, edit inputs, resize handles, links, dialog buttons.
- **Bare jsdom.** Nothing here constructs a ResizeObserver or IntersectionObserver, guarded or
  not — the DataTable's geometry is entirely prop-driven (§2). This is a design property, not an
  implementation detail: fixed row heights are what make 50,000 rows scannable at a constant
  rhythm (R-UI-005).
- **Themes.** Every rule reads role-stable tokens; nothing in these modules forks per theme
  (§12).

## 2. DataTable — layout

Anatomy, outside in: a wrapper (`data-testid="datatable"`, hairline border `--graphite-200`,
`--radius-4`, `background: var(--graphite-0)`) holding one scroll container
(`overflow: auto; height: <height prop>px`) that contains, in order: sticky header, virtualised
body, sticky footer (only when `footer` is given).

- **Semantics.** The wrapper is `role="grid"` with `aria-rowcount` = data length + 1 (header);
  every rendered row carries `aria-rowindex` — the header row is row 1, a body row is its data
  index + 2 — so a screen reader knows the true extent, and where in it the reader stands, even
  though the DOM holds a window. Header cells are `role="columnheader"` (with `aria-sort` when
  sortable), body cells `role="gridcell"`. Full arrow-key grid navigation is R-UI-032 (M2);
  until then interactive cell content sits in the natural tab order.
- **Header** (`data-testid="datatable-header"`): `position: sticky; top: 0;
  z-index: var(--z-sticky)`, background `--graphite-50`, hairline bottom border, height 28 px,
  labels `--text-12` `--weight-body-medium` `--graphite-600` — never letter-spaced uppercase
  (R-UI-003).
- **Body**: a spacer div whose height is `rowCount × estimateRowHeight` px; visible rows are
  absolutely positioned inside it at `index × estimateRowHeight`. The window is computed by
  @tanstack/react-virtual from the `height` prop and the scroll container's scrollTop with
  `estimateSize: () => estimateRowHeight` and overscan 10 — never from measured layout, so
  mounting needs no observer and at `height={600}`, `estimateRowHeight={40}` at most
  15 + 20 = 35 rows exist in the DOM at any offset. Both are live props, not mount-time
  readings: a changed `height` republishes the viewport rect and a changed
  `estimateRowHeight` remeasures, so the density switch below re-windows instead of leaving
  the old pitch under new row heights.
- **Rows** (`data-testid="datatable-row"`): exactly `estimateRowHeight` px tall — the prop is
  the density switch: a comfortable screen passes 36, a compact one 28 (R-UI-005 rows). Hairline
  bottom divider, cell text `--text-13` `--graphite-800`, cell padding `0 var(--space-2)`,
  content vertically centred, single line, `text-overflow: ellipsis`. Hover fill
  `--graphite-100`; selected rows tint `--cobalt-100` (plus the checked checkbox — never colour
  alone, R-UI-060). A column whose def sets `meta: { numeric: true }` renders its cells
  right-aligned in `.numeric`.
- **Footer** (`data-testid="datatable-footer"`): `position: sticky; bottom: 0;
  z-index: var(--z-sticky)`, background `--graphite-50`, hairline top border, min-height 28 px,
  padding `0 var(--space-2)`; renders the `footer` node verbatim.

## 3. DataTable — behaviour

All table state is controlled: `state`/`onStateChange` pass `sorting`, `grouping`,
`columnPinning`, `columnSizing`, `rowSelection` through to TanStack; uncontrolled consumers get
internal state with the same rendering.

- **Sort.** A sortable column's header renders one ghost button (`data-testid="datatable-sort"`)
  filling the header cell, named by the column label, cycling ascending → descending → unsorted.
  Sorted state shows ↑ or ↓ after the label in `--cobalt-500` and sets
  `aria-sort="ascending" | "descending"`.
- **Filter.** `globalFilter` narrows rows by case-insensitive substring over cell string values
  (TanStack `includesString`). Zero survivors renders the empty state (§4) — a filtered-out
  table is still never silent.
- **Selection.** With `enableRowSelection`, a leading 28 px column renders one Datum Checkbox
  per row (`data-testid="datatable-select-row"`), `aria-label` from `data.table.selectRow` with
  the `getRowId` value in the slot. Selected ids are reported through `onRowSelectionChange`.
  There is deliberately no header select-all: bulk is offered as named groups, never assembled
  from a freeform sweep (L-ACT-02, R-UI-023).
- **Inline edit.** A column with `meta: { editable: true }` renders its cell as an activation
  surface: click, or Enter while focused, replaces the display with an input
  (`data-testid="datatable-edit-cell"`, Input styling §3 of primitives, `.numeric` when the
  column is numeric) pre-filled with the current string, text selected. Enter or blur commits —
  `onCellEdit(rowId, columnId, value)` — and returns to display; Escape reverts without calling.
  The table never mutates `data`; the committed value round-trips through the owner.
- **Grouping.** `state.grouping` renders one group row per group
  (`data-testid="datatable-group-row"`): background `--graphite-50`, `--weight-body-medium`
  `--graphite-900`, a 16 px chevron IconButton (label `data.table.collapseGroup` /
  `data.table.expandGroup`, `aria-expanded`), the grouped value, then the member count in
  parentheses in `.numeric` `--graphite-600`, through the count seam. Groups mount expanded;
  group rows are the same height as data rows and virtualise with them. The chevron, value and
  count sit inside **one `role="gridcell"`** spanning the visible leaf columns (`aria-colspan`):
  a `role="row"` whose children are not cells is malformed ARIA, and a reader would find a row
  with nothing addressable in it. Where `enableRowSelection` is on, a group row opens with the
  same 28 px selection gutter cell the data rows and the header spend — empty, since a group is
  not itself selectable — so the group heads the column grid rather than sitting left of it.
- **Pinning.** `state.columnPinning` gives pinned-left/right cells
  `position: sticky; left/right: 0; z-index: 1` (under the header's `--z-sticky`), an opaque
  background (`--graphite-0`, or the row's own hover/selected fill), and a hairline on the
  scrolling seam (`--graphite-300`).
- **Resize.** `state.columnSizing` sets column widths in px. Each resizable header edge carries
  an 8 px hit area (`role="separator"`, `aria-label` `data.table.resize` with the column label
  in the slot) showing a `--graphite-300` line on hover/drag; drag uses TanStack's pointer
  handlers — no observers. Keyboard: ArrowLeft/ArrowRight adjust by 8 px (one `--space-2`).
  Because the handle is focusable it is a *widget* separator, not a divider, so it states the
  value the arrow keys move: `aria-orientation="vertical"`, `aria-valuenow` = the column's
  current width in px, `aria-valuemin` = 40 (the narrowest a column may be dragged).

## 4. DataTable — states (R-UI-050 share)

- **Empty** (`data-testid="datatable-empty"`): whenever zero rows are visible — no data, or a
  filter left nothing — the body renders the required `emptyReason` string, centred in the
  scroll area, `--text-13` `--graphite-600`, padding `--space-6`. The header still renders (the
  columns teach the shape). `emptyReason` is the composing screen's sentence for *this* silence
  ("an empty list says why it is empty", R-UI-020); the screen updates it when a filter is the
  cause.
- **Loading** is the composing screen's: it renders Skeleton bars sized to the coming rows
  (heights matching its `estimateRowHeight`) in place of the table — skeletons keep layout,
  never spinners on data tables (R-UI-004). DataTable has no loading prop by design.
- **Partial** is PartialNotice (§7) rendered by the screen directly above the table, with the
  refused rows still in `data`, each carrying its refusal in-cell. Error, refusal, offline and
  permission-denied are the screen's, using §7–§8.

## 5. BasisChip, CoverageChip, UnitBadge

All three are 20 px inline chips, `--radius-4`, `--text-12`, vertically centred in either row
density.

- **BasisChip** (`data-testid="basis-chip"`, `data-basis="<CODE>"`): background `--graphite-0`,
  hairline border `--graphite-200`, padding `0 var(--space-2)`, gap `--space-1`; composes
  `<BasisMark basis={basis} />` (glyph + colour + accessible name, inheriting 12 px) followed by
  the basis label in `--graphite-700` — the label is BasisMark's own registered name
  (`tokens.basis.*`), rendered as visible text with the mark's `aria-label` suppressed in the
  chip (one announced name, not two). Unknown code throws via BasisMark.
- **CoverageChip** (`data-testid="coverage-chip"`): same tag surface as BasisChip;
  text is the enumeration `{covered} of {total}` — both counts through the count seam, in
  `.numeric` `--graphite-700`, "of" from `data.coverage.of`. Never a percentage, never a bar:
  the enumeration is the fact; a ratio is an interpretation this chip refuses to add.
- **UnitBadge** (`data-testid="unit-badge"`): background `--graphite-100`, no border, padding
  `0 var(--space-2)`, text `--graphite-700` in `.numeric` mono; the text is exactly
  `formatUnit(unit)` (`m`, `m²`, `m³`, `kg`, `nos`) — from the closed enum, never a caller's
  string (L-FMT-02).

## 6. The state block (shared layout for §7–§8)

EmptyState, ErrorState and PermissionDenied share one layout: a centred column, max-width
360 px, padding `--space-8`, text-align centre. Title `--text-14` `--weight-body-medium`
`--graphite-900`; body lines `--text-13` `--graphite-600` `--leading-ui`, `--space-2` below the
title; one action row `--space-4` below. No icons, no illustrations — the copy is the design.

## 7. The R-UI-050 roster

- **EmptyState** (`data-testid="empty-state"`): state block; `title` and `teach` are the
  screen's copy — `teach` names the next action in one sentence. With `actionLabel`/`onAction`,
  one secondary Button (`data-testid="empty-state-action"`) performs it; the button repeats the
  taught action's verb.
- **ErrorState** (`data-testid="error-state"`): state block. Title `patterns.error.title`, body
  `patterns.error.body`, then the report line — `patterns.error.reportLabel`, a space, and the
  `reportId` verbatim in `.numeric` `--graphite-700` (`data-testid="error-state-report-id"`) —
  then a secondary Button `patterns.error.retry` (`data-testid="error-state-retry"`) calling
  `onRetry`.
- **PartialNotice** (`data-testid="partial-notice"`): not a block — a full-width bar above the
  rows it qualifies: background `--warn-surface`, text `--warn`, `--text-13`, padding
  `var(--space-2) var(--space-3)`, `--radius-4`, `role="status"`. Copy is
  `patterns.partial.text` with the refused count (count seam, `.numeric`) in the slot. The
  meaning is in the words and the count, never the tint alone (R-UI-060).
- **OfflineBanner** (`data-testid="offline-banner"`): full-width bar, `role="status"`,
  background `--info-surface`, text `--info`, `--text-13`, padding
  `var(--space-2) var(--space-3)`; copy `patterns.offline` — it states read-only plainly. No
  dismiss control: the banner leaves when the connection returns, not when it is waved away.
- **PermissionDenied** (`data-testid="permission-denied"`): state block. Title
  `patterns.permission.title`; body is `patterns.permission.body` with the `permission` name
  (rendered in `--font-mono`, it is an identifier) and remedy line `patterns.permission.remedy`
  with `holder` in the slot — what permission, who holds it, both in the text. No action
  button: the remedy is a person, not a click.
- **Loading** is the existing Skeleton primitive, consumed as §4 says — nothing rebuilt here.
- **Refusal** is §8; the act pattern is §9.

## 8. RefusalState and EvidenceLink

**RefusalState** (`data-testid="refusal-state"`) renders in place of the content it refused —
never a toast (R-UI-020). A left-aligned card: background `--graphite-50`, hairline border
`--graphite-200`, `--radius-8`, padding `--space-4`, max-width 480 px. Deliberately not danger
red: a refusal is the system working, not the system broken. Stacked with `--space-2` gaps:

1. Code (`data-testid="refusal-code"`): the `RefusalCode` verbatim, `--font-mono` `--text-12`
   `--graphite-600`.
2. Message (`data-testid="refusal-message"`): `REFUSALS[code].message` verbatim, `--text-13`
   `--graphite-900`.
3. Remedy (`data-testid="refusal-remedy"`): `REFUSALS[code].remedy` verbatim, `--text-13`
   `--graphite-600`.
4. The EvidenceLink at `evidenceHref`, labelled `evidenceLabel` or the default
   `patterns.evidence.default`.

Message and remedy come only from the register — free text props do not exist. A code absent
from REFUSALS throws `Error('Unknown refusal code: <value>')` at render (the BasisMark
precedent): a plausible-looking refusal nobody registered must never reach a reader.

**EvidenceLink** (`data-testid="evidence-link"`) is the Trace affordance, exported standalone:
an anchor, `--text-13` `--cobalt-500`, always underlined (never colour-only), hover
`--cobalt-600`, focus ring class; renders `children`, or `patterns.evidence.default` when none
given.

## 9. ConsequenceDialog (R-UI-021, L-ACT-02)

Composes the primitives Dialog (§11 of that document: scrim, focus trap, Escape, close button,
160 ms fade + scale). The content carries `data-testid="consequence-dialog"`; `title` prop is
the Dialog Title. Below it, the consequence list: one row per `ConsequenceLine`
(`data-testid="consequence-line"`), 28 px, hairline dividers, `label` left in `--text-13`
`--graphite-800`, `count` right-aligned in `.numeric` `--graphite-900` through the count seam.
The UI never computes a count; the lines arrive typed from the server's preview.

Footer, right-aligned, gap `--space-2`: secondary Button `patterns.consequence.cancel`
(`data-testid="consequence-cancel"`), primary Button `patterns.consequence.confirm`
(`data-testid="consequence-confirm"`).

- **Confirm** calls `onConfirm(digest)` with exactly the digest of the consequence currently
  displayed. While the promise is in flight the confirm button is in the primitive's loading
  state (activation blocked, `aria-busy`, still focusable); cancel stays live.
- **`{ ok: true }`** closes through `onOpenChange(false)`.
- **`{ ok: false, stale }`** keeps the dialog open and re-renders every line from `stale`. Each
  changed line — new key, or same key with a different count — additionally carries
  `data-testid="consequence-stale"`: row background `--warn-surface`, count in `--warn`,
  arriving with a `--motion-state-duration` fade. Above the list a `role="status"` line in
  `--warn` `--text-13` renders `patterns.consequence.stale` (it also covers lines that
  vanished). The next confirm carries `stale.digest` — the reader confirms what is shown now,
  never what was shown before (L-ACT-02's stale-digest law, client half).
- **A commit that never answers** — `onConfirm`'s promise rejects — is the third outcome the
  typed `ConfirmResult` does not name, and it is still an answer the reader is owed: the confirm
  button leaves its loading state and a `role="alert"` line in `--danger` `--text-13` renders
  `patterns.consequence.failed` above the list. Silence after a pressed button is exactly what
  R-UI-020 forbids. The lines are unchanged (nothing was restated), so the next confirm carries
  the same digest.
- **Cancel and Escape** close without ever calling `onConfirm`. Closing also ends the episode:
  the stale notice, the changed marks and a failure line are cleared, so a dialog reopened later
  does not greet the reader with the last attempt's news.
- **The restatement is keyed on `consequence.digest`, not on the prop's object identity.** A
  screen that passes an inline `{ digest, lines }` re-creates that object on every parent render;
  discarding the restatement there would put the outdated preview back on screen and send the
  server a digest it has already refused. A genuinely new preview (a new digest) does clear it.

## 10. Copy, verbatim

| Key | Value |
|---|---|
| `data.table.selectRow` | Select row {id} |
| `data.table.expandGroup` | Expand group |
| `data.table.collapseGroup` | Collapse group |
| `data.table.resize` | Resize column {column} |
| `data.coverage.of` | of |
| `patterns.error.title` | This data could not be loaded. |
| `patterns.error.body` | Retry now. If it keeps failing, quote the report id below. |
| `patterns.error.retry` | Retry |
| `patterns.error.reportLabel` | Report id |
| `patterns.partial.text` | Refused rows: {count}. They remain in the list with their reasons. |
| `patterns.offline` | You are offline. This screen is read-only until the connection returns; the data shown may be stale. |
| `patterns.permission.title` | Permission needed |
| `patterns.permission.body` | This needs the {permission} permission, which you do not hold. |
| `patterns.permission.remedy` | Ask {holder} to grant it or to make the change for you. |
| `patterns.evidence.default` | View evidence |
| `patterns.consequence.cancel` | Cancel |
| `patterns.consequence.confirm` | Confirm |
| `patterns.consequence.stale` | The preview changed while this dialog was open. Review the updated counts; confirming applies what is shown now. |
| `patterns.consequence.failed` | This could not be confirmed — the request did not complete. Nothing was changed. Try confirming again. |

Calm, concrete, sentence case, no exclamation marks, no build vocabulary. EmptyState's copy and
`emptyReason` are the composing screen's, decided in that screen's Design Decision; refusal
message/remedy are the REFUSALS register's.

## 11. Motion (R-UI-004)

| Where | Duration | Easing |
|---|---|---|
| Row hover/selection fills, sort indicator, edit swap | `--motion-state-duration` (160 ms) | `--motion-ease` |
| ConsequenceDialog enter/exit (via Dialog) | `--motion-state-duration` (160 ms) | `--motion-ease` |
| Stale-line warn tint arrival | `--motion-state-duration` (160 ms) | `--motion-ease` |

No new durations, no loops, nothing slides; scrolling and column resize track the pointer
directly (no animation). Reduced motion: token durations zero via tokens.css; nothing here
needs an explicit stilling rule because nothing loops.

## 12. Both themes

Every rule reads role-stable tokens, so the theme flip is the token sheet's: chrome
(`--graphite-0/50/100`), hairlines, `--cobalt-100` selection tint, `--warn`/`--warn-surface`
and `--info`/`--info-surface` all carry their own dark values with contrast held (§2 of the
sheet). Pinned-cell backgrounds stay opaque in both themes by reading the same surface token as
the row they sit in. No forked CSS in either module.

## 13. Test hooks

No routes. Test ids introduced (the C-05 contract): `datatable`, `datatable-header`,
`datatable-footer`, `datatable-row`, `datatable-group-row`, `datatable-empty`,
`datatable-sort`, `datatable-select-row`, `datatable-edit-cell` (§2–§4); `basis-chip`,
`coverage-chip`, `unit-badge` (§5); `empty-state`, `empty-state-action`, `error-state`,
`error-state-retry`, `error-state-report-id`, `partial-notice`, `offline-banner`,
`permission-denied` (§7); `refusal-state`, `refusal-code`, `refusal-message`,
`refusal-remedy`, `evidence-link` (§8); `consequence-dialog`, `consequence-line`,
`consequence-stale`, `consequence-confirm`, `consequence-cancel` (§9).
