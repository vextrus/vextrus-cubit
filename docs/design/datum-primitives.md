# Design Decision — datum-primitives

Not a routed screen. This document decides the Datum primitive library: the anatomy, states,
copy, motion and tokens of every component `src/ui/primitives/` exports. It is the contract for
`src/ui/primitives/index.ts`, `src/ui/primitives/primitives.css`,
`src/ui/primitives/strings.ts` and the component files beside them. The `/design` gallery that
renders the roster in both themes ships later under R-UI-011; the visual baselines and the axe
pass (J-004, Q-11) land with it.

Nothing here paints a value. Every colour, radius, size, shadow and duration below names a
variable `src/ui/tokens.css` defines (R-UI-001), so a theme flip reaches every primitive and
there is no second place a colour can be decided.

## 1. Hierarchy — what the library is for

Three layers, and a primitive belongs to exactly one:

1. **Input** — Button, IconButton, Input, Textarea, NumberInput, Checkbox, Radio, RadioGroup,
   Switch, Slider, Select, Combobox. These hold what the user is deciding.
2. **Overlay** — Tabs, Tooltip, Popover, DropdownMenu, ContextMenu, Dialog, Sheet. These move
   the user between things without moving the page under them.
3. **Feedback and ornament** — Toast, Badge, Tag, Kbd, Progress, Skeleton, Separator. These say
   what happened, or what a thing is.

Everything interactive obeys one rule before it obeys its own (R-UI-012): the element the Tab
key lands on carries `datum-focus-ring`, and it has an accessible name. The ring is declared
once, in `src/ui/primitives/primitives.css`, as a 2 px outline in `--cobalt-500` at
`outline-offset: var(--space-1)`'s scale — outside the control's own border, which is what
"outer" asks for — and only on `:focus-visible`, so a pointer user is never ringed.

## 2. Both themes

Every rule in the stylesheet resolves through a token, so `data-theme="light"` and
`data-theme="dark"` need no separate rules. The light theme paints surfaces `--graphite-0`,
insets `--graphite-100` and ink `--graphite-900`; the dark theme flips the same variables and
every primitive follows without a line of component code changing. What the dark theme must not
do is reduce the ring: `--cobalt-500` is the ring colour in both, and both values were fixed
against contrast in the datum-tokens decision.

Hairlines are `--hairline` everywhere. Elevation is `--shadow-3` for a floating surface and
`--shadow-4` for a modal one — never a hand-written shadow, because a shadow is a colour.

## 3. Motion (R-UI-004)

| Change | Duration | Easing |
|---|---|---|
| Any state change — hover, checked, selected, highlighted | 160 ms (`--motion-state-duration`) | `--motion-ease` |
| A panel arriving or leaving — Dialog, Sheet, scrim | 240 ms (`--motion-panel-duration`) | `--motion-ease` |
| The viewer fly-to, when the viewer ships | 320 ms (`--motion-flyto-duration`) | `--motion-flyto-ease` |

No bounce, anywhere: the easing tokens are the only two curves this library uses.

`prefers-reduced-motion: reduce` is honoured by the token sheet itself, which resolves each of
the three duration tokens above to 0 ms under that query, which settles every transition: no
component may hard-code a duration, so reduced motion reaches each of them for free. The one
thing a zero duration does not settle is a keyframe animation that loops — an `infinite`
animation of no length is still an animation running forever — so the primitives' own
stylesheet restates the query once, to turn those off outright: the busy bar, the Skeleton, and
the arrival of a floating or modal surface.

Loading never spins. A button in flight shows a bar that changes opacity in place; a region
whose content has not arrived shows a Skeleton at the size the content will be. Both keep the
layout still, which is what R-UI-004 asks for.

## 4. Copy — the whole of it, verbatim (AM-03 (2))

Every user-facing default string this library renders is registered in
`src/ui/primitives/strings.ts` and decided here. There are six, and no component may improvise
a seventh.

| Key | Value | Where it is read |
|---|---|---|
| `primitives.combobox.loading` | `Loading options` | Combobox, while its loader is out |
| `primitives.combobox.empty` | `No matches` | Combobox, when the loader resolved to nothing |
| `primitives.combobox.list` | `Suggestions` | The accessible name of the Combobox listbox |
| `primitives.dialog.close` | `Close` | A Dialog's own corner control, when it has no label of its own |
| `primitives.sheet.close` | `Close` | The same control on a Sheet |
| `primitives.toast.region` | `Notifications` | The name of the region toasts arrive in |

The voice: a state describes itself in as few words as carry the meaning, sentence case, no
terminal full stop, no exclamation, and never an apology. "Loading options" says a request is
out; "No matches" says one came back empty. They are different sentences because they are
different states, and reporting the first as the second is a copy defect.

