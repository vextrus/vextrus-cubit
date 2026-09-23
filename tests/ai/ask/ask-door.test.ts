/**
 * S-Ask's door, judged at the door itself — live, against a scratch database the committed migrations
 * built (V-DB, docs/design/s-ask.md I-406, §6).
 *
 * Every entry point resolves actor, tenant, project and participation through the one `authorize()`
 * and carries a live-database test that a caller without the right is refused BY NAME. `ai.ask` asks
 * participation (the register's readers' own question): a member of the workspace who is not on the
 * project is refused `PERMISSION_NOT_HELD`. The statement is read by one zod schema, so a blank
 * question and one of 301 characters are `REQUEST_MALFORMED` — an answer, never a 500. And a question
 * the grammar reads is answered with no model call: the ledger holds no row for it.
 *
 * The people, the workspaces and the projects are real: accounts are enrolled through the shipped
 * sign-up door, and the context is minted by the shipped `createContext` off a request carrying the
 * person's real session cookie. Raw SQL is spoken through psql, never a driver import (SEAM-TENANT),
 * and product modules are loaded by absolute path after DATABASE_URL names the scratch world.
 */
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, enrol, openStage, productModule, sql, sqlValue, stageProject, type Person } from "../../spine/uploads/support/upload-stage";

/** The homes this suite reads: the door, the context the door is handed, and the register. */
const AI_ROUTER_MODULE = "src/server/routers/ai.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";

/** A project role that holds no MEASURE: asking needs a place on the project, and nothing more (I-406). */
const REVIEWER = "REVIEWER";

/** Loose shapes for surfaces loaded by path — this file typechecks against the tree, not through it. */
interface AskAnswerShape {
  outcome: string;
  code?: string;
  routedBy?: string;
}
interface AiDoor {
  ask(input: Record<string, unknown>): Promise<AskAnswerShape>;
}
interface AiRouterModule {
  aiRouter: { createCaller(ctx: unknown): AiDoor; _def?: { procedures?: Record<string, unknown> } };
}
interface ContextModule {
  createContext(opts: { req: Request }): Promise<unknown>;
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

/** Put a person on a project with a role (L-ACT-03's participation). */
function participate(person: Person, projectId: string, role: string): void {
  sql(
    `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}) on conflict do nothing;
     insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role)
       values (${lit(person.tenantId)}, ${lit(projectId)}, ${lit(person.userId)}, ${lit(role)}) on conflict do nothing;`,
  );
}

/** The shipped door, as this person's live session reaches it. */
async function doorFor(person: Person): Promise<AiDoor> {
  const { createContext } = await productModule<ContextModule>(CONTEXT_MODULE);
  const { aiRouter } = await productModule<AiRouterModule>(AI_ROUTER_MODULE);
  expect(Object.keys(aiRouter._def?.procedures ?? {}), "ai.ask is on the wire — S-Ask's door (§6)").toContain("ask");
  const request = new Request("http://127.0.0.1/api/trpc/ai.ask", { method: "POST", headers: { cookie: person.cookie } });
  return aiRouter.createCaller(await createContext({ req: request }));
}

/** What the door threw — failing, with what it answered instead, where it answered. */
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

/** The registered code a failure carries. */
async function codeOf(thrown: unknown): Promise<string | null> {
  const { refusalCodeOf } = await productModule<MarkerModule>(REFUSAL_MARKER_MODULE);
  return refusalCodeOf(thrown);
}

/** The register's own spelling of a code (B-17). */
async function registered(code: string): Promise<string> {
  const { REFUSALS } = await productModule<ErrorsModule>(ERRORS_MODULE);
  const spelled = REFUSALS[code]?.code ?? "";
  expect(spelled, `the register publishes ${code}`).toBe(code);
  return spelled;
}

/** How many model calls the ledger holds for one workspace — read as the system reads it. */
function modelCallsOf(tenantId: string): number {
  return Number(sqlValue(`select count(*)::text from model_calls where ${ident(TENANT_COLUMN)} = ${lit(tenantId)};`));
}

describe("ai.ask, at the guard and the schema", () => {
  it("refuses a workspace member who is not on the project, by name, before reading anything", async () => {
    await openStage();
    const stranger = await enrol("ask-door-stranger");
    const projectId = stageProject(stranger.tenantId, "Ask — not a participant");
    const permission = await registered("PERMISSION_NOT_HELD");

    const door = await doorFor(stranger);
    const thrown = await refusalFrom(() => door.ask({ projectId, question: "How many C3 columns are on the 5th floor?" }), "a non-participant asking the drawings");
    expect(await codeOf(thrown), "asking needs a place on the project (I-406): the one guard refuses by name").toBe(permission);
  }, 300_000);

  it("refuses a blank question and one of 301 characters as REQUEST_MALFORMED — an answer, never a 500", async () => {
    await openStage();
    const reviewer = await enrol("ask-door-malformed");
    const projectId = stageProject(reviewer.tenantId, "Ask — malformed");
    participate(reviewer, projectId, REVIEWER);
    const malformed = await registered("REQUEST_MALFORMED");

    const door = await doorFor(reviewer);
    for (const [question, what] of [
      ["   ", "a blank question"],
      ["x".repeat(301), "a question of 301 characters"],
    ] as const) {
      const thrown = await refusalFrom(() => door.ask({ projectId, question }), what);
      expect(await codeOf(thrown), `${what} is refused by the one schema`).toBe(malformed);
    }
    const thrown = await refusalFrom(() => door.ask({ projectId, question: "How many?", reading: { intent: "COST" } }), "a reading outside the roster");
    expect(await codeOf(thrown), "a reading outside the rosters never reaches the engine").toBe(malformed);
  }, 300_000);

  it("answers a participant who holds no MEASURE, from the grammar, writing no model-call row", async () => {
    await openStage();
    const reviewer = await enrol("ask-door-reviewer");
    const projectId = stageProject(reviewer.tenantId, "Ask — a reviewer asks");
    participate(reviewer, projectId, REVIEWER);
    const notMeasured = await registered("ASK_NOT_MEASURED");
    const estimate = await registered("ASK_ESTIMATE_NOT_BUILT");
    const before = modelCallsOf(reviewer.tenantId);

    const door = await doorFor(reviewer);
    const counted = await door.ask({ projectId, question: "How many piles are there?" });
    expect(counted, "a project with no campaign open has nothing measured, and the answer says so by name").toMatchObject({ outcome: "REFUSED", code: notMeasured });
    const priced = await door.ask({ projectId, question: "What will the column concrete cost?" });
    expect(priced, "a cost is never answered as a quantity").toMatchObject({ outcome: "REFUSED", code: estimate });

    expect(modelCallsOf(reviewer.tenantId), "a grammar-routed ask calls no model and writes no ledger row (I-406)").toBe(before);
  }, 300_000);
});
