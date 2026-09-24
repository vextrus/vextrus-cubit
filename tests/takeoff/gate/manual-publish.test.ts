/**
 * S3, live: a hand measurement reaches the gate through the campaign's measure run (V-DB,
 * docs/design/s-measure.md I-379, I-382, I-383, I-384).
 *
 * Over S1's world — S-08 in miniature, ingested, partitioned, discipline-confirmed, scale-affirmed and
 * pinned through the shipped doors — one blinding traced on the plan is recorded through the act seam,
 * and the production wiring's measure run (the shipped roster, the real gate) publishes it:
 *   · one line on the hand measurement's register row, under `pcc.blinding.area`, stating its formula,
 *     the view's calibration key and its basis — and its figure is the one the act's preview showed;
 *   · a second run writes nothing further;
 *   · the residue sights every kind the slab bears at that level, and only the blinding bears a
 *     quantity (I-383);
 *   · a machine offer into the cell the hand measurement claims is refused CELL_MEASURED_BY_HAND;
 *   · struck, the hand object's cell reads NOT_ESTABLISHED although its line stays stored — and so does
 *     a struck machine object's (the residue withholds what the bill withholds, I-379);
 *   · the commit door asks for the run itself (I-384).
 *
 * Product modules are loaded by absolute path after the stage has named the scratch world.
 */
import { afterAll, describe, expect, test } from "vitest";
import { openStage } from "../../spine/uploads/support/upload-stage";
import { gateSeam, measureHandlerSeam } from "./support/gate-stage";
import {
  ERRORS_MODULE,
  REPUDIATE,
  actorOf,
  closeStage,
  countOf,
  performAct,
  productModule,
  sql,
  stageMachineLine,
  stageManualWorld,
  stageRegisterObject,
  tracing,
  campaignOf,
  type ManualWorld,
} from "../manual/support/manual-stage";

const BUDGET_MS = 600_000;

const RESIDUE_MODULE = "src/core/residue/residue.ts";
const BEARS_MODULE = "src/core/catalogue/bears.ts";
const ROUTER_MODULE = "src/server/routers/takeoff-manual.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const JOBS_MODULE = "src/core/jobs/index.ts";

/** The queue's stop, where a case started it. */
let stopRuntime: (() => Promise<void>) | undefined;

type Offered = { kind: string; arm: string; value?: string | null; unit?: string; formula?: string; quantityBasis?: string; ruleId?: string };
type Measured = { objectKey: string; calibrationKey: string; campaignId?: string; offered?: Offered[] };
type Cell = { kind: string; class: string | null; levelId: string | null; measurement: string };

let staging: Promise<ManualWorld> | undefined;
const staged = (): Promise<ManualWorld> => (staging ??= stageManualWorld("publish", 93));
let stagingOther: Promise<ManualWorld> | undefined;
const other = (): Promise<ManualWorld> => (stagingOther ??= stageManualWorld("publish-door", 94));

afterAll(async () => {
  await stopRuntime?.().catch(() => undefined);
  await closeStage();
}, 120_000);

/** Run the campaign's measurement through the production wiring the worker registers. */
async function measure(world: ManualWorld): Promise<void> {
  const { campaignId } = campaignOf(world);
  const job = await productModule<{
    runMeasureJob(payload: unknown, progress: { step(name: string, detail?: unknown): Promise<void> }, deps: unknown): Promise<void>;
  }>("src/modules/takeoff/measure/job.ts");
  const handler = await measureHandlerSeam();
  await job.runMeasureJob({ tenantId: world.person.tenantId, projectId: world.projectId, campaignId, requestedBy: world.person.userId }, { step: async () => undefined }, handler.measureDeps());
}

/** The campaign's lines of one object, as the store holds them. */
function linesOf(world: ManualWorld, objectKey: string): string[][] {
  const { campaignId } = campaignOf(world);
  return sql(
    `select kind, value::text, unit, formula, rule_id, rule_version, quantity_basis, coverage, calibration_keys::text
       from quantity_lines where campaign_id = '${campaignId}'::uuid and object_key = '${objectKey.replaceAll("'", "''")}' order by kind;`,
  );
}

async function cellsOf(world: ManualWorld): Promise<Cell[]> {
  const { residueOf } = await productModule<{ residueOf(scope: unknown): Promise<{ cells: Cell[] }> }>(RESIDUE_MODULE);
  return (await residueOf({ tenantId: world.person.tenantId, projectId: world.projectId })).cells;
}

