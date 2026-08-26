/**
 * Breaker acceptance for what a password reset actually ends, and for the pair sign-up/sign-in make
 * of one address (R-SPINE-001, R-SPINE-002, R-SPINE-062).
 *
 * R-SPINE-001 states the reset with its consequence attached: "password reset (a reset revokes the
 * account's other sessions)". The clause is written that way because a reset is what a person does
 * when the account's other holders must stop holding it — the revocation is the point of the act,
 * not a side effect of it. `resetPassword` does revoke every `sessions` row, and this file does not
 * doubt that; what it asks is whether the *other* bearer credentials the account has outstanding —
 * an unspent reset link, an unspent magic link — survive the act that exists to end exactly this.
 * Each of them mints a session on demand, so a reset that leaves one standing has revoked the
 * account's sessions and left behind the means to make another.
 *
 * The third case is about the pair R-SPINE-001 names first: "email + password sign-up/sign-in". An
 * address the one user-creating door (R-SPINE-002) will build an account under must be an address
 * the sign-in door will look one up under. This file asserts only that floor — either ending is
 * lawful, and it never says which the doors must take.
 *
 * Product modules are loaded by absolute path and the database is the same self-provisioned scratch
 * every live suite uses, so this file judges the shipped seam and adds no second idea of the schema.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
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

/** The outbox the increment's interfaces place the mail in. */
const OUTBOX_DIR = "storage/mail-outbox";

const PASSWORD = "correct-horse-battery-staple-9";

/** How long a mail written after the door has already answered is waited for. */
const MAIL_WAIT_MS = 10_000;
const MAIL_POLL_MS = 50;

type Procedure = (input?: unknown) => Promise<unknown>;
type AuthCaller = Record<string, Procedure>;

interface RootModule {
  appRouter: { createCaller: (ctx: unknown) => unknown };
}

interface ContextModule {
  createContext: (opts: { req: Request }) => unknown;
}

interface Mail {
  to: string;
  kind: string;
  token: string;
}

interface Staged {
  cookie: string;
  outboxDir: string;
  auth(token?: string): Promise<AuthCaller>;
}

let staged: Promise<Staged> | null = null;
let scratch: { drop(): Promise<void> } | null = null;

