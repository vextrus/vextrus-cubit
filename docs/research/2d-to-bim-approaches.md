# 2D CAD drawings to a 3D BIM (IFC) model: prior art, pipeline, AI, licences and a recommended approach

Question: how can 2D AutoCAD DWG drawings (architectural plans, sections and elevations; RCC
structural column, beam, slab and foundation plans with schedules) be turned into a 3D BIM/IFC
model today, and what is the best technical approach and toolset for Vextrus's human-in-the-loop
MVP?

Date: 2026-09-25. Researcher: background agent (medium effort).

**Sources and how they are cited**
- Web primary sources: papers (arXiv, publisher abstracts), vendor documentation, GitHub
  repositories, and licence texts. Each is cited inline as `[S#]`, with the list in §9.
- Local, first-hand:
  - `~/reference/cad2data-Revit-IFC-DWG-DGN/`, the MIT docs only: `README.md`, `LICENSE`,
    `LICENSE-PROPRIETARY` and `DDC_in_additon/ReadMe_DWG_DDC_converter.pdf`. No binary was run.
  - One IfcOpenShell 0.8.5 smoke test, run in a scratch directory and not in the repo (§3.8).
  - The LibreDWG version installed on this machine (`dwgread --version` gives 0.13.3).
- Nothing from `.private/` was read or used.
- **Paywall limits.** Several journal papers were blocked (HTTP 403). For those, only the abstract
  was read, and this note says so wherever it relies on one.

---

## 1. The answer in brief

- **No tool today turns a real 2D drawing set into a correct BIM model without a human.** Every
  product and paper that works in practice is semi-automatic:
  - the machine proposes members from layers, text and geometry;
  - a person picks layers, sets the scale and levels, and checks the result.
  - Glodon GTJ is the closest precedent: Chinese QS software that turns CAD drawings into a 3D
    quantity model. It is built exactly this way: *extract* (the user picks layers), then
    *recognise*, then *check* (校核) [S20–S22].
  - Revit's native path is manual tracing [S24].
- **Vector beats raster when you have the DWG.**
  - Raster floor-plan networks reach about 90% precision and recall on junctions and walls (Liu et
    al.), and 57.5% mean IoU for room segmentation on CubiCasa5K [S8, S9].
  - Vector symbol spotting on real CAD reaches about 90 PQ (SymPoint-V2) [S11].
  - Rule-based parsing of vector structural PDFs reports 0.92/0.997 recall/precision for columns
    and 0.89/0.99 for beams, but only on generator-made drawings [S14].
- **Vision-language models (VLMs) read text well but symbols and geometry badly.**
  - AECV-Bench: up to 0.95 on drawing text QA, but 0.40–0.55 on counting doors and windows [S15].
  - BlueprintAgent: a zero-shot VLM scores 0.301 beam F1 on RC structural blueprints. The same
    VLM, placed inside an engineering-constraint loop that sends it back to specific regions of the
    sheet, scores 0.994 [S12].
  - Use VLMs for sheet classification, schedules, notes and adjudication. Do not use them for
    coordinates.
- **Recommended stack:**
  - **Read:** LibreDWG's `dwg2dxf`, run as a sandboxed separate process, then **ezdxf** (MIT) for
    all parsing. ACadSharp (MIT) is the fallback if LibreDWG fails on a file.
  - **Build:** **IfcOpenShell** (LGPL) to assemble IFC4 (IFC4X3 optional).
  - **View:** **That Open** (web-ifc, MPL-2.0; components, MIT) in the browser.
  - **Avoid:** xeokit (AGPL), and the CubiCasa5K and FloorPlanCAD datasets and weights (CC BY-NC)
    in the product.
- **The minimum a valid frame model needs** (§6.2):
  - storeys with elevations;
  - grid axes with spacings;
  - for each column: position, section, and the storeys it spans;
  - for each beam: supports, section, and top level;
  - for each slab: outline, thickness and level;
  - foundations;
  - for walls: centreline, thickness, height and openings.

  Each fact the machine cannot read must become a one-click question to the quantity surveyor
  (QS), not a refusal. That is the postmortem's rule 2.

---

## 2. Prior art

### 2.1 Academic work

