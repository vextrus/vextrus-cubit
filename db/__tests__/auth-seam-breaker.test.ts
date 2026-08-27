/**
 * Breaker acceptance for the identity doors' input reader (R-SPINE-001, R-SPINE-007, R-SPINE-062,
 * ARCH-03/B-21).
 *
 * The increment's promise is that an auth failure a caller can reach is a registered refusal and
 * never an unmarked fault. `src/server/auth/router.ts` reads each named field through a helper that
 * rejects any string whose `.trim()` is empty, and it rejects it by throwing a plain `Error`. That
 * value carries no refusal marker, so `src/server/trpc.ts` files a FaultRecord and answers a fault
 * id: the caller is told the machine broke, and the operator gets an outage record, for a password
 * the person typed as a space.
 *
 * A blank field is a different case and is already settled: the browser's own requiredness stops a
 * blank submit before it is sent, so the door never sees it. Requiredness cannot stop this one. A
 * single space is a value as far as `required` is concerned, and the screens may not invent a rule
 * that would stop it — the Design Decision (I-13) bans a screen judging a credential, which is
 * exactly what a "no whitespace-only password" rule on the input would be. The judging belongs to
 * the door, and a password of one space is a password that identifies no account: the answer the
 * closed taxonomy already registers for that is CREDENTIALS_NOT_VALID.
 *
 * This file asserts only the floor the law states and never a particular code — the door may answer,
 * or it may refuse with a *registered* code, but it may not hand the caller an unmarked fault for a
 * credential it simply never judged. It is deliberately silent on what a whitespace-only *workspace
 * name* should do, which no registered code speaks to.
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

/**
 * Passwords the browser's own `required` admits and the door's reader does not. The first is what a
 * person leaves behind when they touch the space bar before submitting; the second is what a
 * password manager pastes when the field it copied from held only whitespace.
 */
const BLANK_LOOKING_PASSWORDS = [" ", "   "] as const;

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

/** An account that exists, so a wrong password is judged against a real stored one. */
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
function expectAnsweredOrRegistered(settled: PromiseSettledResult<unknown>, door: string, presented: string): void {
  if (settled.status === "fulfilled") return;

  const failure = (settled as PromiseRejectedResult).reason;
  expect(
    registeredCodeOf(failure),
    `${door} with a password of ${JSON.stringify(presented)} failed with something the closed taxonomy does not ` +
      `register, so src/server/trpc.ts reports it as a fault: the person is shown the fault card telling them the ` +
      `machine broke and is given a fault id to quote, and the operator gets a FaultRecord — for a credential the ` +
      `door never judged (R-SPINE-007, R-SPINE-062, ARCH-03). A blank field is stopped by the browser's own ` +
      `requiredness, but a space is a value that requiredness admits and no screen may lawfully reject (I-13). ` +
      `It failed with: ${describeFailure(failure)}`,
  ).not.toBeNull();
}

describe("BREAKER — a whitespace-only credential is judged, never reported as an outage", () => {
  for (const password of BLANK_LOOKING_PASSWORDS) {
    test(`spine.auth.signIn with a password of ${JSON.stringify(password)} does not hand the caller an unmarked fault`, async () => {
      const { auth } = await stage();
      const email = await registered("sign-in");
      const anonymous = await auth();

      const [settled] = await Promise.allSettled([anonymous["signIn"]?.({ email, password })]);
      expectAnsweredOrRegistered(settled!, "spine.auth.signIn", password);
    });
  }

  test("spine.auth.signUp with a whitespace-only password does not hand the caller an unmarked fault", async () => {
    const { auth } = await stage();
    const anonymous = await auth();

    const [settled] = await Promise.allSettled([anonymous["signUp"]?.({ email: freshEmail("sign-up"), password: " ", tenantName: "Breaker" })]);
    expectAnsweredOrRegistered(settled!, "spine.auth.signUp", " ");
  });

  test("the door still judges a real credential after a whitespace one was presented", async () => {
    const { auth } = await stage();
    const email = await registered("still-judges");
    const anonymous = await auth();

    await Promise.allSettled([anonymous["signIn"]?.({ email, password: " " })]);

    const answer = (await anonymous["signIn"]?.({ email, password: PASSWORD })) as { sessionToken?: string };
    expect(typeof answer?.sessionToken, "a whitespace-only attempt must leave the account signable-in").toBe("string");
  });
});
