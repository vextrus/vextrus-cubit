# Session 01 sweep: the QS critic

26 Sep 2026. The `qs-critic` agent reviewed intent, CONTEXT, the ADRs and milestones as a senior Dhaka
QS, before reading the outside plan review. Clause numbers are from memory and marked "verify".
Grilled with the owner one point at a time; rulings land in the ADRs.

## Findings, most severe first
1. **Critical: the price stops at direct cost.** No layer for overheads, supervision, preliminaries,
   contingency, VAT/AIT on labour bills. PWD SoR rates include contractor's overhead and profit, so the
   Benchmark is not like for like. Fix: an ordered, editable build-up (Direct → Net → Gross) with dated
   tax rates as data; label or strip the Benchmark's markup.
2. **Critical: a Labour Contract cannot be expressed per BOQ item.** Dhaka structural labour is often
   let per sft of floor or casting area covering binding, shuttering and casting (practice). Fix: a
   Labour Contract with its own unit and scope spread over several items, with a no-double-pay check.
3. **Critical: an issued figure can change silently.** A Market Price change updates everything
   (ADR 0006). Fix: dated Market Price sets, an Issued snapshot of the Priced BOQ, and a Revision
   Comparison split into quantity effect and price effect.
4. **Critical: the Excel export would leave a QS unable to sign.** Needs the measurement sheet (Nos | L
   | B | H | Qty), an abstract with live formulas, the Rate Analysis sheet and the summary.
5. **Critical: nothing whole-building reaches the MD until M2; the Target Cost warning fires late.**
   Fix: editable Market Prices and piles/caps in M1; a Cost Basis (measured or allowance ৳/sft per
   unmeasured trade); test the Target Cost against measured + allowance.
6. **Critical: Takeoff Steps missing beyond the review's M6:** sunshades, drop walls, fins, cornices;
   shear walls as a family; grade beams, slab-on-grade; earthwork and derived items (excavation,
   dewatering, shoring, backfill, sand filling, soling, lean concrete); piles as a full family; basement
   walls and ramps; roof treatment, stair and machine rooms; site works; a General Notes /
   Specification step first (grades, cover, laps, mixes).
7. **Major: units wrong for walls and bricks.** 10" walls in cft, 5" in sft; bricks in nos; doors and
   windows sft; frames rft/cft. Fix: units per item class in the Rule Set.
8. **Major: the first Measurement Rules are not written.** Column height, beam between faces below the
   soffit, formwork by contact area, opening deductions (IS 1200 Pt 3 and Pt 12, verify), rounding; rod
   rules for laps, hooks, stock-length cutting and wastage.
9. **Major: Rod Ratio contradicts the Material Schedule's "rod by diameter".** Fix: ratios per element
   type × Storey Band; a ratio-basis diameter split marked "assumed", or rod undivided.
10. **Major: Resources lack wastage and conversion factors;** Sylhet vs local sand, brick vs stone
    chips, ready-mix per cft including pump, carriage. The Material Schedule is gross; the BOQ net.
11. **Major: "what to buy, and when" has no when.** Fix: a fixed stage sequence with procurement lead
    per Resource and ৳ by stage (instalments follow slab castings).
12. **Major: finishes and doors come from the Developer's specification, not the drawings.** Fix: a
    per-Developer specification by room type applied to confirmed rooms.
13. **Major: MEP lump sums have no completeness check.** Fix: a template of expected lines with a
    ৳/sft sanity range each.
14. **Major: the Project Summary's "cost per sft" is undefined** (gross vs saleable); add rod kg/sft,
    cement bags/sft, bricks/sft against past projects.
15. **Minor: BOQ structure and wording** (Sub-structure / Super-structure / Masonry / Finishes / Doors
    & Windows / Services / External works; descriptions carry mix, grade, class; rounding reconciles
    with Excel).
16. **Minor: revisions after construction starts** compare against the issued baseline, with cast
    stages marked done.

## On the outside plan review
- **Missed:** all the money (1–5, 7–14); earthwork and derived items, sunshades, grade beams,
  retaining walls, roof, site works, the specification step; that the Hand Takeoff must use the same
  written Rule Set as the product; whole-building totals an MD checks first.
- **Disputed:** junction order should be a Rule Set choice (IS 1200/PWD default), not an engine
  constant; tolerances per item and on the ৳ total (concrete ±1 %, formwork ±3–5 %, rod by ratio
  excluded); Hand Takeoff zones should add external works and a non-typical upper floor; piles are a
  whole family, not "pile heads".
