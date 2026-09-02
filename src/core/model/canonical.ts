// L-AI-01: a request's identity. The hash is sha256 over a canonical JSON spelling of what the model
// is asked — model id, system prompt, messages, params — so the same question hashes the same
// however a caller ordered its keys, and it is the one key a recorded answer is filed under
// (B-17: one derivation, shared by the fixture transport and the ledger row). The canonical
// spelling itself has one home, the consequence digest's (ARCH-02); it is only named here.
import { createHash } from "node:crypto";
import { canonical } from "../acts/consequence";
import type { JsonValue, ModelRequest } from "./types";

/**
 * A JSON value spelled one way: object keys sorted by code unit at every depth, array order kept,
 * `undefined`-valued keys omitted, and no whitespace anywhere. Scalars are spelled as JSON spells
 * them; a number JSON cannot spell (NaN, an infinity) is refused rather than filed as `null`.
 */
export function canonicalJson(value: JsonValue): string {
  return canonical(value);
}

/** The request's identity: lowercase sha256 hex over its canonical spelling, with absent params as `{}`. */
export function requestHash(request: ModelRequest): string {
  const spelled = canonicalJson({
    modelId: request.modelId,
    system: request.system,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    params: { ...(request.params ?? {}) },
  });
  return createHash("sha256").update(spelled).digest("hex");
}
