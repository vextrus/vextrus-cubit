# One Live Model per Building, or linked discipline models?

Question (the owner, 28 Sep 2026, grill Q31): now that every Discipline (structural, architectural and
MEP) is to be read into the Live Model as Elements with identity (grill Q29), should one Building hold
all of them in one model, or should Vextrus build a structural or architectural model first and an MEP
model separately, linked to it, as Revit practice does with discipline templates and linked models?
Which choice serves the Priced BOQ, Revisions, Checks and the viewer best, and what goes wrong later
with each?

Researched 28 Sep 2026 for session 02. Inputs read: `docs/intent.md`, `CONTEXT.md`, ADRs 0003, 0007,
0009, 0015, 0022, 0027, 0035, 0036, 0037 and 0039, `docs/data-model.md` §3.2–3.4,
`docs/research/component-attributes-and-classification.md`, `docs/research/glodon-bim-2.md`,
`docs/research/edison-check-session-02.md`, `docs/research/oce-data-model.md`, the grill record
(`docs/reviews/session-02-grill.md`, Q29 and Q31), and the drawing analyst's notes on Edison's MEP DWGs
(`.private/work/session-02/mep-read/NOTES.txt`; conventions only are carried here, never content).
Terms are `CONTEXT.md`'s.

**Confidence.**
- **High:** a primary source says it and I read it (vendor documentation, a standard's text or its
  source repository, official guidance).
- **Medium:** plain inference from a primary source, or a primary source that marks itself incomplete.
- **Low:** my judgement.

Sources are `[F#]`, listed at the end. Nothing was measured on this machine for this file.

---

## 0. What is unmeasured, uncertain or blocked (read first)

1. **No source measures one store against federation for a QS.** Every reason given for splitting
   models is organisational (who authors, who is responsible, who may overwrite whom) or a limit of
   file-based tools (memory, file size). None is about the accuracy of quantities. The recommendation
   below is therefore reasoned from documented behaviour, not measured.
2. **Nothing about MEP at Vextrus's scale is measured.** The session-02 component-store prototype
   measured storage and queries at 1.5 M Elements (ADR 0037), which covers the store. The viewer's
   budgets (ADR 0022: ≤ 100 draw calls, 60 fps) have **not** been measured with MEP Elements added
   (conduit and pipe runs are many small pieces). This is open whichever option is chosen.
3. **Vextrus's own MEP evidence is one set from one office** (Edison's electrical and plumbing DWGs,
   read by a drawing analyst in session 02). Conventions such as "the MEP plans carry the structural
   grid" are n = 1.
4. **Glodon:** I read GQI **2021**'s documentation (the page that documents importing the civil model),
   not GQI 2025/2026, and GTJ2025's. Glodon does not say *why* civil and MEP takeoff are separate
   products. The Cubicost (TAS/TME) help centre refused TLS connections from this machine, so the
   export line is unread.
5. **ISO 19650-1 clause 10.4 and Annex A** (the federation strategy and its examples) were not read:
   only the free sample of ISO 19650-1:2018 (clause 3, terms) [F23] and the UK guidance that explains
   clause 10.4 [F24]. The UK guidance's own chapter on federation strategy is **an empty placeholder**
   "to be populated in a future edition" [F25]. ISO 19650-1 and -2 are being revised (drafts at stage
   40.93, `component-attributes-and-classification.md` §6).
6. **Revit help pages come from several releases (2020–2025).** The "When to link" page quoted is the
   2020 edition [F2]; I did not confirm it is unchanged in 2026.
7. **Speckle:** I found no documented relation between objects in *different* models; its proxies
   relate objects inside one model's version [F38]. That is an absence in the docs, not proof.
8. **Autodesk's AEC Data Model and Forma:** only the API's constructs and known limitations were read
   [F41][F42].
9. **IFC relation texts come from the IFC 4.3 source repository's branch head** (`ifc4.3-main` at
   `6754caa287`, 24 Sep 2026), not the sold ISO 16739-1:2024 text; the head marks some relations
   deprecated that the ISO edition may not.
10. **Unknown about the market:** whether Dhaka Developers use a separate MEP QS or engineer for MEP
    takeoff (it decides whether write permission must split by Discipline), whether MEP drawings
    typically arrive later than structural and architectural ones, and whether Dhaka consultants
    coordinate their 2D drawings across disciplines at all.

---

## 1. Conclusions

### 1.1 The answer in one paragraph

Discipline models in BIM separate **authorship and responsibility**, not identity. Revit's own help
says linking is "primarily intended for linking separate buildings" and, for disciplines, is used when
"each discipline works in its own edition of a building model", by "different design teams" [F1][F2];
the costs it lists are no joining or clean-up across links, duplicated identity data, and project
standards drifting apart [F2]. When one small team at one office works on a building, Autodesk
documents the other pattern: **one workshared model** with worksets per discipline and a "Shared
Levels and Grids" workset "editable only by the project manager" [F10]. ISO 19650's unit of
responsibility, the information container, need not be a file: it is "a named persistent set of
information retrievable from within a file, system or application storage hierarchy", including a
"distinct sub-set" of a file, and databases are named as structured containers [F23]. Database-backed
platforms keep **one repository per asset with discipline partitions inside it**: a Bentley iModel
"holds information about a single infrastructure asset", has "a single spatial coordinate system",
and is "comprised of many Models", one responsible party per Model, so "one should not model multiple
disciplines in a single Model" but they sit in one database, where every Element has "a unique 64-bit
*local* identifier" [F27][F28][F57];
its connectors sync many external sources into that one iModel, each under its own Subject [F33]. Glodon's
QS line holds structure and architecture in one GTJ project and all MEP disciplines in one GQI project,
which imports the GTJ model as a **read-only, replace-on-reimport reference** to compute sleeves and
chases [F43][F44]. Vextrus differs from Revit in the fact that decides it: **it authors nothing; one
party, the Developer's QS, confirms every Element from every consultant's drawings.** The separation that
federation buys (each firm owns its file and issues it on its own cycle) Vextrus already has in its
source layer: Sheets carry their Discipline, and Revisions are per sheet (ADR 0015). So the
recommendation is **(A): one Live Model per Building, one identity space, with Discipline as a
partition** (on each Element Family, with its own Takeoff Steps, Drafting Profile, Confirmation state
and Attribute Definitions), sharing the Building's storeys and grid, with typed cross-discipline
relations and Checks. A per-discipline file or IFC export, if a client ever asks, is then a reading of
the model, not a second store. Confidence: High for the evidence, Medium for the inference.

### 1.2 Why the BIM world splits models, and whether each reason applies to Vextrus

