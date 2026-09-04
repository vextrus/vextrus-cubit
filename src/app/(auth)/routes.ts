// The six S-Auth routes, named once (ARCH-02, B-17). A link, a redirect and the evidence a refusal
// points at all read the same path from here, so moving a screen is one edit rather than a search.
export const AUTH_ROUTES = Object.freeze({
  signUp: "/sign-up",
  signIn: "/sign-in",
  verify: "/verify",
  magicLink: "/magic-link",
  reset: "/reset",
  sessions: "/sessions",
  home: "/",
} as const);

/** The route a screen is rendered at, which decides where its refusals send a person (R-UI-020). */
export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES];

/**
 * The token a mailed link carries. Next hands a search parameter as a string, as an array when it
 * was repeated, or not at all; a blank one is no token, because a screen that treats "" as a token
 * asks the server to refuse something the person never presented.
 */
export function tokenFrom(params: Record<string, string | string[] | undefined>): string | null {
  const value = params["token"];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first.trim() !== "" ? first : null;
}

/**
 * The query a token-bearing screen is reached with, spelled once (B-17). A refusal answered on such
 * a screen resolves back onto it, and the screen is only usable while its address still carries the
 * link's token.
 */
export function tokenSearch(token: string): string {
  return `?token=${encodeURIComponent(token)}`;
}
