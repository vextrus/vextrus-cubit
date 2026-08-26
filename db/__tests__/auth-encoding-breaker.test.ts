/**
 * Breaker acceptance for the identity doors' *identifying* and *mailing* halves, on an address the
 * database cannot store (R-SPINE-001, R-SPINE-007, R-SPINE-062, ARCH-03/B-21).
 *
 * AC-2 states the floor in plain words: "signIn with a wrong password or unknown email answers the
 * registered refusal CREDENTIALS_NOT_VALID — an answer, never a fault." An address carrying a NUL
 * (U+0000) is an unknown email in the strongest sense available: postgres `text` cannot hold the
 * byte at all, so no `users` row can ever carry that address and no account can ever be named by
 * it. The door is asked about a value that names nobody, which is exactly the case the closed
 * taxonomy registers CREDENTIALS_NOT_VALID for.
 *
 * What happens instead is that the value reaches the driver. The rate limiter is the first to carry
 * it down: `rate-limit.ts`'s `keyed` folds an over-long identity to a digest but passes every other
 * value through, so the address goes into the advisory lock's own parameter — the observed failure
 * is `Failed query: select pg_advisory_xact_lock(hashtextextended($1, 0))` — and `users.email` would
 * refuse it next. Postgres answers an error carrying no refusal marker. `src/server/trpc.ts` therefore
 * files a FaultRecord and answers a fault id: the person is shown the fault card saying the machine
 * broke on our side, and the operator gets an outage record, for an address the door never looked
 * up. That is the trap the increment named for itself — "a DB constraint never reaches the caller
 * raw" — reached through the value's encoding rather than through a constraint.
 *
 * The seam already holds the answer this case wants, one function away. `session.ts`'s
 * `accountAddress` bounds an address at 254 octets for the same reason and reasons it out in the
 * same words: a value too long "names no account and can never become one, on either door", so both
 * doors answer CREDENTIALS_NOT_VALID rather than letting postgres refuse the btree row as an
 * unmarked 54000. A NUL is that fact again, and it is not caught.
 *
 * Scope, deliberately narrow:
 *
 *   - Only the doors that *identify* somebody (`signIn`) and the two that *mail* a link, where the
 *     lawful answer is already settled and already written down — CREDENTIALS_NOT_VALID for the
 *     first, the same non-disclosing `{ sent: true }` an unknown address gets for the other two.
 *   - Nothing here is asserted about `signUp`, `resetPassword` or a workspace name. Design Decision
 *     I-14 rules that a door which *creates* an account or *sets* a password judges nothing about
 *     what a string says, and this file does not reopen that: it asks nothing of a creating door.
 *   - No particular code is demanded. The floor is only that the caller is answered, or refused
 *     with a code the closed taxonomy registers — never handed a fault id for a value the door
 *     never judged.
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

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The homes the increment's interfaces name. */
const ROOT_MODULE = "src/server/root.ts";
const CONTEXT_MODULE = "src/server/context.ts";
const SESSION_MODULE = "src/server/auth/session.ts";

const PASSWORD = "correct-horse-battery-staple-9";

/** The byte no `text` column can hold, written as an escape so the file itself stays readable. */
const NUL = "\u0000";

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

/** The same address with the unstorable byte in it — still an address shape, still nobody's. */
function unstorableEmail(label: string): string {
  return `breaker-${label}${NUL}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@cubit.test`;
}

/** An account that exists, so the doors under test are exercised against a live table, not an empty one. */
async function registered(label: string): Promise<string> {
  const { auth } = await stage();
  const anonymous = await auth();
  const email = freshEmail(label);
  const answer = (await anonymous["signUp"]?.({ email, password: PASSWORD, tenantName: `Breaker ${label}` })) as { sessionToken?: string };
  expect(typeof answer?.sessionToken, "spine.auth.signUp answers { sessionToken } (increment interfaces)").toBe("string");
  return email;
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

/** The floor: the door answered, or it refused with a code the closed taxonomy registers. */
function expectAnsweredOrRegistered(settled: PromiseSettledResult<unknown>, door: string): void {
  if (settled.status === "fulfilled") return;

  const failure = (settled as PromiseRejectedResult).reason;
  expect(
    registeredCodeOf(failure),
    `${door} was asked about an address carrying a NUL and failed with something the closed taxonomy does not ` +
      `register, so src/server/trpc.ts reports it as a fault: the person is shown the fault card telling them the ` +
      `machine broke on our side and is given a fault id to quote, and the operator gets a FaultRecord — for an ` +
      `address the door never looked up (R-SPINE-007, R-SPINE-062, ARCH-03). No postgres text column can hold a ` +
      `NUL, so that address names no account and can never name one: it is an unknown email, and AC-2 says an ` +
      `unknown email is answered, never faulted. The seam already reaches this conclusion one function away — ` +
      `session.ts's accountAddress refuses an over-long address with CREDENTIALS_NOT_VALID for exactly this ` +
      `reason. It failed with: ${describeFailure(failure)}`,
  ).not.toBeNull();
}

describe("BREAKER — an address the database cannot store is judged, never reported as an outage", () => {
  test("spine.auth.signIn with a NUL in the address does not hand the caller an unmarked fault", async () => {
    const { auth } = await stage();
    await registered("encoding-sign-in");
    const anonymous = await auth();

    const [settled] = await Promise.allSettled([anonymous["signIn"]?.({ email: unstorableEmail("sign-in"), password: PASSWORD })]);
    expectAnsweredOrRegistered(settled!, "spine.auth.signIn");
  });

  test("spine.auth.requestMagicLink with a NUL in the address does not hand the caller an unmarked fault", async () => {
    const { auth } = await stage();
    const anonymous = await auth();

    const [settled] = await Promise.allSettled([anonymous["requestMagicLink"]?.({ email: unstorableEmail("magic-link") })]);
    expectAnsweredOrRegistered(settled!, "spine.auth.requestMagicLink");
  });

  test("spine.auth.requestPasswordReset with a NUL in the address does not hand the caller an unmarked fault", async () => {
    const { auth } = await stage();
    const anonymous = await auth();

    const [settled] = await Promise.allSettled([anonymous["requestPasswordReset"]?.({ email: unstorableEmail("password-reset") })]);
    expectAnsweredOrRegistered(settled!, "spine.auth.requestPasswordReset");
  });

  test("the door still judges a real credential after an unstorable address was presented", async () => {
    const { auth } = await stage();
    const email = await registered("encoding-still-judges");
    const anonymous = await auth();

    await Promise.allSettled([anonymous["signIn"]?.({ email: unstorableEmail("still-judges"), password: PASSWORD })]);

    const answer = (await anonymous["signIn"]?.({ email, password: PASSWORD })) as { sessionToken?: string };
    expect(typeof answer?.sessionToken, "an unstorable address must leave the account signable-in").toBe("string");
  });
});
