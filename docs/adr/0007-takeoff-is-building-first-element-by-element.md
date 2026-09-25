# Takeoff is building-first, element by element, with bulk Confirmation

The QS builds the Building Model one Takeoff Step at a time, in the order a building is built and
measured. Each step draws on every sheet that carries its Element Family (layout, schedule, section).
The machine proposes; the QS confirms in bulk ("86 columns match the schedule; 3 need you"), with the
exceptions pulled out. A fact the machine cannot read, or a Check that fires (ADR 0027), becomes one
Question at that point, answered once for every element it unblocks. The model grows in 3D after each
step, and the Priced BOQ fills in as it grows.

**The fourteen Takeoff Steps:**
1. Sheets. 2. General Notes and Specification (grades, cover, laps, mixes, brick class; they decide
each member's BOQ Item and supply the rod rules). 3. Storeys and levels, from level lines; a
dissenting level mark is a candidate local level and a Question, never a typo by default. 4. Grid.
5. Foundations and substructure: piles as a whole family, caps, mat or footings, grade and tie beams,
basement walls and ramps; earthwork is derived by Measurement Rules, not read. 6. Columns, shear
walls and the lift core. 7. Beams. 8. Slabs, with sunk slabs, upstands, voids and slab-edge members
(sunshades, drop walls, fins, cornices). 9. Stairs, landing beams, the lift pit. 10. Tanks. 11. Walls
and openings, with lintels (a stated reason for every opening without one), parapets, verandah fills.
12. Rooms and finishes, from the Developer's Specification by room type. 13. Roof. 14. Site works and
MEP: lump sums from a template of expected lines, each with a ৳/sft sanity range.

**M1 takes steps 1–4, piles and pile caps from step 5, and steps 6–8; M2 the rest** (ADR 0002).

Rejected: sheet by sheet (Bluebeam/PlanSwift style: one element confirmed three times, the model whole
only at the end); fully automatic, reviewed at the end (Vextrus Cubit refused every line missing one
fact and measured almost nothing, docs/postmortem.md, cause 2). Glodon GTJ works element by element
(docs/research/2d-to-bim-approaches.md); the prototype showed cross-sheet checks turn silent errors
into Questions (docs/research/2d-to-bim-prototype-lessons.md).

## History
- 25 Sep 2026: decided.
- 26 Sep 2026 (owner's decision): the full list of fourteen Takeoff Steps. Evidence: plan review M6,
  M7 and the QS critic #6, #12, #13 (docs/reviews/). The owner's ruling: "Agree".
- 26 Sep 2026: "M1 takes steps 1–4 and 6–8" corrected to include piles and pile caps, which ADR 0002
  (amended) and docs/milestones.md put in M1.
