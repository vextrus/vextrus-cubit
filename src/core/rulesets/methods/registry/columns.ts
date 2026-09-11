// The COLUMNS method area: L-MEA-01's pairs for a column, and the code each is computed by.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import columnsShard from "../columns/columns.methods.json" with { type: "json" };
import { COLUMN_CONCRETE_FORMULA, COLUMN_CONCRETE_METHOD } from "../columns/concrete";
import { methodKey, type MethodArea } from "./area";

/** This area's shards and the implementations for the pairs they record. */
export const COLUMNS_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([columnsShard]),
  implementations: Object.freeze({
    [methodKey(COLUMN_CONCRETE_METHOD)]: COLUMN_CONCRETE_FORMULA,
  }),
});
