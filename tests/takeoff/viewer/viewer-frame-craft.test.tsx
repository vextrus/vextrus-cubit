// @vitest-environment jsdom
/**
 * I-361 and I-362 — S-Viewer's frame and its layers list, as a vision re-look of session 7 found them
 * on F-RCC6-BNBC's S-10 COLUMN LAYOUT PLAN at 1440 × 900 and 1280 × 800:
 *   - no layer was named on screen: each row's three controls stood in the flow at `opacity: 0`, took
 *     ~130 px of a 170–200 px drawer, and squeezed the name (`flex: 1; min-width: 0`) to nothing, so
 *     the list read as eleven bare counts;
 *   - the frame stopped 48 px short of the readout: `.cx-viewer` bled shell-main's padding away with a
 *     negative margin but kept `height: 100%` of the CONTENT box, losing both paddings;
 *   - the drawer's edge was two rules 4 px apart: the column's own border beside the handle's line.
 *
 * The geometry is proved from the stylesheets the frame is drawn by (`tests/support/stylesheet.ts`, the
 * craft rubric's own reader) and the row's anatomy from a jsdom mount of the shipped panel. A layout
 * engine is not what is judged here — the declarations that decide the layout are.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LayersPanel } from "../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/layers-panel";
import type { LayerRow } from "../../../src/modules/takeoff/viewer/client";
import { TESTIDS } from "../../../src/ui/testids";
import { declaredValue, withoutComments } from "../../support/stylesheet";

/** The lane runs from the repository's root; a jsdom module's `import.meta.url` is no file URL. */
const REPO_ROOT = process.cwd();
const at = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

const VIEWER = at("src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer.css");
const SHELL = at("src/ui/shell/shell.css");
const DATA = at("src/ui/primitives/data/data.css");

/** Every declaration of one property across every rule of a sheet whose selector names a class. */
function declarationsNaming(css: string, className: string, prop: string): string[] {
  const out: string[] = [];
  for (const match of withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] as string).trim();
    if (!new RegExp(`\\.${className}(?![\\w-])`).test(selector)) continue;
    for (const decl of (match[2] as string).matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
      if (decl[1] === prop) out.push(`${selector} { ${prop}: ${(decl[2] as string).trim()} }`);
    }
  }
  return out;
}

/**
 * What one exact selector is given for one property, wherever it stands — alone or in a selector list
 * (`declaredValue` reads a rule by its whole selector text, so a list is read here, member by member).
 */
function valueFor(css: string, selector: string, prop: string): string | null {
  let found: string | null = null;
  for (const match of withoutComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const members = (match[1] as string).split(",").map((one) => one.trim());
    if (!members.includes(selector)) continue;
    for (const decl of (match[2] as string).matchAll(/([a-z-]+)\s*:\s*([^;]+);/g)) {
      if (decl[1] === prop) found = (decl[2] as string).trim();
    }
  }
  return found;
}

/** S-10's layers, by the names its drawing gives them. */
const NAMES = ["S-BEAM", "S-COL", "S-TEXT2", "S-GRID"] as const;

function rows(overrides: Partial<Record<(typeof NAMES)[number], Partial<LayerRow>>> = {}): LayerRow[] {
  return NAMES.map((name, index) => ({
    name,
    rgb: [255, 255, 255] as const,
    entityCount: [21, 65, 5, 31][index] as number,
    visible: true,
    drawn: true,
    locked: false,
    isolated: false,
    failed: false,
    ...overrides[name],
  }));
}

function mount(layerRows: LayerRow[]): HTMLElement {
  render(<LayersPanel rows={layerRows} onVisible={() => undefined} onIsolate={() => undefined} onLock={() => undefined} onRetry={() => undefined} onSelectLayer={() => undefined} />);
  return screen.getByTestId(TESTIDS.viewer.layers);
}

afterEach(() => cleanup());

describe("I-362: the frame is shell-main's padding box, and each edge is one seam", () => {
  test("I-362: the height the frame states grows by exactly the two paddings its margin bleeds", () => {
    const padding = declaredValue(SHELL, ".cx-shell-main", "padding");
    expect(padding, "shell-main is padded by one token on every side").toBe("var(--space-6)");
    expect(declaredValue(VIEWER, ".cx-viewer", "margin"), "the frame bleeds that padding away on every side").toBe(`calc(${padding} * -1)`);
    expect(
      declaredValue(VIEWER, ".cx-viewer", "height"),
      "and its height is the content box PLUS both paddings — 100 % alone left the canvas 48 px above the readout",
    ).toBe(`calc(100% + ${padding} * 2)`);
  });

  test("I-362: the route's own bones take the frame's height, not a content-box 100 %", () => {
    expect(valueFor(VIEWER, ".cx-viewer-loading", "height"), "the in-frame bones fill the work area").toBe("100%");
    expect(declarationsNaming(VIEWER, "cx-viewer-bones", "height"), "and nothing gives the route's bones — which wear .cx-viewer — a height of their own").toEqual([]);
  });

  test("I-362: the drawer's edge is the handle's one line — the column draws no border of its own there", () => {
    expect(declarationsNaming(VIEWER, "cx-viewer-left-stack", "border-inline-end"), "the left column states no inline-end border").toEqual([]);
    expect(declarationsNaming(VIEWER, "cx-viewer-left-stack", "border"), "nor a whole border").toEqual([]);
    expect(declaredValue(DATA, ".cx-resizable-line", "width"), "the handle beside it draws the seam, one pixel wide").toBe("1px");
  });
});

