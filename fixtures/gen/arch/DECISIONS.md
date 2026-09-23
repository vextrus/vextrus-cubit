# F-ARCH — decisions (tranche 1)

The architect's set of the Bashundhara G+6 that F-RCC6-BNBC engineers. Each decision here is the
fixture's own (A-nn); where one reads a clause of the Bible it also carries an Interpretation token
(I-458), which the session's integrator renumbers into the ledger. Conventions are learned from
real Dhaka architectural sets (`.private/work/session-8/edison/farch-spec.md`); nothing of any real
set — geometry, text, names or numbers — is carried.

## The building

**A-01 One building, one home (I-452).** F-ARCH is F-RCC6-BNBC's architectural companion, not a
second building. The structure is read from `fixtures.gen.rcc6_bnbc.model` and never edited: its
module constants (grid, levels, storey heights, the chamfer, the balcony, the sunken toilet panels,
the two service ducts, the column stacks and `column_poly`) and, read-only, what its `build()` places
(the lift core's shear walls, the beams and slab panels over each storey, S-25's lintels). Reading
`build()` rather than restating it keeps one home per fact (ARCH-02): a structural regeneration moves
F-ARCH with it, and `manifest.json` pins the structural model's sha256, so such a move is a declared
F-ARCH regeneration in its own `baseline:` commit. By law masonry and finishes are ARCHITECTURAL
(`src/core/catalogue/maps.ts`), and the owner ruled R0 "regenerate and draw all" (session 8): F-ARCH's
drawn brick walls ARE the building's brick walls (250 perimeter and party walls, 125 partitions), the
one wall layout F-RCC6-BNBC's regenerated brickwork will be drawn from. How SAMPLE is paired, and
whether BNBC's informational BRICK_WALL rows are retired, are R0-1's Deviation, not this fixture's.

**A-02 A millimetre drawing that writes feet-inches.** The DXF is in millimetres (`$INSUNITS 4`) and
every size the architect writes — room labels, schedule sizes, dimensions, levels — is feet-inches
text (T-FTIN-LABEL). Real sets are often inch drawings in a model-space frame matrix; both are
tranche-2 twins, so tranche 1 is one paper-layout DXF the product reads today.

