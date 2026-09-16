/**
 * AC-1 (the store's half) — the migrated database follows the grown rosters: every closed-kind and
 * closed-class CHECK admits what the code now closes over, and the catalogue tables carry this
 * leaf's three work items and three bears rows (L-MEA-04, V-DB).
 *
 * The database every case reads is built by the product's own lane over the committed migrations, so
 * no migration FILE is read here: a CHECK standing in that database over the grown roster is the
 * migration, observed. Raw SQL is spoken through psql, never a driver import — SEAM-TENANT's ban
 * binds this file like the rest of the tree.
 *
 * Nothing is transcribed. What each CHECK must admit is `KINDS` and `ELEMENT_TYPES` as the product
 * closes them TODAY, read from the product's own consts: a leaf that lawfully adds a kind after this
 * one moves the expectation with it, and a roster typed out here would fail the next leaf for
 * landing (B-19, B-20).
 */
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../../db/__tests__/harness";
import { AUDIT_REASON, GUC_SYSTEM_REASON } from "../../../../db/__tests__/support/fixtures";
import { lit, run, withSession } from "../../../../db/__tests__/support/live-sql";
import { BRICK_WALL, FINISH_PAINT, FINISH_PLASTER, MASONRY_BRICKWORK, SEED_EDITION_NAME, SEED_EDITION_VERSION, SURFACE, productModule } from "./support/masonry-contract";

/** The homes the rosters and the catalogue are read from (interfaces). */
const KINDS_MODULE = "src/core/catalogue/kinds.ts";
const CLASSES_MODULE = "src/core/catalogue/classes.ts";
const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";
const SEED_MODULE = "src/core/rulesets/seed/index.ts";
const METHODS_REGISTRY_MODULE = "src/core/rulesets/methods/registry.ts";

/**
 * The tables AC-1 names as carrying a closed-KIND CHECK. Which constraint of a table is that CHECK
 * is not typed here: it is the one the database itself writes a kind into, found by a kind that
 * already stood before this leaf (`rcc.concrete`), so a Builder is free to name it as the tree does.
 */
const KIND_CHECK_TABLES: readonly string[] = ["work_items", "quantity_lines", "queue_items", "rail_observations", "scope_declarations"];

/** The closed-CLASS CHECKs AC-1 names, each by the name the criterion spells. */
const CLASS_CHECKS: readonly string[] = ["placements_element_type_closed", "bears_class_closed", "scope_declarations_class_closed"];

/** A member of each roster that stood before this leaf — how a closed CHECK is told from its siblings. */
const A_STANDING_KIND = "rcc.concrete";
const A_STANDING_CLASS = "column";

/** The three work items and the three bears rows this leaf seeds (AC-1). */
const OWED_KINDS: readonly string[] = [MASONRY_BRICKWORK, FINISH_PLASTER, FINISH_PAINT];
const OWED_BEARS: readonly { class: string; kind: string }[] = [
  { class: BRICK_WALL, kind: MASONRY_BRICKWORK },
  { class: SURFACE, kind: FINISH_PLASTER },
  { class: SURFACE, kind: FINISH_PAINT },
];

let scratch: ScratchDb | undefined;
let staging: Promise<string> | undefined;

/** The migrated database, built once and shared by every case of this file. */
const staged = (): Promise<string> =>
  (staging ??= (async () => {
    scratch = await provisionScratchDb();
    return scratch.urlMigrate;
  })());

afterAll(async () => {
  await scratch?.drop();
});

/** Every CHECK constraint of one table, as the database itself renders it. */
async function checksOf(table: string): Promise<{ name: string; definition: string }[]> {
  const url = await staged();
  return run(
    url,
    `select conname, pg_get_constraintdef(oid) from pg_constraint
      where contype = 'c' and conrelid = ${lit(`public.${table}`)}::regclass order by conname;`,
  ).map((row) => ({ name: String(row[0] ?? ""), definition: String(row[1] ?? "") }));
}

/** The rows one table of the migrated catalogue holds, as JSON. */
async function rowsOf(table: string, columns: readonly string[]): Promise<Record<string, unknown>[]> {
  const url = await staged();
  const projection = columns.map((column) => `"${column}"`).join(", ");
  const text = run(url, `select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (select ${projection} from public.${table}) t;`)[0]?.[0] ?? "[]";
  return JSON.parse(text) as Record<string, unknown>[];
}

