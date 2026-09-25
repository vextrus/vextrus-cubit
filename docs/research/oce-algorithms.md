# OpenConstructionERP: algorithms and business logic, six areas

Researched 2026-09-25 against OCE v18.0.0 (commit e7e18cd0e) at `~/reference/openconstructionerp/`,
the cad2data MIT docs at `~/reference/cad2data-Revit-IFC-DWG-DGN/`, the CWICR repository page and the
OCE docs site. OCE is AGPL-3.0. Everything below is a description in our own words, with the path
where the idea lives. No code, schema, prompt, string or data has been copied. Paths are relative to
`~/reference/openconstructionerp/backend/app/` unless stated otherwise.

Method: I read module docstrings and the key functions. I did not run OCE or any converter. "Depth"
is my judgement from reading the code, not from measurement.

---

## (a) BIM/CAD ingestion without plugins (RVT, IFC, DWG, DGN)

**Architecture rule.** OCE bans an in-process IFC or CAD geometry library, IfcOpenShell included.
Every CAD or BIM file is converted by an external program into a "canonical" table (XLSX/Parquet),
plus COLLADA (DAE) geometry where the converter produces it
(`../../DEVELOPING.md` lines 287–304; `../../MODULES.md` "BIM, CAD and coordination").

**What does the converting.** The converters are the proprietary DDC programs
`RvtExporter`, `IfcExporter`, `DwgExporter` and `DgnExporter`: Windows `.exe` files from the cad2data
repo, or Linux `.deb` packages from `pkg.datadrivenconstruction.io`. The installer downloads them
pinned to a commit SHA (`core/converter_source.py`; `modules/boq/cad_import.py` lines 1–50,
`find_converter`, `ensure_converter`). OCE runs them as a subprocess and probes each binary's `--help`
to work out which of two CLI shapes it speaks: v17 positional or v18 flags `-x` xlsx, `-d` dae, `-m`
mode (`cad_import.py` `build_ddc_args`, `detect_converter_capabilities`).

**What each converter emits** (cad2data `README.md` lines 190–196):

| Input | Output |
|---|---|
| RVT | XLSX element table + DAE geometry (+ schedules, PDF sheets) |
| IFC | XLSX element table + DAE geometry |
| DWG | XLSX "database" of AutoCAD records + PDF sheets. **No DAE.** |
| DGN | XLSX only |

`build_ddc_args` confirms the DWG point: DwgExporter has no geometry flag, and passing `-d` to it
aborts the run (`cad_import.py` comment in `build_ddc_args`).

**Extraction.** The XLSX has one row per element. OCE reads its header row, strips the DDC type
suffix (" : Double") and lowercases it, then keeps each row as a dict (`cad_import.py`
`parse_cad_excel`). Quantities come from whatever columns the converter wrote (volume, area,
length, count). `bim_hub/quantity_fallback.py` recovers quantities that sit under unexpected
headers. As a last resort it derives rough quantities from the element's bounding box and tags them
`geometry_bbox`, so a measured value is never overwritten. For RVT, the XLSX `ID` column equals the
DAE `<node id>`, which is how rows pair with meshes in the viewer (`bim_hub/ifc_processor.py`
docstring).

**IFC fallback when no converter is installed.** `bim_hub/ifc_processor.py` contains a
regex-based STEP text parser (about 4,000 lines). It:
- keeps a whitelist of element entity types across IFC2x3, IFC4 and IFC4x3;
- finds quantities by walking `IfcRelDefinesByProperties` → `IfcElementQuantity` → `IfcQuantity*`
  and scales them to SI from the file's unit assignment (`_extract_quantities_for_element`,
  `UnitContext`);
- reads placements;
- writes **placeholder boxes** as COLLADA for the 3D preview (`_generate_collada_boxes`, with
  default extents per type).

So without the proprietary converter, IFC gives real property-set quantities but only fake box
geometry.

**Classification of elements.**
1. Discipline comes from substring rules on the IFC type: door, window and covering are
   architecture; wall, slab, column, beam and footing are structural; pipe, duct and flow are MEP;
   road and alignment are civil (`ifc_processor.py` `_classify_discipline`).
