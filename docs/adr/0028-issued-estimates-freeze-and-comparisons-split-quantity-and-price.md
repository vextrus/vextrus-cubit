# An Issued Estimate is frozen; every comparison splits quantity from price

Market Prices are kept as dated sets: an update makes a new set and keeps the old. The QS or the MD
issues the Estimate, which freezes a snapshot of the Priced BOQ, the Material Schedule, the Market
Price set, the Rule Set version and the Building Model's state; exports carry the issue's number and
date, and the working Estimate stays live beside it. Every comparison (a Revision Comparison, a
re-measure after a rule edit, a price update) shows the quantity effect and the price effect
separately, against a baseline the MD picks: the previous Revision or any Issued Estimate.

Why: ADR 0006 has one Market Price change update every rate and amount, which is right for a working
estimate and wrong for a figure the MD has taken to the board; rod moves 20–30 % in a year. The QS
critic (#3, #16, docs/reviews/session-01-qs-critic.md) found price and quantity effects mixed in the
Revision Comparison, and that after construction starts the baseline is the issued figure, not the
previous drawing. The architecture critic's pinned Rule Set version (docs/reviews/) is part of the
same snapshot.

Considered: one live estimate with an audit log. Rejected: the MD needs a figure that does not move,
and a log does not say what the change was due to.

The owner's ruling (26 Sep 2026): "Agree". Amends ADRs 0006 and 0015.

## Amended: sets are copied on issue, not on every edit (owner's decision, 26 Sep 2026)
Edits go into the current working Market Price set; a new set is copied only when an Issued Estimate
freezes the current one. Each price keeps its last-changed date. What this ADR protects (the issued
figure, and the price effect of every later change) is unchanged. The owner's ruling: "Agree".
