# The Estimate's tax layer, and default allowances per Takeoff Step

Researched 26 Sep 2026. There are two questions:
- **A.** What VAT and AIT apply to a Developer's Labour Contract bills in FY 2025-26 and FY 2026-27, and
  which other taxes and levies belong in a construction Estimate?
- **B.** What consumption per sft of Gross Floor Area should each Takeoff Step's allowance carry by
  default?

The terms are those of `CONTEXT.md`. In this file, "per sft" always means per sft of Gross Floor Area
(every floor, basement and GF parking included; the roof is not a floor).

**Confidence.**
- **High:** a primary source (an NBR SRO, a PWD page) states it, and I read that source.
- **Medium:** a professional firm's summary of the law, or plain arithmetic from a primary source.
- **Low:** a practice website, a vendor page, or my own judgement.

Every Low figure is repeated in "For the owner to verify".

---

## Conclusions

1. **VAT on a Labour Contract bill is 10 %, and the owner is right that it was 7.5 % before.**
   - **The service.** A contractor who does construction work is a "construction firm" (নির্মাণ
     সংস্থা, service code S004.00).
   - **The change.** The Finance Ordinance 2025 raised its rate from 7.5 % to 10 % from **1 July 2025**,
     by moving S004.00 from Table-2 to Table-3 of the Third Schedule.
   - **The deduction.** The VAT Deduction at Source Rules 2025 (SRO 182-Ain/2025/310-Mushak, 27 May
     2025) list S004.00 at **10 %**. VAT must be deducted "whether or not there is a VAT invoice".
   - **FY 2026-27 is unchanged.** The June 2026 amendment of those rules (SRO 140-Ain/2026/345-Mushak,
     7 June 2026, in force 1 July 2026) leaves the S004.00 row as it was.
2. **AIT on a Labour Contract bill is 5 %, a flat rate with no slabs.** It is deducted under Income Tax
   Act 2023 s. 89.
   - The rate is set by the Tax at Source Rules 2024, rule 3(1), as replaced by SRO
     157-Ain/Aykor-12/2025 (26 May 2025): "civil work, construction, engineering or similar work: 5 %",
     on any amount.
   - It was 7 % before FY 2025-26.
   - KPMG's summary of the Finance Bill 2026 says it "remains at flat rate of 5 %" for FY 2026-27.
3. **Who deducts, and why it is the Developer's cost.**
   - **VAT.** Any limited company, and any business with annual turnover above Tk 10 crore, is a
     VAT withholding entity. So a Developer company deducts the VAT.
   - **Unregistered contractors.** When the labour contractor is unregistered or only on the
     turnover-tax list, the rules make the **Developer liable for the VAT** (VDS Rules 2025, rule 6(1)
     proviso).
   - **AIT.** The Developer also deducts AIT as a "specified person".
   - **No credit back.** A Developer's own sales (flats, S010.20) are taxed at reduced rates, so it
     almost certainly cannot claim input credit. The VAT is therefore a real cost (Medium; the s. 46
     text was not read).
4. **VAT and AIT are a separate Estimate layer only if the Labour Contract rate is the contractor's
   take-home.**
   - **If the rate "includes VAT and AIT",** the tax is already inside the Priced BOQ. The layer
     should then only show the split (VAT = bill × 10/110; AIT = 5 % of the bill net of VAT) and add
     nothing.
   - **If the rate is net,** the Developer pays both on top. The layer is then
     **15.79 % of the net Labour Contract amount**: VAT 10.53 % plus AIT 5.26 %, because
     gross = net ÷ 0.95 × 1.10.
   - The same applies to a Material-and-Labour Contract, such as a piling contractor.
   - **This is the one decision the owner must make:** which way Dhaka labour rates are quoted. My
     recommendation is a flag on each Labour Contract ("rate includes VAT and AIT": yes or no),
     defaulting to **no**. I expect sardars to quote take-home rates, but that is practice I have not
     verified.
5. **The other taxes and levies:**
   - **Inside Market Prices, not a layer:** VAT and AIT on materials (cement, rebar, bricks, sand).
   - **In the Estimate, as Lump Sums in the site works and MEP step:** utility connection charges
     (DESCO/DPDC, WASA). PWD itself lists them inside its estimate.
   - **In preliminaries:** testing, which PWD sets at 1 %.
   - **Outside the construction Estimate** (development or sales costs): land, the landowner's share,
     RAJUK approval fees, design fees, VAT on flat sales (2 % or 4.5 %), the Developer's per-sqm tax
     and the stamp duty and registration on flats, and income tax.
6. **The allowances (Section B) come from structural arithmetic on a stated reference building.** It
   is a G+9, 60' × 64' pile-founded Dhaka residential frame, priced with the owner's Rebar Ratios and
   PWD's Rate Analysis relations.
   - **Rebar lands in the owner's range of 4.5–6 kg per sft:**

     | Height | Rebar, kg per sft |
     |---|---|
     | G+6 | **4.7** |
     | G+9 | **4.9** |
     | G+14 | **5.8** |

   - **The other totals (G+9) sit near the published thumb rules:**
     - concrete 1.47 cft per sft;
     - cement 0.42 bags per sft;
     - formwork 2.4 sft per sft;
     - bricks 10 per sft.
   - **What is weak: the money check.** It gives a direct cost of about ৳2,890 per sft and an
     Estimate of about ৳3,280 per sft. The part that compares with PWD's 2022 plinth-area rate
     (net of mark-ups) is about **15 % below that rate**.
   - **Why it is weak:** the labour rates and the finish prices are my assumptions. Every allowance
     figure is Low until the owner sets it.