| Work | Input | What it recognises | Reported accuracy | What the human does | Note |
|---|---|---|---|---|---|
| Liu, Wu, Kohli, Furukawa, *Raster-to-Vector*, ICCV 2017 [S8] | Raster floor plan | Junctions, then walls, doors and icons via integer programming | "around 90% precision and recall" [S8]. With IP: junction acc 94.7 / recall 91.7, room acc 84.5 / recall 88.4, as re-evaluated in [S9] Table 2 | None in the pipeline. Output is 2D vector | Residential plans only. Code is MIT [S30] |
| Kalervo et al., *CubiCasa5K*, 2019 [S9] | Raster, 5,000 plans, 80+ categories | Rooms, icons, walls | Test: rooms mean IoU 57.5 (polygonised 49.3), icons mean IoU 55.7 (41.6) [S9 Table 3] | None | Polygonising loses accuracy when "wall or icon junctions are missed" [S9 §5]. Licence **CC BY-NC 4.0** [S31] |
| Fan et al., *FloorPlanCAD*, 2021 [S10] | **Vector** CAD, 11,602 drawings, 30 thing and 5 stuff classes | Panoptic symbol spotting | Benchmark only. Later models: SymPoint 83.3 PQ, SymPoint-V2 90.1 PQ [S11] | None | SymPoint-V2 gains by using **layer IDs** as a feature [S11]. Dataset **CC BY-NC 4.0** [S32] |
| Byun & Sohn, *ABGS*, Sustainability 2020 [S16] | 2D CAD | Columns and other members, from floor plans **plus member lists** | Abstract says "quickly and accurately". Numbers not accessible (MDPI returned 403) | Not stated in the abstract | Key idea: parse the **member list (schedule) first** to constrain recognition on the plan [S16, S17] |
| Zhao, Deng, Lai, *Reconstructing BIM from 2D structural drawings*, AutCon 128 (2021) [S18] | Raster scans of structural drawings | Grids, columns, beams, then IFC | Abstract: "feasibility and reliability". Numbers paywalled | Not stated | Faster R-CNN plus OCR. Different drawing standards hurt quality [S18] |
| Xu et al., *BlueprintAgent*, arXiv Sep 2026 [S12] | Raster scans of RC buildings: 300 sheets, 20 projects | Axes, columns, beams, then floor aggregation and FEM model | Beam F1 **0.994**, against 0.301 for a zero-shot multimodal LLM (MLLM) and 0.820 for a fixed pipeline. Main model: GPT-5.4; also tested with Claude 4.6 Opus and Qwen 3.6 Plus [S12, S13] | An engineer reviews evidence-linked JSON before use [S13] | Errors: 45% perception, 25% topology, 20% text-to-beam binding, 10% completeness [S13]. Data CC BY 4.0 [S13] |
| *Training-free agentic CV for structural framing plans*, arXiv 2026 [S14] | **Vector PDF** framing plans | Columns, beams, walls, braces, openings | Column recall/precision 0.922/0.997, beam 0.886/0.990. Scale within 0.1% [S14] | Rules were hand-written by the authors | **Tested only on "auto-generated benchmark drawings sharing a common source generator"** [S14]. This is the trap in postmortem cause 1 |
| *Sketch2BIM*, arXiv 2025 [S19] | Hand sketches | Walls, doors, windows | Wall detection starts at 83% and reaches near-perfect after a few rounds of human feedback. Ten plans [S19] | Iterative human feedback is the core of the method | Human-in-the-loop plus schema validation plus scripted BIM |

**What the literature says, in short.**
- Raster floor-plan parsing is mature for residential **architecture**, but polygonising and
  topology remain the weak step [S9].
- **Structural** recognition works best when:
  - the schedule constrains the plan [S16];
  - engineering rules check the output (supports, span counts, continuity) [S12];
  - grids are the backbone (axis-first pipelines in [S12] and GTJ [S20]).
- High scores on self-generated drawings prove little [S14].

### 2.2 Commercial products

| Product | Input | Automation | What the human does | Source |
|---|---|---|---|---|
| **Glodon GTJ2025** (广联达 BIM 土建计量平台), China's QS takeoff platform | DWG | "CAD 识别": add drawings, split, position, then recognise the level table, grid, columns, beams, slabs, walls, doors/windows and foundations, in that order | Per member type: **提取边线/提取标注** (pick the edge-line and label layers), then auto, point or box recognition, then **校核** (a check that flags errors, e.g. beam spans). Storey heights come from 楼层设置 in project settings | [S20, S21, S22] |
| **橄榄山快模 (GLS KuaiMo) and 品茗 (Pinming)**: Revit "翻模" (drawing-to-model) plug-ins | DWG linked in Revit | Walls, columns, beams and slabs, plus MEP; beam and column **numbers read automatically**; beams with level changes; arc beams. Vendor/blog claim: 3–5 times faster than modelling by hand | The user maps layers to families and types, and fixes the result | [S23] (secondary: Zhihu/CSDN write-ups; vendor pages not reached) |
| **Autodesk Revit** | Linked DWG | None native. "Import Walls" brings in ACA walls as reference, then you "Pick Lines" by hand | All of it | [S24] |
| **Autodesk (Forma) Takeoff** | PDF sheets | Symbol detection from one traced example; 90° rotations only; ignores text | Confirms or deselects each instance | [S25] |
| **WiseBIM AI for Revit** | DWG, DXF, PDF, images | Walls, openings, slabs, roofs, columns, beams, furniture, text | Sets the scale, picks families, runs detection per element type | [S26] (search summary of the vendor page; the product page itself gave no detail) |
| **BIMify for Revit** | Linked DWG | "Reads the layer data" and generates Revit geometry | Layer mapping | [S27] |
| **ACCA Edificius** | DXF/DWG | "Wand" converts selected 2D entities into walls, slabs and so on | Sets the scale, positions, selects the objects | [S28] |
| **Snaptrude** | Its own sketching | "Sketch to BIM" turns massing into walls and slabs from presets | Draws it | [S29]. Not a DWG reader |

