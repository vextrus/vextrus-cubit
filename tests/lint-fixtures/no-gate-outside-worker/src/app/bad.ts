// SEAM-GATE's payload, from the app layer: `src/core/gate` reached from `src/app/**`.
//
// A screen that wrote a quantity line would be a second writer, and L-MEA-08 admits exactly one. The
// ban is the same one the module layer's payload carries, at the other banned root, and it holds for
// a type-only import too — the rail↔gate contract is what an app-layer file may name (riskNotes (2)).
//
// This file is linted and scanned as `src/app/bad.ts`. Nothing here is imported by anything.
//
// As in the module layer's payload, the fixture declares its own answer: the trailing marker names a
// line the scan owes a finding at, and an unmarked line is one it must not report.
import { evaluateOffers } from "@/core/gate"; // RECORDED REASON SEAM-GATE — GATE-IMPORT: reported
import type { GateVerdict } from "../core/gate"; // RECORDED REASON SEAM-GATE — GATE-IMPORT: reported

export type Answered = GateVerdict;

export const publishFromTheScreen = evaluateOffers;
