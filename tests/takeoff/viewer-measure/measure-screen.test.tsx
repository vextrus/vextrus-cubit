// @vitest-environment jsdom
/**
 * S4's QS outcome, driven through the mounted viewer as a hand and a keyboard drive it (s-measure
 * I-371, I-372, § 2.1–2.4, § 3): on S-08 the QS presses A, snaps the SOG's own outline (81D) and reads
 * its area live, then cuts out the lift pit (830) — and the grammar's keys, the double-click, Shift's
 * constraint, Alt+click, a stray tool key, and the two preconditions the viewer holds (an unscaled view
 * and a reader without MEASURE) each answer as the Decision rules.
 *
 * Every figure is the one I-393's table states for the committed ring, at the three places a reader
 * sees (`figure.test.ts` proves the arithmetic); every id is the registry's.
 */
import { afterEach, describe, expect, test } from "vitest";
import { formatUserFigure } from "@/core/format";
import { quantise } from "@/core/identity/keys";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { S08_PIT, S08_SOG, s08Paper } from "./support/s08";
import { PIT_KEY, SOG_KEY, click, drag, hover, key, mountMeasure, unmountMeasure, type MeasureMount } from "./support/measure-screen";

afterEach(() => unmountMeasure());

const draft = (mount: MeasureMount): HTMLElement => {
  const found = mount.one(TESTIDS.measure.draft);
  expect(found, "an armed tool mounts the measure layer").not.toBeNull();
  return found as HTMLElement;
};
const cell = (mount: MeasureMount): HTMLElement => {
  const found = mount.one(TESTIDS.viewer.statusMeasure);
  expect(found, "the status line carries the measure cell while a tool is armed (§2.4)").not.toBeNull();
  return found as HTMLElement;
};
const pressed = (mount: MeasureMount, testid: string): string | null => mount.one(testid)?.getAttribute("aria-pressed") ?? null;

async function trace(mount: MeasureMount, ring: readonly (readonly [number, number])[]): Promise<void> {
  for (const point of ring) await click(mount, point);
}

describe("S4: on S-08 the QS presses A, snaps 81D, reads its area live, and cuts out the lift pit", () => {
  test("A arms Area; five endpoint snaps and Enter close 328.838 m²; X, the pit's four corners and Enter leave 320.791 m²", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "a" });
    expect(pressed(mount, TESTIDS.viewer.toolArea), "the armed tool wears aria-pressed (§9)").toBe("true");
    expect(draft(mount).getAttribute("data-state")).toBe("idle");

    await trace(mount, S08_SOG);
    expect(draft(mount).getAttribute("data-points")).toBe("5");
    expect(draft(mount).getAttribute("data-basis"), "every point met the drawing, so the outline is MEASURED (I-387)").toBe("MEASURED");
    const points = mount.all(TESTIDS.measure.point);
    expect(points.map((point) => point.getAttribute("data-source")), "each point cites the entity it was snapped to").toEqual(Array(5).fill(SOG_KEY));
    expect(points.map((point) => [point.getAttribute("data-key-x"), point.getAttribute("data-key-y")])).toEqual(S08_SOG.map(([x, y]) => [quantise(x), quantise(y)]));

    // The running figure follows the pointer: back at the first vertex the ring closes through it.
    await hover(mount, S08_SOG[0] as readonly [number, number]);
    const live = mount.one(TESTIDS.measure.liveFigure) as HTMLElement;
    expect([live.getAttribute("data-shown"), live.getAttribute("data-value"), live.getAttribute("data-unit"), live.getAttribute("data-si")]).toEqual(["true", "328.838", "m2", "calibrated"]);

    await key(mount, { key: "Enter" });
    expect(draft(mount).getAttribute("data-state"), "Enter closes the ring; with no condition picked it stands as a draft (I-497)").toBe("draft");
    expect([cell(mount).getAttribute("data-value"), cell(mount).getAttribute("data-unit")]).toEqual(["328.838", "m2"]);
    expect(cell(mount).textContent, "the cell says nothing was recorded").toContain(strings.measure_status_unrecorded);

    await key(mount, { key: "x" });
    expect(draft(mount).getAttribute("data-state")).toBe("cutting");
    await trace(mount, S08_PIT);
    await key(mount, { key: "Enter" });
    expect(draft(mount).getAttribute("data-state")).toBe("draft");
    expect(mount.all(TESTIDS.measure.point).filter((point) => point.getAttribute("data-ring") === "cutout-1").map((point) => point.getAttribute("data-source"))).toEqual(Array(4).fill(PIT_KEY));
    expect(cell(mount).getAttribute("data-value"), "(328 838 371.244… − 8 046 918.88) mm² at 0.001 m per unit").toBe("320.791");
  });
});

