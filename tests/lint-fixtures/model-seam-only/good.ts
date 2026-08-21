/**
 * Silent: one path (L-AI-01). The caller states what it wants proposed and takes callModel
 * from src/core, which pins the model id from a closed const and records the call —
 * proposed or refused — in the model-call ledger.
 */
export interface ModelRequest {
  readonly tenantId: string;
  readonly prompt: string;
}

export type CallModel = (request: ModelRequest) => Promise<string>;

export async function describeSheet(
  callModel: CallModel,
  request: ModelRequest,
): Promise<string> {
  return callModel(request);
}
