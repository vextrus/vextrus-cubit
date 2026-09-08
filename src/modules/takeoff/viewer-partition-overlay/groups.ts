// L-ACT-02's "bulk is offered, never assembled", read over the views the overlay carries: one group
// per class a model proposed among the views nobody has ruled on yet, keyed on the fact judged.
//
// The offer is DERIVED from the rows, never listed: a class is offered because views propose it, and
// a view that has been confirmed has left the group because L-ACT-01 gives a second, disagreeing
// reading its own path rather than a re-confirmation (R-UI-023: "there is no select-all over
// heterogeneous rows", and no member list either — the pattern's substance is that absence).
import type { ViewGroupKey } from "@/core/acts";
import { formatUserFigure } from "@/core/format";
import { PARTITION_COPY, fillCopy } from "./copy";
import type { PartitionOverlayView } from "./types";

/**
 * The kind of fact these groups are keyed on. It is spelled against the seam's own union, so a kind
 * renamed in the closed roster is a compile error here rather than a key nobody offers (B-17).
 */
const PROPOSED_VIEW_TYPE: ViewGroupKey["kind"] = "PROPOSED_VIEW_TYPE";

/** One offered group, in the shape the shipped `OfferedGroups` takes one (I-78, I-79). */
export type OfferedViewGroup = {
  readonly key: ViewGroupKey;
  readonly label: string;
  readonly count: string;
};

/**
 * The groups this drawing's partition offers right now, in the order its views first propose them —
 * an order, so two readings of one partition offer the same list (L-REG-05), and never a ranking.
 *
 * A view with no proposal joins none; a view somebody has already confirmed joins none. Where that
 * leaves nothing, the answer is the empty offer, and the panel says so rather than standing a door
 * onto nothing (R-UI-020).
 */
export function offeredViewGroups(views: readonly PartitionOverlayView[], drawingId: string): OfferedViewGroup[] {
  const counted = new Map<string, number>();
  for (const view of views) {
    if (view.proposed === null || view.confirmed !== null) continue;
    counted.set(view.proposed.type, (counted.get(view.proposed.type) ?? 0) + 1);
  }

  return [...counted.entries()].map(([viewType, members]) => ({
    key: { kind: PROPOSED_VIEW_TYPE, drawingId, viewType },
    label: fillCopy("viewer_partition_group_label", { type: viewType }),
    // The pattern never counts and never formats (I-78): the figure goes through SEAM-FORMAT here,
    // and one member says its own sentence rather than "1" filled into the plural one.
    count: members === 1 ? PARTITION_COPY.viewer_partition_group_count_one : fillCopy("viewer_partition_group_count_many", { count: formatUserFigure(String(members)) }),
  }));
}
