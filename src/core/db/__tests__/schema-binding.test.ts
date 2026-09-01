/**
 * B-05: the typed surface the seam hands drizzle and the schema tree drizzle-kit reads are one
 * roster, and that is a check rather than a sentence. Neither side is transcribed here — a table
 * added to the tree passes this file unchanged, and fails it the moment only one side knows about it.
 *
 * The ORM is not imported: SEAM-TENANT gives the driver one home and this file is not it, so a table
 * is recognised by the mark drizzle puts on its own objects. The mark is read in both directions, so
 * a mark this file failed to recognise empties nothing — it fails the first assertion below.
 */
import { describe, expect, test } from "vitest";
import { SEAM_SCHEMA } from "../../db";

/** drizzle-orm 0.45.2 (the pinned version) marks a table object with this well-known symbol. */
const DRIZZLE_TABLE = "drizzle:IsDrizzleTable";

const isTable = (value: unknown): boolean =>
  typeof value === "object" && value !== null && Object.getOwnPropertySymbols(value).some((mark) => mark.description === DRIZZLE_TABLE);

/** Every drizzle table a module exports, keyed by the name it is exported under. */
const tablesOf = (module: Record<string, unknown>): Map<string, unknown> => new Map(Object.entries(module).filter(([, value]) => isTable(value)));

/** The barrel drizzle.config.ts and the drift lane pin, loaded by path rather than by specifier. */
const loadBarrel = async (): Promise<Record<string, unknown>> => {
  const specifier: string = new URL("../../../../db/schema.ts", import.meta.url).pathname;
  return (await import(specifier)) as Record<string, unknown>;
};

const seamTables = tablesOf(SEAM_SCHEMA as unknown as Record<string, unknown>);

describe("SEAM_SCHEMA is bound to the schema tree", () => {
  test("the typed surface is tables, and there are some", () => {
    expect(seamTables.size, "the typed surface holds tables, or this file grades nothing").toBe(Object.keys(SEAM_SCHEMA).length);
    expect(seamTables.size).toBeGreaterThan(0);
  });

  test("the barrel and the seam hold the same table objects, by identity", async () => {
    const barrelTables = tablesOf(await loadBarrel());
    const held = new Set(seamTables.values());
    for (const [name, table] of barrelTables) {
      expect(held.has(table), `db/schema.ts exports the table "${name}", which SEAM_SCHEMA does not hold — a table the drift lane can see and the seam cannot is a table nothing typed can reach (B-05)`).toBe(true);
    }
    const exported = new Set(barrelTables.values());
    for (const [name, table] of seamTables) {
      expect(exported.has(table), `SEAM_SCHEMA holds "${name}", which db/schema.ts does not export — drizzle-kit generates from the barrel, so it would generate a DROP for it (B-05)`).toBe(true);
    }
    expect(barrelTables.size, "and the two rosters are the same size, so neither side hides a second definition of one table").toBe(seamTables.size);
  });
});
