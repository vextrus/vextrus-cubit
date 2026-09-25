# Bangladeshi QS defaults: Rule Set, Rate Analysis, Rod Ratios, Priced BOQ, Material Schedule

Researched 2026-09-26 for M1 and M2. The question: what should Vextrus ship as its Bangladeshi
defaults, drafted so that a Dhaka QS can check them line by line? Terms are those of `CONTEXT.md`.
Section 6 proposes new ones, and `CONTEXT.md` is not edited here.

**How to read the confidence column.** **High** means a primary source states it in those words.
**Medium** means it is derived by plain arithmetic from a primary source, or a primary source states
it for a neighbouring case. **Low** means practice or a secondary source, or my judgement. Every Low
figure is repeated in "For the owner to verify" at the end.

## Sources used

Primary sources (fetched and read, 26 Sep 2026):
- **[SoR-2R] PWD Schedule of Rates 2022 (2nd Revised), Part A: Civil Works.** Sixteenth edition,
  in force from **22 January 2026**, 336 pp.
  <https://ss.pwd.gov.bd/document/sor/Final_SoR_2022%20_2nd_Revised.pdf>. Page numbers below are
  the SoR's own printed numbers.
  - It supersedes the 2022 (Revised) edition, in force from 23 Feb 2023.
  - Its VAT moved from 7.5% to 10% (preface, p. 5 of the PDF).
  - This PDF stops at Chapter 33. Its Annexures A–C are listed in the table of contents but are not
    in the file.
- **[AnxA] / [AnxB] PWD SoR 2022, Annexure A (Plinth Area Rates) and Annexure B (Guidelines for
  Preparation of Preliminary Estimates).** Both are the original 2022 edition (page numbers 344 and
  357–364), <http://ss.pwd.gov.bd/document/sor/>.
- **[IS1200-n] IS 1200, Methods of Measurement of Building and Civil Engineering Works.** Bureau of
  Indian Standards, full text from archive.org (`gov.in.is.1200.<part>.<year>`):
  - Part 1 (1992) Earthwork;
  - Part 2 (1974, with amendments 1 and 2) Concrete;
  - Part 3 (1976) Brickwork;
  - Part 5 (1982) Formwork;
  - Part 8 (1993) Steel work, including reinforcement;
  - Part 11 (1977) Paving and floor finishes;
  - Part 12 (1976) Plastering.
- **Old product knowledge (branch `dev-lane-and-jev`, read with `git show`, no code carried):**
  - `docs/specs/cubit.bible.xml`: laws L-MEA-01/02/09, L-BD-01/02/04/08, L-FRM-07;
  - `docs/decisions/bill-taxonomy.md`;
  - `fixtures/rcc6-bnbc/takeoff.golden.json`.

Secondary and low-trust sources, marked wherever they are used:
- B. N. Dutta's steel percentages as quoted by civilconstructionguide.com. The book itself was not
  read.
- Generic Indian and Bangladeshi "thumb rule" web pages.
- Bangla estimating blogs (civilbangla.com and similar).

**Where the sources run out.** I found no public primary source for any of these:
- a Bangladeshi method of measurement: the old product reached the same finding in L-BD-01, "No
  national SMM exists", and PWD's item descriptions carry only fragments of one;
- PWD's own *analysis of rates*, that is, the coefficients behind each SoR rate. PWD publishes the
  input prices and the mark-ups, not the per-item consumptions;
- Dhaka Labour Contract rates;
- Dhaka Rod Ratios by element type;
- a Developer's BOQ format;
- the REHAB material I looked for.

For these, the defaults below are derived (Medium) or judged (Low), and the owner's check is the
evidence.

---

## Conclusions

1. **The PWD SoR is a benchmark and a vocabulary, not a method of measurement.** PWD states a few
   rules inside its item descriptions: gross concrete section, formwork separate, rod by standard
   mass, brickwork at nominal 250/375 mm, per-floor added rates. Everything else (where members
   stop at a joint, and every deduction threshold) has to come from IS 1200.
   - The default Rule Set is therefore "IS 1200 as written, with PWD's item conventions on top",
     and it is labelled so.
   - This matches ADR 0009 and the old product's L-BD-01.
2. **IS 1200 gives a different joint rule from the one the old product used.**
   - IS 1200 Part 2 cl. 4.2.2: a column stops at the underside of the slab, a beam runs between
     column faces and below the slab, and the slab runs through over both.
   - Vextrus Cubit instead ran columns floor to floor through the slab (L-MEA-09).
   - Both give the same total concrete. They split it differently between the column item and the
     slab item, and those items carry different PWD rates.
   - **This is the first owner decision.** I recommend IS 1200, because it is citable.
3. **The Rate Analysis coefficients can be derived from PWD's own published relations.** PWD's
   "Miscellaneous measurement relations" (SoR-2R p. x) give:
   - dry volume = 1.5 × wet volume;
   - one bag = 1.25 cft = 50 kg;
   - 1,100 bricks per 100 cft of brickwork.

   From these, RCC 1:1.5:3 comes to **21.8 bags, 40.9 cft sand and 81.8 cft stone chips per 100
   cft** (7.7 bags per m³). All 15 starting items are derived the same way (Section 2), so every
   coefficient traces to one page of one primary document.
4. **The Benchmark Rate is not like-for-like with a Developer's working rate.**
   - Every PWD rate carries contractor's profit 10%, overhead 3.5% and VAT 10% (SoR-2R p. 1).
   - Their composition can be inferred exactly. PWD Annexure A's own "22.703% extra" for the 7.5%
     VAT edition equals (1 + 0.10 + 0.035) ÷ (1 − 0.075) to five digits.
   - So a printed rate is about **1.261 × direct cost** in the 2nd Revised edition.
   - The Priced BOQ should show the PWD rate as printed, and offer "PWD net of mark-ups"
     (× 0.793) as the fair comparison. Otherwise every MD sees Vextrus "20% under PWD" and
     misreads it.
5. **No citable Dhaka Rod Ratios exist.**
   - The defaults in Section 3 are my engineering judgement, bounded by BNBC/ACI minimums and
     cross-checked against Indian thumb rules.
   - All are Low confidence and must be set by the owner before M1 ships.
   - The key default is a column at about **6.8 kg/cft (240 kg/m³)**.