describe("AC-1: the migrated database follows the grown rosters", () => {
  for (const table of KIND_CHECK_TABLES) {
    it(`AC-1: public.${table}'s closed-kind CHECK admits every kind the code closes over`, async () => {
      const kinds = await productModule<{ KINDS: readonly string[] }>(KINDS_MODULE);
      const checks = await checksOf(table);
      const closed = checks.filter((check) => check.definition.includes(`'${A_STANDING_KIND}'`));
      expect(
        closed.length,
        `public.${table} carries a CHECK written from the closed kind roster (its checks are ${JSON.stringify(checks.map((check) => check.name))})`,
      ).toBeGreaterThan(0);
      const admitted = closed.map((check) => check.definition).join("\n");
      // This leaf's own three by name, and then the whole roster as the code closes it today: the
      // first says the migration landed, the second says it was re-stated over the ROSTER and not
      // patched member by member (AC-1).
      for (const kind of [...OWED_KINDS, ...kinds.KINDS]) {
        expect(
          admitted,
          `public.${table}'s closed-kind CHECK admits \`${kind}\` — a migration re-states it over the GROWN roster, and a row the code calls lawful that the store refuses is the drift a new kind is landed to avoid (L-MEA-04, AM-11)`,
        ).toContain(`'${kind}'`);
      }
    });
  }

  for (const constraint of CLASS_CHECKS) {
    it(`AC-1: ${constraint} admits every element class the code closes over`, async () => {
      const classes = await productModule<{ ELEMENT_TYPES: readonly string[] }>(CLASSES_MODULE);
      const url = await staged();
      const definition = run(url, `select pg_get_constraintdef(oid) from pg_constraint where conname = ${lit(constraint)};`)[0]?.[0] ?? "";
      expect(definition, `the migrated database carries the CHECK \`${constraint}\` (AC-1)`).not.toBe("");
      expect(definition, `and it is written from the class roster — it already admits \`${A_STANDING_CLASS}\``).toContain(`'${A_STANDING_CLASS}'`);
      // This leaf's own two by name, then the whole roster as the code closes it today (AC-1).
      for (const elementType of [BRICK_WALL, SURFACE, ...classes.ELEMENT_TYPES]) {
        expect(
          definition,
          `${constraint} admits \`${elementType}\` — a migration re-states it over the GROWN roster, so a class the code calls lawful is one the store accepts (L-MEA-04)`,
        ).toContain(`'${elementType}'`);
      }
    });
  }

  it("AC-1: public.work_items carries this leaf's three kinds, as the code's own catalogue states them", async () => {
    const catalogue = await productModule<{ WORK_ITEM_CATALOGUE: Record<string, { description: string; dimension: string; canonicalUnit: string; documentPrecision: number }> }>(
      CATALOGUE_MODULE,
    );
    const seeded = new Map(
      (await rowsOf("work_items", ["kind", "description", "canonical_unit", "dimension", "document_precision"])).map((row) => [String(row["kind"]), row]),
    );
    for (const kind of OWED_KINDS) {
      const row = seeded.get(kind);
      expect(row, `public.work_items holds \`${kind}\` — the migration seeds the work item the code's catalogue states (AC-1)`).toBeTruthy();
      const owed = catalogue.WORK_ITEM_CATALOGUE[kind];
      expect(
        { dimension: String(row?.["dimension"]), unit: String(row?.["canonical_unit"]), precision: Number(row?.["document_precision"]), description: String(row?.["description"]) },
        `and holds it exactly as the code's catalogue states it — the store and the const are one statement (L-MEA-04, B-19)`,
      ).toEqual({ dimension: owed?.dimension, unit: owed?.canonicalUnit, precision: owed?.documentPrecision, description: owed?.description });
    }
  });

  it("AC-2: the platform seed edition stands in the migrated database at the version this leaf mints, citing every enumerated pair", async () => {
    const seed = await productModule<{ SEED_EDITION_IDENTITY: { name: string; version: string } }>(SEED_MODULE);
    const registry = await productModule<{ enumerateMethods: () => readonly { ruleId: string; version: string }[] }>(METHODS_REGISTRY_MODULE);
    expect(
      { name: seed.SEED_EDITION_IDENTITY.name, version: seed.SEED_EDITION_IDENTITY.version },
      "the seed the product ships names the edition this leaf mints — the migration and the const are one statement (AC-2, B-19)",
    ).toEqual({ name: SEED_EDITION_NAME, version: SEED_EDITION_VERSION });
    const url = await staged();
    // A platform edition belongs to no workspace, so it is read under a system reason: a session
    // that names neither a tenant nor a reason reads nothing here, as everywhere else (SEAM-TENANT).
    const named = (script: string): string[] =>
      run(url, withSession({ [GUC_SYSTEM_REASON]: AUDIT_REASON }, script))
        .map((row) => String(row[0] ?? ""))
        .filter((value) => value !== "");
    const minted = named(
      `select version from public.ruleset_editions where scope = 'platform' and name = ${lit(seed.SEED_EDITION_IDENTITY.name)} order by version;`,
    );
    expect(
      minted,
      `the migration lane mints ${seed.SEED_EDITION_IDENTITY.name} @ ${seed.SEED_EDITION_IDENTITY.version} — an edition nobody can pin puts no method in force (L-MEA-01, L-REG-07)`,
    ).toContain(seed.SEED_EDITION_IDENTITY.version);

    // Through `jsonb`, which renders on one line: a `json` column keeps the whitespace it was
    // written with, and a pretty-printed value comes back as several rows of text.
    const cited = named(
      `select coalesce(methods::jsonb::text, '[]') from public.ruleset_editions
        where scope = 'platform' and name = ${lit(seed.SEED_EDITION_IDENTITY.name)} and version = ${lit(seed.SEED_EDITION_IDENTITY.version)};`,
    );
    const pairs = (JSON.parse(cited[0] ?? "[]") as readonly { ruleId?: string; version?: string }[]).map((pair) => `${String(pair.ruleId)}@${String(pair.version)}`).sort();
    expect(
      pairs,
      "and cites exactly the pairs the shards enumerate — a pin forks this row verbatim, so a pair it omits is a pair no project can measure by (L-REG-07, AM-11)",
    ).toEqual(registry.enumerateMethods().map((pair) => `${pair.ruleId}@${pair.version}`).sort());
  });

  it("AC-1: public.bears carries this leaf's three rows", async () => {
    const seeded = (await rowsOf("bears", ["class", "kind"])).map((row) => `${String(row["class"])}|${String(row["kind"])}`);
    for (const row of OWED_BEARS) {
      expect(seeded, `public.bears holds (${row.class}, ${row.kind}) — the relation the code declares is the relation the store seeds (AC-1)`).toContain(`${row.class}|${row.kind}`);
    }
    expect(new Set(seeded).size, "and holds no pair twice").toBe(seeded.length);
  });
});
