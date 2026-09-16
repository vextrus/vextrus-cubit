/**
 * AC-1(a) [debt-src-core-1t7k8gq, 156149o, unm9z] — which row is current is decided by WRITE ORDER.
 *
 * Three ledgers answer "the newest one" by a clock and tie-break on a random uuid: the set revision a
 * set stands pinned at, the affirmation a view's scale stands under, and the storey-height reading a
 * level is current at. `now()` is fixed for a transaction, so two rows written in one transaction —
 * an act that pins twice, a rebuild appending a drawing's readings, a person correcting twice — carry
 * ONE instant, and a random surrogate then decides which of them the product calls current. The
 * answer moves between reads of the same rows, and nothing in the store says which write came last.
 *
 * `append_seq` is that answer: a bigserial the store hands out in write order. Every case writes two
 * rows inside one transaction with the FIRST-written row carrying the HIGHER uuid, so a tie-break on
 * the surrogate and a tie-break on the write order disagree — and the product must answer the one
 * written LAST (or, for a ledger read oldest-first, must put it last).
 *
 * Nothing here transcribes a schema: the rows are the shared probe seeder's, copied column for column
 * (B-19). The doors are the product's own, on the seam's handle against the staged database; the
 * copies go through psql, because a transaction the store offers no door for is not a write the store
 * makes.
 */
import { afterAll, describe, expect, test } from "vitest";
import { forTenant, type TenantTx } from "../../db";
import { readingsOfLevel, readingsOfProject } from "../../levels/store";
import { affirmationsOfRecord } from "../../scale/store";
import { currentSetRevisionOf } from "../../sets";
import { appendInOneTransaction, asSystem, closeStage, columnsOf, keyColumnOf, staged, templateOf, type Stage } from "./support/ledger-stage";

/** The three ledgers this criterion is about, by the names the store spells them. */
const REVISIONS = "drawing_set_revisions";
const AFFIRMATIONS = "scale_affirmations";
const READINGS = "storey_height_readings";
const CALIBRATIONS = "calibrations";
const LEDGERS: readonly string[] = [REVISIONS, AFFIRMATIONS, READINGS];
const STAGED: readonly string[] = [...LEDGERS, CALIBRATIONS];

/** The column the store hands out in write order, and the role whose inserts must be able to draw from it. */
const APPEND_SEQ = "append_seq";
const APP_ROLE = "cubit_app";

/**
 * Two surrogate keys whose lexical order is the OPPOSITE of the order they are written in: the row
 * written first sorts higher, so "newest by uuid" and "newest by write order" cannot both be right.
 */
const WRITTEN_FIRST = "ffffffff-0000-4000-8000-00000000000a";
const WRITTEN_SECOND = "00000000-0000-4000-8000-00000000000b";

/** Two acts, so an affirmation read back says which of the two writes answered for it. */
const ACT_FIRST = "ffffffff-0000-4000-8000-0000000000a1";
const ACT_SECOND = "00000000-0000-4000-8000-0000000000b1";

const stage = (): Promise<Stage> => staged(STAGED);

afterAll(async () => {
  await closeStage();
});

/** The staged workspace's handle, on the seam the product itself uses. */
async function onTenant<T>(body: (tx: TenantTx) => Promise<T>): Promise<T> {
  const { tenantId } = await stage();
  return forTenant({ tenantId }).transaction(async (tx) => body(tx));
}

/** A one-value probe, read as a boolean. */
function asBoolean(held: Stage, script: string): boolean {
  const answer = asSystem(held, script)[0]?.[0] ?? "";
  return answer === "t" || answer === "true";
}

/**
 * Two copies of a ledger's seeded row, written inside one transaction under one instant, keyed so
 * that the row written first sorts after the row written second.
 */
async function twoWritesInOneTransaction(table: string, firstExtra: Readonly<Record<string, string>> = {}, secondExtra: Readonly<Record<string, string>> = {}): Promise<void> {
  const held = await stage();
  const key = keyColumnOf(held, table);
  expect(key, `${table} is keyed on one column the store hands out, which each copy states for itself`).not.toBe("");
  appendInOneTransaction(held, table, [
    { ...firstExtra, [key]: WRITTEN_FIRST },
    { ...secondExtra, [key]: WRITTEN_SECOND },
  ]);
  const instants = asSystem(held, `select count(distinct ${table === READINGS ? "read_at" : "created_at"})::text from ${table} where ${key} in ('${WRITTEN_FIRST}', '${WRITTEN_SECOND}');`);
  expect(instants[0]?.[0], `both ${table} rows say they were written at one instant — the collision this case is about, proved rather than assumed`).toBe("1");
}

