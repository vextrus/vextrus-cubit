# Session 02's readers on the Edison set: what survives on a real consultant's drawings

Session 02, 27 Sep 2026. A `drawing-analyst` agent ran session 02's prototype readers (fitted to the
Sample Project, steps 1–14) on the Edison set, first as written, then with the smallest fitting that let
each step run, exactly as docs/research/sample-project-first-read.md did in session 01. Counts and
conventions only; the drawings, scripts and renders stay in `.private/work/session-02/edison-check/`.

## Conclusions
1. **Nothing survives as written: every Takeoff Step reads 0 on Edison.** The structural reader crashes
   collecting text before step 1 finishes; the architectural reader crashes on its first line (its sheet
   table, plan-block names and handles are the Sample Project's).
2. **31 fittings** were needed to measure the table below (session 01's Sample run needed 17): **4 generic
   bugs** any real set would expose, **27 set-specific** (layer names, label formats, sheet numbers, the
   title block's form, drawing conventions, tolerances).
3. **Fitted, the geometry-and-label core recovers well** where members are outlines with a label beside
   them: piles 47/47, caps 12/12, tie beams 14/14, columns and shear walls 33/36, beams 138/139, slab
   thickness 31/37, grid 8/8 (232/232 axis offsets agree across sheets).
4. **It still fails wherever the Sample's source of truth was a schedule or a note wording** Edison states
   another way: notes in a separate DWG with free-text tables (psi, laps in bar diameters by band); a
   graphical column schedule (each cell a drawn section); stair facts only as dimensions in sections; door
   and window tags only on separate layout sheets; floor levels only in the architectural elevations
   (structural levels 3/15).
5. **Silent wrong answers appear without Checks:** the lift core bound to the nearest column mark (4 wrong
   bindings); a stale second layer of outlines at another band's sizes (17 false disagreements); two beam
   plans titled for the same floor (it would be placed twice); a duplicated sheet title. Each needs a
   Check that raises a Question (ADR 0027).
6. **The prototype reader carried Sample literals:** a hard-coded grid total (11) that made a correct 8/8
   read 8/11; "9 × typical floor" in the floor-area formula; a "burst title block" Question firing on all
   57 sheets.
7. **The architectural reader's layer-independent wall learning failed:** the true wall layer scored
   0.50–0.62 against a 0.6 threshold and was dropped on 3 of 5 plans, while stair treads, window frames, a
   fixture layer and a metal channel scored 0.8–1.0 and were learnt as walls.

This is postmortem cause 1 measured again: a reader fitted to one office reads nothing at the next. It
is why ADR 0005 requires Held-out Sets, and it sizes the reading work M1 and M2 must do.

## n / N per Takeoff Step ("as written" = only the input path repointed)
| Step | As written | Fitted | Fittings | How N was counted | Still failing |
|---|---|---|---|---|---|
| 1 Sheets | 0/57 (crash) | 57/57; titles 56/57 | 4 (a generic MTEXT bug; frame block name; title block by position: no attributes, text z≠0; bare `NN` numbers vs `S-NN` references) | 57 PDF pages; numbers by eye | views 0 (no view-title layer); 57 false Questions |
| 1 Sheet → storey | 14/32 right, 3 wrong, 18 missed | 32/32 as titled | 1 (storey vocabulary: mezzanine, below ground, "X to top", foundation implied by pile/cap/tie beam) | titles by eye on the PDF | two beam plans on one floor; duplicate title; neither raised |
| 2 Notes | 0/40 (crash) | 16/40 | 3 (separate file; no text/schedule layers; no fixed window) | notes DWG text dump: 16 notes + 24 table facts | table facts 0/24 |
| 3 Storeys | 0/15 (crash) | 3/15 | 1 (level-mark wording, sign in parentheses, roof-relative marks) | architectural elevation by eye | 12 levels only in the architectural set |
| 4 Grid | 0/8 (crash) | 8/8 | 2 (three grid layer names; master grid sheet) | PDF by eye | hard-coded total; drawn vs dimension text up to ~0.15 in unchecked |
| 5 Foundations | 0/73 | 73/73 | 6 (piles as block inserts; the mirrored-insert bug; cap layer; outlines; label format; sheet map) | PDF vector circles; by eye | cap schedule, pile spec, cut-off unread; pile marks are per type |
| 6 Columns etc. | 0/36 | 33/36; size = label 33/33 | 3 (mark format with size in the label; one layer per sheet; band map) | by eye on 3 plans | lift core 0/3; graphical schedule unread; plans 3 bands vs schedule 6 |
| 7 Beams | 0/139 | 138/139; width 138/138 | 5 (dotted marks; outlines; the MTEXT-angle bug; label anchor up to 21 in; sheet map) | PDF text layer | unlabelled pieces; a skewed piece; one mark with different sizes on different spans |
| 8 Slabs | 0/37 | 31/37 | 4 (outline supports; layers; thickness-only labels; gap closing) | PDF text layer | voids not cut; cantilevers merged |
| 9 Stairs | 0/10 (crash) | not fitted | – | by eye | no schedule; needs a section reader |
| 10 Tanks, pits | 0/4 (crash) | not fitted | – | by eye | keyed to Sample sheets |
| 11 Walls | 0 (crash) | typical 54 runs, 8th 52, GF 41 | 2 (wall layer by name; the collapsed-outline guard, a generic bug) | by eye on overlays | exterior walls fragmented; ~20 outlines held per plan |
| 11 Openings | 0 | not fitted | – | tags on 6 layout sheets | tags not on working plans |
| 12 Rooms | 0/24 | not run | 2 identified | 24 room labels (PDF text) | enclosure needs openings |
| 13 Roof | 0 (crash) | roof 6/6, tank slabs 3/3 | – | PDF text layer | parapet, stair-room roof, machine room |
| 14 Template | 0 (crash) | 15/15 assumed | 1 | – | no plot-area note; hard-coded floors |

## The four generic bugs (any real set exposes them)
MTEXT inside blocks without a height (step 1 crashed); mirrored inserts (extrusion −Z) used without the
object-to-world transform (25 of 47 piles about 77,000 in away); MTEXT angle stored as a direction vector
read as 0° (98 of 139 beam labels unbound); self-intersecting wall outlines collapsing to empty geometry
on repair (the wall reader crashed).

## Where Edison's conventions differ from the Sample Project's
- Sheets: 57 frames, one block without attributes, 17 insert scales, 29 rotated; number and title as
  plain text at frame-local positions; bare `NN` in the title block, `S-NN` in references; the PDF title
  block is stroked (no text layer).
- Notes in their own DWG, hierarchical sections in columns, tables as free text; psi; laps as bar
  diameters by member, position and bar-size band.
- Levels almost absent from the structural set; floor levels in the architectural elevations; signs in
  parentheses; tank levels relative to the roof.
- Members as closed outlines labelled "mark (b × d)"; one mark can carry different sizes on different
  spans; beam labels are MTEXT with a direction-vector angle.
- Piles as block inserts, some mirrored; marks name a type, not a pile.
- Drafter-suffixed layers; a family on two layers of one sheet, one stale.
- Floor groupings disagree between sheets and disciplines (column plans 3 bands, the schedule 6); two
  beam plans overlap on one floor.
- Slabs carry only a thickness label; openings tagged only on separate layout sheets; room labels as
  two-line MTEXT on a general text layer.

## What the product's readers must take
- Read the frame, then text by frame-local position; title-block attributes are a bonus, not the route;
  test containment in 2D.
- Apply each insert's object-to-world transform (mirrored inserts included); read MTEXT angle from its
  direction vector; guard every geometry repair.
- Never hard-code N or a storey count: take N from the drawing and raise a Question when sources disagree.
- Learn a layer map per sheet and confirm it by what the geometry is (outline width equals label size;
  piles inside caps); a thickness score alone picks stairs and window frames.
- Bind labels by label geometry (anchor, extent, angle), not a fixed distance; expect "mark (size)"; do
  not assume a mark fixes a size.
- Build readers for schedules drawn as graphics, free-text notes tables and stair sections: on this set
  they are the only source of those facts.
- Take levels from the architectural sections and elevations.
- Raise overlapping and contradictory sheet titles and stale duplicate layers as Questions (ADR 0027).
