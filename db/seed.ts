// The development seed's one home (C-06, B-17).  This file is executable by scripts/seed.mjs and
// is also imported by the journey fixture so account, membership and project SQL cannot drift.
// Raw SQL leaves through live-sql's psql seam; this file deliberately imports no database driver.
import { scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GUC_SYSTEM_REASON } from "./__tests__/support/fixtures";
import { closePsqlPool, lit, run, withSession } from "./__tests__/support/live-sql";
import { storedAddressKey } from "../src/server/auth/session";

export interface SeedAccount {
  readonly userId: string;
  readonly email: string;
  readonly password: string;
  readonly name: string;
}

export interface SeedTenant {
  readonly tenantId: string;
  readonly name: string;
}

export interface SeedProject {
  readonly projectId: string;
  readonly name: string;
  readonly code: string;
  readonly client?: string;
  readonly siteAddress?: string;
  readonly district?: string;
  readonly buildingType?: string;
  readonly storeys?: number;
  readonly fixture?: string;
  readonly manifest?: string;
}

export interface SeedContent {
  readonly sha256: string;
  readonly byteLength: number;
}

const CLOCK = "2026-03-01T04:00:00.000Z";
const SCRYPT = { N: 32_768, r: 8, p: 1, keyLength: 64 } as const;
const SEED_SALT = "cubitdevseededsalt";
export const DEV_SEED_REASON = "dev: install the founder account and SAMPLE project";

export const DEV_FOUNDER: SeedAccount = Object.freeze({
  userId: "d3e00000-0000-4000-8000-000000000003",
  email: "founder@cubit.dev",
  password: "cubit-dev-founder-password",
  name: "Cubit Founder",
});

export const DEV_TENANT: SeedTenant = Object.freeze({
  tenantId: "d3e00000-0000-4000-8000-000000000001",
  name: "Founder Works",
});

type SampleManifest = {
  fixture?: string;
  project?: { name?: string; code?: string; buildingType?: string; storeys?: number };
};

const ROOT = resolveRoot();
const SAMPLE_MANIFEST = "scripts-data/sample-seed/manifest.json";

function resolveRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

function sampleManifest(): SampleManifest {
  return JSON.parse(readFileSync(join(ROOT, SAMPLE_MANIFEST), "utf8")) as SampleManifest;
}

const manifest = sampleManifest();
const sampleProject = manifest.project;
if (manifest.fixture === undefined || sampleProject?.name === undefined || sampleProject.code === undefined) {
  throw new Error(`${SAMPLE_MANIFEST} has no complete SAMPLE project entry`);
}

export const DEV_PROJECT: SeedProject = Object.freeze({
  projectId: "d3e00000-0000-4000-8000-000000000002",
  name: sampleProject.name,
  code: sampleProject.code,
  buildingType: sampleProject.buildingType,
  storeys: sampleProject.storeys,
  fixture: manifest.fixture,
  manifest: SAMPLE_MANIFEST,
});

/** The password hash format and cost the auth door verifies, with a stable salt for idempotence. */
export function seedPasswordHash(password: string): string {
  const salt = Buffer.from(SEED_SALT, "utf8");
  const key = scryptSync(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 256 * SCRYPT.N * SCRYPT.r,
  });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** The key written to users.email is the auth door's own fold, never the typed address. */
export function seedStoredEmail(email: string): string {
  return storedAddressKey(email);
}

/** Install the tenant, verified account and OWNER membership as one idempotent statement group. */
export function seedAccountSql(account: SeedAccount, tenant: SeedTenant): string {
  const at = lit(CLOCK);
  return [
    `insert into tenants (tenant_id, name, created_at) values (${lit(tenant.tenantId)}, ${lit(tenant.name)}, ${at})`,
    `  on conflict (tenant_id) do update set name = excluded.name, created_at = excluded.created_at;`,
    `insert into users (user_id, email, password_hash, email_verified_at, created_at)`,
    `  values (${lit(account.userId)}, ${lit(seedStoredEmail(account.email))}, ${lit(seedPasswordHash(account.password))}, ${at}, ${at})`,
    `  on conflict (user_id) do update set email = excluded.email, password_hash = excluded.password_hash, email_verified_at = excluded.email_verified_at, created_at = excluded.created_at;`,
    `insert into memberships (tenant_id, user_id, workspace_role, created_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(account.userId)}, 'OWNER', ${at})`,
    `  on conflict (tenant_id, user_id) do update set workspace_role = excluded.workspace_role, created_at = excluded.created_at;`,
  ].join("\n");
}

