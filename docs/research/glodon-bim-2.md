# Glodon's "Evolving into BIM 2.0" and what Vextrus should take from it

Question: what does Glodon's whitepaper *Evolving into BIM 2.0: A New Stage for BIM Application and
Development — From Modeling Application to High-Quality Design and Optimized Construction* say, how
much of it has Glodon actually shipped, and what should Vextrus take from it?

Date: 2026-09-25. Researcher: background agent (medium effort).

**Sources and how they are cited**
- The whitepaper: `~/reference/Evolving-into-BIM-2.0_A-New-Stage-for-BIM-Application-and-Development.pdf`,
  44 pages, read in full. Every page has a text layer, which was extracted; every page with a figure
  was also rendered and looked at. **`p.N` is the PDF page number.** The printed folio is N − 5 in
  the body (PDF p.13 is printed page 8). The document has no author or date. It mentions a customer
  cooperation that began in 2024 (p.40), so it is from 2025 or 2026. It closes with a
  forward-looking-statements disclaimer (p.44). It is a vendor document, and it reads like one.
- Web sources are cited as `[W#]`, with the list in §8. Glodon's own statements (the annual report and
  product pages) are primary for what Glodon says it ships. Chinese press and download sites are
  secondary and are marked where they are used.
- The whitepaper's text is not reproduced here. What follows is our summary, with a few short quoted
  phrases.

---

## 1. The thesis in brief

BIM as the industry practises it ("BIM 1.0") is stuck at modelling, visualisation and drawing
output. It is a static, file-based, single-discipline, one-stage activity, often carried out by a
separate BIM team, and it produces little business value (p.9–11). "BIM 2.0" moves the point of BIM
from the model to the data. The model becomes a "living" and continuously updated store of
component-level data. Every discipline, every stage (design → cost → construction → O&M) and every
business function reads from it, and AI works on it. The aim is three outcomes: higher building
quality, higher project benefit and higher construction safety (p.12–21). The value lies in the
integrations: across disciplines, design with cost, design with construction, and design with O&M
(p.22–34). Three things are needed to make it real: component-level cloud software (Glodon's
own), integrated management (EPC as the ideal), and data and responsibility standards (p.35–39).
The paper summarises itself as a "1-4-3-4-3 system": 1 concept, 4 characteristics, 3 goals,
4 scenarios and 3 supports (p.42).

Underneath the language, the argument is **design-led**. The paper assumes the model is born in a
design institute through 3D "forward design" (p.36, p.40), and it promotes Glodon's design products.

---

## 2. Chapter by chapter

### Forewords (p.3–4)
- Lieyun Ding: data is the core factor of production. Design will be "computed rather than merely
  drawn", and construction should be run the way cars are manufactured. BIM's job is to turn
  objects, processes and *business rules* into computable, reusable data assets, which AI then
  depends on (p.3).
- Two former officials: without digitalisation there is no AI. Project-level BIM is the data source
  for enterprise ERP, supply-chain, industry and city data. The paper describes two "leaps": to
  domestic, "secure and controllable" BIM, and from 1.0 to 2.0, meaning static to dynamic and
  isolated to whole-process. Design institutes should lead data production and governance (p.4).

### Ch.1: Why BIM needs redefining (p.6–8)
- Society (p.7): BIM can define a "quality home" at design time, because it makes daylight,
  ventilation, space and performance measurable parameters. BIM is presented as a *product
  definition* tool, not just a drawing tool.
- Industry (p.7–8): a long, fragmented industry chain cannot move from experience-driven to
  data-driven work without one continuous, credible data foundation. AI has a "rigid dependence"
  on high-quality data, and BIM is where that data comes from.
- Enterprise (p.8): firms are moving to EPC and whole-process consulting, and competing on
  systematic capability. BIM lets a firm turn its best practice into *reusable data assets and
  business rules*. The paper calls this business pull the "most realistic" driver.

### Ch.2: What is wrong with BIM today (p.9–11)
- Tools (p.10): mainstream BIM software models form. It does not carry design, cost, construction
  or O&M business logic, so it ends up as a drawing tool. Collaboration is file-level (upload,
  download, convert). There are no component-level increments, versions or real-time sync, and
  consistency breaks down as models grow and changes pile up.
