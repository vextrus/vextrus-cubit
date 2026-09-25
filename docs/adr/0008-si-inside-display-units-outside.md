# Quantities are stored in SI and shown in the project's Display Units

Every quantity, dimension and rate is held in SI inside Vextrus (the Building Model, the maths, the
Rate Analyses). What the QS sees is formatted at the edge in the project's Display Units, which
default to private Dhaka practice:
- cft for RCC and earthwork;
- sft for plaster, flooring and brickwork;
- rft for skirting and railings;
- kg or ton for rod;
- bags for cement.

Metric is one switch away. The Benchmark Rate (PWD, metric) is converted to the same unit so it sits
beside the working rate. Money is always ৳, grouped in lakh and crore. Grouping applies to money
only, never to lengths or coordinates.

We chose this because private practice measures in imperial while PWD and the codes are metric, so a
BOQ in m³ looks foreign to a Dhaka QS. SI inside keeps the engineering, the IFC model and later
markets correct. One unit system inside plus a formatting layer outside prevents a class of error
Vextrus Cubit shipped: lakh grouping on millimetre coordinates. Drawings arrive in their own units
(the Edison set is in inches) and are converted to SI on reading.

## Amended: where units convert, and how money rounds (owner's decision, 26 Sep 2026)
Three findings broke "every quantity, dimension and rate in SI, converted on reading": the plan
review's M8 (the laboratory kept drawing units to the end; precision differs by discipline; spacing
text must stay verbatim), the architecture critic's #10 (a per-m³ rate is the per-cft rate ÷
0.028316846592, which does not terminate, so qty × rate stops matching the QS's own check and the
Excel file) and the QS critic's #7 (a unit belongs to the item: 10" walls in cft, 5" in sft, bricks in
nos, doors in sft). Reviews: docs/reviews/. So:
- **Drawings stay in their own units,** each view with its confirmed scale, and convert to SI with
  exact factors only when the Building Model is assembled. The Building Model and the engineering are
  SI.
- **Money stays in the unit it is quoted in:** each Market Price and rate is an exact decimal per cft,
  bag, sft or whatever unit the market quotes.
- **Each BOQ item has a Billing Unit, set in the Rule Set.** Its quantity is rounded to two decimals
  in that unit, and amount = rounded quantity × rate, exact to the paisa. Excel carries the same
  values with live formulas; a test checks qty × rate = amount on every row.
- **Imperial or metric stays one switch per project,** and the switch re-bills the Priced BOQ in the
  other units rather than relabelling it.

Lakh grouping stays at the edge, for money only. The owner's ruling: "yes, agree on units and
rounding".

## Amended: rounding as a QS rounds (owner's decision, 26 Sep 2026)
Each Measurement Line is rounded to two decimals in its Billing Unit and an item's quantity is their
sum; countable units (nos, bags, kg of rod) round to whole numbers and tons show three decimals (a
Rule Set parameter); rates are held to the paisa; amount = ROUND(quantity × rate, 2); the Estimate's
layers are computed on rounded amounts; the Material Schedule rounds up. The owner's ruling: "Agree".
