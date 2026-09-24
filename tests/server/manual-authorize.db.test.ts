/**
 * The manual measurement doors, judged at the doors themselves — live, against a scratch database the
 * committed migrations built (V-DB, AM-11 §2, docs/design/s-measure.md §2.11).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * `authorize()` before it reads or writes, and carries a live-database test that a caller without the
 * permission is refused BY NAME. `takeoffManual.preview` and `takeoffManual.commit` are those entry
 * points for the hand measurement act, so this is that test:
 *   · a participant who holds no MEASURE is refused `PERMISSION_NOT_HELD` at both doors, and no act row
 *     is written;
 *   · a statement the doors cannot read is `REQUEST_MALFORMED`, never a fault;
 *   · a MEASURER through the doors reaches the act, which answers a project with no campaign open with
 *     `MANUAL_NO_CAMPAIGN` — the door is the act's, not a guard of its own.
 * Each code is the register's own, read off the register rather than spelled here (B-17).
 *
 * The people, workspaces and projects are real: accounts are enrolled through the shipped sign-up
 * door, and the door is called through the router's own caller with a context the shipped
 * `createContext` mints off a request carrying the person's real session cookie.
 */
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_COLUMN } from "../../db/__tests__/support/fixtures";
import { ident, lit } from "../../db/__tests__/support/live-sql";
import { closeStage, enrol, openStage, productModule, sql, sqlValue, stageProject, type Person } from "../spine/uploads/support/upload-stage";
import { MANUAL_BOUNDS } from "../../src/core/manual/law";
import { stageDrawing, unique } from "../takeoff/support/ingest-stage";

const ROUTER_MODULE = "src/server/routers/takeoff-manual.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";

const BUDGET_MS = 300_000;

/** The two project roles the cases stand on: one that holds MEASURE (L-ACT-03) and one that does not. */
const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";

type Door = {
  preview(input: unknown): Promise<unknown>;
  commit(input: unknown): Promise<unknown>;
};

afterAll(async () => {
  await closeStage();
});

/** A project of the person's own workspace, this role on it for them, and a drawing of it to measure on. */
async function projectFor(person: Person, name: string, role: string): Promise<{ projectId: string; drawingId: string }> {
  const projectId = stageProject(person.tenantId, name);
  sql(
    `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}) on conflict do nothing;
     insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}, ${lit(role)}) on conflict do nothing;`,
  );
  const bytes = new TextEncoder().encode(`0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n; ${name}\n`);
  const drawing = await stageDrawing(person as never, projectId, bytes, { name: unique("S-08.dxf"), format: "dxf" });
  return { projectId, drawingId: drawing.drawingId };
}

/** The shipped doors, as this person's live session reaches them. */
async function doorFor(person: Person): Promise<Door> {
  const { createContext } = await productModule<{ createContext(opts: { req: Request }): Promise<unknown> }>(CONTEXT_MODULE);
  const { takeoffManualRouter } = await productModule<{ takeoffManualRouter: { createCaller(ctx: unknown): Door; _def?: { procedures?: Record<string, unknown> } } }>(ROUTER_MODULE);
  expect(Object.keys(takeoffManualRouter._def?.procedures ?? {}).sort(), "takeoffManual.preview and takeoffManual.commit are on the wire (s-measure §2.11)").toEqual(["commit", "preview"]);
  const request = new Request("http://127.0.0.1/api/trpc/takeoffManual.preview", { method: "POST", headers: { cookie: person.cookie } });
  return takeoffManualRouter.createCaller(await createContext({ req: request }));
}

/** A lawful statement of one hand measurement on the drawing — whether the act can stand it is the act's to say. */
function measurement(projectId: string, drawingId: string): Record<string, unknown> {
  return {
    projectId,
    drawingId,
    layoutName: "Model",
    viewKey: "LAYOUT_PLAN:DXF_HANDLE:A0",
    recipe: {
      conditionId: null,
      conditionName: "75 CC blinding under SOG",
      geometry: "POLYGON",
      elementClass: "slab",
      kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding.area" }],
      readings: [{ attribute: "t", valueAsWritten: "75", unitAsWritten: "mm", basis: "ENTERED", sourceKey: null }],
    },
    level: null,
    geometry: {
      geometry: "POLYGON",
      outer: [
        { x: 0, y: 0, cites: [] },
        { x: 10, y: 0, cites: [] },
        { x: 10, y: 10, cites: [] },
      ],
      cutouts: [],
    },
    replaces: null,
  };
}

