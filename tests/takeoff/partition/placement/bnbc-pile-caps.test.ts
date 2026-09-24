// @vitest-environment node
/**
 * FND-2's ratchet, on the drawing it was written for: F-RCC6-BNBC read by the SHIPPED `cad/` CLI
 * (L-CAD-01) and put through the partition's pure stages — views, conventions, grid, schedules,
 * registry, placement — exactly as the rebuild runs them (R-TO-030), and then through the foundations
 * rail's own plan reading with the measure setup's own mappings. No database, no store, no model.
 *
 * What the drawing states, and what is graded here:
 *   · S-06's PILE CAP SCHEDULE (`202D`) is titled on the sheet's paper; its title and its header are
 *     ONE MTEXT (`639`: `\LPILE CAP SCHEDULE\l\PMARK  SIZE  DEPTH  PILES  BOTTOM MESH  TOP MESH`), its
 *     rows are TEXTs standing un-ruled at six x's, and a footer MTEXT (`658`) says the office prints no
 *     NOS column. I-330 reads the header where its line is drawn and the columns where the rows stand.
 *   · S-26's BAR BENDING SCHEDULE (`1E3D`) is a schedule of BARS and registers no member type (I-331).
 *   · The caps' DEPTH is read, in the millimetres S-01 declares (I-332, I-302).
 *   · S-06 draws 26 cap outlines, the 89 pile circles inside them and one unmarked ring (`638`, the
 *     porch footing). Each cap mark stands inside its outline — three of them on their centre pile —
 *     and I-333 places 26 caps by their outlines, carrying each outline's plan: 12 rectangles by their
 *     own sides (the one turned 45°, `5FB`, 2000 × 1000) and 14 chamfered PC2 polygons by shoelace.
 *   · The rail binds the ring's plan (I-334): the schedule's rectangle never stands for a PC2.
 *
 * AND WHAT MAY NOT MOVE: the 89 piles and the 27 columns (pinned in bnbc-pile-schedule.test.ts beside
 * F-RCC6's whole stage output), and the drawn scale, 1, on both fixtures.
 */
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { Offer } from "@/core/offers/contract";
import { capOffersOver, CAP_KINDS, type Measure } from "./support/cap-rail";
import { goldenCellAllowance, goldenCellRows } from "../../../golden/support/golden-fixture";
import { BNBC_DXF, RCC6_DXF, stagesOver, type StagesRead } from "../support/bnbc-stages";

/** The caption the pile-cap schedule is titled by, on the sheet's paper (I-290), and its view. */
const PILE_CAP_SCHEDULE = "DXF_HANDLE:202D";
/** The bar-bending schedule's view (S-26). */
const BAR_SCHEDULE_VIEW = "SCHEDULE:DXF_HANDLE:1E3D";
/** The MTEXT the title and the header are written in, and the footer beneath the rows. */
const HEADER_MTEXT = "DXF_HANDLE:639";
const FOOTER_MTEXT = "DXF_HANDLE:658";
/** S-01's general note declaring the drawing's millimetres (I-302). */
const DECLARATION = "DXF_HANDLE:1F3E";
/** The PC1 turned 45° under C6 at E1, one chamfered PC2, and the unmarked porch footing ring. */
const TURNED_PC1 = "DXF_HANDLE:5FB";
const CHAMFERED_PC2 = "DXF_HANDLE:5AF";
const FOOTING_RING = "DXF_HANDLE:638";

/** What S-06's schedule states per cap type (T-SCHED-NORULES: no NOS column; the counts are the plan's). */
const SCHEDULED: Readonly<Record<string, { readonly size: readonly [number, number]; readonly cell: string }>> = Object.freeze({
  PC1: { size: [2000, 1000], cell: "DXF_HANDLE:63C" },
  PC2: { size: [2100, 1750], cell: "DXF_HANDLE:642" },
  PC3: { size: [2000, 2000], cell: "DXF_HANDLE:648" },
  PC4: { size: [2600, 2600], cell: "DXF_HANDLE:64E" },
  PC5: { size: [3500, 3500], cell: "DXF_HANDLE:654" },
});

/** How many caps of each type S-06 draws (the fixture's model: 4 + 14 + 5 + 2 + 1 = 26). */
const DRAWN: Readonly<Record<string, number>> = Object.freeze({ PC1: 4, PC2: 14, PC3: 5, PC4: 2, PC5: 1 });

