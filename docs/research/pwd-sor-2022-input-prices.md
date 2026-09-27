# PWD SoR 2022 (2nd Revised): input prices for the starter Market Price set

Researched 27 Sep 2026 in session 02. The question: what input prices does PWD's Schedule of Rates give
for the Resources that Vextrus's Rate Analysis library and Material Schedule need, in the Dhaka zone? The
aim is for the priced prototype and M1 to start from PWD's prices instead of the walk prices in
`docs/research/tax-and-allowances.md` §B.4. Terms are those of `CONTEXT.md`.

**Source.** [SoR-2R] *PWD Schedule of Rates 2022 (2nd Revised), Part A: Civil Works*, sixteenth edition,
in force from 22 January 2026 (cover and endorsement, PDF pp. 1 and 4). This is the public PWD PDF, read
locally with the owner's permission of 27 Sep 2026. Its sha256 begins `8891aecf`; it has 336 pages.
- **Page numbers.** Every row below is cited as "p. *printed* / PDF *n*". The printed number is PDF − 16:
  PDF 17 prints "1" and PDF 82 prints "66". The measurement-relations page prints "x" and is PDF 16.
- **Zone.** Every value is from the first zone column, headed "Dhaka, Mymensingh".
- **How it was read.** I took the PDF's text layer by word position with PyMuPDF and assigned each word
  to its row and zone column by coordinate. The input rows on PDF 17, 21, 22, 23, 24, 25, 26, 28, 31, 74
  and 79 were then checked against rendered images of those pages, and every value agreed. The chapter
  item rates in §4 and §6 were checked by coordinate: each sits in the Dhaka column inside its own item.
  The input rows on PDF 18, 29, 30, 81 and 82 rest on the text layer alone.

## Conclusions

**What the SoR does not give, and the values that are not clean. Read these first.**
1. **No price for brick chips.** PWD prices chips as bricks plus breaking. p. x (PDF 16) states "100 cft.
   of khoa or brick chips required 850 Nos. bricks". Adding the 20 mm breaking rate gives **৳120.20 per
   cft**: 850 × ৳13.00 + ৳970, per 100 cft. This is a derived figure, not a printed one.
2. **No row named "binding wire".** PWD's own rebar item 08.1 binds "with supply of G.I. wires" (p. 115 /
   PDF 131). So the price used is **G.I. wire at ৳120/kg** (C24 SL 1940, p. 58 / PDF 74). Black annealed
   binding wire, which Dhaka sites commonly use, is not listed.
3. **No date for the prices.** The preface (PDF 5) names one change from the 2022 (Revised) edition of
   23 Feb 2023: VAT moved from 7.5 % to 10 %, and "necessary adjustments have been made in the rates to
   reflect this change". It does not say the input prices were surveyed again. **Treat them as PWD's
   2022–23 prices carried into a 2026 edition** until someone compares them with the 2022 (Revised) PDF.
   I did not read that PDF.
4. **Not stated: whether the prices are at site, include carriage, or include the supplier's VAT.**
   Carriage is priced apart from the materials (C25, p. 65 / PDF 81).
5. **No labour rate per unit of work, and no output per day.** Labour is priced per day only (C1). The only
   per-unit labour rates are "placing and removing of shutter for formwork" at ৳18/sft and the rates for
   breaking chips (C3, p. 5 / PDF 21). PWD states **no Developer Labour Contract rate of any kind** (§5).
6. **No formwork material price per sft.** PWD lists timber, props and "making steel shutter" (a labour
   rate that excludes materials), but no price per sft of shutter. The prototype's `FWMAT` (৳20/sft) has
   no PWD value.
