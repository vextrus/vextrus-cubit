// The SLABS method area: L-MEA-01's pairs for a slab, a shear wall and a stair, and the code each
// is computed by.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import slabWallStairShard from "../slab-wall-stair/slab-wall-stair.methods.json" with { type: "json" };
import {
  SLAB_CONCRETE_FORMULA,
  SLAB_CONCRETE_METHOD,
  SLAB_DROP_CONCRETE_FORMULA,
  SLAB_DROP_CONCRETE_METHOD,
  SLAB_DROP_FORMWORK_FORMULA,
  SLAB_DROP_FORMWORK_METHOD,
  SLAB_EDGE_FORMWORK_FORMULA,
  SLAB_EDGE_FORMWORK_METHOD,
  SLAB_FORMWORK_FORMULA,
  SLAB_FORMWORK_METHOD,
  SLAB_TAPER_CONCRETE_FORMULA,
  SLAB_TAPER_CONCRETE_METHOD,
} from "../slab-wall-stair/slab";
import {
  FLIGHT_CONCRETE_FORMULA,
  FLIGHT_CONCRETE_METHOD,
  FLIGHT_FORMWORK_FORMULA,
  FLIGHT_FORMWORK_METHOD,
  LANDING_CONCRETE_FORMULA,
  LANDING_CONCRETE_METHOD,
  LANDING_FORMWORK_FORMULA,
  LANDING_FORMWORK_METHOD,
} from "../slab-wall-stair/stair";
import { WALL_CONCRETE_FORMULA, WALL_CONCRETE_METHOD, WALL_FORMWORK_FORMULA, WALL_FORMWORK_METHOD } from "../slab-wall-stair/wall";
import { methodKey, type MethodArea } from "./area";

/** This area's shards and the implementations for the pairs they record. */
export const SLABS_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([slabWallStairShard]),
  implementations: Object.freeze({
    [methodKey(SLAB_CONCRETE_METHOD)]: SLAB_CONCRETE_FORMULA,
    [methodKey(SLAB_TAPER_CONCRETE_METHOD)]: SLAB_TAPER_CONCRETE_FORMULA,
    [methodKey(SLAB_FORMWORK_METHOD)]: SLAB_FORMWORK_FORMULA,
    [methodKey(SLAB_EDGE_FORMWORK_METHOD)]: SLAB_EDGE_FORMWORK_FORMULA,
    [methodKey(SLAB_DROP_CONCRETE_METHOD)]: SLAB_DROP_CONCRETE_FORMULA,
    [methodKey(SLAB_DROP_FORMWORK_METHOD)]: SLAB_DROP_FORMWORK_FORMULA,
    [methodKey(WALL_CONCRETE_METHOD)]: WALL_CONCRETE_FORMULA,
    [methodKey(WALL_FORMWORK_METHOD)]: WALL_FORMWORK_FORMULA,
    [methodKey(FLIGHT_CONCRETE_METHOD)]: FLIGHT_CONCRETE_FORMULA,
    [methodKey(FLIGHT_FORMWORK_METHOD)]: FLIGHT_FORMWORK_FORMULA,
    [methodKey(LANDING_CONCRETE_METHOD)]: LANDING_CONCRETE_FORMULA,
    [methodKey(LANDING_FORMWORK_METHOD)]: LANDING_FORMWORK_FORMULA,
  }),
});
