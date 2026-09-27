# Rebar diameter splits and the starter Developer's Specification (drafts for the owner)

Session 02, 27 Sep 2026. A background agent drafted two inputs the owner owed and that had no draft
anywhere in the repo: the assumed diameter split for rebar by ratio (ADR 0010; `DiameterSplit`), and
the starter Developer's Specification (CONTEXT.md). Nothing here is from the real drawings. Its
working files were in a session scratchpad and are not kept. **Status: drafts, awaiting the owner's
verification** (docs/reviews/session-02-grill.md records the rulings).

## What is unsourced (read first)
- **No source gives shares by diameter for any element type** (BNBC, PWD, the Bangladeshi mills and
  Indian practice pages were searched). Each split is arithmetic on a typical Dhaka section the agent
  chose: reproducible, but the sections are judgement. **Every split is Low.** Sourced: the diameters the
  mills make, bar masses, BNBC's minimum tie, spiral and stirrup sizes.
- **No primary source defines "typical Dhaka mid-range".** The Specification is built from seven
  published developer feature lists (six mid-range, one premium) and one unconfirmed search snippet; the
  sample leans to smaller G+7 to G+10 developers in Mirpur and Uttara. PWD codes are benchmarks only;
  PWD bills frames in cum and railings in sqm (our units are rft and sft: conversions need a frame
  section and a railing height); skirting has no PWD item.
- **A likely double count:** sanitary ware in the Specification's "fitting" lines and in the plumbing
  Lump Sum (step 14, ৳170/sft, probably from PWD Annexure A's internal sanitary and water-supply rate,
  which probably includes fixtures; unchecked).

## 1. Diameter splits for rebar by ratio
The research advised against splitting ratio rebar (qs-defaults.md:111, :513, :519–520); the owner
overrode it (bd-defaults.md:86–87; ADR 0010). `share` is taken as a share of **mass (kg)** (PWD 08.1
measures rebar on standard mass per unit length; data-model.md:235 does not say).