- Data (p.10–11): there are no shared exchange standards and no trusted sharing rules. Each
  participant builds its own model for its own purpose. The result is "model silos", repeated
  modelling and lossy hand-offs.
- Management (p.11): projects are one-off, parties play zero-sum games, and data sharing has no
  organisational basis. A **"two-track disconnect"** forms: a BIM team models on the side while the
  designers, builders and managers keep working the old way. BIM becomes an extra burden.

### Ch.3: What BIM 2.0 is (p.12–21)
- Definition (p.13): a paradigm centred on DATA+AI. It integrates all factors, all disciplines and
  the whole process, and it serves high-quality design and optimised construction. The shift is
  from BM (building modelling) to IM (information management). The paper says the goal is *not*
  more detailed or faster models. Figure 3-1 (p.13) draws "one model through the entire lifecycle"
  and "one model for multiple applications", with feedback from construction flowing back to
  design.
- Table 3-1 (p.14), 1.0 → 2.0:
  - static model → dynamic "live model" with all factors;
  - file-level → component-level collaboration;
  - single discipline → multi-discipline;
  - fragmented → whole-process;
  - at enterprise level, "accumulating a resource library" → "building a digital foundation for
    DATA+AI".
- Full-factor integration (p.15, Fig 3-2): labour, machinery, materials, methods and environment
  feed one live model. That model serves resource allocation, construction organisation,
  scheduling, cost control, and quality and safety. Decisions are made on complete, linked data
  rather than on information "interpreted layer by layer".
- Multi-discipline (p.16, Fig 3-3):
  - a change to a component propagates to every discipline that touches it;
  - people still fix things in 2D, so drawings and models drift apart;
  - the cloud offers a unified data source, versioning, permissions and change traceability.
- Whole-process (p.17, Fig 3-4): the model becomes the main business line. The paper notes that
  this does *not* need one software or one format, only semantic continuity and responsibility at
  the data level. Figure 3-4 is the most concrete diagram in the paper:
  - the design model passes through a "quantity takeoff data completion" step, where
    non-component and rule-based takeoff is added;
  - a cloud quantity-takeoff service feeds a BIM quantity takeoff platform;
  - a detailed construction model (BIMMAKE) and a BIM 5D construction platform follow;
  - an O&M model comes last.
- DATA+AI (p.18–19, Fig 3-5):
  - in 1.0, data is static and discrete;
  - in 2.0, data is the foundation (available, credible, flowing) and AI is the engine
    (recognise, deduce, decide);
  - the loop is "data organization – intelligent deduction – business feedback – continuous
    optimization" (p.19);
  - Figure 3-5's outputs are data taking part in delivery, AI converting data into actionable
    insight ("identify risks proactively and deliver optimization proposals"), and evaluation and
    forecasting for decisions.
- Three goals (p.19–21):
  - Quality: precise product definition, consistent carry-through of design intent, and
    performance verified in advance.
  - Benefit: whole-project value over local savings. Design gets timely cost feedback,
    construction joins design early, and all parties become a "community of interests".
  - Safety: inherent safety checked at design time, and construction risk rehearsed in simulation.

### Ch.4: The integrated scenarios (p.22–34)
Each scenario comes with a named Chinese project and percentage gains. None gives a baseline or a
method.
- 4.1 Multi-disciplinary design (p.23–27):
  - Generative scheme design with ConcettoAI (p.24): master plans, massing and renderings, plus
    real-time cost estimates from preset quotas and market prices. Claim: design cycle −60%.
  - Performance analysis (p.25): sun, daylight, wind, view, pedestrian flow and embodied carbon.
    Claims: about 70% faster, and "100% compliance" with planning limits.
  - Component-level collaboration on "cloud + terminal" (p.26), including AI clash detection and
    AI drawing review. Claims: modelling +30%, MEP coordination −40%, fixes +80%. A Beijing road
    project claims programme −20% and 40 design problems found (p.27).
