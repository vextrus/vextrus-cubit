/**
 * AC-6(a) — five readings, read back in the order they were appended.
 *
 * `observationsOf` orders by `observed_at` and tie-breaks on a random uuid
 * (debt-src-modules-11kfp81), so two readings appended inside one clock tick — a rebuild appending a
 * drawing's cells, a person correcting twice — read back in an order nothing decided, and the
 * standing derived from them changes between reads of the same rows. The store's own `append_seq`
 * is the order, and `observed_at` is left to say what it says.
 *
 * Driven at the shipped door against a real store. The clock is then taken out of it: every reading's
 * `observed_at` is set to one value by SQL, which is exactly the collision the row describes, and the
 * order must be unmoved.
 */
import { afterAll, expect, test } from "vitest";
import {
  COLUMN_C1,
  STOREY_HEIGHT,
  closeStage,
  field,
  observation,
  observationIdOf,
  registerSeam,
  sql,
  stageSetRevision,
  type RegisterSeam,
  type StagedRevision,
  type StoreRow,
} from "../../tests/takeoff/register/support/register-stage";

const BUDGET_MS = 600_000;

/** The five readings this case appends, in the order it appends them. */
const READINGS: readonly string[] = ["3.0", "3.1", "3.2", "3.3", "3.4"];

interface Staged {
  register: RegisterSeam;
  revision: StagedRevision;
  objectKey: string;
  appended: string[];
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    const register = await registerSeam();
    const revision = await stageSetRevision("observations-order");
    const registered = await register.registerSighting(revision.scope, COLUMN_C1);
    expect(registered.registered, `the column these readings are about registered: ${JSON.stringify(registered)}`).toBe(true);
    const objectKey = String(field(registered, "objectKey", "object_key"));

    const appended: string[] = [];
    for (const [index, value] of READINGS.entries()) {
      const answer = await register.appendObservation(
        revision.scope,
        observation({ objectKey, valueAsWritten: value, unitAsWritten: "m", precedence: index === READINGS.length - 1 ? 20 : 10 }),
      );
      expect(answer.appended, `reading ${value} was appended: ${JSON.stringify(answer)}`).toBe(true);
      appended.push(observationIdOf(answer));
    }

    // The collision the row is about: every reading now says it was observed at the same instant, so
    // nothing but the store's own append order can say which came last.
    sql(`update register_observations set observed_at = timestamptz '2026-01-01 00:00:00+00' where object_key = '${objectKey}';`);
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
