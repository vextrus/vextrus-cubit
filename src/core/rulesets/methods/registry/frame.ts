// The FRAME method area: L-MEA-09's pairs for a beam, a tie beam and a lintel, and the code each is
// computed by.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import { BEAM_CONCRETE_FORMULA, BEAM_CONCRETE_METHOD } from "../frame/beam-concrete";
import { BEAM_FORMWORK_FORMULA, BEAM_FORMWORK_METHOD } from "../frame/beam-formwork";
import frameShard from "../frame/frame.methods.json" with { type: "json" };
import { LINTEL_CONCRETE_FORMULA, LINTEL_CONCRETE_METHOD } from "../frame/lintel-concrete";
import { LINTEL_FORMWORK_FORMULA, LINTEL_FORMWORK_METHOD } from "../frame/lintel-formwork";
import { TIE_BEAM_CONCRETE_FORMULA, TIE_BEAM_CONCRETE_METHOD } from "../frame/tie-beam-concrete";
import { TIE_BEAM_FORMWORK_FORMULA, TIE_BEAM_FORMWORK_METHOD } from "../frame/tie-beam-formwork";
import { methodKey, type MethodArea, type MethodShard } from "./area";

/**
 * The shard as the registry reads one: a record keyed by pair. The manifest itself records the six
 * as a LIST — one row per method, in the order L-MEA-09 measures them in — because a method's key is
 * its (rule id, version) and a manifest that spelled the key twice, once as the property name and
 * once inside the row, would hold two homes for one fact (B-17). The key is derived here, from the
 * row's own pair, so the two can never disagree.
 */
const shard: MethodShard = Object.freeze({
  methods: Object.freeze(Object.fromEntries(frameShard.methods.map((row) => [methodKey(row), row]))),
  digest: frameShard.digest,
});

/** This area's shards and the implementations for the pairs they record. */
export const FRAME_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([shard]),
  implementations: Object.freeze({
    [methodKey(BEAM_CONCRETE_METHOD)]: BEAM_CONCRETE_FORMULA,
    [methodKey(BEAM_FORMWORK_METHOD)]: BEAM_FORMWORK_FORMULA,
    [methodKey(TIE_BEAM_CONCRETE_METHOD)]: TIE_BEAM_CONCRETE_FORMULA,
    [methodKey(TIE_BEAM_FORMWORK_METHOD)]: TIE_BEAM_FORMWORK_FORMULA,
    [methodKey(LINTEL_CONCRETE_METHOD)]: LINTEL_CONCRETE_FORMULA,
    [methodKey(LINTEL_FORMWORK_METHOD)]: LINTEL_FORMWORK_FORMULA,
  }),
});