- 4.2 Design–cost (p.27–29): cost control moves forward into design. Two questions drive it:
  "what to choose" (multi-scheme economic comparison) and "how to control" (design to budget).
  - Figure 4-6 (p.28) rests on three bases: construction big data, AI, and a unified cost
    benchmark. Its first box is "Quantity Takeoff + Historical Data Evaluation".
  - A Changsha hospital claims ¥1.94 M saved, estimate accuracy +22.3% *against empirical index
    methods*, and takeoff efficiency +62.5% (p.28).
  - "Design while calculating, real-time early warning" (p.29, Fig 4-7) runs in four steps:
    target cost with responsibility allocation → quota-based design indicators → real-time
    quantities while modelling → cost analysis. A Wuhan park claims takeoff +57%, budgeting
    +50–60%, ¥1.63 M saved and the building made 1.2 m lower.
- 4.3 Design–construction (p.30–32):
  - The chain is design model → construction detailing model → construction management model,
    covering construction quantities, simulation and fabrication (Fig 4-8, p.30).
  - Site layout and construction organisation are simulated in advance. A Shanghai hub project is
    the example: BIM with GIS, and crane stress calculated rather than read from tables (p.31).
  - Manufacturing-grade detailing produces a BOM for the factory. An MEP plant-room case claims
    210 drawing problems resolved, 95% accuracy of embeds and 35 days saved (p.32).
- 4.4 Design–O&M (p.32–34): user and O&M needs are brought into design, and a digital twin is
  delivered alongside the building. A South China HQ claims −30% renovation, −50% data rebuild
  cost, +15% space use and −12–18% HVAC energy (p.34).

### Ch.5: Three supports (p.35–41)
- Software (p.36–37):
  - The primary support is component-level BIM software, and the paper names Glodon's
    "Digital products (e.g., GNA)". Walls, beams, slabs, columns, pipes and spaces are the data
    units. Geometry, discipline attributes, **cost information**, construction requirements and
    O&M parameters all hang on the same object, and a change to one component updates quantities,
    cost checks and reviews.
  - The paper gives four tests for any BIM software:
    1. component-level data organisation;
    2. cloud collaboration;
    3. connection to business (cost, construction, O&M);
    4. an AI application interface (p.37).
- Management (p.37–38): EPC, whole-process consulting and architect-responsibility systems are the
  ideal. The paper concedes they are "not the only entry point": the realistic path is
  **"scenario-driven, local integration, gradual expansion"**, starting from a clear pain point
  (p.38).
- Standards (p.38–39):
  - One "engineering language" across parties.
  - Data connectors, semantic mapping and service interfaces built for AI.
  - Responsibility for data: who produces it, when it is delivered, how it is reviewed and how it
    is updated, following ISO 19650 (p.38).
  - Until industry standards mature, firms should write their own data rules and delivery
    requirements with a vendor (p.39).
- Case (p.39–41), NGREEN, a Hebei design firm:
  - it piloted BIM teams in 2012, collaboration in 2016 and forward design in 2019, and has worked
    with Glodon since 2024;
  - its path was pilot → small projects → large projects → enterprise standards → company-wide;
  - its long-term goal is "drawing-free" delivery (p.40);
  - the benefits it reports are qualitative (p.41).

### Conclusion (p.42)
BIM 2.0 needs the whole chain to take part. Glodon offers "open platform capabilities" and
positions itself as the partner.

---

## 3. BIM 2.0 against BIM 1.0, and the roles of data, AI and the platform

