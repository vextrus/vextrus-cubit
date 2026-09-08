/**
 * AC-2 — `spine.search`, the workspace's one search door, against a self-provisioned, migrated
 * scratch database (V-DB): the same harness every other live suite runs on.
 *
 * The claim is about rows the database really holds and the membership that admits a reader to
 * them, so only a migrated database can answer it. The two accounts are minted through the shipped
 * sign-up door, which is what mints a workspace and the membership joining them (R-SPINE-002) — so
 * "the session holds no membership of tenantId" is a real posture here, not a stubbed one.
 *
 * Nothing is transcribed from the schema or from the seam: the kinds are read from `SEARCH_KINDS`,
 * the cap from `SEARCH_LIMIT`, the closed enums a probe row needs from the seam's own constants, and
 * the expected hits are derived from the rows this file seeded (B-19). Raw SQL is spoken through
 * psql, never a driver import — SEAM-TENANT binds this file like the rest of the tree. Product
 * modules are loaded by absolute path, so a module the Builder has not written yet fails as an
 * assertion naming the file instead of killing collection.
 */
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";
import { BOOTSTRAP_URL, GUC_SYSTEM_REASON } from "./support/fixtures";
import { lit, run, scalar, withSession } from "./support/live-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the increment's interfaces name. */
const SEARCH_MODULE = "src/server/spine/search.ts";
const ROOT_MODULE = "src/server/root.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const SESSION_MODULE = "src/server/auth/session.ts";
const DB_SEAM_MODULE = "src/core/db.ts";

/** The procedure the test contract routes at `/api/trpc/spine.search`. */
const SEARCH_PATH = "spine.search";

/** The two registered answers AC-2 names. */
const SIGNED_OUT = "SIGNED_OUT";
const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

/** The four kinds the door answers over today (AC-2); the roster itself may grow (out of scope). */
const KINDS_TODAY = ["project", "drawing", "sheet", "set"] as const;

/** The token this suite's matching rows carry, and the case a query is asked in. */
const TOKEN = "Zqxel";
const QUERY = "zqxel";

/** A token the cap is proven with, so the rows counted are only this case's. */
const MANY_TOKEN = "Wbrimm";

/** The reason every statement this file makes as the owner is recorded under. */
const REASON = "test: seed the workspaces spine.search is judged over";

const PASSWORD = "correct-horse-battery-staple-9";

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

type Procedure = (input?: unknown) => Promise<unknown>;

interface SearchHitRow {
  kind: string;
  label: string;
  projectId: string;
}

/** The one seam `searchWorkspace` takes injected, so the sheet leg is provable without an ingest. */
interface SearchDeps {
  sheetIndex?: (scope: { tenantId: string; projectId: string }) => Promise<readonly { sheetId: string; drawingId: string; layoutName: string }[]>;
}

interface SearchModule {
  SEARCH_KINDS?: readonly string[];
  SEARCH_LIMIT?: number;
  searchWorkspace?: (input: { tenantId: string; query: string }, deps?: SearchDeps) => Promise<{ hits: readonly SearchHitRow[] }>;
}

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown; _def?: { procedures?: Record<string, unknown> } };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

/* ------------------------------------------------------------------ staging */

let scratch: { drop(): Promise<void> } | undefined;

afterAll(async () => {
  const held = scratch;
  scratch = undefined;
  if (held !== undefined) await held.drop();
});

interface Account {
  email: string;
  token: string;
  userId: string;
  tenantId: string;
  projectId: string;
  drawingId: string;
  setId: string;
}

interface Stage {
  admin: string;
  urlMigrate: string;
  alpha: Account;
  beta: Account;
  search: SearchModule;
  caller(token: string | null): Promise<Procedure>;
}

let staging: Promise<Stage> | undefined;
const staged = (): Promise<Stage> => (staging ??= build());

/** One statement as the owning role, under a recorded system reason. */
const asOwner = (url: string, statement: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: REASON }, statement));

const scalarAsOwner = (url: string, statement: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: REASON }, statement));

