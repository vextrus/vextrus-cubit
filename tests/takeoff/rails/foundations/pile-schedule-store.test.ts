/**
 * FND-1, through the store: F-RCC6-BNBC's PILE SCHEDULE, read off the drawing, written and read back
 * through the partition's own schedule store, handed to the rails by the measure setup's own mapping,
 * measured by the foundations rails and published by the gate — and reconciled with the golden
 * takeoff per cell (I-320, I-321, I-322; AM-06 §2, R-TO-031, R-TO-032, L-QTY-06).
 *
 * WHAT IS READ AND NOTHING IS STAGED FROM A MODEL: the drawing is read by the shipped `cad/` CLI and
 * the partition's pure stages (`../../partition/support/bnbc-stages`); the registry they fold is
 * written by `rewriteScheduleRows` — the very call the partition's one transaction makes — and read
 * back by `storedMemberTypesOf`, the reader `memberTypesOf` answers through; each stored variant is
 * carried into the rails' setup by `memberVariantSetupOf`, the one mapping `railSetupOf` uses. No
 * figure below is typed from `model.json`: the diameter and the length the rails bind are the cells
 * S-05 prints, cited to those cells.
 *
 * WHAT IS STOOD IN FOR, named rather than hidden: the campaign and its register come from the gate's
 * own stage (`stageFoundationsCampaign`) — one register row per pile the placement stage placed,
 * under the pile's own number — and each row's placement carries the member family the placement
 * stage gave that number. The stored placements themselves are the partition's, and J-000 reads them
 * back on a real run (the orchestrator's read-back).
 *
 * THE BAND (L-QTY-06): three per cent under the golden, never over it, the golden read as the PRINTED
 * figure it is (`goldenFigure`: the rows summed, plus the printing's own half-unit). The pile's area is
 * π/4·d² with d the schedule's DIA — never the flattened ring's area, which reads 196,399.58 mm²
 * against the circle's 196,349.54 and would put the cell OVER the golden.
 */
import { afterAll, describe, expect, test } from "vitest";
import { ident, lit } from "../../../../db/__tests__/support/live-sql";
import { BNBC_DXF, stagesOver, type StagesRead } from "../../partition/support/bnbc-stages";
import {
  BNBC_FIXTURE,
  DRAWING_ID,
  INGEST_ID,
  PILE,
  PILING_BORED,
  PILING_BORING,
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
  type VariantSetup,
  type VerdictShape,
} from "./support/foundations-stage";
import { sql } from "../../gate/support/gate-stage";

/** The partition's schedule store, and the measure setup's one mapping of a stored variant. */
const SCHEDULES_STORE_MODULE = "src/modules/takeoff/partition/schedules/store.ts";
const MEASURE_SETUP_MODULE = "src/modules/takeoff/measure/setup.ts";

/** The pile schedule's caption and cells, by the handle the drawing gave each (S-05). */
const PILE_SCHEDULE = "DXF_HANDLE:200A";
const DIA_CELL = "DXF_HANDLE:4EE";
const LENGTH_CELL = "DXF_HANDLE:4EF";

/** The rule a pile's shaft is measured by (R-TO-032). */
const PILE_CONCRETE_RULE = "rcc.pile.concrete";

/** The words a member count would be spelled with: a stored registry says what a member IS (R-TO-031). */
const COUNT_WORDS: readonly string[] = ["count", "members", "nos", "quantity"];

type StoredVariant = { variantKey: string; dimensions?: { dimension: string; text: string; value: number; unit: string; sourceKeys: string[] }[] } & Record<string, unknown>;
type StoredFamily = { scheduleKey: string; family: string; markText: string; variants: StoredVariant[] } & Record<string, unknown>;
type ScheduleStore = {
  rewriteScheduleRows: (tx: unknown, write: Record<string, unknown>) => Promise<void>;
  storedMemberTypesOf: (tenantId: string, ingestId: string) => Promise<{ ingestId: string; families: StoredFamily[] }>;
};
type SetupDoor = { memberVariantSetupOf: (variant: StoredVariant) => VariantSetup };

let staging: Promise<void> | undefined;
let read: StagesRead;
let stage: FoundationsStage;
let stored: { ingestId: string; families: StoredFamily[] };
let batch: RailBatchShape;
let verdict: VerdictShape;
let cells: Map<string, CellReading>;

