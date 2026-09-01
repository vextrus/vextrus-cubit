/**
 * Public acceptance for inc-010a1a, the law half (AC-3 and AC-6), driven live against a scratch
 * database the committed migrations built (V-DB):
 *
 *   AC-3 — the two-sided, server-held role law at the module seam (R-SPINE-006): who may move whom
 *          and what rank they may grant, the workspace's last-OWNER protection and the self-removal
 *          refusal, what each refusal leaves behind, and the one admitted grant written under a
 *          recorded system reason with no act row beside it. Every guard the clause names is driven
 *          here and observed refusing — a registered code is not a refusing test.
 *   AC-6 — the one guarded wire entry: the three procedures of the test contract, the origin gate
 *          before any role is judged, the tenancyAdmin allowance counted by inc-020's own limiter,
 *          the members read surface, and the role history that goes through the participants
 *          module's one home.
 *
 * Everything is observed through names the increment states in public: the module barrel's exports,
 * the procedure paths of the test contract, the registered refusal codes and the door key appended
 * to AUTH_RATE_LIMITS (B-12). Raw SQL is spoken through psql, never a driver import (SEAM-TENANT).
 * The people are real: each is made through the shipped sign-up door, so every session driven here
 * is a session the product issued.
 *
 * B-19: no roster, count or allowance is frozen. The workspace roles are read from the product's own
 * export, the rate-limit allowance from the exported table, the members answer from the rows the
 * database holds, and the role history from the participants module's own answer.
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so the `@/*` tsconfig alias is
 * never resolved inside them — keep imports between `src/` files relative, as `src/core/db.ts` does.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON, TENANT_COLUMN } from "./support/fixtures";
import { count, ident, lit, run, scalar, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/* ------------------------------------------------------------------ the names the increment states */

const TENANCY_MODULE = "src/modules/spine/tenancy";
const PARTICIPANTS_MODULE = "src/modules/spine/participants";
const DB_MODULE = "src/core/db.ts";
const AUTH_MODULE = "src/server/auth/session.ts";
const RATE_LIMIT_MODULE = "src/server/auth/rate-limit.ts";
const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";
const ROOT_MODULE = "src/server/root.ts";
const TENANCY_ROUTER = "src/server/routers/tenancy.ts";

/** The procedure paths the test contract fixes, and the verbs it fixes them at. */
const PROC_MEMBERS = "spine.tenancy.members";
const PROC_ASSIGN = "spine.tenancy.assignRole";
const PROC_REMOVE = "spine.tenancy.removeMember";

/** The door key appended to AUTH_RATE_LIMITS (interfaces line). */
const TENANCY_DOOR = "tenancyAdmin";

/** The roles, and the tables the law moves and must not move. */
const OWNER = "OWNER";
const ADMIN = "ADMIN";
const MEMBER = "MEMBER";
const MEMBERSHIPS = "memberships";
const ACTS = "acts";
const ATTEMPTS = "auth_attempts";

/** The four codes this node appends, plus the one inc-020 already registered. */
const WORKSPACE_PERMISSION_NOT_HELD = "WORKSPACE_PERMISSION_NOT_HELD";
const SELF_REMOVAL_NOT_ALLOWED = "SELF_REMOVAL_NOT_ALLOWED";
const WORKSPACE_WOULD_HAVE_NO_OWNER = "WORKSPACE_WOULD_HAVE_NO_OWNER";
const ORIGIN_NOT_VERIFIED = "ORIGIN_NOT_VERIFIED";
const RATE_LIMITED = "RATE_LIMITED";

/** The role the participants ledger grants in this file's staging, so a history has something in it. */
const MEASURER = "MEASURER";

/** The reason this suite runs its own system-scoped statements under — attributable, like any other. */
const PROBE_REASON = "test: stage a workspace roster for the tenancy role law";

/** The address this deployment states it answers at is set by the lane's harness; these are the rest. */
const REQUEST_ORIGIN = "http://127.0.0.1";
const FOREIGN_ORIGIN = "https://not-this-deployment.example";

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

function exported(bag: Record<string, unknown>, name: string, home: string): AnyFn {
  expect(typeof bag[name], `${home} must export ${name} — the increment's declared interface`).toBe("function");
  return bag[name] as AnyFn;
}

const callFn = (fn: AnyFn, ...args: unknown[]): unknown => (fn as unknown as (...rest: unknown[]) => unknown)(...args);

/* ------------------------------------------------------------------ refusals, read the one way */

interface RefusalError extends Error {
  refusalCode: string;
}

