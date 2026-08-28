// AC-1 and AC-3, the half the file tree answers for: a *model* migration whose generated DDL stays
// pure while the hand-written FORCE RLS, policies and append-only grants live after the marker
// (SEAM-TENANT), and a schema tree that re-exports the two tables so drizzle-kit, the drift lane
// and the live suite all reach them.
//
// The migration is found by the glob the increment names — db/migrations/*model*.sql — never by a
// number typed here: which ordinal it lands on is the generator's business (B-19). The whole-tree
// schema-drift stage is already asserted by tenancy-base.migration.test.ts, which runs
// `scripts/db-drift.mjs --scratch` over every committed migration including this one; what this file
// adds is the reason that stage can stay green — the closed-value CHECKs are part of the GENERATED
// DDL, and everything hand-written sits after the marker.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUC_SYSTEM_REASON, GUC_TENANT, HANDWRITTEN_MARKER, ROLE_APP } from "./support/fixtures";

const ROOT = join(import.meta.dirname, "..", "..");
const MIGRATIONS = join(ROOT, "db", "migrations");
const META = join(MIGRATIONS, "meta");

/** The migration this increment adds, matched as a glob fragment against db/migrations/*.sql. */
const MODEL_MIGRATION = "model";

/** The two tables the ledger is made of (the increment's test contract names both). */
const MODEL_CALLS = "model_calls";
const MODEL_FIXTURES = "model_fixtures";
const LEDGER_TABLES = [MODEL_CALLS, MODEL_FIXTURES];

/** The values the two closed columns are shut to — the CHECKs belong to the generated DDL. */
const TRANSPORTS = ["live", "fixture"];
const OUTCOMES = ["proposed", "refused"];

/** The constructs SEAM-TENANT keeps out of generated DDL — they are hand-written, after the marker. */
const HAND_WRITTEN = [/row\s+level\s+security/i, /create\s+policy/i, /\bgrant\b/i];

function migrationFiles(): string[] {
  if (!existsSync(MIGRATIONS)) return [];
  return readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
}

function modelMigration(): { name: string; text: string } {
  const matches = migrationFiles().filter((name) => name.includes(MODEL_MIGRATION));
  expect(
    matches.length,
    `exactly one db/migrations/*${MODEL_MIGRATION}*.sql is owed — the model-call ledger's tables, its RLS and its grants land in one migration; found ${matches.length === 0 ? "none" : matches.join(", ")}`,
  ).toBe(1);
  const name = matches[0] ?? "";
  return { name, text: readFileSync(join(MIGRATIONS, name), "utf8") };
}

function halves(): { name: string; generated: string; handWritten: string } {
  const { name, text } = modelMigration();
  const marker = text.indexOf(HANDWRITTEN_MARKER);
  expect(marker, `${name} must carry the marker line ${JSON.stringify(HANDWRITTEN_MARKER)} — it is what separates generated DDL from hand-written SQL`).toBeGreaterThanOrEqual(0);
  expect(text.indexOf(HANDWRITTEN_MARKER, marker + 1), `${name} must carry the marker exactly once`).toBe(-1);
  return { name, generated: text.slice(0, marker), handWritten: text.slice(marker + HANDWRITTEN_MARKER.length) };
}

