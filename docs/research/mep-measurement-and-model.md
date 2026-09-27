# MEP: how Dhaka measures and prices it, and how it lives in the Live Model

Question: **how do Dhaka Developers' QSs and consultants measure and price MEP, and how should MEP
live in the Live Model as Elements with identity?** The owner has ruled that MEP (electrical, plumbing
and sanitary, fire, lifts, generator, substation, pumps, low-voltage systems, gas) is read from the
Developer's DWGs and PDFs into the Live Model as Elements and priced in the Priced BOQ, "so basically
we'll not left nothing in a Building". This reverses ADR 0003's "MEP as lump sums" and changes step 14
of ADR 0007.

Researched 28 Sep 2026 for session 02. Inputs read: `docs/intent.md`, `CONTEXT.md`, ADRs 0003, 0006,
0007, 0009, 0035 and 0037, `docs/specs/bd-defaults.md` (the MEP template), `docs/research/tax-and-allowances.md`
§B and `docs/research/component-attributes-and-classification.md`. A sibling agent studies the Edison
set's ELECTRICAL and PLUMBING DWGs; this file covers practice, pricing and modelling, and read no
drawing. Terms are `CONTEXT.md`'s; four new ones are proposed in §1.9.

**Confidence.**
- **High:** a primary source says it and I read it (a PWD schedule, the BNBC gazette, an Act or Rules
  gazette, a BIS standard, the IFC source tree, a vendor's own documentation for what its product does).
- **Medium:** plain inference or arithmetic on a primary source.
- **Low:** my judgement, my assumed quantities, or a vendor's marketing claim.

Sources are `[M#]` (listed at the end). "p. 233 / PDF 249" means printed page / PDF page. All rates
are PWD's **Dhaka and Mymensingh** zone column, **as printed** (PWD's mark-ups inside) unless marked net.

---

## 0. What is unmeasured, uncertain or blocked (read first)

1. **No Dhaka Developer's or consultant's MEP BOQ was found in public.** Two searches (English and
   Bangla) returned Indian bank tenders and interior-design pages, nothing from a Dhaka Developer. So
   "Dhaka practice" in this file is **PWD's practice** (its schedules and specifications), not a
   Developer's. How a Developer's QS actually bills MEP (per point all-in, or points plus wiring per
   metre; supply-and-fix packages or own materials) is **the owner's to confirm** (§1.10, Q1–Q3).
2. **The fire line of the step-14 template may be 3× too low for buildings of 7 storeys or more.**
   The Fire Prevention and Extinguishing Rules 2014 require, for a multi-storey residential building,
   a pump house with a 500 GPM main pump, a diesel standby pump and a jockey pump, a wet riser, and
   sprinklers in the basement and ground floor [M8, pp. 18516–18517]; the Act makes "multi-storey"
   mean **not less than 7 storeys** [M7]. Priced at PWD rates, the three pumps alone come to ≈ ৳56.7
   lakh, i.e. ≈ ৳148 per sft printed on the G+9 reference building, against the template's ৳50
   (range 30–120) (§2.6, Medium). **BNBC 2020 says the opposite for flats up to 33 m**: no fire
   detection and no fixed firefighting required [M6, Part 4 §5.3.2]. Which regime a project follows
   (the Fire Service's NOC conditions, or BNBC only) is a Question per project, not a default.
3. **The same Rules require an underground reservoir of at least 50,000 gallons and an overhead tank of
   at least 25,000 gallons** in such buildings [M8, p. 18517]. That is step 10 (Tanks), not MEP: a
   Check on the tank volumes, and a possible cause of large civil quantities the tank allowance does not
   carry. Not yet cross-checked against a real set.
4. **PWD's E/M rates are not shown net of mark-ups anywhere I read.** One item is flagged "(Without
   profit, overhead expenses and VAT)" [M2, PDF 344], which implies the others include them; the
   factor is not stated. The civil divisor 1.227 (ADR 0006) is **not verified** for E/M.
5. **The electrical Benchmark Rates I cite are 2022 rates re-issued.** Every E/M "2nd Revised" rate I
   compared is the 2022 rate × 1.0277–1.0281 (8 of 8 items, §2.3), so the E/M 2nd Revised adds no
   new market survey. Lifts are the exception: PWD's 2026 lift schedule roughly doubles 2022's lift
   prices [M4] (§2.5).
6. **The Annexure A plinth-area rates behind the template's plumbing (170) and electrical (190) lines
   are not in the 2nd Revised civil PDF** the owner gave me (it ends at chapter 33, printed p. 320 /
   PDF 336). `tax-and-allowances.md` read them from the original 2022 edition; I did not re-read them.
7. **The money split by depth level (§1.5) is my arithmetic on assumed quantities** for the G+9
   reference building (25 light and fan points and 18 sockets per flat, pipe lengths per flat, and so
   on). It shows the order of magnitude only (Low).
8. **The Distribution companies' substation rule was read only through BNBC** ("substations shall be
   required … if the load requirement of the building exceeds 50 kW" [M6, Part 8 §1.3.18.1]); DESCO's
   and DPDC's own documents were not read.
9. **Vendor accuracy figures for 2D MEP takeoff do not exist in what I read.** Glodon's GQI says
   "准确度高" (high accuracy) with no number [M13]; Countfire gives time claims, no accuracy [M17];
   Bluebeam gives none [M18].
10. **IFC 4.3 has no class or predefined type** for a ceiling fan, an earth electrode, a lightning air
    terminal or an ATS; these need `USERDEFINED` with an `ObjectType` (§5.2). IFC 4.3 **deprecates**
    `IfcElectricDistributionBoard` (use `IfcDistributionBoard`), `IfcRelServicesBuildings` and
    `IfcBuildingSystem` [M11]; a mapping written from older examples would be wrong.

---

## 1. Conclusions

### 1.1 The answer in one paragraph

PWD, the only published Bangladeshi source, bills MEP in **four kinds of line**, and each maps to a kind
of Element. **(1) Equipment, enumerated by rating** (a transformer by kVA, a generator by kVA and
origin, a pump set by HP and head, a lift by capacity, speed and stops, a fire pump by GPM and bar):
few Elements, most of the money. **(2) Terminals, enumerated** (a water closet, a basin, a socket
outlet, a switch, a sprinkler, a smoke detector, a hydrant cabinet), and **electrical "points"**, which
PWD counts per outlet but whose rate carries the wiring back to the sub-distribution board [M2, PDF
1–7]. **(3) Runs, measured per metre by size** (water pipe by diameter and material with fittings in the
rate, soil pipe, power wiring and sub-mains by cable size, fire pipe per foot). **(4) Site services,
enumerated by size** (inspection pits by clear size and depth, septic tank and soak well by users
served). IS 1200 Part XIX states the same shape for plumbing [M9]. So the Live Model needs **three
physical MEP Element Families** (equipment, terminals, runs) plus **systems and circuits as groups**,
and a "point" is **a Measurement Rule over terminal Elements**, not an Element. Codes give a QS
strong Checks: lifts above 6 storeys or 20 m, a substation above 50 kW, the fire regime by storeys or
33 m, fixtures per flat, sockets per room [M6][M3][M8]. What 2D drawings give is counts of symbols
(High readability in DWG), run lengths in plan (Medium), diameters and cable sizes from labels and
schematics (Medium), and vertical lengths from storey heights (inferred); what the Developer must
answer is scope, grade and brand, and which fire regime applies.

### 1.2 The MEP BOQ a Dhaka QS expects

Under the **Services** BOQ Section (`CONTEXT.md`), grouped as PWD groups them, with PWD's units. Site
drainage and the utility connections go to **External works**. Rates are PWD Dhaka, printed.

