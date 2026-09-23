// @vitest-environment jsdom
/**
 * I-432 — S-Viewer's layers drawer is the Decision's 200 px (min 160, max 320, "remembered": § 1's
 * frame table), as session 7's vision re-look found it wanting on F-RCC6-BNBC's S-10 (p10):
 *   - it was a share of the work area (14 / 11.5 / 23 %): 195 px at 1440 but 172 at 1280, and 131 px
 *     once the inspector was pinned, under its own minimum;
 *   - the remembered split stored EVERY layout the library committed, its own included: the layout a
 *     sheet opened at, and the share a pixel-sized drawer is re-given when the inspector opens beside
 *     the split. The next mount prefers a stored share over the panel's default, so a drawer nobody
 *     dragged opened at 200, 230 or 260 px depending on whether the inspector was open when the reader
 *     last left a sheet (session 8's adversarial review, reproduced on the pinned 4.13.2).
 *
 * jsdom performs no layout, so the split's geometry is not observable here. What decides it is: the
 * sizes the screen hands the drawer's panel, and what the remembered split stores and hands back. The
 * shipped `ViewerStage` and `ResizablePanelGroup` are mounted with the library's real
 * `useDefaultLayout`; only its three components are replaced by recorders of the props they are
 * given, which is the whole contract between this product and the library.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { createElement, createRef, type ReactNode } from "react";
import type { Layout, LayoutChangedMeta } from "react-resizable-panels";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { UsePointer } from "@/modules/takeoff/viewer/hooks/use-pointer";
import type { UseSnap } from "@/modules/takeoff/viewer-snap/use-snap";
import type { LayersPanelProps } from "../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/layers-panel";
import { DRAWER_SIZE, ViewerStage, type ViewerStageProps } from "../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-stage";
import { customProperties, pixelsIn } from "../../support/stylesheet";

/** Every props object the library's components were handed, in render order. */
const handed = vi.hoisted(() => ({ groups: [] as Record<string, unknown>[], panels: [] as Record<string, unknown>[] }));

vi.mock("react-resizable-panels", async (importOriginal) => {
  const library = await importOriginal<typeof import("react-resizable-panels")>();
  return {
    ...library,
    Group: (props: Record<string, unknown> & { children?: ReactNode }) => {
      handed.groups.push(props);
      return props.children ?? null;
    },
    // A panel's contents are the sheet, its layers and its overlays: none of them is under test.
    Panel: (props: Record<string, unknown>) => {
      handed.panels.push(props);
      return null;
    },
    Separator: () => null,
  };
});

/** The lane runs from the repository's root; a jsdom module's `import.meta.url` is no file URL. */
const REPO_ROOT = process.cwd();
// white-box: the drawer's tokens are the Decision's one spelling of its width, and the split cannot
// read a `var()`: the only way to hold the two equal is to read the declaration the root is handed.
const GLOBALS = readFileSync(join(REPO_ROOT, "src/ui/theme/globals.css"), "utf8");

const DRAWER = "viewer-layers-drawer";
const STAGE = "viewer-stage-panel";
/** The prefix the library's `useDefaultLayout` stores every layout under. */
const STORED = "react-resizable-panels:";

const NOTHING = (): void => undefined;

function mountStage(layersOpen: boolean): void {
  const props: ViewerStageProps = {
    // Handed on to the layers list and the snapping marks, which the recording panel never mounts.
    panel: {} as LayersPanelProps,
    snap: {} as UseSnap,
    pointer: { onPointerDown: NOTHING, onPointerMove: NOTHING, onPointerUp: NOTHING, clearHover: NOTHING, marqueeOn: false } as unknown as UsePointer,
    partition: { panel: null, canvas: null, views: [] },
    onKeyDown: NOTHING,
    layersOpen,
    stageRef: createRef<HTMLDivElement>(),
    canvasRef: createRef<HTMLCanvasElement>(),
    sheetName: "S-10 COLUMN LAYOUT PLAN",
    probed: true,
    renderer: "webgl",
  };
  render(createElement(ViewerStage, props));
}

function lastGroup(): { defaultLayout: Layout | undefined; onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void } {
  const group = handed.groups.at(-1);
  if (group === undefined) throw new Error("the stage mounted no split");
  return group as ReturnType<typeof lastGroup>;
}

function panel(id: string): Record<string, unknown> | undefined {
  return handed.panels.findLast((props) => props.id === id);
}