| | BIM 1.0 (the paper's view) | BIM 2.0 |
|---|---|---|
| What the model is | A geometric deliverable; "form" (p.14) | A component-level data store with cost, construction and O&M attributes; a "live model" (p.15, p.36) |
| Unit of collaboration | The file | The component (p.16) |
| Who uses it | One discipline, one stage, often a separate BIM team (p.11) | Every discipline and stage; the model *is* the business line (p.17) |
| What it yields | Drawings, visuals, clash reports | Decisions: cost feedback, scheme choice, risk pre-control (p.19–21) |
| Enterprise asset | A library of families and templates | A data foundation for DATA+AI (p.14) |

- **Data** is the precondition, and the paper says it must be *credible*, not merely present
  (p.19). The paper is clear that AI without structured, trusted data is empty (p.4, p.8).
- **AI** turns data into recognition, deduction and proposals: clash and code review, cost
  prediction, scheme screening, and risk warnings (p.18–19, p.26, p.29). Throughout, it proposes
  and warns. The paper never describes AI deciding on its own.
- **Platform** means a cloud with a single source of truth, component-level sync, versions,
  permissions and change trace (p.16, p.26, p.36). The paper adds that one format is not required,
  only semantic continuity (p.17).

---

## 4. What Glodon has actually shipped, and what is aspiration

**Where Glodon's money actually is (FY2025 annual report summary [W1])**
- Revenue was RMB 6.068 bn. **Digital Cost** (takeoff, pricing, engineering data, cost management)
  brought in **RMB 4.779 bn (−4.2%)**. **Digital Construction** brought in RMB 846 M (+7.6%, with
  gross margin up from 36% to 58%). **Digital Design**, the business that sells the BIM 2.0
  "forward design" products, brought in **RMB 71.2 M (−21%)**, about 1.2% of revenue. Overseas
  revenue was RMB 240 M (+18%).
- **Reading:** the whitepaper's centre of gravity is design-led BIM. Glodon's business is cost and
  QS. That is where the data, the customers and the renewals are. Even in China, BIM 2.0 is a
  thesis Glodon is still trying to sell to design institutes (it targets "EPC-affiliated design
  institutes" for "integrated design-quantity" benchmarks [W1]).

**Shipped, with evidence**

| Product | What it is | Evidence |
|---|---|---|
| **GTJ** (BIM civil takeoff, now GTJ2026) | 2D CAD / BIM → one civil and rebar model → quantities. National and regional quantity and quota calculation rules are built in. It has "smart drawing recognition" and cloud co-editing | Glodon product page [W2]; our earlier walk of GTJ2025's recognition order (`2d-to-bim-approaches.md`, S20–S22). Recognition accuracy figures ("90%") appear only on download sites and are **unverified** [W3] |
| **GNA** (数维建筑设计, digital building design) | Construction-drawing-stage BIM authoring on Glodon's own GDMP engine, with cloud + terminal. **Its "design-quantity integration" converts the design model into a GTJ model for takeoff** (vendor claim: budget time −60%) | Glodon product page [W4]; annual report [W1]. Press says it was released in July 2022 and used on 100+ projects [W5] (secondary) |
| **Concetto** | AI conceptual design: massing, master plan, rendering and early cost | Annual report [W1]; AI platform announcement [W6] |
| **AI in cost** | AI takeoff (one-click, multi-drawing, for industrial installation and highways), AI pricing (matching quotas to bill items), AI bid evaluation, AI bid clearing (PDF parsing, drafting) | Annual report [W1] |
| **Engineering data** | Zhibiaowang (a cost-index platform) and "Suggested Procurement Prices"; the report says they grew fast while software sales fell | Annual report [W1] |
| **PMSmart** | Project decision tool for the project manager. "Quantities as the foundation, the schedule as the main thread": it pulls GTJ quantities, the schedule, materials and labour together, and AI flags schedule slips, material shortfalls and budget-vs-actual consumption of concrete, rebar and formwork. Claim: 2–4% project profit | Glodon product page [W7]; annual report [W1] |
| **Cubicost** (overseas TAS / TRB / TME / TBQ) | The export version of the takeoff and pricing line: civil, rebar and MEP quantities and billing, sold in Singapore, Malaysia, Hong Kong and Indonesia, with an Indian distributor. Global takeoff and pricing versions for Southeast Asia are planned for 2026 | Glodon 5D BIM page [W8]; annual report [W1]; India reseller [W9] |
| **BIM 5D, BIMMAKE, GSite** | Model-linked schedule and cost on site, a construction detailing model, and site management (in the UK) | Solution pages [W8, W10]; annual report [W1] |

**Aspiration, or unproven as a system**
- The single live model running from design through O&M. Every scenario in Ch.4 is a single
  project case with vendor-reported percentages and no baseline. The shipped reality is a *chain of
  separate products joined by conversions*: GNA → GTJ → GCCP/pricing → BIM 5D/PMSmart. Figure 3-4
  (p.17) shows exactly that.
- Component-level multi-discipline sync in production. It is claimed for GNA, which is used on
  "100+ projects" according to the press [W5]; that is small beside GTJ's installed base.
- Digital-twin O&M and generative design at scale. Both appear only as cases.

---

## 5. How it maps onto Vextrus

### 5.1 Decisions the paper confirms
- **One model, many readings** (p.13, p.17) is ADR-0002 and our CONTEXT definition of the
  Building Model: the Priced BOQ, the Material Schedule and every later module are read from one
  confirmed dataset.
- **Measurement rules sit apart from the model** (ADR-0009). In Figure 3-4 (p.17), Glodon's own
  flow inserts a "rule-based quantity takeoff / data completion" step between the design model
  and cost. GNA does not measure; it hands its model to GTJ, which carries the calculation rules
  [W4]. Glodon, which owns both ends, still keeps geometry and measurement judgement separate. Our
  "pure geometry model plus editable Rule Set" matches that.
- **Credible data before AI** (p.4, p.8, p.19) matches Proposal → Confirmation → Trace. Our
  confirmed Building Model is the "credible" data the paper says AI needs. Unconfirmed machine
  output is exactly what it warns against.
- **No two-track disconnect** (p.11). The paper's sharpest diagnosis is that BIM fails when a
  separate team models while the real work goes on elsewhere. In Vextrus, the QS's own daily
  measuring *is* the modelling (ADR-0007): the Building Model is a by-product of the Takeoff the
  QS must do anyway, not a parallel deliverable.
- **Rebar and civil in one model**: GTJ2026 merged them [W2]. This supports ADR-0010, where rod
  sits on the same element with its Rod Basis.
- **A cost business, not a design business, carries the company.** Glodon's revenue split [W1]
  supports ADR-0001 (the Developer and its QS, not consultants) more strongly than anything in
  the paper itself.
- **Scenario-driven, local integration, gradual expansion** (p.38) is our MVP stance (ADR-0002):
  first money, then cost control, then modules that beta Developers ask for.
- **The model beats the thumb rule.** The Changsha case claims better accuracy than "empirical
  index methods" (p.28). In Dhaka the equivalent is the ৳/sft and rod-kg/sft rule of thumb. A
  model-based Priced BOQ is our answer to it, and a fair pitch line *if we measure it ourselves*.

### 5.2 Where the paper contradicts or diverges from Vextrus
- **The model's origin.** BIM 2.0 assumes forward 3D design by the designer, with "drawing-free"
  delivery as the end state (p.36, p.40). Vextrus builds the model *backwards* from 2D, because
  Revit is rare in Bangladeshi practice (ADR-0004). This is not a conflict of principle: GTJ, the
  product that earns Glodon's money, is also a from-drawings product. It does mean the paper's
  design-side scenarios (generative design, multi-discipline sync, clash review) are not ours.
- **The organisational precondition.** The paper names EPC and whole-process consulting as the
  ideal (p.37). In Bangladesh the Developer usually buys materials itself and engages labour
  contractors, and it also sells the building (ADR-0006, CONTEXT "Labour Contract"). It is already
  the single party that owns cost from estimate to handover. So the integration the paper wants
  EPC to provide is present in our buyer, which strengthens ADR-0001.
- **Drawings stay the truth in our market.** The paper treats 2D edits that bypass the model as a
  defect (p.16). In Bangladesh the consultant's revised DWG *is* the instruction, so Vextrus must
  follow drawing revisions rather than fight them (see §6.3).

### 5.3 What the paper adds
- A **target cost with early warning** (p.29).
- **Multi-scheme economic comparison** (p.28).
- **Change handled per component, not per file** (p.10, p.16).
- **Responsibility for data** in the ISO 19650 sense (p.38).
- **The enterprise's data is its asset** (p.8, p.14).

Each becomes a concrete proposal in §6.

### 5.4 The owner's broader ideas
- **A live project dataset.** The paper's "live model" (p.15) is the owner's idea, described one
  level up. The shipped version of it is PMSmart [W7]. Its pattern of *quantities as the
  foundation and the schedule as the main thread*, with materials and labour attached, is almost
  exactly the path from our Building Model and Material Schedule to cost control (ADR-0002's next
  module).
- **A proactive AI that watches and suggests.** The paper's AI "identifies risks proactively and
  delivers optimisation proposals" (Fig 3-5, p.18) and gives "real-time early warning" (p.29).
  PMSmart ships this as alerts on schedule slip, material shortfall and over-consumption [W7]. The
  paper never has the AI act by itself. That fits our Proposal/Confirmation law: the watcher
  raises a Proposal or a Question, and a person confirms.
- **Historical knowledge per tenant.** The paper's enterprise level (p.8, p.14) and Figure 4-6's
  "Quantity Takeoff + Historical Data Evaluation" and "unified cost benchmark" (p.28) point the same
  way. Glodon's engineering data products (Zhibiaowang indices, suggested prices) grow while its
  software sales fall [W1]. That is evidence that curated historical data is a business in itself.
  Semantic search is not mentioned in the paper; the idea is ours.
- **4D/5D with the project's engineers.** The design → construction detailing → construction
  management model chain (p.30), site and organisation simulation (p.31) and BIM 5D [W8] all
  support it. The lesson from the paper's own "two-track" warning (p.11) is that 4D/5D must be
  done *by the Developer's site and planning engineers in their own work* (setting pour sequences,
  recording progress), not by a separate modelling team.

---

## 6. Ideas to adopt, in our own words

1. **Every confirmed element carries more than geometry.** Hang the Trace, the Storey Band, the
   Rod Basis, the priced BOQ items it feeds, and later its construction stage and progress on the
   element itself, so each new module reads the same object rather than a copy. This is our form
   of "component-level data" (p.36).
2. **Target cost and early warning.** Let the MD set a target (৳ per sft, or a total, per trade)
   for a project. The Priced BOQ shows where it runs over, *while the Takeoff is still under way*.
   This is a cheap first taste of the proactive AI, and it uses nothing we do not already compute.
3. **Follow revisions per element.** When a consultant re-issues a sheet, compare element by
   element. Keep confirmed elements that did not change, raise Proposals only for those that did,
   and show the ৳ effect of the revision. The QS then re-confirms the difference, not the building.
4. **Record who confirmed what, and when.** Make the Confirmation an auditable fact that names the
   person, the time and the Proposal version. This is the paper's "who is responsible for data"
   (p.38) at our scale, and the basis for trusting the dataset later.
5. **Priced variants.** Later, let a Developer price two versions of one building side by side
   (pile or mat, slab depth, brick or block) from the same confirmed model. This is the paper's
   "what to choose" (p.28) in a form a Dhaka MD asks about.
6. **The tenant's accumulated knowledge is a first-class store.** Its Rule Set, Rate Analyses,
   Market Price history, Rod Ratios and finished projects' figures (৳/sft, rod kg/sft,
   cement bags/sft by type and height) make up the "digital foundation" the paper puts at the
   enterprise level (p.14). This is where per-tenant search and benchmarks will live. Whether any
   pooled cross-tenant benchmark exists is the owner's call.
