// SEAM-PREFS: what one person has chosen for themselves, and the only way in or out of it. A
// preference belongs to an account rather than to a workspace (R-SPINE-002), so the rows are reached
// through the system handle under an attributable reason — the same posture identity itself lands
// under (SEAM-TENANT, R-SPINE-007) — and this barrel is the sole entry point a consumer imports.
//
// R-UI-005 gives the seam its first key, density. Later keys join the same one row per account.
import { eq, isUuid, runAsSystem, userPrefs } from "../db";
import { DEFAULT_DENSITY, DENSITIES, isDensity, type Density } from "./density";

export { DENSITIES, type Density };

/** Why the system handle is taken for a preference read, stated once for both of the seam's ways in. */
const READ_REASON = "R-UI-005 density preference: the mode one account's tables are drawn at";
const WRITE_REASON = "R-UI-005 density preference: the mode one account chose for its tables";

/**
 * The density this account's tables are drawn at. An account that never chose is not an absence a
 * screen has to handle: the seam answers the default, which is also the column's, so a table always
 * has a row height and the toggle always has a checked option.
 *
 * A value that names no account cannot own a preference — it is answered rather than sent to the
 * database, where a uuid column would refuse it as a cast fault (22P02) instead of matching no row.
 */
export async function densityFor(userId: string): Promise<Density> {
  if (!isUuid(userId)) return DEFAULT_DENSITY;
  const db = runAsSystem(READ_REASON);
  const rows = await db.select({ density: userPrefs.density }).from(userPrefs).where(eq(userPrefs.userId, userId)).limit(1);
  const stored = rows[0]?.density;
  return stored !== undefined && isDensity(stored) ? stored : DEFAULT_DENSITY;
}

/**
 * Store the mode this account chose. One row per account, so a second choice overwrites the first in
 * place rather than appending a history — a preference is a value, not a record of what was wanted
 * before. The mode is judged here as well as by the column's CHECK: a value from outside the roster
 * is refused as a value nobody may store, never carried down to fault as an unmarked constraint
 * error (R-SPINE-007).
 */
export async function setDensity(userId: string, density: Density): Promise<void> {
  if (!isUuid(userId)) throw new Error("setDensity needs an account uuid — a preference belongs to a person (SEAM-PREFS)");
  if (!isDensity(density)) throw new Error(`setDensity was given ${JSON.stringify(density)}, which is no mode R-UI-005 names (SEAM-PREFS)`);
  const db = runAsSystem(WRITE_REASON);
  await db
    .insert(userPrefs)
    .values({ userId, density })
    .onConflictDoUpdate({ target: userPrefs.userId, set: { density, updatedAt: new Date() } });
}