**The pattern.** Every commercial product that works on real DWGs is **layer-driven and
confirmation-driven**. None claims unattended conversion of a full structural set. GTJ is the
closest analogue to the Vextrus MVP: a QS product whose 3D model exists to measure quantities.

### 2.3 OCE / cad2data (MIT docs only)

- `DwgExporter.exe` turns `.dwg` into an **XLSX database plus optional PDF sheets**
  (`DwgExporter <input> [<output>] [-no-xlsx] [sheets2pdf]`).
  - Sources: `ReadMe_DWG_DDC_converter.pdf` p.2; `README.md` converter table, "AutoCAD
    (1983-2026) | .dwg | DwgExporter.exe | XLSX database + PDF Drawings".
  - It produces **no 3D and no IFC** from DWG. Only the Revit path emits IFC (`RVT2IFCconverter`).
- The binaries "incorporate technology licensed from the Open Design Alliance". Commercial SaaS use
  needs a commercial licence (`README.md` "Licensing"; `LICENSE-PROPRIETARY` §1–2). They are
  unusable for us.
- **Lesson:** the reference product flattens DWG into an entity table and leaves semantics to the
  user. It does not solve 2D-to-BIM. See also `docs/research/ddc-thesis-and-cad2data.md`.

---

## 3. The pipeline, stage by stage

### 3.1 Reading DWG on Linux

| Option | Reads DWG? | Notes | Source |
|---|---|---|---|
| **LibreDWG** (GNU) | Yes | "Beta development stage". Reader "done" with minor exceptions. Writer covers R1.1–R2000 only. Tools: `dwgread -O JSON\|minJSON\|GeoJSON\|DXF\|DXFB`, `dwg2dxf`, `dxf2dwg`. "not as stable as the unfree Teigha library… AutoCAD fails to import some of our files (~10% failure rate)" (about its DXF output). **`TABLE`, `TABLECONTENT` and dynamic-block classes are "unstable, undertested"**. That matters, because schedules are sometimes ACAD_TABLE entities | [S1, S2] |
| LibreDWG security | — | Repeated fuzzing CVEs: heap overflows in R2004 decompression. CVE-2025-61154 affects v0.13.3.7571–7835; CVE-2026-9500 affects up to 0.14. **This machine has 0.13.3**, and its build number was not checked. Latest release: 0.14.8597 (10 Sep 2026) | [S3, S4] |
| **ezdxf** (Python, MIT) | **No**, DXF only. Its `odafc` add-on shells out to ODA File Converter | Best-in-class DXF API; see §3.2 | [S5] |
| **ODA File Converter** | Yes (DWG ↔ DXF) | Linux RPM/DEB/AppImage. Now offered as "free for 60 days" trial. Terms for commercial or server use are not stated on the page | [S6] |
| **ODA Drawings SDK** (formerly Teigha) | Yes, the reference-grade reader | Membership: Sustaining **$6K in year one, then $3.6K/yr**; Founding $30K, then $14.4K/yr (source code). **Only Sustaining and above may deploy SaaS/web apps**. SDK add-ons cost extra | [S7] (search summary of opendesign.com/pricing; the page itself timed out, so re-verify) |
| **ACadSharp** (.NET, MIT) | Yes: AC1014–AC1032 (R14–2018+). Writes all of these except AC1021 | Active: 4.6k commits. A permissive-licence alternative to LibreDWG; needs a .NET service | [S33] |
| Aspose.CAD (commercial) | Yes | From US$799 (search summary) | [S34] |

**The postmortem's first-hand DWG knowledge** (`docs/postmortem.md`, "What is worth carrying"):
LibreDWG showed text-wrapping and MTEXT-order failure modes on our files.

### 3.2 What to extract from the DXF (ezdxf)

- **Units and scale.**
  - "Any length or coordinate value in DXF is unitless". `$INSUNITS` sets the modelspace units;
    `$MEASUREMENT` only picks hatch and linetype files [S35].
  - **Units must therefore be confirmed**, for example by checking a dimension's
    `get_measurement()` against its displayed text.
- **Dimensions.**
  - `get_measurement()` returns the true WCS measurement. `actual_measurement` "is optional and
    often not present".
  - Text `"<>"` means "show the measured value"; any other text is an **override**, and must be
    compared with the geometry [S36].
- **MTEXT.** `plain_text()` and `all_columns_plain_text()` strip the inline codes (`\P`, `\S`
  stacking, `\H`, `\f` and others) [S37].
- **Paper space.**
  - A VIEWPORT gives `get_scale()` and `get_transformation_matrix()` (model to paper) and
    `frozen_layers` [S38].
  - Needed when several details at different scales share one sheet.
- **Xrefs.** ezdxf can `embed` an xref's modelspace into a block. Units between documents must be
  scaled by hand. ACAD_TABLE and proxy entities are not supported [S39].
  - Consultants' sets often xref the grid or architectural background, so a **missing xref is a
    question for the user**.
