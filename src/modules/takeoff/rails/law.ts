// The shape one AREA's rail roster takes, and how the areas' rosters become one. It stands in its
// own file because every area file of this directory declares its roster against it and the barrel
// `./index.ts` — which enumerates those areas — merges them: a shape imported from the barrel would
// be a cycle, and one each area re-spelled would be the drift B-17 exists to prevent.

import type { Kind } from "@/core/catalogue/kinds";
import type { Rail, RailBatch, RailInput, RailObservation, Offer } from "@/core/offers/contract";

/**
 * One area's rails, keyed by quantity KIND (L-MEA-08). Partial on purpose: a kind with no rail is a
 * kind nothing measures rather than a kind measured by a default.
 */
export type RailRoster = Readonly<Partial<Record<Kind, Rail>>>;

/**
 * Several rails for one kind, as ONE rail: a pure function whose batch is the members' batches
 * concatenated, offers then observations, in the order they were composed.
 *
 * L-MEA-08 selects a rail per kind, and more than one AREA measures a kind — the frame's beams and
 * this area's slabs are both `rcc.concrete`. Composing them is how the roster answers for both:
 * a spread of one area's map over another's would keep the last and lose the first in silence,
 * which is a kind measured by half the tree while the roster says it is measured (AM-11, B-19).
 *
 * Each member is asked exactly once, for the same input: a rail is pure, so the composition is too.
 */
export function composeRails(rails: readonly Rail[]): Rail {
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

/**
 * Every area's rails as one roster: a kind exactly one area answers is answered by that area's very
 * function, and a kind several answer is answered by `composeRails` over them in enumeration order.
 *
 * The identity in the single-area case matters: a roster that wrapped every rail would make "which
 * function measures this kind" unanswerable, and a reader auditing the roster would see a closure
 * rather than the rail its area declared.
 */
export function enumerateRails(areas: readonly RailRoster[]): RailRoster {
  const held = new Map<Kind, Rail[]>();
  for (const area of areas) {
    for (const [kind, rail] of Object.entries(area) as readonly [Kind, Rail | undefined][]) {
      if (rail === undefined) continue;
      held.set(kind, [...(held.get(kind) ?? []), rail]);
    }
  }
  const roster: Partial<Record<Kind, Rail>> = {};
  for (const [kind, rails] of held) roster[kind] = rails.length === 1 ? (rails[0] as Rail) : composeRails(rails);
  return Object.freeze(roster);
}
