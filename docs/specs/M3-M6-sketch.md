# M3–M6 and after the MVP: sketched as far as the foundation needs

Written in session 02 (28 Sep 2026), under the owner's delegation: "Take every necessary actions, update
and write all files to end the session." This is a sketch, not a spec. Each milestone gets its own spec,
grill and sign-off when its turn comes. The sketch exists so that M0–M2 build nothing a later milestone
has to tear out: for each milestone it gives the finish line (from `docs/milestones.md`), what it rests
on (ADRs and tables), what M0–M2 must already hold, and what its grill must settle. Terms are
`CONTEXT.md`'s; where this page and an ADR disagree, the ADR wins.

**The line.** After M2, M3 (MEP), M4 (rebar and more than one Building) and M5 (Revisions and PDFs) run
in sequence, because each changes the engine's reading. M6's operations work runs beside M4 and M5; the
founding Developers are onboarded once M4 is done, before M5 (the owner's rulings: "M4 first", 26 Sep
2026; session 02 Q29: "Agree with your recommendation B on Q29."). No dates (ADR 0019).

## M3 — MEP read

**Finish line.** MEP enters the Live Model as Discipline Parts (ADR 0040): equipment (lifts, generator,
substation, boards, pumps) and terminals (electrical points, sanitary fixtures through the architectural
reader, fire devices where drawn) read as Elements with identity and Element Relations (hosted in, in
room, passes through, same thing as); risers read by diameter and storey; pipes and sub-mains priced by
QS-confirmed rules per point and per fixture until true run lengths are read after the MVP; the legend
proposes each MEP office's Drafting Profile; board schedules and single-line diagrams as Checks on N; a
missing discipline (such as fire) raised as a Question, never read as zero. Until an MEP Part is read,
the MEP template's ৳/sft lines are its allowances. One Held-out Set with MEP drawings is scored blind.

**The depth, as ruled** (Q29, Q31, Q32; ADRs 0040, 0007; `docs/specs/bd-defaults.md`, MEP conventions):
- **Equipment** as Elements, ratings from the single-line and pump diagrams or asked. A lift's stops come
  from the storeys its core serves; capacity, speed, stops and brand type are figure-feeding Attributes;
  it is priced as supply plus installation (PWD's 2026 lift schedule).
- **Terminals** as Elements, one per storey per symbol, *in room* and *hosted in* their wall or ceiling:
  electrical points; sanitary fixtures from the architect's base plan (M2's wall filter already holds
  them as fixture candidates), related *same thing as* any plumbing symbol for the same fixture and priced
  once; fire devices where drawn.
- **Risers** by diameter and storey, one Element per storey, *spans storeys* through each slab.
- **Runs are priced by rule, not read as lengths.** A point is PWD's point, its circuit wiring inside and
  the switch outside, with a Check that stops that wiring being billed again per metre (convention 1).
  Sub-mains, power wiring and pipes come from QS-confirmed rules per point and per fixture, marked as such.
- **MEP items are Material-and-Labour by default** (convention 2). Scope (convention 3): light fittings
  and AC units out, their points and AC sockets in; sanitary ware in, under plumbing; the lift in.
- **Fire** is read where drawn. Where it is not, the storey-count allowance stands (৳50/sft below 7
  storeys, ৳120/sft from 7 up) with a Question, never zero (convention 4).
- **The MEP Takeoff Steps** run after the architecture (ADR 0007): electrical (equipment and boards;
  points), plumbing and sanitary (fixtures, risers, equipment), fire (devices and equipment, where drawn).
  The exact steps are M3's spec.
- **Each MEP office's Drafting Profile** is proposed from its legend (the kind is the layer; the legend's
  rows sit on the plan's symbol layers) and confirmed by the QS (ADR 0039).