- **Rendering for AI or for the UI.**
  - The ezdxf drawing add-on renders modelspace or a paperspace layout to PNG, SVG or PDF
    (matplotlib, SVG and PyMuPDF backends).
  - Limit: "VIEWPORTS are always rendered as top view" [S40].
- **Blocks and attributes** (INSERT/ATTRIB) carry column marks, door tags and title blocks.
  **Layers** carry the discipline and member type, and are the strongest single feature: see GTJ
  [S20] and the layer gain in SymPoint-V2 [S11].

### 3.3 Grid detection

- Axis-first is the common backbone: GTJ recognises the grid before columns and beams [S20], and
  BlueprintAgent's stages begin with axis-grid extraction [S13].
- Method (vector):
  1. Take the long lines on grid-like layers or with center linetypes.
  2. Take the bubble circles or blocks, with their text labels (A, B, C… / 1, 2, 3…).
  3. Take the spacings from the dimension chains.
- The grid gives every later member a named position, for example "C1 at B/3". It is also the
  **cross-sheet anchor**: the same grid on the foundation, column, beam and architectural plans
  lets the sheets be registered to each other.

### 3.4 Member recognition

- **Columns.** Closed rectangles or hatches at grid intersections, plus a mark (C1, C2…).
  - The section b×h and the storey span come from the **column schedule**.
  - GTJ has separate "识别柱表 / 识别柱大样" (recognise column table / column detail) steps [S41].
  - ABGS parses the member list first [S16].
- **Beams.**
  - Edge-line pairs between supports.
  - The label carries mark, b×d and reinforcement. In Chinese practice this is a "集中标注"
    (collective label) plus "原位标注" (in-place labels).
  - Spans are split at supports, and span errors are the thing a human checks [S42].
  - BlueprintAgent's constraints (beam–column support, span count, 3D continuity) are what lift
    beam F1 from 0.82 to 0.994 [S12, S13].
- **Slabs.** Regions bounded by beams, with a thickness from the slab note or schedule.
  - The postmortem records that *every* beam was blocked on **one unread slab thickness**. This is
    exactly the fact to ask the QS for.
- **Walls and openings.**
  - Parallel line pairs on wall layers (the vector approach), with openings found as gaps plus door
    and window blocks or tags.
  - Raster networks handle this for plans without layers [S8, S9].
- **Foundations and piles.** Pile caps and footings follow the same pattern as columns: a plan
  mark plus a schedule.

### 3.5 Linking sheets (plan ↔ schedule ↔ section)

- The links are:
  - member marks shared between plan and schedule;
  - the shared grid;
  - level names shared between the sections and the level or storey table.
- In the literature, the **binding of text to member** is itself a major error class: 20% of
  BlueprintAgent's residual errors are "binding" [S13].
- Design this as an explicit, reviewable link, for example "plan mark B12 → schedule row B12". Do
  not leave it implicit.

### 3.6 Levels and storey heights

- GTJ takes storey heights from project settings (楼层设置). It can also recognise a level table
  from the structural drawings [S20].
- Sources in a typical set:
  - the level or storey table on the structural sheets;
  - section and elevation level marks (e.g. "+3.050");
  - general notes.
- This is the single most important fact for 3D, and the one most often missing or inconsistent.
  It needs a **first-class confirmation step**.

### 3.7 Assembling the IFC (IfcOpenShell)

- **API.** `ifcopenshell.api` covers every authoring step:
  - `root.create_entity`;
  - `aggregate` (Project → Site → Building → Storey) and `spatial.assign_container`;
  - `geometry` (profile, wall and extrusion representations; placement; booleans);
  - `material` (profile and layer sets), `type`, `pset` and `grid` [S43].
- **Entities (checked in the installed schema, see §3.8).**
  - Frame and envelope: `IfcColumn`, `IfcBeam`, `IfcSlab`, `IfcWall`.
  - Foundations and stairs: `IfcFooting`, `IfcPile`, `IfcStair`.
  - Voids, grids and bars: `IfcOpeningElement`, `IfcGrid`, `IfcReinforcingBar`.
  - Storeys: `IfcBuildingStorey`.
  - All exist in both IFC4 and IFC4X3.
- **Geometry.**
  - Extrude an `IfcRectangleProfileDef` along the member axis (a SweptSolid body).
  - The material profile set records b×h for columns and beams.
  - Wall and slab thickness uses layer sets.
- **Quantities.** The standard quantity sets:
  - `Qto_ColumnBaseQuantities`: Length, CrossSectionArea, …, GrossVolume, NetVolume…;
  - `Qto_BeamBaseQuantities`;
  - `Qto_SlabBaseQuantities`: Width, Length, Depth, Perimeter, Gross/Net Area and Volume…;
  - `Qto_WallBaseQuantities`;
  - `Qto_FootingBaseQuantities`.

  These were read from IfcOpenShell's IFC4X3 templates.
