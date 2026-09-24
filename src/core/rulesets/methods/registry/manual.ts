// The MANUAL method area: the pairs a hand measurement is measured by where no machine method fits
// the geometry a person traces (R-TO-040, R-TO-041), and the code each is computed by.
//
// Only the twins stand here. A hand measurement that fits a machine method's algebra is offered under
// that method's own pair — a count of piles is `piling.bored.count` whoever counted them — and the
// roster of which rule a hand measurement of each geometry, class and kind is offered under is
// `../manual/rules.ts`, not this file (s-measure I-539).
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import { MANUAL_BLINDING_FORMULA, MANUAL_BLINDING_METHOD } from "../manual/blinding";
import manualShard from "../manual/manual.methods.json" with { type: "json" };
import { methodKey, type MethodArea } from "./area";

/** This area's shards and the implementations for the pairs they record. */
export const MANUAL_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([manualShard]),
  implementations: Object.freeze({
    [methodKey(MANUAL_BLINDING_METHOD)]: MANUAL_BLINDING_FORMULA,
  }),
});