---

## A. The tax layer

### A.1 Sources read (all fetched 26 Sep 2026)

**Primary**
- **[VDS25]** NBR, *উৎসে মূল্য সংযোজন কর কর্তন ও আদায় বিধিমালা, ২০২৫* (VAT Deduction and Collection at
  Source Rules 2025).
  - SRO 182-Ain/2025/310-Mushak, 27 May 2025, in force 1 July 2025.
  - <https://nbr.gov.bd/uploads/sros/VATSRO-1822.pdf>
  - Rules 2, 3, 4, 5, 6 and 8 were read.
- **[VDS26]** NBR, the amendment to [VDS25].
  - SRO 140-Ain/2026/345-Mushak, 7 June 2026, in force 1 July 2026.
  - <https://nbr.gov.bd/uploads/sros/VAT_SRO-140.pdf>
- **[TSR25]** NBR, SRO 157-Ain/Aykor-12/2025, 26 May 2025 (Gazette, 26 May 2025). It amends the Tax at
  Source Rules 2024, replacing rule 3(1) (s. 89) and rule 4(1) (s. 90).
  - <https://nbr.gov.bd/uploads/sros/IT_SRO-157.pdf>
- **[AnxA] / [AnxB]** PWD SoR 2022, Annexure A (plinth-area rates, pp. 344–355) and Annexure B
  (preliminary estimates, pp. 357–362).
  - The original 2022 edition, as used in docs/research/qs-defaults.md.

**Professional-firm summaries (Medium)**
- **[ACN25]** ACNABIN (Baker Tilly), *Summary of important changes introduced by the Finance
  Ordinance, 2025*. Used: pp. 33, 49, 56 and 60.
  - <https://bti-global.files.svdcdn.com/production/network/bangladesh/documents/Reports/Summary-of-Important-Changes-Introduced-by-the-Finance-Ordinance-2025-of-BD-ACNABIN.pdf>
- **[KPMG26]** Rahman Rahman Huq (KPMG), *Salient features of Finance Bill 2026*, 14 June 2026.
  Used: pp. 7, 8, 11 and 20–30.
  - <https://assets.kpmg.com/content/dam/kpmg/bd/pdf/Salient_features_of_Finance_Bill_2026(Tax-and_VAT).pdf>
  - This is the Bill. The Act as gazetted (in force 1 July 2026) was not read.

**Practice and low-trust sources**
- **[FMS]** fmskillsharing.com, a worked contractor bill (VAT at 10/110, then AIT on the bill net of
  VAT).
  - <https://fmskillsharing.com/how-to-calculate-tax-vat-from-contractor-bill-supplier-bill-etc/>
- **[TXP27]** taxpertbd.com, the VAT and TDS charts for FY 2026-27.
- **[CAR27]** caripon.com, the TDS chart for FY 2026-27.
- **[TBS-R]** The Business Standard, the RAJUK fee proposal.
  - <https://www.tbsnews.net/bangladesh/rajuk-seeks-fivefold-hike-construction-approval-fees-1296821>

**Not read (so their clause numbers are unverified)**
- The VAT and SD Act 2012 text and its Third Schedule.
- The Income Tax Act 2023 text.
- The Finance Act 2026 as passed.

### A.2 VAT on Labour Contract bills

