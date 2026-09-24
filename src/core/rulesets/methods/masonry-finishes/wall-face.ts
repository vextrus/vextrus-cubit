// L-MEA-03's face algebra on a room's WALLS, over ONE run of them that stands under ONE soffit.
//
// A room's walls are one face of that room on one level (R-TO-036), and their gross is not an outline
// a rail could hand over: it is a run of the room's clear outline carried up the band the finish
// covers. A rail computes nothing and has no field a product or a difference could land in
// (L-MEA-08), so both are the METHOD's, in the one tree the template is printed from and the figure
// computed by (I-543):
//
//   · plaster and paint, `A = P × (H − f) − openings` — the band above the skirting or the dado;
//   · tiling,            `A = P × h − openings`       — the dado itself, from the floor up.
//
//   · `P` — the length of the run, read off the room's clear outline (MEASURED). A run is the part
//     of the boundary that stands under one soffit: F-ARCH's A-18 splits an edge where the panel over
//     it changes, and a room whose boundary stands under two soffits is two runs, never one `P` over
//     one height — one height would over-measure the band under the lower soffit (L-QTY-04);
//   · `H` — that run's clear height, FFL to the soffit over it: a fact of the STRUCTURE (L-MEA-06),
//     which the section prints by zone and the storey less the panel cross-checks (L-MEA-07). The
//     room finish schedule states no ceiling height and is never where `H` is read;
//   · `f` — where the band starts: the top of the skirting or of the dado, the room finish schedule's;
//   · `h` — the dado's height, the room finish schedule's;
//   · `openings` — the sum of what the edition's finish threshold DEDUCTED of the openings that band
//     meets, bound by the gate from the candidates the rail enumerated on the finish channel, each
//     citing the schedule row it came from (L-MEA-02, L-MEA-03).
//
// `H` and `f` are two readings from two documents, bound as each was written, and the subtraction is
// the tree's — as `rcc.beam.concrete`'s `D − t` is — so no binding carries a figure nobody wrote.
// `threshold` is declared and bound and is not in either tree, for the reason `./face` gives: a figure
// that moved when the threshold moved would be a figure the threshold had been subtracted from.
//
// The face algebra's own tree (`./face`, `A = gross − openings`) is not edited to say this: it is in
// force under `finish.surface.plaster@1` and `finish.surface.paint@1`, and an edit to it would be a
// new version of both. The plaster and the paint of one band differ only in the kind they measure, so
// they share one tree as the plaster and the paint of a surface share theirs; the tiling covers a
// different band of the same run and has its own.
import type { Kind } from "@/core/catalogue/kinds";
import { THRESHOLD_VARIABLE } from "@/core/offers/law";
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, times, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The variables a wall-face formula names, each in the dimension its reading is taken in. */
const RUN: MethodVariable = Object.freeze({ name: "P", dimension: "LENGTH" as const });
const CLEAR_HEIGHT: MethodVariable = Object.freeze({ name: "H", dimension: "LENGTH" as const });
const BAND_FLOOR: MethodVariable = Object.freeze({ name: "f", dimension: "LENGTH" as const });
const DADO_HEIGHT: MethodVariable = Object.freeze({ name: "h", dimension: "LENGTH" as const });
const OPENINGS: MethodVariable = Object.freeze({ name: "openings", dimension: "AREA" as const });
const THRESHOLD: MethodVariable = Object.freeze({ name: THRESHOLD_VARIABLE, dimension: "AREA" as const });

/** `A = P × (H − f) − openings` — one run of a room's walls, from the band's floor to the soffit over it. */
export const WALL_BAND_TREE: Statement = Object.freeze({
  result: "A",
  expr: minus(times(V("P"), minus(V("H"), V("f"))), V("openings")),
});

/** `A = P × h − openings` — one run of a room's walls, from the floor to the top of the dado. */
export const DADO_TREE: Statement = Object.freeze({ result: "A", expr: minus(times(V("P"), V("h")), V("openings")) });

/**
 * One wall-face method: a tree, in force under this pair and measuring this kind. The kind is what
 * selects the rail that offers it (L-MEA-08); the tree is which band of the run it covers.
 */
function wallFaceMethodOf(pair: MethodPair, kind: Kind, tree: Statement, variables: readonly MethodVariable[]): FormulaMethod {
  const parts = formulaFrom(tree, pair.ruleId);
  return Object.freeze({
    role: "formula",
    ruleId: pair.ruleId,
    version: pair.version,
    kind,
    dimension: "AREA",
    variables: Object.freeze([...variables, OPENINGS, THRESHOLD]),
    // A finish deducts through the finish's OWN channel, as the face algebra's does: L-MEA-01 states a
    // threshold per channel, and a finish's is `finishOpeningDeductionMinM2`, never a wall's.
    deductionChannels: Object.freeze(["finish_opening" as const]),
    tree,
    template: parts.template,
    evaluate: parts.evaluate,
    attempt: parts.attempt,
  });
}

/** The pairs these methods are in force under: an edition cites them, the registry maps them. */
export const WALL_FACE_PLASTER_METHOD: MethodPair = Object.freeze({ ruleId: "finish.wall_face.plaster", version: "1" });
export const WALL_FACE_PAINT_METHOD: MethodPair = Object.freeze({ ruleId: "finish.wall_face.paint", version: "1" });
export const WALL_FACE_TILING_METHOD: MethodPair = Object.freeze({ ruleId: "finish.wall_face.tiling", version: "1" });

/** `finish.wall_face.plaster@1`: the plaster of one run of a room's walls (R-TO-036, L-MEA-03). */
export const WALL_FACE_PLASTER_FORMULA: FormulaMethod = wallFaceMethodOf(WALL_FACE_PLASTER_METHOD, "finish.plaster", WALL_BAND_TREE, [
  RUN,
  CLEAR_HEIGHT,
  BAND_FLOOR,
]);

/** `finish.wall_face.paint@1`: the paint of one run of a room's walls (R-TO-036, L-MEA-03). */
export const WALL_FACE_PAINT_FORMULA: FormulaMethod = wallFaceMethodOf(WALL_FACE_PAINT_METHOD, "finish.paint", WALL_BAND_TREE, [
  RUN,
  CLEAR_HEIGHT,
  BAND_FLOOR,
]);

/** `finish.wall_face.tiling@1`: the tiled dado of one run of a room's walls (R-TO-036, AM-16(4), L-MEA-03). */
export const WALL_FACE_TILING_FORMULA: FormulaMethod = wallFaceMethodOf(WALL_FACE_TILING_METHOD, "finish.tiling", DADO_TREE, [RUN, DADO_HEIGHT]);
