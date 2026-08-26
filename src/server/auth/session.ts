// R-SPINE-001 and R-SPINE-002's doors, and their one home (B-17, ARCH-02): every way a person can
// come to hold a session, every way one ends, and the list of the ones they hold. The procedures in
// `./router.ts` are a thin transport over these — nothing here knows about tRPC, a Request or a
// cookie jar, so `../context.ts` can resolve a cookie through `resolveSession` without this file
// ever importing it back (ARCH-01's no-cycle rule).
//
// Every statement runs through `runAsSystem(reason)`: identity is not tenant-scoped (a person is
// one account across every workspace), and the membership row this writes is admitted by the
// tenancy migration's system policy with the reason recorded beside it (SEAM-TENANT).
import {
  and,
  asc,
  eq,
  gt,
  isNull,
  isUuid,
  lt,
  memberships,
  runAsSystem,
  sessions,
  tenants,
  users,
  type SystemDb,
  type TenantTx,
} from "../../core/db";
import { deliver } from "./mail";
import { admitAttempt } from "./rate-limit";
import { accountAlreadyExists, credentialsNotValid } from "./refusals";
import { absorbPassword, digestOf, hashPassword, mintSecret, verifyPassword } from "./secrets";
import { consumeToken, issueToken, TOKEN_KINDS, type AuthTokenPurpose } from "./tokens";

/** The cookie a session travels in, named once (ARCH-02, R-SPINE-001). */
export const SESSION_COOKIE = "cubit_session";

/**
 * How long a session is live for, counted from when it began — the server's own bound, and the one
 * the cookie's Max-Age is derived from rather than the other way round. A Max-Age is a request to a
 * browser: a token copied out of a cookie jar, or replayed from a capture, is presented by something
 * that never agreed to it, so a lifetime only the browser keeps is no lifetime at all. Thirty days
 * is long enough that a person who uses the product weekly is never signed out mid-work.
 */
export const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/** The moment a session must have begun after to still be live. */
function liveSince(): Date {
  return new Date(Date.now() - SESSION_LIFETIME_MS);
}

/** The longest a device label may be, so a caller cannot make the list unreadable (see `deviceLabelFrom`). */
const DEVICE_LABEL_MAX = 48;

/** Who a live session belongs to: the row that proves it, and the account it proves. */
export interface AuthSession {
  sessionId: string;
  userId: string;
}

/** What a door that hands out a session answers with. */
export interface SessionAnswer {
  sessionToken: string;
}

/** One row of the device list R-SPINE-001 owes a person: what it is, when it began, and if it is here. */
export interface SessionRow {
  id: string;
  deviceLabel: string;
  createdAt: string;
  current: boolean;
}

/** Where each mailed link points. One route per purpose; the token rides in the query. */
const LINK_PATHS: Readonly<Record<AuthTokenPurpose, string>> = Object.freeze({
  verifyEmail: "/verify",
  magicLink: "/magic-link",
  passwordReset: "/reset",
});

/**
 * The address is the account's name, so it is one name: addresses are compared and stored folded and
 * trimmed, or the same person would hold two accounts by capitalising differently.
 */
function normalisedEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * What a device is called in the list. Derived from the user agent because the alternative is asking
 * the person to name their own laptop; when the agent says nothing recognisable the raw product
 * token is still more use than a blank, and a request with no agent at all is an unnamed device
 * rather than an unlabelled row — R-SPINE-001's list has to say something about every session.
 *
 * The header is the caller's to write, so the label it yields is cut to `DEVICE_LABEL_MAX`: a device
 * list is a thing a person reads, and an unbounded caller-chosen string stored per sign-in would let
 * anybody make their own list — the very list revoke is driven from — unreadable.
 */
export function deviceLabelFrom(userAgent: string | null | undefined): string {
  return clipped(namedDevice(userAgent));
}

/** The label, cut to a length a row can show. */
function clipped(label: string): string {
  return label.length <= DEVICE_LABEL_MAX ? label : `${label.slice(0, DEVICE_LABEL_MAX - 1).trimEnd()}…`;
}

function namedDevice(userAgent: string | null | undefined): string {
  const agent = (userAgent ?? "").trim();
  if (agent === "") return "Unknown device";

  const browser = ["Firefox", "Edg", "Chrome", "Chromium", "Safari"].find((name) => agent.includes(name));
  const platform = (
    [
      ["Android", "Android"],
      ["iPhone", "iOS"],
      ["iPad", "iPadOS"],
      ["Mac OS X", "macOS"],
      ["Windows", "Windows"],
      ["Linux", "Linux"],
    ] as const
  ).find(([needle]) => agent.includes(needle));

  if (browser === undefined) return (agent.split(/[\s/]/)[0] ?? "").trim() || "Unknown device";
  const named = browser === "Edg" ? "Edge" : browser === "Chromium" ? "Chrome" : browser;
  return platform === undefined ? named : `${named} on ${platform[1]}`;
}