7. **Plan the cost-control module on PMSmart's spine.** Quantities come from the Building Model,
   the schedule is the thread, and materials and labour are recorded against them. Budget and
   actual per element or stage then gives the AI something to watch.
8. **Judge our own architecture by the paper's four tests** (p.37): component-level data, shared
   access, connection to business (cost, procurement, site), and an interface the AI can call. It
   is a useful checklist, not a spec.
9. **Grow the way NGREEN did** (p.40): pilot, then small project, then large project, then the
   Developer's own standards, then company-wide. It is a sensible adoption path to offer beta
   Developers.

---

## 7. What does not carry over to Bangladesh

- **The premise of forward design.** Chinese design institutes are being pushed into 3D authoring.
  Dhaka consultants deliver 2D AutoCAD, and Revit is rare (ADR-0004). The paper's multi-discipline
  sync, AI clash detection and drawing review, and "drawing-free" delivery assume a designer-made
  model that our market does not produce.
- **State and policy scaffolding.**
  - National quota (定额) systems and embedded national calculation rules.
  - The "New Bill of Quantities" policy [W1].
  - "Secure and controllable" domestic software (p.4).
  - "Quality homes" and "China Construction 2035" (p.3, p.7).
  
  Bangladesh's closest anchor is the PWD Schedule of Rates, which private practice uses only as a
  Benchmark Rate (ADR-0006). We have not found a Bangladeshi national BIM or data-exchange standard
  to lean on; this is unverified.
