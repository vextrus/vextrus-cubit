// @vitest-environment jsdom
/**
 * I-363 — the views/grid region as a reader meets it on F-RCC6-BNBC's S-10 COLUMN LAYOUT PLAN, at
 * both of the Direction's viewports (§7: "both viewports are measured").
 *
 * A vision re-look of session 7 found three things the earlier suites could not see, because they
 * judged the scene's geometry and never the words or the lettering:
 *   - the grid rows printed the stored double whole — `12,00,000.000000001`, `12,11,582.399999999` —
 *     each wrapping under its own family, which read as the store's lowercase key;
 *   - at 1280 × 800 every bubble was an empty ring: the label was dropped whenever the ring's RADIUS
 *     fell under 6 px, which called a 10.5 px ring illegible;
 *   - the view's type chip stood inside the box's corner, where the plan draws its first axis, and
 *     that axis's bubble — painted after it — cut its words to "Layout(1)plan".
 *
 * The shapes are S-10's own, from its feed (the ones `overlay-sheet.test.ts` reads), and every screen
 * quantity comes from the viewer's own `fitCamera` at the stage each viewport gives the sheet. The
 * paint is judged on a recording 2D context: what it was asked to letter, at what size, and in what
 * order — never a picture.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { formatUserFigure } from "../../../src/core/format";
import { LEGIBLE_TEXT_PX, fitCamera } from "../../../src/modules/takeoff/viewer/client";
import { drawOverlayScene } from "../../../src/modules/takeoff/viewer-partition-overlay/paint";
import { PartitionPanel } from "../../../src/modules/takeoff/viewer-partition-overlay/partition-panel";
import { overlayScene } from "../../../src/modules/takeoff/viewer-partition-overlay/scene";
import type { OverlayPalette, PartitionOverlay, PartitionOverlayAxis, PartitionOverlayView } from "../../../src/modules/takeoff/viewer-partition-overlay/types";
import { EnumLabel, IdChip } from "../../../src/ui/primitives/core";
import { humaniseEnum } from "../../../src/ui/primitives/core/enum-label";
import { viewerPartition } from "../../../src/ui/strings/viewer-partition";
import { TESTIDS } from "../../../src/ui/testids";

/** S-10's drawn extents on its A1 paper. */
const S10_EXTENTS = { min: [10, 10] as const, max: [831, 584] as const };

/**
 * The stage the sheet is fitted into, per viewport: the canvas's own box as the craft capture measured
 * it before I-362 (1190 × 756 and 1052 × 656), and as the frame gives it once it reaches the readout
 * (48 px taller). The smallest of them is the one the bubbles went blank at.
 */
const STAGES = [
  { name: "1440 × 900", width: 1190, height: 804 },
  { name: "1280 × 800", width: 1052, height: 704 },
  { name: "1280 × 800, before I-362", width: 1052, height: 656 },
] as const;

/** The on-sheet view, its paper box, and the ring radius every S-10 bubble has on the paper. */
const PLAN = "LAYOUT_PLAN:DXF_HANDLE:20B6";
const PLAN_BOX = { min: [133.892, 180.752] as const, max: [402.108, 420.788] as const };
const RING = 5.0006;

/** One stored axis in the feed's shape, with the noisy double the grid stage stored for it. */
function axis(label: string, along: "x" | "y", position: number, centre: readonly [number, number]): PartitionOverlayAxis {
  return {
    viewKey: PLAN,
    label,
    family: along === "x" ? "numeral" : "letter",
    axis: along,
    position,
    bubbleKey: `DXF_HANDLE:${PLAN}-${label}`,
    labelKey: `DXF_HANDLE:${PLAN}-${label}-t`,
    minSpacing: 2743.2,
    bubble: { centre, radius: RING },
  } as unknown as PartitionOverlayAxis;
}

/** S-10's plan: numerals 1–4 as stored (the doubles the capture printed), letter A beside them. */
function s10(): PartitionOverlay {
  const view = { viewKey: PLAN, type: "LAYOUT_PLAN", reason: null, caption: "COLUMN LAYOUT PLAN", anchorKey: null, proposed: null, confirmed: null, entityCount: 93, box: PLAN_BOX } as unknown as PartitionOverlayView;
  return {
    ingestId: "11111111-1111-4111-8111-111111111111",
    views: [view],
    axes: [
      axis("1", "x", 1_200_000.000000001, [175.892, 408.248]),
      axis("2", "x", 1_204_572.0000000014, [218.892, 408.248]),
      axis("3", "x", 1_208_839.2000000004, [258.892, 408.248]),
      axis("4", "x", 1_211_582.399999999, [284.892, 408.248]),
      axis("A", "y", -400_000.00000000006, [148.892, 222.752]),
    ],
    deferrals: [],
  } as unknown as PartitionOverlay;
}

/** The palette the screen reads from tokens — here, names that say which token each stroke took. */
const PALETTE: OverlayPalette = { ink: "ink", warn: "warn", paper: "paper", label: "label", mono: "mono", typeSizePx: 12, labelSizePx: 12 };

