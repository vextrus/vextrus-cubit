/**
 * Public acceptance for the identity core's one door (R-SPINE-001/002/007/062, V-DB): AC-1, AC-2,
 * AC-3 and AC-5, against a self-provisioned, migrated scratch database — the same harness every
 * other live suite runs on.
 *
 * The procedures are driven the way the increment's interfaces declare: `appRouter.createCaller`
 * composed with `createContext({ req })`, with an authenticated call presenting
 * `Cookie: cubit_session=<token>` on that Request. Product modules are loaded by absolute path, so a
 * module the Builder has not written yet fails as an assertion naming the file rather than killing
 * collection. Raw SQL is spoken through psql, never a driver import (SEAM-TENANT binds this file
 * like the rest of the tree), and as the bootstrap superuser, so a policy on an identity table can
 * never make a probe silently read or write nothing.
 *
 * Nothing here transcribes a schema (B-19). The identity tables are named by the interfaces, but
 * their columns are not: a row is found by rendering it with `to_jsonb` and looking for the value
 * the scenario itself minted, so a Builder who spells the account's key `user_id` and one who
 * spells it `id` are judged by the same cases. Every account is minted with a fresh address, so no
 * case can pass or fail on another's rows.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { ident, lit, run, scalar } from "./support/live-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the increment's interfaces name. */
const SESSION_MODULE = "src/server/auth/session.ts";
const MAIL_MODULE = "src/server/auth/mail.ts";
const ROOT_MODULE = "src/server/root.ts";
const CONTEXT_MODULE = "src/server/context.ts";

/** Declared interface values, asserted rather than assumed. */
const SESSION_COOKIE_NAME = "cubit_session";
const OUTBOX_DIR = "storage/mail-outbox";

/** The identity tables the interfaces name (src/core/db.ts, re-exported by db/schema/identity.ts). */
const USERS = "users";
const SESSIONS = "sessions";
const AUTH_TOKENS = "auth_tokens";
const MEMBERSHIPS = "memberships";
const TENANTS = "tenants";

/** The ten procedures of the test contract. */
const AUTH_PROCEDURES = [
  "spine.auth.signUp",
  "spine.auth.signIn",
  "spine.auth.signOut",
  "spine.auth.verifyEmail",
  "spine.auth.requestMagicLink",
  "spine.auth.consumeMagicLink",
  "spine.auth.requestPasswordReset",
  "spine.auth.resetPassword",
  "spine.auth.listSessions",
  "spine.auth.revokeSession",
] as const;

/** The mail kinds the outbox writes. */
const VERIFY_MAIL = "verify-email";
const MAGIC_MAIL = "magic-link";

/** The refusal codes this increment registers, plus the one it already had. */
const CREDENTIALS_NOT_VALID = "CREDENTIALS_NOT_VALID";
const TOKEN_NOT_VALID = "TOKEN_NOT_VALID";
const ACCOUNT_ALREADY_EXISTS = "ACCOUNT_ALREADY_EXISTS";
const SIGNED_OUT = "SIGNED_OUT";

const PASSWORD = "correct-horse-battery-staple-9";

/** The trigger that induces a mid-write failure for AC-1, and the function behind it. */
const INDUCED = "verifier_induced_failure";

/** A uuid as the tree mints them — how a row's own key is picked out of its rendered JSON. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown; _def?: { procedures?: Record<string, unknown> } };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface Staged {
  admin: string;
  outboxDir: string;
  sessionCookie: string;
  auth(options?: { token?: string; headers?: Record<string, string> }): Promise<AuthCaller>;
}

let staged: Promise<Staged> | null = null;
let scratch: { drop(): Promise<void> } | null = null;

afterAll(async () => {
  const held = scratch;
  scratch = null;
  if (held !== null) await held.drop();
});

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/**
 * Stage the product once for the whole file — lazily, so a tree that does not carry the auth modules
 * yet fails inside each test rather than in a hook, and memoised, so one migrated database serves
 * every case.
 */
function stage(): Promise<Staged> {
  return (staged ??= build());
}

