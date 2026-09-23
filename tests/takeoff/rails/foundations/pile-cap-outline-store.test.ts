/**
 * FND-2, through the store: F-RCC6-BNBC's pile caps READ off the drawing — S-06's 26 cap outlines and
 * S-06's PILE CAP SCHEDULE — written and read back through the partition's own placement and schedule
 * stores, handed to the rails by the measure setup's own mappings, measured by the foundations rails
 * and published by the gate, and reconciled with the golden takeoff per cell (I-330..I-334; L-FRM-02,
 * R-TO-031, R-TO-032, L-QTY-06).
 *
 * WHAT IS READ AND NOTHING IS STAGED FROM A MODEL: the drawing is read by the shipped `cad/` CLI and
 * the partition's pure stages (`../../partition/support/bnbc-stages`). The placements and the plans
 * their rings enclose are written by `rewritePlacementRows` — the very call the partition's one
 * transaction makes — and read back by `storedOutlinesOf`, the reader `outlinesOf` answers through;
 * the registry by `rewriteScheduleRows` and `storedMemberTypesOf`. Each is carried into the rails'
 * setup by `outlineSetupOf` and `memberFamiliesSetupOf`, the mappings `railSetupOf` uses. No figure
 * below is typed from `model.json`: the plans are the rings S-06 draws and the sizes and depths the
 * cells S-06's schedule prints.
 *
 * WHAT IS STOOD IN FOR, named rather than hidden: the campaign and its register come from the gate's
 * own stage (`stageFoundationsCampaign`) — one register row per cap the placement stage placed — and
 * each row's placement is handed the family and the stored plan the placement stage gave that cap.
 * J-000 reads the stored placements back on a real run (the orchestrator's read-back).
 *
 * THE BAND (L-QTY-06): three per cent under the golden, never over it, the golden read as the PRINTED
 * figure it is (`goldenFigure`: the rows summed, plus the printing's own half-unit). The plan is the
 * ring's — a PC2 is its 3.2625 m² shoelace and never the schedule's 2100 × 1750 (3.675 m², which would
 * put the cell 5.8 % over), and the PC1 turned 45° its own 2000 × 1000 and never its 2121 × 2121 box.
 */
import { afterAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import { BNBC_DXF, stagesOver, type StagesRead } from "../../partition/support/bnbc-stages";
import {
  BNBC_FIXTURE,
  DRAWING_ID,
  INGEST_ID,
  PILE_CAP,
  RCC_CONCRETE,
  UNDER_TOLERANCE,
  canon,
  closeStage,
  evaluate,
  goldenCell,
  goldenFigure,
  inTenantTx,
  linesUnderRule,
  productModule,
  publishedByCell,
  railBatchOf,
  stageFoundationsCampaign,
  type CellReading,
  type FoundationsStage,
  type RailBatchShape,
  type StagedMember,
  type VerdictShape,
} from "./support/foundations-stage";
import { sql } from "../../gate/support/gate-stage";

/** The partition's two stores, and the measure setup's mappings of what they hold. */
const PLACEMENT_STORE_MODULE = "src/modules/takeoff/partition/placement/store.ts";
const SCHEDULES_STORE_MODULE = "src/modules/takeoff/partition/schedules/store.ts";
const MEASURE_SETUP_MODULE = "src/modules/takeoff/measure/setup.ts";

/** The schedule the caps are typed by, and the two rings the plans are graded on (S-06). */
const PILE_CAP_SCHEDULE = "DXF_HANDLE:202D";
const BAR_SCHEDULE = "DXF_HANDLE:1E3D";
const TURNED_PC1 = "DXF_HANDLE:5FB";
const DECLARATION = "DXF_HANDLE:1F3E";

/** The rules a cap's concrete is measured by (R-TO-032). */
const PRISM_POLY_RULE = "rcc.foundation.prism_poly";
const PRISM_RECT_RULE = "rcc.foundation.prism_rect";

type StoredOutline = { placementKey: string; sourceKey: string; unitSourceKey: string | null; geometry: string; unit: string; areaUnit: string; area: string; perimeter: string; length: string | null; breadth: string | null };
type StoredFamily = { scheduleKey: string; family: string; variants: { variantKey: string; dimensions?: { dimension: string; value: number; unit: string }[] }[] } & Record<string, unknown>;
type PlacementStore = {
  rewritePlacementRows: (tx: unknown, write: Record<string, unknown>) => Promise<void>;
  storedOutlinesOf: (tenantId: string, ingestId: string) => Promise<StoredOutline[]>;
};
type ScheduleStore = {
  rewriteScheduleRows: (tx: unknown, write: Record<string, unknown>) => Promise<void>;
  storedMemberTypesOf: (tenantId: string, ingestId: string) => Promise<{ ingestId: string; families: StoredFamily[] }>;
};
type SetupDoor = {
  outlineSetupOf: (outline: StoredOutline) => Record<string, unknown>;
  memberFamiliesSetupOf: (families: readonly StoredFamily[]) => Record<string, readonly unknown[]>;
};

let staging: Promise<void> | undefined;
let read: StagesRead;
let stage: FoundationsStage;
let outlines: StoredOutline[];
let families: StoredFamily[];
let batch: RailBatchShape;
let verdict: VerdictShape;
let cells: Map<string, CellReading>;

/** The drawing read, the partition stored and read back, the campaign measured — once, awaited by every case. */
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    read = await stagesOver(BNBC_DXF);
    const caps = read.placed.placements.filter((row) => row.elementType === PILE_CAP);
    expect(caps.length, "S-06 places its caps").toBeGreaterThan(0);
    const members: StagedMember[] = caps.map((row, index) => ({ id: `${row.mark}-${index + 1}`, class: PILE_CAP, mark: row.mark, source: BNBC_DXF }));
    stage = await stageFoundationsCampaign("bnbc-pile-caps", members);

    // The partition as its one transaction writes it: the placements with the plans their rings enclose,
    // and the registry the schedules folded — each read back by the reader the setup reads through.
    const placementStore = await productModule<PlacementStore>(PLACEMENT_STORE_MODULE);
    const scheduleStore = await productModule<ScheduleStore>(SCHEDULES_STORE_MODULE);
    const scope = { tenantId: stage.tenantId, projectId: stage.projectId, drawingId: DRAWING_ID, ingestId: INGEST_ID };
    await inTenantTx(stage.tenantId, (tx) => placementStore.rewritePlacementRows(tx, { ...scope, placements: read.placed }));
    await inTenantTx(stage.tenantId, (tx) =>
      scheduleStore.rewriteScheduleRows(tx, {
        ...scope,
        schedules: { views: read.reconstructed.views, tables: read.reconstructed.tables, registry: read.registered.families, deferrals: [...read.reconstructed.deferrals, ...read.registered.deferrals] },
      }),
    );
    outlines = await placementStore.storedOutlinesOf(stage.tenantId, INGEST_ID);
    families = (await scheduleStore.storedMemberTypesOf(stage.tenantId, INGEST_ID)).families;

    // The setup, through the setup's own mappings: the stage's register rows were staged in the caps'
    // order, so the n-th row stands for the n-th cap the placement stage placed.
    const setup = await productModule<SetupDoor>(MEASURE_SETUP_MODULE);
    stage.setup.memberTypes = { [INGEST_ID]: setup.memberFamiliesSetupOf(families) as never };
    const planOf = new Map(outlines.map((outline) => [outline.placementKey, outline]));
    caps.forEach((cap, index) => {
      const key = String(stage.objects[index]?.["placementKey"]);
      const held = stage.setup.placements[key];
      const plan = planOf.get(cap.placementKey);
      expect(held !== undefined && plan !== undefined, `the ${index + 1}th register row stands for ${cap.placementKey}, and the store holds its plan`).toBe(true);
      stage.setup.placements[key] = { ...(held as object), memberFamily: cap.memberFamily, outline: setup.outlineSetupOf(plan as StoredOutline) } as never;
    });

    batch = await railBatchOf(stage);
    verdict = await evaluate(stage, batch);
    cells = await publishedByCell(stage.tenantId, stage.campaignId);
  })());