- **The EPC and whole-process consulting framing** (p.37). Our buyer is the Developer as owner and
  builder, not an EPC contractor.
- **Design-to-O&M and digital twins** (p.32–34). Developers hand flats to buyers and owners'
  associations and do not run the buildings, so O&M is not their business.
- **Performance simulation and generative master-planning** (p.24–25). These serve design
  institutes and large sites, not a Developer's G+6 to G+14 plot.
- **Heavy site technology.** Intelligent tower cranes, IoT, CV safety cameras and GIS digital
  twins (p.31; [W1]) assume a mechanised, well-instrumented site. A typical Dhaka Developer site is
  labour-heavy, so this should be treated as later and optional. That is our judgement; we have no
  measurement.
- **Vendor numbers.** The −60%, +70% and 100% figures in Ch.4 are single-project, self-reported and
  without baselines. None should be repeated as evidence, in our material or to the owner's
  customers.

---

## 8. Web sources

- [W1] Glodon Company Limited, *Annual Report 2025 (Summary)*, English, stock code 002410 (pp.2–13
  used: segment descriptions, segment revenue, overseas business, AI deployment, 2026 plan).
  https://pdf.dfcfw.com/pdf/H2_AN202603231820704486_1.pdf
- [W2] Glodon, GTJ2026 product page (广联达BIM土建计量一体化平台GTJ2026).
  https://www.glodon.com/product/145.html
