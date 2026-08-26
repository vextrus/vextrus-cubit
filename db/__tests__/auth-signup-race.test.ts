/**
 * The seam-side guard against two sign-ups racing one address (AC-1, R-SPINE-002, R-SPINE-007).
 *
 * `src/server/auth/session.ts`'s `createAccount` wears two layers. The belt is a `SELECT … WHERE
 * email = …` inside the transaction, which catches the ordinary second sign-up. The braces are the
 * `users_email_unique` index read as an answer: between that SELECT and the INSERT there is a window,
 * and two calls that both pass the check both insert — one commits and the other is refused by the
 * index with SQLSTATE 23505. A constraint violation carries no refusal marker, so without the braces
 * `src/server/trpc.ts` would file a FaultRecord and hand that person a fault id, telling them the
 * machine broke when what actually happened is that somebody else took the address a moment earlier.
 *
 * Every other test of AC-1's ACCOUNT_ALREADY_EXISTS path signs up, awaits, and signs up again —
 * strictly sequential, so the SELECT always answers and the braces are never taken. This file makes
 * the calls concurrent, which is the only way the window is entered at all, and asserts the floor
 * from outside: whichever layer answers, exactly one caller holds a session, every other caller is
 * refused with the registered code, and the address names exactly one account. Stated that way it
 * cannot be read as a test of an implementation detail — it fails if the driver's error shape drifts,
 * if the constraint is renamed, or if a wrapper changes how deep the cause sits, which is exactly the
 * regression the guard exists to stop.
 *
 * Product modules are loaded by absolute path and the database is the same self-provisioned scratch
 * every live suite uses, so this file judges the shipped seam and adds no second idea of the schema.
 */
import { randomUUID } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { refusalCodeOf } from "../../src/core/faults/refusal-marker";
import { provisionScratchDb } from "./harness";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the increment's interfaces name. */
const ROOT_MODULE = "src/server/root.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const SESSION_MODULE = "src/server/auth/session.ts";

const PASSWORD = "correct-horse-battery-staple-9";

/**
 * How many callers present the address at once. More than two, because the window is a window: with
 * two the scheduler may still hand one transaction its commit before the other reaches its SELECT,
 * and every extra caller is another chance for two of them to be inside it together. Every caller
 * past the first is owed the same registered answer whichever layer refuses it.
 */
const RACERS = 4;

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface Staged {
  auth(): Promise<AuthCaller>;
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
  expect(String(session["SESSION_COOKIE"] ?? ""), `${SESSION_MODULE} exports SESSION_COOKIE (increment interfaces)`).not.toBe("");

  const db = await provisionScratchDb();
  scratch = db;
  process.env["DATABASE_URL"] = db.urlApp;

  const [root, context] = await Promise.all([productModule<RootModule>(ROOT_MODULE), productModule<ContextModule>(CONTEXT_MODULE)]);

  return {
    auth: async (): Promise<AuthCaller> => {
      const ctx = await context.createContext({ req: new Request("http://cubit.test/api/trpc/spine.auth") });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
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

/** The marker as `src/server/trpc.ts` reads it before it decides a failure is an outage. */
function refusalOfFailure(failure: unknown): string | null {
  return refusalCodeOf(failure) ?? refusalCodeOf((failure as { cause?: unknown } | null)?.cause);
}

describe("R-SPINE-002 — two sign-ups racing one address are both answered, never reported as an outage", () => {
  test(`${RACERS} concurrent sign-ups on one address: one session, the rest ACCOUNT_ALREADY_EXISTS`, async () => {
    const { auth } = await stage();
    const email = `race-${randomUUID()}@cubit.test`;

    // Each caller gets its own context, exactly as four concurrent HTTP requests would.
    const callers = await Promise.all(Array.from({ length: RACERS }, () => auth()));
    const settled = await Promise.allSettled(
      callers.map((caller, at) => caller["signUp"]?.({ email, password: PASSWORD, tenantName: `Race Workspace ${at}` })),
    );

    const admitted = settled.filter(
      (outcome): outcome is PromiseFulfilledResult<{ sessionToken?: string }> =>
        outcome.status === "fulfilled" && typeof (outcome.value as { sessionToken?: string })?.sessionToken === "string",
    );
    const refused = settled.filter((outcome) => outcome.status === "rejected");

    expect(
      admitted.length,
      `exactly one of ${RACERS} concurrent sign-ups on one address may create the account (R-SPINE-002: the address is ` +
        `the account's name). Outcomes: ${JSON.stringify(settled.map((outcome) => (outcome.status === "fulfilled" ? "session" : describeFailure(outcome.reason))))}`,
    ).toBe(1);

    for (const outcome of refused) {
      const failure = (outcome as PromiseRejectedResult).reason;
      expect(
        refusalOfFailure(failure),
        `a sign-up that lost the race to an address must be told the account already exists, not that the machine ` +
          `broke. This one carried no refusal marker, so src/server/trpc.ts files a FaultRecord and answers a fault ` +
          `id — the outage AC-1's seam-side guard exists to prevent (R-SPINE-007, R-SPINE-062, ARCH-03). It failed ` +
          `with: ${describeFailure(failure)}`,
      ).toBe("ACCOUNT_ALREADY_EXISTS");
    }

    expect(refused.length, "every caller past the winner is refused — none may be left without an answer").toBe(RACERS - 1);
  });

  test("the address that lost the race still signs in with the winner's password", async () => {
    const { auth } = await stage();
    const email = `race-live-${randomUUID()}@cubit.test`;

    const callers = await Promise.all(Array.from({ length: RACERS }, () => auth()));
    await Promise.allSettled(callers.map((caller, at) => caller["signUp"]?.({ email, password: PASSWORD, tenantName: `Race Live ${at}` })));

    // One account survives a race, and it is a working one: a rolled-back racer that left a half
    // account behind would answer here, not above.
    const answer = (await (await auth())["signIn"]?.({ email, password: PASSWORD })) as { sessionToken?: string };
    expect(typeof answer?.sessionToken, "the account a race left behind must be the one the winner created").toBe("string");
  });
});