function property(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const own = (value as Record<string, unknown>)[name];
  if (own !== undefined) return own;
  const cause = (value as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null ? (cause as Record<string, unknown>)[name] : undefined;
}

const isRefusal = (thrown: unknown): thrown is RefusalError => typeof property(thrown, "refusalCode") === "string";

async function refusalFrom(work: () => Promise<unknown> | unknown, what: string): Promise<unknown> {
  try {
    await work();
  } catch (thrown) {
    return thrown;
  }
  expect.fail(`${what} — the seam answered instead of refusing`);
}

/** The code, and the proof that it is one the closed register holds (R-SPINE-062, B-17). */
function refusedWith(thrown: unknown, code: string, what: string): void {
  expect(Object.hasOwn(REFUSALS, code), `${code} must be registered in src/core/errors.ts — the taxonomy is closed (R-SPINE-062, B-17)`).toBe(true);
  expect(refusalCodeOf(thrown), `${what} must be refused ${code}, readable via refusalCodeOf — got ${String(thrown)}`).toBe(code);
  expect(isRefusal(thrown), `${code} must travel as the settled refusal marker`).toBe(true);
}

/* ------------------------------------------------------------------ reading answers, whatever shape they wear */

interface Leaf {
  path: string[];
  text: string;
}

function leavesOf(value: unknown, path: string[] = [], depth = 0): Leaf[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [{ path, text: value }];
  if (typeof value === "number" || typeof value === "boolean") return [{ path, text: String(value) }];
  if (value instanceof Date) return [{ path, text: value.toISOString() }];
  if (Array.isArray(value)) return value.flatMap((held, index) => leavesOf(held, [...path, String(index)], depth + 1));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([key, held]) => leavesOf(held, [...path, key], depth + 1));
  return [];
}

const textOf = (value: unknown): string[] => leavesOf(value).map((leaf) => leaf.text);

/** Does the entry carry a moment — a Date, or a string a Date can be read from? */
const carriesATime = (entry: unknown): boolean => textOf(entry).some((text) => text.length >= 10 && !Number.isNaN(Date.parse(text)));

/* ------------------------------------------------------------------ the database, as the owner reads it */

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

const sysRun = (url: string, script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysScalar = (url: string, script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));
const sysCount = (url: string, script: string): number => count(url, withSession({ [GUC_SYSTEM_REASON]: PROBE_REASON }, script));

/* ------------------------------------------------------------------ staging: real people, real workspaces */

type Person = { userId: string; email: string; cookie: string; tenantId: string };
type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

type Workspace = { tenantId: string; owner: Person; members: Person[] };

