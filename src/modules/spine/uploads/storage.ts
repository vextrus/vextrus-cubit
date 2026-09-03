// R-SPINE-020's disk: the app's one storage instance, and where a transfer's bytes are staged while
// it is still arriving.
//
// The instance and the machine's answer for where objects live are core's (src/core/storage/app):
// more than one module stores content-addressed objects, and a module reaches core and its own
// module only (ARCH-01), so a second reader of the root here would be a second storage and a second
// signing secret. This file publishes that one instance under the name the upload seam's callers
// know it by, and adds the staging area, which is this seam's own (ARCH-02, B-17).
import { join } from "node:path";
import { appStorage, storageRoot } from "../../../core/storage/app";

/** Staging stands beside the stored objects, under a name no tenant prefix can collide with. */
const STAGING_DIR = ".uploads";

export { storageRoot };

/** The app's one Storage, as R-SPINE-020's callers name it. */
export const uploadStorage = appStorage;

/** Where the bytes of an open upload session are staged, under the root above (R-SPINE-020). */
export function stagingPath(tenantId: string, uploadId: string): string {
  return join(storageRoot(), STAGING_DIR, tenantId, uploadId);
}

/** The directory a tenant's staging copies stand in — made before the first chunk is written. */
export function stagingDir(tenantId: string): string {
  return join(storageRoot(), STAGING_DIR, tenantId);
}