2. Cost-standard codes come from `cad/classification_mapper.py`. A coarse table maps each Revit
   category or IFC class to DIN 276, NRM 1 or MasterFormat. A second table deepens the code one
   level from a normalised material name (German and English synonyms folded together) and a
   fire-rating flag. The tables are deterministic. They are "fallback and confidence anchors" for
   AI suggestions.
3. In the match pipeline, an optional LLM step filters out non-building rows (grids, annotation)
   (`match_elements/pipeline.py` stage "filter").

**DWG path: does anything become 3D or BIM-like? No.**
- `dwg_takeoff/ddc_dwg_parser.py` turns DwgExporter's XLSX of AutoCAD records (line, polyline,
  arc, circle, hatch, text, block reference) into 2D drawable JSON. It parses coordinates to (x, y)
  and discards Z (`_parse_coord_csv` returns a 2-tuple). It also infers units from the extents.
- DXF is read natively with ezdxf. `dxf_processor.calculate_entity_measurement` computes only
  lengths, circumferences, arc lengths and polyline perimeters. `boq/dxf_native.py` adds shoelace
  areas for closed polylines and circles, emits one row per entity, and uses the **layer as the
  category**.
- The DWG-to-matching extractor calls itself "interim" and "stub-style". Full layer-walking and
  block-attribute reading is a to-do (`core/match_service/extractors/dwg.py` docstring). The
  DWG match adapter notes that DWG has no opening or void relations
  (`match_elements/sources/dwg_adapter.py`).
- The only "3D" from 2D anywhere is manual takeoff: a user draws a polygon on a PDF and types a
  depth, and the server computes area × depth (`takeoff/service.py` around line 540).

There is no wall reconstruction, no level stacking, no extrusion to elements, and no IFC
authoring from 2D.

**Depth:** Real engineering around a proprietary core. The RVT/IFC/DWG/DGN readers are the DDC
binaries. OCE's own work is orchestration: the install, the CLI probing, XLSX parsing, the
column-alias normalisation, unit handling, and a careful fallback IFC STEP text parser with
placeholder geometry. The DWG path is 2D entities plus per-entity length and area, and its
extractor for matching is admittedly a stub. Classification is a lookup table plus optional LLM.

**Lesson for Vextrus:**
- OCE does not solve 2D→BIM. It never attempts it. Our 2D→model approach will be original work,
  with no reference implementation to lean on.
- Its canonical element table is the right shape to adopt independently: one row per element,
  with stable id, class, storey, discipline, properties, quantities and bbox.
- Two practices are worth doing: tag each quantity with where it came from (measured, bbox, or
  typed-in depth), and never let an approximate value overwrite a measured one.
- Depending on the DDC binaries is licence-blocked for a competing product
  (`~/reference/README.md`). The open equivalents to evaluate are ezdxf for DXF, the ODA converter
  or LibreDWG for DWG, and IfcOpenShell for IFC, which OCE bans for its own reasons.

---

## (b) Cost database and resources

**Three layers** (`../../docs/US_COST_DATABASE_METHODOLOGY.md` "What you are actually building"):
1. **Work items**: the priced lines, each with code, description, unit, rate and currency.
2. **Components**: stored on the work item as its recipe, the quantity of each labour, material and
   plant resource per one unit of work.
3. **Resource prices**: one price per resource per region.

The stated reason for the split is that recipes change over years while prices change over months,
so a region can be repriced in one pass over a few hundred resources.

**Storage.** A `CostItem` is unique on (code, region). It carries multilingual descriptions,
classification, components (JSON), tags, mass per unit and a price date (`modules/costs/models.py`
`CostItem`). `ResourcePrice` is the per-region price sheet. `RegionalIndex` is a
(region × category × date) multiplier; the lookup takes the latest date that is not in the future
(`models.py`).

**Rate build-up.** A work item's rate is Σ(component quantity × regional sheet price). This is what
makes "coefficient bases", which ship norms but no prices (for example Vietnam Dinh Muc and
Indonesia AHSP), priceable once local prices are entered. Money is handled in Decimal
(`costs/resource_pricing.py` docstring). Assemblies compose rates as
Σ(factor × quantity × unit cost) × bid factor, with a safe parametric formula evaluator for
dimension-driven quantities (`assemblies/service.py` lines 8, 116–171; `assemblies/formula_engine.py`).
Other adjusters:
- `price_index` moves a cost between periods and regions;
- `waste_factors` turns net quantities into gross;
- `norm_expansion` expands a work item into labour, plant and material demand
  (`../../MODULES.md` "Estimating and BOQ").