type Stage = {
  url: string;
  /** The workspace AC-3's role law is staged in, with an ADMIN and two MEMBERs beside its OWNER. */
  law: Workspace;
  /** A workspace of its own for the origin cases, so their attempts spend nobody else's allowance. */
  origin: Workspace;
  /** And one for the rate limit, plus a bystander whose own allowance must stay untouched. */
  limited: Workspace;
  bystander: Workspace;
  /** A signed-in account that is a member of none of the workspaces above. */
  stranger: Person;
  projectId: string;
  tenancy: () => Promise<Record<string, unknown>>;
  participants: () => Promise<Record<string, unknown>>;
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

    /** One real account, its personal workspace, and this device's session — through the shipped door. */
    const enrol = async (label: string): Promise<Person> => {
      // Lower case throughout: the sign-up door normalises an address before it stores it, so a
      // marker that is not already normalised would not find the row it just made.
      const marker = `${label}-${randomUUID().slice(0, 8)}`.toLowerCase();
      const email = `${marker}@cubit.test`;
      const answer = (await callFn(signUp, {
        email,
        password: "correct horse battery staple",
        tenantName: `Tenancy ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      })) as { sessionToken?: string };
      expect(typeof answer?.sessionToken, "the sign-up door answers with a session token (R-SPINE-002)").toBe("string");
      const userId = sysScalar(url, `select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
      const tenantId = sysScalar(url, `select ${ident(TENANT_COLUMN)}::text from ${ident(MEMBERSHIPS)} where user_id = ${lit(userId)} limit 1;`);
      return { userId, email, tenantId, cookie: `${sessionCookieName}=${answer.sessionToken ?? ""}` };
    };

    /** A workspace: its owner's personal one, joined by however many members the case needs. */
    const workspace = async (label: string, joiners: readonly string[]): Promise<Workspace> => {
      const owner = await enrol(`${label}-owner`);
      const members: Person[] = [];
      for (const joiner of joiners) {
        const person = await enrol(joiner);
        sysRun(
          url,
          `insert into ${ident(MEMBERSHIPS)} (${ident(TENANT_COLUMN)}, user_id, workspace_role)
             values (${lit(owner.tenantId)}, ${lit(person.userId)}, ${lit(MEMBER)}) on conflict do nothing;`,
        );
        members.push(person);
      }
      return { tenantId: owner.tenantId, owner, members };
    };

    // The law's workspace: an ADMIN and two MEMBERs beside the OWNER. Their addresses are staged
    // out of alphabetical order, so an answer that serves them in insertion order is not an
    // ordered answer (AC-6).
    const law = await workspace("law", ["zulu-member", "alpha-member", "bravo-admin"]);
    const admin = law.members[2];
    expect(admin, "the law workspace stages three joiners").toBeDefined();
    sysRun(
      url,
      `update ${ident(MEMBERSHIPS)} set workspace_role = ${lit(ADMIN)}
        where ${ident(TENANT_COLUMN)} = ${lit(law.tenantId)} and user_id = ${lit(admin?.userId ?? "")};`,
    );

    const origin = await workspace("origin", ["origin-member"]);
    const limited = await workspace("limited", ["limited-member"]);
    const bystander = await workspace("bystander", ["bystander-member"]);
    const stranger = await enrol("stranger");

    // A project of the law workspace, with the OWNER standing on it and one MEMBER holding a
    // project role — the history AC-6's memberRoleHistory answers from.
    const projectId = sysScalar(url, `insert into projects (${ident(TENANT_COLUMN)}, name) values (${lit(law.tenantId)}, 'Tenancy law acceptance') returning project_id::text;`);
    const subject = law.members[0];
    sysRun(
      url,
      `insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id) values (${lit(law.tenantId)}, ${lit(projectId)}, ${lit(law.owner.userId)});
       insert into participants (${ident(TENANT_COLUMN)}, project_id, user_id) values (${lit(law.tenantId)}, ${lit(projectId)}, ${lit(subject?.userId ?? "")});
       insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role) values (${lit(law.tenantId)}, ${lit(projectId)}, ${lit(law.owner.userId)}, 'PRINCIPAL');
       insert into participant_roles (${ident(TENANT_COLUMN)}, project_id, user_id, role) values (${lit(law.tenantId)}, ${lit(projectId)}, ${lit(subject?.userId ?? "")}, ${lit(MEASURER)});`,
    );

    let tenancyModule: Promise<Record<string, unknown>> | undefined;
    let participantsModule: Promise<Record<string, unknown>> | undefined;
    let routeModule: Promise<Record<string, unknown>> | undefined;

    return {
      url,
      law,
      origin,
      limited,
      bystander,
      stranger,
      projectId,
      tenancy: () => (tenancyModule ??= productModule<Record<string, unknown>>(TENANCY_MODULE)),
      participants: () => (participantsModule ??= productModule<Record<string, unknown>>(PARTICIPANTS_MODULE)),
      handlers: async () => (await (routeModule ??= productModule<Record<string, unknown>>(ROUTE_MODULE))) as { GET?: RouteHandler; POST?: RouteHandler },
    };
  })());

/** The workspace role one membership reads, and the way a case stages the one it needs. */
const roleOf = (url: string, tenantId: string, userId: string): string =>
  sysScalar(url, `select workspace_role::text from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);

const setRole = (url: string, tenantId: string, userId: string, role: string): void => {
  sysRun(url, `update ${ident(MEMBERSHIPS)} set workspace_role = ${lit(role)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and user_id = ${lit(userId)};`);
};

/** Every byte of one membership row, so "the subject's row is unchanged" is checkable. */
const rowOf = (url: string, tenantId: string, userId: string): string =>
  sysScalar(
    url,
    `select coalesce(md5(string_agg(r::text, '|')), 'no row') from ${ident(MEMBERSHIPS)} r where r.${ident(TENANT_COLUMN)} = ${lit(tenantId)} and r.user_id = ${lit(userId)};`,
  );

/** Every membership of a workspace with the role it holds — what a refusal must leave exactly as it was. */
const rosterOf = (url: string, tenantId: string): string[][] =>
  sysRun(
    url,
    `select user_id::text, workspace_role::text from ${ident(MEMBERSHIPS)}
      where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} order by user_id::text;`,
  );

/** How many of a workspace's memberships hold one role — read back live, so no case assumes its own staging. */
const holdersOf = (url: string, tenantId: string, role: string): number =>
  sysCount(url, `select count(*) from ${ident(MEMBERSHIPS)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)} and workspace_role = ${lit(role)};`);

/** The act rows a workspace holds: a role change writes none (SEAM-ACT), and a refusal writes none either. */
const actsIn = (url: string, tenantId: string): number =>
  sysCount(url, `select count(*) from ${ident(ACTS)} where ${ident(TENANT_COLUMN)} = ${lit(tenantId)};`);

type Actor = { tenantId: string; userId: string };
const actorOf = (workspace: Workspace, person: Person): Actor => ({ tenantId: workspace.tenantId, userId: person.userId });

/** The module's two writing doors, loaded through the barrel the interfaces line names. */
async function doors(): Promise<{ assign: AnyFn; remove: AnyFn; members: AnyFn; history: AnyFn }> {
  const tenancy = await (await staged()).tenancy();
  const home = `${TENANCY_MODULE}/index.ts`;
  return {
    assign: exported(tenancy, "assignWorkspaceRole", home),
    remove: exported(tenancy, "removeMember", home),
    members: exported(tenancy, "membersOf", home),
    history: exported(tenancy, "memberRoleHistory", home),
  };
}

/* ------------------------------------------------------------------ AC-3 */

describe("AC-3: the two-sided role law at the module seam", () => {
  it("AC-3: the barrel exports the surface, and isWorkspaceRole answers for the exported roster", async () => {
    await staged();
    const tenancy = await productModule<Record<string, unknown>>(TENANCY_MODULE);
    const home = `${TENANCY_MODULE}/index.ts`;
    for (const name of ["isWorkspaceRole", "assignWorkspaceRole", "removeMember", "membersOf", "memberRoleHistory", "guardTenancyMutation"]) {
      exported(tenancy, name, home);
    }
    const isWorkspaceRole = exported(tenancy, "isWorkspaceRole", home);
    const db = await productModule<Record<string, unknown>>(DB_MODULE);
    const roster = db["WORKSPACE_ROLES"];
    expect(Array.isArray(roster), `${DB_MODULE} must export WORKSPACE_ROLES — the one roster every guard derives from`).toBe(true);
    for (const role of (roster as unknown[]).map(String)) {
      expect(callFn(isWorkspaceRole, role), `isWorkspaceRole must admit ${role}, which WORKSPACE_ROLES names — one roster, not two (B-17)`).toBe(true);
    }
    expect(callFn(isWorkspaceRole, "SUPERUSER"), "isWorkspaceRole must refuse a role-shaped name the roster does not hold").toBe(false);
  }, 300_000);

  it(`AC-3: an ADMIN demoting an OWNER is refused ${WORKSPACE_PERMISSION_NOT_HELD}, and the OWNER's row is untouched`, async () => {
    const stage = await staged();
    const { assign } = await doors();
    const admin = stage.law.members[2];
    const before = rowOf(stage.url, stage.law.tenantId, stage.law.owner.userId);

    const thrown = await refusalFrom(
      () => callFn(assign, actorOf(stage.law, admin as Person), { subjectUserId: stage.law.owner.userId, role: MEMBER }),
      `an ${ADMIN} demoting an ${OWNER}`,
    );
    refusedWith(thrown, WORKSPACE_PERMISSION_NOT_HELD, `the stripped side of the two-sided guard: an ${ADMIN} may not move an ${OWNER} (R-SPINE-006)`);
    expect(rowOf(stage.url, stage.law.tenantId, stage.law.owner.userId), "a refused assignment leaves the subject's row exactly as it was").toBe(before);
    expect(roleOf(stage.url, stage.law.tenantId, stage.law.owner.userId), `and the ${OWNER} is still the ${OWNER}`).toBe(OWNER);
  }, 300_000);

  it(`AC-3: an ADMIN removing an OWNER is refused ${WORKSPACE_PERMISSION_NOT_HELD}, and the membership survives`, async () => {
    const stage = await staged();
    const { remove } = await doors();
    const admin = stage.law.members[2];
    const before = rowOf(stage.url, stage.law.tenantId, stage.law.owner.userId);

    const thrown = await refusalFrom(
      () => callFn(remove, actorOf(stage.law, admin as Person), { subjectUserId: stage.law.owner.userId }),
      `an ${ADMIN} removing an ${OWNER}`,
    );
    refusedWith(thrown, WORKSPACE_PERMISSION_NOT_HELD, `an ${ADMIN} may neither demote nor remove an ${OWNER} (R-SPINE-006)`);
    expect(rowOf(stage.url, stage.law.tenantId, stage.law.owner.userId), "a refused removal takes no row away").toBe(before);
  }, 300_000);

  it(`AC-3: a MEMBER actor moving anyone is refused ${WORKSPACE_PERMISSION_NOT_HELD}`, async () => {
    const stage = await staged();
    const { assign, remove } = await doors();
    const mover = stage.law.members[0];
    const subject = stage.law.members[1];
    const actor = actorOf(stage.law, mover as Person);
    const before = rowOf(stage.url, stage.law.tenantId, subject?.userId ?? "");

    for (const [what, work] of [
      ["assigning", () => callFn(assign, actor, { subjectUserId: subject?.userId ?? "", role: ADMIN })],
      ["removing", () => callFn(remove, actor, { subjectUserId: subject?.userId ?? "" })],
    ] as const) {
      const thrown = await refusalFrom(work, `a workspace ${MEMBER} ${what} a fellow member`);
      refusedWith(thrown, WORKSPACE_PERMISSION_NOT_HELD, `the actor must hold ${ADMIN} or ${OWNER} to move anybody (R-SPINE-006)`);
    }
    expect(rowOf(stage.url, stage.law.tenantId, subject?.userId ?? ""), "and the subject's row is exactly what it was").toBe(before);
  }, 300_000);

  it(`AC-3: an OWNER granting ${ADMIN} to a ${MEMBER} lands, under a recorded system reason, writing no act row`, async () => {
    const stage = await staged();
    const { assign } = await doors();
    const subject = stage.law.members[1];
    setRole(stage.url, stage.law.tenantId, subject?.userId ?? "", MEMBER);
    const actsBefore = sysCount(stage.url, `select count(*) from ${ident(ACTS)} where ${ident(TENANT_COLUMN)} = ${lit(stage.law.tenantId)};`);

    // SEAM-TENANT: the reason a system handle is opened for is recorded as it is taken. The
    // recorder is the seam's own hook, so what is captured here is what the fault seam would see.
    const db = await productModule<Record<string, unknown>>(DB_MODULE);
    const recordWith = exported(db, "recordSystemReasonsWith", DB_MODULE);
    const reasons: string[] = [];
    callFn(recordWith, (record: { reason?: unknown }) => {
      reasons.push(String(record?.reason ?? ""));
    });
    try {
      await callFn(assign, actorOf(stage.law, stage.law.owner), { subjectUserId: subject?.userId ?? "", role: ADMIN });
    } finally {
      callFn(recordWith, () => undefined);
    }

    expect(roleOf(stage.url, stage.law.tenantId, subject?.userId ?? ""), `an ${OWNER} granting ${ADMIN} to a ${MEMBER} lands, and the row reads ${ADMIN}`).toBe(ADMIN);
    expect(
      sysCount(stage.url, `select count(*) from ${ident(ACTS)} where ${ident(TENANT_COLUMN)} = ${lit(stage.law.tenantId)};`),
      "a workspace role change is not an act on a project, so it writes no act row (SEAM-ACT, out of scope for this node)",
    ).toBe(actsBefore);

    expect(reasons, "the write goes through runAsSystem, whose reason is recorded as the handle is taken (SEAM-TENANT)").not.toEqual([]);
    for (const reason of reasons) {
      expect(reason.trim(), "a recorded reason that is blank attributes nobody").not.toBe("");
    }
    expect(
      reasons.some((reason) => /role|member|tenancy|workspace/i.test(reason)),
      `the recorded reason must attribute this work — none of ${JSON.stringify(reasons)} names the role, the member, the workspace or the tenancy it was opened for (SEAM-TENANT: attributable, never validated-then-discarded)`,
    ).toBe(true);

    setRole(stage.url, stage.law.tenantId, subject?.userId ?? "", MEMBER);
  }, 300_000);

  it(`AC-3: an ${ADMIN} granting ${OWNER} is refused ${WORKSPACE_PERMISSION_NOT_HELD} — the granted side of the guard`, async () => {
    const stage = await staged();
    const { assign } = await doors();
    const admin = stage.law.members[2];
    const subject = stage.law.members[1];
    setRole(stage.url, stage.law.tenantId, subject?.userId ?? "", MEMBER);
    const roster = rosterOf(stage.url, stage.law.tenantId);
    const actsBefore = actsIn(stage.url, stage.law.tenantId);

    // The stripped side is already proven above; this is the other half of "two-sided": the subject
    // outranks nobody, and the refusal is about the rank being handed out (R-SPINE-006).
    const thrown = await refusalFrom(
      () => callFn(assign, actorOf(stage.law, admin as Person), { subjectUserId: subject?.userId ?? "", role: OWNER }),
      `an ${ADMIN} granting ${OWNER} to a ${MEMBER}`,
    );
    refusedWith(thrown, WORKSPACE_PERMISSION_NOT_HELD, `the granted side of the two-sided guard: the actor may not grant a rank above their own (R-SPINE-006)`);
    expect(rosterOf(stage.url, stage.law.tenantId), "a refused grant leaves every membership and every role exactly as it was").toEqual(roster);
    expect(actsIn(stage.url, stage.law.tenantId), "and a refused role change writes no act row (SEAM-ACT)").toBe(actsBefore);
  }, 300_000);

  it(`AC-3: the workspace's only ${OWNER} removing themself is refused ${WORKSPACE_WOULD_HAVE_NO_OWNER}`, async () => {
    const stage = await staged();
    const { remove } = await doors();

    // The precondition is read back live rather than assumed: this workspace holds exactly one
    // OWNER, so the caller is the one whose leaving would empty it.
    expect(holdersOf(stage.url, stage.law.tenantId, OWNER), `the case needs a workspace whose only ${OWNER} is the caller`).toBe(1);
    expect(roleOf(stage.url, stage.law.tenantId, stage.law.owner.userId), `and that one ${OWNER} is the caller`).toBe(OWNER);
    const roster = rosterOf(stage.url, stage.law.tenantId);
    const actsBefore = actsIn(stage.url, stage.law.tenantId);

    const thrown = await refusalFrom(
      () => callFn(remove, actorOf(stage.law, stage.law.owner), { subjectUserId: stage.law.owner.userId }),
      `the workspace's only ${OWNER} removing themself`,
    );
    // This call is both a self-removal and the last OWNER's departure, and the settled guard order
    // judges the workspace's protection first — so the code it answers pins that order too.
    refusedWith(thrown, WORKSPACE_WOULD_HAVE_NO_OWNER, `a workspace may not be left with no ${OWNER}: last-OWNER protection is judged before self-removal (R-SPINE-006, server-held)`);
    expect(rosterOf(stage.url, stage.law.tenantId), "a refused removal takes no membership away and moves no role").toEqual(roster);
    expect(actsIn(stage.url, stage.law.tenantId), "and writes no act row (SEAM-ACT)").toBe(actsBefore);
  }, 300_000);

  it(`AC-3: with a second ${OWNER} standing, an ${OWNER} removing themself is refused ${SELF_REMOVAL_NOT_ALLOWED}`, async () => {
    const stage = await staged();
    const { assign, remove } = await doors();
    const second = stage.law.members[1];

    // The second OWNER is staged through the lawful path — an OWNER granting OWNER, which the rank
    // law admits — so this case stands on the law under test rather than on a hand-written row.
    await callFn(assign, actorOf(stage.law, stage.law.owner), { subjectUserId: second?.userId ?? "", role: OWNER });
    expect(
      holdersOf(stage.url, stage.law.tenantId, OWNER),
      `the lawful grant leaves a second ${OWNER} standing, so last-OWNER protection is not what answers this one`,
    ).toBe(2);
    const roster = rosterOf(stage.url, stage.law.tenantId);
    const actsBefore = actsIn(stage.url, stage.law.tenantId);

    try {
      const thrown = await refusalFrom(
        () => callFn(remove, actorOf(stage.law, stage.law.owner), { subjectUserId: stage.law.owner.userId }),
        `an ${OWNER} removing themself while another ${OWNER} stands`,
      );
      refusedWith(thrown, SELF_REMOVAL_NOT_ALLOWED, "self-removal is a server refusal, never UI hiding (R-SPINE-006)");
      expect(rosterOf(stage.url, stage.law.tenantId), "a refused self-removal takes no membership away and moves no role").toEqual(roster);
      expect(actsIn(stage.url, stage.law.tenantId), "and writes no act row (SEAM-ACT)").toBe(actsBefore);
    } finally {
      // The staging is undone so the workspace this file's later cases read still holds one OWNER.
      setRole(stage.url, stage.law.tenantId, second?.userId ?? "", MEMBER);
    }
  }, 300_000);
});

