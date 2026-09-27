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