/** The golden's cap concrete cell (L-QTY-06), in its own spelling. */
const CAP_CONCRETE_CELL = { class: "PILE_CAP", kind: "RCC_CONCRETE", level: "FDN" } as const;
const FIXTURE = "rcc6-bnbc";

let bnbcRead: Promise<StagesRead> | undefined;
let rcc6Read: Promise<StagesRead> | undefined;

/** Each drawing is read ONCE for the whole suite — lazily, so a refusal fails the case that needed it. */
const bnbc = (): Promise<StagesRead> => (bnbcRead ??= stagesOver(BNBC_DXF));
const rcc6 = (): Promise<StagesRead> => (rcc6Read ??= stagesOver(RCC6_DXF));

/** How long one drawing's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/** One row of a table's cells, verbatim, in column order. */
function rowOf(read: StagesRead, index: number): { text: string; keys: string[] }[] {
  const table = read.reconstructed.tables.find((one) => one.scheduleKey === PILE_CAP_SCHEDULE);
  return (table?.cells ?? []).filter((cell) => cell.rowIndex === index).map((cell) => ({ text: cell.text, keys: cell.sourceKeys }));
}

/** The type of the entity the drawing gave a key. */
function typeOf(graph: EntityGraph, key: string): string | undefined {
  return graph.entities.find((entity) => entity.key === key)?.type;
}

describe("I-330: S-06's PILE CAP SCHEDULE reads — its MTEXT header where its line is drawn, its columns where its rows stand", () => {
  test("the header is the MTEXT's second line, named in its own word order, every name citing the MTEXT", async () => {
    const read = await bnbc();
    const table = read.reconstructed.tables.find((one) => one.scheduleKey === PILE_CAP_SCHEDULE);
    expect(table, `202D yields a table; the deferrals read ${JSON.stringify(read.reconstructed.deferrals)}`).toBeDefined();
    expect(table?.title, "titled by its paper caption").toBe("PILE CAP SCHEDULE  SCALE 1:50");
    expect(table?.columns, "six columns, where the rows' own texts stand").toEqual([200000, 202400, 205600, 207800, 209800, 213600]);
    expect(rowOf(read, 0), "the header band, and not the title above it").toEqual(["MARK", "SIZE", "DEPTH", "PILES", "BOTTOM MESH", "TOP MESH"].map((text) => ({ text, keys: [HEADER_MTEXT] })));
  }, BUDGET_MS);

  test("five rows, verbatim — and the footer is neither a header nor a row", async () => {
    const read = await bnbc();
    expect(rowOf(read, 1).map((cell) => cell.text), "PC1's row").toEqual(["PC1", "2000x1000", "1295", "2", "16%%C @ 150 B/W", "12%%C @ 200 B/W"]);
    expect(rowOf(read, 2).map((cell) => cell.text), "PC2's row").toEqual(["PC2", "2100x1750", "1295", "3", "16%%C @ 150 B/W", "12%%C @ 200 B/W"]);
    expect(rowOf(read, 5).map((cell) => cell.text), "PC5's row").toEqual(["PC5", "3500x3500", "1295", "9", "20%%C @ 125 B/W", "16%%C @ 150 B/W"]);
    expect(rowOf(read, 6), "and nothing after PC5").toEqual([]);
    const table = read.reconstructed.tables.find((one) => one.scheduleKey === PILE_CAP_SCHEDULE);
    expect(table?.cells.some((cell) => cell.sourceKeys.includes(FOOTER_MTEXT)), "no cell cites the footer 658 (`…PRINTS NO NOS COLUMN`)").toBe(false);
    expect(table?.unplaced, "and no text of the table's rows went unplaced").toEqual([]);
  }, BUDGET_MS);
});

