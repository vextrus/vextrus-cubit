// The shape one AREA's contribution to the method roster takes, and how a pair is spelled as a key.
//
// It stands in its own file because every area file of this directory declares its contribution
// against it and the barrel `src/core/rulesets/methods/registry.ts` — which enumerates those areas —
// hands `methodKey` out again: a shape or a key spelling imported from the barrel would be a cycle,
// and one each area re-spelled would be the drift B-17 exists to prevent.

import type { MethodPair } from "../../editions/content";
import type { MethodImplementation } from "../law";

/** How a pair is spelled wherever one is a key: `<ruleId>@<version>` (L-MEA-01). */
export function methodKey(pair: MethodPair): string {
  return `${pair.ruleId}@${pair.version}`;
}

/** One shard, as the manifest records it: the pairs in force, and the digest over those entries. */
export type MethodShard = {
  readonly methods: Readonly<Record<string, { readonly ruleId: string; readonly version: string; readonly law: string; readonly module: string }>>;
  readonly digest: string;
};

/**
 * One area's contribution: the shards it declares in force, and the code the pairs they record are
 * computed by. The two travel together because they are the two halves of one claim — a shard is
 * what an edition may cite, and an implementation is what can answer the citation. An area whose
 * shard records a pair it implements nothing for is exactly what `implementationOf` answers
 * `undefined` for, and what the gate refuses `METHOD_IMPLEMENTATION_MISSING` over.
 */
export type MethodArea = {
  readonly shards: readonly MethodShard[];
  readonly implementations: Readonly<Record<string, MethodImplementation>>;
};