Every other word in a primitive comes from the screen that mounts it — a Button's label, a
Dialog's title, a Badge's text. Those are decided in that screen's own Design Decision.

## 5. Test ids this document introduces (AM-03 (1))

| Test id | On |
|---|---|
| `number-input-field` | the NumberInput's `<input>` |
| `number-input-suffix` | the NumberInput's unit, beside the number |
| `combobox-input` | the Combobox's `role="combobox"` input |
| `combobox-list` | the Combobox's `role="listbox"` |
| `combobox-option` | one offered option |
| `combobox-empty` | the Combobox's "no matches" state |
| `dialog-content` | the Dialog's modal surface |
| `sheet-content` | the Sheet's modal surface |
| `toast-region` | the container the toast list is announced in |

## 6. Anatomy and states, primitive by primitive

The R-UI-050 screen states — loading, empty, error, refusal, partial, offline,
permission-denied — belong to screens, not to controls; a primitive owns only the states listed
against it. The states a screen owns are decided in that screen's document, and the
RefusalState, ErrorState and EmptyState components that render them are later leaves of this
same module.

### Button

`[icon?] label [busy?]` in one row, `--space-2` between. Four variants, selected by
`data-variant`, never by a class the caller composes:

| Variant | Rest | Hover |
|---|---|---|
| `primary` | `--cobalt-500` fill, `--graphite-0` ink | `--cobalt-600` |
| `secondary` | `--graphite-0` fill, `--hairline` border, `--graphite-900` ink | `--graphite-50` |
| `ghost` | no fill, `--graphite-800` ink | `--graphite-100` |
| `danger` | `--danger` fill, `--graphite-0` ink | `--danger`, saturated |

Height `--row-comfortable`, radius `--radius-4`, weight `--weight-body-medium`.

States: rest · hover · focus (ring) · **loading** — `aria-busy="true"`, `aria-disabled="true"`,
the pulsing bar, and activation refused, because every act in this product writes a document
and a double click on a slow submit writes two. A loading button keeps its place in the tab
order; it is not `disabled`, because a control that vanishes from the keyboard mid-act loses
the user their place. Disabled is the platform's `disabled`, painted `--graphite-400`.

### IconButton

A square Button of side `--row-comfortable` holding one glyph. `label` is required and is
rendered as `aria-label`: an icon-only control is the commonest unnamed button, and a required
prop is the only version of that rule the compiler can enforce.

### Input

Full-width field, height `--row-comfortable`, padding `--space-2` `--space-3`, `--hairline`
border, `--radius-4`, ink `--graphite-900`, placeholder `--graphite-500`. States: rest · hover ·
focus (ring) · disabled (`--graphite-50` fill, `--graphite-400` ink).

### Textarea

The Input, at twice the minimum height, resizable vertically only.

### NumberInput

`[ field ][ unit ]`, `--space-2` apart. The field is `[data-testid="number-input-field"]`; the
unit, when there is one, is `[data-testid="number-input-suffix"]` in `--graphite-600` at
`--text-13`. The field is `--font-mono` with `tabular-nums slashed-zero` and right-aligned, so
a column of amounts lines up whether it is being read or edited (R-SPINE-061).

Two states, and they are the whole control:

- **being edited** (focused): the raw decimal string, exactly as typed. Grouping is not
  editable text — a caret landing after a separator nobody typed is a caret in the wrong place.
- **at rest** (blurred): what SEAM-FORMAT makes of it — lakh/crore, ASCII digits, so
  `1234567.89` reads `12,34,567.89` and `10000000` reads `1,00,00,000` (B-07, R-SPINE-061).

An empty field is empty at rest, never a zero and never `NaN`. Characters outside `0-9`, a
single `.` and a leading sign are refused: the keystroke is dropped and the digits around it
survive, so `12a3` is `123`, and a pasted `1,234,567` becomes `1234567` rather than nothing.
The value crosses the prop boundary as a string in both directions; there is no `number` in
this control at any moment.

### Checkbox and Radio, RadioGroup

A `--space-4` square (Checkbox, `--radius-2`) or circle (Radio) with `--hairline`, filled
`--cobalt-500` when checked, the indicator drawn in `--graphite-0`. RadioGroup stacks its
options `--space-2` apart and is one tab stop: the arrows move between options inside it.
States: unchecked · checked · focus (ring) · disabled.

### Switch

A `--space-5`-high track, `--graphite-300` when off and `--cobalt-500` when on, with a
`--graphite-0` thumb that travels in 160 ms. `role="switch"` with `aria-checked`; a Switch
commits immediately, so it is never used for anything that needs a confirmation.

### Slider

Track `--graphite-200`, range `--cobalt-500`, thumb `--graphite-0` with a 2 px `--cobalt-500`
border. The thumb is the focusable element, so the thumb — not the root — carries the ring and
the accessible name.

### Select