afterAll(async () => {
  await closeStage();
});

/** The cap plans the store holds for this record, as the table holds them. */
function capOutlineRows(tenantId: string): string[][] {
  return sql(
    `select o.geometry, o.unit, o.area_unit, o.area, o.perimeter, coalesce(o.length, ''), coalesce(o.breadth, ''), o.source_key, coalesce(o.unit_source_key, '')
       from ${ident("placement_outlines")} o join ${ident("placements")} p
         on p.tenant_id = o.tenant_id and p.ingest_id = o.ingest_id and p.placement_key = o.placement_key
      where o.tenant_id = ${lit(tenantId)}::uuid and o.ingest_id = ${lit(INGEST_ID)}::uuid and p.element_type = ${lit(PILE_CAP)}
      order by o.placement_key;`,
  );
}

const BUDGET_MS = 900_000;

describe("I-333: the caps' plans, through the store", () => {
  test("the store holds one plan per cap — 12 rectangles and 14 polygons, 99.445 m² and 196.2415 m of ring, in the millimetres S-01 declares", async () => {
    await staged();
    const rows = capOutlineRows(stage.tenantId);
    expect(rows.length, "26 caps, 26 plans").toBe(26);
    expect(rows.filter((row) => row[0] === "PRISM_RECT").length, "the rectangles").toBe(12);
    expect(rows.filter((row) => row[0] === "PRISM_POLY").length, "the chamfered PC2").toBe(14);
    expect(new Set(rows.map((row) => `${row[1]}|${row[2]}|${row[8]}`)), "mm and mm², cited to the declaration (I-302)").toEqual(new Set([`mm|mm2|${DECLARATION}`]));
    const { exact } = await canon();
    const area = rows.reduce((sum, row) => sum.add(exact(row[3] as string)), exact("0"));
    const perimeter = rows.reduce((sum, row) => sum.add(exact(row[4] as string)), exact("0"));
    expect(area.eq(exact("99445000")), `Σ shoelace ${area.toString()} mm² is 99.445 m²`).toBe(true);
    const lattice = exact("1.3");
    expect(perimeter.sub(exact("196241.5")).lte(lattice) && exact("196241.5").sub(perimeter).lte(lattice), `Σ perimeter ${perimeter.toString()} mm is 196.2415 m, to the 0.1 lattice of each ring`).toBe(true);
    expect(rows.find((row) => row[7] === TURNED_PC1)?.slice(0, 7), "the turned PC1 by its own sides").toEqual(["PRISM_RECT", "mm", "mm2", "2000000.0", "6000.0", "2000.0", "1000.0"]);
  }, BUDGET_MS);

  test("the registry the setup reads holds PC1..PC5 from the cap schedule with their depth, and nothing from the bar schedule", async () => {
    await staged();
    expect(families.filter((family) => family.scheduleKey === BAR_SCHEDULE), "a bar schedule registers no member type (I-331)").toEqual([]);
    const caps = families.filter((family) => family.scheduleKey === PILE_CAP_SCHEDULE);
    expect(caps.map((family) => family.family), "five cap families").toEqual(["PC1", "PC2", "PC3", "PC4", "PC5"]);
    expect(caps.map((family) => family.variants[0]?.dimensions?.map((one) => [one.dimension, one.value, one.unit])), "DEPTH 1295 mm on every one (I-332)").toEqual(Array.from({ length: 5 }, () => [["depth", 1295, "mm"]]));
  }, BUDGET_MS);

  test("a rewrite that places nothing leaves no plan of the one that stood", async () => {
    await staged();
    const placementStore = await productModule<PlacementStore>(PLACEMENT_STORE_MODULE);
    const scope = { tenantId: stage.tenantId, projectId: stage.projectId, drawingId: DRAWING_ID, ingestId: INGEST_ID };
    await inTenantTx(stage.tenantId, (tx) => placementStore.rewritePlacementRows(tx, { ...scope, placements: null }));
    expect(await placementStore.storedOutlinesOf(stage.tenantId, INGEST_ID), "cleared with the placements, in the same rewrite (L-REG-04)").toEqual([]);
    await inTenantTx(stage.tenantId, (tx) => placementStore.rewritePlacementRows(tx, { ...scope, placements: read.placed }));
  }, BUDGET_MS);
});

