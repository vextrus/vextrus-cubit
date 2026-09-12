/**
 * THE SEEDED WORKER TENANTS — idempotent, and distinct per worker (v22 speed, decision 2).
 *
 * The lane installs one tenant per Playwright worker before the first journey, so that a spec which
 * needs a signed-in owner with a project and an ingested drawing signs IN rather than walking the
 * sign-up, verification, workspace and upload doors. Two properties make that lawful, and neither of
 * them needs a database to judge:
 *
 *   · IDEMPOTENT — the lane's database outlives a run (V-E2E), so a second run must converge on the
 *     same rows rather than adding a second set. Every id is a literal function of the index and
 *     every insert names its conflict.
 *   · PER-INDEX DISTINCT — two workers must share no id, no address and no storage prefix, or one
 *     worker's act satisfies the other's assertion (P4b §1, the fault the lane already had once).
 *
 * It lives in db/__tests__/ and NOT in tests/journeys/ for one mechanical reason: the lane split is
 * derived from what a suite reaches (scripts/lib/pg-suites.mjs), and `seeded-tenant.ts` reaches the
 * harness's live-sql module for `lit`/`run`/`withSession` — so any suite that imports it is the
 * database lane's, exactly as db/__tests__/picture-tenant-seed.live.test.ts is. Nothing here opens a
 * connection; what is proved is what a live test could not tell you anyway — that the SQL says what
 * it must say, about the right ids, and that nothing in it is a second spelling of a fact declared
 * elsewhere.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  SEEDED_FIXTURE,
  SEEDED_PASSWORD,
  seededContent,
  seededHash,
  seededStoredEmail,
  seededTenant,
  seededTenantCount,
  seededTenantSql,
} from "../../tests/e2e/support/seeded-tenant";
import { storedAddressKey } from "../../src/server/auth/session";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONTENT = seededContent(REPO_ROOT);

describe("one tenant per worker, and no two the same", () => {
  test("every id, address and name is a function of the index, and no two workers collide", () => {
    const six = Array.from({ length: 6 }, (_, index) => seededTenant(index));
    const everything = six.flatMap((tenant) => [
      tenant.tenantId,
      tenant.projectId,
      tenant.userId,
      tenant.drawingId,
      tenant.ingestId,
      tenant.sheetId,
      tenant.rasterIds.thumb,
      tenant.rasterIds.preview,
      tenant.email,
    ]);
    expect(new Set(everything).size, "two workers sharing one id is one worker's act satisfying the other's assertion (P4b §1)").toBe(everything.length);
    for (const tenant of six) {
      expect(tenant.tenantId, "the ids are UUIDs of the 5eed… family, so a row found by hand is recognisably this fixture's").toMatch(
        /^5eed0000-0000-4000-8000-[0-9a-f]{12}$/,
      );
      expect(tenant.email).toBe(`tenant-w${tenant.index}@seeded.cubit.test`);
    }
  });

  test("the same index always names the same tenant — which is what makes the seed idempotent", () => {
    expect(seededTenant(3)).toEqual(seededTenant(3));
    expect(seededTenant(3).tenantId).not.toBe(seededTenant(4).tenantId);
  });

  test("the count is the worker count, floored at one — never a list somebody has to keep", () => {
    expect(seededTenantCount(4)).toBe(4);
    expect(seededTenantCount(6)).toBe(6);
    expect(seededTenantCount(0)).toBe(1);
  });
});

describe("the SQL converges rather than accumulates", () => {
  const sql = seededTenantSql(seededTenant(2), CONTENT);

  test("every insert names what happens on conflict — a second run rewrites or keeps, never adds", () => {
    const inserts = [...sql.matchAll(/insert into (\w+)/g)].map((match) => match[1] ?? "");
    expect(inserts.sort(), "the seven tables one seeded tenant is made of").toEqual(
      ["drawings", "files", "ingests", "memberships", "projects", "sheet_rasters", "sheet_rasters", "sheet_rasters", "tenants", "users"].sort(),
    );
    expect([...sql.matchAll(/on conflict/g)]).toHaveLength(inserts.length);
    // The four APPEND-ONLY ledgers may not be UPDATEd — `cubit_append_only()` refuses with 42501 —
    // so convergence there is the row already being what the fixture says.
    for (const ledger of ["files", "drawings", "ingests", "sheet_rasters"]) {
      const statement = sql.slice(sql.indexOf(`insert into ${ledger}`));
      expect(statement.slice(0, statement.indexOf(";") + 1), `${ledger} is append-only`).toMatch(/on conflict[^;]*do nothing/);
    }
  });

  test("the SQL is about THIS worker's tenant and no other", () => {
    const mine = seededTenant(2);
    expect(sql).toContain(mine.tenantId);
    expect(sql).toContain(mine.projectId);
    expect(sql).not.toContain(seededTenant(1).tenantId);
    expect(sql).not.toContain(seededTenant(3).userId);
  });

  test("the account is written under the DOOR's fold of the address, never the address as typed", () => {
    const mine = seededTenant(2);
    expect(seededStoredEmail(mine)).toBe(storedAddressKey(mine.email));
    expect(sql, "the raw address in the row is a row the sign-in door cannot find (cubit-u2i)").not.toContain(`'${mine.email}'`);
    expect(sql).toContain(storedAddressKey(mine.email));
  });

  test("the credential is the door's own scrypt spelling, and it is paid for once", () => {
    expect(seededHash()).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(seededHash(), "one password for every seeded tenant means ONE scrypt for the whole seed").toBe(seededHash());
    expect(SEEDED_PASSWORD.length).toBeGreaterThan(8);
  });

  test("the account is VERIFIED and OWNS its workspace — the two facts the prologue walked for", () => {
    expect(sql).toMatch(/email_verified_at/);
    expect(sql).toMatch(/'OWNER'/);
  });
});

describe("the drawing is F-RCC6, named by the SAMPLE seed rather than by a second digest", () => {
  test("the sha and the byte length are the manifest's and the committed file's", () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, SEEDED_FIXTURE.manifest), "utf8")) as { files: { path: string; sha256: string }[] };
    const named = manifest.files.find((entry) => entry.path === SEEDED_FIXTURE.path);
    expect(CONTENT.sha256, "the digest is READ out of scripts-data/sample-seed/manifest.json, never re-spelled here").toBe(named?.sha256);
    expect(CONTENT.byteLength).toBe(readFileSync(join(REPO_ROOT, SEEDED_FIXTURE.path)).byteLength);
  });

  test("the rows name that sha, so the bytes the seed copies are the bytes the rows point at", () => {
    const sql = seededTenantSql(seededTenant(0), CONTENT);
    expect(sql).toContain(CONTENT.sha256);
    expect(sql, "one sheet, named the way every sheet-facing spec asks for it").toContain(SEEDED_FIXTURE.sheetName);
    for (const tier of ["thumb", "preview", "full"]) expect(sql).toContain(`'${tier}'`);
  });
});