/** Install a project from the supplied fixture data, retaining optional fields when present. */
export function seedProjectSql(tenant: SeedTenant, project: SeedProject, _content?: SeedContent): string {
  void _content;
  const fields = ["tenant_id", "project_id", "name", "code"];
  const values = [lit(tenant.tenantId), lit(project.projectId), lit(project.name), lit(project.code)];
  const optional: [string, string | number | undefined][] = [
    ["client", project.client],
    ["site_address", project.siteAddress],
    ["district", project.district],
    ["building_type", project.buildingType],
    ["storeys", project.storeys],
  ];
  for (const [field, value] of optional) {
    if (value === undefined) continue;
    fields.push(field);
    values.push(typeof value === "number" ? String(value) : lit(value));
  }
  const assignments = fields.slice(2).map((field) => `${field} = excluded.${field}`).join(", ");
  const at = lit(CLOCK);
  fields.push("created_at");
  values.push(at);
  return [
    `insert into projects (${fields.join(", ")})`,
    `  values (${values.join(", ")})`,
    `  on conflict (project_id) do update set ${assignments}, created_at = excluded.created_at;`,
  ].join("\n");
}

/** Install project participation and the initial PRINCIPAL role (L-ACT-03, R-SPINE-011). */
export function seedProjectParticipantSql(account: SeedAccount, tenant: SeedTenant, project: SeedProject): string {
  const at = lit(CLOCK);
  const grantId = lit("d3e00000-0000-4000-8000-000000000004");
  return [
    `insert into participants (tenant_id, project_id, user_id, joined_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(project.projectId)}, ${lit(account.userId)}, ${at})`,
    `  on conflict (tenant_id, project_id, user_id) do nothing;`,
    `insert into participant_roles (tenant_id, grant_id, project_id, user_id, role, act_id, granted_at)`,
    `  values (${lit(tenant.tenantId)}, ${grantId}, ${lit(project.projectId)}, ${lit(account.userId)}, 'PRINCIPAL', null, ${at})`,
    `  on conflict (tenant_id, project_id, user_id, role) do nothing;`,
  ].join("\n");
}

/** The complete development install, optionally removing only this seed's deterministic rows first. */
export function devSeedSql(options: { reset?: boolean } = {}): string {
  const reset = options.reset === true
    ? [
        `delete from projects where project_id = ${lit(DEV_PROJECT.projectId)};`,
        `delete from memberships where tenant_id = ${lit(DEV_TENANT.tenantId)} and user_id = ${lit(DEV_FOUNDER.userId)};`,
        `delete from users where user_id = ${lit(DEV_FOUNDER.userId)};`,
        `delete from tenants where tenant_id = ${lit(DEV_TENANT.tenantId)};`,
      ]
    : [];
  return withSession(
    { [GUC_SYSTEM_REASON]: DEV_SEED_REASON },
    [
      ...reset,
      seedAccountSql(DEV_FOUNDER, DEV_TENANT),
      seedProjectSql(DEV_TENANT, DEV_PROJECT),
      seedProjectParticipantSql(DEV_FOUNDER, DEV_TENANT, DEV_PROJECT),
    ].join("\n"),
  );
}

/** The stage runner invokes this file directly; the return value is useful to focused callers. */
export default function main(argv: string[] = process.argv.slice(2)): number {
  const url = process.env["DATABASE_URL"]?.trim();
  if (url === undefined || url === "") {
    process.stderr.write("REFUSE seed DATABASE_URL missing — point it at cubit_dev (B-21)\n");
    return 1;
  }
  try {
    run(url, devSeedSql({ reset: argv.includes("--reset") }));
    return 0;
  } finally {
    closePsqlPool();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();