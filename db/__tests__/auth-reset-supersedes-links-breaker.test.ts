/**
 * Breaker acceptance for the password reset's reach (R-SPINE-001, R-SPINE-062, ARCH-03).
 *
 * R-SPINE-001 gives a reset one job beyond changing the password: "a reset revokes the account's
 * other sessions". The point of that clause is not bookkeeping — it is that after a reset, whoever
 * was holding the account on the strength of something issued *before* it is holding nothing. The
 * person doing the reset is doing it because they believe somebody else can get in.
 *
 * `src/server/auth/session.ts`'s `resetPassword` revokes the `sessions` rows and stops there. Every
 * `auth_tokens` row the account had outstanding when the reset happened is left live, and two of the
 * three kinds are credentials that hand out a session on their own:
 *
 *   - a magic-link token issued before the reset still answers `{ sessionToken }` after it, so the
 *     holder of an older mail walks straight back into the account the reset just swept;
 *   - a password-reset token issued before the reset still resets the password after it — and
 *     `resetPassword` revokes every session as it goes, so spending the older link takes the account
 *     *and* signs out the person who had just reset it. Their remedy did not hold.
 *
 * This file asserts only that floor: a reset ends the account's outstanding single-use links along
 * with its sessions. It says nothing about *how* — expiring them, consuming them, or scoping them to
 * a password generation are all cures — and it does not name a refusal code, only that whatever
 * answer the dead link gets is one the closed taxonomy registers, never an unmarked fault
 * (R-SPINE-062, ARCH-03).
 *
 * Product modules are loaded by absolute path and the database is the same self-provisioned scratch
 * every live suite uses, so this file judges the shipped seam and adds no second idea of the schema.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
const MAIL_MODULE = "src/server/auth/mail.ts";

const PASSWORD = "correct-horse-battery-staple-9";
const PASSWORD_AFTER = "the-password-the-person-chose-11";
const PASSWORD_STOLEN = "the-password-an-older-link-set-13";

/**
 * A loopback request, so `src/server/context.ts` gives the doors a real origin and the mailed links
 * are links rather than a recorded configuration outage.
 */
const REQUEST_URL = "http://localhost/api/trpc/spine.auth";

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface MailModule {
  outboxDir: () => string;
}

/** One mail, as `src/server/auth/mail.ts` writes it. */
interface OutboxMail {
  to?: unknown;
  kind?: unknown;
  token?: unknown;
}

interface Staged {
  cookie: string;
  outbox: () => string;
  auth(token?: string): Promise<AuthCaller>;
}

let staged: Promise<Staged> | null = null;
let scratch: { drop(): Promise<void> } | null = null;

afterAll(async () => {
  const held = scratch;
  scratch = null;
  if (held === null) return;
  // The scratch database is dropped `with (force)`, which terminates whatever the seam's pool still
  // holds; the pool is given a beat to go idle so no half-open connection rejects with nobody left
  // to catch it.
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

  const [root, context, mail] = await Promise.all([
    productModule<RootModule>(ROOT_MODULE),
    productModule<ContextModule>(CONTEXT_MODULE),
    productModule<MailModule>(MAIL_MODULE),
  ]);

  return {
    cookie,
    outbox: mail.outboxDir,
    auth: async (token?: string): Promise<AuthCaller> => {
      const headers = new Headers();
      if (token !== undefined) headers.set("cookie", `${cookie}=${token}`);
      const ctx = await context.createContext({ req: new Request(REQUEST_URL, { headers }) });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
}

/** A fresh address, so no run of this file can pass or fail on another run's rows or mail. */
function freshEmail(label: string): string {
  return `breaker-${label}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}@cubit.test`;
}

/** An account with a workspace of its own, and the session sign-up handed back. */
async function accountWith(email: string, label: string): Promise<string> {
  const { auth } = await stage();
  const anonymous = await auth();
  const answer = (await anonymous["signUp"]?.({ email, password: PASSWORD, tenantName: `Breaker ${label}` })) as { sessionToken?: string };
  expect(typeof answer?.sessionToken, "spine.auth.signUp answers { sessionToken } (increment interfaces)").toBe("string");
  return String(answer.sessionToken);
}

/** Every token the outbox holds for this address and kind, oldest first. */
function mailedTokens(directory: string, to: string, kind: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(directory, name))
    .map((path) => ({ path, at: statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? 0 }))
    .sort((one, two) => one.at - two.at)
    .map(({ path }) => readMail(path))
    .filter((mail): mail is OutboxMail => mail !== null)
    .filter((mail) => mail.to === to && mail.kind === kind)
    .map((mail) => String(mail.token ?? ""))
    .filter((token) => token !== "");
}

function readMail(path: string): OutboxMail | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as OutboxMail;
  } catch {
    // A mail being written as this reads it is not a mail this test is about.
    return null;
  }
}

