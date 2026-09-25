# Takeoff is building-first, element by element, with bulk Confirmation

The QS builds the Building Model one Takeoff Step at a time, in the order a building is built and
measured: storeys and their heights, the grid, foundations, columns, beams, slabs, stairs, walls and
openings, then finishes. Each step draws on every sheet that carries that element type (layout,
schedule, section). The machine proposes; the QS confirms in bulk ("86 columns match the schedule;
3 need you"), with the exceptions pulled out. A fact the machine cannot read or finds in conflict
becomes one Question at that point, answered once for every element it unblocks. The Building Model
grows in 3D after each step, and the Priced BOQ fills in as it grows.

Considered options:
- Sheet by sheet (Bluebeam/PlanSwift style). Rejected: the same element appears on a layout, a
  schedule and a section, so it would be confirmed three times, and the model is whole only at the end.
- Fully automatic, reviewed at the end. Rejected: Vextrus Cubit refused every line missing one fact
  and measured almost nothing (docs/postmortem.md, cause 2).

Evidence: Glodon GTJ, the one tool that does this at scale, works element by element
(docs/research/2d-to-bim-approaches.md), though it recognises foundations last (:96); our order is the
order a building is built and measured. The session 10 prototype showed that rules plus cross-sheet
checks get the structure mostly right, and that the checks turn silent errors into Questions
(docs/research/2d-to-bim-prototype-lessons.md).

## Amended: the full list of Takeoff Steps (owner's decision, 26 Sep 2026)
The plan review (M6) and the QS critic (#6, #12, #13; docs/reviews/) found families that cost real
money missing. The steps, in building order, each with its Checks (ADR 0027):
1. **Sheets**: the sheet list.
2. **General Notes and Specification**: concrete grade per member, rod grade, cover, laps, mortar
   mixes, brick class; they decide each member's rate item and supply the rod rules.
3. **Storeys and levels**, from level lines; a dissenting level mark is a candidate local level and a
   Question, never a typo by default (plan review M7).
4. **Grid.**
5. **Foundations and substructure**: piles as a whole family (boring, concrete, rod, cut-off, head
   breaking, tests); caps, mat or footings; grade and tie beams; basement walls and ramps. Earthwork
   (excavation, sand filling, soling, lean concrete, backfill) is derived from them by Measurement
   Rules, not read.
6. **Columns, shear walls (their own family) and the lift core.**
7. **Beams.**
8. **Slabs**, with sunk slabs, upstands and voids, and the slab-edge members: sunshades, drop walls,
   fins, cornices.
9. **Stairs**, with landing beams and the lift pit.
10. **Tanks**: underground and overhead water reservoirs, septic tank.
11. **Walls and openings**, with lintels (a stated reason for every opening without one), parapets
    and verandah fills.
12. **Rooms and finishes**: finishes come from the Developer's Specification by room type, applied to
    the confirmed rooms, since consultant drawings rarely state them.
13. **Roof**: treatment, stair room, machine room.
14. **Site works and MEP**: lump sums the QS enters from a template of expected lines, each with a
    ৳/sft sanity range, so a missing lift or generator cannot pass unnoticed.

M1 takes steps 1–4 and 6–8 (the frame); M2 the rest. The owner's ruling: "Agree".
