/**
 * AC-1(b)–(e) — the constraints the sweep lands, observed in a migrated store.
 *
 * (b) [1l9c2jw, bzbpim] `register_objects_level_stated_once` reads `num_nonnulls(...) <= 1` with an
 * `else ''` arm, so a row may state NO level at all: the safety net over the levelColumns/levelSegment
 * split lets through exactly the rows it exists to catch (L-REG-04).
 * (c) [4h94g0] the same CHECK compares the caller's spelling of a levelId against Postgres's
 * normalised uuid output, so a key derived from an uppercase uuid is refused by the store although
 * the grammar minted it. The grammar lowercases the surrogate — one home for the segment (B-17).
 * (d) [dyop9w] `calibrations` is a CONTENT address (L-MEA-05: "the same reading affirmed twice is the
 * same row"), and it carried four record-scoped columns its key does not cover. A second act naming
 * the same reading from another ingest then finds a row stamped with somebody else's record.
 * (e) [zpf8fo] the three view-type columns are closed against the product's own roster.
 *
 * Every expectation is derived: the rosters come from the product's consts, the columns from the
 * catalogue, and the CHECK is judged by what the database accepts and refuses rather than by its
 * rendered text (B-19). Raw SQL through psql; the store's own doors on the seam's handle.
 */
import { afterAll, describe, expect, test } from "vitest";
import { lit } from "../../../../db/__tests__/support/live-sql";
import { forTenant, type TenantTx } from "../../db";
import { VIEW_TYPE_SPELLINGS } from "../../errors/transport-vocabulary";
import { levelSegment } from "../../identity/keys";
import { affirmationsOfRecord, writeAffirmation } from "../../scale/store";
import { asSystem, closeStage, columnsOf, indexesOf, offerToChecks, staged, templateOf, type Stage } from "./support/ledger-stage";

/** The tables these cases are about. */
const REGISTER_OBJECTS = "register_objects";
const CALIBRATIONS = "calibrations";
const AFFIRMATIONS = "scale_affirmations";
const PARTITION_VIEWS = "partition_views";
const CONFIRMATIONS = "view_type_confirmations";
const TABLES: readonly string[] = [REGISTER_OBJECTS, CALIBRATIONS, AFFIRMATIONS, PARTITION_VIEWS, CONFIRMATIONS];

/** The constraint that binds a register row's level columns to its own key (L-REG-04). */
const LEVEL_STATED_ONCE = "register_objects_level_stated_once";

/**
 * The three closed-vocabulary CHECKs of the view-type columns: the table, the column, the constraint
 * that closes it, and whatever ELSE that row must state for its other CHECKs to be satisfied — a
 * proposed class names the ledger row it came from, or it is no proposal at all (L-AI-01).
 */
const TYPE_CHECKS: readonly (readonly [string, string, string, Readonly<Record<string, string>>])[] = [
  [PARTITION_VIEWS, "type", "partition_views_type_closed", {}],
  [PARTITION_VIEWS, "proposed_type", "partition_views_proposed_type_closed", { proposed_call_id: "22222222-0000-4000-8000-000000000001" }],
  [CONFIRMATIONS, "type", "view_type_confirmations_type_closed", {}],
];

/** The record-scoped columns a content address does not cover, and the reads they carried. */
const RECORD_COLUMNS: readonly string[] = ["project_id", "drawing_id", "ingest_id", "act_id"];
const RECORD_INDEXES: readonly string[] = ["calibrations_by_ingest", "calibrations_by_drawing"];

/** A surrogate spelled the way a person hands one over — uppercase, which is the same uuid (AC-1(c)). */
const SURROGATE_UPPER = "ABCDEF12-0000-4000-8000-000000000001";
const SURROGATE_LOWER = "abcdef12-0000-4000-8000-000000000001";

const stage = (): Promise<Stage> => staged(TABLES);

afterAll(async () => {
  await closeStage();
});

