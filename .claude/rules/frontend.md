---
paths:
  - "src/ui/**"
  - "src/app/**"
  - "src/modules/**/*.tsx"
  - "src/modules/**/*.css"
  - "docs/design/**"
  - "tests/ui/**"
---
# Frontend law (Datum, the craft standard, the shell)

**A screen is built against its Design Decision** (`docs/design/<screen>.md`: wireframe, region table
id/width/min/max/owner, every R-UI-050 state, copy verbatim, motion, tokens). Change the Decision in
the same commit as the screen; a deviation from it is a defect, and a second spelling of the same
document is a defect. Copy is design: write it in the product's voice, the QS's words, never ours.

**The craft rubric (AM-08)**: twelve criteria 0–5, weights summing to 12, at 1440x900 and 1280x800, both
themes; the screen's score is the minimum; the bar is total ≥ 4.0 with no criterion below 3, and it
blocks like a failing test. Mechanical criteria are computed from the DOM after `settled()`; a human
may only lower them. `workSurface`: the primary grid fills ≥ 55 % of shell-main; the canvas ≥ 70 % of
the viewport on S-Viewer/S-Measure; the grid or canvas starts within 240 px of main's top. The score is
the floor, not the goal: the owner's bar is "the best software its users have ever touched" (DIFF-4),
judged by looking at the running product (the `product-review` skill), not by the number.

**Mechanics that fail the lint lane:**
- `src/ui/testids.ts` is the only spelling of a test id (`cubit/no-literal-testid`; under
  `src/modules/**` a warning whose frozen count may only fall). `RegisterChrome.testIds` is how a module
  screen publishes its own.
- Components consume the semantic alias layer and density/layout tokens only; `--graphite-*`/`--beam-*`
  outside `tokens.ts`, `tokens.css` and the alias group fails `cubit/no-primitive-token`. Density
  revalues `--row-h`, `--cell-px`, `--cell-py`, `--text-body` at the root via `[data-density]`.
- No colour literal outside `src/ui/tokens.ts` (`cubit/no-colour-literal`). Dark is the default theme,
  light is complete, both are baselined; consumer code never branches on the theme.
- Shipped primitives only (`src/ui/primitives/{core,data,overlay}`): Select, Combobox, IdChip, EnumLabel,
  Breadcrumb, DataTable (TanStack Table 9 behind `DataTableColumnDef`), NumberInput, Switch, Checkbox,
  Resizable (react-resizable-panels 4: sizes are `"%"` strings — a bare number means pixels). Native
  `select` and `input type=date` are unlawful; ids render through IdChip, enums through EnumLabel.
- Every user-facing string lives in the string tables (R-SPINE-060); numbers, dates, money and units
  render only through `src/core/format.ts` (lakh/crore, ৳, `DD MMM YYYY`).

**The shell**: a 48 px icon rail, a 32 px toolbar, a 24 px status bar, exactly one inspector hosted by
the shell's slot through `useInspector`, present only with a selection. Grids: compact 28 px rows, no
wrapping, ellipsis plus tooltip, sticky header, frozen key column, tabular right-aligned numerals with
lakh/crore grouping, group subtotals where the domain has them. Every screen declares its crumbs in
`routes.ts` (workspace › project › area › page).

**The frame's slots are owner-held claims** (`src/ui/shell/slots.tsx`): a screen claims in the layout
effect of the commit that mounts it and updates passively; only the owner withdraws its claim; the tabs
row is a portal. Hydration stands a screen twice for ~100 ms, so nothing may depend on mount order.

**Design direction**: Datum is a precision instrument — graphite ground, 1 px hairlines, indigo means
actionable, copper only when a human commits an act (one per screen at most), a four-tick focus
reticle, mono tabular readouts, nothing bounces, skeletons never spinners on data. Avoid the generic
defaults a model reaches for unasked: no gradient hero panels, no pill-shaped buttons, no cards inside
cards, no decorative icons beside every label, no centred marketing copy on a work screen, no
explanatory paragraphs above a grid (one line at most; the rest lives in popovers or empty states).
