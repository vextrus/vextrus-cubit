/**
 * THE PICTURE TENANT'S SEED, PROVED AGAINST A LIVE DATABASE.
 *
 * The fixture is installed by the journeys' global setup before the first journey runs, and until
 * this suite existed nothing checked that it WORKED: a `globalSetup` that throws takes the whole run
 * down before a single test reports, so the failure arrives as a wall of nothing rather than as a
 * named defect. It failed exactly that way on 2026-09-12 — SQLSTATE 42501, "new row violates
 * row-level security policy for table tenants" — and the fix is unprovable without a suite that can
 * watch the rows land.
 *
 * THE FAULT WAS NOT THE ROLE. Every tenant-scoped table is `FORCE ROW LEVEL SECURITY`, and
 * db/migrations/0000_tenancy-base.sql says why: "without it the table's owner reads and writes past
 * its own policies, and a guarantee the owner escapes is not a guarantee." So the owner is refused
 * exactly as the app role is, and reaching for a more privileged connection would have been the
 * wrong fix even if it had worked. What the policies arm on is a NON-EMPTY REASON —
 * `cubit.system_reason` — because "the reason IS the attribution, so a session that names none sees
 * no row at all". This suite asserts both halves: the seed lands its rows WITH the reason, and the
 * same script is still refused WITHOUT it.
 *
 * That second half is the one that matters in a year. A seed that merely works can be made to work
 * by a privilege nobody notices; a seed whose script is provably refused without its reason cannot.
 */
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { GUC_SYSTEM_REASON } from "./support/fixtures";
import { count, lit, psql, scalar, withSession } from "./support/live-sql";
import { PICTURE_CLOCK, PICTURE_CONTENT, PICTURE_SEED_REASON, PICTURE_TENANT, pictureStoredEmail, seedPictureTenant } from "../../tests/e2e/support/picture-tenant";
import { storedAddressKey } from "../../src/server/auth/session";

let stage: ScratchDb | null = null;

/** The scratch database this suite writes into, made once and dropped after. */
async function database(): Promise<ScratchDb> {
  stage ??= await provisionScratchDb();
  return stage;
}

afterAll(async () => {
  await stage?.drop();
  stage = null;
});

/** Reading the fixture's own rows is system-scoped too: the reader names why it is looking. */
const READING = "test: read the picture tenant's rows back";

