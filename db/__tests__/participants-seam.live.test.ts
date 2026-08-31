/**
 * Public acceptance for inc-012-participants, driven live against a scratch database the committed
 * migrations built (V-DB):
 *
 *   AC-1 — ASSIGN_PARTICIPANT_ROLE's `direction`, the appended withdrawal, and the last PRINCIPAL.
 *   AC-3 — `roleHistory`'s one seam guard: who may read a project's role history, and how a
 *          stranger is refused (the read-path PERMISSION_NOT_HELD that names no act type).
 *   AC-4 — the tRPC act pair under `spine.participants`, driven through the shipped route handler
 *          with a real session cookie, reaching the one seam.
 *
 * Everything is observed through names the increment states in public: the act seam's barrel, the
 * participants module's barrel, the procedure paths of the test contract, the declared columns of
 * `participant_role_withdrawals` and the registered refusal codes (B-12).
 *
 * Raw SQL is spoken through psql, never a driver import — SEAM-TENANT's ban binds this file like
 * the rest of the tree. The people are real: each is made through the shipped sign-up door, so the
 * sessions AC-4 drives with are sessions the product itself issued.
 *
 * B-19: no roster, count or key set is frozen. The history's length is derived from the grants and
 * withdrawals the database holds; the entry shape is graded on COVERAGE of the facts AC-3 names,
 * never on a spelling; and the OWNER/ADMIN limb arms itself from the schema rather than assuming a
 * workspace-role column this tree does not yet declare — the limb arms the moment one lands, which
 * is what inc-010a1a's column does; its arrival is also why the staging below states the role its
 * joiners join under (B-20, see WORKSPACE_MEMBER).
 *
 * NOTE FOR THE BUILDER: product modules are loaded by absolute path, so the `@/*` tsconfig alias is
 * never resolved inside them — keep imports between `src/` files relative, as `src/core/db.ts` does.
 */
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { AUDIT_REASON, GUC_SYSTEM_REASON, SEED_REASON } from "./support/fixtures";
import { count, ident, lit, run, scalar, withSession } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");

/* ------------------------------------------------------------------ the names the increment states */

/** The seam barrel (SEAM-ACT) and the module barrel the increment's interfaces name. */
const ACTS_MODULE = "src/core/acts/index.ts";
const PARTICIPANTS_MODULE = "src/modules/spine/participants";
const ROUTE_MODULE = "src/app/api/trpc/[trpc]/route.ts";

/** The act type, the roles and the two directions. */
const ASSIGN_PARTICIPANT_ROLE = "ASSIGN_PARTICIPANT_ROLE";
const PRINCIPAL = "PRINCIPAL";
const MEASURER = "MEASURER";
const REVIEWER = "REVIEWER";
const GRANT = "GRANT";
const WITHDRAW = "WITHDRAW";

/**
 * The workspace role a joiner states at insert (B-20, inc-010a1a).
 *
 * `memberships.workspace_role` arrived with R-SPINE-003's roles, DEFAULT 'OWNER' — the default that
 * serves R-SPINE-002's "every user gets a personal tenant at sign-up" without touching the sign-up
 * transaction. It also backfills every row this file's staging wrote without a role, which would
 * make the colleague and the stranger workspace OWNERs of a workspace they merely joined. AC-3's
 * refusing limb below (a signed-in member of the workspace who does not participate) would then be
 * a red no lawful actor could clear, because the guard's OWNER/ADMIN limb — reserved for that
 * increment and armed by it — would rightly admit them. Stating the role at insert is the whole
 * re-baseline: a person who joins somebody else's workspace joins it as a MEMBER.
 */
const WORKSPACE_MEMBER = "MEMBER";

/** The permission L-ACT-03 makes PRINCIPAL-only, and the refusal codes this increment leans on. */
const ADMINISTER_PROJECT = "ADMINISTER_PROJECT";
const PERMISSION_NOT_HELD = "PERMISSION_NOT_HELD";
const CONSEQUENCES_NOT_CARRIED = "CONSEQUENCES_NOT_CARRIED";
const PROJECT_WOULD_HAVE_NO_PRINCIPAL = "PROJECT_WOULD_HAVE_NO_PRINCIPAL";

/** The tables, and the withdrawal columns the increment's interfaces declare. */
const ACTS = "acts";
const PARTICIPANT_ROLES = "participant_roles";
const WITHDRAWALS = "participant_role_withdrawals";
const WITHDRAWAL_COLUMNS = ["tenant_id", "withdrawal_id", "grant_id", "project_id", "user_id", "role", "act_id", "withdrawn_at"] as const;

/** The procedure paths the test contract fixes. */
const PROC_HISTORY = "spine.participants.roleHistory";
const PROC_PREVIEW = "spine.participants.assignRolePreview";
const PROC_COMMIT = "spine.participants.assignRole";

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

/** One declared export, refused as absent rather than called as undefined. */
function exported(bag: Record<string, unknown>, name: string, home: string): AnyFn {
  expect(typeof bag[name], `${home} must export ${name} — the increment's declared interface`).toBe("function");
  return bag[name] as AnyFn;
}

const callFn = (fn: AnyFn, ...args: unknown[]): unknown => (fn as unknown as (...rest: unknown[]) => unknown)(...args);

/* ------------------------------------------------------------------ the seam's values, as data */