/* ------------------------------------------------------------------ AC-6: the wire */

type WireAnswer = { status: number; raw: string; body: { result?: { data?: unknown }; error?: { data?: Record<string, unknown> } } | undefined };

/** Call one procedure through the shipped route handler, as a browser would, wearing a session. */
async function callProcedure(path: string, input: unknown, cookie: string, origin?: string): Promise<WireAnswer> {
  const stage = await staged();
  const endpoint = `${REQUEST_ORIGIN}/api/trpc/${path}`;
  const params = { params: Promise.resolve({ trpc: [path] }) };
  const headers: Record<string, string> = { cookie, "content-type": "application/json" };
  if (origin !== undefined) headers["origin"] = origin;

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
  const verb = await declaredVerb(path);
  if (verb === "query") {
    const get = handlers.GET;
    expect(typeof get, `${path} is a query, so ${ROUTE_MODULE} owes a GET handler`).toBe("function");
    return answerOf(await (get as RouteHandler)(new Request(`${endpoint}?input=${encodeURIComponent(JSON.stringify(input))}`, { method: "GET", headers }), params));
  }
  const post = handlers.POST;
  expect(typeof post, `${path} is a mutation, so ${ROUTE_MODULE} owes a POST handler`).toBe("function");
  return answerOf(await (post as RouteHandler)(new Request(endpoint, { method: "POST", headers, body: JSON.stringify(input) }), params));
}