- **The viewer** gains the Discipline filter and saved views (a saved ask from M2 for the selection,
  plus a camera and a section); runs are drawn as lines or instanced; the scene stays merged per storey
  with the Discipline as per-Element data. Session 02 measured 42–73 draw
  calls with every discipline in one scene, against up to 131 when merged per discipline (ADR 0040).

**What Edison showed** (one office's set; counts and conventions only; docs/research/edison-mep-read.md):
- Electrical points are very readable: 1,245 of 1,320 read, 75 Questions. On a typical floor, the
  reader's symbols, the drafter's tags and the board schedule agree exactly on the tagged kinds.
- Distribution boards 11 of 11 (N from the schematics); geysers 24 of 24; 43 other pieces of equipment
  placed only at their text labels, all Questions; ratings appear only in the schematics.
- Plumbing risers 27 of 46 read (those labelled on two or more sheets), 19 Questions; floor traps (123)
  and gate valves (94) read as symbols.
- Runs are schematic: 1,133 conduit curves and 1,796 plumbing segments, no conduit or cable size on any
  run. Lengths from them would be invented precision.
- Sanitary fixtures: 0 as plumbing symbols (they are the architect's base plan). Fire: 0 of anything.
- The MEP plans carry the structural grid as a block, so registration is exact; no MEP file states
  levels (storeys come from the architecture); mounting heights came from the legend for 588 points and
  were assumed for 716.
- The same point appears on up to three sheets: the fixture sheet is read once and the conduit sheets
  serve as a Check.
- Checks that fired: a band's title block naming other floors than its plan title; socket tags against
  circuits; lights tagged on one storey but drawn on the sheet above (a point's storey is not always its
  sheet's).

**The money** (Low; docs/research/mep-measurement-and-model.md §1.5): the template's MEP is about ৳725/sft,
about 25 % of the reference building's direct cost. Equipment is about 45 % of it, terminals about 23 %,
runs about 27 %.

**Rests on.** ADRs 0040 (Discipline Parts, Element Relations, the depth), 0007 (MEP steps), 0039
(Drafting Profiles per office and Discipline), 0037 (Attribute Definitions, IFC mappings), 0002 (Cost
Basis; allowance until read), 0009 (Measurement Rules as data), 0027 (Checks; a missing discipline is a
Question), 0006 (Material-and-Labour Contracts), 0022 (the viewer), 0038 (MEP rules per Market). Tables:
`drawings` Sheets with their Discipline; `live_model` Element Families with their Discipline Part and IFC
class, Element Relations, Attribute Definitions; `measurement` Rule Sets with MEP rules; `boq` the MEP
Parts' allowance lines (M2); `takeoff` Takeoff Steps per Discipline Part and Coverage.

**What M0–M2 must already hold** (so M3 adds rows and packages, not a rewrite):
- Sheet Disciplines include electrical, plumbing, fire and other MEP from M0; MEP sheets are split,
  named and assigned to their Building in M0 and held for their Part in M2's Coverage.
- Every Element Family and Takeoff Step belongs to a Discipline Part; the Relation table takes M3's new
  types (*passes through*, *spans storeys*, *same thing as*) without a schema rewrite.
- A storey holds its finished floor level (M2), from which mounting heights are measured.
- M2's wall filter records sanitary fixtures with their block kind.
- The MEP allowance lines are held per MEP Part (M2), each able to switch to measured when its Part is
  confirmed.
- Material-and-Labour items stay outside the Material Schedule (M1).
- The query has a Discipline predicate and the viewer's per-Element state carries the Discipline (M2).

**Open for M3's grill.**
1. The MEP Takeoff Steps and their order; the research recommends equipment, then terminals, then runs
   (equipment is about half the money in tens of Elements).
2. The run rules per point and per fixture: which lengths (sub-main per flat board, power wiring per
   socket, pipe per fixture), their starter values (none has a source yet), and how a figure shows it
   was priced by rule.
3. Which template line each Part's read replaces, and what stays a Lump Sum (utility connection and
   demand charges are not Elements).
4. The identity tolerance for a terminal across Revisions (no evidence for a value).
5. How far schematics are read beyond the board Check (ratings from single-line and pump diagrams, or
   asked).
6. The PWD E/M Benchmark's net factor (the civil divisor 1.227 is unverified for E/M, and the E/M 2nd
   Revised rates are the 2022 rates × 1.028), and whether MEP contractors' rates are quoted net or
   inclusive of VAT and AIT (the flag of M2's ruling 2).
7. The terms Point, Run, MEP System and Circuit for `CONTEXT.md` (proposed in the research, §1.9).
8. IFC 4.3 classes: a ceiling fan, an earth electrode, a lightning air terminal and an ATS have none
   (USERDEFINED); `IfcDistributionBoard`, not the deprecated `IfcElectricDistributionBoard`.
9. *Passes through* without routed runs: which groove, sleeve and hole items arise from risers through
   slabs alone.
10. Fire: how a read Fire Part and the M2 clearance answer reconcile; what a building under 7 storeys
    with no fire drawings carries.
11. The viewer's budgets with MEP added, unmeasured on the reference setup.
12. A per-Part lock, if a separate MEP QS appears (ADR 0040 keeps it possible; the owner's fact is that
    one QS measures everything).
13. The Held-out Set with MEP drawings, ideally with fire (the owner obtains it).

## M4 — Rebar from the drawing, and more than one Building

**Finish line.** Beam rebar, then slab rebar, read from the drawing; the Priced BOQ shows the rising
share of rebar from the drawing. A second Building of one Project is read, measured and priced
(ADR 0036), ready before the founding Developers are onboarded.

**Rests on.** ADRs 0010 (the three Rebar Bases; every bar inside its concrete and schedule totals that
sum back as Checks; laps by rule R3; the plan-versus-section precedence confirmed per consultant; "a must,
not an option"), 0036 (a Project holds a Site and Buildings; each sheet assigned to a Building), 0015
(identity), 0037 (confirmed rebar bars in `live_model`), 0033 (priced per Building), 0039 (a consultant's
rebar conventions in its Drafting Profile), 0005 (rebar from the drawing ±3 %). Tables: `live_model`
confirmed rebar bars (columns from M1); `measurement` Rebar Ratios and diameter splits, replaced element
type by element type; the Material Schedule's diameter and "assumed" flag; `projects` Building and Site;
`drawings` Sheet's Building.

**What M0–M2 must already hold.**
- Every Building-scoped table and query is keyed by Building from M0: storeys, grid, Elements, Gross
  Floor Area, Cost Basis, Estimate, Issued Estimate, share link.
- The Summary and exports are computed per Building, with the Site's works beside it (M2 has one
  Building).
- The confirmed-bar shape M1 uses for columns (shape, diameter, count, spacing, laps, each with its
  Trace) is general enough for beams and slabs.
- The share of rebar from the drawing shows on the Summary (M2).

**Open for M4's grill.**
1. How beam and slab reinforcement is drawn in the sets we hold, and the reader's route (schedules,
   sections, plan annotations); Edison's column schedule is graphical, and nothing else is measured.
2. The plan-versus-section precedence as part of the Drafting Profile.
3. How a Project's figure composes: each Building's Estimate plus the Site's works; cost per sft per
   Building and per Project; how the Target Cost applies.
4. Shared structures (a podium, a shared basement, a car park under two towers): one Building or its
   own; sheets that serve two Buildings.
5. Assigning sheets to Buildings: proposed from titles, grids or key plans, confirmed by the QS.
6. The building picker's first appearance; Issued Estimates per Building or per Project.
7. The price for a multi-building Project (ADR 0033's minimum per building).
8. A real multi-building Drawing Set to prove it on (the founding clients hold them; the owner obtains
   one).

## M5 — Revisions, vector PDFs, and publishing Drafting Profiles

**Finish line.** Needs a real revision pair from a client or Edison, never one the team drew. A revised
set carries Confirmations over, and the Revision Comparison shows the ৳ effect. A vector-PDF set goes
through the same Takeoff. A Drafting Profile is published to the Library once the first client's
written permission covers it (ADR 0039).

**Rests on.** ADRs 0015 (identity per family; Revisions per sheet; reader upgrades matched from M1;
"changed in rev B, awaiting Confirmation"), 0028 (the comparison engine and its split; Issued Estimates as
baselines), 0014 (the PDF upload report, the differential test, pdfplumber and pypdfium2), 0040 (a
Relation whose end changes raises a Question; each Part revised on its own cycle, MEP usually later),
0039 (publishing with permission and a Vextrus review; no profile built from a Held-out Set), 0037
(permanent ids; Model Versions; Records stamped with the design version in force), 0022 (the Plot
underlay). Tables: `drawings` Revisions, Sheet Revisions, Drawing Set States, Drafting Profiles;
`revisions` Comparison and ComparisonElement (M2); `live_model` Element States over Model Versions.

**What M0–M2 must already hold.**
- The Drawing Set State pinned on every Issued Estimate (M2), and the PDF anchor type in every Trace
  (M0).
- Matching on every reader upgrade from M1, with zero changes on a re-read.
- The comparison engine takes the `revision` kind as a new kind, not a rewrite (M2).
- "Awaiting answer" (M2) is the grammar "awaiting Confirmation" reuses.
- Annotations and Relations anchored to permanent Element ids (M2).
- Drafting Profiles as data with a tenant scope a Library copy can take (M1).

**Open for M5's grill.**
1. The real revision pair (the owner obtains it); one that includes a later MEP issue would test Parts
   revised apart.
2. Matching tolerances per family, MEP terminals included (no evidence yet).
3. The pass bar for the PDF loss table.
4. A Revision that arrives mid-Takeoff, or for a Part still on allowance.
5. The Questions for an orphaned Relation and for annotations on removed Elements.
6. Publishing: the clause in the founding clients' agreement (ADR 0033), the reviewer's checklist
   (layer names and label patterns can carry names), profile versions, a Developer's local override,
   withdrawal.
7. How the product counts the 6 months of included Revisions (ADR 0033).

## M6 — Beta

**Finish line.** Google Cloud Mumbai (ADR 0034), backups with a restore drill against the 7-day
point-in-time window and the Delhi backups, and MFA (row-level security is in from M0); this operations
work runs beside M4 and M5. The founding Developers are onboarded "done with you" on their own Drawing
Sets once M4 is done (MEP and rebar both read), before M5.

**Rests on.** ADRs 0034 (asia-south1: one x86 VM, Cloud SQL for PostgreSQL 18 Enterprise with 7 days of
point-in-time restore and 30 days of daily backups in Delhi, a dual-region bucket, a staging VM; 99.5 %
uptime, about 5 minutes of data loss at most, restored within 4 hours; a monthly restore drill, staff
MFA, rate limits and an audit table), 0018 (hosted, multi-tenant), 0038 (a home region per Developer,
tenant-prefixed keys, a cell per region), 0033 (the founding clients' terms), 0013 (TypeSafe named as a
processor in each founding client's permission), 0022 (the budgets re-checked on a founding client's own
QS computer), 0026 (Answer Keys fenced). Tables: `platform` tenancy with forced row-level security and a
non-owner app role, Memberships scoped to Projects, invitations, tenant-prefixed storage, the event
outbox, jobs; the telemetry.

**What M0–M2 must already hold.** Row-level security in every tenant table's first migration;
constraints on populated tables added by a role that bypasses it, or before data; object storage behind
one interface (the file system in development, Cloud Storage in the beta); no local path or address in
settings; times in UTC; ids from `ids.new_id()`; no secret in the repository; telemetry hidden from
clients.

**Open for M6's grill.**
1. Before provisioning: the latency from Dhaka, the N2D price in the console, and whether the billing
   account is self-serve (Q26).
2. Whether Cloud SQL lets the migration role bypass row-level security as M0's finding needs; not
   checked yet.
3. Whether 14 days of point-in-time restore (about $190 a month more) is wanted later.
4. The MFA method for staff and for clients.
5. TypeSafe's retention and whether zero retention is offered (ADR 0013: asked before the beta).
6. Bangladesh's Personal Data Protection Act 2026: a lawyer checks our reading on data held abroad
   (ADR 0034).
7. Monitoring, alerts and who answers them in a small team.

## After the MVP, in order (session 02 Q28: "Agree with your recommendation on Q28.")
Each is chosen and refined by what beta Developers ask for (ADR 0002).

1. **Level 3: a written explanation of each Revision Comparison** (ADRs 0011, 0015). Rests on the
   Revision Comparison with its Element differences and quantity and price split (M2, M5), the query
   (M2) and Traces. Open: the System Two model (ADR 0011 names Claude) and the client permission for what
   it receives; how every number in the prose is checked against the figures (code computes, the model
   only words them); cost per project; evaluation on real revision pairs.
2. **Cost control during construction: As built Records** (ADRs 0035, 0037, 0028). Rests on the Records
   table (empty since M0: append-only, who, when, evidence, the design version in force), As built
   Attribute Definitions (cast date, concrete and rebar as cast, actual cost), each Element's issued cost
   from the frozen Measurement Lines as its budget, Construction Stage and casting stage (M1), Deviations
   shown and never absorbed, and Memberships scoped to Projects for site engineers. Open: which site
   records come first; capture on a phone at site, offline; evidence files; where actual cost comes from
   (purchases, contractor and Labour Contract bills); "budget" as cost control's word; "digital twin"
   allowed once As built data flows (ADR 0035).
3. **As maintained**: after-sales and facility management (warranty, expected life, maintenance and
   condition as Records), the handover package for the owners' association, the buyer's view of their
   own flat, and Live Models of buildings a Developer already maintains; moved forward if a beta
   Developer asks. Rests on Records, O&M Attribute Definitions with their IFC mappings (warranty, service
   life, condition), IFC-ready data, and outsiders by invitation. Open: the Apartment family nothing reads
   yet; a buyer's access; how a building with no drawings in Vextrus gets a Live Model; the handover
   format (an IFC or COBie exporter, added when asked).
4. **Project memory**: per-tenant history and semantic search over old documents. Rests on one Postgres
   (ADR 0021) with the Document and DocumentChunk tables left out of the MVP (docs/data-model.md §7).
   Open: which documents; the embedding model and whether text leaves Vextrus; retention.
5. **The watcher** that wakes to flag anomalies and notify. Rests on the event outbox (M0) and the
   figures computed on read (the Target Cost warning, likely over allowance). Open: which anomalies,
   which channels, who receives them.
6. **4D Schedule and 5D Cost**, built with the project's engineers. Rests on Construction Stages as a
   sequence and casting stages per Element (ADR 0002) and the Material Schedule's lead times. Open: where
   dates come from (a scheduling tool's import or Vextrus's own), activities against stages, who owns the
   schedule.

**Waiting on a trigger, outside the order:** IFC export, when the first client or market asks (ADR 0035;
every exporter passes a validation gate, ADR 0031); true MEP run lengths (ADR 0040); a second Market
(translations and fonts, right-to-left testing, the digit switch, its Rule Set and prices, the PDF engine
for non-Latin scripts; ADR 0038), not before 10 Developers pay (ADR 0033); Bangla screens, with the two
rulings they wait for (৳ before or after the figure in Bangla, the Bangla word for Rebar; session 02
Q15); OmniClass and MasterFormat (ADR 0037); steel-framed and industrial buildings (ADR 0003); scanned
drawings (ADR 0014).