type ActorCtx = { tenantId: string; userId: string; actorKind: "human" };
type AssignInput = { type: string; projectId: string; subjectUserId: string; role: string; direction?: string };
type ConsequenceSubject = { subjectId?: unknown; before?: unknown; after?: unknown };
type ConsequenceValue = { subjects?: unknown };

const ctxFor = (tenantId: string, userId: string): ActorCtx => ({ tenantId, userId, actorKind: "human" });

const assign = (projectId: string, subjectUserId: string, role: string, direction?: string): AssignInput =>
  direction === undefined ? { type: ASSIGN_PARTICIPANT_ROLE, projectId, subjectUserId, role } : { type: ASSIGN_PARTICIPANT_ROLE, projectId, subjectUserId, role, direction };

/** The subject the Consequence names, read past whatever else it carries. */
function subjectOf(consequence: unknown, subjectId: string): { before: string[]; after: string[] } {
  const subjects = (consequence as ConsequenceValue | null)?.subjects;
  expect(Array.isArray(subjects), `a Consequence names the subjects it judges (L-ACT-02); got ${JSON.stringify(consequence)}`).toBe(true);
  const named = (subjects as ConsequenceSubject[]).find((subject) => subject.subjectId === subjectId);
  expect(named, `the Consequence names no subject ${subjectId}: ${JSON.stringify(consequence)}`).toBeDefined();
  const before = named?.before;
  const after = named?.after;
  expect(Array.isArray(before) && Array.isArray(after), "a subject of a Consequence carries the roles it holds before and after").toBe(true);
  return { before: (before as string[]).map(String), after: (after as string[]).map(String) };
}

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

/** Run the work, require it to refuse, and hand back what it threw. */
async function refusalFrom(work: () => Promise<unknown> | unknown, what: string): Promise<unknown> {
  try {
    await work();
  } catch (thrown) {
    return thrown;
  }
  expect.fail(`${what} — the seam answered instead of refusing`);
}

/** The code, and the proof that it is one the closed register holds (B-17, R-SPINE-062). */
function refusedWith(thrown: unknown, code: string, what: string): void {
  expect(Object.hasOwn(REFUSALS, code), `${code} must be registered in src/core/errors.ts — the taxonomy is closed (R-SPINE-062, B-17)`).toBe(true);
  expect(refusalCodeOf(thrown), `${what} must be refused ${code}, readable via refusalCodeOf — got ${String(thrown)}`).toBe(code);
  expect(isRefusal(thrown), `${code} must travel as the settled refusal marker`).toBe(true);
}

/* ------------------------------------------------------------------ the database, as the owner reads it */

let scratch: ScratchDb | undefined;

afterAll(async () => {
  await scratch?.drop();
});

const sysRun = (url: string, script: string): string[][] => run(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, script));
const sysScalar = (url: string, script: string): string => scalar(url, withSession({ [GUC_SYSTEM_REASON]: SEED_REASON }, script));
const sysCount = (url: string, script: string): number => count(url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, script));

/** How many rows a table holds for one project — the number a refusal must not move. */
function rowsFor(url: string, table: string, projectId: string): number {
  return sysCount(url, `select count(*) from ${ident(table)} where project_id = ${lit(projectId)};`);
}

/** Every byte of every row this table holds for one project, so "nothing was rewritten" is checkable. */
function fingerprint(url: string, table: string, projectId: string): string {
  return sysScalar(url, `select md5(coalesce(string_agg(r::text, '|' order by r::text), '')) from ${ident(table)} r where r.project_id = ${lit(projectId)};`);
}

/** Every role granted to a person on a project, as the grant ledger holds it (grants, not effective roles). */
function grantedRoles(url: string, projectId: string, userId: string): string[] {
  return sysRun(url, `select role::text from ${ident(PARTICIPANT_ROLES)} where project_id = ${lit(projectId)} and user_id = ${lit(userId)} order by 1;`).map((row) => row[0] ?? "");
}

/* ------------------------------------------------------------------ staging: real people, one workspace */

type Person = { userId: string; email: string; cookie: string };

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response>;

type Stage = {
  url: string;
  tenantId: string;
  principal: Person;
  colleague: Person;
  stranger: Person;
  projectId: string;
  preview: AnyFn;
  commit: AnyFn;
  consequenceDigest: (consequence: unknown) => string;
  /** Loaded on first use, so a criterion that needs neither is judged on its own merits. */
  participants: () => Promise<Record<string, unknown>>;
  handlers: () => Promise<{ GET?: RouteHandler; POST?: RouteHandler }>;
  sessionCookieName: string;
};