**A-03 Level.** "At level L" means standing on L's slab and rising to the soffit of the slab of the
level above — for walls, rooms and openings alike (F-RCC6-BNBC's brick rows confuse this; R0-1).

**A-04 The sheets.** A-01 GROUND FLOOR PLAN and A-02 TYPICAL FLOOR PLAN (1ST TO 6TH), each with its
door & window schedule beside it; A-03 ROOM FINISH SCHEDULE & WALL TYPES (with the Edison-style floor
tile legend beside the Bible-style finish schedule); A-04 SECTION A-A with the level stack and the
clear heights. Each sheet is a paper layout whose numbered title line (`A-02  TYPICAL FLOOR PLAN (1ST
TO 6TH)`) the title grammar reads as ARCHITECTURAL, and each view a VIEWPORT titled on the paper
under it. The roof plan, elevations, details, DWG and PDF are tranche 2 and the manifest promises
none of them.

**A-05 Two flats, mirrored — with the building's own exceptions.** The east flat is the west flat
mirrored about the middle of bay 3-4, except where the structure is not symmetric: the east flat has
no chamfer (its BED-02 is rectangular, with its own windows on E and 6), its kitchen has no duct
(DUCTS[0] is in the west kitchen), the second duct (DUCTS[1]) stands in the east BED-01's corner in a
shaft, so the east BED-01 is entered through the STUDY (the west one's door would open into that
shaft — path 2 found it), and the east dining opens onto the balcony, which the west dining is past
the end of (A-12). The stair's mirror position is the east flat's STUDY.

**A-06 Walls meet the lift core flush.** The core's shear walls thin from 250 to 200 at 3F, so a wall
that meets the core stops on its face and that end moves by level (S1, S2, LF, S1e, S2e, AXn); the
rooms beside the core step by 25 mm where the core does.

**A-07 Toilets stand on the sunken panels.** Every toilet's clear polygon IS the sunken panel over its
floor's slab (2438 x 1524); its four 125 walls stand on the panel's drop-wall ring, t/2 outside it.
The strip left between a toilet and the external wall is a pipe SHAFT (a void). A toilet's ceiling is
the sunken soffit of the floor above (storey − 300 − 125: 2623 at 1F-5F; 2923 at 6F, under a roof
with no sunken panel); its walls' brickwork rises to the drop wall (storey − 300).

**A-08 Ducts are enclosed.** Each service duct stands in a 125 enclosure (a DUCT void), never in a
room's floor.

**A-09 Low walls are not storey brickwork.** The balcony's 3" planter (3'-0" high, a quarter circle at
the A-6 end on the slab's own R 5'-0" corner) and the flats' verandah divider bound the verandahs but
are not billed as brickwork.

## The golden

**A-10 Brickwork (I-456).** Wall by wall: each wall runs clear between the faces of what owns its
ends — column or shear wall > 250 > 125; walls of one thickness meet at corners on their centrelines,
a wall stops at the face of the wall it abuts — and rises from the slab top to the soffit over its
centreline: a beam (its depth, the deeper where two meet), a sunken panel's drop wall, or the slab.
Openings over 0.1 m² deduct w x h x t; smaller ones are retained and listed (V-2).

**A-11 S-25's lintels own their volume.** Every 250-wall opening of one of S-25's three size classes
(3'-4" windows → L1, 5'-0" windows → LS1, 4'-0" door-height → L2) carries F-RCC6-BNBC's lintel, whose
b x D x length is deducted from the brickwork it sits in (it is billed once, as BNBC's LINTEL rows).
On every framed floor the classes count exactly S-25's program (10 L1, 8 L2, 6 LS1) — the selfcheck's
cross-fixture check. The architect's sizes are feet-inches and S-25's widths millimetres (3'-4" =
1016 against 1000); the difference is registered, never reconciled. Openings in 125 walls carry no
S-25 lintel.

**A-12 The balcony openings.** Five 4'-0" sliding doors open onto the balcony (two per living room,
one from the east dining), with the two flat entrances and the stair's fire door making S-25's eight
L2 openings a floor.

**A-13 Archways (T-ARCHWAY).** A gap with no leaf wider than 4'-0" joins two labelled areas into one
space: LIVING and DINING are one room carrying two labels, measured once. The archway is full height
(the beam over it is drawn dashed).

**A-14 A room is bounded by wall faces; columns are obstructions (I-453).** A room is the clear
region bounded by the faces of the brick walls, the low walls and the lift core. A column is judged
by L-MEA-02's 0.1 m² rule applied to obstructions: a column piece standing in a room whose plan area
exceeds 0.1 m² is deducted from its floor and ceiling; smaller pieces are retained and listed on the
row. Column faces are not added to the wall face (the wall face is measured as if it ran through the
column). A column whose face stands within 50 mm of a wall face is engaged with it (the gap is filled
and plastered over); the selfcheck refuses a free-standing column rather than guessing its faces.
The door threshold (the wall gap under a leaf) belongs to neither room.

**A-15 The curved verandah is analytic.** Path 1 takes the east verandah as its rectangle plus the
part of the planter's inner circle below the wall face, ∫√(r² − u²) du; path 2 takes the face its
arrangement finds with the arc's chord and adds the circular segment r²/2 (θ − sin θ). The verandah
carries its FLOOR only (its ceiling is not carried, A-19).

**A-16 The ground floor's parking is open.** SURFACE-OPEN: not closed by walls on its open side, it is
no room and carries no row until a person closes the outline.

**A-17 Openings are counted as placed (I-457).** OPENING_COUNT is the placements per mark per
level; OPENING_AREA is w x h per mark. The schedule's printed quantity is evidence to check, never the
count: the typical door schedule prints D-2 as 08 NOS against nine placed (T-OPENING-NOS), a declared
disagreement the product must refuse until a person states it (L-MEA-02; L-CAD-08: no registry
count).

**A-18 Wall faces (I-454, I-455).** Per boundary edge: length x the height from FFL to the
soffit of the slab over the room at that edge (L-MEA-06's clear height, read off the structure; an
edge is split where the panel over it changes). A beam standing over the edge is inside the face; a
beam crossing it is not deducted (its end contact is under 0.1 m²). A dry room has a 4" skirting and
a wet room a dado (kitchen 5'-0", toilet 7'-0"): plaster and paint cover the band above it, the tile
the band below. Each opening whose WHOLE area w x h exceeds 0.1 m² deducts its overlap with each band
it meets, from every room it opens onto; skirting is the boundary less the widths of openings at
floor level.

**A-19 Ceilings.** A room's ceiling is its floor area: the slab soffit, plastered and painted. Beam
drops, reveals, thresholds, external faces, verandah ceilings, stair and lift finishes are not carried
in tranche 1 and `cells.json` names each.

## The drawing

**A-20 Conventions and dirt.** Walls are unhatched double lines on a dozen layer names, some
misspelt or duplicated (readers must not key on names); wall lines stop at columns, which are closed
outlines with a solid hatch (T-COLUMN-HATCH); the core is drawn as RCC with a pattern hatch
(T-CORE-RING-250). Rooms are implied by the walls, never drawn as polylines (a rug is the one closed
outline in a room, T-FURNITURE). Labels are NAME + W x L in feet-inches to the nearest inch (one is a
nominal size, T-ROOM-SIZE-NOMINAL; one stands outside its room on a leader, T-LABEL-OUTSIDE; the two
flats repeat names, T-DUP-LABEL). Openings are gaps with jambs: windows three glass lines, sliding
doors two offset leaves, hinged doors a door block (mirrored for the east hands, T-MIRRORED-DOOR; one
drawn exploded, T-EXPLODED-DOOR). Tags are circled and unhyphenated (D2); the schedules hyphenate
(D-2, T-MARK-SPELLING), group by type with a serial column, wrap W x H over two lines and write NN NOS.
One wall face is drawn twice (T-DOUBLE-LINE); the guard room's rear wall stops short (T-UNCLOSED-WALL).
The wall-type table is captioned WALL TYPES, which the caption grammar reads UNTYPED today
(T-WALL-TYPES-CAPTION, ARCH-3's to teach).

## Two paths and the checks

The golden is computed twice: path 1 (`golden.py`) room by room over the authored clear polygons and
wall by wall over authored end rules; path 2 (`golden_check.py`) re-derives the rooms from the wall
centrelines ± t/2 by its own planar-face code (split every solid edge, walk the half-edges, keep the
free counter-clockwise faces, name them by their labels), allocates every opening by probing either
side of its host, finds the column pieces by convex difference, and measures brickwork by clipping
each band by the junction rule. It never reads a room's polygon, an opening's allocation or a wall's
end rules (the poison test). `selfcheck.py` refuses on any disagreement, on an allocation that is not
the authored one, on a 250-wall opening program that is not S-25's, on a sunken panel over a room
that is no toilet, on a duct outside a duct void, on an empty exit cell, and on a label more than an
inch off its room outside the registered traps. On the way path 2 found four authoring faults, each
fixed in the model: the east bedroom's mirrored door opening into a duct shaft, five T-junction ends
written as corner points, a junction band overshooting the thinner wall it met, and a wall whose end
ran through the thinner core wall into the lift shaft.