| Reason for separate discipline models | Evidence | Does it apply to Vextrus? |
|---|---|---|
| Different firms author, and each is responsible for its own work | Revit: link when "each discipline works in its own edition"; "different design teams" [F1][F2]. ISO 19650: containers let "multiple appointed parties … create information simultaneously … removing the risk of them overwriting each other's information" [F24]. iTwin: "a single party should be responsible for all Elements in a given Model" [F29] | **At the source, yes; at the model, no.** Each consultant office's work stays separate as its Discipline's Sheets, Sheet Revisions and Drafting Profile (ADRs 0015, 0039). The Elements are confirmed by one party, the Developer's QS (ADR 0007) |
| Separate issue and revision cycles | Speckle: split models "when ownership, discipline, package, or release schedule differs" [F35]; ISO 19650: each container carries its own status and revision [F24] | **Yes**, and already handled: Revisions are per sheet and change only the Elements on the sheets reissued (ADR 0015). A Discipline's reissue is a Revision of its sheets |
| File size and performance | Revit "opens the linked model and keeps it in memory. The more links a project contains, the longer it can take to open" [F1] | **No for the store** (Postgres; 1.6 ms for a filtered query at 1.5 M Elements, ADR 0037). **Unmeasured for the viewer** with MEP added (§0.2) |
| Different tools, templates and settings per discipline | Revit's templates hold "view templates, loaded families, defined settings"; "select the template that best reflects your discipline" [F14] | **As data, yes; as separate models, no.** Revit's own view discipline works "whether you are using a single model that incorporates multiple disciplines, or the model links to other discipline-specific models" [F13]. Vextrus's "template" per Discipline is its Element Families, Attribute Definitions, Takeoff Steps, Measurement Rules, Checks and Drafting Profile, all data (ADRs 0009, 0037, 0039) |
| Concurrent editing without overwriting | Worksharing exists so "multiple team members … work on the same project model at the same time" [F4]; ISO's breakdown structure removes "the risk of them overwriting" [F24] | **Partly.** One QS team per project today; if a separate MEP QS appears, a Discipline-scoped write permission (row-level) is enough; §0.10 |
| Coordination and clash detection between separately authored models | "designers may be working separately on discipline specific models … These two models need to be coordinated" [F17]; Clash Detective finds "cross-discipline interferences" [F19] | **Changed in kind.** Federation exists to *find* conflicts between models authored apart. In one Live Model the relations are data, and a conflict is a Check that raises a Question (ADR 0027) |

### 1.3 The three options compared

| | **(A) One Live Model per Building, Discipline as a partition** | **(B) Separate discipline models, linked** | **(C) Structure + architecture one model, MEP linked** |
|---|---|---|---|
| Identity | One identity space; a thing drawn by two disciplines is one Element with Traces to both | One per model. Revit's Copy/Monitor *copies* levels, grids, walls and fixtures into the other model and does not copy their Mark [F9][F11]; OCE's element id is "unique only within its model" (`oce-data-model.md`) | One space for the civil model; MEP holds a reference snapshot (GQI) [F43] |
| Storeys and grid | Owned by the Building; every Discipline's sheets register to them | Copied and monitored per model; "derive shared coordinates from only one file" [F12]; misalignment when coordinates are not published [F18] | As (A) inside civil; MEP maps its storeys to the civil ones on import [F43] |
| Cross-discipline relations (hosted in wall, passes through slab, point in room) | Typed rows between Elements, versioned with the model | Across files: hosted elements become "orphaned" when the linked host is moved or deleted [F15]; Autodesk's AEC Data Model: "Linked Revit Models are currently not supported" [F42]; BCF: "IFC-files don't have an unique id" [F20] | Inside civil as (A); civil→MEP through the snapshot, which only allows whole-model adjust, relocate, view or delete [F43] |
| Measurement across disciplines (walls to beam soffit, openings, sleeves, chases, holes) | A pure function over one set of confirmed facts (ADR 0027: "a changed beam depth moves slab and wall heights") | A cross-model join on every Confirmation and Revision | Civil inside; MEP's sleeves and chases computed from the snapshot [F43] |
| Revisions | Per sheet (ADR 0015); a relation whose other end changed is re-checked | Per model; each change must reach every model that copied or monitors it [F6][F7] | Civil revision → MEP re-import, which deletes and replaces the reference [F43] |
| The QS's work | One Takeoff; shared facts confirmed once | Shared facts confirmed per model (the pattern ADR 0007 rejected for sheets) | Once for civil, again at each MEP link |
| Who does it | iTwin (one iModel, discipline Models) [F27][F28]; Revit worksharing for a small team at one office [F10]; Glodon's stated direction (glodon-bim-2.md: "model silos" are the problem) | Revit linking across firms [F2]; Navisworks, ACC, Speckle federation [F17][F19][F37] | Glodon GTJ + GQI as shipped [F43][F44] |

### 1.4 The recommendation, in detail

**(A) One Live Model per Building, one identity space, partitioned by Discipline.**

1. **Where Discipline lives.** On the Element Family (each Family belongs to one Discipline: `pile`,
   `beam` structural; `wall`, `opening`, `room` architectural; MEP families by sub-discipline), and on
   every Sheet (already, data-model §3.2). An Element's Traces may point at sheets of any Discipline: a
   WC drawn in the architect's toilet layout and in the plumbing plan is **one** Element with two
   Traces, and a Check that they agree. This is iTwin's rule: a thing that belongs to several systems is
   modelled once, by the primary responsible party, and "shared" by the others [F29]; iTwin treats two
   parties' copies of one wall as a temporary "non-authoritative duplicate" to be eliminated before
   publishing, "where redundant modeling of the same physical Entity creates problems" [F30].
2. **Each Discipline's "template" is data:** its Element Families (with identity rules per family, ADR
   0015), Attribute Definitions (ADR 0037), Takeoff Steps, Measurement Rules and BOQ Items (ADR 0009),
   Checks (ADR 0027) and the consultant office's Drafting Profile (ADR 0039; offices differ by
   Discipline, so profiles do too). Progress, Coverage and Confirmation state are per Takeoff Step, so
   they are per Discipline without new machinery. The Cost Basis already lets a Discipline stay an
   allowance until its steps are confirmed (ADR 0002), so MEP moves from lump sum to measured step by
   step, as every other Trade does.
3. **The Building owns the storeys and the grid.** They are reference Elements (`storey`, `grid_line`)
   confirmed once in Steps 3–4 from whichever sheets state them, and every Discipline's sheets register
   to them. On Edison, levels are "almost absent from the structural set; floor levels in the
   architectural elevations" (structural levels read 3/15), while the grid's 232/232 axis offsets agree
   across sheets (`edison-check-session-02.md`), and the MEP plans carry the same grid block with the
   structural set's axis offsets; one storey's MEP sheets carried no grid and were registered by
   matching the architect's base plan (mep-read notes). So no single Discipline could own them:
   storeys come mostly from architecture, the grid from structure, MEP depends on both. The structural
   slab level and the architectural finished floor level are **two facts of one storey**, as IFC holds
   them (`ElevationOfSSLRelative`, `ElevationOfFFLRelative` on one `IfcBuildingStorey`) [F51], never two
   storeys. A Discipline whose sheets disagree with the confirmed grid or levels raises a Question.
   This mirrors Revit's workshared pattern, where one person owns "Shared Levels and Grids" [F10], and
   its linked pattern, where levels are copied "from the origination model (typically the
   architectural model)" [F8].