/* ------------------------------------------------------------------ *
 * Sessions themselves.
 * ------------------------------------------------------------------ */

/** The handles a session may be written through: a system-scoped one, or a transaction's own. */
type Writer = SystemDb | TenantTx;

/**
 * Start a session for this account. The token is minted here and answered once; the row holds only
 * its digest, so revoking a device is the whole story of ending it — nobody, including this tree,
 * can read a live token back out of the table.
 */
async function startSession(db: Writer, userId: string, deviceLabel: string): Promise<SessionAnswer> {
  // A session past its lifetime can never be resolved again, so the row is only a row nobody will
  // ever read. Cleared here, scoped to the one account this write is already about: the table would
  // otherwise grow by one row per sign-in for ever, with nothing in the tree to prune it.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.createdAt, liveSince())));

  const sessionToken = mintSecret();
  await db.insert(sessions).values({ userId, tokenHash: digestOf(sessionToken), deviceLabel });
  return { sessionToken };
}

/**
 * Who this cookie is, or nobody. A revoked, expired or unknown token resolves to null and the caller
 * answers SIGNED_OUT — the refusal is the transport's to make, because "no session" is not a failure
 * of this lookup. The lifetime is read here rather than trusted to the cookie: the predicate is what
 * makes a session end, so a token presented by anything other than the browser it was set on expires
 * too. The row's last-seen is stamped by the same statement that reads it, so the device list says
 * when a device was last here without a second round trip.
 */