describe("S4 on S-08 as the product draws it: a paper sheet, the plan seen through viewport 2077 at 1:100 (I-501)", () => {
  test("A, five endpoint snaps on 81D's paper outline and Enter read 328.838 m² through the window; X and the pit leave 320.791 m²", async () => {
    const mount = await mountMeasure({ paper: true });
    const { sog, pit } = s08Paper();
    const outline = sog.points ?? [];
    await key(mount, { key: "a" });
    await trace(mount, outline);
    expect(mount.all(TESTIDS.measure.point).map((point) => point.getAttribute("data-source")), "each point met the projected outline, and cites the model entity it shows").toEqual(Array(5).fill(SOG_KEY));

    await hover(mount, outline[0] as readonly [number, number]);
    const live = mount.one(TESTIDS.measure.liveFigure) as HTMLElement;
    expect(
      [live.getAttribute("data-value"), live.getAttribute("data-unit"), live.getAttribute("data-si"), live.getAttribute("data-via")],
      "the model factor carried through window 2077 — never 0.033, the model factor on paper coordinates",
    ).toEqual(["328.838", "m2", "calibrated", "2077"]);

    await key(mount, { key: "Enter" });
    expect([cell(mount).getAttribute("data-value"), cell(mount).getAttribute("data-unit")]).toEqual(["328.838", "m2"]);
    await key(mount, { key: "x" });
    await trace(mount, pit.points ?? []);
    await key(mount, { key: "Enter" });
    expect([cell(mount).getAttribute("data-value"), cell(mount).getAttribute("data-unit")]).toEqual(["320.791", "m2"]);
  });

  test("the distance cell reads the same metres through the same window: two picks along 81D's second edge read 16.100 m, not 0.161", async () => {
    const mount = await mountMeasure({ paper: true });
    const outline = s08Paper().sog.points ?? [];
    await click(mount, outline[1] as readonly [number, number], { altKey: true });
    await click(mount, outline[2] as readonly [number, number], { altKey: true });
    const distance = mount.one(TESTIDS.viewer.statusDistance) as HTMLElement;
    expect([distance.getAttribute("data-picks"), distance.getAttribute("data-si"), distance.getAttribute("data-via")]).toEqual(["2", "calibrated", "2077"]);
    expect(distance.textContent).toContain(fill(strings.viewer_status_distance_metres, { metres: formatUserFigure("16.100") }));
  });
});