/** The one token this door just mailed to this address — the door writes exactly one per call. */
async function mailedToken(door: "requestMagicLink" | "requestPasswordReset", email: string, kind: string): Promise<string> {
  const { auth, outbox } = await stage();
  const before = mailedTokens(outbox(), email, kind).length;
  const anonymous = await auth();
  await anonymous[door]?.({ email });

  const tokens = mailedTokens(outbox(), email, kind);
  expect(tokens.length, `spine.auth.${door} writes one JSON mail of kind "${kind}" into the outbox (AC-2, AC-3)`).toBe(before + 1);
  return String(tokens[tokens.length - 1]);
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

/** Assert a door refused, with a code the closed taxonomy registers rather than an unmarked fault. */
function expectRegisteredRefusal(settled: PromiseSettledResult<unknown>, story: string): void {
  if (settled.status === "fulfilled") {
    expect.fail(`${story} It answered instead: ${JSON.stringify(settled.value)}`);
  }
  expect(
    registeredCodeOf(settled.reason),
    `${story} It failed with something the closed taxonomy does not register, so src/server/trpc.ts reports it as ` +
      `a fault and the caller is handed a fault id (R-SPINE-062, ARCH-03): ${describeFailure(settled.reason)}`,
  ).not.toBeNull();
}

describe("BREAKER — a password reset ends the links the account had outstanding, not only its sessions", () => {
  test("a magic link issued before the reset no longer hands out a session after it", async () => {
    const email = freshEmail("magic");
    await accountWith(email, "magic");

    // Mailed before the reset — the very mail the person is resetting because somebody else may hold it.
    const older = await mailedToken("requestMagicLink", email, "magic-link");

    const resetToken = await mailedToken("requestPasswordReset", email, "password-reset");
    const { auth } = await stage();
    const anonymous = await auth();
    await anonymous["resetPassword"]?.({ token: resetToken, password: PASSWORD_AFTER });

    const [settled] = await Promise.allSettled([(await auth())["consumeMagicLink"]?.({ token: older })]);
    expectRegisteredRefusal(
      settled as PromiseSettledResult<unknown>,
      `a magic-link token mailed before the account's password was reset still answered { sessionToken } after it. ` +
        `R-SPINE-001 has a reset revoke the account's other sessions so that whoever held the account before it holds ` +
        `nothing after — and a live pre-reset magic link is a session for the asking, so the sweep is undone the ` +
        `moment it is spent.`,
    );
  });

  test("a reset link issued before the reset can no longer set the password after it", async () => {
    const email = freshEmail("reset");
    await accountWith(email, "reset");

    // Two reset links outstanding at once: the older is the one somebody else may be holding.
    const older = await mailedToken("requestPasswordReset", email, "password-reset");
    const newer = await mailedToken("requestPasswordReset", email, "password-reset");
    expect(older, "two requestPasswordReset calls must mint two different tokens").not.toBe(newer);

    const { auth } = await stage();
    await (await auth())["resetPassword"]?.({ token: newer, password: PASSWORD_AFTER });

    const [settled] = await Promise.allSettled([(await auth())["resetPassword"]?.({ token: older, password: PASSWORD_STOLEN })]);
    expectRegisteredRefusal(
      settled as PromiseSettledResult<unknown>,
      `a password-reset token mailed before the account's password was reset still reset it again afterwards. ` +
        `resetPassword revokes every session as it goes, so spending the older link takes the account and signs out ` +
        `the person who had just reset it — R-SPINE-001's reset is the remedy for exactly that situation, and here it ` +
        `did not hold.`,
    );

    const [signedIn] = await Promise.allSettled([(await auth())["signIn"]?.({ email, password: PASSWORD_AFTER })]);
    expect(
      signedIn?.status === "fulfilled",
      `the password the person set with their own reset link no longer signs them in: an older link overwrote it ` +
        `(R-SPINE-001). signIn answered: ${signedIn?.status === "rejected" ? describeFailure(signedIn.reason) : "—"}`,
    ).toBe(true);
  });
});
