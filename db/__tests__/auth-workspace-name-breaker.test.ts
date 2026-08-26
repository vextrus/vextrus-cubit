/**
 * Breaker acceptance for the third string R-SPINE-002's one door is handed: the workspace name
 * (R-SPINE-001, R-SPINE-007, R-SPINE-062, ARCH-03/B-21).
 *
 * The increment's promise is that an auth failure a caller can reach is a registered refusal and
 * never an unmarked fault, and the settled reading (Design Decision I-14) says how the *creating*
 * doors meet it: `spine.auth.signUp` "accept[s] any string the transport proves is a string … the
 * personal tenant is named as presented". The door therefore owes an answer — the session it
 * creates, or a code the closed taxonomy registers — for every string it is given.
 *
 * `spine.auth.signUp` takes three caller-written strings, and two of them already settle the case
 * of a value postgres cannot hold on this side of the wire: the address goes through
 * `nameable()`/`isStorableText` in src/server/auth/session.ts, and the limiter's key goes through
 * `countable()` in src/server/auth/rate-limit.ts. Both were written for one reason, stated in both
 * files: a NUL is refused by the driver on the *parameter*, before any column is reached, and that
 * refusal carries no marker — so the caller is handed a fault id and the operator a FaultRecord for
 * a value the door never wrote. The settled ruling on that shape (R-SPINE-062 / R-SPINE-007,
 * ARCH-03, B-21) puts it plainly: a value the database cannot store "is not an outage".
 *
 * `tenantName` is the third string and has no such settlement. It reaches `tx.insert(tenants)`
 * exactly as presented, so a workspace name carrying U+0000 fails the driver mid-transaction and
 * comes back to the caller as a fault id with an outage filed behind it.
 *
 * This file asserts only that floor, and never a particular code or a particular remedy. The door
 * may answer — I-14's reading, and the one that keeps "named as presented" true — or it may refuse
 * with a code the closed taxonomy already registers. What it may not do is tell the person the
 * machine broke, and file an operator outage record, for a workspace name it never wrote. The file
 * is deliberately silent on what a *whitespace-only* workspace name should do, which is the sibling
 * question db/__tests__/auth-seam-breaker.test.ts leaves open and no registered code speaks to.
 *
 * Product modules are loaded by absolute path and the database is the same self-provisioned scratch
 * every live suite uses, so this file judges the shipped seam and adds no second idea of the schema.
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { ident, lit, run } from "./support/live-sql";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the increment's interfaces name. */
const ROOT_MODULE = "src/server/root.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const SESSION_MODULE = "src/server/auth/session.ts";

/** The identity tables the interfaces name (src/core/db.ts, re-exported by db/schema/identity.ts). */
const USERS = "users";
const MEMBERSHIPS = "memberships";
const TENANTS = "tenants";

const PASSWORD = "correct-horse-battery-staple-9";

/** A uuid as the tree mints them — how a row's own key is picked out of its rendered JSON. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The one character postgres cannot hold in `text` at all — refused as a bind parameter, so no
 * column definition and no length can rescue it. Spelled by code point rather than as a literal,
 * because a NUL written into a source file is invisible to whoever reads this next.
 */
const NUL = String.fromCharCode(0);

/**
 * Workspace names a person can put in the box and the browser will send. `required` admits every
 * one of them — each has length — and Design Decision I-13 forbids the screen inventing a rule that
 * would stop them, so the door is what has to answer.
 */
const UNSTORABLE_WORKSPACE_NAMES: readonly string[] = [`Acme${NUL} Ltd`, NUL, `${NUL}Meridian Builders`];

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface Staged {
  /** The scratch database as a role that sees every row, for reading what the door left behind. */
  admin: string;
  auth(token?: string): Promise<AuthCaller>;
}

let staged: Promise<Staged> | null = null;
let scratch: { drop(): Promise<void> } | null = null;

afterAll(async () => {
  const held = scratch;
  scratch = null;
  if (held === null) return;
  // The scratch database is dropped `with (force)`, which terminates whatever the seam's pool still
  // holds. A connection the pool opened but had not finished handshaking would then reject on a
  // closed socket with nobody left to catch it, so the pool is given a beat to go idle first.
  await new Promise((settle) => setTimeout(settle, 500));
  await held.drop();
});

