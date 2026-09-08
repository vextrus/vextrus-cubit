/**
 * AC-4's offer half — `offeredViewGroups(views, drawingId)`, L-ACT-02's "bulk is offered, never
 * assembled" read over the views the overlay carries.
 *
 * Every sentence is the strings table's own, filled the way the Decision fills it, and every count
 * goes through `formatUserFigure` — both read from the product rather than typed here (B-19,
 * R-SPINE-060), so a table that re-words the offer moves this expectation with it. The arming rule
 * is derived from the input list: a class is offered because views propose it, not because this
 * file says so.
 */
import { describe, expect, test } from "vitest";
import {
  COPY,
  DETAIL,
  LEGEND_NOTES,
  PROPOSED_VIEW_TYPE,
  SCHEDULE,
  UNTYPED,
  aView,
  fill,
  formatSeam,
  groupsDoor,
  partitionStrings,
  type GroupItem,
  type OverlayView,
} from "./support/overlay-stage";

/** The drawing the offer is keyed on — an identity, never a name (L-ACT-02's typed key). */
const DRAWING = "33333333-3333-4333-8333-333333333333";

/** How many views the third class proposes: enough that a figure without its seam reads wrong. */
const MANY = 1234;

/**
 * The views the offer is read over: two silent views proposed at one class, one at another, that
 * many at a third, one silent view somebody has already confirmed, and two views nobody proposed
 * anything for.
 */
function views(): OverlayView[] {
  const many = Array.from({ length: MANY }, (_unused, at) =>
    aView({ viewKey: `crowd-${at}`, type: UNTYPED, reason: "CAPTION_UNCLASSIFIABLE", proposed: { type: SCHEDULE, callId: `call-crowd-${at}` } }),
  );
  return [
    aView({ viewKey: "silent-1", type: UNTYPED, reason: "CAPTION_UNCLASSIFIABLE", proposed: { type: DETAIL, callId: "call-1" } }),
    aView({ viewKey: "silent-2", type: UNTYPED, reason: "CAPTION_UNCLASSIFIABLE", proposed: { type: DETAIL, callId: "call-2" } }),
    aView({ viewKey: "silent-3", type: UNTYPED, reason: "CAPTION_UNCLASSIFIABLE", proposed: { type: LEGEND_NOTES, callId: "call-3" } }),
    ...many,
    aView({
      viewKey: "settled-1",
      type: UNTYPED,
      reason: "CAPTION_UNCLASSIFIABLE",
      proposed: { type: DETAIL, callId: "call-4" },
      confirmed: { type: DETAIL, actId: "44444444-4444-4444-8444-444444444444" },
    }),
    aView({ viewKey: "plan-1" }),
    aView({ viewKey: "elsewhere-1", type: SCHEDULE, box: null }),
  ];
}

/** The classes the input really offers: proposed, and not yet confirmed — derived, never listed. */
function armedClasses(rows: readonly OverlayView[]): Map<string, number> {
  const counted = new Map<string, number>();
  for (const row of rows) {
    if (row.proposed === null || row.confirmed !== null) continue;
    counted.set(row.proposed.type, (counted.get(row.proposed.type) ?? 0) + 1);
  }
  return counted;
}

/** The offer, in one comparable order — the answer's order is nobody's contract (C-05). */
function byType(groups: readonly GroupItem[]): GroupItem[] {
  return [...groups].sort((left, right) => (left.key.viewType < right.key.viewType ? -1 : left.key.viewType > right.key.viewType ? 1 : 0));
}

describe("AC-4: confirming is offered by group, one group per proposed class", () => {
  test("AC-4: one group per proposed class among the unconfirmed views, keyed on the fact judged", async () => {
    const { offeredViewGroups } = await groupsDoor();
    const rows = views();
    const armed = armedClasses(rows);
    expect(armed.size, "the staged views really propose more than one class").toBeGreaterThan(1);

    const offered = byType(offeredViewGroups(rows, DRAWING));
    expect(
      offered.map((group) => group.key.viewType),
      "one group per class proposed among views nobody has confirmed — a confirmed view joins none, and a view with no proposal joins none",
    ).toEqual([...armed.keys()].sort());

    for (const group of offered) {
      expect(
        group.key,
        `the ${group.key.viewType} group is keyed on the fact judged: the kind, the drawing and the class`,
      ).toEqual({ kind: PROPOSED_VIEW_TYPE, drawingId: DRAWING, viewType: group.key.viewType });
    }
  });

  test("AC-4: each group says the table's sentence, filled with its class, and counts its own members", async () => {
    const { offeredViewGroups } = await groupsDoor();
    const table = await partitionStrings();
    const { formatUserFigure } = await formatSeam();
    const rows = views();
    const armed = armedClasses(rows);

    for (const group of byType(offeredViewGroups(rows, DRAWING))) {
      const members = armed.get(group.key.viewType) ?? 0;
      expect(group.label, `the ${group.key.viewType} group says the table's own sentence, filled with the class`).toBe(
        fill(table["viewer_partition_group_label"] as string, { type: group.key.viewType }),
      );
      expect(group.count, `the ${group.key.viewType} group counts its own members, through the figure seam`).toBe(
        members === 1 ? (table["viewer_partition_group_count_one"] as string) : fill(table["viewer_partition_group_count_many"] as string, { count: formatUserFigure(String(members)) }),
      );
    }
  });

  test("AC-4: the table says what the contract fixes it to say, verbatim", async () => {
    const table = await partitionStrings();
    for (const [key, sentence] of Object.entries(COPY)) {
      expect(table[key], `${key} is the copy the Decision fixes (C-05)`).toBe(sentence);
    }
  });

  test("AC-4: no views at all, and no unconfirmed proposal, are both an empty offer", async () => {
    const { offeredViewGroups } = await groupsDoor();
    expect(offeredViewGroups([], DRAWING), "nothing to offer over nothing").toEqual([]);
    expect(
      offeredViewGroups(views().filter((row) => row.proposed === null || row.confirmed !== null), DRAWING),
      "every proposal already carried: the offer is empty, and the panel says so rather than showing a door onto nothing",
    ).toEqual([]);
  });
});
