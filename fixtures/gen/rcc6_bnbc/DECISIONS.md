# F-RCC6-BNBC — decisions of the Fixture Engineer (Wave A: model, golden, validators, traps)

Numbers in the AM-02 section were measured at 50a13d4 (concrete 1,185.9 m³ of which piles 372.8; formwork
5,680 m²; rebar 165.6 t). After the adversary round (§ "Adversary round" below) the golden stands at
concrete 1,186.9 m³, formwork 5,686.0 m², rebar 166.6 t; 89 piles / 1,899 m; 379 rows; 36/36 M3 cells.

## AM-02 — one owner per junction (the measurement-convention law)

**The fault.** L-MEA-01 gives the column–beam junction to the column ("full storey height floor-to-floor")
*and* to the beam ("junction in the beam"), and lets the slab–beam junction "defer with a reason", which
publishes gross beam + gross slab. Under L-QTY-04 an over-measured figure is a hard block, so the Bible
contradicts itself, and `fixtures/rcc6/takeoff.golden.json` bakes the contradiction in.

**The law this fixture is built on** (`model.CONVENTIONS["junction_ownership"]`, printed on S-01):

1. Every junction volume and every contact face has exactly one owner, in this order of precedence:
   pile > pile cap > column / shear wall > beam > slab.
2. Columns and walls run floor-to-floor through the joint (band-aware). Beams are measured **clear between
   support faces** and **below the slab soffit** (b × (D − t) × clear; the thicker adjoining slab sets t).
   Slabs run through: outline to the edge-beam outer face − column/wall plan areas − openings > 0.1 m².
   Grade beams clear between cap faces. Stair flights sloped length × width × waist + step triangles;
   landings AREA_THICK.
3. Formwork is the contact area of the owned shape: column 2(b+d) × (floor-to-floor − t) − beam-end
   contacts above the 500 cm² member-end threshold; beam sides (D − t_left) + (D − t_right) plus soffit b,
   × clear; slab soffit net of beam soffits and columns, free edges × t as EDGE; caps/footings/grade beams
   sides only; bored piles none.
4. A junction deduction may defer only where the published figure is then **under** — never over.
   (The 25 mm sliver where a 150 panel meets a 125 panel over one beam is unowned by design: under.)

**What it moves.** On this fixture the old law (beam b × D × c/c, slab gross plate, column floor-to-floor)
over-measures the framed floors' BEAM+SLAB concrete by **63.7 m³ (15.2 %; 483.6 → 419.9)** and their
formwork by **802 m² (24.3 %; 4,109 → 3,307)** — 5.4 % / 14.1 % of the whole bill. On **F-RCC6 v1.1**
(estimate from `inputs.json`, H-bible-m3 §3.1-1): ≈ 11 m³ beam∩slab + ≈ 3 m³ column∩beam per typical level
≈ **98 m³ over seven levels (≈ 12 % of ≈ 826 m³)**, and ≈ 160 m² formwork per level ≈ **1,100 m² (≈ 20 %)**.
The M2 column rows do not move (columns keep floor-to-floor).

**Amendment text for the Bible (G1 pastes; replaces the junction sentence of L-MEA-01 and amends
L-FRM-02/03):**

> **L-MEA-09 One owner per junction** (supersedes the junction sentences of **L-MEA-01** — "beam length is
> the drawn long-section span with the junction in the beam; slab–beam junction deductions defer with a
> reason" — and the "beams (long-section spans, junction in beam)" clause of **R-TO-032**; G1 amends both
> to cite this law). Each junction volume and each contact face has exactly one owning
> member, in the precedence pile > pile cap > column / shear wall > beam > slab. Vertical members measure
> floor-to-floor through joints (band-aware). Beams measure clear between support faces and below the slab
> soffit: `b × (D − t_slab) × clear`, the thicker adjoining slab governing t. Slabs run through: outline to
> the edge-beam outer face, less column and wall plan areas, less openings above `openingDeductionMinM2`.
> Grade/tie beams measure clear between cap or footing faces. Formwork is the contact area of the owned
> shape: vertical members `perimeter × (storey − t_slab)` less member-end contacts above
> `memberEndNoDeductMaxCm2`; beams `((D − t_left) + (D − t_right) + b) × clear`; slab soffit net of beam
> soffits and columns, free edges `length × t` as their own component; caps and footings sides only; bored
> piles none. A junction deduction may defer (`JUNCTION_DEFERRED`) only where the published figure is then
> under; otherwise it is a hard block under L-QTY-04. Citations: IS 1200 Part 2 cl. 4.2/4.5 (deductions at
> junctions), PWD SoR 2022 RCC item notes ("measured net, junctions once").

## AM-03 — rebar billing

(a) **Wastage and binding wire never touch the billed quantity.** L-FRM-05's "3 %, 8 kg/t" apply to
A-RESOURCE-PDF and rate analysis only. The golden's REBAR rows are net (NET) plus laps as their own
component (LAP), per L-BD-02. *Moves on F-RCC6 v1.1: nothing (no REBAR rows).*

(b) **The table bills; d²/162 checks.** kg = billable length × the L-FRM-05 kg/m lookup. d²/162 is an
informational column with a stated tolerance of 0.25 % (10 mm: 0.6173 vs 0.616 = +0.21 %; 28 mm +0.25 %).
An engine using d²/162 against this golden lands 0.02–0.25 % over → the +0 % arm fails, which is the
enforcement L-BD-02 wants. *Moves: ≈ +0.2 % of 165.6 t ≈ 330 kg on this fixture if an engine used the
formula.*

(c) **BS 8666 cutting length bills; IS-additive is printed beside.** `bbs.golden.json` carries
`cutting_raw_mm` (BS, never rounded), `cutting_rounded_mm` (the only rounded surface, ≤ 25 mm) and
`cutting_is_additive_mm`. The IS↔BS divergence is recorded, never asserted equal.

(d) **fy 500.** The ℓd table exists for fy 420 only. This fixture's S-02 authors its own table for fy 500 /
f'c 3500 (ℓd 50d bottom, 65d top; laps 50d/40d) so J-032's "the drawing's note governs" applies and no row
is missing. The Bible should still add fy 500 rows (scale the 420 rows by 500/420 → f'c 3500: 49/60
confined, 73/93 otherwise; 3000: 52/64, 79/99; 4000: 45/56, 68/86) **or** define the deferral
`DETAILING_ROW_NOT_IN_EDITION` when a note's fy has no row. *Moves on F-RCC6 v1.1: nothing.*

(e) **The stirrup-hook inconsistency inside L-FRM-05.** The detailing table says "stirrup 135° =
max(6d, 75 mm)" (ACI 318-19 Table 25.3.2 / seismic hook) while the synthesis text says "closed link … with
10d hooks" (the IS 2502 allowance). Resolution: the **edition default is 6d ≥ 75 mm**; the **drawing's
typical detail overrides** (S-03 here draws 10d, so every link in `bbs.golden.json` uses 10d, authored);
the IS 2502 10d stays only in the additive convention printed beside. The synthesis sentence is amended to
"closed link legs to the outer bend line (b−2c, d−2c) with hooks per the edition (default max(6d, 75 mm),
or the typical detail's value)". *Moves: on this fixture 10d vs 6d on 10 mm links is 80 mm per link; ≈ 1–2 %
of stirrup mass, ≈ 1 t, if an engine defaulted to 6d — hence the trap registered by the S-03 detail.*

**Amendment text for the Bible (G1 pastes into L-FRM-05 and L-BD-02):**

> Wastage and binding wire apply only to resource and procurement outputs, never to a billed quantity.
> The billed mass is billable length × the kg/m table; `d²/162` is a check with tolerance 0.25 %. BS 8666
> governs the BBS cutting length (raw never rounded; one rounded value ≤ 25 mm); the IS-additive figure is
> printed beside it and never billed. The stirrup/tie 135° hook extension defaults to max(6d, 75 mm) and a
> drawing's typical detail overrides it verbatim. Where a note's fy has no ℓd row the campaign defers
> `DETAILING_ROW_NOT_IN_EDITION` unless the drawing authors its own table, which then governs (J-032).
> A transcribed lap note overrides the lap within the campaign's applied values and re-presents the lines;
> it never mints an edition.

## AM-07 subset present in this fixture

The S-25 lintel schedule (L1, L2, LS1 by arch mark, openings scheduled), 1F–6F. Rows: `LINTEL` × 3
kinds. The brick walls they sit in are F-ARCH's members and F-ARCH's golden bills them (R0-G3, W-51,
D-009); S-25 prints the BW250/BW125 wall types from `model.WALL_TYPES`.

