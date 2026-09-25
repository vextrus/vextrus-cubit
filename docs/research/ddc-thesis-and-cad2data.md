# The Data-Driven Construction thesis and cad2data's pipeline idea: what should shape Vextrus's single dataset

Question: what does Artem Boiko's *Data-Driven Construction* (2nd ed., 2025) argue, what is
cad2data's pipeline concept, and which of its ideas should shape Vextrus's single-dataset design?

Date: 2026-09-25. Researcher: background agent (medium effort).

**Sources and how they are cited**
- **The book.** `~/reference/DataDrivenConstruction_Book_2ndEdition_ArtemBoiko_2025_en-US.pdf`.
  - "book p.N" means the **PDF page**. The printed page number is PDF page − 28.
  - Read in full: pp.11–26 (part summaries, introduction, table of contents).
  - Read selectively: pp.76–80, 101–110, 165–172, 179–180, 225–227, 236–258, 306–311, 318–320,
    327–333, 348–351, 375–384, 399–401 and 439–440.
- **cad2data** (MIT parts only), at `~/reference/cad2data-Revit-IFC-DWG-DGN/`:
  - `README.md`;
  - `AI_AGENTS_INSTRUCTIONS/INSTRUCTIONS.md` and `TOOLS_OVERVIEW.md`;
  - the nine `DDC_n8n_Workflows&Pipelines/*.json` files (node lists and key code nodes);
  - `DDC_in_additon/ReadMe_DWG_DDC_converter.pdf` and
    `DDC_in_additon/DDC_python_pipelines/*.ipynb` plus the "Pipeline and DDC terminal version"
    PDF.
- Nothing in `DDC_*_Converters/` was run. No text or code is copied here; everything is
  paraphrased.

---

## 1. The thesis in brief

Construction is one of the last industries still run on expert opinion and manual re-keying rather
than on data (book pp.13–15). Its data is plentiful but split across files and applications that
cannot talk to each other. The fix Boiko proposes is not another application. It is a change of
centre: treat the project as **one structured, machine-readable set of entities with attributes**,
and treat every business task as a transformation of that set (book pp.76–77, 400–401):
- quantity take-off, estimate, schedule, validation, CO₂, reporting.

He makes three moves:
1. **BIM is really a database.** Early BIM writing described a single database of elements that
   kept drawings and schedules in sync. Vendors then shifted the story to geometry and 3D, and
   locked the data behind proprietary formats and APIs (book pp.104–109, 318–319).
2. **Liberate the database.** Use reverse-engineering SDKs (the Open Design Alliance lineage) to
   turn any CAD format into a flat table of elements (rows) × properties (columns), plus
   triangulated geometry keyed by the same element ID (book pp.165–169, 320).
3. **Work on the table, not in the tool.** Once the data is a DataFrame, QTO, validation, costing
   and scheduling are filter, group and aggregate operations. Anyone can express them in a few lines
   of Pandas or SQL, and today an LLM can write them from plain language (book pp.244–251, 327–333).
   These operations chain into automated ETL pipelines that run unattended (book pp.348–351,
   375–384).

The book's own caution is worth keeping: AI adds nothing without good input data and domain
understanding (book p.16), and "data-driven" is a strategy to build, not a product to buy (book
p.17).

---

## 2. Key concepts, each with a citation