/** What the shipped router says this procedure is — read off the mount, never guessed. */
async function declaredVerb(path: string): Promise<string> {
  const root = await productModule<{ appRouter?: { _def?: { procedures?: Record<string, { _def?: { type?: string } }> } } }>(ROOT_MODULE);
  const procedures = root.appRouter?._def?.procedures ?? {};
  expect(Object.keys(procedures), `${path} is not mounted on the composed router (the test contract's procedures)`).toContain(path);
  return String(procedures[path]?._def?.type ?? "");
}

/** The refusal code a wire answer carries, or the empty string when it answered instead. */
const refusalOnTheWire = (answer: WireAnswer): string => String(answer.body?.error?.data?.["refusalCode"] ?? "");

function resultOf(answer: WireAnswer, what: string): unknown {
  expect(answer.body?.error, `${what} was refused or faulted: ${answer.raw.slice(0, 500)}`).toBeUndefined();
  const data = answer.body?.result?.data;
  expect(data, `${what} answered no data: ${answer.raw.slice(0, 500)}`).toBeDefined();
  return data;
}

describe("AC-6: the one guarded wire entry", () => {
  it("AC-6: the three procedures are mounted under spine.tenancy at the verbs the contract fixes", async () => {
    await staged();
    expect(await declaredVerb(PROC_MEMBERS), `${PROC_MEMBERS} is a query`).toBe("query");
    expect(await declaredVerb(PROC_ASSIGN), `${PROC_ASSIGN} is a mutation`).toBe("mutation");
    expect(await declaredVerb(PROC_REMOVE), `${PROC_REMOVE} is a mutation`).toBe("mutation");
  }, 300_000);

  it("AC-6: the lane's router instantiates the one guard once, and compares no origin of its own", async () => {
    const router = join(REPO_ROOT, TENANCY_ROUTER);
    expect(existsSync(router), `${TENANCY_ROUTER} is owed — it is where guardTenancyMutation is instantiated, exactly once`).toBe(true);
    const source = readFileSync(router, "utf8");
    const instantiations = source.split("guardTenancyMutation(").length - 1;
    expect(instantiations, `${TENANCY_ROUTER} must call guardTenancyMutation exactly once — one guarded entry, instantiated once, with inc-020's machinery injected (ARCH-02, B-17)`).toBe(1);
    const comparing = source
      .split("\n")
      .filter((line) => /origin/i.test(line) && /[!=]==?/.test(line))
      .map((line) => line.trim());
    expect(
      comparing,
      `${TENANCY_ROUTER} compares an origin itself — the Origin rule's one home is src/modules/spine/tenancy/guard/**, and a transport-local copy is a second answer to a question that has one (ARCH-02, B-17)`,
    ).toEqual([]);
  }, 300_000);

  it(`AC-6: an Origin the deployment does not answer at is refused ${ORIGIN_NOT_VERIFIED}, before any role is judged`, async () => {
    const stage = await staged();
    const subject = stage.origin.members[0];
    // The very same call the next case drives: were the origin gate not first, the role law would
    // answer this one, because a sole OWNER may not demote themself.
    const answered = await callProcedure(PROC_ASSIGN, { subjectUserId: stage.origin.owner.userId, role: MEMBER }, stage.origin.owner.cookie, FOREIGN_ORIGIN);
    expect(Object.hasOwn(REFUSALS, ORIGIN_NOT_VERIFIED), `${ORIGIN_NOT_VERIFIED} must be registered in src/core/errors.ts`).toBe(true);
    expect(
      refusalOnTheWire(answered),
      `a cookie-authenticated mutation stating an Origin that matches neither the request's own origin nor the configured one is refused ${ORIGIN_NOT_VERIFIED}, before any role is judged (R-SPINE-006): ${answered.raw.slice(0, 500)}`,
    ).toBe(ORIGIN_NOT_VERIFIED);

    // And nothing moved: the refusal is answered ahead of the work, not after it.
    expect(roleOf(stage.url, stage.origin.tenantId, stage.origin.owner.userId), "a refused mutation moves no role").toBe(OWNER);
    expect(roleOf(stage.url, stage.origin.tenantId, subject?.userId ?? ""), "and no other row either").toBe(MEMBER);
  }, 300_000);

  it("AC-6: a request stating no Origin, or one the deployment does answer at, passes the origin gate", async () => {
    const stage = await staged();
    const configured = process.env["CUBIT_PUBLIC_ORIGIN"]?.trim() ?? "";
    expect(configured, "the lane's harness names the address this deployment answers at, which is the origin the gate admits").not.toBe("");

    for (const [what, origin] of [
      ["stating no Origin at all", undefined],
      ["stating the request's own origin", REQUEST_ORIGIN],
      ["stating the origin the deployment is configured with", new URL(configured).origin],
    ] as const) {
      const answered = await callProcedure(PROC_ASSIGN, { subjectUserId: stage.origin.owner.userId, role: MEMBER }, stage.origin.owner.cookie, origin);
      expect(
        refusalOnTheWire(answered),
        `a mutation ${what} passes the origin gate — an absent Origin proceeds, and a matching one is a match (R-SPINE-006): ${answered.raw.slice(0, 500)}`,
      ).not.toBe(ORIGIN_NOT_VERIFIED);
    }
  }, 300_000);

  it(`AC-6: mutations past the ${TENANCY_DOOR} allowance are refused ${RATE_LIMITED}, counted by the one limiter and keyed on the account`, async () => {
    const stage = await staged();
    const limits = await productModule<Record<string, unknown>>(RATE_LIMIT_MODULE);
    const table = limits["AUTH_RATE_LIMITS"] as Record<string, { attempts?: number }> | undefined;
    expect(table, `${RATE_LIMIT_MODULE} must export AUTH_RATE_LIMITS — the one home of every door's allowance`).toBeDefined();
    const allowance = table?.[TENANCY_DOOR]?.attempts;
    expect(
      typeof allowance === "number" && Number.isInteger(allowance) && allowance > 0,
      `AUTH_RATE_LIMITS must gain the door key "${TENANCY_DOOR}" with an allowance — R-SPINE-006's "tenant-admin actions carry rate limits", counted by the limiter that already exists (ARCH-02, B-17)`,
    ).toBe(true);
    const spend = allowance ?? 0;

    const subject = stage.limited.members[0];
    const cookie = stage.limited.owner.cookie;
    const attemptsBefore = sysCount(stage.url, `select count(*) from ${ident(ATTEMPTS)} where door = ${lit(TENANCY_DOOR)};`);

    // Every attempt is a real change, alternating the subject's role, so nothing is refused for
    // asking for what is already the case. The allowance is the exported number, never a literal.
    for (let attempt = 0; attempt < spend; attempt += 1) {
      const answered = await callProcedure(PROC_ASSIGN, { subjectUserId: subject?.userId ?? "", role: attempt % 2 === 0 ? ADMIN : MEMBER }, cookie);
      expect(
        refusalOnTheWire(answered),
        `attempt ${attempt + 1} of an allowance of ${spend} must not be refused — the allowance is what the exported table states: ${answered.raw.slice(0, 500)}`,
      ).not.toBe(RATE_LIMITED);
    }
    const past = await callProcedure(PROC_ASSIGN, { subjectUserId: subject?.userId ?? "", role: ADMIN }, cookie);
    expect(
      refusalOnTheWire(past),
      `the attempt past the ${TENANCY_DOOR} allowance of ${spend} is refused ${RATE_LIMITED}: ${past.raw.slice(0, 500)}`,
    ).toBe(RATE_LIMITED);

    expect(
      sysCount(stage.url, `select count(*) from ${ident(ATTEMPTS)} where door = ${lit(TENANCY_DOOR)};`),
      `the attempts are counted in ${ATTEMPTS} under the door key — inc-020's admitAttempt is the one counting home, and guard/** keeps no counter of its own (ARCH-02, B-17)`,
    ).toBeGreaterThan(attemptsBefore);

    // Keyed on the session's server-derived account id: another account's allowance is its own.
    const bystanderSubject = stage.bystander.members[0];
    const other = await callProcedure(PROC_ASSIGN, { subjectUserId: bystanderSubject?.userId ?? "", role: ADMIN }, stage.bystander.owner.cookie);
    expect(
      refusalOnTheWire(other),
      `one account spending its allowance must not spend another's — the count is keyed on the id the session resolved to: ${other.raw.slice(0, 500)}`,
    ).not.toBe(RATE_LIMITED);
  }, 600_000);
});