**Where the data comes from.** DDC's **CWICR** database ("Construction Work Items, Components &
Resources"), from the separate repository `datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR`:
- 55,719 work items and 27,672 resources, in 30 countries and 23 languages (repository page, fetched
  2026-09-25).
- It is built mainly on the Russian GESN/FER state norm system and its CIS successors (ENIR, GESN,
  FER and others), adapted to other markets using World Bank PPP price adjustments.
- **Licence: CC BY-NC 4.0** for the data, with a separate commercial licence; Apache-2.0 for the
  code.
- South Asia coverage is India (Mumbai) only. **Bangladesh is not covered.**

OCE loads a region from Parquet (84 to 85 columns), caches it under `~/.openestimator/cache`, and
indexes it in Qdrant with BGE-M3 embeddings (`costs/cwicr_v3_catalogue.py`, a 48-row region
registry; `../../docs/cost-database-import.md`). Users can import their own Excel/CSV through a
preview step that proposes a column mapping (`cost-database-import.md` "Importing a spreadsheet").
Currency is resolved from the region tag, not stored per row (`US_COST_DATABASE_METHODOLOGY.md`
"Currency"). The Bangladesh currency BDT is known to the ranker (`core/match_service/ranker_qdrant.py`
line 579). A "South Asian schedule of rates" exchange format lists IN, BD, LK and NP, with a CPWD
rule pack (`modules/boq/exchange_formats.py` around line 436). India's public-works rate book is the
nearest analogue OCE has.

**Depth:** Real and well reasoned. The recipe/price split, the price-sheet repricing and Decimal
money are solid. The data itself is imported from CWICR, whose provenance is Soviet/CIS norms
PPP-scaled to other countries.

**Lesson for Vextrus:**
- Adopt the three-layer model (work item → components → regional resource prices) in our own
  schema. It suits Bangladesh well: the PWD and LGED schedules of rates are norm-based analyses of
  rates.
- Do **not** plan on CWICR as our Bangladesh price source. It is non-commercial, it has no BD
  region, and PPP-scaled GESN norms are not how BD quantity surveyors price.
- Our data source is the PWD/LGED schedules and analyses of rates plus local market resource
  prices, and building that is a product task in its own right.
- Keep the price date on every price and a regional index table from day one.

---

## (c) BOQ generation from model elements

OCE has **two** mechanisms.

**1. Rule-based quantity maps** (`bim_hub/models.py` `BIMQuantityMap`; `bim_hub/service.py`
`apply_quantity_maps`, around lines 2757–2990). A rule has:
- an element-type filter and a property filter;
- a quantity source (which property or quantity key to read);
- a multiplier, a unit and a waste percentage;
- a BOQ target.

For every element and every active rule: if the filters match, it reads the quantity, computes
adjusted = qty × multiplier × (1 + waste/100), and records the element, rule and quantity. Elements
missing the property are **reported as skipped, with the reason**, not silently dropped. A dry run is
the default. On a real run it creates an element↔position link (type "rule_based", with the rule id)
and, if the target position does not exist and the rule allows it, a new position whose quantity is
the sum. The ratio of matched to skipped elements is stamped onto that position as a confidence
score. If a project has several open bills, the apply is refused rather than guessed.

**2. Match-elements pipeline** (`match_elements/pipeline.py` docstring; `match_elements/service.py`).
Seven visible, re-runnable stages:
1. **convert**
2. **load**
3. **schema**: an LLM or a heuristic decides, per attribute, whether it sums, averages or takes the
   first value.
4. **filter**: drop non-building categories.
5. **group**: default key is (IFC class, type name). The user can change it.
6. **match**: rank cost items per group.
7. **rollup**

Two parts of the grouping and match logic:
- **Group identity** is a SHA-1 "signature" of the normalised group-by values (lowercased,
  accent-folded, keys sorted, dimension units stripped). A group in project B with the same
  signature as a confirmed group in project A is offered the same cost item. That is a
  cross-project learning loop, and it needs at least 2 prior identical picks before it trusts a
  search-log pick (`match_elements/signature.py`; `service.py` `_PRIOR_PICK_MIN_HISTORY`).
