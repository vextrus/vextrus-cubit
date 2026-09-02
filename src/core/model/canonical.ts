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
 * them — which is why a number JSON cannot spell is refused first, by name: JSON writes NaN and the
 * infinities as `null`, and a hash over that would identify a request nobody made (B-17).
 */
export function canonicalJson(value: JsonValue): string {
  assertFinite(value, "value");
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

/** Every number under `value` is finite, or the first one that is not is named by its path. */
function assertFinite(value: unknown, path: string): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${String(value)}, which is not a finite number — a model request cannot carry it (L-AI-01)`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFinite(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) assertFinite(item, `${path}.${key}`);
  }
}