4. **Cross-discipline relations are typed data**, confirmed like facts and versioned with the Model
   Version (data-model §3.3): the kinds IFC already names, so each maps to IFC later (ADR 0035):
   - *voids* and *fills* (an opening in a wall or slab; a door in the opening) [F49];
   - *hosted in* (a socket or switch board in a wall, a light in a ceiling or slab; GTJ's "附属构件",
     elements that "must rely on another element to exist", whose copy and delete follow the host [F44]);
   - *passes through* (a pipe or conduit through a beam, slab or wall; IFC's `IfcRelInterferesElements`
     with `ImpliedOrder` TRUE when one element "creates a void in" the other, FALSE for clash results)
     [F48];
   - *covers* (plaster, tiles or paint on a wall face; a floor finish on a slab) [F54];
   - *in room / bounded by* (a point in a room, for "per point" pricing and room-type specifications;
     `IfcRelSpaceBoundary`) [F52];
   - *spans storeys* (a riser or stack; contained in one storey, "referenced" by the others) [F50];
   - *in system* (a point on a circuit to a distribution board; a fixture on a stack;
     `IfcDistributionSystem`) [F52].
   A relation whose far end is removed or changed by a Revision raises a Question, instead of leaving
   an orphan as Revit does [F15].
5. **Takeoff order.** Keep ADR 0007's building-first order and put MEP after its hosts:
   shared reference (sheets; notes and specification; storeys and levels; grid, with every
   Discipline's sheets registered) → structure (foundations to tanks) → architecture (walls and
   openings, rooms and finishes, roof) → MEP by sub-discipline (plumbing and sanitary; electrical;
   fire; HVAC where drawn) → site works. MEP sheets are read, registered and counted in Coverage at
   Step 1, but their Elements are confirmed after the walls, slabs and rooms that host or contain them.
   GQI needs the civil model before it can compute sleeves and chases [F43], and Revit's documented
   workflow has the architect's levels and grids first and the MEP engineer copying them [F7]. An MEP
   Proposal whose host is not yet confirmed waits, blocked, with that as its Question.
6. **Cross-discipline Checks, not a clash engine, in the MVP.** Checks are pure functions over the
   confirmed state (ADR 0027), so they run on every Confirmation of either side:
   - every hosted MEP Element has a confirmed host (the orphan check);
   - every run that passes through a beam or slab has a sleeve, hole or groove, or raises a Question,
     because each is priced: PWD's SoR 2022 prices "groove cutting in brick work and R.C.C work …
     in wall, lintel, beam" per metre (26.67) and "punching or cutting hole of any diameter in RCC
     floor for sanitary works" each (26.68) [F56];
   - every riser or stack lies inside a slab void on every storey it spans;
   - each fixture drawn by both the architect and the plumbing consultant agrees in type and position;
   - every point lies in a room (per-point pricing and the Developer's Specification by room type).
   General hard-clash detection between MEP runs and structure (what Navisworks and ACC sell [F17][F19])
   is later, and only if Developers want Vextrus to find their consultants' coordination errors (§0.10).
7. **The viewer:** one scene, Discipline as a filter. ADR 0022's "colour, isolate and hide by any
   Attribute" covers toggling and isolating Disciplines if Discipline is exposed as an attribute of the
   Family. Saved filters play the role of Revit's view disciplines: in an MEP view Revit shows MEP
   categories normally and "all other categories display using halftone"; a "Coordination" view shows
   every category [F13]. ACC groups models into views "representing a specific trade, or level" [F17].
8. **Revisions:** per sheet, as ADR 0015. A plumbing reissue changes only Elements traced to the
   plumbing sheets; a structural reissue that moves a beam re-runs the penetration Checks against
   unchanged MEP Elements. Nothing is re-imported or re-linked.
9. **Exports later:** ISO 19650 lets a container be a "distinct sub-set" [F23], and its breakdown can
   follow the delivery team's responsibilities (UK guidance: structural, MEP, mechanical, electrical and
   plumbing containers under a "federated information model" [F25]; Hong Kong's DEVB: building →
   storey → discipline → sub-discipline [F26]). So if a client's BIM consultant ever wants
   `arch.ifc`, `str.ifc` and `mep.ifc`, they are filters of one model sharing GlobalIds (ADR 0037) and
   one coordinate system, which avoids the misalignment ACC documents [F18].

### 1.5 What goes wrong later with each option

**(A), and what to design now to prevent it.**
- *One Discipline's backlog holds the whole Building "incomplete".* Keep completeness per Takeoff Step
  and per Discipline (Coverage and StepProgress already are), never one flag for the model.
- *A separate MEP QS or firm needs write access to MEP only.* Cheap if the Discipline is on every
  Family row from M0 (a row-level policy by Discipline); expensive to retrofit. Whether it is needed is
  unknown (§0.10).
- *Host Revisions ripple into confirmed MEP Elements.* Relations make the ripple visible as Questions;
  without them it would be silent. The cost is Checks that re-run on either side's Confirmation.
