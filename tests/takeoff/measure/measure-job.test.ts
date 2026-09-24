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
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { lit } from "../../../db/__tests__/support/live-sql";
import {
  COLUMN_C1,
  GROUND_FLOOR,
  LEVELS_MODULE,
  MEMBER_VOLUME,
  QUANTITY_LINES_TABLE,
  RAIL_OBSERVATIONS_TABLE,
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
  productModule,
  railsRoster,
  registerSeam,
  rowsOfCampaign,
  sql,
  sqlValue,
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

/**
 * MEASURE-REFUSE (walk-0 fresh-flow B03; L-MEA-05 "declared, never silent", L-MEA-07; s-coverage
 * I-484): on a fresh, unscaled set the run published nothing and answered "Done 0 s" with
 * nothing deferred. A run over a campaign whose view no affirmation names, and whose ground floor no
 * one has stated a height for, now NAMES both — in its own verdict, in the store the gate wrote its
 * reports to, in the register's deferred-and-refused region and in the coverage cell's reason.
 *
 * The rail is a stub that reports exactly what every shipped rail reports for a member placed in a
 * view with no calibration of record — `VIEW_SCALE_UNAFFIRMED`, against the VIEW (the column, frame,
 * foundation, slab and masonry rails all do so) — so what is judged is the run and its readers, not
 * a rail's own branch.
 */
describe("MEASURE-REFUSE: an unscaled run defers by name, per view and per storey", () => {
  /** The view the stub's members were placed in, as a rail reports it (its L-REG-04 address). */
  const UNSCALED_VIEW = "v:LAYOUT_PLAN:DXF_HANDLE:UNSCALED";
  /** The caption that view is anchored by, as the stored partition holds it, and the anchor's key. */
  const UNSCALED_CAPTION = "GROUND FLOOR COLUMN LAYOUT PLAN";
  const UNSCALED_ANCHOR = "DXF_HANDLE:UNSCALED";
  const SCALE = "VIEW_SCALE_UNAFFIRMED";
  const HEIGHT_UNSTATED = "STOREY_HEIGHT_UNSTATED";

  type Refused = { campaign: StagedCampaign; steps: Step[]; groundLevelId: string; sheet: { drawingId: string; layoutName: string } };

  let refusing: Promise<Refused> | undefined;
  const refused = (): Promise<Refused> =>
    (refusing ??= (async () => {
      const it = await stageCampaign("measure-refuse", { objects: 2 });
      // The view the members were placed in, as the pinned drawing's stored partition holds it: its
      // caption and the caption's own entity, on the manifest's first drawing — what the register names
      // the deferral by. The stage records no reading of that drawing's bytes, so the caption stands on
      // no sheet anyone read, and the deferral is opened nowhere rather than at the drawing's file name
      // (s-coverage I-548; the sheet a caption stands on is proved over a real record in
      // tests/residue/channels-layout.db.test.ts).
      const manifest = (path: string): string =>
        sqlValue(`select (manifest -> 0 ->> '${path}') from drawing_set_revisions where tenant_id = ${lit(it.tenantId)} and set_revision_id = ${lit(it.setRevisionId)};`);
      const sheet = { drawingId: manifest("drawingId"), layoutName: manifest("name") };
      sql(
        `insert into partition_views (tenant_id, project_id, drawing_id, ingest_id, view_key, type, caption, anchor_key) values (${lit(it.tenantId)}, ${lit(it.projectId)}, ${lit(sheet.drawingId)}, ${lit(randomUUID())}, ${lit(UNSCALED_VIEW)}, 'LAYOUT_PLAN', ${lit(UNSCALED_CAPTION)}, ${lit(UNSCALED_ANCHOR)});`,
      );
      // One column standing on the stack's own ground floor, whose height nobody has stated.
      const levels = await productModule<{ levelsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>(LEVELS_MODULE);
      const ground = (await levels.levelsOf(it.scope)).find((level) => String(level["label"]) === GROUND_FLOOR);
      expect(ground, "the staged stack holds its ground floor").toBeTruthy();
      const groundLevelId = String((ground as Record<string, unknown>)["levelId"]);
      const register = await registerSeam();
      // In the roster's own spelling: the register stage's shared sighting predates the closed class
      // roster, and a storey is owed a height for the verticals the roster names (L-MEA-09).
      const answer = await register.registerSighting(it.registerScope, {
        ...COLUMN_C1,
        elementType: "column",
        label: "refuse-c-gf",
        mark: "C77",
        x: 4000,
        level: { levelId: groundLevelId },
      } as typeof COLUMN_C1);
      expect(field(answer, "registered", "registered"), `the ground-floor column registered: ${JSON.stringify(answer)}`).toBe(true);

      const { kind } = await stub();
      const gate = await gateSeam();
      const unscaled = (input: RailInput) => ({
        offers: [] as OfferShape[],
        observations: input.objects.map((object) => ({
          class: "column",
          kind: input.kind,
          code: SCALE,
          objectKey: String(field(object, "objectKey", "object_key")),
          sourceEntity: UNSCALED_VIEW,
        })),
      });
      const job = await measureJobSeam();
      const steps: Step[] = [];
      await job.runMeasureJob(
        { tenantId: it.tenantId, projectId: it.projectId, campaignId: it.campaignId, requestedBy: it.person.userId },
        { step: async (name, detail) => void steps.push({ name, detail }) },
        { rails: { [kind]: unscaled }, gate: gate.evaluateOffers },
      );
      return { campaign: it, steps, groundLevelId, sheet };
    })());

  test("the verdict names the view with no scale of record, the class placed in it, and the storey with no height", async () => {
    const { steps, groundLevelId } = await refused();
    const verdict = (steps[steps.length - 1]?.detail ?? {}) as Record<string, unknown>;
    expect(verdict["published"], "nothing could be measured").toBe(0);
    expect(verdict["observed"], "and the run says how many reports it made rather than nothing").toBe(3);
    expect(verdict["deferred"], "BY NAME: the view, and the storey its vertical stands on").toEqual([
      { code: SCALE, view: UNSCALED_VIEW, caption: null, classes: ["column"], members: 3 },
      { code: HEIGHT_UNSTATED, levelId: groundLevelId, label: GROUND_FLOOR, classes: ["column"], members: 1 },
    ]);
  });

  test("the gate stored each report against the view it names, so every reader after the run can name it too", async () => {
    const { campaign } = await refused();
    const reports = rowsOfCampaign(RAIL_OBSERVATIONS_TABLE, campaign.tenantId, campaign.campaignId);
    expect(reports.map((row) => `${String(field(row, "code", "code"))}@${String(field(row, "sourceEntity", "source_entity"))}`)).toEqual([
      `${SCALE}@${UNSCALED_VIEW}`,
      `${SCALE}@${UNSCALED_VIEW}`,
      `${SCALE}@${UNSCALED_VIEW}`,
    ]);
  });

  test("the register's deferred-and-refused region names the view by its caption and the storey by its label, each with where it is fixed", async () => {
    const { campaign, groundLevelId, sheet } = await refused();
    const register = await productModule<{
      registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{ refusals: { code: string; objectKey: string; kind: string | null; deferral?: unknown }[] }>;
    }>("src/modules/takeoff/register-ui/server.ts");
    const view = await register.registerViewOf(campaign.scope);
    expect(sheet.layoutName, "the manifest names the drawing — a file, which is no sheet a deferral may be opened at").not.toBe("");
    expect(view.refusals.slice(0, 2), "a run's deferrals lead the region, each one row keyed on what it is about, naming what the QS fixes").toEqual([
      {
        code: SCALE,
        objectKey: UNSCALED_VIEW,
        kind: null,
        deferral: { subject: "VIEW", name: UNSCALED_CAPTION, sheet: null },
      },
      { code: HEIGHT_UNSTATED, objectKey: groundLevelId, kind: null, deferral: { subject: "STOREY", name: GROUND_FLOOR } },
    ]);
  });

  test("the register says a run was carried, and names as drawn-not-measured exactly what the certificate states (s-takeoff-register I-649/b)", async () => {
    const { campaign, sheet } = await refused();
    // A detail the drawing captions as a tank: a member no class of the catalogue is, which the
    // certificate names as drawn and never measured (s-coverage I-481) — and so must the register.
    sql(
      `insert into partition_views (tenant_id, project_id, drawing_id, ingest_id, view_key, type, caption, anchor_key) values (${lit(campaign.tenantId)}, ${lit(campaign.projectId)}, ${lit(sheet.drawingId)}, ${lit(randomUUID())}, 'v:DETAIL:DXF_HANDLE:TANK', 'DETAIL', 'OVERHEAD WATER TANK', 'DXF_HANDLE:TANK');`,
    );
    type Declared = { subject: string; class?: string; word?: string };
    const register = await productModule<{
      registerViewOf: (
        scope: { tenantId: string; projectId: string },
        options: { declared: boolean },
      ) => Promise<{ measured?: boolean; declared?: Declared[]; objects: { class: string }[]; lines: unknown[] }>;
    }>("src/modules/takeoff/register-ui/server.ts");
    const coverage = await productModule<{
      certificatePreviewOf: (scope: { tenantId: string; projectId: string }) => Promise<{ measurement: unknown[]; unclassed: unknown[] }>;
    }>("src/modules/takeoff/coverage/server.ts");
    const reading = await productModule<{ declaredOf: (input: { measurement: unknown[]; unclassed: unknown[]; registeredClasses: ReadonlySet<string> }) => Declared[] }>(
      "src/modules/takeoff/register-ui/declared.ts",
    );
    const view = await register.registerViewOf(campaign.scope, { declared: true });
    expect(view.measured, "the run reported, so the register reads a run as carried — never 'not measured yet'").toBe(true);
    expect(view.lines, "and it published nothing, which is the state the work surface then states").toEqual([]);
    const certificate = await coverage.certificatePreviewOf(campaign.scope);
    expect(
      (view.declared ?? []).filter((item) => item.subject === "MEMBER").map((item) => item.word),
      "the tank the drawing captions is named as drawn and not measured",
    ).toEqual(["tank"]);
    expect(view.declared, "the declared sightings are the certificate's own rows, read once (B-17)").toEqual(
      reading.declaredOf({ measurement: certificate.measurement, unclassed: certificate.unclassed, registeredClasses: new Set(view.objects.map((object) => object.class)) }),
    );
  });

  test("before any run the register reads no run carried and names nothing declared (I-649)", async () => {
    const it = await stageCampaign("register-unrun", { objects: 1 });
    const register = await productModule<{
      registerViewOf: (scope: { tenantId: string; projectId: string }, options: { declared: boolean }) => Promise<{ measured?: boolean; declared?: unknown[]; refusals: unknown[] }>;
    }>("src/modules/takeoff/register-ui/server.ts");
    const view = await register.registerViewOf(it.scope, { declared: true });
    expect(view.measured).toBe(false);
    expect(view.declared).toEqual([]);
    expect(view.refusals, "and nothing deferred, because nothing ran").toEqual([]);
  });

  test("a member whose concrete published still owes its reinforcement cell the report that says why (the residue asks per kind)", async () => {
    // One column on the ground floor: the stub publishes its concrete and reports that nobody read
    // its reinforcement schedule. Asked by object alone, the concrete line swallowed the report and
    // the rebar cell read as though nothing explained it (s-coverage I-480).
    const it = await stageCampaign("measure-kinds", { objects: 0 });
    const levels = await productModule<{ levelsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>(LEVELS_MODULE);
    const groundLevelId = String(((await levels.levelsOf(it.scope)).find((level) => String(level["label"]) === GROUND_FLOOR) ?? {})["levelId"]);
    const register = await registerSeam();
    const answer = await register.registerSighting(it.registerScope, { ...COLUMN_C1, elementType: "column", label: "kinds-c-gf", mark: "C78", x: 4100, level: { levelId: groundLevelId } } as typeof COLUMN_C1);
    const objectKey = String(field(answer, "objectKey", "object_key"));
    const contract = await offersContract();
    const { kind } = await stub();
    const gate = await gateSeam();
    const REBAR = "rcc.rebar";
    const UNREAD = "REBAR_SCHEDULE_UNREAD";
    const both = (input: RailInput) => ({
      offers:
        input.kind === kind
          ? [
              offer({
                objectKey,
                setRevisionId: input.setRevisionId,
                kind,
                class: "column",
                geometryType: String(contract.GEOMETRY_TYPES[0]),
                calibration: CALIBRATION,
                bindings: bindingsIn(READ_IN, READINGS, CALIBRATION),
              }),
            ]
          : [],
      observations: input.kind === REBAR ? [{ class: "column", kind: REBAR, code: UNREAD, objectKey, sourceEntity: objectKey }] : [],
    });
    const job = await measureJobSeam();
    await job.runMeasureJob(
      { tenantId: it.tenantId, projectId: it.projectId, campaignId: it.campaignId, requestedBy: it.person.userId },
      { step: async () => undefined },
      { rails: { [kind]: both, [REBAR]: both }, gate: gate.evaluateOffers },
    );
    const residue = await productModule<{
      residueOf: (scope: { tenantId: string; projectId: string }) => Promise<{ cells: { kind: string; class: string | null; levelId: string | null; measurement: string; reason?: string | null }[] }>;
    }>("src/core/residue/index.ts");
    const cells = (await residue.residueOf(it.scope)).cells.filter((cell) => cell.class === "column" && cell.levelId === groundLevelId);
    expect(cells.find((cell) => cell.kind === kind)?.measurement, "the concrete published").toBe("QUANTITY_BEARING");
    expect(cells.find((cell) => cell.kind === REBAR)?.reason, "and the reinforcement cell reads the report made about it").toBe(UNREAD);
  });

  test("a run that published its columns with the height left out, and reported nothing, still defers the storey by name", async () => {
    // Scaled, and no height: the column is offered and kept PARTIAL_DECLARED with its storey height
    // omitted under the levels law's code; no rail reports anything. The run was carried — its line
    // says so — and the register names the storey it could not measure a height for.
    const it = await stageCampaign("measure-heights", { objects: 0 });
    const levels = await productModule<{ levelsOf: (scope: { tenantId: string; projectId: string }) => Promise<Record<string, unknown>[]> }>(LEVELS_MODULE);
    const groundLevelId = String(((await levels.levelsOf(it.scope)).find((level) => String(level["label"]) === GROUND_FLOOR) ?? {})["levelId"]);
    const register = await registerSeam();
    const answer = await register.registerSighting(it.registerScope, { ...COLUMN_C1, elementType: "column", label: "heights-c-gf", mark: "C79", x: 4200, level: { levelId: groundLevelId } } as typeof COLUMN_C1);
    const objectKey = String(field(answer, "objectKey", "object_key"));
    const contract = await offersContract();
    const { kind } = await stub();
    const gate = await gateSeam();
    const readings = Object.fromEntries(Object.entries(READINGS).filter(([name]) => name !== "L"));
    const partial = (input: RailInput) => ({
      offers: [
        offer({
          objectKey,
          setRevisionId: input.setRevisionId,
          kind,
          class: "column",
          geometryType: String(contract.GEOMETRY_TYPES[0]),
          calibration: CALIBRATION,
          bindings: bindingsIn(READ_IN, readings, CALIBRATION),
          omitted: [{ variable: "L", code: HEIGHT_UNSTATED }],
          coverage: "PARTIAL_DECLARED",
        }),
      ],
      observations: [] as never[],
    });
    const job = await measureJobSeam();
    const steps: Step[] = [];
    await job.runMeasureJob(
      { tenantId: it.tenantId, projectId: it.projectId, campaignId: it.campaignId, requestedBy: it.person.userId },
      { step: async (name, detail) => void steps.push({ name, detail }) },
      { rails: { [kind]: partial }, gate: gate.evaluateOffers },
    );
    expect(verdictOf(steps), "the partial line published").toEqual({ published: 1, queued: 0, refused: 0 });
    const reader = await productModule<{
      registerViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{ refusals: { code: string; objectKey: string; kind: string | null; deferral?: unknown }[] }>;
    }>("src/modules/takeoff/register-ui/server.ts");
    expect((await reader.registerViewOf(it.scope)).refusals, "the storey is named though no rail reported a word").toEqual([
      { code: HEIGHT_UNSTATED, objectKey: groundLevelId, kind: null, deferral: { subject: "STOREY", name: GROUND_FLOOR } },
    ]);

    // And the draft's closing page says why each unmeasured kind of the column was left out, in the
    // certificate's words — the reason beside the fall-through, never the fall-through's own sentence.
    const boq = await productModule<{
      boqViewOf: (scope: { tenantId: string; projectId: string }) => Promise<{ payload: { notMeasured?: { class: string | null; kind: string; cause: string }[] } | null }>;
    }>("src/modules/takeoff/boq/server.ts");
    const left = (await boq.boqViewOf(it.scope)).payload?.notMeasured ?? [];
    const formwork = left.find((row) => row.class === "column" && row.kind === "rcc.formwork");
    expect(formwork?.cause, "column formwork: the run reads it for no class yet").toBe("COVERAGE_KIND_NOT_READ");
    expect(left.map((row) => row.cause), "no row of the draft stands on the fall-through's own sentence").not.toContain("NOT_ESTABLISHED");
  });

  test("the coverage cell the ground floor's column stands in reads the scale as its reason", async () => {
    const { campaign, groundLevelId } = await refused();
    const residue = await productModule<{
      residueOf: (scope: { tenantId: string; projectId: string }) => Promise<{ cells: { kind: string; class: string | null; levelId: string | null; measurement: string; reason?: string | null }[] }>;
    }>("src/core/residue/index.ts");
    const { kind } = await stub();
    const cells = (await residue.residueOf(campaign.scope)).cells.filter((cell) => cell.kind === kind && cell.class === "column");
    const ground = cells.find((cell) => cell.levelId === groundLevelId);
    expect(ground?.measurement, "nothing was published for the ground floor's column").toBe("NOT_ESTABLISHED");
    expect(ground?.reason, "and the cell says why: no scale of record on the view it was placed in").toBe(SCALE);
  });
});