describe("I-331, I-332: the member types — the caps from their schedule, none from the bar schedule", () => {
  test("S-26's BAR BENDING SCHEDULE registers no member type, and says so; its table is still read whole", async () => {
    const read = await bnbc();
    expect(read.registered.families.filter((family) => family.scheduleKey === "DXF_HANDLE:1E3D"), "PC3 and S3 are no longer minted sectionless off a bar schedule").toEqual([]);
    expect(read.registered.deferrals, "the view contributed nothing, by name").toContainEqual({ viewKey: BAR_SCHEDULE_VIEW, reason: "SCHEDULE_VIEW_CONTRIBUTED_NOTHING" });
    expect(read.reconstructed.tables.some((table) => table.scheduleKey === "DXF_HANDLE:1E3D"), "the bars' table is reconstructed as it was").toBe(true);
  }, BUDGET_MS);

  test("PC1..PC5 from 202D, each with its section and its depth in millimetres, cited to the cell and to S-01's declaration", async () => {
    const read = await bnbc();
    const caps = read.registered.families.filter((family) => family.family.startsWith("PC"));
    expect(caps.map((family) => [family.family, family.scheduleKey]), "five families, one schedule").toEqual(Object.keys(SCHEDULED).map((mark) => [mark, PILE_CAP_SCHEDULE]));
    for (const family of caps) {
      const stated = SCHEDULED[family.family];
      expect(family.variants.length, `${family.family}: one variant`).toBe(1);
      const variant = family.variants[0];
      expect([variant?.sectionWidth, variant?.sectionDepth, variant?.sectionUnit], `${family.family}: the SIZE cell, in the declared millimetres`).toEqual([stated?.size[0], stated?.size[1], "mm"]);
      expect(variant?.dimensions, `${family.family}: DEPTH 1295, read at its own cell and at the declaration that gave it its unit`).toEqual([
        { dimension: "depth", text: "1295", value: 1295, unit: "mm", sourceKeys: [stated?.cell, DECLARATION] },
      ]);
    }
  }, BUDGET_MS);
});

describe("I-333: S-06 places 26 caps by their outlines — never a pile circle, never the porch footing", () => {
  test("26 pile caps: PC1 4, PC2 14, PC3 5, PC4 2, PC5 1, each typed by its own schedule row", async () => {
    const { placed } = await bnbc();
    const caps = placed.placements.filter((row) => row.elementType === "pile_cap");
    const byFamily: Record<string, number> = {};
    for (const row of caps) byFamily[String(row.memberFamily)] = (byFamily[String(row.memberFamily)] ?? 0) + 1;
    expect(caps.length, "one cap per outline, not one per pile (89)").toBe(26);
    expect(byFamily, "each family as many times as S-06 draws it").toEqual(DRAWN);
    expect(caps.every((row) => row.mark === row.memberFamily), "the mark each cap was read under IS its family").toBe(true);
  }, BUDGET_MS);

  test("every cap stands on a closed LWPOLYLINE of the drawing — the turned PC1 among them — and on no circle; the porch footing stands unplaced", async () => {
    const { graph, placed } = await bnbc();
    const caps = placed.placements.filter((row) => row.elementType === "pile_cap");
    expect(new Set(caps.map((row) => typeOf(graph, row.outlineKey))), "every outline a polyline").toEqual(new Set(["LWPOLYLINE"]));
    expect(caps.map((row) => row.outlineKey), "the turned PC1 under C6 at E1").toContain(TURNED_PC1);
    expect(placed.placements.some((row) => row.outlineKey === FOOTING_RING), "638 holds no mark and stands in no cap: it is nobody's member here").toBe(false);
    expect(new Set(caps.map((row) => row.outlineKey)).size, "26 distinct rings").toBe(26);
  }, BUDGET_MS);

  test("the 89 piles and the 27 columns still stand, and the drawn scale is one on both fixtures", async () => {
    const [bnbcPlaced, rcc6Placed] = [(await bnbc()).placed, (await rcc6()).placed];
    expect(bnbcPlaced.placements.filter((row) => row.elementType === "pile").length, "S-04's 89 piles").toBe(89);
    expect(bnbcPlaced.placements.filter((row) => row.elementType === "column").length, "the 27 columns").toBe(27);
    expect(bnbcPlaced.scale, "F-RCC6-BNBC reads at one drawing unit per scheduled unit").toBe(1);
    expect(rcc6Placed.scale, "and so does F-RCC6").toBe(1);
  }, BUDGET_MS);

  test("F-RCC6's FOOTING SCHEDULE, which schedules footings AND caps, states no depth to either — the frozen fixture bills neither (I-332)", async () => {
    const { registered, placed } = await rcc6();
    const footingSchedule = registered.families.filter((family) => family.scheduleKey === "DXF_HANDLE:578");
    expect(footingSchedule.map((family) => family.family), "F1..F4 and PC1, PC2, one schedule").toEqual(["F1", "F2", "F3", "F4", "PC1", "PC2"]);
    expect(footingSchedule.flatMap((family) => family.variants.flatMap((variant) => variant.dimensions ?? [])), "no DEPTH read off a schedule of two classes").toEqual([]);
    expect(
      new Set((placed.outlines ?? []).map((outline) => `${outline.unit}|${outline.unitSourceKey}`)),
      "its rings are read in the millimetres its HEADER states, citing no declaration",
    ).toEqual(new Set(["mm|null"]));
  }, BUDGET_MS);
});

