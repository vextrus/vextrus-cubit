// L-MEA-08's rails, as a roster: "rail is selected per quantity KIND, never per drawing".
//
// So the roster is keyed by kind, and a kind with no rail is a kind nothing measures rather than a
// kind measured by a default: the map is partial on purpose, and the measure job runs whatever
// stands here — a rail landed tomorrow is run with no edit to the job (B-19).
//
// A kind is named here once, beside the rail that measures it: a roster naming a rail the tree does
// not hold would be a claim that a kind is measured when nothing measures it (B-19).
//
// "Here" is this DIRECTORY, not this file (AM-11). Each area keeps its own roster in `./<area>.ts`,
// and this file ENUMERATES them and merges them, so `RAILS` is still the one roster the measure job
// reads and every importer still reads it from `@/modules/takeoff/rails`. An area lands a rail by
// editing its own file and nothing else — five rails written at once never touch one map.

import { BOQ_RAILS } from "./boq";
import { DOCS_RAILS } from "./docs";
import { FOUNDATIONS_RAILS } from "./foundations";
import { FRAME_RAILS } from "./frame";
import type { RailRoster } from "./law";
import { MASONRY_RAILS } from "./masonry";
import { REBAR_RAILS } from "./rebar";
import { SLABS_RAILS } from "./slabs";

/** Every kind this product measures, and the pure function that measures it (L-MEA-08). */
export const RAILS: RailRoster = Object.freeze({
  ...FOUNDATIONS_RAILS,
  ...FRAME_RAILS,
  ...SLABS_RAILS,
  ...MASONRY_RAILS,
  ...REBAR_RAILS,
  ...DOCS_RAILS,
  ...BOQ_RAILS,
});