- **Unit choice** for a group follows dimensional specificity: m³ if volume > 0, else m², else m,
  else kg, else pcs. There is a per-IFC-class natural-unit fallback (wall→m³, slab→m², beam and
  column→m, door→pcs, rebar→kg) for when the file carries only counts (`service.py` `_pick_unit`,
  `_IFC_NATURAL_UNIT`).

**The matcher** (`core/match_service/ranker_qdrant.py` docstring; `core/match_service/config.py`):
1. It builds a structured query from the element envelope.
2. It runs one hybrid search in Qdrant: dense BGE-M3 plus sparse, fused by reciprocal-rank fusion.
3. It attaches the full Parquet row.
4. It applies additive, named boosts: a classification-code match, unit match or mismatch, region,
   and prior pick.
5. It clamps the score, sorts, and assigns a confidence band. High is 0.78 or above and medium 0.62
   or above, calibrated on a golden set.
6. Optionally, a local cross-encoder (BGE-reranker-v2-m3, ONNX) rescores, or an LLM reranks the
   shortlist.

High-confidence top picks are **pre-selected for one-click confirm but never auto-committed**.

**Apply to BOQ** (`service.py` `apply_to_boq`): for each confirmed group it creates one position
(description, unit, quantity, rate) and stores the source element ids on it. It then expands the
cost item's components into resource sub-rows, each scaled by factor × parent quantity. Currency
comes from the project, then from the region; it never defaults to EUR. Per-line FX is applied.

The simple path for RVT tables groups by category → type and sums count, volume, area and length.
It rounds item rows first and then sums the rounded values, so the displayed totals reconcile
(`boq/cad_import.py` `group_cad_elements`).

**Depth:** The strongest area. There is a real, deterministic quantity-rule engine with
explainable skips, and a real hybrid-retrieval matcher with transparent boosts, a calibrated band, a
learning loop and human confirmation. What it is **not** is measurement-standard-aware quantity
rules: nothing deducts openings per a method of measurement, and there is no concrete / formwork /
rebar split per element. It trusts the converter's quantities. `use_net_quantities` is accepted but
ignored for DWG (`dwg_adapter.py`).

**Lesson for Vextrus:**
- Take these ideas, in our own words: quantity rules as data with dry-run and skip reasons;
  element→position links that carry provenance (rule id, confidence); group signatures for
  cross-project reuse; a unit chosen by dimensional specificity; named additive boosts plus
  calibrated bands.
- Where we can beat OCE: quantity rules that encode the measurement standard a Bangladeshi
  quantity surveyor uses (PWD/LGED items, BNBC-driven splits), including deductions and
  concrete/formwork/rebar derivation. OCE leaves exactly that to the converter.

---

## (d) 4D scheduling and 5D cost

**BOQ → schedule** (`modules/schedule/service.py` `generate_from_boq`, around line 2397, and
`_calc_duration_from_resources`, lines 205–290). Top-level BOQ sections become summary activities
and positions become tasks. Duration follows a four-step priority, and the step used is recorded on
the activity:
1. Explicit labour-hours per unit × quantity ÷ (crew × hours per day), plus 10% for mobilisation,
   converted to calendar days.
2. Labour-hours summed from the position's labour resources; crew size is the number of labour
   lines.
3. A fallback production-rate table by unit: roughly 4 h/m³, 0.8 h/m², 0.5 h/m, 1 h/pcs and a flat
   8 h per lump sum.
4. The position's share of cost × the total project days. The total defaults to 365 days, or 540
   for offices.

Dependencies are heuristic: sequential within a section, overlapping between sections. The work
calendar is resolved by region.

`core/cpm.py` is a real calendar-aware CPM: forward and backward passes, float, critical path, and
skipping of non-working days and holidays.

**4D link to the model.** Activities link to element sets through **EAC predicates**, a JSON
rules engine over canonical element rows (`schedule/service_4d.py` docstring;
`eac/engine/executor.py`). A snapshot at a date gives each task's status (not started, in progress,
completed, delayed, ahead). SPI = EV/PV and CPI = EV/AC. The result is None, not 0, when the
schedule is not cost-loaded. Clash mode in EAC is deferred for lack of a geometry kernel. The
clash module itself uses AABBs from converter meshes (`clash/__init__.py`, `clash/geometry.py`).

