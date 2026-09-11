// The FOUNDATIONS method area — empty until M3 writes it (AM-11).
//
// M3's foundations rail declares its methods HERE: a `*.methods.json` shard recorded beside the code it
// declares, and the implementation for each pair the shard records. The barrel
// `src/core/rulesets/methods/registry.ts` already enumerates this file, so a pair added to the group
// below is a pair `enumerateMethods` answers and `implementationOf` can compute — with no shared
// list to edit and no other area's file to touch (B-19).

import type { MethodArea } from "./area";

/** This area's shards and the implementations for the pairs they record. */
export const FOUNDATIONS_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([]),
  implementations: Object.freeze({}),
});
