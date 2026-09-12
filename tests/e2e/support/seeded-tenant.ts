// THE SEEDED WORKER TENANTS (v22 speed, the founder's second decision: "no walking the sign-up /
// upload prologue per worker").
//
// WHAT THIS REPLACES. Every journey but J-000 needs the same three facts before it can walk: a
// verified account, a workspace it owns, and a project inside it — and most of them want a drawing
// already ingested on top. Fifteen specs reached those facts by DRIVING THE DOORS: sign up (or read
// the ACCOUNT_ALREADY_EXISTS refusal), open the verification mail out of the outbox, sign in, click
// the workspace door, read the tenant id off the URL, look for a project card and create one if it
// is absent. Every one of those is a round trip to the served product, and every one of them is a
// walk of screens the spec is not about. A journey that is about the register paid for the sign-up
// door to be exercised a sixteenth time.
//
// WHY THIS IS NOT "HAND-STAGING" (AM-09 §2). The rule is about a LEG: "a journey never installs
// product state by calling module functions, importing server actions or writing to the database —
// it clicks what a customer clicks." The prologue is not the leg. The picture tenant has stood on
// exactly this reading since AM-09 §4 — a fixture the LANE installs before the first journey, never
// a journey — and this is the same fixture, once per Playwright worker instead of once per lane.
// J-000 is the exception that proves it: the golden path IS the prologue, so it still walks every
// click of it (tests/e2e/journeys/j-000/golden-run.ts).
//
// ONE TENANT PER WORKER, keyed on `parallelIndex`. That is the isolation this lane can have
// (tests/e2e/support/worker.ts states why a per-worker DATABASE is not one this server can serve):
// every row is tenant-scoped under RLS, and every stored object lives at `<root>/<tenantId>/<sha>`,
// so two workers holding two tenants can address none of each other's rows or bytes. The ids are
// LITERALS derived from the index — `5eed…` so a row found by hand is recognisably this fixture's
// and nobody's customer — which is what makes the seed idempotent: a second run converges on the
// same rows rather than adding a second set.
//
// Playwright-free, exactly as `picture-tenant.ts` is and for the same reason: the facts and the SQL
// are wanted by the journeys' global setup AND by a vitest that can prove the seed without a browser.
import { scryptSync } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { GUC_SYSTEM_REASON } from "../../../db/__tests__/support/fixtures";
import { lit, run, withSession } from "../../../db/__tests__/support/live-sql";
import { INGEST_SCHEME } from "../../../src/core/entitygraph/schema";
import { storedAddressKey } from "../../../src/server/auth/session";

/** The instant every seeded row carries, so a screen that prints a date prints the same one twice. */
export const SEEDED_CLOCK = "2026-03-01T04:00:00.000Z";

/** The password every seeded account holds. One password, so ONE scrypt is paid for the whole seed. */
export const SEEDED_PASSWORD = "seeded-worker-tenant-password";

/** The corpus each seeded tenant already holds, as the SAMPLE seed package pins it. */
export const SEEDED_FIXTURE = Object.freeze({
  /** The manifest that names the bytes — read rather than re-spelled, so the two cannot drift. */
  manifest: "scripts-data/sample-seed/manifest.json",
  /** The drawing the seed lands: F-RCC6's DXF, the same file J-000's prologue uploads by hand. */
  path: "fixtures/rcc6/rcc6.dxf",
  format: "dxf",
  /** The layout the extractor reads out of it, and the name every sheet-facing spec asks for. */
  sheetName: "FOUNDATION PLAN",
});

/** What one seeded worker tenant is. Every field a literal, every literal a function of the index. */
export interface SeededTenant {
  readonly index: number;
  readonly tenantId: string;
  readonly projectId: string;
  readonly userId: string;
  readonly drawingId: string;
  readonly ingestId: string;
  readonly sheetId: string;
  readonly rasterIds: Readonly<Record<"thumb" | "preview" | "full", string>>;
  /** The address as a person types it. What goes in the row is the door's fold of it (below). */
  readonly email: string;
  readonly password: string;
  readonly workspaceName: string;
  readonly projectName: string;
  readonly projectCode: string;
}

/** A UUID of the `5eed…` family: the worker's index, then which object of that worker's it names. */
function seededId(index: number, object: number): string {
  return `5eed0000-0000-4000-8000-${String(index).padStart(6, "0")}${String(object).padStart(6, "0")}`;
}

/**
 * THE TENANT WORKER `index` WALKS AS. Derived, never listed: a lane asked for six workers seeds six,
 * and the seventh worker of a mis-stated run addresses a tenant nobody seeded and is told so by the
 * sign-in door rather than by a silence.
 */