describe("AC-1: the model migration's generated DDL is pure", () => {
  it("AC-1: the generated half creates both ledger tables", () => {
    const { name, generated } = halves();
    for (const table of LEDGER_TABLES) {
      expect(generated, `${name}'s generated DDL must create ${table}`).toMatch(new RegExp(`create\\s+table[^;]*"?${table}"?`, "i"));
    }
  });

  it("AC-1: the closed-value CHECKs are generated, not appended — the drift lane's self-proof depends on it", () => {
    // A CHECK the generator does not know about is drift: regenerating from db/schema would want to
    // add it. So the values transport and outcome are shut to must appear BEFORE the marker.
    const { name, generated } = halves();
    for (const value of [...TRANSPORTS, ...OUTCOMES]) {
      expect(generated, `${name}'s generated DDL must close its columns to '${value}' — a CHECK written by hand after the marker is drift the moment db/schema is regenerated`).toContain(`'${value}'`);
    }
    expect(generated, `${name}'s generated DDL must carry CHECK constraints`).toMatch(/\bcheck\b/i);
  });

  it("AC-1: no row-level security, policy or grant appears before the marker", () => {
    const { name, generated } = halves();
    for (const construct of HAND_WRITTEN) {
      expect(generated, `${name} has ${String(construct)} before the marker — the drift lane's self-proof needs the generated DDL pure (SEAM-TENANT)`).not.toMatch(construct);
    }
  });

  it("AC-1: the model migration is in drizzle's journal, with a snapshot beside it that never learnt about the appended SQL", () => {
    // Hand-writing a migration file the journal does not know about leaves the generator ready to
    // write it again — which the schema-drift stage reads as drift.
    const { name } = modelMigration();
    const stem = name.replace(/\.sql$/, "");
    const journal = readFileSync(join(META, "_journal.json"), "utf8");
    expect(journal, `db/migrations/meta/_journal.json does not name ${stem} — drizzle-kit generate is what must have written it`).toContain(stem.replace(/^\d+_/, ""));
    const ordinal = /^(\d+)_/.exec(stem)?.[1] ?? "";
    expect(ordinal, `${name} does not carry drizzle's ordinal prefix`).not.toBe("");
    const snapshot = join(META, `${ordinal}_snapshot.json`);
    expect(existsSync(snapshot), `db/migrations/meta/${ordinal}_snapshot.json is owed beside ${name}`).toBe(true);
    const text = readFileSync(snapshot, "utf8");
    for (const construct of HAND_WRITTEN) {
      expect(text, `db/migrations/meta/${ordinal}_snapshot.json mentions ${String(construct)} — appended SQL must never touch drizzle's snapshots, or the drift lane reports drift forever`).not.toMatch(construct);
    }
  });
});