7. **Conflicts and oddities in the printed values:**
   - **Surki is printed twice and the two disagree.** SL 198 gives ৳113 per cft (p. 7 / PDF 23). SL 2107
     gives ৳1,600 per cum, which is ৳45.31 per cft (p. 63 / PDF 79). They differ by a factor of 2.5.
   - **Grade 500 rebar is priced below Grade 400:** ৳87,000 against ৳89,000 per M. ton (p. 10 / PDF 26).
     Its row also cites BDS-6935-**2016**, where the Grade 300 and 400 rows cite 2006. This is as
     printed.
   - **12 mm stone chips cost less than 19 mm chips:** ৳17,840 against ৳21,804 per % cft (p. 7 / PDF
     23). The 19 mm price is exactly uncrushed boulder (৳19,604) plus breaking 20 mm chips (৳2,200).
   - **The brick unit reads "per %0 nos".** %0 is a typed per-mille, meaning per 1,000. Two rows confirm
     it: "Royalty of earth, per %0 cft" (SL 220, PDF 24) and "Royalty of Earth, per thousand cft" (SL
     2047, PDF 77) are both ৳2,200.
   - **The wall-tile size bands do not place a 300 × 600 tile cleanly.** By its short side it falls in
     SL 370 (৳65); by its area it falls in SL 371 (৳85) (p. 12 / PDF 28).
   - **Some rates print out of text order.** Collapsible gate 19.1.3 (৳6,165/sqm) sits outside the page's
     text flow and was read by position (PDF 208). The image confirms it.

   No value was unreadable. None of the values below is a guess.

**What it does give.** The SoR has a full price list of inputs: "Rates of Man, Materials and Mark-ups",
printed pp. 1–66 (PDF 17–82). Its rows are numbered SL 1 to SL 2196 in 26 groups (C1–C26), and each row
has four zone columns. Every material Resource the Rate Analysis library and the Material Schedule name has a printed
Dhaka price, except the two above (brick chips derived, binding wire as G.I. wire).

**Against the walk prices** (tax-and-allowances.md §B.4):

| Resource | Walk price | PWD Dhaka | Change |
|---|---|---|---|
| Local sand | ৳55/cft | ৳19.00/cft | −65 % |
| Sylhet sand | ৳80/cft | ৳53.80/cft | −33 % |
| Rebar | ৳95,000/t | ৳87,000/t | −8 % |
| Bricks | ৳14 each | ৳13.00 each | −7 % |
| PCC cement | ৳520/bag | ৳500/bag | −4 % |
| OPC cement | ৳520/bag | ৳520/bag | 0 |
| Stone chips | ৳180/cft | ৳218.04/cft | +21 % |

Sand is where PWD and the walk disagree most. It deserves the owner's eye first.

**The item rates are built on these prices.** For RCC 1:1.5:3 in columns (07.3.2, ৳15,380/cum, p. 100 /
PDF 116), the materials at these prices come to ৳11,084/cum. That is 91 % of the rate net of mark-ups
(৳12,196). The remaining ৳1,112/cum (৳31.5/cft) is left for labour, plant, water and curing (§6).

**Recommendation.** Ship the Dhaka column as Vextrus's starter Market Price set. Label it "PWD SoR 2022
(2nd Revised), in force 22 Jan 2026, Dhaka/Mymensingh". Flag the sand prices and the undated-price caveat,
and let each Developer overwrite it. The owner decides this; see "For the owner to verify".

The machine-readable copy is `.private/work/session-02/priced/pwd_prices_2022.csv`, 85 rows. Its columns
are those asked for, plus two at the end: `value_quoted` (the value in the Vextrus unit) and `kind`.
`kind` is one of `input`, `derived`, `labour_day`, `plant`, `work_rate`, `carriage` or `item_rate`.
Resource codes match the prototype's `engine/catalogue.py` wherever one exists.

---

## 1. Units and factors

Every row gives the printed unit and, separately, the Vextrus unit with the factor, where value in the
Vextrus unit = printed value × factor. Nothing is converted silently.

| Printed unit | Meaning | To the Vextrus unit | Factor | Source |
|---|---|---|---|---|
| per % cft | per 100 cft | per cft | 0.01 | usage throughout; SL 223 prints "per 100 cft" in the same list |
| per %0 nos | per 1,000 nos | per nos | 0.001 | SL 220 vs SL 2047 (above) |
| per M. ton | per metric tonne (1,000 kg) | per kg / per t | 0.001 / 1 | SoR Table 1, "1 tonne = 0.984 ton = 1000 kg" (p. i / PDF 7) |
| per bag | 50 kg bag | per bag | 1 | p. x: "1 bag of cement … = 1.25 cft. = 50 kg" |
| cum | m³ | per cft | 0.028316846592 (exact) | 1 ft = 0.3048 m |
| sqm | m² | per sft | 0.09290304 (exact) | same. SoR Table 1 rounds 1 m² to 10.764 ft² |
| meter | m | per rft | 0.3048 (exact) | same |

## 2. Materials the Rate Analysis library and Material Schedule need (Dhaka, Mymensingh)