- *MEP identity rules are harder than structural ones.* Points have no grid intersection and runs are
  topological (a conduit home run, a stack). This is hard in any option, and must be settled per MEP
  family before its milestone (ADR 0015's rule: identity per family, a mark only a hint).
- *The viewer may exceed its budgets with MEP* (§0.2); measure before MEP's milestone. Per-storey GLBs
  and batching by Family are the usual levers; Discipline filters reduce what is drawn.

**(B) Separate linked discipline models** would reproduce the documented failures of federation:
- *Duplicated identity.* Copy/Monitor makes new elements in the other model and drops their Mark [F9];
  Revit warns that managing "identity data between the host project and the linked models can result
  in duplicate names or numbers" [F2]; iTwin calls such copies non-authoritative duplicates to be
  removed before publishing [F30]. The QS would confirm shared things (storeys, grid, fixtures) once per
  model, the repetition ADR 0007 rejected for sheets.
- *Loose cross-model references.* Hosts orphaned on move or delete [F15]; OCE's ids are unique only
  within a model; Autodesk's own cloud data model does not support linked models [F42]; BCF must ask
  the user to match files by hand [F20].
- *Coordinates.* ACC documents models that looked aligned in Revit arriving rotated because shared
  coordinates were not published [F18].
- *Measurement that spans models* (brick walls to the beam soffit, lintels over openings, sleeves in
  slabs) needs a cross-model join on every change; ADR 0027's "a changed beam depth moves slab and wall
  heights" becomes a synchronisation problem.
- *"Model silos"*, the failure Glodon's own BIM 2.0 paper names (`glodon-bim-2.md`, Ch.2), and the
  opposite of ADR 0035's one identity per Element.

**(C) Structure + architecture one model, MEP linked** keeps the tightest coupling (structure and
architecture, which share walls, beams, lintels, levels and openings) in one model, as GTJ does [F44],
and would let MEP ship later without touching the civil schema. But (A) gets the same staging from
Discipline partitions and milestones. What goes wrong is what GQI documents: the civil model enters MEP
as a reference that can only be adjusted, relocated, viewed or deleted as a whole; a second import
deletes the first; storeys are mapped by hand at each import; sleeves and chases are computed from a
snapshot, and a civil change on site means re-importing [F43]. MEP-drawn fixtures and the architect's
fixtures stay two things; and GQI's own help tells a user whose equipment stands against a wall to draw
a wall element in GQI before rotating the equipment's 3D display [F43], a duplicate of the architect's wall.

### 1.6 For the grill: the question and the recommendation

Recommended ruling for Q31: **(A)**, recorded as an ADR amending ADR 0035 (the Live Model) and ADR 0003
(already reversed on MEP by Q29): one Live Model per Building; Discipline on every Element Family and
Sheet from M0; the Building owns storeys and grid; typed cross-discipline relations in
`building_model`; MEP Takeoff Steps after walls, rooms and slabs; cross-discipline Checks; Discipline
filters in the viewer; per-discipline exports only as readings. Two small things to decide with it:
whether write permission splits by Discipline (ask the owner whether Developers use a separate MEP QS),
and the MEP families' identity rules (settled per family before MEP's milestone). A possible
`CONTEXT.md` addition: **Element Relation** (a typed, versioned link between two Elements: hosted in,
voids, fills, covers, passes through, in room, spans storeys, in system). *Avoid:* link, association,
dependency.

---

## 2. Revit: templates, linking, worksharing, Copy/Monitor

- **Templates are starting settings, not model types.** "A project template can include view
  templates, loaded families, defined settings (such as units, fill patterns, line styles, line
  weights, view scales, and more), and geometry"; "select the template that best reflects your
  discipline and intent" [F14]. Revit's view Discipline property "affects views whether you are using a
  single model that incorporates multiple disciplines, or the model links to other discipline-specific
  models" [F13]. High.
- **Linking is for separate buildings first.** "Linking models is primarily intended for linking
  separate buildings, such as those that compose a campus. You can link architectural models,
  structural models, and MEP models." A linked model is opened and kept in memory; "the more links a
  project contains, the longer it can take to open" [F1]. High.
- **When to link** (2020 edition): "Separate buildings on a site or campus"; "Parts of buildings which
  are being designed by different design teams or designed for different drawing sets"; "Coordination
  across different disciplines (for example, an architectural model and a structural model)". Its
  limitations: "Limited joining and interaction between elements in the host project and elements in
  the linked models will prevent elements from cleaning up or joining"; "managing element names,
  numbers, and identity data between the host project and the linked models can result in duplicate
  names or numbers"; "Separate project standards … can cause models to become unsynchronized"; "linked
  models need to be carefully managed" [F2]. High.
- **Worksharing vs linking.** "Use worksharing when you are working with a single model (one RVT file)
  that will have multiple team members working on it"; "Use linked models when your project contains
  distinct buildings, such as a campus, or when you are working with team members from other
  disciplines" [F3]. The two combine: "If you enable worksharing, your links are contained in
  worksets" [F5]. Revit Server and cloud worksharing extend worksharing across offices [F16]. High.
- **The one-model pattern Autodesk documents.** Copy/Monitor inside a workshared project "is best suited
  to a small interdisciplinary team that is working on a building project at the same office or
  location", with worksets such as "Shared Levels and Grids: editable only by the project manager",
  "Structure", "Mechanical"; the engineers copy levels and grids from the shared workset and are warned
  when they change [F10]. High. *Inference (Medium):* Vextrus's QS team, one party at one Developer
  confirming all Disciplines, is this case, not the multi-firm case.
- **The linked pattern.** "Each team maintains its own edition of the model"; "The structural engineer
  creates an empty structural model and uses Copy/Monitor to copy levels and grids from the linked
  architectural model"; the mechanical engineer does the same for levels [F6]. The engineer starts from
  "a project template that defines the desired views and settings", links and pins the architectural
  model, copies levels and grids, and is notified of changes "when they open the engineering model or
  reload the architectural model" [F7]. Best practices: copy levels "from the origination model
  (typically the architectural model)"; copy columns with "Split Columns by Levels"; Copy/Monitor
  cannot copy multi-segment grids; overuse "can result in performance degradation"; renaming either
  file breaks the monitoring [F8]. High.
- **Copies are new elements.** Copy/Monitor copies levels, grids, columns, walls, floors, openings and
  MEP fixtures; the Identity Data "Image, Comments, Mark" are not copied, and a copy's phase is the
  current view's [F9]. For fixtures, "the architect often creates the building model first, placing
  fixtures", and the MEP engineer copies them into the MEP model and is notified if the architect
  "adds, removes, or changes fixtures" [F11]. High.
- **Shared coordinates** are needed "if you want the position of the model to be known to other linked
  models"; "You should derive shared coordinates from only one file" [F12]. High.
- **Orphans.** An element hosted by an element in a linked model becomes orphaned when "the linked
  element was later moved or deleted"; Mirror or Cut and Paste "delete the original element and create
  a copy with a different ID" [F15]. High.

## 3. ISO 19650: information containers and federation

- **Definitions (ISO 19650-1:2018, clause 3).** *Federation*: "creation of a composite information
  model from separate information containers"; "The separate information containers used during
  federation can come from different task teams". *Information container*: "named persistent set of
  information retrievable from within a file, system or application storage hierarchy", for example a
  "sub-directory, information file (including model, document, table, schedule), or distinct sub-set of
  an information file such as a chapter or section, layer or symbol"; "Structured information
  containers include geometrical models, schedules and databases". *Information model*: "set of
  structured and unstructured information containers" [F23]. High.
- **Maturity.** "Stage 2 … is where a mixture of manual and automated information management processes
  are used to generate a federated information model. The information model includes all information
  containers delivered by task teams" [F23]. High.
- **Why a breakdown and a federation strategy** (UK guidance on ISO 19650-1 clause 10.4): the breakdown
  structure "enables multiple appointed parties to create information simultaneously within different
  containers in an efficient manner … removing the risk of them overwriting each other's information";
  the federation strategy is "a higher-level description of how and why the information model is being
  divided up"; together they give "rules for combining and segregating information containers for
  specific purposes such as management of security, spatial coordination or information transmission";
  they "apply to all information container types, not just geometric models". The lead appointed party
  determines the breakdown structure (the appointing party may set the federation strategy), and "both
  could evolve throughout the life of an appointment". An information model
  "is not just a single or federated geometrical model but a collection of information containers
  however they are created or presented" [F24]. High.