describe("I-372: the grammar, through the screen", () => {
  test("Backspace re-opens the last ring closed, and Escape costs the cut-out before the outline, then leaves to Select", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "a" });
    await trace(mount, S08_SOG);
    await key(mount, { key: "Enter" });
    await key(mount, { key: "x" });
    await trace(mount, S08_PIT);
    await key(mount, { key: "Enter" });

    await key(mount, { key: "Backspace" });
    expect([draft(mount).getAttribute("data-state"), cell(mount).getAttribute("data-points")], "the cut-out opens again, its four points kept").toEqual(["cutting", "9"]);
    await key(mount, { key: "Backspace" });
    expect(draft(mount).getAttribute("data-points"), "and a second Backspace takes its last point").toBe("8");

    await key(mount, { key: "Escape" });
    expect([draft(mount).getAttribute("data-state"), cell(mount).getAttribute("data-value")], "Escape inside the cut-out keeps the outline").toEqual(["draft", "328.838"]);
    await key(mount, { key: "Escape" });
    expect(draft(mount).getAttribute("data-state"), "a second Escape discards the draft").toBe("idle");
    await key(mount, { key: "Escape" });
    expect([pressed(mount, TESTIDS.viewer.toolSelect), mount.one(TESTIDS.measure.draft)], "with nothing in progress Escape returns to Select").toEqual(["true", null]);
  });

  test("a double-click's second click finishes the shape and places nothing", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "a" });
    const [a, b, c] = S08_PIT as [readonly [number, number], readonly [number, number], readonly [number, number]];
    await click(mount, a);
    await click(mount, b);
    await click(mount, c);
    await click(mount, c, { detail: 2 });
    expect([draft(mount).getAttribute("data-state"), draft(mount).getAttribute("data-points")]).toEqual(["draft", "3"]);
  });

  test("Shift constrains the live segment from the last point to 0°/90°, through the snapping region's own Ortho", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "l" });
    const start = S08_SOG[0] as readonly [number, number];
    const off: readonly [number, number] = [start[0] + 5125, start[1] + 1125];
    await click(mount, start);
    await click(mount, off, { shiftKey: true });
    const second = mount.all(TESTIDS.measure.point)[1] as HTMLElement;
    expect([second.getAttribute("data-key-x"), second.getAttribute("data-key-y"), second.getAttribute("data-basis")], "the point keeps the last point's y exactly and is placed by hand").toEqual([
      quantise(off[0]),
      quantise(start[1]),
      "ENTERED",
    ]);
    expect([cell(mount).getAttribute("data-value"), cell(mount).getAttribute("data-unit")], "a 5 125-unit run at 0.001 m per unit").toEqual(["5.125", "m"]);
  });

  test("without Shift the same click is placed where the hand is", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "l" });
    const start = S08_SOG[0] as readonly [number, number];
    const off: readonly [number, number] = [start[0] + 5125, start[1] + 1125];
    await click(mount, start);
    await click(mount, off);
    const second = mount.all(TESTIDS.measure.point)[1] as HTMLElement;
    expect(second.getAttribute("data-key-y")).toBe(quantise(off[1]));
  });

  test("a pick taken in Select anchors nothing once a tool is armed: with Ortho pressed the first vertex stands where it was clicked", async () => {
    const mount = await mountMeasure();
    const start = S08_SOG[0] as readonly [number, number];
    // A free pick in Select, then Ortho, then Linear: the pick stays on the sheet for Select to return to.
    const pick: readonly [number, number] = [start[0] + 2000, start[1] - 1500];
    await click(mount, pick, { altKey: true });
    expect(mount.all(TESTIDS.viewer.snapPick)).toHaveLength(1);
    await pressOrtho(mount);
    await key(mount, { key: "l" });
    const first: readonly [number, number] = [pick[0] + 3125, pick[1] + 1875];
    await click(mount, first);
    const placed = mount.all(TESTIDS.measure.point)[0] as HTMLElement;
    expect([placed.getAttribute("data-key-x"), placed.getAttribute("data-key-y")], "never squared to the Select pick's axis").toEqual([quantise(first[0]), quantise(first[1])]);
  });

  test("path-mode snapping: a perpendicular is dropped from the path's last point, never from a pick nobody took", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "l" });
    const bottom = S08_SOG[0] as readonly [number, number];
    // A free point below the SOG's bottom edge, and the pointer near where a square run would meet it.
    const below: readonly [number, number] = [bottom[0] + 5125, bottom[1] - 875];
    await click(mount, below);
    await click(mount, [below[0] + 3, bottom[1] - 1]);
    const second = mount.all(TESTIDS.measure.point)[1] as HTMLElement;
    expect([second.getAttribute("data-key-x"), second.getAttribute("data-key-y"), second.getAttribute("data-source")], "the foot of the perpendicular on 81D's bottom edge").toEqual([
      quantise(below[0]),
      quantise(bottom[1]),
      SOG_KEY,
    ]);
  });

  test("the keyboard cursor (R-UI-060, §2.2): the arrows move the live point, snapping as a hand would, and Space places it", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "c" });
    const corner = S08_PIT[0] as readonly [number, number];
    await hover(mount, corner);
    // Ten screen pixels right with Shift: past the corner's 8 px reach, still on the pit's bottom edge.
    await key(mount, { key: "ArrowRight", shiftKey: true });
    await key(mount, { key: " " });
    const placed = mount.all(TESTIDS.measure.point);
    expect(placed).toHaveLength(1);
    const point = placed[0] as HTMLElement;
    expect([point.getAttribute("data-key-y"), point.getAttribute("data-source"), point.getAttribute("data-basis")], "a point met on 830's edge, placed from the keyboard").toEqual([quantise(corner[1]), PIT_KEY, "MEASURED"]);
    expect(Number(point.getAttribute("data-key-x")), "right of the corner the cursor started at").toBeGreaterThan(corner[0]);
  });

  test("a press dragged past the tolerance pans and places nothing", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "c" });
    await drag(mount, S08_PIT[0] as readonly [number, number], { x: 40, y: 0 });
    expect(draft(mount).getAttribute("data-points")).toBe("0");
  });

  test("Alt+click in an armed tool places and picks nothing, and says where the pick lives (I-371)", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "c" });
    await click(mount, S08_PIT[0] as readonly [number, number], { altKey: true });
    expect(draft(mount).getAttribute("data-points")).toBe("0");
    expect(mount.all(TESTIDS.viewer.snapPick), "no pick is taken").toHaveLength(0);
    expect(cell(mount).textContent).toContain(strings.measure_status_pick_in_select);
  });

  test("a tool key mid-shape never costs the outline: it is refused with 'finish first'", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "a" });
    await trace(mount, S08_SOG.slice(0, 3));
    await key(mount, { key: "l" });
    await key(mount, { key: "v" });
    expect([pressed(mount, TESTIDS.viewer.toolArea), draft(mount).getAttribute("data-points")]).toEqual(["true", "3"]);
    expect(cell(mount).textContent).toContain(strings.measure_status_finish_first);
  });

  test("M opens the measure menu: Rectangle arms, the rest of the toolset stands disabled with its reason", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "m" });
    const items = mount.all(TESTIDS.measure.menuItem);
    expect(items.map((item) => item.getAttribute("data-tool"))).toEqual(["rectangle", "cutout", "perimeter", "volume", "typical", "pitch", "layer-region", "fill", "freehand"]);
    const coming = items.slice(2);
    expect(coming.every((item) => item.getAttribute("aria-disabled") === "true" && item.getAttribute("title") === strings.measure_tool_not_yet)).toBe(true);
  });

  test("Rectangle: two opposite corners of the pit span it whole, its derived corners met on the drawing", async () => {
    const mount = await mountMeasure();
    await key(mount, { key: "m" });
    await clickItem(mount, "rectangle");
    const [a, , c] = S08_PIT as [readonly [number, number], readonly [number, number], readonly [number, number]];
    await click(mount, a);
    await click(mount, c);
    expect([draft(mount).getAttribute("data-shape"), draft(mount).getAttribute("data-state"), draft(mount).getAttribute("data-points"), draft(mount).getAttribute("data-basis")]).toEqual(["rectangle", "draft", "4", "MEASURED"]);
    expect(cell(mount).getAttribute("data-value")).toBe("8.047");
  });
});

