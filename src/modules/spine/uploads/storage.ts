// R-SPINE-020's disk: the app's one storage instance, and where a transfer's bytes are staged while
// it is still arriving.
//
// SEAM-STORAGE is a factory over injected configuration and reads no environment (src/core/storage),
// so somebody has to read the machine's answer for the running app — this file is that somebody, and
// the only one (ARCH-02, B-17). The root is `STORAGE_ROOT`, the same name `pnpm checkup` asks the
// machine for; the signing secret is `CUBIT_STORAGE_SIGNING_SECRET`.
//
// The instance is anchored to the process rather than to this module's instance, for the reason the
// fault sink states: one home is an identity property, and a bundler that compiled this file into
// two graphs would otherwise leave the tier with two storages — and a second signing secret, so a
// URL one half minted the other would refuse.
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { makeStorage, type Storage } from "../../../core/storage";
import { reportFault } from "../../../core/faults/report";

/** The environment names this file reads (AS-01, declared in the transport vocabulary). */
const ROOT_VAR = "STORAGE_ROOT";
const SECRET_VAR = "CUBIT_STORAGE_SIGNING_SECRET";

/** Staging stands beside the stored objects, under a name no tenant prefix can collide with. */
const STAGING_DIR = ".uploads";

/** The route the fault seam records a cleanup failure under (ARCH-03). */
const ROUTE = "storage: uploads";

const HELD_KEY = Symbol.for("vextrus.cubit.modules.spine.uploads.storage");

const processScope = globalThis as typeof globalThis & { [HELD_KEY]?: { root: string; secret: string; storage: Storage } };

/** Where objects and staging copies are laid down: the machine's answer, or the default beside it. */
export function storageRoot(): string {
  const stated = process.env[ROOT_VAR]?.trim();
  return stated === undefined || stated === "" ? join(process.cwd(), "storage") : stated;
}

/**
 * The key signed download URLs are minted with. An installation that states none gets one minted per
 * process: no door of this seam signs a URL, and a secret written into the tree as a default
 * would be a secret in the repo (Q-12, B-23). A deployment that hands out download links states the
 * name above, and the links then survive a restart.
 */
function signingSecret(): string {
  const stated = process.env[SECRET_VAR]?.trim();
  return stated === undefined || stated === "" ? randomUUID() : stated;
}

/**
 * The app's one Storage. It is rebuilt when the machine names a different root — a test that repoints
 * `STORAGE_ROOT` is pointed at the directory it named, rather than at the one the first caller found.
 */
export function uploadStorage(): Storage {
  const root = storageRoot();
  const held = processScope[HELD_KEY];
  if (held !== undefined && held.root === root) return held.storage;
  const secret = held?.secret ?? signingSecret();
  const storage = makeStorage({
    root,
    signingSecret: secret,
    // A staging copy the volume will not let go of is a fact only an operator can act on: the put
    // has done what it was asked, and a discarding catch would tell nobody (ARCH-03, B-21).
    onCleanupFailure: (failure) => {
      reportFault({ requestId: "storage", actor: "uploads", route: ROUTE, cause: failure });
    },
  });
  processScope[HELD_KEY] = { root, secret, storage };
  return storage;
}

/** Where the bytes of an open upload session are staged, under the root above (R-SPINE-020). */
export function stagingPath(tenantId: string, uploadId: string): string {
  return join(storageRoot(), STAGING_DIR, tenantId, uploadId);
}

/** The directory a tenant's staging copies stand in — made before the first chunk is written. */
export function stagingDir(tenantId: string): string {
  return join(storageRoot(), STAGING_DIR, tenantId);
}
