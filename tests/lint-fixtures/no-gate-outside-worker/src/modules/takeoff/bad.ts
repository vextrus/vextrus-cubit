// SEAM-GATE's payload, from the module layer: `src/core/gate` reached from `src/modules/**`.
//
// "The gate is the sole writer of quantity lines and rail observations (L-MEA-08)" — and the way a
// sole writer stays sole is that nothing outside the worker's own handler can reach it at all. The
// ban is TOTAL: a type-only import is a reach too, which is why the rail↔gate contract lives in
// `src/core/offers` — a module that has to type a rail imports that, and never this (riskNotes (2)).
//
// This file is linted as `src/modules/takeoff/bad.ts` (the corpus's virtual path is read from its
// last `src/` segment) and scanned at the same address. Nothing here is imported by anything: it
// exists to be scanned. `scripts/eslint/**` is locked at M2, so the ban is a committed scan rather
// than an ESLint rule — the way L-CAD-06's view-type spellings and L-FRM-06's factors are banned.
//
// Every spelling that reaches the gate from here is on its own line, each carrying its recorded
// reason. A relative spelling that would resolve somewhere OTHER than `src/core/gate` is not a reach
// at the gate and is deliberately not written: the ban is on the module, not on a run of characters.
//
// The payload declares its own answer, so the prover never has to re-derive it: a line the scan owes
// a finding at carries the trailing marker below, and a line it must NOT report carries none. The
// marker is the fixture's word, not the scanner's — which is the whole use of a corpus.
import { evaluateOffers } from "@/core/gate"; // RECORDED REASON SEAM-GATE — GATE-IMPORT: reported
import { partitionDeductions } from "@/core/gate/index"; // RECORDED REASON SEAM-GATE — GATE-IMPORT: reported
import type { GateVerdict } from "../../core/gate"; // RECORDED REASON SEAM-GATE — GATE-IMPORT: reported

// A statement broken across lines reaches the gate exactly as a one-line one does: the ban is about
// the module reached, never the shape of the statement (AC-2 — "any spelling"). It is owed at the
// line that spells the module, which is where the marker sits.
import {
  renderFormula,
} from "@/core/gate"; // RECORDED REASON SEAM-GATE — GATE-IMPORT: reported

// The lawful counterpart, side by side with the payload: a module types a rail through the contract.
import type { Offer } from "@/core/offers/contract";

// Prose, and a string, that name the gate without reaching it. Neither is an import, and a scan that
// reported either would be matching characters rather than reading imports: "@/core/gate".
export const named = "@/core/gate";

export async function measureAnyway(offers: readonly Offer[]): Promise<GateVerdict> {
  void partitionDeductions;
  void renderFormula;
  return evaluateOffers({ tenantId: "", projectId: "", campaignId: "" }, { offers, observations: [] });
}
