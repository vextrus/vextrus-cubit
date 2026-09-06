// @vitest-environment jsdom
/**
 * The painted sheet as a hook (Decision § 5/§ 6, PB-2): a browser is asked for a context once and
 * what it answered is said plainly, and "first paint" is what a reader can actually see — a refusal,
 * an absence and a browser with no WebGL are all on screen the moment they are known, while a sheet
 * that can be drawn waits for geometry rather than claiming the blank paper as a painting.
 *
 * jsdom answers no WebGL context, which is exactly the browser I-82 rules for, so this mount grades
 * that leg for real rather than through a stand-in painter.
 */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ViewerHead } from "../../../../src/modules/takeoff/viewer/types";
import { usePainter } from "../../../../src/modules/takeoff/viewer/hooks/use-painter";
import { layerOf, sheetHead } from "./hook-support";

/** A sheet with geometry to paint, and one whose roster holds nothing at all. */
const head = sheetHead([layerOf("GRID")]);
const emptySheet = sheetHead([]);

/** The canvas and the stage the painter is made over, as the screen hands them in. */
function surfaces() {
  const canvas = document.createElement("canvas");
  const stage = document.createElement("div");
  document.body.append(stage);
  stage.append(canvas);
  return { canvasRef: { current: canvas }, stageRef: { current: stage } };
}

function mount(sheet: ViewerHead | null, refused = false) {
  return renderHook(() => usePainter({ head: sheet, refused, ...surfaces() }));
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("usePainter: what the browser answered, and when a reader has seen everything", () => {
  test("a browser with no WebGL context is probed once and said so, and the sheet stops waiting (I-82)", () => {
    const { result } = mount(head);

    expect(result.current.probed, "the browser has been asked").toBe(true);
    expect(result.current.renderer, "and what it answered is said plainly, never guessed at").toBe("unavailable");
    expect(result.current.firstPaint, "a sheet that can never be drawn has shown everything it has").toBe(true);
  });

  test("nothing is claimed of a browser nobody has asked yet", () => {
    // No canvas and no stage: the painter is never made, so no context was ever asked for.
    const { result } = renderHook(() => usePainter({ head }));

    expect(result.current.probed, "a sheet with nowhere to draw has asked the browser nothing").toBe(false);
    expect(result.current.renderer, "and claims no renderer on its behalf").toBe("unavailable");
    expect(result.current.firstPaint, "and has not painted").toBe(false);
  });

  test("a head that is not a manifest is on screen the moment it answers (PB-2)", () => {
    const absent = mount({ kind: "absent", reason: "not-ingested" });
    expect(absent.result.current.firstPaint, "a drawing nobody has read shows everything it has at once").toBe(true);

    cleanup();
    const denied = mount(null, true);
    expect(denied.result.current.firstPaint, "and so does a door that refused this reader").toBe(true);
  });

  test("a sheet whose roster holds nothing has nothing left to wait for", () => {
    const { result } = mount(emptySheet);

    expect(result.current.probed, "the browser was still asked").toBe(true);
    expect(result.current.firstPaint, "an empty roster has arrived in full the moment it is read").toBe(true);
  });
});
