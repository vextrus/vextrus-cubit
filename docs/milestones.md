# Vextrus — the first milestones

Agreed by the owner on 25 Sep 2026. Every finish line is walked by the owner and the team in the
running product, on the Development Sets (the Sample Project and the Edison set) and the Held-out Sets (ADR 0005). No dates
(ADR 0019). After M2, M3–M5 run in parallel, since they touch different modules.

| # | Milestone | Finish line the owner judges |
|---|---|---|
| M0 | **Drawings in** | Upload the Edison structural and architectural DWGs and the Sample Project DWGs. Every sheet is split correctly, gets a proposed name and storey, and renders legibly in the viewer. The QS confirms the sheet list. |
| M1 | **The frame, priced** | The QS runs the Takeoff Steps for storeys and heights, grid, columns (by Storey Band), beams and slabs. The frame shows in 3D, and the frame's Priced BOQ (concrete, formwork, rod by ratio) and Material Schedule appear in ৳ and in cft/sft. Every figure opens its Trace. Column rod comes from the drawing. The figures agree with the Hand Takeoff of a typical floor. |
| M2 | **The whole building (the showcase)** | Foundations, stairs, walls and openings, and finishes, with MEP as lump sums. Rate Analyses on editable Market Prices with PWD Benchmark Rates alongside, and an editable Rule Set. The Project Summary with the Target Cost warning; Excel and PDF exports; the 3D share link; the Level 2 assistant. The figures agree with the Hand Takeoff. This is what an MD is shown. |
| M3 | **Revisions and vector PDFs** | A revised set carries Confirmations over, and the Revision Comparison shows the ৳ effect. A vector-PDF set goes through the same Takeoff. |
| M4 | **Rod from the drawing** | Beam rod, then slab rod, read from the drawing. The Priced BOQ shows the rising share of rod from the drawing. |
| M5 | **Beta** | AWS Mumbai, row-level security, backups with a restore drill, and MFA. The founding Developers are onboarded "done with you" on their own Drawing Sets. |

## How a finish line is measured (ADR 0005, amended 26 Sep 2026)
"Agrees with the Hand Takeoff" means, on every Development Set and Held-out Set the milestone names:
counts exact; each BOQ item line within its tolerance (concrete ±1 %, rod from the drawing ±3 %,
formwork ±3 %, masonry and plaster ±3 %, finishes ±5 %); each zone's ৳ total within ±2 %; rod by
ratio not compared. The Hand Takeoff covers five zones under the same signed Rule Set, and is scored
blind (ADR 0026). M1 needs one Held-out Set, M2 two.

## After the MVP, in order
1. Level 3: a written explanation of each Revision Comparison (ADR 0015).
2. Cost control during construction.
3. Project memory: per-tenant history and semantic search over old documents.
4. The watcher that wakes to flag anomalies and notify.
5. 4D Schedule and 5D Cost, built with the project's engineers.

Each is chosen and refined by what beta Developers ask for (ADR 0002).
