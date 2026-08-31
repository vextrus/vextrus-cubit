/**
 * Which workspace a tenancy request is about (R-SPINE-002, AC-6, B-17), driven through the shipped
 * route handler with real session cookies.
 *
 * The test contract fixes the three procedures' inputs exactly — `members` takes "no input beyond
 * session/tenant context", `assignRole` takes `{ subjectUserId, role }`, `removeMember` takes
 * `{ subjectUserId }` — so the workspace a call administers is never a value the caller wrote. It is
 * derived from the session, and by ONE derivation: the shell's `earliestWorkspaceOf`, which is what
 * already answers "which workspace is this signed-in account in" for the frame. A second answer in
 * the tenancy lane would be a second home for a cross-cutting question (B-17, ARCH-02), and the two
 * could disagree about the same session — the frame rendering one workspace while the lane
 * administered another.
 *
 * So this file proves the two halves that follow from that: the roster served is the roster of the
 * workspace the shell's own derivation names, and a `tenantId` written into the request body is not
 * a lever — it moves nothing, because no procedure reads it.
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
const SHELL_MODULE = "src/server/shell/workspace.ts";

const PROC_MEMBERS = "spine.tenancy.members";
const MEMBERSHIPS = "memberships";
const ROLE_COLUMN = "workspace_role";
const MEMBER = "MEMBER";

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

    // The guest belongs to two workspaces — their own, and the owner's. That is the shape
    // R-SPINE-002 states is ordinary, and the shape a caller-stated tenant would let them address.
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

/** The shell's derivation — the one home of "which workspace is this account in" (B-17). */
async function shellWorkspaceOf(userId: string): Promise<string> {
  await staged();
  const shell = await productModule<Record<string, unknown>>(SHELL_MODULE);
  const derive = exported(shell, "earliestWorkspaceOf", SHELL_MODULE);
  const answered = (await callFn(derive, userId)) as { tenantId?: string } | null;
  return String(answered?.tenantId ?? "");
}

/* ------------------------------------------------------------------ the cases */

describe("R-SPINE-002 / AC-6 / B-17: the workspace a tenancy request is answered about is derived, never stated", () => {
  it("B-17: the roster served is the roster of the workspace the shell's one derivation names", async () => {
    const stage = await staged();

    const derived = await shellWorkspaceOf(stage.owner.userId);
    expect(derived, "the shell answers a workspace for a signed-in account — the lane must not need a second answer").not.toBe("");

    const held = rosterOf(stage.url, derived);
    expect(held.length, "the derived workspace holds more than one membership, so a roster of the wrong workspace would differ in length").toBeGreaterThan(1);

    const served = resultOf(await callProcedure(PROC_MEMBERS, undefined, stage.owner.cookie), `${PROC_MEMBERS} for the owner's session`);
    expect(served.length, `${PROC_MEMBERS} answers the roster of the workspace the shell derives, one entry per membership the store holds`).toBe(held.length);
    for (const memberId of held) {
      expect(carries(served, memberId), `the served roster names every membership the derived workspace holds (${memberId})`).toBe(true);
    }
  }, 300_000);

  it("R-SPINE-002: a person in two workspaces is answered about the one the session derives, and the frame agrees", async () => {
    const stage = await staged();

    const held = rosterOf(stage.url, stage.owner.tenantId);
    expect(held, "the guest holds a membership of the owner's workspace too — the ordinary many-tenants shape").toContain(stage.guest.userId);

    // One question, one answer: the lane and the shell frame are looking at the same session, so
    // whichever workspace the derivation names, both are about that one. A lane that derived its
    // own could render one workspace in the frame while administering another (B-17, ARCH-02).
    const derived = await shellWorkspaceOf(stage.guest.userId);
    expect(rosterOf(stage.url, derived), "the derived workspace is one the guest actually holds a membership of").toContain(stage.guest.userId);

    const served = resultOf(await callProcedure(PROC_MEMBERS, undefined, stage.guest.cookie), `${PROC_MEMBERS} for the guest's session`);
    expect(served.length, "the guest is answered the roster of the derived workspace, not of whichever workspace they hold most memberships near").toBe(
      rosterOf(stage.url, derived).length,
    );
  }, 300_000);

  it("the contract's inputs are the whole surface: a tenantId written into the body moves nothing", async () => {
    const stage = await staged();

    // `members` takes "no input beyond session/tenant context". A caller who writes somebody else's
    // workspace id into the body is therefore not naming a workspace at all — the field is read by
    // no procedure, so the answer is the same one the session already derived. Were it read, this
    // case would serve the owner's roster to the guest and the two lengths below would differ.
    const derived = await shellWorkspaceOf(stage.guest.userId);
    const own = rosterOf(stage.url, derived);
    const other = rosterOf(stage.url, stage.owner.tenantId);
    expect(own.length, "the two workspaces differ in size, so a body that moved the answer would be visible here").not.toBe(other.length);

    const stated = resultOf(
      await callProcedure(PROC_MEMBERS, { tenantId: stage.owner.tenantId }, stage.guest.cookie),
      `${PROC_MEMBERS} with another workspace's id written into the body`,
    );
    expect(stated.length, "stating a workspace on the wire grants nothing and addresses nothing — the answer is the session's own").toBe(own.length);
  }, 300_000);
});