export async function resolveSession(sessionToken: string): Promise<AuthSession | null> {
  if (sessionToken.trim() === "") return null;
  const db = runAsSystem("R-SPINE-001 session resolution: which account a presented cubit_session cookie belongs to");
  const live = await db
    .update(sessions)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(sessions.tokenHash, digestOf(sessionToken)), isNull(sessions.revokedAt), gt(sessions.createdAt, liveSince())))
    .returning({ sessionId: sessions.sessionId, userId: sessions.userId });
  return live[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * R-SPINE-002: the one user-creating door.
 * ------------------------------------------------------------------ */

export interface SignUpRequest {
  email: string;
  password: string;
  tenantName: string;
  deviceLabel: string;
  origin: string;
}

/**
 * R-SPINE-002, in one transaction: the account, the personal workspace it is created with, and the
 * membership joining the two. There is no other door — no vendor endpoint is mounted — so an account
 * that belongs nowhere is unrepresentable rather than merely discouraged: if any of the three writes
 * is refused, none of them survives.
 *
 * The address is guarded inside the transaction *and* the unique index is read as an answer, because
 * a check before an insert is a race and a constraint violation reaching the caller is an unmarked
 * fault — a person who simply already has an account would be handed a fault id instead of being
 * told to sign in (R-SPINE-007).
 */
export async function signUp(request: SignUpRequest): Promise<SessionAnswer> {
  const email = normalisedEmail(request.email);
  await admitAttempt("signUp", email);

  // Derived before the transaction opens: scrypt is deliberately slow, and a transaction holding a
  // connection through it would be holding it for nothing.
  const passwordHash = await hashPassword(request.password);
  const db = runAsSystem("R-SPINE-002 sign-up: the account, its personal workspace and the membership joining them, written as one transaction");

  const created = await createAccount(db, { email, passwordHash, tenantName: request.tenantName, deviceLabel: request.deviceLabel });

  // Sent only once the transaction has committed: a mail for an account that was rolled back is a
  // link nobody can follow.
  mail(request.origin, email, "verifyEmail", created.verifyToken);
  return { sessionToken: created.sessionToken };
}

interface NewAccount {
  email: string;
  passwordHash: string;
  tenantName: string;
  deviceLabel: string;
}

async function createAccount(db: SystemDb, account: NewAccount): Promise<{ sessionToken: string; verifyToken: string }> {
  try {
    return await db.transaction(async (tx) => {
      const taken = await tx.select({ userId: users.userId }).from(users).where(eq(users.email, account.email)).limit(1);
      if (taken.length > 0) throw accountAlreadyExists();

      const [user] = await tx.insert(users).values({ email: account.email, passwordHash: account.passwordHash }).returning({ userId: users.userId });
      if (user === undefined) throw new Error("the sign-up transaction inserted no account row");

      const [tenant] = await tx.insert(tenants).values({ name: account.tenantName }).returning({ tenantId: tenants.tenantId });
      if (tenant === undefined) throw new Error("the sign-up transaction inserted no workspace row");

      await tx.insert(memberships).values({ tenantId: tenant.tenantId, userId: user.userId });

      const verifyToken = await issueToken(tx, user.userId, "verifyEmail");
      const { sessionToken } = await startSession(tx, user.userId, account.deviceLabel);
      return { sessionToken, verifyToken };
    });
  } catch (failure) {
    // The unique index is the belt the seam-side guard wears: two sign-ups racing one address reach
    // here, and both deserve the registered answer rather than one of them getting a fault id.
    if (isUniqueViolation(failure)) throw accountAlreadyExists();
    throw failure;
  }
}

/** A duplicate key, as postgres reports it through the driver — the one constraint a user can reach. */
function isUniqueViolation(failure: unknown): boolean {
  const cause = (failure as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause === "object" && cause !== null && cause.code === "23505";
}

/* ------------------------------------------------------------------ *
 * Signing in, and the two ways to do it without a password.
 * ------------------------------------------------------------------ */

export interface SignInRequest {
  email: string;
  password: string;
  deviceLabel: string;
}

/**
 * A password sign-in. A wrong password and an address with no account are the same answer: the door
 * exists to admit people, not to say who is registered.
 *
 * Verification is not a gate here. The closed taxonomy (R-SPINE-062) registers no code for "this
 * address is not verified yet", and inventing an unregistered answer — or dressing the refusal as a
 * wrong credential — are both worse than admitting the account that just proved it holds the
 * password. A gate on verification is a refusal, and a refusal needs a registered code to be given.
 *
 * Sameness here is wall-clock as well as textual. Deriving a password is deliberately expensive, so
 * a door that skipped the derivation for an address it found no account for would answer an unknown
 * address measurably sooner than a wrong password — the same enumeration the identical answer exists
 * to prevent, read off a stopwatch instead. An address with no account pays the derivation anyway.
 */
export async function signIn(request: SignInRequest): Promise<SessionAnswer> {
  const email = normalisedEmail(request.email);
  await admitAttempt("signIn", email);

  const db = runAsSystem("R-SPINE-001 sign-in: matching a presented address and password against the account it names");
  const [account] = await db.select({ userId: users.userId, passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);
  if (account === undefined) {
    await absorbPassword(request.password);
    throw credentialsNotValid();
  }
  if (!(await verifyPassword(request.password, account.passwordHash))) throw credentialsNotValid();

  return startSession(db, account.userId, request.deviceLabel);
}

/** Spend a verification link: the address is now proven, and the account row says so. */
export async function verifyEmail(request: { token: string }): Promise<{ verified: true }> {
  const db = runAsSystem("R-SPINE-001 email verification: marking an account's address proven against the token that was mailed to it");
  const { userId } = await consumeToken(db, request.token, "verifyEmail");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.userId, userId));
  return { verified: true };
}

/**
 * Mail a link, or quietly do nothing. Both the magic-link and the reset door answer the same way for
 * an address with no account: telling a caller which addresses exist is the enumeration the rate
 * limit exists to prevent, so the answer is identical and only the outbox differs.
 *
 * Identical in the same two senses `signIn` is: an address with an account pays for a token row and
 * a delivery, an address without one pays for neither, and the difference is legible to a caller
 * holding a clock. Both answers are therefore held back to the same floor, which is longer than the
 * work either side does, so the two are indistinguishable from outside.
 */
async function mailLinkFor(purpose: "magicLink" | "passwordReset", door: "requestMagicLink" | "requestPasswordReset", request: { email: string; origin: string }): Promise<{ sent: true }> {
  const email = normalisedEmail(request.email);
  await admitAttempt(door, email);
  const began = Date.now();

  const db = runAsSystem(`R-SPINE-001 ${TOKEN_REASONS[purpose]}: issuing a single-use link for the address a caller named`);
  const [account] = await db.select({ userId: users.userId }).from(users).where(eq(users.email, email)).limit(1);
  if (account !== undefined) mail(request.origin, email, purpose, await issueToken(db, account.userId, purpose));

  await noSoonerThan(began);
  return { sent: true };
}

/**
 * The floor every mailing door answers on. Comfortably above what issuing a token and writing the
 * outbox file cost, and below what a person waiting on a form would call slow.
 */
const MAIL_DOOR_FLOOR_MS = 250;

/** Hold an answer back until the door has taken the same time whichever branch it went down. */
function noSoonerThan(began: number): Promise<void> {
  const remaining = MAIL_DOOR_FLOOR_MS - (Date.now() - began);
  return remaining <= 0 ? Promise.resolve() : new Promise((settle) => setTimeout(settle, remaining));
}

/** What each mailing door is opening a system handle for — attributable, not decorative. */
const TOKEN_REASONS: Readonly<Record<"magicLink" | "passwordReset", string>> = Object.freeze({
  magicLink: "magic-link sign-in",
  passwordReset: "password reset",
});

export function requestMagicLink(request: { email: string; origin: string }): Promise<{ sent: true }> {
  return mailLinkFor("magicLink", "requestMagicLink", request);
}

export function requestPasswordReset(request: { email: string; origin: string }): Promise<{ sent: true }> {
  return mailLinkFor("passwordReset", "requestPasswordReset", request);
}

/**
 * Spend a magic link for a session. Following the link is itself proof the address receives mail, so
 * an account that had not verified yet is verified by arriving here.
 */
export async function consumeMagicLink(request: { token: string; deviceLabel: string }): Promise<SessionAnswer> {
  const db = runAsSystem("R-SPINE-001 magic-link sign-in: spending a mailed single-use link for a session");
  const { userId } = await consumeToken(db, request.token, "magicLink");
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(and(eq(users.userId, userId), isNull(users.emailVerifiedAt)));
  return startSession(db, userId, request.deviceLabel);
}

/**
 * R-SPINE-001's reset: the password changes and every session the account held ends with it — the
 * point of a reset is that whoever was signed in on the strength of the old one no longer is. The
 * device this reset was done on is signed in afresh, so the person who just proved they hold the
 * address is not signed out by their own remedy.
 */
export async function resetPassword(request: { token: string; password: string; deviceLabel: string }): Promise<SessionAnswer> {
  const passwordHash = await hashPassword(request.password);
  const db = runAsSystem("R-SPINE-001 password reset: setting a new password and revoking every session the account held");

  return db.transaction(async (tx) => {
    const { userId } = await consumeToken(tx, request.token, "passwordReset");
    await tx.update(users).set({ passwordHash, emailVerifiedAt: new Date() }).where(eq(users.userId, userId));
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    return startSession(tx, userId, request.deviceLabel);
  });
}

/* ------------------------------------------------------------------ *
 * The device list.
 * ------------------------------------------------------------------ */

/** Everywhere this account is signed in, oldest first, with the calling device marked. */
export async function listSessions(session: AuthSession): Promise<SessionRow[]> {
  const db = runAsSystem("R-SPINE-001 device list: the live sessions of the account making the request");
  const rows = await db
    .select({ id: sessions.sessionId, deviceLabel: sessions.deviceLabel, createdAt: sessions.createdAt })
    .from(sessions)
    // The same predicate `resolveSession` admits a cookie by: a row past its lifetime signs nobody
    // in, so listing it as a device somebody is signed in on would be listing a session that is over.
    .where(and(eq(sessions.userId, session.userId), isNull(sessions.revokedAt), gt(sessions.createdAt, liveSince())))
    .orderBy(asc(sessions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    deviceLabel: row.deviceLabel,
    createdAt: row.createdAt.toISOString(),
    current: row.id === session.sessionId,
  }));
}

