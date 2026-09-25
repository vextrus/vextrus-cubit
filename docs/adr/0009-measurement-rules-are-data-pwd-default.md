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
