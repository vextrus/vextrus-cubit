# Vextrus — the first milestones

Agreed by the owner on 25 Sep 2026 and redrawn in session 02 (28 Sep 2026, the owner's ruling on Q27:
"Agree with your recommendation on Q27"), after the Live Model became the product (ADR 0035). Every
finish line is walked by the owner and the team in the running product, on the Development Sets (the
Sample Project and the Edison set) and the Held-out Sets (ADR 0005). No dates (ADR 0019). After M2, M3 (MEP),
M4 (rebar and more than one Building) and M5 (Revisions and PDFs) run in sequence, since each changes the
engine's reading; M6's operations work runs beside M4 and M5 (the owner's rulings: "M4 first", 26 Sep
2026, i.e. rebar before revisions and PDFs; MEP as its own milestone after M2, 28 Sep 2026, Q29: "Agree
with your recommendation B on Q29.").

| # | Milestone | Finish line the owner judges |
|---|---|---|
| M0 | **Drawings in** | Upload the Edison structural and architectural DWGs and the Sample Project DWGs. Every sheet is split correctly, gets a proposed name and storey, and renders legibly in the viewer. The QS confirms the sheet list. *Beneath it, from the first line:* markets as data (ADR 0038: a Market row, message catalogues, formatters, logical CSS, money with its currency, Billing Units per unit system, UTC, UUIDv7 and a home region); Python 3.14 and PostgreSQL 18 (ADR 0034); a Project's Buildings (ADR 0036); Memberships scoped to Projects; the Live Model's empty tables for Attributes, Records and classification (ADR 0037). Engine PRs are checked for regression by element diff; the Answer Keys arrive in M1 (ADR 0030). |
| M1 | **The frame and piles, priced** | The QS runs the Takeoff Steps for sheets, general notes and specification, storeys and levels, grid, piles and pile caps, columns and shear walls, beams and slabs. The frame shows in 3D, one Element per physical piece (a column per storey, ADR 0015), each carrying its As designed Attributes with their IFC mapping and Uniclass reference (ADR 0037). Its Priced BOQ (concrete, formwork, rebar) is priced by Rate Analyses on the Developer's editable Market Prices (starter: PWD SoR 2022, Dhaka), and the Material Schedule appears in ৳ and in cft/sft. Every Takeoff Step not yet confirmed carries a marked allowance, so the MD sees a whole-building figure with its measured share; a step may close with Questions open, its held Elements flagged "awaiting answer" (ADR 0002). Every figure opens its Trace; Checks raise Questions. Column rebar comes from the drawing. The reader handles an unknown office's set: a Drafting Profile is learnt on Edison and confirmed by the QS (ADR 0039). The viewer's M1 tools (measure and area, an Element's dimensions, sections with dimensions, properties and filters by Attribute) pass the budgets on the reference setup (ADR 0022). The figures agree with the Hand Takeoff within tolerance, and one Held-out Set is scored blind, first as an unknown office's first read. |
| M2 | **The whole building (the showcase)** | Mat foundations and derived earthwork, stairs, tanks, walls and openings, rooms and finishes from the Developer's Specification, roof, site works as Lump Sums on the Site, and the MEP template's lines as the MEP Discipline Parts' allowances until M3 reads them (the fire line by storey count). PWD Benchmark Rates alongside, and an editable Rule Set. The Estimate's layers (preliminaries, contingency, taxes) and Issued Estimates, each freezing its Measurement Lines (ADR 0028). The Project Summary with the Target Cost warning; Excel and PDF exports; the 3D share link with presentation for marketing within budget on the reference setup; plans and elevations derived from the model, printing with no overlapping labels; placed dimensions and notes that survive Revisions; the Live Model's query (Level 2, ADR 0011). The figures agree with the Hand Takeoff in all five zones, and two Held-out Sets are scored blind. This is what an MD is shown. |
| M3 | **MEP read** | MEP enters the Live Model as Discipline Parts (ADR 0040): equipment (lifts, generator, substation, boards, pumps) and terminals (electrical points, sanitary fixtures through the architectural reader, fire devices where drawn) read as Elements with identity and Element Relations (hosted in, in room, passes through, same thing as); risers read by diameter and storey; pipes and sub-mains priced by QS-confirmed rules per point and per fixture until true run lengths are read after the MVP; the legend proposes each MEP office's Drafting Profile; board schedules and single-line diagrams as Checks on N; a missing discipline (such as fire) raised as a Question, never read as zero. Until an MEP Part is read, the MEP template's ৳/sft lines are its allowances. One Held-out Set with MEP drawings is scored blind. |
| M4 | **Rebar from the drawing, and more than one Building** | Beam rebar, then slab rebar, then shear-wall and core rebar, read from the drawing; the Priced BOQ shows the rising share of rebar from the drawing. A second Building of one Project is read, measured and priced (ADR 0036), ready before the founding Developers are onboarded. |
| M5 | **Revisions and vector PDFs** | Needs a real revision pair from a client or Edison, never one the team drew. A revised set carries Confirmations over, and the Revision Comparison shows the ৳ effect. A vector-PDF set goes through the same Takeoff. A Drafting Profile is published to the Library once the first client's written permission covers it (ADR 0039). |
| M6 | **Beta** | Google Cloud Mumbai (ADR 0034), backups with a restore drill against the 7-day point-in-time window and the Delhi backups, and MFA (row-level security is in from M0); this operations work runs beside M4 and M5. The founding Developers are onboarded "done with you" on their own Drawing Sets once M4 is done (MEP and rebar both read), before M5. |

## How a finish line is measured (ADR 0005)
"Agrees with the Hand Takeoff" means, on every Development Set and Held-out Set the milestone names:
counts exact; each BOQ item line within its tolerance (concrete ±1 %, rebar from the drawing ±3 %,
formwork ±3 %, masonry and plaster ±3 %, finishes ±5 %); each zone's ৳ total within ±2 %; rebar by
ratio not compared. The Hand Takeoff covers five zones under the same signed Rule Set, and is scored
blind (ADR 0026). M1 needs one Held-out Set, M2 two, M3 one with MEP drawings; each is scored first as an unknown office's first
read (no Drafting Profile of its office), then with one if it exists (ADR 0039). The M1 and M2 walks each
include a timed Takeoff by a QS who did not build the product (ADR 0033).

## After the MVP (the owner's ruling, session 02 Q28: "Agree with your recommendation on Q28")
1. Level 3: a written explanation of each Revision Comparison (ADR 0015).
2. Cost control during construction: As built Records (ADR 0037).
3. As maintained: after-sales and facility management (warranty, expected life, maintenance, condition
   as Records), the handover package for the owners' association, the buyer's view of their own flat,
   and Live Models of buildings a Developer already maintains; moved forward if a beta Developer asks.
4. Project memory: per-tenant history and semantic search over old documents.
5. The watcher that wakes to flag anomalies and notify.
6. 4D Schedule and 5D Cost, built with the project's engineers.

Each is chosen and refined by what beta Developers ask for (ADR 0002).
