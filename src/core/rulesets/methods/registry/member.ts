// The MEMBER method area: the generic member-volume formula, and the shard that puts its pair in
// force.
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import { methodKey, type MethodArea } from "./area";
import memberShard from "../member/member.methods.json" with { type: "json" };
import { MEMBER_VOLUME_FORMULA, MEMBER_VOLUME_METHOD } from "../member/volume";

/** This area's shards and the implementations for the pairs they record. */
export const MEMBER_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([memberShard]),
  implementations: Object.freeze({
    [methodKey(MEMBER_VOLUME_METHOD)]: MEMBER_VOLUME_FORMULA,
  }),
});
