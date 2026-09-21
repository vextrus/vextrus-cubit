/**
 * The bar-schedule export door, judged at the door itself — live, against a scratch database the
 * committed migrations built (V-DB, AM-11 §2, R-TO-054, I-bbs-8).
 *
 * Every entry point resolves actor, tenant, project, participation and permission through the one
 * `authorize()` before it reads or writes, and carries a live-database test that a caller without
 * the permission is refused BY NAME. `takeoffBbs.exportSchedule` is that entry point for this lane,
 * so this is that test: a participant who holds no MEASURE is refused `PERMISSION_NOT_HELD`, a
 * MEASURER whose project has no campaign open is refused `BBS_NO_CAMPAIGN`, and the render itself
 * refuses `BBS_NO_BAR_ROW` where the campaign scheduled nothing — each the code the register
 * publishes, read off the register rather than spelled here (B-17). The render that files a
 * document over a measured campaign is proved beside the view it is drawn from
 * (tests/takeoff/bbs-ui/view.db.test.ts), on the campaign that suite already stages.
 *
 * The people, the workspaces and the projects are real: accounts are enrolled through the shipped
 * sign-up door, so a workspace is theirs because R-SPINE-002 made it theirs. The database, the
 * storage root and those doors come from the upload seam's own stage — borrowed, never copied
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
import { closeStage, enrol, openStage, productModule, sql, sqlValue, stageProject, type Person } from "../../spine/uploads/support/upload-stage";

/** The homes this suite reads: the door, the context the door is handed, the run and the register. */
const BBS_ROUTER_MODULE = "src/server/routers/takeoff-bbs.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const BBS_JOB_MODULE = "src/modules/takeoff/bbs-ui/job.ts";
const BBS_MODULE = "src/modules/takeoff/bbs-ui/index.ts";
const REFUSAL_MARKER_MODULE = "src/core/faults/refusal-marker.ts";
const ERRORS_MODULE = "src/core/errors.ts";

/** The two project roles the cases stand on: one that holds MEASURE (L-ACT-03) and one that does not. */
const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";

