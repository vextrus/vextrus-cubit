# Edison's MEP drawings: what they hold and how much code can read into the Live Model

Session 02, 28 Sep 2026. A `drawing-analyst` agent studied the Edison set's ELECTRICAL and PLUMBING DWGs
(LibreDWG 0.14; one consultant office's work, which the owner calls "pretty standard") after the owner
ruled that MEP is read into the Live Model as Elements with identity (docs/reviews/session-02-grill.md,
Q29). Counts and conventions only; the model, overlays and renders stay in
`.private/work/session-02/mep-read/`.

## Conclusions
1. **Electrical points are very readable.** Every point is a symbol on a layer per kind, with an
   independent count to check it: on a typical floor the reader's symbols, the drafter's tags and the
   board schedule agree exactly on the tagged kinds (switch boards 17, sockets 30, geyser sockets 5, AC
   sockets 6). 1,320 electrical points across the building: 1,245 read, 75 Questions.
2. **Plumbing risers are the best plumbing fact:** each stack is labelled with diameter, material,
   service and often its floor span; 46 risers, 27 read (labelled on two or more sheets), 19 Questions.
   Floor traps (123) and gate valves (94) are symbols and read.
3. **Runs are schematic, not quantities.** Conduits are curves from the board to each point; drains are
   double lines with fittings as blocks (adding segments roughly doubles the length); no conduit or cable
   size on any run (only in a lookup chart). Lengths from these drawings would be invented precision.
4. **Equipment is a label, ratings are in the schematics:** distribution boards 11/11 (N from the
   schematics), geysers 24/24; transformer, panels, generator, pumps and tanks placed at their text labels
   (Questions); kVA, kVAR, pump flow and head only in the single-line and pump diagrams; the lift appears
   only on the architect's plan and a board schedule.
5. **Not in this set:** fire protection (0 detectors, sprinklers, hydrants, hose reels; one layer named for
   smoke detectors holds DP switches) and sanitary fixtures as plumbing symbols (WCs, basins, showers and
   sinks are the architect's base drawing, exploded lines, so 0 read). A missing discipline must be raised
   as a Question, never read as zero.
6. **Registration is exact:** every MEP plan but the mezzanine carries the structural grid as a block (8
   axis offsets identical: a pure shift); the mezzanine registers by matching its base plan (697 of 1,355
   points within 0.3 in). No MEP file states levels: storeys come from the architectural elevation.
7. **The same point appears on up to three sheets** (the fixture sheet and 17 conduit sheets repeat
   subsets at identical positions): reading every sheet would double- or triple-count.

## What the drawings are
- Sheets side by side in model space, each in a scaled frame block without attributes; sheet numbers as
  plain text; the one paper-space layout empty; stray entities far out (stored extents useless).
- ELECTRICAL: 38 sheets + cover: 6 storey bands × 4 plan kinds (fixture layout, point conduit, power
  conduit, low-power conduit), 4 AC pipe sheets, 2 solar, 1 lightning protection, 7 schematics (single-line
  diagram, 2 earthing, main board with changeover and metering, common and lift boards, floor boards), 1
  legend (symbol, meaning, mounting height, the cable/conduit chart).
- PLUMBING: 26 sheets + cover: notes with a fixture-height table; a 45-row legend; 8 plans; septic tank;
  3 toilet details; water riser; gas riser; soil/waste/vent; 9 fixture, tank and pump details.
- No attributes on any MEP symbol.

## n / N by depth
| Level | What | n / N | How N was counted | Reader work |
|---|---|---|---|---|
| A equipment | distribution boards | 11/11 | schematics (9 floor, 1 common, 1 lift) | small |
| A | geysers | 24/24 | by eye, 3 per typical floor × 8 | small |
| A | other equipment (transformer, panels, generator, PABX, earthing pits, pumps, tanks, meters) | 43 at labels, all Questions | – | small (ratings from schematics: moderate) |
| B points | electrical, typical floor | 146 per floor 1F–7F, 145 on 8F, 71 GF, 59 mezzanine, 23 roof | tags + board schedule + by eye (untagged fans 9/9) | moderate, the richest return |
| B | floor traps / gate valves | 123 / 94 | not independently counted | small |
| B | sanitary fixtures | 0 | by eye ~5 WC, 4 basins, 4 showers, 1 sink per typical floor | via the architectural reader |
| C runs | conduits 1,133 curves; plumbing 1,796 segments | drawn lengths only | – | large for true lengths |
| C | risers | 46 plumbing (27 read) + 1 electrical | labels on ≥ 2 sheets | small |
| D schematics | board schedules (circuits by tag range) | matched plan tags on 4 kinds | – | moderate |
Checks that fired: a band's title block naming other floors than its plan title; 28 socket tags vs 29
circuits on 8F; 6 switch-board tags vs 3 on the mezzanine; 8 GF tube-light tags without symbols while
the mezzanine sheet draws 12 over the double-height space (a point's storey is not always its sheet's);
a schematic's title belonging to another sheet. Mounting heights read from the legend for 588 points,
assumed for 716.

## Conventions a product reader must take
The kind is the layer (block names often anonymous); legend rows sit on the plan's symbol layers, so the
legend proposes the layer map (match by tag too); tags on the symbol's layer, some kinds never tagged;
symbol base points can lie far from the geometry: locate by the geometry's centre, assign sheets by
containment; read the fixture sheet once and use the conduit sheets as a Check; storey bands as lists in
plan titles (title blocks can disagree); MEP plans carry the structural grid as a block; board schedules
list circuits by tag range (an independent N); conduit sizes from a chart keyed by type, never from runs;
drains double-line, diameters and spans on riser labels; sanitary fixtures belong to the architectural
base plan; mounting heights are text, some kinds with several heights by use; equipment placed by label,
ratings in schematics; a missing discipline is a Question.

## The agent's view on depth
MVP (beside M2's architecture): Level B electrical points from the fixture sheets (layer map proposed from
the legend, confirmed once as the office's Drafting Profile; the board schedule as the Check); Level A
boards and geysers, other equipment as Questions at their labels; plumbing floor traps, valves and risers
by diameter; sanitary fixtures from the architectural reader; runs priced by QS-confirmed allowances per
point and per fixture, not measured. Later: true run lengths, schedule parsing beyond the board Check,
fire protection once a set contains it. The prototype wrote 4,580 Elements (1,513 read, 3,067 Questions:
every run and every label-placed piece of equipment), and added an MEP reading step (numbered 15 in the
prototype) that ADR 0007 lacks.
