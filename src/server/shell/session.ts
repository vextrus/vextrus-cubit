// The session as a rendered screen sees it (R-SPINE-001): the token the browser presented, and the
// end of it. The transport is a cookie jar rather than a `Request`, because a server-rendered route
// is handed no request object — everything else is the identity seam's, read through its one home
// (B-17): the cookie's name, the resolution of a token to a session, and the revocation itself.
import { cookies, headers } from "next/headers";
import { clearedSessionCookie, resolveSession, signOut, SESSION_COOKIE } from "../auth/session";
import { originFactsFromHeaders } from "../context";

/** The session token this request presents, or null when it presents none. */
export async function presentedSessionToken(): Promise<string | null> {
  const presented = (await cookies()).get(SESSION_COOKIE)?.value;
  return presented === undefined || presented.trim() === "" ? null : presented;
}

/**
 * End the session the request was made with, and stop the browser presenting it again. A token that
 * resolves to nothing is already ended: the cookie still goes, so a dead cookie is not carried back
 * to a screen that would read it as a session.
 *
 * The cookie is SET to the identity seam's cleared value rather than deleted by name: a browser
 * matches an expiry against the attributes a cookie was set with, so a deletion that states none
 * can leave the live cookie — and the token in it — sitting in the jar (R-SPINE-001). The `Secure`
 * half of those attributes is the deployment's, read from the seam that decides it for every other
 * lane too (ARCH-02).
 */
export async function endSession(sessionToken: string | null): Promise<void> {
  const session = sessionToken === null ? null : await resolveSession(sessionToken);
  if (session !== null) await signOut(session);
  const { secureCookies } = originFactsFromHeaders(await headers());
  (await cookies()).set(clearedSessionCookie(secureCookies));
}
