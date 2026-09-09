/**
 * The measure job, run over a staged campaign (SEAM-GATE, SEAM-JOBS, L-MEA-08, L-QTY-03).
 *
 * One rail, the real gate, one campaign: the run reads the campaign's register objects, hands the
 * gate what the rail offered as one batch, and reports what it found step by step. The rail here is
 * a stub — no rail ships at this leaf, and `RAILS` is empty — so what is proved is the WIRING: that
 * the roster is run over the pinned revision's own objects, that the gate writes what it publishes,
 * that a second run over the same campaign writes nothing further (SEAM-JOBS: "every job idempotent
 * on its key"), and that the production wiring judges the same batch the same way.
 *
 * The offers the stub makes are to the rail↔gate contract, calibration reference included: affirming
 * one is the RAIL's obligation (L-MEA-08), and a line always carries "a non-empty set of affirmed
 * calibration references" (L-QTY-03), so a rail that affirms none publishes nothing. The line each
 * offer leaves behind states exactly what it affirmed.
 *
 * Nothing here re-spells a step, a kind or a class: the steps are read from the job module's own
 * roster, the kind from the method the registry maps, and the (class, kind) pair from the catalogue.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  MEMBER_VOLUME,
  QUANTITY_LINES_TABLE,
  bears,
  bindingsIn,
  closeStage,
  field,
  gateSeam,
  measureHandlerSeam,
  measureJobSeam,
  methodsRegistry,
  offer,
  offersContract,
  railsRoster,
  rowsOfCampaign,
  stageCampaign,
  storeCounts,
  type OfferShape,
  type StagedCampaign,
} from "../gate/support/gate-stage";

/** How many register objects the campaign is staged with — one offer each. */
const OBJECTS = 2;

/** The unit the stub reads in, and the readings it makes. Any mapped unit serves; nothing turns on it. */
const READ_IN = "m";
const READINGS: Readonly<Record<string, string>> = { b: "0.3", d: "0.45", L: "3" };

/** The calibration reference the stub's readings and geometry stand on (L-QTY-03). */
const CALIBRATION = "CAL:S-101:grid-A";

let staged: Promise<StagedCampaign> | undefined;
const campaign = (): Promise<StagedCampaign> => (staged ??= stageCampaign("measure", { objects: OBJECTS }));

afterAll(async () => {
  await closeStage();
});

/** One step as the run reported it. */
type Step = { name: string; detail?: Record<string, unknown> };

/** What a rail is handed, as the job hands it — the campaign's own revision and its register objects. */
type RailInput = { campaignId: string; setRevisionId: string; kind: string; objects: readonly Record<string, unknown>[] };

/** The stub rail, and what it saw when it was run. */
type Stub = { rail: (input: RailInput) => { offers: readonly OfferShape[]; observations: readonly never[] }; kind: string; seen: { objectKeys: string[] } };

let stubbed: Promise<Stub> | undefined;

/**
 * A rail over the one kind this leaf's method measures: one offer per register object, each to the
 * contract and no more. It records the keys it was handed, because "runs the rail over the
 * campaign's register objects" is a statement about what the roster is given (L-MEA-08).
 */
const stub = (): Promise<Stub> =>
  (stubbed ??= (async () => {
    const contract = await offersContract();
    const catalogue = await bears();
    const registry = await methodsRegistry();
    const implementation = registry.implementationOf(MEMBER_VOLUME);
    expect(implementation, "the registry maps the one method this leaf lands — the rail offers what it measures").toBeTruthy();
    const kind = String((implementation as { kind: string }).kind);
    const bearing = catalogue.rows.find((row) => row.kind === kind);
    expect(bearing, `the catalogue bears the kind ${kind} the method measures`).toBeTruthy();
    const bearsRow = bearing as { class: string; kind: string };
    const geometryType = String(contract.GEOMETRY_TYPES[0]);
    const seen: { objectKeys: string[] } = { objectKeys: [] };

    const rail = (input: RailInput) => {
      seen.objectKeys = input.objects.map((object) => String(field(object, "objectKey", "object_key")));
      return {
        offers: seen.objectKeys.map((objectKey) =>
          offer({
            objectKey,
            setRevisionId: input.setRevisionId,
            kind: input.kind,
            class: bearsRow.class,
            geometryType,
            calibration: CALIBRATION,
            bindings: bindingsIn(READ_IN, READINGS, CALIBRATION),
          }),
        ),
        observations: [] as never[],
      };
    };
    return { rail, kind, seen };
  })());

