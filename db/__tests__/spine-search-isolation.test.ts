/**
 * The other half of `spine.search` on the wire (R-SPINE-003, R-SPINE-050): a workspace's subjects
 * are answered to that workspace and to nobody else.
 *
 * A tenant id on the wire is a value the caller wrote, so naming one is not being admitted to it.
 * Two enrolled people, each holding their own workspace, are staged with a project named by the same
 * token — and the read is driven through the shipped tRPC route handler with each one's real session
 * in turn. Neither sees the other's row, and a caller who names the workspace they do not hold is
 * answered with the registered refusal rather than with somebody else's rows.
 *
 * Raw SQL is spoken through the stage's psql seam, never a driver import — SEAM-TENANT's ban binds
 * this file like the rest of the lane. The kinds and the query token are read from the one place
 * both lanes state them (`tests/ui/command-palette/support/search-contract.ts`), never listed here.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeStage, enrol, openStage, productModule, stageProject, type Person } from "../../tests/spine/uploads/support/upload-stage";
import { SEARCH_TOKEN, expectSearchKind, searchName } from "../../tests/ui/command-palette/support/search-contract";

/** The procedure the test contract fixes, and the handler it is reached through. */
const PROC_SEARCH = "spine.search";
const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";

/** What a caller who named a workspace they do not hold is answered with (R-SPINE-062). */
const NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

type RouteHandler = (request: Request, context: { params: Promise<{ trpc: string[] }> }) => Promise<Response>;

interface Neighbour {
  person: Person;
  projectId: string;
  projectName: string;
}

interface Stage {
  one: Neighbour;
  other: Neighbour;
}

let staging: Promise<Stage> | undefined;
let opened = false;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    await openStage();
    opened = true;
    const make = async (who: string): Promise<Neighbour> => {
      const person = await enrol(who);
      const projectName = searchName("project", randomUUID().slice(0, 8));
      return { person, projectId: stageProject(person.tenantId, projectName), projectName };
    };
    return { one: await make("search-one"), other: await make("search-other") };
  })());

afterAll(async () => {
  if (opened) await closeStage();
});

interface WireAnswer {
  status: number;
  raw: string;
  body: { result?: { data?: unknown }; error?: { data?: Record<string, unknown>; message?: string } } | undefined;
}

/** One call of the procedure over GET, exactly as the test contract addresses it. */
async function callSearch(input: unknown, cookie: string | null): Promise<WireAnswer> {
  const route = await productModule<{ GET?: RouteHandler }>(ROUTE_MODULE);
  const get = route.GET;
  expect(typeof get, `${ROUTE_MODULE} answers a query over GET (the test contract)`).toBe("function");
  const response = await (get as RouteHandler)(
    new Request(`http://127.0.0.1/api/trpc/${PROC_SEARCH}?input=${encodeURIComponent(JSON.stringify(input))}`, {
      method: "GET",
      headers: cookie === null ? {} : { cookie },
    }),
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

/** The labels an answer carries, refusing an answer that is not `{ hits }`. */
function labelsOf(answer: WireAnswer, what: string): string[] {
  expect(answer.body?.error, `${what} was refused or faulted: ${answer.raw.slice(0, 500)}`).toBeUndefined();
  const data = answer.body?.result?.data as { hits?: unknown } | undefined;
  expect(Array.isArray(data?.hits), `${what} answers \`{ hits }\`: ${answer.raw.slice(0, 500)}`).toBe(true);
  return (data as { hits: { kind?: unknown; label?: unknown }[] }).hits.map((hit) => {
    expectSearchKind(hit.kind, `an answered hit ${JSON.stringify(hit)}`);
    return String(hit.label);
  });
}

describe("R-SPINE-003: spine.search answers one workspace and no other", () => {
  it("R-SPINE-003: each workspace is answered its own project and never its neighbour's", async () => {
    const stage = await staged();

    const mine = labelsOf(await callSearch({ tenantId: stage.one.person.tenantId, query: SEARCH_TOKEN }, stage.one.person.cookie), "the first workspace's own read");
    expect(mine, "a workspace is answered the project it holds").toContain(stage.one.projectName);
    expect(mine, "and never a project another workspace holds — the token reaches both names").not.toContain(stage.other.projectName);

    const theirs = labelsOf(
      await callSearch({ tenantId: stage.other.person.tenantId, query: SEARCH_TOKEN }, stage.other.person.cookie),
      "the second workspace's own read",
    );
    expect(theirs, "the neighbour is answered the project they hold").toContain(stage.other.projectName);
    expect(theirs, "and never the first workspace's").not.toContain(stage.one.projectName);
  }, 300_000);

  it("R-SPINE-003: naming a workspace the session does not hold is refused, not answered", async () => {
    const stage = await staged();
    // The session is real and live; only the workspace it named is somebody else's. What comes back
    // is the registered refusal — never rows, and never an empty list that would read as "nothing
    // there" for a workspace that is full (ARCH-03, B-21, R-UI-020).
    const answer = await callSearch({ tenantId: stage.other.person.tenantId, query: SEARCH_TOKEN }, stage.one.person.cookie);
    expect(answer.body?.result, "a workspace the session does not hold answers no rows at all").toBeUndefined();
    expect(JSON.stringify(answer.body?.error ?? {}), `the refusal names ${NOT_HELD}: ${answer.raw.slice(0, 500)}`).toContain(NOT_HELD);
  }, 300_000);

  it("R-SPINE-003: a request with no session is refused rather than answered", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.one.person.tenantId, query: SEARCH_TOKEN }, null);
    expect(answer.body?.result, "a read with no live session answers no rows").toBeUndefined();
    expect(JSON.stringify(answer.body?.error ?? {}), `the refusal names SIGNED_OUT: ${answer.raw.slice(0, 500)}`).toContain("SIGNED_OUT");
  }, 300_000);
});
