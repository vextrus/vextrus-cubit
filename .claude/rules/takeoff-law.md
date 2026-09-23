---
paths:
  - "src/modules/takeoff/**"
  - "src/core/gate/**"
  - "src/core/rulesets/**"
  - "src/core/levels/**"
  - "tests/takeoff/**"
  - "tests/golden/**"
  - "docs/design/s-*.md"
---
# Takeoff law — what makes a number signable

- **The register is the system of record** (L-REG-01). The gate is the sole writer of quantity lines
  (L-MEA-08): rails offer typed geometry and bindings; the gate resolves the pinned method, evaluates in
  decimal, renders the formula from the same template, and returns `{ published, refused, queued }`.
- **Coverage**: COMPLETE, or PARTIAL_DECLARED with every omitted component enumerated; never undeclared.
  Over-measurement is a hard block, never a disclosure; a deduction defers (JUNCTION_DEFERRED) only
  where the published figure is then under. Refusals carry closed reason codes (the refusal register,
  Q-07). "A partial faulty estimate is more harmful than no estimate."
- **Junctions (L-MEA-09)**: one owner per junction, pile › cap › column/wall › beam › slab. Verticals
  floor-to-floor through the joint, band-aware; beams `b × (D − t_slab) × clear` between support faces
  below the soffit, the thicker slab governing; slabs run through, less column/wall areas and openings.
- **Rebar (AM-03)**: the kg/m table bills, d²/162 only checks; laps are their own component (LAP) beside
  NET, never a percentage; wastage and binding wire touch resource outputs only. BS 8666 governs the
  BBS: the raw cutting length is never rounded, one rounded surface (≤ 25 mm), the IS-additive figure
  printed beside and never billed. Shape 51 is `2(A + B) + 2C − 2.5r − 5d`.
- **Levels**: a level is a surrogate id; label/ordinal/height never key. Storey height is a set of
  readings (D-001: a storey stated in two notations is one storey). A bare typical caption registers
  UNRESOLVED rows with no line (`TYPICAL_RANGE_UNSTATED`); I-368 refuses offers on register keys in the
  UNRESOLVED slot.
- **The register reads the notes through the ONE resolver** (`929a37c2`). Sessions 5–6 established: a
  viewport's title captions its model-space region (I-290); block bubbles georeference (I-292); `EL`
  marks propose the stack (I-293); the stacked schedule reads (I-294); a feet-and-inches dimension scales
  a unitless header (I-295); an ordinal-word band covers the stack's floor labels; the unit a drawing
  DECLARES is the last word on a unitless section (I-302); a plan note naming a mark is evidence about
  the MEMBER (I-303); the plan states a column's SHAPE and the schedule its SIZE (I-304); a circular
  column is PRISM_POLY billed by `rcc.column.circular.concrete@1` (I-305).
- **Beams**: no beam line reaches COMPLETE before FRM-4 (slab thickness per side, lift-core walls as
  supports, support faces per storey). The ties need the joint depth, and the vertical beams need FRM-3
  (TEXT rotation through L-CAD-05, an EntityGraph bump that re-keys the corpora).
- Rules as data, methods as code: a method is one Expr tree that prints the formula and computes the
  figure; the notation grammar is a table and its corpus a ratchet (may grow, never shrink). Registries
  split per area, assembled by enumeration, each barrel with a duplicate-key test.
