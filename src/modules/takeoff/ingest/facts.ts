// R-TO-001's fidelity counters, as named facts: what the extractor reported about the units it read
// and about what the extraction lost, taken off the artifact and nothing else.
//
// Nothing here counts anything. A count made on this side would be a second answer to a question
// `cad/` already answered, and two answers to one question are how a record stops being evidence
// (L-CAD-01, ARCH-02) — so every field below is carried over in the artifact's own order.
import type { EntityGraph } from "../../../core/entitygraph/schema";

/** One layout as the record names it: the space, its kind, and the strays kept out of its extents. */
export type IngestLayoutFact = { name: string; kind: string; strays_rejected: number };

/** One space's counters: whether exploding was cut short, and what it and flattening cost (L-CAD-05). */
export type IngestCounterFact = {
  space: string;
  explode_truncated: boolean;
  explode_losses: Record<string, number>;
  flatten_capped: Record<string, number>;
};

/** Everything a record pins about what was taken and what was lost taking it (R-TO-001). */
export type IngestFacts = {
  insunits: EntityGraph["insunits"];
  dropped_layouts: string[];
  layouts: IngestLayoutFact[];
  counters: IngestCounterFact[];
};

/** The named facts an artifact carries, read off it field for field. */
export function factsOf(graph: EntityGraph): IngestFacts {
  return {
    insunits: { ...graph.insunits },
    dropped_layouts: [...graph.dropped_layouts],
    layouts: graph.layouts.map((layout) => ({ name: layout.name, kind: layout.kind, strays_rejected: layout.strays_rejected })),
    counters: graph.counters.map((counter) => ({
      space: counter.space,
      explode_truncated: counter.explode_truncated,
      explode_losses: { ...counter.explode_losses },
      flatten_capped: { ...counter.flatten_capped },
    })),
  };
}