export function seededTenant(index: number): SeededTenant {
  return Object.freeze({
    index,
    tenantId: seededId(index, 1),
    projectId: seededId(index, 2),
    userId: seededId(index, 3),
    drawingId: seededId(index, 4),
    ingestId: seededId(index, 5),
    sheetId: seededId(index, 6),
    rasterIds: Object.freeze({ thumb: seededId(index, 7), preview: seededId(index, 8), full: seededId(index, 6) }),
    email: `tenant-w${index}@seeded.cubit.test`,
    password: SEEDED_PASSWORD,
    workspaceName: `Worker ${index} Works`,
    projectName: `Worker ${index} Tower`,
    projectCode: `W${index}-01`,
  });
}

/**
 * The scrypt parameters the sign-in door verifies against, and a fixed salt — a hash that changes
 * per run is a row that changes per run, and this one is computed ONCE for the whole seed because
 * scrypt at N=32768 costs about a tenth of a second and N tenants would otherwise pay it N times.
 */
const SCRYPT = { N: 32_768, r: 8, p: 1, keyLength: 64 } as const;
const SEEDED_SALT = "cubitseededsalt0";

let cachedHash: string | null = null;

/** The seeded accounts' stored credential, derived the way the door derives it, once. */
export function seededHash(): string {
  if (cachedHash !== null) return cachedHash;
  const salt = Buffer.from(SEEDED_SALT, "utf8");
  const key = scryptSync(SEEDED_PASSWORD, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 256 * SCRYPT.N * SCRYPT.r });
  cachedHash = ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
  return cachedHash;
}

/**
 * THE KEY THE ACCOUNT IS STORED UNDER — the door's own fold, never a second spelling of it.
 * `users.email` does not hold the address as typed (`storedAddress` → `foldedKey`), and a fixture
 * that wrote the raw address wrote a row the sign-in door cannot find. That is not hypothetical:
 * it is exactly what made the picture tenant unsignable-in for a day (cubit-u2i).
 */
export function seededStoredEmail(tenant: SeededTenant): string {
  return storedAddressKey(tenant.email);
}

/** The reason that arms system scope for this seed (SEAM-TENANT — the reason IS the attribution). */
export const SEEDED_SEED_REASON = "fixture: install the per-worker tenants the journey lane signs in as";

/** How many tenants a lane of `workers` needs — the count is the worker count, and nothing else. */
export function seededTenantCount(workers: number): number {
  return Math.max(1, Math.floor(workers));
}

/** The bytes the seed lands, and the sha the rows name them by, read out of the SAMPLE manifest. */
export function seededContent(root: string): { sha256: string; byteLength: number; file: string } {
  const manifest = JSON.parse(readFileSync(join(root, SEEDED_FIXTURE.manifest), "utf8")) as {
    files?: { path?: string; sha256?: string }[];
  };
  const named = (manifest.files ?? []).find((entry) => entry.path === SEEDED_FIXTURE.path);
  if (named?.sha256 === undefined) {
    throw new Error(`${SEEDED_FIXTURE.manifest} names no sha256 for ${SEEDED_FIXTURE.path} — the seed reads the manifest rather than re-spelling a digest`);
  }
  const file = join(root, SEEDED_FIXTURE.path);
  return { sha256: named.sha256, byteLength: statSync(file).size, file };
}

/**
 * THE OBJECT STORE'S HALF. `src/core/storage/index.ts` addresses every object at
 * `<STORAGE_ROOT>/<tenantId>/<sha256>`, so a drawing whose ROWS exist and whose BYTES do not is a
 * 404 wearing a name — which is precisely the defect the gallery's viewer stills recorded as black
 * frames (cubit-u2j: "raster rows, no artifact in the store"). The seed therefore copies F-RCC6's
 * committed bytes under each tenant's own prefix. Written to a temporary name and renamed, so a
 * worker that reads the path while another writes it sees the whole file or no file (P4b §2).
 */
export function seedStorageObjects(root: string, storageRoot: string, count: number): void {
  const content = seededContent(root);
  for (let index = 0; index < count; index += 1) {
    const tenant = seededTenant(index);
    const object = join(storageRoot, tenant.tenantId, content.sha256);
    if (existsSync(object) && statSync(object).size === content.byteLength) continue;
    mkdirSync(dirname(object), { recursive: true });
    const partial = `${object}.${process.pid}.tmp`;
    copyFileSync(content.file, partial);
    renameSync(partial, object);
  }
}

/**
 * The SQL that installs one seeded tenant, idempotently. The shape is the picture tenant's, for the
 * reason that is the only proved shape in this tree: `on conflict do update` where a row may be
 * revalued, `do nothing` on the four APPEND-ONLY ledgers (`cubit_append_only()` refuses an UPDATE
 * with 42501 — "a row written is immutable"), so convergence there is the row already being what
 * the fixture says.
 */