afterAll(async () => {
  const held = scratch;
  scratch = null;
  if (held === null) return;
  // The scratch database is dropped `with (force)`, which terminates whatever the seam's pool still
  // holds; the pool is given a beat to go idle first so nothing rejects on a closed socket.
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

  const mail = await productModule<Record<string, unknown>>(MAIL_MODULE);
  const outbox = String(mail["MAIL_OUTBOX_DIR"] ?? "");
  expect(outbox, `${MAIL_MODULE} exports MAIL_OUTBOX_DIR = "${OUTBOX_DIR}" (increment interfaces)`).toBe(OUTBOX_DIR);

  const db = await provisionScratchDb();
  scratch = db;
  process.env["DATABASE_URL"] = db.urlApp;

  const [root, context] = await Promise.all([productModule<RootModule>(ROOT_MODULE), productModule<ContextModule>(CONTEXT_MODULE)]);

  return {
    cookie,
    outboxDir: isAbsolute(outbox) ? outbox : join(REPO_ROOT, outbox),
    auth: async (token?: string): Promise<AuthCaller> => {
      const headers = new Headers();
      if (token !== undefined) headers.set("cookie", `${cookie}=${token}`);
      const ctx = await context.createContext({ req: new Request("http://cubit.test/api/trpc/spine.auth", { headers }) });
      const caller = root.appRouter.createCaller(ctx) as { spine: { auth: AuthCaller } };
      return caller.spine.auth;
    },
  };
}

/* ------------------------------------------------------------------ *
 * The outbox, as this file reads it.
 * ------------------------------------------------------------------ */

function delivered(s: Staged): Mail[] {
  if (!existsSync(s.outboxDir)) return [];
  return readdirSync(s.outboxDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => join(s.outboxDir, name))
    .map((path) => ({ path, at: statSync(path).mtimeMs }))
    .sort((a, b) => b.at - a.at)
    .map((file) => JSON.parse(readFileSync(file.path, "utf8")) as Mail);
}

/**
 * The token of the newest mail of this kind for this address that is not one already held. Waited
 * for rather than assumed: the mailing doors answer before the file is on disk.
 */
async function freshToken(s: Staged, to: string, kind: string, seen: readonly string[]): Promise<string> {
  const deadline = Date.now() + MAIL_WAIT_MS;
  for (;;) {
    const found = delivered(s).find((mail) => mail.to === to && mail.kind === kind && !seen.includes(mail.token));
    if (found !== undefined) return found.token;
    expect(Date.now() <= deadline, `no fresh "${kind}" mail for ${to} reached ${s.outboxDir} within ${MAIL_WAIT_MS}ms`).toBe(true);
    await new Promise((wake) => setTimeout(wake, MAIL_POLL_MS));
  }
}

/* ------------------------------------------------------------------ *
 * Accounts, answers and failures.
 * ------------------------------------------------------------------ */

/** A brand-new account with a workspace of its own, so no case can pass or fail on another's rows. */
async function account(label: string): Promise<{ email: string; anonymous: AuthCaller }> {
  const { auth } = await stage();
  const anonymous = await auth();
  const email = `breaker-${label}-${Date.now().toString(36)}@cubit.test`;
  const answer = (await anonymous["signUp"]?.({ email, password: PASSWORD, tenantName: `Breaker ${label}` })) as { sessionToken?: string };
  expect(typeof answer?.sessionToken, "spine.auth.signUp answers { sessionToken } (increment interfaces)").toBe("string");
  return { email, anonymous };
}

/** What the failure carries, in the words the operator would read on the record. */
function describeFailure(failure: unknown): string {
  const bag = failure as { name?: unknown; code?: unknown; message?: unknown; cause?: { code?: unknown } };
  return JSON.stringify({ name: bag?.name, code: bag?.code, causeCode: bag?.cause?.code, message: String(bag?.message ?? "").slice(0, 240) });
}

/** The marker as the settled core reader sees it — the value or its direct cause. */
function registeredCodeOf(failure: unknown): string | null {
  const code = refusalCodeOf(failure) ?? refusalCodeOf((failure as { cause?: unknown } | null)?.cause);
  return code !== null && Object.hasOwn(REFUSALS, code) ? code : null;
}

/** How a door ended: with the value it answered, or with the failure it threw. */
type Ending = { answered: true; value: unknown } | { answered: false; failure: unknown };

async function ending(work: Promise<unknown> | undefined): Promise<Ending> {
  try {
    return { answered: true, value: await work };
  } catch (failure) {
    return { answered: false, failure };
  }
}

/** The session token a door answered with, or nothing — a door that refused handed out no session. */
function sessionTokenOf(end: Ending): string | null {
  if (!end.answered) return null;
  const token = (end.value as { sessionToken?: unknown } | null)?.sessionToken;
  return typeof token === "string" && token !== "" ? token : null;
}

/**
 * The floor every door in this file is held to when it does not answer: a caller who presents a
 * credential the door will not honour is owed a *registered* refusal, never a fault id.
 */
function refusedWithARegisteredCode(end: Ending, why: string): void {
  expect(end.answered, `${why} — the door answered instead of refusing`).toBe(false);
  if (end.answered) return;
  expect(registeredCodeOf(end.failure), `${why}, and the refusal must be registered rather than an unmarked fault — got ${describeFailure(end.failure)}`).not.toBeNull();
}

/* ------------------------------------------------------------------ *
 * 1. A reset and the account's other outstanding links.
 * ------------------------------------------------------------------ */

describe("BREAKER — a password reset ends the account's other outstanding credentials (R-SPINE-001)", () => {
  test("an older reset link cannot set a second password after the account's owner has completed a reset", async () => {
    const s = await stage();
    const { email, anonymous } = await account("two-links");

    // A person who does not see the first mail arrive asks again. Both links are live, and the one
    // they act on is the newest — which is what the product's own TOKEN_NOT_VALID remedy tells them
    // to do ("Request a fresh link and use the newest email").
    await anonymous["requestPasswordReset"]?.({ email });
    const older = await freshToken(s, email, "password-reset", []);
    await anonymous["requestPasswordReset"]?.({ email });
    const newest = await freshToken(s, email, "password-reset", [older]);
    expect(newest, "two requests for a reset link mint two different tokens").not.toBe(older);

    const owner = "chosen-by-the-account-owner-4";
    const completed = await ending(anonymous["resetPassword"]?.({ token: newest, password: owner }));
    expect(sessionTokenOf(completed), "spine.auth.resetPassword answers { sessionToken } for a live link (increment interfaces)").not.toBeNull();

    // The reset is done: the account has a password its owner chose, and every session it held was
    // revoked. The older link is a credential minted *before* that act, and spending it now sets a
    // password the owner never chose and locks them out of the account they just recovered.
    const stale = await ending(anonymous["resetPassword"]?.({ token: older, password: "chosen-by-somebody-else-7" }));
    refusedWithARegisteredCode(
      stale,
      "a reset link minted before a completed reset must no longer set this account's password (R-SPINE-001: a reset is what ends the account's other holds on itself)",
    );

    const back = await ending(anonymous["signIn"]?.({ email, password: owner }));
    expect(sessionTokenOf(back), "the password the completed reset set is still the account's password — no older link replaced it").not.toBeNull();
  });

  test("a magic link minted before a reset hands out no session after it", async () => {
    const s = await stage();
    const { email, anonymous } = await account("link-then-reset");

    await anonymous["requestMagicLink"]?.({ email });
    const magic = await freshToken(s, email, "magic-link", []);
    await anonymous["requestPasswordReset"]?.({ email });
    const reset = await freshToken(s, email, "password-reset", []);

    const completed = await ending(anonymous["resetPassword"]?.({ token: reset, password: "chosen-by-the-account-owner-5" }));
    expect(sessionTokenOf(completed), "spine.auth.resetPassword answers { sessionToken } for a live link (increment interfaces)").not.toBeNull();

    // R-SPINE-001's reset revokes the account's other sessions. A magic link is a session that has
    // not been claimed yet — it mints one on demand, for anybody holding the mail — so a reset that
    // leaves it live has ended the sessions and left the means of making another.
    const spent = await ending(anonymous["consumeMagicLink"]?.({ token: magic }));
    expect(sessionTokenOf(spent), "a magic link minted before a password reset must not hand out a session after it (R-SPINE-001)").toBeNull();
    refusedWithARegisteredCode(spent, "a magic link a reset has invalidated is refused with a registered code, never a fault id (R-SPINE-062)");
  });
});

/* ------------------------------------------------------------------ *
 * 2. The pair sign-up/sign-in make of one address.
 * ------------------------------------------------------------------ */

describe("BREAKER — an account the one door creates is an account the sign-in door can find (R-SPINE-001, R-SPINE-002)", () => {
  /**
   * An address that is nothing once the account's own normalisation (trim and fold) has run. One
   * case, not a table: every such value names the same account, so a second case in the same
   * database would only ever meet the first one's row.
   */
  const EMPTY_ADDRESS = "   ";

  test(`spine.auth.signUp(${JSON.stringify(EMPTY_ADDRESS)}) either refuses, or creates an account spine.auth.signIn can still find`, async () => {
    const { auth } = await stage();
    const anonymous = await auth();

    const created = await ending(anonymous["signUp"]?.({ email: EMPTY_ADDRESS, password: PASSWORD, tenantName: "Breaker empty address" }));

    // Either ending is lawful and this file names neither: the door may judge the address it is
    // asked to name an account after, or it may take what it was given. What may not happen is both
    // — a user, a personal tenant and a membership written under an address the sign-in door will
    // not look an account up under. R-SPINE-001 states sign-up and sign-in as one pair, and an
    // account that door cannot reach can never be signed into again, nor created again: a second
    // attempt on the same address answers ACCOUNT_ALREADY_EXISTS.
    if (!created.answered) {
      refusedWithARegisteredCode(created, "a sign-up the door declines is a registered refusal, never an unmarked fault (R-SPINE-062)");
      return;
    }

    expect(sessionTokenOf(created), "spine.auth.signUp answers { sessionToken } (increment interfaces)").not.toBeNull();
    const back = await ending(anonymous["signIn"]?.({ email: EMPTY_ADDRESS, password: PASSWORD }));
    expect(
      sessionTokenOf(back),
      `spine.auth.signUp created an account under ${JSON.stringify(EMPTY_ADDRESS)}, so spine.auth.signIn with the same address and password must find it — ` +
        `otherwise the account, its personal tenant and its membership are stranded, and the address cannot be signed up again either (R-SPINE-001, R-SPINE-002) — got ${
          back.answered ? JSON.stringify(back.value) : describeFailure(back.failure)
        }`,
    ).not.toBeNull();
  });
});