const cellAt = (cells: readonly Cell[], klass: string, kind: string, levelId: string): Cell | undefined => cells.find((cell) => cell.class === klass && cell.kind === kind && cell.levelId === levelId);

async function codes(): Promise<Record<string, { code: string }>> {
  return (await productModule<{ REFUSALS: Record<string, { code: string }> }>(ERRORS_MODULE)).REFUSALS;
}

describe("S3: a hand measurement publishes through the campaign's run, as its preview said (I-384)", () => {
  let recorded: Promise<Measured> | undefined;
  const record = (): Promise<Measured> =>
    (recorded ??= (async () => {
      const world = await staged();
      const { consequence } = await performAct(actorOf(world.person), tracing(world));
      return (consequence as { measurement: Measured }).measurement;
    })());

  test("one line on the hand row, under pcc.blinding.area, with its formula, calibration key and basis — at the figure the preview showed", async () => {
    const world = await staged();
    const m = await record();
    const [previewed] = m.offered ?? [];
    expect(previewed?.arm, `the preview asked the gate: ${JSON.stringify(m.offered)}`).toBe("published");
    expect(countOf("register_objects", `object_key = '${m.objectKey}'`), "the hand row stands in the register").toBe(1);

    await measure(world);
    const lines = linesOf(world, m.objectKey);
    expect(lines.length, "one line, of the one kind the recipe measures").toBe(1);
    const [kind, value, unit, formula, ruleId, , basis, coverage, keys] = lines[0] ?? [];
    expect([kind, ruleId, coverage]).toEqual(["pcc.blinding", "pcc.blinding.area", "COMPLETE"]);
    const { exact } = await productModule<{ exact(value: string): { eq(other: string): boolean } }>("src/core/units/canon.ts");
    expect(exact(value ?? "NaN").eq(previewed?.value ?? "NaN"), `published ${value} against the preview's ${previewed?.value}`).toBe(true);
    expect([unit, formula, basis], "the preview's unit, formula and basis are the line's").toEqual([previewed?.unit, previewed?.formula, previewed?.quantityBasis]);
    expect(JSON.parse(keys ?? "[]"), "the line cites the view's calibration key").toEqual([m.calibrationKey]);

    await measure(world);
    expect(linesOf(world, m.objectKey).length, "a second run writes nothing further").toBe(1);
  }, BUDGET_MS);

  test("the residue sights every kind the slab bears at its level, and only the blinding bears a quantity (I-383)", async () => {
    const world = await staged();
    await record();
    const { BEARS } = await productModule<{ BEARS: readonly { class: string; kind: string }[] }>(BEARS_MODULE);
    const borne = [...new Set(BEARS.filter((row) => row.class === "slab").map((row) => row.kind))].sort();
    const cells = await cellsOf(world);
    const slab = cells.filter((cell) => cell.class === "slab" && cell.levelId === world.levelId);
    expect(slab.map((cell) => cell.kind).sort(), "one cell per kind the slab bears").toEqual(borne);
    for (const cell of slab) expect([cell.kind, cell.measurement]).toEqual([cell.kind, cell.kind === "pcc.blinding" ? "QUANTITY_BEARING" : "NOT_ESTABLISHED"]);
  }, BUDGET_MS);

  test("a machine offer into the cell the hand measurement claims is refused CELL_MEASURED_BY_HAND", async () => {
    const world = await staged();
    const m = await record();
    const { campaignId, setRevisionId } = campaignOf(world);
    const machineKey = await stageRegisterObject(world, "SOGM");
    const gate = await gateSeam();
    const reading = (value: string, unit: string, basis: string, source: string) => ({ value, unit, basis, source, calibration: m.calibrationKey });
    const verdict = await gate.evaluateOffers(
      { tenantId: world.person.tenantId, projectId: world.projectId, campaignId },
      {
        offers: [
          {
            ruleId: "pcc.blinding.area",
            kind: "pcc.blinding",
            class: "slab",
            register: { setRevisionId, objectKey: machineKey },
            drawing: { drawingId: world.drawingId, viewKey: "v:LAYOUT_PLAN:machine" },
            engine: "VECTOR",
            geometry: { type: "POLYGON", basis: "MEASURED", calibration: m.calibrationKey },
            bindings: { count: reading("1", "pcs", "MEASURED", "DXF_HANDLE:1"), A: reading("1600", "mm2", "MEASURED", "DXF_HANDLE:1"), t: reading("75", "mm", "ENTERED", "DXF_HANDLE:1"), threshold: reading("0.1", "m2", "DERIVED", "edition") },
            selectors: {},
            deductions: [],
            omitted: [],
            coverage: "COMPLETE",
          },
        ] as never,
        observations: [],
      },
    );
    expect(verdict.refusals.map((refusal: { objectKey: string; code: string }) => [refusal.objectKey, refusal.code])).toEqual([[machineKey, (await codes())["CELL_MEASURED_BY_HAND"]?.code]]);
    expect(linesOf(world, machineKey), "nothing of the machine's stands in the person's cell").toEqual([]);
  }, BUDGET_MS);

  test("struck, the hand object's cell reads NOT_ESTABLISHED — its line stays stored and counts for nothing (I-379)", async () => {
    const world = await staged();
    const m = await record();
    await measure(world);
    expect(cellAt(await cellsOf(world), "slab", "pcc.blinding", world.levelId)?.measurement).toBe("QUANTITY_BEARING");
    await performAct(actorOf(world.person), { type: REPUDIATE, projectId: world.projectId, objectKey: m.objectKey });
    expect(linesOf(world, m.objectKey).length, "lines are append-only within a campaign").toBe(1);
    expect(cellAt(await cellsOf(world), "slab", "pcc.blinding", world.levelId)?.measurement, "the residue withholds what the bill withholds").toBe("NOT_ESTABLISHED");
  }, BUDGET_MS);
});

