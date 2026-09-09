/**
 * AC-6(a) — the column that makes "append order" an order the store guarantees.
 *
 * Append order rests on `observed_at` plus a random-uuid tie-break (debt-src-modules-11kfp81): two
 * readings appended in the same clock tick read back in whichever order their uuids happen to sort,
 * so which reading came last — and therefore which one stands — is decided by a random number. The
 * store settles it: `append_seq`, a bigserial the database itself hands out in the order rows are
 * written.
 *
 * The database read here is built by the product's own lane over the committed migrations, so no
 * file under db/ is read: a column standing in that database is the migration and its journal entry,
 * observed.
 *
 * Raw SQL is spoken through psql, never a driver import: SEAM-TENANT's ban binds this file too.
 */
import { afterAll, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "./harness";
import { run } from "./support/live-sql";

const BUDGET_MS = 600_000;

const REGISTER_OBSERVATIONS = "register_observations";
const APPEND_SEQ = "append_seq";

let scratch: ScratchDb | undefined;
let staging: Promise<string> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<string> {
  return (staging ??= (async () => {
    const provisioned = await provisionScratchDb();
    scratch = provisioned;
    return provisioned.urlMigrate;
  })());
}

afterAll(async () => {
  await scratch?.drop();
}, 120_000);

test(
  `AC-6(a): ${REGISTER_OBSERVATIONS} carries ${APPEND_SEQ}, a not-null bigserial`,
  async () => {
    const url = await staged();

    const described = run(
      url,
      `select data_type, is_nullable, coalesce(column_default, '')
         from information_schema.columns
        where table_name = '${REGISTER_OBSERVATIONS}' and column_name = '${APPEND_SEQ}';`,
    );

    expect(described.length, `${REGISTER_OBSERVATIONS} holds an ${APPEND_SEQ} column`).toBe(1);
    const [dataType, nullable, madeBy] = described[0] as string[];
    expect(dataType, "a bigint, because a drawing set may carry more readings than an int holds").toBe("bigint");
    expect(nullable, "every row has a place in the append order — there is no row without one").toBe("NO");
    expect(madeBy, "the database hands the number out; nothing in the app chooses it").toContain("nextval");
  },
  BUDGET_MS,
);
