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

Evidence: Glodon GTJ, the one tool that does this at scale, works in this order
(docs/research/2d-to-bim-approaches.md). The session 10 prototype showed that rules plus cross-sheet
checks get the structure mostly right, and that the checks turn silent errors into Questions
(docs/research/2d-to-bim-prototype-lessons.md).