/** The drawing read, the registry stored and read back, the campaign measured — once, awaited by every case. */
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    read = await stagesOver(BNBC_DXF);
    const piles = read.placed.placements.filter((row) => row.elementType === PILE);
    expect(piles.length, "S-04 places its piles").toBeGreaterThan(0);
    const members: StagedMember[] = piles.map((row) => ({ id: row.mark, class: PILE, mark: row.mark, source: BNBC_DXF }));
    stage = await stageFoundationsCampaign("bnbc-pile-schedule", members);

    // The registry the schedules stage folded, written by the partition's own store call and read back
    // by the reader the rails' setup reads through. The stage's record is the setup's surrogate ingest,
    // so the join the setup makes is the product's own: a placement's ingest names its member types.
    const store = await productModule<ScheduleStore>(SCHEDULES_STORE_MODULE);
    await inTenantTx(stage.tenantId, (tx) =>
      store.rewriteScheduleRows(tx, {
        tenantId: stage.tenantId,
        projectId: stage.projectId,
        drawingId: DRAWING_ID,
        ingestId: INGEST_ID,
        schedules: {
          views: read.reconstructed.views,
          tables: read.reconstructed.tables,
          registry: read.registered.families,
          deferrals: [...read.reconstructed.deferrals, ...read.registered.deferrals],
        },
      }),
    );
    stored = await store.storedMemberTypesOf(stage.tenantId, INGEST_ID);

    const setup = await productModule<SetupDoor>(MEASURE_SETUP_MODULE);
    stage.setup.memberTypes = { [INGEST_ID]: Object.fromEntries(stored.families.map((family) => [family.family, family.variants.map(setup.memberVariantSetupOf)])) };
    const familyOf = new Map(piles.map((row) => [row.mark, row.memberFamily]));
    for (const object of stage.objects) {
      const key = String(object["placementKey"]);
      const held = stage.setup.placements[key];
      if (held !== undefined) stage.setup.placements[key] = { ...held, memberFamily: familyOf.get(String(object["mark"])) ?? null };
    }

    batch = await railBatchOf(stage);
    verdict = await evaluate(stage, batch);
    cells = await publishedByCell(stage.tenantId, stage.campaignId);
  })());

afterAll(async () => {
  await closeStage();
});

/** Every key at every depth of a value — where a stored count would hide. */
function keysAtEveryDepth(value: unknown, held: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const entry of value) keysAtEveryDepth(entry, held);
  else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      held.add(key.toLowerCase());
      keysAtEveryDepth(entry, held);
    }
  }
  return held;
}

/** The dimension rows the store holds for this record, as the table holds them. */
function dimensionRows(tenantId: string): string[][] {
  return sql(
    `select family, variant_key, dimension, text, value::text, unit, array_to_string(source_keys, ',') from ${ident("member_type_dimensions")}
      where tenant_id = ${lit(tenantId)}::uuid and ingest_id = ${lit(INGEST_ID)}::uuid order by family, variant_key, dimension;`,
  );
}

const BUDGET_MS = 900_000;

describe("I-322: the pile schedule's dimensions, through the store", () => {
  test("the store holds P from the pile schedule, with its diameter and its length in millimetres, cited to their cells", async () => {
    await staged();
    const family = stored.families.find((one) => one.family === "P");
    expect(family?.scheduleKey, `the family P, from ${PILE_SCHEDULE}`).toBe(PILE_SCHEDULE);
    expect(family?.markText, "its mark cell verbatim").toBe("P");
    expect(family?.variants.map((variant) => variant.dimensions), "⌀500 and 21336, as the schedule wrote them (AM-06 §2)").toEqual([
      [
        { dimension: "dia", text: "500", value: 500, unit: "mm", sourceKeys: [DIA_CELL] },
        { dimension: "length", text: "21336", value: 21336, unit: "mm", sourceKeys: [LENGTH_CELL] },
      ],
    ]);
    expect(dimensionRows(stage.tenantId), "exactly those two rows, and no family of any other schedule states a dimension its class is read for").toEqual([
      ["P", "SECTION", "dia", "500", "500", "mm", DIA_CELL],
      ["P", "SECTION", "length", "21336", "21336", "mm", LENGTH_CELL],
    ]);
  }, BUDGET_MS);

  test("no object at any depth of the stored registry carries a member count — the NOS was corroboration, and is stored nowhere", async () => {
    await staged();
    expect(COUNT_WORDS.filter((word) => keysAtEveryDepth(stored).has(word)), "a schedule says what a member IS, never how many stand (R-TO-031, T-SCHED-NORULES)").toEqual([]);
    expect(stored.families.find((one) => one.family === "P")?.["corroboration"], "the NOS the placement stage checked the plans against does not come back from the store").toBeUndefined();
  }, BUDGET_MS);

  test("the setup hands the rails the schedule's own figures, TRANSCRIBED and cited to the cells", async () => {
    await staged();
    expect(stage.setup.memberTypes[INGEST_ID]?.["P"]?.[0]?.dimensions, "the one mapping `railSetupOf` uses (I-322)").toEqual({
      dia: { value: "500", unit: "mm", basis: "TRANSCRIBED", source: DIA_CELL },
      length: { value: "21336", unit: "mm", basis: "TRANSCRIBED", source: LENGTH_CELL },
    });
  }, BUDGET_MS);
});

