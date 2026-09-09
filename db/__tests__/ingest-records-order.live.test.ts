/**
 * AC-4(a) — "newest first" is an order, or it is nothing.
 *
 * `ingestRecords` orders by `created_at` alone (debt-src-modules-1um73f4), so two records of one
 * drawing written in the same transaction — a re-ingest and its supersession, a backfill — come back
 * in whichever order the planner reached them, and "the current record" changes between two reads of
 * the same rows. The record id settles it, descending, so the order is total.
 *
 * Driven at the shipped door against a real store. The clock is taken out of it deliberately: both
 * records say they were created at the same instant, which is exactly the collision the row is about.
 */
import { afterAll, expect, test } from "vitest";
import { closeStage, openSheetsStage, productModule, sql, stagePerson } from "../../tests/takeoff/partition/support/partition-stage";
import { stageDrawing } from "../../tests/takeoff/support/ingest-stage";

const BUDGET_MS = 600_000;

const INGEST_MODULE = "src/modules/takeoff/ingest/index.ts";

/** Two records of one drawing, minted so that one id sorts above the other whatever the clock says. */
const LOWER = "11111111-1111-4111-8111-111111111111";
const GREATER = "99999999-9999-4999-8999-999999999999";

/** The one instant both records claim to have been written at. */
const ONE_INSTANT = "2026-01-01 00:00:00+00";

type Record_ = { ingestId: string };
type IngestSeam = { ingestRecords: (scope: { tenantId: string; drawingId: string }) => Promise<Record_[]> };

interface Staged {
  ingest: IngestSeam;
  tenantId: string;
  drawingId: string;
}

let staging: Promise<Staged> | undefined;

/** Lazy and memoised: a throwing hook would leave every case skipped, and judge nothing. */
function staged(): Promise<Staged> {
  return (staging ??= (async () => {
    await openSheetsStage();
    const { person, projectId } = await stagePerson("ingest-records-order");
    const drawing = await stageDrawing(person, projectId, new TextEncoder().encode("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n"), {
      name: `records-order-${Date.now()}.dxf`,
      format: "dxf",
    });

    // Two records of that one drawing, written with the same created_at: the tie the row is about.
    for (const ingestId of [LOWER, GREATER]) {
      sql(
        `insert into ingests (tenant_id, ingest_id, drawing_id, sha256, job_id, artifact_sha256,
                              extractor_scheme, extractor_tool, extractor_tool_version, extractor_parameter_set_hash,
                              facts, created_at)
         values ('${person.tenantId}'::uuid, '${ingestId}'::uuid, '${drawing.drawingId}'::uuid, repeat('0', 64),
                 'job-${ingestId}', repeat('0', 64), 'DXF_HANDLE', 'cubit-acceptance', '0.0.0', repeat('0', 64),
                 '{"layouts":[]}'::json, timestamptz '${ONE_INSTANT}');`,
      );
    }

    return { ingest: await productModule<IngestSeam>(INGEST_MODULE), tenantId: person.tenantId, drawingId: drawing.drawingId };
  })());
}

afterAll(async () => {
  await closeStage();
}, 120_000);

test(
  "AC-4(a): two records of one instant come back in one order, the greater id first",
  async () => {
    const stage = await staged();

    const read = await stage.ingest.ingestRecords({ tenantId: stage.tenantId, drawingId: stage.drawingId });

    expect(read.map((record) => record.ingestId), "the clock cannot separate them, so the record id does — descending, like the order it tie-breaks").toEqual([
      GREATER,
      LOWER,
    ]);
  },
  BUDGET_MS,
);

test(
  "AC-4(a): and the same rows read the same way every time",
  async () => {
    const stage = await staged();

    const first = await stage.ingest.ingestRecords({ tenantId: stage.tenantId, drawingId: stage.drawingId });
    const second = await stage.ingest.ingestRecords({ tenantId: stage.tenantId, drawingId: stage.drawingId });

    expect(second.map((record) => record.ingestId), "which record is the current one does not change between two reads").toEqual(
      first.map((record) => record.ingestId),
    );
  },
  BUDGET_MS,
);
