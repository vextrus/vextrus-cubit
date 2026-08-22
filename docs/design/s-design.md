# Design Decision — S-Design (the living component gallery, `/design`)

The gallery is a precision reference sheet (R-UI-011): every public component of the Datum
surface, in every state its entry declares, in both themes, on deterministic local sample data —
no network, no database, no clock in rendered output. Its reader is the person building or
grading Datum, so it is calm, dense and exact — a drawing register, not a marketing page.
Token names are `docs/design/datum-tokens.md`; component anatomy is `datum-primitives.md` and
`datum-patterns.md`.

Interpretations recorded:

1. `/design` ships unauthenticated, outside any `(app)/[tenant]` group; auth arrives in the
   auth increment (per the increment spec).
2. R-UI-011's "every state" is read as: every state the entry declares in the static grid, plus
   the overlay surfaces reached by activating the live triggers the grid renders. A permanently
   open modal would scrim the sheet and hide every other entry, so Dialog, Sheet,
   ConsequenceDialog and the floating overlays render closed with working triggers; the
   visual-baseline increment scripts the opens.
3. The gallery's empty state names a source path. Its audience is the team authoring Datum, so
   the authoring step is the true next action — the one screen where a path is product copy.

## 1. Layout and hierarchy

Page background `--graphite-50`; all text `--font-ui`, `--leading-ui`; compact rhythm
throughout (R-UI-005 — a reference sheet is a dense screen).

- **Top bar** — sticky (`top: 0`, `z-index: var(--z-sticky)`), 48 px tall, background
  `--graphite-0`, hairline bottom border `--graphite-200`, padding `0 var(--space-6)`,
  contents vertically centred. Left: the `h1` "Datum" (`--text-16`, `--weight-heading`,
  `--graphite-950`), then `--space-3` gap, then the entry count "{count} components"
  (`--text-13`, `--graphite-600`, the digits in `.numeric`, count through
  `formatNumber(String(n), 'count')`), derived from `galleryEntries.length`. Right: the theme
  control (§3).
- **Left rail** — a `nav` (accessible name `design.nav`), 200 px, sticky under the top bar,
  padding `--space-4`, hidden below `--breakpoint-md` (the sheet is read on wide screens; on
  narrow ones the single column stands alone). Three group labels — `design.module.primitives`
  / `.patterns` / `.data` — `--text-12`, `--weight-body-medium`, `--graphite-500`, sentence
  case (no letter-spaced uppercase, R-UI-003), each followed by its entries as anchor links
  `#<entry-id>`: `--text-13`, `--graphite-700`, hover `--graphite-950`, focus ring class,
  28 px line boxes, no underline at rest (the rail is navigation chrome, not prose).
- **Main column** — `main`, `max-width: 1040px`, padding `--space-6`, `--space-8` between
  sections. Three sections in barrel order — Primitives, Patterns, Data — each headed by an
  `h2` from the same `design.module.*` keys (`--text-20`, `--weight-heading`,
  `--graphite-950`), a hairline under it, then that module's entry cards.

