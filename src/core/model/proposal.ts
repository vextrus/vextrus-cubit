// L-AI-02: a model answers a Proposal<T> or a Refusal — never a conclusion, never a quantity. The
// wire shape a model's answer must take is fixed here, and reading it is pure: the shape is judged,
// every cited source key is resolved against the artifact, and only then is the payload handed to
// the caller's typed decoder. Nothing here does I/O; the seam records the row and throws.
//
// `kind` is a unique-symbol VALUE, not a string brand: a string-branded object is still a JsonValue
// and would serialise into a jsonb column unnoticed. A symbol is nothing JSON can spell, which is
// what keeps a Proposal out of every payload, row, param and insert at compile time.
import { REFUSALS, type RefusalCode } from "../errors";
import type { ModelId } from "../model-ledger.types";
import { parseSourceKey, stringsOf, type SourceKey, type SourceKeyResolver } from "./sources";
import type { JsonValue } from "./types";

/** The mark every Proposal carries: a symbol, so no JSON payload can carry one. */
export const PROPOSAL_KIND: unique symbol = Symbol("cubit.proposal");

/** What the seam answers: the caller's decoded reading, the resolved sources it rests on, and the call that made it. */
export type Proposal<T> = {
  readonly kind: typeof PROPOSAL_KIND;
  readonly payload: T;
  readonly sources: readonly [SourceKey, ...SourceKey[]];
  readonly model: ModelId;
  readonly callId: string;
};

/** What a caller's decoder answers — a value or a detail, never a throw (ARCH-03: a throw is a fault). */
export type DecodeResult<T> = { ok: true; value: T } | { ok: false; detail: string };

/** What a caller hands `propose`: the artifact its sources resolve against, and how its payload is read. */
export type ProposalContract<T> = {
  artifact: SourceKeyResolver;
  decode(payload: JsonValue): DecodeResult<T>;
};

/** The three ways a model's answer fails to be a proposal, drawn from the closed taxonomy (R-SPINE-062). */
export type ResolutionCode = RefusalCode & ("UNSOURCED" | "SOURCE_UNRESOLVED" | "MALFORMED");

/** The pure reading of a wire answer: what a Proposal will carry, or which refusal it earns and why. */
export type Resolution<T> =
  | { ok: true; payload: T; sources: readonly [SourceKey, ...SourceKey[]] }
  | { ok: false; code: ResolutionCode; detail: Record<string, JsonValue> };

/** The wire shape: exactly the members `payload` (any JSON) and `sources` (strings). */
type Wire = { payload: JsonValue; sources: string[] };

/**
 * Read a transport's payload as a proposal, in a fixed order: the wire shape (MALFORMED), then that
 * anything at all is cited (UNSOURCED), then that every citation is a well-formed key (MALFORMED —
 * before the artifact is asked about anything), then that every key is in the artifact
 * (SOURCE_UNRESOLVED, naming every missing key in wire order), then the caller's decoder
 * (MALFORMED on its detail). Sources come back in wire order, duplicates kept.
 */
export function resolveProposal<T>(payload: JsonValue, contract: ProposalContract<T>): Resolution<T> {
  const wire = readWire(payload);
  if (wire === null) return malformed("the answer is not an object of exactly a payload and an array of source strings");
  // An empty citation list has no key to parse, so the well-formedness pass is a no-op on it and
  // the emptiness check that follows is the second judgement in the fixed order.
  const sources: SourceKey[] = [];
  for (const text of wire.sources) {
    const key = parseSourceKey(text);
    if (key === null) return malformed(`${JSON.stringify(text)} is not a source key of the form scheme:key`);
    sources.push(key);
  }
  if (!nonEmpty(sources)) return { ok: false, code: REFUSALS.UNSOURCED.code, detail: {} };
  const unresolved = sources.filter((key) => !contract.artifact.has(key));
  if (unresolved.length > 0) return { ok: false, code: REFUSALS.SOURCE_UNRESOLVED.code, detail: { unresolved } };
  const decoded = contract.decode(wire.payload);
  if (!decoded.ok) return malformed(decoded.detail);
  return { ok: true, payload: decoded.value, sources };
}

/** The wire as the shape it must take, or null. */
function readWire(payload: JsonValue): Wire | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== "payload" || keys[1] !== "sources") return null;
  const inner = payload["payload"];
  const sources = payload["sources"];
  if (inner === undefined || sources === undefined) return null;
  const strings = stringsOf(sources);
  return strings === null ? null : { payload: inner, sources: strings };
}

function malformed<T>(reason: string): Resolution<T> {
  return { ok: false, code: REFUSALS.MALFORMED.code, detail: { reason } };
}

/** The guard that types a checked-non-empty list as the tuple a Proposal's `sources` is. */
function nonEmpty(keys: readonly SourceKey[]): keys is readonly [SourceKey, ...SourceKey[]] {
  return keys.length > 0;
}
