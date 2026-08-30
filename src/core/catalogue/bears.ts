// L-MEA-04: the `bears` relation — class × kind, what an element class lawfully bears.
//
// It answers one question and is answered nowhere else: given a member the model holds, which work
// items may be measured against it. A slab bears its casting, its steel, its shuttering and the
// finishes laid on it; it does not bear brickwork, and a line that claims otherwise is a mapping
// error the relation can name rather than a quantity nobody questioned.
//
// A class that bears nothing is **declared**, never residual: `UNBORNE` says so out loud, so the
// difference between "this class carries no work" and "somebody forgot this class" is a fact in the
// source instead of an absence. `BEARS` therefore holds no empty array — an empty one would be the
// undeclared case wearing the declared case's clothes.
import type { ElementType } from "./element-types";
import type { Kind } from "./kinds";

/** Which kinds each bearing class carries. Every value is non-empty; a class with nothing is in `UNBORNE`. */
export const BEARS: Readonly<Partial<Record<ElementType, readonly Kind[]>>> = Object.freeze({
  footing: Object.freeze(["excavation", "backfilling", "sand-filling", "lean-concrete", "concrete-casting", "reinforcement", "formwork", "waterproofing"]),
  pile: Object.freeze(["concrete-casting", "reinforcement"]),
  "pile-cap": Object.freeze(["excavation", "backfilling", "lean-concrete", "concrete-casting", "reinforcement", "formwork"]),
  raft: Object.freeze(["excavation", "backfilling", "sand-filling", "brick-soling", "lean-concrete", "concrete-casting", "reinforcement", "formwork", "waterproofing"]),
  "grade-beam": Object.freeze(["excavation", "backfilling", "lean-concrete", "concrete-casting", "reinforcement", "formwork"]),
  column: Object.freeze(["concrete-casting", "reinforcement", "formwork", "structural-steel", "plastering", "tiling", "painting"]),
  beam: Object.freeze(["concrete-casting", "reinforcement", "formwork", "structural-steel", "plastering", "painting"]),
  slab: Object.freeze([
    "concrete-casting",
    "reinforcement",
    "formwork",
    "brick-soling",
    "plastering",
    "tiling",
    "painting",
    "waterproofing",
    "false-ceiling",
    "skirting",
    "pipework",
    "electrical-point",
  ]),
  wall: Object.freeze(["brickwork", "plastering", "tiling", "painting", "waterproofing", "skirting", "pipework", "electrical-point", "sanitary-ware"]),
  stair: Object.freeze(["concrete-casting", "reinforcement", "formwork", "plastering", "tiling", "painting", "railing"]),
  lintel: Object.freeze(["concrete-casting", "reinforcement", "formwork", "plastering", "painting"]),
  parapet: Object.freeze(["brickwork", "plastering", "painting", "waterproofing", "railing"]),
  plinth: Object.freeze(["brickwork", "plastering", "painting", "waterproofing"]),
} satisfies Partial<Record<ElementType, readonly Kind[]>>);

/**
 * The classes that bear no kind, declared. A door and a window are openings: what the measurement
 * does with them is deduct them from the surfaces and volumes around them (L-MEA-01's opening
 * allowances), and the shutter and frame are joinery measured against their own class. Neither
 * carries a work item of its own, and saying so here is what keeps that from reading as an omission.
 */
export const UNBORNE: readonly ElementType[] = Object.freeze(["door", "window"]);
