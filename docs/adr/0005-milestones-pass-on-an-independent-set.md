# Every milestone passes on the Sample Project and on an Independent Set

A milestone is done only when its finish line passes, in the running product, on both the Sample
Project and at least one Independent Set: a real Drawing Set that the Vextrus team did not draw.

From day one the Independent Set is the Edison set. A Vextrus core member works at Edison Real Estate
Ltd. and has obtained permission to use it for development. It is read and analysed locally, it is
never committed or put into an issue, and its content becomes demo material only with the owner's
permission. Sets from client Developers' real projects join it as they arrive, with each client's
permission.

This rule exists because Vextrus Cubit passed every gate on drawings it generated itself and was
never tested on a drawing it did not author (docs/postmortem.md, cause 1). A reader that passes only
on the Sample Project is not done.

## The Hand Takeoff (owner's decision, 25 Sep 2026)
A team engineer measures one typical floor of the Sample Project and of each Independent Set by hand,
as a QS normally does. The figures are kept in `.private/` and out of every build session's reach.
The owner compares Vextrus's figures with them when walking M1 and M2. It is our own truth, made from
the drawings, not from a model an agent could fit to.

## Amended: development sets and Held-out Sets (owner's decision, 26 Sep 2026)
Plan review C3 (docs/reviews/plan-review-ledger.md): once the readers' rules are fitted to a set, that
set no longer proves reading. So the Sample Project and the Edison set are **Development Sets**: build
sessions read them, and they prove that nothing regressed. Proof that Vextrus reads Dhaka drawings
comes from **Held-out Sets**, real sets from other consultants that no build session ever opens,
scored by the owner only. The owner's ruling: "one held-out set before M1, two before M2". A milestone
does not close without them. Research agrees: "rules fitted to one office fail at the next", so prove
it "on two or three real consultant sets" (docs/research/2d-to-bim-approaches.md:389, :443).

## Amended: what "agree" means (owner's decision, 26 Sep 2026)
Plan review C1 and the QS critic (docs/reviews/): "agree" had no tolerance and the Hand Takeoff
checked only a typical floor, where errors are cheapest to catch. The owner's ruling: "accept these
tolerances and five zones".
- **Counts exact:** sheets, views, storeys, grid lines, columns, beams, slab panels, openings, rooms.
- **Per BOQ item line:** concrete ±1 %; rod from the drawing ±3 %; formwork ±3 %; masonry and plaster
  ±3 %; finishes ±5 %. Each zone's ৳ total ±2 %. Rod by ratio is not compared.
- **One written Rule Set on both sides:** the Hand Takeoff is measured under the same signed
  Measurement Rules as the product.
- **Five zones:** foundations and substructure; the ground / podium floor; one typical floor; one
  non-typical upper floor where the building has one; the roof with the stair and lift tower. M1
  checks the frame in the zones it covers; M2 checks all five.
- Each Held-out Set gets its own Hand Takeoff. Scoring is blind (ADR 0026).