/** What the door threw — and, where it answered instead, a failure that says so. */
async function refusalFrom(work: () => Promise<unknown>, what: string): Promise<string | null> {
  const { refusalCodeOf } = await productModule<{ refusalCodeOf(error: unknown): string | null }>(REFUSAL_MARKER_MODULE);
  let answered: unknown;
  let thrown: unknown;
  let refused = false;
  try {
    answered = await work();
  } catch (caught) {
    thrown = caught;
    refused = true;
  }
  if (!refused) expect.fail(`${what} must be refused, and the door answered with ${JSON.stringify(answered)}`);
  return refusalCodeOf(thrown);
}

async function codes(): Promise<Record<string, { code: string } | undefined>> {
  return (await productModule<{ REFUSALS: Record<string, { code: string } | undefined> }>(ERRORS_MODULE)).REFUSALS;
}

/** How many hand measurement acts this workspace has recorded. */
function actsRecorded(tenantId: string): number {
  return Number(sqlValue(`select count(*)::text from acts where ${ident(TENANT_COLUMN)} = ${lit(tenantId)}::uuid and act_type = 'RECORD_MANUAL_MEASUREMENT';`));
}

describe("the manual measurement doors, at the guard", () => {
  it("refuses a participant who does not hold MEASURE at both doors, by name, before anything is read or written", async () => {
    await openStage();
    const reviewer = await enrol("manual-door-reviewer");
    const { projectId, drawingId } = await projectFor(reviewer, "Manual — reviewer", REVIEWER);
    const permission = (await codes())["PERMISSION_NOT_HELD"]?.code;
    expect(permission, "the register publishes PERMISSION_NOT_HELD — the guard's own refusal").toBeDefined();

    const door = await doorFor(reviewer);
    const statement = measurement(projectId, drawingId);
    expect(await refusalFrom(() => door.preview({ input: statement }), `a ${REVIEWER} previewing a hand measurement`), `${REVIEWER} holds no MEASURE (L-ACT-03)`).toBe(permission);
    expect(await refusalFrom(() => door.commit({ input: statement, consequenceDigest: "0".repeat(64) }), `a ${REVIEWER} recording one`), "the commit door asks the same guard").toBe(permission);
    expect(actsRecorded(reviewer.tenantId), "a refused door writes no act").toBe(0);
  }, BUDGET_MS);

  it("answers a statement it cannot read with REQUEST_MALFORMED — a kind the class does not bear, a geometry that is not the recipe's, more points than the law bounds a statement to", async () => {
    await openStage();
    const measurer = await enrol("manual-door-malformed");
    const { projectId, drawingId } = await projectFor(measurer, "Manual — malformed", MEASURER);
    const malformed = (await codes())["REQUEST_MALFORMED"]?.code;
    const door = await doorFor(measurer);
    const statement = measurement(projectId, drawingId);
    const unborne = { ...statement, recipe: { ...(statement["recipe"] as Record<string, unknown>), kinds: [{ kind: "piling.bored", ruleId: "piling.bored.count" }] } };
    expect(await refusalFrom(() => door.preview({ input: unborne }), "a slab measured for bored piles"), "a slab bears no bored pile (L-MEA-04)").toBe(malformed);
    const run = { ...statement, geometry: { geometry: "POLYLINE", run: [{ x: 0, y: 0, cites: [] }, { x: 5, y: 0, cites: [] }] } };
    expect(await refusalFrom(() => door.preview({ input: run }), "a run under an area recipe"), "the trace is the recipe's own geometry (I-374)").toBe(malformed);
    expect(await refusalFrom(() => door.preview({ input: { ...statement, geometry: "a square" } }), "a geometry that is no geometry")).toBe(malformed);
    // The exact guards' work grows with the product of the rings' sizes, so the points are bounded over every ring together.
    const points = (count: number, y: number): { x: number; y: number; cites: string[] }[] => Array.from({ length: count }, (_, index) => ({ x: index, y: y + (index % 2), cites: [] }));
    const oneRing = { ...statement, geometry: { geometry: "POLYGON", outer: points(MANUAL_BOUNDS.points + 1, 0), cutouts: [] } };
    expect(await refusalFrom(() => door.preview({ input: oneRing }), "an outline of one point more than the bound"), "a statement past the bound").toBe(malformed);
    const spread = { ...statement, geometry: { geometry: "POLYGON", outer: points(MANUAL_BOUNDS.points - 100, 0), cutouts: [{ role: "OPENING", ring: points(101, 5) }] } };
    expect(await refusalFrom(() => door.preview({ input: spread }), "the bound spread over an outline and a cut-out"), "the bound is over every ring together").toBe(malformed);
  }, BUDGET_MS);

  it("hands a MEASURER's statement to the act, which answers a project with no campaign open by name", async () => {
    await openStage();
    const measurer = await enrol("manual-door-measurer");
    const { projectId, drawingId } = await projectFor(measurer, "Manual — no campaign", MEASURER);
    const noCampaign = (await codes())["MANUAL_NO_CAMPAIGN"]?.code;
    expect(noCampaign, "the register publishes MANUAL_NO_CAMPAIGN (Q-07)").toBeDefined();
    const door = await doorFor(measurer);
    expect(await refusalFrom(() => door.preview({ input: measurement(projectId, drawingId) }), "a hand measurement on a project with no campaign"), "a measurement has no revision to stand in").toBe(noCampaign);
    expect(actsRecorded(measurer.tenantId)).toBe(0);
  }, BUDGET_MS);

  it("takes a rule id at the door and leaves the pairing to the act, which refuses one MANUAL_RULES does not hold by name at both doors (I-539)", async () => {
    await openStage();
    const measurer = await enrol("manual-door-unpaired");
    const { projectId, drawingId } = await projectFor(measurer, "Manual — unpaired", MEASURER);
    const unpaired = (await codes())["MANUAL_PAIRING_NOT_OFFERED"]?.code;
    expect(unpaired, "the register publishes MANUAL_PAIRING_NOT_OFFERED (Q-07)").toBeDefined();
    const door = await doorFor(measurer);
    const statement = measurement(projectId, drawingId);
    const recipe = statement["recipe"] as Record<string, unknown>;
    const cases: readonly [string, Record<string, unknown>][] = [
      ["a pile cap's blinding", { ...recipe, elementClass: "pile_cap" }],
      ["a footing's blinding", { ...recipe, elementClass: "footing" }],
      ["a slab's formwork", { ...recipe, kinds: [{ kind: "rcc.formwork", ruleId: "rcc.formwork.slab" }], readings: [] }],
      ["the slab's blinding under the machine's rectangle rule", { ...recipe, kinds: [{ kind: "pcc.blinding", ruleId: "pcc.blinding_rect" }] }],
    ];
    for (const [what, stated] of cases) {
      const input = { ...statement, recipe: stated };
      expect(await refusalFrom(() => door.preview({ input }), `${what} previewed`), `${what} is no pairing a hand measurement is offered under`).toBe(unpaired);
      expect(await refusalFrom(() => door.commit({ input, consequenceDigest: "0".repeat(64) }), `${what} recorded`), "and the commit door answers the same").toBe(unpaired);
    }
    expect(actsRecorded(measurer.tenantId), "a refused pairing writes no act").toBe(0);
  }, BUDGET_MS);

  it("the card's read (S6, I-617): refused by name without MEASURE; a MEASURER is answered the stack, and the drawing is bound to the project", async () => {
    await openStage();
    type CardRead = (userId: string, asked: Record<string, unknown>) => Promise<{ space: string; windows: unknown[]; levels: unknown[]; levelId: string | null; notes: unknown[] }>;
    const { readHandMeasurementCard } = await productModule<{ readHandMeasurementCard: CardRead }>(ROUTER_MODULE);
    const asked = (projectId: string, drawingId: string): Record<string, unknown> => ({ projectId, drawingId, sheetName: "S-08", viewKey: "LAYOUT_PLAN:DXF_HANDLE:2073", kinds: ["pcc.blinding"], attributes: ["t"] });
    const permission = (await codes())["PERMISSION_NOT_HELD"]?.code;

    const reviewer = await enrol("manual-card-reviewer");
    const refused = await projectFor(reviewer, "Manual card — reviewer", REVIEWER);
    expect(await refusalFrom(() => readHandMeasurementCard(reviewer.userId, asked(refused.projectId, refused.drawingId)), `a ${REVIEWER} reading the card`), "the read asks MEASURE (L-ACT-03)").toBe(permission);

    const measurer = await enrol("manual-card-measurer");
    const own = await projectFor(measurer, "Manual card — measurer", MEASURER);
    const answered = await readHandMeasurementCard(measurer.userId, asked(own.projectId, own.drawingId));
    expect(answered, "a project with no stack and a drawing nobody has read offers nothing, and states the sheet itself").toEqual({ space: "S-08", windows: [], levels: [], levelId: null, notes: [] });

    // Another project's drawing, named from this one: the guard binds the drawing to the project (R-SPINE-004).
    const elsewhere = await projectFor(measurer, "Manual card — another project", MEASURER);
    expect(await refusalFrom(() => readHandMeasurementCard(measurer.userId, asked(own.projectId, elsewhere.drawingId)), "a drawing of another project"), "never answered across projects").not.toBeNull();
  }, BUDGET_MS);
});
