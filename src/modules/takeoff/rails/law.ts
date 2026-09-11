// The shape one AREA's rail roster takes. It stands in its own file because every area file of this
// directory declares its roster against it and the barrel `./index.ts` — which enumerates those
// areas — merges them: a shape imported from the barrel would be a cycle, and one each area
// re-spelled would be the drift B-17 exists to prevent.

import type { Kind } from "@/core/catalogue/kinds";
import type { Rail } from "@/core/offers/contract";

/**
 * One area's rails, keyed by quantity KIND (L-MEA-08). Partial on purpose: a kind with no rail is a
 * kind nothing measures rather than a kind measured by a default.
 */
export type RailRoster = Readonly<Partial<Record<Kind, Rail>>>;
