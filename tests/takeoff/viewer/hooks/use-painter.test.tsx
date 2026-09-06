// @vitest-environment jsdom
/**
 * The painter's life as a hook (PB-2, I-82): a browser is asked for a context exactly once, nothing
 * is claimed about it before it has been asked, and first paint is the moment a reader can see
 * everything there is to see — which, where nothing can be drawn at all, is at once.
 *
 * This document offers no WebGL, which is the case I-82 is about: the hook is judged on what it says
 * about a browser that cannot draw, not on pixels no headless DOM has.
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern. */
const USE_PAINTER_MODULE = "src/modules/takeoff/viewer/hooks/use-painter.ts";

/** The extents this sheet is framed by, and a layer to hand over. */
const EXTENTS = { min: [0, 0], max: [400, 200] };
const LAYER = { name: "GRID", rgb: [11, 22, 33], entityCount: 1, records: [] };

type PainterHook = {
  usePainter: (options: {
    head: unknown;
    canvasRef: { current: HTMLCanvasElement | null };
    stageRef: { current: HTMLElement | null };
    statusRef: { current: HTMLElement | null };
    stateRef: { current: unknown };
    cameraRef: { current: unknown };
    refused: boolean;
  }) => {
    renderer: "webgl" | "unavailable";
    probed: boolean;
    firstPaint: boolean;
    take: (layer: unknown) => void;
    draw: (camera: unknown) => void;
    pulse: (durationMs: number) => void;
  };
};

let canvas: HTMLCanvasElement;
let stage: HTMLDivElement;
let status: HTMLDivElement;

/** A head of this kind: a sheet with the roster given, an absence otherwise. */
function head(kind: "manifest" | "absent", layers: readonly unknown[] = []): unknown {
  if (kind === "absent") return { kind: "absent", reason: "not-ingested" };
  return {
    kind: "manifest",
    cache: "miss",
    facts: {},
    manifest: { version: 1, layoutName: "SHEET ONE", extents: EXTENTS, insunits: { code: 0, unit: null, unmapped: true }, digest: "sheet-one", layers },
  };
}

/** The posture a painter draws through — the painter is the subject here, not the posture. */
const state = { layerRows: () => [] };

async function mount(given: unknown, options: { attached?: boolean; refused?: boolean } = {}) {
  const { usePainter } = await productModule<PainterHook>(USE_PAINTER_MODULE);
  const attached = options.attached !== false;
  return renderHook(() =>
    usePainter({
      head: given,
      canvasRef: { current: attached ? canvas : null },
      stageRef: { current: attached ? stage : null },
      statusRef: { current: status },
      stateRef: { current: state },
      cameraRef: { current: null },
      refused: options.refused === true,
    }),
  );
}

beforeEach(() => {
  canvas = document.createElement("canvas");
  stage = document.createElement("div");
  status = document.createElement("div");
  document.body.append(stage, status);
  stage.append(canvas);
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("the painted sheet", () => {
  test("nothing is claimed about a browser that has not been asked yet (I-82)", async () => {
    const { result } = await mount(head("manifest", [LAYER]), { attached: false });

    expect(result.current.probed, "there is no canvas to ask about, so no question was put").toBe(false);
    expect(result.current.firstPaint, "and a sheet nobody has been shown is not painted").toBe(false);
  });

  test("a browser with no context is asked once, says so, and has shown everything it has", async () => {
    const { result } = await mount(head("manifest", [LAYER]));

    expect(result.current.probed, "the canvas was asked for a context").toBe(true);
    expect(result.current.renderer, "and this document has none to give (I-82)").toBe("unavailable");
    expect(result.current.firstPaint, "a sheet that cannot be drawn is not a sheet a reader waits for").toBe(true);
  });

  test("an answer with no sheet in it is painted the moment it arrives (PB-2)", async () => {
    const absent = await mount(head("absent"));
    expect(absent.result.current.firstPaint, "a drawing nobody has read has shown everything it has").toBe(true);
    cleanup();

    const refused = await mount(null, { refused: true });
    expect(refused.result.current.firstPaint, "and so has a feed that refused").toBe(true);
  });

  test("a sheet handed to a painter that does not exist is taken in silence, never as a fault", async () => {
    const { result } = await mount(head("manifest", [LAYER]));

    expect(() => {
      result.current.take(LAYER);
      result.current.draw({ centre: [0, 0], scale: 1, viewport: { width: 800, height: 600 } });
      result.current.pulse(0);
    }, "a browser that cannot draw is answered in words, not with an exception (I-82, ARCH-03)").not.toThrow();
    expect(result.current.renderer, "and nothing about it changed by being handed a layer").toBe("unavailable");
  });
});