async function build(): Promise<Stage> {
  const provisioned = await provisionScratchDb();
  scratch = provisioned;
  // The product opens its pool from this, so it is repointed before any product module is imported.
  process.env["DATABASE_URL"] = provisioned.urlApp;

  const adminUrl = new URL(BOOTSTRAP_URL);
  adminUrl.pathname = new URL(provisioned.urlApp).pathname;
  const admin = adminUrl.toString();

  const [root, context, session, seam, search] = await Promise.all([
    productModule<RootModule>(ROOT_MODULE),
    productModule<ContextModule>(CONTEXT_MODULE),
    productModule<Record<string, unknown>>(SESSION_MODULE),
    productModule<{ ACCEPTED_FORMATS?: readonly string[]; SCAN_VERDICTS?: readonly string[] }>(DB_SEAM_MODULE),
    productModule<SearchModule>(SEARCH_MODULE),
  ]);

  const cookieName = String(session["SESSION_COOKIE"] ?? "");
  expect(cookieName, `${SESSION_MODULE} publishes SESSION_COOKIE — the name a session rides under`).not.toBe("");

  /** The search door, called as the session the caller presents (or as nobody at all). */
  const callerFor = async (token: string | null): Promise<Procedure> => {
    const headers = new Headers();
    if (token !== null) headers.set("cookie", `${cookieName}=${token}`);
    const ctx = await context.createContext({ req: new Request(`http://cubit.test/api/trpc/${SEARCH_PATH}`, { headers }) });
    const caller = root.appRouter.createCaller(ctx) as { spine: Record<string, Procedure> };
    expect(typeof caller.spine?.["search"], `appRouter mounts ${SEARCH_PATH} (test contract)`).toBe("function");
    return caller.spine["search"] as Procedure;
  };

  const format = seam.ACCEPTED_FORMATS?.[0];
  const verdict = seam.SCAN_VERDICTS?.[0];
  expect(typeof format, `${DB_SEAM_MODULE} publishes ACCEPTED_FORMATS — the closed set a file's format belongs to`).toBe("string");
  expect(typeof verdict, `${DB_SEAM_MODULE} publishes SCAN_VERDICTS — the closed set a scan's verdict belongs to`).toBe("string");

  /** Mint an account through the shipped door, which is what mints a workspace and its membership. */
  const enrol = async (local: string): Promise<{ email: string; token: string; userId: string; tenantId: string }> => {
    const email = `${local}-${randomUUID().slice(0, 8)}@cubit.test`;
    const ctx = await context.createContext({ req: new Request("http://cubit.test/api/trpc/spine.auth.signUp") });
    const caller = root.appRouter.createCaller(ctx) as { spine: { auth: Record<string, Procedure> } };
    const signUp = caller.spine.auth["signUp"];
    expect(typeof signUp, "the shipped sign-up door mints an account, its workspace and the membership joining them").toBe("function");
    const answer = (await (signUp as Procedure)({ email, password: PASSWORD, tenantName: `Workspace ${local}` })) as { sessionToken?: string };
    expect(typeof answer?.sessionToken, `sign-up answers ${email} with a session`).toBe("string");
    const userId = scalarAsOwner(admin, `select user_id::text from users where email = ${lit(email)};`);
    const tenantId = scalarAsOwner(admin, `select tenant_id::text from memberships where user_id = ${lit(userId)}::uuid limit 1;`);
    expect(tenantId, `${email} holds a membership of the workspace sign-up minted`).not.toBe("");
    return { email, token: String(answer?.sessionToken ?? ""), userId, tenantId };
  };

  /** The rows one workspace holds: one of each kind carrying the token, and one carrying none. */
  const furnish = (who: { userId: string; tenantId: string }): { projectId: string; drawingId: string; setId: string } => {
    const url = provisioned.urlMigrate;
    const projectId = scalarAsOwner(
      url,
      `insert into projects (tenant_id, name) values (${lit(who.tenantId)}::uuid, ${lit(`${TOKEN} Terminal`)}) returning project_id::text;`,
    );
    asOwner(url, `insert into projects (tenant_id, name) values (${lit(who.tenantId)}::uuid, ${lit("Unrelated Yard")});`);

    const sha = randomUUID().replace(/-/g, "");
    asOwner(
      url,
      `insert into files (tenant_id, sha256, byte_length, format, scan_verdict)
         values (${lit(who.tenantId)}::uuid, ${lit(sha)}, 1, ${lit(String(format))}, ${lit(String(verdict))});`,
    );
    const drawingId = scalarAsOwner(
      url,
      `insert into drawings (tenant_id, project_id, sha256, name, format, uploaded_by)
         values (${lit(who.tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(sha)}, ${lit(`${TOKEN} Elevation`)}, ${lit(String(format))}, ${lit(who.userId)}::uuid)
       returning drawing_id::text;`,
    );
    const setId = scalarAsOwner(
      url,
      `insert into drawing_sets (tenant_id, project_id, name, created_by)
         values (${lit(who.tenantId)}::uuid, ${lit(projectId)}::uuid, ${lit(`${TOKEN} Tender Set`)}, ${lit(who.userId)}::uuid)
       returning set_id::text;`,
    );
    return { projectId, drawingId, setId };
  };

  const alphaAccount = await enrol("alpha");
  const betaAccount = await enrol("beta");
  const alpha: Account = { ...alphaAccount, ...furnish(alphaAccount) };
  const beta: Account = { ...betaAccount, ...furnish(betaAccount) };

  return { admin, urlMigrate: provisioned.urlMigrate, alpha, beta, search, caller: callerFor };
}