6. **The Priced BOQ should be grouped by trade, in PWD chapter order.** It then reads like the
   benchmark it sits beside.
   - Items are numbered `trade.group.item`, with the PWD item code shown in the Benchmark column.
   - MEP and other lump sums sit as lines inside their trade.
   - Provisional sums are marked and kept out of the "measured" subtotal.
7. **The Material Schedule should be a matrix: materials down the side, and floors grouped into
   construction stages across the top.**
   - Seven default stages: Piling; Foundation; Frame (per floor); Brickwork; Plaster; Flooring and
     finishes; Roof and external.
   - Sand is split into its three grades, because PWD and Dhaka sites buy them as different
     materials.
   - Rod by ratio is shown in kg without diameters. Only rod from the drawing is split by diameter.
8. **Three places where the owner's earlier rulings and the sources disagree.**
   - ADR 0008 says brickwork is shown in sft. PWD and IS 1200 measure 250 mm and thicker walls in
     cum (cft), and only 125 mm walls in sqm (sft).
   - The default joint rule (point 2 above).
   - Whether laps are measured (PWD 08.1 says rates "exclude splices or laps"; IS 1200 Part 8
     cl. 11.1 says "authorized overlaps … shall be measured").

---

## 1. Rule Set: the first Measurement Rules

Written as a QS would read them. Every rule is one editable row of the default Rule Set. "Param" marks a number
the Developer can change without rewriting the rule. Imperial figures are the SI rule converted for display
(ADR 0008).

### 1.0 General

| # | Rule | Source | Conf. |
|---|---|---|---|
| G1 | Quantities are measured **net, as drawn**. No wastage, bulking or shrinkage is added to a BOQ quantity; wastage lives only in the Rate Analysis. | IS1200-3 cl. 2.3; IS1200-12 cl. 2.4 ("measured net"); old L-BD-02 | High |
| G2 | Dimensions are taken to 0.01 m (slab thickness to 0.005 m). Areas are to 0.01 m² and volumes to 0.01 m³ **on documents only**; the Building Model keeps full precision. | IS1200-2 cl. 2.4.1–2.4.3 | High |
| G3 | Concrete is measured on the **gross concrete section**. There is no deduction for rod, for pipes or conduits up to 100 cm² in section, for openings up to 0.1 m² (param), or for ends of dissimilar members up to 500 cm² in section. | SoR-2R ch. 07 headings "measured on gross concrete section"; IS1200-2 cl. 4.1.8 (a)–(d) | High |
| G4 | Concrete, formwork and rod are **three separate items** for every RCC element. | SoR-2R 07.1 note "Rate is excluding … reinforcement … and … shuttering & centering"; IS1200-2 cl. 4.1.3, 4.1.5 | High |
| G5 | Each RCC item is split by element class the way PWD prices it: (a) foundations up to plinth (footing, pile cap, raft, grade beam, floor slab on grade); (b) columns and walls; (c) slabs, beams, lintels and stairs; (d) cornice, railing, drop wall, fins and sunshade. | SoR-2R 07.3.1–07.3.4 | High |
| G6 | A quantity on a floor above the ground floor keeps its floor. This lets PWD's per-floor added rates, and the Material Schedule by floor, be computed. | SoR-2R 07.11, 04.10, 08.2, 15.16 | High |

### 1.1 The frame (M1): columns, beams, slabs

| # | Rule | Source | Conf. |
|---|---|---|---|
| F1 | **Column height:** from the top of the pile cap or footing to the underside of the first slab above, then from the top of each floor slab to the underside of the slab above. The column runs through the beam depth below the slab. | IS1200-2 cl. 4.2.2.1 | High (as IS text) |
| F1-alt | *Alternative (Vextrus Cubit, L-MEA-09):* the column runs floor to floor through the slab, and the slab is measured less the column's plan area. **Owner to choose; see Conclusion 2.** | old bible L-MEA-09 | — |
| F2 | A column's section is the size given for its **Storey Band** on the column schedule, applied storey by storey. Where a size changes, the new size starts at the top of the slab of the storey where the band starts. | CONTEXT.md "Storey Band"; IS1200-2 cl. 4.2.2.1 (measured storey by storey) | Medium |
| F3 | **Beam length:** clear between the faces of the columns (or walls) that support it, including any haunch. A secondary beam runs to the side faces of the main beam that carries it. | IS1200-2 cl. 4.2.2.3; secondary beams by analogy with IS1200-5 cl. 6.6 | High / Medium |
| F4 | **Beam depth:** from the underside of the slab to the underside of the beam. For an inverted (upturned) beam: from the top of the slab to the top of the beam. | IS1200-2 cl. 4.2.2.3 | High |
| F5 | **Slab:** measured over beams and columns, to the outer face of the edge beam or the slab's drawn edge. Deduct openings over 0.1 m² (param). | IS1200-2 cl. 4.1.8(b), 4.2.2 (follows from F1, F3 and F4) | High |
| F6 | Where two slabs of different thickness meet over a beam, each slab runs to the beam's centre line, and the beam is measured below each slab's soffit for its half width. | No source found; geometry chosen to avoid double counting | Low |
| F7 | A projection whose average thickness is **100 mm or less** is a sunshade (chajja). It is measured as its clear projection and belongs to item class (d). Thicker projections are measured as slab. | IS1200-2 Amendment 2 (1984) to cl. 4.2.3 | High |
| F8 | Drop walls, parapets, fins and railings in RCC belong to class (d) and are measured on their own. | SoR-2R 07.3.4; IS1200-2 cl. 4.2.1 (y) | High |

### 1.2 Formwork