let staging: Promise<Stage> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
const staged = (): Promise<Stage> =>
  (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    process.env["DATABASE_URL"] = provisioned.urlApp;
    const url = provisioned.urlMigrate;

    const auth = await productModule<Record<string, unknown>>("src/server/auth/session.ts");
    const signUp = exported(auth, "signUp", "src/server/auth/session.ts");
    const sessionCookieName = typeof auth["SESSION_COOKIE"] === "string" ? (auth["SESSION_COOKIE"] as string) : "cubit_session";

    /** One real account, through the shipped door: the user, its workspace and this device's session. */
    const enrol = async (label: string): Promise<Person> => {
      const marker = `${label}-${randomUUID().slice(0, 8)}`;
      const email = `inc012-${marker}@cubit.test`;
      const answer = (await callFn(signUp, {
        email,
        password: "correct horse battery staple",
        tenantName: `Participants ${marker}`,
        deviceLabel: "acceptance",
        origin: "https://cubit.example",
        requestId: randomUUID(),
      })) as { sessionToken?: string };
      expect(typeof answer?.sessionToken, "the sign-up door answers with a session token (R-SPINE-002)").toBe("string");
      const userId = sysScalar(url, `select user_id::text from users where email like ${lit(`%${marker}%`)} limit 1;`);
      return { userId, email, cookie: `${sessionCookieName}=${answer.sessionToken ?? ""}` };
    };

    const principal = await enrol("principal");
    const colleague = await enrol("colleague");
    const stranger = await enrol("stranger");

    const tenantId = sysScalar(url, `select tenant_id::text from memberships where user_id = ${lit(principal.userId)} limit 1;`);
    // One workspace, three members: the colleague and the stranger join the principal's tenant, so
    // "another signed-in member of the tenant" is a real person rather than an outsider (AC-3).
    for (const person of [colleague, stranger]) {
      sysRun(
        url,
        `insert into memberships (tenant_id, user_id, workspace_role) values (${lit(tenantId)}, ${lit(person.userId)}, ${lit(WORKSPACE_MEMBER)}) on conflict do nothing;`,
      );
    }

    // A project of that workspace, its creator installed as PRINCIPAL exactly as project creation
    // installs one (L-ACT-03), and the colleague attached with no role at all.
    const projectId = sysScalar(url, `insert into projects (tenant_id, name) values (${lit(tenantId)}, 'Participants acceptance') returning project_id::text;`);
    sysRun(
      url,
      `insert into participants (tenant_id, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(principal.userId)});
       insert into participants (tenant_id, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(colleague.userId)});
       insert into ${ident(PARTICIPANT_ROLES)} (tenant_id, project_id, user_id, role) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(principal.userId)}, ${lit(PRINCIPAL)});`,
    );

    const acts = await productModule<Record<string, unknown>>(ACTS_MODULE);
    let participantsModule: Promise<Record<string, unknown>> | undefined;
    let routeModule: Promise<Record<string, unknown>> | undefined;

    return {
      url,
      tenantId,
      principal,
      colleague,
      stranger,
      projectId,
      preview: exported(acts, "preview", ACTS_MODULE),
      commit: exported(acts, "commit", ACTS_MODULE),
      consequenceDigest: exported(acts, "consequenceDigest", ACTS_MODULE) as unknown as (consequence: unknown) => string,
      participants: () => (participantsModule ??= productModule<Record<string, unknown>>(PARTICIPANTS_MODULE)),
      handlers: async () => (await (routeModule ??= productModule<Record<string, unknown>>(ROUTE_MODULE))) as { GET?: RouteHandler; POST?: RouteHandler },
      sessionCookieName,
    };
  })());

/** A fresh project of the same workspace, with `holders` installed as PRINCIPAL — one scene per case. */
async function scene(holders: readonly string[], others: readonly string[] = []): Promise<string> {
  const { url, tenantId } = await staged();
  const projectId = sysScalar(url, `insert into projects (tenant_id, name) values (${lit(tenantId)}, 'Participants scene') returning project_id::text;`);
  for (const userId of [...holders, ...others]) {
    sysRun(url, `insert into participants (tenant_id, project_id, user_id) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}) on conflict do nothing;`);
  }
  for (const userId of holders) {
    sysRun(url, `insert into ${ident(PARTICIPANT_ROLES)} (tenant_id, project_id, user_id, role) values (${lit(tenantId)}, ${lit(projectId)}, ${lit(userId)}, ${lit(PRINCIPAL)});`);
  }
  return projectId;
}

/* ------------------------------------------------------------------ AC-1 */

