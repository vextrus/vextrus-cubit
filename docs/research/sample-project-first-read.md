# Sample Project: first read by the session-10 prototype pipeline

Session 01, 26 Sep 2026. A `drawing-analyst` agent ran the session-10 prototype on the Sample
Project. Conventions and counts only; the drawings, scripts, facts and overlays stay in
`.private/work/session-01/sample-pipeline/`.

## Conclusions
1. **The prototype's rules transferred at 0 %.** As written, it runs no stage past the first on this
   set. It needed 17 fittings to run end to end, and each fitting is a place a rule was set-specific:
   layer names, label formats, title strings, members drawn as lines instead of outlines.
2. **The layer-independent ideas held once fitted:** grid binding by bubble; level consensus (it
   out-voted a mistyped mark); registering sheets through a grid intersection (exact on the overlay);
   three-way cross-checks (drawn size, per-sheet table, schedule), which found a wrong table where two
   of three sources agreed.
3. **Still broken after fitting:** skewed members; detail views drawn inside a plan sheet (their
   members landed on the plan); slab panel geometry; per-storey exceptions to a "typical" plan; wall
   thickness from 2·area/perimeter on short pieces (11 of 26 wrong); a plan inserted at non-unit scale
   compensated by DIMLFAC; storeys implied rather than named (pile, pile cap, grade beam, stair-room
   roof).
4. **Title-block attributes are the right sheet key when they exist,** but sets burst some title
   blocks to plain text; the reader needs both routes.
5. **The Sample Project reads as a clean, generated set with planted faults, not a consultant's set.**
   Header editing time is about 20 s per file (the Independent Set: 69 and 442 days); the creation
   stamp is a default epoch; the two DWGs were saved 24 s apart; geometry is exact (whole-inch
   offsets, sheets exactly 144 in apart). About 25 planted contradictions were each caught by a check.
   It tests contradiction handling well and robustness to real mess not at all. This contradicts
   ADR 0004's "drafted the way a Dhaka consultant drafts"; see the session-01 ruling on it.
6. **LibreDWG 0.14 converted both files with exact entity parity** against `dwgread` JSON (31,767 and
   11,236 entities, all ATTRIBs present) despite thousands of warning lines; the repair step changed
   nothing.

## Method
LibreDWG 0.14 `dwg2dxf`, the repair step, ezdxf. Each prototype stage ran first as written, then with
the smallest fitting that let it run. N was always counted another way: PDF pages, the PDF text layer
(TrueType only), or by eye on PDF and DXF renders. The crude IFC was checked by hand volumes (one
column at two bands; 56 / 56 walls).

## n / N
| Stage | Prototype as written | Fitted |
|---|---|---|
| Sheets segmented | 0/38, 0/29 | 38/38, 29/29 |
| Titles read | 1/38, 7/29 (view titles only) | 38/38, 29/29 (3 from burst text) |
| Sheet → storey (16 storey-bearing structural sheets) | 3/16, plus 1 false storey | 11/16 |
| Grid axes, 14 structural plans | 0/154 | 154/154 |
| Grid axes, 2 architectural plans | 0/22 | 21/22 (line missing, bubbles present) |
| Named levels | rule not saved | 14/14 (1 mistyped mark out-voted) |
| Column outlines, 3 band plans | 40/54, wrong layer on one sheet | 54/54; precision 54/58 (detail-view columns) |
| Column marks bound | 0/54 | 54/54 |
| Column size vs schedule | 0/54 | 53/54 (1 mark missing from the schedule) |
| Column schedule size cells | 0/17 | 17/17; bands 4/4 |
| Beams found, 4 layout sheets | 0/60 | 57/60 (skewed beams missed) |
| Beams bound to labels | 0 | 56/57 (the 1 has no label) |
| Slab panel labels | 0 | read on 2 typical sheets; N not independently counted |
| Slab panel geometry | – | 0 |
| Walls, typical plan | 0 | precision 53/56; no missed run seen by eye; thickness wrong on 11/26 short pieces |
| Walls, ground-floor plan | 0 | 0/20 without a layer map |
| Openings, stairs, foundations, shear walls, lift core | not attempted | not attempted |

## Conventions: Sample Project vs the Independent Set
Two numbers are structural / architectural.

| | Independent Set (Edison) | Sample Project |
|---|---|---|
| Sheet layout | model space; one row and one grid; some paper-space content | model space; one row each; paper space empty |
| Title blocks | block inserts without attributes | one block, 40 attribute tags, 4 scales, some rotated for portrait; 3 burst to text |
| Layers | 119 / 145, drafter suffixes | 46 / 65, clean names, yet one member on 2–3 names across sheets |
| Units | inches, ft-in text | inches, ft-in text; bar diameters in mm |
| Blocks | 23 / 125 named; 5 / 214 nested | 7 / 26 named; 0 / 20 nested; plans are blocks in both |
| Schedules | lines, text, dimensions | lines and text, one row as an attribute block, per-sheet band tables; no table objects in either |
| Column labels | mark and size together | bare mark; size only in tables |
| Beams | closed outlines | dashed line pairs |
| Level marks | repeated, 1 mistyped | two formats, 1 mistyped |
| Text styles | about 30, all TrueType | 8, SHX and TrueType mixed; SHX carries half to three quarters of the text |
| Dimension styles | 28 / 16, many overrides | one style per scale; some overrides contradict geometry |
| Diameter symbol | – | control code and literal glyph mixed in one schedule |
| Editing time | months to years | seconds |
| Wall outlines | open, self-intersecting, fragmented | exact rectangles and L/U shapes |

## What the product should take from this
- Key sheets by title-block attributes, with a text fallback.
- Treat detail views inside a sheet as separate views.
- Expand storey ranges, and ask the QS about shared boundary storeys.
- Read beams as line pairs as well as outlines, including skewed ones.
- Learn a layer map per sheet, not only per set.
- Take wall thickness from the minimum-rectangle width, not 2·area/perimeter.
- Honour DIMLFAC and insert scale.
- Cross-check every value three ways, and raise contradictions as Questions (ADR 0027).

## Not measured
Openings, stairs, foundations, shear walls and the lift core; slab panel geometry; wall recall run by
run; the non-typical architectural plans; architectural sheet → storey; time per stage.
