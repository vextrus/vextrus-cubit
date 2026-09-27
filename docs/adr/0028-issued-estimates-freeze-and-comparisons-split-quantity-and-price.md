# An Issued Estimate is frozen; every comparison splits quantity from price

The QS or the MD issues the Estimate, which freezes a snapshot of the Priced BOQ, the Material
Schedule, the Market Price set, the Rule Set version and the Live Model's state, with an issue
number and date, down to its Measurement Lines: each line keeps its Element, BOQ Item, quantity in the
Billing Unit and frozen rate, so every Element has a working cost (computed on read) and an issued
cost under each Issued Estimate (frozen), the budget cost control compares As built against. Exports carry the issue's number and date; the working Estimate stays live beside
it. Every comparison (a Revision Comparison, a re-measure after a rule edit, a price update) shows the
quantity effect and the price effect separately, against a baseline the MD picks: the previous
Revision or any Issued Estimate.

**Market Price sets are copied on issue, not on every edit.** Edits go into the current working set;
a new set is copied only when an Issued Estimate freezes the current one. Each price keeps its
last-changed date.

Why: ADR 0006 has one Market Price change update every rate and amount, which is right for a working
estimate and wrong for a figure the MD has taken to the board; rebar moves 20–30 % in a year. After
construction starts the baseline is the issued figure, not the previous drawing. Rejected: one live
estimate with an audit log (the MD needs a figure that does not move, and a log does not say what a
change was due to).

## History
- 26 Sep 2026: decided; amends ADRs 0006 and 0015. Evidence: QS critic #3, #16
  (docs/reviews/session-01-qs-critic.md); the architecture critic's pinned Rule Set version. The
  owner's ruling (26 Sep 2026): "Agree".
- 26 Sep 2026 (owner's decision): sets are copied on issue, not on every edit. Evidence:
  docs/data-model.md §6. The owner's ruling: "Agree".
- 27 Sep 2026 (owner's decision, session 02 Q7): issuing also freezes the Measurement Lines, so each
  Element has an issued cost; live money is still never stored (ADR 0031). Evidence: docs/data-model.md
  §3.5 froze only per item and per storey. The owner's ruling: "Agree with B on Q7".
