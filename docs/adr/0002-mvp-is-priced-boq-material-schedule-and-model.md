# The MVP delivers the Priced BOQ, the Material Schedule and the Building Model together

The MVP's paid result, for a Developer's MD, is three things from one QS-confirmed takeoff of the
building's 2D drawings: the Priced BOQ (what the building will cost), the Material Schedule (what to
buy, and when) and the Building Model in 3D (the visible proof that the numbers are right, and what
makes the showcase striking). Money is in M1, the first milestone after the drawings come in, not deferred behind a perfect takeoff,
because deferring it is part of why Vextrus Cubit failed (docs/postmortem.md).

Cost control during construction (budget against actual, progress against the model) is the next
module. Modules after it are chosen by what beta Developers ask for, once the MVP is proven with them.

## Amended: a whole-building figure from M1 (owner's decision, 26 Sep 2026)
The QS critic (#5, docs/reviews/session-01-qs-critic.md) found that a frame-only M1 priced from an
unfamiliar library gives the MD nothing to judge a building by, and that a Target Cost tested against
a BOQ still being measured warns only at the end. So:
- **Every trade carries a Cost Basis, measured or allowance.** A trade not yet measured carries an
  allowance in ৳/sft of floor area (Vextrus's default or the Developer's past projects), clearly
  marked. The MD sees a whole-building figure from the first Confirmation, with the measured share
  rising.
- **The Target Cost is tested against measured + allowance,** so it warns early.
- **Editable Market Prices and the frame's Rate Analyses move into M1,** so M1's ৳ is at the
  Developer's own prices.
- **Piles and pile caps move into M1**; mat foundations and derived earthwork stay in M2.

The owner's ruling: "Agree".

## Amended: "when" is a Construction Stage, not a date (owner's decision, 26 Sep 2026)
The MVP has no schedule, and buyers' instalments in Dhaka follow slab castings (QS critic #11). So the
Material Schedule's "when" is a Construction Stage in a fixed sequence the Developer may rename but
not reorder in the MVP: piling; substructure (caps, grade beams, basement); the frame floor by floor,
one stage per slab casting; masonry; finishes; services; external works. Materials run down the side,
stages and floors across the top; rod splits by diameter from the drawing and by an "assumed" split
by ratio. Each Resource carries an editable procurement lead time, so the schedule says what to order
before each stage. The Project Summary shows ৳ by stage. Real dates wait for 4D after the MVP. The
owner's ruling: "Agree".