/** The staged workspace's handle, on the seam the product itself uses. */
async function onTenant<T>(body: (tx: TenantTx) => Promise<T>): Promise<T> {
  const { tenantId } = await stage();
  return forTenant({ tenantId }).transaction(async (tx) => body(tx));
}

describe("AC-1(b): a register row states its level exactly one way", () => {
  test("AC-1(b): a row stating no level at all is refused, by the constraint's own name", async () => {
    const held = await stage();
    const template = templateOf(held, REGISTER_OBJECTS);
    const placementKey = String(template["placement_key"] ?? "");
    expect(placementKey, "the seeded register row carries the placement key its identity is built on").not.toBe("");

    const refused = offerToChecks(held, REGISTER_OBJECTS, {
      object_key: `${placementKey}#no-level`,
      placement_key: `${placementKey}#no-level`,
      level_id: null,
      level_slot: null,
      level_label: null,
    });
    expect(
      refused,
      `a sighting stands somewhere: on a surrogate, in a lawful-null slot, or under a placeholder. A row stating none of the three is the very thing ${LEVEL_STATED_ONCE} exists to catch, and an empty-key arm lets it through (L-REG-04)`,
    ).toContain(LEVEL_STATED_ONCE);
  });

  test("AC-1(b): a row stating a level one way is still accepted", async () => {
    const held = await stage();
    const template = templateOf(held, REGISTER_OBJECTS);
    const placementKey = `${String(template["placement_key"] ?? "")}#one-way`;
    const segment = levelSegment({ slot: "FOUNDATION" });
    const landed = offerToChecks(held, REGISTER_OBJECTS, {
      object_key: `${placementKey}${segment}`,
      placement_key: placementKey,
      level_id: null,
      level_slot: "FOUNDATION",
      level_label: null,
    });
    expect(landed, "the constraint refuses rows that state no level, never rows that state one — a net that catches everything catches nothing (L-REG-04)").toBe("");
  });
});

describe("AC-1(c): the level segment spells a surrogate the way the store stores one", () => {
  test("AC-1(c): levelSegment is indifferent to the case a uuid arrives in", () => {
    expect(
      levelSegment({ levelId: SURROGATE_UPPER }),
      "one uuid is one level, however it was typed: two spellings of one surrogate would derive two keys for one instance (L-REG-04, B-17)",
    ).toBe(levelSegment({ levelId: SURROGATE_LOWER }));
  });

  test("AC-1(c): a row whose key was derived from an uppercase uuid is accepted by the CHECK", async () => {
    const held = await stage();
    const template = templateOf(held, REGISTER_OBJECTS);
    const levelId = String(template["level_id"] ?? "") || SURROGATE_LOWER;
    const placementKey = `${String(template["placement_key"] ?? "")}#upper`;
    const landed = offerToChecks(held, REGISTER_OBJECTS, {
      object_key: `${placementKey}${levelSegment({ levelId: levelId.toUpperCase() })}`,
      placement_key: placementKey,
      level_id: levelId.toUpperCase(),
      level_slot: null,
      level_label: null,
    });
    expect(
      landed,
      `the store renders a uuid lowercase, so a key the grammar minted from an uppercase spelling must still be the key the row's columns say it is — otherwise the register refuses a sighting for the case its caller typed (L-REG-04, B-17)`,
    ).toBe("");
  });
});