describe("I-333: each cap's plan is its own ring's — never a box, never the schedule's rectangle", () => {
  test("26 plans: 12 rectangles by their own sides and 14 polygons by shoelace — 99.445 m² and 196.2415 m of ring", async () => {
    const { placed } = await bnbc();
    const caps = new Set(placed.placements.filter((row) => row.elementType === "pile_cap").map((row) => row.placementKey));
    const plans = (placed.outlines ?? []).filter((outline) => caps.has(outline.placementKey));
    expect(plans.length, "one plan per cap").toBe(26);
    expect(plans.filter((plan) => plan.geometry === "PRISM_RECT").length, "PC1 ×4, PC3 ×5, PC4 ×2, PC5 ×1 are rectangles").toBe(12);
    expect(plans.filter((plan) => plan.geometry === "PRISM_POLY").length, "the 14 chamfered PC2").toBe(14);
    expect(new Set(plans.map((plan) => `${plan.unit}|${plan.areaUnit}|${plan.unitSourceKey}`)), "millimetres, as S-01 declares — the header is unitless (I-302)").toEqual(new Set([`mm|mm2|${DECLARATION}`]));
    const area = plans.reduce((sum, plan) => sum + Number(plan.area), 0);
    const perimeter = plans.reduce((sum, plan) => sum + Number(plan.perimeter), 0);
    expect(area, "Σ shoelace = 99,445,000 mm²").toBe(99_445_000);
    expect(Math.abs(perimeter - 196_241.5), "Σ perimeter = 196,241.5 mm, to the 0.1 lattice each ring is carried on").toBeLessThanOrEqual(26 * 0.05);
  }, BUDGET_MS);

  test("the turned PC1 is 2000 × 1000 by its own sides; a PC2 is 3.2625 m² with no sides at all", async () => {
    const { placed } = await bnbc();
    const plans = new Map((placed.outlines ?? []).map((outline) => [outline.sourceKey, outline]));
    expect(plans.get(TURNED_PC1), "its box is 2121 × 2121 and 4.5 m² — its plan is 2.0 m²").toMatchObject({ geometry: "PRISM_RECT", length: "2000.0", breadth: "1000.0", area: "2000000.0", perimeter: "6000.0" });
    expect(plans.get(CHAMFERED_PC2), "the schedule's 2100 × 1750 would say 3.675 m²").toMatchObject({ geometry: "PRISM_POLY", length: null, breadth: null, area: "3262500.0" });
  }, BUDGET_MS);
});

/**
 * TEST_AMENDED (session 8, FND-OWN, I-544, I-547): a pile cap's concrete and blinding are
 * offered under their own sentences — the prism less the heads its piles own, L-FRM-04's blinding less
 * the piles' sections (L-MEA-09) — and a cap whose piles nobody read keeps its row naming
 * `CAP_PILES_UNREAD` rather than the whole prism over them (L-QTY-04). This ratchet stages no piles:
 * what it grades is the PLAN each cap is read over, so every reading of the plan and the depth must be
 * bound, and the only thing any row may omit is the junction it was never handed. The figures are
 * graded over those bindings by the clause's own algebra below, independently of the product's
 * methods, exactly as before; ./rails/foundations/cap-junctions-rails.test.ts grades the junction.
 */
const JUNCTION_UNREAD = "CAP_PILES_UNREAD";

