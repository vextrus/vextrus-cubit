/**
 * SEAM-TENANT on the search door: `spine.search` answers a workspace's own subjects and no other's,
 * and a session naming a workspace it holds no membership of is refused rather than answered
 * (R-SPINE-050, R-SPINE-062, ARCH-03).
 *
 * The proof is behavioural and driven through the shipped tRPC route handler with real sessions
 * against a scratch database the committed migrations built (V-DB): two enrolled people, two
 * workspaces, and one project name only the first workspace holds. The own-tenant read runs first,
 * so a cross-tenant read that answers nothing is proof of the policy rather than proof that the row
 * was never staged (the RLS control-probe ordering).
 *
 * Raw SQL is spoken through the stage's psql seam, never a driver import — SEAM-TENANT's ban binds
 * this file like the rest of the lane.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeStage, enrol, openStage, productModule, stageProject, type Person } from "../../tests/spine/uploads/support/upload-stage";
import { searchName } from "../../tests/ui/command-palette/support/search-contract";

/** The procedure the test contract fixes, and the handler it is reached through. */
const PROC_SEARCH = "spine.search";
const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";

/** The one code a search may be refused with when the session holds no membership (I-142). */
const NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

type RouteHandler = (request: Request, context: { params: Promise<{ trpc: string[] }> }) => Promise<Response>;

interface WireAnswer {
  status: number;
  raw: string;
  body: { result?: { data?: unknown }; error?: { data?: Record<string, unknown> } } | undefined;
}

interface Stage {
  holder: Person;
  stranger: Person;
  projectName: string;
}

let staging: Promise<Stage> | undefined;
let opened = false;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    await openStage();
    opened = true;
    const holder = await enrol("search-holder");
    const stranger = await enrol("search-stranger");
    const projectName = searchName("project", randomUUID().slice(0, 8));
    stageProject(holder.tenantId, projectName);
    return { holder, stranger, projectName };
  })());

afterAll(async () => {
  if (opened) await closeStage();
});

/** One call of the procedure over GET, exactly as the test contract addresses it. */
async function callSearch(input: unknown, cookie: string | null): Promise<WireAnswer> {
  const route = await productModule<{ GET?: RouteHandler }>(ROUTE_MODULE);
  const get = route.GET;
  expect(typeof get, `${ROUTE_MODULE} answers a query over GET`).toBe("function");

  const headers: Record<string, string> = cookie === null ? {} : { cookie };
  const response = await (get as RouteHandler)(
    new Request(`http://127.0.0.1/api/trpc/${PROC_SEARCH}?input=${encodeURIComponent(JSON.stringify(input))}`, { method: "GET", headers }),
    { params: Promise.resolve({ trpc: [PROC_SEARCH] }) },
  );
  const raw = await response.text();
  let body: WireAnswer["body"];
  try {
    const parsed: unknown = JSON.parse(raw);
    body = (Array.isArray(parsed) ? parsed[0] : parsed) as WireAnswer["body"];
  } catch {
    body = undefined;
  }
  return { status: response.status, raw, body };
}

/** The registered code a refused answer carries, where src/server/trpc.ts's formatter stamps it. */
function refusalCodeOf(answer: WireAnswer): unknown {
  return answer.body?.error?.data?.["refusalCode"];
}

/** The labels an answer carries, refusing an answer that is not `{ hits }`. */
function labelsOf(answer: WireAnswer, what: string): string[] {
  expect(answer.body?.error, `${what} was refused or faulted: ${answer.raw.slice(0, 500)}`).toBeUndefined();
  const data = answer.body?.result?.data as { hits?: unknown } | undefined;
  expect(Array.isArray(data?.hits), `${what} answers \`{ hits }\`: ${answer.raw.slice(0, 500)}`).toBe(true);
  return (data as { hits: { label?: unknown }[] }).hits.map((hit) => String(hit.label));
}

describe("SEAM-TENANT: spine.search answers one workspace's subjects and refuses another's", () => {
  it("the workspace that holds the project is answered it — the control the isolation proof stands on", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.holder.tenantId, query: stage.projectName }, stage.holder.cookie);
    expect(labelsOf(answer, "the holder's own search"), "the workspace that holds the project finds it").toContain(stage.projectName);
  }, 300_000);

  it("a stranger's own workspace answers nothing of it — the row is invisible, not merely unnamed", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.stranger.tenantId, query: stage.projectName }, stage.stranger.cookie);
    expect(labelsOf(answer, "the stranger's own search"), "another workspace's project is not among a stranger's hits").not.toContain(stage.projectName);
  }, 300_000);

  it("a session naming a workspace it holds no membership of is refused, never answered", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.holder.tenantId, query: stage.projectName }, stage.stranger.cookie);
    expect(answer.body?.result, `naming somebody else's workspace answers nothing: ${answer.raw.slice(0, 500)}`).toBeUndefined();
    expect(refusalCodeOf(answer), `it is refused with the register's own code: ${answer.raw.slice(0, 500)}`).toBe(NOT_HELD);
  }, 300_000);

  it("a search presenting no session is refused as signed out", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.holder.tenantId, query: stage.projectName }, null);
    expect(answer.body?.result, "a door that needs a session answers no data without one").toBeUndefined();
    expect(refusalCodeOf(answer), `a missing session is SIGNED_OUT: ${answer.raw.slice(0, 500)}`).toBe("SIGNED_OUT");
  }, 300_000);
});
