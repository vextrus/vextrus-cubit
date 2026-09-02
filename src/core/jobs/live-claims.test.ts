// @vitest-environment node
/**
 * The store's bounded, cursor-keyed read of live claims, against the storage itself (SEAM-JOBS,
 * R-SPINE-030): batch by batch in (kind, key) order, every claim whose job has no ending is reached
 * exactly once, an ended job's claim is passed over, and the keyset comparison the cursor rides on
 * is answered by Postgres for the driver's untyped parameters. A live scratch database from the db
 * lane's harness, the store opened as the managing tier.
 *
 * The harness reads DATABASE_URL at module load for its bootstrap connection, so it is imported
 * before anything else touches the environment.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { provisionScratchDb, type ScratchDb } from "../../../db/__tests__/harness";
import { jobsStore, type JobEventDraft, type JobsStore, type LiveClaim } from "../db";
import { TERMINAL_STATUSES } from "./statuses";

/** Two kinds, spelled so their order is the same by code point and by the server's collation. */
const KINDS = ["alpha", "probe"] as const;
const KEYS_PER_KIND = 5;
const BATCH = 3;

let scratch: ScratchDb;
let store: JobsStore;
/** Every claim written, in the (kind, key) order the store promises. */
let written: LiveClaim[];
/** The one claim whose job ended, which no batch may hold. */
let ended: LiveClaim;

const draftOf = (claim: LiveClaim, status: string): JobEventDraft => ({
  jobId: claim.jobId,
  kind: claim.kind,
  key: claim.key,
  step: "finish",
  status,
  attempt: 1,
  refusalCode: null,
  faultId: null,
  detail: null,
  elapsedMs: null,
});

beforeAll(async () => {
  scratch = await provisionScratchDb();
  store = jobsStore(scratch.urlMigrate);
  await store.open({ manage: true });
  written = [];
  for (const kind of KINDS) {
    for (let index = 0; index < KEYS_PER_KIND; index += 1) {
      const claim = { kind, key: `claim-0${index}`, jobId: randomUUID() };
      await store.claimKey(claim.kind, claim.key, claim.jobId);
      written.push(claim);
    }
  }
  ended = written[KEYS_PER_KIND + 2] as LiveClaim;
  await store.append(draftOf(ended, "succeeded"));
}, 120_000);

afterAll(async () => {
  await store.close();
  await new Promise((settle) => setTimeout(settle, 500));
  await scratch.drop();
}, 120_000);

describe("liveClaims reads the claims batch by batch", () => {
  test("without a cursor: the first `limit` live claims in (kind, key) order", async () => {
    const first = await store.liveClaims([...TERMINAL_STATUSES], BATCH);
    expect(first).toEqual(written.slice(0, BATCH));
  });

  test("after a cursor: the claims past it, the ended job's claim passed over", async () => {
    const live = written.filter((claim) => claim !== ended);
    const seen: LiveClaim[] = [];
    let after: LiveClaim | undefined;
    for (let passes = 0; passes < live.length; passes += 1) {
      const batch = await store.liveClaims([...TERMINAL_STATUSES], BATCH, after === undefined ? undefined : { kind: after.kind, key: after.key });
      seen.push(...batch);
      after = batch.at(-1);
      if (batch.length < BATCH) break;
    }
    expect(seen).toEqual(live);
  });

  test("a cursor at the last claim of one kind reaches the next kind's first claim", async () => {
    const lastOfFirstKind = written[KEYS_PER_KIND - 1] as LiveClaim;
    const batch = await store.liveClaims([...TERMINAL_STATUSES], 1, { kind: lastOfFirstKind.kind, key: lastOfFirstKind.key });
    expect(batch).toEqual([written[KEYS_PER_KIND]]);
  });

  test("a cursor past every claim answers nothing", async () => {
    const last = written.at(-1) as LiveClaim;
    expect(await store.liveClaims([...TERMINAL_STATUSES], BATCH, { kind: last.kind, key: last.key })).toEqual([]);
  });
});
