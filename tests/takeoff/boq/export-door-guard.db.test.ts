/**
 * The draft-BOQ door, judged at the door itself — live, against a scratch database the committed
 * migrations built (V-DB).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * `authorize()` before it reads or writes, and carries a live-database test that a caller without
 * the permission is refused BY NAME. `takeoffBoq.exportDraft` is that entry point for this lane, so
 * this is that test: a participant who holds no MEASURE is refused `PERMISSION_NOT_HELD`, and a
 * MEASURER whose project has no campaign open is refused `BOQ_NO_CAMPAIGN` — the code the register
 * publishes, read off the register rather than spelled here (B-17).
 *
 * The people, the workspaces and the projects are real: two accounts are enrolled through the
 * shipped sign-up door, so a workspace is theirs because R-SPINE-002 made it theirs. The database,
 * the storage root and those doors come from the upload seam's own stage — borrowed, never copied
 * (ARCH-02). Raw SQL is spoken through psql, never a driver import (SEAM-TENANT), and product
 * modules are loaded by absolute path after DATABASE_URL names the scratch world.
 *
 * The door is called through the router's own caller rather than over HTTP: what is under judgement
 * is the guard the procedure runs before it enqueues anything, and the context is minted by the
 * shipped `createContext` off a request carrying the person's real session cookie.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_COLUMN } from "../../../db/__tests__/support/fixtures";
import { ident, lit } from "../../../db/__tests__/support/live-sql";
import { closeStage, enrol, openStage, productModule, sql, stageProject, type Person } from "../../spine/uploads/support/upload-stage";

/** The homes this suite reads: the door, the context the door is handed, and the register. */
const BOQ_ROUTER_MODULE = "src/server/routers/takeoff-boq.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const BOQ_JOB_MODULE = "src/modules/takeoff/boq/job.ts";
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";

/** The two project roles the cases stand on: one that holds MEASURE (L-ACT-03) and one that does not. */
const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";

/** Loose shapes for surfaces loaded by path — this file typechecks against the tree, not through it. */
interface BoqDoor {
  exportDraft(input: { projectId: string }): Promise<{ jobId: string; deduplicated: boolean }>;
}
interface BoqRouterModule {
  takeoffBoqRouter: { createCaller(ctx: unknown): BoqDoor };
}
interface ContextModule {
  createContext(opts: { req: Request }): Promise<unknown>;
}
interface JobModule {
  runBoqDraftJob(
    payload: { tenantId: string; projectId: string; campaignId: string; requestedBy: string },
    progress: { step(name: string, detail?: unknown): Promise<void> },
    deps: unknown,
  ): Promise<unknown>;
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
async function doorFor(person: Person): Promise<BoqDoor> {
  const { createContext } = await productModule<ContextModule>(CONTEXT_MODULE);
  const { takeoffBoqRouter } = await productModule<BoqRouterModule>(BOQ_ROUTER_MODULE);
  const request = new Request("http://127.0.0.1/api/trpc/takeoffBoq.exportDraft", { method: "POST", headers: { cookie: person.cookie } });
  return takeoffBoqRouter.createCaller(await createContext({ req: request }));
}

/** What the door threw, or a failure of the case itself where it answered instead. */
async function refusalFrom(work: () => Promise<unknown>, what: string): Promise<unknown> {
  try {
    const answered = await work();
    expect.fail(`${what} must be refused, and the door answered with ${JSON.stringify(answered)}`);
  } catch (thrown) {
    return thrown;
  }
}

/** The registered code the failure carries — the refusal named, never merely a failure (ARCH-03). */
async function refusedWith(thrown: unknown, code: string, why: string): Promise<void> {
  const { refusalCodeOf } = await productModule<MarkerModule>(REFUSAL_MARKER_MODULE);
  expect(refusalCodeOf(thrown), why).toBe(code);
}

/** The register's own spelling of the codes this lane answers with. */
async function codes(): Promise<{ permission: string; noCampaign: string; noLine: string }> {
  const { REFUSALS } = await productModule<ErrorsModule>(ERRORS_MODULE);
  const permission = REFUSALS["PERMISSION_NOT_HELD"]?.code ?? "";
  const noCampaign = REFUSALS["BOQ_NO_CAMPAIGN"]?.code ?? "";
  const noLine = REFUSALS["BOQ_NO_PUBLISHED_LINE"]?.code ?? "";
  expect(permission, "the register publishes PERMISSION_NOT_HELD — the guard's own refusal").not.toBe("");
  expect(noCampaign, "the register publishes BOQ_NO_CAMPAIGN — this door's own refusal (Q-07)").not.toBe("");
  expect(noLine, "the register publishes BOQ_NO_PUBLISHED_LINE — the render job's own refusal (Q-07)").not.toBe("");
  return { permission, noCampaign, noLine };
}

describe("the draft-BOQ export door, at the guard", () => {
  it("refuses a participant who does not hold MEASURE, by name, without enqueueing a render", async () => {
    await openStage();
    const reviewer = await enrol("boq-door-reviewer");
    const projectId = projectFor(reviewer, "Draft BOQ — reviewer", REVIEWER);
    const { permission } = await codes();

    const door = await doorFor(reviewer);
    const thrown = await refusalFrom(() => door.exportDraft({ projectId }), `a ${REVIEWER} asking for the draft`);

    await refusedWith(thrown, permission, `${REVIEWER} holds no MEASURE, so the one guard refuses this door before it reads anything (L-ACT-03)`);
  }, 300_000);

  it("refuses a MEASURER whose project has no campaign open, by the register's own code", async () => {
    await openStage();
    const measurer = await enrol("boq-door-measurer");
    const projectId = projectFor(measurer, "Draft BOQ — no campaign", MEASURER);
    const { noCampaign } = await codes();

    const door = await doorFor(measurer);
    const thrown = await refusalFrom(() => door.exportDraft({ projectId }), "a MEASURER asking for a draft of a project with no campaign");

    await refusedWith(thrown, noCampaign, "there is no register to draft from, and a job that would find nothing is not work (R-SPINE-062)");
  }, 300_000);

  it("refuses the render itself, by name, where the campaign published no line", async () => {
    await openStage();
    const measurer = await enrol("boq-job-measurer");
    const projectId = projectFor(measurer, "Draft BOQ — no published line", MEASURER);
    const { noLine } = await codes();
    const { runBoqDraftJob } = await productModule<JobModule>(BOQ_JOB_MODULE);

    // The run is given a campaign that published nothing — the state the door cannot see, because a
    // campaign IS open by the time the job runs. The refusal is raised off the reading itself, before
    // any dependency of the renderer is touched, so the run is handed none (ARCH-03, B-21).
    const payload = { tenantId: measurer.tenantId, projectId, campaignId: randomUUID(), requestedBy: measurer.userId };
    const steps: string[] = [];
    const thrown = await refusalFrom(
      () => runBoqDraftJob(payload, { step: async (name) => void steps.push(name) }, {}),
      "a render of a campaign that published no line",
    );

    await refusedWith(thrown, noLine, "nothing to draft is an answer about what was asked for, never a fault of the run (R-SPINE-062)");
    expect(steps.length, "the run reported the read it did before it refused — a refusal is not a silent stop (I-107)").toBeGreaterThan(0);
  }, 300_000);
});
