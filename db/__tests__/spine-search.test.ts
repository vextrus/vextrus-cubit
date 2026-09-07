/**
 * AC-2 (the live half) — `spine.search` on the wire: the read the palette's navigate group is made
 * of (R-SPINE-050), driven through the shipped tRPC route handler with a real session, against a
 * scratch database the committed migrations built (V-DB).
 *
 * The subjects are real rows of a real workspace: a project, a drawing over stored content, and a
 * drawing set, each named with the same token so one query reaches all of them. The kinds are read
 * from the one place both lanes state them (`tests/ui/command-palette/support/search-contract.ts`),
 * never listed again here (B-19).
 *
 * Raw SQL is spoken through the stage's psql seam, never a driver import — SEAM-TENANT's ban binds
 * this file like the rest of the lane.
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so keep imports between `src/`
 * files relative or spelled through the alias this lane's config resolves.
 */
import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ident, lit } from "./support/live-sql";
import { TENANT_COLUMN } from "./support/fixtures";
import { closeStage, enrol, openStage, productModule, sql, sqlValue, stageProject, type Person } from "../../tests/spine/uploads/support/upload-stage";
import { BLANK_QUERIES, SEARCH_KINDS, SEARCH_TOKEN, SEARCH_TOKEN_TYPED, searchName } from "../../tests/ui/command-palette/support/search-contract";

/** The procedure the test contract fixes, and the handler it is reached through. */
const PROC_SEARCH = "spine.search";
const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";
const ROOT_MODULE = "src/server/root.ts";

/** The staged content's shape: a real format and a clean verdict, as the store's CHECKs admit. */
const FORMAT = "dxf";
const SCAN_VERDICT = "clean";

type RouteHandler = (request: Request, context: { params: Promise<{ trpc: string[] }> }) => Promise<Response>;
type WireAnswer = {
  status: number;
  raw: string;
  body: { result?: { data?: unknown }; error?: { data?: Record<string, unknown> } } | undefined;
};

interface Stage {
  person: Person;
  projectId: string;
  drawingId: string;
  setId: string;
  names: { project: string; drawing: string; set: string };
}

let staging: Promise<Stage> | undefined;
let opened = false;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    await openStage();
    opened = true;
    const person = await enrol("search");
    const marker = randomUUID().slice(0, 8);

    const names = {
      project: searchName("project", marker),
      drawing: `${searchName("drawing", marker)}.${FORMAT}`,
      set: searchName("set", marker),
    };
    const projectId = stageProject(person.tenantId, names.project);
    const sha256 = createHash("sha256").update(marker).digest("hex");

    sql(
      `insert into ${ident("files")} (${ident(TENANT_COLUMN)}, sha256, byte_length, format, scan_verdict)
         values (${lit(person.tenantId)}::uuid, ${lit(sha256)}, 1024, ${lit(FORMAT)}, ${lit(SCAN_VERDICT)})
         on conflict do nothing;`,
    );
    const drawingId = sqlValue(
      `insert into ${ident("drawings")} (${ident(TENANT_COLUMN)}, project_id, sha256, name, format, uploaded_by)
         values (${lit(person.tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(sha256)}, ${lit(names.drawing)}, ${lit(FORMAT)}, ${lit(person.userId)}::uuid)
         returning drawing_id::text;`,
    );
    const setId = sqlValue(
      `insert into ${ident("drawing_sets")} (${ident(TENANT_COLUMN)}, project_id, name, created_by)
         values (${lit(person.tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(names.set)}, ${lit(person.userId)}::uuid)
         returning set_id::text;`,
    );

    return { person, projectId, drawingId, setId, names };
  })());

afterAll(async () => {
  if (opened) await closeStage();
});