**5D** (`modules/costmodel/service.py`):
- The budget is generated from the BOQ.
- Cash flow spreads each budget line evenly over the months of its window, converted to the base
  currency (`generate_cash_flow_from_schedule`).
- Time-phased PV = Σ(line amount × linear fraction of its window elapsed). The window comes from
  the linked activity, else the line's own period, else the project period (`_time_phased_pv`).
- EVM is standard, with S-curves.
- There is an elemental cost-plan helper (cost per m² GFA, a regional factor defaulting to 1)
  (`costmodel/elemental.py`).
- The docs add Monte Carlo (openconstructionerp.com/docs, "Planning" summary).

**Depth:**
- CPM and EVM are real and conventional.
- BOQ→schedule is a thin heuristic. The durations are only as good as the labour norms on the
  position, and the fallbacks (the unit table, the cost share) are placeholders the code itself
  labels "coarse".
- The dependency logic is not construction logic. There is no sequencing by storey, trade or
  curing.
- The 4D visual depends on converter geometry, so it does not exist for DWG.

**Lesson for Vextrus:**
- Two ideas to take: durations derived from the same resource norms that price the work, which the
  three-layer cost model gives us for free, and recording the source of each duration.
- Real value in Bangladesh would come from sequencing rules (floor-by-floor RCC cycle, curing and
  stripping times, monsoon calendar), which OCE lacks.
- Treat 4D as a later layer. It depends on having model elements first.

---

## (e) Validation rules

**Engine** (`core/validation/engine.py`):
- Rules are classes registered at import time from each module's `validators.py`.
- They are grouped into named rule sets (boq_quality, din276, nrm, masterformat, gaeb, bim, and
  others) that a project turns on.
- Each result carries severity (error blocks, warning needs acknowledgement, info), category,
  element reference and a suggested fix.
- Quality score = weighted passes ÷ weighted total, with weights error 3, warning 1.5 and info 0.4.
  Any error caps the score at 0.5/(1+n errors), so one error can never read as 99%.
- Engine failures are reported separately as "diagnostic" and do not count as findings.
- The docs claim 42 rules run automatically in the background (openconstructionerp.com/docs).

**Examples:**
- BOQ quality (`core/validation/rules/__init__.py`): position has a quantity, a rate and a
  description; no duplicate ordinals; no negative values; total = qty × rate; resource-split sum
  matches the rate; unit-system consistency; lump-sum ratio; cost concentration.
- "Unrealistic rate" and "rate vs benchmark" use **global EUR thresholds** (for example a rate above
  10,000 EUR/m² is suspicious) FX-scaled into the bill's currency. That is crude, not a regional
  benchmark.
- Standards: DIN 276, NRM, MasterFormat and GAEB structure and completeness.
- BIM model (`modules/validation/rules/bim_model_rule.py`, `bim_universal.py`): duplicate ids,
  expected categories, unit consistency, georeference, spatial structure, classification coverage;
  wall has thickness, structural element has material, door has clear width, element has storey.
- IDS files are imported as plain XML into rules (`modules/validation/ids_importer.py`).
- A YAML/JSON **Compliance DSL** with a deliberately tiny grammar (`core/validation/dsl/parser.py`).
- A **natural-language → DSL** builder (`core/validation/dsl/nl_builder.py`) tries a deterministic
  pattern matcher first and falls back to an LLM only when uncertain. The generated YAML must
  re-parse or it is rejected, and the user confirms before it is saved.

**Depth:** Real and broad: an engine, scoring, many concrete rules, the DSL, IDS. The weak spot is
the numeric plausibility rules. They are global constants, not data-driven by region or trade.

**Lesson for Vextrus:**
- Take these ideas, in our own words: validation as a core engine with severity semantics, a
  capped quality score, diagnostics separated from findings, and an NL→DSL path that must re-parse
  and be confirmed by a person.
- Where we can beat OCE: plausibility checks grounded in BD data (rate bands per PWD item, steel
  kg/m³ of concrete per member type, BNBC checks), rather than EUR constants.

---

## (f) AI features

