// @vitest-environment jsdom
/**
 * The rooms an architect's plan encloses, as the views/grid overlay shows them (ARCH-5; s-takeoff
 * I-647): painted on the sheet through the plan's own grid, and listed in the panel with their
 * areas, the surfaces they registered and — where a region is no room — the register's reason.
 *
 * What is judged is what a reader meets: the scene the canvas paints (a room outlined, a void dotted,
 * an unclosed room with no outline at all, a region dropped not painted), where a room lands on a
 * PAPER sheet that shows the plan through a window, the switch that hides them, and the panel's rows.
 * Copy is read from the registry, never typed (R-SPINE-060).
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS } from "../../../src/core/errors";
import { PartitionPanel } from "../../../src/modules/takeoff/viewer-partition-overlay/partition-panel";
import { overlayScene, sceneCounts, sheetFrameOf, screenAt } from "../../../src/modules/takeoff/viewer-partition-overlay/scene";
import type { PartitionOverlay, PartitionOverlayAxis, PartitionOverlayRoom } from "../../../src/modules/takeoff/viewer-partition-overlay/types";
import type { Camera } from "../../../src/modules/takeoff/viewer/types";
import { viewerPartition } from "../../../src/ui/strings/viewer-partition";
import { TESTIDS } from "../../../src/ui/testids";

const PLAN = "LAYOUT_PLAN:DXF_HANDLE:81B";

/** An axis of the plan: its model position, and where its bubble stands on the sheet opened. */
function axis(label: string, family: "x" | "y", position: number, onSheet: number): PartitionOverlayAxis {
  const centre = family === "x" ? ([onSheet, 0] as const) : ([0, onSheet] as const);
  return { viewKey: PLAN, family: family === "x" ? "numeral" : "letter", label, axis: family, position, bubbleKey: `DXF_HANDLE:B${label}`, labelKey: `DXF_HANDLE:L${label}`, minSpacing: 4000, bubble: { centre, radius: 4 } };
}

/** A room of the plan, in the feed's shape; the outline is a model-space rectangle. */
function room(roomKey: string, status: PartitionOverlayRoom["status"], name: string | null, extra: Partial<PartitionOverlayRoom> = {}): PartitionOverlayRoom {
  return {
    roomKey,
    viewKey: PLAN,
    status,
    reason: null,
    name,
    labels: [],
    outline: { outer: [[125, 125], [4447, 125], [4447, 4875], [125, 4875]], holes: [] },
    areaM2: "20.5295",
    anchor: [2000, 2500],
    faces: status === "CLOSED" ? 3 : 0,
    ...extra,
  };
}

/** A paper sheet showing the plan at 1:100 through a window shifted 50 across and 20 up. */
function paperOverlay(): PartitionOverlay {
  return {
    ingestId: "11111111-1111-4111-8111-111111111111",
    views: [{ viewKey: PLAN, type: "LAYOUT_PLAN", reason: null, caption: "TYPICAL FLOOR PLAN", anchorKey: "DXF_HANDLE:81B", proposed: null, confirmed: null, entityCount: 900, box: { min: [40, 10], max: [300, 200] } }],
    axes: [axis("1", "x", 0, 50), axis("2", "x", 4572, 95.72), axis("A", "y", 0, 20), axis("B", "y", 4876.8, 68.768)],
    deferrals: [],
    rooms: [
      room("r-bed", "CLOSED", "BED-01"),
      room("r-lift", "VOID", "LIFT", { areaM2: "5.61194388" }),
      room("r-guard", "NOT_CLOSED", "GUARD ROOM", { reason: "SURFACE_NOT_CLOSED", outline: null, areaM2: null, anchor: [1000, 1000] }),
      room("r-sliver", "DROPPED", null, { reason: "ROOM_OUTLINE_OUT_OF_BAND", areaM2: "0.0156" }),
    ],
  } as PartitionOverlay;
}

/** A camera that shows the sheet at 1 px per sheet unit, its origin at the canvas's top-left. */
const CAMERA: Camera = { centre: [500, 400], scale: 1, viewport: { width: 1000, height: 800 } } as unknown as Camera;

afterEach(() => cleanup());

