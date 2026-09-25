# 2D→BIM prototype: general lessons from one real consultant set

Session 10, 25 Sep 2026. A throwaway prototype read a real Dhaka consultant's structural and
architectural DWGs (an Independent Set, used with permission; its content stays private) and
assembled a crude two-storey IFC4. This file holds only lessons that do not reveal the drawings.
The question and the recommended pipeline come from `2d-to-bim-approaches.md`.

## Result
- A vector-first pipeline (DWG → DXF → ezdxf → rules → IfcOpenShell) produced columns, shear walls,
  beams, slabs and walls at the storey levels read from the drawings. A column, a beam and a slab
  were checked by hand, and their volumes matched.
- Structure came out well; walls only partly (recall roughly 60–75 % by eye). Openings, stairs, lift
  cores and foundations were not attempted.

## Readers
- LibreDWG 0.13.3 is not usable: on one file it exited 0 and wrote a DXF with no entities; on another
  its DXF broke ezdxf (raw line breaks in MTEXT, handle-0 entities, lost anonymous block names).
- LibreDWG 0.14 read both files cleanly and built without root in about two minutes.
- Keep a DXF-repair step, and verify every conversion by comparing entity counts with `dwgread`
  JSON. Never trust the exit code.
- ezdxf is excellent once the DXF is valid.

## How real sets are drawn (what the reader must handle)
- All sheets sit side by side in model space; paper space may be empty. One Discipline laid sheets
  in a row, the other in a grid (category × floor). Sheet frames and title blocks are block inserts.
- **Sheet segmentation is the first failure point.** A sheet region drawn too wide produced dozens
  of phantom columns.
- Whole floor plans can be one block insert with doors nested inside: explode nested blocks.
- Layer names carry drafter-name suffixes and typos: the product needs a layer → member mapping the
  QS confirms once and the product remembers per consultant.
- Units: the set was drawn in inches; cross-check geometry against dimension values.
- Schedules were drawn as lines, text and dimensions, not as AutoCAD tables.

## What rules read reliably
Grid axes and bubbles; column outlines placed on the grid with mark and size; schedule cells; beams
bound to their labels; storey levels as a consensus of repeated level marks (one mark was mistyped; but see the correction below);
registering one sheet onto another through a shared grid intersection.

## Facts the domain forces
- A column's size changes by storey band: a column fact is mark × storey band, not one size.
- Slab thickness varies panel by panel.
- Wall outlines are messy: open, self-intersecting, fragmented.

## Cross-checks turn silent errors into questions
Every wrong binding the rules made (a lift core bound to a column label, an unlabelled beam) was
caught by a size-disagreement check. Cross-checks between sheets are how the machine knows what to
ask the QS.

## What the QS must confirm
Which sheet is which storey; which schedule band covers which storeys; the layer → member mapping;
odd members (lift cores, unlabelled beams); slab thickness per panel and voids; wall fixes; the
measurement rules for wall height and beam depth. Estimated at roughly 170–270 confirmations for a
whole building, mostly walls and the sheet list. That is an estimate, not a timed session.

## IfcOpenShell 0.8.5 pitfalls
Use metres as the project unit so profiles and extrusion depths agree; keep the shape object alive
or `get_volume` returns garbage; `api.run` is gone, so call `ifcopenshell.api.<module>.<fn>`.

## Verdict
Go on LibreDWG ≥ 0.14 → ezdxf → IfcOpenShell, with repair and verification. The hard parts are sheet
segmentation, binding labels to geometry and wall recall, not the libraries. The confirmation
experience is the core of the product.

## Correction (session 01, 26 Sep 2026)
Levels by consensus can erase real local levels. The plan review (M7, docs/reviews/plan-review-ledger.md)
reports that marks disagreeing with the level ladder were sunk and raised zones, not typos. Storeys come
from drawn level lines; a dissenting mark is a candidate local level and a Question (ADR 0007, step 3).
