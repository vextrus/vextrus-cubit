# Measurement Rules are data the Developer can read and edit, defaulting to IS 1200 with PWD's conventions

The quantities in the Priced BOQ come from the Building Model through Measurement Rules held as data,
not code. Each rule is written in words a QS reads. Each Developer has its own Rule Set, a copy of the
Bangladeshi default: about 50 rules, IS 1200 as written with PWD's item conventions on top, each
labelled with its source, with Dhaka-practice parameters (docs/specs/bd-defaults.md; for example 450 mm
excavation working space). Rule Sets are versioned; each project pins a version, and a rule edit is an
explicit re-measure (ADR 0031). Every figure's Trace names the rules that produced it. The Building
Model holds confirmed facts; all measurement judgement lives in the Rule Set: opening deductions,
formwork, plaster, Billing Units (ADR 0008), rod detailing (ADR 0010).

**Junction ownership is a Measurement Rule.** Who owns concrete where members overlap is a rule,
defaulting to IS 1200 Pt 2 cl. 4.2.2: the slab runs over beams and columns; a column stops at the slab
soffit; a beam runs between column faces below it. Masonry deducts the concrete embedded in it. One
function applies it for both the quantities and the 3D geometry, so the picture and the figures cannot
disagree, and a Check (ADR 0027) proves the owned volumes sum exactly to the union of the concrete.

Why: QSs will argue with the numbers, and a visible rule settles the argument quickly; Developers'
habits differ, and the Rule Set is where that difference belongs. Rejected: rules hard-coded to one
standard or to "Dhaka practice" (invisible and unarguable), and junction ownership as a fixed engine
order (the split between items changes the money). OpenConstructionERP holds quantity maps as data but
applies no measurement standard (docs/research/oce-algorithms.md).

## History
- 25 Sep 2026: decided, defaulting to PWD practice.
- 26 Sep 2026 (owner's decision): junction ownership is a Measurement Rule. Evidence: plan review M4,
  the QS and architecture critics (docs/reviews/). The owner's ruling: "yes, agree on junction
  ownership".
- 26 Sep 2026: the default Rule Set is IS 1200 as written with PWD's item conventions, with the
  practice parameters set. Evidence: docs/research/qs-defaults.md §1, docs/specs/bd-defaults.md. The
  owner's ruling: "Agree, 450".