## Model decisions that deviate from E-fixture §3.2 (the generator is the single source)

- **D-01 stair sub-grid is `2'`, not `C'`.** A 2,438 mm C–D bay cannot host a 2,000/2,250 mm flight run
  plus a 1,219 mm landing in y; the flights run in x from grid 3 toward grid 2 (two 1,079.5 flights +
  279.4 well = 2,438.4 exactly — amended by R0, W-32: Rev B's model built 1,066.8 + 304.8 under a
  figured 3'-6½"), so the half-landing beam LB1 spans C→D at x = grid 2 + 4'-0" (`2'`).
- **D-02 chamfer.** The skew beam EB2/GB4 runs corner-to-corner through the 45°-rotated C6 (two spans);
  the corner points are beam-to-beam joints (`JOINT`), a legal support kind beside COLUMN/WALL/CAP/BEAM/FREE.
- **D-03 floor landing at 1F.** FL@1F starts at the departing flights' foot (run 2,000); the GF flights'
  last tread (run 2,250) overlaps it by 250 mm in plan — that is the tread that *is* the landing, not a
  double count (the flight is measured on its waist).
- **D-04 revision cloud.** The clouded C4 3F–4F note "2-20Ø EXTRA" is a trap: the schedule's clouded value
  (10-25Ø) is what the golden authors; the note adds nothing (T-REV-CLOUD).
- **D-05 PC2 centroid.** The triangular cap's bounding-box centre is not its pile-group centroid; the
  75 mm centroid check exempts PC2 by name (its group centroid is the polygon's, by construction).
- **D-06 excavation for polygon caps** is measured by bounding box in the golden; an engine deferring
  `POLYGON_PIT` is under (lawful) — `cells.json` records the expected residue. R0 holds it: a Deviation
  from L-FRM-04's deferral, recorded as D-008 (W-41).
- **D-07 covers** follow the drawing (S-01: caps 2" = 50.8 mm beside the Bible's 75) — a registered trap
  (T-NOT-COVER). *Amended by R0 (W-27):* the golden follows the drawn figure — the model cuts the cap
  bars at 50.8 (`COVER["PILE_CAP"]`), where Rev B cut them at 75 and left the printed 2" a disagreement
  no faithful reader could land on; piles and footings keep 75, which Rev C's S-01 cover lines state.

## F-RCC6 v1.1 repair list — a spec for P4 (do not touch fixtures/rcc6/** in this wave)

1. **B5 spans.** `inputs.json` authors B5 at spans the DXF does not draw; re-author B5 at its drawn spans
   (count and `span_m` from the plan), regenerate the BEAM rows.
2. **Beams stopped at openings.** B2/B4/B6 run through the stair/duct openings on the typical plan; stop
   them at the opening trimmers (add the trimmer beams as members or shorten the spans), regenerate.
3. **GF slab.** Either draw a GF slab-on-grade plan (then the SLAB GF row is lawful, no soffit formwork) or
   drop the SLAB GF row; do not keep a row with no drawn bearer.
4. **Column necks.** Leave the FDN→GF neck out (it would move the M2 column rows); declare the omission in
   `fixtures/gen/README.md` as a convention of v1.1.
5. **Junction recompute (AM-02).** Recompute BEAM and SLAB rows under the one-owner law above: beams
   b × (D − t) × clear, slab plate − column areas − openings; formwork beam ((D−t)·2 + b) × clear, slab soffit
   net of beam soffits and columns. Expected movement: ≈ −98 m³ concrete and ≈ −1,100 m² formwork over
   seven levels (estimate above). Blast radius: golden BEAM/SLAB rows, DXF/PDF/PNG bytes, `sanity.json`,
   sample-seed hashes; the M2 column test is unaffected.
6. Keep `fixtures/rcc6` byte-frozen for J-000 until P4 lands all five in one node, one commit per item.

## What Wave B's emitters must read from the model (never recompute)

`model.build()` → `members` (every instance with class, mark, level, geometry in mm as Decimal, supports,
slab thicknesses each side, beam-end contacts, holes with `deducted`), `bars` (every authored bar: member,
bar mark, dia, shape, legs, count, role, lap), `regions` (panels per level with polygons), `grid`
(X/Y/subgrid/chamfer), `levels`, `storeys`, `site`, `conventions`; plus `model.column_rect()`,
`model.outline()`, `model.CAPS/COLUMN_MARKS/BEAM_TYPES/SLAB_BARS/STAIR/OHWT/UGWR/SEPTIC/PARAPET/RAMP`,
`selfcheck.schedule_marks()` (which sheet lists which mark) and `traps.json` (sheet + placeholder handle
to fill). The sheets print authored values; the only disagreements allowed are the registered traps
(T-DIM-OVERRIDE 4,267.2 → "14'-2"", T-RISER-ROUNDED, T-BBS-TOTAL 165,637.323 → 168,453.157, T-NOT-COVER).

## Adversary round (fix-forward on v22/f1) — rulings the golden had taken silently

**(3a) Shape 51 — which formula is law.** L-FRM-05 writes the closed link explicitly as
`51 = 2(A+B+C) − 2.5r − 5d` and, in the same clause, the generic `Σlegs − bends·(0.5r + d)`. A closed
link has two hook extensions, not four, so the explicit clause double-counts the hooks: on this fixture it
would add +18.7 % to 672 link marks (+3,065 kg). **Ruling: the generic form is law; the explicit `51`
text is a transcription slip.** Both golden paths use `2(A+B) + 2C − 2.5r − 5d` (C = the 135° hook
extension); `golden.SHAPE_FORMULA["51"]` prints the ruled form. *Amendment text for L-FRM-05 (G1):*

> `51 = 2(A + B) + 2C − 2.5r − 5d` (closed link, A × B to the outer bend line, C the hook extension); every
> shape's cutting length is the generic `Σlegs − bends·(0.5r + d)`, and an explicit code formula that
> disagrees with the generic form is void.

**(3b) Cutting stock — first-fit-decreasing.** L-FRM-05 says "cutting stock as 1-D bin packing by
diameter, first-fit-decreasing"; the first golden used best-fit over capacity buckets. **Ruling: FFD, as
written**, over the *rounded* cutting length (the length a site cuts; the raw length is the billed
surface). `bbs.golden.json` re-emitted: 8 mm 400 bars · 10 mm 9,450 · 12 mm 1,238 · 16 mm 1,200 ·
20 mm 1,737 · 25 mm 140 (offcuts per diameter beside). *Amendment text:* "… first-fit-decreasing over the
rounded cutting length; the stock count and offcut are informational and never billed."

**(3c) Junction — the clauses AM-02 replaces.** Named in the L-MEA-09 text above: **L-MEA-01**
(cubit.bible.xml:214, "junction in the beam … slab–beam junction deductions defer") and **R-TO-032**
(:462, "beams (long-section spans, junction in beam)"). Both must cite L-MEA-09 after G1 pastes it.

**What the independent path (adversary 2) found in the model, now fixed:** face-flush bands moved the
column centre *inward* (inner face flush, not outer) — 505d0dc; beam clear spans were taken from half a
column width instead of the real face — 3238fb1; floor landings and the SRR/MRR slabs took no
column/wall or beam-soffit deductions and had no bars — e8604d1; SB-R5/SB-R6 sat on the core's own wall
legs and one carried a *negative* clear span — a04db54 (selfcheck now refuses any beam clear ≤ 0 or
cutting length ≤ 0); the septic baffle ran across the wrong dimension — e8604d1.

## Wave B (N2/N3) — the drawings: rulings of the Fixture Engineer

**W-01 F-RCC6 v1.1's R-7 (column formwork OVER) — the shape of v1.2.** R-7 keeps `2(b + d) × storey`
for column formwork, an OVER figure AM-02 forbids, kept only because AM-01 freezes the M2 column rows.
Ruling: v1.2 applies AM-02 to column formwork alone — `2(b + d) × (storey − t_slab)` less each beam-end
contact `b_beam × (D_beam − t_slab)` above 500 cm² — and moves **only the COLUMN/FORMWORK rows** (≈ −8.6 m²
per level, ≈ −60 m² over seven levels on F-RCC6 — both figures were estimates, and only the first
term: measured off the drawn geometry the overage is **18.580 m²/level over six levels = 111.480 m²,
10.63 % of COLUMN FORMWORK 1048.800**, being 8.580 m² of slab band + 10.000 m² of beam-end contacts
(120 ends/level at 750–875 cm², all above the 500 cm² threshold). The figure is carried as data in
`fixtures/rcc6/manifest.json` R-7 `overage`, computed by `fixtures/gen/rcc6.py r7_overage()` and
checked against a second path in `cad/tests/sanity/test_rcc6_golden.py`; v1.2 moves the rows by it);
COLUMN/RCC_CONCRETE stays floor-to-floor and the M2
proof (which pins concrete, not formwork) is untouched. v1.2 lands as one commit on `fixtures/gen/rcc6.py`
+ the golden + `manifest.repairs[R-7].state = REPAIRED, side = EXACT`, with the sample-seed hashes. Not
done in this wave (the founder's grant covers the ruling; `fixtures/rcc6/**` stays byte-frozen).

**W-02 Raster budget (Founder's Law 4).** `emit/plan.RASTER`: PNG only for the six-sheet subset S-01,
S-10, S-11, S-17, S-20, S-26 (an A2, four A1, an A3) at R1 300 dpi; R2/R3/R4 as JPEG for the subset;
one full-set DCT raster PDF only for R2 (the F-SCAN seed). Caps: corpus ≤ 45 MB, rasters ≤ 25 MB, no
file > 8 MB; the size test pins them. A variant that will not fit at its planned dpi drops dpi, never
sheets, and the manifest records the dpi actually used.

**W-03 Fonts and Bengali.** The TrueType PDF embeds Vera (shipped inside the pinned reportlab 4.4.9
wheel, so it is identical on every machine); the stroked PDF uses the public-domain Hershey simplex
table embedded in `emit/hershey.py`. reportlab does not shape Bengali and no Bengali TTF is pinned, so
the Bengali title (T-BENGALI) lives in the DXF/DWG only; both PDFs print the English line and the
manifest names `BENGALI_TEXT_DXF_ONLY` as a PDF-variant loss. No system font is ever read.

**W-04 DWG profile.** `emit/dwg.py` mints every `scene.feature_scenes()` entry alone (plus a one-viewport
layout), converts back with `dwg2dxf`, and compares the census. A feature LibreDWG loses or corrupts is
excluded from the DWG source — the DXF keeps it — and named in `sanity.json["dwg"][*]["losses"]` per
(space, type) with the reason; `expected` is `drawn − losses`, which is the census the cad DWG lane must
read. The DWG is judged by that census, never by bytes (§3.9).

**W-05 Model-space frames.** `rcc6-bnbc.model.dxf`: each sheet's paper scene × 100 planted in model
space (an A1 frame is 84.1 × 59.4 m), 1:100 views at 1:1 inside it, 1:S details at ×(100/S) with
`DIMLFAC = S/100` (S-12 at 1:20: ×5, 0.2). One layout "SHEET" with a single VIEWPORT over S-00. The
sanity tally for this file has two spaces: `model` and `SHEET`.

**W-06 Trap handles.** After the paper-layout DXF is written, `__main__` fills every `handle` in
`fixtures/gen/rcc6_bnbc/traps.json` with the live entity handle (the trap's own entity; for a
document-level trap, the S-00 title TEXT or the entity `plan.DOCUMENT_TRAPS` names) and copies the file
to the corpus. ezdxf assigns handles deterministically for a fixed placing order, so a second build
reproduces them; validate/traps.py refuses a handle that does not open.

**W-07 The malformed DXF.** `rcc6-bnbc.libredwg-r2000.dxf` is authored by the generator (never taken
from `dwg2dxf`, whose bytes are not stable): the paper set saved as R2000 with one DIMENSION's
tag stream broken by a single mis-paired line and one MTEXT carrying an "Embedded Object" column block,
so `vextrus_cad.resync` refuses it by name (`DXF_TAG_STREAM_DESYNC`) until its resync drops the lines.

**W-08 Dimension habit.** Plans dimension in feet-inches (the office habit; `Inches Dimension` layer);
details and schedules in millimetres. Dimension text is always horizontal (LibreDWG, E-fixture §4.3).
The only dimension that disagrees with its geometry is T-DIM-OVERRIDE (4,267.2 drawn, `14'-2"` printed),
under the S-02 "DO NOT SCALE" note.

**W-09 Twenty-seven sheets.** E-fixture §3.4 says "26 sheets" and lists S-00…S-26, which is 27; the
roster follows the list (the cover sheet S-00 is the 27th). Tests assert one layout per roster entry
with unique S-numbers, never the literal 26.

**W-10 The raster ladder, as measured.** Planned vs used (manifest `raster.*.dpi`): R1 300 dpi PNG
(2.2 MB, 6 sheets); R2 200 dpi JPEG q70 (4.9 MB, 6 sheets); the full-set R2 DCT PDF 120 dpi q34
(7.2 MB — dropped from 150 dpi to sit under the 8 MB single-file cap); R3 120 dpi q55 (2.8 MB); R4
150 dpi q60 (2.4 MB). The ladder lowers quality first, then dpi, never the sheet count. Rasters are a
pure function of the TrueType PDF, which the in-process second build does rebuild and compare; the
rasters themselves are exempt from that second pass (> 60 s) and are proved instead by the regenerate
test's byte identity against the committed set. Corpus 33.6 MB (cap 45), raster/ 12.3 MB (cap 25).

**W-11 The PDF's feet-inch dimensions are authored, not measured.** ezdxf renders decimal dimension
text only, so a plan dimension's `15'-0"` is the composer's `ft_in()` of the authored span with
`fact=` attached (check 5 proves it equals the span); millimetre dimensions with no override stay
measured. In the DXF a reader still sees a DIMENSION whose measurement and text agree, except
T-DIM-OVERRIDE. Four Vera-less glyphs (⌊⌋⌈⌉ Σ →) are spelled out in the PDF (counted in the manifest);
no trap string is dropped.

**W-12 The BBS sheet reads the golden path, not the corpus.** `emit/sheets/common.py::Ctx.bbs()` first
read the committed `bbs.golden.json`, so a generator run with the corpus deleted failed and a stale
corpus could feed its own sheet (B-23). It now calls `golden.compute(world)` — emit importing golden is
the lawful direction; the import-lint forbids only the reverse.

**Named DWG losses (W-04, measured).** Of 21 feature canaries + a one-VIEWPORT layout, 19 round-trip
exact through `dxf2dwg`/`dwg2dxf` 0.13.3 (bulged polylines, simple/complex/solid hatches, linetypes,
rotated TEXT, MTEXT codes, dimensions with overrides and DIMLFAC, LEADER, POLYLINE, ATTRIB blocks,
3-deep nested/mirrored/scaled INSERTs, the xref INSERT, POINT/SOLID, the revision cloud, VIEWPORT). Lost:
IMAGE (2 on the paper set: S-00 logo, S-03 scan), MULTILEADER (1), Bengali TEXT (1, S-00). The DWG
source omits exactly those; `sanity.json["dwg"][*].expected = drawn − losses`, and the cad DWG lane reads
that census. Nothing was refused by `convert_dwg`.

## F2 adversary round — fix-forward on v22/f2

**W-13 The title block's address.** F2-6: the address line's shape ("HOUSE n, ROAD n, BLOCK x,
BANANI, DHAKA-1213") survived from the reference set's block with the numbers changed. Ruling: no line
of the reference block survives — the fictional consultant now sits in Uttara Model Town (Sector 6,
Dhaka-1230) with a different line shape; names, phone, client, project, RAJUK reference stay invented.
The founder's law reads "notation habits only", and an address template is not a notation habit.

**W-14 The BBS sample total (F2-1, F2-2) and the quantity wall.** S-26 printed `grand_total_kg × 1.017`
— the project's golden steel mass on a sample sheet of three members whose own rows sum to 481.889 kg
— so the trap was unreachable and the drawing carried the answer. Ruling: `golden.bbs_sample()` is the
one selection (PC3, B7@2F, S3@1F, distinct bar marks); S-26 prints exactly those rows and a grand
total of **their sum × 1.017**; `traps.json` T-BBS-TOTAL `true` is that sum and `printed` the ×1.017
figure; selfcheck 5 and `validate/wall.py` assert `printed / true = 1.017 ± 0.0005` and that the
printed value is not `grand_total_kg`. `validate/wall.py` is the permanent quantity wall: every takeoff
row quantity, every kind total and the BBS grand total, in 3- and 2-decimal and thousands-separated
spellings (integers only above 1,000), must match no numeric token of any drawn string.

**W-15 A note states the convention, never the golden's method (F2-3).** `CONVENTIONS["curved_balcony"]`
now reads "measured as the true quarter-circle, not as the drawn polygon's corner point". The same rule
governs every note: what a QS needs to reproduce the measurement, never how the golden computed it, and
never the name of a golden file (F2-4: S-26 cites the S-02 table, not `bbs.golden.json`).

**W-16 VIEWPORT is content on neither side (F2-5).** `sanity.json["drawn"]` never counted VIEWPORT (the
product's ingest treats it as a frame, not paint); the DWG `expected` did. One convention now: the DWG
census is stripped of VIEWPORT before it becomes `expected`, `expected == drawn − losses` holds type for
type in both directions (validate/tally.py checks the reverse too), and `sanity.json["dwg"][*]` states
`not_counted` and the reason. The cad DWG test strips the same class before comparing.

**W-18 Every paper layout keeps its own viewport.** `page_setup` plants the layout's own VIEWPORT (id 1,
the paper seen at 1:1, named by the LAYOUT's `viewport_handle`); an earlier wave deleted it and discarded the
reference so that "both sanity numbers count the same set". W-16 had already made VIEWPORT content on
neither side, so the deletion counted nothing and left every sheet without the viewport AutoCAD itself
writes for a layout. It now stays, in the paper set, the model-frames set and the DWG canary. Nothing
authored moves: the handle was allocated before the deletion, so every later handle (the traps, the
cells) is what it was; the ingest excludes this viewport from a sheet's window inventory by the handle
the LAYOUT names, so the 53 windows are the 53 windows. Blast radius: the DXF bytes, the DWGs (judged by
census, VIEWPORT stripped) and the manifest hashes.

**W-17 Document traps carry their own evidence (F2-7; amends W-06).** T-FRAMES-MODELSPACE's handle is
the frames set's caption TEXT in its `SHEET` layout — which is also the one TEXT the model twin has over
the paper set (F2-8's 2,628 vs 2,627: named, not equalised). T-INSUNITS-0 has `handle: null` and anchors
`$INSUNITS = 0` (a header variable has no handle); T-PDF-SHX and T-RASTER anchor their files; T-DXF-
MALFORMED anchors the twin and the 1-based line of the mis-paired `AcDbAlignedDimension` plus the 13
lines the resync drops. `validate/traps.py` and the cad sanity test verify each anchor against the bytes.

**W-18 R4 is a real keystone (F2-8; amends W-10).** The page now lands on the photo as a trapezoid — top
edge inset 7–11 % per corner, bottom 0.5–2 %, plus a ±1.5 % lean — so the page-quad width grows
monotonically top to bottom; the earlier transform zoomed into the page and left only an in-plane lean.

## R0 — Rev C, "Regenerate and draw all" (session 8; the owner's ruling on R0)

**W-19 The Rev C append pass: Rev B's handles are kept.** The set was issued as Rev B, and the product
keys on its handles: the trap registry, the notation corpus, the model recordings, the journeys. ezdxf
mints handles in creation order, so one record created early moves every later one — one new layer
moved 8,198 of 8,592 records and one TEXT inside S-08's scene 6,391 (the R0 design's measurements).
Ruling: the writers (`emit/dxf.py`) build Rev B exactly as issued — its layers (`REV_B_LAYERS`), its
blocks (`REV_B_BLOCKS`), every untagged item, its layouts and viewports, down to deleting `Layout1` —
then end the issue as its save did (`_close_issue`: pending changes committed, the sorted CLASSES, and
`update_all`'s two APPIDs and DICTIONARYVAR), and only then append Rev C (`scene.APPENDED`): the layers
and blocks Rev B did not have (a plan or library entry outside the Rev B rosters, wherever it stands),
every item drawn inside `Scene.revision("C")`, every view `revc.add_view` adds (`View.rev`; its model
square after Rev B's, `assign_model_offsets`) and every sheet first issued in C (`Sheet.new_in`; its
layout and frame after Rev B's). Rev B's composers read a `Ctx` fenced of the members Rev C draws first
(`revc.DRAWN_IN_C`) — every member index and the bars, which are member-derived too (a loop over
`ctx.bars` sees none of a fenced member's); `emit/sheets/revc.py` appends after every Rev B sheet is composed and never calls
a Rev B composer. A value correction is made in place — same type, layer and position in its scene, so
the same handle with a new body — and registered in `revc.CORRECTED` per file with its correction's
id. Check 9 (`validate/revision.py`, run by `validate.run` and by
`python -m fixtures.gen.rcc6_bnbc.validate.revision` in about 3 s) reads the Rev B paper set, frames
set and twin by git blob id (`b7e37fa7`, `828bf6e7`, `0abc7958`; traps `d5505eae`) from the raw tag
stream and refuses by handle: a Rev B record lost, retyped or moved to another layer; a rewrite the
register does not name, or a registered record that did not change; a VIEWPORT, table or dictionary
in the register; a correction registered in one set and not the other; a record added below Rev B's
`$HANDSEED` (22A8, 21F3, 246A); a header variable other than `$HANDSEED` moved; Rev B's CLASSES no
longer first; a trap whose handle moved. The design's "three containers" exemption is read as its
cause — a container may only GROW (a table head's counts rise, entries are added, nothing it held
changes) — and the append-pass probe (`cad/tests/rcc6_bnbc/test_rcc6_bnbc_revision.py`: an item on a
Rev B view and on a Rev B sheet, a dimension, a new layer, a block defined mid-library, a new view, a
new sheet) grows exactly those three in the paper set (the LAYER and BLOCK_RECORD tables and the
layout dictionary) and two in the frames set, and moves no other Rev B record. Two hazards closed on
the way: every writer asserts every authored item was placed (a tagged item no pass placed would print
on the PDF and be missing from the DXF, which no handle check sees), and `_carry_handles` drops a
frame copy's entry once carried (a dead copy's id may be reused by a later copy that the appended pass
never places, which would carry a stale handle). Cost: the generator reads the repository's object
store — a clone without R0's Rev B blobs refuses by name, never skips. At R0-G0 the revision draws
nothing and corrects nothing; the proof is the corpus regenerating byte for byte (below).

**W-19a Rev B's windows are pinned.** `Paper.view` centred each window on its scene's extents, so an
in-place correction that moves a scene's extents re-centred its Rev B VIEWPORT and moved every frames
record of the view (the refuter's D-TANK trial: VIEWPORT `226A` −75, frames `2066..2075` and `206A`
+150). Ruling: `emit/sheets/revb_windows.json` pins each Rev B view's window — `"<sheet>#<index>"`, its
title as a check, the scene point at the window's lower-left — and `Paper.view` frames a Rev B view on
its pin and refuses a view with none (a later view is `revc.add_view`'s, centred on its own scene).
The 53 pins were minted once, at R0-G0, from the unmodified composers (a `git archive` of `0c4f31b1`),
and equal the design's scratch pins 53 of 53. They are never re-minted — a pin minted after a
correction would freeze a moved window; a corrected scene that outgrows its window is refused by check
5b (`validate/fit.py` reads the pinned origin) and is fixed by a smaller correction or a Rev C view,
never by moving the window. Check 9 re-centres every Rev B view no correction touched and demands its
pin exactly, so the pins' provenance is proved for as long as it can hold (53 of 53 at R0-G0).

**R0-G0's proof (the append pass and the pins, no content change).** `python -m fixtures.gen.rcc6_bnbc
--out <scratch>` over this generator wrote 44 files; 43 are byte-identical to the committed corpus —
both DXFs, the twin, both DWGs (judged by census; byte-equal this run), both PDFs, the 24 rasters and
every JSON — and `manifest.json` differs only where it must: `generator.modules` (the five modules this
step edits, the three it adds) and `validate.revision`, check 9's report (paper 8,591 records, frames
8,410, twin 8,591, each 0 corrected, 0 grown, 0 added; traps 52/52; 5,975 authored items in both sets;
53 windows pinned, 53 untouched and centred on their pins). The cad lane's own regeneration test
reads the same: `regenerated files differ from the committed bytes: ['manifest.json']`, both DWG
censuses equal. The manifest re-mints with the corpus at R0-BASE; until then its module-pin tests
(`test_manifest_pins_the_generator_and_its_outputs`, the AC-1 byte-identity and manifest-pin cases)
read the generator as moved — the window in which the generator and the corpus disagree opens here.

## R0-G1 — the golden and drawing corrections (session 8)

Each correction says which side moved — the golden to follow its drawing or its law, or the drawing
because the golden holds the design — the evidence, and what it moved. The golden figures are the
generator's own (`model.build()` through both paths; 0 two-path differences after every step). The
drawing corrections are made in place (W-19): same type, layer and place in the scene, a new body,
each handle registered in `revc.CORRECTED` with its correction's id. The Interpretation and Deviation
tokens (I-R0G1-*, D-R0G1-*) are recorded in the product's decision log with R0's documents.

**W-20 K1 + D-EGL: the E.G.L is −1'-6" = −457.2.** `SITE.egl_mm` was `ft(-1, 6)` = −12" + 6" = −152.4,
a sign slip: S-25's label `1D91` reads `E.G.L (-1'-6")`, T-NOT-LEVEL says EGL −457.2 is the SITE fact,
and golden.py's own formula text says `EGL −1'-6"`. The golden follows the label (`−ft(1, 6)`):
PILE_CAP EXCAVATION 445.875 → 377.279 m³, FOOTING 6.621 → 4.844, WALL (the tank pits) 121.611 →
107.728. The drawing is corrected to its label: S-25's ground line, its label and the two cut arrows
stood at half the pile cut-off (−914.4) and stand at the SITE figure (`1D8F`, `1D91`, `1D94`, `1D95`).
Found on the way: `scene.ft_in` floor-divided a negative figure (−152.4 spelled `-1'-6"`, −457.2
`-2'-6"`), which is how check 5 passed the slip; a figure below zero now spells as its magnitude after
a minus (tested in `test_rcc6_bnbc_selfcheck.py`), and no drawn string moves by it — every drawn
caller passes a magnitude.

**W-21 K2: CS1 is 150 throughout.** S-19 and S-20 print "150 THK" on CS1 (`197D`, `1ABE`) and draw no
taper; the model's 150 → 100 taper was drawn nowhere. SLAB RCC 1F..6F +0.587 m³, FW +0.843 m² per level.

**W-22 K4: CB1..CB4 are 250×450 throughout.** S-16 and S-17 draw them as plain rectangles; the model's
450 → 300 `D2` was drawn nowhere. BEAM 1F..6F +0.082 m³, +0.659 m², +3.696 kg per level.

**W-23 K6: LB1 is filed at the layout that draws it.** The half-landing beam of storey s was re-filed
at s for its concrete and formwork while its bars stayed at the level above. It now keeps the level of
the beam layout that draws it — S-13 at 1F, S-14 at 2F..6F, S-15 at ROOF — for every kind, as its
bars already were (I-604). BEAM GF (0.123 m³, 1.860 m²) retires into ROOF (11.919 → 12.042 m³,
139.933 → 141.793 m² before K8). The seventh, `LB1@6F`, now at ROOF, was never on Rev B's roof layout:
the Rev B composers are fenced of it (`revc.DRAWN_IN_C`) and Rev C draws it. S-13 and S-14 draw the
same geometry under the next storey's id, and no record of theirs moves.

**W-24 K7: the slab on grade's hole reveals.** golden.py fell back to `D(2400)` — the OHWT manhole's
perimeter — for any hole with no rectangle, so the SOG's pit and ramp holes were billed as manhole
reveals (0.600 m²). The pit hole reveals nothing: its edge abuts the core walls, which K22 closes on
grid C. The ramp exposes the SOG edge by min(t, drop) along its two sides and its mouth, the drop
falling linearly from its flush top edge (I-602); the model states it as the hole's `reveal_mm2`,
path 2 derives it from the ramp's own run and rise. SLAB FW GF 9.587 → 10.309 m² (after K8). The
fallback stays for the tank slab's manhole, whose perimeter it is.

**W-25 K8: the slab owns its edge.** L-MEA-09's owned shape at a free edge (I-601): the slab bills
its EDGE × t out to the edge beam's outer face; EB1 and EB2 bill their outer side D − t; CB1's west
side, with no slab beyond its axis, bills D; PS1 stops on PB4/PB5's axes and has no free edge. Path 1
measures a panel's boundary on its level's outline (`model.outline_free`), path 2 by its own
collinearity test (`golden_check.edge_on_outline`). SLAB FW +6.974 m² per typical floor (1F +6.319,
ROOF and GF +8.987); BEAM FW −2.574..−2.594 m² at 1F..6F, ROOF −0.441.

**W-26 K9: TG1's north side takes the thicker adjoining slab.** TG1 spans 3–5 under S (125) over 3–4 and
the 150 panel over 4–5; its side was read by a probe on the bay boundary, which found whichever panel's
bounding box it met first. The thicker adjoining slab governs (L-MEA-09), probed mid-bay on each side.
BEAM 1F −0.065 m³, −0.164 m²; COLUMN FW GF 140.327 → 140.347.

**W-27 K11 + D-S26: the pile-cap cover is the drawn 2".** S-01 `1F46` states '2" clear cover (pile caps)'
and T-NOT-COVER says the drawing's value bills; the model cut the cap bars at 75. `COVER["PILE_CAP"]` is
50.8: PILE_CAP REBAR 4,576.022 → 4,732.035 kg (before K18), COLUMN REBAR FDN +17.344 (the dowels' cap
leg). S-26's PC3 rows regenerate at 50.8, so S-26 agrees with S-01, and T-BBS-TOTAL is re-seeded
from the new sample sum — 492.564 true, 500.938 printed (`1E40`). D-07 is amended above. S-07 is not
yet carried: its cap sections still draw the bottom and top rod lines 76 from the faces
(`emit/sheets/found.py`), with no dimension or cover text on them. Scaled, that reads a 3" cover. R0-G1
does not redraw them; S-01's stated 2" governs (T-NOT-COVER), and redrawing them at 50.8 is a Rev C
correction that the register must name.

**W-28 GC-1..GC-4: the column ties as BNBC 2020 zones them (the owner's A′).** GC-1: the foundation neck
is one run at the end spacing. GC-2: C4 carries no cross-tie — S-12 draws one perimeter tie (reading
A of S-12's sections, I-607). GC-4: the joint is the deepest beam drawn into the column head where
that is over 450, else 450 (I-605); clear = h − joint, and a column whose clear height fits inside
its two end zones is tied at the end spacing throughout. GC-3: C7's ties are the circular hoops S-11
states (10Ø @ 100/100), individual hoops at 100 over the storey. Their cutting length is formula (iii),
πA + 2C − 2(0.5r + d) = 1,322.389 mm, **by AM-03(d), and it is not the owner's question** (I-608;
the owner's standing ruling, session 9's brief). AM-03(d) states that every shape's cutting length is
the generic sum of legs less bends × (0.5r + d), and that an explicit formula disagreeing with the
generic form is void. (iii) is that generic form for the legs (πA, C, C) and two bends, as the
session-7 R6 critic read it; (i) π(A − d) + 2C and (ii) the exact centreline development both
disagree with it, so AM-03(d) admits (iii) alone, and choosing (i) or (ii) would be a Deviation, not a
ruling. The R0 design's owner question 2 (§4.3) and session 7's R6c owner gate are therefore retired
for this formula (I-599, which carried (iii) as the recommendation pending the owner, is
superseded by I-608). The shape
is marked CH, the generator's own site mark (like SP, CT and CRK), not a BS 8666 shape code. The
formula moves only the two CH rows, C7X at FDN and at GF. S-03's CH row and S-12's C7 section no
longer wait on a ruling (W-48). The model re-zones every rectangular column once its
framing is built (`tie_zones_from_framing`); path 2 re-derives every column's tie count from its own
joint depth and zones and refuses an authored count it does not reach (`Derive.column_tie_sets`, with
its teeth in `test_rcc6_bnbc_lint.py`). COLUMN REBAR FDN 2,853.771 → 2,442.141 kg, GF 4,142.917 →
3,986.080, 1F/2F 3,862.420 → 3,707.791, 3F/4F 3,103.104 → 2,976.393, 5F 2,045.792 → 1,934.000,
6F → 1,922.382, ROOF 129.968 → 101.940 (−1,394.383 kg in all).

**W-29 K17: the pile owns its head.** The pile's cut-off (−1,828.8) stands 76.2 above the cap soffit
(−1,905.0); that 3" is pile concrete, and L-MEA-09 gives the pile first ownership. Each cap deducts
π/4·d²·76.2 per pile it holds: PILE_CAP RCC −1.332 m³.

**W-30 K18 + D-PIT: the lift pit is PC5's recess.** The pit (8,714.2–11,707.4 × 8,714.2–11,402.6, floor
−1,524) lies wholly inside PC5's prism (−609.6 to −1,905.0), so the golden billed PC5 solid and billed
the pit's walls and slab inside the same volume. Under L-MEA-09 the cap owns it (I-603): PC5
deducts the void (2,493.2 × 2,188.4 × 914.4) and forms its sides, and the PIT members retire, their
bars becoming PC5's recess bars. PILE_CAP RCC 122.500 m³ (with K17), FW 254.211 → 262.773 m², REBAR
5,156.933 kg; the six PIT cells retire. S-08's pit ring was drawn from the retired LPS slab and is now
drawn from the core's outer face — the same entity, byte for byte. S-23's pit section (D-PIT) drew the
base inside the pit, above its EL −1.524 mark; it now lies below it, the two marks (PIT, LPS) name
PC5, and the caption reads "LIFT PIT SECTION (RECESS IN PILE CAP PC5, SEE S-07)" — the view keeps its
pinned title, and the caption grammar still types it a section.

**W-31 K19: the cap blinding is net of the piles.** The blinding under a cap is pierced by its piles; IS
1200 deducts a section over 500 cm² (a 500 Ø pile is 1,963 cm²), and L-MEA-09 governs L-FRM-04's gross
formula (I-600). PILE_CAP BLINDING 9.468 → 8.137 m³.

**W-32 K20 + D-WELL: the flight is the figured 3'-6½".** S-22 figures FLIGHT WIDTH 3'-6½" (T-NOT-FTIN-STACK:
1,079.5); the model built 1,066.8. The width follows the figure and the well closes the C–D bay —
2 × 1,079.5 + 279.4 = 2,438.4 — so S-22's "WELL 304" reads "WELL 279" (`1C9D`) and its two stair plans
redraw the flights at the new width in place (40 records). STAIR +0.015 m³, +0.102 m², +0.131 kg per
typical floor (GF +0.016, +0.114, +0.150). D-01 is amended above.

**W-33 K21: a column or wall is deducted only from the plan it stands on.** A panel deducted every
column and wall its bounding box met, including those standing in its own deducted holes: the three
FDN core legs inside the pit hole (1.905 m²) and A4's and A5's halves inside the ramp hole (0.090 m²)
were deducted twice. Each path now deducts only what stands on the panel's net plan, by its own code;
a scan of every panel moves only GF. SLAB RCC GF 39.358 → 39.608 m³, BLINDING GF 23.615 → 23.765.

**W-34 K22: below GF the pit is closed on grid C.** A pit cannot stand open to the fill, and S-23's pit
section draws it closed to GF; the model built legs 3, 4 and D at FDN with the door face open.
`SW1-C@FDN` (250, on grid C between the legs, cap top to GF) closes it, and legs 3 and 4 at FDN run to
its outer face as the PIT legs did; the SOG's pit-hole edge then abuts a wall, so K7's pit reveal of 0
holds. The alternative — a 0.374 m² reveal — bills formwork to a slab edge over a pit open to the fill,
and is rejected. SHEAR_WALL FDN RCC 1.161 → 1.579 m³, FW 9.290 → 12.635 m², REBAR 147.999 → 202.630 kg.
No Rev B view draws an FDN wall: the member is fenced of Rev B (`DRAWN_IN_C`) and Rev C draws it.

**W-35 K23: the parapet is the figured 1067.** S-21's parapet detail figures its height in millimetres
(`1C2E` "1067", and the plan's note), per W-08; the model's 3'-6" (1,066.8) printed as 1067 only by
rounding. The golden follows the print (`PARAPET.h = 1067`): WALL ROOF FW 153.390 → 153.419 m², RCC
7.670 → 7.671, REBAR 440.959 → 441.004. The detail's geometry moves 0.2 mm in place (11 records, the
height DIMENSION's six block records among them); no printed string changes. It replaces the first
design's D-PARA, which would have written feet-inches into a millimetre detail.

**W-36 D-CORE: the core is drawn as the legs the model builds.** Rev B drew the lift core as two
concentric rings inside the grids — four walls where the model builds three legs centred on grids 3,
4 and D, the door face on C being B13, the coupling beam the layouts already draw; read under AM-06(4)
the ring is +22.9 % to +53.6 % over the golden's walls. The two rings are redrawn in place as legs 3
and 4 of the storey each plan shows (`common.draw_core_and_stair(scene, ctx, storey)` reads that
storey's own SW1 legs): on the seven plans that draw the core (S-13, S-14, S-15's roof and stair-roof
layouts, S-19, S-20, S-21) and on S-23's core plan, whose HATCH now fills the three legs (three paths,
the same handle). The thickness is the storey's: 250 on S-13, S-19 and S-23; 200 on S-15 and S-21; the
typical plans S-14 and S-20 stand for 2F..6F and draw the lower band, 250, with S-23's band note
governing (I-606). Leg D's outline is Rev C's; no coupling-beam rectangle is drawn. It moves no
golden figure: it is what lets the wall and core-adjacent beam readers land on the golden.

**W-37 D-SW: the band note is the model's band.** S-23 `1CB2` read "SHEAR WALL 250 THK (LOWER), 200 THK
ABOVE 4F"; the walls change at the 3F storey, so a faithful reader billed 3F 25 % over. It reads
"SHEAR WALL 250 THK (GF TO 2ND), 200 THK (3RD TO ROOF)", composed from the model's own legs.

**W-38 D-TANK: the tank walls stand outside the clear span.** A tank catalogue's lx is the clear inside
size (the golden runs the N and S walls over lx + 2 × wall); S-24's three sections drew the walls
inside it. The walls now stand outside, and the base and top run over them — the 12 outlines, in place.
The pinned windows keep the three VIEWPORTs and every frames record (the refuter's R0-G0 trial moved
them unpinned), and check 5b holds each section inside its window. The outer dimension each section
gains is Rev C's.

**W-39 D-CRANK: the slab bars crank at 45°.** The model's cranked bars add 0.42 × the crank height, a 45°
crank; S-03's note said "CRANK 1:6" and its polyline rose at about 40°. The note reads "CRANK 45%%D AT
L/5 FROM THE SUPPORT FACE" and the polyline rises at 45° (`179`, `17B`).

**W-40 D-BLIND: the blinding outline is the slab's.** S-08's exploded blinding rectangle (`824`–`827`) was
the SOG's bounding box drawn 75 outside it, 338.343 m² — over the golden's plan by the E-1 chamfer and
the projection. Its four LINEs move onto the slab's four square edges, in Rev B's order, and its note
(`828`) reads "75 THK BLINDING UNDER SLAB ON GRADE & RAMP (EXPLODED OUTLINE)"; the chamfer's LINE is
Rev C's. S-Measure's decision test (wf-789-5) asserts the old rectangle takes in more than the slab:
whichever of the two lands second amends it.

**W-41 The M3 gate pairs: 40.** `cells.json` adds the earthwork the golden already bills beside the
concrete it serves — FOOTING × EXCAVATION, FOOTING × BLINDING, WALL × EXCAVATION (the tank pits) and
SLAB × BLINDING (the SOG and the ramp): 36 → 40, and the selfcheck covers 40/40. BRICK_WALL ×
BRICKWORK is not a BNBC pair: the walls are drawn and billed in the architect's set, and the pair is
F-ARCH's. The residues are rewritten: PC2's polygon pits by bounding box are a Deviation from L-FRM-04's
deferral (D-008, D-06 above), the cap blinding is net of the piles, the lintels are counted off
F-ARCH's door and window schedule through S-25's class map, and the WALL class is the tanks and the
parapet.

**W-42 The trap registry says what the drawing says.** T-NOT-RANGE-UNSTATED claimed the S-00 index names
2ND TO 6TH for S-20; the index title carries no range, so the plan registers UNRESOLVED rows with no
line until a person states the range (TYPICAL_RANGE_UNSTATED), and the text now says so. T-NOT-COVER,
T-NOT-FTIN-STACK and T-NOT-LEVEL name the figures the golden bills (W-27, W-32, W-20); T-BBS-TOTAL is
re-seeded (W-27). No trap handle moves (52 of 52).

**W-43 R0 prints no revision marks.** The generator tags Rev C internally, but R0 adds no title-strip
REV, no S-00 index or revision-row entry and no dated paper-space text (R0-G1's register holds no
title-strip, index or revision-row record): the S-00 index then agrees with every sheet, and the 27
set-wide sheet-revision-recency recordings, whose requests read the sheets' revision text, stay
byte-equal (R0-REC recomputes their hashes). The cost in realism: the regenerated set still says B. A
later revision-marks baseline can add them with a re-record of the 27 (about $0.005).

**R0-G1's proof.** The golden: the design's `final/m-k23.json` reproduced exactly (185 class × kind ×
level cells; 193 before, K6 −2 and K18 −6), its 370 rows, the BBS, the members and the bars equal to
the design's scratch generator; 0 two-path differences. Totals: RCC 1,186.893 → 1,180.513 m³, FW
5,686.047 → 5,724.531 m², REBAR 166,626.107 → 165,482.875 kg, EXCAVATION 574.107 → 489.851 m³,
BLINDING 35.723 → 34.542 m³; BRICKWORK 259.425 unchanged (R0-G3's). The drawing: `python -m
fixtures.gen.rcc6_bnbc --out <scratch>` passes every check — notation 3,102 strings, facts 1,117, fit
53 views, tally, traps 52/52, determinism — and check 9 reads paper 115 records corrected of 8,591,
frames 115 of 8,410, the twin 115 of 8,591: 0 lost, 0 retyped, 0 grown, 0 added, no VIEWPORT; 109
authored items corrected in both sets (the other 6 records are the parapet dimension's block); 53
windows pinned, 33 untouched and centred on their pins; `r2.pdf` 7,585,547 B, under 8 MB. The changed
set is the register, both ways. 25 of the corpus's files move (the goldens, cells, model, site,
notation corpus, sanity, manifest, both DXFs, the twin, both DWGs, the three PDFs and the S-20 and
S-26 rasters), all in R0-BASE's declared paths; the rest regenerate byte-identical. The product's
grammar over the regenerated notation corpus reads 3,068, traps 8 and allows 26 of 3,102, none
unaccounted: the E.G.L allowance is spent (the string reads −457.2, now the authored figure) and
retires at R0-BASE (`corpus-allow.json`, frozen 18 → 17). In the window until R0-BASE re-mints the
corpus, the cad lane reads the generator as moved: `test_committed_golden_regenerates_byte_for_byte`
and the manifest pins, and the golden sanity lane's generator arm (its `M3_CELLS` is 36, graded
against the committed `cells.json`; it moves to 40 with the corpus).

## R0-G2 — the Rev C drawn additions (session 8)

What the R0 design's section 6 draws, on the existing sheets only, appended by `revc.apply` (W-19)
through four area modules (`revc_frame`, `revc_found`, `revc_slabs`, `revc_details`). Every item is
read off `model.build()`; a note that states a bar spacing is printed only after the bars' own
counts are checked against it (`model.count_at`), so a model that moves a spacing moves the note or
stops the generator. Interpretation tokens (I-R0G2-*) await R0's documents for their ids.

**W-19b The twin's appended records are the paper set's.** The R2000 twin is the paper set read and
saved again (W-07), so every record Rev C appends to the paper set it appends too, under the same
handle. Its own Rev B `$HANDSEED` (246A) is a counter the R2000 save ran past: no Rev B record of the
twin stands at or above the paper seed (22A8), and the first record Rev C appends (22A8 in both files)
was refused as "added below the seed". Check 9 now judges the twin's additions as exactly the paper
set's additions, above the paper set's seed; a record only the twin adds, or one it lacks, is refused
by name (`test_the_twin_adds_exactly_what_the_paper_set_adds`). With nothing appended it reads as
before.

**W-44 What Rev C draws, and how it is lettered.** By sheet: S-01 the four covers the model cuts at and
the set never stated (75 piles and footings, 30 tanks, 25 lintels, 20 walls, stairs and parapet), a
row under the four it did; S-05 the main bars' run above the cut-off (3" into the cap, then 40d =
800, which is how the model cuts each bar); S-06 F1's mark in its own ring with its size, depth and
mesh, the caps' side bars (3-12Ø, every cap carries them) and PC5's pointer to its recess; S-07 the
recess in PC5's section (W-45); S-08 a mark on each of the 42 grade-beam spans Rev B left unmarked,
the blinding's chamfer LINE (D-BLIND's fifth, T-BLINDING-OUTLINE) and a RAMP SECTION (K7,
T-RAMP-REVEAL); S-09 how the grade beams meet the slab on grade (K8); S-12 two general notes — its
sections are typical for every band of a mark (reading A, I-607), and the starter bars' 12d foot
and 50d lap as the model cuts the dowels; leg D on the eight views that draw the core, at the storey
each draws (D-CORE; the typical beam layout's is T-CORE-BAND); the seventh LB1 on the roof layout (K6,
T-LB1-HALF-LANDING); the stair roof's grid, its two C4 stubs and the note naming them by grid point
(W-49); S-19, S-20 and S-21 each a slab panel schedule (W-47); S-20 the two ducts the model cuts at
every framed floor; S-21 the stair and machine-room roofs' thicknesses and the OHWT's outline over
the stair roof; S-22 the landings' thickness and ML1's mesh; S-23 SW1's bars and a LIFT PIT PLAN AT
FDN with K22's note (W-45); S-24 a plan of each tank (clear sizes, walls outside them, manholes,
levels, setting-out, bars; T-TANK-CLEAR) and each section's outer dimension (D-TANK); S-25 its lintel
notes and LS1's sunshade (W-46). Ten views are added — each on free paper of its sheet, over no other
view or title band, captioned in words the caption grammar types (SCHEDULE, NOTES, DETAIL, PLAN,
SECTION), so none waits on a recording. No sheet, layer, block, revision mark or dated paper text is
added (W-43). Every string reads in the family it declares under both the fixture's mirror and the
product's grammar: a note is set as plain prose the grammar reads as nothing, and a figure it means to
be read by is its own TEXT beside it (a mark, a section, a bar call, a level in feet and inches); a
dimension in a millimetre view carries no authored text, so the reader measures it and the notation
corpus gains no bare integer (W-08, the `300` allowance's reason). No model-space text Rev C draws is
as tall as a caption (the partition's 0.8 share of the tallest, 400), so no Rev B view is re-titled.
The tank and pit plans are captioned PLAN and the grammar types them layout plans; they carry no grid
and the grid stage leaves them ungridded, so they place nothing — the tanks and the pit are billed
from their sections and notes, never placed off these plans (I-609).

**W-45 The lift pit is drawn in PC5's section, and planned on S-23.** The design asked for a new
1:25 view "PC5 WITH LIFT PIT RECESS" on S-07. S-07 is an A2 whose window its six 1:25 sections fill,
and a 3.5 m cap needs 140 mm; that caption is also one the grammar cannot type. The recess is drawn
where a cap detail shows it, in PC5's own section: the void cut 914 into the cap top over 2493, its
floor at EL -5'-0", the recess bars the retired pit members became (12Ø @ 150 vertical and 10Ø @ 150
horizontal each face, 12Ø @ 150 both ways top and bottom under the floor) and legs 3 and 4 of the FDN
core standing on the cap to GF (T-PIT-RECESS on the recess outline). The pit's plan, with all four
FDN legs — the front wall on grid C among them (K22) — is a new LIFT PIT PLAN AT FDN on S-23, where
the pit section already points ("SEE S-07"), with the note WLS-1 reads: "BELOW GF THE PIT IS CLOSED
ON GRID C: FRONT WALL SW1 250 THK, PIT FLOOR TO GF (BELOW THE LIFT DOOR)" and "AT FDN SW1
L=2688/2688/2493/2493".

**W-46 S-25's counts stay where Rev B drew them; its notes stand in a view of their own.** The design
moved the three count notes ("OVER 1000 OPENING, 10 NOS PER FLOOR") into the window in place — Rev B
set them at 13000, where the window cuts them after "OVE" on paper. Measured before it landed: the
schedule reader joins the texts of a row ("L1+OVER 1000 OPENING, 10 NOS PER FLOOR"), and moving the
counts severs each from its key — the table read 6 cells and read 10, and the keys alone registered
three families with no section (L1, L2, LS1). Rev C keeps the counts in place (the clipped paper
line is a Rev B defect it keeps) and sets the lintel notes in a LINTEL NOTES view under the schedule,
outside its reader's window: "LINTELS AT 1ST TO 6TH FLOOR; BEARING 300 EACH SIDE" (every lintel is its
opening plus 300 a side), the class-to-mark map "L1 OVER W1, LS1 OVER W2, L2 OVER D1, FD1 & SD1 - IN
250 WALLS ONLY (SEE THE ARCHITECTURAL DOOR & WINDOW SCHEDULE)", "NOS PER FLOOR ARE INDICATIVE; THE
ARCHITECTURAL SCHEDULE GOVERNS" (T-LINTEL-NOS-FLOORS: the counts corroborate and never bill,
AM-06(5)) and "BRICK WALLS: SEE THE ARCHITECTURAL DRAWINGS". The S-25 schedule reads byte for byte as
Rev B's. An LS1 SUNSHADE DETAIL (1:20) draws the sunshade 600 × 75 with its bars.

**W-47 The slab panel schedules.** Each prints its floors' panel marks once (1ST FLOOR; TYPICAL
FLOOR, which names no range, as S-20 and the index do not, W-42; ROOF & STAIR ROOF), a thickness and
the bars: a two-way panel's bottom bars both ways and its extra top at `SLAB_BARS[t]` (alternate bars
cranked at L/5, the extra top L/4 each side — two notes under the table), CS1's top 10Ø @ 125 and
distribution 8Ø @ 200, S10's one-way 10Ø @ 125 with 8Ø @ 200 distribution, SS1 "SUNK 300". Found on
the way, and left for R0 to rule: S-19's Rev B note "BALCONY TOP BARS 12Ø @ 125 c/c, L/3 INTO THE
SLAB" disagrees with the model, which cuts CS1's top bars at 10Ø @ 125 and runs them 1000 into the
slab; the schedule prints the model's figure, so S-19 now states both (the note is a corpus-allowed
string; which side moves is a golden-or-drawing correction, not an addition).

**W-48 Held for the reader, no longer for the owner.** S-03's CH shape row and S-12's C7 SECTION
("10Ø @ 100 CIRCULAR HOOPS") were held for the owner's ruling on C7's hoop cutting length. W-28 (as
amended, I-608) settles it by AM-03(d): formula (iii), no owner question. What still holds the two
views is their reader, not the formula: the product's BS 8666 roster (`SHAPE_CODES`) has no CH, so a
drawn "SHAPE CH" row is an unread string until R6c (or a declared-unheld shape list) lands; the
R0 design carries both views with the ties chain (R6b/R6c, design §6's S-03 and S-12 rows). Until
then S-11's "10Ø@100/100" is C7's only statement of its ties.

**W-49 The stair-roof stubs place.** With its grid, the stair-roof layout is georeferenced: the
partition's stages over the regenerated set place its two C4 stubs as columns and SB-R1, SB-R2 and
SB-R4 as beams (none were placed before). The design's section 9 foresaw it: at R0-BASE, J-000 either
bears the stubs out at ROOF (`m3-bill-and-schedules.spec.ts` amended with the band's result) or the
stubs wait for LEV-2's baseline — `revc_frame.stair_roof` draws them in one block that can be held.
F1's mark places the one footing on S-06 (F1-1's cells). The seventh LB1 places nothing yet.

**W-50 The DWG source is no issue: it skips the mid-issue save (R0-G2's review).** As R0-G2 first
drew it, both DWGs lost every model-space entity Rev C appends: the product's lane (`convert_dwg`)
refused 7 classes on each by SHORTFALL (the paper DWG, census against converted: CIRCLE 358/354,
DIMENSION 152/125, HATCH 88/79, INSERT 128/123, LINE 1,945/1,822, LWPOLYLINE 671/638, TEXT
2,638/2,180 — G1's counts), and `test_rcc6_bnbc_dwg.py` read 2 failed, 5 passed. `emit/dwg.mint`
wrote the refusal into `sanity.json` and proved only the census, which counts what the DWG holds, not
what the product reads. The cause, measured on a one-sheet probe: `dxf2dwg` mints its own APPID,
VX_CONTROL and VX_TABLE_RECORD from the handle after the last record of the DXF's OBJECTS section.
The writers end Rev B with the paper set's mid-issue save (`_close_issue`, W-19), whose `update_all`
mints the DICTIONARYVAR below every record Rev C appends, so the minted records took Rev C's first
three handles; the model space's entity chain ran from Rev B's last entity into a duplicated handle
and stopped (the conversion's model space ends at 1E40). The same source without the mid-issue save
converts whole. Ruling: a write with `skip` (the DWG source) skips the mid-issue save — its handles
are nobody's evidence and the DWG is judged by its census (W-04) — so its one save mints those
records last. `mint` now proves the lane refused nothing (`_prove_carried`): a refused class stops the
generator by name instead of landing in `sanity.json`. `cad/tests/rcc6_bnbc/test_rcc6_bnbc_dwg_mint.py`
proves both on a one-sheet set, with the mid-issue save put back as its teeth (SHORTFALL on model
LINE 9/5 and TEXT 2/1). Cost: the DWG's Rev C records sit three handles lower than the DXF's, and
nothing keys on a DWG handle. The published DXFs are unchanged byte for byte. Their OBJECTS section
still ends below Rev C's handles, so anyone converting them with `dxf2dwg` would meet the same loss;
the product reads a DXF through ezdxf, and the DWGs it ships are minted from the source.

**R0-G2's proof.** `python -m fixtures.gen.rcc6_bnbc --out <scratch>` passes every check: notation
3,584 strings, facts 1,373, fit 63 views, wall, tally, traps 60/60 (52 kept, 8 new), determinism; check
9 reads paper 115 records corrected of 9,618, 1,027 added above 22A8, frames 115 and 1,017 above
21F3, the twin as the paper set, 0 lost or retyped, no VIEWPORT, 53 windows pinned, 29 untouched and
centred; `r2.pdf` 7,965,028 B (under 8 MiB by 0.40). The product's grammar over the regenerated
notation corpus reads 3,550, traps 8 and allows 26 of 3,584, none unaccounted (the E.G.L allowance
unspent is R0-G1's, retiring at R0-BASE). The partition's stages over the regenerated DXF: the five
tables BNBC read before read as before bar 1E3D, which R0-G1's D-S26 moved; three new tables (the slab
panel schedules) register 43 families; placements add the F1 footing and the two C4 columns
(non-framed digest `796d2950…`) and three SRR beams; the stair-roof layout is gridded, and four new
plans are ungridded. The note-clause recorder's asked set grows 148 → 163: S-01 30 → 34 as planned,
and a caption or note each on S-08, S-12 (2), S-19, S-20, S-21, S-23, S-24 (3) and S-25 — R0-REC
records them. `cad/tests/rcc6_bnbc/test_rcc6_bnbc_revc.py` holds the additions to the design. Both
DWGs convert through the product's lane with nothing refused (W-50): over a regeneration (every output
but the two DWGs, `sanity.json` and the manifest byte-identical to R0-G2's first), `test_rcc6_bnbc_dwg.py`
reads 7 passed, and with it the regeneration and DXF sanity suites read 154 passed. All 458 TEXTs Rev C
draws in model space are in the converted DXF; the one difference by type is the MULTILEADER the
profile names.

## R0-G3 — masonry has one home, F-ARCH (session 9)

**W-51 BNBC mints no brick wall and bills no brickwork (D-009).** The walls are the architect's:
F-ARCH authors them wall by wall at GF..6F and its golden bills BRICK_WALL × BRICKWORK, S-25's lintels
deducted (F-ARCH A-10, A-11) — 538.041 m³ against BNBC's retired lump of 259.425 m³ at 1F..6F, which
ran through about 18 columns, left out the grid-A facade and gave 1F the GF height. `lintels()` (was
`lintels_and_walls()`) mints the LINTEL members only, unchanged; `golden.py` and `golden_check.py`
drop the BRICK_WALL branch and the BRICKWORK unit. S-25's two wall-type lines and `schedule_marks()`
read `model.WALL_TYPES = {BW250: 250, BW125: 125}` instead of the members, with the same text and
position and `fact=authored(t)`, so no handle moves. The pair is not a BNBC cell (`cells.json`); the
M3 brickwork cells read `goldenRows("arch")`. Nothing flows from F-ARCH into BNBC, so no import cycle.

**R0-G3's proof.** Scratch regenerations before and after (`.private/work/session-9/chain/g3-before`,
`g3-after`): `rcc6-bnbc.dxf`, `rcc6-bnbc.model.dxf`, `rcc6-bnbc.libredwg-r2000.dxf`, `rcc6-bnbc.pdf`,
`bbs.golden.json`, `traps.json` and `sanity.json` byte-identical (`cells.json` moves only in its note, which now names `goldenRows("arch")`); `takeoff.golden.json`
370 → 358 rows, the 12 BRICKWORK rows gone, the 30 LINTEL rows byte-equal and every other row
identical; `notation.corpus.json` moves only in the two wall-type lines' facts (member `t` → authored).
F-ARCH over the new BNBC (`g3-arch`): `takeoff.golden.json`, `arch.dxf` and the notation corpus
byte-identical to the committed ones (766 rows, brickwork 538.041 m³); its `model.json` moves only in
LB1's ids (R0-G1's K6) and its manifest in BNBC's `model.py` pin — F-ARCH's re-mint is its own
`baseline:` in the R0 window, beside BNBC's. `cad/tests/rcc6_bnbc/test_rcc6_bnbc_masonry.py` holds it:
no brick-wall member or BRICKWORK row on either path, the LINTEL rows byte-equal to the committed
golden's, S-25's two wall-type lines printed from the table, and no BNBC module importing F-ARCH.