| # | Rule | Source | Conf. |
|---|---|---|---|
| FW1 | Formwork is **its own item**, measured as the **area in contact with the concrete**, in sqm (shown in sft), and priced by element class. | IS1200-5 cl. 6.1; SoR-2R 07.12.1–07.12.11 | High |
| FW2 | **Column:** perimeter × height from the top of the slab to the underside of the slab above. **No deduction** where beams frame in. | IS1200-5 cl. 6.6 ("no deduction … from the formwork to … column … at intersections of beam") | High |
| FW3 | **Beam:** both sides (each side's depth below the slab soffit) plus the soffit, clear between column faces. A secondary beam's formwork runs to the sides of the main beam, with no deduction from the main beam. | IS1200-5 cl. 6.6 | High |
| FW4 | **Slab:** the soffit area between beam sides, plus the slab's free edges. Openings up to 0.4 m² are not deducted (param). | IS1200-5 cl. 5.1, 6.4 | High |
| FW5 | Slab and step edges under 200 mm thick are measured as **area** (edge length × thickness) inside the slab item. IS measures them in running metres; I recommend area for Dhaka simplicity. | IS1200-5 cl. 5.1 (running metres) | Low (a departure) |
| FW6 | **Footings, pile caps and grade beams:** sides only. Soffits are measured only where the drawing shows no blinding or soling. **Bored piles: no formwork.** | IS1200-5 cl. 5.1 (foundations class); practice | Medium |
| FW7 | **Stairs:** waist-slab soffit, plus risers, plus the sides of the flight (strings). Landings are measured as slab. | IS1200-5 cl. 5.1; SoR-2R 07.12.10 | Medium |
| FW8 | Where a storey is higher than 4 m, the extra height is a separate added-rate line (Benchmark only). | SoR-2R 07.15 (sqm per extra 1 m); 07.10 for concrete | High |

### 1.3 Rod

| # | Rule | Source | Conf. |
|---|---|---|---|
| R1 | Rod mass = bar length × **standard mass per metre**, never weighed. The masses are: 8 mm 0.395, 10 mm 0.616, 12 mm 0.888, 16 mm 1.579, 20 mm 2.466, 22 mm 2.980, 25 mm 3.854 and 32 mm 6.313 kg/m. | SoR-2R p. vi Table 7 (BDS 1313:1991); SoR-2R 08.1 note | High |
| R2 | **Rod by ratio:** the element's concrete volume (by F1–F8) × the Rod Ratio for its element type. Shown as "by ratio". | ADR 0010 | High (as ruling) |
| R3 | **Rod from the drawing:** the bar-bending schedule's cutting lengths × R1. **Laps are a separate, visible component** beside the net bars. Chairs and spacers are measured when the drawing shows them. | IS1200-8 cl. 11.1 ("Authorized overlaps, chairs/separators shall be measured"); old L-BD-02 | High (IS) |
| R3-note | PWD 08.1 prices rod "excluding splices or laps". In a PWD contract, laps are therefore not paid in the rod item. Laps are bought rod, though, so the Material Schedule includes them. The Benchmark Rate is applied to net-of-lap kg. **Owner to confirm.** | SoR-2R 08.1 | Medium |
| R4 | Binding wire and cutting wastage are **Rate Analysis Resources** of the rod item, not rod quantity. | IS1200-8 cl. 11.1 (the item includes cutting, bending and binding) | High |

### 1.4 Foundations (M2)

| # | Rule | Source | Conf. |
|---|---|---|---|
| E1 | **Excavation** (cft): the plan outline of the pile cap or footing (plus blinding projection), widened by a **working space of 600 mm** each side (param), × the depth from existing ground level to the underside of the soling or blinding. | IS1200-1 cl. 4.2.5, 4.2.5.1 ("600 mm measured from the face of substructure") | High (IS) |
| E1-note | The old product used 1'-6" (450 mm) working space plus a 6" depth allowance. Dhaka practice may be narrower than IS. | old L-MEA-01 seed | Low |
| E2 | Excavation is split into **stages of 1.5 m depth** (the Benchmark adds a rate per 0.5 m beyond 1.5 m). Lead beyond 10 m is a site fact the QS enters. | IS1200-1 cl. 4.2.3; SoR-2R 02.1.2–02.1.4 | High |
| E3 | **Backfill:** excavation less the volume of everything built below existing ground level. **Sand filling in plinth:** the plinth area inside the grade beams × the filling depth shown. | SoR-2R 02.10, 02.13; practice | Medium |
| E4 | **Brick flat soling:** area (sft) of the footing or pile cap outline plus the blinding projection. **Blinding CC 1:3:6:** the same outline × thickness (default 75 mm, i.e. 3"). | SoR-2R 03.1.1, 03.4.1; old seed "blindingProjection 3 in, blindingThickness 3 in" | Low (projection and thickness) |
| P1 | **Bored piles:** count; length from cut-off level to toe; concrete = π/4 × d² × that length; boring measured in metres. The over-cast length above cut-off (param, default 600 mm) is concrete bought and **pile-head breaking** is a separate item. | SoR-2R 09.1, 09.4, 09.7 | Medium (default over-cast Low) |
| P2 | **Pile cap and footing:** gross volume. The pile head inside the cap is not deducted. The column starts at the top of the cap (F1). | IS1200-2 cl. 4.1.8(a); F1 | Medium |
| P3 | **Grade (tie) beam:** clear between the faces of the pile caps or footings it connects. Depth is its full depth, unless a slab on grade is cast with it, in which case F4 applies. | by analogy with IS1200-2 cl. 4.2.2.3 | Medium |

### 1.5 Stairs (M2)

| # | Rule | Source | Conf. |
|---|---|---|---|
| S1 | Stair concrete = flight (sloped length × width × waist thickness) + steps (½ × riser × tread × width, per step). Stringer beams are included. **Landings are measured as slab.** | IS1200-2 cl. 4.2.1 (h) "Staircase including stringer beams but excluding landings" | High (classification) / Medium (formula) |

### 1.6 Walls and openings (M2)

| # | Rule | Source | Conf. |
|---|---|---|---|
| W1 | **250 mm (10") and thicker brickwork** in **cum, shown in cft**, at nominal thickness: 250 mm for one brick and 375 mm for one and a half. | SoR-2R 04.2 "(measurement to given as 250 mm width for one brick length and 375 mm for one brick and a half)" | High |
| W2 | **125 mm (5") brickwork in sqm, shown in sft**, stating thickness. | SoR-2R 04.15/04.16; IS1200-3 cl. 4.1.1 | High |
| W1/W2-note | ADR 0008 lists brickwork under "sft". The sources put 10" walls in cft. **Owner to confirm** whether 10" walls also show in sft (area × stated thickness). | ADR 0008 vs SoR-2R | — |
| W3 | Wall length is **clear between the faces of columns** (and RCC walls). Height is from the top of the floor slab to the **underside of the beam or slab above**. | Follows from F1–F5: RCC is measured first and the wall fills between | Medium |
| W4 | **Deduct openings over 0.1 m²** (param; about 1.08 sft). When calculating an opening's area, a separate lintel or sill over it counts as part of the opening; the lintel's bearing ends do not. | IS1200-3 cl. 4.1.4(b) and Note | High |
| W5 | **No deduction for:** beam or lintel ends up to 0.1 m² in section; slab bearings not over 100 mm thick that do not cross the full wall; pipes up to 300 mm diameter; chases up to 50 cm girth. | IS1200-3 cl. 4.1.4 (a), (c), (e), (f) | High |
| W6 | Brickwork **below plinth** is a separate item from superstructure brickwork. | SoR-2R 04.1 vs 04.2 | High |
| L1 | **Lintel:** opening width + a bearing each side (param, default 150 mm) × lintel section. Belongs to RCC class (c). | SoR-2R 07.3.3 (lintel in class c); bearing length: no source | Low (bearing) |

### 1.7 Finishes (M2)

| # | Rule | Source | Conf. |
|---|---|---|---|
| PL1 | **Wall plaster** (sft) per face: length between the walls or partitions that bound it, taken before plastering; height from the floor (or top of skirting) to the ceiling. Sides of pilasters and exposed column and beam faces are added. | IS1200-12 cl. 3.12, 3.12.1 | High |
| PL2 | **Ceiling plaster:** between walls; stair soffits are measured as ceiling. | IS1200-12 cl. 3.9, 3.10 | High |
| PL3 | **Openings in plastered walls:** | IS1200-12 cl. 3.8.1, 3.8.2 | High |
| | (a) up to 0.5 m²: no deduction, and nothing added for jambs, soffits or sills; | | |
| | (b) over 0.5 m² and up to 3 m², with both faces plastered alike: deduct **one face only**, and add nothing for jambs, soffits or sills; | | |
| | (c) over 3 m²: deduct **both faces**, and **add** the jambs, soffits and sills. | | |
| PL4 | Plaster is itemised by **thickness, mix and face**: 12 mm 1:4 for outer faces, 12 mm 1:6 for inner faces, and 6 mm 1:4 for ceilings and RCC faces. These are PWD's own splits. | SoR-2R 15.1.2, 15.4, 15.5 | High |
| PL5 | Plaster or bands in isolated widths of 300 mm or less are measured in rft. | IS1200-12 cl. 3.4 | High |
| FL1 | **Floor finish** (sft): between wall faces, **taken before skirting, dado or wall plaster**. No deduction for voids or embedded ends up to 0.1 m² (IS Part 11 cl. 3.5 allows up to 0.2 m² for voids; recommend 0.1 m² for both). | IS1200-11 cl. 2.4, 2.7, 3.5 | High / Medium |
| FL2 | **Skirting in rft** stating height. **Dado in sft.** Stair treads and risers are measured as area. | IS1200-11 cl. 3.6, 3.9; ADR 0008 (rft for skirting) | High |
| PT1 | **Painting:** the area of the plaster it covers, per face. | No IS 1200 painting part was read | Low |
| MEP1 | **MEP** (plumbing, sanitary, electrical, lift, generator, fire) is **not measured**. The QS types each as a lump-sum line. | CONTEXT.md "Discipline"; milestones M2 | High (as ruling) |

### 1.8 Where members stop at a joint (summary for the Trace)

Under the recommended IS 1200 default, each joint volume is measured once, by this precedence:
- **pile → pile cap** (the pile stops at cut-off);
- **pile cap → column** (the column starts at the top of the cap);
- **slab over column and beam** (the slab runs through at its full thickness);
- **column over beam** (the column owns the joint below the slab);
- **beam** between column faces, below the slab;
- **grade beam** between cap faces.

Formwork follows IS 1200 Part 5 cl. 6.6: beams stop at column sides, and columns take no deduction.

---

## 2. Rate Analysis: shape, and the starting library's first items

### 2.1 Shape of one Rate Analysis

One Rate Analysis per BOQ item, **per unit of the item**. It is stored per SI unit inside and shown per 100 cft
or 100 sft, as PWD itself quotes materials "per % cft" (SoR-2R pp. 1–66).

| Part | Carries | Notes and sources |
|---|---|---|
| Header | item name, unit, **Mix** (if any), the linked PWD item code for the Benchmark Rate | the PWD code lets the Benchmark Rate follow |
| Material lines | Resource, **quantity per unit**, unit (bag, cft, nos, kg, sft, litre), **wastage %** | wastage multiplies the quantity; the old L-FRM-07 used `consumption × (1 + wastage%)` |
| Labour Contract lines | Labour Contract, quantity per unit (normally 1 × the item's unit), unit | priced at the Developer's Labour Contract rate (CONTEXT.md) |
| Plant lines (optional) | e.g. mixer or vibrator hire per day ÷ output | usually inside the casting Labour Contract in Dhaka (Low) |
| Working rate | Σ(material qty × (1 + wastage) × Market Price) + Σ(labour) + Σ(plant) | **no profit, overhead or VAT by default**: the Developer is the builder |
| Developer overhead (optional, per project) | one % on the Priced BOQ total, **not inside item rates** | keeps item rates comparable with "PWD net of mark-ups" (Low: owner's call) |
| Benchmark Rate | the PWD rate as printed (4 zones; Dhaka/Mymensingh by default) converted to the Display Unit, **and** "net of mark-ups" = printed ÷ 1.2611 | see 2.4 |

The Material Schedule is Σ over items of (item quantity × material quantity per unit × (1 + wastage)).
Labour and plant never enter it (CONTEXT.md, "Rate Analysis").

### 2.2 Constants every coefficient below uses

| Constant | Value | Source | Conf. |
|---|---|---|---|
| Dry volume of concrete or mortar | **1.5 × wet volume** (approx.) | SoR-2R p. x "Miscellaneous measurement relations" | High (as PWD's) |
| Cement bag | **50 kg = 1.25 cft** (0.0354 m³) | SoR-2R p. x | High |
| Standard brick | **9.5" × 4.5" × 2.75"** (BDS 208; 240 × 114 × 70 mm); 1,000 nos ≈ 72 cft | SoR-2R p. x; 03.1.2 | High |
| Bricks in 100 cft of brickwork | **1,100 nos** with 0.25" joints | SoR-2R p. x | High (as PWD's) |
| Bricks in 100 sft of single flat soling | **300 nos** | SoR-2R p. x | High |
| Wet mortar in 100 cft of brickwork | 100 − 1,100 × 0.0680 = **25.2 cft** | derived from the two rows above | Medium |
| Sand grades | F.M. 1.2 "local" for mortar and plaster; F.M. 2.2 "Sylhet/coarse" for stone-chip concrete; 50/50 in brick-chip RCC; F.M. 0.5–0.8 for filling | SoR-2R 04.1, 07.1, 07.3, 15.1, 02.10 | High |
| 1 m³ = 35.3147 cft; 1 m² = 10.7639 sft | — | definition | High |

Private practice often uses 1.52–1.57 as the dry-volume factor for concrete and about 1.27–1.33 for mortar
(low-trust web sources). The default is PWD's 1.5 everywhere, and it is a parameter of each Mix.

### 2.3 The starting library's first 15 items

Material quantities are **per 100 cft** (volume items) or **per 100 sft** (area items), before wastage.
Figures in brackets are per m³ or m². The wastage % defaults are **all Low**: they are practice, not PWD.
Labour Contract lines carry no price, because Vextrus ships no Labour Contract rates. The Developer types
them, since no source exists.

| # | Item (PWD Benchmark code) | Unit | Cement (bags) | Sand (cft) | Coarse aggregate (cft) | Other Resources | Labour Contract | Conf. |
|---|---|---|---|---|---|---|---|---|
| 1 | RCC 1:1.5:3, stone chips: columns and walls (07.3.2) | cft | 21.8 (7.71/m³) | 40.9 F.M. 2.2 (0.409 m³) | 81.8 stone chips 20 mm down (0.818 m³) | admixture optional | casting (mix, place, vibrate, cure) per cft | Medium |
| 2 | RCC 1:1.5:3, stone chips: beams, slabs, lintels, stairs (07.3.3) | cft | as #1 | as #1 | as #1 | — | casting per cft | Medium |
| 3 | RCC 1:1.5:3, stone chips: footings, pile caps, raft, grade beams (07.3.1) | cft | as #1 | as #1 | as #1 | — | casting per cft | Medium |
| 4 | RCC 1:2:4, stone chips (07.2.x) | cft | 17.1 (6.05/m³) | 42.9 F.M. 2.2 | 85.7 stone chips | — | casting per cft | Medium |
| 5 | RCC 1:2:4, brick chips (07.1.x) | cft | 17.1 | 21.4 F.M. 1.2 + 21.4 F.M. 2.2 | 85.7 picked jhama brick chips | — | casting per cft (incl. chip breaking if bricks are bought) | Medium |
| 6 | CC 1:3:6 blinding/lean, brick chips (03.4.1) | cft | 12.0 (4.24/m³) | 45.0 F.M. 1.2 | 90.0 brick chips | — | per cft | Medium |
| 7 | Formwork, steel shutter, any RCC element (07.12.x) | sft | — | — | — | form oil (Low: 0.3 litre per 100 sft) | shuttering incl. props and shutter hire, per sft | Low (resources) |
| 8 | Rod work, B500DWR/500W, cut, bend, bind and place (08.1.3) | kg | — | — | — | rod 1 kg + **3% cutting wastage**; binding wire **10 kg per ton** | rod binding per kg (or per ton) | Low (wastage, wire) |
| 9 | Brickwork 250 mm (10"), 1:6, superstructure (04.2) | cft | 4.31 | 32.4 F.M. 1.2 | — | bricks **1,100** + 3% | brickwork per cft | Medium |
| 10 | Brickwork 250 mm (10"), 1:4, exterior walls (04.3) | cft | 6.04 | 30.2 F.M. 1.2 | — | bricks 1,100 + 3% | per cft | Medium |
| 11 | Brickwork 125 mm (5"), 1:4 (04.16) | sft | 2.52 | 12.6 F.M. 1.2 | — | bricks **458** (49.3/m²) + 3% | per sft | Medium |
| 12 | Plaster 12 mm, 1:4, outer face (15.1.2) | sft | 0.94 | 4.7 F.M. 1.2 | — | — | plaster per sft | Medium |
| 13 | Plaster 12 mm, 1:6, inner face (15.4) | sft | 0.67 | 5.1 F.M. 1.2 | — | — | plaster per sft | Medium |
| 14 | Plaster 6 mm, 1:4, ceiling and RCC faces (15.5) | sft | 0.47 | 2.4 F.M. 1.2 | — | — | plaster per sft | Medium |
| 15 | Earthwork in excavation, up to 1.5 m depth, 10 m lead (02.1.2) | cft | — | — | — | — | excavation per cft | High (shape) |
| 16 | Sand filling in plinth, F.M. 0.8, in 150 mm layers (02.10.2) | cft | — | 100 F.M. 0.8 × **1.20** compaction (Low) | — | — | filling per cft | Low |
| 17 | Brick flat soling (03.1.1) | sft | — | 2 cft F.M. 1.2 for joints (Low) | — | bricks **300** + 3% | soling per sft | Medium |
| 18 | GP floor tiles 600 × 600, 20 mm 1:4 bed (06.1.4) | sft | 1.57 + white cement 1 kg (Low) | 7.9 F.M. 1.2 | — | tiles 100 sft + **5%** | tile laying per sft | Medium (mortar) / Low (wastage) |

How the numbers are derived (so a QS can redo any row):
- **Concrete** (rows 1–6): wet volume 100 × 1.5 = 150 cft dry, split by the Mix.
  - For 1:1.5:3 the parts sum to 5.5. Cement = 150/5.5 = 27.3 cft ÷ 1.25 = 21.8 bags. Sand = 40.9 cft.
    Stone chips = 81.8 cft.
- **Brickwork** (rows 9–11): per 100 cft, 25.2 cft wet mortar × 1.5 = 37.8 cft dry.
  - At 1:6: cement 5.4 cft = 4.31 bags, sand 32.4 cft.
  - A 5" wall is 100 sft × 5/12 ft = 41.7 cft, taken at the same rate per cft.
- **Plaster** (rows 12–14): 12 mm = 0.472", so 100 sft × 0.472/12 = 3.94 cft wet, × 1.5 = 5.9 cft dry.
  PWD's dry factor is applied with no extra allowance for joint filling.
- **Tile bed** (row 18): 20 mm × 100 sft = 6.56 cft wet, × 1.5 = 9.84 cft dry.

Standard wastage defaults (all Low, all editable):

| Resource | Wastage |
|---|---|
| cement | 2% |
| sand | 5% |
| stone chips and brick chips | 3% |
| bricks | 3% |
| rod | 3% |
| tiles | 5% |

**A known tension.** PWD's 1,100 bricks per 100 cft is fewer than the 1,244 that 9.5 × 4.5 × 2.75 bricks with
0.25" joints arithmetically need. The PWD figure implies joints of about 0.4", or frogged bricks filled with mortar.
It is shipped as PWD's figure and flagged.

### 2.4 Benchmark Rate: what PWD's printed rate contains

| Fact | Value | Source | Conf. |
|---|---|---|---|
| Contractor's profit | 10.00% | SoR-2R p. 1 "Mark-ups" | High |
| Contractor's overhead | 3.50% | SoR-2R p. 1 | High |
| VAT | 10.00% (7.5% in the Revised 2023 edition) | SoR-2R p. 1 and preface | High |
| Composition | printed rate = direct × (1 + 0.10 + 0.035) ÷ (1 − VAT). This reproduces AnxA's "22.703% extra" for 7.5% VAT exactly (1.135 ÷ 0.925 = 1.22703). | AnxA note 8; the inference is mine | Medium |
| Factor in the 2nd Revised edition | 1.135 ÷ 0.90 = **1.2611**; "net of mark-ups" = printed × 0.793 | derived | Medium |
| Private-owner reduction stated by PWD | "The cost will be reduced by 22.383% (considering contractor's profit, overhead charge, VAT, price escalation and others)" | AnxB p. 358 (original 2022 edition) | High (as quote); does not reconcile exactly with the row above |
| Zones | four columns: Dhaka/Mymensingh · Chattogram/Sylhet · Khulna/Barisal/Gopalgonj · Rajshahi/Rangpur | SoR-2R every chapter | High |
| Base floor | RCC, brickwork and plaster rates are "up to ground floor", with a per-floor added rate. Examples: 07.11.1 ৳93/cum; 04.10 ৳184/cum; 15.16 ৳15/sqm; 08.2 ৳0.69/kg. Above 4 m free height: 07.10 ৳350/cum per extra metre. | SoR-2R | High |
| Example | 07.3.2 RCC 1:1.5:3 columns = ৳15,380/cum (Dhaka) = ৳435.5/cft printed, ≈ ৳345/cft net of mark-ups | SoR-2R p. 100, derived | High / Medium |

Recommendation: show the Benchmark Rate for an item on floor *n* as base + (*n* − 1) × added rate. Here *n* counts
floors above ground, per PWD's wording "additional floor above ground floor". Show both "printed" and "net of
mark-ups", with the edition and effective date named.

---

## 3. Default Rod Ratios

**Sources run out here.** No primary or Bangladeshi source gives kg of rod per unit of concrete by element type.
The table below is my engineering judgement for Dhaka RCC residential frames of G+6 to G+14 (BNBC 2020,
intermediate moment frames, fy 420–500 MPa). It is bounded and cross-checked as follows:
- **Bounds (Medium):**
  - column longitudinal steel 1%–6%/8% of the gross section (BNBC 2020 Part 6 and ACI 318; clause
    numbers not verified);
  - slab temperature steel at least 0.18% each way for fy 420 (ACI 318; BNBC follows it).
- **Arithmetic:** 1% steel by volume = 78.5 kg/m³ = **2.22 kg/cft**.
- **Indian thumb rules (low-trust web sources):**

  | Element | kg/m³ |
  |---|---|
  | slab | 80 |
  | beam | 120 |
  | column | 160 |
  | footing | 40 |

- **B. N. Dutta** (via civilconstructionguide.com, low trust): slab 1%, beam 2%, column 2.5%, footing 0.8%.
- **Not evidence:** the old product's synthetic BNBC fixture gives:

  | Element | kg/m³ |
  |---|---|
  | beam | 302 |
  | column | 251 |
  | slab | 130 |
  | pile | 107 |
  | pile cap | 42 |

Each ratio is **deemed to include laps, ties and stirrups**, but not cutting wastage (that is in Rate Analysis #8).

| Element type | Default kg/cft | Default kg/m³ | Plausible range kg/m³ | Why | Conf. |
|---|---|---|---|---|---|
| Bored cast-in-situ pile | **1.7** | 60 | 40–90 | about 0.6% longitudinal, often curtailed along the length, plus spiral | Low |
| Pile cap | **2.5** | 90 | 70–130 | bottom mat, sides, top mat on large caps | Low |
| Isolated or combined footing | **2.0** | 70 | 50–100 | bottom mat governs | Low |
| Raft / mat | **2.8** | 100 | 80–140 | top and bottom mats | Low |
| Grade (tie) beam | **4.2** | 150 | 120–200 | beam-like, with seismic ties | Low |
| Column | **6.8** | 240 | 180–320 | 2–3% longitudinal plus IMRF ties; heavier at low storeys | Low |
| Beam | **5.1** | 180 | 140–250 | top and bottom bars, extra bars at supports, seismic stirrups | Low |
| Slab (two-way, 125–150 mm) | **2.5** | 90 | 70–110 | two layers at bottom plus top bars at supports | Low |
| Stair (waist + steps) | **3.1** | 110 | 90–140 | — | Low |
| Lift core / shear wall | **5.1** | 180 | 120–250 | boundary elements | Low |
| Retaining / basement wall | **3.4** | 120 | 90–160 | — | Low |
| Lintel | **2.5** | 90 | 70–120 | 2 + 2 bars with stirrups, short spans | Low |
| Sunshade, drop wall, parapet (class d) | **2.5** | 90 | 60–110 | — | Low |

Two checks the Project Summary could show once the frame is confirmed (Low; owner to set):
- rod for the building as a whole, ÷ floor area: expected about **4.5–6 kg/sft** for Dhaka G+6 to G+14;
- cement ÷ floor area.

---

## 4. Priced BOQ structure

### 4.1 Trades and their order

The order follows the PWD SoR chapters, so each trade sits beside its Benchmark chapter. The column
"M" shows the milestone that fills the trade.

| No. | Trade | PWD chapter | M | Measured or typed |
|---|---|---|---|---|
| 1 | Earthwork and site preparation | 02 | M2 | measured |
| 2 | Piling | 09 | M2 | measured |
| 3 | Soling, blinding and DPC | 03 | M2 | measured |
| 4 | Concrete works (RCC and CC) | 07 | **M1** | measured |
| 5 | Formwork | 07 (07.12–07.18) | **M1** | measured |
| 6 | Rod works | 08 | **M1** | measured (by ratio, or from the drawing) |
| 7 | Brickwork | 04 | M2 | measured |
| 8 | Plaster and pointing | 15 | M2 | measured |
| 9 | Flooring, tiles and skirting | 06 (and 05) | M2 | measured |
| 10 | Doors, windows and grills | 11–14, 19 | M2 | counted or typed (Low: not in milestones yet) |
| 11 | Painting | 16 | M2 | measured |
| 12 | Plumbing and sanitary | 26 | M2 | **lump sum** |
| 13 | Electrical | PWD's separate E/M schedule (not read) | M2 | **lump sum** |
| 14 | Lift, generator, substation, fire | AnxB items 6–7, 15 | M2 | **lump sum** |
| 15 | Miscellaneous and external works | 21, 22, 24 | M2 | typed |

Formwork and rod could be listed as sub-groups inside Concrete works rather than as separate trades. That is
closer to how a Dhaka QS thinks ("the RCC"). The items stay the same either way; only the headings change
(owner's choice, Low).

Inside Concrete, Formwork and Rod, **sub-groups follow the element classes**: piles, pile caps, grade beams,
columns, beams, slabs, stairs, lintels and class (d). Each item's quantity then expands by floor.

### 4.2 Numbering

**`trade.group.item`**, for example `4.2.1` (Concrete › Columns › RCC 1:1.5:3). Details:
- Numbers are Vextrus's own and are derived, never stored. This keeps the old product's I-269
  lesson: a stored number becomes a second home for the order.
- The PWD code (for example `PWD 07.3.2`) is printed in the Benchmark column, never used as the item
  number, because one Vextrus item may benchmark against different PWD items per floor.

### 4.3 What each item line carries

| Column | Content |
|---|---|
| No. | `trade.group.item` |
| Description | a PWD-style description with the Mix, grade and element class, followed by the Rule Set rules applied (for the Trace) |
| Unit | Display Unit (cft, sft, rft, kg, bag, nos, LS) |
| Quantity | confirmed quantity. The item opens to its per-floor and per-element breakdown, and every figure opens its Trace. |
| Rate | working rate from the item's Rate Analysis at Market Prices |
| Amount | quantity × rate, in ৳ grouped in lakh and crore |
| Benchmark Rate | PWD rate converted to the unit: "printed" and "net of mark-ups", with the edition and zone |
| Basis | for rod: "by ratio" or "from the drawing" (ADR 0010). For others: "measured", "typed" or "lump sum". |

### 4.4 Subtotals and totals

- One subtotal per trade (৳). The Project Summary's "cost by trade" reads these directly.
- **Measured subtotal** (measured items only) and **Grand total** (measured + lump sums +
  provisional sums), shown apart, so the MD sees how much of the figure was typed rather than
  measured.
- **Cost per sft** = grand total ÷ floor area. The default floor area is PWD's **plinth area**: "the
  area bounded by the exterior perimeter of a floor or the perimeter formed by joining the lines on
  the outer faces of columns … except courtyard open to sky" (AnxA). The owner should confirm this
  against the Developer's saleable-area habits.
- The optional Developer overhead % and contingency are separate lines after the grand total, never
  inside rates. AnxB uses price contingency up to 8% and physical contingency up to 2% (PWD
  practice, High as quote).

### 4.5 Lump sums and provisional sums

- **A lump sum** (MEP, lift, generator) is a line in its trade: description, unit "LS", quantity 1, the amount
  typed by the QS, and no Rate Analysis. It enters the Material Schedule only if the QS gives it one.
- **A provisional sum** (work whose scope is not yet known) is labelled as such. It sits at the end of the trade
  it provides for, never in a trade of its own, and is excluded from the measured subtotal. This carries over
  the old product's bill-taxonomy ruling: "a line within each bill, never a seventh bill".
- Nothing unmapped hides in a provisional sum. An item that fits no trade shows under a visible "Unclassified"
  heading, so the gap stays visible (also carried over from the old product).

---

## 5. Material Schedule breakdown

### 5.1 Layout

Materials run down the side and **floors** across the top, grouped under **construction stages**, with a
total column. Each cell opens to the BOQ items that produced it. Every figure is Σ(item quantity × Rate
Analysis quantity × (1 + wastage)). Materials from Material-and-Labour Contracts are excluded (CONTEXT.md).

### 5.2 Stages (default, editable)

| # | Stage | Floors it spans | Items that feed it |
|---|---|---|---|
| 1 | Piling | foundation | piles, pile-head breaking |
| 2 | Foundation | foundation to plinth | excavation, soling, blinding, pile caps, footings, grade beams, sand filling, slab on grade, columns up to plinth |
| 3 | Frame | each floor (GF, 1F … roof) | columns, beams, slabs, stairs, lift core: concrete, formwork, rod |
| 4 | Brickwork | each floor | 10" and 5" walls, lintels |
| 5 | Plaster | each floor | wall, ceiling and RCC-face plaster |
| 6 | Flooring and finishes | each floor | floor tiles, skirting, painting |
| 7 | Roof and external | roof, site | roof treatment, parapet, external works |

Stages 1–3 also give the MD a pour-by-pour view of the frame. Owner to confirm the stage list (Low).

### 5.3 Materials and units (defaults)

| Material | Display unit | Metric switch | Split by | Source |
|---|---|---|---|---|
| Cement | bag (50 kg) | bag / t | type where the Rate Analysis names it (OPC CEM-I for RCC, PCC CEM-II/B-M for masonry and plaster, per PWD) | SoR-2R 07.3, 04.1, 15.1 |
| Coarse sand (Sylhet, F.M. 2.2) | cft | m³ | — | SoR-2R materials, "per % cft" |
| Local sand (F.M. 1.2) | cft | m³ | — | same |
| Filling sand (F.M. 0.5–0.8) | cft | m³ | — | SoR-2R 02.10 |
| Stone chips (20 mm down) | cft | m³ | — | SoR-2R materials item 191 |
| Brick chips (picked jhama) | cft | m³ | — | SoR-2R 07.1, 03.4 |
| Bricks (first class, 9.5 × 4.5 × 2.75") | nos | nos | — | SoR-2R materials item 165 (per 1,000) |
| Rod | kg, with ton totals | kg / t | **by diameter only where "from the drawing"**; rod "by ratio" is one undivided line per floor and stage | ADR 0010 |
| Binding wire | kg | kg | — | Rate Analysis #8 |
| Floor tiles | sft | m² | size | Rate Analysis #18 |
| Admixture (if used) | litre | litre | — | SoR-2R 07.19 (per litre) |
| Ready-mix concrete (if used instead of site mix) | cft | m³ | grade | SoR-2R 07.8 |

The old product's rule applies: rod "by ratio" must never be split into invented diameters (ADR 0010, "it
cannot give real diameters for procurement"). The schedule shows each floor's share of rod still "by ratio".

---

## 6. New terms the domain needs (proposed; CONTEXT.md not edited)

| Term | Proposed definition | Avoid |
|---|---|---|
| **Trade** | A group of Priced BOQ items of one kind of work, such as Concrete works or Brickwork, in PWD chapter order. It is the top level of the Priced BOQ and of "cost by trade". | bill, section, division (CONTEXT.md already uses "trade" without defining it) |
| **Mix** | The proportion of cement to sand to aggregate (1:1.5:3) or of cement to sand (1:4) that a concrete, mortar or plaster Rate Analysis is built on. | ratio (clashes with Rod Ratio), grade (for concrete, that is strength) |
| **Wastage** | The percentage added to a Resource's quantity in a Rate Analysis for cutting, spillage and breakage. Never added to a BOQ quantity. | waste factor, allowance, margin |
| **Dry Volume Factor** | The number a Mix's wet volume is multiplied by to give the dry volume of its materials (PWD: 1.5). | bulking factor (bulking is sand swelling with moisture) |
| **Lap** | The length of rod where two bars overlap to continue. It is shown as its own component of rod from the drawing. | splice (alone), overlap |
| **Construction Stage** | One of the Material Schedule's groupings of work in build order: Piling, Foundation, Frame, Brickwork, Plaster, Flooring and finishes, Roof and external. | phase, milestone (a Vextrus word), stage alone (clashes with Takeoff Step's avoided "stage") |
| **Lump Sum** | A Priced BOQ line with a typed amount and no measured quantity, used for MEP and other work Vextrus does not measure. | allowance, PC sum |
| **Provisional Sum** | A Lump Sum for work whose scope is not yet known, kept out of the measured subtotal. | contingency (a percentage on the total), reserve |
| **Mark-up** | PWD's contractor profit, overhead and VAT inside every Benchmark Rate. It is removed to give "net of mark-ups". | margin, on-cost, overhead (alone) |
| **Added Rate** | A PWD rate added to a base item for each floor above ground, each metre of height over 4 m, or each 0.5 m of extra depth. | extra, surcharge |
| **Plinth Area** | The floor area inside the outer faces of the external walls or columns, per PWD; the divisor for cost per sft. | built-up area, saleable area (different things in sales) |
| **Deduction Threshold** | The smallest opening or void a Measurement Rule deducts (0.1 m² in brickwork, 0.5 m² in plaster). | cutoff, tolerance |
| **Element Class** | PWD's price class for an RCC element: foundation, column and wall, slab and beam, or ornamental (07.x.1–4). It selects the Benchmark Rate. | member type, category |

---

## For the owner to verify

Each item is a figure or rule I am unsure of. Tick when confirmed or corrected.

**Rule Set**
- [ ] F1 vs F1-alt: are columns measured to the slab underside (IS 1200, recommended) or floor to floor through the slab (Vextrus Cubit)?
- [ ] F6: where slabs of unequal thickness meet over a beam, is each run to the beam's centre line?
- [ ] FW5: are slab and step edges measured as area inside the slab formwork (my recommendation) or in rft (IS)?
- [ ] FW6: are footing and pile-cap soffits never shuttered where blinding or soling is shown?
- [ ] E1: working space 600 mm each side (IS) or 450 mm (the old product's figure, and Dhaka practice?).
- [ ] E4: soling and blinding projection 75 mm (3") beyond the footing, and blinding 75 mm thick.
- [ ] P1: pile over-cast length above cut-off 600 mm, broken as a separate item.
- [ ] L1: lintel bearing 150 mm each side.
- [ ] W1/W2 vs ADR 0008: 10" brickwork shown in cft (PWD) or in sft?
- [ ] W3: walls measured clear between columns and up to the beam or slab soffit.
- [ ] R3-note: laps in the Material Schedule, and the Benchmark Rate applied to net-of-lap kg.
- [ ] FL1: one threshold of 0.1 m² for floor-finish voids (IS allows 0.2 m² for voids).
- [ ] PT1: painting area = the plastered area it covers.

**Rate Analysis**
- [ ] Dry Volume Factor 1.5 for concrete **and** mortar (PWD), rather than 1.52–1.57 for concrete and 1.27–1.33 for mortar (private practice).
- [ ] 1,100 bricks per 100 cft (PWD), which implies about 0.4" joints (arithmetic gives 1,244 at 0.25").
- [ ] 458 bricks per 100 sft of 5" wall (derived).
- [ ] Plaster uses no extra allowance for filling joints beyond ×1.5.
- [ ] Wastage defaults: cement 2%, sand 5%, chips 3%, bricks 3%, rod 3%, tiles 5%.
- [ ] Binding wire 10 kg per ton of rod.
- [ ] Form oil 0.3 litre per 100 sft, and shuttering as one Labour Contract including props and shutter hire.
- [ ] Sand filling compaction factor 1.20.
- [ ] Soling joint sand 2 cft per 100 sft; tile-joint white cement 1 kg per 100 sft.
- [ ] Mixer and vibrator inside the casting Labour Contract, not as plant lines.
- [ ] No profit, overhead or VAT inside working rates; Developer overhead as one % on the total.
- [ ] Benchmark composition: printed = direct × 1.135 ÷ (1 − VAT), so "net of mark-ups" = × 0.793. AnxB's 22.383% does not reconcile with this.
- [ ] Benchmark zone Dhaka/Mymensingh by default, and floor added rates applied per floor above ground.

**Rod Ratios (all Low)**
- [ ] Pile 1.7 · pile cap 2.5 · footing 2.0 · raft 2.8 · grade beam 4.2 · column 6.8 · beam 5.1 · slab 2.5 · stair 3.1 · shear/lift wall 5.1 · retaining wall 3.4 · lintel 2.5 · class (d) 2.5 kg/cft.
- [ ] Ratios include laps, ties and stirrups, but not cutting wastage.
- [ ] Whole-building check of 4.5–6 kg/sft for G+6 to G+14.

**Priced BOQ and Material Schedule**
- [ ] The trade order in 4.1, and whether Formwork and Rod are separate trades or sub-groups of Concrete.
- [ ] Doors, windows and painting are in M2's scope (the milestones list "finishes" only).
- [ ] Plinth area as the cost-per-sft divisor.
- [ ] The seven Construction Stages in 5.2.
- [ ] Sand split three ways, and cement split by type only where the Rate Analysis names it.
