/**
 * Which workspace a tenancy request is about (R-SPINE-002, AC-6, B-17), driven through the shipped
 * route handler with real session cookies.
 *
 * The test contract fixes the three procedures' inputs exactly — `members` takes "no input beyond
 * session/tenant context", `assignRole` takes `{ subjectUserId, role }`, `removeMember` takes
 * `{ subjectUserId }` — so the workspace a call administers is never a value the caller wrote. It is
 * the account's own: the membership it held FIRST, which is the same membership the signed-in frame
 * puts a name to, so a roster served is the roster of the workspace the person is looking at.
 *
 * Every expectation here is staged, never asked of the product: the cases know which workspace each
 * account joined first because this file put them there in that order (and reads the two `created_at`
 * back to prove the staging held), and they know what each roster contains because they read it out
 * of the database. A lane that answered the NEWEST membership, or another workspace entirely, serves
 * a different roster than the one staged — which is the whole point of staging a person into two
 * workspaces of different sizes (B-19: derive the denominator, never restate the implementation).
 *
 * So this file proves the two halves that follow: the roster served is the roster of the account's
 * first workspace, and a `tenantId` written into the request body is not a lever — it moves nothing,
 * because no procedure reads it.
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
const JOINED_COLUMN = "created_at";
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

/**
 * Did this account join `earlier` before it joined `later`? The staging's own ordering, read back out
 * of the rows rather than assumed — the two memberships are written by two different doors, and the
 * case that rests on which came first says so out loud.
 */
const joinedFirst = (url: string, userId: string, earlier: string, later: string): string =>
  sysScalar(
    url,
    `select (first.${ident(JOINED_COLUMN)} < second.${ident(JOINED_COLUMN)})::text
       from ${ident(MEMBERSHIPS)} first, ${ident(MEMBERSHIPS)} second
      where first.user_id = ${lit(userId)} and first.${ident(TENANT_COLUMN)} = ${lit(earlier)}
        and second.user_id = ${lit(userId)} and second.${ident(TENANT_COLUMN)} = ${lit(later)};`,
  );

/* ------------------------------------------------------------------ the cases */

describe("R-SPINE-002 / AC-6 / B-17: the workspace a tenancy request is answered about is the account's own", () => {
  it("the roster served is the roster of the workspace the session's account belongs to", async () => {
    const stage = await staged();

    // The owner holds exactly one membership — the workspace sign-up made them, which the staging
    // then put a second person into. So the roster this session is owed is that workspace's, read
    // out of the database rather than counted here.
    const held = rosterOf(stage.url, stage.owner.tenantId);
    expect(held, "the owner belongs to the workspace their sign-up created").toContain(stage.owner.userId);
    expect(held, "the guest was staged into the owner's workspace, so a roster of the wrong workspace is a shorter one").toContain(stage.guest.userId);

    const served = resultOf(await callProcedure(PROC_MEMBERS, undefined, stage.owner.cookie), `${PROC_MEMBERS} for the owner's session`);
    expect(served.length, `${PROC_MEMBERS} answers one entry per membership the owner's workspace holds`).toBe(held.length);
    for (const memberId of held) {
      expect(carries(served, memberId), `the served roster names every membership that workspace holds (${memberId})`).toBe(true);
    }
  }, 300_000);

  it("R-SPINE-002: a person in two workspaces is answered about the one they joined first", async () => {
    const stage = await staged();

    // The ordinary many-tenants shape, staged in a known order: the guest's own workspace came with
    // their sign-up, and the owner's workspace was joined afterwards. The rows are asked to confirm
    // that ordering, because the expectation below rests on it.
    expect(rosterOf(stage.url, stage.owner.tenantId), "the guest holds a membership of the owner's workspace too").toContain(stage.guest.userId);
    expect(
      joinedFirst(stage.url, stage.guest.userId, stage.guest.tenantId, stage.owner.tenantId),
      "the guest joined their own workspace before the owner's — the staging this case rests on",
    ).toBe("true");

    const own = rosterOf(stage.url, stage.guest.tenantId);
    const other = rosterOf(stage.url, stage.owner.tenantId);
    expect(own.length, "the two workspaces differ in size, so answering the wrong one is visible in the count").not.toBe(other.length);
    expect(other, "the owner is a member of the owner's workspace and of no other — the marker of a wrong answer").toContain(stage.owner.userId);

    const served = resultOf(await callProcedure(PROC_MEMBERS, undefined, stage.guest.cookie), `${PROC_MEMBERS} for the guest's session`);
    expect(served.length, "the guest is answered the roster of the workspace they joined first, not of the one they joined later").toBe(own.length);
    expect(carries(served, stage.guest.userId), "the roster served to the guest names the guest").toBe(true);
    expect(carries(served, stage.owner.userId), "the owner appears only in the later-joined workspace, so naming them means the wrong workspace was served").toBe(
      false,
    );
  }, 300_000);

  it("the contract's inputs are the whole surface: a tenantId written into the body moves nothing", async () => {
    const stage = await staged();

    // `members` takes "no input beyond session/tenant context". A caller who writes somebody else's
    // workspace id into the body is therefore not naming a workspace at all — and this caller is a
    // member of the workspace they name, so a procedure that read the field and honoured it for
    // members would answer the owner's roster here. It answers the session's own instead.
    const own = rosterOf(stage.url, stage.guest.tenantId);
    const stated = resultOf(
      await callProcedure(PROC_MEMBERS, { tenantId: stage.owner.tenantId }, stage.guest.cookie),
      `${PROC_MEMBERS} with another workspace's id written into the body`,
    );

    expect(stated.length, "stating a workspace on the wire grants nothing and addresses nothing — the answer is the session's own").toBe(own.length);
    expect(carries(stated, stage.guest.userId), "the answer is the guest's own workspace, which names the guest").toBe(true);
    expect(carries(stated, stage.owner.userId), "the stated workspace's other member is absent, so the stated field moved nothing").toBe(false);
  }, 300_000);
});