| Fact | Value | Source | Conf. |
|---|---|---|---|
| Service a labour-only building contractor falls under | **S004.00 construction firm** (নির্মাণ সংস্থা) | [VDS25] r. 3(1) table, serial 05 | High (that the code exists and its rate); Medium (that a labour-only contractor falls under it: see the risk row) |
| Rate from 1 July 2025 | **10 %** | [VDS25] r. 3(1) serial 05: "S০০৪.০০ নির্মাণ সংস্থা ১০%" | High |
| Rate before 1 July 2025 | **7.5 %** | [ACN25] p. 56: "S004.00 … withdrawn from Paragraph B of Table-2 and … inserted in paragraph B of Table-3 … increased from 7.5 % to 10 %"; p. 60 (VDS guidelines 2021 → 2025) | Medium (firm summary; consistent with PWD SoR-2R moving its own VAT mark-up from 7.5 % to 10 %) |
| Rate in FY 2026-27 | **10 %** (unchanged) | [VDS26] amends r. 3(1) only by adding S083.00 at serial 41 and renumbering 41–44, in force 1 July 2026. [KPMG26] lists no construction-rate change. [TXP27] shows S004.00 at 10 % (Table-3, Part B). | High (the VDS table); Medium (the Third Schedule as enacted) |
| Deducted regardless of invoice | "মূসক চালানপত্র থাকুক বা না থাকুক" (whether or not there is a VAT invoice) | [VDS25] r. 3(1) | High |
| Who must deduct (withholding entity) | government bodies, banks, insurers and financial institutions, secondary-and-above educational institutions, **any limited company**, and **any person or entity with annual turnover above Tk 10 crore** | [VDS25] r. 2(1)(খ) | High |
| Supplier unregistered or only on the turnover-tax list | the **recipient (the Developer) is liable** for the applicable VAT | [VDS25] r. 6(1) proviso | High |
| Deposit | registered withholding entity: an increasing adjustment in its own return, and a Mushak-6.6 certificate within 3 working days of filing. Unregistered: treasury challan within 15 days of payment, then Mushak-6.6 within 3 working days | [VDS25] r. 6(2), 6(3) | High |
| Liability | the withholding entity and the supplier are jointly and severally liable; the executive officers can be proceeded against | [VDS25] r. 8 | High |
| Base | the value of the supply. If the bill is VAT-inclusive, VAT = bill × **10/110** (the tax fraction) | [FMS] worked example | Low–Medium (practice; the Act's tax-fraction clause was not read) |
| **Risk: manpower supply** | if a contractor is paid per head or per day for supplying workers rather than for measured work, the service may be **S072.00 manpower supply at 15 %** | [VDS25] r. 3(1) serial 40 | High (the rate); Low (the classification) |
| Input credit for the Developer | its flat sales are reduced-rate (S010.20: 2 % up to 1,600 sft, 4.5 % above, 2 % on re-registration). A reduced-rate supplier generally cannot take input tax credit, so VAT on labour is a cost | rates: [VDS25] serial 10. The credit bar is VAT Act s. 46 (not read) | Medium |

### A.3 AIT (tax deducted at source) on Labour Contract bills

| Fact | Value | Source | Conf. |
|---|---|---|---|
| Section | Income Tax Act 2023 **s. 89**: payments to contractors, sub-contractors and suppliers | [TSR25] r. 3(1) "আইনের ধারা ৮৯ এর অধীন" | High |
| Rate from 1 July 2025 | **5 %**, "on any amount of base value" (যেকোনো পরিমাণ ভিত্তিমূল্যের উপর); no slabs | [TSR25] r. 3(1) table serial 17: "manufacturing, process or conversion, civil work (পূর্ত কাজ), construction, engineering or similar work: 5 %" | High |
| Rate before | 7 % | [ACN25] p. 33 ("7 % → 5 % Decrease") | Medium |
| Rate in FY 2026-27 | **5 %** | [KPMG26] p. 11: "remains at flat rate of 5 %". [CAR27] and [TXP27] agree. | Medium (the Bill and charts; the FY 2026-27 rules SRO was not read) |
| Who deducts | the "specified person" making the payment: companies, firms, AOPs and similar | ITA 2023 s. 89 with s. 2 (not read) | Medium |
| Base | the bill **net of VAT** | [FMS] | Low–Medium |
| Failure to deduct | the shortfall is payable **plus 50 %** | [KPMG26] p. 8; [ACN25] p. 32 | Medium |
| Whose tax it is | the contractor's advance income tax, credited to him. It costs the Developer nothing unless the rate is agreed net of tax. | the nature of TDS | High |

**Related rates** (the same rule tables, [TSR25]), for Market Prices, not for the layer:
- supply of goods in general, 5 % (serial 19);
- cement, iron and iron-product manufacturers, 2 % (serial 8);
- MS billet, 0.5 % (serial 1).

### A.4 How the tax layer should work in the Estimate (my recommendation)

- **Each Labour Contract carries a flag:** "rate includes VAT and AIT", **yes** or **no** (default
  **no**, Low: to be verified from Dhaka practice).
  - **No (net):** the layer adds VAT = 10 % × (net ÷ 0.95) and AIT = 5 % × (net ÷ 0.95). That is
    **+15.79 %** on the Labour Contract amounts: VAT 10.53 % plus AIT 5.26 %.
  - **Yes (gross):** the layer adds ৳0. It shows the split for the cash-flow view:
    VAT = gross × 10/110, AIT = 5 % × (gross − VAT).
- **Where the layer applies:**
  - to every Labour Contract line, including the labour share inside an allowance (Section B
    carries labour quantities such as casting area for this reason);
  - to a Material-and-Labour Contract (piling, a lift supplied and installed) only where its rate
    is net.
- **Where it does not apply:** Lump Sums typed by the QS are taken as typed. The QS types them
  including VAT, and the MEP template says so.
- **Rates held as dated data:** VAT (S004.00) 7.5 % until 30 June 2025, then 10 % from 1 July 2025;
  AIT (s. 89) 7 % until 30 June 2025, then 5 % from 1 July 2025. Each row carries its SRO.
- **G+9 example (Low):** the labour inside the reference building's civil works is about ৳448 per sft
  (B.4). On net rates the layer is **≈ ৳71 per sft**, about 2 % of the Estimate.

### A.5 Other taxes and levies: in the construction Estimate or not

| Levy | Where it belongs | Why / source | Conf. |
|---|---|---|---|
| VAT and AIT on materials (cement, rebar, bricks, sand, chips, tiles) | **Inside the Market Price**; no layer | Manufacturers invoice with Mushak-6.3, so no VDS applies ([VDS25] r. 5(a)). The same holds for a trader invoicing at 15 % (r. 5(b)). A trader who invoices otherwise is a procurement provider (S037.00, VDS 10 %, r. 4(2), serial 22). The Market Price must be the **gross amount the Developer pays**, including any VAT it deposits itself. | High (the rules); Medium (the consequence) |
| Supplementary duty, import duty (lifts, generators, imported tiles) | Inside the price or the Lump Sum | paid upstream | High |
| Utility connection and demand charges (DESCO/DPDC/PDB, WASA, sewer) | **In the Estimate:** Lump Sums in the site works and MEP step | PWD lists "PDB/DESA/DESCO/REB connection charges" and "WASA/Municipal charge" inside its estimate ([AnxA] pp. 350–351; [AnxB] p. 361) | High (PWD practice) |
| Quality assurance and material testing | **In the Estimate:** preliminaries | [AnxB] p. 362 item 16: 1 % of the subtotal | High (as PWD's) |
| Contingency | **In the Estimate:** its own layer | [AnxB] p. 362 item 17: price contingency up to 8 %, physical contingency up to 2 % | High (as PWD's) |
| Land, landowner's signing money and share of flats | **Outside** | [AnxB] p. 362 keeps "cost of land" (item 18) below the construction subtotal | High |
| RAJUK / CDA land-use clearance, building permit, occupancy fees | **Outside** (a development cost). They are small: TBS reports about Tk 42,500 for a 5,000 m² building, and about Tk 2.5 lakh under the proposed 2025 rules, i.e. ≈ ৳1–5 per sft | [TBS-R] | Low |
| Architect, structural and MEP design fees; soil test | **Outside** (a development cost) | practice | Low |
| VAT on flat sales (S010.20: 2 % / 4.5 % / 2 % on re-registration); land developer (S010.10: 2 %) | **Outside** (sales) | [VDS25] serials 09–10 | High (the rates) |
| Developer's per-sqm tax on flat registration; stamp duty, registration fee, local-government tax | **Outside** (at transfer). The per-sqm tax is reported as Tk 1,000–1,600 per sqm residential in Dhaka under ITA 2023 "s. 126" | web summaries only; section and rates not verified | Low |
| Developer's income tax; the new Developer part of the Fifth Schedule (Finance Bill 2026); WPPF | **Outside** (tax on profit) | [KPMG26] p. 7 | Medium |

---

## B. Default allowances per Takeoff Step

### B.1 The reference building and its assumptions

The allowances are arithmetic on one stated building, so every figure can be redone. **Each geometric
input is my assumption (Low).**

**Plan and floors**
- Footprint and typical floor 60' × 64' = **3,840 sft**. GF is parking; floors 1 to N−1 are flats,
  4 per floor.
- Floor to floor 10'. Slabs 6", two-way beam-and-slab, with 7 % of the slab area as openings.
- Suspended slab levels = N (floor 1 up to and including the roof).
- Gross Floor Area = N × 3,840 sft.

**Frame**
- 26 columns.
- The average column section over the height:
  - G+6: 2.0 sft;
  - G+9: 2.6 sft (for example 24" × 30" at the base tapering to 12" × 20" at the top);
  - G+14: 3.6 sft.
- Columns stop at the slab soffit (IS 1200, as ruled), plus a 4' stub from the top of the cap to the
  GF slab.
- The core per floor:
  - G+6 and G+9: one lift, 25 rft of 8" wall;
  - G+14: two lifts, 50 rft of 10" wall.
- Beams: 800 rft clear per level. Section below the slab: 0.97 sft (G+6), 1.07 sft (G+9), 1.20 sft
  (G+14), i.e. about 10–12" × 14–15".
- Stairs: one per floor (two for G+14), 65 cft of waist and steps per storey; landings are slab.

**Foundation (pile, no basement)**
- The service load is taken as 220 psf of Gross Floor Area. Piles = load ÷ safe capacity × 1.10.

  | Height | Piles | Capacity each |
  |---|---|---|
  | G+6 | 20" dia × 60' | 110 kips |
  | G+9 | 20" dia × 70' | 140 kips (67 piles) |
  | G+14 | 24" dia × 80' | 220 kips |

- Each pile carries 2' of over-cast (P1).
- Pile cap: 70 cft per 20" pile, 115 cft per 24" pile.
- Grade beams: 500 rft of 12" × 24" (12" × 29" for G+14).
- A 5" RCC slab on grade.
- Excavation: 5.5 cft per sft of footprint (caps and grade beams with 1'-6" working space).
- Sand filling: 2' over the footprint.
- Soling: under the slab, caps and grade beams.

**Other quantities, per flat floor**

| Item | Quantity |
|---|---|
| 10" external brickwork | 250 rft × 8.8' high, 25 % openings |
| 5" internal brickwork | 700 rft × 8.8' high, 15 % openings |
| Slab-edge members (sunshades, drop walls) | 90 cft |
| Lintels | 54 cft |
| Toilet and kitchen wall tiles | 2,250 sft |
| Windows | 13 % of floor area |
| Doors | 11 per 1,000 sft |

**Rebar and material coefficients**
- Rebar uses the owner's Rebar Ratios (docs/specs/bd-defaults.md), which include laps. Two ratios are
  mine: slab on grade 1.5 kg/cft (not in the owner's list) and the roof stair and lift room
  4.0 kg/cft (blended).
- Cement, sand and bricks follow the bd-defaults Rate Analyses (PWD relations).
- Consumption is **net, as measured**. Wastage is added by the Rate Analysis when priced and in the
  Material Schedule, never here.

The script behind every number is reproducible from the lines above. It is not committed.

### B.2 The allowance per Takeoff Step

The figures are **per sft of Gross Floor Area, for the G+9 reference**, with G+6 and G+14 values in
brackets where they differ materially. A step's allowance is the listed quantities priced at current
Market Prices through their Rate Analyses. Labour quantities are listed so that Labour Contracts price
too. "Confidence" is about the default as a figure for a typical Dhaka building, not the arithmetic.

#### Step 5. Foundations and substructure (pile, no basement)

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Pile concrete (1:1.5:3) | 0.27 (G+6 0.30, G+14 0.29) | cft | 67 piles × 20" × 72' ÷ 38,400 sft | Low |
| Pile boring | 0.12 (G+6 0.13, G+14 0.09) | rft | piles × length | Low |
| Pile-cap concrete | 0.12 (G+6 0.16, G+14 0.13) | cft | 70 cft per pile | Low |
| Grade-beam concrete | 0.026 (G+6 0.031) | cft | 500 rft × 2.0 sft | Low |
| Slab-on-grade concrete | 0.042 (G+6 0.060, G+14 0.028) | cft | footprint × 5" ÷ N | Medium (arithmetic) |
| CC blinding (1:3:6) | 0.017 | cft | 2,550 sft × 3" | Low |
| **Rebar** | **0.94** (G+6 1.12, G+14 0.94) | kg | pile 1.7, cap 2.5, grade beam 4.2 kg/cft; slab on grade 1.5 (mine) | Low |
| Formwork (cap and grade-beam sides) | 0.10 (G+6 0.13, G+14 0.07) | sft | FW6: sides only | Low |
| Earthwork in excavation | 0.55 (G+6 0.79, G+14 0.37) | cft | 5.5 cft per sft of footprint ÷ N | Low |
| Sand filling in plinth | 0.20 (G+6 0.29, G+14 0.13) | cft | 2' × footprint ÷ N | Low |
| Brick flat soling | 0.17 (G+6 0.24, G+14 0.11) | sft | footprint + 2,550 sft | Low |

**Cross-check with PWD.** [AnxA] Table 1 (p. 344) gives the pile foundation for 10 storeys at
**৳42,685 per sqm of footprint** (printed 2022; 18 m precast piles), with these additions:
- +৳11,855 for piles 18–24 m;
- +20 % for cast-in-situ piles.

That makes ৳6,545 per sqm of Gross Floor Area ≈ **৳608 per sft printed, ≈ ৳496 net of mark-ups**. The
figures above price at **≈ ৳329 per sft** (B.4). That is below PWD, and the gap is mainly pile
numbers and length. **Dhaka soils vary more than any other input here.**

#### Step 6. Columns, shear walls and core

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Column concrete | 0.17 (G+6 0.14, G+14 0.24) | cft | 26 columns × average section × 9.5' per storey | Low |
| Shear wall and core concrete | 0.041 (G+14 0.10) | cft | 25 rft × 8" per floor (G+14: 50 rft × 10") | Low |
| **Rebar** | **1.40** (G+6 1.14, G+14 2.14) | kg | column 6.8, core 5.1 kg/cft | Low |
| Formwork | 0.59 (G+6 0.54, G+14 0.79) | sft | FW2: perimeter × height; core both faces | Low |

#### Step 7. Beams

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Beam concrete | 0.22 (G+6 0.20, G+14 0.25) | cft | 800 rft × 1.07 sft below the slab, per level | Low |
| **Rebar** | **1.14** (G+6 1.03, G+14 1.28) | kg | 5.1 kg/cft | Low |
| Formwork | 0.68 | sft | FW3: two sides + soffit | Low |

A flat-plate floor (no beams, 8–10" slab) moves most of this into step 8. The QS should switch the
floor type before allowances are shown.

#### Step 8. Slabs and slab-edge members

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Slab concrete (6") | 0.465 | cft | 0.5' × 93 % (openings); one suspended level per floor | Medium (arithmetic; the thickness is Low) |
| Slab-edge members: sunshades, drop walls, fins (class d) | 0.021 | cft | 90 cft per flat floor | Low |
| **Rebar** | **1.22** | kg | slab 2.5, class (d) 2.5 kg/cft | Low |
| Formwork | 0.88 | sft | FW4 soffit between beams + edges; class (d) 515 sft per floor | Low |
| **Casting area** (for a per-sft casting Labour Contract) | **1.00** | sft | suspended slab area ÷ Gross Floor Area; exactly 1 with no basement | Medium |

#### Step 9. Stairs

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Stair concrete (waist + steps) | 0.017 (G+14 0.034, two stairs) | cft | 65 cft per storey per stair | Low |
| Rebar | 0.05 (G+14 0.10) | kg | 3.1 kg/cft | Low |
| Formwork | 0.044 (G+14 0.089) | sft | FW7: soffit, risers, strings | Low |

#### Step 10. Tanks (underground reservoir and overhead tank)

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Concrete | 0.028 | cft | ~30 cft of RCC per flat (≈ 11,000 gal reservoir + 4,000 gal overhead for 36 flats) | Low |
| Rebar | 0.10 | kg | 3.4 kg/cft (basement-wall ratio) | Low |
| Formwork | 0.042 | sft | both wall faces + top slab | Low |

**Cross-check with PWD.** [AnxA] p. 349 prices a roof tank at ৳178 per gallon and p. 350 an
underground reservoir at ৳106 per gallon (printed 2022). For the reference that is ≈ ৳49 per sft
printed; the figures above price at ≈ ৳21 per sft.

#### Step 11. Walls and openings

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Brickwork 10" (external, 1:4 / 1:6) | 0.33 | cft | 250 rft × 8.8' × 75 % per flat floor; GF partial | Low |
| Brickwork 5" (internal, 1:4) | 1.24 | sft | 700 rft × 8.8' × 85 % per flat floor | Low |
| Bricks | 9.4 | nos | 11 per cft of 10" wall (PWD 1,100 per 100 cft); 4.58 per sft of 5" wall | Medium (coefficients); Low (quantities) |
| Lintel concrete | 0.013 | cft | 54 cft per flat floor | Low |
| Lintel rebar | 0.03 | kg | 2.5 kg/cft | Low |
| Lintel formwork | 0.07 | sft | — | Low |
| Windows | 0.12 | sft | 13 % of flat-floor area | Low |
| Doors | 0.010 | nos | 11 per 1,000 sft of flat floor | Low |

#### Step 12. Rooms and finishes

The Developer's Specification decides the items; these are the quantities.

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Plaster 12 mm 1:6, inner faces | 2.87 | sft | both faces of 5" walls + inner face of 10" walls | Low |
| Plaster 12 mm 1:4, outer faces | 0.49 | sft | outer walls + exposed RCC | Low |
| Plaster 6 mm 1:4, ceilings and RCC faces | 1.13 | sft | 1.2 × floor area per flat floor. **Many Developers skip ceiling plaster; set it to 0 if so.** | Low |
| Floor tiles | 0.76 | sft | 82 % of flat-floor area; GF lobby only | Low |
| Wall tiles (toilets, kitchen) | 0.53 | sft | 2,250 sft per flat floor | Low |
| Skirting | 0.23 | rft | — | Low |
| Interior paint | 3.49 | sft | plaster area less tiled area (PT1) | Low |
| Exterior paint | 0.50 | sft | — | Low |
| GF parking floor finish | 0.07 | sft | 70 % of the GF | Low |

#### Step 13. Roof

| Consumption | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Roof treatment (lime terracing or waterproofing + tiles) | 0.10 (G+6 0.14, G+14 0.07) | sft | footprint ÷ N | Medium (arithmetic) |
| Parapet, 5" brick, 3' high | 0.020 | sft | 256 rft × 3' | Low |
| Stair and lift room: RCC | 0.007 | cft | 260 cft | Low |
| Stair and lift room: rebar | 0.03 | kg | 4.0 kg/cft | Low |
| Stair and lift room: 5" walls | 0.016 | sft | 600 sft | Low |

**Cross-check with PWD.** [AnxA] Table 2 gives roof treatment at ৳3,360 per sqm printed (৳312 per sft of
roof), i.e. ≈ ৳31 per sft of Gross Floor Area for G+9.

#### Step 14. Site works and MEP (৳ per sft Lump Sums, Market-Price independent)

The PWD figures are **2022 printed ÷ 1.227**, i.e. net of the 22.703 % mark-ups PWD states for
Annexure A.

| Lump Sum | Default ৳/sft | Range | Source / basis | Conf. |
|---|---|---|---|---|
| Internal plumbing and sanitary | **170** | 100–205 | [AnxA] p. 349 item 6, residential ৳1,313 / 1,907 / 2,688 per sqm (standard / super / special) → ৳100 / 144 / 204 per sft net | Medium (PWD 2022); Low (the Developer's grade) |
| Internal electrical | **190** | 160–210 | [AnxA] p. 350 item 7, residential ৳2,130 / 2,490 / 2,760 per sqm → ৳161 / 188 / 209 per sft net | Medium / Low |
| Lift(s) | **105** | 80–200 | 1 lift for G+9 at ≈ ৳40 lakh, 2 for G+14. Vendor pages quote ৳8–35 lakh by capacity and stops. | Low |
| Generator | **80** | 50–100 | 100–200 kVA at ৳20–40 lakh | Low (no source) |
| Substation, HT/LT, utility connection and demand charges | **90** | 70–120 | [AnxA] p. 351 item 10 lists them, unpriced ("on the basis of requirements") | Low |
| Fire detection and protection | **50** | 30–120 | scales with height (BNBC 2020 Part 4, not read) | Low |
| Pumps, intercom, CCTV, miscellaneous | **40** | 30–60 | — | Low |
| Gas | **0** | 0–17 | [AnxA] p. 350 item 8: ৳182 per sqm on upper floors, ৳455 on GF. New piped-gas connections are assumed unavailable in Dhaka (unverified). | Low |
| Site works: boundary wall, gate, driveway, drains | **60** | 40–100 (higher for low buildings) | [AnxA] pp. 351–355: RCC-frame boundary wall ৳13,960 per m; MS gate ৳26,538 per m; RCC road ৳3,163 per sqm; drain ৳3,196 per m. Net, on a 10-katha plot (104 m of wall, 280 sqm paving, 100 m of drain) ÷ 38,400 sft. | Medium (rates); Low (plot) |

#### Basement modifiers (one basement under the footprint, 11' deep; the floor count rises by one)

| Change | per sft | Unit | Basis | Conf. |
|---|---|---|---|---|
| Add basement retaining wall (12") | +0.065 | cft | perimeter 248' × 11' | Low |
| Add retaining-wall rebar | +0.22 | kg | 3.4 kg/cft | Low |
| Excavation rises to | ≈ 1.7 | cft | 4,620 sft × 15.5' ÷ 42,240 sft | Low |
| Sand filling | 0 | cft | none under a basement | Medium |
| Add waterproofing (floor + walls) | +0.16 | sft | [AnxA] Table 4: ৳1,742 per sqm printed | Low |
| Add shoring / retaining piles and dewatering | +160 | ৳/sft | [AnxA] Table 4: ৳106,230 per m of perimeter (single basement) printed → ~৳86,600 net × 78 m ÷ 42,240 sft | Low |
| If a mat replaces piles and caps: mat concrete (4' thick) | 0.36 | cft | footprint × 4' ÷ 42,240 sft | Low |
| If a mat replaces piles and caps: mat rebar | 1.02 | kg | 2.8 kg/cft (against ≈ 0.72 for piles + caps) | Low |

[AnxA] Table 1 shows a mat is cheaper than piles for the same storeys: for 10 storeys, ৳32,846 against
৳42,685 per sqm of footprint.

### B.3 Whole-building cross-check (consumption)

| Measure, per sft | G+6 | G+9 | G+14 | Known figure | Verdict |
|---|---|---|---|---|---|
| **Rebar** (net, laps included, before 3 % Wastage) | **4.72** | **4.90** | **5.83** | Owner's range 4.5–6 (bd-defaults). Indian thumb rule: 4.5–4.75 residential, 5.0–5.5 commercial ([CIV], Low). | **In range** at every height; G+6 is near the floor |
| Of which, superstructure | 3.59 | 3.95 | 4.89 | — | — |
| Concrete | 1.50 | 1.47 | 1.63 | [CIV] lists "1.34 cu ft / sq ft", mislabelled as steel on the page, i.e. about 1.3 of concrete (Low) | Near; a little above |
| Cement | 0.42 | 0.42 | 0.45 | Indian thumb rules 0.40–0.43 bags ([CIV]; houseyog, Low) | Near |
| Formwork | 2.37 | 2.43 | 2.64 | "2.4 × plinth area" ([CIV], Low) | Near |
| Bricks (incl. soling and parapet) | 9.9 | 10.0 | 10.1 | Indian thumb rule 7.3 ([CIV]) | **Higher.** The BDS brick is smaller (9.5 × 4.5 × 2.75") and Dhaka flats are wall-dense. Flag for the owner. |

[CIV] = <https://civiconcepts.com/blog/thumb-rules-for-civil-engineering> (low trust; one row on that
page is visibly mislabelled).

### B.4 Whole-building cross-check (money, G+9, Low)

**Assumed Market Prices** (Low):

| Resource | Price | Source |
|---|---|---|
| Rebar | ৳95,000 per t | TBS, 12 Mar 2026: BSRM ~৳95,000 |
| Cement | ৳520 per bag | TBS, 12 Mar 2026: ৳475–520 |
| Bricks | ৳14 each | pricetodayhub, 2 May 2026: ৳13,000–16,000 per 1,000 |
| Sylhet sand | ৳80 per cft | pricetodayhub: ৳70–95 |
| Local sand | ৳55 per cft | pricetodayhub: ৳45–65 |
| Stone chips | ৳180 per cft | **my figure**: the same page says ৳90–130, which I doubt for Dhaka |
| Formwork material | ৳20 per sft | my figure |

**Assumed labour** (all Low, mine):

| Work | Rate |
|---|---|
| Casting-area Labour Contract (binding, shuttering, casting) | ৳170 per sft |
| Pile boring and casting | ৳450 per rft |
| Brickwork | ৳40 per cft (10"); ৳20 per sft (5") |
| Plaster | ৳14–16 per sft |
| Tile laying | ৳30 per sft |

**Assumed finishes** (all Low, mine):

| Item | Price |
|---|---|
| Floor tiles | ৳110 per sft |
| Wall tiles | ৳90 per sft |
| Windows | ৳700 per sft |
| Doors (average, incl. frame and fittings) | ৳14,000 each |

**The resulting direct cost:**

| Takeoff Step | ৳/sft (materials + labour) |
|---|---|
| 5 Foundations and substructure | 329 |
| 6 Columns, shear walls and core | 254 |
| 7 Beams | 234 |
| 8 Slabs and slab-edge members | 373 |
| 9 Stairs | 14 |
| 10 Tanks | 21 |
| 11 Walls and openings | 442 |
| 12 Rooms and finishes | 414 |
| 13 Roof | 25 |
| 14 Site works and MEP | 785 |
| **Direct cost** | **≈ 2,890** |
| Preliminaries and site overheads 6 % (assumed) | 173 |
| Contingency 5 % (assumed) | 144 |
| VAT and AIT on net Labour Contracts (15.79 % of ৳448) | 71 |
| **Estimate** | **≈ 3,280** |

**Against PWD.** The same scope priced by [AnxA] (2022, residential "standard", stone chips) is:
- superstructure (Table 2): average ৳26,671 per sqm;
- structural member weightage (Table 3): ≈ ৳1,232;
- piles as in step 5: ৳6,545;
- sanitary and electrical: ৳3,443;
- roof treatment: ৳336.

That totals **৳3,551 per sft printed, or ৳2,894 per sft net of mark-ups**, in 2022 prices. Our
like-for-like part (civil less tanks, plus plumbing and electrical) is **≈ ৳2,445**, which is
**~15 % under PWD net**. It is further under once 2022 → 2026 price rises are allowed for.

Likely reasons:
- PWD's 11' storeys against our 10';
- PWD's own labour and carriage inside its rates;
- my labour and finish prices (Low).

**Against web figures** (low trust): the Estimate of ≈ ৳3,280 sits at the bottom of the 2026 Dhaka
"standard" ranges on developer and consultancy sites (৳3,200–4,300 per sft; conspert.com,
costnest.site).

**Conclusion.** The consumption defaults are defensible. The ৳ per sft they produce depends mostly on
labour and finish prices, which the Developer enters.

---

## For the owner to verify

**Tax (A)**
- [ ] Are Dhaka Labour Contract rates quoted **net** (VAT and AIT paid on top, a +15.79 % layer) or
  **"inclusive of VAT and tax"** (no layer)? I recommend a flag per Labour Contract, defaulting to
  net.
- [ ] Is a labour-only contractor billed per measured unit treated as **S004.00 construction firm at
  10 %** in practice, never S072.00 manpower supply at 15 %?
- [ ] Does the Developer, whose flat sales are at 2 % or 4.5 %, really get **no input credit** for VAT
  withheld on labour (VAT Act s. 46, not read)?
- [ ] AIT at 5 % on the bill **net of VAT** (practice source), and the FY 2026-27 rate confirmed from
  the TDS rules SRO for 2026 (not read).
- [ ] Market Prices are entered as the **gross** amount paid to suppliers, including any VAT or AIT the
  Developer deducts or deposits itself.
- [ ] Utility connection charges belong in the Estimate (site works and MEP); RAJUK fees, design fees,
  land, registration and sales VAT stay outside.

**Allowances (B), all Low**
- [ ] The reference building: 3,840 sft floor, 10' floor to floor, 6" slabs, 26 columns, 800 rft of
  beams per floor, 4 flats per floor, GF parking.
- [ ] Average column section 2.0 / 2.6 / 3.6 sft for G+6 / G+9 / G+14; core 25 rft of 8" wall (one
  lift) or 50 rft of 10" wall (two lifts).
- [ ] Piles: 20" × 60–70' at 110–140 kips, or 24" × 80' at 220 kips; 220 psf service load; caps
  70 / 115 cft per pile.
- [ ] Two ratios that are mine: slab on grade 1.5 kg/cft; roof stair and lift room 4.0 kg/cft.
- [ ] Walls per flat floor: 250 rft of 10" external and 700 rft of 5" internal; bricks ≈ 10 per sft
  (above the Indian 7.3).
- [ ] Ceiling plaster included (1.13 sft per sft), or zero if the Developer uses putty only.
- [ ] Windows 13 % of floor area; doors 11 per 1,000 sft at an average ৳14,000.
- [ ] Tanks at ~30 cft of RCC per flat.
- [ ] The MEP and site-works ৳ per sft defaults: plumbing 170, electrical 190, lift 105, generator 80,
  substation and connections 90, fire 50, miscellaneous 40, gas 0, site works 60.
- [ ] The basement modifiers, and whether a basement building here is on piles or a mat.
- [ ] The Market Prices and labour rates in B.4, especially stone chips at ৳180 per cft and the
  casting-area Labour Contract at ৳170 per sft.
- [ ] Beam-and-slab as the default floor type (flat plate moves beam quantities into slabs).
