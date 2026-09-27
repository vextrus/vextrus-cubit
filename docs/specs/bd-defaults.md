# The Bangladeshi defaults, as the owner verified them

The values Vextrus ships as a new Developer's starting Rule Set, Rate Analyses, Rebar Ratios, Priced BOQ
structure and Material Schedule. Drafted in docs/research/qs-defaults.md with a source and confidence
for every figure; each line below is one the owner (a practising civil engineer) has verified or set.
A Developer edits its own copy (ADR 0009).

## Rule Set
- **Joint rule:** IS 1200 Pt 2 cl. 4.2.2: the slab runs over beams and columns; a column stops at the
  slab soffit; a beam runs between column faces below the soffit (ADR 0009, amended 26 Sep 2026).
- **Billing Units:** 10" and thicker brickwork in cft, 5" in sft; bricks in nos (ADR 0008, amended).
- **Laps (R3):** measured, as a separate visible line beside the net bars, and included in the
  Material Schedule. The Benchmark Rate applies to net-of-lap kg. Where the drawing leaves a lap
  unstated, the default is 40 × bar diameter for tension laps (editable), and the figure's Rebar Basis
  is "from the drawing + rules". Owner's ruling, 26 Sep 2026: "Agree and yes".

- **The default Rule Set** is docs/research/qs-defaults.md §1 (about 50 rules: IS 1200 as written with
  PWD's item conventions on top), each rule labelled with its source. Owner's ruling, 26 Sep 2026:
  "Agree, 450". Its practice-based parameters, as set:
  - E1 excavation working space: **450 mm (1'-6")** each side (Dhaka practice; IS 1200 says 600 mm);
  - E4 blinding: 3" projection, 3" thick;
  - P1 pile over-cast above cut-off: 600 mm (2'), head breaking its own item;
  - L1 lintel bearing: 150 mm (6") each side;
  - FW5 slab and step edges under 200 mm: measured as area (a stated departure from IS 1200's rm);
  - F6 slabs of different thickness over a beam: each runs to the beam's centre line;
  - PT1 painting: the plaster area it covers, per face.
- **Three rules refined on the real read** (owner's ruling, 27 Sep 2026, session 02 Q23: "Agree with your
  recommendation on Q23"; source: practice; evidence: the session-02 priced prototype):
  - P3 grade (tie) beams: clear between the faces of the pile caps or footings they connect; **where a
    grade beam bears on the cap** (its soffit at the cap's top), clear between the faces of the columns it
    connects, the cap measured to its own top;
  - E4 extends to grade beams: brick flat soling and CC blinding under grade beams as under caps and
    footings, drawn or not (Dhaka practice); FW6 then measures no grade-beam soffit;
  - E3 sand filling where no depth is stated: from existing ground level to the underside of the
    ground-floor slab, marked "derived", with a Question where a section disagrees.
- The Hand Takeoff is measured under these same written rules (ADR 0005).

## Rebar Ratios (ADR 0010)
Default per element type, overridable per Storey Band. Each includes laps, ties and stirrups;
cutting wastage is in the Rate Analysis. No primary source exists; the owner set them from practice
(26 Sep 2026: "Agree and yeah all right").

| Element | kg/cft | kg/m³ |
|---|---|---|
| Bored pile | 1.7 | 60 |
| Pile cap | 2.5 | 90 |
| Footing | 2.0 | 70 |
| Raft / mat | 2.8 | 100 |
| Grade beam | 4.2 | 150 |
| Column | 6.8 | 240 |
| Beam | 5.1 | 180 |
| Slab (two-way, 5–6") | 2.5 | 90 |
| Stair | 3.1 | 110 |
| Lift core / shear wall | 5.1 | 180 |
| Basement wall | 3.4 | 120 |
| Lintel | 2.5 | 90 |
| Sunshade, drop wall, parapet | 2.5 | 90 |

**Whole-building check (ADR 0016):** rebar 4.5–6 kg per sft of Gross Floor Area for Dhaka G+6 to
G+14; outside the range is flagged, never blocked.

## Rate Analyses (ADR 0006)
**Shape** (owner's ruling, 26 Sep 2026: "Yes agree with the shape and your four recommendations"):
one Rate Analysis per item, per unit, shown per 100 cft or 100 sft as PWD quotes it. Material lines
(Resource, quantity per unit, unit, wastage %); labour lines (the item's own, or "covered by Labour
Contract X"); optional plant lines. Working rate = Σ materials × (1 + wastage) × Market Price +
labour. No mark-ups inside item rates; they sit in the Estimate's layers.

**The starting library:** the 18 items of docs/research/qs-defaults.md §2.3, each derived from PWD's
published relations (SoR 2022, 2nd Revised, p. x), for example RCC 1:1.5:3 = 21.8 bags, 40.9 cft
F.M. 2.2 sand, 81.8 cft stone chips per 100 cft. Plus:
- **Ready-mix RCC per cft including the pump,** as a Material-and-Labour-style item whose cement and
  aggregates leave the Material Schedule.

**Parameters, as shipped (all editable):**
- dry-volume factor 1.5 (PWD), a parameter of each Mix;
- bricks per 100 cft of brickwork 1,100 (PWD), flagged against the arithmetic ~1,244;
- wastage: cement 2 %, sand 5 %, stone and brick chips 3 %, bricks 3 %, rebar 3 %, tiles 5 %;
- no Labour Contract rates: the Developer enters its own.

## Priced BOQ structure (owner's ruling, 26 Sep 2026: "Agree")
- **Seven BOQ Sections by building part:** Sub-structure; Super-structure; Masonry; Finishes; Doors &
  Windows; Services; External works. Within each, items group by element class (piles, caps, columns,
  beams, slabs…); each RCC element's concrete, formwork and rebar sit together.
- **Numbering** `section.group.item` (2.1.1 = Super-structure › Columns › RCC 1:1.5:3), derived, never
  stored. The PWD code appears only in the Benchmark column.
- **Each line:** number, description (mix, grade, class), Billing Unit, quantity, rate, amount,
  Benchmark Rate (printed and net), Basis (measured, by ratio, from the drawing, allowance, lump sum),
  Trace; it opens to its per-floor breakdown.
- **Lump sums** are "LS" lines in Services from the MEP template; **provisional sums** sit at the end
  of the section they provide for, outside the measured subtotal; anything unclassified shows under a
  visible "Unclassified" heading.
- **Totals:** a subtotal per section, the measured subtotal, then the Estimate's layers (ADR 0006).
- **A PWD-chapter view by Trade** is one switch away, for comparing with the SoR.
- Rebar by ratio carries an "assumed" diameter split (ADR 0010, the owner's Q7 ruling), overriding the
  research's advice to leave it undivided.

## Material Schedule (owner's ruling, 26 Sep 2026: "Agree"; stages per ADR 0002)
Gross (what to buy: wastage included); materials under a Material-and-Labour Contract excluded; each
cell opens to the BOQ items that produced it.

| Material | Unit (metric) | Split by |
|---|---|---|
| Cement | bags of 50 kg (t) | type where the Rate Analysis names it (OPC for RCC, PCC for masonry and plaster) |
| Sylhet / coarse sand, F.M. 2.2 | cft (m³) | — |
| Local sand, F.M. 1.2 | cft (m³) | — |
| Filling sand, F.M. 0.5–0.8 | cft (m³) | — |
| Stone chips, 20 mm down | cft (m³) | — |
| Brick chips (picked jhama) | cft (m³) | — |
| Bricks, first class | nos | — |
| Rebar | kg, ton totals | diameter from the drawing, or "assumed" by ratio |
| Binding wire | kg | — |
| Floor tiles | sft (m²) | size |
| Ready-mix concrete | cft (m³) | grade; listed apart, its cement and aggregates not above |

## Allowances per Takeoff Step (ADR 0002; owner's ruling, 27 Sep 2026, session 02 Q8: "Agree with your recommendation on Q8, all ✓")
Vextrus's starting allowances are the consumptions per sft of Gross Floor Area in
docs/research/tax-and-allowances.md §B.2 (G+9, with G+6 and G+14 where they differ), priced at current
Market Prices through their Rate Analyses. They are **Low confidence** and are replaced by each
Developer's past projects. The owner verified the reference building they are computed on
(§B.1), every item as drafted:
- typical floor 60′×64′ = 3,840 sft, ground floor parking, 4 flats per floor, 10′ floor to floor, 6″
  two-way beam-and-slab (the default floor type);
- 26 columns, average section 2.0 / 2.6 / 3.6 sft (G+6 / G+9 / G+14); core 25 rft of 8″ wall (one
  lift) or 50 rft of 10″ wall (two lifts);
- 800 rft of beams per floor, about 10–12″ × 14–15″ below the slab;
- piles 20″ × 60–70′ at 110–140 kips (G+6/G+9), 24″ × 80′ at 220 kips (G+14); 220 psf service load;
  caps 70 / 115 cft per pile; grade beams 500 rft of 12″×24″;
- walls per flat floor 250 rft of 10″ external and 700 rft of 5″ internal, so **bricks ≈ 10 per sft**
  of Gross Floor Area (above the Indian 7.3: the BDS brick is smaller and Dhaka flats are wall-dense);
- **ceiling plaster included** (1.13 sft per sft);
- windows 13 % of floor area, doors 11 per 1,000 sft, tanks about 30 cft of RCC per flat;
- Rebar Ratios slab on grade 1.5 kg/cft and roof stair and lift room 4.0 kg/cft (the researcher's,
  now the owner's).
Cross-check owed: the Sample Project's measured consumption per step beside these (session 02's
priced prototype).

## MEP and site-works template, the Estimate's layers, the MD's consumption ranges (owner's ruling, 27 Sep 2026, session 02 Q10: "Agree with your recommendation on Q10, all ✓")
All Low confidence; each Developer's past projects replace them. Source: docs/research/tax-and-allowances.md §B.

**MEP and site-works template** (ADR 0007 step 14): ৳ per sft of Gross Floor Area (PWD 2022 ÷ 1.227),
typed including VAT; the range is each line's sanity Check (ADR 0027).
| Line | Default | Range |
|---|---|---|
| Plumbing and sanitary | 170 | 100–205 |
| Electrical | 190 | 160–210 |
| Lift | 105 | 80–200 |
| Generator | 80 (no source; the least sure) | 50–100 |
| Substation and utility connections | 90 | 70–120 |
| Fire protection | 50 | 30–120 |
| Pumps, intercom, CCTV | 40 | 30–60 |
| Gas | 0 | 0–17 |
| Site works | 60 | 40–100 |

**The Estimate's layers** (ADR 0006): preliminaries and site overheads 6 % of direct cost; contingency
5 %. PWD's caps for reference: testing 1 %, price contingency ≤ 8 %, physical ≤ 2 %.

**The MD's consumption ranges** (ADR 0016; per sft of Gross Floor Area; outside is a flag, never a
block): rebar 4.5–6 kg (set 26 Sep); cement 0.36–0.52 bags; concrete 1.25–1.85 cft; bricks 8.4–11.6
(±15 % around the reference building's G+6 to G+14 points).

## Rebar diameter splits for rebar by ratio (ADR 0010; owner's ruling, 27 Sep 2026, session 02 Q13: "Agree with your recommendation on Q13.")
The assumed split of ratio rebar by diameter, **share of kg**, per Element Family; each row sums to 1;
22 mm is 0 everywhere; all **Low** (no source gives shares by diameter: arithmetic on typical Dhaka
sections, docs/research/diameter-splits-and-specification.md §1). Every figure using them is marked
"assumed"; rebar read from the drawing replaces them element type by element type.
| Family | 8 | 10 | 12 | 16 | 20 | 25 |
|---|---|---|---|---|---|---|
| Bored pile | – | 0.35 | 0.05 | 0.60 | – | – |
| Pile cap | – | – | 0.20 | 0.10 | 0.55 | 0.15 |
| Footing | – | – | 0.30 | 0.55 | 0.15 | – |
| Raft / mat | – | – | 0.05 | 0.10 | 0.40 | 0.45 |
| Grade beam | – | 0.30 | 0.05 | 0.20 | 0.45 | – |
| Column (until read from the drawing) | – | 0.25 | – | 0.15 | 0.35 | 0.25 |
| Shear wall / lift core | – | 0.25 | 0.35 | 0.30 | 0.10 | – |
| Beam | – | 0.35 | 0.05 | 0.40 | 0.20 | – |
| Slab | – | 0.80 | 0.20 | – | – | – |
| Stair | – | 0.35 | 0.55 | 0.10 | – | – |
| Basement wall, tanks | – | 0.05 | 0.45 | 0.45 | 0.05 | – |
| Lintel | 0.40 | 0.30 | 0.30 | – | – | – |
| Sunshade, drop wall, parapet | 0.25 | 0.75 | – | – | – | – |
| Slab on grade | – | 1.00 | – | – | – | – |
Weighted over the G+9 reference building: 10 mm 41 %, 16 mm 22 %, 20 mm 18 %, 12 mm 11 %, 25 mm 7 %,
8 mm 0.5 %. A split cannot vary by Storey Band (columns are read from the drawing from M1).

## The starter Developer's Specification (owner's ruling, 27 Sep 2026, session 02 Q20: "Agree with your recommendation on Q20")
Vextrus's starter, typical Dhaka mid-range, is the table in
docs/research/diameter-splits-and-specification.md §2 (room type × surface, with the PWD SoR benchmark of
each), **Low**, replaced by each Developer's own brochure. In one breath: 600×600 GP homogeneous floor tile
in beds, living and verandah (4″ tile skirting), 300×300 in toilets and kitchen, 18 mm granite in the
ground-floor lobby, cement tiles in parking, lime terracing ~100 mm on the roof; 12 mm plaster with
plastic emulsion inside, weather coat outside, toilets and kitchen tiled 300×600 to 7′-0″; ceilings 6 mm
plaster with plastic emulsion; a solid Chattogram teak entrance door, teak-veneered flush room and
kitchen doors, uPVC toilet and verandah doors, MS grill on the verandah parapet; 4″ aluminium sliding
windows, 5 mm glass, MS grills; a granite kitchen worktop and a stainless sink; stair treads in GP
homogeneous tiles with an MS railing.
**Sanitary ware and taps are not in the starter's "fitting" lines**: the MEP template's "plumbing and
sanitary" Lump Sum (৳170/sft, Q10) keeps them, so nothing is counted twice. They move into the
Specification (counted per confirmed toilet) only when the owner sets a pipework-only default for the
plumbing Lump Sum.

## Starter labour rates (owner's ruling, 27–28 Sep 2026, session 02 Q30: "Agree with your recommendation on Q30.")
PWD prices labour per day only (docs/research/pwd-sor-2022-input-prices.md §5). Vextrus's starter labour
rates, all **Low**, each Developer's own replacing them: casting-area Labour Contract ৳170/sft of casting
area; brickwork ৳40/cft (10″) and ৳20/sft (5″); plaster ৳15/sft; tile laying ৳30/sft; pile boring and
casting ৳450/rft; from PWD's per-unit items (net of mark-ups): earthwork in excavation ৳3.88/cft,
backfill ৳4.78/cft, sand filling labour ৳6.88/cft (derived), shuttering outside the contract ৳18/sft,
pile-head breaking ৳345 per head, concrete casting outside the contract ৳31.50/cft (derived). Rebar
binding outside the contract, brick flat soling and painting labour have no figure: they stay unpriced
and flagged "rate not entered", never a silent ৳0, until a figure is entered.
The starter Market Price set is PWD SoR 2022 (2nd Revised), Dhaka column
(docs/research/pwd-sor-2022-input-prices.md, refuter-checked), with brick chips derived at ৳120.20/cft.
