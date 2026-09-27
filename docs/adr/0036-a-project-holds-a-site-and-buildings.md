# A Project holds a Site and one or more Buildings, from M0

A **Project** is one Developer's development on one plot: its **Site** (boundary, external works, site
services), one or more **Buildings**, and one Drawing Set. Each Building has its own storeys, grid,
Live Model, Gross Floor Area and price (ADR 0033 already prices per building). Every building-scoped
table and query carries the Building from M0; M0 creates one Building per Project automatically, and
the screens show no building picker until a second one exists. A sheet is assigned to a Building,
defaulting to the only one.

Why: most Dhaka Projects are one building on one plot, but the first Developers who hold multi-building
Projects are the most premium clients, whom Vextrus prioritises. The seam costs one table and a key
before any code exists; retrofitted, it re-scopes every Element, storey, grid, Gross Floor Area,
Revision and price query. Rejected: one building per Project with a second tower as a second Project
(docs/data-model.md §7 as drafted); reading and pricing a second Building in M1–M2 (reading work the
MVP does not need to prove itself; its milestone slot is set when the MVP line is redrawn).

## History
- 27 Sep 2026 (owner's decision, session 02 Q4). The owner's ruling: "Agree with B on Q4 … the
  Developers we'd onboard first have a multi-building project on their books are low but they are the
  most premium client whom we priorities most."