describe("I-334: the caps are measured over their own plans, COMPLETE, inside L-QTY-06's band", () => {
  test("every cap resolves its type, and the gate refused nothing", async () => {
    await staged();
    const unknown = batch.observations.filter((one) => one.class === PILE_CAP && one.code === "MEMBER_TYPE_UNKNOWN");
    expect(unknown.length, `no cap is left untyped (${JSON.stringify(unknown.slice(0, 3))})`).toBe(0);
    expect(verdict.refused, `every offer published (the gate refused ${JSON.stringify(verdict.refusals)})`).toBe(0);
  }, BUDGET_MS);

  test("pile_cap × rcc.concrete: 26 COMPLETE lines; the PC2 lines are PRISM_POLY over A = 3.2625 m²", async () => {
    await staged();
    const held = cells.get(`${PILE_CAP}|${RCC_CONCRETE}`);
    expect(held?.lines, "one line per cap").toBe(26);
    expect(held?.partial, `every one COMPLETE (${JSON.stringify(held?.partialCodes)})`).toBe(0);
    const { exact } = await canon();
    const polygons = linesUnderRule(stage.tenantId, stage.campaignId, PRISM_POLY_RULE);
    expect(polygons.length, "the 14 PC2").toBe(14);
    for (const line of polygons) {
      const bindings = (line as Record<string, unknown>)["bindings"] as Record<string, { value?: string; unit?: string; basis?: string; canonical?: { value?: string; unit?: string } }>;
      expect([bindings["A"]?.value, bindings["A"]?.unit, bindings["A"]?.basis], "A is the ring's shoelace, measured").toEqual(["3262500.0", "mm2", "MEASURED"]);
      expect(bindings["A"]?.canonical?.unit, "carried by the canon in m²").toBe("m2");
      expect(exact(String(bindings["A"]?.canonical?.value)).eq(exact("3.2625")), `as 3.2625 m² (${String(bindings["A"]?.canonical?.value)})`).toBe(true);
    }
    expect(linesUnderRule(stage.tenantId, stage.campaignId, PRISM_RECT_RULE).length, "and the twelve rectangles by their sides").toBe(12);
  }, BUDGET_MS);

  test("PILE_CAP × RCC_CONCRETE × FDN stands inside the golden's band — three per cent under at most, never over", async () => {
    await staged();
    const { exact } = await canon();
    const held = cells.get(`${PILE_CAP}|${RCC_CONCRETE}`) as CellReading;
    const golden = goldenFigure(goldenCell(BNBC_FIXTURE, { class: PILE_CAP, kind: RCC_CONCRETE }), exact as (value: string) => ReturnType<typeof exact>);
    expect(golden.printed.mul(exact(UNDER_TOLERANCE)).sub(golden.halfUlp).lte(held.sum), `${held.sum.toString()} m³ is no more than three per cent under ${golden.said}`).toBe(true);
    expect(held.sum.lte(golden.printed.add(golden.halfUlp)), `${held.sum.toString()} m³ is not over ${golden.said} — an over-measured figure is never a disclosure (L-QTY-04)`).toBe(true);
    expect(held.sum.eq(exact("99.445").mul(exact("1.295"))), `and it is 99.445 m² × 1.295 m exactly (${held.sum.toString()})`).toBe(true);
  }, BUDGET_MS);
});