- **Who owns a container.** The UK naming puts the originator and role in each container's ID (the
  example `NEWP-ABC-XX-ZZ-SP-S-0001` is the structural engineer's first specification), with status and
  revision as metadata per container [F24]. The responsibility matrix's breakdown in the UK guidance
  runs "All containers → Federated information model → MEP containers (mechanical, electrical,
  plumbing) / Structural containers", each with a responsible task team [F25]. Hong Kong's DEVB example
  breaks a multi-storey building down by building, then storey, then discipline (structural,
  architectural, building services), then sub-discipline (foundation, superstructure) [F26]. High.
- **For Vextrus** (Medium, inference): ISO 19650 organises *responsibility for information*; it does
  not require one file per discipline, and a partition of a database is a container. The consultants'
  containers are their drawings, which Vextrus keeps as issued (Sheets and Sheet Revisions, per
  Discipline, ADR 0015). The Live Model is the Developer's own information, confirmed by its QS; if it is
  ever delivered under ISO 19650, its Discipline partitions can be the containers.

## 4. Coordination tools: what federation is for

- **ACC Model Coordination:** "designers may be working separately on discipline specific models … These
  two models need to be coordinated … A clash may occur if, for example, a pipe passes through a wall
  without an available pipe penetration." Models uploaded to a coordination space are clash-checked
  automatically; spaces can also be used for "model aggregation" with views "representing a specific
  trade, or level of a building" [F17]. New file versions "trigger a new automatic clash check"; limits
  include 1,000 models per clash-enabled space; and exported models can arrive rotated when "shared
  coordinates [were] either not … published to the linked files, or not … saved into the exported
  file" [F18]. High.
- **Navisworks Clash Detective** searches "your total project model, identifying cross-discipline
  interferences (clashes) earlier in the design process", as a one-off "sanity check" or "an ongoing
  audit check" [F19]. High.
- **BCF** exchanges issues between tools, pointing at components by `IfcGuid` (with an
  `AuthoringToolId` fallback); because "IFC-files don't have an unique id", matching a topic's files to
  the receiver's models "might not be fully automated" [F20]. High.
