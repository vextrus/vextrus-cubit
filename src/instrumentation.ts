// The web tier's boot root: Next calls `register()` once, before the first request is served.
//
// What it does here is read the whole environment declaration for the web tier (src/core/env.ts)
// and refuse to come up when a name the tier cannot work without is absent or malformed. An
// installation that is misconfigured then fails at boot, loudly and by name, instead of at the
// first request that happens to need the missing value — and the outage crosses the one fault seam
// on its way out, so the operator has the record before anybody sees an error page (ARCH-03, B-21).
//
// The tree has no middleware or proxy file, so Next registers only the nodejs runtime; nothing here
// branches on which runtime it is in.
import { envErrorOf, envUnusableOf, validateEnv } from "./core/env";
import { reportFault } from "./core/faults/report";

/** The tier this file boots, as the declaration names it. */
const TIER = "web";

/** How the web tier names itself when an outage of its own is recorded (ARCH-03). */
export const WEB_BOOT_ROUTE = "web/instrumentation";

/** Who a boot outage is filed against: the tier itself, since no request exists yet. */
const ACTOR = "web";

/**
 * Validate the environment once, and refuse to start if a name this tier requires is missing or
 * malformed. Nothing is dialled and no connection is opened: this is a read of the machine's own
 * answer, so a boot that is going to fail on configuration fails before it has taken a socket out.
 */
export async function register(): Promise<void> {
  const verdict = validateEnv(TIER);
  if (!verdict.ok) {
    const failure = envErrorOf(TIER, verdict);
    reportFault({ requestId: process.pid.toString(), actor: ACTOR, route: WEB_BOOT_ROUTE, cause: failure });
    throw failure;
  }
  // A name this tier does not require, stated unusably, is the operator's to correct and nobody
  // else's: the seam that reads it keeps its own default and the tier comes up (ARCH-03).
  if (verdict.invalid.length > 0) {
    reportFault({ requestId: process.pid.toString(), actor: ACTOR, route: WEB_BOOT_ROUTE, cause: envUnusableOf(TIER, verdict.invalid) });
  }
}