describe("AC-1(d): a calibration is its content address and nothing else", () => {
  test("AC-1(d): the record-scoped columns and the reads over them are gone", async () => {
    const held = await stage();
    const columns = columnsOf(held, CALIBRATIONS);
    expect(
      RECORD_COLUMNS.filter((column) => columns.includes(column)),
      `a calibration is keyed on what it SAYS — the view key and the two factors — so a column its key does not cover stamps one record's name on a row a second record shares (L-MEA-05, L-REG-04)`,
    ).toEqual([]);
    expect(
      RECORD_INDEXES.filter((index) => indexesOf(held, CALIBRATIONS).includes(index)),
      "and the reads that scoped calibrations by record go with them: the record scope is scale_affirmations'",
    ).toEqual([]);
    for (const column of ["tenant_id", "key", "view_key", "factor_x", "factor_y", "created_at"]) {
      expect(columns, `${column} is part of what a calibration says, and it stays`).toContain(column);
    }
  });

  test("AC-1(d): a second act naming the same reading from another ingest finds the one row", async () => {
    const held = await stage();
    const affirmation = templateOf(held, AFFIRMATIONS);
    const projectId = String(affirmation["project_id"] ?? "");
    const drawingId = String(affirmation["drawing_id"] ?? "");
    const ingestId = String(affirmation["ingest_id"] ?? "");
    const rank = String(affirmation["rank"] ?? "");
    const calibration = templateOf(held, CALIBRATIONS);
    const key = `${String(calibration["key"] ?? "")}#shared`;
    const viewKey = String(calibration["view_key"] ?? "");
    const factorX = String(calibration["factor_x"] ?? "");
    const factorY = String(calibration["factor_y"] ?? "");
    const move = { viewKey, outgoingKey: null, incomingKey: key, factorX, factorY };

    const otherIngest = "11111111-0000-4000-8000-0000000000c1";
    await onTenant(async (tx) => {
      await writeAffirmation(tx, {
        tenantId: held.tenantId,
        projectId,
        drawingId,
        ingestId,
        actId: "11111111-0000-4000-8000-0000000000d1",
        rank: rank as never,
        moves: [move],
        sourceKeys: [],
        observations: [],
      });
    });
    await onTenant(async (tx) => {
      await writeAffirmation(tx, {
        tenantId: held.tenantId,
        projectId,
        drawingId,
        ingestId: otherIngest,
        actId: "11111111-0000-4000-8000-0000000000d2",
        rank: rank as never,
        moves: [move],
        sourceKeys: [],
        observations: [],
      });
    });

    const filed = asSystem(held, `select count(*)::text from "${CALIBRATIONS}" where key = ${lit(key)};`)[0]?.[0];
    expect(filed, "a content address is filed once: the same reading affirmed from another record is the row already there (L-MEA-05)").toBe("1");

    const standing = await onTenant(async (tx) => affirmationsOfRecord(tx, { tenantId: held.tenantId, ingestId: otherIngest }));
    expect(standing.get(viewKey)?.calibrationKey, "and the second record reads that one row as the calibration its view stands under").toBe(key);
    expect(standing.get(viewKey)?.factorX, "carrying the factors the first act filed, unchanged").toBe(factorX);
  });
});

describe("AC-1(e): the view-type columns are closed against the product's roster", () => {
  test("AC-1(e): the roster is not empty, or these cases grade nothing", () => {
    expect(VIEW_TYPE_SPELLINGS.length, "the closed view-type vocabulary the store is written from (L-CAD-06)").toBeGreaterThan(0);
  });

  test.each(TYPE_CHECKS)("AC-1(e): %s.%s refuses a spelling outside the roster, by %s", async (table, column, constraint, companions) => {
    const held = await stage();
    const outside = `${String(VIEW_TYPE_SPELLINGS[0])}_NOT_A_SPELLING`;
    expect(VIEW_TYPE_SPELLINGS as readonly string[], "the probe spelling is genuinely outside the roster").not.toContain(outside);

    const refused = offerToChecks(held, table, { ...companions, [column]: outside });
    expect(
      refused,
      `a closed vocabulary is closed at the store: a spelling no reader of ${table}.${column} knows cannot be written, however it reached the statement (L-CAD-06, B-17)`,
    ).toContain(constraint);
  });

  test.each(TYPE_CHECKS)("AC-1(e): %s.%s accepts every spelling the product closes over (%s)", async (table, column, constraint, companions) => {
    const held = await stage();
    const refusals = VIEW_TYPE_SPELLINGS.map((spelling) => offerToChecks(held, table, { ...companions, [column]: spelling })).filter((said) => said !== "");
    expect(refusals, `${constraint} is written from the product's own roster, so a spelling the product closes over is a spelling the store accepts (B-19)`).toEqual([]);
  });
});
