// @vitest-environment jsdom
/**
 * S-Viewer's tool row and readout are instruments (session 8, C3 — session 7's vision re-look of
 * F-RCC6-BNBC's S-10 COLUMN LAYOUT PLAN at 1440 × 900 and 1280 × 800, `relook-final.json`):
 *   - the readout lost its mono face: v22 U2 (2cad2aaa) dropped `font-family: var(--font-mono)` and
 *     `tabular-nums slashed-zero` from `.cx-viewer-readout`, so the scale read in the interface face
 *     and every zoom step that changed a digit's width moved every cell after it (R-UI-030);
 *   - the tool groups were mounted into the frame's slot bare: no `role="toolbar"`, no name, none of
 *     the shell row's chrome — and the panel pair, which §3.1 right-aligns, sat after the camera group;
 *   - Snap, Ortho and Angle lock stood at the Button's own 14 px and `--control-h`, not the row's 28;
 *   - the layers drawer was a share of the work area: 195 px at 1440 but 172 at 1280 (its proof is
 *     `viewer-drawer.test.ts`, which mounts the split).
 *
 * Geometry is not observable under jsdom, so the layout is proved from the declarations the viewer is
 * drawn by (`tests/support/stylesheet.ts`, the craft rubric's own reader), and the anatomy those
 * declarations select from a jsdom mount of the shipped components.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement, createRef, type ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { formatUserFigure } from "@/core/format";
import { useSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import { fill, strings } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { SnapTools } from "../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/snap-region";
import { StatusLine, type StatusLineProps } from "../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/status-line";
import { ViewerToolbar, type ViewerToolbarProps } from "../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-toolbar";
import { customProperties, customPropertyValues, declaredValue, pixelsIn } from "../../support/stylesheet";

/** The lane runs from the repository's root; a jsdom module's `import.meta.url` is no file URL. */
const REPO_ROOT = process.cwd();
// white-box: a face, a floor and an alignment are layout, which jsdom does not perform: the only
// reading of them this lane can take is the declaration the browser is handed.
const at = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

const VIEWER = at("src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer.css");
const SHELL = at("src/ui/shell/shell.css");
const GLOBALS = at("src/ui/theme/globals.css");
const TOKENS = at("src/ui/tokens.css");
/** Every value each token is declared as, for `pixelsIn` to resolve a `var()` chain through. */
const VARS = customPropertyValues(TOKENS, GLOBALS);

afterEach(() => cleanup());

/** The readout as the frame mounts it over a drawn sheet, with the snapping region's real cells. */
function Readout({ scale }: { scale: number }): ReactNode {
  const snap = useSnap({ camera: null });
  const props: StatusLineProps = {
    statusRef: createRef<HTMLDivElement>(),
    layoutName: "S-10 COLUMN LAYOUT PLAN",
    sheet: true,
    scale,
    loadedLayers: 11,
    totalLayers: 11,
    drawnEntities: 296,
    entityCount: 296,
    selectionCount: 0,
    firstPaint: true,
    renderer: "webgl",
    partial: false,
    snap,
  };
  return createElement(StatusLine, props);
}

/** The row as the frame mounts it, with the snapping region's own three toggles in their group. */
function Row({ views }: { views?: ReactNode }): ReactNode {
  const snap = useSnap({ camera: null });
  const props: ViewerToolbarProps = {
    tool: "select",
    onTool: () => undefined,
    snapTools: createElement(SnapTools, { snap }),
    onFit: () => undefined,
    onZoomIn: () => undefined,
    onZoomOut: () => undefined,
    layersOpen: true,
    onLayers: () => undefined,
    inspectorPinned: false,
    onInspector: () => undefined,
  };
  return createElement(ViewerToolbar, views === undefined ? props : { ...props, views });
}

/** The scale cell as the stylesheet selects it: the first cell after the sheet's name. */
const SCALE_CELL = ".cx-viewer-readout-sheet + .cx-viewer-readout-cell";

/** The widest reading the scale cell's measure is sized to hold whole: two whole digits (I-431). */
const SCALE_AT_TWO_DIGITS = "99.999";

