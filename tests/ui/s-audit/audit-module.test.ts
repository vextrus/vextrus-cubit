/**
 * Public acceptance for AC-3's contract half — what `src/modules/spine/audit` publishes and what it
 * is allowed to reach for. The live half (the panels answering `{ armed: false }` on the schema as
 * migrated today, and the page rendering that answer) is `db/__tests__/audit-surfaces.live.test.ts`,
 * because it needs a migrated database and this lane has none.
 *
 * The two source scans below are marked where they happen. "Reads only through the tenant seam" is a
 * statement about the tree — a run can watch a query answer, but not watch which handle it was NOT
 * issued on — and `cubit/no-db-outside-seam` bans driver imports tree-wide but says nothing about
 * `runAsSystem`, which is the seam handle this door must not take: an audit surface reads what the
 * caller's tenant may read, and nothing wider.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { AUDIT_MODULE, REPO_ROOT, productModule, sourceOf } from "./support/decision";

const MODULE_DIR = "src/modules/spine/audit";

/** The names the Increment Spec's interfaces fix — the panels' table names included (AC-3). */
const PANEL_TABLES: Readonly<Record<string, string>> = { modelLedger: "model_calls", jobs: "jobs" };

/** The one handle a per-project audit read may take, and the one it may not. */
const SEAM_HANDLE = "forTenant";
const SYSTEM_HANDLE = "runAsSystem";

/** Driver specifiers: the seam is the tree's one home for them (SEAM-TENANT). */
const DRIVER_SPECIFIERS = ["postgres", "pg", "drizzle-orm", "drizzle-orm/postgres-js", "drizzle-orm/pg-core", "postgres-js"];

interface AuditModule {
  getAuditSurfaces?: unknown;
  AUDIT_PANEL_TABLES?: unknown;
}

/** Every authored file of the module, repo-relative. */
function moduleFiles(): string[] {
  const root = join(REPO_ROOT, MODULE_DIR);
  expect(existsSync(root) && statSync(root).isDirectory(), `${MODULE_DIR} is missing from the checkout — S-Audit's sole read door does not exist yet`).toBe(true);
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) found.push(`${MODULE_DIR}/${next}`);
    }
  };
  walk("");
  expect(found.length, `${MODULE_DIR} holds no TypeScript module`).toBeGreaterThan(0);
  return found.sort();
}

/** Comments stripped, so prose naming a handle is never read as a call to it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("AC-3 — the audit module publishes the read door and the panels' table names", () => {
  test("AC-3: src/modules/spine/audit/index.ts exports getAuditSurfaces(ctx, projectId)", async () => {
    const module = await productModule<AuditModule>(AUDIT_MODULE);
    expect(typeof module.getAuditSurfaces, `${AUDIT_MODULE} must export getAuditSurfaces — the Increment Spec makes it S-Audit's sole read door`).toBe("function");
    expect(
      (module.getAuditSurfaces as (...args: unknown[]) => unknown).length,
      "getAuditSurfaces takes the caller's ctx and the project it is asked about",
    ).toBeGreaterThanOrEqual(2);
  });

  test("AC-3: it exports AUDIT_PANEL_TABLES — the names the two panels probe", async () => {
    const module = await productModule<AuditModule>(AUDIT_MODULE);
    const tables = module.AUDIT_PANEL_TABLES;
    expect(typeof tables, `${AUDIT_MODULE} must export AUDIT_PANEL_TABLES — the one home for the names the panels probe (ARCH-02)`).toBe("object");

    const named = tables as Record<string, unknown>;
    expect(Object.keys(named).sort(), "AuditSurfaces carries exactly two panels, so exactly two names are probed").toEqual(Object.keys(PANEL_TABLES).sort());
    for (const [panel, table] of Object.entries(PANEL_TABLES)) {
      expect(named[panel], `AUDIT_PANEL_TABLES.${panel} is "${table}" — the ledger (L-AI-01) and jobs (C-SPINE-JOBS) increments target this name or re-point it under B-20`).toBe(table);
    }
  });
});

describe("AC-3 — the door reads through the tenant seam and nothing else", () => {
  test("AC-3: no file of the module imports a database driver (SEAM-TENANT)", () => {
    // SOURCE SCAN: which import a module does not make cannot be observed from a run.
    for (const relative of moduleFiles()) {
      const source = code(sourceOf(relative));
      for (const match of source.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
        const specifier = match[1] ?? "";
        expect(
          DRIVER_SPECIFIERS.includes(specifier),
          `${relative} imports "${specifier}" — the driver, the schema and drizzle's query surface live in src/core/db.ts and nowhere else (SEAM-TENANT)`,
        ).toBe(false);
      }
    }
  });

  test("AC-3: the module takes the tenant handle, never the system handle", () => {
    // SOURCE SCAN, same reason: `runAsSystem` not being called is a property of the tree.
    const sources = moduleFiles().map((relative) => ({ relative, source: code(sourceOf(relative)) }));

    const takesTenantHandle = sources.some((file) => new RegExp(`\\b${SEAM_HANDLE}\\s*\\(`).test(file.source));
    expect(
      takesTenantHandle,
      `no file of ${MODULE_DIR} calls ${SEAM_HANDLE}(ctx) — AC-3 makes the tenant seam the only way this door reaches the act log, so a tenant reads its own acts and no one else's`,
    ).toBe(true);

    for (const file of sources) {
      expect(
        new RegExp(`\\b${SYSTEM_HANDLE}\\s*\\(`).test(file.source),
        `${file.relative} takes ${SYSTEM_HANDLE}(…) — an audit surface answers what the caller's tenant may read; the system handle would read past row-level security`,
      ).toBe(false);
    }
  });
});
