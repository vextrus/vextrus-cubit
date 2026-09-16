/**
 * AC-1 — the REBAR shard, registered: five method pairs recorded in one shard, one kind in the
 * closed catalogue borne by ten classes, one rail under one home, four codes in the closed taxonomy
 * and one table in the seam (L-MEA-01, L-MEA-04, L-MEA-08, AM-11, L-REG-04, riskNotes (2)).
 *
 * The rosters are read from the product's own consts and its committed catalogue tables, never
 * typed out whole here: this leaf APPENDS to kinds, bears, refusals and the seam, and a roster
 * written out in full would un-land whatever else the tree already measures (B-19, B-20).
 *
 * What the database makes of the same migration — the table's key, its posture, its grants and the
 * platform edition row — is graded beside this in `./bar-rows.migration.test.ts`, which runs in the
 * database lane the import graph puts it in.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  BAR_ROWS_TABLE,
  CATALOGUE_DIR,
  DB_SCHEMA_REBAR_MODULE,
  KILOGRAMS,
  KINDS_MODULE,
  MASS,
  METHOD_HASHES_SCRIPT,
  PAIR_CONSTANTS,
  RAILS_BARREL_MODULE,
  RCC_REBAR,
  REBAR_CLASSES,
  REBAR_CODES,
  REBAR_ERRORS_MODULE,
  REBAR_METHOD_DIR,
  REBAR_PAIRS,
  REBAR_PRECISION,
  REBAR_REGISTRY_MODULE,
  REBAR_ROSTER_MODULE,
  REBAR_SHARD,
  REPO_ROOT,
  SCHEMA_REBAR_MODULE,
  SCHEMA_SEAM_MODULE,
  SEED_MODULE,
  methodsRegistry,
  productModule,
  railsRoster,
  refusalRegister,
  type MethodPairShape,
} from "./support/rebar-contract";

/** The platform edition this leaf's migration mints, so a pin puts the five pairs in force (AC-1). */
const SEED_EDITION = { name: "IS1200_IN", version: "2027.01" };

/** Is this pair one of this shard's five? The shard owns `rcc.rebar.*` and the detailing edition. */
function isRebarPair(pair: MethodPairShape): boolean {
  return REBAR_PAIRS.some((owed) => owed.ruleId === pair.ruleId);
}

/** One pair, said the way a message names it. */
function said(pair: MethodPairShape): string {
  return `${pair.ruleId}@${pair.version}`;
}

/** A committed catalogue table, read as the data it is. */
function catalogueTable<T>(name: string): T[] {
  expect(existsSync(join(REPO_ROOT, CATALOGUE_DIR, name)), `${CATALOGUE_DIR}/${name} is a table the catalogue emitter commits (L-MEA-04)`).toBe(true);
  return JSON.parse(readFileSync(join(REPO_ROOT, CATALOGUE_DIR, name), "utf8")) as T[];
}

