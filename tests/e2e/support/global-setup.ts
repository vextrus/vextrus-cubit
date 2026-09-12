// V-E2E's setup: the journeys' database exists and carries the committed schema before the first
// journey runs. The web server is started by the config's `webServer` and reads the same URL; it
// opens no connection until a journey asks it to, which is what lets the two agree by name.
//
// Under the picture lane (the default since the re-baseline lease) it also installs the PICTURE TENANT — a workspace, a project and an
// account whose ids, names and clock are literals, so a still taken of them needs no magenta mask
// (AM-09 §4, Design Direction 00 §9.3). Installed only under that flag: with the flag off this file
// does exactly what it did, and no existing journey meets a row it did not meet before.
import { pictureLane } from "./capture-geometry";
import { ROLE_MIGRATE } from "../../../db/__tests__/support/fixtures";
import { PICTURE_CLOCK, PICTURE_TENANT, seedPictureTenant } from "./picture-tenant";
import { e2eDatabaseUrl, migrateUrlForPictureTenant, provisionE2eDatabase } from "./scratch-db";

export default function globalSetup(): void {
  provisionE2eDatabase();
  if (!pictureLane()) return;
  seedPictureTenant(migrateUrlForPictureTenant());
  process.stdout.write(`PICTURE TENANT ${PICTURE_TENANT.tenantId} at ${PICTURE_CLOCK} (${ROLE_MIGRATE} on ${new URL(e2eDatabaseUrl()).pathname.slice(1)})\n`);
}