export function seededTenantSql(tenant: SeededTenant, content: { sha256: string; byteLength: number }): string {
  const at = lit(SEEDED_CLOCK);
  return [
    `insert into tenants (tenant_id, name, created_at) values (${lit(tenant.tenantId)}, ${lit(tenant.workspaceName)}, ${at})`,
    `  on conflict (tenant_id) do update set name = excluded.name, created_at = excluded.created_at;`,
    `insert into users (user_id, email, password_hash, email_verified_at, created_at)`,
    `  values (${lit(tenant.userId)}, ${lit(seededStoredEmail(tenant))}, ${lit(seededHash())}, ${at}, ${at})`,
    `  on conflict (user_id) do update set email = excluded.email, password_hash = excluded.password_hash, email_verified_at = excluded.email_verified_at, created_at = excluded.created_at;`,
    `insert into memberships (tenant_id, user_id, workspace_role, created_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(tenant.userId)}, 'OWNER', ${at})`,
    `  on conflict (tenant_id, user_id) do update set workspace_role = excluded.workspace_role, created_at = excluded.created_at;`,
    `insert into projects (tenant_id, project_id, name, code, client, site_address, district, created_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(tenant.projectId)}, ${lit(tenant.projectName)}, ${lit(tenant.projectCode)}, ${lit("Meghna Holdings")}, ${lit("Plot 14, Gulshan Avenue")}, ${lit("Dhaka")}, ${at})`,
    `  on conflict (project_id) do update set name = excluded.name, code = excluded.code, client = excluded.client, site_address = excluded.site_address, district = excluded.district, created_at = excluded.created_at;`,
    `insert into files (tenant_id, sha256, byte_length, format, scan_verdict, created_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(content.sha256)}, ${content.byteLength}, ${lit(SEEDED_FIXTURE.format)}, 'clean', ${at})`,
    `  on conflict (tenant_id, sha256) do nothing;`,
    `insert into drawings (tenant_id, drawing_id, project_id, sha256, name, format, uploaded_by, created_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(tenant.drawingId)}, ${lit(tenant.projectId)}, ${lit(content.sha256)}, ${lit(`${tenant.projectCode} — F-RCC6.dxf`)}, ${lit(SEEDED_FIXTURE.format)}, ${lit(tenant.userId)}, ${at})`,
    `  on conflict (drawing_id) do nothing;`,
    `insert into ingests (tenant_id, ingest_id, drawing_id, sha256, job_id, artifact_sha256, extractor_scheme, extractor_tool, extractor_tool_version, extractor_parameter_set_hash, facts, created_at)`,
    `  values (${lit(tenant.tenantId)}, ${lit(tenant.ingestId)}, ${lit(tenant.drawingId)}, ${lit(content.sha256)}, ${lit(`fixture-seeded-ingest-w${tenant.index}`)}, ${lit(content.sha256)}, ${lit(INGEST_SCHEME)}, 'fixture', '1.0.0', ${lit(content.sha256.slice(0, 16))}, ${lit(JSON.stringify({ layouts: 1, entities: 0 }))}::json, ${at})`,
    `  on conflict (ingest_id) do nothing;`,
    ...(["thumb", "preview", "full"] as const).map((tier) =>
      [
        `insert into sheet_rasters (tenant_id, raster_id, ingest_id, drawing_id, job_id, layout_name, tier, width, height, sha256, created_at)`,
        `  values (${lit(tenant.tenantId)}, ${lit(tenant.rasterIds[tier])}, ${lit(tenant.ingestId)}, ${lit(tenant.drawingId)}, ${lit(`fixture-seeded-raster-${tier}-w${tenant.index}`)}, ${lit(SEEDED_FIXTURE.sheetName)}, ${lit(tier)}, ${RASTER_SIZE[tier][0]}, ${RASTER_SIZE[tier][1]}, ${lit(content.sha256)}, ${at})`,
        `  on conflict (raster_id) do nothing;`,
      ].join("\n"),
    ),
  ].join("\n");
}

/** The three tiers the sheet index and the viewer read, at the picture tenant's own measures. */
const RASTER_SIZE = Object.freeze({ thumb: [320, 226] as const, preview: [1280, 905] as const, full: [3370, 2384] as const });

/**
 * Install `count` worker tenants and their bytes. ONE psql round trip for every tenant's rows — the
 * seed is a lane cost paid before the first journey, and paying it N times over would put the
 * prologue back one level down.
 */
export function seedWorkerTenants(url: string, options: { root: string; storageRoot: string; count: number }): void {
  const content = seededContent(options.root);
  const tenants = Array.from({ length: options.count }, (_, index) => seededTenant(index));
  run(url, withSession({ [GUC_SYSTEM_REASON]: SEEDED_SEED_REASON }, tenants.map((tenant) => seededTenantSql(tenant, content)).join("\n")));
  seedStorageObjects(options.root, options.storageRoot, options.count);
}
