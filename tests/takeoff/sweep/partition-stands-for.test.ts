/**
 * AC-1(e): whether a partition STANDS for a record is a fact about the rebuild, not about how many
 * views it found (debt-src-modules-1413app, R-UI-050).
 *
 * Two records are staged: one the shipped partition job really ran over, and one nothing has read
 * yet. What the door answers about each is the whole grading — "read and found nothing" and "never
 * read" are different answers, and a reader acts on them differently.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  PRINCIPAL,
  closeStage,
  grantRole,
  openSheetsStage,
  partitionViewRows,
  productModule,
  runPartition,
  stageIngested,
  stagePerson,
  tempFixtureRoot,
  withFixtureRoot,
  type Person,
  type StagedIngest,
} from "../partition/support/partition-stage";

/** How long a staged case may take: a database provisioned, a drawing ingested, a partition run. */
const BUDGET_MS = 900_000;

const STORE_MODULE = "src/modules/takeoff/partition/store.ts";

type Store = {
  partitionStandsFor: (tenantId: string, ingestId: string) => Promise<boolean>;
  rewritePartition: (write: Record<string, unknown>) => Promise<void>;
};

let person: Person;
let projectId: string;
let read: StagedIngest;
let unread: StagedIngest;

beforeAll(async () => {
  await openSheetsStage();
  const staged = await stagePerson("partition-stands-for");
  person = staged.person;
  projectId = staged.projectId;
  grantRole(person.tenantId, projectId, person.userId, PRINCIPAL);

  // One record the partition really ran over, and a second nothing has been run over.
  read = await stageIngested(person, projectId, [], 0x51, "captionless");
  await withFixtureRoot(tempFixtureRoot("stands-for"), async () => runPartition(person, read, "stands-for"));
  unread = await stageIngested(person, projectId, [], 0x52, "unpartitioned");
}, BUDGET_MS);

afterAll(async () => {
  await closeStage();
}, 120_000);

describe("AC-1: a partition that found nothing still stands", () => {
  test("AC-1: a rebuilt record with no view rows stands; a record nobody has rebuilt does not", async () => {
    const store = await productModule<Store>(STORE_MODULE);
    expect(typeof store.partitionStandsFor, `${STORE_MODULE} publishes \`partitionStandsFor\``).toBe("function");

    // The same record read again by a rebuild that classified NOTHING — the partition ran, and what
    // it found was no view at all. A drawing whose plans nobody has captioned reads exactly this way.
    await store.rewritePartition({
      tenantId: person.tenantId,
      projectId,
      drawingId: read.drawing.drawingId,
      ingestId: read.ingestId,
      views: [],
      assignments: new Map<string, string>(),
      proposals: new Map<string, unknown>(),
      conventions: null,
      grid: null,
      schedules: null,
      placements: null,
      expansion: null,
      proposal: null,
    });
    expect(
      partitionViewRows(person.tenantId, read.ingestId),
      "the rebuild left no view row behind — which is the record this case is about (B-19)",
    ).toEqual([]);

    expect(
      await store.partitionStandsFor(person.tenantId, read.ingestId),
      "the partition ran over this record and wrote what it read: the drawing HAS been read, and the doors answer 'read, and found none' rather than 'never read' — a judgement made on the view-row count cannot tell those two apart (R-UI-050)",
    ).toBe(true);

    expect(
      await store.partitionStandsFor(person.tenantId, unread.ingestId),
      "while a record nothing has been run over holds no partition at all, which is the other answer entirely",
    ).toBe(false);
  }, BUDGET_MS);
});
