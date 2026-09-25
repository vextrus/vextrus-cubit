# Rod is priced by ratio first, and read from the drawing element type by element type

Each element gets rod by Rod Ratio as soon as it is confirmed, so the Priced BOQ and the Material
Schedule are whole from the first milestone. Rod read from the drawing then replaces the ratio one
element type at a time: columns in M1, then beams, then slabs in M3. **The owner's condition: rod from
the drawing is a must, not an option;** ratio rod must not become the permanent answer. Each of
columns, beams and slabs is a finish line judged on the Development Sets and the Held-out Sets
(ADR 0005).

- **Three Rod Bases,** shown on every rod figure: *by ratio*; *from the drawing* (every bar, lap and
  hook stated on the drawing); *from the drawing + rules* (bars read; laps, hooks, anchorage,
  stock-length cutting and wastage supplied by Measurement Rules where the drawing is silent, each
  assumed length traced to its rule). The Priced BOQ shows the share of rod from the drawing.
- **Rod Ratios** are set per element type, overridable per Storey Band by the QS; defaults in
  docs/specs/bd-defaults.md, editable by the Developer.
- **Ratio rod enters the Material Schedule with a diameter split marked "assumed",** from a default
  split per element type.
- **Laps** are measured as a separate visible line beside the net bars and enter the Material
  Schedule; an unstated lap defaults to 40 × bar diameter (editable), making the basis "from the
  drawing + rules".
- **Where a plan and a section disagree,** a precedence rule is confirmed once per consultant.
- **Rod from the drawing is accepted by two Checks** (ADR 0027): every bar inside its concrete, and
  schedule totals that sum back.

Rejected: from the drawing only in the first milestone (the hardest reading; Vextrus Cubit reached
only column rod in five weeks, and the money would be incomplete, docs/postmortem.md causes 2 and 4);
ratio only (approximate, and no real diameters for procurement). Ratios are how Dhaka engineers make
early estimates; marking the basis keeps the product honest with the MD.

## History
- 25 Sep 2026: decided, with the owner's condition above.
- 26 Sep 2026 (owner's decision): three Rod Bases, ratios by Storey Band, an assumed diameter split.
  Evidence: plan review M2, QS critic #8, #9 (docs/reviews/). The owner's ruling: "Agree".
- 26 Sep 2026: the default Rod Ratios. Evidence: docs/specs/bd-defaults.md (no primary source; set
  from practice). The owner's ruling: "Agree and yeah all right".
- 26 Sep 2026: laps (rule R3). Evidence: docs/specs/bd-defaults.md. The owner's ruling: "Agree and
  yes".
- 26 Sep 2026: milestone numbers follow the reorder (beam and slab rod are M3).