| # | Concept | What it says (paraphrased) | Where |
|---|---|---|---|
| 1 | **Silos → one integrated store** | Every task wired to its own table or system forces constant manual reconciliation. Move everything into one repository ("one big table" of entities) so there is a single model, so validation gets simpler, and so analytics and ML become possible. | book pp.76–77 |
| 2 | **Data-centric vs application-centric** | Put the data model at the centre and let logic, UI and agents orbit it. The less complex the data architecture, the less code it needs. Traditional apps are "CRUD plus business logic", and that logic is migrating to AI agents working directly on data. | book pp.77–80 |
| 3 | **Files vs data** | A file is a container for a human to open. Data is linked, queryable and updated automatically. Past projects left as archived files are effectively dead. | book pp.400–401 |
| 4 | **Data atoms** | Break information down to its smallest reusable units, such as resource items in costing and elements in CAD, and store them so they can be recombined. | book pp.399–400 |
| 5 | **Element = geometry + attributes** | Every CAD format, open or closed, carries the same two things per element: geometric parameters and attribute properties. They stay linked by a unique ID, so they can be separated and used independently. | book pp.101–103, 166 |
| 6 | **CAD/BIM → structured form** | Native formats are hierarchical and closed. Converters "flatten" them into an entity table plus a mesh, and the formats become interchangeable as information carriers. | book pp.165–169, 320 |
| 7 | **Mesh over BREP** | For quantities and exchange, tessellated geometry (OBJ, glTF, DAE, USD) is good enough and needs no geometry kernel. Parametric BREP is an intermediate source, not the basis of an exchange format. | book pp.306–310 |
| 8 | **3D → 4D → 5D as attribute layers** | 4D (time) and 5D (cost) are not new models. They are new attribute columns on the same entities, fed by the volume attributes that geometry supplies. 6D–8D add further layers (energy, facility management, safety). | book pp.236, 258 |
| 9 | **QTO = filter + group + aggregate** | Select by category, class or type. Group by rule attributes. Sum length, area, volume or count according to each group's unit of measure. Apply waste or overrun factors. | book pp.240–243 |
| 10 | **Grouping-rule tables** | Keep QTO rules as data: per category, the group-by attributes, the aggregate attribute, a filter expression and a formula or factor. A generic script applies the rule table to any project. | book pp.248–254 |
| 11 | **Resource-based estimating** | A resource database of materials, labour and plant with unit prices. Work items are "recipes" of resources per unit of work. Cost = quantity × recipe, and time falls out of the same recipe's labour hours, which yields a Gantt schedule. | book pp.225–227, 255–258 |
| 12 | **Classification as common language** | Without a shared classifier the same window carries different codes in CAD, estimating and facility management, and loses attributes at each hand-off. Classifiers (MasterFormat, OmniClass, Uniclass and others) are the join key. | book pp.179–180 |
| 13 | **Requirements → validation as data** | Data requirements are tables of attribute rules, often RegEx. Validation is an automated pipeline stage that outputs pass/fail per element ID and ends disputes about whether a model is "compliant". | book pp.318–319, 381–384 |
| 14 | **ETL and pipelines** | Manual ETL is an engineer opening the CAD tool, running plugins and exporting. Automated ETL runs scripts for extract, transform/validate and load (report, PDF, dashboard, other systems) on a schedule, for example overnight so reports are ready by morning. | book pp.348–351, 375–377 |
| 15 | **LOD is overrated for 4D–7D** | Often LOD100 geometry, or even flat DWG drawings, is enough for scheduling and costing. The rest can be calculated or attached to non-geometric elements such as rooms. | book p.311 |
| 16 | **Cross-project big data** | Flattened projects stack into one giant table (thousands of projects, millions of rows) for analytics and ML cost/time prediction. The flat table is extremely **wide and sparse**: about 25–27k distinct attribute columns. | book pp.439–440 |

---

## 3. The converter's flat element table, conceptually

These points come from the converter docs and from the notebooks and workflows that consume the
output. The converters were **not run**, so the exact DWG column set is not known first-hand.

**The shape.**
- One XLSX workbook per source file.
- One row per element, each with its own ID. Columns are every property found on any element
  (`README.md` "Key Features"; `ReadMe_DWG_DDC_converter.pdf` p.1).
- For Revit and IFC, a DAE (Collada) mesh whose element IDs match the XLSX rows. Optional PDF sheets
  and, for Revit, schedules (`README.md` "Supported Formats").
- DWG gives XLSX plus optional PDF sheets only, with no mesh (`TOOLS_OVERVIEW.md` "DwgExporter").

**Typical BIM-derived columns.**
- These appear in the example table in the "Pipeline and DDC terminal version" PDF: ID, Name,
  Category (e.g. `OST_Walls`, `OST_Doors`), Family Name, Type Name, Level, dimensional quantities
  (Height, Area, Volume, Length) and optional bounding-box min/max X/Y/Z.
- Revit export depth is chosen by category set: basic 309, standard 724, complete 1,209 categories
  (`README.md` CLI table).

**Header quirk.** Column headers carry a storage-type suffix of the form "Name : Type". Every
consumer first strips it (notebook `1_DDC_Conversion…ipynb`; the "Validate – Enhanced" node in
`n8n_4_Validation…json`).

**Value quirk.** Quantities sometimes arrive as strings with units, and consumers regex the number
out (`6_DDC_QUICK_QTO…ipynb`). Units may be imperial: the classification workflow converts ft³ to m³
from bounding boxes (`n8n_5…json`, "Group Data with AI Rules").