describe("AC-1: the act's direction, and the withdrawal it appends", () => {
  it("AC-1: an input with no direction still grants — the pre-existing behaviour is the default", async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const ctx = ctxFor(stage.tenantId, stage.principal.userId);
    const input = assign(projectId, stage.colleague.userId, REVIEWER);

    const consequence = await callFn(stage.preview, ctx, input);
    const subject = subjectOf(consequence, stage.colleague.userId);
    expect(subject.before, `an absent direction means ${GRANT}, so the subject does not hold ${REVIEWER} yet`).not.toContain(REVIEWER);
    expect(subject.after, `an absent direction means ${GRANT} (AC-1)`).toContain(REVIEWER);

    await callFn(stage.commit, ctx, input, stage.consequenceDigest(consequence));
    expect(grantedRoles(stage.url, projectId, stage.colleague.userId), "the grant lands in participant_roles exactly as it did before this increment").toEqual([REVIEWER]);
    expect(rowsFor(stage.url, WITHDRAWALS, projectId), "a grant appends no withdrawal").toBe(0);
  }, 300_000);

  it(`AC-1: a ${WITHDRAW} preview drops the role from the subject's after list`, async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const ctx = ctxFor(stage.tenantId, stage.principal.userId);

    const granted = assign(projectId, stage.colleague.userId, MEASURER, GRANT);
    await callFn(stage.commit, ctx, granted, stage.consequenceDigest(await callFn(stage.preview, ctx, granted)));

    const consequence = await callFn(stage.preview, ctx, assign(projectId, stage.colleague.userId, MEASURER, WITHDRAW));
    const subject = subjectOf(consequence, stage.colleague.userId);
    expect(subject.before, `the subject holds ${MEASURER} before the withdrawal`).toContain(MEASURER);
    expect(subject.after, `a ${WITHDRAW} preview answers an after list that no longer holds the role (AC-1)`).not.toContain(MEASURER);
    expect(rowsFor(stage.url, WITHDRAWALS, projectId), "a preview writes nothing (L-ACT-02)").toBe(0);
  }, 300_000);

  it(`AC-1: a ${WITHDRAW} commit appends exactly one withdrawal row and rewrites no grant`, async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const ctx = ctxFor(stage.tenantId, stage.principal.userId);

    const granted = assign(projectId, stage.colleague.userId, MEASURER, GRANT);
    await callFn(stage.commit, ctx, granted, stage.consequenceDigest(await callFn(stage.preview, ctx, granted)));

    const grantsBefore = fingerprint(stage.url, PARTICIPANT_ROLES, projectId);
    const grantRows = rowsFor(stage.url, PARTICIPANT_ROLES, projectId);
    const withdrawalsBefore = rowsFor(stage.url, WITHDRAWALS, projectId);

    const withdrawal = assign(projectId, stage.colleague.userId, MEASURER, WITHDRAW);
    await callFn(stage.commit, ctx, withdrawal, stage.consequenceDigest(await callFn(stage.preview, ctx, withdrawal)));

    expect(rowsFor(stage.url, WITHDRAWALS, projectId), `a withdrawal appends exactly one row to ${WITHDRAWALS} (AC-1)`).toBe(withdrawalsBefore + 1);
    expect(rowsFor(stage.url, PARTICIPANT_ROLES, projectId), `${PARTICIPANT_ROLES} rows are never deleted — the ledger is append-only`).toBe(grantRows);
    expect(fingerprint(stage.url, PARTICIPANT_ROLES, projectId), `${PARTICIPANT_ROLES} rows are never updated — a withdrawal is a countermanding row, not an edit`).toBe(grantsBefore);
    expect(grantedRoles(stage.url, projectId, stage.colleague.userId), "the grant that was countermanded is still on the record").toContain(MEASURER);

    // The appended row names the withdrawal, in the columns the increment declares.
    const appended = sysRun(
      stage.url,
      `select ${WITHDRAWAL_COLUMNS.map((column) => `${ident(column)}::text`).join(", ")} from ${ident(WITHDRAWALS)} where project_id = ${lit(projectId)};`,
    )[0];
    expect(appended, `${WITHDRAWALS} must carry the columns the increment declares: ${WITHDRAWAL_COLUMNS.join(", ")}`).toBeDefined();
    const row = Object.fromEntries(WITHDRAWAL_COLUMNS.map((column, index) => [column, appended?.[index] ?? ""]));
    expect(row["user_id"], "the withdrawal names the subject it countermands").toBe(stage.colleague.userId);
    expect(row["role"], "the withdrawal names the role it countermands").toBe(MEASURER);
    expect(row["tenant_id"], "the withdrawal is owned by the workspace the act moved").toBe(stage.tenantId);
    expect(String(row["grant_id"] ?? ""), "the withdrawal points at the grant it countermands").not.toBe("");
    expect(
      sysCount(stage.url, `select count(*) from ${ident(PARTICIPANT_ROLES)} where grant_id = ${lit(String(row["grant_id"] ?? ""))} and role = ${lit(MEASURER)};`),
      "the withdrawal's grant_id is a grant of that very role",
    ).toBe(1);

    // The effective reading, from the seam itself: a fresh preview of the same grant sees a subject
    // who no longer holds it, which is what "grants minus withdrawals" means (AC-1).
    const after = subjectOf(await callFn(stage.preview, ctx, assign(projectId, stage.colleague.userId, MEASURER, GRANT)), stage.colleague.userId);
    expect(after.before, "the subject's effective roles shrank by the withdrawal").not.toContain(MEASURER);
  }, 300_000);

  it("AC-1: a withdrawn role stops carrying its permissions at the next check", async () => {
    const stage = await staged();
    // Two PRINCIPALs, so the withdrawal below is lawful and what it proves is the permission check.
    const projectId = await scene([stage.principal.userId, stage.colleague.userId]);
    const admin = ctxFor(stage.tenantId, stage.principal.userId);
    const colleague = ctxFor(stage.tenantId, stage.colleague.userId);

    // The colleague can perform the act while they hold PRINCIPAL — the control the case needs.
    await callFn(stage.preview, colleague, assign(projectId, stage.principal.userId, REVIEWER, GRANT));

    const withdrawal = assign(projectId, stage.colleague.userId, PRINCIPAL, WITHDRAW);
    await callFn(stage.commit, admin, withdrawal, stage.consequenceDigest(await callFn(stage.preview, admin, withdrawal)));

    const thrown = await refusalFrom(
      () => callFn(stage.preview, colleague, assign(projectId, stage.principal.userId, REVIEWER, GRANT)),
      `a person whose ${PRINCIPAL} was withdrawn performing ${ASSIGN_PARTICIPANT_ROLE}`,
    );
    refusedWith(thrown, PERMISSION_NOT_HELD, "an effective role the ledger has countermanded bundles nothing (L-ACT-03)");
    expect(property(thrown, "permission"), `${PERMISSION_NOT_HELD} carries the missing permission`).toBe(ADMINISTER_PROJECT);
  }, 300_000);

  it(`AC-1: withdrawing the last effective ${PRINCIPAL} is refused ${PROJECT_WOULD_HAVE_NO_PRINCIPAL}, previewing and committing`, async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const ctx = ctxFor(stage.tenantId, stage.principal.userId);
    const input = assign(projectId, stage.principal.userId, PRINCIPAL, WITHDRAW);

    const actsBefore = rowsFor(stage.url, ACTS, projectId);
    const withdrawalsBefore = rowsFor(stage.url, WITHDRAWALS, projectId);

    // The digest carried at commit is arbitrary on purpose: the seam recomputes the Consequence
    // inside the writing transaction before it compares digests, so a guard that stands at all
    // stands here — and a commit answered CONSEQUENCES_NOT_CARRIED would mean the project's last
    // PRINCIPAL was protected only by the preview the actor happened to run.
    for (const [what, work] of [
      ["previewing", () => callFn(stage.preview, ctx, input)],
      ["committing", () => callFn(stage.commit, ctx, input, "0".repeat(64))],
    ] as const) {
      const thrown = await refusalFrom(work, `${what} a withdrawal that would leave the project with no ${PRINCIPAL}`);
      refusedWith(thrown, PROJECT_WOULD_HAVE_NO_PRINCIPAL, `${what} the withdrawal of a project's last ${PRINCIPAL} (R-SPINE-011, L-ACT-03)`);
    }

    expect(rowsFor(stage.url, ACTS, projectId), "a refused withdrawal writes no act row").toBe(actsBefore);
    expect(rowsFor(stage.url, WITHDRAWALS, projectId), "a refused withdrawal appends nothing").toBe(withdrawalsBefore);

    // The control: with a second effective PRINCIPAL standing, the very same withdrawal commits —
    // so the refusal above is the last-PRINCIPAL guard and not a seam that cannot withdraw at all.
    const shared = await scene([stage.principal.userId, stage.colleague.userId]);
    const lawful = assign(shared, stage.principal.userId, PRINCIPAL, WITHDRAW);
    await callFn(stage.commit, ctx, lawful, stage.consequenceDigest(await callFn(stage.preview, ctx, lawful)));
    expect(rowsFor(stage.url, WITHDRAWALS, shared), "a withdrawal that leaves a PRINCIPAL standing commits").toBe(1);
  }, 300_000);
});

