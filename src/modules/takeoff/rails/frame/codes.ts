// The FRAME area's rail-local closed code roster: every reason one of its six rails reports a row it
// did not offer (L-MEA-08). Each is a registered refusal too — the same taxonomy serves a machine's
// refusals and a reader's evidence (R-SPINE-062).
//
// It stands in its own file because the area's index composes six rails that each report under it,
// and a roster imported from the index those rails are published by would be a cycle (ARCH-01).
import type { RefusalCode } from "@/core/errors";

/**
 * The three codes this leaf adds beside the four a member's reading already reports under: a run the
 * partition could not read, a slab whose thickness the view never stated, and a lintel no opening
 * schedule states. Each is a reading the drawing did not give, and none of the three is ever guessed
 * (L-MEA-09, L-QTY-01).
 */
export const FRAME_RAIL_CODES = ["RUN_UNREAD", "SLAB_THICKNESS_UNSTATED", "LINTEL_SOURCE_ABSENT"] as const satisfies readonly RefusalCode[];

/** The codes the member reading reports under, shared with the column rail's own roster. */
export const MEMBER_READING_CODES = ["VIEW_SCALE_UNAFFIRMED", "MEMBER_TYPE_UNKNOWN", "SECTION_BAND_UNCOVERED", "SECTION_UNIT_UNSTATED"] as const satisfies readonly RefusalCode[];

/** One code a frame rail reports under. */
export type FrameRailCode = (typeof FRAME_RAIL_CODES)[number] | (typeof MEMBER_READING_CODES)[number];