describe("AC-1(a): the ledgers carry their own write order", () => {
  test.each(LEDGERS)("AC-1(a): %s carries append_seq, not null, on a sequence cubit_app may draw from", async (table) => {
    const held = await stage();
    expect(columnsOf(held, table), `${table} carries the store's own write order — a clock and a random surrogate cannot say which write came last (L-REG-04)`).toContain(APPEND_SEQ);
    expect(
      asBoolean(held, `select attnotnull from pg_attribute where attrelid = '${table}'::regclass and attname = '${APPEND_SEQ}';`),
      `${APPEND_SEQ} is not null: a row with no place in the order is a row the order cannot answer for`,
    ).toBe(true);
    expect(
      asBoolean(held, `select has_sequence_privilege('${APP_ROLE}', pg_get_serial_sequence('${table}', '${APPEND_SEQ}'), 'USAGE');`),
      `${APP_ROLE} may draw from ${table}'s sequence — without that grant every insert the app role makes refuses (0037's GRANT pattern)`,
    ).toBe(true);
  });

  test.each(LEDGERS)("AC-1(a): %s's standing rows are numbered and the sequence stands past them", async (table) => {
    const held = await stage();
    expect(columnsOf(held, table), `${table} carries append_seq before anything can be said about how its rows were numbered`).toContain(APPEND_SEQ);
    expect(
      asBoolean(held, `select count(*) = count(${APPEND_SEQ}) and count(distinct ${APPEND_SEQ}) = count(*) from ${table};`),
      `every ${table} row that stood before the column was added carries a place in the order, and no two share one (the backfill, in the former read order)`,
    ).toBe(true);
    expect(
      asBoolean(
        held,
        `select (select last_value from pg_sequences where schemaname = 'public' and sequencename = split_part(pg_get_serial_sequence('${table}', '${APPEND_SEQ}'), '.', 2))
                >= coalesce((select max(${APPEND_SEQ}) from ${table}), 0);`,
      ),
      `the sequence was moved past the backfill, so the next write takes a number no standing row holds (0037's setval)`,
    ).toBe(true);
  });

  test("AC-1(a): currentSetRevisionOf answers the revision written last, not the one with the higher uuid", async () => {
    const held = await stage();
    const template = templateOf(held, REVISIONS);
    const setId = String(template["set_id"] ?? "");
    const projectId = String(template["project_id"] ?? "");
    expect(setId, "the staged revision names the set it pins").not.toBe("");
    await twoWritesInOneTransaction(REVISIONS, { manifest: "[]" }, { manifest: "[]" });

    const current = await onTenant(async (tx) => currentSetRevisionOf(tx, { tenantId: held.tenantId, projectId }, setId));
    expect(
      current?.setRevisionId,
      `two pins written in one transaction carry one created_at, so the one written LAST is the one the set stands at — whichever uuid sorts higher (${WRITTEN_FIRST} was written first) (R-TO-005, L-REG-04)`,
    ).toBe(WRITTEN_SECOND);
  });

  test("AC-1(a): affirmationsOfRecord reads the affirmation written last as the one in force", async () => {
    const held = await stage();
    const template = templateOf(held, AFFIRMATIONS);
    const ingestId = String(template["ingest_id"] ?? "");
    expect(ingestId, "the staged affirmation names the record it was made against").not.toBe("");
    const calibration = templateOf(held, CALIBRATIONS);
    const viewKey = String(calibration["view_key"] ?? "");
    const calibrationKey = String(calibration["key"] ?? "");
    expect(calibrationKey, "the staged calibration is the pair both affirmations take the view to").not.toBe("");
    const names = { view_keys: `{${viewKey}}`, incoming_keys: `{${calibrationKey}}`, outgoing_keys: "{}" };
    await twoWritesInOneTransaction(AFFIRMATIONS, { ...names, act_id: ACT_FIRST }, { ...names, act_id: ACT_SECOND });

    const standing = await onTenant(async (tx) => affirmationsOfRecord(tx, { tenantId: held.tenantId, ingestId }));
    expect(standing.size, "the staged affirmation names at least one view, or this case reads an empty map and grades nothing").toBeGreaterThan(0);
    expect(
      [...new Set([...standing.values()].map((calibration) => calibration.actId))],
      `every view both affirmations name stands under the act that wrote LAST: the two carry one created_at, and ${WRITTEN_FIRST} sorts above ${WRITTEN_SECOND} by uuid (L-MEA-05)`,
    ).toEqual([ACT_SECOND]);
  });

  test("AC-1(a): readingsOfProject and readingsOfLevel put the reading written last at the end", async () => {
    const held = await stage();
    const template = templateOf(held, READINGS);
    const projectId = String(template["project_id"] ?? "");
    const levelId = String(template["level_id"] ?? "");
    expect(projectId, "the staged reading names its project").not.toBe("");
    expect(levelId, "the staged reading names the level it was read on").not.toBe("");
    await twoWritesInOneTransaction(READINGS);

    const scope = { tenantId: held.tenantId, projectId };
    const ofProject = await onTenant(async (tx) => readingsOfProject(tx, scope));
    const ofLevel = await onTenant(async (tx) => readingsOfLevel(tx, scope, levelId));

    for (const [what, rows] of [
      ["readingsOfProject", ofProject],
      ["readingsOfLevel", ofLevel],
    ] as const) {
      const ids = rows.map((row) => row.readingId);
      expect(ids, `${what} holds both readings this case wrote`).toContain(WRITTEN_SECOND);
      expect(
        ids.indexOf(WRITTEN_SECOND) > ids.indexOf(WRITTEN_FIRST),
        `${what} reads oldest first, so the reading written LAST stands after the one written before it — the two carry one read_at, and ${WRITTEN_FIRST} sorts above ${WRITTEN_SECOND} by uuid (L-REG-01, L-MEA-07)`,
      ).toBe(true);
    }
  });
});
