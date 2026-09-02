// L-AI-01, R-AI-005: the shipped ledger adapter. Every call the seam answers or refuses becomes one
// `model_calls` row through the tenant's own database handle (SEAM-TENANT), and the row's generated
// id is what the answer carries back as its `callId`.
import { modelCalls, type TenantDb } from "../db";
import type { ModelLedger, ModelLedgerRow } from "./types";

/** A ledger that writes `model_calls` through the tenant-scoped handle it is given. */
export function dbModelLedger(db: TenantDb): ModelLedger {
  return {
    async record(row: ModelLedgerRow): Promise<{ callId: string }> {
      const [inserted] = await db
        .insert(modelCalls)
        .values({
          tenantId: row.tenantId,
          projectId: row.projectId,
          modelId: row.modelId,
          requestHash: row.requestHash,
          transport: row.transport,
          outcome: row.outcome,
          refusalCode: row.refusalCode,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          attributedCost: row.attributedCost,
        })
        .returning({ callId: modelCalls.callId });
      if (inserted === undefined) {
        throw new Error(`the model-call ledger wrote the row for request ${row.requestHash} and answered no call id`);
      }
      return { callId: inserted.callId };
    },
  };
}