| Group | Typical BOQ Items | Billing Unit | PWD source and a sample rate |
|---|---|---|---|
| **Electrical: points** | Light / exhaust / bracket-fan point; fan point; call-bell point (concealed conduit, with circuit wiring to the SDB, without switch) | point | E/M 1.6.1.1 ৳1,410 [M2, PDF 6] |
| **Electrical: accessories** | Switches by gang; fan regulators; sockets 5–10 A and 13–20 A; TV, telephone, data sockets | each | 4.12.1.1 one-gang ৳590 (EU) / ৳224 (HK) / ৳155 (BD–CN); 4.11.1.1 13–20 A socket ৳969 [M2, PDF 128–129] |
| **Electrical: wiring** | Power circuit wiring and sub-mains, concealed, by cable size; riser cables; busbar trunking | m | 1.15.1.3 2×4 mm² concealed ৳416/m; 1.17.1.4 4×10 mm² NYY ৳1,506/m [M2, PDF 18, 20] |
| **Electrical: boards** | Flat SDB / SPDB by ways; floor DB (TPDB); MDB; change-over switch | each | 4.2.1 6-way SPDB ৳13,185; 4.18.1 change-over 60–100 A ৳4,168 [M2, PDF 120, 130] |
| **Earthing and lightning** | Earthing set by electrode length; earth pit; air terminal (≤ 6 storeys) or ESE (above); down conductor | set / each / m | 4.19.2 40 ft ৳30,266/set; 4.21.2 down conductor ৳1,165/m [M2, PDF 131–132] |
| **Light fittings** (if the Developer supplies them) | By type | each | Subhead 6 [M3] (not read in detail) |
| **Substation** | HT switchgear (LBS or VCB); transformer by kVA; transformer enclosure; LT switchgear; PFI; HT cable | each / m | 2.1.1.1 HT with LBS ৳4,14,271; 2.1.4.7 400 kVA transformer ৳9,53,209 [M2, PDF 41, 49] |
| **Standby generation** | Generator with ATS by kVA and origin; change-over; exhaust, fuel line | each | 2.2.2.2.8 150 kVA (China/India/BD) ৳26,95,891 [M2, PDF 96] |
| **Lifts** | Lift by type, capacity, speed: up to 3 stops + per extra stop; installation by capacity band: up to 3 stops + per stop | each / job | 2026 B2 630 kg 1 m/s ৳36,11,073 + ৳1,27,439 per stop [M4, PDF 19] |
| **Plumbing: fixtures** | WC, long pan, basin (+ pedestal), sink, urinal; cocks, mixers, showers; accessories | each | 26.01.1 WC ৳9,212; 26.13.1 basin ৳3,941; 26.35.2 shower mixer ৳7,321 [M1, pp. 233, 241, 249] |
| **Plumbing: water supply pipes** | PP-R, uPVC pressure, CPVC or GI by diameter (fittings in the rate); valves by diameter | m / each | 26.47.3 PP-R 25 mm ৳436/m; 26.42.1 GI 12.5 mm ৳453/m; 26.52.1 12 mm gate valve ৳472 [M1, pp. 251–255] |
| **Plumbing: soil, waste, vent, rainwater** | uPVC or HDPE SWV by diameter; RWP 100 mm with head and shoe; floor drains, traps, cleanouts | m / each | 26.43.2 100 mm SWV ৳906/m; 26.40 RWP ৳1,021/m; 26.28 floor drain ৳1,409 [M1, pp. 246–252] |
| **Plumbing: works in structure** | Groove cutting for concealed pipes; holes in RCC floors; hangers | m / each | 26.67.1 ৳334/m; 26.68 ৳208 each [M1, p. 259] |
| **Plumbing: tanks and pumps** | Pump sets by HP/discharge/head; float valves; tank fittings; plastic OHT | set / each | 5.3 centrifugal 5.5 HP ৳98,492–1,20,939 per set [M2, PDF 151] |
| **Fire detection and alarm** | FACP by zones or devices; smoke and heat detectors; manual call points; bells, horns, strobes; T&C | each | 14.48.1 8-zone FACP ৳88,970; smoke detector ৳3,349; MCP ৳3,559 [M2, PDF 471–472] |
| **Fire fighting** | Fire pumps (motor, engine), jockey; hydrant cabinets, landing valves, hoses; sprinklers; alarm check and zone valves; black steel pipe by diameter; extinguishers; T&C per level | each / ft | 14.3.1 500 GPM ৳20,99,729; 14.27.1 sprinkler ৳2,144; 14.11.4 100 mm pipe ৳2,421/**ft** [M2, PDF 456–466] |
| **Low-voltage systems** | CCTV cameras, NVR, switches; PABX/IP phones; data cabling and faceplates; TV; intercom | each / m | 15.2.1 NVR ৳18,916 [M2, PDF 509]; **no intercom item in PWD** (0 hits in 744 pages) |
| **Gas** | Titas riser pipe by ND; stop cocks; testing and purging; or an LPG reticulated system per set | m / each / set | 28.8.1 12 mm riser ৳328/m; 28.12.1 LPG system up to 40 flats ৳11,91,750/set [M1, pp. 288–289] |
| **External works: site services** | Inspection pits by size and depth; septic tank and soak well by users; external sewer and water lines | each / m | 26.73.1 pit with cover ৳7,214; 26.74.1 septic 200 users ৳3,39,770; 26.76.1 soak well ৳1,57,197 [M1, pp. 260–262] |

**Every PWD MEP item is "supplying, fitting and fixing"** (supply and install in one rate), so by
`CONTEXT.md`'s terms each is a **Material-and-Labour Contract** item whose materials do not enter the
Material Schedule. Whether a Developer instead buys sanitary ware, cables or pipes itself and hires
labour is Q2 (§1.10).

### 1.3 The Element Families and their identity rules (proposed)

ADR 0037 gives every Element a permanent UUIDv7; the question is what **matches** an Element to its
predecessor when a Revision arrives. The rules below follow the structural families' pattern (one
Element per storey for anything that spans storeys; the mark or tag as drawn when there is one).

| Element Family | What one Element is | Identity across Revisions (match key) | IFC 4.3 class (§5) |
|---|---|---|---|
| **MEP Equipment** | One transformer, HT or LT panel, generator, ATS, lift, pump set, fire pump, jockey pump, FACP, PFI bank, gas cylinder bank | Building + the **tag as drawn** (`TR-1`, `LIFT-2`, `FP-1`); else Building + room (plant room) + type + ordinal | `IfcTransformer`, `IfcDistributionBoard`, `IfcElectricGenerator`, `IfcTransportElement` ELEVATOR, `IfcPump`, `IfcUnitaryControlElement` ALARMPANEL (the FACP), `IfcElectricFlowStorageDevice` CAPACITORBANK |
| **Distribution Boards** | One MDB, floor DB, flat SDB/SPDB | The board **tag** from the plan or single-line diagram (`DB-3A`); else storey + flat + "SDB" | `IfcDistributionBoard` SWITCHBOARD / DISTRIBUTIONBOARD / CONSUMERUNIT |
| **MEP Terminals** | One symbol insert: a light or fan point, socket, switch, WC, basin, floor drain, sprinkler, detector, call point, hydrant cabinet, camera, data or TV outlet | Storey + room + terminal type + position (matched within a tolerance, a Rule Set parameter); a typical floor's symbols become **one Element per storey** | `IfcLightFixture`, `IfcOutlet`, `IfcSwitchingDevice`, `IfcSanitaryTerminal`, `IfcWasteTerminal`, `IfcFireSuppressionTerminal`, `IfcSensor`, `IfcAlarm`, `IfcAudioVisualAppliance` |
| **MEP Runs** | One segment of pipe, cable, conduit or tray between two nodes (fittings, terminals, boards), in one storey; a riser is one Element **per storey** | System + from-node + to-node + size (diameter or cable size); a riser by its system tag (`SP-1`, `WSR-2`) + storey | `IfcPipeSegment`, `IfcCableSegment`, `IfcCableCarrierSegment` (CONDUITSEGMENT, CABLETRAYSEGMENT) |
| **MEP Chambers** (site) | One inspection pit, manhole, septic tank, soak well, valve pit | Site + tag or position | `IfcDistributionChamberElement` (INSPECTIONPIT, MANHOLE, VALVECHAMBER); septic tank `IfcTank` or chamber, a choice to record |
| **Systems and Circuits** (groups, not physical) | One system (domestic cold water, soil, rainwater, fire protection, electrical, lightning protection, CCTV) or one switched circuit | System code or circuit id as drawn (`DB-2A/C3`) | `IfcDistributionSystem` (PredefinedType per system), `IfcDistributionCircuit` |

Two rules make identity survive typical floors and Revisions:
- **A typical-floor MEP plan produces one Element per storey per symbol**, as the structural families
  do for columns, because As built and As maintained values differ flat by flat (ADR 0035).
- **A symbol that moves beyond the tolerance, or changes type, is removed and new** in the Revision
  Comparison, never silently re-matched. The tolerance is a parameter; I have no evidence for a value
  (Low).

Scale, for the data spine: the G+9 reference building (36 flats) at ~25 points, ~18 sockets, ~12
switch plates and ~10 plumbing terminals per flat is ≈ 2,300 terminal Elements before common areas
(Low arithmetic). ADR 0037's prototype measured 1.5 M Elements; this is well inside it.

### 1.4 How a "point" maps to Elements

A **point** is a billing notion, and PWD and CPWD define it differently:
- **PWD Bangladesh** [M2, PDF 1–7]: a light, fan or bell point is the wiring from the switch board to
  the outlet, "looping at the switch board with earth terminal", **including circuit wiring (From SDB
  to Switch Board)** with 2 × 2.5 mm² cable, the conduit ("one conduit from switch board to common
  point on ceiling is considered to draw 3 pair of cable"), and the switch-board box and ebonite cover,
  **without switch**. Switches and sockets are separate items in Subhead 4 [M2, PDF 127–129]; power
  (socket) wiring and sub-mains are per metre [M2, PDF 8–20].
- **CPWD India** [M10, pp. 24–27]: circuit wiring (DB to the first switch box) and sub-mains are
  **measured per metre**; a point runs from the controlling switch to the outlet and **includes the
  switch**; socket points are measured per metre from the tapping point, with the socket paid
  separately; a group-controlled light counts each further outlet as another point; a two-way light is
  two points.

So in the Live Model: **a point is a Measurement Rule over terminal Elements**. The terminal Element
(`IfcLightFixture` for a light point, a fan terminal, `IfcAlarm` BELL for a call bell) is counted; the
switch is its own Element related to it (`IfcRelFlowControlElements`, §5.3); the circuit is an
`IfcDistributionCircuit` group. Under the **PWD default** the circuit wiring is inside the point, so
a Check must refuse to bill that same wiring again per metre (the "each item's labour paid once"
conservation of ADR 0027, applied to wiring). Under a **CPWD-style Rule Set** the same Elements give
circuit runs per metre and a point that includes the switch. Whether the light **fitting** is also
supplied is a scope attribute of the same Element, priced as a second BOQ Item (Subhead 6) when in scope.

### 1.5 Depth levels and what each gives the Priced BOQ

The step-14 template (bd-defaults, Q10) carries MEP at **৳725 per sft** of Gross Floor Area (plumbing
170, electrical 190, lift 105, generator 80, substation and connections 90, fire 50, pumps/intercom/CCTV
40; gas 0). On the G+9 reference building's direct cost of ≈ ৳2,890 per sft [`tax-and-allowances.md`
§B.4], that is **25 % of direct cost**. How that money splits by depth:

| Depth | Elements | Money it prices (template ৳/sft, and my split) | Share of MEP ৳725 |
|---|---|---|---|
| **1. Equipment** | Lifts, generator, transformer and panels, fire and water pumps, FACP, main boards, earthing sets | lift 105 + generator 80 + substation ~60 of 90 (the rest is DESCO/DPDC connection and demand charges, which are not Elements) + fire ~30 of 50 + plumbing ~30 of 170 (pumps, pits, septic tank) + electrical ~27 of 190 (boards, earthing) | **≈ 330, ≈ 45 %** (Medium for lift and generator, Low for the splits) |
| **2. Terminals and points** | Points, sockets, switches, sanitary fixtures, sprinklers, detectors, cameras | electrical ~65 of 190 (34 %) + plumbing ~66 of 170 (39 %) + fire ~10 + misc ~25 | **≈ 165, ≈ 23 %** (Low) |
| **3. Runs** | Pipes, cables, conduits, trays, risers | electrical ~99 of 190 (52 %) + plumbing ~73 of 170 (43 %) + fire pipes ~10 + misc ~15 | **≈ 195, ≈ 27 %** (Low) |
| **4. Schematics** (systems, circuits, riser and single-line diagrams) | Groups and their relations | **No money of their own**; they supply the sizes and ratings that set the rates of levels 1 and 3, and the Checks | 0 % direct |
| Not modelled | Utility connection and demand charges; gas connection | ~30 of 90, gas 0 | ≈ 5 % |

The electrical and plumbing splits are my arithmetic at PWD rates on assumed quantities (25 points,
18 sockets with 8 m of 2 × 4 mm² each, 12 switch plates, one 6-way SPDB and 20 m of 4 × 10 mm² sub-main
per flat; two toilets and a kitchen per flat; 40 m of 25 mm and 30 m of 19 mm PP-R, 20 m each of 100 mm
and 50 mm SWV per flat; common items as stated in the notes file). They give ৳139 (electrical) and
৳129 (plumbing) per sft net, against the template's 190 and 170. **Low**: the point is the shape
(equipment ≈ half, runs ≈ a quarter), not the figures.

**Two cross-checks that do hold (Medium):**
- **Lift.** One 630 kg, 1 m/s lift of PWD 2026 type B2 (the Chinese brands) for GF + 9 (10 stops):
  ৳36.11 lakh + 7 × ৳1.274 lakh = ৳45.0 lakh supply, plus installation ≈ ৳0.97 lakh + 7 × ৳0.195 lakh
  = ৳2.3 lakh [M4, PDF 19, 40]; ≈ ৳47.4 lakh = ৳123 per sft printed, ≈ ৳100 net if the civil
  divisor applies. The template's 105 holds.
- **Generator.** 150 kVA with ATS, China/India/BD origin, ৳26.96 lakh [M2, PDF 96] = ৳70 per sft
  printed, ≈ ৳57 net. The template's 80 (range 50–100) holds; it was "no source" and now has one.

**One that fails (Medium):** fire, per §0.2: ≈ ৳148 per sft printed for pumps alone under the Fire
Rules, against ৳50.

**The build order this suggests:** equipment first (≈ 45 % of MEP money in tens of Elements, mostly read
from schedules and single-line diagrams, easy to confirm), then terminals (counting symbols, what
2D takeoff tools do best, §6), then runs (the hardest to read honestly from 2D, and where PWD's point
definition already absorbs part of the electrical wiring). Until each depth is confirmed, the step
keeps its template allowance as its Cost Basis, exactly as ADR 0002 intends.

### 1.6 What can be read and what must be asked

| Fact | From a DWG | From a vector PDF | Otherwise |
|---|---|---|---|
| Terminal type and count per room and storey | **Read**: block inserts, their names and positions, matched to the sheet's legend (Glodon reads the legend table the same way, [M14] 材料表) | Read by shape matching, weaker (Bluebeam's Visual Search is a template with a sensitivity slider [M18]) | — |
| Equipment and its rating | Read from equipment schedules, single-line diagrams, riser diagrams, plant-room plans | Same, from text | **Ask** where not drawn (generator kVA, lift count and capacity are often only in the specification) |
| Run route and plan length | Read polylines on MEP layers; lengths in plan | Read vector paths, if not flattened | — |
| Diameter or cable size of a run | Read from labels on the line, riser diagrams, single-line diagrams (Glodon's multi-circuit and riser-diagram functions do this [M14]) | Same, from text | **Infer** sprinkler pipe sizes from heads served only as a flagged Proposal (Glodon does, from the Chinese code's hazard class [M14] 喷淋提量); Bangladesh has no such table in what I read |
| Vertical lengths (drops to switches and sockets, risers) | **Infer** from storey heights (step 3) and mounting heights (switch boards 1,220 mm above floor in residential buildings [M3, Subhead-1 p. 55]) | Same | — |
| Circuit membership | Read from circuit labels (`C3`) and home-run arrows | Same | **Ask** when absent; PWD's point rate does not need it |
| Grade, brand and origin (sanitary grade, cable maker, lift type, generator origin) | Rarely drawn | Rarely | **Ask**, once per project, as part of the Developer's Specification |
| Scope (light fittings, AC units, sanitary ware inside plumbing or in the Specification, water heaters) | Not drawn | Not drawn | **Ask** (Q3) |
| Fire regime (Fire Service NOC conditions or BNBC only) | Not drawn | Not drawn | **Ask** per project (§0.2) |
| Utility connection and demand charges; gas (Titas, LPG system, none) | Not drawn | Not drawn | **Ask**; they stay Lump Sums |

### 1.7 MEP Measurement Rules, drafted in Vextrus's words

Each is a candidate row of the Bangladeshi default Rule Set (ADR 0009), with its source. "PWD" means the
item's own description; "IS" means IS 1200 Part XIX [M9]; "CPWD" is offered as an alternative.
1. **Point.** Count each light, bracket-fan, exhaust-fan, ceiling-fan and call-bell outlet as one point;
   the point includes its wiring from the switch board, the switch-board box and cover, and the circuit
   wiring back to the SDB; the switch is billed separately. (PWD E/M 1.1–1.7 [M2, PDF 1–7].)
   *Alternative:* circuit wiring per metre and the switch inside the point (CPWD 3.3–3.4 [M10]).
2. **Group and two-way control.** Each further outlet on one switch is a further point; a light switched
   from two places is two points. (CPWD 3.4.6–3.4.7 [M10]; PWD is silent, so a Question the first time.)
3. **Sockets and switches.** Enumerate socket outlets by rating (5–10 A; 13–20 A) and switches by gang.
   (PWD 4.10–4.12 [M2, PDF 127–129].)
4. **Power wiring, sub-mains and feeders.** Measure per metre by cable type and size along the conduit
   or tray run, board to outlet or board to board, including vertical rises by storey height, excluding
   slack and connections inside boards. (PWD 1.8–1.19 units [M2, PDF 8–29]; CPWD 3.3.2(i) [M10].)
5. **Boards and equipment.** Enumerate by type and rating (ways, amperes, kVA, HP, GPM and bar).
   (PWD Subheads 2, 4, 5, 14 [M2].)
6. **Lifts.** Enumerate by type, capacity and speed; price supply as "up to 3 stops" plus each further
   stop, and installation as a separate job by capacity band on the same stop count. (PWD Subhead 8
   and 8.3 [M3, pp. 408–443]; [M4].)
7. **Earthing and lightning protection.** Enumerate earthing sets by electrode length and earth pits;
   the air terminal by the building's height band (up to 6 storeys, or above); down conductors per
   metre. (PWD 4.19–4.22 [M2, PDF 131–134].)
8. **Sanitary fixtures and fittings.** Enumerate, fully described (type, size band, grade). (IS 5.5;
   PWD 26.01–26.39 [M1].)
9. **Water supply pipes.** Measure per metre by nominal diameter, material and jointing, net as fixed;
   standard fittings (elbows, tees, sockets, unions) are included with the pipe; valves, stop cocks and
   meters are enumerated by diameter. (IS 3.1, 4.0–4.2 [M9]; PWD 26.42 and 26.47 include fittings [M1].)
10. **Soil, waste, vent and rainwater pipes.** Measure per metre along the centre line by diameter and
    material. *Bangladeshi default (PWD):* bends and sockets are in the pipe rate (26.40, 26.43 [M1]).
    *IS alternative:* bends, tees and branches enumerated as extra over (IS 5.2, 6.1 [M9]).
11. **Pipes by location.** Pipes in ducts, in chases, embedded in floors, or fixed to walls and ceilings
    are measured as separate items; below and above ground stated separately. (IS 2.7, 3.5 [M9].)
12. **Concealed pipework.** Chase or groove cutting is measured per metre separately; holes in RCC floors
    are enumerated. (IS 3.8 [M9]; PWD 26.67–26.68 [M1].)
13. **Short lengths.** Pipe lengths of one metre or less, other than running lengths, measured separately
    as "short length". (IS 3.9 [M9]; a parameter, off by default until a QS asks for it.)
14. **Chambers.** Enumerate inspection pits and manholes by clear size and depth band. (IS 6.2.1 [M9];
    PWD 26.70–26.73 [M1].) Septic tanks and soak wells by users served. (PWD 26.74, 26.76 [M1].)
15. **Fire protection.** Fire pipe per foot by diameter (PWD's unit); sprinklers, detectors, call points,
    hydrant units and valves enumerated; testing and commissioning per system level band. (PWD 14.x
    [M2, PDF 450–498].)
16. **Gas.** Riser and service pipe per metre by nominal diameter; stop cocks enumerated; testing and
    purging per metre; an LPG reticulated system per set, with a per-flat adjustment. (PWD 28.x [M1].)

### 1.8 Checks a QS can run on MEP (sanity, per building or per flat)

| Check | Rule | Source |
|---|---|---|
| Lift present | Required in buildings more than six storeys or 20 m high; a stretcher lift and standby power to lifts above 10 storeys or 32 m | BNBC Part 8 §4.2.1 [M6, gazette p. 4763] |
| Substation present | Required if the building's load exceeds 50 kW; rating with a load factor of at least 80 %; not in a basement | BNBC Part 8 §1.3.18 [M6, pp. 4577, 4581] |
| Transformer size | Minimum load density for multi-family dwellings 20 W/m² (non-AC), 75 W/m² (AC) × area → kVA | BNBC Table 8.1.17 [M6, p. 4547] |
| Electrical shaft and risers | Over six storeys or 20 m: at least one 200 × 400 mm electrical shaft per 1,500 m² of floor; above 9 storeys, busbar trunking preferred | BNBC §1.3.13 [M6, p. 4571]; PWD E/M spec [M3, Subhead-1 p. 56] |
| Sockets per flat | Minimum 13 A sockets: bedroom 2, living 3, drawing 3, dining 1, kitchen 1 (+1 toaster, +1 refrigerator), verandah 1, bathroom 0, one per room for AC | PWD E/M Table 4.1 [M3, Subhead-4 p. 184] |
| Fixtures per flat | At least 1 WC, 1 basin, 1 bath or shower and 1 kitchen sink per flat | BNBC Table 8.6.1 [M6, p. 4860] |
| Fire regime | ≥ 7 storeys: Fire Service regime (wet riser per 600 m² of floor, sprinklers in basement and ground floor at 1 per 9.30 m², smoke and heat detectors at 1 each per 75 m² in parking and plant areas, call point + bell + strobe per floor, 500 GPM main + diesel standby + jockey pumps); BNBC: none required for flats up to 33 m; hydrant and manual alarm at stair or lift lobbies above | Fire Act 2003 s. 2 [M7]; Fire Rules 2014 [M8, pp. 18516–18518]; BNBC Part 4 §5.3.2 [M6, p. 2932] |
| Sprinkler count | Basement + ground-floor area ÷ 9.30 m² (Fire Rules regime) | [M8, p. 18516] |
| Fire water | Underground reservoir ≥ 50,000 gal (⅔ for fire), overhead tank ≥ 25,000 gal (½ for fire); above 15 storeys a relay pump and intermediate reservoir every 26 m | [M8, p. 18517] |
| Lightning protection | The air terminal item changes above 6 storeys | PWD 4.21–4.22 [M2, PDF 132–133] |
| Money | Each MEP line's ৳/sft within the template range (bd-defaults Q10), now with PWD-based bases for lift, generator and fire | §1.5 |

### 1.9 Terms proposed for `CONTEXT.md`

- **Point**: PWD's unit of electrical wiring for one light, fan or bell outlet, counted from confirmed
  terminal Elements by a Measurement Rule; never an Element itself. *Avoid:* outlet (that is the
  Element), wiring point.
- **Run**: one segment of pipe, cable, conduit or tray between two nodes in one storey, measured per
  metre by size. *Avoid:* line, segment (IFC's), pipe (alone).
- **MEP System**: a named network (domestic water, soil, rainwater, fire protection, electrical,
  lightning protection, CCTV) grouping Equipment, Terminals and Runs. *Avoid:* service, discipline
  (a Discipline is a family of drawings).
- **Circuit**: one switched electrical circuit from a board way, grouping the terminals it feeds.
  *Avoid:* sub-circuit, loop.

### 1.10 Questions for the owner (one at a time; my recommendation first)

1. **How does your QS bill electrical: PWD's all-in point (circuit wiring inside, switch outside), or
   points plus circuit wiring per metre?** I recommend PWD's point as the default Rule Set with the CPWD
   form as a switch, because PWD is Bangladesh's only published definition and it needs no circuit
   routing to price.
2. **Are MEP items Material-and-Labour Contracts by default, or does the Developer buy sanitary ware,
   cables and pipes itself?** I recommend Material-and-Labour by default (PWD's items are all supply and
   fix), with a per-trade switch, because it keeps MEP out of the Material Schedule until a Developer says
   otherwise.
3. **What is in the Developer's MEP scope: light fittings, AC units, water heaters, sanitary ware in
   plumbing or in the Specification?** I recommend fittings and AC units out by default and sanitary
   ware in plumbing, because that matches the current template and the Specification rule of
   bd-defaults.
4. **For buildings of 7 storeys or more, do your projects carry the Fire Service NOC set (500 GPM pumps,
   sprinklers in basement and ground floor, 50,000-gallon reservoir)?** I recommend asking it per
   project as a Question and making the fire allowance storey-dependent, because the template's ৳50 is
   a third of what the Rules imply.
5. **Build order: equipment, then terminals, then runs?** I recommend it, because equipment is about
   half the MEP money in a few tens of Elements, and runs are the least reliable from 2D.

---

## 2. PWD's MEP schedules: what exists, units, and rates

### 2.1 The editions (read 28 Sep 2026)

PWD's download page lists nine books [M5]: the 2022 Civil, E/M and Retrofitting books; their Revised
and 2nd Revised editions (the E/M "Revised" is Subhead 8 only); and **"PWD Schedule Of Rates 2026, Part
B: Electro-mechanical Works, Subhead 8: Lift & Escalator"** [M4]. So:
- **Civil (plumbing, sanitary, gas):** 2022 2nd Revised [M1], chapters 26 (Sanitary and water supply,
  printed pp. 233–263 / PDF 249–279), 27 (Deep tube-well), 28 (Gas connection, pp. 286–289 / PDF
  302–305). High.
- **E/M (electrical, substation, generator, pumps, fire, CCTV, PABX):** 2022 2nd Revised [M2], one
  744-page PDF with a text layer, last modified 17 May 2026 (PDF metadata); its page header still reads
  "PWD SoR 2022 For E/M Works"; it has no Subhead 8. The original 2022 E/M is published per subhead as
  scanned PDFs [M3]; I read its Subheads 1, 2.1, 2.2, 4 and 8 as images. High.
- **Lifts:** the 2026 Subhead 8 [M4], signed on 26 Apr 2026 (dates beside the signatures, PDF 49). High.

### 2.2 Plumbing, sanitary and gas (civil chapter 26 and 28)

What each family of items includes, in PWD's words [M1] (High; rates in §1.2):
- **Fixtures** (26.01–26.39) are "supplying, fitting and fixing" including "making holes wherever
  required and mending good the damages", with the connection pieces named per item (26.05's urinal
  includes its 32 mm waste pipe and 12 mm stop cock). WCs come in eight size and weight bands from
  ৳9,212 to ৳25,512 (26.01.1–26.01.8, pp. 233–234); a Developer's grade picks a band.
- **GI water pipe** (26.42) includes "all special fittings, such as bends, elbows, sockets, reducing
  sockets, Tee, unions, jam-nuts" and trenching where needed (p. 251). **PP-R** (26.47) includes
  "nipple, elbow, reducers, Tee, end cap, plug, socket" (p. 253). **uPVC SWV** (26.43) is fixed "with
  sockets, bends … with all accessories" (p. 252). So PWD's pipe rates **carry their fittings**, unlike
  IS 1200's extra-over rule for soil pipes (§4.1).
- **Rainwater pipe** (26.40) is 100 mm uPVC "with head and shoes, bends, … F.I. Bar clamp" and roof
  grating, per metre (p. 250).
- **Valves** (26.49–26.57) are enumerated by diameter from 12 to 100 mm (pp. 254–257).
- **Works in the structure**: groove cutting per metre by groove size (26.67) and holes in RCC floors
  each (26.68) (p. 259).
- **Site**: inspection pits by clear size and depth (26.70, 26.73; pp. 259–261), septic tanks by users
  served (26.74: 10 to 200 users, ৳67,966 to ৳3,39,770), soak wells by users (26.76), each including
  its excavation, brickwork, RCC and reinforcement (pp. 261–262).
- **Gas** (chapter 28): Titas service pipe per metre by nominal diameter (28.1: 100 mm ৳4,250 to 20 mm
  ৳685, p. 286), butt welds and fittings each, valve pit each (28.6: ৳1,28,635, p. 287), domestic riser pipe
  per metre excluding welding and fittings (28.8), testing and purging per metre (28.11: ৳30), and, new
  in this schedule, a **complete LP gas reticulated system for high-rise buildings** "(Up to 40 unit 20
  storied)" per set (28.12.1: ৳11,91,750), less ৳10,000 per flat below 40 and plus ৳9,458 per flat up
  to 100 (28.12.2–3), and a prepaid meter per flat (28.13: ৳25,222) (pp. 288–289). This gives the
  template's gas line (0, range 0–17) a priced basis where a Developer installs LPG: ≈ ৳33,000 per flat
  plus a meter (Medium).

### 2.3 Electrical (E/M Subheads 1 and 4)

- **Point wiring** is priced in seven forms by installation (channel, surface conduit, concealed
  conduit) and cable (BYM, BYA, FR, zero-halogen), each for light/fan points and call-bell points, and
  each in two cable-origin tiers ("Eastern cables" or another maker with a type-test certificate)
  [M2, PDF 1–7]. The concealed BYM form (1.6) is the residential norm in my reading, not verified.
- **Wiring per metre** (1.8–1.19) is priced by installation and cable: e.g. concealed BYM 2 × 1.5 mm²
  ৳230/m to 2 × 16 mm² ৳1,179/m (1.15, PDF 18); concealed 4-core NYY 4 × 2.5 mm² ৳617/m to 4 × 16 mm²
  ৳2,145/m (1.17, PDF 20); HT XLPE cable (1.20, PDF 32).
- **The specification annexure** [M3, Subhead-1 pp. 55–56] defines circuit wiring ("Wiring between a
  switch board and a BDB/SDB/DB will be called Circuit Wiring … also referred to as sub-circuit"),
  keeps socket circuits apart from light and fan circuits, fixes switch-board height at 1,220 mm above
  floor in residential buildings, and sets minimum cable sizes by breaker (5 A 1.5 mm²; 10 A 2.5 mm²;
  15 A 4 mm²; 20 A 6 mm²).
- **Boards and accessories** [M2, PDF 119–141]: SDBs and SPDBs by ways, TPDBs, MCBs and MCCBs, busbar
  and busbar trunking, sockets and switches by origin tier, TV/telephone/data sockets, change-over
  switches, earthing sets by electrode length (4.19: ৳25,474 at 20 ft to ৳52,966 at 120 ft), earth pits
  (4.20), lightning arresters up to 6 storeys (4.21) and early-streamer arresters above (4.22), cable
  trays and ladders (4.33–4.34).
- **Re-issue factor.** The 2nd Revised rate / the 2022 rate: point 1,410 / 1,372; HT LBS panel
  4,14,271 / 4,03,085; transformers 250, 315 and 400 kVA 6,67,550 / 6,49,526, 7,68,892 / 7,48,131,
  9,53,209 / 9,27,472; generator 100 kVA 23,74,775 / 23,10,655; earthing 25,474 / 24,786; socket 1,096
  / 1,066. All between 1.0277 and 1.0281 (Medium: a uniform uplift, most likely the VAT change the civil
  preface names).

### 2.4 Substation, generator, pumps, fire and low-voltage (E/M Subheads 2, 5, 14, 15, 17)

- **Substation** [M2, PDF 40–90]: HT switchgear with LBS (2.1.1.1, ৳4,14,271) or VCB; 11/0.415 kV
  transformers by kVA (250 kVA ৳6,67,550; 315 kVA ৳7,68,892; 400 kVA ৳9,53,209; PDF 48–49); dry-type
  enclosures by kVA band; LT switchgear; PFI panels. The CT ratio table ties HT panel choice to
  transformer size (100–150 kVA 10/5 … 500 kVA 30/5) [M3, Subhead-2.1 p. 62].
- **Generator** [M2, PDF 91–107]: "Three phase generator with ATS (without canopy)" by kVA from 10 to 500,
  in two origin tiers (USA/UK/Japan/EU, and China/India/Bangladesh/South Asia), the ATS inside the item
  (the 2022 text: "auto start and auto charge over [sic] to load within 10 sec during normal power
  failure" [M3, Subhead-2.2 p. 130]). 150 kVA: ৳30,14,025 and ৳26,95,891 (PDF 95–96).
- **Pumps** [M2, PDF 149–171]: centrifugal "reservoir to overhead tank" sets by HP, discharge, head and
  pipe sizes (5.3, PDF 151); submersible sets "for above 16 storied building" (5.7); sewage pumps (5.9).
- **Fire** [M2, PDF 450–498]: extinguishers; engine- and motor-driven fire pumps by GPM and bar (500 GPM
  at 9 bar: ৳33,59,566 engine, ৳20,99,729 motor); jockey pumps; fire-brigade connections; hydrant units
  and cabinets; **black steel Schedule 40 pipe per foot** (14.11: 100 mm ৳2,421/ft, 50 mm ৳744/ft); valves;
  sprinklers (pendent ৳2,144, upright ৳1,955); alarm check, pressure-reducing and zone valves; clean-agent
  gas suppression; conventional FACPs by zones and addressable FACPs by device count; detectors, call
  points, bells, horns, strobes (PDF 472); testing and commissioning per level band (14.47: levels 1–6
  ৳31,527, each further floor ৳6,305).
- **CCTV** (Subhead 15, PDF 499–569): IP cameras by type, NVRs by channels (15.2.1 ৳18,916), PoE switches.
  **PABX and data** (Subhead 17, PDF 599–661): IP-PABX, phones, MDF/SDF, Cat-6 cable and faceplates.
  **No apartment intercom item** in the 744 pages (text search, 0 hits), although Dhaka flats commonly
  have one (my observation, Low).

### 2.5 Lifts: the 2022 and 2026 schedules

- **2022** [M3, Subhead 8]: "Supply of following lift complete with …" by brand type A (KONE, Mitsubishi,
  OTIS, Schindler, TKE, Fujitec, Hitachi, made in their home countries), B (Wittur, Orona, MacPuarsa, Movi),
  C (the type-A brands' Chinese and South Korean plants) and D (Chinese, Malaysian, Thai and Indian makers
  and plants, e.g. Fuji HD, Sigma, XIZI), each by capacity and speed as
  "Upto 3-stop Price" plus "Next per stop". 630 kg, 1 m/s: A ৳48,85,511 + ৳1,88,197 (p. 408); B ৳33,43,546
  + ৳1,33,345 (p. 413); D ৳19,94,988 + ৳70,406 (p. 423). **Installation is a separate item** (8.3): 630–1000
  kg ৳94,715 up to 3 stops, ৳19,004 per stop to 10 stops, ৳20,904 per stop from 11 (p. 443). High.
- **2026** [M4]: brand types A1, A2 (the same brands made in China, Thailand, South Korea), B1, B2 (the
  former D brands) and **C (Walton, Property)** (Table 8.8, PDF 49). 630 kg, 1 m/s: B1 ৳67,13,211 +
  ৳2,56,686 per stop (PDF 15); B2 ৳36,11,073 + ৳1,27,439 per stop (PDF 19). Installation 630–1000 kg
  ≈ ৳97,34x up to 3 stops + ≈ ৳19,531 per stop (read from the OCR text of PDF 40, digits partly garbled;
  Medium). **B2 in 2026 is 81 % above D in 2022** for the same lift.
- For the Live Model: a lift is one MEP Equipment Element with capacity, speed, stops and brand type as
  its figure-feeding Attributes; its BOQ Items are "supply" and "installation", both computed from the
  stop count, which the Takeoff already knows from the storeys the lift core serves (step 6).

### 2.6 The fire arithmetic behind §0.2 (Medium)

For the G+9 reference building (10 storeys, so "multi-storey" under the Act; about 30 m, so under BNBC's
33 m): the Fire Rules' pump house is one 500 GPM main pump, one diesel standby and one jockey pump
[M8, p. 18517]. At PWD rates: motor-driven 500 GPM 9 bar ৳20,99,729 (14.3.1) + engine-driven ৳33,59,566
(14.2.1) + jockey 20 GPM ৳2,14,387 (14.4.1) = **৳56.7 lakh**, ÷ 38,400 sft = ৳148 per sft printed, before
risers, sprinklers (a 3,840 sft ground floor ÷ 100 sft per head ≈ 38 heads), detectors, alarms and the
50,000-gallon reservoir. If the building follows BNBC only, the fire line is extinguishers and little
else. The template's single ৳50 fits neither case.

---

## 3. Codes that drive MEP quantities

### 3.1 BNBC 2020 (Bangladesh Gazette, Extraordinary, 11 Feb 2021) [M6]

Read from the gazette copy; each page carries the gazette page number, cited here.
- **Definitions.** "High rise building: any building which is more than 10-storey or 33 m high from
  reference datum", appurtenances such as the overhead tank and machine room excluded (Part 1, p. 2588;
  Part 3, p. 2625). "Point (in wiring): a termination of the fixed wiring intended for the connection of
  current using equipment e.g., a Light, a fan, an exhaust fan" (Part 8, p. 4516). "Sub circuit, final
  circuit: an outgoing circuit connected to one way of a distribution board …" (p. 4513).
- **Fire (Part 4).** Chapter 5 is performance-based. For **A3, flats and apartments**: "(a) Up to 33 m
  height fire detection and fixed firefighting arrangement shall not be required. (b) No protection is
  required within the dwelling units of high rise flats and apartments; manual alarm system and fixed
  hydrant system shall be provided in the landings of fire stairs or in the lift lobby" (§5.3.2,
  p. 2932). A fire protection plan is required for buildings of 33 m and above and for A3 buildings with
  30 or more dwelling units (§5.1.6, p. 2930). Chapter 4 gives standpipe, wet riser, fire pump and
  sprinkler design rules (PDF 322–344), which I did not extract in detail.
- **Electrical (Part 8 Ch. 1).** Symbols for electrical drawings (Table 8.1.15, pp. 4542–4544: a candidate
  default legend for the Drafting Profile); estimated loads per fitting (Table 8.1.16: 15 A socket 1,500 W,
  5 A socket 300 W, ceiling fan 100 W, 12,000 BTU/h split AC 1,300 W; pp. 4545–4546); minimum load densities
  (Table 8.1.17, p. 4547); the electrical shaft rule (§1.3.13, p. 4571); the substation rule (§1.3.18,
  p. 4577) and "The 11 kV/0.4 kV substation shall not be placed in a basement" (p. 4581); standby supply
  (§1.3.19, p. 4581).
- **Lifts (Part 8 Ch. 4).** "Lifts shall be provided in buildings more than six storeys or 20 m in height";
  a stretcher lift and standby power for one or more lifts above ten storeys or 32 m (§4.2.1, p. 4763).
- **Water and drainage (Part 8 Ch. 5–7).** Domestic consumption by flat size (Table 8.5.1(a), p. 4815:
  e.g. a flat over 2,500 sft 200/150 lpcd; a moderate flat under 2,000 sft 180/135 lpcd), fixture units,
  pipe sizes, hanger spacing; minimum fixtures per dwelling (Table 8.6.1, p. 4860); rainwater management
  (Ch. 7). **Fuel gas** is Ch. 8 (from PDF 2346), not read.

### 3.2 The Fire Prevention and Extinguishing Act 2003 and Rules 2014 [M7][M8]

- The Act defines "বহুতল ভবন" (multi-storey building) as "অন্যুন ৭ তলাবিশিষ্ট ভবন", a building of **not
  less than 7 storeys** (s. 2(জ)) [M7]; section 7 puts the plan of a multi-storey or commercial building
  under the Director General's approval.
- The Rules (SRO 230-Ain/2014, Gazette 18 Sep 2014) set, for multi-storey "A" class buildings (A-1
  houses, **A-2 flats and apartments**, A-3 hostels, A-5 hotels), what the fire-fighting floor plan must
  show [M8, pp. 18516–18518], in Bangla; my translation of the parts a QS counts:
  - **Wet riser**: one riser per 600 m² of floor per storey, one more for any excess; at each riser point
    a landing valve with a 3-bar pressure-reducing valve and a 38 mm × 30 m hose with nozzle, in a
    20″ × 20″ glazed box.
  - **Automatic sprinklers**: in the **basement and ground floor**, one upright head per 9.30 m² (not more
    than 100 sft), naming the parking, driveway, substation, generator room, AC plant room and water
    treatment plant; at most 40 heads per floor per zone.
  - **Water**: an underground reservoir of at least 50,000 gallons, two-thirds kept for fire; an overhead
    tank of at least 25,000 gallons, half kept for fire; above 15 storeys, a relay pump and intermediate
    reservoir every 26 m.
  - **Pump house**: at least one 500 GPM main pump, one diesel standby pump and one jockey pump, with
    automatic change-over to the standby generator.
  - **Detection**: for A-1, A-2 and A-3, one smoke and one heat detector per 75 m² in the basement and
    ground-floor ramps, driveway, parking, substation, pump house, generator room, enclosed stairs, fire
    command station and drop-off; smoke detectors in flats "may be" installed.
  - **Alarm**: a manual call point with alarm bell and strobe at each floor's corridor or outside the stair
    or lift lobby; **emergency lights** in stairs, corridors, lobbies, plant rooms and parking.
- An amendment proposal to the Rules exists on district Fire Service sites (search result, not read).
  Which version a project's NOC follows is part of Q4. High for the text; the translation is mine.

### 3.3 What a QS needs from the codes

The Checks of §1.8. None of the codes gives MEP quantities per sft; they give **triggers** (storeys,
height, load) and **densities** (per 600 m², per 75 m², per 9.30 m², per flat, per room), which is what
a Check needs.

---

## 4. Measurement rules that exist for MEP

### 4.1 IS 1200 Part XIX: water supply, plumbing and drains (1981, reaffirmed) [M9]

Nine pages; the clauses that matter (High):
- General: work measured "net as fixed, to the nearest 0.01 metre" (2.4); below and above ground stated
  separately (2.7).
- Pipes "classified according to their nominal diameter, kind of material, quality and the method of
  jointing and … measured in running metres" (3.1), including cutting and waste (3.1.1); a fitting of
  unequal diameter designated by its largest (3.2); testing included in the item (3.3); pipes "laid or
  fixed in ducts, chases, trenches, embedded in floor, fixed to walls, ceilings, etc … measured
  separately" (3.5); cutting through walls and floors included, "however, not … concealed pipe work in
  which case the cutting of chase and making good shall be measured separately in running metres" (3.8);
  lengths of one metre or less measured separately as "short length" (3.9).
- Water supply: standard fittings (elbows, bends, tees, connectors, unions, diminishing sockets)
  "included along with the pipes"; caps and plugs enumerated; sluice valves, hydrants, stop-cocks and
  water meters enumerated by diameter; the main connection enumerated; cisterns enumerated by type and
  size (cl. 4).
- Plumbing: taps, valves, traps, gratings enumerated; bends, tees, branches and access doors for soil and
  waste pipes "enumerated as extra over"; sanitary appliances enumerated and fully described (cl. 5).
- Drains: pipes per metre "along the central line of the pipes and fittings", fittings enumerated extra
  over (6.1), or measured between fittings with fittings enumerated (6.1.1); manholes and inspection
  chambers measured in detail, or enumerated in depth bands of half a metre, then one metre (6.2.1).
- Laying of water and sewer lines is Part XVI (1979), cited by Part XIX; not read.

### 4.2 Electrical: no IS 1200 part; CPWD's and PWD's own notes

IS 1200 has no electrical part in what I found; the Indian rule is CPWD's General Specifications for
Electrical Works, Part I Internal [M10] (the 2013 edition; the 2023 edition's URL refused the connection).
Its clauses 3.3–3.4 (pp. 24–27) are summarised in §1.4. PWD Bangladesh's rules are in its item
descriptions and its specification annexure (§2.3). BNBC Part 8 defines "point" but says nothing on
measurement. So Vextrus's electrical Measurement Rules must be written from PWD's items with CPWD as the
alternative (§1.7).

### 4.3 How Glodon's GQI turns rules into settings (vendor documentation, High for what it says)

GQI's calculation settings are per discipline (给排水, 电气, 消防 …). For electrical, the settings include
whether to add reserve lengths where a cable meets a luminaire, switch or socket ("为了响应广西定额而特殊增加",
added to meet the Guangxi quota), whether cables attract a height surcharge, and sleeves for trays and
conduits [M14, 计算设置-电气]. This is the same idea as Vextrus's Rule Set parameters.

---

## 5. The model: IFC 4.3 and COBie

### 5.1 Sources

IFC 4.3 from the source repository that builds the documentation, branch `ifc4.3-main` at commit
`6754caa287` (24 Sep 2026), the same commit `component-attributes-and-classification.md` read [M11]:
enumerations from `docs/schemas/**/Types/*Enum.md`, property sets from `reference_schemas/psd/*.xml`,
entity text from `Entities/*.md`. Property and quantity sets per class from buildingSMART's bSDD API
(IFC 4.3 dictionary) [M12], which rate-limits (HTTP 429) and needed back-off. High.

### 5.2 Classes and predefined types for Dhaka MEP

| Our Element | IFC 4.3 class (parent) | Predefined types that fit | Key sets |
|---|---|---|---|
| Light point / luminaire | `IfcLightFixture` (`IfcFlowTerminal`) | POINTSOURCE, DIRECTIONSOURCE, SECURITYLIGHTING | `Pset_LightFixtureTypeCommon` (NumberOfSources, TotalWattage, LightFixtureMountingType…); `Pset_LightFixtureTypeSecurityLighting` (emergency lights: SelfTestFunction, BackupSupplySystem, PictogramEscapeDirection) |
| Ceiling / exhaust fan | `IfcFan` or `IfcElectricAppliance` | **none fits**: IfcFan's types are HVAC fans (CENTRIFUGAL…, PROPELLORAXIAL); use USERDEFINED `CEILINGFAN` | — |
| Socket, TV, data, telephone outlet | `IfcOutlet` (`IfcFlowTerminal`) | POWEROUTLET, AUDIOVISUALOUTLET, DATAOUTLET, TELEPHONEOUTLET, COMMUNICATIONSOUTLET | `Pset_OutletTypeCommon` (IsPluggableOutlet, NumberOfSockets) |
| Switch, fan regulator | `IfcSwitchingDevice` (`IfcFlowController`) | TOGGLESWITCH, DIMMERSWITCH | `Pset_SwitchingDeviceTypeCommon` (NumberOfGangs, SwitchFunction…); `Pset_SwitchingDeviceTypeToggleSwitch` |
| MCB, MCCB, RCCB | `IfcProtectiveDevice` | CIRCUITBREAKER, RESIDUALCURRENTCIRCUITBREAKER, EARTHLEAKAGECIRCUITBREAKER | `Pset_ProtectiveDeviceTypeCircuitBreaker` |
| SDB, DB, MDB, LT panel, HT panel | `IfcDistributionBoard` (`IfcFlowController`) | CONSUMERUNIT, DISTRIBUTIONBOARD, SWITCHBOARD, MOTORCONTROLCENTRE | `Pset_DistributionBoardOccurrence` (IsMain); `Qto_DistributionBoardBaseQuantities` (NumberOfCircuits). **Not** `IfcElectricDistributionBoard`, deprecated in IFC4.3.0.0 |
| ATS, change-over | `IfcSwitchingDevice` | **none**: USERDEFINED `ATS` | — |
| Transformer | `IfcTransformer` (`IfcEnergyConversionDevice`) | VOLTAGE | `Pset_TransformerTypeCommon` (PrimaryVoltage, SecondaryVoltage, MaximumApparentPower, TransformerVectorGroup…) |
| Generator | `IfcElectricGenerator` | ENGINEGENERATOR | `Pset_ElectricGeneratorTypeCommon` (MaximumPowerOutput…) |
| PFI, IPS/UPS | `IfcElectricFlowStorageDevice` | CAPACITORBANK, UPS | `Pset_ElectricFlowStorageDeviceTypeCommon` |
| Cable, busbar, earthing conductor | `IfcCableSegment` (`IfcFlowSegment`) | CABLESEGMENT, BUSBARSEGMENT, CONDUCTORSEGMENT | `Qto_CableSegmentBaseQuantities` (Length, CrossSectionArea…); `Pset_CableSegmentTypeEarthingConductor` |
| Conduit, tray, ladder, trunking | `IfcCableCarrierSegment` | CONDUITSEGMENT, CABLETRAYSEGMENT, CABLELADDERSEGMENT, CABLETRUNKINGSEGMENT | `Qto_CableCarrierSegmentBaseQuantities` (Length…) |
| Switch box, pull box | `IfcJunctionBox` (`IfcFlowFitting`) | POWER, DATA | `Pset_JunctionBoxTypeCommon` (NumberOfGangs…) |
| Earth electrode, lightning air terminal | — | **no class or type**: USERDEFINED (e.g. `IfcDiscreteAccessory`); IFC has only properties such as `HasLightningRod` | — |
| WC, basin, sink, shower, urinal, cistern | `IfcSanitaryTerminal` | TOILETPAN, WASHHANDBASIN, SINK, SHOWER, URINAL, CISTERN, BATH, BIDET, WCSEAT | `Pset_SanitaryTerminalTypeCommon`; `…ToiletPan` (ToiletType, PanMounting); `…WashHandBasin` (Mounting, DrainSize) |
| Floor drain, trap, gully, roof drain | `IfcWasteTerminal` | FLOORTRAP, FLOORWASTE, GULLYTRAP, ROOFDRAIN, WASTETRAP | `Pset_WasteTerminalTypeCommon` |
| Tap, stop cock, valve | `IfcValve` (`IfcFlowController`) | FAUCET, STOPCOCK, ISOLATING, CHECK, PRESSUREREDUCING, DRAWOFFCOCK, GASCOCK | `Pset_ValveTypeCommon` (Size, WorkingPressure…) |
| Pipe | `IfcPipeSegment` (`IfcFlowSegment`) | RIGIDSEGMENT, FLEXIBLESEGMENT, GUTTER | `Pset_PipeSegmentTypeCommon` (NominalDiameter, InnerDiameter, OuterDiameter…); `Qto_PipeSegmentBaseQuantities` (Length, GrossWeight…) |
| Pipe fitting | `IfcPipeFitting` | BEND, JUNCTION, TRANSITION, CONNECTOR | `Qto_PipeFittingBaseQuantities` |
| Pump set, fire pump, jockey | `IfcPump` (`IfcFlowMovingDevice`) | ENDSUCTION, SPLITCASE, SUBMERSIBLEPUMP, SUMPPUMP, VERTICALINLINE | `Pset_PumpTypeCommon` (FlowRateRange, ConnectionSize…) |
| Plastic tank, cistern | `IfcTank` (`IfcFlowStorageDevice`) | STORAGE, BREAKPRESSURE, EXPANSION | `Pset_TankTypeCommon` (TankNominalCapacity…) |
| Inspection pit, manhole, valve pit | `IfcDistributionChamberElement` | INSPECTIONPIT, INSPECTIONCHAMBER, MANHOLE, VALVECHAMBER, SUMP | `Qto_DistributionChamberElementBaseQuantities` (Depth, GrossVolume…) |
| Water, energy, gas meter | `IfcFlowMeter` | WATERMETER, ENERGYMETER, GASMETER | `Pset_FlowMeterTypeCommon` |
| Sprinkler, hydrant, hose reel, fire brigade inlet | `IfcFireSuppressionTerminal` | SPRINKLER, FIREHYDRANT, HOSEREEL, BREECHINGINLET | `Pset_FireSuppressionTerminalTypeSprinkler` (ConnectionSize, CoverageArea); `…FireHydrant` (PressureRating) |
| Smoke and heat detector | `IfcSensor` (`IfcDistributionControlElement`) | SMOKESENSOR, HEATSENSOR, FIRESENSOR, GASSENSOR | `Pset_SensorTypeCommon` |
| Call point, bell, siren, strobe | `IfcAlarm` | BREAKGLASSBUTTON, MANUALPULLBOX, BELL, SIREN, LIGHT | `Pset_AlarmTypeCommon` (AlarmCondition) |
| Fire alarm control panel (FACP) | `IfcUnitaryControlElement` | ALARMPANEL | — |
| CCTV camera, intercom handset, speaker | `IfcAudioVisualAppliance` | CAMERA, COMMUNICATIONTERMINAL, SPEAKER | `Pset_AudioVisualApplianceTypeCommon` |
| Network switch, router, PABX | `IfcCommunicationsAppliance` | NETWORKAPPLIANCE, ROUTER, TELEPHONYEXCHANGE | — |
| Lift | `IfcTransportElement` (`IfcTransportationDevice`) | ELEVATOR | `Pset_TransportElementCommon` (CapacityPeople, CapacityWeight, FireExit); `Pset_TransportElementElevator` (FireFightingLift, ClearWidth, ClearDepth, ClearHeight) |
| Gas burner (hob) | `IfcBurner` | — | `Pset_BurnerTypeCommon` (EnergySource) |

Notes (High): bSDD lists `Pset_ElectricalDeviceCommon` on every class above, pipes included, because the
set applies to `IfcDistributionElement` (psd file); it is meaningless on a pipe. The psd files of the same
commit still name `IfcElectricDistributionBoard` as the board sets' applicable class, although the entity
page deprecates it; a CI check against the dictionary (as the sibling doc advised) will meet this.

### 5.3 Systems, circuits and "what feeds what"

- `IfcDistributionSystem` (PredefinedType from 51 values, USERDEFINED and NOTDEFINED included: DOMESTICCOLDWATER, DRAINAGE, SEWAGE, RAINWATER,
  VENT, FIREPROTECTION, ELECTRICAL, LIGHTING, EARTHING, LIGHTNINGPROTECTION, POWERGENERATION, GAS, DATA,
  TELEPHONE, TV, SECURITY, CONVEYING…) groups elements through `IfcRelAssignsToGroup` and may aggregate
  sub-systems [M11, IfcDistributionSystem, IfcDistributionSystemEnum].
- "_IfcDistributionSystem_ with PredefinedType 'ELECTRICAL' should be used for overall power systems, and
  _IfcDistributionCircuit_ with PredefinedType 'ELECTRICAL' should be used for each switched circuit";
  each device whose operation depends on the circuit is assigned to it by `IfcRelAssignsToGroup`; the
  circuit is assigned to the port of the controller it originates from (`IfcRelAssignsToProduct`)
  [M11, IfcDistributionCircuit]. That is exactly the Circuit of §1.9.
- A switch controlling a light is `IfcRelFlowControlElements` ("an actuator operating a valve, damper, or
  switch", "the control element(s) sense or control some aspect of the flow element") [M11].
- Which building a system serves: `IfcRelServicesBuildings` is **deprecated** in 4.3 in favour of
  `IfcRelReferencedInSpatialStructure` [M11].
- Physical connectivity (pipe to fitting to terminal) is by `IfcDistributionPort` and `IfcRelConnectsPorts`;
  Vextrus need not hold ports in the MVP, but a Run's from-node and to-node (§1.3) are the same fact.

### 5.4 As maintained: what facility management keeps for MEP

MEP equipment and terminals are what COBie calls maintainable assets ("mechanical equipment, electrical
equipment, plumbing fixtures, and other items that require maintenance, upkeep, and replacement"), and a
column is not; COBie's Type fields (manufacturer, model, warranty durations for parts and labour, and in
COBie 2.4 expected life and replacement cost), Component fields (serial number, installation date,
warranty start, tag, bar code, space) and Jobs (preventive maintenance tasks with frequency) are filled at
construction and handover, never at design (`component-attributes-and-classification.md` §4, from
NIBS's COBie V3 and NBIMS-US V3 §4.2). Every MEP class above carries IFC's `Pset_Warranty`,
`Pset_ServiceLife`, `Pset_ManufacturerTypeInformation`, `Pset_ManufacturerOccurrence`,
`Pset_InstallationOccurrence`, `Pset_MaintenanceStrategy` and `Pset_Condition` [M12, e.g.
IfcLightFixture]. So:
- **As designed** (the Takeoff) fills the type, rating, location, tag and system of each MEP Element.
- **As built and As maintained** Records fill make, model, serial number, installation and warranty dates,
  expected life and maintenance jobs (ADR 0037's Records). For a Dhaka building the high-value assets are
  few: lifts, generator, transformer and panels, pumps, fire pumps, FACP. That is where after-sales starts.
- IFC's `Tag` attribute on every element [M12, "Attributes": Tag] is the natural home of the drawn tag
  that §1.3 uses for identity.

---

## 6. What competitors do (documented facts; vendor claims marked)

- **Glodon GQI (China, "BIM安装计量", GQI2026)** [M13]: covers electrical, fire, low-voltage (弱电), water
  supply and drainage, heating, air conditioning and industrial pipes; imports CAD, PDF, MagiCAD, Tianzheng
  and photographs; "智能识别构件、设备，准确度高" (smart recognition of elements and devices, high accuracy:
  **vendor claim, no figure**); water pipes recognised "AI一键" with system, diameter and elevation; a whole
  building's devices taken off in one action; wiring routed by system along trays by shortest path across
  floors; many circuits of one or more boards recognised at once; a whole drawing's sprinkler pipes
  recognised at once with groove couplings generated; built-in bill and quota libraries.
- **How GQI does it, from its 2021 manual** [M14] (High for what the manual says):
  - **Legend table first** (材料表): box-select the drawing's material or legend table, edit names,
    elevations and component types, and the components are created before any symbol is recognised.
  - **Point devices** (点式设备一键提量): screens out irrelevant CAD blocks; counts one legend drawn at
    different sizes as one component; classes results as "优选设备" (known) or "未知设备" (unknown devices
    the user must name); runs over several sub-projects at once.
  - **Circuits** (多回路): reads two drafting styles, conduit and wire specification on each circuit line
    with wire counts per segment, or circuit information written on the line; the user selects the lines
    and labels and the software proposes board, circuit number and wire count.
  - **Single-line diagrams** (电系统图): reads each board's name and size and its schematic, row by row,
    into circuit components, then builds a distribution tree from the loads at the circuit ends.
  - **Water risers** (水系统图): reads a riser diagram's elevations, diameters and system numbers into a
    tree of risers, then places them at the riser marks on the plans.
  - **Sprinklers** (喷淋提量): user sets material, elevation and the hazard class; diameters are taken from
    the drawing's labels first, else inferred from the number of heads served per the code; a zone runs
    from the flow indicator to the end test valve.
  - **Missing-quantity check** (漏量检查): lists every legend not yet recognised per floor, and every pipe
    not connected to a device or not joined end to end, and jumps to it; the manual names the classic
    miss: "两种规格的吸顶灯，图例一致，但大小不一样" (two ceiling-light specifications with the same
    symbol at different sizes). This is Vextrus's Coverage idea applied to MEP.
- **Glodon TMEC / Cubicost TME** (export) [M15][M16]: "fast identification, accurate modeling and flexible
  quantification", "built-in standardized calculation rules", "batch calculation of pipelines and devices",
  and "find the uncalculated quantities quickly" (vendor page; no figures). cubicost.com now redirects to
  glodon.com.
- **Countfire (UK)** [M17]: "With a single selection, automatically detect and count symbols and text
  references across multiple drawings"; lengths of cable, containment and pipework by on-screen measurement
  "scaled to each drawing"; "every count is marked on the drawing"; "A drawing set that would take days to
  count manually can be taken off in hours" (vendor claim; no accuracy figure).
- **Bluebeam Revu Visual Search** [M18]: the user draws a rectangle around a symbol; results depend on a
  sensitivity slider ("Lower sensitivity allows for more variation in results"); no accuracy stated.

**What this means for Vextrus (Medium):** every documented tool counts symbols well and treats runs as
the user's work (measure on screen, or select lines and confirm); the most advanced (GQI) reads legends,
circuits, riser diagrams and single-line diagrams into relations, and has an explicit "what was not
recognised" check. None claims a measured accuracy. Vextrus's differences are the ones it already has:
one Live Model with identity (GQI's manual lists an "import civil model" function, 导入土建模型 [M14], so its
MEP and civil models appear to be separate files joined by import; my inference),
a QS Confirmation with Trace, Coverage of every symbol, and Bangladesh's rules and rates.

---

## Sources

**Bangladesh: schedules, codes and law (primary)**
- [M1] PWD, *Schedule of Rates 2022 (2nd Revised), Part A: Civil Works*, in force 22 Jan 2026; the owner's
  local copy `Final_SoR_2022 _2nd_Revised.pdf` (336 pages; printed page = PDF − 16), also at
  https://ss.pwd.gov.bd/document/sor/Final_SoR_2022%20_2nd_Revised.pdf. Chapters 26 and 28 read in full,
  Dhaka column checked against rendered images of PDF 268 and 304.
- [M2] PWD, *Schedule of Rates 2022 For E/M Works (2nd Revised)*, 744 pp.,
  https://ss.pwd.gov.bd/document/sor/Pwd_Schedule_Of_Rates_EM_2nd_revised.pdf (text layer; cited by PDF page).
- [M3] PWD, *Schedule of Rates 2022 For E/M Works* (original), per-subhead scanned PDFs listed at
  https://ss.pwd.gov.bd/sor/sordownload/2 (Subhead-1 Wiring & Cables pp. 1–8, 55–56; Subhead-2.1 Substation
  pp. 62–79; Subhead-2.2 Generator pp. 130–132; Subhead-4 Boards & Controls pp. 158–186; Subhead-8 Lift &
  Escalator pp. 408–443), read as rendered images.
- [M4] PWD, *Schedule of Rates 2026, Part B: Electro-mechanical Works, Subhead 8: Lift & Escalator*,
  https://ss.pwd.gov.bd/document/sor/Lift_escalator-2026.pdf (50 pp.; PDF 15, 19, 39–40, 49 read as images
  or OCR text).
- [M5] PWD, Schedule of Rates index, https://ss.pwd.gov.bd/sor (read 28 Sep 2026).
- [M6] *Bangladesh National Building Code 2020*, Bangladesh Gazette, Extraordinary, 11 Feb 2021; copy at
  https://mccibd.org/wp-content/uploads/2021/09/Bangladesh-National-Building-Code-2020.pdf (2,464 pp.;
  cited by gazette page).
- [M7] *অগ্নি প্রতিরোধ ও নির্বাপণ আইন, ২০০৩* (Act 7 of 2003), s. 2,
  http://bdlaws.minlaw.gov.bd/act-900/section-28222.html; s. 7,
  http://bdlaws.minlaw.gov.bd/act-900/section-28227.html.
- [M8] *অগ্নি প্রতিরোধ ও নির্বাপণ বিধিমালা, ২০১৪*, SRO 230-Ain/2014, Bangladesh Gazette, Extraordinary,
  18 Sep 2014, https://www.dpp.gov.bd/upload_file/gazettes/11671_56355.pdf (gazette pp. 18516–18518 = PDF
  46–48, read as images).

**Measurement standards (primary)**
- [M9] BIS, *IS 1200 (Part XIX): 1981 Method of Measurement of Building and Civil Engineering Works, Part XIX
  Water Supply, Plumbing and Drains* (third revision, reaffirmed), https://archive.org/details/gov.in.is.1200.19.1981.
- [M10] CPWD, *General Specifications for Electrical Works, Part I: Internal, 2013*, clauses 3.3–3.4
  (pp. 24–27), https://www.dgll.nic.in/sites/default/files/2023-06/CPWD%20%E0%A4%95%E0%A5%87%20General%20Specifications%20for%20Electrical%20Works%20(Part-1%20Internal)%202013_compressed.pdf.
  The 2023 edition (https://cpwd.gov.in/Publication/CPWD_General_Specification_for_Electrical_Works_Part-I_Internal_2023.pdf)
  refused the connection.

**IFC (primary)**
- [M11] buildingSMART, IFC 4.x documentation source, branch `ifc4.3-main` at `6754caa287` (24 Sep 2026),
  https://github.com/buildingSMART/IFC4.x-development (enumerations, entity pages, `reference_schemas/psd/`).
- [M12] buildingSMART bSDD API, IFC 4.3 dictionary, e.g.
  https://api.bsdd.buildingsmart.org/api/Class/v1?Uri=https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/IfcLightFixture&IncludeClassProperties=true
  (and 31 further MEP classes; read 28 Sep 2026).

**Competitors (vendor documentation; claims marked)**
- [M13] Glodon, *BIM安装计量GQI*, https://m.glodon.com/mobile/product/detail/85.
- [M14] Glodon AECORE, *安装计量GQI2021* manual: 多回路 https://aecore.glodon.com/doc/GQI2021/1aa71f7ad1e9437c861eff23231c1801;
  喷淋提量 …/c1f0f82dadd647538ab0fd72c2c90ef9; 电系统图 …/e53dc5a7094945e99dffc1195f04a5bd; 计算设置-电气
  …/003e38cdf12b43cf983a2d9e96195aad; 点式设备一键提量 …/efde6ff284c84bb9804318f0d7ce1fb2; 漏量检查
  …/198eae97cac14d19ac93e37de3c516c3; 材料表 …/2004f7ff2dc844c3becca56e7530eac1; 水系统图
  …/b744642a476d4d8c91ead3ca73d88d33 (all under https://aecore.glodon.com/doc/GQI2021/).
- [M15] Glodon, *TMEC: 5D BIM Quantity Takeoff for Mechanical & Electrical*, https://www.glodon.com/en/products/tmec-59.
- [M16] Glodon, *5D BIM Digital Cost Management Solution*, https://www.glodon.com/en/solutions/5D-BIM-Digital-Cost-Management-Solution-7.
- [M17] Countfire, *Electrical takeoff software*, https://www.countfire.com/product/takeoff-software.
- [M18] Bluebeam, *Visual search overview*, https://support.bluebeam.com/revu/features/visual-search-overview.html.

**In this repository**
- `docs/research/tax-and-allowances.md` §B (the template's sources, the reference building, direct cost ≈ ৳2,890/sft).
- `docs/research/component-attributes-and-classification.md` §2 and §4 (IFC sets, COBie fields).
- `docs/specs/bd-defaults.md` (the MEP template, owner's Q10 ruling).
- Working notes, rates and arithmetic: `.private/work/session-02/digests/mep-research-NOTES.txt`.

## Verified by a refuter (28 Sep 2026, session 02), and what it corrects
- **Fire Rules 2014 (SRO 230-Ain/2014), CONFIRMED** from the gazette (Thirteenth Schedule, A-2 flats):
  sprinklers in basement and ground floor, one head per 9.30 m² (100 sft); one **riser point (landing
  valve) per 600 m² of each floor** (not "a wet riser per 600 m²"); underground reservoir ≥ 50,000 gallons
  (two-thirds kept for fire); roof tank ≥ 25,000 gallons (half for fire); a pump house with a ≥ 500 GPM
  main pump, a diesel standby and a jockey pump. The Act 2003 s.2 defines a multi-storey building as
  not less than 7 storeys. No enacted amendment found.
- **BNBC 2020 Part 4 §5.3.2(a), PARTLY TRUE:** "Up to 33 m height fire detection and fixed firefighting
  arrangement shall not be required" applies only to residential buildings meeting §5.2.1 and §5.2.2
  (monolithic Type I-A, Class-I finishes); §5.1.6(c) requires a fire protection plan for A3 buildings of
  30 or more dwelling units; and the Act s.7 ("notwithstanding any other law in force") makes the Fire
  Service's clearance a condition of approving any multi-storey plan. So for 7 or more storeys the Fire
  Rules apply on top of BNBC: the choice between regimes this file presented is not one the law gives
  (the refuter's reading of s.7, not a court's).
- **PWD E/M 2nd Revised = 2022 × 1.028, CONFIRMED** on four items. **The lift claim misleads:** PWD's
  2023–24 revised lift schedule already raised Type D (630 kg, 1 m/s) from ৳19,94,988 + ৳70,406 per extra
  stop to ৳29,52,583 + ৳1,04,200 (+48 %); the 2026 schedule's equivalent (Type B2, the same brands and a PMS
  gearless motor) is ৳36,11,073 + ৳1,27,439, **+22.3 % over the rate in force before it**, not +81 %.
- **PWD's point, CONFIRMED:** "including circuit wiring (From SDB to Switch Board) … switch board & pull
  box … without switch"; switches and sockets separate; sub-mains and feeders per metre.
- **IfcElectricDistributionBoard deprecated in IFC 4.3, CONFIRMED** (use IfcDistributionBoard).
- **Fire pumps, arithmetic CONFIRMED, headline overstated:** 20,99,729 + 33,59,566 + 2,14,387 =
  ৳56,73,682, ৳147.75/sft of the reference building printed; the template's ৳50 is **net** (÷ 1.227), so
  like for like ≈ ৳120/sft net, about 2.4× the default and at the top of its 30–120 range, not 3×. The
  1.227 divisor is itself unverified for E/M. Fire is under-provisioned for 7+ storeys; the gap is smaller
  than first stated.