**Entry card** (one per §5 row, in the table's order): `id="<entry-id>"` for the rail anchors;
background `--graphite-0`, hairline border `--graphite-200`, `--radius-8`, padding
`--space-4`, `--space-4` below. Header row: the entry title as `h3`
(`gallery.entry.<entry-id>`, `--text-14`, `--weight-body-medium`, `--graphite-900`), then,
right-aligned, the covered export names joined by spaces in `--font-mono` `--text-12`
`--graphite-500` (identifiers, rendered as such). Body: the states in a wrapping flex row, gap
`--space-6` horizontal and `--space-4` vertical. Each state cell carries
`data-testid="gallery-entry-<entry-id>-<state>"` and stacks: the state label
(`gallery.state.<state>`, `--text-12`, `--graphite-600`, `--space-2` below it), then the
rendered sample. DataTable's state cells span the card's full width.

## 2. The screen's own seven states (R-UI-050, forced via `?state=`)

`/design?state=<name>` forces the state; `GalleryScreen` receives it as `screenState`. The
seven names are exactly `loading | empty | error | refusal | partial | offline |
permission-denied`. Any other value, or none, renders the live gallery. The top bar and rail
always render (chrome is not what failed). The forced surface sits in the main column inside a
wrapper carrying `data-testid="design-screen-state-<state>"`. Blocking states (loading, empty,
error, refusal, permission-denied) replace the sections; partial and offline put their bar
inside the wrapper at the top of the main column with the full gallery rendered beneath —
shown, not hidden.

- **loading** — a skeleton that keeps the layout (R-UI-004): in the rail, six Skeleton bars
  120 × 12 px with `--space-3` gaps; in the main column, eight card-shaped Skeletons
  (full-width × 160 px, `--radius-8`) with `--space-4` gaps. No text, no spinner; Skeleton is
  `aria-hidden` and the wrapper carries `aria-busy="true"`.
- **empty** — `EmptyState` with title `design.empty.title` "No components are registered." and
  teach `design.empty.teach` "Add a gallery entry under src/ui/gallery/entries to put a
  component on this sheet." No action button: the remedy is authoring, not a click.
- **error** — `ErrorState` with `reportId="DSGN-0001"` (a code, rendered verbatim in
  `.numeric`). Its copy is the patterns register ("This data could not be loaded." / retry /
  report id). Retry replaces the URL with `/design` — dropping the query — so the live gallery
  renders: the honest recovery from a forced state.
- **refusal** — `RefusalState` with the registered code `STORAGE_URL_EXPIRED`,
  `evidenceHref="/design"`, default evidence label. Code, message and remedy render from the
  REFUSALS register in place (R-UI-020); nothing is toasted.
- **partial** — `PartialNotice` with `refusedCount={2}`: "Refused rows: 2. They remain in the
  list with their reasons." above the full gallery.
- **offline** — `OfflineBanner`: "You are offline. This screen is read-only until the
  connection returns; the data shown may be stale." above the full gallery, which is already
  read-only.
- **permission-denied** — `PermissionDenied` with `permission="design.read"` (a code) and
  `holder` from `design.permission.holder` "the design system owner": what permission, who
  holds it, both in the text.

## 3. Theme toggle

The Datum Switch, `data-testid="design-theme-toggle"`, in the top bar's right end: a visible
text label `design.theme` "Dark theme" (`--text-13`, `--graphite-700`, `--space-2` left of the
switch) and the same string as the switch's accessible name. Off = light (the default), on =
dark; toggling writes `data-theme="dark"` / `"light"` on `document.documentElement`, both
directions, in memory only (no persistence — later increment). The flip is instant: repainting
every token through a transition would smear the whole sheet, so no transition property is set
on theme change.

## 4. Determinism

Sample data is literal in the entry modules: fixed numbers, fixed rows, a Combobox loader that
resolves synchronously from a local array, `onConfirm` resolving `{ ok: true }`, no `Date.now`,
`Math.random` or locale-dependent formatting in rendered output. Every count and numeral goes
through the format seam and `.numeric` exactly as the component contracts already require.

## 5. The roster — entry ids, covers, states, sample data

One module per row at `src/ui/gallery/entries/<entry-id>.tsx`. "Covers" lists the sub-part
exports carried on the root's `covers` besides the root export itself. State names below are
the `<state>` segment of `gallery-entry-<entry-id>-<state>`. All quoted copy is verbatim.

| Entry id | Covers (besides root) | States | Sample (copy verbatim) |
|---|---|---|---|
| `button` | — | primary · secondary · ghost · danger · with-icon · disabled · loading | Label "Save measurement"; danger "Void signatures"; with-icon adds a 16 px plus icon |
| `icon-button` | — | default · disabled | Label "Close panel", × icon |
| `input` | — | default · disabled · invalid | Value "Ground floor plan"; placeholder "Sheet name" on disabled/invalid |
| `textarea` | — | default · disabled · invalid | Value "Column grid shifted 40 mm east of the architectural set." |
| `number-input` | — | default · disabled · invalid | Value `1234567.89`, unit `m²` (blurred display 12,34,567.89 per the primitive) |
| `checkbox` | — | unchecked · checked · indeterminate · disabled | Label "Include openings" |
| `radio-group` | Radio | default · disabled | Options "Comfortable" / "Compact", first checked |
| `switch` | — | off · on · disabled | Label "Snap to grid" |
| `slider` | — | single · range · disabled | "Sheet opacity", 0–100 at 60; range "Storey range", thumbs 2 and 7 of 0–12 |
| `select` | SelectContent, SelectItem, SelectTrigger, SelectValue | placeholder · selected · disabled | Placeholder "Choose an element class"; options "Wall" "Column" "Beam" "Slab"; selected "Column" |
| `combobox` | — | default | Placeholder "Search layers"; loader resolves to "S-COL" "S-BEAM" "S-SLAB" |
| `tabs` | TabsContent, TabsList, TabsTrigger | default | Triggers "Sheets" "Measurements" "Estimates", first active; panel "Every sheet in this set, newest first." |
| `tooltip` | TooltipContent, TooltipTrigger | default | IconButton trigger "Snap settings"; tip "Snap to grid intersections" |
| `popover` | PopoverContent, PopoverTrigger | default | Trigger "Sheet details"; body "Scale 1:100. Calibrated against grid line A–B." |
| `dropdown-menu` | DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger | default | Trigger "Sheet actions"; items "Rename sheet" "Duplicate sheet", destructive "Delete sheet" |
| `context-menu` | ContextMenuContent, ContextMenuItem, ContextMenuTrigger | default | Trigger region "Sheet B-2"; same three items |
| `dialog` | DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger | default | Trigger "Rename sheet"; title "Rename sheet"; description "The new name appears everywhere this sheet is cited."; an Input holding "Ground floor plan" |
| `sheet` | SheetClose, SheetContent, SheetTitle, SheetTrigger | default | Trigger "Open sheet details"; title "Sheet details"; body "Scale 1:100. Calibrated against grid line A–B." |
| `toaster` | — | default | One `<Toaster />` plus a secondary Button "Show a notification" firing the toast "Measurement saved." |
| `badge` | — | neutral · success · warn · danger · info | "Draft" "Signed" "Stale" "Voided" "Imported" |
| `tag` | — | default · removable | "Layer S-COL" |
| `kbd` | — | default | "⌘" and "K" as two Kbds in a row |
| `progress` | — | zero · half · full | Name "Upload progress"; values 0 / 50 / 100 of 100 |
| `skeleton` | — | default | Two bars, 240 × 16 and 160 × 16 |
| `separator` | — | horizontal · vertical | Between the words "Sheets" and "Estimates" |
| `empty-state` | — | default · with-action | Title "No sheets in this set."; teach "Upload a drawing to start measuring."; action "Upload a drawing" (no-op) |
| `error-state` | — | default | `reportId="RPT-3412"`, `onRetry` no-op |
| `partial-notice` | — | default | `refusedCount={2}` |
| `offline-banner` | — | default | — |
| `permission-denied` | — | default | Permission `estimate.sign`; holder "the project lead" |
| `refusal-state` | — | default | Code `STORAGE_URL_EXPIRED`; `evidenceHref="/design"`; default label |
| `evidence-link` | — | default · labelled | Labelled: "View sheet B-2" |
| `consequence-dialog` | — | default | Danger trigger "Void signatures"; title "Void signatures"; lines "Signatures voided" 3, "Estimate lines reopened" 14; confirm resolves `{ ok: true }` |
| `data-table` | — | comfortable · compact · grouped · empty | §6 |
| `basis-chip` | — | measured · transcribed · derived · imported · entered · interpreted · defaulted | One chip per code |
| `coverage-chip` | — | default | 14 of 96 |
| `unit-badge` | — | default | All five: m, m², m³, kg, nos |

This roster covers every capitalized component value export of the three barrels; `toast` is
lower-case and excluded by the predicate. The completeness test proves it from the barrels at
run time via `coverageReport` — this table is the design, never a frozen list in code.

## 6. The data-table entry

Columns: "Element" · "Quantity" (numeric) · "Unit" · "Basis" — header labels from the gallery
table. Eight fixed rows of element quantities (walls, columns, beams, slabs with literal
quantities like `126.40`, unit via UnitBadge, basis via BasisChip — each row exercising a
different basis where sensible). `height={240}`. comfortable: `estimateRowHeight={36}`,
`enableRowSelection` with the first row selected. compact: 28, no selection. grouped: grouping
on "Element". empty: `data={[]}` with `emptyReason` "No measurements match this filter."

## 7. Copy — the string tables (R-SPINE-060)

`src/app/design/strings.ts` exports `DESIGN_STRINGS`, frozen, typed key→English as the
existing module tables are. The whole table:

| Key | Value |
|---|---|
| `design.title` | Datum |
| `design.count` | {count} components |
| `design.nav` | Components |
| `design.module.primitives` | Primitives |
| `design.module.patterns` | Patterns |
| `design.module.data` | Data |
| `design.theme` | Dark theme |
| `design.empty.title` | No components are registered. |
| `design.empty.teach` | Add a gallery entry under src/ui/gallery/entries to put a component on this sheet. |
| `design.permission.holder` | the design system owner |

`src/ui/gallery/strings.ts` exports `GALLERY_STRINGS`, same shape, holding three families:
`gallery.entry.<entry-id>` — the entry title, the component name in sentence case with spaces
("Button", "Icon button", "Number input", "Data table", "Basis chip", …);
`gallery.state.<state>` — the state label, the state name with hyphens as spaces in sentence
case ("Primary", "With icon", "Off", "Measured");
and `gallery.sample.<entry-id>.<slot>` — every quoted sample string in §5–§6, one key per
string. No string literal reaches JSX except `data-testid` values and codes
(`STORAGE_URL_EXPIRED`, `DSGN-0001`, `RPT-3412`, `estimate.sign`, `design.read`, layer and
grid identifiers inside table copy are part of their table strings). Voice everywhere: calm,
concrete, sentence case, no exclamation marks, no build vocabulary — §2's empty state is the
recorded exception.

## 8. Motion (R-UI-004)

The screen adds no motion of its own: it is a reference sheet, arriving by navigation, and its
entries already carry the primitives' contractual motion (which is itself on display). The
loading state's Skeletons pulse per the primitive and are stilled under
`prefers-reduced-motion` by primitives.css; token durations zero via tokens.css. The theme
flip is deliberately untransitioned (§3). Nothing else animates.

## 9. Tokens

Only the names above: surfaces `--graphite-0/50`, hairlines `--graphite-200`, text
`--graphite-500/600/700/900/950`, focus `--cobalt-500` via `datum-focus-ring`, type
`--text-12/13/14/16/20` with `--weight-heading/--weight-body-medium`, spacing
`--space-2/3/4/6/8`, radius `--radius-8`, `--z-sticky`, `--breakpoint-md`, `.numeric` for
every numeral. No colour, spacing or duration literal anywhere in `src/app/design/**` or
`src/ui/gallery/**` (R-UI-001); the px sizes named here (200 rail, 1040 column, 48 bar,
skeleton geometry) are layout dimensions, not token roles.

## 10. Both themes

Everything reads role-stable tokens, so the flip is the token sheet's: `--graphite-0` cards on
a `--graphite-50` canvas read as white-on-paper in light and near-black-on-black in dark, with
hairlines carrying the card edges in both. No forked CSS in this screen. Light is the default
(`data-theme` absent or `"light"`); the toggle is the only writer of the attribute.

## 11. Test hooks (C-05)

Routes: `/design`;
`/design?state=<loading|empty|error|refusal|partial|offline|permission-denied>`.
Test ids: `design-gallery-root` (the wrapper around top bar, rail and main column),
`design-theme-toggle` (§3), `design-screen-state-<state>` (§2, the seven names), and
`gallery-entry-<entry-id>-<state>` for exactly the id × state pairs of §5's roster. All entry
cells render inside `design-gallery-root` in the live gallery and in the partial and offline
states. No other test ids or routes are introduced.
