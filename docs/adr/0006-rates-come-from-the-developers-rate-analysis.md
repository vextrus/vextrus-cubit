# Working rates come from the Developer's Rate Analysis; PWD SoR is the benchmark

Every item in the Priced BOQ is priced by its Rate Analysis: the Resources it consumes per unit, at
the Developer's Market Prices. That matches how Dhaka Developers price: they buy materials themselves
and hire labour-only contractors (Labour Contracts), and only rarely give a trade out on a
Material-and-Labour Contract. The PWD Schedule of Rates rate is shown beside each item as a Benchmark
Rate, never as the working rate.

The same Rate Analysis yields both the money and the Material Schedule, so the two MVP outputs
cannot disagree, and a change in one Market Price updates every rate and amount. Vextrus ships a
Bangladeshi starting library of Rate Analyses (drawn from PWD SoR practice and its analysis of rates,
editable per Developer) so a new client does not start blank.

Considered: PWD SoR item rates as the working rate (rejected: Developers use them only as a
reference) and the Developer's rates alone (rejected: a benchmark is how an MD checks a figure).
The three-layer idea (item → resources → prices) was learnt from OpenConstructionERP and is
re-expressed in our own design; its CWICR data has no Bangladesh base and is non-commercial.

## Amended: the build-up above direct cost, and a like-for-like Benchmark (owner's decision, 26 Sep 2026)
The QS critic (#1, docs/reviews/session-01-qs-critic.md) found the price stopped at direct cost. The
QS-defaults research (docs/research/qs-defaults.md) measured the Benchmark's gap: PWD rates carry 10 %
profit, 3.5 % overhead and 10 % VAT, so a printed rate is about 1.261 × direct cost, and PWD's own
"22.703 % extra" matches (1.135) ÷ (1 − VAT). So:
- **The Estimate is an ordered build-up the Developer edits:** direct cost (the items) + preliminaries
  and site overheads (as items or a % of direct cost) + contingency % + taxes (VAT and AIT, dated rates
  held as data). The Priced BOQ shows each layer; cost per sft is quoted on the Estimate, with direct
  cost beside it.
- **The Benchmark Rate is shown as printed and net of PWD's mark-ups,** so an MD compares like with
  like. The mark-up figures are data with their SoR edition and date.
- No profit layer: the Developer does not bill itself.

The owner's ruling: "Agree".
