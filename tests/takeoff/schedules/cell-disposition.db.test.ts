/**
 * What a person made of a proposed schedule-cell reading, judged at the door itself — live, against
 * a scratch database the committed migrations built (R-TO-031, L-AI-02, R-AI-005, AM-11 §2).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * `authorize()` before it reads or writes, and carries a live-database test that a caller without
 * the permission is refused BY NAME. `takeoffSchedules.judgeCellReading` is that entry point for
 * this reading, so this is that test: a participant who holds no MEASURE is refused
 * `PERMISSION_NOT_HELD`, read off the register rather than spelled here (B-17), and nothing is
 * written on the way out.
 *
 * Beside it, the record itself: judging a reading writes the ledger's own outcome of the call it
 * answers — accepted CONFIRMED, edited OVERRULED, rejected REPUDIATED — naming NO act, because a
 * disposition is a record and not an act (L-ACT-01): the stored table still renders as stored and
 * the member-type registry is still read from the drawing. A judgment of a call this project never
 * made, and of a call that was refused and proposed nothing, are caller defects: faults, not
 * refusals (ARCH-03).
 *
 * The people, the workspaces and the projects are real: accounts are enrolled through the shipped
 * sign-up door. The database and those doors come from the upload seam's own stage — borrowed, never
 * copied (ARCH-02). Raw SQL is spoken through psql, never a driver import (SEAM-TENANT), and product
 * modules are loaded by absolute path after DATABASE_URL names the scratch world.
 *
 * The calls a judgment answers are written through the SHIPPED ledger (`dbModelLedger`), so a call
 * id here is an id `model_calls` itself generated (L-AI-01).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, enrol, openStage, productModule, sql, stageProject, type Person } from "../../spine/uploads/support/upload-stage";

/** The homes this suite reads: the door, the context it is handed, the writer, the seam and the store. */
const SCHEDULES_ROUTER_MODULE = "src/server/routers/takeoff-schedules.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const DISPOSITIONS_MODULE = "src/modules/takeoff/partition/schedules/cell-reading/dispositions.ts";
const MODEL_BARREL = "src/core/model/index.ts";
const DB_BARREL = "src/core/db.ts";
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";

/** The two project roles the cases stand on: one that holds MEASURE (L-ACT-03) and one that does not. */
const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";

/** The question this reading is filed under, and the id AS-05 bills it to. */
const QUESTION = "schedule-cell";
const OPUS = "claude-opus-5";

/** Loose shapes for surfaces loaded by path — this file typechecks against the tree, not through it. */
interface SchedulesDoor {
  judgeCellReading(input: { projectId: string; callId: string; disposition: string }): Promise<{ outcomeId: string; outcome: string }>;
}
interface SchedulesRouterModule {
  takeoffSchedulesRouter: { createCaller(ctx: unknown): SchedulesDoor; _def?: { procedures?: Record<string, unknown> } };
}
interface ContextModule {
  createContext(opts: { req: Request }): Promise<unknown>;
}
interface DispositionsModule {
  recordCellReadingDisposition(
    actor: { tenantId: string; projectId: string; actor: string },
    judgment: { callId: string; disposition: string },
  ): Promise<{ outcomeId: string; outcome: string }>;
}
interface LedgerRow {
  tenantId: string;
  projectId: string;
  modelId: string;
  requestHash: string;
  transport: string;
  outcome: string;
  refusalCode: string | null;
  inputTokens: number;
  outputTokens: number;
  attributedCost: string;
  question: string | null;
  judgment: unknown;
}
interface ModelBarrel {
  dbModelLedger(db: unknown): { record(row: LedgerRow): Promise<{ callId: string }> };
}
interface DbBarrel {
  forTenant(ctx: { tenantId: string }): unknown;
  modelOutcomeRowsOf(
    db: unknown,
    scope: { tenantId: string; projectId: string },
    callIds?: readonly string[],
  ): Promise<{ outcomeId: string; callId: string; question: string | null; outcome: string; actId: string | null; actorUserId: string }[]>;
}
interface MarkerModule {
  refusalCodeOf(error: unknown): string | null;
}
interface ErrorsModule {
  REFUSALS: Readonly<Record<string, { code: string }>>;
}

