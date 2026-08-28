// Who the frame is showing itself to (R-UI-030's user menu): the account behind the presented
// session. Identity is the auth seam's — `resolveSession` says whose session it is — and the
// address is read through the system handle, because an account is not tenant-scoped state.
import { eq, runAsSystem, users } from "../../core/db";
import { resolveSession } from "../auth/session";

/** The signed-in account, as a screen names it: the address the door was answered for. */
export interface Viewer {
  userId: string;
  email: string;
}

/**
 * The account the presented session belongs to, or null when the session is not live — a cookie
 * that outlived its session, or one that was revoked from the device list.
 *
 * The address is the value `users.email` carries, which is what every auth door looks an account up
 * under (src/server/auth/session.ts).
 */
export async function viewerFor(sessionToken: string | null): Promise<Viewer | null> {
  const session = sessionToken === null ? null : await resolveSession(sessionToken);
  if (session === null) return null;

  const db = runAsSystem("R-UI-030 shell frame: the address of the account whose session the frame is rendered for");
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.userId, session.userId)).limit(1);
  const row = rows[0];
  return row === undefined ? null : { userId: session.userId, email: row.email };
}
