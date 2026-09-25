# Working rates come from the Developer's Rate Analysis; the Estimate is a build-up; PWD SoR is the benchmark

Every BOQ Item is priced by its Rate Analysis: the Resources it consumes per unit, at the Developer's
Market Prices (working rate = Σ materials × (1 + Wastage) × Market Price + labour + plant). The same
Rate Analyses yield the Material Schedule, so money and materials cannot disagree. Vextrus ships a
Bangladeshi starting library (docs/specs/bd-defaults.md), which each Developer edits. Mark-ups never
sit inside item rates.

**The Estimate is an ordered build-up the Developer edits:** direct cost (the items) + preliminaries
and site overheads (as items or a % of direct cost) + contingency % + taxes (VAT and AIT, dated rates
held as data). The Priced BOQ shows each layer; cost per sft is quoted on the Estimate, with direct
cost beside it. No profit layer: the Developer does not bill itself.

**Labour Contracts** have their own unit and scope (for example per sft of casting area, covering rod
binding, shuttering and casting); the quantity comes from a Measurement Rule, and each is its own
line in the Priced BOQ. They belong to the Developer, with a per-project override of rate or scope.
Every item a Labour Contract covers takes no other labour; a Check (ADR 0027) makes each item's labour
come from exactly one source. A Material-and-Labour Contract is the exception: one rate per unit, its
materials outside the Material Schedule.

**The Benchmark Rate** (PWD Schedule of Rates) is shown beside each item, as printed and net of PWD's
mark-ups (10 % profit, 3.5 % overhead, 10 % VAT: printed ≈ 1.261 × direct cost), held as data per SoR
edition. A covered item's Benchmark comparison uses its share of the Labour Contract, allocated in
proportion to the labour its own Rate Analysis would have carried at Market Prices. The Benchmark is
never the working rate.

Why: Dhaka Developers buy materials themselves and hire labour-only contractors. Rejected: PWD rates as
the working rate (a reference only), the Developer's rates with no benchmark (a benchmark is how an MD
checks a figure). The item → resources → prices idea was learnt from OpenConstructionERP and
re-expressed; its CWICR data has no Bangladesh base and is non-commercial.

## History
- 25 Sep 2026: decided.
- 26 Sep 2026 (owner's decision): the build-up above direct cost and a like-for-like Benchmark.
  Evidence: QS critic #1, docs/research/qs-defaults.md. The owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision): Labour Contracts with their own unit and scope. Evidence: QS critic
  #2. The owner's ruling: "Agree".
- 26 Sep 2026: Labour Contracts belong to the Developer; Benchmark allocation. Evidence:
  docs/data-model.md §6. The owner's ruling: "Agree".
- 26 Sep 2026: the Rate Analysis shape and starting library. Evidence: docs/specs/bd-defaults.md. The
  owner's ruling: "Yes agree with the shape and your four recommendations".
- 26 Sep 2026: an Issued Estimate freezes prices (ADR 0028 amends the "one change updates everything"
  rule for issued figures).