describe("I-321: the piles the schedule types are measured COMPLETE, inside L-QTY-06's band", () => {
  test("every pile resolves its type: no pile is MEMBER_TYPE_UNKNOWN, and the gate refused nothing", async () => {
    await staged();
    const unknown = batch.observations.filter((one) => one.class === PILE && one.code === "MEMBER_TYPE_UNKNOWN");
    expect(unknown.length, `no pile is left untyped (${JSON.stringify(unknown.slice(0, 3))})`).toBe(0);
    expect(verdict.refused, `every offer published (the gate refused ${JSON.stringify(verdict.refusals)})`).toBe(0);
  }, BUDGET_MS);

  test("piling.bored and piling.boring: one COMPLETE line per pile, the count and the scheduled length", async () => {
    await staged();
    const piles = read.placed.placements.filter((row) => row.elementType === PILE).length;
    const { exact } = await canon();
    for (const kind of [PILING_BORED, PILING_BORING]) {
      const held = cells.get(`${PILE}|${kind}`);
      expect(held?.lines, `${kind}: one line per placed pile`).toBe(piles);
      expect(held?.partial, `${kind}: every one of them COMPLETE — the schedule states what it needs (AM-06 §2)`).toBe(0);
    }
    expect(cells.get(`${PILE}|${PILING_BORED}`)?.sum.eq(exact(String(piles))), "the piles counted, one each").toBe(true);
    expect(
      cells.get(`${PILE}|${PILING_BORING}`)?.sum.eq(exact("21.336").mul(String(piles))),
      `each bored the 21,336 mm the schedule states — never the cap's embedment added to it (sum ${cells.get(`${PILE}|${PILING_BORING}`)?.sum.toString()})`,
    ).toBe(true);
  }, BUDGET_MS);

  test("every published pile cell stands inside the golden's band — three per cent under, never over", async () => {
    await staged();
    const { exact } = await canon();
    for (const kind of [PILING_BORED, PILING_BORING, RCC_CONCRETE]) {
      const held = cells.get(`${PILE}|${kind}`) as CellReading;
      expect(held?.partial, `${PILE} × ${kind} is judged only under COMPLETE coverage (L-QTY-06)`).toBe(0);
      const golden = goldenFigure(goldenCell(BNBC_FIXTURE, { class: PILE, kind }), exact as (value: string) => ReturnType<typeof exact>);
      expect(golden.printed.mul(exact(UNDER_TOLERANCE)).sub(golden.halfUlp).lte(held.sum), `${PILE} × ${kind}: ${held.sum.toString()} is no more than three per cent under ${golden.said}`).toBe(true);
      expect(held.sum.lte(golden.printed.add(golden.halfUlp)), `${PILE} × ${kind}: ${held.sum.toString()} is not over ${golden.said} — an over-measured figure is never a disclosure (L-QTY-04)`).toBe(true);
    }
  }, BUDGET_MS);

  test("a pile's shaft binds the schedule's diameter and length, never the ring's area", async () => {
    await staged();
    const lines = linesUnderRule(stage.tenantId, stage.campaignId, PILE_CONCRETE_RULE);
    expect(lines.length, "a line per pile under the pile's own rule").toBeGreaterThan(0);
    for (const line of lines.slice(0, 3)) {
      const bindings = (line as Record<string, unknown>)["bindings"] as Record<string, { value?: string; unit?: string; source?: string }>;
      expect([bindings["d"]?.value, bindings["d"]?.unit, bindings["d"]?.source], "d is S-05's DIA cell").toEqual(["500", "mm", DIA_CELL]);
      expect([bindings["length"]?.value, bindings["length"]?.unit, bindings["length"]?.source], "and the length is S-05's LENGTH cell").toEqual(["21336", "mm", LENGTH_CELL]);
    }
  }, BUDGET_MS);
});

describe("I-322: the dimensions are rebuilt with the partition", () => {
  test("a rewrite that reads no schedule leaves no dimension of the one that stood", async () => {
    await staged();
    const store = await productModule<ScheduleStore>(SCHEDULES_STORE_MODULE);
    await inTenantTx(stage.tenantId, (tx) => store.rewriteScheduleRows(tx, { tenantId: stage.tenantId, projectId: stage.projectId, drawingId: DRAWING_ID, ingestId: INGEST_ID, schedules: null }));
    expect(dimensionRows(stage.tenantId), "cleared beneath the variants, in the same rewrite (L-REG-04)").toEqual([]);
    expect((await store.storedMemberTypesOf(stage.tenantId, INGEST_ID)).families, "and the registry with them").toEqual([]);
  }, BUDGET_MS);
});