/* ------------------------------------------------------------------ AC-6: the read surface */

describe("AC-6: the members read surface", () => {
  it("AC-6: members serves each member's id, identity as presented, workspace role and created_at, ordered by code point", async () => {
    const stage = await staged();
    const answered = resultOf(await callProcedure(PROC_MEMBERS, {}, stage.law.owner.cookie), PROC_MEMBERS);
    expect(Array.isArray(answered), `${PROC_MEMBERS} answers the workspace's members as a list: ${JSON.stringify(answered)}`).toBe(true);
    const entries = answered as unknown[];

    // The denominator is the database's, never a frozen number.
    const held = sysRun(
      stage.url,
      `select m.user_id::text, m.workspace_role::text, u.email
         from ${ident(MEMBERSHIPS)} m join users u on u.user_id = m.user_id
        where m.${ident(TENANT_COLUMN)} = ${lit(stage.law.tenantId)};`,
    );
    expect(entries.length, "one entry per membership of the workspace").toBe(held.length);

    const people = [stage.law.owner, ...stage.law.members];
    for (const row of held) {
      const userId = row[0] ?? "";
      const role = row[1] ?? "";
      const storedKey = row[2] ?? "";
      const presented = people.find((who) => who.userId === userId)?.email ?? "";
      const entry = entries.find((named) => textOf(named).includes(userId));
      expect(entry, `${PROC_MEMBERS} names no member ${userId}: ${JSON.stringify(entries)}`).toBeDefined();
      expect(textOf(entry), `the entry for ${userId} carries the workspace role the store holds`).toContain(role);
      expect(carriesATime(entry), `the entry for ${userId} carries the moment the membership was created: ${JSON.stringify(entry)}`).toBe(true);
      expect(
        textOf(entry),
        `the entry for ${userId} carries the account's identity as it was presented (${presented}): ${JSON.stringify(entry)}`,
      ).toContain(presented);
      if (storedKey !== presented) {
        // `users.email` holds the KEY the address is stored under, which the fold tags. A surface
        // that renders the column raw paints the tag at the person; the identity is read back
        // through the fold's own home, never re-derived here (B-17).
        expect(
          textOf(entry),
          `the entry for ${userId} carries the raw stored key (${storedKey}) — the key an account is stored under is not an address anybody presented: ${JSON.stringify(entry)}`,
        ).not.toContain(storedKey);
      }
    }

    // Ordered by code point: the answer is sorted, ascending, on some fact it serves — which fact
    // is the Builder's to choose, but a list in no order at all is not an order (never localeCompare).
    const paths = new Map<string, string[]>();
    for (const entry of entries) {
      for (const leaf of leavesOf(entry)) {
        const key = leaf.path.join(".");
        paths.set(key, [...(paths.get(key) ?? []), leaf.text]);
      }
    }
    const ascending = [...paths.entries()].filter(
      ([, values]) => values.length === entries.length && new Set(values).size === values.length && values.every((value, index) => index === 0 || (values[index - 1] ?? "") < value),
    );
    expect(
      ascending.map(([key]) => key),
      `${PROC_MEMBERS} answers in no code-point order at all — no field it serves is strictly ascending across ${JSON.stringify(entries)}`,
    ).not.toEqual([]);
  }, 300_000);

  it(`AC-6: memberRoleHistory answers through the participants module's one history home, and a non-member is refused ${WORKSPACE_PERMISSION_NOT_HELD} on both reads`, async () => {
    const stage = await staged();
    const { members, history } = await doors();
    const subject = stage.law.members[0];
    const owner = actorOf(stage.law, stage.law.owner);

    const answered = await callFn(history, owner, subject?.userId ?? "");
    expect(Array.isArray(answered), `memberRoleHistory answers a member's project-role history as a list: ${JSON.stringify(answered)}`).toBe(true);
    const entries = answered as unknown[];
    expect(textOf(entries), `it names the project role the ledger granted the member`).toContain(MEASURER);
    expect(textOf(entries), `and the project it was granted on`).toContain(stage.projectId);

    // The one home: whatever the participants module says about this member on this project is
    // what this answer carries — no second history is derived here (ARCH-02, B-17).
    const participants = await stage.participants();
    const roleHistory = exported(participants, "roleHistory", `${PARTICIPANTS_MODULE}/index.ts`);
    const projectHistory = (await callFn(roleHistory, { ...owner, actorKind: "human" }, { projectId: stage.projectId })) as unknown[];
    const aboutSubject = projectHistory.filter((entry) => textOf(entry).includes(subject?.userId ?? ""));
    expect(aboutSubject.length, "the participants module's own answer says something about this member, so the comparison is not empty").toBeGreaterThan(0);
    expect(entries.length, "memberRoleHistory answers exactly what the participants module's history home holds about that member").toBe(aboutSubject.length);

    const outsider = { tenantId: stage.law.tenantId, userId: stage.stranger.userId };
    for (const [what, work] of [
      ["the members list", () => callFn(members, outsider)],
      ["a member's role history", () => callFn(history, outsider, subject?.userId ?? "")],
    ] as const) {
      const thrown = await refusalFrom(work, `a signed-in non-member of the workspace reading ${what}`);
      refusedWith(thrown, WORKSPACE_PERMISSION_NOT_HELD, `a signed-in stranger to the workspace is refused ${what} (R-SPINE-006, server-held)`);
    }
  }, 300_000);
});