describe("§3: the preconditions the viewer holds, said before the first click", () => {
  test("over a view with no scale of record a click places nothing, and the cell says why", async () => {
    const mount = await mountMeasure({ unscaled: true });
    await key(mount, { key: "a" });
    await click(mount, S08_SOG[0] as readonly [number, number]);
    expect(draft(mount).getAttribute("data-points")).toBe("0");
    expect(cell(mount).getAttribute("data-reason")).toBe("unscaled");
    expect(mount.screen.querySelector(".cx-viewer-stage")?.getAttribute("data-measure-refusal"), "the stage wears the not-allowed cursor's hook").toBe("unscaled");
  });

  test("a QS two-point scale on S-08's paper keeps the figure in sheet units and says why — its sheet is not recorded (I-501)", async () => {
    const mount = await mountMeasure({ paper: true, space: "unrecorded" });
    const { pit } = s08Paper();
    await key(mount, { key: "a" });
    await trace(mount, pit.points ?? []);
    await hover(mount, (pit.points ?? [])[0] as readonly [number, number]);
    const live = mount.one(TESTIDS.measure.liveFigure) as HTMLElement;
    expect([live.getAttribute("data-unit"), live.getAttribute("data-si"), live.getAttribute("data-via")]).toEqual(["du2", "unrecorded", ""]);
    expect(live.textContent).toContain(strings.measure_figure_unrecorded);
  });

  test("without MEASURE the tools stand disabled with the reason, and nothing arms", async () => {
    const mount = await mountMeasure({ denied: true });
    const area = mount.one(TESTIDS.viewer.toolArea) as HTMLButtonElement;
    await expectEventually(() => area.disabled);
    expect(area.getAttribute("title")).toBe(strings.measure_tools_permission);
    await key(mount, { key: "a" });
    expect([pressed(mount, TESTIDS.viewer.toolArea), cell(mount).getAttribute("data-reason")]).toEqual(["false", "permission"]);
  });
});

/** The snapping region's Ortho pressed, as a hand presses it. */
async function pressOrtho(mount: MeasureMount): Promise<void> {
  const { act, fireEvent } = await import("@testing-library/react");
  const ortho = mount.one(TESTIDS.viewer.snapOrtho) as HTMLElement;
  await act(async () => {
    fireEvent.click(ortho);
  });
  expect(ortho.getAttribute("aria-pressed")).toBe("true");
}

/** A menu item selected, as a hand selects one. */
async function clickItem(mount: MeasureMount, tool: string): Promise<void> {
  const { act, fireEvent } = await import("@testing-library/react");
  const item = mount.all(TESTIDS.measure.menuItem).find((entry) => entry.getAttribute("data-tool") === tool) as HTMLElement;
  await act(async () => {
    fireEvent.click(item);
  });
}

async function expectEventually(held: () => boolean): Promise<void> {
  const { waitFor } = await import("@testing-library/react");
  await waitFor(() => expect(held()).toBe(true));
}
