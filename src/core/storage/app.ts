// The app's one Storage instance, and the one place the machine's answer for where objects live is
// read (ARCH-02, B-17).
//
// SEAM-STORAGE itself is a factory over injected configuration and reads no environment (./index),
// so somebody has to read the machine's answer for the running app. That somebody sits in core
// because more than one module stores and serves content-addressed objects — the upload seam that
// lays a drawing down and the takeoff seam that renders its sheets — and a module reaches core and
// its own module only (ARCH-01). Two readers of the root would be two storages, and a URL one
// minted the other would refuse.
//
// The instance is anchored to the process rather than to this module's instance, for the reason the
// fault sink states: one home is an identity property, and a bundler that compiled this file into
// two graphs would otherwise leave the tier with two storages — and a second signing secret.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { envValue, isDevelopment } from "../env";
import { REFUSALS } from "../errors";
import { refusal } from "../faults/refusal-marker";
import { reportFault } from "../faults/report";
import { makeStorage, type SignVerification, type Storage } from "./index";

/** The environment names this file reads, through the one home for them (src/core/env.ts). */
const ROOT_VAR = "STORAGE_ROOT";
const SECRET_VAR = "CUBIT_STORAGE_SIGNING_SECRET";

/** The route the fault seam records a cleanup failure under (ARCH-03). */
const ROUTE = "storage: app";

/** The route a minted signing secret is reported under: an operator's fact, not a put's (ARCH-03). */
const SIGNING_ROUTE = "storage: signing secret";

/** Who a cleanup failure is filed against: this instance is every module's, not the upload seam's. */
const ACTOR = "storage";

/** There is no request behind either record: the seam itself is what the operator is being told of. */
const REQUEST_ID = "storage";

/** The one refusal an installation that states no key answers a download request with (Q-12). */
const DOWNLOAD_NOT_SIGNABLE = REFUSALS.DOWNLOAD_NOT_SIGNABLE.code;

const HELD_KEY = Symbol.for("vextrus.cubit.core.storage.app");

/**
 * What the process holds: the storage last built and what it was built FROM, and the secret this
 * process minted, if it ever minted one. They are separate fields because they have different
 * lifetimes — the instance is rebuilt whenever the machine's answer changes, and a minted secret is
 * the process's for as long as the process lives, so a URL signed before `STORAGE_ROOT` moved is
 * still one this process can vouch for.
 */
interface AppStorageScope {
  instance?: { root: string; stated: string | undefined; storage: Storage };
  minted?: string;
}

const processScope = globalThis as typeof globalThis & { [HELD_KEY]?: AppStorageScope };

const scope: AppStorageScope = (processScope[HELD_KEY] ??= {});

/** Where objects and staging copies are laid down: the machine's answer, or the default beside it. */
export function storageRoot(): string {
  const stated = envValue(ROOT_VAR);
  return stated === undefined ? join(process.cwd(), "storage") : stated;
}

/**
 * The key a developer's own machine signs with when it states none, minted at most once per process.
 *
 * A secret written into the tree as a default would be a secret in the repo (Q-12, B-23), so the
 * convenience of signed downloads without stating a name costs what it costs: the links die at the
 * next restart. That cost is a fact only an operator can act on, so it crosses the fault seam as a
 * warning naming the variable to go and set — once, with the minting, because a line per signed URL
 * is the noise B-21 rules out.
 */
function mintedSecret(): string {
  const already = scope.minted;
  if (already !== undefined) return already;
  const minted = randomUUID();
  scope.minted = minted;
  reportFault({
    requestId: REQUEST_ID,
    actor: ACTOR,
    route: SIGNING_ROUTE,
    cause: `warning: ${SECRET_VAR} is not set — a signing secret was minted for this process, and signed URLs will not survive a restart (Q-12)`,
  });
  return minted;
}

/**
 * The seam an installation that states no signing key gets: storage, without signatures.
 *
 * Storing and serving evidence is not what the missing key takes away (R-SPINE-021), so `put` and
 * `get` are the ordinary seam over the root. Signing is: a minted key would make every download link
 * die at the next restart and would leave a box that named no key effectively unsigned, which is the
 * hole Q-12 closes. `sign` therefore refuses with a registered code carrying the operator's own
 * detail (ARCH-03), and `verify` vouches for nothing at all — there is no key here to have signed
 * anything, so no artefact can be this installation's.
 */
function withoutSigning(base: Storage): Storage {
  return {
    ...base,
    sign(): never {
      throw refusal(DOWNLOAD_NOT_SIGNABLE, `storage: ${SECRET_VAR} is not set, so this installation signs no download URLs (Q-12)`);
    },
    verify(): SignVerification {
      return { ok: false, reason: "invalid" };
    },
  };
}

/**
 * The app's one Storage, built from what the machine states.
 *
 * It is rebuilt when the machine names a different root OR a different signing secret — a suite that
 * repoints `STORAGE_ROOT` is pointed at the directory it named, and one that states a secret after a
 * case that stated none signs with the secret it stated, rather than with whatever the first caller
 * happened to find. A stated secret is always the key: only that makes a URL minted before a restart
 * verify after it.
 */
export function appStorage(): Storage {
  const root = storageRoot();
  const stated = envValue(SECRET_VAR);
  const instance = scope.instance;
  if (instance !== undefined && instance.root === root && instance.stated === stated) return instance.storage;

  // An installation that states no key mints none: the seam below never signs, so it is built with
  // no key rather than with a key nobody stated.
  const development = isDevelopment();
  const signable = stated !== undefined || development;
  const base = makeStorage({
    root,
    signingSecret: stated ?? (development ? mintedSecret() : ""),
    // A staging copy the volume will not let go of is a fact only an operator can act on: the put
    // has done what it was asked, and a discarding catch would tell nobody (ARCH-03, B-21).
    onCleanupFailure: (failure) => {
      reportFault({ requestId: REQUEST_ID, actor: ACTOR, route: ROUTE, cause: failure });
    },
  });
  const storage = signable ? base : withoutSigning(base);
  scope.instance = { root, stated, storage };
  return storage;
}
