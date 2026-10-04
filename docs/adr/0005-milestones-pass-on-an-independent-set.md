# Milestones are proven on Held-out Sets, checked for regression on Development Sets, and measured against a Hand Takeoff

A milestone is done only when its finish line passes in the running product, walked by the owner and
the team:
- **On the Development Sets** (the Sample Project and the Edison set), which build sessions read and
  fit the readers to. They prove only that nothing regressed. A Vextrus core member works at Edison
  Real Estate Ltd. and obtained permission to use its set for development; it is read locally, never
  committed or put in an issue, and shown only with the owner's permission.
- **On the Held-out Sets:** real sets from other consultants that no build session ever opens,
  scored only by the owner. They are the proof that Vextrus reads Dhaka drawings. One is required
  before M1 closes, two before M2, and one with MEP drawings before M3; each is scored first as an
  unknown office's first read (ADR 0039). Client Developers' sets join as they arrive, with permission.

**Agreement is measured against a Hand Takeoff:** a team engineer's manual measurement of five zones
(foundations and substructure; the ground / podium floor; one typical floor; one non-typical upper
floor where there is one; the roof with the stair and lift tower), under the same signed Rule Set as
the product. Each Independent Set (the Edison set and every Held-out Set) gets its own; the Sample
Project is scored against its generating inputs instead (see History). It is an Answer Key, scored blind (ADR 0026).
- Counts exact: sheets, views, storeys, grid lines, columns, beams, slab panels, openings, rooms.
- Per BOQ Item line: concrete ±1 %; rebar from the drawing ±3 %; formwork ±3 %; masonry and plaster
  ±3 %; finishes ±5 %. Each zone's ৳ total ±2 %. Rebar by ratio is not compared.
- M1 checks the frame in the zones it covers; M2 checks all five.

Why: Vextrus Cubit passed every gate on drawings it generated itself (docs/postmortem.md, cause 1),
and rules fitted to one office fail at the next, so prove it "on two or three real consultant sets"
(docs/research/2d-to-bim-approaches.md:389, :443).

## History
- 25 Sep 2026: decided (every milestone on the Sample Project and an Independent Set, from day one
  the Edison set). The Hand Takeoff of one typical floor was the owner's decision.
- 26 Sep 2026 (owner's decision): Development Sets and Held-out Sets. Evidence: plan review C3,
  docs/reviews/plan-review-ledger.md. The owner's ruling: "one held-out set before M1, two before M2".
- 26 Sep 2026 (owner's decision): what "agree" means (tolerances, five zones, one Rule Set). Evidence:
  plan review C1 and the QS critic, docs/reviews/. The owner's ruling: "accept these tolerances and
  five zones".
- 26 Sep 2026 (clarification): "before M1" means before M1 closes. The owner's ruling: "before M1
  closes."
- 26 Sep 2026 (owner's decision): the Sample Project needs no Hand Takeoff. Its counts and geometry
  are scored blind against its generating agent's inputs (an Answer Key, ADR 0026); its quantities
  are checked only as arithmetic, never as proof. Edison and each Held-out Set keep their five-zone
  Hand Takeoffs. The owner's ruling: "Agree".
- 28 Sep 2026 (owner's decisions, session 02 Q16, Q29): each Held-out Set is scored first as an unknown
  office's first read (no Drafting Profile of its office), then with one if it exists (ADR 0039); M3 (MEP)
  needs one Held-out Set with MEP drawings. The blind scoring starts in M1 (ADR 0030).
- 4 Oct 2026 (the owner's decision, session 12 Q7; ADR 0042): the Development Sets, the Edison set among them, may
  also be read by cloud sessions, through a private drawings repository and a read-only token, after a probe
  (docs/specs/factory.md §2.4). They are still never committed to the public repository or put in an issue; Held-out
  Sets stay local. The owner's ruling: "Q7 drawing data - I'm allowing to be more easy going on this case and cloud
  sessions may read drawing and enabling Remote Control for most cases if that means more power and performance by
  allowing some privacy issues that I'm allowing willingly".
