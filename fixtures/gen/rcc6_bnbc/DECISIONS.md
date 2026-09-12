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

Brick walls 250 (perimeter) / 125 (partitions) at 1F–6F with the S-25 lintel schedule (L1, L2, LS1 by arch
mark, openings scheduled). Rows: `BRICKWORK` m³ by nominal thickness and `LINTEL` × 3 kinds. The
`BRICKWORK` rows sit outside the 36-cell matrix until AM-07 is ruled.

## Model decisions that deviate from E-fixture §3.2 (the generator is the single source)

- **D-01 stair sub-grid is `2'`, not `C'`.** A 2,438 mm C–D bay cannot host a 2,000/2,250 mm flight run
  plus a 1,219 mm landing in y; the flights run in x from grid 3 toward grid 2 (two 1,066.8 flights +
  304.8 well = 2,438.4 exactly), so the half-landing beam LB1 spans C→D at x = grid 2 + 4'-0" (`2'`).
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
  `POLYGON_PIT` is under (lawful) — `cells.json` records the expected residue.
- **D-07 covers** follow the drawing (S-01: caps 2" = 50.8 mm beside the Bible's 75) — a registered trap
  (T-NOT-COVER); the model uses 75 for caps/piles/footings where its own bars are computed, so the printed
  2" is the disagreement the product must surface, not a golden input.

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
per level, ≈ −60 m² over seven levels on F-RCC6); COLUMN/RCC_CONCRETE stays floor-to-floor and the M2
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