describe("AC-1: the hand-written half governs both tables", () => {
  it("AC-1: each ledger table is given FORCE row-level security, both policies and the app-role grants", () => {
    const { name, handWritten } = halves();
    for (const table of LEDGER_TABLES) {
      const quoted = `"?${table}"?`;
      expect(handWritten, `${name} must enable row level security on ${table}`).toMatch(new RegExp(`alter\\s+table\\s+${quoted}\\s+enable\\s+row\\s+level\\s+security`, "i"));
      expect(handWritten, `${name} must declare row level security WITH FORCE on ${table} — an owner that escapes its own policies is not a guarantee (SEAM-TENANT)`).toMatch(
        new RegExp(`alter\\s+table\\s+${quoted}\\s+force\\s+row\\s+level\\s+security`, "i"),
      );
      expect(handWritten, `${name} must declare a tenant-scope policy on ${table} reading ${GUC_TENANT}`).toMatch(
        new RegExp(`create\\s+policy[^;]*on\\s+${quoted}[^;]*${GUC_TENANT.replace(".", "\\.")}`, "i"),
      );
      expect(handWritten, `${name} must declare a system-scope policy on ${table} reading ${GUC_SYSTEM_REASON}`).toMatch(
        new RegExp(`create\\s+policy[^;]*on\\s+${quoted}[^;]*${GUC_SYSTEM_REASON.replace(".", "\\.")}`, "i"),
      );
      expect(handWritten, `${name} must grant ${ROLE_APP} its append-only privileges on ${table} — SELECT and INSERT, and nothing that writes a row away`).toMatch(
        new RegExp(`grant[^;]*\\b${table}\\b[^;]*\\b${ROLE_APP}\\b`, "i"),
      );
    }
  });

  it("AC-2: each ledger table wears the append-only belt the tree already carries, and no copy of it", () => {
    // A table the app role may INSERT into but may neither UPDATE nor DELETE is, by the live suite's
    // own derivation, an append-only ledger — and every append-only ledger is judged against an
    // owner-proof trigger too (db/__tests__/act-immutability.live.test.ts). The function that raises
    // the refusal is derived from the migrations that already install it: B-17 puts that belt in one
    // home, and a byte-copy of it here would be a blocking defect.
    const { name, handWritten } = halves();
    const trigger = /create\s+trigger\s+"?\w+"?\s+(?:before|after)\s+([\s\S]*?)\s+on\s+"?(\w+)"?\b([\s\S]*?)execute\s+(?:function|procedure)\s+"?(\w+)"?/gi;

    const installed = new Map<string, { events: string; fn: string }[]>();
    const known = new Set<string>();
    for (const file of migrationFiles()) {
      const text = readFileSync(join(MIGRATIONS, file), "utf8");
      for (const match of text.matchAll(new RegExp(trigger))) {
        const table = match[2] ?? "";
        const fn = match[4] ?? "";
        if (file === name) {
          installed.set(table, [...(installed.get(table) ?? []), { events: match[1] ?? "", fn }]);
        } else if (/append[_\s-]?only/i.test(match[0])) {
          known.add(fn);
        }
      }
    }
    expect([...known], "no earlier migration installs an append-only trigger function — this derivation has nothing to compare against").not.toEqual([]);
    expect(handWritten, `${name} must not define a function of its own: the append-only belt already has one home (B-17)`).not.toMatch(/create\s+(or\s+replace\s+)?function/i);

    for (const table of LEDGER_TABLES) {
      const triggers = installed.get(table) ?? [];
      expect(triggers.length, `${name} installs no trigger on ${table} — an append-only ledger the owner can still rewrite is not append-only (L-ACT-01)`).toBeGreaterThan(0);
      const events = triggers.map((one) => one.events).join(" ");
      for (const event of ["UPDATE", "DELETE", "TRUNCATE"]) {
        expect(events, `${table}'s belt must fire on ${event} — that is one of the ways a row gets unwritten`).toMatch(new RegExp(`\\b${event}\\b`, "i"));
      }
      for (const one of triggers) {
        expect([...known], `${table}'s trigger calls ${one.fn}, which no earlier migration defines — reuse the belt the tree already carries, never copy it (B-17)`).toContain(one.fn);
      }
    }
  });

  it("AC-1: no UPDATE or DELETE is granted to the app role anywhere in the migration", () => {
    const { name, handWritten } = halves();
    for (const statement of handWritten.split(";")) {
      if (!/\bgrant\b/i.test(statement)) continue;
      if (!LEDGER_TABLES.some((table) => statement.includes(table))) continue;
      for (const privilege of ["UPDATE", "DELETE", "TRUNCATE", "ALL"]) {
        expect(statement, `${name} grants ${privilege} on a ledger table — the model-call ledger is append-only (L-AI-01, L-ACT-01)`).not.toMatch(new RegExp(`\\b${privilege}\\b`, "i"));
      }
    }
  });
});

describe("AC-3: the schema tree reaches the two tables", () => {
  it("AC-3: db/schema/model.ts re-exports the tables from the seam, and the barrel includes it", () => {
    const model = join(ROOT, "db", "schema", "model.ts");
    expect(existsSync(model), "db/schema/model.ts is owed — it is where drizzle-kit and the drift lane read the ledger's tables back (SEAM-TENANT)").toBe(true);
    const text = readFileSync(model, "utf8");
    for (const exported of ["modelCalls", "modelFixtures"]) {
      expect(text, `db/schema/model.ts must re-export ${exported}`).toContain(exported);
    }
    expect(text, "db/schema/model.ts must take the tables FROM the seam — src/core/db.ts is the only lawful home of a table builder (SEAM-TENANT)").toMatch(/src\/core\/db/);

    const barrel = readFileSync(join(ROOT, "db", "schema", "index.ts"), "utf8");
    expect(barrel, "db/schema/index.ts must export ./model, or the drift lane and the live suite never see the ledger's tables").toMatch(/\.\/model/);
  });
});
