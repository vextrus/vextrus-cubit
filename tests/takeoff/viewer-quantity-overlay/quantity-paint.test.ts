/**
 * viewer.md Part 6 § 1 — the third canvas's paint: basis by colour AND glyph (R-TO-015, R-UI-002),
 * the condition by its colour AND its hatch (R-UI-060), and the unmeasured hatched in the warn token
 * and never filled (L-QTY-07).
 *
 * The context is a recorder: every call and every style in force at it, so what is painted is read
 * as calls rather than as pixels. The palette's values are opaque names, never colours — the paint's
 * only job is to put each one where the Decision says.
 */
import { describe, expect, test } from "vitest";
import { drawQuantityScene } from "../../../src/modules/takeoff/viewer-quantity-overlay/paint";
import type { QuantityFill, QuantityPalette } from "../../../src/modules/takeoff/viewer-quantity-overlay/types";
import { CONDITION_COLOURS } from "../../../src/core/manual/law";
import { QUANTITY_BASES } from "../../../src/core/offers/law";

type Call = { name: string; args: unknown[]; fillStyle: unknown; strokeStyle: unknown; alpha: unknown; dash: unknown };

/** A 2D context that records what is drawn, with the styles in force at each call. */
function recorder(): { context: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const state: Record<string, unknown> = { fillStyle: "", strokeStyle: "", globalAlpha: 1, lineWidth: 1, font: "", textAlign: "", textBaseline: "" };
  let dash: number[] = [];
  const saved: { state: Record<string, unknown>; dash: number[] }[] = [];
  const target: Record<string, unknown> = { canvas: { width: 400, height: 300 } };
  const context = new Proxy(target, {
    get(_, name: string) {
      if (name in target) return target[name];
      if (name in state) return state[name];
      return (...args: unknown[]) => {
        if (name === "setLineDash") dash = [...(args[0] as number[])];
        if (name === "save") saved.push({ state: { ...state }, dash: [...dash] });
        if (name === "restore") {
          const back = saved.pop();
          if (back !== undefined) {
            Object.assign(state, back.state);
            dash = back.dash;
          }
        }
        calls.push({ name, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, alpha: state.globalAlpha, dash: [...dash] });
        return name === "measureText" ? { width: 8 } : undefined;
      };
    },
    set(_, name: string, value) {
      state[name] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { context, calls };
}

const PALETTE: QuantityPalette = {
  condition: Object.fromEntries(CONDITION_COLOURS.map((colour) => [colour, `condition-${colour}`])) as QuantityPalette["condition"],
  basis: Object.fromEntries(QUANTITY_BASES.map((basis) => [basis, `basis-${basis}`])) as QuantityPalette["basis"],
  glyph: Object.fromEntries(QUANTITY_BASES.map((basis) => [basis, `glyph-${basis}`])) as QuantityPalette["glyph"],
  warn: "warn",
  paper: "paper",
  mono: "mono",
  glyphSizePx: 12,
};

function fill(over: Partial<QuantityFill>): QuantityFill {
  return { key: "C1", colour: "column", hatch: "solid", rings: [], rect: { x: 10, y: 10, width: 60, height: 40 }, basis: "DERIVED", unmeasured: false, ...over };
}

describe("the quantity canvas's paint", () => {
  test("a measured member is tinted in its condition, outlined in its basis colour and wears its basis glyph", () => {
    const { context, calls } = recorder();
    drawQuantityScene(context, { fills: [fill({})] }, PALETTE);
    const tint = calls.find((call) => call.name === "fill");
    expect(tint?.fillStyle, "the tint is the condition's colour").toBe("condition-column");
    expect(Number(tint?.alpha), "and only a tint: the linework reads through it").toBeLessThan(1);
    expect(calls.some((call) => call.name === "stroke" && call.strokeStyle === "basis-DERIVED"), "the outline says the basis in colour").toBe(true);
    const glyph = calls.find((call) => call.name === "fillText");
    expect(glyph?.args[0], "and by glyph (R-UI-002)").toBe("glyph-DERIVED");
    expect(glyph?.fillStyle).toBe("basis-DERIVED");
  });

  test("a condition with a hatch is hatched in its own colour over the tint — colour is never the only channel", () => {
    const { context, calls } = recorder();
    drawQuantityScene(context, { fills: [fill({ colour: "beam", hatch: "diagonal" })] }, PALETTE);
    expect(calls.filter((call) => call.name === "lineTo" && call.strokeStyle === "condition-beam").length, "the diagonal hatch is stroked in the condition's colour").toBeGreaterThan(0);
  });

  test("a member seen and not billed is never filled: it is hatched in warn with a dashed outline, and wears no glyph", () => {
    const { context, calls } = recorder();
    drawQuantityScene(context, { fills: [fill({ basis: null, unmeasured: true })] }, PALETTE);
    expect(calls.filter((call) => call.name === "fill"), "no tint on what was not billed (L-QTY-07)").toEqual([]);
    const strokes = calls.filter((call) => call.name === "stroke");
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.every((call) => call.strokeStyle === "warn"), "every stroke is the warn token").toBe(true);
    expect(strokes.some((call) => Array.isArray(call.dash) && (call.dash as number[]).length > 0), "the outline is dashed").toBe(true);
    expect(calls.some((call) => call.name === "fillText"), "no glyph: there is no basis to key").toBe(false);
  });

  test("a member too small to hold a legible glyph keeps its outline and loses only the glyph", () => {
    const { context, calls } = recorder();
    drawQuantityScene(context, { fills: [fill({ rect: { x: 0, y: 0, width: 8, height: 8 } })] }, PALETTE);
    expect(calls.some((call) => call.name === "stroke" && call.strokeStyle === "basis-DERIVED")).toBe(true);
    expect(calls.some((call) => call.name === "fillText")).toBe(false);
  });

  test("a member whose outline carries its rings is painted along them, not its box", () => {
    const { context, calls } = recorder();
    drawQuantityScene(context, { fills: [fill({ rings: [[[1, 1], [9, 1], [9, 9], [1, 9]]] })] }, PALETTE);
    expect(calls.some((call) => call.name === "moveTo" && (call.args as number[])[0] === 1 && (call.args as number[])[1] === 1)).toBe(true);
    expect(calls.some((call) => call.name === "rect"), "no box is traced where the rings stand").toBe(false);
  });
});
