import { describe, expect, test } from "vitest";
import { DEV_FOUNDER, DEV_PROJECT, DEV_TENANT, devSeedSql, seedAccountSql, seedPasswordHash, seedProjectSql, seedStoredEmail } from "../../db/seed";
import { storedAddressKey } from "../../src/server/auth/session";

describe("the development seed", () => {
  const sql = devSeedSql();

  test("declares the deterministic founder, tenant and SAMPLE project", () => {
    expect(DEV_FOUNDER.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(DEV_TENANT.tenantId).toMatch(/^[0-9a-f-]{36}$/);
    expect(DEV_PROJECT.projectId).toMatch(/^[0-9a-f-]{36}$/);
    expect(DEV_PROJECT.fixture).toBe("F-RCC6");
    expect(DEV_PROJECT.name).toBe("SAMPLE: six-storey RCC residential building");
    expect(DEV_PROJECT.code).toBe("SAMPLE-RCC6");
    expect(DEV_PROJECT.manifest).toBe("scripts-data/sample-seed/manifest.json");
  });

  test("writes the account under the auth door's folded key with its scrypt format", () => {
    expect(seedStoredEmail(DEV_FOUNDER.email)).toBe(storedAddressKey(DEV_FOUNDER.email));
    expect(seedPasswordHash(DEV_FOUNDER.password)).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(seedAccountSql(DEV_FOUNDER, DEV_TENANT)).toContain(seedStoredEmail(DEV_FOUNDER.email));
    expect(seedAccountSql(DEV_FOUNDER, DEV_TENANT)).toContain("'OWNER'");
    expect(seedAccountSql(DEV_FOUNDER, DEV_TENANT)).toContain("email_verified_at");
  });

  test("is idempotent: every insert has an explicit conflict action", () => {
    const inserts = [...sql.matchAll(/insert into (\w+)/g)].map((match) => match[1]);
    expect(inserts).toEqual(["tenants", "users", "memberships", "projects", "participants", "participant_roles"]);
    expect([...sql.matchAll(/on conflict/g)]).toHaveLength(inserts.length);
    expect(sql).toContain(DEV_TENANT.tenantId);
    expect(sql).toContain(DEV_PROJECT.projectId);
    expect(devSeedSql({ reset: true })).toContain(`delete from projects where project_id = '${DEV_PROJECT.projectId}'`);
  });

  test("produces reproducible SQL output for canonical dev entities", () => {
    const secondSql = devSeedSql();
    expect(secondSql).toBe(sql);
    expect(sql).toContain(DEV_FOUNDER.userId);
    expect(sql).toContain(DEV_TENANT.tenantId);
    expect(sql).toContain(DEV_PROJECT.projectId);
  });
});

test("the project helper remains reusable for worker-specific deterministic projects", () => {
  const workerSql = seedProjectSql(DEV_TENANT, { projectId: "d3e00000-0000-4000-8000-000000000099", name: "Worker", code: "W-01" });
  expect(workerSql).toContain("on conflict (project_id) do update");
  expect(workerSql).toContain("'Worker'");
});