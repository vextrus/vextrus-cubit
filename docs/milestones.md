# Vextrus — the first milestones

Agreed by the owner on 25 Sep 2026. Every finish line is walked by the owner and the team in the
running product, on the Development Sets (the Sample Project and the Edison set) and the Held-out Sets (ADR 0005). No dates
(ADR 0019). After M2, M3 and then M4 run in sequence, since both change the engine's reading; M5's
operations work runs beside them (the owner's ruling, 26 Sep 2026: "M4 first", i.e. rebar before
revisions and PDFs; M3 and M4 were renumbered to match).

| # | Milestone | Finish line the owner judges |
|---|---|---|
| M0 | **Drawings in** | Upload the Edison structural and architectural DWGs and the Sample Project DWGs. Every sheet is split correctly, gets a proposed name and storey, and renders legibly in the viewer. The QS confirms the sheet list. |
| M1 | **The frame and piles, priced** | The QS runs the Takeoff Steps for sheets, general notes and specification, storeys and levels, grid, piles and pile caps, columns and shear walls (by Storey Band), beams and slabs. The frame shows in 3D. Its Priced BOQ (concrete, formwork, rebar) is priced by Rate Analyses on the Developer's editable Market Prices, and the Material Schedule appears in ৳ and in cft/sft. Every unmeasured trade carries a marked allowance, so the MD sees a whole-building figure with its measured share. Every figure opens its Trace; Checks raise Questions. Column rebar comes from the drawing. The figures agree with the Hand Takeoff within tolerance, and one Held-out Set is scored blind. |
| M2 | **The whole building (the showcase)** | Mat foundations and derived earthwork, stairs, tanks, walls and openings, rooms and finishes from the Developer's Specification, roof, and site works and MEP from the lump-sum template. PWD Benchmark Rates alongside, and an editable Rule Set. The Estimate's layers (preliminaries, contingency, taxes) and Issued Estimates. The Project Summary with the Target Cost warning (on measured + allowance); Excel and PDF exports; the 3D share link; the Level 2 assistant. The figures agree with the Hand Takeoff in all five zones, and two Held-out Sets are scored blind. This is what an MD is shown. |
| M3 | **Rebar from the drawing** | Beam rebar, then slab rebar, read from the drawing. The Priced BOQ shows the rising share of rebar from the drawing. |
| M4 | **Revisions and vector PDFs** | Needs a real revision pair from a client or Edison, never one the team drew. A revised set carries Confirmations over, and the Revision Comparison shows the ৳ effect. A vector-PDF set goes through the same Takeoff. |
| M5 | **Beta** | AWS Mumbai, backups with a restore drill, and MFA (row-level security is in from M0); this operations work runs beside M3 and M4. The founding Developers are onboarded "done with you" on their own Drawing Sets once M3 is done, before M4. |

## How a finish line is measured (ADR 0005, amended 26 Sep 2026)
"Agrees with the Hand Takeoff" means, on every Development Set and Held-out Set the milestone names:
counts exact; each BOQ item line within its tolerance (concrete ±1 %, rebar from the drawing ±3 %,
formwork ±3 %, masonry and plaster ±3 %, finishes ±5 %); each zone's ৳ total within ±2 %; rebar by
ratio not compared. The Hand Takeoff covers five zones under the same signed Rule Set, and is scored
blind (ADR 0026). M1 needs one Held-out Set, M2 two. The M1 and M2 walks each include a timed Takeoff
by a QS who did not build the product (ADR 0033).

## After the MVP, in order
1. Level 3: a written explanation of each Revision Comparison (ADR 0015).
2. Cost control during construction.
3. Project memory: per-tenant history and semantic search over old documents.
4. The watcher that wakes to flag anomalies and notify.
5. 4D Schedule and 5D Cost, built with the project's engineers.

Each is chosen and refined by what beta Developers ask for (ADR 0002).
