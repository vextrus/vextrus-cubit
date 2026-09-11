// The CONVENTIONS method area: L-CAD-08's convention resolver, and the shard that puts its pair in
// force.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute — and this area is reached by loaders that are
// not the bundler's, the acts seam being loaded directly under Node by the journeys' own staging.

import conventionsShard from "../conventions/conventions.methods.json" with { type: "json" };
import { CONVENTIONS_METHOD, resolve } from "../conventions/resolve";
import type { ResolverMethod } from "../law";
import { methodKey, type MethodArea } from "./area";

/** L-CAD-08's convention resolver, as the registry holds it: versioned code, keyed by its pair. */
const CONVENTIONS_RESOLVE: ResolverMethod = Object.freeze({
  role: "resolver",
  ruleId: CONVENTIONS_METHOD.ruleId,
  version: CONVENTIONS_METHOD.version,
  resolve,
});

/** This area's shards and the implementations for the pairs they record. */
export const CONVENTIONS_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([conventionsShard]),
  implementations: Object.freeze({
    [methodKey(CONVENTIONS_METHOD)]: CONVENTIONS_RESOLVE,
  }),
});
