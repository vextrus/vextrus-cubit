// V-E2E's setup: the journeys' database exists and carries the committed schema before the first
// journey runs. The web server is started by the config's `webServer` and reads the same URL; it
// opens no connection until a journey asks it to, which is what lets the two agree by name.
//
// Under `CUBIT_E2E_PICTURE=1` it also installs the PICTURE TENANT — a workspace, a project and an
// account whose ids, names and clock are literals, so a still taken of them needs no magenta mask
// (AM-09 §4, Design Direction 00 §9.3). Installed only under that flag: with the flag off this file
// does exactly what it did, and no existing journey meets a row it did not meet before.
import { scryptSync } from "node:crypto";
import { ROLE_MIGRATE } from "../../../db/__tests__/support/fixtures";
import { lit, run } from "../../../db/__tests__/support/live-sql";
import { PICTURE_CLOCK, PICTURE_TENANT } from "./picture-tenant";
import { e2eDatabaseUrl, migrateUrlForPictureTenant, provisionE2eDatabase } from "./scratch-db";

/**
 * scrypt's cost and format as `src/server/auth/secrets.ts` states them — the door verifies what is
 * in the column, so the fixture must write what that door reads. The salt is a literal rather than
 * random for the reason everything in this tenant is: a hash that changes per run is a row that
 * changes per run.
 */
const SCRYPT = { N: 32_768, r: 8, p: 1, keyLength: 64 } as const;
const PICTURE_SALT = "cubitpicturesalt";

/** The picture account's stored credential, derived the way the sign-in door derives it. */
function pictureHash(): string {
  const salt = Buffer.from(PICTURE_SALT, "utf8");
  const key = scryptSync(PICTURE_TENANT.password, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 256 * SCRYPT.N * SCRYPT.r });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/**
 * The picture tenant, written idempotently. Every insert is `on conflict do update`, so a second run
 * over the same cluster converges on the same rows rather than refusing or doubling — the fixture is
 * a STATE the lane arrives at, not an event it performs.
 */
function provisionPictureTenant(): void {
  const url = migrateUrlForPictureTenant();
  const at = lit(PICTURE_CLOCK);
  run(
    url,
    [
      `insert into tenants (tenant_id, name, created_at) values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.workspaceName)}, ${at})`,
      `  on conflict (tenant_id) do update set name = excluded.name, created_at = excluded.created_at;`,
      `insert into users (user_id, email, password_hash, email_verified_at, created_at)`,
      `  values (${lit(PICTURE_TENANT.userId)}, ${lit(PICTURE_TENANT.email)}, ${lit(pictureHash())}, ${at}, ${at})`,
      `  on conflict (user_id) do update set email = excluded.email, password_hash = excluded.password_hash, email_verified_at = excluded.email_verified_at, created_at = excluded.created_at;`,
      `insert into memberships (tenant_id, user_id, workspace_role, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.userId)}, 'OWNER', ${at})`,
      `  on conflict (tenant_id, user_id) do update set workspace_role = excluded.workspace_role, created_at = excluded.created_at;`,
      `insert into projects (tenant_id, project_id, name, code, client, site_address, district, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.projectId)}, ${lit(PICTURE_TENANT.projectName)}, ${lit(PICTURE_TENANT.projectCode)}, ${lit(PICTURE_TENANT.client)}, ${lit(PICTURE_TENANT.siteAddress)}, ${lit(PICTURE_TENANT.district)}, ${at})`,
      `  on conflict (project_id) do update set name = excluded.name, code = excluded.code, client = excluded.client, site_address = excluded.site_address, district = excluded.district, created_at = excluded.created_at;`,
    ].join("\n"),
  );
}

export default function globalSetup(): void {
  provisionE2eDatabase();
  if (process.env["CUBIT_E2E_PICTURE"] !== "1") return;
  provisionPictureTenant();
  process.stdout.write(`PICTURE TENANT ${PICTURE_TENANT.tenantId} at ${PICTURE_CLOCK} (${ROLE_MIGRATE} on ${new URL(e2eDatabaseUrl()).pathname.slice(1)})\n`);
}
