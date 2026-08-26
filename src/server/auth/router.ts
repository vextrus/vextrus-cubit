// The identity lane's transport (R-SPINE-001, R-SPINE-002). Every procedure here is a thin wrapper
// over `./session.ts`: it reads what the request itself supplies — the device, the origin, the live
// session — parses the caller's input, and hands the answer back. No rule about identity lives in
// this file; SEAM-ACT wants the door thin and the seam thick.
//
// A door that needs a session states so once, through `signedInProcedure`: the middleware answers
// SIGNED_OUT with its registered sign-in remedy for a missing, unknown or revoked cookie, so no
// procedure body has to remember to check (ARCH-03, B-21).
import { publicProcedure, router } from "../trpc";
import { credentialsNotValid, signedOut } from "./refusals";
import {
  consumeMagicLink,
  listSessions,
  requestMagicLink,
  requestPasswordReset,
  resetPassword,
  revokeSession,
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
  signIn,
  signOut,
  signUp,
  verifyEmail,
} from "./session";

/**
 * How long a browser keeps the cookie: the session's own lifetime, read from the seam that enforces
 * it. It is a hint and not the bound — the row is what makes a session live, `resolveSession` is
 * what ends it, and revoking ends it everywhere at once — but a browser told to keep a token longer
 * than the server will honour it would present a dead cookie, so the two are one number.
 */
const COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_LIFETIME_MS / 1000);

/**
 * The attributes every `cubit_session` cookie carries. `HttpOnly` keeps the token out of scripts and
 * `SameSite=Lax` out of cross-site posts.
 *
 * `Secure` is carried unless the request was answered somewhere a `Secure` cookie could not be kept
 * — the context decides that once per request (`deploymentIsSecure`), and it decides it so that a
 * deployment which configured nothing gets the flag rather than losing it. The flag is dropped only
 * for loopback http and for a deployment that configured a plain-http origin of its own.
 */
