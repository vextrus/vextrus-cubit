# Design Decision — S-Measure (manual measurement: the tools, the chest, the card, the book)

S-Measure is the viewer in its measuring mode (bible:625, "manual measurement mode in the viewer:
tool chest, conditions/assemblies editor, measurement list, legend"). A quantity surveyor measures a
sheet by hand with snaps, under a named condition, and each finished measurement is confirmed as an
act on a compact card at its closing point. From there it reaches the gate as an offer under the
condition's kind, and it lands in the register, the draft BOQ and the measurement book. This is the
M4 exit's path: "a QS can measure a sheet with no auto-detection at all" (bible:829).

Precedence is the Bible, then `00-direction.md`, then this file. This file is the one home of
S-Measure's layout, states, copy, motion, tokens, test hooks and the law readings below (C-13, B-17).
`docs/design/viewer.md` still rules the frame, the canvas, the layers panel, snapping (Part 4) and the
scale tab (Part 5). Nothing of those is re-decided here. Where a row of viewer.md names the tools as
disabled (viewer.md:27, §3.1 of the Direction) or names their owner in an IOU (viewer.md:2370-2371,
"owner: inc-407"), that row now points here; the sentence rides the wave's integration commit (§13).

Law applied: R-TO-040…044, R-UI-042, R-UI-021/020/022/023/050/060/080/081/082/083, R-TO-012/015/017,
L-REG-01…06, L-QTY-01…05, L-MEA-01/02/05/08/09, L-FRM-04, L-ACT-01…03, L-CAD-02/06/07, R-TO-003,
B-17, B-19, C-05, C-13, AM-08.

Who builds what (session 8's slices; each amends this file in the commit that lands it, C-13):
S1 the act, the markless key and the store · S2 the manual methods · S3 manual offers to the gate ·
S4 the armed tools and the gesture grammar · S5 the condition chest · S6 the card and J-000's leg ·
S7 the measurement book · S8 the legend's manual conditions (in VD-4's legend) · S9 the rest of the
toolset · S10 assemblies · S11 J-041.

This Decision defines I-370 … I-394, I-497 … I-501 (session 8), I-538 and I-539 (S2), I-573, I-574, I-575 and I-576 (S5), and I-586 … I-589 (S3), and cites D-005 (entered session 9, `docs/decisions/deviations.md`).

---

## The frame in measuring mode (Direction §3.1, unchanged geometry)

```
┌R─┬──────────────────────────────────────────────────────────────────┬─ I ─────┐
│▲ │ ws › BNBC Residence ▾ › Drawings › S-08 Grade beam layout  ⌘K ⟳ ✉ ◉│(only on │
│  ├──────────────────────────────────────────────────────────────────┤ select) │
│▦ │ ⌖ ✋ │ ⟋ ▱ ⊕ ▾ │ ◈ Snap Ortho Angle │ ⊞ ▤ │ ⛶ + − │       L≡ V≡ │         │
│▤ ├──────────┬──────────────────────────────────────────────┬────────┤         │
│⚙ │▾Conditions│                                              │        │         │
│  │■ 75 CC bl…│  ┌──────────────────────────────┐            │        │         │
│  │  1   … m³ │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│            │        │         │
│  │■ SOG 125 …│  │▒▒▒▒▒▒▒▒┌──┐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│            │        │         │
│  │+ New cond.│  │▒▒▒▒▒▒▒▒│  │▒▒ A 320.791 m² ▒▒▒▒│            │        │         │
│  │▾Measured  │  │▒▒▒▒▒▒▒▒└──┘▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│            │        │         │
│  │ on S-08   │  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│            │        │         │
│  │■ 75 CC …  │  ◆──────────────────────────────◆┐           │        │         │
│  │▸Layers    │                                   │ CARD 320  │        │         │
│  │▸Views/grid│   CANVAS (≥ 70 % of viewport)     │ at the    │        │         │
│  │   200     │                                   │ closing ◆ │        │         │
│  ├──────────┴───────────────────────────────────┴────────────┤         │         │
│  │ S-08 │ scale ✓ │ x −125.0 y −400125.0 │ 20.672 m │ endpoint │ Area · 5 pts · 328.838 m² │ ● │
└──┴──────────────────────────────────────────────────────────────────┴─────────┘
```

The tool row's measure group is **Linear L · Area A · Count C · ▾ (M, the measure menu)**, armed. The
armed tool wears the Direction's 2 px beam underline (`aria-pressed`). The left drawer is one column of
collapsible groups, in this fixed order: **Conditions** (the chest) · **Measured on this sheet** ·
**Layers** · **Views and grid**. The card floats over the canvas at the closing point. It is an
overlay, not a docked region, so the canvas box does not change.

| Region | Purpose | Width | Min | Max | Owner (file) | Empty | Error | Loading |
|---|---|---|---|---|---|---|---|---|
| rail | app areas | `--rail-w` 48 | 48 | 48 | shell | — | — | — |
| topbar | location, ⌘K, jobs, notifications, user | 100 % × 40 | — | — | shell | — | — | crumb bone |
| tool row | Select · Pan ǀ **Linear · Area · Count · ▾** ǀ Snap · Ortho · Angle ǀ Views · Grid ǀ Fit · + · − ǀ L≡ V≡ | 100 % × `--toolbar-h` 32; 28 px buttons | — | — | `viewer-toolbar.tsx` (S4) | tools disabled with the reason in the tooltip (§3) | — | — |
| drawer › Conditions | the project's chest: swatch, name, hotkey, running total per kind | drawer 200 | 160 | 320 | `measure-chest.tsx` (S5) | teaching empty state + New condition | inline retry + report id | 3 row bones |
| drawer › Measured on this sheet | this sheet's measurements, grouped by condition, with subtotals | drawer 200 | 160 | 320 | `measure-list` group (S7; until it lands, S6's commit is said in the measure cell, §2.4) | one line: nothing measured here yet | inline retry + report id | 3 row bones |
| drawer › Layers, Views and grid | unchanged (viewer.md Parts 1 and 3) | drawer 200 | 160 | 320 | viewer.md | viewer.md | viewer.md | viewer.md |
| canvas (primary) | the sheet; the draft outline, its points, the running figure, committed measurements in their condition's paint | flex; ≥ 70 % of viewport | — | — | `viewer-stage.tsx` + `measure-region.tsx` (S4) | viewer.md's absences | viewer.md | viewer.md |
| card | the measurement's consequence: condition, the readings, the book rows, the quantity per kind with its formula and basis, level, scale, digest; Cancel · Cut out · Confirm | 320 | 288 | 360 | the ConsequenceDialog's MEASUREMENT arm, placed by `measure-region.tsx` (S6) | — (never empty, I-373) | refusal: the card's refusal slot; fault: the card's own ErrorState, the outline kept (§3) | skeletons keep the card's shape |
| inspector (the shell's one slot) | the selected measurement: book rows, lines, basis, act, Edit, Delete; or the entity as today | `--inspector-w` 320 | 280 | 480 | viewer inspector (S7 adds the measurement arm) | absent, width 0 | RefusalState in the tab | tab skeleton |
| status | mono readout; gains the **measure cell** while a tool is armed | 100 % × 24 | — | — | `status-line.tsx` (S4) | cells show `—` | — | — |

**The canvas law, in numbers (R-UI-080, Direction §1).**
- At 1440×900 with no selection: 1440 − 48 − 200 = 1192 wide × (900 − 40 − 32 − 24) = 804 tall =
  958 368 px², which is 73.9 % of the viewport.
- At 1280×800: 1032 × 704 = 726 528 px², which is 71.0 %.
- With a measurement selected, the inspector takes 320 and the drawer collapses, exactly as it does
  for an entity selection today (the Direction's "one lawful dip", §3.1). That dip is inherited, not
  introduced here, and it is below R-UI-080's 70 %: 1072 × 804 = 66.5 % at 1440×900, and
  912 × 704 = 62.7 % at 1280×800 (65.4 % at the inspector's 280 minimum), which is also under the
  Direction's own "≥ 66 %". S-Measure adds no width to a selection. The dip's owner is the viewer
  frame (`viewer.md`), and the figures ride integration there (§13).
- The card never changes these figures: it floats above the canvas and goes away on Confirm or Esc.
- Nothing is added above the canvas: the tool row is the frame's 32 px track, so the canvas still
  starts at the top of main, 72 px below the viewport's top edge (40 + 32; R-UI-081's limit is 240).

### The card (anchored at the closing point)

```
             ◆ closing point
              ╲ (hairline leader in --canvas-measure when the card sits > 24 px away)
  ┌───────────────────────────────────────────────┐  320 wide, --surface-overlay 92 %, blur 12
  │ RECORD A HAND MEASUREMENT                      │  overline (DLG-1's act words)
  │ ■ 75 CC blinding under SOG                      │  swatch · condition name
  │   Slab · Blinding · Ground floor ▾ · S-08       │  class · kind · level (Combobox) · sheet
  │ t  75 mm  ▣ note "75 THK BLINDING UNDER…" ▾      │  a reading and its source (§2.5)
  │ ─────────────────────────────────────────────── │
  │   1 × A 328.8384 m²               × 0.075 = 24.663 │  book row, gross (the SOG's own outline, 81D)
  │ Less: 1 × 2.9932 × 2.6884  opening × 0.075 =  0.604 │  cut-out (lift pit), opening channel
  │ Less: 25 columns (register)        × 0.075 =  0.304 │  junction deduction (I-389), plan ∩ ring
  │ Net                              ƒ Derived = 23.755 m³ │  per kind; the line's basis chip
  │ ─────────────────────────────────────────────── │
  │ Formula  count × (A − openings − junctions) × t  │  the gate's own template (L-QTY-03)
  │ Scale    X 0.001 · Y 0.001 m per unit  #3f9c… ⎘  │  factors + calibration key IdChip
  │ Counts what you traced and nothing else on GF.   │  one line (I-390)
  │ ▸ Consequence digest                             │  DLG-1's disclosure
  │                  Cut out  X   Cancel   ● Confirm ⌘↵│  footer; copper only on Confirm
  └───────────────────────────────────────────────┘
```

### The book (Takeoff › Measurements, `/t/{tenant}/p/{project}/takeoff/measurements`)

```
┌R─┬──────────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › BNBC Residence ▾ › Takeoff › Measurements           ⌘K ⟳ ✉ ◉│(on sel) │
│  ├──────────────────────────────────────────────────────────────────┤         │
│  │ Register · Measurements · Coverage · Levels · Schedules · BOQ · BBS  Export│         │
│  ├──────────────────────────────────────────────────────────────────┤         │
│  │ Condition·All ▾ Sheet·All ▾ Level·All ▾ Basis·All ▾        4 of 4 │         │
│  ├───────────────────┬─────┬───┬─────┬───────┬───────┬───────┬──────┬───┬─────┤  │
│  │ Item              │Sheet│Lvl│ No  │   L   │   B   │   D   │  Qty │Unit│Basis│ │
│  │ ▾ 75 CC blinding under SOG                              23.755 m³          │  │
│  │   gross (traced)  │S-08 │GF │  1  │ A 328.8384 m² │ 0.075 │24.663│ m³ │ ▣ T │  │
│  │   Less: cut-out   │S-08 │GF │  1  │ 2.9932│ 2.6884│ 0.075 │ 0.604│ m³ │ ▣ T │  │
│  │   Less: columns   │S-10 │GF │ 25  │  (register)   │ 0.075 │ 0.304│ m³ │ ƒ D │  │
│  │   Net             │     │   │     │       │       │       │23.755│ m³ │ ƒ D │  │
│  ├───────────────────┴─────┴───┴─────┴───────┴───────┴───────┴──────┴───┴─────┤  │
│  │ (sticky footer) per unit: 23.755 m³                                        │  │
└──┴──────────────────────────────────────────────────────────────────┴─────────┘
```

Scale, Measured by and On stand to the right of Basis (§2.10); the sketch stops at Basis for width.
The Basis cell of a row is that row's own weakest-wins roll-up: the gross row above is ▣ TRANSCRIBED
because its geometry is MEASURED and its t was read off note 828. The gross ring is the slab's own
five-point outline, not a rectangle, so it prints its area across L and B (I-391). The figures are
the J-000 ring's as read this session (I-393); the leg asserts the gate's evaluation, never these
digits.

The book is Direction §3.2's grid template. Its region table is s-takeoff's own (tabs row, filter bar,
grid ≥ 55 % of main, sticky footer, inspector on selection), with three differences:
- no index rail;
- a group row per condition, with its per-kind Net;
- child rows in the measurement book's order: gross, then "Less:" rows, then Net.

At both viewports the grid's first row starts 88 px below the top of main. S7 builds it and amends
`s-takeoff.md` for the tab.

---

## 0. Interpretations

Each is the most defensible reading of the law it names. Each is put to the `refuter` before the
slice that applies it builds on it (§11). A refuted Interpretation is amended here, or it becomes a
Deviation in `docs/decisions/deviations.md` in the same commit (CLAUDE.md, Law).

- **I-370 — S-Measure is a mode of the viewer, not a route.** The Bible calls it "manual measurement
  mode in the viewer" (bible:625), and the Direction draws it on the viewer's template (§3.1). It
  keeps the viewer's route (`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}`), its one
  `VIEWER_STATES` matrix (S-Measure's cells are written into it, §3) and its frame.
  - The armed tool is local state and never enters the address, like Snap's pressed state (I-148). A
    reload or a shared link lands in Pan (the viewer's resting tool), with nothing drawing (amended on the refuter's pass, session 9).
  - The measurement book is the one new route (Takeoff › Measurements).
  - Rejected: a `/measure/…` route, which would be a second viewer with a second states matrix
    (B-17). Rejected: `?tool=` in the address, which would make a pasted link start drawing on the
    reader's sheet.

- **I-371 — While a measure tool is armed, the plain click belongs to the tool.** In Linear, Area and
  Count a plain click places a point. The selection gestures (click, Shift+click, the marquee) are
  suspended until the reader returns to Select (V, or Esc from an idle tool). The distance pick of
  I-145 (Alt+click, or Enter on the canvas) belongs to Select and stays exactly as it is there. Inside
  an armed tool, Alt+click places nothing and picks nothing: the status reads
  `measure_status_pick_in_select`, because the running figure already gives every length and a
  modifier that silently did something else would cost a point. Enter finishes the shape (I-372).
  This amends I-145 only inside an armed measure tool.
  - Rejected: Alt+click points. A QS places hundreds of points a day, and every tool they come from
    (Bluebeam, PlanSwift, OST, CostX) places them with a plain click. A chord per point is hostile.

- **I-372 — The gesture grammar (R-UI-042), whole.** One grammar serves Linear, Area, Count and every
  later tool (S9). It is a pure state machine (`viewer-measure/gesture.ts`, S4) with no DOM.

  | Input | Drawing (points placed) | Closed, card open | Closed, card dismissed (a draft) | Nothing in progress |
  |---|---|---|---|---|
  | click | place a point (snapped where a glyph shows, free otherwise) | — (the card is modal) | nothing; the status reads "Finish or discard this outline first" | place the first point |
  | Alt+click | nothing; the status reads `measure_status_pick_in_select` (I-371) | — | same as drawing | same as drawing |
  | Space (canvas focused) | place a point at the keyboard cursor (R-UI-060) | — | — | place the first point |
  | press-and-drag > 4 px | pan; no point; the draft survives | — | pan | pan |
  | wheel, + / − | zoom; the draft survives | — | zoom | zoom |
  | Enter, or double-click | finish: Linear ≥ 2 points, Area ≥ 3 (closes the ring), Count ≥ 1; opens the card. A double-click's second click places no point | — | re-open the card | — |
  | Backspace | remove the last point | — | re-open the shape for editing (the closing edge goes) | — |
  | Esc | discard the shape ("Measurement discarded") | close the card; the shape stays as a draft; nothing is committed | discard the draft | return to Select (then the viewer's own Esc clears the selection, I-145) |
  | Shift (held) | constrain the live segment from the last point: 0°/90°, or 15° steps with Angle lock pressed | — | — | — |
  | X (Area) | — | close the card and start a cut-out ring inside the outline | start a cut-out ring | — |
  | ⌘/Ctrl+Enter | — | **Confirm** (I-373) | — | — |
  | L / A / C / V / H / 1–9 | nothing; the status reads "Finish or discard this outline first" | — | same as drawing | arm that tool (a digit picks that condition and arms its tool; V returns to Select, H to Pan) |
  | S, F | toggle snapping; fit the sheet — the draft survives | — | same as drawing | same as drawing |
  | M | open the measure menu | — | — | open the measure menu |

  - Shift uses the snapping region's own `constrainOrtho` and angle-lock step (viewer.md Part 4, I-148),
    anchored at the last placed point instead of pick 1. It is one home and no second implementation.
    The toolbar's Ortho and Angle toggles hold the same constraint without Shift.
  - Rejected: Bluebeam's 45° default for Shift. The product already locks in 15° steps (I-148), and one
    product with two angle grammars would be two grammars.
  - A tool key does not discard a shape in progress. A stray key never costs a QS their outline;
    only Esc discards, and it says so. Keys that move nothing a shape depends on (S, F, the zoom keys)
    work mid-shape.
  - The roster (`src/ui/shell/shortcuts/roster.ts`, R-UI-032's one home) already binds V, H, M, C, L,
    A, S, F and Escape. It gains the lines this grammar adds, so the ? sheet and ⌘K list them:
    `viewer-condition` (1–9), `viewer-measure-cutout` (X), `viewer-measure-finish` (Enter),
    `viewer-measure-undo` (Backspace), `viewer-measure-point` (Space) and `viewer-measure-confirm`
    (Mod+Enter), each labelled from `shortcuts.ts` (§4). Owner: S4 for the cut-out, finish, undo and
    point lines (landed), S5 for the digits, S6 for Confirm with the card it confirms (I-499).
  - A cut-out ring must lie wholly inside its outer ring and must not overlap another cut-out.
    Otherwise it is not closed, and the status names why (`measure_status_cutout_outside`).

- **I-373 — The card is a ConsequenceDialog, presented at the closing point. Confirm is the act, and
  the digest binds the recipe and the previewed figure.** R-UI-042 asks for "a compact inline card …
  with confirm as the act". R-UI-021 asks that "every act opens a ConsequenceDialog". Both hold
  because the card IS the one ConsequenceDialog (B-17):
  - Same component, same `preview()`/`commit({ consequenceDigest })`, the same pending, stale,
    refused and committing states, and the same single RefusalState slot.
  - It is presented anchored: portalled into the viewer's root (the `container` of I-167), placed
    beside the closing point instead of centred, with a transparent scrim so the traced shape stays
    visible behind it. It stays modal: focus is trapped, the rest of the screen is inert, and an
    inert act button elsewhere paints disabled, so only one copper act is operable at a time.
  - The Consequence gains a `MEASUREMENT` rendering arm (I-45's total map). The arm carries the
    recipe as applied (condition name, geometry type, class, kinds → rule ids, attribute readings with
    their bases), the book rows, the previewed figure per kind (the gate's own `judgeOffer`, never a
    second calculation), the level, the view and the calibration keys.
  - The digest binds the arm's payload: S1 adds it to what `judged` (`src/core/acts/consequence.ts`)
    hashes, as `effects` was added for R-TO-020. Today `judged` binds only the act type, tenant,
    project, rendering arm, the subjects' ids with their before/after lists, and the effects; a
    figure outside them would not be confirmed by the digest (the critic's R-UI-021 correction).
    What the QS confirmed is therefore the recipe and the figure they read, and a different figure
    at commit is `CONSEQUENCES_NOT_CARRIED`, re-rendered as stale (I-44).
  - Subjects: the new register object (none → REGISTERED) and, on an edit, its predecessor
    (REGISTERED → REPUDIATED, I-379).
  - The footer gains an optional secondary action, **Cut out (X)**, before Cancel.
  - What the pattern gains, whole (each touches `ConsequenceDialog`, which DLG-1 owns this wave, so
    the list is handed to DLG-1 and rides integration, §13): the optional footer secondary action;
    an anchored presentation (a point anchor, placement beside it, a transparent scrim, and
    `data-presentation="anchored"`); a Mod+Enter confirm that never takes a bare Enter; and a
    consumer error boundary inside the dialog (the fault arm below). Nothing else changes.
  - Confirm answers **⌘/Ctrl+Enter** and never a bare Enter. A bare Enter closed the shape a moment
    earlier, and consequence-dialog §1 keeps an act off a pre-focused Enter for exactly this reason:
    a bounce of the same key must not commit. Initial focus is the card's first control.
  - Because the card is modal, nothing behind it takes a click while it is open. A reading from the
    drawing (a thickness a note states) is therefore offered INSIDE the card, never taken by a click
    on the sheet behind it (§2.5): code proposes the notes that state the attribute, the QS picks
    one, and nothing picks silently.
  - A fault that is not a refusal (I-40's other arm) is caught by the card's own boundary and
    rendered as ErrorState with retry and the report id inside the card. The traced outline stays on
    the sheet: a transient fault never costs a QS forty clicks. This is the scale panel's bargain
    (viewer.md, S-Scale's Error state: "a scale that cannot be read costs the reader this panel,
    never the drawing"), kept in one more place.
  - Once confirmed, the tool stays armed under the same condition, ready for the next outline
    (OST's and PlanSwift's rhythm).
  - The running figure on the canvas is the client's display of the same exact arithmetic (I-385).
    The card's figure is the gate's and it governs. Where the two ever differ at display precision,
    the card's stands and the running figure is gone.
  - **What the digest binds, as S1 built it** (`ConsequenceMeasurement`, `src/core/acts/consequence.ts`):
    the recipe as applied (its readings as the act judged them), the level, the drawing, the sheet
    and its space, the partition's and the register's view keys, the calibration key with its two
    factors, the drawn and figure units, the traced geometry with each point's basis and cited keys,
    the exact geometry figure (the gross and each cut-out with its role), the geometry's basis, the
    count of demoted points, the key the new row succeeds (`supersedes`) and the measurement an edit
    strikes (`replaces`). Until the offer builder stands (S3), the figure a QS confirms is the
    geometry's own; the per-kind quantity `judgeOffer` answers joins the same payload, and so the
    same digest, when S3 lands. An act with no MEASUREMENT arm digests exactly as before.
  - The pattern renders the arm's subjects as it renders every subject list until S6's card lands:
    the new object (none → REGISTERED) and, for an edit, its predecessor (REGISTERED → REPUDIATED).
  - Owner: S1 for the arm and the digest, S6 for the presentation. The sentence in
    `consequence-dialog.md` rides integration (§13).
  - Rejected: a bespoke card with its own confirm. That would be a second act pattern (B-17), and it
    would let a figure the gate never computed be the one the QS signed off.

- **I-374 — A condition is authored data, not an act, and a measurement snapshots its recipe.** A
  condition (R-TO-041) is a named recipe: name, geometry type (area, length, count), class, one or
  more kinds (each with its manual method's rule id), the attribute readings the method declares
  (for example t = 75 mm), a colour and a hatch, and a hotkey.
  - Authoring a condition changes nothing the machine derives until a measurement cites it, so it is
    not an act (L-ACT-01, "a human write that changes what the machine would derive"). It is project
    data written behind `authorize(MEASURE)`, through its own door (S5).
  - The measurement act stores the recipe **as applied**. Editing a condition later never re-derives a
    standing measurement; re-assigning measurements to another condition is a new act, offered as a
    group (R-TO-043, R-UI-023).
  - Attributes a condition supplies are **ENTERED** when a measurement applies them: a person stated
    them, and the act names that person. They are never DEFAULTED, which L-MEA-06 bars from
    quantity-determining attributes. An attribute bound to a note of the drawing that the card
    offers (§2.5; for example "75 THK BLINDING UNDER", handle 828) is **TRANSCRIBED** and cites that
    note's source key.
  - Colours come from the element palette's eight tokens (`--element-*`, default: the class's own) and
    hatches from a closed set of six (solid tint, diagonal, cross, dots, horizontal, vertical). That
    gives 48 distinct swatches with no new token (R-UI-001 is final) and never colour alone (R-UI-060).
  - Hotkeys: the digits 1–9 pick the chest's first nine conditions in its order and arm the
    condition's tool (Area for an area condition, and so on). The roster gains one `viewer-condition`
    entry so the ? sheet and ⌘K list it (R-UI-032).
  - A tool arms only with a condition picked: pick first, then draw, the OST and PlanSwift order.
    Pressing A with no condition picked arms Area under the area condition last used on this mount,
    if there is one. If there is none, focus moves to the chest filtered to area conditions and the
    status reads "Pick a condition to measure with"; nothing arms. A quick measurement with no
    condition is the Select tool's distance pick, which exists. Where the chest holds no condition
    of the tool's geometry at all, the tool arms and records nothing (I-497).
  - The chest is per project (S5). A tenant-level chest (R-TO-041, "per tenant and per project") is an
    IOU (§14).

- **I-375 — A measurement may stand on any view that draws scope, including an untyped view and the
  anchorless one.**
  - L-CAD-06 ("only layout-plan-class views may yield instances") governs what the MACHINE may
    instance from a partition. A human measuring by hand is not the machine yielding instances.
  - The M4 exit asks for a sheet "with no auto-detection at all", and such a sheet's only view is the
    anchorless one (`UNASSIGNED`, `partition/views/assign.ts:133-141`: an entity no caption reaches
    falls to it) or an honestly untyped one.
  - So a manual measurement may stand on every view class except the three that draw no scope:
    `SCHEDULE`, `LEGEND_NOTES` and `TITLE` (refused `MANUAL_VIEW_DRAWS_NO_SCOPE`). Sections and
    details are measurable: a QS takes a wall face off an elevation.
  - **The ring's view.** It is the view that holds the ring's snapped entities; every snapped point
    must stand in that one view. For a wholly free ring it is the innermost view whose box holds every
    point. A ring whose points stand in two views, or in none, is refused `MANUAL_RING_OFF_VIEW`.
  - **The view key a manual row carries.** It is the view's own key, `v:<class>:<anchor source key>`
    (L-REG-04). The anchorless view has no anchor, so its key is spelled
    `v:UNASSIGNED:FILE:<sha256 of the drawing revision's bytes>`: content-derived, minting nothing,
    and never shared by two drawings. This spelling is new. The partition today keys that view as the
    bare `UNASSIGNED`, which two drawings of one project share, and gives it no page. The manual door
    (S1) derives the `FILE:` spelling itself, so no hand row depends on the partition's key. The
    partition adopting the same spelling (and naming a page's space) is an IOU of the PDF lane,
    M4P-2 (§14).
  - **A view, in every rule below, is the pair (view key, space).** Two pages of one PDF whose only
    view is the anchorless one share its key, and their coordinates are two spaces. The mark's
    `space` (I-378) keeps their rows apart, and the overlap guard (I-380) and the cross-view rule
    (I-381) treat the two pages as two views. Otherwise one scope drawn on both pages would pass
    both: the guard never compares two spaces, and the cross-view rule would see one view.
  - **How the act proves the view (S1).** The statement names the drawing revision, the sheet (its
    layout name, which is the space its points are in) and the partition's own key for the view.
    - A snapped point stands on the entities it cites. Each must be assigned to the named view by the
      stored partition (`view_assignments`) and drawn in the named space; one assigned elsewhere
      refuses `MANUAL_RING_OFF_VIEW`.
    - A free point, or a snapped one the act demotes (I-387), stands in the named view only inside
      the extent that view's own assigned entities draw on that space, widened by one lattice step.
      So a wholly free ring is placed by the view the statement names, proved by that extent, rather
      than by searching for the innermost box: the reader names the view it measured on, and the act
      checks the claim.
    - A paper layout's entities are in no view (the partition partitions model space), so a point on
      one is off every view.
    - The register view key is the one grammar's (`viewKey`): `viewAddressOf`'s spelling for an
      anchored view, the `FILE:` spelling for the anchorless one.
  - The scale of an anchorless view is affirmed by SCALE-1's two-point path, which needs no machine
    proposal.
  - Rejected: requiring a human view-type act first. That act is not built, and it would put a
    ceremony between a QS and the M4 exit's plainest case: a scan with nothing on it but lines.

- **I-376 — Discipline and the kind's authority hold for hand measurement (L-REG-03).** "Discipline
  is drawing-scoped, machine-proposed, human-confirmed, fails closed: an unconfirmed drawing is not
  walked", and "each quantity kind has exactly one authoritative discipline" (`KIND_DISCIPLINE`).
  - The product confirms discipline per sheet (`sheet_disciplines`, `confirm-discipline.ts`). A
    measurement on a sheet whose discipline is unconfirmed is refused
    (`MANUAL_DISCIPLINE_UNCONFIRMED`). The card's preview says so before anything is recorded (I-497 moved the check there; amended on the refuter's pass, session 9).
  - A sheet the machine proposed no discipline for is confirmed by CONFIRM_DISCIPLINE's `SHEET`
    group, which needs no proposal (s-drawings I-84: "the single-sheet chooser offers every
    discipline"; `confirm-discipline.ts` reads it as "the person's judgement inside the closed
    enum"). So the M4 exit's sheet is not stopped here; S11 walks that path on its text-less sheet.
  - A condition whose kind is not the sheet's authoritative discipline is refused
    (`MANUAL_KIND_NOT_THIS_DISCIPLINE`). Brickwork is measured off the architect's plan, never off
    the structural one.
  - The register row's discipline is the sheet's confirmed discipline.

- **I-377 — The level of a measurement.** The object key ends in a level segment (L-REG-04), so every
  measurement states one.
  - A foundation class (footing, pile cap, pile, tie beam, `placement/law.ts:85`) stands in the
    lawful-null `FOUNDATION` slot, and the card shows "Foundation".
  - Any other class takes the level the view's caption states through the one level resolver (S-08:
    "GF SLAB ON GRADE" → Ground floor). The card shows it in a Combobox the QS may change: a changed
    level is an ENTERED selection named by the act.
  - A view that states no level offers no default, and the QS picks from the stack. With no level
    picked the card refuses `MANUAL_LEVEL_UNSTATED`, because a hand measurement is never keyed into
    the `UNRESOLVED` slot, which I-368 bars from lines.
  - Rejected: `@unregistered:<label>` for hand measurements. A person measuring names a level the
    stack holds or authors one first (INSERT_LEVEL).
  - **As the act applies it (S1).** A foundation class stands in the `FOUNDATION` slot whatever was
    stated: the slot the placement stands a drawn one in, so a hand footing and the machine's meet in
    one cell (I-382) and cannot be counted twice across two spellings of one level. The card shows it
    before the QS confirms, and the digest binds it. Any other class stands on a live level of the
    stack; none, the `UNRESOLVED` slot, a level the stack no longer holds, and the `FOUNDATION` slot
    are each `MANUAL_LEVEL_UNSTATED`. L-CAD-07's foundation roster moved into core for this
    (`src/core/catalogue/level-basis.ts`); the placement law re-exports it, so it has one home.

- **I-378 — The markless key (L-REG-02, L-REG-04).** A hand measurement has no drawn mark, but the
  store binds `object_key = placement_key ‖ level segment` (`register_objects_level_stated_once`), and a
  placement key needs a non-empty mark (`keys.ts:93-96`).
  - **The mark** is `~m.` followed by the first 16 hex of the sha-256 of the canonical JSON
    `{ v: 1, class, kinds, geometry, space, rings, supersedes }`, where:
    - `class` is the condition's element class. L-REG-02 lists element type in the identity.
    - `kinds` is the recipe's kinds, code-point sorted. The condition's id and name never enter: an id
      is minted (L-REG-04 forbids it) and a name is a label (L-REG-02 forbids it).
    - `geometry` is `POLYGON`, `POLYLINE` or `POINT_SET`.
    - `space` names the coordinate space the points are in: `model` for model-space geometry (every
      BNBC view is a model-space region, L-CAD-06), or the layout's name for paper-space geometry.
      The PDF lane names a page's space (M4P-2). Coordinates of two spaces are never compared.
    - `rings` are the points quantised onto the 0.1-drawing-unit lattice by `quantise` (`keys.ts`,
      one home). The outer ring starts at its least point (x, then y, compared as exact decimals) and
      runs counter-clockwise. Cut-out rings run clockwise, each from its own least point, sorted by
      that point. A polyline runs from its lesser end. A point set is sorted.
    - `supersedes` is the object key this measurement succeeds, or `null` (I-379).
  - **The placement's x, y** is the outer ring's least point, or the point set's least point.
  - **The view key** is I-375's. **The level segment** is I-377's.
  - For J-000's ring on S-08 (the SOG's own outline, POLYLINE 81D, I-393), the key reads
    `v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.<16 hex>|-125.0,-400125.0@<GF's surrogate>`: of 81D's two
    points at x = −125, the lesser y is −400125.
  - Consequences:
    - The same trace of the same scope under the same class and kinds re-derives the same key, so a
      second identical measurement is `DUPLICATE_IDENTITY` at the door for free (L-REG-03).
    - One ring under two conditions of one class and different kinds (SOG concrete and blinding under
      it) gives two keys, both lawful. One ring under two conditions of the same kinds (a 75 mm and a
      100 mm blinding) collides, which is right: that is one scope measured twice.
    - Attributes (t, a multiplier) never enter the key (L-REG-02: "correctable attributes … never in
      identity").
  - 16 hex is 64 bits. A collision refuses a lawful measurement; it never double-counts one.
  - The prefix cannot be a drawn mark. Marks are compared dotless-uppercase (`keys.ts:62`) and `~`
    appears in no mark grammar. `@` and `|` are never used.
  - **Why coordinates may enter here, when L-REG-02 says "no coordinates".** L-REG-02's reason is
    written beside the rule: "five drawings of one building shared zero coincident vertices", so
    coordinates cannot pair one member across drawings, and a mark must. A hand ring has no mark to
    pair by, and it is never paired across drawings: the carry across a re-pin is owed (I-394). The
    ring stands in for the mark only inside one view of one drawing-set revision, where L-REG-04
    already keys every placement by its quantised coordinates. So the coordinates do the job a mark
    does there, and never the job L-REG-02 refuses them.
  - Each hand mark is a family of one, so its row keeps the bare mark and no `#i` ordinal (L-REG-05).
  - **What the reader sees.** The mark is an identifier (R-UI-082): it renders through IdChip in the
    Technical disclosure only. Everywhere a mark is shown as a name (the register tree, the Source
    chip, the BOQ's member list), a hand measurement shows its condition's name and "by hand". That
    note rides integration into `s-takeoff-register.md` (§13).
  - Rejected: a UUID or a counter as the mark (L-REG-04: "zero minted ids"). Rejected: geometry only,
    which collides two conditions of one class over one ring (the critic's L-REG-02 correction).

- **I-379 — An edit is a superseding act that repudiates its predecessor in the same transaction.
  Delete is REPUDIATE.**
  - Why a new key: within a campaign a published line never changes. A different claim at the same
    natural key is refused (`evaluate.ts` `sameClaim`), and lines re-derive only in a later campaign
    (`level-effects.ts`). An edit that kept its key would be refused at the gate while the bill kept
    the old figure.
  - So an edit (a changed ring, level or attribute, R-TO-043) is a new `RECORD_MANUAL_MEASUREMENT`
    act naming its predecessor. It registers a new row whose key carries `supersedes` = the
    predecessor's key (I-378), so an attribute-only edit still has a key of its own. In the same
    transaction it writes the predecessor's `repudiated_objects` row (L-ACT-01, "moves the object to
    the no-join table").
  - Nothing is overwritten. The bill withholds the predecessor's lines as it withholds every
    repudiated object's (I-173; BOQ-1 makes the draft BOQ and the BBS honour it). The card's
    consequence names both subjects: "Replaces {previous}, which leaves the bill."
  - **Delete** is the existing REPUDIATE, with its own ConsequenceDialog.
  - **The residue withholds what the bill withholds.** Today it does not. The residue's published arm
    (`publishedLinesOf`, `src/core/residue/residue.ts:361-374`, unchanged from `ed29abf0` to the
    session branch's head `fbc1700f`) joins quantity lines to register rows and never reads
    `repudiated_objects`. A hand measurement deleted with no successor would therefore leave its
    class × kind × level cell quantity-bearing on the coverage screen and the certificate while the
    bill holds nothing for it: an undeclared omission, and hand delete is an everyday act.
    - The rule: the residue's published arm counts no line whose object stands repudiated in the
      campaign's set revision, under the same no-join reading as the register table (I-173) and the
      bill (BOQ-1). It is one rule for hand and machine objects alike (a repudiated machine object
      has the same gap today). A cell left with no standing line reads NOT_ESTABLISHED, which is the
      truth.
    - Owner: S3, which already owns what a hand row sights (I-383). Its proof is a live-database
      test in which REPUDIATE of the only hand measurement in a cell leaves that cell
      NOT_ESTABLISHED, and a second in which a repudiated machine object's cell does the same.
    - Until the rule stands, S7 offers no Delete on a hand measurement. It offers no Edit either,
      because an edit whose successor the gate then refuses would open the same gap.
    - Nothing on the J-000 project moves: it holds 0 repudiated objects (read back this session).
  - **Re-tracing after a delete.** A trace whose own key stands repudiated succeeds it: the act
    derives `supersedes` = that key, and if that key also stands repudiated it repeats until a key is
    free. A key that stands un-repudiated is `DUPLICATE_IDENTITY`: a real second measurement of one
    scope.
  - Keys stay a pure function of the act log (L-REG-04), and "delete then re-trace works" (S1's
    proof).
  - **As the act applies it (S1).** An edit names the measurement it replaces (`replaces`). That
    measurement must stand in the revision: one already struck or replaced refuses
    `MANUAL_PREDECESSOR_NOT_STANDING`, and an edit that states the same recipe, geometry, level,
    view and space as its predecessor is `ACT_CHANGES_NOTHING`. The row's stored `supersedes` is the
    key its own key succeeds: the predecessor for an edit, and the struck key a re-trace re-derives.
    The act strikes only `replaces`, because what a re-trace succeeds is already struck.
  - Rejected: appending an attribute observation to the same object. That is the right shape for a
    machine-read attribute (R-TO-051), but within a campaign it cannot move a published line, so the
    QS would edit and see nothing change.

- **I-380 — The overlap guard (one view, one cell) ignores superseded and repudiated
  measurements.** Two hand measurements in one class × kind × level cell on one view (one (view key,
  space) pair, I-375) must not measure the same ground.
  - **The guard reads the geometry the figure reads.** It runs on the stored exact points (I-385),
    never on the key's quantised ring. A guard on the lattice would pass two snapped rings that
    overlap by less than one lattice step (both quantise to a shared edge), and both would bill the
    sliver: up to 0.1 drawing units wide, about 30 mm on a feet drawing. The lattice serves the key
    alone (I-378).
  - Areas: the net regions (outer less cut-outs) must not share any positive area. Shared edges and
    points are not overlap.
  - Runs: any positive collinear overlap is overlap.
  - Counts: a coincident point is overlap, and so are two points that cite one counted symbol (the
    same INSERT, S9).
  - An overlap is refused at preview as `MANUAL_OVERLAP`, naming the other measurement (its condition
    and figure) and linking to it.
  - The guard reads only standing measurements: not superseded, not repudiated. Otherwise an edit
    would be refused as overlapping the very measurement it replaces.
  - The arithmetic is exact and integer, never floats (B-07). Every coordinate of the two
    measurements is scaled to an integer by the largest decimal exponent among them (81D's chamfer
    vertex 2691.423304703363 carries 15 places, so S-08's rings scale by 10¹⁵), and the orientation,
    crossing and containment predicates run in BigInt. Shared area is decided by those predicates;
    it is never computed as a float and compared with a tolerance.

- **I-381 — A second hand measurement of one cell on another view is refused unless the two are
  proven disjoint.** L-REG-03 scopes the double-count guard to the drawing-set revision, not to a view.
  The same blinding traced on S-08 and again on another sheet gets two view keys, so it passes both
  the register's key and I-380. ("Another view" is another (view key, space) pair, I-375.)
  - So a hand measurement in a class × kind × level cell that already holds a standing hand
    measurement on a different view is refused `MANUAL_CELL_OTHER_VIEW`, naming the other view and
    its measurement, unless the two are proven disjoint.
  - Proof means: both views are georeferenced to the project's grid (L-CAD-07; S-08's view carries
    letter axes A–E and numeral axes 1–6 in the stored `grids`, read back this session), both rings
    map into one grid frame by shared axis labels, and their net regions share no area there,
    decided on the exact points as I-380 decides it.
  - The proof is owed (§14, owner S3). Until it lands nothing is proven, so the refusal stands for
    every other view.
  - This errs toward measuring less, which is the lawful direction. The remedy is to measure the cell
    on one sheet.

- **I-382 — Machine lines and hand lines never share a cell, and the refusal is named on both
  arms.** At class × kind × level grain within the campaign, a cell holds machine lines or hand
  lines, never both.
  - **Hand arm (preview):** where lines of any non-repudiated machine object stand in the cell, the
    act is refused `MANUAL_CELL_MACHINE_MEASURED`.
  - **Machine arm (gate):** a machine offer into a cell a standing hand measurement claims is refused
    `CELL_MEASURED_BY_HAND`, whatever the batch order. The cell is claimed by a stored fact, not by
    which offer came first.
  - "Claims" means the recipe's kinds at its class and level (I-383). A typical ×n measurement (S9)
    claims the cell at every level it is timesed over. Machine queue items (declared exclusions, no
    quantity) do not block a hand measurement: measuring by hand what the machine could not is the
    point of the tool.
  - Repudiating the machine's objects in a cell frees it for a hand measurement. Deleting the hand
    measurements in a cell lets the machine's next run publish. Until something publishes again, the
    cell reads NOT_ESTABLISHED under I-379's residue rule, never quantity-bearing.
  - Cell grain is conservative: it can under-measure, never over-measure (L-QTY-04). Geometry-grain
    sharing is a later refinement (§14).

- **I-383 — A hand row SIGHTS every kind its class bears, and CLAIMS only its recipe's kinds.**
  L-QTY-05 makes the residue's cell (sighted class × kind borne × level), and a register row of the
  class is a sighting. A hand measurement registers a row of its class, so the residue sights that
  class at that level for every kind the class bears (`bears.ts`), as the law is written.
  - A hand blinding under the SOG sights slab × {concrete, formwork, rebar, blinding} × GF. Blinding
    becomes quantity-bearing when its line publishes. The other three read NOT_ESTABLISHED, which is
    true: the SOG's concrete is not measured, and the certificate says so. `bears.ts` states the same
    principle: "a borne pair nothing publishes stands in the residue as NOT_ESTABLISHED, which is the
    disclosure".
  - The hand measurement CLAIMS (I-382) only the recipe's kinds, so the machine may still measure the
    other kinds of that cell.
  - Rejected: sighting only the recipe's kinds, which S3's draft scope assumed. It would hide a real
    gap behind a hand measurement of a neighbouring kind, and it would need a Deviation from L-QTY-05
    that no evidence supports.
  - Consequence: J-000's residue roster gains the slab × GF cells when S6's leg lands. The roster R0-1
    declares must carry them (§12, risk).

- **I-384 — A hand measurement publishes through the campaign's measure job, and through each kind's
  one rail.** R-TO-040 says results are "offers to the gate under a chosen kind, never lines the tool
  writes".
  - The commit door (`takeoff-manual.ts`, server) requests the campaign's measure run after the act
    commits. The act is core and cannot import a module (ARCH-01).
  - L-MEA-08 selects the rail per kind, never per drawing. So there is no second rail for hand
    measurements: each kind's one rail gains a **manual arm**, composed at one home in the rail
    composition. The arm reads `setup.manual` (the standing, un-superseded, un-repudiated
    measurements) and offers through the one builder `src/core/manual/offer.ts`, the same builder the
    act's preview asks `judgeOffer` with.
  - The machine arm of every rail never sees a hand row. The filter is a manual-origin fact at one
    home in the setup the job hands the rails, never a mark prefix.
  - There is no narrowed run. BNBC's measure jobs took 0.51 s and 0.80 s (the critic's read of
    pg-boss), and narrowing would put `writeBarRows`' whole-campaign replace at risk
    (`measure/job.ts:81-88`).
  - The card closes on commit. The sheet's list shows the row as "Adding to the register" until the
    job's verdict, then its figure or its named refusal (§3, partial).

- **I-385 — Hand geometry is stored exactly and computed exactly. Only the key is quantised.**
  - Each point is stored as its snapped entity's own coordinate in its exact decimal spelling (the
    canon's `exact(String(n))`, as `quantise` reads it). A free point is the pointer's world point
    quantised onto the 0.1 lattice, since a free click has no drawing fact to keep.
  - Areas (shoelace) and lengths are computed in decimal from the stored points, at full precision,
    carried as `numeric`, and never quantised as areas. The key alone uses the quantised ring
    (I-378).
  - S-08's SOG outline (POLYLINE 81D) is 328 838 371.244 361 926 236 249 292 333 79 mm², the
    shoelace of its five vertices' decimal spellings in the DXF, and the lift pit (830) is
    8 046 918.88 mm². Both are exact (§10's table, checked against the DXF by the Decision's test).
  - Rejected: quantising the area to 0.1 du² as `outline.ts` does for extractor outlines, which read a
    float shoelace. A hand ring's points are known exactly, so rounding its area would lose digits the
    drawing states. Rejected: quantising snapped points to the lattice. In a feet drawing that moves a
    point up to 15 mm and can enlarge a ring, which is over-measurement.
  - The geometry arithmetic has one home, `src/core/manual/law.ts` (S1). The running figure (S4), the
    offer builder (S3) and the book (S7) all call it.
  - **As the act applies it (S1, amended on review): a snapped point is stored as the drawing's point,
    never as the client's.** Where the drawing itself determines a point among what the point cites
    (a vertex of a cited entity, the midpoint of one of its segments, or the crossing of two cited
    grid axes), and that point stands within the snap reach of the stated one (I-387), the stored
    point is that one, spelled as the drawing spells it: a viewer's midpoint of (0.1, 0.2)–(0.2, 0.4)
    arrives as (0.15000000000000002, 0.30000000000000004) and is stored as (0.15, 0.3). A nearest
    point, a perpendicular foot or a crossing of two entities away from their vertices has no drawn
    coordinate of its own. It keeps its stated spelling, and it stands within the snap reach of every
    entity it cites (`src/core/manual/snaps.ts`).

- **I-386 — Hand readings carry the view's declared unit. The gate multiplies no factor today, and
  L-MEA-05's gap is recorded.** L-MEA-05 says "the gate multiplies, not the rail". The tree's gate
  converts by named unit only (`gate/units.ts`); nothing under the gate or the rails reads a factor
  (the critic's read).
  - A hand reading carries the unit the drawing declares, through the one declared-unit resolver
    (I-295, I-302), exactly as outline readings do. It cites the view's calibration key per measured
    attribute (L-QTY-03's non-empty set).
  - Where the gate would bill wrong, the preview refuses `MANUAL_UNIT_NOT_CONVERTIBLE`:
    - the drawing declares no length unit the gate converts (points, pixels, unitless); or
    - the view's affirmed factors differ from the declared unit's own factor beyond
      `scaleVerificationTolerance` (0.01), meaning a sheet drawn to a scale other than full size in
      its unit.
  - The canvas's running figure still shows metres from the calibration (I-146), so the QS sees the
    number the gate would need to multiply to reach.
  - **As the act applies it (S1): the unit is read off the affirmed calibration, not off the
    declared-unit resolver.** The act is core, and the declared-unit resolver (I-295, I-302) lives in
    the partition module, which core may not import (ARCH-01). What the act can read is the view's
    scale of record, which a person affirmed (L-MEA-05). A view is drawn full size in unit U when
    both of its factors equal U's metres per unit within the edition's verification tolerance
    (`drawnUnitOf`, `src/core/manual/units.ts`). The unit the hand reading carries is that U, which
    must be a canon length unit the gate converts (mm, m, ft, in). Anything else refuses
    `MANUAL_UNIT_NOT_CONVERTIBLE`: 1:100, centimetres, points, pixels, or two axes in two units.
    - This is the second bullet above, with the declared unit replaced by the unit the affirmed
      factors are. On every fixture the two agree: BNBC declares millimetres on S-01, and S-08 is
      affirmed at 0.001.
    - Where they could disagree (a note declaring millimetres over a view the QS affirmed at the
      foot's 0.3048 by two points), the affirmation governs. It is the act that says what one drawing
      unit measures, and the declaration speaks for the dimension texts.
    - An area is carried in the square of the drawn unit (mm², m², sft). An inch drawing carries no
      area the canon holds, so an area on one refuses too.
  - The gap is the gate's (§14, owner: the m4-pdf-sheet area). A vector PDF page (points) cannot
    publish a hand line until the gate multiplies. A raster page waits on that and on M4P-6 too
    (I-387). So the M4 exit's text-less sheet in J-041 is a full-size vector DXF drawn in
    millimetres, with no text at all (§10). A text-less PDF or scan is proved only once both land.

- **I-387 — Basis per point (R-TO-040 with L-QTY-01).** Both clauses apply and neither is dropped.
  - A point snapped to vector geometry (`DXF_HANDLE`, `PDF_OBJECT`) is **MEASURED** and cites the
    source keys the snap was met on.
  - A free point on vector content is **ENTERED** (R-TO-040, "free-drawn without snaps").
  - A point snapped to a `RASTER_TRACE` primitive, or placed free over raster content, is
    **INTERPRETED** (L-QTY-01: "a QS hand-tracing a scan also produces INTERPRETED"; it is never
    relabelled MEASURED).
  - The geometry's basis is the weakest over every point of every ring. The line's two roll-ups are
    weakest-wins over geometry and the determining and selecting attributes (L-QTY-01). They are
    derived, never stored.
  - The register row's standing is MEASURED for vector geometry, snapped or free: a person saw the
    scope on the drawing, and the per-attribute basis rides on the line. For raster geometry it is
    INTERPRETED once M4P-6 widens `SIGHTING_STANDINGS` (today `MEASURED | DERIVED`,
    `src/core/identity/law.ts:12`). Until then the tools stand disabled over raster content, with the
    reason in the tooltip.
  - An INTERPRETED hand line reaches a bill only as AGREED (L-QTY-04), and the card says so in one
    line.
  - **The door re-derives a snapped point's basis; it never takes the client's word.** A point
    claims MEASURED only where the server, reading the cited entities from the stored EntityGraph,
    reproduces it: an endpoint, midpoint, intersection or grid crossing exactly, a nearest or
    perpendicular point on the entity within one lattice step (amended in S1 on review: within one
    micrometre of real length, never a lattice step; see below). A point that does not reproduce is
    demoted to ENTERED (a free point), never refused, and the card shows the demoted basis. A tampered
    or buggy client can therefore make a figure weaker, never stronger than the drawing supports.
  - **As the act applies it (S1): the re-derivation is the act's, not the transport's.** A guard
    that only a transport runs is a second door to one write (B-17). So the act's own preview reads
    the stored EntityGraph (`artifactAt`), the partition's assignments and the grid on its
    transaction (`src/core/manual/snaps.ts`).
    - A point is MEASURED when it stands within the **snap reach** of every entity it cites (an
      original and the paint that names it), and of every grid axis of the named view it cites. An
      endpoint, a midpoint, an intersection, a nearest or a perpendicular point, and a grid crossing
      all do, so the snap kind is not stated and not trusted. It is stored as the drawing's own point
      where the drawing determines one there (I-385).
    - **The snap reach is one micrometre of real length** (`SNAP_REACH_METRES`, carried into the
      view's drawn unit by `snapReachOf`, `src/core/manual/units.ts`): 0.001 on a millimetre drawing,
      0.000001 on a metre one, about 0.0000033 on a foot one. That is float noise for a viewer
      computing on the drawing's own doubles, which is all a lawful viewer is (`viewer-snap/snap.ts`
      snaps on the records' own world points). Pushing every point of a 100 m perimeter outward by
      the whole reach adds 0.0001 m², below anything a bill prints.
    - **Amended on review, from "within one lattice step".** The original reading allowed a nearest or
      perpendicular point one lattice step, 0.1 drawing units. That is 100 mm on a metre drawing and
      about 30 mm on a foot one, which I-380 itself calls over-measurement. The review measured it: a
      10 m × 10 m slab drawn in metres as four LINEs, each corner pushed 0.07 units outward while citing
      its two lines, came back MEASURED at 102.8196 m² against the drawing's 100. That broke the
      guarantee above and the law (over-measurement is a hard block). The same push is now demoted
      (`tests/takeoff/manual/manual-law.test.ts`, "a metre drawing, corners pushed outward"). On a
      millimetre drawing such as BNBC the old slack was 0.1 mm, which is why no fixture caught it.
    - A point that does not reproduce, or that cites a key the drawing does not hold, is demoted: it
      becomes a free point on the lattice, ENTERED, citing nothing. The card counts the demoted
      points.
    - A recipe reading that claims TRANSCRIBED from a note the drawing does not hold is demoted to
      ENTERED the same way.
  - While drawing, each placed point wears its basis as R-UI-002 spells it everywhere a basis
    appears: the basis glyph in the basis colour, 10 px, centred on the point, on a 1 px
    `--canvas-paper` halo. MEASURED is ◆ in `--basis-measured`, ENTERED ✎ in `--basis-entered`,
    INTERPRETED ▦ in `--basis-interpreted`. A QS learns the rule by watching the points, and it is the
    same pair they read on the card's chips and in the book (never colour alone, and never a second
    glyph set: a hollow circle is DEFAULTED's ○, and a square is TRANSCRIBED's ▣).

- **I-388 — Blinding is measured by a traced outline, never by a projection (L-FRM-04).** L-FRM-04
  prices blinding as `count × (L + 2p) × (B + 2p) × t`, "deferred for polygon plans". That formula
  projects a rectangular member's plan by p, and it defers polygons because the machine cannot offset
  one.
  - A hand measurement of blinding traces an outline: the blinding's own drawn outline where it
    follows the member it blinds, or the member's own outline.
  - The manual method (`pcc.blinding.area@1`, S2) binds no p:
    `count × (A − Σ openings > threshold − Σ junction plans) × t`. The card's formula shows no p, and
    the book row says "traced outline" and cites the entity the ring was snapped to (81D, say), so a
    reader sees which outline was measured.
  - Nothing here projects a polygon, so the clause's deferral is not reached. It still binds the
    machine rail, which this Decision does not touch.
  - **A drawn blinding outline counts only where it follows its member.** A blinding outline is the
    member's plan projected by the edition's p, and under a slab on grade by nothing: the yardstick
    reads p = 0 there ("slab on grade: net area · 75", `golden.py`). Where a drawn blinding outline
    reaches beyond that, it is a second drawn fact that disagrees with the member's own outline. That
    disagreement is declared, never resolved silently (L-REG-03), and it is never resolved in the
    larger direction (L-QTY-04). The QS traces the member's own outline, which is under by at most
    the projection: the lawful direction, and visible because the formula names no p. The product
    cannot tell a drawn blinding outline from any other ring, so today this is the QS's reading,
    made checkable by the cited entity. A guard that holds a blinding ring inside its member's ring
    plus p is owed (§14).
  - S-08 was that case in Rev B, and Rev C draws the blinding on its member (F-RCC6-BNBC's D-BLIND,
    `fixtures/gen/rcc6_bnbc/DECISIONS.md` W-40). Rev B's LINEs 824–827 drew a plain rectangle, the
    SOG's bounding box plus 75 mm on every side, around a pentagon with a 45° chamfer (POLYLINE 81D):
    9.504 m² outside the slab, 4.091 m² of it beyond even a 75 mm projection. Rev C moves the four
    LINEs onto the slab's four square edges, draws the chamfer as a fifth LINE (2309), and note 828
    reads "75 THK BLINDING UNDER SLAB ON GRADE & RAMP (EXPLODED OUTLINE)". The drawn outline now closes
    on 81D's own five points and takes in nothing outside the slab. J-000 traces 81D (I-393), which is
    now the drawn blinding outline too. The reading above still governs any set whose blinding outline
    does not follow its member.
  - If the refuter rejects this reading, Deviation **D-005** (text in §11) is entered in
    `docs/decisions/deviations.md` in the same commit, before S2 mints the method.

- **I-389 — A slab-class ring deducts the register's vertical members inside it, or it is refused
  (L-MEA-09).** L-MEA-09: "Slabs run through: … less column and wall plan areas, less openings above
  `openingDeductionMinM2`". A junction deduction may defer only where the figure is then under;
  otherwise it is a hard block. The blinding under a slab is borne by the slab (`bears.ts`) and
  follows the slab's plan.
  - A column stub stands through the blinding course: it is cast before the course is laid. L-MEA-09
    deducts a column's plan whole, whatever its size. At Rev B the yardstick's authoring model
    deducted 5.956875 m² under SOG@GF (`model.py` `deduct_columns`, instrumented in session 8):
    4.051875 m² of 25 FDN column plans clipped to the SOG's bounding box, plus 1.905 m² of the three
    FDN core walls SW1-3, SW1-4 and SW1-D. Since R0's K21 (W-33) it deducts only what stands on the
    slab's net plan: 3.961875 m², the 25 columns less A4's and A5's parts inside the ramp hole
    (0.09 m², which RAMP@GF deducts on its own plan), and no core wall, because all four FDN legs
    (K22 adds SW1-C) stand inside the lift-pit hole.
  - **Which storey's members pass through a slab at level L:** the storey whose top is L, as the
    yardstick reads it (`STOREY_TOP`). At GF that is the FDN storey's columns, which run from the cap
    to GF. A register object at level L spans L to the level above; it stands on the slab, not
    through it. The J-000 register holds 26 column objects at FDN and 26 at GF (read back this
    session), and I-389 reads the FDN ones. Their sections equal the GF ones on BNBC, so no figure
    turns on this there.
  - So when a slab-class ring stands at level L and the register holds column or shear-wall objects of
    the storey whose top is L:
    - where a member stands on the ring's own view (the same view key and space), it is already in the
      ring's frame and needs no grid. This is the no-auto-detection case: columns measured by hand on
      the same sheet are register objects too.
    - where the ring's view and the members' views are georeferenced to one grid, every such member
      whose plan (its section at that storey, from the schedule, placed on its view) meets the ring's
      net region is offered as a **junction** deduction candidate. It is DERIVED and cites its
      placement key.
    - where the product cannot place those members relative to the ring (no shared georeference),
      the preview refuses `MANUAL_JUNCTION_UNPROVEN`. Its evidence link lists the members it cannot
      place, and it fails closed instead of publishing a figure that may hold them undeducted.
    - The cost of failing closed: on a project whose sheets carry no grid, a slab cannot be measured
      by hand at a level where the register holds columns. The QS is told why, and the level's slab
      cells stay NOT_ESTABLISHED. That is under-measurement, the lawful direction.
  - **A candidate deducts its plan clipped to the ring's net region** (the outer ring less every
    cut-out, of either role), with no threshold: L-MEA-09 applies the threshold to openings only.
    - A member straddling the slab's edge deducts the part the slab holds. On S-08, 17 of the 25
      columns straddle the SOG's edge (the perimeter columns stand 75–175 mm past it), so a rule that
      deducted only members wholly inside the ring would leave their inner parts undeducted:
      over-measurement.
    - A member inside a cut-out deducts nothing more, because the cut-out already took it.
    - The clipping is exact, on I-380's integer predicates. Where an oblique edge makes the clipped
      area a non-terminating decimal, it is rounded toward the larger deduction, so the figure can
      only be under.
    - The card and the book print the candidates as one "Less:" row ("Less: 25 columns (register)").
  - Only standing members count: repudiated ones are nothing (L-ACT-01). A member whose plan does not
    meet the ring's net region is not deducted.
  - **A traced cut-out has a role**, chosen per cut-out on the card (a Select, default **Opening**):
    - **Opening** (the lift pit) deducts in the opening channel by the edition's strictly-greater
      threshold (L-MEA-02's partition, which L-MEA-09 applies to slab openings). Ignored ones are
      listed.
    - **Column or wall** deducts whole in the junction channel, with no threshold. Without this role a
      300 × 300 column traced as a cut-out (0.09 m²) would be ignored by the 0.1 m² opening threshold,
      and the slab would over-measure against L-MEA-09. This is how the QS deducts members the
      register does not hold, on a sheet where nothing was detected.
    - A register member inside a traced cut-out of either role is never deducted a second time: its
      plan is clipped to the net region, which the cut-out has already left.
  - On BNBC today the register holds 26 column objects at FDN (and 26 at GF) and no shear wall at any
    level (read back from the J-000 project this session).
    - 25 of the FDN columns meet the SOG's ring. C7, the porch column, stands outside it: its
      placement is `1213716.0,-403048.0` on S-10's view, which is model y = −3048, and the ring holds
      only y ≥ −125. So I-389 deducts 25 columns there, 4.051875 m² once clipped.
    - The three FDN core walls stand inside the lift pit: 830 runs 8714.2…11707.4 × 8714.2…11402.6 in
      model space, which is the core's outer face (CORE ± t_low / 2), and every wall lies within it.
      The pit's cut-out therefore already takes them, and nothing more is owed (I-393 Q(3), answered
      by the drawing).
  - Owner: S3 (the offer builder: which members are candidates, and their clipping), and S4/S6 for
    the cut-out role on the gesture and the card. The channel itself landed with S2 (I-538): the
    roster (`DEDUCTION_CHANNELS`, `src/core/offers/law.ts`) is `opening | finish_opening |
    junction`, the gate deducts a junction candidate whole and binds the sum into `junctions`, and
    `pcc.blinding.area@1` declares both channels.
  - Rejected: letting the QS type the column deductions ("Less: 7 × 0.45 × 0.60", ENTERED). That is
    PWD practice and it may come later (S9), but it trusts arithmetic the register can already do.
    Rejected: publishing without them, which over-measures.

- **I-390 — A hand line's COMPLETE speaks for what was traced.** The residue's cell is class × kind
  × level (L-QTY-05). Once one hand line publishes in a cell, the cell reads quantity-bearing whether
  the QS traced all of it or one bay.
  - The machine has a sighting per object, and each one gets a line or an observation. A hand
    measurement has no inventory of what it did not trace.
  - So the card says, in one line and every time: **"Counts what you traced and nothing else on
    {level}."** The book groups by condition and sheet so the QS can see what they covered.
  - The Certificate's actor statement ("measured by", L-QTY-07) names the person for hand lines.
  - This is a disclosure about scope attribution, not about magnitude. It is never a licence to
    over-measure, which I-380, I-381, I-382 and I-389 each block.
  - A per-cell "hand coverage is partial" declaration is an IOU (§14).

- **I-391 — The measurement book is printed in the PWD form.** The Dhaka ritual ("details of
  measurement") reads **No × L × B × D = Qty**, with deductions as their own **Less:** rows and a
  **Net** per item. The book (S7), the card and the inspector all render a hand measurement that way,
  from the line's own bindings:
  - **L × B.** A ring that is a rectangle (four points, right angles in drawing space) prints its two
    side lengths (the lift pit: 2.9932 × 2.6884). Any other ring prints its traced area across the L
    and B columns, to 4 decimals of m² rounded half-even, with the exact value standing in the line
    (S-08's SOG outline: "A 328.8384 m²"). A run prints L. A count prints No.
  - **Dimensions print exactly as measured**: metres to the tenth of a millimetre (up to 4 decimals),
    trailing zeros trimmed, never rounded. The printed product then reproduces the Qty a QS checks on
    a calculator: a traced 20.8216 × 16.2496 rectangle prints 338.3427, where 20.822 × 16.250 would
    print 338.358 and fail the check.
  - The **Qty** prints at the kind's document precision (`catalogue.ts`: m³ at 3 decimals), rounded
    half-even by the caller and grouped lakh/crore by the format seam (`figure`, `formatUserFigure`).
    The exact value stands in the line.
  - A typical multiplier (S9) prints as a timesing ("× 5") in the No column.
  - Units render through `QuantityText`. Feet-and-inches beside SI on a feet sheet is an IOU of the
    format seam (§14).

- **I-392 — F-SCAN's S-08 is a mixed page with a vector caption (R-TO-003).** R-TO-003: "mixed pages
  (drafted sheet with a pasted scan) mint both schemes". F-SCAN's S-08 (M4P-5) is authored that way:
  - the view caption ("GRADE BEAM LAYOUT & GF SLAB ON GRADE") and the title block are vector text
    (`PDF_OBJECT`);
  - the plan body is a pasted scan, vectorised into `RASTER_TRACE` primitives.
  - The caption classifies the view as a layout plan, its anchor keys the view, and the traced
    primitives fall to it by reach. So the scan leg's hand trace stands in a typed, anchored view with
    its level stated by the caption.
  - It is the realistic Dhaka case: an old sheet re-issued inside a new title block.
  - The text-less scan, whose only view is the anchorless one, is J-041's M4-exit proof (S11), under
    I-375.
  - Rejected: a fully raster S-08. With no caption text there is nothing to anchor a view, so every
    traced primitive falls to the anchorless view (`partition/views/assign.ts:133-141`) and the page
    could never hold a layout plan. That would make the scan leg depend on the anchorless path for
    the wrong reason.

- **I-393 — J-000's hand item is slab × blinding × GF on S-08, traced on the slab's own outline, and
  the column deduction applies.** This is PROVISIONAL until the `qs-critic` rules. S6 asserts no
  COMPLETE figure before that ruling and I-389 both stand, and the ruling is recorded in §12.
  - **The ring** is the SOG's own outline, POLYLINE 81D on layer Slab: five points, endpoint snaps.
    The lift pit, LWPOLYLINE 830, is its Opening cut-out. Since Rev C the ring is also S-08's drawn
    blinding outline, LINEs 824, 825, 826, 2309 and 827.
  - **S-08's two outlines disagreed in Rev B; Rev C draws them as one (L-REG-03).** Rev B drew the
    blinding's scope twice:
    - 81D is a pentagon with a 45° chamfer from (2691.423304703363, −384025.4) to
      (−125, −386841.82330470334);
    - Rev B's 824–827 was a plain rectangle: 81D's bounding box plus 75 mm on every side. It took in
      9.504 m² outside the slab, 4.091 m² of it at the chamfered corner beyond even a 75 mm
      projection. Traced with the columns' whole plans deducted, it came to about 24.41 m³, 0.79 m³
      (3.4 %) over the golden's then 23.615: over-measurement, a hard block (L-QTY-04). So the leg
      traced 81D, and the rectangle went to the qs-critic as Q(4).
    - Rev C (D-BLIND, W-40) moves 824–827 onto the slab's four square edges and adds the chamfer's
      LINE 2309. The five LINEs close on 81D's own points, and the outline takes in 0 mm² outside the
      slab. The drawing now answers Q(4), and the conclusion holds: the ring is 81D, whichever of the
      two coincident outlines the QS snaps to.
  - **The fixture defect this Decision recorded is corrected.** The generator's comment said the slab
    and its blinding are "the same shape drawn three ways", and its next lines drew the bounding box
    plus 75 mm. R0's D-BLIND made the drawing follow the comment, in the Rev C `baseline:` commit
    (7cd0ead3). The ring is 81D, the outline the yardstick reads too (SOG@GF's `poly` in `model.json`).
  - **The slice's rule, and how this item meets it.** The item must carry "no undrawn deduction".
    Read strictly, S-08 alone fails it: S-08 does not draw the FDN columns the blinding is laid
    around. The columns are drawn on S-10, sized on S-11 and registered (26 FDN column objects in the
    J-000 project, 25 of them meeting the ring, read back this session). So this Decision reads
    "undrawn" as "drawn nowhere in the pinned set": the item qualifies only through I-389, which
    reaches those columns by code. Without I-389 the item fails the rule, and the leg asserts the
    named refusal, not a line.
  - **Why no other item serves better.** Every cell was checked against four conditions: the machine
    publishes nothing there, one sheet draws it whole, the stack holds its level, and it owes no
    deduction the drawing set does not draw. No BNBC cell meets all four:
    - the machine's 11 published cells fail the first (read back this session: beam concrete and
      formwork; column concrete and rebar; pile boring, bored count and concrete; pile-cap concrete,
      formwork, excavation and blinding);
    - the lift-pit slab (LWPOLYLINE 830 × 300, 2.414 m³ in the yardstick, no deduction) needs `PIT`,
      a level the stack lacks, and inserting one would move the stack every M3 leg reads;
    - FDN slab blinding (2.432 m³) is drawn only in section (S-24);
    - lintels are a schedule (a view that draws no scope, I-375);
    - stairs are sloped (length × width × waist plus the step triangles, L-MEA-09), and the
      yardstick's WALL rows name a class the closed roster lacks (`bears.ts`).
  - **The named fallback, if I-389 cannot be built in session 8:** shear wall × rcc.concrete × GF,
    traced as runs on S-23's LIFT CORE PLAN (the yardstick's 6.387 m³, "the door face carries no
    wall; no deduction"). The machine publishes no shear wall and the register holds none, and GF is
    in the stack. Its costs:
    - **It lands in a gate cell.** SHEAR_WALL × RCC_CONCRETE is one of `cells.json`'s 36 cells,
      judged at ±3 % / +0 % (R-TO-035). Its golden is 6.387 m³ at GF of about 44.290 m³ over
      FDN…ROOF and PIT. A hand line there is judged by M3's golden band, which ties the manual leg
      to the gate's verdict and to R0. The informational cell below was chosen first for exactly
      this reason.
    - A Linear method `Σ L × t × floor-to-floor`, with the height DERIVED from the stack's storey
      height.
    - A level picked by hand, because a typical core plan states none.
    - L-MEA-09's column / shear wall tie where a core wall meets a column.
    - That S-23 draws the walls whole is INFERRED, not read: the `drawing-analyst` confirms it before
      anyone builds on it.
    - Moving the item re-scopes S2, S3, S4 and M4P-5, which are written around S-08's blinding, so
      that call is the orchestrator's.
  - **The cell.** slab × pcc.blinding × GF is not among `cells.json`'s 36 gate cells. It is an
    informational golden row, so the ±3 %/+0 % band does not bind it (the critic's correction). The
    machine owes it nothing on BNBC and publishes nothing there today (read-back of project
    `fe67f2bc`, session 8: 11 class × kind cells carry lines, none of them slab). So a hand claim on
    it can never collide with M3's machine proof in the J-000 project every leg shares. Every other
    cell S-08 draws whole is a gate cell (tie beams, pile caps) or needs a level the stack lacks (the
    lift-pit slab's `PIT`; the BNBC stack is FDN…ROOF).
  - **The column ruling.** The column deduction applies. The FDN column stubs stand through the 75 mm
    course, L-MEA-09 deducts a column's plan whole, and the yardstick deducts them (I-389). S-08
    does not draw the columns; S-10 and the register do. So 81D less the lift pit alone over-measures
    by the 25 columns' plan clipped to the ring, 4.051875 m² × 0.075 = 0.304 m³: a hard block. The
    figure is reachable only through I-389. The grid it needs stands: S-08's view (`…:2073`) and six
    other layout plans of the J-000 project each carry letter axes A–E and numeral axes 1–6 in the
    stored `grids` (read back this session). If I-389 is not built, the leg publishes nothing
    COMPLETE; it asserts the named refusal instead.
  - **The figure.** The leg never hard-codes it: it asserts the gate's evaluation of
    `(A₈₁D − 8.04691888 − Σ column plans ∩ ring) × 0.075` m³, with t = 75 mm from note 828
    (TRANSCRIBED) or the condition (ENTERED). The readings this Decision rests on, taken this session:

    | J-000 ring reading | Value | Source |
    |---|---|---|
    | slab outline 81D, mm² | 328838371.24436192623624929233379 | the shoelace of its five vertices' decimal spellings in the DXF |
    | blinding outline 824–827 and 2309, mm² | 328838371.24436192623624929233379 | the five LINEs (Rev C, D-BLIND) |
    | blinding outline outside the slab, mm² | 0 | the difference |
    | lift pit 830, mm² | 8046918.88 | the LWPOLYLINE |
    | FDN columns meeting the ring | 25 | `model.json`; C7, the porch column, outside |
    | their plans clipped to the ring, mm² | 4051875 | `model.json` |
    | of those columns, straddling the slab's edge | 17 | `model.json`: the perimeter columns |
    | FDN core walls inside the pit, mm² | 2590800 | `model.json`: SW1-3, SW1-4, SW1-D and K22's SW1-C |
    | the yardstick's deduction under SOG@GF, mm² | 3961875 | `model.json`, `col_deduct`: the columns less their parts in the ramp hole (K21) |
    | the yardstick's deduction under RAMP@GF, mm² | 90000 | `model.json`: A4 and A5 inside the ramp |
    | hand figure, m³ | 23.755468 | (81D − pit − columns) × 0.075, to 6 places |
    | golden slab × blinding × GF, m³ | 23.765 | `takeoff.golden.json` (R0: 23.615 → 23.765, K21) |

    `tests/takeoff/manual/s-measure-decision.test.ts` recomputes every row from the committed DXF,
    `model.json` and the golden, so a moved fixture or a misread figure goes red here before a slice
    builds on it.
  - **The hand figure against the golden: −0.009532 m³ (−0.04 %), under, the lawful direction.**
    - At Rev B the hand figure stood +0.140568 m³ over the golden's 23.615, and the golden owned most
      of it: SOG@GF's `col_deduct` took the three FDN core walls (1.905 m², 0.142875 m³) inside the
      lift-pit hole it had already deducted, and A4's and A5's parts inside the ramp hole a second
      time beside RAMP@GF's (0.09 m², 0.00675 m³). R0's K21 (W-33) deducts each member only from the
      plan it stands on, and the golden now reads 23.765. Both R0 items are closed.
    - −0.009057 m³: the hand line measures the blinding under the 1:8 ramp on plan, where the golden
      takes the sloped area (Q(2)). That is under, the lawful direction.
    - −0.000475 m³: the golden prints its row to three places (23.764525 → 23.765).
    - The difference is an informational row's disagreement, never a band failure.
  - **Questions put to the qs-critic (§12):**
    - (1) Is the column deduction owed under the SOG blinding? (This file's reading: yes.)
    - (2) Is plan area right for the blinding under the 1:8 ramp (drawn, 82F), or is the line
      PARTIAL_DECLARED by the slope? (This file's reading: plan, under by 0.009057 m³, the lawful
      direction.)
    - (3) **Answered by the drawing, shown to the critic to contest.** Does the lift-pit outline 830
      include the core walls? It does. 830 runs 8714.2…11707.4 × 8714.2…11402.6 in model space, which
      is CORE ± t_low / 2, the walls' outer face, and all four FDN walls (K22 adds SW1-C on grid C)
      lie inside it. Nothing more is owed. The yardstick no longer deducts them on top of the pit
      (K21).
    - (4) **Answered by the drawing since Rev C.** In Rev B S-08 drew the blinding's scope twice, and
      the two disagreed at the chamfer: was the slab's own outline 81D the right ring (this file's
      reading: yes), or the rectangle 824–827? Rev C's D-BLIND draws the blinding outline on 81D's
      own edges, so the two are one ring.

- **I-394 — Carrying a hand measurement across a re-pin is an IOU (L-REG-06).** A hand measurement's
  key names a view (a caption anchor's handle) and the drawing's coordinates, both inside one set
  revision.
  - A re-pin opens a new campaign on a new revision. That campaign starts with no hand measurements;
    the old ones stay in the old campaign's record.
  - The chest (project data) carries.
  - Pairing hand measurements across revisions (L-REG-05's content signature, over the ring) and the
    re-pin act's statement of what re-presents are owed. The owner is the slice that builds
    REPIN_DRAWING_SET (§14). Until then the re-pin act's consequence must say that hand measurements
    do not carry.

- **I-496 — A hand measurement is stored beside its register row, append-only; a condition is
  retired, never deleted (L-ACT-01, R-TO-041).** Migration 0062 lands two tables.
  - `manual_measurements` holds one row per register object, keyed by the object's own key inside
    its revision and bound to that row by a foreign key: the act that recorded it, the drawing,
    sheet and views it was traced on, the recipe as applied, the level (a surrogate, or the
    `FOUNDATION` slot, stated exactly once), the traced geometry exactly as the act judged it, the
    exact figure, the drawn and figure units, the calibration key, and what it supersedes. The app
    role reads and adds; a trigger refuses every rewrite and removal, the owner's included, as it
    does on the register's ledger of readings.
  - `conditions` holds a project's named recipes: the name (one standing condition per name), the
    geometry, class, kinds with their rule ids, the readings, the colour (one of the element
    palette's eight members, by name) and the hatch (one of six). The app role may edit one and
    retire it, and never delete it, because a measurement cites the condition it was applied from.
  - The manual-origin fact S3's rail filter keys on (I-384) is a row in `manual_measurements`: a
    register object with one is a hand measurement's. It is never read off the mark's prefix.
  - **The citation of a condition is bound to the project, in the act and in the store (amended on
    review).** A recipe that names a condition is judged against the chest first. The act reads the
    condition by workspace, project and id on its own transaction, and refuses
    `MANUAL_CONDITION_NOT_STANDING` where the chest holds none (another project's, another workspace's,
    or none at all) or holds it retired. Without that read the store's key answered an unknown
    condition with SQLSTATE 23503, which reached the wire as a fault. The store's key is now
    composite, `(tenant_id, project_id, condition_id)` against `conditions_scoped_key`: a foreign key
    is checked past row-level security, and a key on the id alone would let a row cite another
    workspace's condition. A null id cites nothing and is checked against nothing. That the recipe
    as stated agrees with the condition it names is still the chest's to prove (S5); the act checks
    that the condition stands.

- **I-495 — Every write to the register's objects has one home, the register store (L-REG-01, B-17,
  ARCH-01).** A hand measurement "registers through the register's door, never through a writer of
  its own" (the J-000 header's third door). The act that records one is core, and core imports
  nothing above it, so the door comes down to where the act can reach it.
  - The batch sighting write (`registerSightingsIn`: the store's own key as the double-count guard,
    a refused sighting kept whole as evidence) moves from `src/modules/takeoff/register/index.ts`
    into `src/core/register/store.ts`, beside the observation ledger and the repudiation writer that
    already stood there. The module re-exports it, and every caller above core (the rebuild, the
    stages) keeps its import. The move is diff-neutral: the same SQL, the same answers, the register
    breaker suites unchanged.
  - The two core writers that wrote `register_objects` directly are re-homed as named writers of
    the store. `rekeyObjectIn` is L-REG-04's one hop, which a level carry (`levels/store.ts`) and a
    typical range (`author-typical-range.ts`) both take: the key, the surrogate, the cleared slot
    and label, and the standing where the caller moves it. `registerBesideIn` stands up the rows a
    typical range places a member on beside its placeholder, where a key already standing is the
    same sighting and writes nothing.
  - Rejected: routing the typical range's rows through the batch door. A range re-stated over a
    storey the member already stands on would then be kept as a refused sighting, evidence of a
    double count that is not one.
- **I-497 — With no condition picked, an armed tool measures and records nothing.** I-374 arms a
  tool only with a condition picked, and with no condition of the tool's geometry in the chest
  "nothing arms". That reading fits a stocked chest. Read against an empty one, and against every
  project before S5 lands the chest, it leaves Linear, Area and Count unusable, and the empty chest's
  teaching state with nothing to teach beside.
  - So where the chest holds no condition of the tool's geometry, L, A and C arm the tool with no
    condition. The QS draws, snaps and cuts out; the running figure and the measure cell read the
    shape live; Enter finishes it into a draft that stays on the sheet. It is a take-off check, the
    area and run the Select pick cannot give.
  - Nothing is recorded. No card opens, because a measurement is an offer to the gate under a chosen
    kind (R-TO-040), and a shape with no condition has none. The measure cell says so after every
    finish: `measure_status_unrecorded`. Where the chest holds a condition of the geometry, I-374's
    pick-first order governs unchanged.
  - The preconditions of RECORDING are said where recording is asked. No open campaign, a sheet
    outside the pinned set and an unconfirmed discipline (§3's reasons 3–5) are refused by name at the
    card's preview (§5). The tool row says the preconditions of DRAWING that the viewer already holds:
    offline (reason 1), MEASURE not held (reason 2, read from the scale door's own
    `PERMISSION_NOT_HELD`, one answer and no second read), and the unscaled view under the pointer
    (reason 7). Reasons 3–5 join the tool row when a read of them stands in the route; owner S6,
    which brings the preview door that reads them. Reason 6 joins with M4P-6: no raster content
    reaches the viewer before it.
  - Rejected: tools disabled until a condition exists. The QS could not check a single outline, and
    the chest's empty state would teach a tool nobody may touch.

- **I-498 — The hatch over an unscaled view is the views overlay's own; an armed tool honours it and
  says so.** §2.3 asks that every view with no scale of record is hatched while a tool is armed. The
  views overlay already hatches exactly those views, in the untyped hatch idiom and `--warn`, from the
  scale door's one answer (I-160).
  - The measure layer paints no second hatch. Over such a view the cursor is not-allowed, a click
    places nothing, the reticle's ticks turn `--warn`, and the measure cell reads `data-reason=unscaled`
    with `measure_view_unscaled`.
  - A reader who switches the views overlay off takes the hatch away with it; the refusal still
    stands, in the cursor and in words.
  - Rejected: a second hatch on the measure canvas. Two layers painting one pattern over one view
    double its ink where both stand, and two homes for one reading is a copy (B-17).

- **I-499 — The grammar's unwritten cells.** I-372's table leaves some cells open. They are ruled
  here, each in the direction of never costing the QS work:
  - Escape while cutting discards the cut-out in progress and returns to the outline as a draft. A
    stray Escape in a cut-out never costs the outline.
  - Backspace on an empty cut-out ring returns to the outline. On a finished shape with cut-outs, the
    last ring closed is the first re-opened: the cut-out before the outline.
  - A point placed where the ring's last point already stands adds nothing and says
    `measure_status_repeated`. A Count never counts one symbol twice in one measurement (I-380's
    coincident point): a count is a set, not a path, so a point where ANY counted point already
    stands is refused the same way, however many clicks ago that symbol was counted (A, B, A counts
    two). A Linear or Area path may come back to a point it passed; only a repeat of the last point
    is nothing.
  - Rectangle (the M menu): each ring is spanned by two opposite corners, and the second corner
    finishes it, so there is nothing to Enter. A cut-out drawn in Rectangle is a rectangle too.
  - An outline that crosses itself or encloses no area is not finished (`measure_status_degenerate`),
    so the door's `MANUAL_GEOMETRY_DEGENERATE` is said before anybody is asked to confirm.
  - A free point is the pointer's world point on the 0.1 lattice (I-385), except a coordinate that a
    constraint (Shift, or Ortho) copied exactly from the last point. That coordinate keeps the last
    point's own spelling, so an ortho run stays exactly square in the drawing's coordinates.
  - A press may travel up to 4 px and still place a point (§7). The sheet does not move before the
    press passes 4 px; past it the press pans, from where it began. The click count is the browser's
    own click's, so a double-click's second click finishes and places nothing.
  - The roster spells the space bar `Space`; the one reading of a step (`matchesStep`) reads the space
    bar's key as that word.
  - Confirm's roster line (Mod+Enter) joins with the card it confirms (S6). Until then there is
    nothing for the key to do, and a line of the ? sheet that does nothing would be a false line.

- **I-500 — A rectangle's derived corners are MEASURED only where the drawing has a point exactly
  there.** The two corners a QS clicks keep their own basis. The other two are derived from them: the
  x of one and the y of the other.
  - Each derived corner is asked of the drawing through the snapping region's own resolver. Where an
    entity's point stands exactly at the corner (a vertex of the lift pit 830, say), the corner is
    MEASURED and cites that entity. Anywhere else it is ENTERED.
  - Either way its coordinates are the clicked corners' own exact spellings, never quantised again.
  - So a rectangle traced over a drawn rectangle is MEASURED throughout, and one drawn over nothing is
    honestly weaker (I-387). The door re-derives every cited point (I-387), so a client that claimed
    more is demoted there.

- **I-501 — On a sheet that shows the plan through a viewport, a figure is carried into metres
  through the one window it stands in, or it stays in the sheet's own units and says why.** L-MEA-05
  carries a view's figure into metres by its scale of record, and that scale is stated per unit of the
  space it was read in.
  - A paper sheet shows model space through its viewports: the viewer projects each model record onto
    the paper, moved and scaled by the window (`viewer/projection.ts`). So a point placed on such a
    sheet stands in PAPER coordinates.
  - Every BNBC sheet is such a sheet. S-08's plan is seen through viewport 2077 at 1:100 (view height
    34000 over a 340 frame, read from the committed DXF), while its view's scale of record is the
    DIMENSION_RATIO 0.001 m per MODEL unit (the J-000 project's read-back). That factor on paper
    coordinates would state 81D at about 0.033 m², ten thousand times under its 328.838 m².
  - So the calibration door (`viewer-snap/server.ts`) answers two facts beside each view's stored
    factors, both read in `viewer-snap/sheet-space.ts`: the windows the sheet shows model space
    through (the viewer's own `windowsOf` over the layout's inventory — each frame on the paper, and
    the viewport's view height over its frame's height, in the drawing's own spellings), and the space
    each view's factor is per unit of (`model` for the machine ranks, which are read off the view's
    model-space members or the header; `unrecorded` for a QS two-point, whose sheet the affirmation
    does not record). The windows travel with the calibration, not the manifest, so a sheet is known
    to be paper from the door's answer and never from whichever records have streamed in so far.
  - One reading, `sheetMeasuring` in `viewer-snap/snap.ts`, answers how a span of the sheet is
    carried, for the running figure, a Linear run's lettered segments and the snapping region's
    distance cell alike (B-17). On model space, a view's factor carries the sheet's own coordinates.
    On paper, where one view's scale of record holds every point and exactly one window's frame holds
    them too, the factor is carried through that window: a length is multiplied by the window's ratio
    of model units to sheet units (34000 / 340 = 100 on S-08), an area by its square. The quotient is
    taken once, in the canon's 40-digit decimal, and the figure rounded once, half-even. On S-08, 81D
    reads A 328.838 m², and 320.791 m² with the lift pit 830 cut out, as on model space.
  - Where that does not hold the figure stays in the sheet's own units and says why, each reason by
    name: `windowed` where the points stand in two windows, or on paper outside every window, or in
    two overlapping windows (`measure_figure_windowed`); `unrecorded` where the view's factor is a
    QS two-point (`measure_figure_unrecorded`). The distance cell says the same two reasons
    (`viewer_status_distance_windowed`, `viewer_status_distance_unrecorded`), and both surfaces name
    the window they carried a figure through (`data-via`).
  - What stays owed (§14): the act maps a placed point back to model space through its window before
    it keys or measures anything (I-378's `model` space; S1/S6). And the scale store does not record
    the sheet a QS two-point was taken on; on model space such a factor is still applied as it always
    was, and a two-point taken on a paper sheet is per PAPER unit there (§12).
  - Rejected: metres from the model factor on paper coordinates — a partial faulty estimate is more
    harmful than no estimate. Rejected: withholding metres on every paper sheet (this Interpretation's
    first reading, S4's first pass) — the QS outcome is metres on S-08, and the window that makes them
    right is a fact the drawing states. Rejected: carrying the windows in the manifest head — the
    manifest is VIEW-TXT's this wave and its digest covers what a painter draws; the calibration door
    is where the question "what carries this sheet into metres" is already answered.
- **I-538 — A deduction channel may carry no threshold: `junction` deducts a member's plan whole
  (L-MEA-08, L-MEA-09).** L-MEA-08 has an offer carry "deduction candidates per channel with
  geometry/basis/source and no sums", and has the gate "read deduction thresholds from the edition and
  partition strictly-greater". L-MEA-09 puts the threshold on a slab's openings and on nothing else:
  "less column and wall plan areas, less openings above `openingDeductionMinM2`".
  - Reading: the gate partitions a channel against the threshold the edition states for it; a
    channel the law states none for is deducted whole. So I-389's members come off as candidates,
    each with its own reading and source and each on the line with its side, never as one sum an
    offer binds.
  - The roster (`DEDUCTION_CHANNELS`, `src/core/offers/law.ts`) is `opening | finish_opening |
    junction`. `CHANNEL_THRESHOLD.junction` is null and the channel's sum binds `junctions`
    (`src/core/gate/deductions.ts`). A junction in a unit the canon lacks is refused
    `UNIT_UNMAPPED`, and one that is not a figure `OFFER_NOT_TO_CONTRACT`, as any candidate is.
  - A junction below zero is refused `OFFER_NOT_TO_CONTRACT`, never deducted. A member's plan, like
    a line's figure, is never less than nothing (`admissibleFigure`, L-QTY-04). With no threshold
    in the way, a negative candidate would be subtracted from the ring and raise the figure, which
    is over-measurement, a hard block. A signed ring area that came through clockwise is the likely
    way in, since the manual builder clips members with signed arithmetic (S1's `core/manual/exact.ts`).
    The threshold channels need no such arm: a negative candidate is never strictly greater than
    their threshold, so it is kept and moves nothing. A junction of zero is deducted and moves
    nothing. (Found by S2's adversarial review, 2026-09-24.)
  - The channel is the home of every junction L-MEA-09 gives to a member the plate does not own:
    columns and walls through a slab's ring, and a pile's section through a cap's blinding (pile ›
    pile cap). Each comes off whole. A member offered through the opening channel would be judged by
    a threshold L-MEA-09 puts on openings alone. BNBC's piles are about 0.2 m², above the 0.1 m²
    threshold, so today the two channels agree on them, but only one of them is the rule.
  - Nothing in the method or `MANUAL_RULES` says junction candidates are OWED: an offer with none
    publishes with `junctions = 0`. I-389's fail-closed arm (members that stand through the ring but
    cannot be placed refuse or declare, never publish COMPLETE) is the builder's to build (S3, §14).
  - The machine's slab methods keep their pre-summed `A_members` (`rcc.slab.concrete@1` and its kin,
    bound from the plan reader's junction reading): a standing pair is never edited (L-MEA-01). A
    later version of them may take the channel; that is their owner's call.
  - Rejected: `junctions` as a variable the manual builder binds pre-summed. That is the sum L-MEA-08
    keeps out of an offer, and it drops each member's source from the line the book prints "Less: 25
    columns (register)" from. Rejected: borrowing `openingDeductionMinM2`. A 300 × 300 column is
    0.09 m²; the threshold would keep it, and the slab would bill concrete where the column stands.
  - Proof: `tests/rulesets/manual-methods.test.ts` and `tests/takeoff/gate/methods-registry.test.ts`.

- **I-539 — Which rule a hand measurement is offered under: one twin, the reuses named, the rest
  not offered yet (R-TO-040, R-TO-041, L-MEA-01).** A hand measurement is offered under the machine's
  own pair wherever that pair's algebra takes exactly the readings a trace and a condition give. A
  twin is minted only where it does not.
  - `src/core/rulesets/methods/manual/rules.ts` (`MANUAL_RULES`) is the one home of the pairings
    offered today (geometry × class × kind → rule id) and, per pairing, what supplies each variable
    the rule declares: the trace, the multiplier, the condition's reading, the edition or the gate.
    The act snapshots the rule id it reads there (I-374), the chest (§2.6) lists what it holds, and
    the offer builder (S3) binds by it. A pairing it does not hold is not offered, and no rule is
    guessed for it.
  - A condition attribute a twin declares (for blinding, `t`) is the condition's reading (ENTERED)
    or the drawing note the card binds (TRANSCRIBED), never the edition's `blindingThickness`: that
    parameter prices the machine's projected rectangle, and a hand measurement names its own
    thickness (I-374, L-MEA-06).
  - The geometry roster a pairing is typed by (`MANUAL_GEOMETRIES`, `ManualGeometry`) lives in S1's
    `src/core/manual/law.ts`; `rules.ts` imports it from there (the stand-in it carried until S1 landed
    was deleted at integration, session 9).
    `tests/rulesets/manual-methods.test.ts` goes red on a tree holding both.
  - Every kind of `KINDS`, decided. A kind added to the roster owes its row here, and
    `tests/rulesets/manual-methods.test.ts` refuses a roster with a kind the table lacks:

    | Kind | Hand geometry, class | Decision | Why | Offered by |
    |---|---|---|---|---|
    | pcc.blinding | Area, slab | twin `pcc.blinding.area@1` | the rect method reads L and B off a rectangle, projects p, and has no channel for a cut-out (I-388) | S2 |
    | pcc.blinding | Area, pile cap | the same twin, not offered yet | the piles stand through a cap's blinding (FND-OWN deducts their sections from the machine's), and nothing offers them from a hand trace yet, so the figure would be over | S3's successor, with those candidates |
    | pcc.blinding | Area, footing | the same twin, not offered yet | nothing stands through a spread footing's blinding, so the figure is whole, but no proof walks one (BNBC is piled) | the first proof that measures a footing |
    | rcc.concrete | Area, slab | twin owed, on the same traced-plate tree (`manual/traced-plate.ts`) | `rcc.slab.concrete@1` takes the members pre-summed (`A_members`); a hand ring takes them as junction candidates (I-538) | S9 |
    | rcc.concrete | Count, pile | reuse `rcc.pile.concrete@1` | count × π × d × d × length ÷ 4 takes the points counted, and d and length from the condition or the pile schedule | the Count tool's proof (S9, S11) |
    | rcc.concrete | Count, column; Length, beam or wall | not offered | a vertical's height is the stack's floor-to-floor, band-aware, and a beam's length its clear span between support faces (L-MEA-09); a click or a traced run states neither | S9 |
    | rcc.formwork | any | not offered | a contact face depends on which member owns each junction (L-MEA-09), which one trace does not state | after S9 |
    | piling.bored | Count, pile | reuse `piling.bored.count@1` | N = count, the points counted | the Count tool's proof (S9, S11) |
    | piling.boring | Count, pile | reuse `piling.bored.length@1` | count × length, the length from the condition or the pile schedule (AM-06 §2) | the Count tool's proof (S9, S11) |
    | earthwork.excavation | Area | not offered | L-FRM-04 defers polygon pits, and a traced outline plus a working allowance is the offset of a polygon it defers | a Deviation first |
    | masonry.brickwork | Length, brick wall | reuse `masonry.brick_wall.volume@1`, not offered yet | L-MEA-02: "a face with no schedule is not measured"; a hand run brings no schedule until that clause is ruled for hand measurement | S9, with that ruling |
    | finish.plaster, finish.paint | Area, surface | reuse `finish.surface.plaster@1` and `finish.surface.paint@1`, not offered yet | the same L-MEA-02 clause | S9, with that ruling |
    | finish.flooring | Area, surface | reuse `finish.surface.flooring@1`, not offered yet | a floor finish is a room's floor net of its openings (I-542); a hand ring of a room is S9's Area tool under the same L-MEA-02 ruling as plaster and paint (added at integration, session 9: ARCH-2's kind) | S9, with that ruling |
    | finish.tiling | Area, surface | reuse `finish.wall_face.tiling@1`, not offered yet | a dado is `P × h − openings` over one run of a room's walls (I-543); a traced run states P and no height, so the height comes from a condition the chest does not hold yet (added at integration, session 9) | S9, with a condition that states h |
    | finish.skirting | Length, surface | not offered | no method measures skirting yet: its length deducts the openings' widths at floor level and no channel carries a width (s-coverage, ARCH-2's open item) | ARCH-7/8, with the skirting's method |
    | rcc.rebar | none | never by hand geometry | bars are the schedule's and the BBS's (AM-03); a trace states no bar | none |

  - Proof: `tests/rulesets/manual-methods.test.ts` holds every pairing to its method: enumerated, a
    formula of the pairing's kind, borne by its class, every declared variable supplied and nothing
    else, and each supplier's dimension, channel and parameter the method's own.

- **I-573 — A condition's hotkey is its place in the chest, not a stored choice.** §2.6 asked for
  "the next free digit, changeable". The `conditions` table (0062) holds no hotkey column, and this
  wave's migrations are another slice's, so a changeable digit would have to live outside the store,
  where two browsers would disagree about what 3 means.
  - So the digits 1–9 pick the chest's first nine standing conditions in the order they were
    authored (`authored_at`, then the id), exactly as I-374 first said ("the digits 1–9 pick the
    chest's first nine conditions in its order"). Retiring one moves the rest up a digit. A tenth
    condition has no digit and is picked by a click.
  - The form shows the digit the new condition will answer to, and does not offer to change it.
  - The chest's answer carries each condition's `hotkey`, computed by the store's read
    (`chestOf`, `src/core/manual/conditions.ts`), so the row's Kbd, the roster's `viewer-condition`
    line and the key the viewer matches are one fact.
  - Rejected: a client-side preference for the digit. It would make the chest's own keycaps a
    per-browser fact while the chest is project data.
  - Owed: re-ordering the chest (and with it a chosen digit) needs an order column. Owner: S5's
    successor (§14).

- **I-574 — What the chest may author is the manual roster, judged by the chest, and every refusal
  is named.** R-TO-041 asks for named recipes; I-374 says the recipe names each kind with its manual
  method's rule id; I-539 puts which pairings are offered in `MANUAL_RULES`. The chest
  (`judgeCondition`) reads all of it from there:
  - Each kind is judged against the class's bears (L-MEA-04): one it does not bear is
    `CONDITION_KIND_NOT_BORNE`. One it bears that no manual method measures from the shape (a slab's
    concrete traced as an area, today) is `CONDITION_KIND_NOT_OFFERED`: a condition under it would
    draw outlines the gate could never offer, which is measuring nothing and calling it measured.
    Rejected: answering that case with `CONDITION_KIND_NOT_BORNE`, whose sentence would then be false.
  - The rule id is the roster's, never the caller's: the statement names kinds, and the chest writes
    each with the rule `manualRuleOf` answers (B-17). The act snapshots it from there (I-374).
  - The readings are exactly the variables the paired rules take from the recipe (`ManualSupply`
    `recipe`), each once, in the order the rules owe them, each a positive decimal in a unit of the
    variable's dimension (the method's own `MethodVariable`), and each ENTERED with no source key
    (I-374: a person stated it). A reading missing, one no rule takes, one in a unit of another
    dimension, or a size of nothing is a statement the form never makes, so it is `REQUEST_MALFORMED`.
    A value that states no number is `READING_NOT_NUMERIC`, the act's own code for the same fact.
  - The name is trimmed, 1 to 120 characters, and one standing condition holds it
    (`CONDITION_NAME_TAKEN`, asked before the write and read off `conditions_standing_name_once` where
    two people race to it, so the second is told, never faulted).
  - A condition leaves the chest by being retired (`retired_at`, `retired_by`), never deleted. One
    the chest does not hold standing — retired already, another project's, another workspace's — is
    `CONDITION_NOT_IN_CHEST`.
  - Authoring and retiring ask MEASURE and name no act type (I-374: not an act). Reading asks
    participation: every role on the project sees the chest, and the answer's `canAuthor` is the
    guard's answer to MEASURE, which is how §3's read-only cell is decided.

- **I-575 — The running total is the campaign's own COMPLETE lines, never a figure the chest
  computes.** §2.6 asks for "the running total per kind for this campaign, measured scope only".
  - Per condition, the chest reads the standing hand measurements of the campaign open now (the
    register scope of the latest campaign; a measurement whose register row is repudiated counts for
    nothing), and the quantity lines the gate published of them. The total per kind is the sum of the
    COMPLETE lines' values, in decimal, grouped by kind and unit. A PARTIAL line is never totalled
    (L-QTY-07), and a kind with no COMPLETE line is absent, never 0.
  - The row shows the totals, or "—", and its tooltip says how many standing measurements cite the
    condition and how many of them every kind of the recipe has a COMPLETE line for ("2 measured in
    this campaign, 1 billed"). So a measurement the gate has not billed is said, never hidden.
  - Until manual offers reach the gate (S3), no hand measurement has a line, and every row reads "—"
    with its measured count. That is the true state: measured, not billed.
  - Rejected: totalling the traced geometry (the ring's m²) as the condition's total. A blinding is
    billed in m³ through the edition's method and its deductions; an m² beside the row would be a
    second, unsigned figure for the same scope.

- **I-576 — A condition is picked only while its geometry's tool is armed.** I-374 ties a condition
  to its tool ("arm the condition's tool (Area for an area condition, and so on)"), so a Line cannot
  measure under an Area condition.
  - The chest remembers the condition last picked, and names it as what the armed tool measures under
    only while the armed tool is its geometry's (`TOOL_OF_GEOMETRY`). Pressing L or C after picking an
    area condition leaves the measure cell and the chest's selection without it; pressing A again finds
    it where it was, which is §2.6's "the area condition last used on this mount" for the one
    remembered.
  - Rejected: forgetting the pick when the tool changes. The QS who steps to Select or Line for a
    moment would have to pick again, and §2.6 asks that A find the condition last used.
  - A read-only chest picks nothing, so it does not take the digits 1–9 either: the keystroke goes on
    to the sheet's own keys (§3).

- **I-586 — A register member's plan is the ring it was placed by, laid on the hand ring through the
  grid (I-389, as built).** I-389 reads the members of the storey whose top is the ring's level and
  deducts each one's plan clipped to the ring's net region. S3 builds that in
  `src/core/manual/junctions.ts` (pure) and its reader in `src/core/manual/offer.ts`:
  - **Which members.** A slab-class ring (`JUNCTION_MEMBER_CLASSES`: a slab runs past columns and
    shear walls, L-MEA-09) at level L reads the standing register objects of those classes on the
    level just below L in the live stack. A ring in the FOUNDATION slot, or on the lowest level, runs
    past nothing. Repudiated objects are nothing, and so is the measurement an edit strikes.
  - **Which plan.** A machine member's plan is the closed ring the placement stage placed it by
    (`placements.outline_key`, I-333), read out of its drawing's own artifact at its points' exact
    decimal spellings. A member measured by hand is laid by its own traced outline. The schedule's
    section is not redrawn: the register object at FDN was placed by a plan of that storey, and its
    drawn ring is the section that plan states (on BNBC the FDN and GF sections are one, I-389).
  - **Which frame.** The same view is its own frame. Two views are one frame by the cap relation's
    rule (I-547): every axis label the two share, at least two per world axis, at one offset on the
    placement lattice. The offset laid is that lattice reading (`quantise`), never a float: S-08's and
    S-10's numeral axes read 2.99e-15 and 1200000.000000001, one building's grid drawn twice, and the
    lattice says −1200000.0. Two views affirmed at different scales of record are no frame: a
    translation between drawing units of two sizes lays nothing where it stands. A ring whose own view
    stands under another scale than the one it was measured at lays nothing either.
  - **Clipped exactly.** The member's plan is clipped to the ring's outline less every cut-out by the
    overlap guard's exact kernel (`sharedArea`, I-380). A fraction that does not terminate is rounded
    UP at a trillionth of a drawing unit², toward the larger deduction. A member the ring does not
    meet, and one inside a cut-out, deducts nothing; one straddling the edge deducts what the ring
    holds. Each candidate cites its placement key and stands DERIVED in the junction channel.
  - **Fail closed.** A member with no plan, no frame the ring's grid can lay it in, or another scale
    refuses the whole measurement `MANUAL_JUNCTION_UNPROVEN`, naming the members, for every kind whose
    rule deducts junctions (I-389's arm, §14 closed). The preview answers it in the card; the run
    reports it as the kind's observation on the object.
  - Rejected: re-deriving a section rectangle from the schedule and the placement point. It needs the
    member's rotation and its centre, neither of which the store keeps for every member, and the
    drawn ring is the drawing's own statement of both. Rejected: laying plans by their float offset.
    Two grids drawn to one building differ by noise the lattice exists to absorb, and the exact
    kernel would carry that noise into every clipped area.
  - The translation rule has one statement in core (`frameTranslation`) and one in the module
    (`cap-junctions.ts` `translationBetween`, I-547), which core may not import. Re-homing the module's
    onto core's is the integrator's (§14).

- **I-587 — The preview asks the gate, and the card's figure is the gate's (I-373, I-384).** The
  act's preview offers the measurement through the one builder the run offers through
  (`manualOffersOf`), over the members the run would read, and asks the gate's own `judgeOffer` under
  the campaign's edition. The MEASUREMENT arm carries each kind's answer (`offered`: the figure, unit,
  formula, coverage and basis the line would publish, or the queue cause) and the campaign it stands
  in, and the digest binds both.
  - A kind the gate would refuse refuses the act by the gate's own code (`METHOD_NOT_IN_EDITION`
    where the edition cites no manual pair, `OFFER_NOT_TO_CONTRACT` where the recipe states no
    reading the rule declares), and a ring that cannot lay its members refuses
    `MANUAL_JUNCTION_UNPROVEN`. A measurement that could never publish is not recorded to sight its
    cell as though it might.
  - A kind `MANUAL_RULES` holds no pairing for, for this geometry and class, is recorded and answered
    `not-offered`: no rule is guessed (I-539), and the cell it sights reads NOT_ESTABLISHED, which is
    true. The chest (S5) authors only paired conditions, so a QS meets this only through a condition
    stated off the chest.
  - INTERPRETED geometry is answered `queued` (L-QTY-04), never refused.
  - The commit door then asks for the campaign's measure run (`requestMeasure`) and answers the ask
    beside `{ actId, objectKey }` (§2.11). Asking is not an act; a run already queued is the same ask.

- **I-588 — What a hand offer cites (L-QTY-03).** The ring's area cites the first entity its outline
  was snapped on (81D for J-000's ring), or the recording act where every point was placed free; each
  cut-out cites its own ring's first entity. An ENTERED reading cites the act that recorded it
  (`act:<id>`), a TRANSCRIBED one its note. The count of one trace is `1 pcs` at the geometry's own
  basis: it is the trace's, not a person's statement (S9's typical ×n will be ENTERED). The threshold
  is DERIVED from the pinned edition. Before the act exists the preview cites the measurement's own
  register key for an ENTERED reading; a source enters no figure, formula or digest, so the preview's
  figure and the run's are one (proved in `tests/takeoff/gate/manual-offers.test.ts`).

- **I-589 — The gate reads the cell rule off stored claims, on both arms (I-382, as built).** After
  the batch's own over-measurement block, `withoutSharedCells` (`src/core/gate/evaluate.ts`) reads
  three stored facts: which register objects a hand measurement recorded (the manual-origin fact),
  which cells a standing hand measurement claims (its recipe's kinds at its class and level), and
  which cells a standing machine object already published in. A machine offer into a claimed cell is
  refused `CELL_MEASURED_BY_HAND` on the queued arm as on the published one: an object is a line or a
  declared exclusion of its own cell, and this cell is the person's. A hand offer into a cell a
  standing machine object published in is refused `MANUAL_CELL_MACHINE_MEASURED`, the act's own
  preview refusal answered again, because a campaign's lines move between a preview and a run.
  - The machine's rails never see a hand row (I-384): the run hands them the machine's rows
    (`machineRowsOf`, keyed on the manual-origin fact), so no rail reports a placement nobody placed
    for a person's sighting. The setup's manual seam (`RailSetup.manual`) is typed in the contract,
    and the measurement's shape is declared into it by the builder that owns it (module augmentation),
    because the contract importing the manual law would close a cycle through the law's own imports.

---

## 1. What a QS brings from Bluebeam, PlanSwift, On-Screen Takeoff and CostX

A Dhaka QS who measures by hand today uses one of these four tools, or AutoCAD plus Excel plus a
measurement book. The table records what they will expect, and what Cubit keeps, refuses and adds.
Sources: the vendors' own help pages (Bluebeam: "hold down Shift … horizontal, vertical, or 45°",
"to remove the last control point, select Backspace", "select Enter after the last point or
double-click"; CostX's Cutout tool and negative dimensions; OST's Conditions and Typical Groups;
PlanSwift's Area/Linear/Segment/Count items, assemblies and cut-outs). Only Bluebeam's gesture keys
are quoted from its manual; "similar" is the common practice a QS reports, not a quoted fact. A dash
means this Decision does not rely on that tool for the row, not that the tool lacks it.

| What the QS expects | Bluebeam Revu | PlanSwift | OST | CostX | Cubit (this Decision) |
|---|---|---|---|---|---|
| Pick what you measure, then draw | Tool Chest item (subject, colour, depth) | Takeoff item from the job tree | Condition from the pinned Conditions list | Dimension group | Pick a condition in the chest (or its digit), then draw (I-374) |
| Click points; Enter or double-click finishes; Backspace drops a point; Esc cancels; Shift constrains | yes (Shift: 0/45/90, quoted) | similar | similar | similar | yes; Shift is 0/90, or 15° with Angle lock (I-372) |
| Snap to the drawing | snap to content | vector snap | snap | vector snap | six snap kinds, priority-ruled (I-147); each point's basis visible (I-387) |
| Cut-outs drawn, not typed | Cutout | Cutout tool | cut-out | Cutout tool, negative dimensions | X cuts out inside the ring; "Less:" rows (I-372, I-391) |
| Deductions for members through the slab | drawn by hand | drawn by hand | drawn by hand | drawn by hand | **from the register, by code** (I-389) |
| Running total while drawing | yes | live totals | yes | yes | running figure at the live point and in the status (§2.4) |
| One measurement, many items | tool sets and custom columns | assemblies of parts | multi-quantity conditions (Qty1/Qty2) | dimension group expressions | assemblies (S10), edition parameters |
| Typicals | copy | multiplier | Typical Groups and Areas | multiply | typical ×n (S9), printed as timesing |
| A list of every measurement, editable | Markups List | job tree | Summary | workbook | sheet list in the drawer + the book at Takeoff › Measurements (§2.7, §2.10) |
| Legend on the sheet | Legend markup | — | — | — | VD-4's legend, keyed by condition (§2.8) |
| Calibrate per viewport | yes | yes | yes | yes | per view, affirmed by act (L-MEA-05); hatched where none |
| Live link from bill cell to drawing | — | — | — | workbook links | every line carries its Trace (R-UI-022) |
| A measurement is final when drawn | yes | yes | yes | yes | **a card to confirm it** (R-UI-042); ⌘↵ keeps the rhythm (I-373) |
| Can I measure the same thing twice? | not prevented | not prevented | not prevented | not prevented | **no**: refused by name (I-378, k, l, m) |

What a QS will find different, and why:
- **The confirm card.** It costs a chord (⌘↵) per measurement. In return, the QS sees the formula,
  the deductions and the basis the gate will bill before anything is committed.
- **Refusals.** Measuring twice is refused, never silently allowed. Over-measurement is the one error
  a bill must never carry.
- **Deductions the register already knows** (columns through a slab) are deducted by code, not by
  hand.
- **The book.** It prints in their own PWD form, with dimensions exact enough to check on a
  calculator.

What Cubit refuses from them:
- a ribbon of a hundred tools (the tool row plus the M menu);
- modal property dialogs for conditions (the chest's inline popover);
- measurements that are not in any bill until someone exports them.

---

## 2. Layout and interaction

### 2.1 The tool row (`viewer-toolbar.tsx`, S4)

- Linear L, Area A and Count C arm (IconButton `pressed`, the 2 px beam underline).
- A fourth button, ▾ (the M menu), opens a DropdownMenu of the rest of the toolset:
  - Rectangle (S4) and Cut out (S4, the same as X);
  - Perimeter, Volume, Typical ×n, Pitch multiplier (Linear), Select on layer in region, Fill a
    closed region and Freehand (S9). Each stands **disabled with its reason** until its slice lands:
    a tool that is coming is a fact.
- R-TO-040's own words for the three armed tools, and who pays each:
  - Linear shows its segments: while drawing and on the card, each segment's length sits at its
    midpoint in the running figure's style (S4).
  - Count snaps to a symbol: a click on a block reference counts that insert at its insertion point,
    MEASURED and citing the insert's source key (S9; S4's Count counts snapped or free points).
  - Area draws a polygon or a rectangle (S4), freehand and magic fill (S9).
- Disabled reasons for the whole group (the tooltip, `title`; §4) cover: no open campaign, the sheet
  outside the pinned set, the discipline unconfirmed, MEASURE not held, and raster content before
  M4P-6. The pointer and camera groups stay usable. S4 renders MEASURE not held, read from the scale
  door's own answer; the rest join as I-497 names.
- `viewer_tools_measure_absent` ("Measurement tools arrive with S-Measure") retired when S4 landed.
- The ▾ is a 20 px chevron beside Count (`--space-5`), with "More measure tools" and its key M in its
  tooltip. Its menu lists Rectangle, Cut out (live only on a finished Area outline) and the S9 tools,
  each of those disabled with `measure_tool_not_yet` in its `title`.
- With no condition picked the tools measure and record nothing (I-497).

### 2.2 The gesture grammar

I-372's table is the contract. The pointer paths live in the inherited `use-pointer.ts`, and a
pointerdown in an armed tool never enters the select, pan or marquee paths. The measure keys are
matched in the route's `measure-region.tsx`, through the roster's own `matchesStep` and
`shortcutById` (R-UI-032), exactly as `snap-region.tsx` matches S. They are not matched in
`use-keyboard.ts`: that hook is in `src/modules`, which may not import the roster from `src/ui`
(ARCH-01), so it keeps only the camera's keys and yields the arrows while a tool is armed. The
keyboard cursor (R-UI-060) works like this:
- with the canvas focused and a tool armed, the arrow keys move the live point by one screen pixel
  (Shift: ten), converted to drawing units at the camera's scale. In Select they pan, as today
  (`viewer_canvas_keys`); in an armed tool the camera follows the live point instead, panning when it
  comes within `--space-5` of the stage's edge, so no pan chord is needed and none is invented;
- the live point snaps exactly as the pointer's would, and the status speaks the snap kind when it
  changes (so a keyboard user knows when the point sits on the drawing);
- Space places a point and Enter finishes;
- the hidden status line speaks each placement (§4).

### 2.3 Snapping and basis while drawing

Snapping is viewer.md Part 4's, unchanged: the priority order, the 8 px tolerance and the glyph
shapes. A placed point keeps the snap's source keys (`data-source`) and wears I-387's basis mark,
R-UI-002's own pair at 10 px, centred on the point:
- MEASURED is ◆ in `--basis-measured`;
- ENTERED is ✎ in `--basis-entered`;
- INTERPRETED is ▦ in `--basis-interpreted`.

Each mark has a 1 px `--canvas-paper` halo. None of the three is a shape the snap glyphs wear (a
hollow square, a triangle, ✕, ⊥, a crossed circle, an hourglass) or the pick's ✛, so a placed point
is never read as a live snap.

The draft paint:
- the outline is 2 px `--canvas-measure`;
- the fill is `--canvas-measure` at 12 %, mixed at paint time (the canvas palette is semantic,
  R-UI-086);
- cut-out rings are 2 px dashed `--canvas-measure`, knocked out of the fill;
- the live segment is 1 px dashed `--canvas-measure` from the last point to the live point.

With a tool armed, every view with no scale of record is hatched (the partition overlay's untyped
hatch idiom, in `--warn`). Over a hatched view the pointer is `not-allowed`, a click places nothing,
and the status cell names why. The hatch is the views overlay's own (I-498).

The reticle: while a tool is armed, four 4 px ticks (`--space-1`, 1 px wide, in `--canvas-measure`
on a 1 px `--canvas-paper` halo) stand around the live point in a `--space-4` box. The live point is
where the next click lands: snapped, and constrained where Shift, Ortho or Angle hold. That is not
always where the hand is, so the reticle shows it. Over an unscaled view the ticks turn `--warn`. The
reticle draws in over `--motion-reticle`; the OS cursor is `crosshair`.

### 2.4 The running figure

A DOM label (`measure-live-figure`, `pointer-events: none`, `aria-hidden`) sits 12 px right of and
below the live point, clamped inside the stage. It is 12 px mono, on `--surface-overlay` with
`--hairline` and radius 4, and it holds:
- **Linear:** `L 20.672 m` (total), then `+ 4.267 m` (the live segment).
- **Area:** `A 328.838 m²` once three points stand; before that, the live segment.
- **Count:** `N 7`.

Figures are SI from the view's calibration (componentwise, I-146), rounded half-even to 3 decimals by
the caller and grouped by `formatUserFigure`. On an uncalibrated view the label shows drawing units
only, with `measure_figure_uncalibrated`. On a paper sheet the figure is carried through the one
viewport it stands in; across windows, or under a QS two-point factor, it stays in sheet units with
`measure_figure_windowed` or `measure_figure_unrecorded` (I-501).

The status line gains the **measure cell** (`viewer-status-measure`) after the distance cell:
`Area · 75 CC blinding under SOG · 5 points · 328.838 m²`. The label and figure repeat for a reader
who is not looking at the pointer. After Confirm the cell reads `measure_status_recorded` until the
next point is placed (S6), so the commit is said on the sheet before the sheet's list exists (S7).

With no condition picked (I-497) the cell reads `Area · 5 points · A 328.838 m²`
(`measure_status_tool`; `measure_status_tool_one` for one point). After a finish it adds
`measure_status_unrecorded`. It repeats the grammar's refusals, `finish first`, `too few`,
`degenerate`, `repeated`, the cut-out's and Alt+click's, as a muted note, and it states §3's reason
where one holds. The cell stands while a tool is armed, and while the tools stand disabled; in Select
and Pan with the tools usable it is absent, so the readout a reader already knows does not change.
The cell's figure is the placed shape's. The label's is the live one: the cell does not follow the
pointer (PB-3).

A Linear run letters each placed segment's length at its midpoint on the canvas, in the distance
cell's own words (`{metres} m`, or `{distance} drawing units` with no scale of record), 12 px mono on
a paper halo.

### 2.5 The card

Anatomy is in the wireframe above. Placement:
- the card goes on the side of the closing point with the most room: right, then left, below, above;
- it is clamped inside the stage with `--space-3` inset and never covers the closing point;
- a 1 px `--canvas-measure` leader joins its nearest corner to the point when the two are more than
  24 px apart;
- width 320 (288–360);
- its body scrolls inside a max height of min(60 % of the stage, 440 px), and the footer stays
  visible.

Content, top to bottom:
1. The act overline (DLG-1's words for the act).
2. The condition line: the swatch and name, then the class, kind, level Combobox (I-377) and the
   sheet number.
3. The readings: one row per attribute the recipe binds (`t 75 mm`), with its `BasisChip` and its
   source, and a Select where the drawing offers a reading (below).
4. The book rows (I-391), each cut-out with its role Select (Opening · Column or wall, I-389).
5. The Net per kind: `QuantityText`, a `BasisChip` for the quantity basis, and the coverage.
6. The formula: the gate's template, filled with live variables.
7. The scale: the view's two factors in metres per drawing unit (as data in the arm's payload, in the
   scale tab's own words) and the calibration key IdChip.
8. The one-line scope note (I-390).
9. The interpreted note, only when the basis is INTERPRETED.
10. The replaces note, only on an edit.
11. The digest, behind DLG-1's disclosure.
12. The footer: **Cut out X** (secondary; Area only) · **Cancel** · **Confirm ⌘↵** (the act variant,
    the one copper dot).

While the preview is pending, skeletons keep this shape (the pattern's own, §1 of
consequence-dialog.md).

**Readings from the drawing.** The card is modal (I-373), so it takes nothing by a click on the sheet
behind it. Instead, for each attribute the recipe binds, the preview offers the notes of the ring's
view that state it: the TEXT and MTEXT entities assigned to that view, read by the one notation
resolver. On S-08 that is 828, "75 THK BLINDING UNDER (EXPLODED OUTLINE)" → t 75 mm. The reading's
Select holds the condition's value (ENTERED, the default) and each offered note (TRANSCRIBED, citing
the note's source key). Picking a note re-previews the card. Where a note and the condition
disagree, both stand in the Select with their figures, and the QS picks; nothing picks silently.
A view with no such note offers only the condition's value, and the Select renders as plain text.
S6 builds this.

### 2.6 The chest (drawer › Conditions, S5)

The group heading "Conditions" has a count and a ghost IconButton **New condition** (+). The rows
are 28 px:
- a 12 px swatch (colour + hatch);
- the name (ellipsis, tooltip whole);
- the hotkey in a Kbd (1–9): the condition's place in the chest (I-573);
- the running total per kind for this campaign, mono and right-aligned, measured scope only (PARTIAL
  never totalled, L-QTY-07): the sum of the campaign's COMPLETE lines of the standing measurements
  that cite the condition, "—" where there is none, and "{n} measured in this campaign, {m} billed" in
  its tooltip (I-575).

The picked condition wears the selection idiom (a 3 px inset `--line-accent` bar on
`--surface-selected`, the aliases the rule `cubit/no-primitive-token` admits). A click picks it and
arms its tool. Under a shape in progress the pick changes nothing and the measure region says
"finish or discard first" (I-372). Without MEASURE a click picks nothing, because nothing would arm.
While a condition is picked, the measure cell reads `measure_status_drawing` (tool · condition ·
points).

The chest is the drawer's first group, above Layers (§1's fixed order), at most 40 % of the drawer's
height, scrolling inside itself. It is read once the sheet is a manifest (R-UI-043). Reading it is a
participant's read, whatever the role; whether the reader may change it is the one guard's answer to
MEASURE, carried with the chest (`canAuthor`).

**New condition** opens a Popover (320 wide) anchored to the button, holding:
- **Name**;
- **Measured as** (Select: Area · Length · Count); a shape `MANUAL_RULES` pairs with nothing yet says
  `measure_condition_none_offered`, and Save stays disabled;
- **Class** (Select over the classes `MANUAL_RULES` pairs with that geometry, I-539; a Select, not a
  Combobox, while the roster holds one class per geometry);
- **Kinds** (checkboxes over the kinds it pairs with that geometry and class);
- one NumberInput plus unit Select per variable the paired rules take from the recipe (for blinding:
  **Thickness**, mm), the units those of the variable's dimension;
- **Colour** (eight swatches, opening at the class's own);
- **Hatch** (six);
- **Hotkey**: the digit the new condition will answer to, shown, not chosen (I-573).

Its footer is Cancel and **Save condition** (primary, not copper: saving a condition is not an act,
I-374). A refusal (§5's `CONDITION_*`) renders as the one RefusalState inside the popover, which stays
open so the QS can correct it. A condition saved is picked and its tool armed: the QS authored it to
measure with it. A row's menu (⋯) offers Remove from chest; Edit is owed (§14). A condition cited by
measurements stays readable in the book by its snapshot.

### 2.7 The sheet's list (drawer › Measured on this sheet)

Rows are grouped by condition. The group row carries the swatch, the name and the per-kind subtotal.
A child row per measurement shows its figure and its state: pending, published, waiting for
agreement, or not billed with the reason.

A click selects the measurement on the canvas, flies to it (`--motion-flyto`) and opens the inspector
on it. The inspector (S7) shows:
- the book rows;
- the lines with their EvidenceLinks;
- the basis;
- the act (who, when);
- **Edit**: re-opens the shape as a draft for a superseding act (I-379);
- **Delete**: REPUDIATE through its ConsequenceDialog.

### 2.8 Committed paint and the legend chip

A standing measurement paints on VD-4's quantity canvas in its condition's colour: fill at 20 % plus
the condition's hatch in 1 px, and a 1.5 px outline. The quantity basis glyph (R-UI-002) sits at the
ring's least point. A measurement waiting for agreement has a dashed outline; one refused by the gate
is hatched in `--warn` with its reason on hover. The selected one has a 2 px `--canvas-selection`
outline.

The legend is VD-4's (viewer.md Part 6), its one home, keyed by condition, with rail classes read as
conditions. S8 adds hand conditions to it. A legend chip reads: swatch · condition name · count ·
total per kind, labelled measured scope.

### 2.9 Keyboard and accessibility (R-UI-060)

Every tool is reachable by its key and by the tool row (Tab order: the row, then the drawer, then the
canvas). A measurement can be made without a pointer (the keyboard cursor, §2.2). The card is a
dialog with its title, a focus trap and Escape.

Announcements go through the hidden `role="status"` line: a point placed (with its basis), a shape
finished, a draft kept or discarded. That is at most one utterance per gesture, never per pointer
move.

The basis is shape plus colour, a condition is colour plus hatch, and a hatched view is pattern plus
words. Nothing means by colour alone.

### 2.10 The measurement book (Takeoff › Measurements, S7)

This is Direction §3.2's grid template, and it follows the grid law (R-UI-083).

Columns:
- **Item** (frozen: the condition name on group rows; on child rows, gross (traced), Less: cut-out,
  Less: {members} (register) and Net);
- Sheet (its number, an EvidenceLink to the ring);
- Level;
- No, L, B, D (mono, right, exact, I-391);
- Qty (the kind's precision);
- Unit;
- Basis (`BasisChip`);
- Scale (the view's calibration key through IdChip, its factors in the tooltip; R-TO-043 names
  calibration among the list's columns);
- Measured by;
- On (`DD MMM YYYY`).

Group rows carry the per-kind Net and the footer carries per-unit totals (B-07).

Filter chips: Condition, Sheet, Level, Basis. Bulk re-assignment of a condition is an offered group
(R-UI-023): "Re-assign the 4 measurements of '75 CC blinding under SOG' on S-08 to …". **Export** is
XLSX through the export seam. Editing a number or deleting a row opens the ConsequenceDialog,
centred (the book is not the canvas), for the superseding act or REPUDIATE.

### 2.11 Server doors (named here so the test hooks have a home)

These are written by their slices through `serverCall`/`routeHandler`, each with a live-database
refusal test (CLAUDE.md, Architecture):
- `takeoffManual.preview`, `takeoffManual.commit` and `takeoffManual.sheetMeasurements`
  (`src/server/routers/takeoff-manual.ts`, S1, S3, S6). S1's two take `{ input }` and
  `{ input, consequenceDigest }`, where `input` is `{ projectId, drawingId, layoutName, viewKey,
  recipe, level, geometry, replaces }` and each point is `{ x, y, cites }`, the world point and the
  source keys it was snapped on. Both authorise with MEASURE and bind the drawing to the project
  (R-SPINE-004). The commit answers `{ actId, objectKey, measure }`, where `measure` is the answer of
  the campaign's measure request it makes after the act commits (I-587);
- `takeoffConditions.list`, `.author` and `.retire` (`takeoff-conditions.ts`, S5). `list` takes
  `{ projectId }` and answers `{ conditions, catalogue, canAuthor }`; `author` takes
  `{ projectId, condition: { name, geometry, elementClass, kinds, readings, colour, hatch } }`, each
  reading `{ attribute, valueAsWritten, unitAsWritten }`, and answers `{ conditionId }`; `retire` takes
  `{ projectId, conditionId }`. The viewer route answers the same three through its server actions
  (`measure-actions.ts`: `readConditionChest`, `authorConditionInChest`, `retireConditionFromChest`),
  over the same three resolutions the lane exports, so the chest has one door per question. The live
  refusal tests are `tests/takeoff/manual/conditions.db.test.ts`;
- `takeoffManual.book` and the XLSX export (S7).

---

## 3. States (R-UI-050), cell by cell

S-Measure's cells are written into `VIEWER_STATES` (the viewer route's one enumerable home). The book's
seven are a new entry for the Takeoff › Measurements route in `src/ui/screen-states/matrix.tsx`
(S7). No screen-local refusal block exists anywhere (R-UI-020, B-17).

| State | Where | What renders | Copy | Test id |
|---|---|---|---|---|
| loading | chest, list | 3 row bones each, header real; the tool row is local state and operable once the stage and the conditions answer | — | `measure-chest[data-state=loading]`, `measure-list[data-state=loading]` |
| loading | card | the pattern's skeletons in the card's shape; no Confirm in the DOM | — | `consequence-dialog[aria-busy=true]` |
| loading | book | header real, bones for rows | — | `measurements-grid` |
| empty | chest | `EmptyState`: title, one sentence that teaches, one action | `measure_chest_empty_title`, `_body`, `_action` | `measure-chest[data-state=empty]` |
| empty | list | one line | `measure_list_empty` | `measure-list[data-state=empty]` |
| empty | book | `EmptyState` + Open the drawings | `measurements_empty_title`, `_body`, `_action` | `measurements-empty` |
| error | chest, list | the read's fault in place: the sentence, a retry and the report id, compact in the drawer (the scale panel's failed cell, not the full-size `ErrorState`, which a 200 px group cannot hold); the sheet stays | `measure_chest_read_failed` (chest), `measure_read_failed` (list), `measure_retry`, `measure_read_report` | `measure-chest-retry`, `measure-list-retry` |
| error | card | a preview or commit fault that is not a refusal (I-40): the card's own boundary renders `ErrorState` in the card's body with retry (re-previews) and the report id; no Confirm; the outline stays on the sheet (I-373) | `measure_card_failed`, `measure_retry` | `measure-card-retry` inside `consequence-dialog` |
| error | book, head | the root error boundary (its own Decision) | — | — |
| refusal | card | the one RefusalState in the card's slot. A preview refusal unmounts Confirm (I-41); a commit refusal keeps it (I-44); a stale digest re-renders | registry-owned (§5) | `refusal-state` inside `consequence-dialog` |
| refusal | tool row | the preconditions, said before the first click: the tools are disabled with the reason in the tooltip and in the measure cell | `measure_tools_*` (§4) | `viewer-tool-area[disabled]`, `viewer-status-measure[data-reason]` |
| refusal | book | `MEASUREMENTS_NO_CAMPAIGN` through RefusalState in the grid's place | registry-owned | `refusal-state` |
| partial | canvas | views with no scale of record are hatched while a tool is armed; the rest measure | `measure_view_unscaled` | `viewer-status-measure[data-reason=unscaled]` |
| partial | list, book | a measurement whose line is queued (INTERPRETED) or refused keeps its row with the state and reason; shown, never hidden | `measure_list_queued`, `measure_list_refused` | `measure-list-row[data-state]` |
| partial | card | opening cut-outs at or under the threshold are listed, not deducted; a snapped point the door could not reproduce shows its demoted basis (I-387) | `consequence_dialog_measurement_below_threshold`, `consequence_dialog_measurement_demoted` | `consequence-measurement-row[data-role=ignored]`, `consequence-measurement-row[data-role=gross][data-basis]` |
| offline | canvas, card | drawing stays local; Enter on a finished shape opens no card; the draft stays and an alert line says why; Confirm resumes when the connection returns | `measure_offline` | `viewer-status-measure[data-reason=offline]` |
| offline | book | read-only; Edit, Delete and Export say why | `measure_offline_book` | — |
| permission-denied | tool row, chest | without MEASURE the tools are disabled with the reason; the chest and list are read-only (no New, no Edit, no Delete). The workspace denial stays delegated to `t/[tenant]/layout.tsx` | `measure_tools_permission` | `measure-chest[data-state=readonly]` |

The preconditions, in the order checked (the first that holds is said):
1. offline;
2. MEASURE not held;
3. no open campaign;
4. sheet not in the pinned set;
5. discipline unconfirmed;
6. raster content before M4P-6;
7. the view under the pointer unscaled.

Each renders as `data-reason` on the measure cell: `offline` · `permission` · `no-campaign` ·
`not-pinned` · `discipline` · `raster` · `unscaled`. Reasons 2–6 disable the measure group and put the
sentence in each tool's tooltip. Reason 7 disables only the hatched view under the pointer. Offline
(1) disables nothing: the reader may draw, and only Confirm waits for the connection.

S4 renders reasons 1, 2 and 7. Reasons 3–5 are refused by name at the card's preview until their read
stands in the route, and reason 6 has no content to meet before M4P-6 (I-497).

---

## 4. Copy, verbatim

Homes:
- `src/ui/strings/measure.ts` (exists: `job_step_measure`; S4, S5, S6 and S7 append their blocks);
- `src/ui/strings/viewer.ts` for the tool row's tooltips (S4);
- `src/ui/strings/shortcuts.ts` for the roster lines I-372 adds (S4, S5);
- `src/ui/strings/consequence-dialog.ts` for the card's MEASUREMENT arm (`consequence_dialog_measurement_*`,
  I-45: an arm's words are the pattern's).

Voice: the QS's words, calm, no exclamation marks. Figures and units come through the format seam,
never through the string.

**Tool row and menu (viewer.ts, measure.ts).**
`viewer_tool_measure_menu` **More measure tools** · `measure_tool_rectangle` **Rectangle** ·
`measure_tool_cutout` **Cut out** · `measure_tool_perimeter` **Perimeter** · `measure_tool_volume`
**Volume** · `measure_tool_typical` **Typical ×n** · `measure_tool_pitch` **Pitch multiplier** ·
`measure_tool_layer_region` **Select on layer in region** · `measure_tool_fill` **Fill a closed
region** · `measure_tool_freehand` **Freehand** ·
`measure_tool_not_yet` **Arrives with the rest of the manual toolset** ·
`measure_tools_offline` **You are offline. You can draw, and confirm when the connection returns.** ·
`measure_tools_permission` **Measuring needs the Measure permission. A project principal can give you a
role that carries it.** · `measure_tools_no_campaign` **Measuring needs an open campaign. Pin the
drawing set in Takeoff to open one.** · `measure_tools_not_pinned` **This sheet is not in the
campaign's pinned drawing set, so nothing measured on it could be billed.** ·
`measure_tools_discipline` **Confirm this sheet's discipline before measuring on it.** ·
`measure_tools_raster` **Measuring on scanned content arrives with the raster lane.**

**Stage, status and announcements (measure.ts).**
`viewer_status_measure` **Measure** · `measure_status_pick` **Pick a condition to measure with** ·
`measure_status_pick_in_select` **Distances are picked in Select: press V, then Alt+click.** ·
`measure_status_drawing` **{tool} · {condition} · {points} points** · `measure_status_finish_first`
**Finish or discard this outline first (Enter or Escape)** · `measure_status_cutout_outside` **A
cut-out must stand inside the outline and clear of the other cut-outs** · `measure_view_unscaled`
**This view has no scale of record. Affirm its scale in the Scale tab, then measure here.** ·
`measure_view_no_scope` **Schedules, notes and title blocks draw nothing to measure.** ·
`measure_figure_uncalibrated` **drawing units: this view has no scale of record** ·
`measure_point_placed` **Point {n} placed, {basis}.** · `measure_shape_finished` **{tool} finished:
{figure}.** · `measure_draft_kept` **Nothing was committed. Your outline is still on the sheet: press
Enter to open it again, or Escape to discard it.** · `measure_draft_discarded` **Measurement
discarded.** · `measure_offline` **You are offline, so nothing can be confirmed. Your outline stays on
the sheet until the connection returns.** · `measure_read_failed` **The measurements could not be
read.** · `measure_retry` **Try again** · `measure_status_recorded` **Recorded. Adding to the
register.** · `measure_card_failed` **This measurement could not be checked, and nothing was
recorded. Your outline is still on the sheet.**

**The armed tools' figure and the grammar's other notes (measure.ts, S4; I-497, I-499).**
`measure_figure_windowed` **sheet units: this shape does not stand inside one viewport** (I-501) ·
`measure_figure_unrecorded` **sheet units: a two-point scale is not carried through a viewport**
(I-501) · the distance cell's `viewer_status_distance_windowed` **Not inside one viewport** and
`viewer_status_distance_unrecorded` **Two-point scale not carried through a viewport** (viewer-snap.ts) ·
`measure_status_tool` **{tool} · {points} points** · `measure_status_tool_one` **{tool} · 1 point** ·
`measure_status_unrecorded` **Measured, not recorded: no condition is picked.** ·
`measure_status_too_few` **{tool} needs {count} points before it can be finished.** ·
`measure_status_degenerate` **This outline encloses nothing: it crosses itself, or its points stand
in one line.** · `measure_status_repeated` **A point already stands there.** ·
`measure_figure_length` **L {value} m** · `measure_figure_area` **A {value} m²** ·
`measure_figure_segment` **+ {value} m** · `measure_figure_count` **N {value}** ·
`measure_figure_length_units` **L {value}** · `measure_figure_area_units` **A {value}** ·
`measure_figure_segment_units` **+ {value}** · `measure_point_removed` **Last point removed.** ·
`measure_shape_reopened` **Open again: add points, or press Enter to close it.** ·
`measure_cutout_started` **Cutting out: place the cut-out's points inside the outline, then press
Enter.** · `measure_cutout_finished` **Cut out: {figure} remains.** · `measure_cutout_discarded`
**Cut-out discarded. The outline stands.** · `measure_canvas_keys` **L, A and C arm Linear, Area and
Count. Space places a point at the cursor the arrow keys move, Enter finishes, Backspace removes the
last point, X cuts out and Escape discards.** (the keys line the canvas points at, beside the
camera's and the snapping region's). A Linear segment's length on the canvas reuses the distance
cell's `viewer_status_distance_metres` and `viewer_status_distance_units`.

**Shortcut labels (shortcuts.ts, the ? sheet and ⌘K).** `shortcut_viewer_condition` **Pick a condition
(1 to 9)** · `shortcut_viewer_measure_cutout` **Cut out** · `shortcut_viewer_measure_finish` **Finish
the outline** · `shortcut_viewer_measure_undo` **Remove the last point** ·
`shortcut_viewer_measure_point` **Place a point at the keyboard cursor** ·
`shortcut_viewer_measure_confirm` **Confirm the measurement**

**The card (consequence-dialog.ts, the MEASUREMENT arm).**
`act_record_manual_measurement` **Record a hand measurement** (DLG-1's act words; the key is spelled
in whatever table DLG-1 gives the act words, this is its sentence) ·
`consequence_dialog_measurement_readings` **Readings** ·
`consequence_dialog_measurement_reading_condition` **From the condition** ·
`consequence_dialog_measurement_reading_note` **From the note "{note}"** ·
`consequence_dialog_measurement_role_opening` **Opening** ·
`consequence_dialog_measurement_role_member` **Column or wall** ·
`consequence_dialog_measurement_demoted` **{count} points did not sit on the drawing where they were
snapped, so they count as placed by hand.** ·
`consequence_dialog_measurement_condition` **Condition** · `consequence_dialog_measurement_level`
**Level** · `consequence_dialog_measurement_sheet` **Measured on** ·
`consequence_dialog_measurement_gross_area` **traced outline** ·
`consequence_dialog_measurement_gross_run` **traced run** · `consequence_dialog_measurement_less`
**Less:** · `consequence_dialog_measurement_less_register` **{count} {members} (register)** ·
`consequence_dialog_measurement_net` **Net** · `consequence_dialog_measurement_formula` **Formula** ·
`consequence_dialog_measurement_scale` **Scale** · `consequence_dialog_measurement_scope` **Counts what
you traced and nothing else on {level}.** · `consequence_dialog_measurement_interpreted` **Traced on a
scan: this waits for a second reading and is billed only once agreed.** ·
`consequence_dialog_measurement_replaces` **Replaces {previous}, which leaves the bill.** ·
`consequence_dialog_measurement_below_threshold` **{count} cut-outs of {threshold} m² or less are not
deducted, by rule.** · `consequence_dialog_measurement_cutout` **Cut out** ·
`consequence_dialog_measurement_foundation` **Foundation**

**Chest (measure.ts).**
`measure_chest_heading` **Conditions** · `measure_chest_new` **New condition** ·
`measure_chest_empty_title` **No conditions yet** · `measure_chest_empty_body` **A condition is what you
measure: a name, a class, a kind and its sizes. 75 CC blinding under SOG is a slab blinded 75 mm
thick.** · `measure_chest_empty_action` **New condition** · `measure_chest_readonly` **Read-only: your
role does not carry the Measure permission.** · `measure_condition_name` **Name** ·
`measure_condition_geometry` **Measured as** · `measure_condition_geometry_area` **Area** ·
`measure_condition_geometry_length` **Length** · `measure_condition_geometry_count` **Count** ·
`measure_condition_class` **Class** · `measure_condition_kinds` **Kinds** · `measure_condition_colour`
**Colour** · `measure_condition_hatch` **Hatch** · `measure_condition_hotkey` **Hotkey** ·
`measure_condition_save` **Save condition** · `measure_condition_cancel` **Cancel** ·
`measure_condition_edit` **Edit** (owed with Edit, §14) · `measure_condition_retire` **Remove from
chest** · `measure_chest_row_label` **{condition}: pick it and arm {tool}** · `measure_chest_row_menu`
**More for {condition}** · `measure_chest_total_none` **—** · `measure_chest_total_label` **{measured}
measured in this campaign, {billed} billed** · `measure_chest_read_failed` **The conditions could not
be read.** · `measure_read_report` **Report {id}** · `measure_condition_none_offered` **Nothing is
measured by hand this way yet.** · `measure_condition_reading_t` **Thickness** ·
`measure_condition_reading_unit` **{reading} unit** · `measure_condition_hatch_solid` **Solid tint** ·
`measure_condition_hatch_diagonal` **Diagonal** · `measure_condition_hatch_cross` **Cross** ·
`measure_condition_hatch_dots` **Dots** · `measure_condition_hatch_horizontal` **Horizontal** ·
`measure_condition_hatch_vertical` **Vertical** · `measure_condition_hotkey_none` **None: the digits
pick the chest's first nine** · `measure_status_condition_pending` **Measured under {condition}.
Confirming a measurement arrives with its card; nothing is recorded yet.** (S5, until S6's card
records it; I-497's `measure_status_unrecorded` stays the sentence with no condition picked)

**Sheet list (measure.ts).**
`measure_list_heading` **Measured on this sheet** · `measure_list_empty` **Nothing measured on this sheet
yet. Pick a condition and draw.** · `measure_list_pending` **Adding to the register** ·
`measure_list_queued` **Waiting for agreement** · `measure_list_refused` **Not billed: {reason}** ·
`measure_edit` **Edit** · `measure_delete` **Delete**

**The book (measure.ts; the tab label in the takeoff lane's table).**
`takeoff_nav_measurements` **Measurements** · `measurements_empty_title` **No hand measurements in this
campaign** · `measurements_empty_body` **Open a sheet, pick a condition and measure it. Each
measurement lands here as a line of the measurement book.** · `measurements_empty_action` **Open the
drawings** · `measurements_col_item` **Item** · `measurements_col_sheet` **Sheet** ·
`measurements_col_level` **Level** · `measurements_col_no` **No** · `measurements_col_l` **L** ·
`measurements_col_b` **B** · `measurements_col_d` **D** · `measurements_col_qty` **Qty** ·
`measurements_col_unit` **Unit** · `measurements_col_basis` **Basis** · `measurements_col_by`
**Measured by** · `measurements_col_on` **On** · `measurements_export` **Export XLSX** ·
`measure_offline_book` **You are offline. The book is read-only until the connection returns.**

---

## 5. Refusals (proposed registry entries, `src/core/errors/manual.ts` unless named)

The message and remedy are the registry's (R-SPINE-062): static sentences, with no placeholders, as
every registered entry is. The one RefusalState renders them. The specifics (which measurement, which
view, which members) travel in the refusal's evidence link, which the door fills (I-40). Each code
enters `tests/refusal-register` exercised or deferred by name (Q-07). S1 registers the preview's codes,
S3 the gate's, S5 the chest's and S7 the book's. The integrator merges the aggregate digest.

Severity and surface (`RefusalSeverity`, `RefusalSurface`, `src/core/errors/law.ts`): every `MANUAL_*`
code is `warning` on `dialog` (it answers inside the card); `CELL_MEASURED_BY_HAND` is `info` on
`inline`, because it explains why a machine line is absent; the four `CONDITION_*` codes are `warning`
on `inline` (the chest's popover); `MEASUREMENTS_NO_CAMPAIGN` is `info` on `inline`.

| Code | Message | Remedy | Evidence link |
|---|---|---|---|
| `MANUAL_NO_CAMPAIGN` | No campaign is open on this project, so a measurement has no drawing-set revision to stand in. | Pin the drawing set in Takeoff to open a campaign, then measure. | the Takeoff register |
| `MANUAL_SHEET_NOT_PINNED` | This sheet is not in the campaign's pinned drawing set, so a measurement on it could never be billed. | Open the sheet from the pinned set, or pin a set that includes it. | the drawing set |
| `MANUAL_DISCIPLINE_UNCONFIRMED` | Nobody has confirmed this sheet's discipline, and a sheet whose discipline is unconfirmed is not measured. | Confirm the sheet's discipline on the Drawings screen, then measure. | the drawing's card |
| `MANUAL_KIND_NOT_THIS_DISCIPLINE` | This kind is measured off another discipline's drawings, so it cannot be measured on this sheet. | Measure it on a sheet of the discipline that states it. | the Drawings screen, filtered to that discipline |
| `MANUAL_VIEW_DRAWS_NO_SCOPE` | Schedules, notes and title blocks draw nothing that can be measured. | Measure on a plan, section or detail of the scope. | — (the view is under the pointer) |
| `MANUAL_RING_OFF_VIEW` | The outline's points stand in more than one view, or in none, so it has no single view to be measured on. | Keep every point inside one view of the sheet. | — |
| `MANUAL_GEOMETRY_DEGENERATE` | The outline encloses nothing measurable: it crosses itself, has too few distinct points, or a cut-out stands outside it or over another cut-out. | Redraw it with points that enclose the scope once, and cut-outs inside it. | — |
| `MANUAL_LEVEL_UNSTATED` | This measurement stands on no level, and a quantity with no level cannot be billed by floor. | Pick the level on the card, or add the level to the stack first. | the level stack |
| `MANUAL_UNIT_NOT_CONVERTIBLE` | This view is not drawn full size in a length unit the bill converts yet, so a hand figure here would be billed at the wrong size. | Measure on a sheet drawn full size in millimetres, metres or feet. | the view's Scale tab |
| `MANUAL_OVERLAP` | This outline overlaps a measurement already standing under this class and kind on this level. | Trim the outline to the ground the other does not cover, or edit the other. | the other measurement, selected |
| `MANUAL_CELL_OTHER_VIEW` | This class and kind on this level is already measured by hand on another view, and the two cannot be shown to cover different ground. | Measure this class and kind on this level on one sheet only. | the other view's measurement |
| `MANUAL_CELL_MACHINE_MEASURED` | The product already measures this class and kind on this level, so a hand measurement there would count the same scope twice. | Measure a class, kind or level the product does not, or repudiate its objects here first. | the register, filtered to the cell |
| `MANUAL_PREDECESSOR_NOT_STANDING` | The measurement this edit replaces no longer stands: it was deleted or already replaced. | Open the measurement that stands now and edit that one. | the measurement that stands now |
| `MANUAL_CONDITION_NOT_STANDING` (S1, on review) | The condition this measurement applies is not in this project's chest: it was retired, or it belongs to another project. | Pick a condition that stands in this project's chest, then measure. | the condition chest |
| `MANUAL_JUNCTION_UNPROVEN` | The register holds columns or walls on this level that this sheet cannot place, so the outline may hold them without deducting them. | Measure on a sheet whose grid ties to the columns' sheet. | the register's columns and walls on the level |
| `CELL_MEASURED_BY_HAND` (gate, `errors/gate.ts`) | A quantity surveyor measured this class and kind on this level by hand, so the product's own reading was not published. | Keep the hand measurements, or delete them to let the product's reading publish on the next run. | the measurement book, filtered to the cell |
| `CONDITION_NAME_TAKEN` (S5) | Another condition in this project already has this name. | Choose a name that tells the two apart. | the other condition |
| `CONDITION_KIND_NOT_BORNE` (S5) | The chosen class does not bear this kind, so the condition would measure nothing billable. | Choose a kind the class bears, or another class. | — |
| `CONDITION_KIND_NOT_OFFERED` (S5, I-574) | No hand-measurement method measures this kind from this shape yet, so the condition would measure nothing billable. | Choose one of the kinds the condition form offers for this shape and class. | — |
| `CONDITION_NOT_IN_CHEST` (S5, I-574) | This condition is not in this project's chest: it was already removed, or it belongs to another project. | Reload the chest and pick a condition that stands in it. | the condition chest |
| `MEASUREMENTS_NO_CAMPAIGN` (S7) | No campaign is open on this project, so there is no measurement book. | Pin the drawing set in Takeoff, then measure a sheet. | the Takeoff register |

Reused, unchanged:
- `VIEW_SCALE_UNAFFIRMED`, `DUPLICATE_IDENTITY`, `METHOD_NOT_IN_EDITION`, `CONSEQUENCES_NOT_CARRIED`,
  `ACT_CHANGES_NOTHING` and `PERMISSION_NOT_HELD`;
- `PARTITION_NOT_AVAILABLE` for a drawing with no ingest record, or a view its partition does not
  hold, and `READING_NOT_NUMERIC` for a recipe reading that states no number;
- `REQUEST_MALFORMED` for a malformed statement at the door. A recipe whose class does not bear one
  of its kinds is malformed there, because the chest refuses such a condition at authoring (S5,
  `CONDITION_KIND_NOT_BORNE`), and so is a trace whose geometry is not the recipe's.

S1 registers every `MANUAL_*` code above except `MANUAL_JUNCTION_UNPROVEN`, thirteen in all. S3
registers that one with the junction channel that raises it (I-389, I-586), and the gate's
`CELL_MEASURED_BY_HAND` (I-589).

`VIEW_SCALE_UNAFFIRMED`'s registered message speaks of "members". The unscaled view is said before
the first click (§3), so a hand measurer meets that message only from a stale view. Re-wording it for
both readers is an IOU for its owner (§14).

---

## 6. Motion (R-UI-004)

- The card enters with the Dialog primitive's own fade and 0.98 → 1 scale over `--motion-state`
  `--ease`, and exits instantly.
- A placed point, the closing edge and the fill appear with no tween: a measurement is placed, not
  animated.
- On Confirm, the draft's paint goes to the condition's paint over `--motion-state`.
- A list row click flies the camera with `--motion-flyto` `--ease-flyto` and pulses the ring in its
  basis colour (the Trace's pulse, viewer.md Part 2).
- Skeletons pulse in their one home. The reticle draws in `--motion-reticle`.
- Reduced motion zeroes every duration at the source. Nothing bounces.

## 7. Tokens

- Canvas: `--canvas-measure` (draft, cut-outs, leader) · `--canvas-snap` (glyphs, viewer.md) ·
  `--canvas-selection` · `--canvas-paper` (halos) · `--canvas-pulse`.
- Basis: `--basis-measured`, `--basis-transcribed`, `--basis-derived`, `--basis-entered`,
  `--basis-interpreted` (point marks, chips).
- Element palette (condition colours): `--element-*`.
- `--warn` (unscaled hatch, refused paint) · `--surface-overlay` (card, live figure; glass is an
  overlay's privilege, `--glass-alpha`/`--glass-blur`) · `--hairline` (the 1 px seam, a whole border
  value) · `--surface-selected` + `--line-accent` (the picked condition) · the armed tool's underline
  is the pressed IconButton's own (`--line-accent` inset 2 px, `--ink-link` icon; `core.css`), never a
  second spelling.
- Text: `--ink` (primary), `--ink-secondary` (values), `--ink-muted` (labels, captions).
- `--space-1…5` · `--radius-2/4` · `--text-12/13` · `--font-mono`/`--font-ui` ·
  `--weight-body-medium`/`--weight-heading`.
- `--motion-state`/`--motion-flyto`/`--motion-reticle`/`--ease`/`--ease-flyto` · `--z-overlay` (card).
- No `--graphite-*` or `--beam-*` primitive appears in any S-Measure stylesheet or component: the lint
  rule `cubit/no-primitive-token` refuses them outside the token source (R-UI-086).

Px literals, closed set: 10 px basis glyphs on placed points, 12 px swatches, 12 px figure offset,
24 px leader threshold, 4 px drag tolerance, the 3 px selection bar, and the card's 320/288/360/440.
The canvas strokes §2.3 names join it: the 2 px outline and cut-out, the 1 px live segment and
halos, and the two dashes, 6–4 for a cut-out (the views overlay's own) and 4–3 for the live segment.
Anything else is a defect.

## 8. Themes

No `[data-theme]` selector in any S-Measure stylesheet. Canvas colours are read from computed tokens
at paint time (the pulse's precedent, `use-reveal`), so both themes paint from one scene. The fills'
percentages hold in both themes because they mix a token's own value.

Contrast:
- the live figure and the card's text reach ≥ 4.5:1 on `--surface-overlay` in both themes;
- the draft outline reaches ≥ 3:1 on `--canvas-paper` in both: `--canvas-measure` #C13515 on #FCFCFB
  is 5.40:1, and #FF7A4D on #101216 is 7.27:1;
- the placed points' basis glyphs on `--canvas-paper` (WCAG relative luminance, computed from
  `tokens.css` this session): light ◆ 5.07, ✎ 4.96, ▦ 6.20; dark ◆ 8.91, ✎ 9.51, ▦ 6.71, all above
  the 3:1 a graphical object needs;
- copper appears once, on Confirm.

## 9. Test hooks (closed contract, C-05)

**Routes:**
- `/t/{tenant}/p/{project}/viewer/{drawing}/{layout}` (unchanged; `?s=act:<actId>` selects a hand
  measurement once the Trace resolves `act:` keys, VD-1/S6);
- `/t/{tenant}/p/{project}/takeoff/measurements` (new; `?m=<objectKey>` focuses a row, the
  register's `?line=` idiom).

Crumbs: workspace › project › Takeoff › Measurements (S7, `routes.ts`).

**Test ids.** Registered in `src/ui/testids.ts` by the slice that builds each element, in one
contiguous `measure` group plus the named existing groups; the integrator merges them.
- Tool row (`viewer` group): `viewer-tool-linear`, `viewer-tool-area`, `viewer-tool-count` (exist;
  now `aria-pressed`) · `viewer-tool-measure-menu` · `measure-menu-item` (`data-tool`, `disabled` with
  `title`).
- Stage:
  - `measure-draft` (`data-tool`, `data-state` = idle | drawing | closed | cutting | draft,
    `data-shape` = polygon | rectangle, `data-points`, `data-basis`) — the measure canvas itself,
    mounted while a tool is armed; the stage wears `data-measure-refusal=unscaled` over an unscaled
    view (the not-allowed cursor's hook);
  - `measure-point` (`data-index`, `data-ring` = outer | cutout-{n}, `data-basis`, `data-source`,
    `data-key-x`, `data-key-y`);
  - `measure-live-figure` (`data-value` exact at 3 decimals, `data-unit` = m | m2 | du | du2 |
    count, `data-si` = calibrated | uncalibrated | windowed | unrecorded, empty for a count,
    `data-via` = the window a paper figure was carried through, `data-shown`); the distance cell
    `viewer-status-distance` gains the same `data-si` values and `data-via` (I-501).
- Status: `viewer-status-measure` (`data-tool`, `data-condition`, empty with no condition picked,
  `data-points`, `data-value`, `data-unit`, `data-reason`).
- Card (the ConsequenceDialog's ids stand: `consequence-dialog` with `data-act-type` and a new
  `data-presentation="anchored"`, `consequence-confirm`, `consequence-digest-line`; the arm adds):
  - `consequence-measurement-condition`;
  - `consequence-measurement-row` (`data-role` = gross | less | junction | ignored | net,
    `data-kind`, `data-value`, `data-basis`; a cut-out row also `data-cutout-role` = opening |
    member);
  - `consequence-measurement-reading` (`data-attribute`, `data-value`, `data-unit`, `data-basis`,
    `data-source`);
  - `consequence-measurement-quantity` (`data-kind`, `data-value`, `data-unit`, `data-basis`,
    `data-coverage`);
  - `consequence-measurement-level`;
  - `consequence-measurement-cutout`;
  - `measure-card-retry` (the card's own ErrorState, §3).
- Chest:
  - `measure-chest` (`data-state` = loading | ready | empty | failed | readonly);
  - `measure-chest-condition` (`data-condition`, `data-selected`, `data-geometry`, `data-hotkey`);
  - `measure-chest-new` · `measure-chest-retry` · `measure-condition-form` · `measure-condition-save`;
  - `measure-chest-row-menu` (a row's ⋯, absent when read-only) · `measure-chest-retire` (its Remove
    from chest item). The row's total carries `data-measured` and `data-billed` (I-575).
- List:
  - `measure-list` (`data-state`);
  - `measure-list-row` (`data-object-key`, `data-state` = pending | published | queued | refused);
  - `measure-list-retry`.
- Book: `takeoff-nav-measurements` · `measurements-screen` · `measurements-grid` · `measurements-row`
  (`data-role` = group | gross | less | junction | net, `data-object-key`) · `measurements-export` ·
  `measurements-empty`.

Behavioural hooks without new ids:
- `aria-pressed` on the armed tool;
- `aria-busy` on the card while pending;
- the absence of `consequence-confirm` while a preview is pending or refused (asserted, not
  assumed);
- `cursor: not-allowed` over a hatched view.

## 10. How the journeys walk

**J-000 m4-sheet-and-manual-measure (S6).** Safe to run again: it finds a standing measurement and
skips to the read-back.
1. Take `bnbcMeasured` and open S-08 from its card. The view "GRADE BEAM LAYOUT & GF SLAB ON GRADE"
   holds a DIMENSION_RATIO scale of record, factor 0.001 (the critic's read). If it holds none, the
   leg affirms two points first (SCALE-1).
2. In the chest, find "75 CC blinding under SOG" (slab · blinding · t 75 mm) or author it.
3. Press its digit (or A). Click the five vertices of POLYLINE 81D, the SOG's own outline (endpoint
   snaps), and press Enter. Since Rev C the drawn blinding outline (824–827 and 2309) lies on the
   same five edges; in Rev B it was a rectangle that billed blinding outside the slab (I-393).
4. On the card, press X. Click the four corners of LWPOLYLINE 830 (the lift pit) and press Enter.
5. The card re-previews and the leg reads it through `data-value`:
   - gross 328.83837124436192623624929233379 m² in `data-value` (exact; the row prints 328.8384),
     and Less 8.04691888 m² (above 0.1: deducted);
   - Less the register's 25 FDN columns meeting the ring, their plans clipped to it (I-389);
   - t 75 mm: the leg picks note 828 in the card's reading Select (TRANSCRIBED, §2.5); the
     condition's ENTERED value is the Select's default;
   - level Ground floor;
   - the Net equal to the gate's own evaluation.
6. Press ⌘↵. The measure cell reads `measure_status_recorded`; the leg then reads the register row
   and the BOQ line (the sheet's list row, pending then published, joins when S7 lands).
7. Read-back (`readback` skill, db_read):
   - one register row at `v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.…|-125.0,-400125.0@<GF>`;
   - one `pcc.blinding` line whose value equals the gate's evaluation, formula printed;
   - 0 orphans;
   - residue: slab × {concrete, formwork, rebar} × GF NOT_ESTABLISHED (I-383).

It asserts no COMPLETE figure before §12's ruling is recorded and I-389 stands. The stub's first door
(the missing Decision) is struck in the commit that lands this file: the fixme's title in
`tests/e2e/journeys/j-000/m4-sheet-and-manual-measure.spec.ts` and its roster line in
`tests/journeys/fixme-roster.test.ts` now name only the doors S1–S6 still owe.

**J-041 (S11).** A staged, scale-affirmed sheet with an open campaign walks:
- count, linear, and area with a cut-out;
- a condition and an assembly;
- the list and an edit (a superseding act; the predecessor leaves the BOQ);
- the legend;
- the sheet PDF from Documents.

A second, **text-less** sheet (only the anchorless view) is scaled by two points and measured by
hand: the M4 exit's proof (I-375). It is a full-size vector DXF drawn in millimetres, with no text
at all, because a PDF page waits on the gate multiplying calibration (I-386) and a scan waits on
that and on M4P-6 (I-387). S11 stages it so, and a text-less PDF or scan joins J-041 only once both
land.

## 11. Refuter record (one verdict per Interpretation)

The proof asks for a `refuter` verdict per Interpretation. None has been run: this slice was written
in a worktree whose agent has no way to start another agent, and that stayed true when the slice was
recovered after the power cut. Each row states the strongest objection the author could raise, and the
answer this Decision rests on. That is **not** a verdict. The orchestrator runs `refuter` over each
Interpretation and records CONFIRMED / AMENDED / REJECTED here before the slice named in the last
column builds on it.

An adversarial review of this slice (session 8, wave 1) found defects in I-379, I-380, I-388,
I-389 and I-393. Each finding was checked against the fixture, the DXF, the code and the J-000
project before it was fixed, and each is amended in this edition (Changelog). The review is not a
per-Interpretation verdict, so those rows stay OWED, and their objections below are the review's.

| Token | Strongest objection | Answer this Decision rests on | Verdict | Blocks |
|---|---|---|---|---|
| I-370 | R-UI-080 names S-Measure beside S-Viewer as a screen of its own | "mode in the viewer" (bible:625); the Direction draws both on one template (§3.1) | AMENDED | S4 |
| I-371 | I-145 kept plain click as selection "byte for byte" | only while a measure tool is armed; Select is unchanged | CONFIRMED | S4 |
| I-372 | Shift in Bluebeam is 45°; ours differs | one angle grammar per product (I-148) | CONFIRMED | S4 |
| I-373 | R-UI-021 says "opens a ConsequenceDialog", not a card | the card IS the dialog, anchored; the digest binds the figure | OWED | S1, S6 |
| I-374 | authoring a condition changes future quantities, so it should be an act | it changes nothing the machine derives until a measurement (an act) cites it; the act snapshots it | OWED | S5 |
| I-375 | L-CAD-06 forbids instances off non-plan views | it governs what the machine may instance; a human measurement is not machine instancing | OWED | S1, S11 |
| I-376 | a solo QS may hold architectural scope on a structural sheet | KIND_DISCIPLINE is law (L-REG-03); measure on the authoritative sheet | AMENDED | S1 |
| I-377 | a level default is a machine choice presented as the QS's | it is the view's caption through the one resolver, shown and changeable; a change is ENTERED | OWED | S1, S6 |
| I-378 | L-REG-02 says "no coordinates", and the mark hashes the ring's; also, a hash is a minted id in disguise | the ring stands in for a mark only inside one view of one revision, where L-REG-04 already keys placements by coordinates, and it is never paired across drawings (the re-pin carry is owed, I-394); the hash is a pure function of content and the act log and re-derives identically | CONFIRMED | S1 |
| I-379 | a new key per edit breaks L-REG-02's "attributes never in identity"; and (review) the residue still counts a repudiated object's lines, so a deleted hand measurement leaves its cell quantity-bearing while the bill holds nothing | attributes still never enter; the successor differs by its predecessor, and the predecessor is struck; the residue withholds what the bill withholds (S3, with a db test), and S7 offers no Delete or Edit until it does | OWED | S1, S3, S7 |
| I-380 | (review) a guard on the quantised lattice passes two rings that overlap by less than one lattice step, while the figures bill the sliver from the exact points | the guard now reads the stored exact points, scaled to integers, with BigInt predicates; any positive shared area or collinear overlap is refused; the lattice keys only | CONFIRMED | S1 |
| I-381 | refusing every other view blocks legitimate split measurement across sheets | it errs toward measuring less; the proof of disjointness is owed and named | OWED | S1, S3 |
| I-382 | cell grain refuses a hand measurement where the machine published only PARTIAL | conservative by design; geometry grain is an IOU | OWED | S1, S3 |
| I-383 | new NOT_ESTABLISHED cells will read as noise on the certificate | they are true, and L-QTY-05 is written that way; narrowing would need a Deviation | OWED | S3 |
| I-384 | "a rail per kind" is broken by a manual arm | the arm is inside the kind's one rail, composed at one home | OWED | S3 |
| I-385 | exact figures from float-sourced coordinates are false precision | the coordinate's own decimal spelling is the drawing's fact; the key alone quantises | OWED | S1, S3 |
| I-386 | refusing where the factor ≠ the unit blocks every PDF sheet | yes, until the gate multiplies (L-MEA-05); publishing a wrong-size figure is worse | CONFIRMED | S1 |
| I-387 | L-QTY-01 and R-TO-040 disagree on a free point on a scan; and a MEASURED claim rests on the client; and (review) one lattice step of reach let a metre drawing's corners, each pushed 70 mm outward, come back MEASURED at 102.8196 m² against 100 | weakest-wins makes it INTERPRETED under both; the door re-derives every snapped point from the cited entity and demotes what it cannot reproduce, within one micrometre of real length (never a lattice step), and stores the drawing's own point where the drawing determines one (I-385) | OWED | MANUAL-LAW (session 9's refuter: the server's judgePoint answers MEASURED for a point citing a RASTER_TRACE key — latent while I-386 refuses every page not drawn full size) |
| I-388 | L-FRM-04 defers polygon blinding outright; and (review) S-08's drawn blinding rectangle bills blinding outside the slab at the chamfer | it defers projecting a polygon plan, and a traced outline projects nothing; a drawn blinding outline counts only where it follows its member, and where it does not, the member's own outline is traced (under by at most p) | REJECTED | OPEN-3 (the mint of S2's method) |
| I-389 | a derived deduction from another sheet is "undrawn" on this one; a traced cut-out treated as an opening under-deducts a small column; and (review) "26 columns" counts the porch column outside the ring, and "members at that level" names the wrong storey | it is drawn on S-10 and in the register, and the fail-closed arm covers what cannot be placed; a cut-out carries a role; members are the storey whose top is the slab's level, each clipped to the ring's net region (25 on BNBC, 17 of them straddling its edge) | OWED | S3, S4, S6 |
| I-390 | a one-line disclosure is still a disclosure of possible under-coverage | under-coverage is the lawful direction; over is blocked by k, l, m, t | OWED | S6 |
| I-391 | printing 4-decimal metres is unusual in a PWD book | it is what makes the printed arithmetic reproduce | OWED | S7 |
| I-392 | F-SCAN may intend a pure scan | R-TO-003 names mixed pages; the text-less case is J-041's | OWED | M4P-5 |
| I-393 | the item fails "no undrawn deduction"; and (review) the rectangle 824–827 over-measures by 0.79 m³, the yardstick's 5.957 m² was misread, Q(3) rested on a false premise, and the fallback's gate cell went unsaid | S-08 alone does fail it; only I-389 reaches the columns, and the leg waits for it; the ring is now 81D, the figures are re-read and tested against the fixture, Q(3) is answered by the drawing, the golden's two double deductions are R0 items, and the fallback is named a gate cell | OWED | S6 |
| I-394 | leaving the carry out breaks L-REG-06 | the carry is owed and the re-pin must say so; nothing silently drops | OWED | re-pin |
| I-496 | an append-only store makes a wrong measurement permanent; and (review) a recipe naming an unknown condition reached the store's key and answered with a fault, and a key on the id alone crossed workspaces | nothing is lost: an edit supersedes and strikes, a delete repudiates, and the bill withholds a struck object's lines (I-379, BOQ-1); what stays is the record of what a person did; the act refuses a condition the chest does not hold standing by name, and the key is `(tenant, project, condition)` | CONFIRMED | S1 |
| I-495 | a move of the door every rebuild uses risks a behaviour change | the move is the same SQL in a new home, proved by the register breaker suites unchanged; the two re-homed writers keep their own semantics (no evidence for a re-stated range) | CONFIRMED | S1 |
| I-497 | a tool that measures without recording invites a QS to believe a figure was taken; and it departs from I-374's pick-first | the cell says "Measured, not recorded" after every finish, and no card, act or line exists to mistake for one; pick-first governs wherever the chest can be picked from | CONFIRMED | S4, S5 |
| I-498 | §2.3 says hatched "with a tool armed", whatever the views switch says | one hatch home (I-160); with the hatch switched off the refusal still stands in the cursor and in words | CONFIRMED | S4 |
| I-499 | ruling the table's open cells in code is the grammar growing silently | each cell is written here, and each errs toward keeping the QS's work | OWED | MANUAL-LAW (session 9's refuter: the server re-snaps an uncited coordinate to the 0.1 grid, so a Shift/Ortho run is not stored square and can grow a ring) |
| I-500 | a derived corner nothing was snapped to is a free point and belongs on the lattice | its coordinates are the clicked corners' own, exactly; its basis is asked of the drawing and demoted at the door if it does not reproduce | OWED | MANUAL-LAW (session 9's refuter: a derived ENTERED corner is quantised by the server's free(); up to 0.05 drawing units per coordinate) |
| I-501 | a window's ratio applied to a factor read on paper states a figure 10⁴ over; picking "the" window by the frame misreads a shape across two | only machine ranks (read off model-space members) are carried through a window, a two-point is `unrecorded`; a shape must stand inside exactly one frame, and two, none or overlapping frames refuse by name | CONFIRMED | S4, S6 |
| I-538 | L-MEA-08 has the gate partition candidates against thresholds, so a channel with none is no channel | L-MEA-08 also keeps sums out of offers, and L-MEA-09 states no threshold for members; a channel with no threshold is the only home that keeps both | CONFIRMED | OPEN-3 (the mint) |
| I-539 | reusing a machine pair for a hand trace hides that a person measured it | the line's bases, sources and act say who measured it; the pair says only how it is computed, and one algebra has one pair (B-17) | OWED | MANUAL-LAW (session 9's refuter: the act never reads MANUAL_RULES — the door takes any rule id, so a 'not offered' pairing is recorded; and the footing row's 'whole' ignores p) |
| I-573 | a QS arranges the chest by habit, and a digit that moves when another condition is removed breaks muscle memory | the digit is project data or nothing; a per-browser digit disagrees across the team; re-ordering is owed with an order column | OWED | S5's successor |
| I-574 | a separate CONDITION_KIND_NOT_OFFERED is one more code for what the form already prevents | the door is also the tRPC lane, which any caller reaches; a refusal whose sentence is false for its case is worse than one more code | OWED | S5 |
| I-575 | a chest that reads "—" for every condition until S3 lands looks broken in a demo | it is the true state (measured, not billed), said in the tooltip; a traced m² would be a second, unsigned figure for the scope | OWED | S3, S5 |
| I-576 | forgetting the pick on a tool change is simpler and cannot mislead | the QS who steps to Select or Line for a moment would pick again, and §2.6 asks A to find the condition last used; a remembered pick shown only under its own tool misleads no one | OWED | S5 |
| I-586 | a drawn ring is the plan the drawing states at one storey, and a schedule may state another section at the storey below; and a lattice-quantised offset moves a plan by up to 0.05 units | the register object stands on the level its plan was placed from, so its ring is that storey's; the offset is the reading of two grids of one building, whose float noise is below the lattice; a member nobody can lay fails the measurement closed | OWED | S6 |
| I-587 | refusing an act for the gate's reason puts a gate code in the card, and recording an unpaired kind lets a measurement sight a cell it never bills | the card's figure is the gate's, so its refusal is too; an unpaired kind's cell reads NOT_ESTABLISHED, which is the truth, and the chest authors paired conditions only | OWED | S6, S7 |
| I-588 | citing the act for an ENTERED thickness hides the condition it came from | the measurement snapshots the recipe with its condition id (I-374), and the act row names the person; the act is where a reader takes recourse | OWED | S7 |
| I-589 | refusing the machine's queued arm hides an exclusion the machine would have declared | the cell is the person's by a stored fact; the machine's reading of it would be a second statement about one scope, and the refusal names why (CELL_MEASURED_BY_HAND) | OWED | S6 |

**D-005 — entered** (session 9: the refuter rejected I-388 — L-FRM-04 defers polygon plans outright and states `(L + 2p)(B + 2p)t` with no hand/machine split, so dropping p is a departure, not a reading). Its row and section are in `docs/decisions/deviations.md`.

## 12. Critic record

The proof asks that a `ux-critic` and a `qs-critic` read this Decision and that their findings are
resolved. Neither has run in this slice's worktree, and both are **OWED** to the orchestrator.
- **Questions put to the qs-critic:** I-393's four: (1) and (2) as asked, (3) as a statement the
  drawing answers, for the critic to contest, and (4) the chamfer, 81D against the rectangle
  824–827. Also whether the named fallback item would be signable if I-389 cannot be built this
  session, knowing it lands in a gate cell.
- **For the ux-critic:**
  - the card's placement at 1280×800 near the stage's edge;
  - whether ⌘↵ is discoverable enough (the Kbd on the button);
  - the drawer's four groups at 200 px;
  - the cut-out role Select and the reading Select inside a 320 px card;
  - whether 10 px basis glyphs on every draft point read as a vertex or as clutter.

Findings are resolved here, in this file, in the commit that records them.

Risks this Decision leaves the orchestrator:
- S3's slice text says the residue sights "only the recipe's kinds". I-383 rules the opposite under
  L-QTY-05. The slice text defers to this file, so S3 follows I-383 unless the refuter overturns it.
- I-389 adds a `junction` channel, a cross-view placement and a cut-out role. S2 landed the channel
  and the method's two channels (I-538). What remains touches S3 (the builder), S4 (the gesture)
  and S6 (the card), and S3's slice text names only the opening channel. The fail-closed arm is
  S3's too (§14): an offer with no junction candidates publishes with `junctions = 0`.
- FND-OWN's slice text deducts a cap blinding's pile sections "above the 0.1 m² threshold". I-538
  reads a pile's section as a junction (L-MEA-09's pile › pile cap), deducted whole in the `junction`
  channel. FND-OWN takes that channel or records why not. No BNBC figure moves either way: its
  piles are about 0.2 m².
- I-387 puts a snap re-derivation in S1's door: the server reads the cited entities from the stored
  EntityGraph.
- J-000's asserted residue roster (R0-1) must carry the slab × GF cells once S6 lands.
- If I-389 is not built this session, J-000's manual leg asserts a named refusal, not a line (I-393).
- **Two R0 items on the golden's side** (I-393), **closed by R0's K21 (W-33).** SOG@GF's column
  deduction took the three FDN core walls (1.905 m², 0.142875 m³) inside the lift-pit hole it had
  already deducted, and A4's and A5's parts inside the ramp hole a second time beside RAMP@GF's
  (0.09 m², 0.00675 m³). The golden now deducts each member only from the plan it stands on: 23.615
  → 23.765 m³, and the hand figure stands 0.009532 m³ under it.
- **A fixture defect for F-RCC6-BNBC's owner, closed by R0's D-BLIND (W-40)**: `found.py` said the
  SOG and its blinding are "the same shape drawn three ways", but Rev B's blinding LINEs 824–827 were
  the SOG's bounding box plus 75 mm. Rev C draws them on the slab's own edges, with the chamfer's
  LINE 2309.
- **The residue's no-join rule** (I-379) is S3's, and S7 offers no Delete or Edit on a hand
  measurement until it stands. S3's and S7's slice texts do not name it yet.
- **Metres on a paper sheet (I-501).** The snapping region's distance cell multiplied paper
  coordinates by a view's model-space factor on any sheet that shows its plan through a viewport; on
  BNBC's 1:100 sheets that stated a length a hundred times short. It now asks `sheetMeasuring` as the
  running figure does, and reads 16.100 m along 81D's second edge on S-08's paper (jsdom,
  `measure-screen.test.tsx`), not 0.161. Not yet seen in a browser. J-020 stages MODEL_SPACE sheets
  only, so no journey covered the paper case before, and none does yet.
- **The scale store mixes spaces (I-501).** A QS_TWO_POINT affirmation picked on a paper sheet is a
  factor per PAPER unit: `affirm-scale.ts` checks that the cited keys belong to the named views, and
  a projected record cites its model entity, but nothing records which sheet the coordinates came
  from. The viewer now refuses to carry a two-point factor through a window (`unrecorded`), but on
  model space it applies it as before, and the measure job reads that factor per model unit. The
  affirmation should record the sheet it was taken on (or map the picks back through their window).
  Owner: the scale door's (S-Scale), named by the orchestrator.
- **The spec's "docs lane in pnpm verify" does not exist.** `scripts/lib/lanes.mjs` has no lane over
  `docs/design`, and `test:docs` is the Typst document lane. What stands in its place is this
  Decision's own test in the unit lane, which verify runs:
  `tests/takeoff/manual/s-measure-decision.test.ts`. It checks that §0 and §11 name the same
  Interpretations, that every verdict is one of the four words, that D-005 is entered if I-388 is
  REJECTED, that §3 rules R-UI-050's seven states, that every token this file names exists in the
  stylesheets, and that I-393's readings match the committed DXF, `model.json` and golden. The
  spec's proof line needs amending to name it; the spec lives outside this worktree.

## 13. Notes that ride integration (other owners' files, sentences ready)

- **`viewer.md`**
  - :27: "Linear L · Area A · Count C · ▾ (armed; `s-measure.md` §2.1)".
  - :2370-2371: "The measurement tools themselves — M/C/L/A, the gesture grammar and the inline
    measurement card (R-UI-042) — are ruled by `docs/design/s-measure.md`; the picks here feed the
    readout and nothing else."
  - I-145 gains: "Amended by s-measure I-371: inside an armed measure tool a plain click places a
    point."
- **`00-direction.md`** §3.1 (:147): "Linear L · Area A · Count C (armed in M4, `s-measure.md`)"
  in place of "M2/M3 show them disabled with 'Measurement tools arrive with S-Measure'".
- **`consequence-dialog.md`**
  - I-45 gains the `MEASUREMENT` arm.
  - I-167 gains the anchored presentation (a transparent scrim, placed beside a point, still modal).
  - §1's footer gains the optional secondary action.
  - §7's closed contract gains the six `consequence-measurement-*` ids, `measure-card-retry` and
    `data-presentation`.
  - I-40 gains: "A consumer may catch a fault at its own boundary inside the dialog and render
    ErrorState there (s-measure I-373); the fault is still a fault, never a refusal."
- **`s-takeoff-register.md`** (I-179, I-287): a hand measurement's mark renders as its condition's
  name and "by hand"; the `~m.` mark is shown only in the Technical disclosure through IdChip.
- **`s-takeoff.md`**: the lane's tabs gain Measurements after Register (S7).
- **`s-coverage.md`**: I-383's reading of what a hand row sights, and I-379's rule that the
  residue counts no line of a repudiated object (landed by S3 in `publishedLinesOf`; the sentence for
  s-coverage: "A line whose object stands repudiated in the campaign's revision counts for nothing in
  the residue, as in the register and the draft BOQ; its cell reads NOT_ESTABLISHED where no other
  line stands (s-measure I-379).").
- **`viewer.md`**, the canvas law: the selection dip's figures (66.5 % at 1440×900, 62.7 % at
  1280×800), which fall below R-UI-080's 70 % and the Direction's own "≥ 66 %". The dip is the
  viewer frame's, inherited by S-Measure.
- **DLG-1** (the ConsequenceDialog's owner this wave): I-373's whole list of what the pattern gains
  (the footer's secondary action, the anchored presentation with its point anchor, transparent scrim
  and `data-presentation`, the Mod+Enter confirm, and the consumer error boundary).
- **`src/ui/shell/shortcuts/roster.ts`** and `src/ui/strings/shortcuts.ts`: the six roster lines of
  I-372 with their labels (§4), landed by S4 and S5.

## 14. Recorded IOUs (owner named, never a comment in `src/`)

- The proof of disjointness across views (I-381): grid-frame mapping by shared axis labels. S3 built
  the frame rule (`frameTranslation`, I-586) but not the guard that uses it, so the refusal still
  stands for every other view. Owner: S3's successor, named by the orchestrator.
- ~~The cross-view placement of registered members as junction candidates (I-389).~~ Built by S3
  (I-586).
- ~~I-389's fail-closed arm.~~ Built by S3 (I-586): `MANUAL_JUNCTION_UNPROVEN`.
- One statement of the plan-over-plan translation: core's `frameTranslation` (I-586) and the
  module's `translationBetween` (`measure/cap-junctions.ts`, I-547) state one rule twice, because
  core may not import the module. The module's should call core's. Owner: the integrator, with
  FND-OWN's successor.
- Geometry-grain sharing of a cell between machine and hand lines (I-382). Owner: after M4, named at
  that time.
- A per-cell "hand coverage is partial" declaration (I-390). Owner: the residue's owner (S3's
  successor).
- The gate multiplying calibration (L-MEA-05; I-386), without which no hand line publishes on a PDF
  (points) or raster (pixels) page. Owner: the m4-pdf-sheet area (M4P-*).
- Feet-and-inches beside SI on a feet sheet: `formatFeetInches` in the format seam (I-391). Owner: S7.
- A tenant-level chest (R-TO-041). Owner: S5's successor.
- Edit a condition (§2.6's row menu): the chest's UPDATE of name, paint and recipe, which never
  re-derives a standing measurement (I-374). S5 ships Remove from chest only. Owner: S5's successor.
- Re-ordering the chest, and with it a chosen digit (I-573): an order column on `conditions`.
  Owner: S5's successor, with a migration.
- The status line's `data-condition` (§9): the measure cell names the picked condition in words
  (`measure_status_drawing`), and `status-line.tsx` does not yet carry its id. Owner: S6, with the
  card that records under it.
- Drafts persisted across a reload or offline. Owner: the prefs seam's node (viewer I-84, unpaid).
- `VIEW_SCALE_UNAFFIRMED`'s wording for hand measurers (§5). Owner: the frame errors' owner.
- The re-pin carry (I-394). Owner: the slice that builds REPIN_DRAWING_SET.
- The partition keying the anchorless view as `v:UNASSIGNED:FILE:<sha256>`, per drawing, and naming a
  page's space (I-375). Today it spells the bare `UNASSIGNED`, which two drawings of one project
  share; the manual door derives its own spelling meanwhile. Owner: M4P-2.
- A guard that holds a blinding ring inside its member's ring plus the edition's p (I-388). It needs
  the member measured on the same view. Owner: S2's successor.
- The SOG blinding outline on S-08 that does not follow the chamfer (`found.py:229-230`, I-393).
  Owner: F-RCC6-BNBC's generator.
- Typed "Less:" rows (ENTERED deductions, PWD practice) beside traced and register-derived ones.
  Owner: S9.
- §3's reasons 3–5 (no campaign, not pinned, discipline) in the tool row and the measure cell, from a
  read of them in the route (I-497). Owner: S6.
- One home for the ring arithmetic (I-385). S4's running figure and its cut-out predicates compute in
  `viewer-measure/figure.ts` and `viewer-measure/rings.ts`, exactly, in BigInt, while S1's
  `src/core/manual/law.ts` was being written beside them. The two meet at integration, and whichever
  is not `law.ts` then calls it. Owner: the integrator, with S1.
- The door re-checks a cut-out's containment exactly (I-372's rule is S4's on the client, and a client
  is not trusted, I-387). Owner: S1/S3.
- The point on paper, mapped back to model space (I-501, I-378). The viewer now carries a figure
  through its window (the calibration door answers the sheet's windows; `sheetMeasuring` carries a
  span through the one window it stands in). What an act keys and measures must still be the model
  point: a point placed on a paper sheet is mapped back through its window before the door re-derives
  it. Owner: S1/S6. The sheet a QS two-point was taken on is not recorded (§12). Owner: S-Scale.
- The remaining J-041 tools, assemblies and the sheet PDF. Owners: S9, S10, VD-6 and S11.
- A view's extent has two readings: the partition overlay's box, read off the viewer's render
  records (a module), and the act's extent, read off the artifact's entity points (I-375). They agree
  on model space. One home for the box, in core, is owed. Owner: VD-4, or the slice that next touches
  the overlay.
- The placement outline's square-unit map (`partition/placement/outline.ts`) and the manual law's
  (`src/core/manual/law.ts`, mm → mm², m → m², ft → sft) are two spellings of one fact. The outline
  should read core's. Owner: the partition's next slice.

## Changelog

- 2026-09-23 — S0 (session 8, wave 1): first edition, written before any screen work (C-13). It covers:
  - the frame in measuring mode, the card, the chest, the sheet list and the book, each with its
    region table;
  - I-370 … I-394, with D-005 held conditional on the refuter;
  - every R-UI-050 state, with its copy verbatim, the refusal entries proposed for registration, and
    the routes and test ids;
  - the comparison with Bluebeam, PlanSwift, OST and CostX.

  The refuter, qs-critic and ux-critic verdicts are owed (§11, §12).

  Finished after the power cut that stopped the first draft. The draft was checked against the code at
  `ed29abf0`, the Bible and the critic's corrections, and these changes were made:
  - The point marks now wear R-UI-002's basis glyphs (◆ ✎ ▦). The draft's square and hollow circle
    were TRANSCRIBED's and DEFAULTED's shapes.
  - The draft named `--beam-100` and `--graphite-*` primitives, which the lint rule refuses. They are
    now the semantic aliases.
  - Cut-outs carry a role (Opening, or Column or wall). Without it, the 0.1 m² opening threshold
    would leave a small column's plan undeducted.
  - The door re-derives each snapped point's basis instead of trusting the client.
  - The card is modal, so a reading from the drawing is now offered inside it, not taken by a click
    on the sheet behind it.
  - The card gains an error state that keeps the outline.
  - "A view" is now (view key, space), so two pages of one PDF cannot pass the double-count rules.
  - L-REG-02's "no coordinates" is answered for the markless key.
  - I-393 now says plainly that S-08 alone fails the slice's rule. It records the four-condition
    search and names a fallback item.
  - The book gains the Scale column R-TO-043 names.
  - The gesture grammar covers V, H, S and F, and the roster lines are named.
  - Stale citations are corrected: the M4 exit is bible:829; `assign.ts`'s path; `rebuild.ts:275`,
    which never held the claim; and the discipline, which is per sheet.
  - The figures in I-393 are re-read this session, from the J-000 project's lines and register and
    from the DXF.

- 2026-09-23 — S0, after the slice's adversarial review. Each finding was checked against the fixture
  (`model.py` instrumented, the DXF read with ezdxf), the code and the J-000 project before it was
  fixed:
  - **I-393 and I-388: the ring is the SOG's own outline, 81D.** The drawn blinding rectangle
    824–827 is the SOG's bounding box plus 75 mm, and it takes in 9.504 m² outside the slab
    (4.091 m² of it at the chamfer, beyond any projection). Traced, it would bill about 0.79 m³
    over the golden, silently and in the larger direction. The disagreement is now declared, and it
    is the qs-critic's Q(4). I-388 now says a drawn blinding outline counts only where it follows
    its member.
  - **I-389 and I-393: the figures are re-read.** The yardstick's 5.957 m² is 4.052 m² of 25 FDN
    column plans plus 1.905 m² of three core walls. Those walls stand inside the pit outline 830,
    which is the core's outer face, so Q(3) is answered by the drawing, and the golden
    double-deducts them. The register's 26 columns include C7, the porch column, which stands outside
    the ring: 25 are deducted. The members are the storey whose top is the slab's level (FDN under
    GF). Each is clipped to the ring's net region, because 17 of the 25 straddle the slab's edge.
  - **I-393: the fallback is a gate cell** (SHEAR_WALL × RCC_CONCRETE, ±3 % / +0 %), and that is
    now among its costs.
  - **I-379: the residue withholds what the bill withholds.** Its published arm never read
    `repudiated_objects`, so a deleted hand measurement would have left its cell quantity-bearing.
    Owner S3, with a db test. S7 gates Delete and Edit on it.
  - **I-380: the overlap guard reads the exact points**, in scaled integers, not the key's lattice,
    which let a sub-lattice sliver bill twice.
  - I-371: Alt+click in an armed tool does nothing, and the status says where the pick lives.
  - I-373: the whole list of what ConsequenceDialog gains is handed to DLG-1.
  - I-375: the anchorless key's new spelling is an IOU of M4P-2.
  - I-386: J-041's text-less sheet is a full-size vector DXF.
  - The canvas law states the inherited selection dip's real figures.
  - §10 walks the new ring. §11 and §12 carry the review. The Decision gains its own test in the unit
    lane, in place of the docs lane the spec names, which does not exist.

  The refuter's per-Interpretation verdicts and both critics' reads are still owed (§11, §12).

- 2026-09-24 — S1 (session 8, wave 2): the act, the markless key and the store, built.
  - `RECORD_MANUAL_MEASUREMENT` under MEASURE, behind `takeoffManual.preview` and `.commit`
    (§2.11). The MEASUREMENT arm's payload is bound by the digest (I-373, amended to say what S1
    binds).
  - The law, the key, the guards and the point judgement are in `src/core/manual/` (`law.ts`,
    `identity.ts`, `overlap.ts`, `snaps.ts`, `units.ts`, `exact.ts`, `store.ts`).
  - The register's batch sighting write came down into `src/core/register/store.ts`, and the two
    core writers of `register_objects` were re-homed there (I-495).
  - `manual_measurements` and `conditions` (migration 0062, I-496).
  - Amended from what the code taught:
    - I-375 (how the act proves the view);
    - I-377 (a foundation class stands in `FOUNDATION` whatever was stated, and the roster moved
      into core);
    - I-379 (`replaces` and `supersedes`, and the new `MANUAL_PREDECESSOR_NOT_STANDING`);
    - I-386 (the unit read off the affirmed calibration);
    - I-387 (the re-derivation is the act's own, within one lattice step of each cited entity);
    - §5 (the degenerate message names cut-outs; S1's codes; an unborne kind is malformed at the
      door).
  - The J-000 stub's MISSING DOOR now names only what is still owed: a method, a rail arm, a
    chest and the tools.
  - Amended on the adversarial review:
    - I-387: the snap reach is one micrometre of real length through the drawn unit, not one
      lattice step. The review showed a metre drawing's pushed corners MEASURED 2.8 % over.
    - I-385: a snapped point is stored as the drawing's own vertex, midpoint or grid crossing
      wherever one stands within that reach.
    - I-496: a condition the chest does not hold standing is refused by name
      (`MANUAL_CONDITION_NOT_STANDING`), and the store's key on it is `(tenant, project,
      condition)`. Migration 0062 was regenerated; it was never landed.
    - A statement is bounded at 1 000 points over every ring and 50 cut-outs (`MANUAL_BOUNDS`,
      the manual law), where it had been 5 000 points a ring and 500 cut-outs. Measured: two
      1 000-point outlines take about a second to compare exactly, and two 5 000-point ones about six.
      The exact kernel now also skips a pair whose boxes share no area.
    - The commit judges a statement once per transaction; the seam's own preview inside the commit
      had judged it twice.
- 2026-09-24 — S4 (session 8, wave 2): Linear, Area and Count armed on the sheet.
  - The tool row's measure group arms (L, A, C), with the ▾ and its M menu: Rectangle, Cut out, and
    the S9 tools disabled with their reason. `viewer_tools_measure_absent` retired.
  - The gesture grammar is a pure machine (`viewer-measure/gesture.ts`). The pointer places points on
    the click, which carries the click's count; the keys are matched in `measure-region.tsx` against
    the roster, which gains finish, undo, cut-out and point.
  - Shift constrains from the path's last point through the snapping region's own `constrainOrtho`
    and Angle lock, and a perpendicular drops from the same point (path mode, `use-snap.ts`).
  - The running figure: a DOM label at the live point, exact in decimal from the view's scale of
    record, with the measure cell after the distance cell and the reticle at the live point. On
    S-08, 81D reads A 328.838 m², and 320.791 m² once the lift pit 830 is cut out (I-393's ring).
  - On a sheet that shows its plan through a viewport (every BNBC sheet: S-08's window 2077 is 1:100)
    the running figure stays in the sheet's units and says why, because the view's scale of record is
    per model unit and the client holds paper coordinates (I-501). The per-window scale is owed.
  - The same day, after an adversarial review: the calibration door answers the sheet's windows and
    the space each factor is per unit of (`viewer-snap/sheet-space.ts`), and one reading
    (`sheetMeasuring`) carries a span through the one window it stands in, for the running figure,
    the lettered segments and the distance cell alike. On S-08's paper 81D reads A 328.838 m² and
    320.791 m² with the pit cut out, as on model space (jsdom); a shape across windows, or a QS
    two-point factor, stays in sheet units and names why (I-501 rewritten). The distance cell's
    hundredfold-short length on paper is fixed with it (§12). A Count now refuses a point where any
    counted point stands (A, B, A counted three; I-499). A pick taken in Select no longer anchors a
    shape's first vertex while a tool is armed (path mode).
  - I-497 … I-501 are recorded, their refuter rows owed. §2.1, §2.3, §2.4, §3, §4, §7, §9, §12 and
    §14 are amended to what landed.
- 2026-09-24 — S2 (session 8, wave 2): the manual methods.
  - `pcc.blinding.area@1` lands in the new MANUAL method area (`src/core/rulesets/methods/manual/`,
    its shard `manual.methods.json`, `registry/manual.ts`), on the traced-plate tree
    `V = count × (A − openings − junctions) × t`, with the opening and junction channels (I-388,
    I-389). No edition cites it yet; it is not in force until the edition that mints the wave's new
    methods does (L-MEA-01).
  - The `junction` channel lands in the roster and the gate with no threshold (I-538). I-389's owner
    line, §12's risk and §14's IOU now say so.
  - I-539 records the decision for each kind, and `MANUAL_RULES` holds the one pairing offered
    today: a slab's blinding, traced. §2.6's New condition popover now lists its classes, kinds and
    attribute inputs from that roster.
  - I-388's refuter verdict is still OWED. S2 built on it because a method is in force only once an
    edition cites it, so the verdict now blocks that mint (§11's row). If the refuter rejects I-388,
    D-005 enters with the mint and the method does not change: D-005's "what the product does
    instead" is this method.
  - S2's adversarial review (the same day). The gate now refuses a junction below zero
    `OFFER_NOT_TO_CONTRACT` (I-538): with no threshold in the way it would have raised the figure.
    I-538 also records that a pile's section through a cap's blinding is a junction, and that the
    fail-closed arm is S3's (§14). I-539 now places the geometry roster in S1's `core/manual/law.ts`,
    and its table is proved to cover every kind of `KINDS`. `MANUAL_RULES` reads each channel's
    variable and threshold off the gate's maps.
- 2026-09-24 — S5 (session 9, wave 3b): the condition chest.
  - The chest stands in the drawer, above Layers: a row per standing condition with its swatch
    (colour and hatch), name, digit and the campaign's COMPLETE total per kind; the New condition
    popover over `MANUAL_RULES`; Remove from chest in the row's menu; and §3's loading, empty, error
    and read-only cells. A pick, a digit or a save arms the condition's tool, and the measure cell
    names the condition (`measure_status_drawing`) while the armed tool is its geometry's (I-576); a
    finished shape under it says nothing is
    recorded until S6's card (`measure_status_condition_pending`).
  - The doors: `takeoffConditions.list`, `.author` and `.retire`, and the viewer route's three
    actions over the same resolutions (§2.11). `src/core/manual/conditions.ts` is the chest's one
    home: the catalogue, the judgement, the read with its totals, the author and the retire.
  - I-573 (the digit is the chest's order), I-574 (the roster, judged by the chest, every refusal
    named; `CONDITION_KIND_NOT_OFFERED` and `CONDITION_NOT_IN_CHEST` registered beside §5's two) and
    I-575 (the totals are the campaign's lines) are recorded, their refuter rows owed. The roster
    gains `viewer-condition` (1–9). §2.6, §2.11, §3, §4, §5, §9, §11 and §14 are amended to what
    landed; Edit and re-ordering are owed (§14). The chest's error sentence is its own key,
    `measure_chest_read_failed`, so S7's list keeps `measure_read_failed` for the measurements.
- 2026-09-24 — S3 (session 9, wave 3b): manual offers reach the gate.
  - The one builder (`src/core/manual/offer.ts`, `manualOffersOf`) offers a hand measurement under
    the pairing `MANUAL_RULES` holds: the trace's area, the count of one, the recipe's readings, the
    edition's threshold, the opening cut-outs in the opening channel and the member cut-outs and the
    register's members in the junction channel (I-586, I-588).
  - Each kind's one rail gains its manual arm (`src/modules/takeoff/rails/manual.ts`, composed in the
    barrel after the machine's), reading `setup.manual`, which the run's setup reads through the same
    reader the preview does (`manualSetupIn`). The machine's rails are handed the machine's rows only
    (`machineRowsOf`, the manual-origin fact) (I-384, I-589).
  - The gate refuses a machine offer into a hand-claimed cell `CELL_MEASURED_BY_HAND` and a hand offer
    into a machine-published cell `MANUAL_CELL_MACHINE_MEASURED` (I-589). The residue counts no line
    of a repudiated object (I-379, landed); its sightings are unchanged: a hand row sights every kind
    its class bears (I-383, as S0 ruled against the slice text's "only the recipe's kinds").
  - The preview's figure is `judgeOffer`'s, bound by the digest, and the commit door asks for the
    campaign's run (I-587). The members a slab ring runs past are laid and clipped exactly, or the
    measurement fails closed `MANUAL_JUNCTION_UNPROVEN` (I-586); §14's two IOUs on I-389 are closed.
  - I-379's residue rule now stands, so S7's gate on Delete and Edit is lifted as far as the residue
    is concerned.
  - Proofs: `tests/takeoff/gate/manual-offers.test.ts` (unit) and
    `tests/takeoff/gate/manual-publish.test.ts` (live database: one line at the preview's figure with
    its formula, calibration key and basis; the residue's cells; the machine arm refused; the no-join
    rule for hand and machine objects; the commit door's ask). The refuter's verdicts on I-586 …
    I-589 and on the `evaluate.ts` change are owed (§11).
- 2026-09-24 — R0's Rev C (session 9): F-RCC6-BNBC regenerated (7cd0ead3), and I-388's, I-389's and
  I-393's statements about S-08 amended to the drawing as Rev C draws it.
  - D-BLIND (W-40): the blinding LINEs 824–827 lie on the slab's four square edges and LINE 2309 draws
    the chamfer, so the drawn outline is 81D's own and takes in 0 mm² outside the slab (was 9.504 m²).
    Q(4) is answered by the drawing; the conclusion stands: J-000 traces 81D.
  - K21 (W-33) and K22 (W-34): the yardstick deducts only what stands on a panel's net plan
    (SOG@GF 5.956875 → 3.961875 m²), four FDN core legs stand inside the pit (1.905 → 2.5908 m²), and
    the golden slab × blinding × GF reads 23.765 (was 23.615). The two R0 items this Decision
    listed against the golden are closed; the hand figure, 23.755468 m³, is unchanged and stands
    0.009532 m³ under the golden (the ramp's slope and the golden's rounding).
  - Proof: `tests/takeoff/manual/s-measure-decision.test.ts`, re-read over the Rev C DXF.