/** Run the job once with the given dependencies, and answer the steps it reported. */
async function runWith(deps: { rails: Record<string, unknown>; gate: Awaited<ReturnType<typeof gateSeam>>["evaluateOffers"] }): Promise<Step[]> {
  const it = await campaign();
  const job = await measureJobSeam();
  const steps: Step[] = [];
  await job.runMeasureJob(
    { tenantId: it.tenantId, projectId: it.projectId, campaignId: it.campaignId, requestedBy: it.person.userId },
    { step: async (name, detail) => void steps.push({ name, detail }) },
    deps,
  );
  return steps;
}

/** The verdict a run reported, read off its last step (the roster's own last member). */
function verdictOf(steps: readonly Step[]): { published: unknown; queued: unknown; refused: unknown } {
  const last = steps[steps.length - 1] as Step;
  const detail = (last.detail ?? {}) as Record<string, unknown>;
  return { published: detail["published"], queued: detail["queued"], refused: detail["refused"] };
}

/** What one run of the stub rail over the campaign left behind, computed once and read by every case. */
type Run = { it: StagedCampaign; steps: Step[]; kind: string; seen: { objectKeys: string[] }; countsAfterFirst: Record<string, number> };

let running: Promise<Run> | undefined;

const run = (): Promise<Run> =>
  (running ??= (async () => {
    const it = await campaign();
    const gate = await gateSeam();
    const { rail, kind, seen } = await stub();
    const steps = await runWith({ rails: { [kind]: rail }, gate: gate.evaluateOffers });
    return { it, steps, kind, seen, countsAfterFirst: storeCounts(it.tenantId) };
  })());

describe("the measure job: one rail, the real gate, one campaign", () => {
  test("the roster is run over the campaign's own register objects, and every step is reported in order", async () => {
    const { it, steps, seen } = await run();
    const job = await measureJobSeam();

    expect(seen.objectKeys, "the rail is handed the register objects standing on the campaign's pinned revision (L-MEA-08)").toEqual(it.objectKeys);
    expect(
      steps.map((step) => step.name),
      "and the run reports the steps its own roster names, in the order it passes them (SEAM-JOBS: workers report progress events)",
    ).toEqual([...job.MEASURE_STEPS]);
    expect(verdictOf(steps), "the last step carries the verdict the gate answered").toEqual({ published: OBJECTS, queued: 0, refused: 0 });
  });

  test("what the rail offered the gate published — one line per register object, each stating what it affirmed", async () => {
    const { it } = await run();
    const lines = rowsOfCampaign(QUANTITY_LINES_TABLE, it.tenantId, it.campaignId);

    expect(
      lines.map((row) => String(field(row, "objectKey", "object_key"))).sort(),
      "the gate is the sole writer of quantity lines, and the run reached it for every object the rail offered (SEAM-GATE)",
    ).toEqual([...it.objectKeys].sort());
    for (const row of lines) {
      expect(
        field(row, "calibrationKeys", "calibration_keys"),
        "and its line states the references the offer affirmed — a non-empty set, per measured attribute (L-QTY-03)",
      ).toEqual([CALIBRATION]);
    }
  });

  test("a second run over the same campaign writes nothing further", async () => {
    const { it, steps, kind, countsAfterFirst } = await run();
    const gate = await gateSeam();
    const { rail } = await stub();

    const again = await runWith({ rails: { [kind]: rail }, gate: gate.evaluateOffers });
    expect(verdictOf(again), "a re-run of the same rail over the same revision reports what it found — it does not refuse its own lines").toEqual(verdictOf(steps));
    expect(storeCounts(it.tenantId), "and nothing further is written: every row the gate writes is keyed on the fact it records (SEAM-JOBS, L-QTY-04)").toEqual(countsAfterFirst);
  });

  test("the production wiring hands the real gate and the shipped roster, and judges the same batch the same way", async () => {
    const { it, steps, kind, countsAfterFirst } = await run();
    const handler = await measureHandlerSeam();
    const { rail } = await stub();

    const deps = handler.measureDeps();
    expect(deps.rails, "the wiring the worker registers runs the roster the product ships (ARCH-02)").toEqual(await railsRoster());
    expect(
      verdictOf(await runWith({ rails: { [kind]: rail }, gate: deps.gate })),
      "and the gate it hands in is the real one — the same batch is judged the same way through it",
    ).toEqual(verdictOf(steps));

    // The roster is empty at this leaf (scope: the column rail is inc-213), so a production run over
    // a campaign reaches the gate with nothing and says so, rather than failing for want of a rail.
    expect(verdictOf(await runWith(deps)), "with no rail to run, a production measurement publishes, queues and refuses nothing").toEqual({
      published: 0,
      queued: 0,
      refused: 0,
    });
    expect(storeCounts(it.tenantId), "and it writes nothing").toEqual(countsAfterFirst);
  });
});
