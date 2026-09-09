// The lawful half of the corpus: the worker's handler IS the one lawful caller of the gate (goal),
// so the very same spellings the two bad payloads carry are lawful here and the scan must report
// nothing at all in this file.
//
// This file is linted and scanned as `src/worker/good.ts`. It reaches the gate by the alias and by a
// relative path, and it types a rail through the contract — the whole vocabulary, at the one address
// that may hold it.
import { evaluateOffers } from "@/core/gate";
import type { GateVerdict } from "../core/gate";
import type { Offer, RailObservation } from "@/core/offers/contract";

export async function runTheGate(
  scope: { tenantId: string; projectId: string; campaignId: string },
  offers: readonly Offer[],
  observations: readonly RailObservation[],
): Promise<GateVerdict> {
  return evaluateOffers(scope, { offers, observations });
}
