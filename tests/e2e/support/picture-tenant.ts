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
import { INGEST_SCHEME } from "../../../src/core/entitygraph/schema";
import { storedAddressKey } from "../../../src/server/auth/session";

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
  /** The drawing the gallery's viewer still is taken of, as the drawings list names it. */
  drawingName: "RT-01 — Foundation Package.dxf",
  /** The sheet and the lines the register and the viewer paint in a still. */
  sheetName: "A-101 — Foundation Plan",
  lineNames: Object.freeze(["Substructure — Excavation", "Substructure — Blinding", "Substructure — Pile cap"]),
});

/**
 * The content the drawing is made of, and the record taken out of it. Literals for the same reason
 * the ids are: a sha computed per run is a row that changes per run, and the drawings list prints it.
 * `f1c7…` again, so a row found by hand is recognisably this fixture's.
 */
export const PICTURE_CONTENT = Object.freeze({
  sha256: "f1c7c0de00000000000000000000000000000000000000000000000000000000",
  byteLength: 262_144,
  format: "dxf",
  ingestId: "f1c70000-0000-4000-8000-000000000006",
  /** The three tiers the sheet index and the viewer read, one raster id each (`sheetId` is the full one). */
  rasterIds: Object.freeze({ thumb: "f1c70000-0000-4000-8000-000000000007", preview: "f1c70000-0000-4000-8000-000000000008", full: PICTURE_TENANT.sheetId }),
  rasterSize: Object.freeze({ thumb: [320, 226] as const, preview: [1280, 905] as const, full: [3370, 2384] as const }),
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
 * THE KEY THE ACCOUNT IS STORED UNDER — the door's own fold, never a second spelling of it.
 *
 * `users.email` does not hold the address as typed: every door writes and reads it through
 * `storedAddress` (`src/server/auth/session.ts`), which folds it with `foldedKey` — the fold's one
 * home (B-17). A fixture that wrote the raw address wrote a row the sign-in door cannot find:
 * `where(eq(users.email, "as presented surveyor@picture.cubit.test"))` matched nothing, so the
 * picture tenant was answered CREDENTIALS_NOT_VALID and every gallery still was a picture of the
 * sign-in card. Calling the exported key function rather than re-spelling `as presented ` here is
 * the whole point: if the fold ever changes, this fixture changes with it and cannot drift.
 */
export function pictureStoredEmail(): string {
  return storedAddressKey(PICTURE_TENANT.email);
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
      `  values (${lit(PICTURE_TENANT.userId)}, ${lit(pictureStoredEmail())}, ${lit(pictureHash())}, ${at}, ${at})`,
      `  on conflict (user_id) do update set email = excluded.email, password_hash = excluded.password_hash, email_verified_at = excluded.email_verified_at, created_at = excluded.created_at;`,
      `insert into memberships (tenant_id, user_id, workspace_role, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.userId)}, 'OWNER', ${at})`,
      `  on conflict (tenant_id, user_id) do update set workspace_role = excluded.workspace_role, created_at = excluded.created_at;`,
      `insert into projects (tenant_id, project_id, name, code, client, site_address, district, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.projectId)}, ${lit(PICTURE_TENANT.projectName)}, ${lit(PICTURE_TENANT.projectCode)}, ${lit(PICTURE_TENANT.client)}, ${lit(PICTURE_TENANT.siteAddress)}, ${lit(PICTURE_TENANT.district)}, ${at})`,
      `  on conflict (project_id) do update set name = excluded.name, code = excluded.code, client = excluded.client, site_address = excluded.site_address, district = excluded.district, created_at = excluded.created_at;`,
      // THE DRAWING THE PICTURES ARE TAKEN OF. Until 2026-09-12 the seed stopped at the project, so
      // `gallery-v22.spec.ts` navigated to a `drawingId` no row answered for and the drawings, viewer
      // and takeoff stills were pictures of an empty state. The content row comes first because
      // `drawings_content` is a composite foreign key onto it: a drawing is a name pointing at bytes.
      `insert into files (tenant_id, sha256, byte_length, format, scan_verdict, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_CONTENT.sha256)}, ${PICTURE_CONTENT.byteLength}, ${lit(PICTURE_CONTENT.format)}, 'clean', ${at})`,
      // DO NOTHING, not DO UPDATE: these four are APPEND-ONLY ledgers (`cubit_append_only()` refuses
      // an UPDATE with 42501 — "a row written is immutable"). Convergence here is therefore the row
      // already being what the fixture says, which is the same state a second run arrives at.
      `  on conflict (tenant_id, sha256) do nothing;`,
      `insert into drawings (tenant_id, drawing_id, project_id, sha256, name, format, uploaded_by, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.drawingId)}, ${lit(PICTURE_TENANT.projectId)}, ${lit(PICTURE_CONTENT.sha256)}, ${lit(PICTURE_TENANT.drawingName)}, ${lit(PICTURE_CONTENT.format)}, ${lit(PICTURE_TENANT.userId)}, ${at})`,
      `  on conflict (drawing_id) do nothing;`,
      // The record the sheet was read out of. `facts` is the extractor's own counters; one sheet was
      // read, which is what the fixture holds — a made-up count would be a number a screen prints.
      `insert into ingests (tenant_id, ingest_id, drawing_id, sha256, job_id, artifact_sha256, extractor_scheme, extractor_tool, extractor_tool_version, extractor_parameter_set_hash, facts, created_at)`,
      `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_CONTENT.ingestId)}, ${lit(PICTURE_TENANT.drawingId)}, ${lit(PICTURE_CONTENT.sha256)}, ${lit("fixture-picture-ingest")}, ${lit(PICTURE_CONTENT.sha256)}, ${lit(INGEST_SCHEME)}, 'fixture', '1.0.0', ${lit(PICTURE_CONTENT.sha256.slice(0, 16))}, ${lit(JSON.stringify({ layouts: 1, entities: 0 }))}::json, ${at})`,
      `  on conflict (ingest_id) do nothing;`,
      // The sheet itself: a layout is a row per tier, and the layout NAME is what the viewer's
      // address carries (`PICTURE_TENANT.sheetName`), so the three rows are what make that URL resolve.
      ...(["thumb", "preview", "full"] as const).map((tier) =>
        [
          `insert into sheet_rasters (tenant_id, raster_id, ingest_id, drawing_id, job_id, layout_name, tier, width, height, sha256, created_at)`,
          `  values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_CONTENT.rasterIds[tier])}, ${lit(PICTURE_CONTENT.ingestId)}, ${lit(PICTURE_TENANT.drawingId)}, ${lit(`fixture-picture-raster-${tier}`)}, ${lit(PICTURE_TENANT.sheetName)}, ${lit(tier)}, ${PICTURE_CONTENT.rasterSize[tier][0]}, ${PICTURE_CONTENT.rasterSize[tier][1]}, ${lit(PICTURE_CONTENT.sha256)}, ${at})`,
          `  on conflict (raster_id) do nothing;`,
        ].join("\n"),
      ),
    ].join("\n")),
  );
}