function cookieAttributes(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** The cookie a session travels home in. */
function sessionCookie(ctx: { secureCookies: boolean }, sessionToken: string): string {
  return `${SESSION_COOKIE}=${sessionToken}; ${cookieAttributes(ctx.secureCookies)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
}

/**
 * The same cookie, ended: a sign-out that left the token in the browser would be a half sign-out.
 * The attributes are the ones it was set with — a browser matches an expiry against them, so a
 * clearing cookie that dropped `Secure` would leave the original sitting in the jar.
 */
function clearedCookie(ctx: { secureCookies: boolean }): string {
  return `${SESSION_COOKIE}=; ${cookieAttributes(ctx.secureCookies)}; Max-Age=0`;
}

/* ------------------------------------------------------------------ *
 * Input, read by hand.
 * ------------------------------------------------------------------ */

/** What a caller sent, as a bag — anything that is not one carries no named fields. */
function bagOf(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

/**
 * A named string field, proved to be a *string* and nothing more. `input` is whatever crossed the
 * wire, so a door handed a number would otherwise reach the seam and fail there as a fault, when
 * what the caller actually did was call it wrongly — no browser can produce that, and a plain throw
 * for it is honest.
 *
 * What the string *says* is deliberately not judged here. A reader that also rejected a blank value
 * would be judging, and a judgement thrown as a plain `Error` reaches the caller as a fault id with
 * a FaultRecord filed behind it (R-SPINE-007, ARCH-03/B-21) — "the machine failed" for a slipped
 * space bar. The browser's `required` cannot stop a single space (Design Decision I-13 forbids the
 * screen inventing a rule that would), and the closed taxonomy registers no code for a detail left
 * blank (R-SPINE-062, B-06), so the doors that *create* an account or *set* a password take the
 * value as presented: no password policy exists to break, and R-SPINE-002 names the personal
 * workspace with what sign-up was given. Only the doors that *identify* somebody judge, through
 * `credential` below, where the taxonomy does register the answer.
 */
function field(input: unknown, name: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string") throw new Error(`spine.auth: "${name}" is required and must be a string`);
  return value;
}

/**
 * An address or a password presented to *identify* somebody, as the person typed it. A blank one
 * identifies no account — it is a credential that names nobody, which is exactly what
 * CREDENTIALS_NOT_VALID is registered for (R-SPINE-062). The doors that create an account or set a
 * password read through `field` instead: the entry says the email and password match no account and
 * offers a password reset, which is false in every word of a person who is making one.
 */
function credential(input: unknown, name: string): string {
  const value = field(input, name);
  if (value.trim() === "") throw credentialsNotValid();
  return value;
}

/**
 * A door whose whole input is one value — `verifyEmail(token)`, `revokeSession(id)`. The value may
 * arrive named or bare, because both readings of a one-argument door are honest and the caller
 * should not have to guess which one this tree chose. When a caller supplies more than one of the
 * names, a value that says something wins over a blank one.
 *
 * A blank value is returned rather than rejected: every door reading through here — a token, a
 * session id, an address a link is mailed to — already answers a value that matches nothing
 * (TOKEN_NOT_VALID, an unchanged revoke, the same `{ sent: true }` an unknown address gets), so
 * rejecting it here would replace those answers with a fault.
 */
function only(input: unknown, names: readonly string[]): string {
  if (typeof input === "string") return input;
  const bag = bagOf(input);
  const supplied = names.map((name) => bag[name]).filter((value): value is string => typeof value === "string");
  const value = supplied.find((candidate) => candidate.trim() !== "") ?? supplied[0];
  if (value === undefined) throw new Error(`spine.auth: this door takes ${names.map((name) => `"${name}"`).join(" or ")}, named or as a bare string`);
  return value;
}

/* ------------------------------------------------------------------ *
 * The lane.
 * ------------------------------------------------------------------ */

/** A door that needs a live session. The cookie was resolved once, when the context was minted. */
const signedInProcedure = publicProcedure.use(({ ctx, next }) => {
  if (ctx.session === null) throw signedOut();
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const authRouter = router({
  signUp: publicProcedure
    .input((input: unknown) => ({ email: field(input, "email"), password: field(input, "password"), tenantName: field(input, "tenantName") }))
    .mutation(async ({ ctx, input }) => {
      const answer = await signUp({ ...input, deviceLabel: ctx.deviceLabel, origin: ctx.origin, requestId: ctx.requestId });
      ctx.cookies.push(sessionCookie(ctx, answer.sessionToken));
      return answer;
    }),

  signIn: publicProcedure
    .input((input: unknown) => ({ email: credential(input, "email"), password: credential(input, "password") }))
    .mutation(async ({ ctx, input }) => {
      const answer = await signIn({ ...input, deviceLabel: ctx.deviceLabel });
      ctx.cookies.push(sessionCookie(ctx, answer.sessionToken));
      return answer;
    }),

  signOut: signedInProcedure.mutation(async ({ ctx }) => {
    const answer = await signOut(ctx.session);
    ctx.cookies.push(clearedCookie(ctx));
    return answer;
  }),

  verifyEmail: publicProcedure.input((input: unknown) => ({ token: only(input, ["token"]) })).mutation(({ input }) => verifyEmail(input)),

  requestMagicLink: publicProcedure
    .input((input: unknown) => ({ email: only(input, ["email"]) }))
    .mutation(({ ctx, input }) => requestMagicLink({ ...input, origin: ctx.origin, requestId: ctx.requestId })),

  consumeMagicLink: publicProcedure
    .input((input: unknown) => ({ token: only(input, ["token"]) }))
    .mutation(async ({ ctx, input }) => {
      const answer = await consumeMagicLink({ ...input, deviceLabel: ctx.deviceLabel });
      ctx.cookies.push(sessionCookie(ctx, answer.sessionToken));
      return answer;
    }),

  requestPasswordReset: publicProcedure
    .input((input: unknown) => ({ email: only(input, ["email"]) }))
    .mutation(({ ctx, input }) => requestPasswordReset({ ...input, origin: ctx.origin, requestId: ctx.requestId })),

  resetPassword: publicProcedure
    .input((input: unknown) => ({ token: field(input, "token"), password: field(input, "password") }))
    .mutation(async ({ ctx, input }) => {
      const answer = await resetPassword({ ...input, deviceLabel: ctx.deviceLabel });
      ctx.cookies.push(sessionCookie(ctx, answer.sessionToken));
      return answer;
    }),

  listSessions: signedInProcedure.query(({ ctx }) => listSessions(ctx.session)),

  revokeSession: signedInProcedure
    .input((input: unknown) => ({ id: only(input, ["id", "sessionId"]) }))
    .mutation(({ ctx, input }) => revokeSession(ctx.session, input.id)),
});