/** Settle a call and hand back the refusal code it was refused with. */
async function refusalOfCall(work: Promise<unknown>, why: string): Promise<string | null> {
  const [settled] = await Promise.allSettled([work]);
  expect(settled?.status, `${why} — the door answered instead of refusing`).toBe("rejected");
  return refusalCodeOf((settled as PromiseRejectedResult).reason);
}

/* ------------------------------------------------------------------ the cases */

describe("AC-2 — spine.search is a signed-in door over the caller's own workspace", () => {
  test("AC-2: without a session the door refuses SIGNED_OUT", async () => {
    const stage = await staged();
    const search = await stage.caller(null);
    expect(
      await refusalOfCall(search({ tenantId: stage.alpha.tenantId, query: QUERY }), "a request presenting no session"),
      "a door that needs a session says so, as a registered refusal and never as a fault (ARCH-03)",
    ).toBe(SIGNED_OUT);
  });

  test("AC-2: a session holding no membership of the named workspace is refused WORKSPACE_PERMISSION_NOT_HELD", async () => {
    const stage = await staged();
    const search = await stage.caller(stage.alpha.token);
    expect(
      await refusalOfCall(search({ tenantId: stage.beta.tenantId, query: QUERY }), "a member of one workspace naming another"),
      "the refusal is thrown through `refusal()` from src/core/faults/refusal-marker, so the seam reads it as an answer",
    ).toBe(WORKSPACE_PERMISSION_NOT_HELD);
  });

  test("AC-2: for a member the answer is the workspace's own matching rows, and no other workspace's", async () => {
    const stage = await staged();
    const kinds = stage.search.SEARCH_KINDS;
    expect(Array.isArray(kinds), `${SEARCH_MODULE} publishes SEARCH_KINDS — the closed roster a hit's kind belongs to`).toBe(true);
    for (const kind of KINDS_TODAY) expect(kinds, `SEARCH_KINDS names \`${kind}\` (AC-2)`).toContain(kind);

    const search = await stage.caller(stage.alpha.token);
    const answer = (await search({ tenantId: stage.alpha.tenantId, query: QUERY })) as { hits?: readonly SearchHitRow[] };
    expect(Array.isArray(answer.hits), "the door answers `{ hits }`").toBe(true);
    const hits = answer.hits ?? [];

    for (const hit of hits) expect(kinds, `every hit's kind is one SEARCH_KINDS names — \`${hit.kind}\` is not`).toContain(hit.kind);
    expect(
      hits.map((hit) => `${hit.kind}:${hit.label}`).sort(),
      "the query is matched against the stored name, case-insensitively, over the caller's own projects, drawings and sets",
    ).toEqual([`drawing:${TOKEN} Elevation`, `project:${TOKEN} Terminal`, `set:${TOKEN} Tender Set`]);

    for (const hit of hits) expect(hit.projectId, "every hit names a project of the caller's own workspace").toBe(stage.alpha.projectId);

    const foreign = (await (await stage.caller(stage.beta.token))({ tenantId: stage.beta.tenantId, query: QUERY })) as { hits?: readonly SearchHitRow[] };
    expect((foreign.hits ?? []).length, "the other workspace holds its own matching rows, so the comparison below is not vacuous").toBeGreaterThan(0);
    for (const hit of foreign.hits ?? []) {
      expect(hit.projectId, "another workspace's rows never appear in this one's answer").not.toBe(stage.alpha.projectId);
    }
  });

  test("AC-2: a blank or whitespace query answers no hits at all", async () => {
    const stage = await staged();
    const search = await stage.caller(stage.alpha.token);
    for (const query of ["", "   ", "\t\n"]) {
      const answer = (await search({ tenantId: stage.alpha.tenantId, query })) as { hits?: readonly SearchHitRow[] };
      expect(answer.hits, `a query of ${JSON.stringify(query)} asks for nothing, so nothing is answered`).toEqual([]);
    }
  });

  test("AC-2: no more than SEARCH_LIMIT hits are answered", async () => {
    const stage = await staged();
    const limit = stage.search.SEARCH_LIMIT;
    expect(typeof limit, `${SEARCH_MODULE} publishes SEARCH_LIMIT — the cap, stated once (B-19)`).toBe("number");
    const cap = limit as number;
    expect(cap, "a cap of at least one is what an answer can be bounded by").toBeGreaterThan(0);

    asOwner(
      stage.urlMigrate,
      `insert into projects (tenant_id, name)
         select ${lit(stage.alpha.tenantId)}::uuid, ${lit(`${MANY_TOKEN} `)} || g
           from generate_series(1, ${cap + 3}) g;`,
    );

    const search = await stage.caller(stage.alpha.token);
    const answer = (await search({ tenantId: stage.alpha.tenantId, query: MANY_TOKEN.toLowerCase() })) as { hits?: readonly SearchHitRow[] };
    expect((answer.hits ?? []).length, `${cap + 3} rows match, so the answer is capped at SEARCH_LIMIT`).toBe(cap);
  });
});