describe("I-334: the rail binds the ring's plan, and the cap concrete stands inside the golden's band", () => {
  test("26 cap concrete offers, every plan and depth bound: PC2 over its shoelace A, every rectangle over the schedule's sides it corroborates", async () => {
    const offers = capOffersOver(await bnbc(), CAP_KINDS.concrete);
    expect(offers.length, "one per cap").toBe(26);
    expect(
      offers.flatMap(({ offer }) => offer.omitted).filter((one) => one.code !== JUNCTION_UNREAD),
      "the plan and the depth are both read on every cap: nothing is omitted but the junction this proof stages no piles for",
    ).toEqual([]);
    const polygons = offers.filter(({ offer }) => offer.geometry.type === "PRISM_POLY");
    expect(polygons.map(({ row }) => row.memberFamily), "the 14 PC2, and only they").toEqual(Array.from({ length: 14 }, () => "PC2"));
    for (const { offer, row } of polygons) {
      expect(offer.ruleId, "measured by the pile cap's polygon sentence").toBe("rcc.pile_cap.prism_poly");
      expect([offer.bindings["A"]?.value, offer.bindings["A"]?.unit, offer.bindings["A"]?.basis, offer.bindings["A"]?.source], "A is the ring's shoelace, measured and cited to the ring").toEqual(["3262500.0", "mm2", "MEASURED", row.outlineKey]);
      expect(offer.bindings["L"], "and no schedule rectangle stands beside it").toBeUndefined();
    }
    const turned = offers.find(({ row }) => row.outlineKey === TURNED_PC1)?.offer;
    expect([turned?.ruleId, turned?.bindings["L"]?.value, turned?.bindings["B"]?.value, turned?.bindings["L"]?.basis], "the turned PC1: the schedule's own 2000 × 1000, which its own sides corroborate").toEqual([
      "rcc.pile_cap.prism_rect",
      "2000",
      "1000",
      "TRANSCRIBED",
    ]);
    expect(offers.every(({ offer }) => offer.bindings["D"]?.value === "1295" && offer.bindings["D"]?.unit === "mm"), "D is the schedule's 1295 on every cap").toBe(true);
  }, BUDGET_MS);

  test("the blinding under the twelve rectangles is laid by their plans; under the fourteen polygons it defers by name (L-FRM-04)", async () => {
    const offers = capOffersOver(await bnbc(), CAP_KINDS.blinding);
    expect(offers.length, "one per cap").toBe(26);
    const planned = offers.filter(({ offer }) => offer.bindings["L"] !== undefined && offer.bindings["B"] !== undefined);
    expect(planned.map(({ row }) => row.memberFamily).sort(), "a rectangle's blinding is its sides widened by the edition's projection").toEqual(
      ["PC1", "PC1", "PC1", "PC1", "PC3", "PC3", "PC3", "PC3", "PC3", "PC4", "PC4", "PC5"],
    );
    expect(
      planned.every(({ offer }) => offer.omitted.every((one) => one.code === JUNCTION_UNREAD)),
      "and omits nothing of its plan — only the junction this proof stages no piles for",
    ).toBe(true);
    const deferred = offers.filter(({ offer }) => !planned.some((one) => one.offer === offer));
    expect(
      deferred.every(({ offer, row }) => row.memberFamily === "PC2" && offer.omitted.some((one) => one.code === "BLINDING_PLAN_DEFERRED") && offer.omitted.every((one) => one.code === "BLINDING_PLAN_DEFERRED" || one.code === JUNCTION_UNREAD)),
      "a polygon has no L and no B to widen: the PC2 blinding is kept and named, never boxed",
    ).toBe(true);
  }, BUDGET_MS);

  test("Σ plan × depth over the 26 caps is inside PILE_CAP × RCC_CONCRETE × FDN's band — three per cent under at most, never over", async () => {
    const offers = capOffersOver(await bnbc(), CAP_KINDS.concrete);
    const cubicMetres = offers.reduce((sum, { offer }) => sum + volumeOf(offer), 0);
    const rows = goldenCellRows(FIXTURE, CAP_CONCRETE_CELL);
    const golden = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const allowance = Number(goldenCellAllowance(FIXTURE, CAP_CONCRETE_CELL));
    expect(rows.length, "the golden states the cell").toBeGreaterThan(0);
    expect(cubicMetres, `${cubicMetres.toFixed(6)} m³ is not over ${golden} + ${allowance}`).toBeLessThanOrEqual(golden + allowance);
    expect(cubicMetres, `${cubicMetres.toFixed(6)} m³ is no more than three per cent under ${golden}`).toBeGreaterThanOrEqual(golden * 0.97 - allowance);
    expect(cubicMetres, "99.445 m² × 1.295 m").toBeCloseTo(128.781275, 6);
  }, BUDGET_MS);
});

/** The golden's cap formwork cell (L-QTY-06), in its own spelling: `sum(perimeter · depth) [sides only]`. */
const CAP_FORMWORK_CELL = { class: "PILE_CAP", kind: "FORMWORK", level: "FDN" } as const;

