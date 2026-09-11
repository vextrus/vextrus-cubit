/**
 * The seam's allowlist, probed where it was widest (SEAM-TENANT, scripts/eslint/rules/no-db-outside-seam.mjs).
 *
 * `SEAM_HOME` admits `src/core/db.ts` and everything ONE level under `src/core/db/`. That was exact
 * while the seam was a handful of modules; AM-11 then cut the tables into 31 `schema-<area>.ts`
 * files, and every one of them inherited the whole allowlist — including the right to open a
 * connection of its own. A table declaration has no business holding a driver: the pools are
 * `pools.ts`'s, the handles are `seam.ts`'s, and a `schema-<area>.ts` that imported `postgres` would
 * be a second door into the database standing inside the seam's own directory, where the ban that
 * exists to stop exactly that no longer looks.
 *
 * So the allowlist is read in two halves, and this file is the probe of the narrow one: an area's
 * schema module may import the ORM it declares its tables with, and may not import a driver. The
 * source is linted at a VIRTUAL path through the shipped flat config, so what is judged is the rule
 * as it ships rather than a copy of it, and no fixture has to be planted in the tree to ask.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RULE = "cubit/no-db-outside-seam";

/** The adversary's probe, byte for byte: a schema-area file that opens a connection of its own. */
const DRIVER_IN_A_SCHEMA_AREA = `import postgres from "postgres";\n\nexport const rogue = postgres("postgres://127.0.0.1/x");\n`;

/** What every one of the 31 area files really does hold, and must keep holding. */
const ORM_IN_A_SCHEMA_AREA = `import { sql } from "drizzle-orm";\nimport { pgTable, text } from "drizzle-orm/pg-core";\n\nexport const probes = pgTable("probes", { id: text("id").primaryKey() });\nexport const one = sql\`1\`;\n`;

let linter: ESLint;

beforeAll(async () => {
  const loaded: unknown = await import(pathToFileURL(join(REPO_ROOT, "eslint.config.mjs")).href);
  const config = (loaded as { default: Linter.Config[] }).default;
  linter = new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
}, 120_000);

/** Every message the shipped config reports for this source, read as if it lived at `virtualPath`. */
async function lintAs(source: string, virtualPath: string): Promise<Linter.LintMessage[]> {
  const results = await linter.lintText(source, { filePath: join(REPO_ROOT, virtualPath) });
  return results.flatMap((result) => result.messages);
}

const refusalsOf = (messages: readonly Linter.LintMessage[]): Linter.LintMessage[] => messages.filter((m) => m.ruleId === RULE);

describe("the tenant seam's allowlist is narrow where the tables are", () => {
  test("a schema-area file that imports the driver is refused", async () => {
    const refused = refusalsOf(await lintAs(DRIVER_IN_A_SCHEMA_AREA, "src/core/db/schema-advtemp.ts"));
    expect(
      refused.map((m) => m.messageId),
      "src/core/db/schema-advtemp.ts imports `postgres`: a table declaration may not open a connection (SEAM-TENANT)",
    ).toEqual(["driver"]);
  });

  test("the same driver import is refused in a schema-area file of any area's name", async () => {
    for (const at of ["src/core/db/schema-tenants.ts", "src/core/db/schema-takeoff-ingest.ts", "src/core/db/schema.ts"]) {
      const refused = refusalsOf(await lintAs(DRIVER_IN_A_SCHEMA_AREA, at));
      expect(refused.map((m) => m.messageId), `${at} imports \`postgres\``).toEqual(["driver"]);
    }
  });

  test("a schema-area file still declares its tables with the ORM", async () => {
    const refused = refusalsOf(await lintAs(ORM_IN_A_SCHEMA_AREA, "src/core/db/schema-advtemp.ts"));
    expect(refused.map((m) => m.message), "the 31 area files declare their tables with drizzle-orm and must lint clean").toEqual([]);
  });

  test("the seam's own modules still hold the driver, which is the point of the allowlist", async () => {
    for (const at of ["src/core/db/pools.ts", "src/core/db/sql.ts", "src/core/db/jobs.ts", "src/core/db.ts"]) {
      const refused = refusalsOf(await lintAs(DRIVER_IN_A_SCHEMA_AREA, at));
      expect(refused.map((m) => m.messageId), `${at} is the seam and may hold a driver`).toEqual([]);
    }
  });

  test("the bytes really are a driver import — the same source is refused outside the seam", async () => {
    const refused = refusalsOf(await lintAs(DRIVER_IN_A_SCHEMA_AREA, "src/modules/billing/probe.ts"));
    expect(refused.map((m) => m.messageId), "the control: these bytes are refused everywhere the ban looks").toEqual(["driver"]);
  });

  test("a relative import whose path merely contains \"pg\" is not a driver (scripts/lib/pg-suites.mjs)", async () => {
    const source = `import { pgSuites } from "../../scripts/lib/pg-suites.mjs";\nexport const n = pgSuites.length;\n`;
    expect(refusalsOf(await lintAs(source, "tests/toolchain/lane-probe.test.ts"))).toEqual([]);
    expect(refusalsOf(await lintAs(source, "src/modules/anywhere/probe.ts"))).toEqual([]);
  });

  test("no area file ships one today", async () => {
    const { globSync } = await import("node:fs");
    const areas = globSync("src/core/db/schema*.ts", { cwd: REPO_ROOT }).filter((p) => !p.endsWith(".test.ts"));
    expect(areas.length, "AM-11 cut the tables per area; the probe is about those files").toBeGreaterThan(30);
    for (const area of areas) {
      const refused = refusalsOf(await lintAs(readFileSync(join(REPO_ROOT, area), "utf8"), area));
      expect(refused.map((m) => m.message), `${area} lints clean under the narrowed allowlist`).toEqual([]);
    }
  }, 120_000);
});