/* ------------------------------------------------------------------ AC-3 */

/** Every string a history entry carries, however deeply it nests it. */
function textOf(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (value instanceof Date) return [value.toISOString()];
  if (Array.isArray(value)) return value.flatMap((held) => textOf(held, depth + 1));
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap((held) => textOf(held, depth + 1));
  return [];
}

/** Does the entry name this person — by the id the store holds, or by the address it reads back? */
function names(entry: unknown, person: Person): boolean {
  const text = textOf(entry).join("").toLowerCase();
  return text.includes(person.userId.toLowerCase()) || text.includes(person.email.split("@")[0]?.toLowerCase() ?? person.email.toLowerCase());
}

/** Does the entry carry a moment — a Date, or a string a Date can be read from? */
function carriesATime(entry: unknown): boolean {
  return textOf(entry).some((text) => text.length >= 10 && !Number.isNaN(Date.parse(text)));
}

/** Does this ONE string name this person, rather than the entry's whole flattened bag? */
function mentions(text: string, person: Person): boolean {
  const lower = text.toLowerCase();
  return lower.includes(person.userId.toLowerCase()) || lower.includes(person.email.split("@")[0]?.toLowerCase() ?? person.email.toLowerCase());
}

/** One leaf of an answer, carried with the path of key names it was found under. */
interface Leaf {
  path: string[];
  text: string;
}

/** The same walk `textOf` does, keeping the field names — so a value can be judged by where it sits. */
function leavesOf(value: unknown, path: string[] = [], depth = 0): Leaf[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [{ path, text: value }];
  if (typeof value === "number" || typeof value === "boolean") return [{ path, text: String(value) }];
  if (value instanceof Date) return [{ path, text: value.toISOString() }];
  if (Array.isArray(value)) return value.flatMap((held, index) => leavesOf(held, [...path, String(index)], depth + 1));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([key, held]) => leavesOf(held, [...path, key], depth + 1));
  return [];
}

/**
 * A field that says it holds the SUBJECT of the act, and one that says it holds who ACTED.
 *
 * AC-3 puts two different people in one entry, "the subject user" and "the acting user's identity",
 * and which is which is a fact about the FIELD and never about the bag: an entry built with the two
 * transposed still carries both people, and a search over the entry's flattened text cannot tell the
 * two implementations apart. Nothing but the field's own name can. So the entry is required to say
 * which is which, in the vocabulary this criterion, the act input (`subjectUserId`) and the screen's
 * Design Decision (line one the subject's label, line two "by {actor}") already use. Any spelling
 * carrying the word is accepted, at any depth: `subjectUserId`, `subject.userId`, `subjectUser.email`
 * — and `actor…`, `acting…`, `actedBy…`, `performedBy…` for the other. `actId`/`actType` are neither.
 */