describe("AC-2 — a sheet is a hit of the index, asked through the seam the door is given", () => {
  test("AC-2: one `sheet` hit per sheetIndexOf card whose layoutName carries the query", async () => {
    const stage = await staged();
    const searchWorkspace = stage.search.searchWorkspace;
    expect(typeof searchWorkspace, `${SEARCH_MODULE} publishes searchWorkspace(input, deps) — the seam behind the door`).toBe("function");

    const cards = [
      { sheetId: randomUUID(), drawingId: stage.alpha.drawingId, layoutName: `${TOKEN} FOUNDATION PLAN` },
      { sheetId: randomUUID(), drawingId: stage.alpha.drawingId, layoutName: `${TOKEN} ROOF PLAN` },
      { sheetId: randomUUID(), drawingId: stage.alpha.drawingId, layoutName: "SITE SECTION" },
    ];
    const asked: string[] = [];
    const answer = await (searchWorkspace as NonNullable<SearchModule["searchWorkspace"]>)(
      { tenantId: stage.alpha.tenantId, query: QUERY },
      {
        sheetIndex: async (scope) => {
          asked.push(scope.projectId);
          return scope.projectId === stage.alpha.projectId ? cards : [];
        },
      },
    );

    expect(asked, "the index is asked for the workspace's own projects").toContain(stage.alpha.projectId);
    expect(
      answer.hits
        .filter((hit) => hit.kind === "sheet")
        .map((hit) => hit.label)
        .sort(),
      "one sheet hit per card whose layout name carries the query, and none for the card that does not",
    ).toEqual([`${TOKEN} FOUNDATION PLAN`, `${TOKEN} ROOF PLAN`]);
  });
});
