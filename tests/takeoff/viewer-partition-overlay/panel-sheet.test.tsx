// @vitest-environment jsdom
/**
 * I-319, I-114 and I-111 as amended — the views/grid panel on a PAPER sheet, mounted bare over the
 * shape F-RCC6-BNBC's S-10 answered: one view of the drawing stands on the sheet and the rest stand
 * on others; ten views are untyped, each with the same stored reason.
 *
 * Before these amendments the panel listed every view in view-key order, the one on the sheet ninth
 * and under the fold, 53 rows saying "Not on this sheet", the raw store tokens on every badge, and
 * the register's 88-character sentence as a paragraph under every untyped row (the craft rubric's
 * copy-diet 1). What is judged here is what a reader meets: which row is first, what is folded and
 * what the fold says, the words on the badge, and where the reason went.
 *
 * The chrome is the product's own — IdChip, EnumLabel, humaniseEnum and Tooltip from `src/ui`, the
 * very components the screen hands the panel (ARCH-01) — so the slots are judged as they will be
 * mounted, and a slot whose type drifts from the primitive's fails to compile here. Copy is read from
 * the registry, never typed (R-SPINE-060).
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { REFUSALS } from "../../../src/core/errors";
import { formatUserFigure } from "../../../src/core/format";
import { offeredViewGroups } from "../../../src/modules/takeoff/viewer-partition-overlay/groups";
import { PartitionPanel, type PartitionPanelProps } from "../../../src/modules/takeoff/viewer-partition-overlay/partition-panel";
import type { PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "../../../src/modules/takeoff/viewer-partition-overlay/types";
import { EnumLabel, IdChip, Tooltip } from "../../../src/ui/primitives/core";
import { humaniseEnum } from "../../../src/ui/primitives/core/enum-label";
import { viewerPartition } from "../../../src/ui/strings/viewer-partition";
import { TESTIDS } from "../../../src/ui/testids";

/** The stored reason a caption the grammar could not read leaves on its view (L-CAD-06). */
const CAPTION_UNCLASSIFIABLE = "CAPTION_UNCLASSIFIABLE";

/** The drawing the offer is keyed on. */
const DRAWING = "33333333-3333-4333-8333-333333333333";

/** One view, in the feed's shape. */
function view(viewKey: string, type: string, box: PartitionOverlayView["box"], extra: Partial<Record<"reason" | "caption" | "proposed", unknown>> = {}): PartitionOverlayView {
  return {
    viewKey,
    type,
    reason: null,
    caption: `${type} ${viewKey}`,
    anchorKey: null,
    proposed: null,
    confirmed: null,
    entityCount: 12,
    box,
    ...extra,
  } as unknown as PartitionOverlayView;
}

/** One stored axis of a view, in the feed's shape. */
function axis(viewKey: string, label: string): PartitionOverlayAxis {
  return { viewKey, label, family: "numeral", axis: "x", position: 1_200_000, bubbleKey: `DXF_HANDLE:${viewKey}-${label}`, labelKey: `DXF_HANDLE:${viewKey}-${label}t`, minSpacing: 1, bubble: null } as unknown as PartitionOverlayAxis;
}

/** The on-sheet view, placed LAST in the store's order — as S-10's was ninth — so "first" is earned. */
const HERE = "LAYOUT_PLAN:DXF_HANDLE:20B6";
const BOX = { min: [133.9, 180.8] as const, max: [402.1, 420.8] as const };

/** S-10's shape: three views on other sheets (two untyped, one proposed a class), then the one here. */
function paperSheet(): PartitionOverlay {
  return {
    ingestId: "11111111-1111-4111-8111-111111111111",
    views: [
      view("DETAIL:DXF_HANDLE:1B04", "DETAIL", null),
      view("UNTYPED:DXF_HANDLE:1FC2", "UNTYPED", null, { reason: CAPTION_UNCLASSIFIABLE, proposed: { type: "DETAIL", callId: "call-1" } }),
      view("UNTYPED:DXF_HANDLE:21CB", "UNTYPED", null, { reason: CAPTION_UNCLASSIFIABLE, proposed: { type: "MEMBER_SECTION", callId: "call-2" } }),
      view(HERE, "LAYOUT_PLAN", BOX),
    ],
    axes: [axis("DETAIL:DXF_HANDLE:1B04", "9"), axis(HERE, "1"), axis(HERE, "2")],
    deferrals: [{ viewKey: "DETAIL:DXF_HANDLE:1B04", reason: "GRID_NO_BUBBLE_EVIDENCE" }],
  } as unknown as PartitionOverlay;
}

/** The chrome the screen hands the panel — the product's own primitives, nothing redrawn. */
const CHROME: Pick<PartitionPanelProps, "IdChip" | "EnumLabel" | "humaniseEnum" | "Tooltip"> = { IdChip, EnumLabel, humaniseEnum, Tooltip };

