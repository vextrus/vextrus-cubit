// The MASONRY method area: L-MEA-02's brickwork and L-MEA-03's finishes, and the code each is
// computed by — the plaster and the paint of a surface, the floor finish of a room's floor, and the
// plaster, the paint and the tiling of one run of a room's walls (R-TO-036, I-542, I-543).
//
// The shard is imported rather than discovered by walking the tree, for the reason the barrel gives:
// what is in force is decided at build time. It states `with { type: "json" }` because an ES module
// loader admits a JSON module only on that attribute.

import { BRICK_WALL_VOLUME_FORMULA, BRICK_WALL_VOLUME_METHOD } from "../masonry-finishes/brick-wall";
import { FLOORING_FACE_FORMULA, FLOORING_FACE_METHOD } from "../masonry-finishes/flooring";
import masonryShard from "../masonry-finishes/masonry-finishes.methods.json" with { type: "json" };
import { PAINT_FACE_FORMULA, PAINT_FACE_METHOD } from "../masonry-finishes/paint";
import { PLASTER_FACE_FORMULA, PLASTER_FACE_METHOD } from "../masonry-finishes/plaster";
import {
  WALL_FACE_PAINT_FORMULA,
  WALL_FACE_PAINT_METHOD,
  WALL_FACE_PLASTER_FORMULA,
  WALL_FACE_PLASTER_METHOD,
  WALL_FACE_TILING_FORMULA,
  WALL_FACE_TILING_METHOD,
} from "../masonry-finishes/wall-face";
import { methodKey, type MethodArea } from "./area";

/** This area's shards and the implementations for the pairs they record. */
export const MASONRY_METHODS: MethodArea = Object.freeze({
  shards: Object.freeze([masonryShard]),
  implementations: Object.freeze({
    [methodKey(BRICK_WALL_VOLUME_METHOD)]: BRICK_WALL_VOLUME_FORMULA,
    [methodKey(PLASTER_FACE_METHOD)]: PLASTER_FACE_FORMULA,
    [methodKey(PAINT_FACE_METHOD)]: PAINT_FACE_FORMULA,
    [methodKey(FLOORING_FACE_METHOD)]: FLOORING_FACE_FORMULA,
    [methodKey(WALL_FACE_PLASTER_METHOD)]: WALL_FACE_PLASTER_FORMULA,
    [methodKey(WALL_FACE_PAINT_METHOD)]: WALL_FACE_PAINT_FORMULA,
    [methodKey(WALL_FACE_TILING_METHOD)]: WALL_FACE_TILING_FORMULA,
  }),
});