async function build(): Promise<Staged> {
  const [session, mail] = await Promise.all([productModule<Record<string, unknown>>(SESSION_MODULE), productModule<Record<string, unknown>>(MAIL_MODULE)]);

  const sessionCookie = String(session["SESSION_COOKIE"] ?? "");
  expect(sessionCookie, `${SESSION_MODULE} exports SESSION_COOKIE = "${SESSION_COOKIE_NAME}" (increment interfaces)`).toBe(SESSION_COOKIE_NAME);

  const outbox = String(mail["MAIL_OUTBOX_DIR"] ?? "");
  expect(outbox, `${MAIL_MODULE} exports MAIL_OUTBOX_DIR = "${OUTBOX_DIR}" (increment interfaces)`).toBe(OUTBOX_DIR);

  const db = await provisionScratchDb();
  scratch = db;
  process.env["DATABASE_URL"] = db.urlApp;

  const adminUrl = new URL(BOOTSTRAP_URL);
  adminUrl.pathname = new URL(db.urlApp).pathname;
  const admin = adminUrl.toString();

  const [root, context] = await Promise.all([productModule<RootModule>(ROOT_MODULE), productModule<ContextModule>(CONTEXT_MODULE)]);

  const mounted = Object.keys(root.appRouter._def?.procedures ?? {});
  for (const path of AUTH_PROCEDURES) {
    expect(mounted, `${path} is mounted on appRouter (test contract: procedures) — mounted: ${mounted.join(", ") || "none"}`).toContain(path);
  }

  for (const table of [USERS, SESSIONS, AUTH_TOKENS, MEMBERSHIPS]) {
    const present = scalar(admin, `select count(*) from information_schema.tables where table_schema = 'public' and table_name = ${lit(table)};`);
    expect(Number(present), `the migrated schema carries the identity table "${table}" (increment interfaces)`).toBeGreaterThan(0);
  }

  return {
    admin,
    outboxDir: isAbsolute(outbox) ? outbox : join(REPO_ROOT, outbox),
    sessionCookie,
    auth: async (options: { token?: string; headers?: Record<string, string> } = {}): Promise<AuthCaller> => {
      const headers = new Headers(options.headers ?? {});
      if (options.token !== undefined) headers.set("cookie", `${sessionCookie}=${options.token}`);
      const ctx = await context.createContext({ req: new Request("http://cubit.test/api/trpc/spine.auth", { headers }) });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Settling calls, and reading their answers.
 * ------------------------------------------------------------------ */

async function answerOf(work: Promise<unknown>, why: string): Promise<Record<string, unknown>> {
  const [settled] = await Promise.allSettled([work]);
  if (settled?.status === "rejected") expect.fail(`${why} — it failed instead with: ${describeFailure(settled.reason)}`);
  return ((settled as PromiseFulfilledResult<unknown>).value ?? {}) as Record<string, unknown>;
}

async function failureOf(work: Promise<unknown>, why: string): Promise<unknown> {
  const [settled] = await Promise.allSettled([work]);
  expect(settled?.status, `${why} — the door answered instead of refusing`).toBe("rejected");
  return (settled as PromiseRejectedResult).reason;
}

function describeFailure(reason: unknown): string {
  if (typeof reason !== "object" || reason === null) return String(reason);
  const failure = reason as { message?: unknown; refusalCode?: unknown; cause?: { message?: unknown; code?: unknown } };
  const parts = [String(failure.message ?? reason)];
  if (failure.refusalCode !== undefined) parts.push(`refusalCode=${String(failure.refusalCode)}`);
  if (failure.cause?.code !== undefined) parts.push(`cause.code=${String(failure.cause.code)}`);
  return parts.join(" · ");
}

/**
 * A single-field procedure's input. The interfaces write these doors as `consumeMagicLink(token)`
 * and `revokeSession(id)` without fixing whether the field arrives named, named by an equivalent
 * alias, or bare, so each shape is offered in turn — the spec's ambiguity must not decide the
 * criterion. A door that refuses rejects like any other, so the first shape's refusal is what the
 * caller is handed back.
 */
function oneField(procedure: Procedure, fields: readonly string[], value: string): Promise<unknown> {
  const primary = fields[0] ?? "value";
  const shapes: unknown[] = [{ [primary]: value }];
  if (fields.length > 1) shapes.push(Object.fromEntries(fields.map((field) => [field, value])));
  shapes.push(value);
  return firstThatSettles(procedure, shapes);
}

async function firstThatSettles(procedure: Procedure, shapes: readonly unknown[]): Promise<unknown> {
  let firstFailure: unknown;
  let failed = false;
  for (const shape of shapes) {
    const [settled] = await Promise.allSettled([procedure(shape)]);
    if (settled?.status === "fulfilled") return settled.value;
    if (!failed) {
      firstFailure = (settled as PromiseRejectedResult).reason;
      failed = true;
    }
  }
  throw firstFailure;
}

/** The registered refusal a failure carries, read through the marker the fault seam itself reads. */
async function refusalOf(work: Promise<unknown>, why: string): Promise<string> {
  const reason = await failureOf(work, why);
  const code = refusalCodeOf(reason);
  expect(code, `${why} — the failure carries no registered refusal marker, so it reaches the caller as a fault: ${describeFailure(reason)}`).not.toBeNull();
  expect(Object.keys(REFUSALS), `${why} — "${String(code)}" is registered in the closed taxonomy (R-SPINE-062)`).toContain(String(code));
  return String(code);
}

async function expectRefusal(work: Promise<unknown>, expected: string, why: string): Promise<void> {
  expect(await refusalOf(work, why), why).toBe(expected);
}

/* ------------------------------------------------------------------ *
 * The scenario's vocabulary.
 * ------------------------------------------------------------------ */

const freshEmail = (what: string): string => `verifier-${what}-${randomUUID()}@cubit.test`;

const sessionTokenOf = (answer: Record<string, unknown>, why: string): string => {
  const token = String(answer["sessionToken"] ?? "");
  expect(token.length, `${why} — the answer is { sessionToken } (increment interfaces)`).toBeGreaterThan(0);
  return token;
};

async function signUp(s: Staged, email: string, tenantName: string): Promise<string> {
  const auth = await s.auth();
  const answer = await answerOf(auth["signUp"]!({ email, password: PASSWORD, tenantName }), `spine.auth.signUp creates the account for ${email}`);
  return sessionTokenOf(answer, "spine.auth.signUp");
}

/** Sign up and consume the verification mail — the state the journey signs in from. */
async function verifiedAccount(s: Staged, what: string): Promise<{ email: string; tenantName: string; session: string }> {
  const email = freshEmail(what);
  const tenantName = `Workspace ${what} ${randomUUID().slice(0, 8)}`;
  const session = await signUp(s, email, tenantName);
  const mail = newestMail(s, email, VERIFY_MAIL, "signUp writes a verify-email mail into the outbox (AC-2)");
  const auth = await s.auth();
  await answerOf(oneField(auth["verifyEmail"]!, ["token"], mail.token), `spine.auth.verifyEmail(token) marks ${email} verified`);
  return { email, tenantName, session };
}

/* ------------------------------------------------------------------ *
 * The JSON outbox.
 * ------------------------------------------------------------------ */

interface Mail {
  to: string;
  kind: string;
  url: string;
  token: string;
  at: number;
}

function newestMail(s: Staged, to: string, kind: string, why: string): Mail {
  const mails = existsSync(s.outboxDir)
    ? readdirSync(s.outboxDir)
        .filter((name) => name.endsWith(".json"))
        .map((name) => join(s.outboxDir, name))
        .filter((file) => statSync(file).isFile())
        .map((file) => {
          const bag = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
          return {
            to: String(bag["to"] ?? ""),
            kind: String(bag["kind"] ?? ""),
            url: String(bag["url"] ?? ""),
            token: String(bag["token"] ?? ""),
            at: statSync(file).mtimeMs,
          };
        })
        .filter((mail) => mail.to === to && mail.kind === kind)
        .sort((a, b) => b.at - a.at)
    : [];
  const newest = mails[0];
  expect(newest, `${why} — no "${kind}" mail for ${to} in ${s.outboxDir}`).toBeTruthy();
  const mail = newest as Mail;
  expect(mail.token.length, `${why} — the "${kind}" mail carries a token`).toBeGreaterThan(0);
  return mail;
}

/* ------------------------------------------------------------------ *
 * Reading rows without transcribing a column name.
 * ------------------------------------------------------------------ */

/** Every row of a table whose rendered JSON contains this value — the row the scenario minted. */
function rowsHolding(s: Staged, table: string, value: string): Record<string, unknown>[] {
  return run(s.admin, `select to_jsonb(t)::text from ${ident("public")}.${ident(table)} t where to_jsonb(t)::text like ${lit(`%${value}%`)};`).map(
    (row) => JSON.parse(row[0] ?? "{}") as Record<string, unknown>,
  );
}

/** The uuid-shaped values a row carries — one of them is its own key, whatever the column is called. */
const uuidsOf = (row: Record<string, unknown>): string[] => Object.values(row).filter((value): value is string => typeof value === "string" && UUID.test(value));

describe("AC-1: one transactional door", () => {
  test("AC-1: signUp creates the user, the personal tenant and the membership joining them", async () => {
    const s = await stage();
    const email = freshEmail("door");
    const tenantName = `Workspace door ${randomUUID().slice(0, 8)}`;
    await signUp(s, email, tenantName);

    const users = rowsHolding(s, USERS, email);
    expect(users.length, `AC-1: signUp created the account row for ${email} in "${USERS}"`).toBe(1);

    const tenantId = scalar(s.admin, `select coalesce((select tenant_id::text from ${ident(TENANTS)} where name = ${lit(tenantName)} limit 1), '');`);
    expect(tenantId, `AC-1: signUp created the personal tenant named "${tenantName}" in "${TENANTS}" (R-SPINE-002)`).not.toBe("");

    const memberships = rowsHolding(s, MEMBERSHIPS, tenantId);
    const accountIds = uuidsOf(users[0] as Record<string, unknown>);
    const joining = memberships.filter((row) => uuidsOf(row).some((value) => accountIds.includes(value)));
    expect(
      joining.length,
      `AC-1: a membership in "${MEMBERSHIPS}" joins the new account to its personal tenant ${tenantId} — an account that belongs nowhere is unrepresentable (R-SPINE-002)`,
    ).toBeGreaterThan(0);
  });

  test("AC-1: when part of the write fails, no user and no tenant survive — the three writes are one transaction", async () => {
    const s = await stage();
    const email = freshEmail("rollback");
    const tenantName = `Workspace rollback ${randomUUID().slice(0, 8)}`;

    // The failure is induced in the database itself, at the membership write: whatever order the
    // door writes its three rows in, the transaction cannot commit.
    run(
      s.admin,
      `create or replace function ${ident(INDUCED)}() returns trigger language plpgsql as $$ begin raise exception 'induced failure (AC-1)'; end $$;
       create trigger ${ident(INDUCED)} before insert on ${ident(MEMBERSHIPS)} for each row execute function ${ident(INDUCED)}();`,
    );
    const auth = await s.auth();
    const [settled] = await Promise.allSettled([auth["signUp"]!({ email, password: PASSWORD, tenantName })]);
    run(s.admin, `drop trigger if exists ${ident(INDUCED)} on ${ident(MEMBERSHIPS)}; drop function if exists ${ident(INDUCED)}();`);

    expect(settled?.status, "AC-1: a sign-up whose membership write is refused by the database does not answer as a success").toBe("rejected");
    expect(
      rowsHolding(s, USERS, email).length,
      `AC-1: no user row for ${email} survives a failed sign-up — the user, the tenant and the membership are written in ONE transaction (R-SPINE-002)`,
    ).toBe(0);
    expect(
      Number(scalar(s.admin, `select count(*) from ${ident(TENANTS)} where name = ${lit(tenantName)};`)),
      `AC-1: no tenant named "${tenantName}" survives a failed sign-up — the same transaction carried it`,
    ).toBe(0);
  });

  test("AC-1: a second sign-up with the same email answers ACCOUNT_ALREADY_EXISTS — a seam-side guard, not a raw constraint fault", async () => {
    const s = await stage();
    const email = freshEmail("twice");
    await signUp(s, email, `Workspace first ${randomUUID().slice(0, 8)}`);

    const auth = await s.auth();
    await expectRefusal(
      auth["signUp"]!({ email, password: PASSWORD, tenantName: `Workspace second ${randomUUID().slice(0, 8)}` }),
      ACCOUNT_ALREADY_EXISTS,
      `AC-1: signing up ${email} a second time is refused with the registered code — a unique-violation reaching the caller as a fault would answer a fault id instead`,
    );
  });
});

describe("AC-2: verification and credentialed sign-in", () => {
  test("AC-2: signUp writes the verify-email mail, and verifyEmail marks the account verified", async () => {
    const s = await stage();
    const email = freshEmail("verify");
    await signUp(s, email, `Workspace verify ${randomUUID().slice(0, 8)}`);

    const mail = newestMail(s, email, VERIFY_MAIL, "AC-2: signUp writes a verify-email mail carrying the token");
    expect(mail.url.includes(mail.token), "AC-2: the verification mail's url carries the token the mail names").toBe(true);

    const before = rowsHolding(s, USERS, email)[0];
    expect(before, `AC-2: the account row for ${email} exists before it is verified`).toBeTruthy();

    const auth = await s.auth();
    await answerOf(oneField(auth["verifyEmail"]!, ["token"], mail.token), "AC-2: spine.auth.verifyEmail(token) is answered for a good token");

    const after = rowsHolding(s, USERS, email)[0];
    expect(
      JSON.stringify(after),
      `AC-2: verifying ${email} marks the account — its row records the verification, and nothing about it changed`,
    ).not.toBe(JSON.stringify(before));
  });

  test("AC-2: signIn answers a session for the right credentials, and refuses the wrong ones as an answer", async () => {
    const s = await stage();
    const { email } = await verifiedAccount(s, "signin");

    const auth = await s.auth();
    const answer = await answerOf(auth["signIn"]!({ email, password: PASSWORD }), "AC-2: signIn with the right credentials is answered");
    const token = sessionTokenOf(answer, "AC-2: spine.auth.signIn");

    const signedIn = await s.auth({ token });
    await answerOf(signedIn["listSessions"]!(), "AC-2: the session token signIn answered with authenticates the next call as `cubit_session`");

    const wrongPassword = await s.auth();
    await expectRefusal(
      wrongPassword["signIn"]!({ email, password: `${PASSWORD}-not` }),
      CREDENTIALS_NOT_VALID,
      "AC-2: a wrong password is a registered refusal — an answer, never a fault (R-SPINE-007)",
    );

    const unknownEmail = await s.auth();
    await expectRefusal(
      unknownEmail["signIn"]!({ email: freshEmail("nobody"), password: PASSWORD }),
      CREDENTIALS_NOT_VALID,
      "AC-2: an unknown email answers the same refusal as a wrong password — the door never says which accounts exist",
    );
  });
});

describe("AC-3: magic link", () => {
  test("AC-3: requestMagicLink writes the mail, consumeMagicLink answers a live session, and an unknown token is refused", async () => {
    const s = await stage();
    const { email } = await verifiedAccount(s, "magic");

    const requester = await s.auth();
    await answerOf(oneField(requester["requestMagicLink"]!, ["email"], email), "AC-3: spine.auth.requestMagicLink is answered for a known account");

    const mail = newestMail(s, email, MAGIC_MAIL, "AC-3: requestMagicLink writes a magic-link mail with a token and a url");
    expect(mail.url.includes(mail.token), "AC-3: the magic-link mail's url carries the token the mail names").toBe(true);

    const consumer = await s.auth();
    const consumed = await answerOf(oneField(consumer["consumeMagicLink"]!, ["token"], mail.token), "AC-3: spine.auth.consumeMagicLink(token) is answered");
    const token = sessionTokenOf(consumed, "AC-3: spine.auth.consumeMagicLink");

    const signedIn = await s.auth({ token });
    await answerOf(signedIn["listSessions"]!(), "AC-3: the session consumeMagicLink answered with is live");

    const stranger = await s.auth();
    await expectRefusal(
      oneField(stranger["consumeMagicLink"]!, ["token"], randomUUID()),
      TOKEN_NOT_VALID,
      "AC-3: a token the tree never issued is refused with the registered code",
    );
  });
});

describe("AC-5: sessions with device list and revoke", () => {
  test("AC-5: listSessions answers the account's sessions with the current one marked", async () => {
    const s = await stage();
    const { email, session } = await verifiedAccount(s, "list");
    const secondToken = sessionTokenOf(
      await answerOf((await s.auth({ headers: { "user-agent": "verifier-second-device/1.0" } }))["signIn"]!({ email, password: PASSWORD }), "AC-5: a second device signs in"),
      "AC-5: spine.auth.signIn",
    );

    const auth = await s.auth({ token: session });
    const rows = (await auth["listSessions"]!()) as Record<string, unknown>[];
    expect(Array.isArray(rows), "AC-5: spine.auth.listSessions answers a list of rows").toBe(true);
    expect(rows.length, "AC-5: both live sessions of the account are listed").toBeGreaterThanOrEqual(2);

    for (const row of rows) {
      expect(String(row["id"] ?? ""), "AC-5: every session row carries an id (test contract: { id, deviceLabel, createdAt, current })").not.toBe("");
      expect(String(row["deviceLabel"] ?? ""), "AC-5: every session row carries a device label — the device list says where you are signed in").not.toBe("");
      expect(
        Number.isFinite(new Date(row["createdAt"] as string | number | Date).getTime()),
        `AC-5: every session row carries a readable createdAt, got ${String(row["createdAt"])}`,
      ).toBe(true);
      expect(typeof row["current"], "AC-5: every session row says whether it is this device").toBe("boolean");
    }

    const current = rows.filter((row) => row["current"] === true);
    expect(current.length, "AC-5: exactly one listed session is the one the call was made with").toBe(1);
    expect(secondToken.length, "AC-5: the second device holds a session of its own").toBeGreaterThan(0);
  });

  test("AC-5: revokeSession signs the revoked device out, and signOut ends the current session", async () => {
    const s = await stage();
    const { email, session } = await verifiedAccount(s, "revoke");
    const other = sessionTokenOf(await answerOf((await s.auth())["signIn"]!({ email, password: PASSWORD }), "AC-5: a second device signs in"), "AC-5: spine.auth.signIn");

    const auth = await s.auth({ token: session });
    const rows = (await auth["listSessions"]!()) as Record<string, unknown>[];
    const others = rows.filter((row) => row["current"] !== true);
    expect(others.length, "AC-5: the device list holds a session other than this one to revoke").toBeGreaterThan(0);

    const revoker = await s.auth({ token: session });
    await answerOf(oneField(revoker["revokeSession"]!, ["id", "sessionId"], String(others[0]?.["id"] ?? "")), "AC-5: spine.auth.revokeSession(id) is answered");

    const revoked = await refusalOf(
      (await s.auth({ token: other }))["listSessions"]!(),
      "AC-5: the revoked session's next call is refused rather than answered",
    );
    expect(revoked, "AC-5: a revoked session answers SIGNED_OUT").toBe(SIGNED_OUT);
    expect(
      /sign[\s-]?in/i.test(REFUSALS[SIGNED_OUT].remedy),
      `AC-5: SIGNED_OUT carries its registered sign-in remedy, got "${REFUSALS[SIGNED_OUT].remedy}"`,
    ).toBe(true);

    const stillHere = await s.auth({ token: session });
    await answerOf(stillHere["listSessions"]!(), "AC-5: revoking another device leaves this one signed in");

    await answerOf((await s.auth({ token: session }))["signOut"]!(), "AC-5: spine.auth.signOut is answered");
    await expectRefusal(
      (await s.auth({ token: session }))["listSessions"]!(),
      SIGNED_OUT,
      "AC-5: after signOut the session is over — its next call answers SIGNED_OUT",
    );
  });

  test("AC-5: a call with no cubit_session, or an unknown one, answers SIGNED_OUT", async () => {
    const s = await stage();
    await expectRefusal((await s.auth())["listSessions"]!(), SIGNED_OUT, "AC-5: a session-requiring procedure called with no cookie answers SIGNED_OUT");
    await expectRefusal(
      (await s.auth({ token: randomUUID() }))["listSessions"]!(),
      SIGNED_OUT,
      "AC-5: a cubit_session the tree never issued answers SIGNED_OUT, never a fault",
    );
  });
});

