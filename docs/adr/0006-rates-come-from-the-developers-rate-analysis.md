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