**The DWG flavour** (book pp.328–330, describing the converted DWG dataframe):
- Rows are drawing entities, with columns such as **Layer**, **ID**, **ParentID** (segments grouped
  into their polyline), **Point** (coordinate tuples as text) and **Area** (on closed polylines).
- Semantics come almost entirely from the **layer name**. The book's wall example filters layers
  containing "wall", rebuilds polylines through ParentID, reads area, and extrudes to a fixed 3,000
  mm height to fake 3D walls.
- The classification workflow likewise treats `Layer` as the category column when no BIM category
  exists (`n8n_5…json`, "Find Category Fields").

**How the pipelines consume it** (`DDC_n8n_Workflows&Pipelines/`, `README.md` §§1–9):
1. **Extract.** Run the converter, or skip if the XLSX already exists, then parse the XLSX into rows.
2. **Transform.**
   - Clean headers.
   - Filter non-building rows (e.g. elements not on the default 3D view, in `n8n_8`/`n8n_9`).
   - Find the category column and the "volumetric" columns by pattern.
   - Group by a chosen parameter (usually Type Name) and aggregate.
   - Optionally, per group, have an LLM:
     - classify against any code system, with RAG over a dictionary (`n8n_5`);
     - decompose the group into work items;
     - match rates by vector search in the CWICR cost database;
     - map units and compute quantity × rate (`README.md` §6.2, stages 0–9);
     - or apply CO₂ factors (`n8n_7`).
   - Validation compares columns against a requirements workbook of category, parameter and rule,
     and colours pass/fail cells (`n8n_4`).
3. **Load.** HTML and XLSX reports, opened automatically. Batch runs add metrics (`n8n_3`).

The README calls the n8n flows "visual process logic templates" to be re-implemented in any
language (`AI_AGENTS_INSTRUCTIONS/INSTRUCTIONS.md`).

**What is notably absent.**
- The pipelines are **stateless and file-based**: XLSX in, report out.
- They have no persistent project dataset, no identity across revisions, no human confirmation
  step, and no provenance from a figure back to its drawing.
- The LLM stages group by *type* and price whole groups. Nothing checks the quantities themselves
  beyond an AI "CTO review" (`README.md` §6.2 stage 7.5).

---

## 4. Which ideas fit a 2D-DWG market like Bangladesh, and which assume BIM

**Fit directly (format-agnostic):**
- **One project dataset of elements × attributes at the centre**, with every module a
  transformation of it (concepts 1–4). This is independent of where the elements come from.
- **4D and 5D as attribute layers on the same elements** (concept 8), and **resource-based
  estimating** with cost and time from one recipe (concept 11). This is close to how PWD Schedule of
  Rates and analysis-of-rates practice already works in Bangladesh (our domain knowledge, per
  `docs/postmortem.md`).
- **QTO as rule tables over grouped elements** (concepts 9–10). IS 1200 / BNBC measurement rules
  map naturally onto per-category grouping rules with factors.
- **Validation as data** (concept 13): requirement rows per category, and a pass/fail per element
  ID.
- **Classification as the join key** (concept 12), using a local code set such as PWD SoR item codes
  rather than OmniClass.
- **LOD100 or flat drawings are enough for 4D–7D** (concept 15). This is the book's own admission,
  and it supports our premise.
- **ETL stages and pipelines** as the shape of ingestion (concept 14).
- **LLM over a flat schema** (book pp.245–246): a simple two-dimensional schema needs no explanation
  to an LLM. That argues for keeping the core element table legible.

**Assume BIM (break on 2D DWG):**
- **"Volumes come free from the geometry kernel"** (book pp.236–237, 306). In DWG there are no
  volumes, only lines, polylines, blocks, text and dimensions. Heights, thicknesses, levels and
  member identity must be *inferred and confirmed*. That is exactly where the old product failed
  (`docs/postmortem.md`, cause 2).
- **Category / Family / Type / Level columns.** A DWG row has Layer and geometry. Category
  depends on layer naming discipline that real consultants do not follow consistently. Type and
  Level exist only in text, legends, schedules and sheet titles.
- **"One line of code gives the QTO"** (book pp.244–247). This is true only once the table is
  semantically complete. For 2D, the hard work is *building* that table. The book's DWG example
  fakes 3D with a constant 3 m extrusion (book pp.330–332), which is a toy, not a takeoff.
- **Mesh geometry keyed by element ID** (DAE output). DWG output has none. We must generate our own
  3D from confirmed 2D data.
