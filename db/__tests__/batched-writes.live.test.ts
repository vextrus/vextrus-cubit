// SEAM-DB's unit of work, proved against a live cluster: a batch of N rows commits ONCE.
//
// The seam opens a transaction around every statement issued outside one (`scopedClient`), which is
// right for a statement and ruinous for a batch: a rail writing one drawing's observations row by
// row paid for a BEGIN, a scope arming and a COMMIT per row. The count is taken from the cluster
// itself — `pg_stat_database.xact_commit` for this scratch database, which no other suite writes to
// — so what is asserted is what Postgres COMMITTED, not what the seam says it did.
//
// What the STORE holds and what the CLUSTER counted are read through psql; what is being graded —
// the write itself — goes through the seam's own handle, because the seam is what every rail calls.
//
// The transactions are counted by the cluster's own witness rather than by a statistic: every row
// carries `txid_current()`, which is the id of the transaction that WROTE it, so `count(distinct …)`
// is the number of transactions the batch was written in. Nothing is inferred and nothing waits for
// a statistics collector to flush.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionScratchDb } from "./harness";
import { BOOTSTRAP_URL } from "./support/fixtures";
import { lit, run, scalar } from "./support/live-sql";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SEAM_MODULE = "src/core/db.ts";
const BATCH_MODULE = "src/core/db/batch.ts";

/** How many rows the proof writes. Big enough that one commit per row would be unmistakable. */
const ROWS = 40;

/** The table the proof writes to: its own, with no foreign key to seed around — what is being
 * graded is the SHAPE of the write, and a schema table would grade its constraints as well. */
const TABLE = "batched_writes_probe";

type Seam = {
  forTenant?: (ctx: { tenantId: string }) => { execute: (query: string) => Promise<unknown>; transaction: (work: (tx: { execute: (query: string) => Promise<unknown> }) => Promise<unknown>) => Promise<unknown> };
  writeInBatches?: <Row>(rows: readonly Row[], statement: (chunk: readonly Row[]) => Promise<unknown>) => Promise<number>;
  inChunks?: <Row>(rows: readonly Row[], size?: number) => readonly (readonly Row[])[];
};

let databaseUrl = "";
let bootstrapUrl = "";
let seam: Seam;
let close: () => Promise<void> = async () => {};

/** The scratch database addressed as the cluster's bootstrap user, for reading the commit counter. */
function bootstrapFor(url: string): string {
  const parsed = new URL(BOOTSTRAP_URL);
  parsed.pathname = new URL(url).pathname;
  return parsed.toString();
}

/** How many DISTINCT transactions wrote the rows the store holds — the BEGINs the writes cost. */
function transactionsUsed(): number {
  return Number(scalar(bootstrapUrl, `select count(distinct xid) from public.${TABLE}`));
}

/** The rows the store holds. */
function held(): number {
  return Number(scalar(bootstrapUrl, `select count(*) from public.${TABLE}`));
}

beforeAll(async () => {
  const provisioned = await provisionScratchDb();
  databaseUrl = provisioned.urlApp;
  close = provisioned.drop;
  bootstrapUrl = bootstrapFor(provisioned.urlMigrate);
  run(bootstrapUrl, `create table public.${TABLE} (n integer primary key, said text not null, xid bigint not null default txid_current())`);
  run(bootstrapUrl, `alter table public.${TABLE} enable row level security`);
  run(bootstrapUrl, `create policy ${TABLE}_all on public.${TABLE} using (true) with check (true)`);
  // The probe table is this suite's own, so it grants what the app role needs — the migrated
  // schema's grants are the migrations', and a probe table has no migration.
  run(bootstrapUrl, `grant select, insert, delete on public.${TABLE} to public`);
  process.env["DATABASE_URL"] = databaseUrl;
  const abs = join(REPO_ROOT, SEAM_MODULE);
  expect(existsSync(abs) && statSync(abs).isFile(), `${SEAM_MODULE} is missing from the checkout`).toBe(true);
  seam = { ...((await import(abs)) as Seam), ...((await import(join(REPO_ROOT, BATCH_MODULE))) as Seam) };
}, 120_000);

afterAll(async () => {
  await close();
});

describe("a batch of rows is one unit of work (SEAM-DB)", () => {
  it("the seam publishes the batching door", () => {
    expect(typeof seam.writeInBatches, "@/core/db exports writeInBatches — the door a rail hands a whole batch to").toBe("function");
    expect(typeof seam.inChunks, "@/core/db exports inChunks — how a batch past the bind limit is split rather than refused").toBe("function");
  });

  it("row by row, the cluster commits once per row — which is the fault", async () => {
    const forTenant = seam.forTenant;
    expect(typeof forTenant, "the seam hands out a tenant handle").toBe("function");
    if (typeof forTenant !== "function") return;
    const db = forTenant({ tenantId: "00000000-0000-4000-8000-000000000001" });

    for (let n = 0; n < ROWS; n += 1) await db.execute(`insert into public.${TABLE} (n, said) values (${n}, ${lit("row by row")})`);
    const spent = transactionsUsed();

    expect(held(), "every row landed").toBe(ROWS);
    expect(spent, `a statement outside a transaction IS a transaction, so ${ROWS} rows written one by one were written in ${ROWS} of them — this is the fault the batch door closes`).toBe(ROWS);
  }, 120_000);

  it(`the same ${ROWS} rows, handed over as one batch, commit ONCE`, async () => {
    const forTenant = seam.forTenant;
    const writeInBatches = seam.writeInBatches;
    if (typeof forTenant !== "function" || typeof writeInBatches !== "function") {
      expect.fail("the seam hands out both the handle and the batching door");
      return;
    }
    run(bootstrapUrl, `truncate public.${TABLE}`);
    const db = forTenant({ tenantId: "00000000-0000-4000-8000-000000000001" });
    const rows = Array.from({ length: ROWS }, (_unused, n) => ({ n, said: "one batch" }));

    let statements = 0;
    await db.transaction(async (tx) => {
      statements = await writeInBatches(rows, async (chunk) => {
        const values = chunk.map((row) => `(${row.n}, ${lit(row.said)})`).join(", ");
        return tx.execute(`insert into public.${TABLE} (n, said) values ${values}`);
      });
    });
    const spent = transactionsUsed();

    expect(held(), "every row of the batch landed").toBe(ROWS);
    expect(statements, `${ROWS} rows fit one statement under the bind limit`).toBe(1);
    expect(spent, `${ROWS} rows handed over as ONE unit of work were written in ONE transaction, whatever N is`).toBe(1);
  }, 120_000);

  it("a batch past the bind limit is split, never refused", () => {
    const inChunks = seam.inChunks;
    if (typeof inChunks !== "function") return;
    const rows = Array.from({ length: 1200 }, (_unused, n) => n);
    const chunks = inChunks(rows, 500);
    expect(chunks.length, "1200 rows at 500 to a statement is three statements — not a refusal, and not 1200").toBe(3);
    expect(chunks.flat(), "the order a caller handed the batch over in is the order it is written in").toStrictEqual(rows);
    expect(inChunks([], 500).length, "a batch of no rows issues no statement at all").toBe(0);
  });
});