describe("S3: the same no-join rule for a machine object, and the commit door asks for the run", () => {
  test("a struck machine object's cell reads NOT_ESTABLISHED too (I-379)", async () => {
    const world = await other();
    const machine = await stageMachineLine(world, "rcc.formwork");
    expect(cellAt(await cellsOf(world), "slab", "rcc.formwork", world.levelId)?.measurement).toBe("QUANTITY_BEARING");
    await performAct(actorOf(world.person), { type: REPUDIATE, projectId: world.projectId, objectKey: machine });
    expect(cellAt(await cellsOf(world), "slab", "rcc.formwork", world.levelId)?.measurement).toBe("NOT_ESTABLISHED");
  }, BUDGET_MS);

  test("takeoffManual.commit records the measurement and requests the campaign's measure run (I-384)", async () => {
    const world = await other();
    // The queue the door asks, started as the worker starts it (no measure handler is registered
    // here, so the job waits on the queue: what is proved is the ask, not the run).
    const { db } = await openStage();
    const jobs = await productModule<{ startJobsRuntime(url: string): Promise<void>; stopJobsRuntime(): Promise<void> }>(JOBS_MODULE);
    await jobs.startJobsRuntime(db.urlMigrate);
    stopRuntime = jobs.stopJobsRuntime;
    const { createContext } = await productModule<{ createContext(opts: { req: Request }): Promise<unknown> }>(CONTEXT_MODULE);
    const { takeoffManualRouter } = await productModule<{
      takeoffManualRouter: { createCaller(ctx: unknown): { preview(input: unknown): Promise<{ consequenceDigest: string }>; commit(input: unknown): Promise<{ objectKey: string | null; measure: { requested: boolean; jobId?: string } | null }> } };
    }>(ROUTER_MODULE);
    const request = new Request("http://127.0.0.1/api/trpc/takeoffManual.commit", { method: "POST", headers: { cookie: (world.person as { cookie: string }).cookie } });
    const door = takeoffManualRouter.createCaller(await createContext({ req: request }));
    // The wire states the act's input without its type: the door names the act (takeoff-manual.ts).
    const input = Object.fromEntries(Object.entries(tracing(world)).filter(([name]) => name !== "type"));
    const { consequenceDigest } = await door.preview({ input });
    const answered = await door.commit({ input, consequenceDigest });
    expect(answered.objectKey, "the measurement was recorded").not.toBeNull();
    expect(answered.measure?.requested, `the run was asked for: ${JSON.stringify(answered.measure)}`).toBe(true);
    expect(typeof answered.measure?.jobId, "the run is a job on the campaign's key").toBe("string");
  }, BUDGET_MS);
});
