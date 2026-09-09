// The lawful half of the corpus: the worker's handler IS the one lawful caller of the gate (goal),
// so the very same spellings the two bad payloads carry are lawful here and the scan must report
// nothing at all in this file.
//
// This file is linted and scanned as `src/worker/good.ts`. It reaches the gate by the alias and by a
// relative path, and it types a rail through the contract — the whole vocabulary, at the one address
// that may hold it.
//
// The lawful marker below is this payload's own declaration that the line really does reach the gate:
// a `good.*` payload that reached it nowhere would prove nothing by going unreported.
import { evaluateOffers } from "@/core/gate"; // GATE-IMPORT: lawful
import type { GateVerdict } from "../core/gate"; // GATE-IMPORT: lawful
import type { Offer, RailObservation } from "@/core/offers/contract";

export async function runTheGate(
  scope: { tenantId: string; projectId: string; campaignId: string },
  offers: readonly Offer[],
  observations: readonly RailObservation[],
): Promise<GateVerdict> {
  return evaluateOffers(scope, { offers, observations });
}