/** One call a recording context was asked to make, with the font in force when it was made. */
type Call = { readonly name: string; readonly args: readonly unknown[]; readonly font: string };

/**
 * A 2D context that records. `measureText` answers a monospace advance of 0.6 em — the width the
 * product's mono face sets a digit in — so a fit is judged against a width the rule would really meet.
 */
function recordingContext(): { context: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state = { font: "", fillStyle: "", strokeStyle: "", lineWidth: 1, textAlign: "", textBaseline: "" };
  const saved: (typeof state)[] = [];
  const target = {
    canvas: { width: 1440, height: 900 },
    save: () => saved.push({ ...state }),
    restore: () => Object.assign(state, saved.pop() ?? state),
    measureText: (text: string) => ({ width: text.length * 0.6 * Number.parseFloat(state.font) }),
    setLineDash: () => undefined,
  };
  const context = new Proxy(target, {
    get(held, key: string) {
      if (key in held) return (held as Record<string, unknown>)[key];
      if (key in state) return (state as Record<string, unknown>)[key];
      return (...args: unknown[]) => calls.push({ name: key, args, font: state.font });
    },
    set(_held, key: string, value: unknown) {
      (state as Record<string, unknown>)[key] = value;
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

/** The frame the overlay paints on S-10 at one stage, as the calls it made. */
function paintAt(stage: { width: number; height: number }, zoom = 1): Call[] {
  const fitted = fitCamera(S10_EXTENTS, stage);
  const camera = { ...fitted, scale: fitted.scale * zoom };
  const scene = overlayScene(s10(), { views: true, grid: true }, camera, undefined, new Map([["LAYOUT_PLAN", humaniseEnum("LAYOUT_PLAN")]]));
  const { context, calls } = recordingContext();
  drawOverlayScene(context, scene, PALETTE, stage);
  return calls;
}

/** The px size a recorded call's font stated. */
const sizeOf = (call: Call): number => Number.parseFloat(call.font);

afterEach(() => cleanup());

describe("I-363: a bubble is lettered wherever its ring can hold a legible label", () => {
  for (const stage of STAGES) {
    test(`I-363: at ${stage.name} every one of S-10's bubbles carries its label, at a legible size that fits its ring`, () => {
      const camera = fitCamera(S10_EXTENTS, stage);
      const diameter = RING * 2 * camera.scale;
      const lettered = paintAt(stage).filter((call) => call.name === "fillText" && s10().axes.some((row) => row.label === call.args[0]));
      expect(
        lettered.map((call) => call.args[0]),
        `a ${diameter.toFixed(1)} px ring is not "below 6 px": every bubble names its axis`,
      ).toEqual(s10().axes.map((row) => row.label));
      for (const call of lettered) {
        expect(sizeOf(call), `${String(call.args[0])} is lettered no smaller than the sheet's own legible floor`).toBeGreaterThanOrEqual(LEGIBLE_TEXT_PX);
        expect(sizeOf(call), `${String(call.args[0])} is lettered no larger than the ring is across, nor than --text-12`).toBeLessThanOrEqual(Math.min(PALETTE.labelSizePx, diameter));
      }
    });
  }

  test("I-363: at 1440 × 900, where the ring has room for it, the label is the --text-12 value it always was", () => {
    const lettered = paintAt(STAGES[0]).filter((call) => call.name === "fillText" && call.args[0] === "1");
    expect(lettered.map(sizeOf), "a ring 12 px across and more letters at the type's own size").toEqual([PALETTE.labelSizePx]);
  });

  test("I-363: a ring too small to hold a legible label still draws, unlettered — the georeference is the fact", () => {
    // Zoomed out until S-10's rings stand under LEGIBLE_TEXT_PX across.
    const stage = STAGES[1];
    const zoom = (LEGIBLE_TEXT_PX * 0.9) / (RING * 2 * fitCamera(S10_EXTENTS, stage).scale);
    const calls = paintAt(stage, zoom);
    expect(calls.filter((call) => call.name === "arc").length, "every ring is still drawn").toBe(s10().axes.length);
    expect(
      calls.filter((call) => call.name === "fillText" && s10().axes.some((row) => row.label === call.args[0])).length,
      "and none is lettered below the sheet's own floor — never drawn smaller than it can be read",
    ).toBe(0);
  });
});

describe("I-363: the view's type chip stands outside its box, over the axes' overrun and under no bubble", () => {
  for (const stage of STAGES) {
    test(`I-363: at ${stage.name} the chip's foot is the box's top edge, and it is painted after every axis`, () => {
      const camera = fitCamera(S10_EXTENTS, stage);
      const scene = overlayScene(s10(), { views: true, grid: true }, camera);
      const rect = (scene.outlines[0] as (typeof scene.outlines)[number]).rect;
      const calls = paintAt(stage);
      const words = humaniseEnum("LAYOUT_PLAN");
      const chipText = calls.findIndex((call) => call.name === "fillText" && call.args[0] === words);
      const chip = calls.slice(0, chipText).filter((call) => call.name === "fillRect").at(-1);
      expect(chip, "the chip is drawn").toBeDefined();
      const [x, y, , height] = (chip as Call).args as number[];
      expect(x, "at the box's left edge").toBeCloseTo(rect.x, 6);
      expect((y as number) + (height as number), "standing on the box's top edge, from outside it").toBeCloseTo(rect.y, 6);
      const lastBubble = calls.map((call, at) => (call.name === "fillText" && call.args[0] !== words ? at : -1)).reduce((last, at) => Math.max(last, at), -1);
      expect(chipText, "the chip's words come after every bubble's, so no axis is painted across them").toBeGreaterThan(lastBubble);
    });
  }

  test("I-363: a box whose top is the canvas's own top keeps its chip inside the corner, where it can be seen", () => {
    const stage = STAGES[1];
    const fitted = fitCamera(S10_EXTENTS, stage);
    // Centre the camera so the plan's top edge stands a few pixels under the canvas's top.
    const camera = { ...fitted, centre: [fitted.centre[0], PLAN_BOX.max[1] - (stage.height / 2 - 4) / fitted.scale] as [number, number] };
    const scene = overlayScene(s10(), { views: true, grid: false }, camera, undefined, new Map([["LAYOUT_PLAN", humaniseEnum("LAYOUT_PLAN")]]));
    const rect = (scene.outlines[0] as (typeof scene.outlines)[number]).rect;
    const { context, calls } = recordingContext();
    drawOverlayScene(context, scene, PALETTE, stage);
    const chip = calls.filter((call) => call.name === "fillRect").at(-1) as Call;
    expect(chip.args[1], "no room above: the chip stands at the box's own top").toBeCloseTo(rect.y, 6);
  });
});

describe("I-363: a grid row states its position on L-REG-04's lattice, on one line, its family in words", () => {
  function mount(): HTMLElement {
    render(
      <PartitionPanel
        state="ready"
        overlay={s10()}
        toggles={{ views: true, grid: true }}
        onToggle={() => undefined}
        onRetry={() => undefined}
        faultId={null}
        groups={null}
        answer={null}
        testIds={{ room: TESTIDS.viewer.partitionRoom, roomsToggle: TESTIDS.viewer.partitionRoomsToggle }}
        IdChip={IdChip}
        EnumLabel={EnumLabel}
        humaniseEnum={humaniseEnum}
      />,
    );
    return screen.getByTestId(TESTIDS.viewer.partition);
  }

  test("I-363: S-10's positions read at 0.1 drawing unit, grouped — not the stored doubles' binary noise", () => {
    const rows = within(mount()).getAllByTestId(TESTIDS.viewer.partitionAxis);
    const stated = rows.map((row) => row.querySelector(".cx-viewer-partition-figure")?.textContent);
    expect(stated, "each figure is the lattice point the placement keys use, through the figure seam").toEqual([
      formatUserFigure("1200000.0"),
      formatUserFigure("1204572.0"),
      formatUserFigure("1208839.2"),
      formatUserFigure("1211582.4"),
      formatUserFigure("-400000.0"),
    ]);
    for (const row of rows) {
      expect(row.textContent, `${row.getAttribute("data-label")} prints no run of float noise`).not.toMatch(/\d\.\d{4,}/);
    }
  });

  test("I-363: the exact stored value is kept whole on data-position, spelled as a decimal", () => {
    const rows = within(mount()).getAllByTestId(TESTIDS.viewer.partitionAxis);
    expect(rows.map((row) => Number(row.getAttribute("data-position"))), "the machine's attribute carries the stored double").toEqual(s10().axes.map((row) => row.position));
    for (const row of rows) expect(row.getAttribute("data-position"), "never an exponent").not.toMatch(/e/i);
  });

  test("I-363: the family is said through the one EnumLabel, the stored spelling kept on the row", () => {
    const rows = within(mount()).getAllByTestId(TESTIDS.viewer.partitionAxis);
    for (const row of rows) {
      const stored = row.getAttribute("data-family") as string;
      const label = row.querySelector(".cx-enum-label");
      expect(label?.getAttribute("data-value"), `${stored} renders through EnumLabel`).toBe(stored);
      expect(label?.firstChild?.textContent, `${stored} is said in words`).toBe(humaniseEnum(stored));
    }
  });

  test("I-363: the three tokens stand on one line that does not wrap, and the hidden sentence says the stated figure", () => {
    const rows = within(mount()).getAllByTestId(TESTIDS.viewer.partitionAxis);
    for (const row of rows) {
      expect(row.querySelectorAll(".cx-viewer-partition-axis-line").length, "one line holds label, family and position").toBe(1);
      const figure = row.querySelector(".cx-viewer-partition-figure")?.textContent ?? "";
      expect(row.querySelector(".cx-viewer-hidden")?.textContent, "the sentence read aloud carries the same stated figure").toBe(
        viewerPartition.viewer_partition_axis_reading
          .replace("{label}", row.getAttribute("data-label") ?? "")
          .replace("{family}", row.getAttribute("data-family") ?? "")
          .replace("{position}", figure),
      );
    }
  });
});