async function productModule<T>(relative: string): Promise<T> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as T;
}

/** Staged lazily and memoised, so a tree without the auth modules fails inside a test, not a hook. */
function stage(): Promise<Staged> {
  return (staged ??= build());
}

async function build(): Promise<Staged> {
  const session = await productModule<Record<string, unknown>>(SESSION_MODULE);
  const cookie = String(session["SESSION_COOKIE"] ?? "");
  expect(cookie, `${SESSION_MODULE} exports SESSION_COOKIE (increment interfaces)`).not.toBe("");

  const db = await provisionScratchDb();
  scratch = db;
  process.env["DATABASE_URL"] = db.urlApp;

  const adminUrl = new URL(BOOTSTRAP_URL);
  adminUrl.pathname = new URL(db.urlApp).pathname;

  const [root, context] = await Promise.all([productModule<RootModule>(ROOT_MODULE), productModule<ContextModule>(CONTEXT_MODULE)]);

  return {
    admin: adminUrl.toString(),
    auth: async (token?: string): Promise<AuthCaller> => {
      const headers = new Headers();
      if (token !== undefined) headers.set("cookie", `${cookie}=${token}`);
      const ctx = await context.createContext({ req: new Request("http://cubit.test/api/trpc/spine.auth", { headers }) });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
}

/** A fresh address, so no case can pass or fail on another's rows. */
function freshEmail(label: string): string {
  return `breaker-workspace-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@cubit.test`;
}

/** What the failure carries, in the words the operator would read on the record. */
function describeFailure(failure: unknown): string {
  const bag = failure as { name?: unknown; code?: unknown; message?: unknown; cause?: { code?: unknown } };
  return JSON.stringify({ name: bag?.name, code: bag?.code, causeCode: bag?.cause?.code, message: String(bag?.message ?? "").slice(0, 240) });
}

/**
 * The marker as the settled core reader sees it — one level deep, the value or its direct cause,
 * which is exactly what `src/server/trpc.ts` reads before it decides to report a fault.
 */
function registeredCodeOf(failure: unknown): string | null {
  const code = refusalCodeOf(failure) ?? refusalCodeOf((failure as { cause?: unknown } | null)?.cause);
  return code !== null && Object.hasOwn(REFUSALS, code) ? code : null;
}

/** What a name reads as in a failure message, with the invisible character named rather than shown. */
function shown(name: string): string {
  return JSON.stringify(name).replaceAll(NUL, "\\u0000");
}

/* ------------------------------------------------------------------ *
 * Reading rows without transcribing a column name.
 * ------------------------------------------------------------------ */

/** Every row of a table whose rendered JSON contains this value — the row the scenario minted. */
function rowsHolding(admin: string, table: string, value: string): Record<string, unknown>[] {
  return run(admin, `select to_jsonb(t)::text from ${ident("public")}.${ident(table)} t where to_jsonb(t)::text like ${lit(`%${value}%`)};`).map(
    (row) => JSON.parse(row[0] ?? "{}") as Record<string, unknown>,
  );
}

/** The uuid-shaped values a row carries — one of them is its own key, whatever the column is called. */
const uuidsOf = (row: Record<string, unknown>): string[] => Object.values(row).filter((value): value is string => typeof value === "string" && UUID.test(value));

/** The rows of `table` that name any of these keys, counted once each however many keys match. */
function rowsNaming(admin: string, table: string, keys: readonly string[]): Record<string, unknown>[] {
  const found = new Map<string, Record<string, unknown>>();
  for (const key of keys) {
    for (const row of rowsHolding(admin, table, key)) found.set(JSON.stringify(row), row);
  }
  return [...found.values()];
}

describe("BREAKER — an unstorable workspace name is answered, never reported as an outage", () => {
  for (const tenantName of UNSTORABLE_WORKSPACE_NAMES) {
    test(`spine.auth.signUp with a workspace name of ${shown(tenantName)} does not hand the caller an unmarked fault`, async () => {
      const { auth } = await stage();
      const anonymous = await auth();

      const [settled] = await Promise.allSettled([anonymous["signUp"]?.({ email: freshEmail("nul"), password: PASSWORD, tenantName })]);

      if (settled!.status === "fulfilled") return;
      const failure = (settled as PromiseRejectedResult).reason;
      expect(
        registeredCodeOf(failure),
        `spine.auth.signUp with a workspace name of ${shown(tenantName)} failed with something the closed taxonomy ` +
          `does not register, so src/server/trpc.ts reports it as a fault: the person is shown the fault card telling ` +
          `them the machine broke and is given a fault id to quote, and the operator gets a FaultRecord — for a name ` +
          `the door never wrote (R-SPINE-007, R-SPINE-062, ARCH-03). The same shape is already settled for the two ` +
          `other strings this door is handed: the address through nameable()/isStorableText in ` +
          `src/server/auth/session.ts and the limiter's key through countable() in src/server/auth/rate-limit.ts, ` +
          `both on the stated ground that a value the database cannot store is not an outage (B-21). The workspace ` +
          `name reaches tx.insert(tenants) unguarded. It failed with: ${describeFailure(failure)}`,
      ).not.toBeNull();
    });
  }

  test("an unstorable workspace name leaves nothing half-written, whichever ending the door takes (AC-1, R-SPINE-002)", async () => {
    const { admin, auth } = await stage();
    const anonymous = await auth();
    const email = freshEmail("rollback");

    const [settled] = await Promise.allSettled([anonymous["signUp"]?.({ email, password: PASSWORD, tenantName: `Acme${NUL} Ltd` })]);

    // I-14 leaves the door two lawful endings, and this file never converts that disjunction into a
    // mandate. AC-1's promise — "when any part of that write fails, no user row survives" — is a
    // conditional whose antecedent is a failed write, so it is the refusal ending that engages it.
    if (settled!.status === "rejected") {
      const failure = (settled as PromiseRejectedResult).reason;
      // The floor first, in this branch as in the three above: a refusal is a code the closed
      // taxonomy registers, never an unmarked fault filed as an outage (R-SPINE-007, R-SPINE-062).
      expect(
        registeredCodeOf(failure),
        `spine.auth.signUp refused the workspace name ${shown(`Acme${NUL} Ltd`)} with something the closed taxonomy does not ` +
          `register, so the person is shown the fault card and the operator gets a FaultRecord for a name the door never ` +
          `wrote (ARCH-03, B-21). It failed with: ${describeFailure(failure)}`,
      ).not.toBeNull();

      expect(
        rowsHolding(admin, USERS, email).length,
        `AC-1: the sign-up failed, so no user row for ${email} survives — the user, the tenant and the membership are ONE transaction (R-SPINE-002)`,
      ).toBe(0);
      const again = (await anonymous["signUp"]?.({ email, password: PASSWORD, tenantName: "Acme Ltd" })) as { sessionToken?: string };
      expect(typeof again?.sessionToken, "AC-1: a sign-up that failed leaves the address free to sign up with").toBe("string");
      return;
    }

    // The door answered. Nothing failed, so AC-1's antecedent is not engaged and the address is
    // rightly taken. What R-SPINE-002 still requires of the answer is that the account it created
    // belongs somewhere: one user, joined by one membership, to one tenant — nothing half-written.
    const users = rowsHolding(admin, USERS, email);
    expect(users.length, `R-SPINE-002: the answered sign-up left exactly one account row for ${email} in "${USERS}"`).toBe(1);

    const accountIds = uuidsOf(users[0] as Record<string, unknown>);
    expect(accountIds.length, `the account row for ${email} carries a key to join a membership to`).toBeGreaterThan(0);

    const memberships = rowsNaming(admin, MEMBERSHIPS, accountIds);
    expect(
      memberships.length,
      `R-SPINE-002: the answered sign-up left exactly one membership in "${MEMBERSHIPS}" for ${email} — an account that belongs nowhere, or twice over, is unrepresentable`,
    ).toBe(1);

    const tenantKeys = uuidsOf(memberships[0] as Record<string, unknown>).filter((value) => !accountIds.includes(value));
    expect(
      rowsNaming(admin, TENANTS, tenantKeys).length,
      `R-SPINE-002: that membership joins the account to exactly one tenant row in "${TENANTS}" — the personal tenant the same transaction created`,
    ).toBe(1);
  });
});
