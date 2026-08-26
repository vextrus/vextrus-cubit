/**
 * Breaker acceptance for the identity core's session doors (R-SPINE-001, R-SPINE-062, ARCH-03).
 *
 * The increment's own promise is that an auth failure a caller can reach is a registered refusal
 * and never an unmarked fault — "a DB constraint never reaches the caller raw". `spine.auth.
 * revokeSession` takes its id straight from the wire and hands it to a statement whose `session_id`
 * column is a uuid, so an id that is not a uuid is rejected by Postgres (22P02) rather than by the
 * seam: the caller is handed a fault id for presenting a value the door itself never checked.
 *
 * The settled reading for this door is that a session id which is not the caller's matches nothing
 * and answers `{ revoked: id }` — the predicate carries `user_id`, and the closed taxonomy holds no
 * code for "that session is not yours". A malformed id is the same fact with less standing: it can
 * match nothing either. This file therefore asserts only the floor the settled reading already
 * implies — the door answers, or it refuses with a *registered* code — and never that some
 * particular code must be given.
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
 * Session ids no uuid column can hold. The first is what a hand-written client sends; the second is
 * a uuid with one character wrong, which is what a truncated or mistyped id looks like.
 */
const MALFORMED_IDS = ["not-a-uuid", "00000000-0000-0000-0000-00000000000g"] as const;

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface Staged {
  cookie: string;
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
    cookie,
    auth: async (token?: string): Promise<AuthCaller> => {
      const headers = new Headers();
      if (token !== undefined) headers.set("cookie", `${cookie}=${token}`);
      const ctx = await context.createContext({ req: new Request("http://cubit.test/api/trpc/spine.auth", { headers }) });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
}

/** A signed-in caller with a workspace of its own, so no case can pass or fail on another's rows. */
async function signedIn(label: string): Promise<AuthCaller> {
  const { auth } = await stage();
  const anonymous = await auth();
  const answer = (await anonymous["signUp"]?.({
    email: `breaker-${label}-${Date.now().toString(36)}@cubit.test`,
    password: PASSWORD,
    tenantName: `Breaker ${label}`,
  })) as { sessionToken?: string };
  expect(typeof answer?.sessionToken, "spine.auth.signUp answers { sessionToken } (increment interfaces)").toBe("string");
  return auth(answer.sessionToken);
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

describe("BREAKER — revokeSession is answered, never faulted, for an id it cannot match", () => {
  for (const id of MALFORMED_IDS) {
    test(`spine.auth.revokeSession(${JSON.stringify(id)}) does not hand the caller an unmarked fault`, async () => {
      const auth = await signedIn("revoke");
      const [settled] = await Promise.allSettled([auth["revokeSession"]?.({ id })]);

      if (settled?.status === "fulfilled") return;

      const failure = (settled as PromiseRejectedResult).reason;
      expect(
        registeredCodeOf(failure),
        `revokeSession(${JSON.stringify(id)}) refused with something the closed taxonomy does not register, so ` +
          `src/server/trpc.ts reports it as a fault and the caller is handed a fault id for an id the door never ` +
          `checked (R-SPINE-062, ARCH-03). It failed with: ${describeFailure(failure)}`,
      ).not.toBeNull();
    });
  }

  test("the caller's own live session still lists after a malformed revoke was presented", async () => {
    const auth = await signedIn("survives");
    for (const id of MALFORMED_IDS) await Promise.allSettled([auth["revokeSession"]?.({ id })]);

    const rows = (await auth["listSessions"]?.()) as { current?: boolean }[];
    expect(Array.isArray(rows), "spine.auth.listSessions answers the account's sessions as rows").toBe(true);
    expect(rows.filter((row) => row.current === true), "an id the door could not match must revoke nothing, least of all the caller's own device").toHaveLength(1);
  });
});