describe("D3: the readout is one line of mono cells (R-UI-030, viewer.md § 1 Status line)", () => {
  test("the line is set in the mono face, with tabular, slashed figures", () => {
    expect(declaredValue(VIEWER, ".cx-viewer-readout", "font-family"), "every glyph one advance wide").toBe("var(--font-mono)");
    expect(declaredValue(VIEWER, ".cx-viewer-readout", "font-variant-numeric"), "figures of one width, a zero told from an O").toBe("tabular-nums slashed-zero");
    expect(declaredValue(VIEWER, ".cx-viewer-readout", "font-size"), "at the caption size, 12 px in both densities").toBe("var(--text-caption)");
    expect(pixelsIn("var(--text-caption)", VARS)).toEqual([12]);
  });

  test("I-431: the stylesheet's scale selector lands on the scale cell of the mounted readout", () => {
    const { container } = render(createElement(Readout, { scale: 1.289 }));
    const cell = container.querySelector(SCALE_CELL);
    expect(cell?.querySelector(".cx-viewer-readout-label")?.textContent, "the first cell after the sheet's name is the scale").toBe(strings.viewer_status_scale);
    expect(container.querySelectorAll(SCALE_CELL), "and it selects that one cell only").toHaveLength(1);
  });

  test("I-431: the scale cell's measure is its reading at two whole digits, counted in the face's own advance", () => {
    const label = strings.viewer_status_scale;
    const value = fill(strings.viewer_status_scale_value, { scale: formatUserFigure(SCALE_AT_TWO_DIGITS) });
    const advances = label.length + value.length;
    expect(declaredValue(VIEWER, ".cx-viewer-readout-cell", "gap"), "the one gap inside a cell, between its label and its value").toBe("var(--space-1)");
    expect(
      declaredValue(VIEWER, SCALE_CELL, "flex-basis"),
      `"${label}" and "${value}" are ${advances} advances, and the gap between them — recount when the copy moves`,
    ).toBe(`calc(${advances}ch + var(--space-1))`);
  });

  test("I-431: the measure is the cell's own, never its content's — and a basis the line may still take from", () => {
    expect(declaredValue(VIEWER, SCALE_CELL, "flex-grow"), "it never grows into the line").toBeNull();
    expect(declaredValue(VIEWER, SCALE_CELL, "min-width"), "no floor of its own: where the line has no room it gives way like every cell").toBeNull();
    expect(declaredValue(VIEWER, ".cx-viewer-readout-cell", "min-width"), "down to the fixed minimum every cell keeps").toBe("96px");
    expect(declaredValue(VIEWER, ".cx-viewer-readout-cell", "overflow"), "and clips there rather than pushing its neighbours").toBe("hidden");
  });

  test.each([
    { scale: 0.012, what: "a sheet in millimetres, fitted" },
    { scale: 1.289, what: "S-10 fitted at 1440 × 900" },
    { scale: 9.603, what: "ten zoom steps in" },
    { scale: 12.004, what: "the step that gains a digit" },
    { scale: 99.999, what: "the last reading of two whole digits" },
  ])("I-431: at $scale px per unit ($what) the whole reading fits the measure", ({ scale }) => {
    const { container } = render(createElement(Readout, { scale }));
    const reading = container.querySelector(SCALE_CELL)?.textContent ?? "";
    expect(reading.length, `"${reading}" takes no more than the measure's ${measureAdvances()} advances`).toBeLessThanOrEqual(measureAdvances());
  });

  test("I-431: past two whole digits the figure still fits — only the unit's last words give way", () => {
    const { container } = render(createElement(Readout, { scale: 1234.568 }));
    const value = container.querySelector(`${SCALE_CELL} .cx-viewer-readout-value`)?.textContent ?? "";
    const figure = formatUserFigure("1234.568");
    expect(value.startsWith(figure), "the figure leads the value").toBe(true);
    expect(strings.viewer_status_scale.length + figure.length, `"${figure}" stands inside the measure, beside its label`).toBeLessThan(measureAdvances());
    expect((container.querySelector(SCALE_CELL)?.textContent ?? "").length, "while the whole reading is longer than the measure").toBeGreaterThan(measureAdvances());
  });

  test("§3.1: a value the line has no room for ends in an ellipsis inside its own cell", () => {
    const value = ".cx-viewer-readout-value";
    expect(declaredValue(VIEWER, value, "min-width"), "the value may give way inside its cell").toBe("0");
    expect(declaredValue(VIEWER, value, "overflow")).toBe("hidden");
    expect(declaredValue(VIEWER, value, "text-overflow"), "and says so with an ellipsis rather than a cut glyph").toBe("ellipsis");
    expect(declaredValue(VIEWER, ".cx-viewer-readout-label", "min-width"), "the label keeps its word: a figure with no name says nothing").toBeNull();
    expect(declaredValue(VIEWER, ".cx-viewer-readout", "white-space"), "one line, never two").toBe("nowrap");
  });
});

