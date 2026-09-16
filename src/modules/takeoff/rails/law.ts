// The shape one AREA's rail roster takes. It stands in its own file because every area file of this
// directory declares its roster against it and the barrel `./index.ts` — which enumerates those
// areas — merges them: a shape imported from the barrel would be a cycle, and one each area
// re-spelled would be the drift B-17 exists to prevent.

import type { Kind } from "@/core/catalogue/kinds";
import type { Offer, Rail, RailBatch, RailInput, RailObservation } from "@/core/offers/contract";

/**
 * One area's rails, keyed by quantity KIND (L-MEA-08). Partial on purpose: a kind with no rail is a
 * kind nothing measures rather than a kind measured by a default.
 */
export type RailRoster = Readonly<Partial<Record<Kind, Rail>>>;

/**
 * Several class readers of ONE kind, as the one rail that kind is measured by.
 *
 * "A rail is selected per quantity KIND, never per drawing" (L-MEA-08), and a kind is measured by one
 * function — but a kind is borne by several classes: `rcc.concrete` is a column's and a footing's and
 * a pile's alike (L-MEA-04's `bears`). So a class reader is written where its area's law is written,
 * and the kind's roster line composes them: the batch is the readers' batches concatenated in
 * argument order, and this computes nothing of its own.
 *
 * Each reader is handed the input unchanged and reads the rows of its own class, so the composition
 * is as pure as the readers are and the order of the offers is the order the readers were named in.
 */
export function composeRails(...rails: readonly Rail[]): Rail {
  return (input: RailInput): RailBatch => {
    const offers: Offer[] = [];
    const observations: RailObservation[] = [];
    for (const rail of rails) {
      const batch = rail(input);
      offers.push(...batch.offers);
      observations.push(...batch.observations);
    }
    return { offers, observations };
  };
}
