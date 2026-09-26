# Units: drawing units until assembly, SI in the Building Model, money in its quoted unit, each BOQ Item in its Billing Unit

- **Drawings stay in their own units** (the Edison set is in inches), each view with its confirmed
  scale; spacing text stays verbatim. They convert to SI with exact factors only when the confirm
  service writes the Building Model. The Building Model and the engineering are SI.
- **Money stays in the unit it is quoted in:** each Market Price and rate is an exact decimal per cft,
  bag, sft or whatever unit the market quotes. Money is always ৳.
- **Each BOQ Item has a Billing Unit, set in the Rule Set** (10" brickwork in cft, 5" in sft, bricks
  in nos, doors in sft; defaults in docs/specs/bd-defaults.md). The Benchmark Rate is converted to the
  same unit so it sits beside the working rate.
- **Rounding as a QS rounds:** each Measurement Line to two decimals in its Billing Unit, and the
  item's quantity is their sum; countable units (nos, bags, kg of rebar) to whole numbers, tons to
  three decimals (a Rule Set parameter); rates to the paisa; amount = ROUND(quantity × rate, 2); the
  Estimate's layers on the rounded amounts; the Material Schedule rounds up. Excel carries the same
  values with live formulas, and a test checks quantity × rate = amount on every row.
- **Display Units are one switch per project:** the market's imperial (cft, sft, rft, bags, ton) by
  default, metric one switch away; the switch re-bills the Priced BOQ, never relabels it.
- **Grouping:** money and quantities group in lakh and crore (`1,24,500 kg`), at the edge only.
  Coordinates and dimensions (drawing positions, lengths such as 14'-6") never group.

Why: private Dhaka practice measures in imperial while PWD and the codes are metric, so a BOQ in m³
looks foreign to a Dhaka QS; SI inside keeps the engineering and IFC correct. A per-m³ rate is the
per-cft rate ÷ 0.028316846592, which does not terminate, so rates held in SI would break the QS's own
qty × rate check. One formatting layer at the edge prevents an error Vextrus Cubit shipped: lakh
grouping on millimetre coordinates.

## History
- 25 Sep 2026: decided as "SI inside, converted on reading; lakh for money only".
- 26 Sep 2026 (owner's decision): where units convert, and how money rounds (drawing units to
  assembly; money in quoted units; Billing Units). Evidence: plan review M8, architecture critic #10,
  QS critic #7 (docs/reviews/). The owner's ruling: "yes, agree on units and rounding".
- 26 Sep 2026 (owner's decision): rounding as a QS rounds. Evidence: docs/data-model.md §6. The
  owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision): quantities group in lakh too. Evidence: docs/design/system.md §10.
  The owner's ruling: "Lakh".
