/**
 * Which workspace a tenancy request is about (R-SPINE-002, AC-6), driven through the shipped route
 * handler with real session cookies.
 *
 * "A user may belong to many tenants; the active tenant is explicit in the URL (`/t/{tenantSlug}/…`)
 * and in the session, and updates on switch." So the workspace a call administers is a fact about
 * the CALL: a surface that answered every request from the account's oldest membership would serve a
 * person who belongs to two workspaces the wrong one whichever they were standing in, and no
 * signed-in caller could ever be a non-member of the workspace they addressed — which is the very
 * refusal AC-6 owes.
 *
 * Stating a workspace grants nothing, and that is what makes it safe to read off the wire: every
 * answer below is the store's judgment of the named workspace against the asking account. So this
 * file proves both halves — the named workspace is the one served, and a stranger who names one is
 * refused WORKSPACE_PERMISSION_NOT_HELD rather than quietly served their own.
 *
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT). Nothing is transcribed: every
 * denominator is read back from the database the committed migrations built (B-19).
 */
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, TENANT_COLUMN } from "./support/fixtures";
import { ident, lit, run, scalar, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

const AUTH_MODULE = "src/server/auth/session.ts";
const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";
const ROOT_MODULE = "src/server/root.ts";

const PROC_MEMBERS = "spine.tenancy.members";
const MEMBERSHIPS = "memberships";
const ROLE_COLUMN = "workspace_role";
const MEMBER = "MEMBER";

/** The refusal a signed-in stranger to a workspace is answered with (the registry's own code). */
const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";

/** The origin the probe's requests arrive at — a matching one, so the origin gate is not the subject. */
const REQUEST_ORIGIN = "http://127.0.0.1";

const PROBE_REASON = "test: probe which workspace a tenancy request is answered about";

/* ------------------------------------------------------------------ loading the product */

async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  let abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  if (statSync(abs).isDirectory()) {
    const barrel = ["index.ts", "index.tsx", "index.mts"].map((file) => join(abs, file)).find((file) => existsSync(file));
    expect(barrel, `${relative} is a directory with no index barrel`).toBeTruthy();
    abs = barrel ?? abs;
  }
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

type AnyFn = (...args: never[]) => unknown;
type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

function exported(bag: Record<string, unknown>, name: string, home: string): AnyFn {
  expect(typeof bag[name], `${home} must export ${name} — the increment's declared interface`).toBe("function");
  return bag[name] as AnyFn;
}

const callFn = (fn: AnyFn, ...args: unknown[]): unknown => (fn as unknown as (...rest: unknown[]) => unknown)(...args);

/* ------------------------------------------------------------------ the database */

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

const sysRun = (url: string, script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysScalar = (url: string, script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));

/* ------------------------------------------------------------------ staging */

type Person = { userId: string; email: string; cookie: string; tenantId: string };

type Stage = {
  url: string;
  /** The workspace the cases address, and the account that owns it. */
  owner: Person;
  /** A member of BOTH workspaces: their own personal one, and the owner's. */
  guest: Person;
  /** A signed-in account that is a member of the owner's workspace and of no other but its own. */
  stranger: Person;
  handlers: () => Promise<{ GET?: RouteHandler; POST?: RouteHandler }>;
};

let staging: Promise<Stage> | undefined;

const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const url = provisioned.urlMigrate;

    const auth = await productModule<Record<string, unknown>>(AUTH_MODULE);
    const signUp = exported(auth, "signUp", AUTH_MODULE);
    const sessionCookieName = typeof auth["SESSION_COOKIE"] === "string" ? (auth["SESSION_COOKIE"] as string) : "cubit_session";

    const enrol = async (label: string): Promise<Person> => {
      const marker = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
      const email = `${marker}@cubit.test`;
      const answer = (await callFn(signUp, {
        email,
        password: "correct horse battery staple",
        tenantName: `Active ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      })) as { sessionToken?: string };
      expect(typeof answer?.sessionToken, "the sign-up door answers with a session token (R-SPINE-002)").toBe("string");
      const userId = sysScalar(url, `select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
      const tenantId = sysScalar(url, `select ${ident(TENANT_COLUMN)}::text from ${ident(MEMBERSHIPS)} where user_id = ${lit(userId)} limit 1;`);
      return { userId, email, tenantId, cookie: `${sessionCookieName}=${answer.sessionToken ?? ""}` };
    };

    const owner = await enrol("active-owner");
    const guest = await enrol("active-guest");
    const stranger = await enrol("active-stranger");

    // The guest belongs to two workspaces — their own, and the owner's. That is the shape
    // R-SPINE-002 states is ordinary, and the shape an "oldest membership" answer gets wrong.
    sysRun(
      url,
      `insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, ${ident(ROLE_COLUMN)})
         values (${lit(owner.tenantId)}, ${lit(guest.userId)}, ${lit(MEMBER)}) on conflict do nothing;`,
    );

    let routeModule: Promise<Record<string, unknown>> | undefined;
    return {
      url,
      owner,
      guest,
      stranger,
      handlers: async () => (await (routeModule ??= productModule<Record<string, unknown>>(ROUTE_MODULE))) as { GET?: RouteHandler; POST?: RouteHandler },
    };
  })());

/* ------------------------------------------------------------------ the wire */

type WireAnswer = { status: number; raw: string; body: { result?: { data?: unknown }; error?: { data?: Record<string, unknown> } } | undefined };

/** What the shipped router says this procedure is — read off the mount, never guessed. */
async function declaredVerb(path: string): Promise<string> {
  const root = await productModule<{ appRouter?: { _def?: { procedures?: Record<string, { _def?: { type?: string } }> } } }>(ROOT_MODULE);
  const procedures = root.appRouter?._def?.procedures ?? {};
  expect(Object.keys(procedures), `${path} is not mounted on the composed router`).toContain(path);
  return String(procedures[path]?._def?.type ?? "");
}

/** Call one procedure through the shipped route handler, as a browser would, wearing a session. */
async function callProcedure(path: string, input: unknown, cookie: string): Promise<WireAnswer> {
  const stage = await staged();
  const endpoint = `${REQUEST_ORIGIN}/api/trpc/${path}`;
  const params = { params: Promise.resolve({ trpc: [path] }) };
  const headers: Record<string, string> = { cookie, "content-type": "application/json" };

  const answerOf = async (response: Response): Promise<WireAnswer> => {
    const raw = await response.text();
    let body: WireAnswer["body"];
    try {
      const parsed: unknown = JSON.parse(raw);
      body = (Array.isArray(parsed) ? parsed[0] : parsed) as WireAnswer["body"];
    } catch {
      body = undefined;
    }
    return { status: response.status, raw, body };
  };

  const handlers = await stage.handlers();
  if ((await declaredVerb(path)) === "query") {
    const get = handlers.GET;
    expect(typeof get, `${path} is a query, so ${ROUTE_MODULE} owes a GET handler`).toBe("function");
    return answerOf(await (get as RouteHandler)(new Request(`${endpoint}?input=${encodeURIComponent(JSON.stringify(input))}`, { method: "GET", headers }), params));
  }
  const post = handlers.POST;
  expect(typeof post, `${path} is a mutation, so ${ROUTE_MODULE} owes a POST handler`).toBe("function");
  return answerOf(await (post as RouteHandler)(new Request(endpoint, { method: "POST", headers, body: JSON.stringify(input) }), params));
}

const refusalOnTheWire = (answer: WireAnswer): string => String(answer.body?.error?.data?.["refusalCode"] ?? "");

function resultOf(answer: WireAnswer, what: string): unknown[] {
  expect(answer.body?.error, `${what} was refused or faulted: ${answer.raw.slice(0, 500)}`).toBeUndefined();
  const data = answer.body?.result?.data;
  expect(Array.isArray(data), `${what} answered no list of members: ${answer.raw.slice(0, 500)}`).toBe(true);
  return data as unknown[];
}

/** Every membership of a workspace, as the database holds them — the denominator each case reads. */
const rosterOf = (url: string, tenantId: string): string[] =>
  sysRun(url, `select user_id::text from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} order by user_id::text;`).map((row) => row[0] ?? "");

const carries = (entries: unknown[], userId: string): boolean => JSON.stringify(entries).includes(userId);

/* ------------------------------------------------------------------ the cases */

describe("R-SPINE-002 / AC-6: the workspace a tenancy request is answered about is the one it names", () => {
  it("R-SPINE-002: a person in two workspaces is answered about the one they name, not the one they joined first", async () => {
    const stage = await staged();

    const held = rosterOf(stage.url, stage.owner.tenantId);
    expect(held.length, "the owner's workspace holds more than one membership, so the two answers below differ").toBeGreaterThan(1);

    const named = resultOf(await callProcedure(PROC_MEMBERS, { tenantId: stage.owner.tenantId }, stage.guest.cookie), `${PROC_MEMBERS} for the workspace the guest named`);
    expect(named.length, `${PROC_MEMBERS} answers the roster of the NAMED workspace, one entry per membership the store holds`).toBe(held.length);
    expect(carries(named, stage.owner.userId), "and that roster names the workspace's owner, who belongs to no other workspace of the guest's").toBe(true);

    const own = resultOf(await callProcedure(PROC_MEMBERS, { tenantId: stage.guest.tenantId }, stage.guest.cookie), `${PROC_MEMBERS} for the guest's own workspace`);
    expect(own.length, "naming the other workspace they hold answers that one instead — the tenant is the request's, not the account's oldest membership").toBe(
      rosterOf(stage.url, stage.guest.tenantId).length,
    );
    expect(carries(own, stage.owner.userId), "the guest's own workspace does not hold the owner").toBe(false);
  }, 300_000);

  it(`AC-6: a signed-in non-member naming the workspace is refused ${WORKSPACE_PERMISSION_NOT_HELD} on the wire`, async () => {
    const stage = await staged();
    const answered = await callProcedure(PROC_MEMBERS, { tenantId: stage.owner.tenantId }, stage.stranger.cookie);
    expect(
      refusalOnTheWire(answered),
      `a signed-in stranger to a workspace is refused when they name it — never answered a roster of their own instead: ${answered.raw.slice(0, 500)}`,
    ).toBe(WORKSPACE_PERMISSION_NOT_HELD);
  }, 300_000);

  it("R-SPINE-002: a request that names no workspace is answered from the account, where that is unambiguous", async () => {
    const stage = await staged();

    const answered = resultOf(await callProcedure(PROC_MEMBERS, {}, stage.owner.cookie), `${PROC_MEMBERS} with no workspace named`);
    expect(answered.length, "an account that holds one membership is administering that workspace, and is answered its roster").toBe(
      rosterOf(stage.url, stage.owner.tenantId).length,
    );

    // And where it IS ambiguous, nothing is guessed: the guest holds two memberships, so a request
    // naming none names no workspace at all, and is answered as the stranger to it that it is.
    const ambiguous = await callProcedure(PROC_MEMBERS, {}, stage.guest.cookie);
    expect(
      refusalOnTheWire(ambiguous),
      `an account in several workspaces that names none is refused ${WORKSPACE_PERMISSION_NOT_HELD} rather than served whichever membership is oldest: ${ambiguous.raw.slice(0, 500)}`,
    ).toBe(WORKSPACE_PERMISSION_NOT_HELD);
  }, 300_000);
});