/** The panel, ready, over one partition — with the screen's chrome unless a case asks for none. */
function mount(overlay: PartitionOverlay, chrome: Partial<PartitionPanelProps> = CHROME): HTMLElement {
  render(
    <PartitionPanel
      state="ready"
      overlay={overlay}
      toggles={{ views: true, grid: true }}
      onToggle={() => undefined}
      onRetry={() => undefined}
      faultId={null}
      groups={null}
      answer={null}
      testIds={{ room: TESTIDS.viewer.partitionRoom, roomsToggle: TESTIDS.viewer.partitionRoomsToggle }}
      {...chrome}
    />,
  );
  return screen.getByTestId(TESTIDS.viewer.partition);
}

/** The rows of one test id, in document order. */
function rowsOf(panel: HTMLElement, testId: string): HTMLElement[] {
  return within(panel).queryAllByTestId(testId);
}

beforeAll(() => {
  // Radix positions a tooltip with a ResizeObserver, which jsdom does not ship.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => cleanup());

describe("I-319: this sheet first, and the other sheets folded under one line", () => {
  test("I-319: the view standing on this sheet is the first row, whatever the store's order", () => {
    const panel = mount(paperSheet());
    const rows = rowsOf(panel, TESTIDS.viewer.partitionView);
    expect(rows[0]?.getAttribute("data-view-key"), "the one view this sheet shows leads the list").toBe(HERE);
    expect(rows[0]?.getAttribute("data-on-sheet"), "and says it stands here").toBe("true");
    expect(
      rows.map((row) => row.getAttribute("data-view-key")),
      "every view keeps its row: this sheet's first, then the others in the order the store carries them",
    ).toEqual([HERE, ...paperSheet().views.filter((row) => row.box === null).map((row) => row.viewKey)]);
  });

  test("I-319: the views on other sheets, their axes and their deferrals are one closed disclosure that says how many", () => {
    const panel = mount(paperSheet());
    const fold = panel.querySelector("details");
    expect(fold, "what stands on other sheets is folded").not.toBeNull();
    expect((fold as HTMLDetailsElement).open, "and closed at open, so this sheet's rows are what a reader meets").toBe(false);

    const others = paperSheet().views.filter((row) => row.box === null).length;
    expect(fold?.querySelector("summary")?.textContent, "the fold says how many views it holds, in the registry's words").toBe(
      viewerPartition.viewer_partition_elsewhere_many.replace("{count}", formatUserFigure(String(others))),
    );
    for (const row of rowsOf(panel, TESTIDS.viewer.partitionView)) {
      expect(Boolean(fold?.contains(row)), `${row.getAttribute("data-view-key")} is folded exactly when it stands on another sheet`).toBe(row.getAttribute("data-on-sheet") === "false");
    }
    for (const row of rowsOf(panel, TESTIDS.viewer.partitionAxis)) {
      expect(Boolean(fold?.contains(row)), `the axis ${row.getAttribute("data-label")} travels with its view`).toBe(row.getAttribute("data-view-key") !== HERE);
    }
    const [deferral] = rowsOf(panel, TESTIDS.viewer.partitionGridDeferral);
    expect(Boolean(deferral && fold?.contains(deferral)), "and so does a deferral of a view on another sheet").toBe(true);
    expect(panel.textContent, "no row repeats that it is not on this sheet: the fold said it once").not.toContain("Not on this sheet");
  });

  test("I-319: one view on another sheet is said as one, and a sheet that shows every view folds nothing", () => {
    const single = paperSheet();
    const one = { ...single, views: [single.views[0], single.views[3]], axes: [], deferrals: [] } as unknown as PartitionOverlay;
    const panel = mount(one);
    expect(panel.querySelector("summary")?.textContent, "one view on another sheet says its own sentence").toBe(viewerPartition.viewer_partition_elsewhere_one);
    cleanup();

    const modelSpace = { ...single, views: single.views.map((row) => ({ ...row, box: BOX })) } as unknown as PartitionOverlay;
    expect(mount(modelSpace).querySelector("details"), "where every view stands here — model space — there is nothing to fold and no disclosure stands").toBeNull();
  });
});

describe("I-114 as amended (R-UI-082): the badge says the stored type in a reader's words", () => {
  test("R-UI-082: the badge is the one EnumLabel — words on the screen, the stored spelling in its disclosure and on the row", () => {
    const panel = mount(paperSheet());
    for (const row of rowsOf(panel, TESTIDS.viewer.partitionView)) {
      const stored = row.getAttribute("data-type") as string;
      const badge = within(row).getByTestId(TESTIDS.viewer.partitionViewBadge);
      const label = badge.querySelector(".cx-enum-label");
      expect(label?.getAttribute("data-value"), `${stored}: the badge renders through EnumLabel, carrying the stored value`).toBe(stored);
      expect(label?.firstChild?.textContent, `${stored}: and says it in words by EnumLabel's one rule`).toBe(humaniseEnum(stored));
      expect(badge.querySelector("[data-technical]")?.textContent, `${stored}: the stored spelling stays, in the technical disclosure`).toBe(stored);
    }
  });

  test("R-UI-082: a proposal is said in words too, and the stored spelling is never shown raw on a note", () => {
    const panel = mount(paperSheet());
    const proposed = rowsOf(panel, TESTIDS.viewer.partitionView).find((row) => row.getAttribute("data-view-key") === "UNTYPED:DXF_HANDLE:21CB") as HTMLElement;
    expect(proposed.textContent, "the note says the class in words").toContain(viewerPartition.viewer_partition_proposed.replace("{type}", humaniseEnum("MEMBER_SECTION")));
    expect(proposed.textContent, "and never the store's token").not.toContain("Proposed as MEMBER_SECTION");
  });

  test("I-114: with no chrome handed in — a mount with no screen around it — the badge says the stored spelling", () => {
    const panel = mount(paperSheet(), {});
    const [first] = rowsOf(panel, TESTIDS.viewer.partitionView);
    expect(within(first as HTMLElement).getByTestId(TESTIDS.viewer.partitionViewBadge).textContent, "the stored spelling, rather than nothing").toBe("LAYOUT_PLAN");
  });

  test("R-UI-082: the offer's group label is one line, in words, and keyed on the stored spelling", () => {
    const groups = offeredViewGroups(paperSheet().views, DRAWING, humaniseEnum);
    const detail = groups.find((group) => group.key.viewType === "DETAIL");
    expect(detail?.label, "the group says the class its members stand in and the class proposed, in one line").toBe(viewerPartition.viewer_partition_group_label.replace("{type}", humaniseEnum("DETAIL")));
    expect(detail?.key.viewType, "while the key it is confirmed on is the stored spelling, whole").toBe("DETAIL");
  });
});

describe("I-111 as amended (R-UI-081): the stored reason is said on the hatched badge, not under every row", () => {
  test("R-UI-081: no untyped row carries a paragraph — the ten copies of one sentence are gone", () => {
    const panel = mount(paperSheet());
    const untyped = rowsOf(panel, TESTIDS.viewer.partitionView).filter((row) => row.getAttribute("data-untyped") === "true");
    expect(untyped.length, "the partition under test really carries untyped views").toBeGreaterThan(1);
    expect(panel.querySelectorAll("li p").length, "no row of the panel holds an explanatory paragraph").toBe(0);
    for (const row of untyped) {
      expect(row.getAttribute("data-reason"), "the row keeps the stored reason, verbatim").toBe(CAPTION_UNCLASSIFIABLE);
      expect(within(row).getByTestId(TESTIDS.viewer.partitionViewBadge).getAttribute("data-untyped"), "and the badge keeps its hatch").toBe("true");
      const reason = within(row).getByTestId(TESTIDS.viewer.partitionViewReason);
      expect(reason.textContent, "the register's own sentence stays with the row for a reader who cannot hover").toBe(REFUSALS.CAPTION_UNCLASSIFIABLE.message);
      expect(reason.className, "drawn nowhere — read out after the row's own facts").toContain("cx-viewer-hidden");
    }
  });

  test("I-111: the hatched badge says the register's sentence on focus, through the one Tooltip", async () => {
    const panel = mount(paperSheet());
    const row = rowsOf(panel, TESTIDS.viewer.partitionView).find((candidate) => candidate.getAttribute("data-untyped") === "true") as HTMLElement;
    const trigger = within(row).getByTestId(TESTIDS.viewer.partitionViewBadge).closest("button") as HTMLButtonElement;
    expect(trigger, "the untyped badge is a button a keyboard reaches").not.toBeNull();
    expect(trigger.className, "wearing the reticle, as every stop does").toContain("cx-reticle");

    await act(async () => {
      fireEvent.focus(trigger);
    });
    const tip = await screen.findAllByTestId(TESTIDS.tooltip.content);
    expect(tip[0]?.textContent, "the tooltip says the register's sentence for the stored reason").toContain(REFUSALS.CAPTION_UNCLASSIFIABLE.message);
  });

  test("I-111: a typed view's badge is no stop at all", () => {
    const panel = mount(paperSheet());
    const [first] = rowsOf(panel, TESTIDS.viewer.partitionView);
    expect(within(first as HTMLElement).getByTestId(TESTIDS.viewer.partitionViewBadge).closest("button"), "a badge with nothing more to say is not a control").toBeNull();
  });
});
