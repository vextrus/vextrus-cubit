# A Revision carries Confirmations over, and the Developer sees a Revision Comparison

When a consultant issues a Revision, Vextrus reads it and matches each element to its predecessor by
grid position, storey and mark (for example, C-3 at B/2 on the 4th floor). Unchanged elements keep
their Confirmation. Only new, removed or changed elements return to the QS as Proposals. The
Developer then sees a Revision Comparison: what changed, element by element, and what it adds or
saves in the Priced BOQ, in quantities and ৳. Matching needs no LLM.

Considered options:
- Re-take-off from scratch. Rejected: the QS repeats every Confirmation, and the Developer learns
  nothing about what changed.
- An AI narrative of the change ("Revision B adds ৳4.2 lakh, mostly from six enlarged columns").
  This is the first Level 3 job, in the milestone after the MVP (ADR 0011).

Why: in Dhaka the revised drawing is the instruction, and revisions are included in the price for
6 months (ADR 0012). Most tools and consultants deliver only a new total, so the element-by-element
comparison is where Vextrus shows its quality. Glodon's lesson is the same: follow revisions and
re-confirm only what changed (docs/research/glodon-bim-2.md). It also forces the Building Model to
give each element a stable identity across Revisions, which cost control needs later.

## Amended: identity per family, revisions per sheet, reader upgrades as Revisions (owner's decision, 26 Sep 2026)
Marks are unreliable keys, consultants revise sheet by sheet, and the reader will change while clients
hold Confirmations (plan review M5; architecture critic #3, #5; refuter #4; docs/reviews/). So:
- **Identity per element family:** columns by grid intersection and Storey Band; beams by axis
  segment; walls by axis overlap; slabs by polygon overlap; openings by host wall and position. A mark
  is a hint, never the key.
- **A Drawing Set's state maps each sheet to its revision;** a Revision changes only the elements on
  the sheets it reissues.
- **A reader upgrade runs through the same matching from M1,** so Confirmations carry over.
- **The first test:** re-reading the same revision gives zero changes.
- **A real revision pair is an explicit dependency of M3,** from a founding client or Edison; M3 does
  not pass on a revision the team drew.
- Baselines and the quantity / price split: ADR 0028.

The owner's ruling: "Agree, yes" (the owner will obtain a real revision pair).