describe("the rooms on the sheet (I-647)", () => {
  test("a paper sheet's window is read off the plan's own grid: model millimetres land where the sheet draws them", () => {
    const frame = sheetFrameOf(paperOverlay().axes);
    expect(frame, "four bubbles on the sheet fix the window").not.toBeNull();
    const [x, y] = frame?.([4572, 4876.8]) ?? [0, 0];
    expect([Number(x.toFixed(6)), Number(y.toFixed(6))]).toEqual([95.72, 68.768]);
    expect(sheetFrameOf([axis("1", "x", 0, 0)]), "a single bubble fixes no scale, so the rooms are listed and not painted").toBeNull();
  });

  test("a room is outlined and chipped with its name and area; a void is outlined; an unclosed room carries only its chip; a dropped region is not painted", () => {
    const scene = overlayScene(paperOverlay(), { views: true, grid: true, rooms: true }, CAMERA);
    const rooms = scene.rooms ?? [];
    expect(rooms.map((one) => [one.roomKey, one.status])).toEqual([
      ["r-bed", "CLOSED"],
      ["r-lift", "VOID"],
      ["r-guard", "NOT_CLOSED"],
    ]);
    const bed = rooms[0];
    expect(bed?.lines).toEqual(["BED-01", viewerPartition.viewer_partition_room_area.replace("{area}", "20.53")]);
    // The outline's first corner (125, 125) in model millimetres, carried onto the paper and the screen.
    const frame = sheetFrameOf(paperOverlay().axes);
    expect(bed?.outer[0]).toEqual(screenAt(CAMERA, frame?.([125, 125]) ?? [0, 0]));
    expect(rooms[1]?.lines).toEqual(["LIFT", viewerPartition.viewer_partition_room_void]);
    expect([rooms[2]?.outer, rooms[2]?.lines], "no box round a room whose walls do not close (L-MEA-03)").toEqual([[], ["GUARD ROOM", viewerPartition.viewer_partition_room_not_closed]]);
    expect(sceneCounts(scene)).toMatchObject({ rooms: 3, unclosed: 1 });
  });

  test("the rooms switch hides them and nothing else; an overlay read before the rooms stage paints as it always did", () => {
    const hidden = overlayScene(paperOverlay(), { views: true, grid: true, rooms: false }, CAMERA);
    expect(hidden.rooms).toEqual([]);
    expect(hidden.outlines.length, "the views are still outlined").toBe(1);
    const before: PartitionOverlay = { ...paperOverlay(), rooms: undefined };
    expect("rooms" in overlayScene(before, { views: true, grid: true }, CAMERA), "no rooms key where the reading carries none").toBe(false);
  });
});

describe("the rooms in the panel (I-647)", () => {
  function mount(overlay: PartitionOverlay): HTMLElement {
    render(
      <PartitionPanel
        state="ready"
        overlay={overlay}
        toggles={{ views: true, grid: true, rooms: true }}
        onToggle={() => undefined}
        onRetry={() => undefined}
        faultId={null}
        groups={null}
        answer={null}
        testIds={{ room: TESTIDS.viewer.partitionRoom, roomsToggle: TESTIDS.viewer.partitionRoomsToggle }}
      />,
    );
    return screen.getByTestId(TESTIDS.viewer.partition);
  }

  test("each room of this sheet's plan is a row: its name, its area and its faces — or what it is and the register's reason", () => {
    const panel = mount(paperOverlay());
    expect(within(panel).getByTestId(TESTIDS.viewer.partitionRoomsToggle).getAttribute("aria-checked")).toBe("true");
    const rows = within(panel).getAllByTestId(TESTIDS.viewer.partitionRoom);
    expect(rows.map((row) => [row.getAttribute("data-room-key"), row.getAttribute("data-status"), row.getAttribute("data-reason")])).toEqual([
      ["r-bed", "CLOSED", null],
      ["r-lift", "VOID", null],
      ["r-guard", "NOT_CLOSED", "SURFACE_NOT_CLOSED"],
      ["r-sliver", "DROPPED", "ROOM_OUTLINE_OUT_OF_BAND"],
    ]);
    expect(rows[0]?.textContent).toContain(viewerPartition.viewer_partition_room_faces_all);
    expect(rows[2]?.textContent, "the unclosed room says why").toContain(REFUSALS.SURFACE_NOT_CLOSED.message);
    expect(rows[3]?.textContent, "the dropped region is listed, never silently").toContain(viewerPartition.viewer_partition_room_unnamed);
    expect(rows[3]?.textContent).toContain(REFUSALS.ROOM_OUTLINE_OUT_OF_BAND.message);
  });

  test("a partition that read no rooms offers no rooms switch", () => {
    const before: PartitionOverlay = { ...paperOverlay(), rooms: undefined };
    const panel = mount(before);
    expect(within(panel).queryByTestId(TESTIDS.viewer.partitionRoomsToggle)).toBeNull();
    expect(within(panel).queryAllByTestId(TESTIDS.viewer.partitionRoom)).toEqual([]);
  });
});