Trigger: `--row-comfortable` high, `--hairline`, `--radius-4`, with a `--graphite-600` chevron.
Content: a floating surface, `--shadow-3`, `--radius-8`, rising 160 ms. An item is
`--row-compact` high and highlights `--cobalt-100`. An option renders its label and nothing
else, so the name a screen reader speaks is the word being chosen.

Keyboard: Enter, Space or ArrowDown opens; the arrows move the highlight; Enter commits;
Escape closes and hands focus back to the trigger.

### Combobox

`[ input ]` over a floating surface holding, in order, a status line and the listbox. The input
is `[data-testid="combobox-input"]` with `role="combobox"`, `aria-expanded` and
`aria-controls` naming `[data-testid="combobox-list"]`; the arrows move
`aria-activedescendant` across `[data-testid="combobox-option"]` without focus ever leaving the
input.

Three states, and they are three:

- **loading** — the loader is out. `Loading options`, in `--graphite-600` at `--text-13`, in a
  `role="status"` line. Not "no matches": a pending request reported as an empty result tells
  the user their search failed when it has not run.
- **options** — what the loader resolved, and only that. This control narrows nothing itself;
  filtering belongs with the data.
- **empty** — the loader answered a query with nothing: `No matches` in
  `[data-testid="combobox-empty"]`.

The listbox is named `Suggestions`, because it has no visible label of its own. Only the newest
request may paint, so a slow answer cannot overwrite a fast one.

### Tabs

A `--hairline` rail of triggers, each `--row-comfortable` high, the active one inked
`--graphite-950` over a 2 px `--cobalt-500` underline and the rest `--graphite-600`. The list is
one tab stop; ArrowRight and ArrowLeft rove inside it and activation is automatic, because a
Datum tab switches a view that is already loaded. `aria-selected` marks exactly one trigger and
`aria-controls` names its `role="tabpanel"`.

### Tooltip

`--graphite-900` surface, `--graphite-0` ink, `--text-13`, `--radius-4`, rising 160 ms. A
tooltip repeats or qualifies a label; it never carries the only copy of anything, because it is
unreachable by touch.

### Popover

The floating surface of §Select — `--graphite-0`, `--hairline`, `--radius-8`, `--shadow-3`,
`--z-overlay` — anchored to its trigger, dismissed by Escape or a click outside.

### DropdownMenu and ContextMenu

The same surface, holding items of `--row-compact` that highlight `--cobalt-100`. A menu item
is reachable while the menu is open and carries the ring. The ContextMenu trigger is a region
you press the context key on, not a control you tab to — it is the one interactive part of this
library that is deliberately not a tab stop.

### Dialog

Centred, `--radius-12`, `--shadow-4`, `--space-6` padding, over a `--graphite-1000` scrim at
40% opacity. `[data-testid="dialog-content"]`, `role="dialog"`, `aria-modal="true"`, labelled
by its Title — the same heading the user can see, so the name never drifts from it. Anatomy:
Title, Description, body, actions; the corner close control is named `Close`. Arrives in
240 ms.

Keyboard: Tab and Shift+Tab stay inside while it is open, Escape closes it, and focus returns
to the trigger that opened it.

### Sheet

The Dialog, arriving from an edge instead of the centre: `[data-testid="sheet-content"]`, full
height, `--hairline` on its inner edge, sliding in over 240 ms. Right by default, because a
detail panel lives on the right. Same modal contract, same `Close`, because a side panel that
behaved differently under the keyboard would be a second contract to keep in step.

### Toast

`[data-testid="toast-region"]` at `--z-toast`, wrapping sonner's own list, which announces in
an `aria-live="polite"` region so a message is spoken as it arrives rather than interrupting.
The region is named `Notifications`. A Toast reports what happened; it never asks a question,
because it disappears.

### Badge

A `--row-compact` pill, `--radius-12`, neutral `--graphite-100` over `--graphite-800`, with the
four semantic tones painting `--info`, `--success`, `--warn` and `--danger` over their
`-surface` tints.

### Tag

The Badge's geometry at `--radius-4`, `--graphite-0` over `--hairline` — a label a user
attached, where a Badge is a state the system computed.

### Kbd

A `--font-mono` key cap at `--text-12`, `--graphite-50` over `--hairline`, `--radius-2`.

### Progress

A `--space-2` bar, `--graphite-200` track, `--cobalt-500` fill, growing in 160 ms.
Determinate only: where the fraction is unknown the answer is a Skeleton, because a bar that
animates without knowing how far along it is states a number nobody measured.

### Skeleton

A `--graphite-100` block of the size the content will be, `--radius-4`, breathing between two
opacities over 240 ms. `aria-hidden`, because there is nothing there yet to announce.

### Separator

One pixel of `--graphite-200`, horizontal or vertical, decorative by default.
