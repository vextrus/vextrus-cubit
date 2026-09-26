# The MVP delivers the Priced BOQ, the Material Schedule and the Building Model together

The MVP's paid result, for a Developer's MD, is three things from one QS-confirmed Takeoff of the
building's 2D drawings: the Priced BOQ (what the building will cost), the Material Schedule (what to
buy, and before which Construction Stage) and the Building Model in 3D (the visible proof). Money is
in M1, not deferred behind a perfect Takeoff; deferring it is part of why Vextrus Cubit failed
(docs/postmortem.md).

**A whole-building figure from M1.** Every Trade carries a Cost Basis: measured, or an allowance in
৳/sft of floor area (Vextrus's default or the Developer's past projects), clearly marked. A Trade
keeps its allowance until every Takeoff Step feeding it is confirmed, with "measured so far: ৳X of an
allowance of ৳Y" beside it; Vextrus proposes the switch and the QS may switch earlier (recorded). The
Target Cost is tested against measured + allowance, so it warns early. M1 prices the frame, piles and
pile caps by Rate Analyses on the Developer's editable Market Prices; mat foundations and derived
earthwork are M2.

**"When" is a Construction Stage, not a date.** The Material Schedule runs materials down the side and
stages and floors across the top, in a fixed sequence the Developer may rename but not reorder:
piling; substructure; the frame, one stage per slab casting; masonry; finishes; services; external
works. Rod splits by diameter from the drawing, or by an "assumed" split by ratio. Each Resource has
an editable procurement lead time, so the schedule says what to order before each stage. The Project
Summary shows ৳ by stage. Real dates wait for 4D after the MVP.

**Structure.** The Priced BOQ's seven BOQ Sections, numbering and columns, and the Material Schedule's
materials and units are in docs/specs/bd-defaults.md.

Cost control during construction is the next module; modules after it are chosen by what beta
Developers ask for.

## History
- 25 Sep 2026: decided.
- 26 Sep 2026 (owner's decision): a whole-building figure from M1 (Cost Basis; Target Cost on measured
  + allowance; Market Prices and the frame's Rate Analyses in M1; piles and pile caps in M1).
  Evidence: QS critic #5, docs/reviews/session-01-qs-critic.md. The owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision): "when" is a Construction Stage. Evidence: QS critic #11. The owner's
  ruling: "Agree".
- 26 Sep 2026: when a Trade switches from allowance to measured. Evidence: docs/data-model.md §6.
  The owner's ruling: "Agree".
- 26 Sep 2026: the Priced BOQ structure and the Material Schedule's materials, as verified. Evidence:
  docs/specs/bd-defaults.md, docs/research/qs-defaults.md. The owner's rulings: "Agree" (structure);
  "Agree" (Material Schedule).
- 26 Sep 2026 (owner's decision, reopening the allowance-switch ruling on prototype evidence):
  allowances are held **per Takeoff Step**, not per Trade: each step carries an allowance in ৳/sft of
  Gross Floor Area for everything it brings, replaced whole by its measured figure when the step is
  confirmed. Held per Trade, concrete and rod stayed allowances until steps 5–10 were all confirmed,
  and the Project Summary prototype showed 7 % measured with most of the frame done. Defaults are
  Vextrus's (set by the owner), then the Developer's past projects. The owner's ruling: "Agree".
