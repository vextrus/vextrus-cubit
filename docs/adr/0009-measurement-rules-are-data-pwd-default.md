# Measurement Rules are data the Developer can read and edit, defaulting to PWD practice

The quantities in the Priced BOQ come from the Building Model through Measurement Rules held as data,
not code. Each rule is written in words a QS reads. Each Developer has its own Rule Set, which starts
as a copy of a Bangladeshi default based on PWD practice. Changing a rule re-measures the Priced BOQ,
and every figure's Trace names the rules that produced it. The Building Model stays pure geometry;
all measurement judgement lives in the Rule Set. Examples of what a rule decides:
- the brickwork deduction for openings;
- whether formwork is a separate item;
- where a beam and a column stop at their joint;
- how plaster is measured.

We chose this because QSs will argue with the numbers, and a visible rule settles the argument
quickly. Developers' habits differ, and the Rule Set is where that difference belongs.

We rejected rules hard-coded to one standard (PWD or IS 1200) and rules hard-coded to "Dhaka
practice": both are invisible and unarguable. OpenConstructionERP holds quantity maps as data but
applies no measurement standard (docs/research/oce-algorithms.md); this is where we go further.

## Amended: junction ownership is a Measurement Rule (owner's decision, 26 Sep 2026)
"The Building Model stays pure geometry" left unsaid who owns concrete where members overlap (tie
beams through caps, beams into columns, slabs over beams, lintels in wall lines). The plan review (M4)
proposed a fixed engine order; the QS and architecture critics (docs/reviews/) disputed it, because
IS 1200 practice runs the slab over beams and columns, stops columns at the slab soffit and runs beams
between column faces below it, and because the split between items changes the money. So junction
ownership is a Measurement Rule in the Rule Set, defaulting to IS 1200 / PWD practice, with masonry
deducting the concrete embedded in it. One function applies it for both the quantities and the 3D
geometry, so the picture and the figures cannot disagree. A Check (ADR 0027) proves the owned volumes
sum exactly to the union of the concrete. The owner's ruling: "yes, agree on junction ownership".