- **Which schema.**
  - IFC4.3 was approved as ISO 16739-1:2024 [S44].
  - IFC4 (Add2 TC1) has the widest viewer and tool support.
  - IfcOpenShell supports IFC2x3 TC1, IFC4 Add2 TC1 and IFC4x3 Add2 [S45].

### 3.8 A first-hand check: IfcOpenShell 0.8.5 works, and one unit trap was found

What was checked:
- Wheels exist for CPython 3.13 on manylinux x86_64 (PyPI).
- In a scratch directory, one extruded rectangular column was built with
  project → site → building → storey → column.

What was found:
- **`unit.assign_unit()` defaults to millimetres** (unit scale 0.001).
- **`geometry.add_profile_representation(depth=…)` takes depth "in meters"** (its docstring says
  so). The profile's XDim and YDim are in *project* units.
- So a 300×500 mm column 3.0 m high must be written as `XDim=300, YDim=500, depth=3.0`. Getting
  this wrong by passing `depth=3000` produced a 450 m³ column instead of 0.45 m³.
- **Units need an explicit test in the assembly layer.**

### 3.9 Viewing in the browser

- **web-ifc** (That Open Company) reads and writes IFC in WASM. **MPL-2.0**; npm 0.0.78 [S46].
- **@thatopen/components** is built on Three.js: IFC loader, floor-plan navigation, dimensions.
  **MIT**; 3.4.8. **@thatopen/fragments** is **MIT** too [S46, S47].
- "IFC.js" is the former name. The old `IFCjs/web-ifc-viewer` repo now resolves to `ThatOpen/`
  (GitHub API).
- **xeokit SDK** is **AGPL-3.0**: "any modifications or integrations… must also be open-sourced
  under AGPLv3". A commercial licence is available from Creoox [S48].

---

## 4. Where AI helps, and where it does not

| Task | Reliable today? | Evidence |
|---|---|---|
| Reading text (OCR / document QA) on drawings | **Yes**, up to 0.95 | AECV-Bench [S15] |
| Classifying sheet and layout regions (title block, table, plan, section) | **Yes**, with domain tuning. RF-DETR mAP50 0.949; Qwen3-VL F1 0.911. General document models suffer "domain interference" | [S49] |
| Counting symbols (doors, windows) from images | **No**, 0.40–0.55 | [S15] |
| Zero-shot VLM extraction of a structural frame | **No**: beam F1 0.301, with outputs violating support and continuity | [S12, S13] |
| VLM inside a constraint loop (rules find a conflict → VLM re-reads that region) | **Yes on raster, in one study**: beam F1 0.994 | [S12, S13] |
| Human feedback loop on VLM output | Converges to near-perfect on simple plans | [S19] |
| Closed-question classification (route, classify) with a small judgment model | Cheap (under one cent per Ask) and reliable, from our own experience | `docs/postmortem.md` |

