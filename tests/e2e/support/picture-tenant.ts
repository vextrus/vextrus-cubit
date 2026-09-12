// THE PICTURE TENANT (AM-09 §4, Design Direction 00 §9.3).
//
// "Picture tests run against the fixed picture tenant and the frozen fixture, never against a
// freshly generated project." The reason is the magenta masks. Every baseline in this lane today
// paints over the parts of the frame that change between runs — a per-run email address, a
// last-activity date, a generated id — and a mask is a hole in the evidence: the founder's read of
// the stills was right partly BECAUSE the masks hid the thing being judged. A tenant whose ids,
// names and clock are literals needs no masks, because nothing in its frame moves.
//
// Everything here is a LITERAL, and deliberately so: a derived id is an id that changes when the
// derivation changes, and then the pictures change with it. The UUIDs are in the `f1c7u2e0` family
// so a row found in a database by hand is recognisable as this fixture's and nobody's customer.
//
// THIS TENANT IS ON BY DEFAULT since the v22 U2 re-baseline lease (2026-09-12): every committed
// baseline is a picture of it, so a run that did not provision it would compare this world against
// pictures of another one. `CUBIT_E2E_PICTURE=0` is the bisect escape (`pictureLane()`, B-17).
import { scryptSync } from "node:crypto";
import { GUC_SYSTEM_REASON } from "../../../db/__tests__/support/fixtures";
import { lit, run, withSession } from "../../../db/__tests__/support/live-sql";

/** The frozen instant every picture is taken at: 2026-03-01 10:00 Asia/Dhaka, stated in UTC. */
export const PICTURE_CLOCK = "2026-03-01T04:00:00.000Z";

/** The workspace, the project, the account — ids and names, all literal, all frozen. */
export const PICTURE_TENANT = Object.freeze({
  tenantId: "f1c70000-0000-4000-8000-000000000001",
  projectId: "f1c70000-0000-4000-8000-000000000002",
  userId: "f1c70000-0000-4000-8000-000000000003",
  drawingId: "f1c70000-0000-4000-8000-000000000004",
  sheetId: "f1c70000-0000-4000-8000-000000000005",
  /** The account the pictures are taken as. Fixed, so `shell-user` needs no mask. */
  email: "surveyor@picture.cubit.test",
  password: "picture-tenant-fixed-password",
  /** What the frame reads, top left to bottom right. */
  workspaceName: "Meghna Works",
  projectName: "Riverside Tower",
  projectCode: "RT-01",
  client: "Meghna Holdings",
  siteAddress: "Plot 14, Gulshan Avenue",
  district: "Dhaka",
  /** The sheet and the lines the register and the viewer paint in a still. */
  sheetName: "A-101 — Foundation Plan",
  lineNames: Object.freeze(["Substructure — Excavation", "Substructure — Blinding", "Substructure — Pile cap"]),
});

/** The picture tenant's own address, for a journey that navigates to it without a sign-in leg. */
export const PICTURE_ROUTES = Object.freeze({
  workspace: `/t/${PICTURE_TENANT.tenantId}`,
  project: `/t/${PICTURE_TENANT.tenantId}/p/${PICTURE_TENANT.projectId}`,
});


/**
 * scrypt's cost and format as `src/server/auth/secrets.ts` states them — the door verifies what is
 * in the column, so the fixture must write what that door reads. The salt is a literal rather than
 * random for the reason everything in this tenant is: a hash that changes per run is a row that
 * changes per run.
 */
const SCRYPT = { N: 32_768, r: 8, p: 1, keyLength: 64 } as const;
const PICTURE_SALT = "cubitpicturesalt";

/** The picture account's stored credential, derived the way the sign-in door derives it. */
export function pictureHash(): string {
  const salt = Buffer.from(PICTURE_SALT, "utf8");
  const key = scryptSync(PICTURE_TENANT.password, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 256 * SCRYPT.N * SCRYPT.r });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/**
 * WHY THIS SEED NAMES A REASON (SEAM-TENANT, db/migrations/0000_tenancy-base.sql).
 *
 * Every tenant-scoped table is `ENABLE ROW LEVEL SECURITY` **and `FORCE ROW LEVEL SECURITY`**, and
 * the migration says why in as many words: "without it the table's owner reads and writes past its
 * own policies, and a guarantee the owner escapes is not a guarantee". So connecting as the owner
 * buys NOTHING here — `cubit_migrate` is refused `insert into tenants` with 42501 exactly as
 * `cubit_app` is. The role was never the missing piece.
 *
 * What the policies actually arm on is a NON-EMPTY REASON:
 *
 *     CREATE POLICY "tenants_system_scope" ON "tenants" FOR ALL
 *       USING (nullif(current_setting('cubit.system_reason', true), '') IS NOT NULL)
 *
 * — "System scope is armed by a non-empty reason and by nothing else: the reason IS the attribution,
 * so a session that names none sees no row at all." That is the same door `runAsSystem(reason)` opens
 * in the product and the same one the live seam suite opens with `SEED_REASON`; this fixture is not
 * a special case, it just has its own reason to give.
 */
export const PICTURE_SEED_REASON = "fixture: install the picture tenant for §9.3's evidence stills";

/**
 * The picture tenant, written idempotently. Every insert is `on conflict do update`, so a second run
 * over the same cluster converges on the same rows rather than refusing or doubling — the fixture is
 * a STATE the lane arrives at, not an event it performs.
 *
 * The URL is a parameter and not a call to `migrateUrlForPictureTenant()` inside, so the seed can be
 * pointed at a scratch database and proved to land rows.
 */
export function seedPictureTenant(url: string): void {
  const at = lit(PICTURE_CLOCK);
  run(
    url,
    withSession({ [GUC_SYSTEM_REASON]: PICTURE_SEED_REASON }, [
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
    ].join("\n")),
  );
}
