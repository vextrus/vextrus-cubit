# Rod is priced by ratio first, and read from the drawing element type by element type

Each element gets rod by Rod Ratio as soon as it is confirmed, so the Priced BOQ and the Material
Schedule are whole from the first milestone. Rod read from the reinforcement detailing (a real
bar-bending schedule by diameter) then replaces the ratio one element type at a time: columns first,
since schedules read reliably in the prototype, then beams, then slabs. Every rod figure shows its
Rod Basis ("by ratio" or "from the drawing"), and the Priced BOQ shows what share of the rod comes
from the drawing. Vextrus ships default Rod Ratios, which the Developer's QS can edit.

**The owner's condition: rod from the drawing is a must, not an option.** Ratio-based rod is the
starting point and must not become the product's permanent answer. Rod from the drawing for columns,
for beams and for slabs is each a milestone finish line, judged on the Sample Project and an
Independent Set.

Considered options:
- From the drawing only (the owner's first preference). Rejected for the first milestone: it is the
  hardest reading in the set (Vextrus Cubit reached only column rod in five weeks), and it would leave
  the money incomplete, which repeats Cubit's failure (docs/postmortem.md, causes 2 and 4).
- Ratio only. Rejected: approximate, and it cannot give real diameters for procurement.

Ratios are how Dhaka engineers make early estimates, and marking the basis keeps the product honest
with the MD.

## Amended: three Rod Bases, ratios by Storey Band (owner's decision, 26 Sep 2026)
The plan review (M2) and the QS critic (#8, #9; docs/reviews/) found that rod "from the drawing" is
bars read plus detailing rules (drawings often leave laps, hooks and anchorage to a general note), that
a net schedule understates without laps, hooks, stock-length cutting and wastage, and that a ratio
cannot give the diameters the Material Schedule promises. So:
- **Three Rod Bases,** shown on every rod figure: *by ratio*; *from the drawing* (every bar, lap and
  hook stated on the drawing); *from the drawing + rules* (bars read; laps, hooks, anchorage,
  stock-length cutting and wastage supplied by Measurement Rules where the drawing is silent, each
  assumed length traced to its rule).
- **Rod Ratios vary by element type × Storey Band:** one default per element type, overridable per
  band by the QS.
- **Ratio rod enters the Material Schedule with a diameter split marked "assumed"**, from a default
  split per element type.
- **Where a plan and a section disagree,** a precedence rule is confirmed once per consultant.
- **Rod from the drawing is accepted by two Checks** (ADR 0027): every bar inside its concrete, and
  schedule totals that sum back.

The owner's ruling: "Agree".