const A_SUBJECT_FIELD = (segment: string): boolean => segment.toLowerCase().includes("subject");
const AN_ACTOR_FIELD = (segment: string): boolean => {
  const key = segment.toLowerCase();
  return key.includes("actor") || key.includes("acting") || key.includes("actedby") || key.includes("performedby") || key === "by" || key.startsWith("byuser");
};

/**
 * AC-3's identity half, bound field-to-role. Membership is not enough: an entry that labelled the
 * actor as the subject would hold both people and still have mislabelled who did what to whom.
 */
function bindsSubjectAndActor(entry: unknown, subject: Person, actor: Person, what: string): void {
  const leaves = leavesOf(entry);
  const shown = JSON.stringify(entry);
  const forSubject = leaves.filter((leaf) => mentions(leaf.text, subject));
  const forActor = leaves.filter((leaf) => mentions(leaf.text, actor));
  const at = (found: Leaf[]): string[] => found.map((leaf) => leaf.path.join("."));

  expect(at(forSubject), `${what} names the subject the role moved on or off: ${shown}`).not.toEqual([]);
  expect(at(forActor), `${what} names the acting user's identity: ${shown}`).not.toEqual([]);
  expect(at(forSubject).filter((path) => at(forActor).includes(path)), `${what} keeps subject and actor in separate fields, never in one: ${shown}`).toEqual([]);

  expect(
    forSubject.some((leaf) => leaf.path.some(A_SUBJECT_FIELD)),
    `${what} carries the subject under a field that names the subject (a path segment holding "subject"); the subject is at [${at(forSubject).join(", ")}] in ${shown}`,
  ).toBe(true);
  expect(
    forActor.some((leaf) => leaf.path.some(A_SUBJECT_FIELD)),
    `${what} must not stand the ACTING user in the subject field — a transposed pair is exactly what this asserts against: ${shown}`,
  ).toBe(false);
  expect(
    forActor.some((leaf) => leaf.path.some(AN_ACTOR_FIELD)),
    `${what} carries the acting user under a field that names the actor ("actor"/"acting…"/"actedBy…"/"performedBy…"); the actor is at [${at(forActor).join(", ")}] in ${shown}`,
  ).toBe(true);
  expect(forSubject.some((leaf) => leaf.path.some(AN_ACTOR_FIELD)), `${what} must not stand the SUBJECT in the actor field: ${shown}`).toBe(false);
}

async function callHistory(participants: Record<string, unknown>, ctx: ActorCtx, projectId: string): Promise<unknown> {
  const door = exported(participants, "roleHistory", `${PARTICIPANTS_MODULE}/index.ts`);
  try {
    return await callFn(door, ctx, { projectId });
  } catch (thrown) {
    // A refusal is an answer, and is never retried in another shape. Only a door that takes its
    // subject positionally is tried the other way — the criterion is about WHO may read the
    // history, never about which of two spellings the argument wears.
    if (isRefusal(thrown)) throw thrown;
    return await callFn(door, ctx, projectId);
  }
}