- **Tekla Structures** treats other disciplines as reference models ("an architectural model, a plant
  design model, or a heating, ventilating and air-conditioning (HVAC) model"), converted to its own
  format, snappable, with change detection between IFC reference versions and optional conversion into
  native objects [F21][F22]. High.
- **For Vextrus** (Medium): every one of these tools exists because the models were authored apart.
  The penetration example ACC gives is exactly a priced item for a Dhaka QS (a sleeve or a hole), which
  in one Live Model is a relation and a Check (§1.4 item 6).

## 5. Database-backed platforms: one repository with partitions, or separate stores?

- **Bentley iTwin / iModel.** "An iModel holds information about a single infrastructure asset"; "Every
  iModel has a single spatial coordinate system"; "An iModel is comprised of many Models"; "Every
  Element is owned by (i.e. contained in) one and only one Model" [F27], and "when stored in an iModel,
  Elements also have a unique 64-bit *local* identifier, called an ElementId" [F57]. The Single Responsible-Party
  Principle: "A Model should have a single responsible-party at any given point in time", which
  "facilitates mapping of Models to ISO 19650 'information containers'"; "Because there are typically
  different responsible-parties for different disciplines, it naturally follows that one should not
  model multiple disciplines in a single Model" [F28]. Models sit under Subjects and partitions in one
  repository [F31]; users "may organize by spatial location … while others may organize by discipline"
  [F32]. A physical thing in several systems is modelled once "in a Model owned by the primary
  responsible party", and "all parties can 'share'" it through `PhysicalSystemGroupsMembers`
  relationships, which therefore cross Models inside the one iModel; "Software should not be too 'rigid' in its
  expectations of how Elements are organized in to Models" [F29]. When architect and structural engineer
  both model a load-bearing wall, the architect's copy is a temporary non-authoritative duplicate, and
  "consistency checks can ensure that all NADs are eliminated before designs are finalized" [F30].
  High.
- **iModel connectors** (the closest analogue to Vextrus reading consultants' files): "Many iModel
  Connectors can be associated with a single iModel and hence the resulting iModel becomes an
  aggregator of many sources of data"; connectors "store enough information about source data to detect
  the differences in it between job-runs"; "Each job generates data in the iModel that is isolated from
  all other jobs' data … each connectors job has its own Subject"; jobs "hold the locks for all of their
  data" [F33]. Federation in iTwin is across *kinds* of data (iModels, reality data, IoT) [F34]. High.
  *Inference (Medium):* one repository per asset, a partition per source and responsible party, one
  identity space; this is option (A)'s shape.
- **Speckle.** A project "contains models and their versions"; "Use separate models to keep ownership,
  review cycles, and version history clear … when teams differ by discipline, area, package, or release
  schedule. Keep related content together when people review and publish it as one unit" [F35][F36].
  Federation assembles separately published models in one viewer scene [F37]. Proxies relate objects
  "by their `applicationId`" inside one version's root collection [F38]. High. *Inference (Medium):*
  Vextrus's QS "reviews and publishes" all Disciplines as one unit, the case Speckle keeps together.
- **IFC 5 (alpha).** One object, addressed by a UUID `path`, can receive attributes from several files:
  the fire-rating example "can be seen as a file from another author (actually every component can be
  authored by different people)", added "as a new 'layer' to the composition" while "the original ones
  from the first author are also still in the original dataset" [F39]. High (for the alpha). Separate
  authorship, one identity: the standard's own direction.
- **That Open** federates IFC files in the browser by taking the first loaded model's coordination
  matrix as the base for the others [F40]. High (source code).
- **Autodesk AEC Data Model:** an ElementGroup is "a part of an AEC project that contains model elements"
  ("Model" or "Design" used interchangeably); a reference property "describes the relationship between
  elements"; and "Linked Revit Models are currently not supported" [F41][F42]. High.
- **OpenConstructionERP** (read for `oce-data-model.md`): an element's converter-assigned id is "unique
  only within its model", with a discipline column and a federation table. High (our reading).

**What recurs:** every platform that stores elements in a database keeps **one repository per asset**
and partitions it by responsibility (iTwin), or keeps per-discipline stores and federates only for
viewing (Speckle, ACC, That Open), and then documents that cross-store relations are weak (AEC Data
Model, BCF, OCE). None of the federating stores offers typed relations between elements in different
models that survive their Revisions.

## 6. QS takeoff tools: how they split disciplines

- **Glodon GTJ2025** (civil takeoff): one project holds both rulebooks ("select the rebar 平法 rules …
  the civil calculation rules and the bill and quota library") with the storeys set in 楼层设置 and the
  grid; it models and recognises shear walls, masonry walls, doors, windows and openings, rooms and
  finishes. Its "附属构件" (doors, windows, openings, slab rebar) must rely on a host: copying a wall
  copies its openings; deleting a door deletes its lintel. An element ID is unique "in the current
  project" [F44]. High.
- **Glodon GQI2021** (MEP takeoff) holds all its disciplines in one project ("六大专业", six
  disciplines, with calculation settings for water supply and drainage, heating and gas, electrical,
  fire, ventilation and air-conditioning). Its "土建模型共享" (civil model sharing) imports the GTJ
  model, exported as a `.gshmd` reference file: the user maps GQI storeys to the civil storeys
  (several single-item projects supported), aligns the civil 0,0 to the MEP 0,0 (manual relocation
  possible), and the import appears as a separate "建筑构件" (building components) discipline on which
  only whole-model adjust, relocate, view-properties and delete are possible; importing again deletes the
  current one. Its stated uses: chases (剔槽) and sleeves (套管) generated "according to the wall and
  slab type", clash checking with automatic avoidance of walls, beams and columns, and re-quantifying
  when "local civil changes during construction" force MEP rework [F43]. High (GQI2021; later versions
  unread).
- **What Glodon ships is (C):** structure and architecture in one model, MEP in another that reads the
  civil one as a snapshot. Glodon does not say why. *Low (my inference):* China prices civil and
  installation works from separate quota books, often by separate cost engineers, and the products
  follow the trades. Glodon's own BIM 2.0 paper argues against the result ("model silos", file-level
  collaboration) and for component-level multi-discipline data (`glodon-bim-2.md`, Ch.2–3).
- **2D takeoff tools measure on the drawing.** CostX's Auto-Revisioning overlays a revised DWG on the
  old one, loads "the initial measurements into the revised drawings", matches lines and flags each
  unreviewed dimension group [F45]. Bluebeam compares revisions by cloud markups or by overlaying pages
  in colours [F46], and carries markups to revised sheets by Batch Slip Sheet [F47]. In their 2D modes,
  measurements belong to a sheet; there is no model, so there is nothing cross-discipline to relate.
  High (vendor docs).
  PlanSwift's guide was not read closely.
- **What a QS gains and loses** (Medium): a per-drawing or per-discipline tool lets an MEP QS work
  alone and keeps each consultant's revision contained; it loses every quantity that depends on two
  disciplines (sleeves, chases and holes by host type; brick walls to beam soffits; points per room),
  which GQI recovers only by importing the civil model. ADR 0007 already rejected sheet-by-sheet takeoff
  for Vextrus.

## 7. The cross-discipline relations a QS and the Live Model need

| Relation | Example in a Dhaka building | Why the QS needs it | IFC's name for it |
|---|---|---|---|
| voids / fills | door and window openings in brick walls; shafts and cut-outs in slabs | deductions from brickwork and slab concrete; door and window counts | `IfcRelVoidsElement`, `IfcRelFillsElement` [F49] |
| hosted in | switch boards and sockets in walls; lights on ceilings or slabs; fixtures on walls | chases per metre in brick or RCC (PWD 26.67 [F56]); orphan Check | no single IFC relation; a box's niche is an opening of type RECESS, one "that does not cut through the element it voids" [F58]; GTJ's host-dependent 附属构件 [F44] |
| covers | plaster, tiles and paint on wall faces; floor finish on slabs | finishes per surface, by room type | `IfcRelCoversBldgElements`, marked deprecated for `IfcRelAggregates` at the branch head [F54] |
| passes through | pipes and conduits through beams, slabs, walls; stacks through every slab | sleeves and holes, each priced (PWD 26.68 "hole … in RCC floor for sanitary works" [F56]) | `IfcRelInterferesElements` (oriented, `ImpliedOrder`) [F48]; a provision for a void is `IfcVirtualElement` PROVISIONFORVOID in IFC 4.3 [F53] |
| in room / bounded by | points and fixtures per room; finishes per room surface | per-point pricing; Developer's Specification by room type; each room enclosed by walls (ADR 0027) | `IfcRelSpaceBoundary` [F52] |
| spans storeys | risers, stacks, the lift core, a column's Storey Band | quantities per storey for the Material Schedule by Construction Stage | `IfcRelReferencedInSpatialStructure` ("A curtain wall might span through several stories") [F50] |
| in system | point → circuit → distribution board; fixture → stack → septic tank | counts per circuit and per board; schedules | `IfcDistributionSystem` [F52] |
| rests on / is cut by (structure ↔ architecture) | brick wall height to beam soffit; lintel over opening; junction ownership | wall volumes, lintels, "owned volumes sum to the whole" (ADRs 0009, 0027) | `IfcRelConnectsElements` family (not read in detail) |
| storey levels | structural slab level vs finished floor level | floor finish thickness; stair heights; wall heights | one `IfcBuildingStorey` with `ElevationOfSSLRelative` and `ElevationOfFFLRelative` [F51] |
| grid | one grid referenced by every Discipline | registration of MEP sheets; positions | `IfcGrid`, "used as an aid in locating structural and design elements" [F55] |

*Where these facts come from on a real set* (Edison, one office, conventions only; mep-read notes and
`edison-check-session-02.md`): the MEP plans are drawn over the architect's base plan; sanitary fixtures
in the plumbing plans are the architect's linework, not MEP symbols, and the architectural DWG carries
some fixture blocks; air-conditioning units appear only as the architect's blocks; the electrical set
repeats the same terminals across several sheet kinds (fixture layout, point conduit, power conduit), so
terminals must be read from one kind of sheet only; riser notes state their storey range. Each of these
is one thing drawn by two consultants or on several sheets: in (A) one Element with several Traces; in
(B) a duplicate to be reconciled.

## 8. Revisions per discipline

- **In federated practice** each model has its own versions and each consumer reacts: Revit notifies a
  monitoring model "when they open the engineering model or reload the architectural model" [F7]; ACC
  re-runs clash checks on each new file version [F18]; Tekla detects changes between IFC reference
  versions [F22]; in Speckle a model is "a stable container" whose "versions carry the evolving design
  snapshots over time" [F35]; GQI re-imports the civil model,
  replacing the old one [F43]; iTwin's connectors "detect the differences … between job-runs" and write
  changesets [F33]. High.
- **In 2D takeoff** revisions are per drawing: CostX carries measurements onto the revised drawing and
  asks for each changed dimension to be reviewed [F45]; Bluebeam slip-sheets markups [F47]. High.
- **In Vextrus** (ADR 0015, already decided): a Drawing Set State maps every sheet to its Sheet
  Revision; a Revision changes only the Elements on the sheets it reissues; matching is per Element
  Family; unchanged Elements keep their Confirmation. Discipline-level reissues are therefore already
  handled. What (A) adds: after any Revision, the cross-discipline Checks re-run, and a relation whose
  other end changed or vanished becomes a Question ("the beam this sleeve passes through was deepened in
  structural rev C"). The Revision Comparison (ADR 0028) can then show the ৳ effect of a structural
  change on MEP items (sleeves, chases) as well as on concrete. Medium (inference).

---

## Sources

Autodesk Revit help
- [F1] About Linked Models (Revit 2020): https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Collaborate/files/GUID-2F5D69C7-A934-481F-A0EF-D1324577F5E1.htm
- [F2] About When to Link Models (Revit 2020): https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Collaborate/files/GUID-656915ED-63D7-4DD8-A198-15E83E8CFBD1.htm
- [F3] Work in a Team (Revit 2021): https://help.autodesk.com/cloudhelp/2021/ENU/Revit-Collaborate/files/GUID-D49CE758-A0F4-4B1D-9CBF-12B0B00F5AB3.htm
- [F4] About Worksharing (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-0FC44807-DF06-4516-905A-4100281AC486.htm
- [F5] About Linking and Worksharing (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-C9B731CA-0F73-4691-8CCA-B1E6456730FB.htm
- [F6] About Copy/Monitor (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-604A097E-3C10-4D1A-B115-9BBB11B88416.htm
- [F7] Workflow: Copy/Monitor for Linked Models (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-6A5B3BBA-77FE-4CFE-9D0C-B347D5C402E2.htm
- [F8] Best Practices: Copy/Monitor (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-C71DDCA8-2AFC-4759-AFA6-714420872661.htm
- [F9] What Elements Can I Copy or Monitor? (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-46735245-3836-4470-99C0-320397718BE6.htm
- [F10] About Copy/Monitor and Workshared Projects (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-5A40AB73-0C77-4E92-A96D-3A36F9B53768.htm
- [F11] Copying MEP Fixtures (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-2BAE6D69-596C-4A2B-8DF9-94C43255BBE7.htm
- [F12] About Shared Coordinates (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-B82147D6-7EAB-48AB-B0C3-3B160E2DCD17.htm
- [F13] About the View Discipline (Revit 2023): https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-5D8831F6-6F15-4BF3-ACEB-06FBC14A5491.htm
- [F14] Project Templates (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Customize/files/GUID-4C16B54A-7ADA-4DEB-A278-C199B1BC4207.htm
- [F15] Review Orphaned Elements from Linked Models (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-CE73C639-A93D-4388-9885-ECA5806551C2.htm
- [F16] Workflow: Collaborating with Revit Models (Revit 2025): https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Collaborate/files/GUID-32A10F90-31F8-49CB-A63A-7060B3C99A99.htm

Coordination tools
- [F17] Autodesk, About Model Coordination (ACC / Forma): https://help.autodesk.com/cloudhelp/ENU/Coord-GS/files/About_Model_Coord.html
- [F18] Autodesk, Model Coordination Frequently Asked Questions: https://help.autodesk.com/cloudhelp/ENU/Coord-GS/files/Model_Coord_FAQs.html
- [F19] Autodesk Navisworks 2026, Overview of Clash Detective Tool: https://help.autodesk.com/cloudhelp/2026/ENU/Navisworks-Clash-Detective/files/GUID-36D9904E-12F3-4F82-8DD3-C2103DB0BC29.htm
- [F20] buildingSMART, BCF 3.0 technical documentation: https://github.com/buildingSMART/BCF-XML/blob/release_3_0/Documentation/README.md
- [F21] Trimble, Tekla Structures 2025, Reference models and compatible formats: https://support.tekla.com/doc/tekla-structures/2025/int_reference_models
- [F22] Trimble, Tekla Structures 2026, Insert IFC models as reference models: https://support.tekla.com/doc/tekla-structures/2026/int_ifc_import

ISO 19650 and its guidance
- [F23] ISO 19650-1:2018, free sample (clause 3 terms; clause 4.2), via iTeh: https://cdn.standards.iteh.ai/samples/68078/c4ead8e9b10a495d8082e034a1f370d9/ISO-19650-1-2018.pdf
- [F24] UK BIM Framework, Information management according to BS EN ISO 19650, Guidance Part 1: Concepts, 2nd edition (July 2019), §6.2, §6.3, §7.2: https://ukbimframework.org/wp-content/uploads/2019/10/Information-Management-according-to-BS-EN-ISO-19650_-Guidance-Part-1_Concepts_2ndEdition.pdf
- [F25] UK BIM Framework, Guidance Part F: About information delivery planning, Edition 1 (Sep 2020), §1.1, §2.0 (empty), §3.3 Figure 5: https://ukbimframework.org/wp-content/uploads/2020/09/Guidance-Part-F_About-information-delivery-planning_Edition-1.pdf
- [F26] Hong Kong Development Bureau, BIM Harmonisation Guidelines for Works Departments, Appendix VIII, Federation Strategy Diagrams and Naming Examples, Figure App VIII-1: https://www.devb.gov.hk/filemanager/en/content_1287/Appendix%20VIII%20-%20Federation%20Strategy%20Diagrams%20and%20Naming%20Examples.pdf

Database-backed platforms
- [F27] iTwin.js, iModel Overview: https://github.com/iTwin/itwinjs-core/blob/master/docs/learning/iModels.md
- [F28] iTwin.js BIS, The Single Responsible-Party Principle: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/data-organization/srpp.md
- [F29] iTwin.js BIS, Organizing Models and Elements: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/data-organization/organizing-models-and-elements.md
- [F30] iTwin.js BIS, Overlapping Systems: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/data-organization/overlapping-systems.md
- [F31] iTwin.js BIS, Information Hierarchy: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/data-organization/information-hierarchy.md
- [F32] iTwin.js BIS, Model Fundamentals: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/model-fundamentals.md
- [F33] iTwin.js, iModel Connectors: https://github.com/iTwin/itwinjs-core/blob/master/docs/learning/imodel-connectors.md
- [F34] iTwin.js BIS, Federated Digital Twins for Infrastructure Engineering: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/intro/federated-digital-twins.md
- [F57] iTwin.js BIS, Element Fundamentals ("ElementIds in iModels"): https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/element-fundamentals.md
- [F35] Speckle docs, Models: https://docs.speckle.systems/workspaces/models.md
- [F36] Speckle docs, Projects: https://docs.speckle.systems/workspaces/projects.md
- [F37] Speckle docs, Model Federation: https://docs.speckle.systems/3d-viewer/federation.md
- [F38] Speckle docs, Core Concepts (collections, proxies, `applicationId`): https://docs.speckle.systems/developers/data-schema/concepts.md
- [F39] buildingSMART IFC 5 development (alpha), commit `1a63082ada` (8 Sep 2026): Examples FAQ https://github.com/buildingSMART/IFC5-development/blob/main/Examples_FAQ.md and https://github.com/buildingSMART/IFC5-development/blob/main/examples/Hello%20Wall/hello-wall-add-fire-rating-30.ifcx
- [F40] That Open engine_components, FragmentsManager (`baseCoordinationModel`): https://github.com/ThatOpen/engine_components/blob/main/packages/core/src/fragments/FragmentsManager/index.ts
- [F41] Autodesk Platform Services, AEC Data Model API, API Constructs: https://aps.autodesk.com/en/docs/aecdatamodel/v1/developers_guide/API%20Essentials/constructs/
- [F42] Autodesk Platform Services, AEC Data Model API, Known Limitations: https://aps.autodesk.com/en/docs/aecdatamodel/v1/developers_guide/knownlimitations/

Quantity takeoff tools
- [F43] Glodon, 安装计量GQI2021 documentation, new-features page ("土建模型共享", "全模型实体显示", "实体支架显示"): https://aecore.glodon.com/doc/GQI2021/ca78ba8882d446beac2451cc8d549a7d
- [F44] Glodon, BIM土建计量平台GTJ2025, 3.3 整体操作流程 (overall workflow, terms): https://aecore.glodon.com/doc/GTJ2025/31678f28cd0c412d850ab2d26611700e
- [F45] RIB Software, "RIB CostX Tips: Updating Drawings with Auto-Revisioning" (vendor): https://www.rib-software.com/en/blogs/rib-costx-auto-drawing-revisioning
- [F46] Bluebeam, Compare original PDFs with their revisions (Revu 20/21): https://support.bluebeam.com/revu/features/compare-documents-vs-overlay-pages.html
- [F47] Bluebeam, Transfer markups with Batch Slip Sheet (Revu 21): https://support.bluebeam.com/revu/how-to/transfer-markups-with-batch-slip-sheet.html

IFC 4.3 (buildingSMART IFC4.x-development, branch `ifc4.3-main` at `6754caa287`, 24 Sep 2026; files under `docs/schemas/`)
- [F48] IfcRelInterferesElements: https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcRelInterferesElements.md
- [F49] IfcRelVoidsElement and IfcRelFillsElement: https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcRelVoidsElement.md; https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcRelFillsElement.md
- [F50] IfcRelReferencedInSpatialStructure and IfcRelContainedInSpatialStructure: https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcRelReferencedInSpatialStructure.md; https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcRelContainedInSpatialStructure.md
- [F51] IfcBuildingStorey (SSL and FFL elevations via Pset_BuildingStoreyCommon): https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcBuildingStorey.md
- [F52] IfcRelSpaceBoundary and IfcDistributionSystem: https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcRelSpaceBoundary.md; https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/shared/IfcSharedBldgServiceElements/Entities/IfcDistributionSystem.md
- [F53] IfcBuildingElementProxyTypeEnum (PROVISIONFORVOID deprecated in 4.3.0.0 for IfcVirtualElement): https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/shared/IfcSharedBldgElements/Types/IfcBuildingElementProxyTypeEnum.md
- [F54] IfcRelCoversBldgElements (marked deprecated for IfcRelAggregates at the branch head): https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/shared/IfcSharedBldgElements/Entities/IfcRelCoversBldgElements.md
- [F55] IfcGrid: https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Entities/IfcGrid.md
- [F58] IfcOpeningElementTypeEnum (OPENING, RECESS): https://github.com/buildingSMART/IFC4.x-development/blob/6754caa287/docs/schemas/core/IfcProductExtension/Types/IfcOpeningElementTypeEnum.md

Bangladesh pricing
- [F56] PWD, Schedule of Rates 2022 (2nd Revised), items 26.67 and 26.68, PDF page 275: https://ss.pwd.gov.bd/document/sor/Final_SoR_2022%20_2nd_Revised.pdf

Repository documents: ADRs 0002, 0003, 0007, 0009, 0015, 0022, 0027, 0028, 0035, 0036, 0037, 0039;
`docs/data-model.md` §3.2–3.4; `docs/research/edison-check-session-02.md`, `glodon-bim-2.md`,
`component-attributes-and-classification.md`, `oce-data-model.md`; `docs/reviews/session-02-grill.md`
(Q29, Q31); `.private/work/session-02/mep-read/NOTES.txt` (not in git; conventions only used here).

**Not refuter-checked.**

## Verified by a refuter (28 Sep 2026, session 02), and what it changes
No claim was refuted outright; four were narrowed:
- **iTwin** says "An iModel holds information about a single infrastructure asset" (one asset per iModel,
  not one iModel per asset); an iTwin "may hold … one or more iModels", and "multiple iModels can be
  oriented relative to one another". Confirmed verbatim: a single spatial coordinate system per iModel,
  "An iModel is comprised of many Models", ElementIds unique within the iModel, "one should not model
  multiple disciplines in a single Model", connectors partitioned by Subject, and the omitted next line:
  "Connector jobs hold the locks for all of their data, so it may not be modified by other iModel
  applications" (write isolation per source).
- **PWD 26.67** is groove cutting for concealing *water distribution pipe work (12 and 20 mm)* in walls,
  lintels and beams (26.67.1 40×40 mm ৳334/m; 26.67.2 75×75 mm ৳550/m, Dhaka), a sanitary item, not an
  electrical chase; 26.68 (hole in an RCC floor for sanitary works, ৳208 each) is as quoted.
- **Revit:** "Linking models is primarily intended for linking separate buildings, such as those that
  compose a campus" (unchanged in 2025 and 2026) and the one-office workshared pattern are confirmed; but
  Autodesk also lists cross-discipline coordination as a use of linking, joining across links is
  "limited" (rooms and ceilings can still be generated from linked geometry), and even inside one
  workshared model the structural engineer copies levels and grids from the shared workset.
- **The AEC Data Model** says "Linked Revit Models are currently not supported": one API's current
  limitation, weak support for a general claim.
- **ISO 19650-1 3.3.12** ("distinct sub-set of an information file … databases") and **Glodon GQI 2021**
  (the civil model imported whole, read-only, re-import replacing it, sleeves and chases from it) are
  confirmed; GQI lets the user choose the storey correspondence rather than mapping by hand each time.

**The weakest step:** the file sets one merged model (A) against linked files (B), and nearly every cost
it lists for B is a cost of file-based tools. It never tests the shape its best evidence describes:
**one database and one coordinate frame, with a separate set of Elements per Discipline, each with one
responsible party and its own locks, duplicates tolerated, and typed relations across the sets**
(iTwin's). That shape has none of the file-level failures, and it does not need the unproven benefit of
merging the architect's and the plumber's WC into one Element; it relates them instead. Whether one QS
confirms every Discipline is unknown (§0.10).
