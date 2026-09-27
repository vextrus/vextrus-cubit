# The MVP delivers the Priced BOQ, the Material Schedule and the Live Model together

The MVP's paid result, for a Developer's MD, is three things from one QS-confirmed Takeoff of the
building's 2D drawings: the Priced BOQ (what the building will cost), the Material Schedule (what to
buy, and before which Construction Stage) and the Live Model in 3D, every discipline once read (ADRs 0035, 0040). Money is
in M1, not deferred behind a perfect Takeoff; deferring it is part of why Vextrus Cubit failed
(docs/postmortem.md).

**A whole-building figure from M1.** Every Takeoff Step carries a Cost Basis: measured, or an
allowance held as consumption per sft of Gross Floor Area priced at current Market Prices (Vextrus's
default, then the Developer's past projects), clearly marked. A step keeps its allowance, whole, until
it is confirmed, with "measured so far" beside it and a "likely over allowance" flag when the
projection passes it. The
Target Cost is tested against measured + allowance, so it warns early. M1 prices the frame, piles and
pile caps by Rate Analyses on the Developer's editable Market Prices; mat foundations and derived
earthwork are M2.

**A step may close while Questions are open.** The QS may close a Takeoff Step with Questions still
open: the step switches from allowance to measured, and each Element a Question holds is priced at its
best candidate (the pre-picked one where two sources agree) and flagged "awaiting answer" in the grid,
the Project Summary and exports, counting in the measured share only once answered. An Element that
failed (no candidate) is typed or excluded with a reason before the step closes.

**"When" is a Construction Stage, not a date.** The Material Schedule runs materials down the side and
stages and floors across the top, in a fixed sequence the Developer may rename but not reorder:
piling; substructure; the frame, one stage per slab casting; masonry; finishes; services; external
works. Rebar splits by diameter from the drawing, or by an "assumed" split by ratio. Each Resource has
an editable procurement lead time, so the schedule says what to order before each stage. The Project
Summary shows ৳ by stage. Real dates wait for 4D after the MVP.

**Structure.** The Priced BOQ's seven BOQ Sections, numbering and columns, and the Material Schedule's
materials and units are in docs/specs/bd-defaults.md.

After the MVP, Level 3 comes first (a written explanation of each Revision Comparison), then cost
control during construction as the first new module; modules after it are chosen by what beta
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
  confirmed. Held per Trade, concrete and rebar stayed allowances until steps 5–10 were all confirmed,
  and the Project Summary prototype showed 7 % measured with most of the frame done. Defaults are
  Vextrus's (set by the owner), then the Developer's past projects. The owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision, refining the above): each step's allowance is held as consumption per
  sft of Gross Floor Area (concrete cft, rebar kg, bricks…) priced at current Market Prices, so a price
  change moves unmeasured steps too; the Target Cost is tested on the full Estimate. Evidence: the
  Project Summary prototype (docs/design/screens.md). The owner's ruling: "Q49 Agree".
- 26 Sep 2026 (owner's decision): after the MVP, Level 3 first, then cost control, matching
  docs/milestones.md. The owner's ruling: "Agree, Level 3 first".
- 27 Sep 2026 (owner's decision, session 02 Q8): the default allowances per Takeoff Step are the
  consumptions in docs/research/tax-and-allowances.md §B.2 on its reference building, every assumption
  verified, Low confidence, replaced by the Developer's past projects (docs/specs/bd-defaults.md). The
  owner's ruling: "Agree with your recommendation on Q8, all ✓".
- 27 Sep 2026 (owner's decision, session 02 Q22): a step may close with Questions open, held Elements
  priced at their best candidate and flagged "awaiting answer" (as a Revision awaiting the QS is), failed
  Elements typed or excluded first. Evidence: the session-02 priced prototype, where 157 held Elements kept
  99 % of the measured money on allowance ("1.1 % measured"). The owner's ruling: "Agree with B on Q22".
- 28 Sep 2026 (session 02): the three outputs read from the Live Model (ADR 0035), every Discipline Part
  included once read (MEP from M3, ADR 0040); "Building Model" renamed.