afterAll(async () => {
  await closeStage();
});

/** A project of the person's own workspace, with this role on it for them. */
function projectFor(person: Person, name: string, role: string): string {
  const projectId = stageProject(person.tenantId, name);
  sql(
    `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}) on conflict do nothing;
     insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}, ${lit(role)}) on conflict do nothing;`,
  );
  return projectId;
}

/** The shipped door, as this person's live session reaches it. */
async function doorFor(person: Person): Promise<SchedulesDoor> {
  const { createContext } = await productModule<ContextModule>(CONTEXT_MODULE);
  const { takeoffSchedulesRouter } = await productModule<SchedulesRouterModule>(SCHEDULES_ROUTER_MODULE);
  expect(Object.keys(takeoffSchedulesRouter._def?.procedures ?? {}), "takeoffSchedules.judgeCellReading is on the wire").toContain("judgeCellReading");
  const request = new Request("http://127.0.0.1/api/trpc/takeoffSchedules.judgeCellReading", { method: "POST", headers: { cookie: person.cookie } });
  return takeoffSchedulesRouter.createCaller(await createContext({ req: request }));
}

/** One call in this project's ledger, written by the shipped ledger — proposed, or refused by name. */
async function callIn(person: Person, projectId: string, outcome: "proposed" | "refused"): Promise<string> {
  const { dbModelLedger } = await productModule<ModelBarrel>(MODEL_BARREL);
  const { forTenant } = await productModule<DbBarrel>(DB_BARREL);
  const ledger = dbModelLedger(forTenant({ tenantId: person.tenantId }));
  const { callId } = await ledger.record({
    tenantId: person.tenantId,
    projectId,
    modelId: OPUS,
    requestHash: randomUUID().replace(/-/g, ""),
    transport: "fixture",
    outcome,
    refusalCode: outcome === "refused" ? "FIXTURE_MISSING" : null,
    inputTokens: 420,
    outputTokens: 0,
    attributedCost: "0.00630000",
    question: QUESTION,
    judgment: null,
  });
  return callId;
}

/** The outcomes one project holds for a call, newest first, read through the store's own reader. */
async function outcomesOf(person: Person, projectId: string, callId: string) {
  const { forTenant, modelOutcomeRowsOf } = await productModule<DbBarrel>(DB_BARREL);
  return modelOutcomeRowsOf(forTenant({ tenantId: person.tenantId }), { tenantId: person.tenantId, projectId }, [callId]);
}

/** What the door threw — and, where it ANSWERED instead, a failure that says so in those words. */
async function refusalFrom(work: () => Promise<unknown>, what: string): Promise<unknown> {
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
  return thrown;
}

describe("the schedule-cell judgment door, at the guard", () => {
  it("refuses a participant who does not hold MEASURE, by name, and records no outcome", async () => {
    await openStage();
    const reviewer = await enrol("cell-reading-reviewer");
    const projectId = projectFor(reviewer, "Cell reading — reviewer", REVIEWER);
    const callId = await callIn(reviewer, projectId, "proposed");
    const { REFUSALS } = await productModule<ErrorsModule>(ERRORS_MODULE);
    const permission = REFUSALS["PERMISSION_NOT_HELD"]?.code ?? "";
    expect(permission, "the register publishes PERMISSION_NOT_HELD — the guard's own refusal").not.toBe("");

    const door = await doorFor(reviewer);
    const thrown = await refusalFrom(() => door.judgeCellReading({ projectId, callId, disposition: "accepted" }), `a ${REVIEWER} judging a proposed reading`);

    const { refusalCodeOf } = await productModule<MarkerModule>(REFUSAL_MARKER_MODULE);
    expect(refusalCodeOf(thrown), `${REVIEWER} holds no MEASURE, so the one guard refuses this door before it writes anything (L-ACT-03)`).toBe(permission);
    expect(await outcomesOf(reviewer, projectId, callId), "a refused door writes nothing: the guard answers before the record is made").toEqual([]);
  }, 300_000);

  it("refuses a statement it cannot read as REQUEST_MALFORMED, never as an outage of ours", async () => {
    await openStage();
    const measurer = await enrol("cell-reading-malformed");
    const projectId = projectFor(measurer, "Cell reading — malformed", MEASURER);
    const { REFUSALS } = await productModule<ErrorsModule>(ERRORS_MODULE);
    const malformed = REFUSALS["REQUEST_MALFORMED"]?.code ?? "";

    const door = await doorFor(measurer);
    const thrown = await refusalFrom(
      () => door.judgeCellReading({ projectId, callId: randomUUID(), disposition: "pondered" } as { projectId: string; callId: string; disposition: string }),
      "a disposition outside the closed roster",
    );

    const { refusalCodeOf } = await productModule<MarkerModule>(REFUSAL_MARKER_MODULE);
    expect(refusalCodeOf(thrown), "one zod schema reads the statement, and a statement it cannot read is a refusal (L-AI-01's copy, ARCH-03)").toBe(malformed);
  }, 300_000);
});