describe("I-337: each cap is formed along its own ring's sides, and the cap formwork stands inside the golden's band", () => {
  test("26 cap formwork offers, all COMPLETE: PC2 along its ring's P, every rectangle along 2 × (L + B) of the sides its concrete binds", async () => {
    const offers = capOffersOver(await bnbc(), CAP_KINDS.formwork);
    expect(offers.length, "one per cap").toBe(26);
    expect(offers.filter(({ offer }) => offer.coverage !== "COMPLETE").map(({ offer }) => offer.omitted), "every one COMPLETE — the ring and the depth are both read").toEqual([]);
    const polygons = offers.filter(({ offer }) => offer.ruleId === "rcc.foundation.formwork_poly");
    expect(polygons.map(({ row }) => row.memberFamily), "the 14 PC2, and only they, are formed along a ring").toEqual(Array.from({ length: 14 }, () => "PC2"));
    for (const { offer, row } of polygons) {
      const ring = offer.bindings["P"];
      expect([ring?.unit, ring?.basis, ring?.source], "P is the ring's own boundary, measured and cited to the ring").toEqual(["mm", "MEASURED", row.outlineKey]);
      expect(Math.abs(Number(ring?.value) - 6960.1075), "a PC2 ring runs 6960.1 mm — its schedule's 2100 × 1750 would say 7700, which is over").toBeLessThanOrEqual(0.05);
      expect([offer.bindings["L"], offer.bindings["B"]], "and no schedule rectangle stands beside it").toEqual([undefined, undefined]);
    }
    const rectangles = offers.filter(({ offer }) => offer.ruleId === "rcc.foundation.formwork_rect");
    expect(rectangles.map(({ row }) => row.memberFamily).sort(), "the twelve rectangles").toEqual(["PC1", "PC1", "PC1", "PC1", "PC3", "PC3", "PC3", "PC3", "PC3", "PC4", "PC4", "PC5"]);
    const turned = rectangles.find(({ row }) => row.outlineKey === TURNED_PC1)?.offer;
    expect([turned?.bindings["L"]?.value, turned?.bindings["B"]?.value, turned?.bindings["L"]?.basis], "the turned PC1 along the schedule's own 2000 × 1000 its sides corroborate — never its 2121 box").toEqual([
      "2000",
      "1000",
      "TRANSCRIBED",
    ]);
    expect(
      offers.every(({ offer }) => offer.bindings["D"]?.value === "1295" && Object.keys(offer.bindings).every((name) => ["count", "L", "B", "P", "D"].includes(name))),
      "D is the schedule's 1295 on every cap, and no soffit and no top is bound on any (L-FRM-03)",
    ).toBe(true);
  }, BUDGET_MS);

  test("Σ sides × depth over the 26 caps is inside PILE_CAP × FORMWORK × FDN's band — three per cent under at most, never over", async () => {
    const offers = capOffersOver(await bnbc(), CAP_KINDS.formwork);
    const squareMetres = offers.reduce((sum, { offer }) => sum + sidesOf(offer), 0);
    const rows = goldenCellRows(FIXTURE, CAP_FORMWORK_CELL);
    const golden = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const allowance = Number(goldenCellAllowance(FIXTURE, CAP_FORMWORK_CELL));
    expect(rows.length, "the golden states the cell").toBeGreaterThan(0);
    expect(squareMetres, `${squareMetres.toFixed(6)} m² is not over ${golden} + ${allowance}`).toBeLessThanOrEqual(golden + allowance);
    expect(squareMetres, `${squareMetres.toFixed(6)} m² is no more than three per cent under ${golden}`).toBeGreaterThanOrEqual(golden * 0.97 - allowance);
    expect(squareMetres, "196.2414 m of side × 1.295 m — the golden's 1.2954 m depth, printed 1295 by the schedule, is the whole of the −0.031 %").toBeCloseTo(254.1326, 3);
  }, BUDGET_MS);
});

/** One offer's side area in m² — L-FRM-03's arithmetic done here, independently of the product's methods. */
function sidesOf(offer: Offer): number {
  const metres = (reading: Measure | undefined): number => Number(reading?.value) * (reading?.unit === "mm" ? 1e-3 : 1);
  const depth = metres(offer.bindings["D"]);
  if (offer.bindings["P"] !== undefined) return metres(offer.bindings["P"]) * depth;
  return 2 * (metres(offer.bindings["L"]) + metres(offer.bindings["B"])) * depth;
}

/** One offer's figure in m³ — the arithmetic of L-FRM-02 done here, independently of the product's methods. */
function volumeOf(offer: Offer): number {
  const metres = (reading: Measure | undefined, power: number): number => Number(reading?.value) * (reading?.unit === "mm2" || reading?.unit === "mm" ? 10 ** (-3 * power) : 1);
  const depth = metres(offer.bindings["D"], 1);
  if (offer.bindings["A"] !== undefined) return metres(offer.bindings["A"], 2) * depth;
  return metres(offer.bindings["L"], 1) * metres(offer.bindings["B"], 1) * depth;
}
