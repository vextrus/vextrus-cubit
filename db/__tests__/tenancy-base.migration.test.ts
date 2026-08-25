// AC-2, the half the file tree answers for: the schema tree behind the pinned barrel, and a
// tenancy-base migration whose generated DDL stays pure while the hand-written RLS, policies and
// grants live after the marker (SEAM-TENANT). The drift lane's self-proof depends on that purity,
// so this file asserts it of drizzle's snapshots too.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUC_SYSTEM_REASON, GUC_TENANT, HANDWRITTEN_MARKER, ROLE_APP, TENANCY_BASE_MIGRATION, TENANTS_TABLE } from "./support/fixtures";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(ROOT, "db", "migrations");
const META = join(MIGRATIONS, "meta");

/** The constructs SEAM-TENANT keeps out of generated DDL — they are hand-written, after the marker. */
const HAND_WRITTEN = [/row\s+level\s+security/i, /create\s+policy/i, /\bgrant\b/i];

function migrationFiles(): string[] {
  if (!existsSync(MIGRATIONS)) return [];
  return readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
}

function tenancyBase(): { name: string; text: string } {
  const matches = migrationFiles().filter((name) => name.includes(TENANCY_BASE_MIGRATION));
  expect(matches.length, `exactly one db/migrations/*${TENANCY_BASE_MIGRATION}*.sql is owed; found ${matches.length === 0 ? "none" : matches.join(", ")}`).toBe(1);
  const name = matches[0] ?? "";
  return { name, text: readFileSync(join(MIGRATIONS, name), "utf8") };
}

describe("SEAM-TENANT: the first schema tree and its tenancy-base migration", () => {
  it("AC-2: the schema tree sits behind the db/schema.ts barrel the toolchain pins", () => {
    for (const relative of ["db/schema/tenants.ts", "db/schema/index.ts", "db/schema.ts"]) {
      expect(existsSync(join(ROOT, relative)), `${relative} is owed — drizzle.config.ts and scripts/lib/lanes.mjs pin db/schema.ts, and the barrel is what arms the schema-drift lane`).toBe(true);
    }
    const barrel = readFileSync(join(ROOT, "db", "schema.ts"), "utf8");
    expect(barrel, "db/schema.ts must re-export ./schema/index so the pinned path and the schema tree are the same schema").toMatch(/\.\/schema\/index/);
  });

  it("AC-2: the tenancy-base migration puts its hand-written SQL after the marker, and nowhere else", () => {
    const { name, text } = tenancyBase();
    const marker = text.indexOf(HANDWRITTEN_MARKER);
    expect(marker, `${name} must carry the marker line ${JSON.stringify(HANDWRITTEN_MARKER)}`).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(HANDWRITTEN_MARKER, marker + 1), `${name} must carry the marker exactly once`).toBe(-1);

    const generated = text.slice(0, marker);
    expect(generated, `${name}'s generated DDL must create ${TENANTS_TABLE}`).toMatch(new RegExp(`create\\s+table[^;]*${TENANTS_TABLE}`, "i"));
    for (const construct of HAND_WRITTEN) {
      expect(generated, `${name} has ${String(construct)} before the marker — the drift lane's self-proof needs the generated DDL pure (SEAM-TENANT)`).not.toMatch(construct);
    }
  });

  it("AC-2: the hand-written half declares FORCE row-level security, both policies and the app grants", () => {
    const { name, text } = tenancyBase();
    const handWritten = text.slice(text.indexOf(HANDWRITTEN_MARKER) + HANDWRITTEN_MARKER.length);
    expect(handWritten, `${name} must enable row level security on ${TENANTS_TABLE}`).toMatch(/enable\s+row\s+level\s+security/i);
    expect(handWritten, `${name} must declare row level security WITH FORCE — an owner that escapes its own policies is not a guarantee`).toMatch(/force\s+row\s+level\s+security/i);
    expect(handWritten, `${name} must declare a tenant policy reading ${GUC_TENANT}`).toMatch(new RegExp(`create\\s+policy[\\s\\S]*${GUC_TENANT.replace(".", "\\.")}`, "i"));
    expect(handWritten, `${name} must declare a system policy reading ${GUC_SYSTEM_REASON}`).toMatch(new RegExp(`create\\s+policy[\\s\\S]*${GUC_SYSTEM_REASON.replace(".", "\\.")}`, "i"));
    expect(handWritten, `${name} must grant ${ROLE_APP} its runtime privileges`).toMatch(new RegExp(`grant[\\s\\S]*${ROLE_APP}`, "i"));
  });

  it("AC-2: drizzle's snapshots never learn about the appended SQL", () => {
    expect(existsSync(META), "db/migrations/meta is owed — drizzle-kit writes the journal and snapshots the drift lane generates against").toBe(true);
    const snapshots = readdirSync(META).filter((name) => name.endsWith(".json"));
    expect(snapshots.length, "db/migrations/meta must hold at least the journal and one snapshot").toBeGreaterThan(0);
    for (const snapshot of snapshots) {
      const text = readFileSync(join(META, snapshot), "utf8");
      for (const construct of HAND_WRITTEN) {
        expect(text, `db/migrations/meta/${snapshot} mentions ${String(construct)} — appended SQL must never touch drizzle's snapshots, or the drift lane reports drift forever`).not.toMatch(construct);
      }
    }
  });
});