describe("what a judgment records", () => {
  it("writes the ledger's own outcome of the call it answers — accepted CONFIRMED, edited OVERRULED, rejected REPUDIATED — naming no act", async () => {
    await openStage();
    const measurer = await enrol("cell-reading-measurer");
    const projectId = projectFor(measurer, "Cell reading — judged", MEASURER);
    const door = await doorFor(measurer);

    for (const [disposition, outcome] of [
      ["accepted", "CONFIRMED"],
      ["edited", "OVERRULED"],
      ["rejected", "REPUDIATED"],
    ] as const) {
      const callId = await callIn(measurer, projectId, "proposed");
      const answer = await door.judgeCellReading({ projectId, callId, disposition });
      expect(answer.outcome, `${disposition} is the ledger's ${outcome}`).toBe(outcome);

      const rows = await outcomesOf(measurer, projectId, callId);
      expect(rows.length, `the ${disposition} judgment is one outcome of the call it answers`).toBe(1);
      expect(rows[0]?.outcome).toBe(outcome);
      expect(rows[0]?.actId, "a disposition is a record and not an act, so its outcome names none (L-ACT-01)").toBeNull();
      expect(rows[0]?.actorUserId, "and records who judged it (R-AI-005)").toBe(measurer.userId);
      expect(rows[0]?.question, "the outcome files under the question the call put").toBe(QUESTION);
    }
  }, 300_000);

  it("takes a judgment of a call this project never made, and of a call that was refused, as caller defects", async () => {
    await openStage();
    const measurer = await enrol("cell-reading-defects");
    const projectId = projectFor(measurer, "Cell reading — defects", MEASURER);
    const other = projectFor(measurer, "Cell reading — another project", MEASURER);
    const { recordCellReadingDisposition } = await productModule<DispositionsModule>(DISPOSITIONS_MODULE);
    const actor = { tenantId: measurer.tenantId, projectId, actor: measurer.userId };

    const elsewhere = await callIn(measurer, other, "proposed");
    const strayed = await refusalFrom(() => recordCellReadingDisposition(actor, { callId: elsewhere, disposition: "accepted" }), "a judgment of another project's call");
    expect(String((strayed as Error).message), "a judgment answers a proposal that was made (L-AI-01)").toContain("holds no call");

    const refused = await callIn(measurer, projectId, "refused");
    const empty = await refusalFrom(() => recordCellReadingDisposition(actor, { callId: refused, disposition: "accepted" }), "a judgment of a refused call");
    expect(String((empty as Error).message), "a refused call proposed nothing, so there is nothing to judge (L-AI-02)").toContain("proposed nothing");

    const unknown = await refusalFrom(() => recordCellReadingDisposition(actor, { callId: "not-a-uuid", disposition: "accepted" }), "a judgment keyed by no call id at all");
    expect(String((unknown as Error).message)).toContain("is no model call id");

    expect(await outcomesOf(measurer, projectId, refused), "a defect writes nothing").toEqual([]);
  }, 300_000);
});
