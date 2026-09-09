/**
 * AC-6(a) — five readings, read back in the order they were appended.
 *
 * `observationsOf` orders by `observed_at` and tie-breaks on a random uuid
 * (debt-src-modules-11kfp81), so two readings appended inside one clock tick — a rebuild appending a
 * drawing's cells, a person correcting twice — read back in an order nothing decided, and the
 * standing derived from them changes between reads of the same rows. The store's own `append_seq`
 * is the order, and `observed_at` is left to say what it says.
 *
 * Driven at the shipped read doors against a real store. The clock is taken out of it AT INSERT TIME:
 * the first reading goes through the shipped door, and the four after it are staged at that reading's
 * own `observed_at`, so every one of the five says it was observed at one instant — exactly the
 * collision the row describes — and the order must be unmoved. A written reading is immutable
 * (`cubit_append_only`: "a row written is immutable, and UPDATE is not a write anybody may make"), so
 * the instant is staged where a reading's instant is decided and nowhere else.
 */
import { afterAll, expect, test } from "vitest";
import {
  COLUMN_C1,
  REGISTER_OBSERVATIONS,
  STOREY_HEIGHT,
  canonicalOf,
  closeStage,
  field,
  observation,
  observationIdOf,
  registerSeam,
  rowsOf,
  sql,
  stageSetRevision,
  type RegisterSeam,
  type StagedRevision,
  type StoreRow,
} from "../../tests/takeoff/register/support/register-stage";
import { ident, lit } from "./support/live-sql";

const BUDGET_MS = 600_000;

/** The five readings this case appends, in the order it appends them. */
const READINGS: readonly string[] = ["3.0", "3.1", "3.2", "3.3", "3.4"];

/** The unit every one of them is written in — one unit, so the readings differ and nothing else does. */
const UNIT = "m";

/** The columns the store hands out itself: a staged reading names neither (AC-6(a)). */
const STORE_ASSIGNED: ReadonlySet<string> = new Set(["observation_id", "append_seq"]);

interface Staged {
  register: RegisterSeam;
  revision: StagedRevision;
  objectKey: string;
  appended: string[];
}

let staging: Promise<Staged> | undefined;

/** The declared precedence a reading is appended under: the last one outranks the four before it. */
function precedenceOf(index: number): number {
  return index === READINGS.length - 1 ? 20 : 10;
}

/**
 * One more reading, at the SAME instant as the reading the door wrote.
 *
 * The door's own row is the template, so every column a reading carries is the product's — this
 * stages only what the case is about: the reading, its canonical value under the product's own canon,
 * its declared precedence, and an `observed_at` copied verbatim from the template. `observation_id`
 * and `append_seq` are the store's to hand out, so neither is named.
 */
function readingAt(template: StoreRow, overrides: Readonly<Record<string, string>>): string {
  const columns = Object.keys(template).filter((column) => !STORE_ASSIGNED.has(column));
  const values = columns.map((column) => {
    const value: unknown = overrides[column] ?? template[column];
    return value === null || value === undefined ? "null" : lit(String(value));
  });
  const written = sql(`insert into ${ident(REGISTER_OBSERVATIONS)} (${columns.map(ident).join(", ")}) values (${values.join(", ")}) returning observation_id::text;`);
  const observationId = written[0]?.[0] ?? "";
  expect(observationId.length, `the ledger accepted a reading staged at the template's instant: ${JSON.stringify(written)}`).toBeGreaterThan(0);
  return observationId;
}

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("observations-order");
    const registered = await register.registerSighting(revision.scope, COLUMN_C1);
    expect(registered.registered, `the column these readings are about registered: ${JSON.stringify(registered)}`).toBe(true);
    const objectKey = String(field(registered, "objectKey", "object_key"));

    // The first reading is the shipped door's, and the instant it recorded is the instant all five
    // will say they were observed at.
    const opening = READINGS[0] as string;
    const answer = await register.appendObservation(revision.scope, observation({ objectKey, valueAsWritten: opening, unitAsWritten: UNIT, precedence: precedenceOf(0) }));
    expect(answer.appended, `reading ${opening} was appended: ${JSON.stringify(answer)}`).toBe(true);
    const appended = [observationIdOf(answer)];

    const template = rowsOf(REGISTER_OBSERVATIONS, revision.person.tenantId).find((row) => String(field(row, "observationId", "observation_id")) === appended[0]);
    expect(template, "the reading the door appended stands in the ledger, and is what the readings after it are staged from").toBeTruthy();

    // The collision the row is about, staged where a reading's instant is decided: the four readings
    // after the first carry the first one's `observed_at`, so nothing but the store's own append
    // order can say which of the five came last.
    for (const [index, value] of READINGS.entries()) {
      if (index === 0) continue;
      appended.push(
        readingAt(template as StoreRow, {
          value_as_written: value,
          canonical_value: await canonicalOf(value, UNIT),
          precedence: String(precedenceOf(index)),
        }),
      );
    }

    const counted = sql(
      `select count(*)::text, count(distinct observed_at)::text from ${ident(REGISTER_OBSERVATIONS)}
        where set_revision_id = ${lit(revision.setRevisionId)}::uuid and object_key = ${lit(objectKey)};`,
    );
    expect(counted[0], "five readings stand in the ledger and every one says it was observed at the same instant — the collision these cases are about, proved rather than assumed").toEqual([
      String(READINGS.length),
      "1",
    ]);
    return { register, revision, objectKey, appended };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

/** The observation ids of some rows, however the store spells the column (C-05). */
function idsOf(rows: readonly StoreRow[]): string[] {
  return rows.map((row) => String(field(row, "observationId", "observation_id")));
}

test(
  "AC-6(a): readings read back in the order they were appended, whatever their clock says",
  async () => {
    const stage = await staged();

    const read = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);

    expect(idsOf(read), "five readings appended in sequence, read back in that sequence — one instant on all of them changes nothing").toEqual(stage.appended);
  },
  BUDGET_MS,
);

test(
  "AC-6(a): and the order does not change between two reads of the same rows",
  async () => {
    const stage = await staged();

    const first = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);
    const second = await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT);

    expect(idsOf(second), "an order the store guarantees is the same order twice").toEqual(idsOf(first));
  },
  BUDGET_MS,
);

test(
  "AC-6(a): the standing is derived over that order",
  async () => {
    const stage = await staged();

    const read = idsOf(await stage.register.observationsOf(stage.revision.scope, stage.objectKey, STOREY_HEIGHT));
    const standing = (await stage.register.attributeStanding(stage.revision.scope, stage.objectKey, STOREY_HEIGHT)) as {
      competing?: StoreRow[];
      overruled?: StoreRow[];
    };

    for (const [label, rows] of [["competing", standing.competing ?? []], ["overruled", standing.overruled ?? []]] as const) {
      const positions = idsOf(rows).map((id) => read.indexOf(id));
      expect(positions.every((at) => at >= 0), `every ${label} reading of the standing is one of the ledger's own rows`).toBe(true);
      expect(
        positions.every((at, index) => index === 0 || at > (positions[index - 1] as number)),
        `the ${label} readings stand in the ledger's append order, which is what the standing is derived over`,
      ).toBe(true);
    }
  },
  BUDGET_MS,
);
