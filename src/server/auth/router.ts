// The identity lane's transport (R-SPINE-001, R-SPINE-002). Every procedure here is a thin wrapper
// over `./session.ts`: it reads what the request itself supplies — the device, the origin, the live
// session — parses the caller's input, and hands the answer back. No rule about identity lives in
// this file; SEAM-ACT wants the door thin and the seam thick.
//
// A door that needs a session states so once, through `signedInProcedure`: the middleware answers
// SIGNED_OUT with its registered sign-in remedy for a missing, unknown or revoked cookie, so no
// procedure body has to remember to check (ARCH-03, B-21).
import { publicProcedure, router } from "../trpc";
import { signedOut } from "./refusals";
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
 * The cookie a session travels home in. `HttpOnly` keeps the token out of scripts and `SameSite=Lax`
 * out of cross-site posts; `Secure` is deliberately not set, because the flag would make the cookie
 * unusable over the loopback http the journeys and a developer's machine serve on, and the transport
 * has no way to know from here whether it is behind TLS. Deployment terminates that concern.
 */
function sessionCookie(sessionToken: string): string {
  return `${SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}`;
}

/** The same cookie, ended: a sign-out that left the token in the browser would be a half sign-out. */
function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* ------------------------------------------------------------------ *
 * Input, read by hand.
 * ------------------------------------------------------------------ */

/** What a caller sent, as a bag — anything that is not one carries no named fields. */
function bagOf(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

/**
 * A named string field. `input` is whatever crossed the wire, so every field is proved to be a
 * non-empty string here rather than assumed: a door handed a number would otherwise reach the seam
 * and fail there as a fault, when what the caller actually did was call it wrongly.
 */
function field(input: unknown, name: string): string {
  const value = bagOf(input)[name];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`spine.auth: "${name}" is required and must be a non-empty string`);
  return value;
}

/**
 * A door whose whole input is one value — `verifyEmail(token)`, `revokeSession(id)`. The value may
 * arrive named or bare, because both readings of a one-argument door are honest and the caller
 * should not have to guess which one this tree chose.
 */
function only(input: unknown, names: readonly string[]): string {
  if (typeof input === "string" && input.trim() !== "") return input;
  const bag = bagOf(input);
  for (const name of names) {
    const value = bag[name];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  throw new Error(`spine.auth: this door takes ${names.map((name) => `"${name}"`).join(" or ")}, named or as a bare string`);
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
      const answer = await signUp({ ...input, deviceLabel: ctx.deviceLabel, origin: ctx.origin });
      ctx.cookies.push(sessionCookie(answer.sessionToken));
      return answer;
    }),

  signIn: publicProcedure
    .input((input: unknown) => ({ email: field(input, "email"), password: field(input, "password") }))
    .mutation(async ({ ctx, input }) => {
      const answer = await signIn({ ...input, deviceLabel: ctx.deviceLabel });
      ctx.cookies.push(sessionCookie(answer.sessionToken));
      return answer;
    }),

  signOut: signedInProcedure.mutation(async ({ ctx }) => {
    const answer = await signOut(ctx.session);
    ctx.cookies.push(clearedCookie());
    return answer;
  }),

  verifyEmail: publicProcedure.input((input: unknown) => ({ token: only(input, ["token"]) })).mutation(({ input }) => verifyEmail(input)),

  requestMagicLink: publicProcedure
    .input((input: unknown) => ({ email: only(input, ["email"]) }))
    .mutation(({ ctx, input }) => requestMagicLink({ ...input, origin: ctx.origin })),

  consumeMagicLink: publicProcedure
    .input((input: unknown) => ({ token: only(input, ["token"]) }))
    .mutation(async ({ ctx, input }) => {
      const answer = await consumeMagicLink({ ...input, deviceLabel: ctx.deviceLabel });
      ctx.cookies.push(sessionCookie(answer.sessionToken));
      return answer;
    }),

  requestPasswordReset: publicProcedure
    .input((input: unknown) => ({ email: only(input, ["email"]) }))
    .mutation(({ ctx, input }) => requestPasswordReset({ ...input, origin: ctx.origin })),

  resetPassword: publicProcedure
    .input((input: unknown) => ({ token: field(input, "token"), password: field(input, "password") }))
    .mutation(async ({ ctx, input }) => {
      const answer = await resetPassword({ ...input, deviceLabel: ctx.deviceLabel });
      ctx.cookies.push(sessionCookie(answer.sessionToken));
      return answer;
    }),

  listSessions: signedInProcedure.query(({ ctx }) => listSessions(ctx.session)),

  revokeSession: signedInProcedure
    .input((input: unknown) => ({ id: only(input, ["id", "sessionId"]) }))
    .mutation(({ ctx, input }) => revokeSession(ctx.session, input.id)),
});