/** The scale cell's measure, in advances, as the stylesheet states it. */
function measureAdvances(): number {
  const measure = declaredValue(VIEWER, SCALE_CELL, "flex-basis") ?? "";
  return Number(/^calc\((\d+)ch/.exec(measure)?.[1]);
}

describe("I-430: the tool row is the shell's own row, named for a reader (p8)", () => {
  test("the groups stand inside one role=toolbar named 'Sheet tools', the shell row's own element", () => {
    render(createElement(Row));
    const row = screen.getByRole("toolbar", { name: strings.viewer_tools_label });
    expect(row.getAttribute("data-testid"), "the shell row's own id, which the craft instrument measures").toBe(TESTIDS.shell.toolbar);
    expect(row.classList.contains("cx-shell-toolbar"), "wearing the shell row's chrome").toBe(true);
    expect(row.classList.contains("cx-viewer-toolbar"), "and marked as the viewer's, for the two rules that are its own").toBe(true);
    expect(
      within(row)
        .getAllByRole("group")
        .filter((group) => group.parentElement === row)
        .map((group) => group.getAttribute("aria-label")),
      "§3.1's groups, left to right",
    ).toEqual([strings.viewer_tools_pointer, strings.viewer_tools_measure, strings.viewer_snap_tools_label, strings.viewer_tools_camera, strings.viewer_tools_panels]);
  });
});

describe("I-430: the panel pair stands at the row's end (§3.1 'right-aligned L≡ V≡', p9)", () => {
  const END = ".cx-viewer-toolbar > .cx-shell-toolbar-group:last-child";

  test("the row's last group takes the free width before it", () => {
    expect(declaredValue(VIEWER, END, "margin-inline-start")).toBe("auto");
  });

  test.each([
    { views: undefined, what: "a sheet with no partition to overlay" },
    { views: createElement("span", null, "views"), what: "a sheet whose views group joins the row" },
  ])("the rule lands on the panel pair: $what", ({ views }) => {
    const { container } = render(createElement(Row, { views }));
    const end = container.querySelector(END);
    expect(end?.getAttribute("aria-label"), "the last group is the panel pair").toBe(strings.viewer_tools_panels);
    expect(end?.querySelector(`[data-testid="${TESTIDS.viewer.layersToggle}"]`), "L≡").not.toBeNull();
    expect(end?.querySelector(`[data-testid="${TESTIDS.viewer.inspectorPin}"]`), "V≡").not.toBeNull();
  });

  test("the alignment is the viewer's own: the shared row's stylesheet states none, so Coverage's row stands as it was", () => {
    expect(declaredValue(SHELL, ".cx-shell-toolbar-group", "margin-inline-start")).toBeNull();
    expect(declaredValue(SHELL, ".cx-shell-toolbar-group:last-child", "margin-inline-start")).toBeNull();
  });
});

describe("I-430: the text toggles stand at the row's 28 px (p11)", () => {
  const TEXT = ".cx-viewer-toolbar .cx-btn";

  test("Snap, Ortho and Angle lock are core Buttons inside the viewer's row, where the rule reaches them", () => {
    render(createElement(Row));
    const row = screen.getByRole("toolbar", { name: strings.viewer_tools_label });
    for (const name of [strings.viewer_snap_toggle, strings.viewer_snap_ortho, strings.viewer_snap_angle]) {
      const toggle = within(row).getByRole("button", { name });
      expect(toggle.classList.contains("cx-btn"), `${name} is the core Button`).toBe(true);
      expect(toggle.closest(".cx-viewer-toolbar"), `${name} stands in the viewer's row`).toBe(row);
    }
  });

  test("they are as tall as the row's icon buttons — the row less one step — in both densities", () => {
    const height = declaredValue(VIEWER, TEXT, "height");
    expect(height, "the same expression the shell pins its icon buttons with").toBe(declaredValue(SHELL, ".cx-shell-toolbar .cx-icon-btn", "height"));
    expect(pixelsIn(height ?? "", VARS), "28 px, whatever --control-h is").toEqual([28]);
    for (const density of ["comfortable", "compact"] as const) {
      const block = customProperties(GLOBALS, new RegExp(`\\[data-density="${density}"\\]`));
      expect(block["--toolbar-h"], `${density} does not revalue the row`).toBeUndefined();
    }
  });

  test("their words are set at the row's 13 px, with one step of inline padding", () => {
    expect(declaredValue(VIEWER, TEXT, "font-size")).toBe("var(--text-13)");
    expect(pixelsIn("var(--text-13)", VARS)).toEqual([13]);
    expect(declaredValue(VIEWER, TEXT, "padding-inline")).toBe("var(--space-2)");
  });
});
