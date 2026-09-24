/**
 * ARCH-2 (the store's half) — the migrated database follows F-ARCH's vocabulary: every closed-class
 * CHECK admits the opening, every closed-kind CHECK admits the three finish kinds, and the catalogue
 * tables carry the three work items and the surface's three bears rows and no row for the opening
 * (L-MEA-04, V-DB; I-540, I-541).
 *
 * The database is built by the product's own lane over the committed migrations, so no migration file
 * is read here: a CHECK standing in that database over the grown roster IS the migration, observed.
 * Raw SQL is spoken through psql, never a driver import (SEAM-TENANT).
 *
 * The constraints are named, because they are the ones the rosters' own `closedList` writes and a
 * missing one is the finding; what each must admit is read from the product's consts, never typed.
 */
import { afterAll, describe, expect, it } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../db/__tests__/harness";
import { lit, run } from "../../db/__tests__/support/live-sql";
import { productModule } from "../server/support/wire";

const CLASSES_MODULE = "src/core/catalogue/classes.ts";
const KINDS_MODULE = "src/core/catalogue/kinds.ts";
const CATALOGUE_MODULE = "src/core/catalogue/catalogue.ts";

/** The vocabulary this slice lands. */
const OPENING = "opening";
const ARCH_KINDS: readonly string[] = ["finish.flooring", "finish.tiling", "finish.skirting"];

/** Every CHECK written from `closedList(ELEMENT_TYPES)`. */
const CLASS_CHECKS: readonly string[] = [
  "placements_element_type_closed",
  "bears_class_closed",
  "quantity_lines_class_closed",
  "rail_observations_class_closed",
  "scope_declarations_class_closed",
  "bar_rows_class_closed",
];

/** Every CHECK written from `closedList(KINDS)`. */
const KIND_CHECKS: readonly string[] = [
  "work_items_kind_closed",
  "quantity_lines_kind_closed",
  "queue_items_kind_closed",
  "rail_observations_kind_closed",
  "scope_declarations_kind_closed",
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

/** One named CHECK as the database renders it, or "" where the database holds no such constraint. */
async function definitionOf(constraint: string): Promise<string> {
  const url = await staged();
  return run(url, `select pg_get_constraintdef(oid) from pg_constraint where contype = 'c' and conname = ${lit(constraint)};`)[0]?.[0] ?? "";
}

/** The rows one catalogue table holds, as JSON. */
async function rowsOf(table: string, columns: readonly string[]): Promise<Record<string, unknown>[]> {
  const url = await staged();
  const projection = columns.map((column) => `"${column}"`).join(", ");
  const text = run(url, `select coalesce(json_agg(row_to_json(t)), '[]'::json)::text from (select ${projection} from public.${table}) t;`)[0]?.[0] ?? "[]";
  return JSON.parse(text) as Record<string, unknown>[];
}

describe("ARCH-2: the migrated database follows F-ARCH's vocabulary", () => {
  for (const constraint of CLASS_CHECKS) {
    it(`${constraint} admits the opening class, and every class the code closes over`, async () => {
      const classes = await productModule<{ ELEMENT_TYPES: readonly string[] }>(CLASSES_MODULE);
      const definition = await definitionOf(constraint);
      expect(definition, `the migrated database carries ${constraint}`).not.toBe("");
      for (const elementType of [OPENING, ...classes.ELEMENT_TYPES]) {
        expect(definition, `${constraint} admits \`${elementType}\` — re-stated over the grown roster, so a class the code calls lawful the store accepts (L-MEA-04)`).toContain(
          `'${elementType}'`,
        );
      }
    });
  }

  for (const constraint of KIND_CHECKS) {
    it(`${constraint} admits the three finish kinds, and every kind the code closes over`, async () => {
      const kinds = await productModule<{ KINDS: readonly string[] }>(KINDS_MODULE);
      const definition = await definitionOf(constraint);
      expect(definition, `the migrated database carries ${constraint}`).not.toBe("");
      for (const kind of [...ARCH_KINDS, ...kinds.KINDS]) {
        expect(definition, `${constraint} admits \`${kind}\` (L-MEA-04)`).toContain(`'${kind}'`);
      }
    });
  }

  it("public.work_items carries the three finish kinds exactly as the code's catalogue states them", async () => {
    const catalogue = await productModule<{ WORK_ITEM_CATALOGUE: Record<string, { description: string; dimension: string; canonicalUnit: string; documentPrecision: number }> }>(
      CATALOGUE_MODULE,
    );
    const seeded = new Map(
      (await rowsOf("work_items", ["kind", "description", "canonical_unit", "dimension", "document_precision"])).map((row) => [String(row["kind"]), row]),
    );
    for (const kind of ARCH_KINDS) {
      const row = seeded.get(kind);
      const owed = catalogue.WORK_ITEM_CATALOGUE[kind];
      expect(row, `public.work_items holds \`${kind}\``).toBeTruthy();
      expect(
        { dimension: String(row?.["dimension"]), unit: String(row?.["canonical_unit"]), precision: Number(row?.["document_precision"]), description: String(row?.["description"]) },
        "and holds it exactly as the const states it — the store and the catalogue are one statement (L-MEA-04, B-19)",
      ).toEqual({ dimension: owed?.dimension, unit: owed?.canonicalUnit, precision: owed?.documentPrecision, description: owed?.description });
    }
  });

  it("public.bears carries the surface's three rows, none for the opening, and no pair twice", async () => {
    const seeded = (await rowsOf("bears", ["class", "kind"])).map((row) => `${String(row["class"])}|${String(row["kind"])}`);
    for (const kind of ARCH_KINDS) {
      expect(seeded, `public.bears holds (surface, ${kind})`).toContain(`surface|${kind}`);
    }
    expect(
      seeded.filter((pair) => pair.startsWith(`${OPENING}|`)),
      "the opening bears nothing yet, so no row names it — it is declared unborne (I-540)",
    ).toEqual([]);
    expect(new Set(seeded).size, "and the relation holds no pair twice").toBe(seeded.length);
  });
});