**Diameters stocked (Grade 500):** KSRM B500DWR 8, 10, 12, 16, 20, 22, 25, 28, 32 mm
(https://ksrm.com.bd/ksrm-b500dwr/, High); AKS 8–40 mm (https://abulkhairsteel.com/brands/aks, High);
BSRM via a reseller: "most common sizes for home builders are 8mm, 10mm, 12mm, 16mm, and 20mm", 25 mm and
up "for very tall buildings" (Medium); PWD SoR 2022 2nd Revised Table 7 p. vi (masses 4–40 mm), couplers
for 16–32 mm p. 10 (High). 22 mm is made but not a home-builder size: set to 0 everywhere.

**BNBC bounds** (2012 final draft, Part 6 Ch. 8, https://law.resource.org/pub/bd/bnbc.2012/gov.bd.bnbc.2012.06.08.pdf;
the gazetted 2020 numbering unverified, Medium): column ties ≥ 10 mm for bars ≤ 32 mm (§8.1.9.4(a));
spirals ≥ 10 mm (§8.1.9.3(b)); IMF beam stirrups over 2d at ends at ≤ d/4, 8db, 24 dstirrup or 300 mm
(§8.3.10.4(b)); minimum slab steel 0.0018 × 420/fy, ≥ 0.0014 (§8.1.11.2); bored piles: no spiral size
(Ch. 3 §3.10.4.10.4). So 8 mm appears only in lintels and slab-edge members.

**Proposed splits (share of kg; each row sums to 1; all Low):**
| Family | 8 | 10 | 12 | 16 | 20 | 25 | Section behind it (assumed) | Section's own kg/m³ vs the owner's ratio |
|---|---|---|---|---|---|---|---|---|
| Bored pile (20") | – | 0.35 | 0.05 | 0.60 | – | – | 500 dia × 21 m; 8-16 top half, 4-16 lower; 10 mm spiral @150 (75 top 1.5 m); 12 mm rings @2 m | 79 vs 60; lighter ratio lifts spiral to ~0.40; an 8 mm spiral would be 0.24 |
| Pile cap | – | – | 0.20 | 0.10 | 0.55 | 0.15 | 4-pile 2.4×2.4×1.05; bottom 20 @125–150; top 12 @200 | 73–83 vs 90; 25 for 24" piles, 16 for 2-pile caps |
| Footing | – | – | 0.30 | 0.55 | 0.15 | – | 2.4×2.4×0.6; 16 @150 bottom; 12 @200 top | 61 vs 70 |
| Raft / mat | – | – | 0.05 | 0.10 | 0.40 | 0.45 | 1.0–1.2 m; 25 (20) @150 bottom + 15–30 % extra; 20 (16) top; 16 chairs | 70–85 vs 100 |
| Grade beam | – | 0.30 | 0.05 | 0.20 | 0.45 | – | 300×600; 3-20 top and bottom; 2-16 extra; 2-12 side; 10 @125 | 155 vs 150 |
| Column (before read from the drawing) | – | 0.25 | – | 0.15 | 0.35 | 0.25 | G+9 bands 750×600 16-25; 600×500 12-20; 500×300 8-16; 10 mm hoops; 40d lap per storey | 209 vs 240 |
| Shear wall / lift core | – | 0.25 | 0.35 | 0.30 | 0.10 | – | 200 wall 12 @150 V, 10 @150 H, 4-16 ends; 250 wall 16/12/20 | 168–217 vs 180 |
| Beam | – | 0.35 | 0.05 | 0.40 | 0.20 | – | 250×450–500; 2-16 top, 2–3-16 bottom; 20 extra at supports; 10 stirrups | 188–217 vs 180 |
| Slab (two-way, 5–6") | – | 0.80 | 0.20 | – | – | – | 150; 10 @150 cranked both ways; extra top 10/12 | 77–85 vs 90 |
| Stair | – | 0.35 | 0.55 | 0.10 | – | – | 1.2 m flight, 150 waist; 12 @125 main; 10 @200 distribution | 95 vs 110 |
| Basement wall (also tanks) | – | 0.05 | 0.45 | 0.45 | 0.05 | – | 300; earth face 16 @150 + extra; inner 12 @150 | 110 vs 120 |
| Lintel | 0.40 | 0.30 | 0.30 | – | – | – | 250×200 2-12/2-10; 125×150 2-10/2-8; 8 @150 | 99 |
| Sunshade, drop wall, parapet | 0.25 | 0.75 | – | – | – | – | 750 × 100; 10 @150; 8 @200 | 91 vs 90 |
| Slab on grade | – | 1.00 | – | – | – | – | mesh | – |
22 mm is 0 in every row.

**Cross-check:** weighted by the G+9 reference building's rebar (tax-and-allowances.md §B.2, 4.8 kg/sft),
the building's purchase mix is 8 mm 0.5 %, 10 mm 41 %, 12 mm 11 %, 16 mm 22 %, 20 mm 18 %, 25 mm 7 %.
If that is not what a G+9 buys, the splits are wrong.
**Structural note:** a split cannot vary by Storey Band (`DiameterSplit` is keyed by version, family,
diameter), though columns change diameter by band; columns are read from the drawing in M1.

## 2. The starter Developer's Specification (typical Dhaka mid-range)
Sources (fetched 27 Sep 2026): [MH] https://mohammadihomes.com/apartment-amenities/ ; [SB]
https://sarabuildersltd.com/project-details/sara-al-burj-tower ; [ASH] https://ashdevelopmentltd.com/mother-june/ ;
[HQ] https://haquegroup.com.bd/haque-manzil-villa/ ; [HV] https://hdl.com.bd/haven-islam-villa/ ; [MAH]
https://mahpropertiesltd.com/project/mah-rayhan-villa/ ; [RJ] RAJUK Uttara Sector 18 via
https://profilebd.blogspot.com/2021/09/rajuk-uttara-apartment-project-sector-18.html (secondary); [S11]
Signature11 ARC (premium) via https://bestbari.com/flat-sale-dhaka/signature11-arc-type-b/ ; [SH] Sheltech
search snippet only. Benchmarks: PWD SoR 2022 2nd Revised, printed page and Dhaka rate as printed.
Confidence: Medium = ≥ 3 of 7 mid-range brochures; Low = 1–2 or judgement. Basis: B brochures, J
judgement, RS the ruled Rule Set (qs-defaults.md §1.7 PL4). Doors, windows, grills and paint are
Material-and-Labour items (M2.md:504).

| Room | Surface | Item | Unit | PWD benchmark | Evidence | Conf. |
|---|---|---|---|---|---|---|
| Bed, master bed | Floor | 600×600 GP homogeneous tile, 20 mm 1:4 bed, white-cement joints | sft | 06.1.4 p.90 ৳1,698/sqm (mirror-polished 06.2.3 ৳2,026) | ASH, MAH, RJ, SH (MH, SB 16"; HQ 20") | Med B |
| Bed | Skirting | 4" skirting cut from floor tile | rft | none; 06.1.4 pro rata 0.33 sft/rft | MH, MAH (SB 6") | Low B |
| Bed | Wall | 12 mm plaster 1:6; acrylic plastic emulsion with sealer and putty, 2 coats | sft | 15.4 p.165 ৳312; 16.2.1 p.169 ৳265 | RS; MH, SB, ASH, HQ, MAH, RJ | Med |
| Bed | Ceiling | 6 mm plaster 1:4; plastic emulsion | sft | 15.5 p.165 ৳309; 16.2.1 (distemper 16.11 ৳219) | no brochure mentions ceiling plaster; paint split 3/3 | Low J |
| Bed | Door | 35–36 mm teak-veneered flush shutter, French polished, mortise lock | sft | 12.9.1.1 p.141 ৳5,683; 16.9.2 ৳533; 12.21 ৳1,277 each | all 7 | Med B |
| Bed | Door frame | teak-chambal or mahogany ~2.5"×5", French polished | rft | 11.1.1.1 p.135 ৳139,274/cum | MH, SB, HV, HQ, MAH, RJ | Med B |
| Bed | Window | aluminium sliding 4" anodised section, 5 mm clear glass | sft | 14.7.1.1 p.156 ৳3,920 + glass 14.16.1.2.1 ৳1,263 | all 7 | Med B |
| Bed | Window grill | MS flat-bar grill, enamel | sft | 13.3.1 p.148 ৳2,133; 16.3.1 ৳235 | MH, SB, ASH, HV, HQ | Med B |
| Living / dining | all but door | as bed | – | – | – | – |
| Living / dining | Entrance door | decorative solid Chattogram teak shutter, lock, viewer, chain, number plate | sft | 12.2.1.1 p.138 ৳16,121; 12.25 ৳631 | all 7 | Med B |
| Living / dining | Entrance frame | Chattogram teak | rft | 11.1.5.1 p.135 ৳263,975/cum | HV | Low B |
| Toilet | Floor | 300×300 GP homogeneous, matt/non-slip | sft | 06.1.1 p.90 ৳1,385 | SB, ASH, HV, SH | Med B |
| Toilet | Skirting | none (wall tiles to floor) | – | – | – | J |
| Toilet | Wall to 7'-0" | 300×600 glazed ceramic tile on 20 mm mortar | sft | 06.6.3 p.92 ৳1,921 | height HV, MAH; size ASH, SH | Med/Low |
| Toilet | Wall above 7'-0" | plaster 1:6, plastic emulsion | sft | 15.4; 16.2.1 | M2.md:424 | Low J |
| Toilet | Ceiling | 6 mm plaster 1:4, synthetic enamel | sft | 15.5; 16.3.1 (nearest) | MH, MAH | Low B |
| Toilet | Door | uPVC shutter and frame | sft | 22.12 p.213 ৳3,878 | MH, SB, ASH, HV | Med B |
| Toilet | Window | small aluminium sliding, obscure glass, grill | sft | 14.7.2.1 ৳5,334; 14.16.1.3 ৳1,249 | silent | Low J |
| Toilet | Fittings per toilet | 2-piece commode (RAK Karla/Amy class), pedestal basin with pillar cock, bib cock, hand shower, grating, mirror, towel rail, soap case, paper holder | nos | 26.01.1 p.233 ৳9,212 and 26.x items | ASH, MAH, HV | Med B (double-count risk) |
| Master toilet | Extra fittings | commode RAK Orient class; shower mixer and head | nos | 26.01.3 ৳11,766; 26.35.1 ৳5,923 | MAH, SB | Low B |
| Kitchen | Floor | 300×300 GP homogeneous | sft | 06.1.1 | SB, MAH | Low B |
| Kitchen | Wall to 7'-0" | 300×600 glazed tile; above, plaster and emulsion | sft | 06.6.3; 15.4; 16.2.1 | MH, ASH, SB | Med B |
| Kitchen | Ceiling | 6 mm plaster, enamel | sft | 15.5; 16.3.1 | MH | Low B |
| Kitchen | Worktop | RCC/brick platform, 18 mm granite, 600 deep | rft | nearest 06.22 p.97 ৳9,435/sqm | MAH, RJ, SH | Low B |
| Kitchen | Sink | single-bowl stainless with tray, sink cock | nos | 26.17.4 ৳5,447; 26.33.1 | SB, ASH, HQ, MAH, SH | Med B |
| Verandah | Floor, skirting | 600×600 GP homogeneous; 4" tile skirting | sft; rft | 06.1.4 | MH, ASH, HV | Low B |
| Verandah | Wall, ceiling | 12 mm plaster 1:4; exterior acrylic | sft | 15.1.2; 16.1.1 ৳282 | – | Low J |
| Verandah | Door | uPVC (or aluminium sliding 14.4.1 ৳3,360) | sft | 22.12 | SB, ASH (HV alu) | Low B |
| Verandah | Grill/railing | MS grill over brick parapet, enamel | sft | 13.6 p.150 ৳2,748 | ASH, HV (SB railing) | Low B |
| Lobby | GF floor | 18 mm Indian granite on 25 mm 1:2 bed | sft | 06.22 p.97 (marble 06.17.1 ৳8,213) | MAH, RJ | Low B |
| Lobby | Typical floor | 600×600 GP homogeneous | sft | 06.1.4 / 06.2.3 | ASH, RJ | Low B |
| Lobby | Wall | plaster and emulsion; lift wall granite on GF, tile above | sft | 15.4; 16.2.1; 06.24 ৳7,382 | MH, MAH | Low B |
| Stair | Treads, risers | GP homogeneous stair tiles, non-skid nosing | sft | 06.10.2 p.93 ৳1,912 | MH, MAH, ASH | Med B |
| Stair | Railing | MS balusters, timber handrail | rft | 20.6.2.1 p.200 ৳4,860/sqm | MAH (MH steel) | Low B |
| Parking | Floor | 300×300 cement pavement tile on 1:4 bed | sft | 06.15.1 p.94 ৳1,242 | MH, SB, HQ, MAH | Med B |
| Parking | Walls, ceiling, guards | plaster and emulsion; MS-angle column guards | sft; rft | 15.4; 15.5; 16.2.1; 20.19 ৳647/m | MH | Low B |
| Roof | Floor | lime terracing avg 100 mm (7:2:2) | sft | 17.4 p.177 ৳19,740/cum | MH, SB, MAH, HQ | Med B |
| Roof | Parapet | 12 mm plaster both faces, weather coat | sft | 15.1.1 ৳324; 16.1.1 | SB | Low B |
| Exterior | Outer walls | 12 mm plaster 1:4; 6 mm on RCC; acrylic weather coat; drip course | sft; rft | 15.1.2 ৳344; 15.5; 16.1.1; 15.10 | MH, SB, ASH, HV, MAH, RJ | Med |

**Premium tier:** 800×800 double-charge or imported porcelain, marble in lobbies and living; Burma teak
entrance doors 7'-6"–8'-0"; EDF 4" window sections; imported toilet tiles to false-slab height, glass
shower screens, counter basins on marble, wall-hung commodes, American Standard/Grohe/Cotto; granite
worktop with porcelain backsplash, double-bowl sink; gypsum false ceiling in the lobby; heat-protective
or landscaped roof.

## Least sure (check first)
1. Sanitary ware: the Specification's fittings or the plumbing Lump Sum, not both (recommend the
   Specification per confirmed toilet, the Lump Sum reduced to pipework).
2. Ceilings: 6 mm plaster at all; plastic emulsion or distemper.
3. The 25 mm shares (columns 0.25, pile caps 0.15, rafts 0.45); 22 mm anywhere.
4. Pile spiral 10 or 8 mm (24–40 % of pile rebar); 16 or 20 mm main bars.
5. Tie and stirrup shares 0.25–0.35 in beams, columns, grade beams.
6. Floor tiles 600×600 or 16"×16"; mirror polished or not.
7. Toilet and kitchen wall tiles: 300×600 to 7'-0", or smaller to full height.
8. Verandah door uPVC or aluminium; grill or railing; kitchen door or none.
9. Kitchen worktop granite or tiled; per rft.
10. Benchmark conversions needing a parameter (frame section, railing height, terracing thickness,
    skirting pro rata).
11. `DiameterSplit.share` as a share of kg.