describe("the picture tenant's seed (AM-09 §4, Design Direction 00 §9.3)", () => {
  it("lands the workspace, the account, the membership and the project, as the literals it names", async () => {
    const { urlMigrate } = await database();

    seedPictureTenant(urlMigrate);

    const read = (script: string): string => scalar(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, script));
    expect(read(`select name from tenants where tenant_id = ${lit(PICTURE_TENANT.tenantId)};`), "the workspace is named as the fixture names it").toBe(PICTURE_TENANT.workspaceName);
    expect(read(`select email from users where user_id = ${lit(PICTURE_TENANT.userId)};`), "the account is stored under the KEY the door reads, not the address as typed").toBe(storedAddressKey(PICTURE_TENANT.email));
    expect(read(`select workspace_role from memberships where tenant_id = ${lit(PICTURE_TENANT.tenantId)} and user_id = ${lit(PICTURE_TENANT.userId)};`), "and it owns that workspace").toBe("OWNER");
    expect(read(`select name from projects where project_id = ${lit(PICTURE_TENANT.projectId)};`), "the project every screen is pictured inside").toBe(PICTURE_TENANT.projectName);
  });

  it("is idempotent: a second run over the same cluster converges rather than refusing or doubling", async () => {
    const { urlMigrate } = await database();

    seedPictureTenant(urlMigrate);
    seedPictureTenant(urlMigrate);

    const rows = (table: string, where: string): number => count(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, `select count(*) from ${table} where ${where};`));
    expect(rows("tenants", `tenant_id = ${lit(PICTURE_TENANT.tenantId)}`), "one workspace, however many times the lane starts").toBe(1);
    expect(rows("users", `user_id = ${lit(PICTURE_TENANT.userId)}`)).toBe(1);
    expect(rows("memberships", `tenant_id = ${lit(PICTURE_TENANT.tenantId)} and user_id = ${lit(PICTURE_TENANT.userId)}`)).toBe(1);
    expect(rows("projects", `project_id = ${lit(PICTURE_TENANT.projectId)}`)).toBe(1);
    expect(rows("drawings", `drawing_id = ${lit(PICTURE_TENANT.drawingId)}`), "one drawing, however many times the lane starts").toBe(1);
    expect(rows("ingests", `ingest_id = ${lit(PICTURE_CONTENT.ingestId)}`)).toBe(1);
    expect(rows("sheet_rasters", `drawing_id = ${lit(PICTURE_TENANT.drawingId)}`), "and three rasters, not six").toBe(3);
  });

  it("freezes the clock in the rows themselves, so nothing in a still moves between runs", async () => {
    const { urlMigrate } = await database();

    seedPictureTenant(urlMigrate);

    const created = scalar(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, `select created_at = ${lit(PICTURE_CLOCK)}::timestamptz from projects where project_id = ${lit(PICTURE_TENANT.projectId)};`));
    expect(created, `the project is created at the frozen instant ${PICTURE_CLOCK}`).toBe("t");
  });

  it("IS REFUSED WITHOUT ITS REASON — the owner does not escape the policy it owns (SEAM-TENANT)", async () => {
    const { urlMigrate } = await database();

    // The same insert the seed makes, as the OWNER, naming no reason. `FORCE ROW LEVEL SECURITY` is
    // what makes this a refusal rather than a write, and 42501 is what it refuses with.
    const refused = psql(urlMigrate, `insert into tenants (tenant_id, name, created_at) values (${lit(PICTURE_TENANT.tenantId)}, ${lit(PICTURE_TENANT.workspaceName)}, ${lit(PICTURE_CLOCK)});`);

    expect(refused.ok, "a session that names no reason writes no tenant row, whatever role it holds").toBe(false);
    expect(refused.sqlstate, "and it is refused by the policy, not by a privilege: 42501").toBe("42501");
  });

  it("STORES THE ACCOUNT WHERE THE SIGN-IN DOOR LOOKS — the fold is the door's, not a copy of it (B-17)", async () => {
    const { urlMigrate } = await database();

    seedPictureTenant(urlMigrate);

    // The bug this suite once asserted: the seed wrote the raw address, `signIn` looks the account
    // up under `storedAddress(email)`, found no row, and answered CREDENTIALS_NOT_VALID — so the
    // picture lane could not sign in at all and the gallery's stills were pictures of the auth card.
    const stored = scalar(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, `select email from users where user_id = ${lit(PICTURE_TENANT.userId)};`));
    expect(stored, "the fixture's key IS the door's key, computed by the door's own function").toBe(storedAddressKey(PICTURE_TENANT.email));
    expect(pictureStoredEmail(), "and the fixture publishes that key rather than re-spelling the tag").toBe(storedAddressKey(PICTURE_TENANT.email));
    expect(stored, "which is not the address as typed — the thing the old assertion froze").not.toBe(PICTURE_TENANT.email);
    // The door finds exactly one account under that key, which is the property the sign-in makes.
    expect(count(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, `select count(*) from users where email = ${lit(storedAddressKey(PICTURE_TENANT.email))};`)), "one account answers the address the pictures are taken as").toBe(1);
  });

  it("lands the drawing, its content, its record and its sheet — the rows the gallery's addresses name", async () => {
    const { urlMigrate } = await database();

    seedPictureTenant(urlMigrate);

    const read = (script: string): string => scalar(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, script));
    expect(read(`select name from drawings where drawing_id = ${lit(PICTURE_TENANT.drawingId)};`), "the drawing the viewer's address names").toBe(PICTURE_TENANT.drawingName);
    expect(read(`select byte_length::text from files where tenant_id = ${lit(PICTURE_TENANT.tenantId)} and sha256 = ${lit(PICTURE_CONTENT.sha256)};`), "pointing at content that exists — `drawings_content` is a foreign key").toBe(String(PICTURE_CONTENT.byteLength));
    expect(read(`select drawing_id::text from ingests where ingest_id = ${lit(PICTURE_CONTENT.ingestId)};`), "one record, read out of that drawing").toBe(PICTURE_TENANT.drawingId);
    expect(count(urlMigrate, withSession({ [GUC_SYSTEM_REASON]: READING }, `select count(*) from sheet_rasters where drawing_id = ${lit(PICTURE_TENANT.drawingId)} and layout_name = ${lit(PICTURE_TENANT.sheetName)};`)), "the sheet the viewer opens, at its three tiers").toBe(3);
  });

  it("names a reason that says what it is for — the reason IS the attribution", () => {
    expect(PICTURE_SEED_REASON.trim(), "an empty reason arms nothing, which is the whole design").not.toBe("");
    expect(PICTURE_SEED_REASON, "and a reader of the act log should be able to tell why these rows exist").toContain("picture tenant");
  });
});