function storedKeys(): string[] {
  return Object.keys(window.localStorage).filter((key) => key.startsWith(STORED));
}

beforeEach(() => {
  window.localStorage.clear();
  handed.groups.length = 0;
  handed.panels.length = 0;
});

afterEach(() => cleanup());

describe("I-432: the layers drawer is the Decision's 200 px, min 160, max 320 (p10)", () => {
  const ROOT = customProperties(GLOBALS, /^:root$/m);

  test("the split's three sizes are the root's drawer tokens, spelled once with their unit", () => {
    expect(DRAWER_SIZE.default, "--drawer-w").toBe(ROOT["--drawer-w"]);
    expect(DRAWER_SIZE.min, "--drawer-w-min").toBe(ROOT["--drawer-w-min"]);
    expect(DRAWER_SIZE.max, "--drawer-w-max").toBe(ROOT["--drawer-w-max"]);
  });

  test("each is in pixels: v4 reads a unitless string as a share of the work area, which is what drew 172 px at 1280", () => {
    for (const size of Object.values(DRAWER_SIZE)) expect(size, `${size} states its unit`).toMatch(/^\d+px$/);
    expect(pixelsIn(DRAWER_SIZE.default)).toEqual([200]);
  });

  test("the stage hands the drawer's panel those sizes, and the drawer holds its pixels as the work area changes", () => {
    mountStage(true);
    const drawer = panel(DRAWER);
    expect(drawer, `the drawer's panel is ${DRAWER}`).toBeDefined();
    expect(drawer?.defaultSize, "default").toBe(DRAWER_SIZE.default);
    expect(drawer?.minSize, "min").toBe(DRAWER_SIZE.min);
    expect(drawer?.maxSize, "max").toBe(DRAWER_SIZE.max);
    // Pinning the inspector narrows the split: its width comes out of the canvas, not a share of it
    // out of the drawer (the old 14 % fell to 131 px there).
    expect(drawer?.groupResizeBehavior, "the inspector's width is the canvas's to give").toBe("preserve-pixel-size");
    expect(panel(STAGE)?.defaultSize, "the canvas takes whatever the drawer leaves").toBeUndefined();
  });

  test("with L≡ off only the canvas stands", () => {
    mountStage(false);
    expect(panel(DRAWER)).toBeUndefined();
    expect(panel(STAGE)).toBeDefined();
  });
});

describe("I-432: the split remembers a reader's drag, never a layout the library settled on by itself", () => {
  test("a layout the library commits on its own — the opening one, the inspector opening beside it — is not stored", () => {
    mountStage(true);
    // What the pinned library reports when the inspector opens at 1440: the drawer held at 200 px of
    // a 1072 px split (the review's own reading of storage).
    lastGroup().onLayoutChanged({ [DRAWER]: 18.657, [STAGE]: 81.343 }, { isUserInteraction: false });
    expect(storedKeys(), "nothing is stored until a reader moves the drawer").toEqual([]);

    cleanup();
    mountStage(true);
    expect(lastGroup().defaultLayout, "so the next sheet opens at the panels' own 200 px").toBeUndefined();
  });

  test("a reader's drag or arrow key is stored for the panels standing, and the next sheet opens at it", () => {
    mountStage(true);
    const dragged = { [DRAWER]: 20, [STAGE]: 80 };
    lastGroup().onLayoutChanged(dragged, { isUserInteraction: true });
    const keys = storedKeys();
    expect(keys, "one layout, under the split's key").toHaveLength(1);
    expect(keys[0], "named for the split and the panels standing").toMatch(new RegExp(`cubit-viewer-split.*${DRAWER}.*${STAGE}`));
    expect(JSON.parse(window.localStorage.getItem(keys[0] as string) ?? "null")).toEqual(dragged);

    cleanup();
    mountStage(true);
    expect(lastGroup().defaultLayout, "remembered means a reader's drag").toEqual(dragged);
  });

  test("the 14 % every browser stored under the drawer's old id is never applied over the 200 px", () => {
    // What the library had stored after one open, with no drag, in a fresh browser context (C3's own
    // reading): the old panel id, at the old share.
    window.localStorage.setItem(`${STORED}cubit-viewer-split:viewer-layers-panel:${STAGE}`, JSON.stringify({ "viewer-layers-panel": 14, [STAGE]: 86 }));
    mountStage(true);
    expect(lastGroup().defaultLayout).toBeUndefined();
  });
});