- **Rich, pre-filled attribute sets for validation.** Rules such as "FireRating must not be null"
  (book p.384) presuppose a modeller who filled parameters in. With 2D there is almost nothing to
  validate until we have created it.
- **Cross-project big data** (book pp.439–440) presupposes thousands of structured models. In
  Bangladesh that corpus does not exist. It would have to be accumulated through our own confirmed
  projects, which makes it a moat.

---

## 5. Lessons for Vextrus's single-dataset design

1. **Make the dataset the product, and every module a view or transformation of it.** This is the
   book's core claim and matches the owner's brief (`docs/handoff/session-10-prompt.md`, "One
   dataset at the centre"). Estimate, schedule, BOQ, procurement and CO₂ should be attribute layers
   and queries over one element set, not copies of it.
2. **Keep a thin, legible core schema, not a 27,000-column sparse sheet.** The DDC flat table is
   honest but wide and sparse (book p.440), and typed only by a header suffix. Use a small typed core
   (element ID, class/category, level, material, dimensions, quantities with units, classification
   code) plus an extensible property bag. That keeps LLM querying easy (book p.246) without the
   sparsity.
3. **Put what DDC lacks at the centre: provenance and confirmation state per attribute.** DDC
   pipelines are stateless file transforms. For 2D, every attribute of an element must record:
   - its origin: read from the drawing (with the Trace: sheet, entity and handle), inferred, typed
     by the QS, or defaulted;
   - its state: proposed or confirmed.

   This is the postmortem's "Trace" and "honest coverage" (`docs/postmortem.md`, "What is worth
   carrying"), and it is what makes a 2D-derived dataset trustworthy.
4. **Think of our ingestion as DDC's extract step followed by a human-in-the-loop transform:**
   - DWG → raw entity table (Layer, handle, geometry, text), which is roughly what DwgExporter gives;
   - → proposed building elements (walls, columns, slabs, openings) with inferred attributes;
   - → QS confirms or supplies the missing facts at the point of need;
   - → the confirmed element dataset;
   - → derived 3D mesh keyed by element ID.

   Keep the raw entity layer as its own stored stage. It is cheap, re-runnable, and the anchor for
   the Trace.
5. **Store QTO rules, validation requirements and the classification mapping as data (tables).**
   Do not hard-code them (book pp.248–254, 381–384). IS 1200 and PWD SoR rules become rule rows that
   a generic engine applies. The QS can then see and adjust them, and agents can edit them safely.
6. **Resource-based costing belongs next to the dataset from day one.** Recipes of resources per
   unit of work, with prices separated from norms (book pp.225–227; `README.md` "DDC CWICR"), so cost
   and time come from the same quantity. This satisfies "money in the loop early"
   (`docs/postmortem.md`, rules).
7. **Use mesh, not a BREP kernel, for our 3D** (book pp.306–310). Extruded, tessellated elements
   from confirmed 2D data are enough for 4D/5D and for display (glTF). Do not take on a parametric
   geometry kernel for the MVP. IFC export can come later as an output, not as the internal model.
8. **Use the LLM where DDC uses it: for classification and grouping, not for quantities.** DDC's
   LLM stages classify groups, decompose types into work items and match rates (`n8n_5`, `n8n_6`,
   `README.md` §6.2). This matches our finding that small closed judgments are cheap and reliable
   (`docs/postmortem.md`, "AI"). Numbers must come from geometry and confirmed facts.
9. **Revisions need identity.** DDC's per-file XLSX has no notion of "the same element in revision
   B". A single dataset must diff drawing revisions against confirmed elements. This is absent from
   DDC and is needed for the dataset to stay "single" across a project's life.
10. **Licensing.** The DDC converters are proprietary, Community tier "for personal and research
    use only", commercial use needs a licence, and ODA pass-through terms apply (`README.md`
    "Licensing"). Our DWG reading must stay on our own stack (LibreDWG/ezdxf know-how per the
    postmortem, or a separately licensed SDK). That is the owner's call.

---

## What is not known

- **DwgExporter's actual output columns** were not observed. It was not run, and no sample DWG
  output is in the repo. The concrete columns and how it represents the following are unconfirmed:
  - blocks and attributes;
  - text/MTEXT;
  - dimensions;
  - xrefs;
  - paper vs model space.

  The DWG column names above come from the book's example (book pp.328–330).
- The book's QTO speed and ROI figures (e.g. "17 clicks vs one line", book pp.242–244) are the
  author's illustrations, not measured benchmarks.
- The book pages outside the ranges listed were not read.