"Rates" means the "Rates of Man, Materials and Mark-ups" section, cited by group and SL. "Walk" is the
tax-and-allowances.md §B.4 price. "None" means the prototype priced the Resource at ৳0.

### 2.1 Cement

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value | Walk |
|---|---|---|---|---|---|---|---|---|
| Cement OPC (`CEM-OPC`) | C6 SL 187 "Ordinary Portland Cement, BDS-EN-197-1-CEM-I, 52.5N, 50 kg bag" | 520.00 | per bag | p. 7 / PDF 23 | bag | 1 | 520.00 | 520 |
| Cement PCC (`CEM-PCC`) | C6 SL 188 "Portland Composite Cement, (CEM-II/B-M 42.5N …): 50 kg bag" | 500.00 | per bag | p. 7 / PDF 23 | bag | 1 | 500.00 | 520 |
| White cement (`WCEM`) | C6 SL 189 "White Cement" | 27.00 | per kg | p. 7 / PDF 23 | kg | 1 | 27.00 | none |

### 2.2 Sand

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value | Walk |
|---|---|---|---|---|---|---|---|---|
| Sylhet / coarse sand F.M. 2.2 (`SAND-SYL`) | C8 SL 226 "Sand (F.M. 2.2)" | 5,380.00 | per % cft | p. 8 / PDF 24 | cft | 0.01 | 53.80 | 80 |
| Local sand F.M. 1.2 (`SAND-LOC`) | C8 SL 225 "Sand (F.M. 1.2)" | 1,900.00 | per % cft | p. 8 / PDF 24 | cft | 0.01 | 19.00 | 55 |
| Filling sand F.M. 0.8 (`SAND-FILL`) | C8 SL 224 "Sand (F.M. 0.8)" | 1,670.00 | per % cft | p. 8 / PDF 24 | cft | 0.01 | 16.70 | none |
| Filling sand F.M. 0.5 (`SAND-FILL05`) | C8 SL 223 "Sand (F.M. 0.5)" | 1,530.00 | per 100 cft | p. 8 / PDF 24 | cft | 0.01 | 15.30 | none |

PWD's chapter items call F.M. 2.2 sand "Sylhet sand or coarse sand of equivalent F.M. 2.2" (for example
07.2, p. 99 / PDF 115). The same group prints royalties, which are not added here: sand ৳6,806 per %0 cft
(SL 221), earth ৳2,200 per %0 cft (SL 220). The SoR does not say whether the sand prices include them.

### 2.3 Aggregates and bricks

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value | Walk |
|---|---|---|---|---|---|---|---|---|
| Stone chips 20 mm down (`STONE`) | C7 SL 191 "19 mm (3/4") down grade crushed stone chips" | 21,804.00 | per % cft | p. 7 / PDF 23 | cft | 0.01 | 218.04 | 180 |
| Stone chips 12 mm down (`STONE-12`) | C7 SL 192 "12 mm (1/2") down grade stone chips" | 17,840.00 | per % cft | p. 7 / PDF 23 | cft | 0.01 | 178.40 | — |
| Brick chips 20 mm down, picked jhama (`BCHIP`), **derived** | 850 bricks (p. x) × SL 165 ৳13.00 + C3 SL 141 "Breaking of 20 mm down brick chips" ৳970 | 12,020.00 | per % cft (derived) | p. x, 6, 5 / PDF 16, 22, 21 | cft | 0.01 | 120.20 | none |
| Brick khoa 50 mm down (`BCHIP-50`), **derived** | 850 × ৳13.00 + C3 SL 140 ৳870 | 11,920.00 | per % cft (derived) | same | cft | 0.01 | 119.20 | — |
| Bricks, first class (`BRICK`) | C5 SL 165 "1st class/Picked jhama standard bricks" | 13,000.00 | per %0 nos | p. 6 / PDF 22 | nos | 0.001 | 13.00 | 14 |
| Machine-made bricks (`BRICK-AUTO`) | C5 SL 166 "Automatic machine made 1st class standard bricks" | 16,000.00 | per %0 nos | p. 6 / PDF 22 | nos | 0.001 | 16.00 | — |

The breaking rates sit under "C3 Work rate excluding cost of materials". The derived chip price assumes
that the Developer buys bricks and breaks them. If it buys chips already broken, its own price applies.

