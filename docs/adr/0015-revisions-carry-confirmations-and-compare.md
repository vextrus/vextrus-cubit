# A Revision carries Confirmations over, and the MD sees a Revision Comparison

When a consultant issues a Revision, Vextrus reads it and matches each element to its predecessor;
unchanged elements keep their Confirmation, and only new, removed or changed elements return to the QS
as Proposals. The MD then sees a Revision Comparison: what changed, element by element, and its effect
on the Priced BOQ in quantities and ৳, split into quantity and price effect against a baseline the MD
picks (ADR 0028). Matching needs no LLM.
- **Identity per Element Family:** columns by grid intersection and Storey Band; beams by axis
  segment; walls by axis overlap; slabs by polygon overlap; openings by host wall and position. A mark
  is a hint, never the key.
- **Revisions are per sheet:** a Drawing Set's state maps each sheet to its Sheet Revision, and a
  Revision changes only the elements on the sheets it reissues.
- **A reader upgrade runs through the same matching from M1,** so Confirmations carry over. The first
  test: re-reading the same revision gives zero changes.
- **While a Revision awaits the QS,** changed and removed elements keep their last confirmed figure,
  flagged "changed in rev B, awaiting Confirmation" wherever it appears (the grid, the Project Summary,
  exports); new elements count for nothing until confirmed.
- **A real revision pair** from a founding client or Edison is an explicit dependency of M4; M4 does
  not pass on a revision the team drew.

Why: in Dhaka the revised drawing is the instruction, and revisions are included in the price for 6
months (ADR 0033). Most tools deliver only a new total, so the element-by-element comparison shows
Vextrus's quality; Glodon re-confirms only what changed (docs/research/glodon-bim-2.md). Stable
identity is what cost control needs later. Rejected: re-take-off from scratch (every Confirmation
repeated, nothing learnt about the change). An AI narrative of the change is the first Level 3 job,
after the MVP (ADR 0011).

## History
- 25 Sep 2026: decided, matching by grid position, storey and mark.
- 26 Sep 2026 (owner's decision): identity per family, revisions per sheet, reader upgrades as
  Revisions, a real revision pair. Evidence: plan review M5; architecture critic #3, #5; refuter #4
  (docs/reviews/). The owner's ruling: "Agree, yes" (the owner will obtain a real revision pair).
- 26 Sep 2026: while a Revision awaits the QS. Evidence: docs/data-model.md §6. The owner's ruling:
  "Agree".
- 26 Sep 2026: baselines and the quantity / price split move to ADR 0028; milestone renumbered (M4).
