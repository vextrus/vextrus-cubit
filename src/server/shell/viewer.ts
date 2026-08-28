// Who the frame is showing itself to (R-UI-030's user menu): the account behind the presented
// session. Identity is the auth seam's — `resolveSession` says whose session it is — and the
// address is read through the system handle, because an account is not tenant-scoped state.
import { cache } from "react";
import { eq, runAsSystem, users } from "../../core/db";
import { foldedKey } from "../auth/folded-key";
import { sessionOf } from "./resolve";

/**
 * The tag a carriable key wears, taken from the fold itself rather than restated here: folding the
 * empty value on the carriable side *is* the prefix. The fold is the auth seam's file and this
 * screen-side reader is not, so the invariant stays in its one home (B-17) — this derivation cannot
 * drift from it, because it is computed by it.
 */
const PRESENTED_PREFIX = foldedKey("", true);

/**
 * The value behind a folded key, when the key is a presented one — and nothing when it is a digest,
 * which stands for a value no column could carry and so is not one anybody may be shown.
 */
function presentedValue(key: string): string | null {
  return key.startsWith(PRESENTED_PREFIX) ? key.slice(PRESENTED_PREFIX.length) : null;
}

/** The signed-in account, as a screen names it: the address the door was answered for. */
export interface Viewer {
  userId: string;
  /** The address as it was presented, or null for an account whose key carries no address. */
  email: string | null;
}

/**
 * The account the presented session belongs to, or null when the session is not live — a cookie
 * that outlived its session, or one that was revoked from the device list.
 *
 * `users.email` holds the folded KEY the doors look an account up under, not the address itself, so
 * the address is read back out of it through the fold's own tag (`presentedValue`, above). A key
 * that is a digest stands for an address no column could carry, and there is nothing there to show.
 *
 * Request-scoped (`cache`, see ./resolve): the frame asks for the viewer once, and asking again
 * within the same render costs nothing.
 */
export const viewerFor = cache(async (sessionToken: string | null): Promise<Viewer | null> => {
  const session = await sessionOf(sessionToken);
  if (session === null) return null;

  const db = runAsSystem("R-UI-030 shell frame: the address of the account whose session the frame is rendered for");
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.userId, session.userId)).limit(1);
  const row = rows[0];
  return row === undefined ? null : { userId: session.userId, email: presentedValue(row.email) };
});