describe("I-361: a layer row is its switch, its name and its count", () => {
  test("I-361: every layer is named on screen — the name keeps an eight-character floor and ellipsises past it", () => {
    const panel = mount(rows());
    expect(
      within(panel)
        .getAllByTestId(TESTIDS.viewer.layerRow)
        .map((row) => row.querySelector(".cx-viewer-layer-name")?.textContent),
      "each row carries its layer's name verbatim",
    ).toEqual([...NAMES]);
    expect(declaredValue(VIEWER, ".cx-viewer-layer-name", "min-width"), "never zero wide (R-UI-083)").toBe("8ch");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-name", "text-overflow"), "an ellipsis past the floor").toBe("ellipsis");
  });

  test("I-361: the three controls stand in one group out of the row's flow, so they take none of the name's width", () => {
    const panel = mount(rows());
    for (const row of within(panel).getAllByTestId(TESTIDS.viewer.layerRow)) {
      const group = row.querySelector(".cx-viewer-layer-controls");
      expect(group?.parentElement, `${row.getAttribute("data-layer")}: the group is the row's own child`).toBe(row);
      for (const id of [TESTIDS.viewer.layerIsolate, TESTIDS.viewer.layerLock, TESTIDS.viewer.layerSelect]) {
        expect(group?.contains(within(row).getByTestId(id)), `${row.getAttribute("data-layer")}: ${id} stands in the group`).toBe(true);
      }
      expect(
        [...row.children].filter((child) => child !== group).map((child) => child.className.split(" ")[0]),
        `${row.getAttribute("data-layer")}: in the flow, the row is its switch, its name and its count`,
      ).toEqual(["cx-viewer-layer-switch", "cx-viewer-layer-name", "cx-viewer-layer-count"]);
    }
    expect(declaredValue(VIEWER, ".cx-viewer-layer-row", "position"), "the row is what the group is positioned against").toBe("relative");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-controls", "position"), "the group is out of the flow").toBe("absolute");
  });

  test("I-361: revealed, the controls never stand over the switch — the group starts where the switch ends", () => {
    const start = declaredValue(VIEWER, ".cx-viewer-layer-row", "padding-inline")?.split(/\s+/)[0];
    const switchWidth = declaredValue(VIEWER, ".cx-viewer-layer-switch", "width");
    expect(start, "the row's start inset is one token").toBe("var(--space-1)");
    expect(switchWidth, "and the switch one token wide").toBe("var(--space-6)");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-controls", "inset-inline"), "the group spans from the switch's end to the row's end").toBe(`calc(${start} + ${switchWidth}) 0`);
    expect(declaredValue(VIEWER, ".cx-viewer-layer-control", "min-width"), "in a drawer too narrow for all three, the controls give way rather than spill").toBe("0");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-control-label", "text-overflow"), "each behind an ellipsis on its label, the control's own box unclipped for the reticle").toBe("ellipsis");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-control", "overflow"), "the control itself never clips — the focus reticle draws 4 px outside it").toBeNull();
  });

  test("I-361: the controls are revealed by the row's own posture, and never removed from the tab order", () => {
    expect(declaredValue(VIEWER, ".cx-viewer-layer-controls", "opacity"), "transparent at rest").toBe("0");
    const revealed = withoutComments(VIEWER);
    expect(revealed, "a hovered row reveals them").toMatch(/\.cx-viewer-layer-row:hover \.cx-viewer-layer-controls/);
    expect(revealed, "and so does a row the keyboard is inside").toMatch(/\.cx-viewer-layer-row\[data-active="true"\] \.cx-viewer-layer-controls/);
    for (const className of ["cx-viewer-layer-controls", "cx-viewer-layer-control"]) {
      expect(declarationsNaming(VIEWER, className, "display").filter((decl) => decl.includes("none")), `${className} is never display: none`).toEqual([]);
      expect(declarationsNaming(VIEWER, className, "visibility"), `${className} is never hidden from the keyboard`).toEqual([]);
    }
    const panel = mount(rows());
    for (const button of within(panel).getAllByTestId(TESTIDS.viewer.layerIsolate)) expect(button.tabIndex, "every control is a tab stop").toBe(0);
  });

  test("I-361: the switch is a 24 px target around its 10 px swatch", () => {
    expect(declaredValue(VIEWER, ".cx-viewer-layer-switch", "width")).toBe("var(--space-6)");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-switch", "height")).toBe("var(--space-6)");
    expect(declaredValue(VIEWER, ".cx-viewer-layer-swatch", "width"), "the swatch keeps its closed-set 10 px").toBe("10px");
  });

  test("I-361: an isolated layer's row says so at rest, and the rows its isolation stopped drawing read muted", () => {
    const panel = mount(rows({ "S-COL": { isolated: true }, "S-BEAM": { drawn: false }, "S-TEXT2": { drawn: false }, "S-GRID": { drawn: false } }));
    const isolated = within(panel)
      .getAllByTestId(TESTIDS.viewer.layerRow)
      .filter((row) => row.getAttribute("data-isolated") === "true");
    expect(isolated.map((row) => row.getAttribute("data-layer")), "the row carries the posture the stylesheet paints").toEqual(["S-COL"]);
    expect(valueFor(VIEWER, '.cx-viewer-layer-row[data-isolated="true"]', "background"), "on the pressed paint's fill").toBe("var(--accent-subtle)");
    expect(valueFor(VIEWER, '.cx-viewer-layer-row[data-drawn="false"] .cx-viewer-layer-name', "color"), "every row left undrawn reads muted").toBe("var(--ink-muted)");
  });
});
