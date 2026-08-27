/**
 * Breaker acceptance for the rate limiter's key (R-SPINE-001, R-SPINE-007, R-SPINE-062, ARCH-03/B-21).
 *
 * The increment's promise is unconditional: "Auth failures are registered refusals in the closed
 * taxonomy … never unmarked faults — a DB constraint never reaches the caller raw."
 *
 * `src/server/auth/rate-limit.ts` opens every limited door with `admitAttempt(door, email)`, and the
 * identity it is handed is the address the caller wrote, at whatever length the caller wrote it. That
 * value is stored verbatim in `auth_attempts.identity`, which `src/core/db.ts` covers with the btree
 * index `auth_attempts_window` on (door, identity, attempted_at). No door bounds the address and no
 * screen can: the sign-in field is `type="email" required` with no `maxlength`, because the Design
 * Decision (I-13) forbids a screen judging what a person typed.
 *
 * So an address whose bytes do not compress under postgres' btree limit makes the *limiter itself*
 * fail — `ERROR: index row size … exceeds btree version 4 maximum 2704 for index
 * "auth_attempts_window"`, SQLSTATE 54000 — before the door has judged anything at all. A constraint
 * error carries no refusal marker, so `src/server/trpc.ts` files a FaultRecord and answers a fault
 * id: the person is shown the fault card telling them the machine broke, and the operator is handed
 * an outage record, for an address the door never looked up. Every one of the four limited doors is
 * reachable this way by an anonymous caller, and none of the attempts is ever counted — the limiter
 * throws at its own INSERT, so the transaction that would have recorded the attempt rolls back.
 *
 * This file asserts only the floor the law states and never a particular code. The door may answer,
 * or it may refuse with a code the closed taxonomy *registers* — CREDENTIALS_NOT_VALID for an address
 * that names no account is the obvious reading, and the mailing doors already answer every unknown
 * address `{ sent: true }` — but it may not report a caller-reachable value as an outage. It is
 * deliberately silent on where the bound belongs (the limiter may key on a digest, or a door may cap
 * the address), on any length limit as a number, and on any format rule for an address, none of which
 * the Bible or the Design Decision speaks to.
 *
 * Product modules are loaded by absolute path and the database is the same self-provisioned scratch
 * every live suite uses, so this file judges the shipped seam and adds no second idea of the schema.
 */
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the increment's interfaces name. */
const ROOT_MODULE = "src/server/root.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const SESSION_MODULE = "src/server/auth/session.ts";

const PASSWORD = "correct-horse-battery-staple-9";

/**
 * How long the local part is made. Comfortably past the 2704-byte btree ceiling, so the case does not
 * turn on where exactly postgres draws the line — the point is that no door draws one at all.
 */
const LOCAL_PART_LENGTH = 3000;

/**
 * An address that is long *and* incompressible. Length alone is not enough: postgres compresses an
 * index value before it measures it, so a run of one letter fits however long it is. A digest chain
 * is deterministic — the same address every run, so a failure is the same failure every run — and
 * carries about six bits a character, which pglz cannot shrink.
 */
function longAddress(label: string): string {
  let seed = `cubit-breaker-long-address:${label}`;
  let local = "";
  while (local.length < LOCAL_PART_LENGTH) {
    seed = createHash("sha256").update(seed).digest("base64url");
    local += seed;
  }
  return `${local.slice(0, LOCAL_PART_LENGTH)}@cubit.test`;
}

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface Staged {
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

  const [root, context] = await Promise.all([productModule<RootModule>(ROOT_MODULE), productModule<ContextModule>(CONTEXT_MODULE)]);

  return {
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
  return `breaker-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@cubit.test`;
}

/** What the failure carries, in the words the operator would read on the record. */
function describeFailure(failure: unknown): string {
  const bag = failure as { name?: unknown; code?: unknown; message?: unknown; cause?: { code?: unknown; constraint_name?: unknown } };
  return JSON.stringify({
    name: bag?.name,
    code: bag?.code,
    causeCode: bag?.cause?.code,
    causeConstraint: bag?.cause?.constraint_name,
    message: String(bag?.message ?? "").slice(0, 240),
  });
}

/**
 * The marker as the settled core reader sees it — one level deep, the value or its direct cause,
 * which is exactly what `src/server/trpc.ts` reads before it decides to report a fault.
 */
function registeredCodeOf(failure: unknown): string | null {
  const code = refusalCodeOf(failure) ?? refusalCodeOf((failure as { cause?: unknown } | null)?.cause);
  return code !== null && Object.hasOwn(REFUSALS, code) ? code : null;
}

/** The floor: the door answered, or it refused with a code the closed taxonomy registers. */
function expectAnsweredOrRegistered(settled: PromiseSettledResult<unknown>, door: string): void {
  if (settled.status === "fulfilled") return;

  const failure = (settled as PromiseRejectedResult).reason;
  expect(
    registeredCodeOf(failure),
    `${door}, given an address of ${LOCAL_PART_LENGTH} incompressible characters, failed with something the closed ` +
      `taxonomy does not register, so src/server/trpc.ts reports it as a fault: the person is shown the fault card ` +
      `telling them the machine broke and is given a fault id to quote, and the operator gets a FaultRecord — for an ` +
      `address the door never judged (R-SPINE-007, R-SPINE-062, ARCH-03). The failure comes from the limiter's own ` +
      `INSERT into auth_attempts, whose btree index auth_attempts_window cannot hold the caller's address, so the ` +
      `door refuses nothing and counts nothing. No screen may bound the value first (Design Decision I-13), so the ` +
      `bound belongs on this side of the wire. It failed with: ${describeFailure(failure)}`,
  ).not.toBeNull();
}

/** The four doors `AUTH_RATE_LIMITS` names, and the input each takes (increment interfaces). */
const LIMITED_DOORS: ReadonlyArray<{ door: string; input: (email: string) => Record<string, unknown> }> = [
  { door: "signIn", input: (email) => ({ email, password: PASSWORD }) },
  { door: "signUp", input: (email) => ({ email, password: PASSWORD, tenantName: "Breaker Workspace" }) },
  { door: "requestMagicLink", input: (email) => ({ email }) },
  { door: "requestPasswordReset", input: (email) => ({ email }) },
];

describe("BREAKER — a limited door bounds the identity it counts, and never reports it as an outage", () => {
  for (const { door, input } of LIMITED_DOORS) {
    test(`spine.auth.${door} with an unbounded address does not hand the caller an unmarked fault`, async () => {
      const { auth } = await stage();
      const anonymous = await auth();

      const [settled] = await Promise.allSettled([anonymous[door]?.(input(longAddress(door)))]);
      expectAnsweredOrRegistered(settled!, `spine.auth.${door}`);
    });
  }

  test("a limited door still admits an ordinary address after an unbounded one was presented", async () => {
    const { auth } = await stage();
    const anonymous = await auth();

    await Promise.allSettled([anonymous["signIn"]?.({ email: longAddress("still-admits"), password: PASSWORD })]);

    const email = freshEmail("still-admits");
    const answer = (await anonymous["signUp"]?.({ email, password: PASSWORD, tenantName: "Breaker Workspace" })) as { sessionToken?: string };
    expect(typeof answer?.sessionToken, "an unbounded address presented once must leave the doors working").toBe("string");
  });
});