- [W3] Download-site description of GTJ2026, the source of the "99% import / 90% recognition"
  figures, **not trusted**. https://soft.china.com/software/1768973.html
- [W4] Glodon, GNA product page (广联达数维建筑设计): cloud + terminal, the design model turned into
  a GTJ model, budget time −60%. https://www.glodon.com/product/413 (redirected from
  https://m.glodon.com/mobile/product/detail/413)
- [W5] Press on GNA: release history, 100+ projects (secondary).
  https://www.sohu.com/a/960294014_122562325 and
  https://baike.baidu.com/item/%E5%B9%BF%E8%81%94%E8%BE%BE%E6%95%B0%E7%BB%B4%E5%BB%BA%E7%AD%91%E8%AE%BE%E8%AE%A1%E8%BD%AF%E4%BB%B6/67903259
- [W6] Glodon, "Glodon Unveils AecGPT and AI Platform for Construction Industry" (2024), via the
  search summary; the page body was truncated when fetched.
  https://www.glodon.com/en/insights/glodon-unveils-aecgpt-and-ai-platform-construction-industry-china-digital-building-summit-2024-371
- [W7] Glodon, PMSmart product page. https://www.glodon.com/product/418.html
- [W8] Glodon, 5D BIM Digital Cost Management Solution (Cubicost TAS/TRB/TME/TBQ).
  https://www.glodon.com/en/solutions/5d-bim-digital-cost-management-solution-7
- [W9] Futurelayers, Indian Cubicost distributor. https://futurelayers.com/product/cubicost/
- [W10] Glodon, BIMMAKE product page. https://www.glodon.com/en/products/bimmake-8

## What we do not know

- Glodon's real recognition accuracy on 2D sets. Its official pages say "smart recognition"
  without figures, and the only figures we found come from a download site.
- Whether Cubicost reads DWG into a model the way GTJ does. The English solution page does not say
  so [W8], and cubicost.com did not resolve when fetched.
- Whether Glodon sells in Bangladesh. We found an Indian distributor [W9] and nothing for
  Bangladesh.
- How many projects run on the "live model" end to end. The paper gives cases, not counts.
