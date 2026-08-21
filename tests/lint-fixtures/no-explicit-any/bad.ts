/**
 * Fires: @typescript-eslint/no-explicit-any (Q-08).
 *
 * RECORDED REASON GUARDRAIL_FIXTURE — the committed spelling of the escape hatch, kept in
 * this file alone. The registry borrows this rule rather than writing a ninth cubit rule:
 * typescript-eslint's is the one every reader already knows by id.
 */
export function normalise(payload: any): unknown { // RECORDED REASON GUARDRAIL_FIXTURE
  return payload;
}
