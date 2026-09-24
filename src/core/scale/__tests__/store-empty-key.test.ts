// The scale store never writes an empty incoming calibration key (L-MEA-05, I-564): a view
// moved to "" would read back as a view nobody affirmed. The refusal comes before any statement, so
// a transaction that records every call it is asked for proves nothing was written.
import { describe, expect, test } from "vitest";
import type { TenantTx } from "@/core/db";
import { writeAffirmation, type AffirmationWrite } from "../store";

function recordingTx(): { tx: TenantTx; calls: string[] } {
  const calls: string[] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ["values", "onConflictDoNothing"]) chain[name] = () => chain;
  const tx = {
    insert: () => {
      calls.push("insert");
      return chain;
    },
  } as unknown as TenantTx;
  return { tx, calls };
}

const write: AffirmationWrite = {
  tenantId: "tenant-1",
  projectId: "project-1",
  drawingId: "drawing-1",
  ingestId: "ingest-1",
  actId: "act-1",
  rank: "DIMENSION_RATIO",
  moves: [{ viewKey: "LAYOUT_PLAN:DXF_HANDLE:20AC", outgoingKey: null, incomingKey: "", factorX: "0.001000000000", factorY: "0.001000000000" }],
  sourceKeys: [],
  observations: [],
};

describe("writeAffirmation", () => {
  test("refuses an empty incoming calibration key before writing anything", async () => {
    const { tx, calls } = recordingTx();
    await expect(writeAffirmation(tx, write)).rejects.toThrow(/empty calibration key/);
    expect(calls).toEqual([]);
  });

  test("writes the calibration and the affirmation for a real key", async () => {
    const { tx, calls } = recordingTx();
    const moves = write.moves.map((move) => ({ ...move, incomingKey: "2e129c69" }));
    await writeAffirmation(tx, { ...write, moves });
    expect(calls).toEqual(["insert", "insert"]);
  });
});