/** One call of the procedure over GET, exactly as the test contract addresses it. */
async function callSearch(input: unknown, cookie: string | null): Promise<WireAnswer> {
  const route = await productModule<{ GET?: RouteHandler }>(ROUTE_MODULE);
  const get = route.GET;
  expect(typeof get, `${ROUTE_MODULE} answers a query over GET (the test contract: GET /api/trpc/${PROC_SEARCH})`).toBe("function");

  const endpoint = `http://127.0.0.1/api/trpc/${PROC_SEARCH}`;
  const headers: Record<string, string> = cookie === null ? {} : { cookie };
  const response = await (get as RouteHandler)(
    new Request(`${endpoint}?input=${encodeURIComponent(JSON.stringify(input))}`, { method: "GET", headers }),
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

interface Hit {
  kind?: unknown;
  label?: unknown;
}

/** The hits an answer carries, refusing an answer that is not `{ hits }` (AC-2). */
function hitsOf(answer: WireAnswer, what: string): Hit[] {
  expect(answer.body?.error, `${what} was refused or faulted: ${answer.raw.slice(0, 500)}`).toBeUndefined();
  const data = answer.body?.result?.data as { hits?: unknown } | undefined;
  expect(Array.isArray(data?.hits), `${what} answers \`{ hits }\` (AC-2): ${answer.raw.slice(0, 500)}`).toBe(true);
  return (data as { hits: Hit[] }).hits;
}

describe("AC-2: spine.search on the wire", () => {
  it("AC-2: the composed router mounts spine.search", async () => {
    await staged();
    const root = await productModule<{ appRouter?: { _def?: { procedures?: Record<string, unknown> } } }>(ROOT_MODULE);
    const paths = Object.keys(root.appRouter?._def?.procedures ?? {});
    expect(paths, "appRouter exposes no procedures at all").not.toHaveLength(0);
    expect(paths, `${PROC_SEARCH} is mounted on the composed router (the test contract's procedures)`).toContain(PROC_SEARCH);
  }, 300_000);

  it("AC-2: a query answers the workspace's subjects, each kind one the palette knows and each label carrying the query", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.person.tenantId, query: SEARCH_TOKEN }, stage.person.cookie);
    const hits = hitsOf(answer, `${PROC_SEARCH} for a token the workspace holds`);

    expect(hits.length, "the staged workspace answers the subjects it holds").toBeGreaterThan(0);
    for (const hit of hits) {
      expect(SEARCH_KINDS, `every hit names one of the kinds spine.search answers (AC-2): ${JSON.stringify(hit)}`).toContain(String(hit.kind));
      expect(String(hit.label).toLowerCase(), `every hit's label carries the query (AC-2): ${JSON.stringify(hit)}`).toContain(SEARCH_TOKEN.toLowerCase());
    }

    // The three subjects this stage can seed stand for their kinds; each is found by the name it
    // was stored under, never by a position in the answer.
    const labels = hits.map((hit) => String(hit.label));
    for (const [kind, name] of [
      ["project", stage.names.project],
      ["drawing", stage.names.drawing],
      ["set", stage.names.set],
    ] as const) {
      const found = hits.filter((hit) => String(hit.label) === name);
      expect(found.length, `the ${kind} the workspace holds is answered — labels were ${JSON.stringify(labels)}`).toBe(1);
      expect(String(found[0]?.kind), `the ${kind} is answered as a ${kind} (AC-2)`).toBe(kind);
    }
  }, 300_000);

  it("AC-2: the match is case-insensitive — the same subjects answer a shouted query", async () => {
    const stage = await staged();
    const answer = await callSearch({ tenantId: stage.person.tenantId, query: SEARCH_TOKEN_TYPED }, stage.person.cookie);
    const hits = hitsOf(answer, `${PROC_SEARCH} for the same token in capitals`);
    const labels = hits.map((hit) => String(hit.label));
    for (const name of [stage.names.project, stage.names.drawing, stage.names.set]) {
      expect(labels, `a shouted query finds the same subject (AC-2): ${JSON.stringify(labels)}`).toContain(name);
    }
  }, 300_000);

  it("AC-2: an empty or whitespace query answers no hits at all", async () => {
    const stage = await staged();
    for (const query of BLANK_QUERIES) {
      const answer = await callSearch({ tenantId: stage.person.tenantId, query }, stage.person.cookie);
      expect(hitsOf(answer, `${PROC_SEARCH} for ${JSON.stringify(query)}`), `a query asking for nothing answers no hits (AC-2)`).toEqual([]);
    }
  }, 300_000);
});