### 2.4 Rebar and binding wire

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value | Walk |
|---|---|---|---|---|---|---|---|---|
| Rebar Grade 500, per kg (`REBAR`) | C10 SL 290 "Grade 500 (500MPa), BDS-6935-2016 and ratio fy to fu ≥ 1.25" | 87,000.00 | per M. ton | p. 10 / PDF 26 | kg | 0.001 | 87.00 | 95 |
| Rebar Grade 500, per ton (`REBAR-T`) | same row | 87,000.00 | per M. ton | p. 10 / PDF 26 | t (metric) | 1 | 87,000.00 | 95,000 |
| Rebar Grade 400/420 (`REBAR-400`) | C10 SL 289 | 89,000.00 | per M. ton | p. 10 / PDF 26 | kg | 0.001 | 89.00 | — |
| Binding wire (`WIRE`) | C24 SL 1940 "G.I. wire" | 120.00 | per kg | p. 58 / PDF 74 | kg | 1 | 120.00 | none |

The neighbouring row C24 SL 1939, "Nails and wires", is ৳70/kg. If Vextrus's "ton" ever meant the long
ton, the factor would be 1.016 (SoR Table 1). It should mean the tonne.

### 2.5 Tiles and stone

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value | Walk |
|---|---|---|---|---|---|---|---|---|
| Floor tile 600 × 600 GP (`TILE-FL`; library #18) | C11 SL 379 "GP (homogeneous) 600 mm x 600 mm floor tiles" | 82.00 | per sft | p. 12 / PDF 28 | sft | 1 | 82.00 | 110 |
| Floor tile 300 × 300 (`TILE-FL300`) | C11 SL 376 "GP (glazed/ unglazed homogeneous) 300 mm x 300 mm floor tiles country made" | 60.00 | per sft | p. 12 / PDF 28 | sft | 1 | 60.00 | — |
| Wall tile, glazed (`TILE-WL`) | C11 SL 371 "Country made wall tiles more than 310 mm X 510 mm in sizes or equivalent" | 85.00 | per sft | p. 12 / PDF 28 | sft | 1 | 85.00 | 90 |
| Stair tile 300 × 600 (`TILE-STAIR`) | C11 SL 395 "GP 300 mm x 600 mm stair tiles (country made)" | 97.00 | per sft | p. 13 / PDF 29 | sft | 1 | 97.00 | — |
| Granite 18 mm (`GRANITE-18`) | C11 SL 431 "18 mm thick granite stone (Indian/equivalent)" | 550.00 | per sft | p. 14 / PDF 30 | sft | 1 | 550.00 | — |
| Tile adhesive (`TILE-ADH`) | C11 SL 429 "Pasting tiles adhesive" | 21.00 | per kg | p. 14 / PDF 30 | kg | 1 | 21.00 | — |
| Tile grout (`TILE-GROUT`) | C11 SL 430 "Tiles grout / joint filler" | 85.00 | per kg | p. 14 / PDF 30 | kg | 1 | 85.00 | — |

A 300 × 600 wall tile, as in the starter Specification's toilets, could fall in SL 370 "more than 250 × 330
& less than 310 × 510" at ৳65 or in SL 371 at ৳85. SL 371 is shown; the owner picks.

### 2.6 Paint

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value |
|---|---|---|---|---|---|---|---|
| Plastic emulsion, interior (`PAINT-INT-L`) | C13 SL 466 "Acrylic plastic emulsion paint (plastic/matt finish)" | 245.00 | per litre | p. 15 / PDF 31 | litre | 1 | 245.00 |
| Sealer, interior (`SEALER-INT`) | C13 SL 469 "Sealer for acrylic plastic emulsion paint" | 172.00 | per litre | p. 15 / PDF 31 | litre | 1 | 172.00 |
| Putty, interior (`PUTTY-INT`) | C13 SL 462 "Ready-mix putty (interior)" | 80.00 | per kg | p. 15 / PDF 31 | kg | 1 | 80.00 |
| Exterior emulsion, the "weather coat" (`PAINT-EXT-L`) | C13 SL 456 "Standard exterior emulsion paint" | 310.00 | per litre | p. 15 / PDF 31 | litre | 1 | 310.00 |
| Sealer, exterior (`SEALER-EXT`) | C13 SL 458 | 195.00 | per litre | p. 15 / PDF 31 | litre | 1 | 195.00 |
| Putty, exterior (`PUTTY-EXT`) | C13 SL 461 | 64.00 | per kg | p. 15 / PDF 31 | kg | 1 | 64.00 |
| Distemper (`DISTEMPER-L`) | C13 SL 464 "Synthetic polyvinyl (S.P.) distemper" | 102.00 | per litre | p. 15 / PDF 31 | litre | 1 | 102.00 |
| Distemper sealer (`DISTEMPER-SEALER`) | C13 SL 465 | 175.00 | per litre | p. 15 / PDF 31 | litre | 1 | 175.00 |
| Enamel (`ENAMEL-L`) | C13 SL 470 "Standard synthetic enamel paint" | 220.00 | per litre | p. 15 / PDF 31 | litre | 1 | 220.00 |
| Thinner (`THINNER`) | C13 SL 463 "Thinner for oil-based paint (turpentine)" | 130.00 | per litre | p. 15 / PDF 31 | litre | 1 | 130.00 |

"Weather coat" is a brand name, and PWD's equivalent is standard exterior emulsion. The prototype priced
all four paints at ৳0. For coverage, p. x says 1 gallon of plastic emulsion or enamel covers 300 sft of
new surface, and 1 gallon of distemper covers 250 sft. One UK gallon is 4.546 litres (SoR Table 1).
Two coats of plastic emulsion therefore use 0.0303 l/sft, or ৳7.43/sft of paint alone (derived).

### 2.7 Lime and surki (roof lime terracing)

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value |
|---|---|---|---|---|---|---|---|
| Slaked lime (`LIME-SLAKED`) | C7 SL 197 "Slaked lime" | 25.00 | per kg | p. 7 / PDF 23 | kg | 1 | 25.00 |
| Stone lime (`LIME-STONE`) | C24 SL 2106 "Stone lime" | 20.00 | kg | p. 63 / PDF 79 | kg | 1 | 20.00 |
| Surki (`SURKI`) | C7 SL 198 "Surki from 1st class brick" | 113.00 | per cft | p. 7 / PDF 23 | cft | 1 | 113.00 |
| Surki, second row (`SURKI-CUM`) | C24 SL 2107 "Surki" | 1,600.00 | cum | p. 63 / PDF 79 | cft | 0.028316846592 | 45.31 |

The terracing item 17.4 specifies stone lime, slaked at site, with khoa, surki and lime at 7:2:2. The two
surki rows conflict, so the owner picks one.

### 2.8 Concrete and formwork accessories

| Vextrus Resource (code) | PWD row, as printed | PWD value | Printed unit | Page | Vextrus unit | Factor | Value |
|---|---|---|---|---|---|---|---|
| Form oil (`FORM-OIL`; library #7) | C7 SL 216 "Shutter releasing agent/ form oil" | 180.00 | per litre | p. 7 / PDF 23 | litre | 1 | 180.00 |
| Admixture (`ADMIX-F`) | C7 SL 213 "Water reducing high range admixture in concrete: Type - F" | 210.00 | per litre | p. 7 / PDF 23 | litre | 1 | 210.00 |
| Timber for formwork (`TIMBER-FW`) | C9 SL 236 | 550.00 | per cft | p. 8 / PDF 24 | cft | 1 | 550.00 |
| Steel prop (`STEEL-PROP`) | C12 SL 454 "Steel prop with adjustable mechanism including top and bottom plate" (purchase) | 1,700.00 | per set | p. 15 / PDF 31 | nos | 1 | 1,700.00 |
| Bamboo prop (`BAMBOO-PROP`) | C12 SL 440 | 138.00 | each | p. 15 / PDF 31 | nos | 1 | 138.00 |
| Polythene sheet (`POLY`) | C24 SL 1943 | 260.00 | per % sft | p. 58 / PDF 74 | sft | 0.01 | 2.60 |
| Ready-mix production (`RMC-PROD`) | C26 SL 2194 "Production cost of Ready Mix Concrete (excluding material cost) including carrying and pumping at site" | 410.00 | per cum | p. 66 / PDF 82 | cft | 0.028316846592 | 11.61 |

## 3. Labour, plant and work rates PWD states (Dhaka, Mymensingh)

**Labour, per day** (C1, p. 1 / PDF 17). The Vextrus unit is "day", with factor 1. PWD states no output
per day, so none of these converts to a rate per unit of work.

| SL | Category | ৳ per day |
|---|---|---|
| 1 | Head mason / Mosaic head mistry | 800.00 |
| 2 | Mason / Mosaic mistry | 700.00 |
| 3 | Skilled labour | 600.00 |
| 4 | Ordinary labour | 550.00 |
| 8 | Foreman/Supervisor | 850.00 |
| 9 | Electrician | 700.00 |
| 11 | Rod binder | 700.00 |
| 13 | Plumber | 700.00 |
| 14 | Painter | 700.00 |
| 15 | Carpenter | 700.00 |
| 16 | Welder | 700.00 |
| 18 | Helper to carpenter/ painter/ plumber/ rod binder/ electrician/ polish mistry/ rig operator | 550.00 |
| 19 | Machine operator | 700.00 |
| 20 | Pile rig operator | 700.00 |

**Plant, work rates and carriage:**

| Row | As printed | Value | Printed unit | Page |
|---|---|---|---|---|
| C2 SL 33 | Scaffolding | 10.00 | per sft | p. 2 / PDF 18 |
| C2 SL 43 | Hire charge of concrete mixer machine | 1,200.00 | per day | p. 2 / PDF 18 |
| C2 SL 44 | Hire charge of concrete vibrator | 550.00 | per day | p. 2 / PDF 18 |
| C2 SL 45 | Hire charge of water pump for concreting or similar purposes | 530.00 | per day | p. 2 / PDF 18 |
| C2 SL 49 | Fuel & lubricant for mixer machine, vibrator, pump etc. | 1,275.00 | per day | p. 2 / PDF 18 |
| C2 SL 55 | Hire charge of cast-in-situ pile boring complete rig set including operational expenses | 8,500.00 | per day | p. 2 / PDF 18 |
| C3 SL 145 | Placing and removing of shutter for formwork (excluding cost of materials) | 18.00 | per sft | p. 5 / PDF 21 |
| C3 SL 146 | Making steel shutter for formwork (excluding cost of materials) | 90.00 | per sft | p. 5 / PDF 21 |
| C3 SL 141 | Breaking of 20 mm down brick chips | 970.00 | per % cft | p. 5 / PDF 21 |
| C3 SL 143 | Breaking of 20 mm down stone chips | 2,200.00 | per % cft | p. 5 / PDF 21 |
| C25 SL 2187(a) | Carriage of materials except bricks and bats, up to 1.5 km | 226.00 | per M. ton | p. 65 / PDF 81 |
| C25 SL 2189(a) | Carriage of bricks or bats, up to 1.5 km | 355.00 | per %0 nos | p. 65 / PDF 81 |

## 4. PWD item rates for the prototype's ৳0 items (not input prices)

Several of the prototype's ৳0 lines are supply-and-apply work or labour-only work: painting, the neat
cement finish, roof treatment, the collapsible gate, earthwork and pile heads. Input prices alone cannot
price them, so PWD's **item rates** are given here as the only PWD evidence. An item rate includes PWD's
profit (10 %), overhead (3.5 %) and VAT (10 %) (p. 1 / PDF 17). "Net" = printed ÷ 1.2611, the
composition derived in qs-defaults.md §2.4 (Medium).

| Prototype line | PWD item, as printed | Printed | Unit | Page | Vextrus unit | Factor | Printed per Vextrus unit | Net |
|---|---|---|---|---|---|---|---|---|
| Earthwork in excavation | 02.1.2 "Earthwork in excavation in foundation trenches up to 1.5 m depth and maximum 10 m lead" | 173.00 | cum | p. 72 / PDF 88 | cft | 0.028316846592 | 4.90 | 3.88 |
| Backfill (nearest; PWD has no "with excavated earth" item) | 02.13 "Earth filling in foundation trenches and plinth in 150 mm layer with earth available within 90 m …" | 213.00 | cum | p. 74 / PDF 90 | cft | 0.028316846592 | 6.03 | 4.78 |
| Sand filling, F.M. 0.8 (sand included) | 02.10.2 | 1,199.00 | cum | p. 73 / PDF 89 | cft | 0.028316846592 | 33.95 | 26.92 |
| Pile-head breaking | 09.7 "Labour for breaking head of hardened cast in situ bored pile …" | 3,695.00 | cum | p. 119 / PDF 135 | nos | 0.117809725 (500 mm pile, 600 mm over-cast: an assumption) | 435.31 | 345.18 |
| Pile boring, for comparison with the ৳450/rft Labour Contract | 09.1.3 boring, 500 mm dia (boring only, with rig, casing and bentonite) | 1,255.00 | meter | p. 118 / PDF 134 | rft | 0.3048 | 382.52 | 303.33 |
| Interior plastic emulsion | 16.2.1 "Interior standard acrylic emulsion paint (plastic or matt finish) …" sealer, putty, 2 coats, all floors | 265.00 | sqm | p. 169 / PDF 185 | sft | 0.09290304 | 24.62 | 19.52 |
| Weather coat | 16.1.1 "Exterior standard acrylic emulsion paint …" sealer, putty, 2 coats, all floors | 282.00 | sqm | p. 169 / PDF 185 | sft | 0.09290304 | 26.20 | 20.77 |
| Distemper | 16.11 synthetic polyvinyl distemper, sealer, putty, 2 coats | 219.00 | sqm. | p. 173 / PDF 189 | sft | 0.09290304 | 20.35 | 16.13 |
| Enamel | 16.3.1 "Standard synthetic enamel paint …" 2 coats over anti-corrosive | 235.00 | sqm | p. 170 / PDF 186 | sft | 0.09290304 | 21.83 | 17.31 |
| Neat cement finish (nearest; PWD has no stand-alone item) | 04.26 25 mm artificial patent stone 1:2:4, brick chips, "finishing the top with neat cement", ground floor | 551.00 | sqm | p. 83 / PDF 99 | sft | 0.09290304 | 51.19 | 40.59 |
| (same, stone chips) | 04.28 | 608.00 | sqm | p. 84 / PDF 100 | sft | 0.09290304 | 56.49 | 44.79 |
| Roof lime terracing | 17.4 "Average 100 mm thick finished lime terracing …", 1st floor | 19,740.00 | cum | p. 177 / PDF 193 | sft at 100 mm | 0.009290304 | 183.39 | 145.42 |
| (floor add) | 17.4.1 added per floor above the 1st | 122.00 | cum | p. 177 / PDF 193 | — | — | — | — |
| Collapsible gate | 19.1.3 M.S. collapsible gate, 25 × 25 × 3 mm angle, "excluding the cost of painting" | 6,165.00 | sqm | p. 192 / PDF 208 | sft | 0.09290304 | 572.75 | 454.16 |
| (lighter gate) | 19.1.4 M.S., 20 × 20 × 3 mm angle | 5,331.00 | sqm | p. 193 / PDF 209 | sft | 0.09290304 | 495.27 | 392.73 |

Notes on these rates:
- Earthwork adds ৳31/cum for each extra 0.5 m of depth beyond 1.5 m (02.1.3).
- A gate needs its area to become a price per gate (nos).
- The 18 library items' own Benchmark Rates were not extracted: the brief asked for them only if the SoR
  gave no input prices.

## 5. Labour rates Developers pay that PWD does not state (for the owner, in one pass)

PWD prices labour per day and never per unit of a Developer's Labour Contract. The draft column is
tax-and-allowances.md §B.4 (all Low, the researcher's own). The PWD column is the nearest thing PWD
states. It is evidence, not a Developer rate.

| Work | Vextrus unit | Draft (§B.4) | Prototype used | Nearest PWD evidence | Owner's value |
|---|---|---|---|---|---|
| Casting-area Labour Contract: rebar binding, shuttering and casting of the frame | sft of casting area | ৳170 | ৳170 | none per unit. Rod binder ৳700/day, mason ৳700, helper ৳550 (p. 1) | |
| Shuttering, outside the casting-area contract | sft of formwork | none | ৳0 | C3 SL 145 placing and removing shutter ৳18/sft, excluding materials (p. 5 / PDF 21) | |
| Rebar cutting, bending and binding, outside the contract | kg (or ton) | none | ৳0 | rod binder ৳700/day + helper ৳550/day; no output stated | |
| Concrete casting (mix, place, vibrate, cure), outside the contract | cft | none | ৳0 | 07.3.2 leaves about ৳31.5/cft for labour, plant, water and curing, net (derived, §6) | |
| Brickwork 10" | cft | ৳40 | ৳40 | mason ৳700/day, ordinary labour ৳550/day | |
| Brickwork 5" | sft | ৳20 | ৳20 | same | |
| Plaster | sft | ৳14–16 | ৳15 | mason ৳700/day | |
| Tile laying | sft | ৳30 | ৳30 | mason / mosaic mistry ৳700/day | |
| Painting, labour only (if the Developer buys the paint) | sft | none | ৳0 (supply-and-apply lines) | painter ৳700/day, helper ৳550; supply-and-apply item rates in §4 | |
| Earthwork in excavation | cft | none | ৳0 | 02.1.2 ৳4.90 printed, ৳3.88 net (the item is essentially labour) | |
| Backfilling with excavated earth | cft | none | ৳0 | 02.13 ৳6.03 printed, ৳4.78 net | |
| Sand filling labour (sand bought apart) | cft | none | ৳0 | 02.10.2 net ৳950.8/cum less F.M. 0.8 sand at the 1.20 compaction factor (৳707.7) = **৳6.88/cft** (derived, Low) | |
| Brick flat soling | sft | none | ৳0 | none per unit | |
| Pile boring and casting (Labour Contract) | rft | ৳450 | ৳450 | 09.1.3 boring only, 500 mm, with rig: ৳382.52 printed, ৳303.33 net | |
| Pile-head breaking | nos | none | ৳0 | 09.7 ৳3,695/cum, which is ৳435 printed or ৳345 net per 500 mm head of 600 mm | |

## 6. Cross-check: are PWD's item rates built on these input prices?

Rates per cum, Dhaka. Material quantities are from qs-defaults.md §2.3 (the PWD dry-volume factor of 1.5,
no wastage). Net = printed ÷ 1.2611.

| Item | Printed | Net | Materials at PWD prices | Share | Left for labour, plant, water, curing |
|---|---|---|---|---|---|
| 07.3.2 RCC 1:1.5:3, stone chips, columns (p. 100 / PDF 116) | 15,380 | 12,196 | 11,084 (cement 7.705 bags ৳4,007; sand 14.45 cft ৳777; stone 28.89 cft ৳6,300) | 91 % | 1,112 (৳31.5/cft) |
| 07.2.2 RCC 1:2:4, stone chips, columns (p. 100 / PDF 116) | 14,890 | 11,807 | 10,562 | 89 % | 1,245 (৳35.3/cft) |
| 07.1.2 RCC 1:2:4, brick chips, columns (p. 99 / PDF 115) | 10,946 | 8,680 | 7,337 (with derived brick chips) | 85 % | 1,342 (৳38.0/cft) |

The materials come to 85–91 % of each net rate. The remainders are small, positive and close to one
another. That is what one expects if PWD's item rates are built on this list (Medium: it rests on the
1.2611 composition and on qs-defaults' quantities). The remainder is too small to show whether carriage is
added on top of the material prices.

## For the owner to verify

- [ ] Ship the Dhaka column of the SoR's "Rates of Man, Materials and Mark-ups" as Vextrus's starter Market
  Price set, labelled with the edition and "in force 22 Jan 2026" (recommended). The walk prices would
  then leave the product.
- [ ] Sand: PWD's ৳19.00/cft local (F.M. 1.2) and ৳53.80/cft Sylhet (F.M. 2.2) are 65 % and 33 % under the
  walk prices. Is that what a Dhaka Developer pays at site in 2026?
- [ ] Stone chips at ৳218.04/cft (boulder plus breaking), against the walk's ৳180.
- [ ] Undated prices: accept them as "PWD's, carried from the 2022 (Revised) edition", or compare them
  with that edition first.
- [ ] Binding wire: PWD's G.I. wire at ৳120/kg, or the Developer's black annealed wire.
- [ ] Brick chips: the derived ৳120.20/cft (bricks broken on site), or a bought-broken price.
- [ ] Surki: SL 198 (৳113/cft) or SL 2107 (৳1,600/cum = ৳45.31/cft).
- [ ] Wall tile 300 × 600: SL 370 (৳65) or SL 371 (৳85).
- [ ] Grade 500 at ৳87,000/t although Grade 400 is ৳89,000: use it as printed?
- [ ] §5: one value per row for the labour rates Developers pay.

**Verified by a refuter (27 Sep 2026, session 02).** 20 of the 85 rows (15 chosen, 5 by
`random.seed(20260927)`) checked against the text layer and rendered page images: all CONFIRMED, each in
the Dhaka, Mymensingh column with its printed unit and factor; over all 85 rows value × factor equals the
quoted value within ৳0.006, and each item rate's net equals its value ÷ 1.26111 within ৳0.01. The
brick-chip price (৳120.20/cft) and "materials are 91 % of 07.3.2 net" re-derive exactly. Caveats: the
1.2611 mark-up factor is itself Medium (qs-defaults.md:335); two nets differ from exact by ৳0.01; 65
rows unsampled.
