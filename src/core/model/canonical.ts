// L-AI-01: a request's identity. The hash is sha256 over a canonical JSON spelling of what the model
// is asked — model id, system prompt, messages, params — so the same question hashes the same
// however a caller ordered its keys, and it is the one key a recorded answer is filed under
// (B-17: one derivation, shared by the fixture transport and the ledger row).
import { createHash } from "node:crypto";
import type { JsonValue, ModelRequest } from "./types";

/** Code-unit order, the order `<` puts strings in — never a locale's. */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * A JSON value spelled one way: object keys sorted by code unit at every depth, array order kept,
 * `undefined`-valued keys omitted (an array slot holding one is `null`, as JSON spells it), and no
 * whitespace anywhere. Scalars are spelled as `JSON.stringify` spells them.
 */
export function canonicalJson(value: JsonValue): string {
  return serialize(value) ?? "null";
}

function serialize(value: JsonValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => serialize(item) ?? "null").join(",")}]`;
  const members = Object.keys(value)
    .sort(byCodeUnit)
    .flatMap((key) => {
      const spelled = serialize(value[key]);
      return spelled === undefined ? [] : [`${JSON.stringify(key)}:${spelled}`];
    });
  return `{${members.join(",")}}`;
}

/** The request's identity: lowercase sha256 hex over its canonical spelling, with absent params as `{}`. */
export function requestHash(request: ModelRequest): string {
  const canonical = canonicalJson({
    modelId: request.modelId,
    system: request.system,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    params: { ...(request.params ?? {}) },
  });
  return createHash("sha256").update(canonical).digest("hex");
}