describe("AC-1: the rebar shard's methods, kind, rail, codes and table are registered", () => {
  test("AC-1: the registry enumerates exactly the five rebar pairs, each with an implementation", async () => {
    const registry = await methodsRegistry();
    const enumerated = [...registry.enumerateMethods()];
    const mine = enumerated.filter(isRebarPair).map(said).sort();
    expect(mine, `the shard's five pairs stand in the manifest, and no sixth stands with them (interfaces): the registry enumerates ${enumerated.length} pairs in all`).toEqual(
      REBAR_PAIRS.map(said).sort(),
    );
    for (const pair of REBAR_PAIRS) {
      expect(registry.implementationOf(pair), `${said(pair)} resolves to an implementation — a pair the registry cannot resolve measures nothing (L-MEA-01)`).toBeTruthy();
    }
  });

  test("AC-1: the registry shard publishes the five pairs by name, and the manifest records them", async () => {
    const shard = await productModule<Record<string, unknown>>(REBAR_REGISTRY_MODULE);
    const roster = shard["REBAR_METHODS"];
    expect(roster !== null && typeof roster === "object", `${REBAR_REGISTRY_MODULE} publishes \`REBAR_METHODS\` — the area's one roster (AM-11)`).toBe(true);
    for (const [name, pair] of Object.entries(PAIR_CONSTANTS)) {
      expect(shard[name], `${REBAR_REGISTRY_MODULE} publishes \`${name}\` as ${said(pair)} (interfaces)`).toMatchObject(pair);
    }

    expect(existsSync(join(REPO_ROOT, REBAR_SHARD)), `${REBAR_SHARD} records the pairs this area declares (L-MEA-01: one file per method, hashed whole into a committed manifest)`).toBe(true);
    const recorded = JSON.parse(readFileSync(join(REPO_ROOT, REBAR_SHARD), "utf8")) as { methods?: { ruleId: string; version: string; implementation?: string; law?: string }[]; digest?: string };
    const methods = recorded.methods ?? [];
    expect(methods.map((method) => said(method)).sort(), `${REBAR_SHARD} records the shard's five pairs (L-MEA-01: one file per method, hashed whole into a committed manifest)`).toEqual(
      REBAR_PAIRS.map(said).sort(),
    );
    for (const method of methods) {
      expect(String(method.implementation ?? ""), `${said(method)} names the file under ${REBAR_METHOD_DIR}/ that implements it`).toContain(REBAR_METHOD_DIR);
    }
    expect(typeof recorded.digest, `${REBAR_SHARD} records the digest \`${METHOD_HASHES_SCRIPT}\` keeps honest (L-MEA-01)`).toBe("string");
  });

  test("AC-1: `node scripts/method-hashes.mjs` accepts the shard's digest", () => {
    expect(existsSync(join(REPO_ROOT, REBAR_SHARD)), `${REBAR_SHARD} stands — with no shard in the tree the stage passes over nothing this leaf lands (L-MEA-01)`).toBe(true);
    const stage = spawnSync(process.execPath, [join(REPO_ROOT, METHOD_HASHES_SCRIPT)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 180_000 });
    expect(
      stage.status,
      `\`node ${METHOD_HASHES_SCRIPT}\` passes over the shards in the tree — a recorded digest that has gone stale is drift (C-06):\n${`${stage.stdout ?? ""}${stage.stderr ?? ""}`.slice(-1500)}`,
    ).toBe(0);
  });

  test("AC-1: the platform seed edition cites the five pairs", async () => {
    const seed = await productModule<Record<string, unknown>>(SEED_MODULE);
    expect(seed["SEED_EDITION_IDENTITY"], `${SEED_MODULE} names the edition this leaf's migration mints (AC-1)`).toMatchObject(SEED_EDITION);
    const content = seed["SEED_EDITION_CONTENT"] as { methods?: MethodPairShape[] };
    const cited = (content.methods ?? []).filter(isRebarPair).map(said).sort();
    expect(cited, "the seed edition puts the shard's five pairs in force — a pair no edition cites measures nothing (L-REG-07)").toEqual(REBAR_PAIRS.map(said).sort());
  });

  test("AC-1: the closed catalogue gains rcc.rebar, borne by the ten classes that carry reinforcement", async () => {
    const kinds = await productModule<{ KINDS: readonly string[] }>(KINDS_MODULE);
    expect([...kinds.KINDS], `${KINDS_MODULE} holds ${RCC_REBAR} — a kind exists because the roster names it (L-MEA-04)`).toContain(RCC_REBAR);

    const workItems = catalogueTable<{ kind: string; dimension: string; canonicalUnit: string; documentPrecision: number }>("work-items.json");
    const item = workItems.find((row) => row.kind === RCC_REBAR);
    expect(item, `${CATALOGUE_DIR}/work-items.json is re-emitted with ${RCC_REBAR} on it (AC-1)`).toBeTruthy();
    expect({ dimension: (item as { dimension: string }).dimension, unit: (item as { canonicalUnit: string }).canonicalUnit, precision: (item as { documentPrecision: number }).documentPrecision }, "rebar is a MASS, billed in kilograms to three places").toEqual({
      dimension: MASS,
      unit: KILOGRAMS,
      precision: REBAR_PRECISION,
    });

    const bears = catalogueTable<{ class: string; kind: string }>("bears.json");
    const bearing = bears.filter((row) => row.kind === RCC_REBAR).map((row) => row.class).sort();
    expect(bearing, `${CATALOGUE_DIR}/bears.json pairs ${RCC_REBAR} with the ten classes that bear reinforcement (AC-1)`).toEqual([...REBAR_CLASSES].sort());
  });

  test("AC-1: the rail stands in the roster the measure job runs, under one home", async () => {
    const rails = await railsRoster();
    expect(typeof rails[RCC_REBAR], `RAILS["${RCC_REBAR}"] is the function the measure job runs for the kind (L-MEA-08)`).toBe("function");
    const roster = await productModule<Record<string, unknown>>(REBAR_ROSTER_MODULE);
    const area = roster["REBAR_RAILS"] as Record<string, unknown> | undefined;
    expect(area !== undefined && typeof area === "object", `${REBAR_ROSTER_MODULE} publishes \`REBAR_RAILS\` — the area's one roster line, spread into the barrel (AM-11)`).toBe(true);
    expect(Object.keys(area as Record<string, unknown>), `and it keys exactly this leaf's kind`).toEqual([RCC_REBAR]);
    expect(rails[RCC_REBAR], `${RAILS_BARREL_MODULE} enumerates that roster and never re-declares the rail (AM-11)`).toBe((area as Record<string, unknown>)[RCC_REBAR]);
  });

  test("AC-1: the four rebar codes join the closed taxonomy through the area's own file", async () => {
    const area = await productModule<Record<string, unknown>>(REBAR_ERRORS_MODULE);
    const local = area["REBAR_REFUSALS"] as Record<string, unknown> | undefined;
    expect(local !== undefined && typeof local === "object", `${REBAR_ERRORS_MODULE} publishes \`REBAR_REFUSALS\` — the area's own register (AM-11)`).toBe(true);
    expect(Object.keys(local as Record<string, unknown>).sort(), "and it names this leaf's four codes").toEqual([...REBAR_CODES].sort());

    const register = await refusalRegister();
    for (const code of REBAR_CODES) {
      const entry = register[code];
      expect(entry, `REFUSALS carries ${code} — a code outside the one taxonomy is a code no surface can render (Q-07)`).toBeTruthy();
      expect(String((entry as { severity?: string }).severity), `${code} is a warning: an unread schedule or an unheld row is a disclosure, never a failure`).toBe("warning");
      expect(String((entry as { surface?: string }).surface), `${code} is shown inline, beside the line it qualifies`).toBe("inline");
      for (const copy of ["message", "remedy"] as const) {
        expect(String((entry as Record<string, unknown>)[copy] ?? "").length, `${code} carries its ${copy} copy`).toBeGreaterThan(0);
      }
    }
  });

  test("AC-1: bar_rows stands in the seam, published by the area's schema file and the db barrel", async () => {
    const area = await productModule<Record<string, unknown>>(SCHEMA_REBAR_MODULE);
    const tables = area["REBAR_TABLES"] as Record<string, unknown> | undefined;
    expect(tables !== undefined && typeof tables === "object", `${SCHEMA_REBAR_MODULE} publishes \`REBAR_TABLES\` (interfaces)`).toBe(true);
    const barRows = (tables as Record<string, unknown>)["barRows"];
    expect(barRows, `${SCHEMA_REBAR_MODULE} publishes \`barRows\` — the store the bill of bars stands in`).toBeTruthy();

    const seam = await productModule<Record<string, unknown>>(SCHEMA_SEAM_MODULE);
    const schema = seam["SEAM_SCHEMA"] as Record<string, unknown>;
    expect(Object.values(schema), `${SCHEMA_SEAM_MODULE} assembles \`${BAR_ROWS_TABLE}\` into SEAM_SCHEMA — a table outside the seam is one no tenant handle scopes (SEAM-TENANT)`).toContain(barRows);

    const barrel = await productModule<Record<string, unknown>>(DB_SCHEMA_REBAR_MODULE);
    expect(barrel["barRows"], `${DB_SCHEMA_REBAR_MODULE} re-exports the same table the seam holds — one home, one table (ARCH-02)`).toBe(barRows);
  });
});