**Reading the evidence for our case.** We have **vectors**, so coordinates, lengths and dimensions
should come from ezdxf, never from a VLM. AI earns its keep on:
1. classifying sheets and layers ("this layer is beams"; "this sheet is the first-floor beam
   layout");
2. reading schedules and general notes into typed rows, especially when a schedule is drawn as
   lines plus text rather than as an ACAD_TABLE;
3. binding labels to members when the geometry is ambiguous;
4. adjudicating conflicts that the rules find, as BlueprintAgent does [S12].

Every AI output should be **a proposal carrying its trace** (the entity handles or sheet region it
came from) for the QS to confirm.

---

## 5. Licence table

| Component | Licence | What it means for a SaaS backend (Vextrus) | Source |
|---|---|---|---|
| LibreDWG | **GPL-3.0-or-later** | **Running it on our server is not distribution.** GPL FAQ #UnreleasedMods: a company running a modified GPL program on a web site "does not have to release the modified sources". Invoking `dwg2dxf` as a separate process with simple file I/O is the "separate programs" case (FAQ #MereAggregation, #GPLPlugins). **Linking** it (C API or Python bindings) into our service makes one combined program. That is harmless while it is only served, but blocks any future **on-prem or desktop distribution** unless our code is GPL. **Rule: subprocess only.** | [S1, S50] |
| ezdxf | MIT | Free to use | [S30] (GitHub API) |
| ACadSharp | MIT | Free to use. Needs a .NET runtime | [S33] |
| ODA Drawings SDK / File Converter | Proprietary. SaaS needs Sustaining membership or above (about $6K, then $3.6K/yr; re-verify). The converter is a 60-day trial | Budget item if LibreDWG proves too unreliable on real files | [S6, S7] |
| DDC converters (cad2data) | Proprietary. Community tier is personal/research only; commercial SaaS needs a licence | Not usable | cad2data `README.md` "Licensing" |
| Aspose.CAD | Commercial, from US$799 | Alternative reader | [S34] |
| IfcOpenShell (python, ifcconvert, ifcpatch, ifctester, ifc5d, ifc4d…) | **LGPL-3.0-or-later** | Use it unmodified as a library. If we modify it, we publish those modifications. Our code stays ours | [S45] |
| Bonsai (Blender add-on), ifcsverchok | GPL-3.0-or-later | Desktop tools only. Do not embed | [S45] |
| web-ifc | **MPL-2.0** | File-level copyleft: changes to *its* files must be shared. Our app is unaffected | [S46] |
| @thatopen/components, @thatopen/fragments | MIT | Free to use | [S46, S47] |
| xeokit SDK | **AGPL-3.0** (or commercial) | Shipping it to users would force our front end to be AGPL, or a paid licence. **Avoid** | [S48] |
| OpenConstructionERP | AGPL-3.0 | Learn only; never copy (project law) | `CLAUDE.md` |
| FloorplanTransformation code | MIT | Usable, but its trained data and weights need separate checking | [S30] |
| CubiCasa5K dataset and weights | **CC BY-NC 4.0** | **Non-commercial**: no training for, or use in, the product | [S31] |
| FloorPlanCAD dataset | **CC BY-NC 4.0** | Non-commercial: research only | [S32] |
| BlueprintAgent data (300 sheets, ground truth) | CC BY 4.0 (per the paper) | Usable, with attribution, as an **external** test set for structural reading | [S13] |

**Caveat.** This is research, not legal advice. The GPL "separate program" line is, in the FSF's
words, "a legal question, which ultimately judges will decide" [S50].

---

## 6. Recommended approach for a human-in-the-loop MVP

### 6.1 The shape

```
DWG ──(sandboxed dwg2dxf subprocess; ACadSharp fallback)──► DXF
DXF ──ezdxf──► entity table (layer, block, text, dims, handles, sheet/viewport)
             ├─ rules: units/scale check, grid, member candidates, schedule tables
             ├─ AI (closed questions): sheet type, layer→member-type, schedule rows, label binding
             ▼
   PROPOSED BUILDING FACTS (each with trace → drawing handles)
             ▼
   QS confirms / edits (one click per fact; asked at point of need)
             ▼
   CONFIRMED FACTS ──IfcOpenShell──► IFC4 model (+Qto sets) ──► BOQ / 5D / 4D
                                          └─► That Open viewer (trace back to the sheet)
```

- The product's own data is the **confirmed facts**, not the IFC. The IFC is **generated** from
  those facts, so it can be rebuilt whenever a fact changes.
- This keeps the Trace the owner valued (postmortem, "What is worth carrying").

### 6.2 The minimum facts for a valid 3D frame model

This is a recommendation, drawn from the recognition order in GTJ [S20] and BlueprintAgent [S13].
The QS confirms each fact.

| Fact | Machine proposes from | QS confirms |
|---|---|---|
| Units and scale per sheet/viewport | `$INSUNITS`, viewport `get_scale()`, dimension checks | One click, "1 unit = 1 mm" |
| Storey list and elevations, or floor-to-floor heights | The level table, section level marks, notes | The table, once per project |
| Grid: axis labels and spacings | Grid layer, bubbles, dimension chains | Once per project, then registered on each sheet |
| Sheet ↔ storey mapping | Title-block text, VLM sheet classification | A list with one tick per sheet |
| Layer ↔ member type | Layer names, AI classification | The GTJ "提取" step, as one picker |
| Columns: mark, position, b×h, from–to storey | Plan plus schedule | Exceptions only |
| Beams: mark, supports, b×d, top level (default: slab top) | Plan labels plus edge lines plus supports | Span/support conflicts only |
| Slabs: outline, thickness, level | Bounded regions plus notes | **Thickness, when it is not read** |
| Foundations: type, size, depth | Foundation plan plus schedule | Exceptions only |
| Walls: centreline, thickness, height, openings plus sill/head | Architectural plan plus door/window schedule | Default height = storey − beam depth, for confirmation |

Anything still unknown becomes an explicit, visible **assumption** with a default the QS can
accept. It must never be a silent guess, and never a hard refusal: that was postmortem cause 2.

### 6.3 Build order

1. **Structure first** (grid, columns, beams, slabs, foundations). Concrete and steel dominate RCC
   cost, and structural sheets are the most regular.
2. **Walls and openings** next.
3. **Rebar** (`IfcReinforcingBar`) as quantities, not modelled bars, at first.

### 6.4 The biggest risks

1. **Drawing variability across consultants.** Layer names, blocks and label syntax differ.
   Rules fitted to one office fail at the next; [S14] shows how self-generated tests hide this.
   *Mitigation:* layer mapping by the user, remembered per consultant; real sets from week one.
2. **DWG reading reliability.**
   - LibreDWG is beta, has CVEs, and handles ACAD_TABLE poorly [S1, S2, S3].
   - *Mitigation:* run it as a sandboxed subprocess with a timeout; keep ACadSharp as fallback;
     budget for ODA if a real-file corpus shows failures.
3. **Levels.** Missing or inconsistent storey data breaks every member.
4. **Cross-sheet binding errors.** These are silent, and plausible-looking, wrong models [S13].
   *Mitigation:* explicit link objects, each shown with its trace.
5. **Units** (§3.8): a factor-of-1000 bug is one line away.
6. **VLM over-trust.** Use VLMs only for text and classification; never for coordinates [S15].
7. **Licence contamination.** No xeokit, no CubiCasa/FloorPlanCAD weights, no LibreDWG linking,
   no DDC binaries.

---

## 7. Unknown / needs a prototype

1. **LibreDWG 0.14 on real Bangladeshi consultant DWGs.** What share convert cleanly? How do
   schedules drawn as ACAD_TABLE fare, compared with schedules drawn as lines plus text? How is
   Bangla or Unicode text handled? Also: upgrade from the installed 0.13.3.
2. **ACadSharp against LibreDWG** on the same files, for fidelity and speed.
3. **ODA pricing and terms.** The live page was not reachable (it timed out), so confirm the
   Sustaining price and the SaaS clause. Also confirm the File Converter's licence after the trial.
4. **Layer conventions in the Bangladeshi market.** Is there any standard, or is it per office?
   This decides how much the layer→member mapping can be remembered and reused.
5. **Grid and level extraction accuracy on real sets.** No published number exists for vector
   structural DWGs from real, varied offices.
6. **Numbers behind the paywalled papers** (ABGS [S16], Zhao et al. [S18], the line-text
   extraction paper [S51]). Their accuracy figures were not read.
7. **What IfcOpenShell's PyPI wheel bundles** (OpenCASCADE, CGAL) and those libraries' licence
   terms. The install docs name OCCT and libcgal-dev [S52]; the licence of the bundled binaries was
   not checked.
8. **That Open viewer performance** on a G+10 model with a few thousand members, and whether its
   Fragments format should be our viewer cache.
9. **Whether a VLM plus constraint loop** in the style of [S12] beats plain rules plus human
   confirmation *on vector input*. [S12] was raster-only.
10. **The real QS effort per sheet** in the confirmation UI. GTJ users are trained operators; our
    users' time budget is unknown.
11. **IFC4 or IFC4X3 as the export default.** Check what the downstream tools (BOQ, 5D, 4D) and
    That Open read best.

---

## 8. Recommendation to the owner (one line)

Build a **vector-first, confirmation-driven** pipeline:
- **Read:** LibreDWG (subprocess), then ezdxf.
- **Propose:** rules plus small AI classification.
- **Confirm:** one click from the QS per fact.
- **Model:** IfcOpenShell to IFC4.
- **View:** That Open.

Prove it on two or three real consultant sets before building anything else. **The confirmation
UI, not the recogniser, is the product's core.**

---

## 9. Sources

- [S1] GNU LibreDWG home: https://www.gnu.org/software/libredwg/
- [S2] LibreDWG manual (programs; DXF output; unstable classes): https://www.gnu.org/software/libredwg/manual/LibreDWG.html
- [S3] CVE-2025-61154 (LibreDWG heap overflow): https://www.sentinelone.com/vulnerability-database/cve-2025-61154/ ; CVE-2026-9500: https://cvefeed.io/vuln/detail/CVE-2026-9500 ; issue #1251: https://github.com/LibreDWG/libredwg/issues/1251
- [S4] LibreDWG releases: https://github.com/LibreDWG/libredwg/releases
- [S5] ezdxf ODA File Converter add-on: https://ezdxf.readthedocs.io/en/stable/addons/odafc.html
- [S6] ODA File Converter: https://www.opendesign.com/guestfiles/oda_file_converter
- [S7] ODA pricing (from a search summary; page not directly fetched): https://www.opendesign.com/pricing ; membership rules: https://www.opendesign.com/agreements/2023/ODA%20Membership%20Rules%20and%20Policies%20Jan%2012%202023.pdf
- [S8] Liu et al., Raster-to-Vector, ICCV 2017: https://openaccess.thecvf.com/content_ICCV_2017/papers/Liu_Raster-To-Vector_Revisiting_Floorplan_ICCV_2017_paper.pdf ; https://art-programmer.github.io/floorplan-transformation.html
- [S9] Kalervo et al., CubiCasa5K (Tables 2–3 read from the PDF): https://arxiv.org/abs/1904.01920
- [S10] FloorPlanCAD: https://arxiv.org/abs/2105.07147
- [S11] SymPoint (ICLR 2024): https://arxiv.org/abs/2401.10556 ; SymPoint-V2: https://arxiv.org/abs/2407.01928
- [S12] BlueprintAgent (abstract): https://arxiv.org/abs/2609.07362
- [S13] BlueprintAgent (full HTML): https://arxiv.org/html/2609.07362
- [S14] Training-free agentic CV for structural framing plans: https://arxiv.org/abs/2608.17237
- [S15] AECV-Bench: https://arxiv.org/abs/2601.04819
- [S16] Byun & Sohn, ABGS, Sustainability 12(17) 6713 (abstract via Semantic Scholar API): https://doi.org/10.3390/su12176713
- [S17] ABGS summary (search result): https://www.researchgate.net/publication/343757981
- [S18] Zhao, Deng, Lai, AutCon 128 (2021) 103750 (abstract): https://www.sciencedirect.com/science/article/abs/pii/S0926580521002016
- [S19] Sketch2BIM: https://arxiv.org/abs/2510.20838
- [S20] Glodon GTJ2025, overall workflow: https://aecore.glodon.com/doc/GTJ2025/31678f28cd0c412d850ab2d26611700e
- [S21] GTJ2025, point-select column recognition: https://aecore.glodon.com/doc/GTJ2025/f91449bb71b94c35b73233047a3e66d1
- [S22] GTJ2025 feature overview: https://aecore.glodon.com/doc/GTJ2025/21183f4a8e4d45d6bb250bb208fe40ca
- [S23] 橄榄山快模 write-ups: https://zhuanlan.zhihu.com/p/407839018 ; https://zhuanlan.zhihu.com/p/76694105 ; 品茗 / BIM建模助手: https://blog.csdn.net/zh_BIM/article/details/121229634
- [S24] Revit Help, Import Walls: https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-0805BFCA-44E1-4DF4-9875-8238C7AB406E.htm
- [S25] Autodesk Takeoff, Symbol Detection: https://help.autodesk.com/cloudhelp/ENU/Takeoff-Takeoff/files/Symbol_Detect.html
- [S26] WiseBIM AI for Revit: https://apps.autodesk.com/RVT/en/Detail/Index?id=7792821748025964445&appLang=en&os=Win64
- [S27] BIMify (Autodesk App Store): https://apps.autodesk.com/RVT/en/Detail/Index?id=4129344638186376552
- [S28] ACCA BibLus, recognising DXF/DWG entities: https://biblus.accasoftware.com/en/recognize-and-import-a-dxf-dwg-file-in-a-bim-project/
- [S29] Snaptrude Sketch to BIM: https://help.snaptrude.com/en/articles/9739306-converting-a-concept-model-into-a-bim-model-sketch-to-bim
- [S30] GitHub API licence fields (checked 2026-09-25): mozman/ezdxf MIT; art-programmer/FloorplanTransformation MIT; LibreDWG/libredwg GPL-3.0; IfcOpenShell LGPL-3.0; ThatOpen/engine_web-ifc MPL-2.0; ThatOpen/engine_components MIT; xeokit/xeokit-sdk AGPL-3.0
- [S31] CubiCasa5K LICENSE: https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE
- [S32] FloorPlanCAD terms: https://floorplancad.github.io/
- [S33] ACadSharp: https://github.com/DomCR/ACadSharp
- [S34] Aspose.CAD pricing: https://purchase.aspose.com/pricing/cad/python-net/
- [S35] ezdxf, units: https://ezdxf.readthedocs.io/en/stable/concepts/units.html
- [S36] ezdxf, DIMENSION: https://ezdxf.readthedocs.io/en/stable/dxfentities/dimension.html
- [S37] ezdxf, MTEXT: https://ezdxf.readthedocs.io/en/stable/dxfentities/mtext.html
- [S38] ezdxf, VIEWPORT: https://ezdxf.readthedocs.io/en/stable/dxfentities/viewport.html
- [S39] ezdxf, xref: https://ezdxf.readthedocs.io/en/stable/xref.html
- [S40] ezdxf, drawing add-on: https://ezdxf.readthedocs.io/en/stable/addons/drawing.html
- [S41] GTJ2025, column table and detail recognition (search result on aecore.glodon.com): https://aecore.glodon.com/doc/GTJ2025/91fc7465636e4e6cad581612e02c18c4
- [S42] GTJ2025, beam recognition: https://aecore.glodon.com/doc/GTJ2025/4fa1f4f613614e1bb3eea1ac5c4b6778
- [S43] IfcOpenShell API index: https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/index.html
- [S44] buildingSMART, IFC 4.3 approved as ISO: https://www.buildingsmart.org/ifc-4-3-approved-as-a-final-standard/
- [S45] IfcOpenShell README (component licence table, schemas): https://github.com/IfcOpenShell/IfcOpenShell ; PyPI: https://pypi.org/project/ifcopenshell/
- [S46] web-ifc: https://github.com/ThatOpen/engine_web-ifc ; npm registry licence fields for web-ifc and @thatopen/components
- [S47] @thatopen/components: https://github.com/ThatOpen/engine_components ; npm @thatopen/fragments (MIT)
- [S48] xeokit SDK README, "Licensing & Commercial Use": https://github.com/xeokit/xeokit-sdk
- [S49] Benchmarking AEC drawing layout detection (EC3 2026): https://arxiv.org/abs/2607.18997
- [S50] GNU GPL FAQ, #UnreleasedMods, #MereAggregation, #GPLPlugins, #GPLInProprietarySystem: https://www.gnu.org/licenses/gpl-faq.html
- [S51] Automated BIM generation using drawing recognition and line-text extraction (JAABE 2020; paywalled): https://www.tandfonline.com/doi/full/10.1080/13467581.2020.1806071
- [S52] IfcOpenShell installation (dependencies): https://docs.ifcopenshell.org/ifcopenshell/installation.html
