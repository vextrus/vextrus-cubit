/**
 * Breaker acceptance for the two password doors agreeing with each other (R-SPINE-001, R-SPINE-062).
 *
 * R-SPINE-001 gives cubit "email + password sign-up/sign-in". Those are two halves of one promise:
 * the value the sign-up door accepts as the account's password is the value the sign-in door admits
 * the account on. Today they disagree about one value a browser can send.
 *
 * `src/server/auth/router.ts` reads sign-up's password through `field` — which judges nothing — and
 * sign-in's through `credential`, which refuses a value that is blank once trimmed. A password of
 * one space therefore *creates* an account (the inputs carry the browser's own `required`, and to a
 * browser a space is a value — Decision I-13 bars the screen from inventing a rule that would stop
 * it), and then never signs anybody in: the door answers CREDENTIALS_NOT_VALID, "The email and
 * password do not match an account", for the exact pair that made it. A second sign-up on the same
 * address answers ACCOUNT_ALREADY_EXISTS, so the person cannot make it again either.
 *
 * Reproduced from the browser against the running app before it was written down: /sign-up with a
 * one-space password reaches "Check your email", and /sign-in with the same address and the same
 * space paints the CREDENTIALS_NOT_VALID refusal at [data-testid=s-auth-refusal].
 *
 * The floor asserted here is the agreement and nothing more: **either** the sign-up door refuses the
 * value with a code the closed taxonomy registers, **or** the sign-in door admits the account it
 * made. Both cures are open, neither is named, and no code is prescribed — so this contradicts
 * neither Decision I-13 nor the settled reading that a whitespace credential must never come back as
 * the fault card (tests/e2e/journeys/s-auth-whitespace-breaker.spec.ts), which both cures preserve.
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

/**
 * The passwords a browser can send that the two doors read differently. A single space is what a
 * slipped space bar leaves in the box; the second is what a mis-selected paste leaves behind. Both
 * satisfy the input's `required`, so both are sent.
 */
const WHITESPACE_PASSWORDS = [" ", "   "] as const;

const REQUEST_URL = "http://localhost/api/trpc/spine.auth";

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
      const ctx = await context.createContext({ req: new Request(REQUEST_URL, { headers }) });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
}

/** A fresh address, so no run of this file can pass or fail on another run's rows. */
function freshEmail(label: string): string {
  return `breaker-${label}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}@cubit.test`;
}

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

describe("BREAKER — a password sign-up accepts is a password sign-in admits", () => {
  for (const password of WHITESPACE_PASSWORDS) {
    test(`a password of ${password.length} space(s) is refused at sign-up or honoured at sign-in — never both`, async () => {
      const email = freshEmail(`parity-${password.length}`);
      const { auth } = await stage();

      const [created] = await Promise.allSettled([(await auth())["signUp"]?.({ email, password, tenantName: "Breaker Workspace" })]);

      if (created?.status === "rejected") {
        // The lawful other cure: the door that makes the credential refuses this one. It only has to
        // refuse it as an *answer* — an unmarked fault would tell the person the machine broke for a
        // password they typed (R-SPINE-007, R-SPINE-062).
        expect(
          registeredCodeOf(created.reason),
          `spine.auth.signUp refused a password of ${JSON.stringify(password)} with something the closed taxonomy ` +
            `does not register, so the caller is handed a fault id for a value they typed (R-SPINE-062, ARCH-03): ` +
            `${describeFailure(created.reason)}`,
        ).not.toBeNull();
        return;
      }

      // Sign-up accepted it, so the account exists and this pair is its password.
      const [admitted] = await Promise.allSettled([(await auth())["signIn"]?.({ email, password })]);

      expect(
        admitted?.status === "fulfilled" && typeof (admitted.value as { sessionToken?: unknown } | undefined)?.sessionToken === "string",
        `spine.auth.signUp created the account on the password ${JSON.stringify(password)} and spine.auth.signIn then ` +
          `refused the very same address and password. The person is told "The email and password do not match an ` +
          `account" about the account they just made, and a second sign-up answers ACCOUNT_ALREADY_EXISTS, so the ` +
          `password door is shut on them for good (R-SPINE-001). The browser sends this: the fields carry the ` +
          `browser's own \`required\`, which a space satisfies, and Decision I-13 bars the screen from inventing a ` +
          `rule that would stop it. signIn answered: ` +
          `${admitted?.status === "rejected" ? describeFailure(admitted.reason) : JSON.stringify(admitted?.value)}`,
      ).toBe(true);
    });
  }
});