**Providers and models.** OCE calls providers over plain HTTP with no SDK. Supported providers
include Anthropic (aliases resolve to claude-sonnet-4-6, claude-opus-4-8 and claude-haiku-4-5),
OpenAI (gpt-4.1 and gpt-4o families), Gemini 2.5, Mistral, DeepSeek, Grok, and local Llama via
Ollama. The user brings their own key (`modules/ai/ai_client.py` lines 1–40; `core/ai/pricing.py`).

Retrieval runs locally:
- BGE-M3 embeddings via fastembed/ONNX, with multilingual-e5-small as the legacy model;
- a BGE-reranker-v2-m3 cross-encoder on CPU (`core/match_service/reranker_bge.py`).

**Tasks:**
- **AI Estimate Builder** (`modules/ai_estimator/service.py`, `tools.py`). Four stages:
  Understand → Group → Match → Assemble. Each ends at a human-confirm checkpoint enforced by a
  state machine.
  - The LLM understands, groups and reasons, but **may not invent a rate or code**. Its tools return
    only real cost-database candidates: grounded search, the resources matcher, an LLM rerank of the
    shortlist, the resource breakdown, and "flag for human".
  - Only the server may set "confirmed/overridden", and it records who decided.
  - With no AI key, the path is deterministic (top-1 grounded match).
  - Validators check rate grounding, currency, low confidence and completeness
    (`ai_estimator/validators.py`).
- **Quick AI estimate** from text or a photo produces BOQ items (`modules/ai/service.py`). This is
  the thinner, older path: the LLM proposes items directly.
- **Match reranking** by LLM over the vector shortlist. It is off by default to save tokens and
  degrades to vector matching (`match_elements/matchers/llm.py`, `vector.py`).
- **Pipeline helpers**: an LLM classifies attribute aggregation, filters non-building elements and
  picks group keys (`match_elements/pipeline.py`).
- **Takeoff**:
  - offline vector-PDF recognition proposes rooms, lengths and counts (`takeoff/recognize.py`);
  - OpenCV raster recognition of scans uses deliberately low confidences of 0.4–0.6
    (`takeoff/raster_recognize.py`);
  - a vision-LLM plan reader only **proposes** scale, room polygons and symbols, and deterministic
    code owns every number and recomputes areas (`takeoff/plan_read.py`);
  - scale is read from title-block text (`takeoff/scale_detect.py`).
- **Clash AI triage**, cached per (subject, prompt version, model), with a replayable audit trail
  (`clash_ai_triage/service.py`). There are also the compliance NL builder, voice capture and
  estimate-basis drafting (`../../MODULES.md`).
- The cad2data n8n workflow 6 (MIT) shows the older, cruder pattern. An LLM detects header fields,
  classifies building versus non-building, then an agent **estimates prices per type group from its
  own knowledge and web search** for a chosen country
  (`DDC_n8n_Workflows&Pipelines/n8n_6_…json` sticky notes). OCE's later estimator explicitly
  forbids that.

**Propose / confirm pattern** (consistent across the code, and stated as a principle in
`../../DEVELOPING.md` lines 296–304):
- the AI proposes with a real confidence and a reason;
- deterministic code recomputes every number;
- nothing is written until a person confirms;
- confirmation is recorded with who confirmed it;
- every feature degrades to a no-AI path.

**Depth:** Mixed. The estimator's grounded-tool design and the takeoff split between proposal and
deterministic geometry are real and careful. The quick text/photo estimate and the n8n pricing flow
are thin prompt wrappers. The matcher, whose "AI" is mostly retrieval, is the deepest part. No model
is trained or fine-tuned; all AI is prompting plus retrieval.

**Lesson for Vextrus:**
- Take the principle, re-expressed: *AI proposes from grounded candidates, code owns every number,
  a person confirms, provenance is recorded, and there is a no-AI fallback.* It is the same rule our
  postmortem needs.
- Adopt "the LLM may only choose among ids the tools returned" as law for any rate or code.
- Avoid the n8n-6 pattern of an LLM pricing from its own knowledge.

---

## Summary of what OCE does not give us

- No 2D→3D or 2D→BIM. The DWG path gives 2D entities, lengths and areas, with layer as category.
- No Bangladesh cost data. CWICR is also CC BY-NC.
- Quantities depend on the proprietary DDC converters for RVT, DWG and DGN, and for real IFC
  geometry.
- No measurement-standard quantity logic (deductions, element → concrete/formwork/rebar).
