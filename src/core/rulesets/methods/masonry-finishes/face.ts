// L-MEA-03's face algebra, said once: `net = gross − Σ(deducted openings) per surface group`.
//
// A plaster and a paint of one surface are two work items of ONE geometry (R-TO-032): the same
// readings, the same channel, the same tree, and only the kind and the rule they are in force under
// differ. So the tree, the variables and the channel stand here and each method beside this file
// states its own pair — a second spelling of `A = gross − openings` is a second home for the clause,
// and the two copies would part the day the clause moved (B-17, B-19).
//
// `openings` is the sum of what the edition's threshold DEDUCTED, bound by the gate from the
// candidates the rail enumerated (L-MEA-08). `threshold` is declared and bound and is not in the
// tree: L-MEA-03 has the rule that retained what was retained land on the line, and a figure that
// moved when the threshold moved would be a figure the threshold had been subtracted from.
import type { Kind } from "@/core/catalogue/kinds";
import type { MethodPair } from "../../editions/content";
import { formulaFrom, minus, V, type Statement } from "../expr";
import type { FormulaMethod, MethodVariable } from "../law";

/** The variables a finish formula names, each in the dimension its reading is taken in (L-MEA-03). */
const GROSS: MethodVariable = Object.freeze({ name: "gross", dimension: "AREA" as const });
const OPENINGS: MethodVariable = Object.freeze({ name: "openings", dimension: "AREA" as const });
const THRESHOLD: MethodVariable = Object.freeze({ name: "threshold", dimension: "AREA" as const });

/** `A = gross − openings` — the face, net of what the schedule's openings deducted (L-MEA-03). */
export const FACE_TREE: Statement = Object.freeze({ result: "A", expr: minus(V("gross"), V("openings")) });

/**
 * One finish method: the face tree, in force under this pair and measuring this kind. The kind is the
 * only thing that differs between the finishes of one face, and it is what selects the rail that
 * offers it (L-MEA-08).
 */
export function faceMethodOf(pair: MethodPair, kind: Kind): FormulaMethod {
  const parts = formulaFrom(FACE_TREE, pair.ruleId);
  return Object.freeze({
    role: "formula",
    ruleId: pair.ruleId,
    version: pair.version,
    kind,
    dimension: "AREA",
    variables: Object.freeze([GROSS, OPENINGS, THRESHOLD]),
    // A finish deducts through its OWN channel: L-MEA-01 states a threshold per channel, and a
    // finish's threshold is `finishOpeningDeductionMinM2` rather than a wall's.
    deductionChannels: Object.freeze(["finish_opening" as const]),
    tree: FACE_TREE,
    template: parts.template,
    evaluate: parts.evaluate,
    attempt: parts.attempt,
  });
}