describe("AC-3: the project's role history, behind one guard", () => {
  it("AC-3: a participant reads every grant and every withdrawal, newest last", async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const ctx = ctxFor(stage.tenantId, stage.principal.userId);

    const granted = assign(projectId, stage.colleague.userId, MEASURER, GRANT);
    await callFn(stage.commit, ctx, granted, stage.consequenceDigest(await callFn(stage.preview, ctx, granted)));
    const withdrawn = assign(projectId, stage.colleague.userId, MEASURER, WITHDRAW);
    await callFn(stage.commit, ctx, withdrawn, stage.consequenceDigest(await callFn(stage.preview, ctx, withdrawn)));

    const history = await callHistory(await stage.participants(), ctx, projectId);
    expect(Array.isArray(history), "roleHistory answers the project's history as a list").toBe(true);
    const entries = history as unknown[];

    // The denominator is the ledger's, never a frozen number: one entry per grant and per withdrawal.
    const expected = rowsFor(stage.url, PARTICIPANT_ROLES, projectId) + rowsFor(stage.url, WITHDRAWALS, projectId);
    expect(entries.length, "one entry per grant and per withdrawal (AC-3)").toBe(expected);

    for (const entry of entries) {
      const text = textOf(entry);
      expect(text.some((value) => value === GRANT || value === WITHDRAW), `every entry names its direction: ${JSON.stringify(entry)}`).toBe(true);
      expect(carriesATime(entry), `every entry says when it occurred: ${JSON.stringify(entry)}`).toBe(true);
    }

    const last = entries[entries.length - 1];
    expect(textOf(last), `newest last: the withdrawal just committed is the final entry — got ${JSON.stringify(entries)}`).toContain(WITHDRAW);
    expect(textOf(last), "and it names the role it moved").toContain(MEASURER);
    expect(names(last, stage.colleague), "the entry names the subject the role was withdrawn from").toBe(true);
    expect(names(last, stage.principal), "the entry names the acting user's identity").toBe(true);

    // Membership in the entry is the weak half: both people are present whichever way round the
    // fields were filled. This is the half that binds — the subject stands in the subject's field
    // and the actor in the actor's, so a transposed pair fails (AC-3: "the subject user" and "the
    // acting user's identity" are two different facts, not one bag of names).
    bindsSubjectAndActor(last, stage.colleague, stage.principal, "the withdrawal entry");

    const grantEntries = entries.filter((entry) => textOf(entry).includes(GRANT));
    expect(grantEntries.length, "the grants are on the record too").toBe(rowsFor(stage.url, PARTICIPANT_ROLES, projectId));
  }, 300_000);

  it(`AC-3: a signed-in member of the workspace who does not participate is refused ${PERMISSION_NOT_HELD}, naming no act type`, async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId]);

    const thrown = await refusalFrom(
      async () => callHistory(await stage.participants(), ctxFor(stage.tenantId, stage.stranger.userId), projectId),
      "reading the role history as a workspace member who neither participates nor owns the workspace",
    );
    refusedWith(thrown, PERMISSION_NOT_HELD, "the read path's one guard (L-ACT-03)");
    expect(property(thrown, "permission"), `the read-path ${PERMISSION_NOT_HELD} names the missing permission`).toBe(ADMINISTER_PROJECT);
    expect(property(thrown, "actType") ?? null, "a read has no act type to name, and that is lawful (L-ACT-03)").toBe(null);
  }, 300_000);

  it("AC-3: a workspace owner or admin who does not participate reads it too — armed by the schema, never assumed", async () => {
    const stage = await staged();
    const participants = await stage.participants();
    const projectId = await scene([stage.principal.userId]);

    // The limb arms itself: R-SPINE-003's workspace roles (OWNER, ADMIN, MEMBER) have not shipped,
    // and `memberships` carries no role column while that is true. So this case asserts the limb
    // where the tree can express it, and asserts the reason it cannot where it cannot (B-19) —
    // the moment a workspace-role column lands, this becomes a live proof without an edit.
    const roleColumn = sysRun(
      stage.url,
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'memberships' and column_name like '%role%' order by 1;`,
    ).map((row) => row[0] ?? "")[0];

    if (roleColumn === undefined) {
      expect(
        sysCount(stage.url, `select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'memberships' and column_name like '%role%';`),
        "no workspace-role column exists, so the OWNER/ADMIN limb of the guard has nothing to read — the reading recorded by the projects lifecycle guard",
      ).toBe(0);
      // The control, so this case is never a pass by absence: the door itself answers a caller who
      // does stand on the project, which is the half of the guard this tree can express.
      const held = await callHistory(participants, ctxFor(stage.tenantId, stage.principal.userId), projectId);
      expect(Array.isArray(held), "a participant reads the project's role history (AC-3)").toBe(true);
      return;
    }

    sysRun(stage.url, `update memberships set ${ident(roleColumn)} = 'OWNER' where user_id = ${lit(stage.stranger.userId)} and tenant_id = ${lit(stage.tenantId)};`);
    const history = await callHistory(participants, ctxFor(stage.tenantId, stage.stranger.userId), projectId);
    expect(Array.isArray(history), "a workspace OWNER who does not participate still reads the project's role history (AC-3)").toBe(true);
  }, 300_000);
});

/* ------------------------------------------------------------------ AC-4 */

type WireAnswer = { status: number; raw: string; body: { result?: { data?: unknown }; error?: { data?: Record<string, unknown> } } | undefined };

/** Call one procedure through the shipped route handler, as a browser would, wearing a session. */
async function callProcedure(stage: Stage, path: string, input: unknown, cookie: string): Promise<WireAnswer> {
  const endpoint = `http://127.0.0.1/api/trpc/${path}`;
  const params = { params: Promise.resolve({ trpc: [path] }) };
  const headers = { cookie, "content-type": "application/json" };

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
  const get = handlers.GET;
  const post = handlers.POST;
  expect(typeof get === "function" || typeof post === "function", `${ROUTE_MODULE} must export a route handler`).toBe(true);

  // A query is answered over GET and a mutation over POST, and which of the two each half of the
  // act pair is, is the Builder's to decide — so the verb is read off the mounted procedure itself
  // rather than guessed. A commit is never sent twice: only the GET attempt (which, being a query,
  // moves nothing) is ever retried the other way.
  const root = await productModule<{ appRouter?: { _def?: { procedures?: Record<string, { _def?: { type?: string } }> } } }>("src/server/root.ts");
  const declaredType = root.appRouter?._def?.procedures?.[path]?._def?.type;
  const overGet = async (): Promise<WireAnswer> =>
    answerOf(await (get as RouteHandler)(new Request(`${endpoint}?input=${encodeURIComponent(JSON.stringify(input))}`, { method: "GET", headers }), params));
  const overPost = async (): Promise<WireAnswer> => {
    expect(typeof post, `${path} is answered over POST, so ${ROUTE_MODULE} owes a POST handler`).toBe("function");
    return answerOf(await (post as RouteHandler)(new Request(endpoint, { method: "POST", headers, body: JSON.stringify(input) }), params));
  };

  if (declaredType === "query" && typeof get === "function") {
    const answered = await overGet();
    if (answered.body?.error === undefined || typeof post !== "function") return answered;
    return overPost();
  }
  return overPost();
}

function resultOf(answer: WireAnswer, what: string): Record<string, unknown> {
  expect(answer.body?.error, `${what} was refused or faulted: ${answer.raw.slice(0, 500)}`).toBeUndefined();
  const data = answer.body?.result?.data;
  expect(data, `${what} answered no data: ${answer.raw.slice(0, 500)}`).toBeDefined();
  return (typeof data === "object" && data !== null ? data : { value: data }) as Record<string, unknown>;
}

describe("AC-4: the act pair on the wire, reaching the one seam", () => {
  it("AC-4: appRouter mounts roleHistory, assignRolePreview and assignRole under spine.participants", async () => {
    await staged();
    const root = await productModule<{ appRouter?: { _def?: { procedures?: Record<string, unknown> } } }>("src/server/root.ts");
    const paths = Object.keys(root.appRouter?._def?.procedures ?? {});
    expect(paths, "appRouter exposes no procedures at all").not.toHaveLength(0);
    for (const procedure of [PROC_HISTORY, PROC_PREVIEW, PROC_COMMIT]) {
      expect(paths, `${procedure} is mounted on the composed router (the test contract's procedures)`).toContain(procedure);
    }
  }, 300_000);

  it("AC-4: assignRolePreview answers { consequence, consequenceDigest } — the seam's own digest", async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const input = assign(projectId, stage.colleague.userId, REVIEWER, GRANT);

    const answered = resultOf(await callProcedure(stage, PROC_PREVIEW, { input }, stage.principal.cookie), PROC_PREVIEW);
    expect(answered["consequence"], `${PROC_PREVIEW} answers the Consequence the seam computed`).toBeDefined();
    expect(typeof answered["consequenceDigest"], `${PROC_PREVIEW} answers the digest beside it`).toBe("string");
    expect(
      answered["consequenceDigest"],
      "the digest is src/core/acts' consequenceDigest of that very consequence — one home, no transport-local digest (B-17, ARCH-02)",
    ).toBe(stage.consequenceDigest(answered["consequence"]));
    expect(subjectOf(answered["consequence"], stage.colleague.userId).after, "and the consequence is the one the input asks for").toContain(REVIEWER);
  }, 300_000);

  it("AC-4: assignRole commits and answers the written act's id", async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const input = assign(projectId, stage.colleague.userId, REVIEWER, GRANT);

    const previewed = resultOf(await callProcedure(stage, PROC_PREVIEW, { input }, stage.principal.cookie), PROC_PREVIEW);
    const digest = String(previewed["consequenceDigest"]);
    const committed = resultOf(await callProcedure(stage, PROC_COMMIT, { input, consequenceDigest: digest }, stage.principal.cookie), PROC_COMMIT);

    const actId = textOf(committed).find((value) => sysCount(stage.url, `select count(*) from ${ident(ACTS)} where act_id::text = ${lit(value)};`) === 1);
    expect(actId, `${PROC_COMMIT} answers the id of the act it wrote — got ${JSON.stringify(committed)}`).toBeDefined();
    expect(sysScalar(stage.url, `select consequence_digest from ${ident(ACTS)} where act_id::text = ${lit(actId ?? "")};`), "the act row carries the digest the commit carried").toBe(digest);
    expect(grantedRoles(stage.url, projectId, stage.colleague.userId), "and the state change landed with it").toContain(REVIEWER);
  }, 300_000);

  it(`AC-4: a digest the current state no longer produces is refused ${CONSEQUENCES_NOT_CARRIED}, and writes nothing`, async () => {
    const stage = await staged();
    const projectId = await scene([stage.principal.userId], [stage.colleague.userId]);
    const asReviewer = assign(projectId, stage.colleague.userId, REVIEWER, GRANT);
    const asMeasurer = assign(projectId, stage.colleague.userId, MEASURER, GRANT);

    const stale = String(resultOf(await callProcedure(stage, PROC_PREVIEW, { input: asReviewer }, stage.principal.cookie), PROC_PREVIEW)["consequenceDigest"]);

    // The intervening act moves exactly the state the stale digest bound.
    const fresh = resultOf(await callProcedure(stage, PROC_PREVIEW, { input: asMeasurer }, stage.principal.cookie), PROC_PREVIEW);
    resultOf(await callProcedure(stage, PROC_COMMIT, { input: asMeasurer, consequenceDigest: String(fresh["consequenceDigest"]) }, stage.principal.cookie), PROC_COMMIT);

    const actsBefore = rowsFor(stage.url, ACTS, projectId);
    const grantsBefore = fingerprint(stage.url, PARTICIPANT_ROLES, projectId);

    const refused = await callProcedure(stage, PROC_COMMIT, { input: asReviewer, consequenceDigest: stale }, stage.principal.cookie);
    expect(Object.hasOwn(REFUSALS, CONSEQUENCES_NOT_CARRIED), `${CONSEQUENCES_NOT_CARRIED} is registered in src/core/errors.ts`).toBe(true);
    expect(refused.body?.error?.data?.["refusalCode"], `a stale digest is answered as the registered refusal: ${refused.raw.slice(0, 500)}`).toBe(CONSEQUENCES_NOT_CARRIED);
    expect(rowsFor(stage.url, ACTS, projectId), "a refused commit writes no act row").toBe(actsBefore);
    expect(fingerprint(stage.url, PARTICIPANT_ROLES, projectId), "and no state change").toBe(grantsBefore);
  }, 300_000);
});