/** Loose shapes for surfaces loaded by path — this file typechecks against the tree, not through it. */
interface BbsDoor {
  exportSchedule(input: { projectId: string }): Promise<{ jobId: string; deduplicated: boolean }>;
}
interface BbsRouterModule {
  takeoffBbsRouter: { createCaller(ctx: unknown): BbsDoor; _def?: { procedures?: Record<string, unknown> } };
}
interface ContextModule {
  createContext(opts: { req: Request }): Promise<unknown>;
}
interface JobModule {
  runBbsRenderJob(
    payload: { tenantId: string; projectId: string; campaignId: string; requestedBy: string },
    progress: { jobId: string; step(name: string, detail?: unknown): Promise<void> },
    deps: unknown,
  ): Promise<unknown>;
}
interface KindModule {
  BBS_RENDER_KIND: string;
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
async function doorFor(person: Person): Promise<BbsDoor> {
  const { createContext } = await productModule<ContextModule>(CONTEXT_MODULE);
  const { takeoffBbsRouter } = await productModule<BbsRouterModule>(BBS_ROUTER_MODULE);
  expect(Object.keys(takeoffBbsRouter._def?.procedures ?? {}), "takeoffBbs.exportSchedule is on the wire — the door this session lands (I-bbs-8)").toContain("exportSchedule");
  const request = new Request("http://127.0.0.1/api/trpc/takeoffBbs.exportSchedule", { method: "POST", headers: { cookie: person.cookie } });
  return takeoffBbsRouter.createCaller(await createContext({ req: request }));
}

/**
 * What the door threw — and, where it ANSWERED instead, a failure that says so in those words. The
 * verdict is taken OUTSIDE the `try`, so an answer is reported as the thing worth reading.
 */
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

/**
 * How many schedule renders this scratch world has been asked for — the queue read as the system
 * reads it. The queue's schema is provisioned by the first enqueue, so a world where nothing was
 * ever queued has no table at all: that is zero renders, not a failure of the read (SEAM-JOBS).
 */
async function rendersQueued(): Promise<number> {
  const { BBS_RENDER_KIND } = await productModule<KindModule>(BBS_MODULE);
  const stands = sqlValue(`select (to_regclass('cubit_jobs.job_events') is not null)::text;`).trim();
  if (stands !== "t") return 0;
  return Number(sqlValue(`select count(*)::text from cubit_jobs.job_events where kind = ${lit(BBS_RENDER_KIND)};`));
}

/** The registered code the failure carries — the refusal named, never merely a failure (ARCH-03). */
async function refusedWith(thrown: unknown, code: string, why: string): Promise<void> {
  const { refusalCodeOf } = await productModule<MarkerModule>(REFUSAL_MARKER_MODULE);
  expect(refusalCodeOf(thrown), why).toBe(code);
}

/** The register's own spelling of the codes this lane answers with. */
async function codes(): Promise<{ permission: string; noCampaign: string; noBar: string }> {
  const { REFUSALS } = await productModule<ErrorsModule>(ERRORS_MODULE);
  const permission = REFUSALS["PERMISSION_NOT_HELD"]?.code ?? "";
  const noCampaign = REFUSALS["BBS_NO_CAMPAIGN"]?.code ?? "";
  const noBar = REFUSALS["BBS_NO_BAR_ROW"]?.code ?? "";
  expect(permission, "the register publishes PERMISSION_NOT_HELD — the guard's own refusal").not.toBe("");
  expect(noCampaign, "the register publishes BBS_NO_CAMPAIGN — this door's own refusal (Q-07)").not.toBe("");
  expect(noBar, "the register publishes BBS_NO_BAR_ROW — the render job's own refusal (Q-07)").not.toBe("");
  return { permission, noCampaign, noBar };
}

describe("the bar-schedule export door, at the guard", () => {
  it("refuses a participant who does not hold MEASURE, by name, without enqueueing a render", async () => {
    await openStage();
    const reviewer = await enrol("bbs-door-reviewer");
    const projectId = projectFor(reviewer, "Bar schedule — reviewer", REVIEWER);
    const { permission } = await codes();

    const door = await doorFor(reviewer);
    const thrown = await refusalFrom(() => door.exportSchedule({ projectId }), `a ${REVIEWER} asking for the schedule`);

    await refusedWith(thrown, permission, `${REVIEWER} holds no MEASURE, so the one guard refuses this door before it reads anything (L-ACT-03, AM-11 §2)`);
    expect(await rendersQueued(), "a refused door queues nothing: the guard answers before any work is enqueued").toBe(0);
  }, 300_000);

  it("refuses a MEASURER whose project has no campaign open, by the register's own code", async () => {
    await openStage();
    const measurer = await enrol("bbs-door-measurer");
    const projectId = projectFor(measurer, "Bar schedule — no campaign", MEASURER);
    const { noCampaign } = await codes();

    const door = await doorFor(measurer);
    const thrown = await refusalFrom(() => door.exportSchedule({ projectId }), "a MEASURER asking for the schedule of a project with no campaign");

    await refusedWith(thrown, noCampaign, "there is no bill of bars to render, and a job that would find nothing is not work (R-SPINE-062)");
  }, 300_000);

  it("refuses the render itself, by name, where the campaign scheduled no bar", async () => {
    await openStage();
    const measurer = await enrol("bbs-job-measurer");
    const projectId = projectFor(measurer, "Bar schedule — no bar row", MEASURER);
    const { noBar } = await codes();
    const { runBbsRenderJob } = await productModule<JobModule>(BBS_JOB_MODULE);

    // The run is given a campaign that scheduled nothing — the state the door cannot see, because a
    // campaign IS open by the time the job runs. The refusal is raised off the reading itself, before
    // any dependency of the renderer is touched, so the run is handed none (ARCH-03, B-21).
    const payload = { tenantId: measurer.tenantId, projectId, campaignId: randomUUID(), requestedBy: measurer.userId };
    const steps: string[] = [];
    const thrown = await refusalFrom(
      () => runBbsRenderJob(payload, { jobId: randomUUID(), step: async (name) => void steps.push(name) }, {}),
      "a render of a campaign that scheduled no bar",
    );

    await refusedWith(thrown, noBar, "nothing to schedule is an answer about what was asked for, never a fault of the run (R-SPINE-062)");
    expect(steps.length, "the run reported the read it did before it refused — a refusal is not a silent stop (I-107)").toBeGreaterThan(0);
  }, 300_000);
});