/**
 * End another device's session — or this one's; revoke is revoke. The statement is scoped to the
 * caller's own account, so a session id belonging to somebody else matches nothing and changes
 * nothing: the closed taxonomy registers no code for "that session is not yours", and answering one
 * would confirm the id exists.
 *
 * An id no session id could be is the same fact with less standing, and gets the same answer. Asked
 * of the database it would be a cast error (22P02) rather than a miss — an unmarked fault, so the
 * caller would be handed a fault id for presenting a value the door never checked, and the operator
 * a record of a failure that never happened (R-SPINE-062, ARCH-03).
 */
export async function revokeSession(session: AuthSession, sessionId: string): Promise<{ revoked: string }> {
  if (!isUuid(sessionId)) return { revoked: sessionId };

  const db = runAsSystem("R-SPINE-001 session revoke: ending a session the requesting account holds");
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.sessionId, sessionId), eq(sessions.userId, session.userId), isNull(sessions.revokedAt)));
  return { revoked: sessionId };
}

/** Sign out: this device's session ends, and the others are untouched. */
export async function signOut(session: AuthSession): Promise<{ signedOut: true }> {
  const db = runAsSystem("R-SPINE-001 sign-out: ending the session the request was made with");
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.sessionId, session.sessionId), isNull(sessions.revokedAt)));
  return { signedOut: true };
}

/* ------------------------------------------------------------------ *
 * The outbox.
 * ------------------------------------------------------------------ */

/**
 * Put the link in the outbox. The origin is the one the request arrived on, so a link is followed
 * back to the server that sent it without a second name for the product's own address; a caller the
 * origin could not be read from gets a root-relative link, which still resolves inside the app.
 */
function mail(origin: string, to: string, purpose: AuthTokenPurpose, token: string): void {
  const url = `${origin}${LINK_PATHS[purpose]}?token=${encodeURIComponent(token)}`;
  deliver({ to, kind: TOKEN_KINDS[purpose], url, token });
}
