// The craft rubric measures the frame's slots — the 32 px tool row and the 24 px readout — where a
// screen mounted them, and nothing where no screen did.
//
// Session 7's final craft re-look found the viewer's row unmeasured: the viewer mounts its tool
// groups bare into the frame's slot and its own readout (`viewer-status`) in place of the frame's,
// so the rubric, which read only `shell-toolbar` and `shell-status`, scored chromeGeometry 5 on
// "toolbar absent, status absent" — a craft-table row that proved nothing about its chrome. The
// critic of session 8's map added the trap on the other side: the frame mounts the slot on EVERY
// screen and zeroes its track when nothing is in it (R-UI-080), so a slot read unconditionally
// would cost home, audit, drawings, documents and settings a point each for the absence the law
// asks for.
//
// The review of H1 added the third: the slot's height is the FRAME's track (`--toolbar-h`, a grid
// row; the slot and the frame's toolbar clip what they hold), so it reads 32 whether or not the row
// inside fits — session 7's BOQ tab row wrapped every label and three buttons inside that 32 px track
// and was found by eye (s-boq.md, I-boq-1(a)). The row is graded on its content against its box
// (`scrollHeight`/`scrollWidth` against `clientHeight`/`clientWidth`), and the words call the height
// what it is: the track's.
//
// Two halves. The rule is pure (`scripts/probe/lib/frame.mjs`) and is tested pure. Then the page half
// of `readCraft` is run for real over a built frame, in a jsdom window standing in for the page — it
// has no layout, so every box is handed in — through a page whose `evaluate` calls the function it is
// given with that window as its globals, and the reading goes through `scoreCraft`, the path the
// probe walks. The suite itself stays in node: the probe's registry reader (`lib/testids.mjs`) reads
// `src/ui/testids.ts` by a file URL, which node's `fs` takes and jsdom's `URL` is not.
import { afterEach, describe, expect, test } from "vitest";
import { chromeGeometry, FRAME_REGIONS, frameSlots, spill, STATUS_HEIGHT, TOOLBAR_HEIGHT } from "../../scripts/probe/lib/frame.mjs";
import { idOf } from "../../scripts/probe/lib/testids.mjs";

type Box = { x: number; y: number; width: number; height: number; area: number };
const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height, area: width * height });

type Extent = { scrollWidth: number; scrollHeight: number; clientWidth: number; clientHeight: number };
const extent = (scrollWidth: number, scrollHeight: number, clientWidth: number, clientHeight: number): Extent => ({ scrollWidth, scrollHeight, clientWidth, clientHeight });

const TRACK = box(48, 40, 1392, TOOLBAR_HEIGHT);
const READOUT = box(48, 876, 1392, STATUS_HEIGHT);
/** A row whose content fits the track's box exactly. */
const FITS = extent(1392, TOOLBAR_HEIGHT, 1392, TOOLBAR_HEIGHT);
/** Session 7's BOQ tab row, as a reproduction in the product's Chromium read it: a label in the aside wrapped, the content 45 high in the 32 px slot. */
const WRAPPED = extent(1392, 45, 1392, TOOLBAR_HEIGHT);
/** An aside that keeps one line (nowrap) and has too much in it: the content runs past the slot's right edge. */
const SPILLED = extent(1520, TOOLBAR_HEIGHT, 1392, TOOLBAR_HEIGHT);
const EMPTY_SLOT = { ...box(48, 40, 1392, 0), children: 0, extent: extent(1392, 0, 1392, 0) };

/** The viewer as it ships: groups in the slot, its own readout, neither of the frame's ids. */
const viewer = {
  toolbar: null,
  toolbarButtons: [],
  toolbarSlot: { ...TRACK, children: 6, extent: FITS },
  slotButtons: [28],
  status: null,
  viewerStatus: READOUT,
};
/** A screen with no tools: the frame's empty slot, zero high, and the frame's readout. */
const home = { toolbar: null, toolbarButtons: [], toolbarSlot: EMPTY_SLOT, slotButtons: [], status: READOUT, viewerStatus: null };

const RAIL = { width: 48 };
const TOPBAR = { height: 40 };

describe("frameSlots: the region measured is the one a screen mounted", () => {
  test("the viewer's bare tool groups are measured in the frame's slot, and its readout in its own", () => {
    const frame = frameSlots(viewer);
    expect(frame.toolbar).toEqual({ region: FRAME_REGIONS.toolbarSlot, box: viewer.toolbarSlot, buttons: [28], extent: FITS });
    expect(frame.status).toEqual({ region: FRAME_REGIONS.viewerStatus, box: READOUT });
  });

  test("an empty slot is no tool row: zero high with nothing in it is the absence R-UI-080 asks for", () => {
    expect(frameSlots(home).toolbar).toBeNull();
  });

  test("the slot needs BOTH an element and a height — either alone is no row", () => {
    expect(frameSlots({ ...home, toolbarSlot: { ...box(48, 40, 1392, 0), children: 1, extent: WRAPPED } }).toolbar, "an element in a zeroed track").toBeNull();
    expect(frameSlots({ ...home, toolbarSlot: { ...TRACK, children: 0, extent: FITS } }).toolbar, "a track with no element in it").toBeNull();
  });

  test("the frame's own toolbar wins over its slot, and its buttons and its extent are the ones read", () => {
    const own = extent(540, TOOLBAR_HEIGHT, 540, TOOLBAR_HEIGHT);
    const toolbar = { ...box(900, 40, 540, TOOLBAR_HEIGHT), extent: own };
    const frame = frameSlots({ ...viewer, toolbarSlot: { ...TRACK, children: 1, extent: WRAPPED }, toolbar, toolbarButtons: [28], slotButtons: [28, 32] });
    expect(frame.toolbar).toEqual({ region: FRAME_REGIONS.toolbar, box: toolbar, buttons: [28], extent: own });
  });

  test("the viewer's readout stands in only where the frame's is absent", () => {
    const frame = frameSlots({ ...home, viewerStatus: box(48, 876, 1392, 30) });
    expect(frame.status).toEqual({ region: FRAME_REGIONS.status, box: READOUT });
  });

  test("with neither readout, there is none to measure", () => {
    expect(frameSlots({ ...home, status: null }).status).toBeNull();
  });
});

describe("spill: whether a row's content runs past its box", () => {
  test("content inside the box, or one sub-pixel over, fits", () => {
    expect(spill(FITS)).toEqual([]);
    expect(spill(extent(1393, 33, 1392, 32)), "one pixel over is layout rounding, not a spill").toEqual([]);
  });

  test("each axis is its own finding, stated as the figures that show it", () => {
    expect(spill(WRAPPED)).toEqual(["45>32 high"]);
    expect(spill(SPILLED)).toEqual(["1520>1392 wide"]);
    expect(spill(extent(1520, 45, 1392, 32))).toEqual(["45>32 high", "1520>1392 wide"]);
  });
});

describe("chromeGeometry reads the measured regions", () => {
  test("the viewer's row and readout are measured and SAID to be measured, with the box each was read in", () => {
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots(viewer) })).toEqual({
      score: 5,
      why: `rail 48, toolbar track 32 (${FRAME_REGIONS.toolbarSlot}) and its row fits, status track 24 (${FRAME_REGIONS.viewerStatus})`,
    });
  });

  test("a row that wrapped inside the 32 px track costs the point, though the track still reads 32", () => {
    const wrapped = { ...viewer, toolbarSlot: { ...TRACK, children: 1, extent: WRAPPED } };
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots(wrapped) })).toEqual({ score: 4, why: `toolbar clipped (${FRAME_REGIONS.toolbarSlot}) 45>32 high` });
  });

  test("a one-line row with too much in it, clipped at the slot's right edge, costs the point", () => {
    const spilled = { ...viewer, toolbarSlot: { ...TRACK, children: 1, extent: SPILLED } };
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots(spilled) })).toEqual({ score: 4, why: `toolbar clipped (${FRAME_REGIONS.toolbarSlot}) 1520>1392 wide` });
  });

  test("the frame's own toolbar is held to the same fit, and the clip names it", () => {
    const toolbar = { ...box(48, 40, 1392, TOOLBAR_HEIGHT), extent: WRAPPED };
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots({ ...home, toolbar, toolbarButtons: [28] }) })).toEqual({
      score: 4,
      why: `toolbar clipped (${FRAME_REGIONS.toolbar}) 45>32 high`,
    });
  });

  test("a track off 32 px — the frame's own CSS moved, which no screen can do — costs the point too, and one row loses one point", () => {
    const tall = { ...viewer, toolbarSlot: { ...box(48, 40, 1392, 40), children: 6, extent: extent(1392, 40, 1392, 40) } };
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots(tall) })).toEqual({ score: 4, why: `toolbar track 40 (${FRAME_REGIONS.toolbarSlot})` });
    const tallAndWrapped = { ...viewer, toolbarSlot: { ...box(48, 40, 1392, 40), children: 6, extent: extent(1392, 52, 1392, 40) } };
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots(tallAndWrapped) })).toEqual({
      score: 4,
      why: `toolbar track 40 (${FRAME_REGIONS.toolbarSlot}), toolbar clipped (${FRAME_REGIONS.toolbarSlot}) 52>40 high`,
    });
  });

  test("a screen with no tool row keeps its score and its words: 'toolbar absent', no point off", () => {
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots(home) })).toEqual({ score: 5, why: "toolbar absent" });
  });

  test("the frame's own regions are stated bare, as the tracks they are", () => {
    const toolbar = { ...box(48, 40, 1392, TOOLBAR_HEIGHT), extent: FITS };
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots({ ...home, toolbar, toolbarButtons: [28] }) })).toEqual({ score: 5, why: "rail 48, toolbar track 32 and its row fits, status track 24" });
    expect(chromeGeometry({ rail: RAIL, topbar: TOPBAR, frame: frameSlots({ ...home, status: box(48, 872, 1392, 28) }) })).toEqual({ score: 4, why: "toolbar absent, status track 28" });
  });

  test("the rest of the criterion is unchanged: an open rail is -2, a tall top bar -1", () => {
    expect(chromeGeometry({ rail: { width: 220 }, topbar: { height: 48 }, frame: frameSlots(viewer) })).toEqual({ score: 2, why: "rail 220, topbar 48" });
    expect(chromeGeometry({ rail: null, topbar: null, frame: frameSlots(home) }).why).toBe("rail absent, toolbar absent");
  });
});

// ---- the page half, run over a built frame --------------------------------------------------------

interface Criterion {
  readonly score: number;
  readonly why: string;
}
interface CraftReading {
  readonly frame: ReturnType<typeof frameSlots>;
  readonly toolbar: Box | null;
  readonly status: Box | null;
  readonly slots: { readonly toolbarSlot: (Box & { children: number; extent: Extent }) | null };
  readonly controls: { readonly toolbarButtons: readonly number[] };
}
interface FakePage {
  evaluate(fn: (arg: unknown) => unknown, arg: unknown): Promise<unknown>;
}
interface CraftModule {
  readCraft(page: FakePage): Promise<CraftReading>;
  scoreCraft(reading: CraftReading, axeByTheme: Record<string, unknown>, kind: "grid" | "canvas"): { readonly criteria: Record<string, Criterion> };
}

interface JsdomModule {
  readonly JSDOM: new (html: string) => { readonly window: Window & typeof globalThis };
}

// `craft.mjs` is the browser's code and is kept out of the node type program (tsconfig.json), and
// jsdom publishes no types: both are loaded by address and typed by the part of them this suite reads.
const CRAFT = new URL("../../scripts/probe/lib/craft.mjs", import.meta.url).href;
const JSDOM_MODULE = "jsdom";
const craft = async (): Promise<CraftModule> => (await import(/* @vite-ignore */ CRAFT)) as CraftModule;

/** What the page's code reads off `globalThis`, handed the window's own for one evaluation. */
const PAGE_GLOBALS = ["document", "window", "NodeFilter", "getComputedStyle"] as const;

/**
 * A window standing in for the page, and the page over it: `evaluate` runs the function it is handed
 * — the very function `page.evaluate` would ship to Chromium — with the window as its globals, and
 * puts node's own back afterwards. Every box is the one the suite hands `part`, since jsdom lays
 * nothing out.
 */
async function stage() {
  const { JSDOM } = (await import(/* @vite-ignore */ JSDOM_MODULE)) as JsdomModule;
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const boxes = new WeakMap<Element, Box>();
  window.Element.prototype.getBoundingClientRect = function measured(this: Element): DOMRect {
    const b = boxes.get(this) ?? box(0, 0, 0, 0);
    return { ...b, top: b.y, left: b.x, right: b.x + b.width, bottom: b.y + b.height, toJSON: () => b };
  };
  const page: FakePage = {
    evaluate: (fn, arg) => {
      const held = new Map(PAGE_GLOBALS.map((name) => [name, Reflect.get(globalThis, name) as unknown]));
      for (const name of PAGE_GLOBALS) Reflect.set(globalThis, name, name === "window" ? window : name === "getComputedStyle" ? window.getComputedStyle.bind(window) : Reflect.get(window, name));
      try {
        return Promise.resolve(fn(arg));
      } finally {
        for (const [name, value] of held) Reflect.set(globalThis, name, value);
      }
    },
  };
  /** One element of the built frame: its tag, its registry id, its box, what it holds. */
  const part = (tag: string, id: string | null, at: Box | null, ...children: Element[]): Element => {
    const element = window.document.createElement(tag);
    if (id !== null) element.setAttribute("data-testid", idOf(id));
    if (at !== null) boxes.set(element, at);
    element.append(...children);
    return element;
  };
  /**
   * How far an element's content runs against its box, as Chromium would answer it — jsdom lays
   * nothing out and answers 0 for all four, so the suite states them, on the element itself.
   */
  const extendTo = (element: Element, at: Extent): void => {
    for (const [name, value] of Object.entries(at)) Object.defineProperty(element, name, { value, configurable: true });
  };
  /** The frame around a screen: rail, top bar, the tool slot holding `tools`, main, and a readout. */
  const frame = (tools: Element[], slotHeight: number, screen: Element, readout: Element): Element => {
    const rail = part("nav", "shell.rail", box(0, 0, 48, 900));
    rail.setAttribute("data-collapsed", "true");
    const main = part("main", "shell.main", box(48, 72, 1392, 804), screen);
    const slot = part("div", "shell.toolbarSlot", box(48, 40, 1392, slotHeight), ...tools);
    window.document.body.append(rail, part("header", "shell.topbar", box(48, 0, 1392, 40)), slot, main, readout);
    return slot;
  };
  return { page, part, frame, extendTo, close: () => window.close() };
}

let staged: Awaited<ReturnType<typeof stage>> | null = null;
afterEach(() => {
  staged?.close();
  staged = null;
});

describe("readCraft + scoreCraft over a built frame", () => {
  test("the viewer: its row is measured in the slot, its readout in its own box, and its buttons are the row's", async () => {
    staged = await stage();
    const { page, part, frame, extendTo } = staged;
    const button = (at: Box) => part("button", null, at);
    // `ShellToolbarGroup`s, as the viewer mounts them: tool groups, bare in the slot.
    const toolGroup = (at: Box, ...tools: Element[]) => {
      const group = part("div", null, at, ...tools);
      group.setAttribute("role", "group");
      return group;
    };
    const group = toolGroup(box(56, 42, 64, 28), button(box(58, 42, 28, 28)), button(box(88, 42, 28, 28)));
    const snap = toolGroup(box(130, 42, 180, 28), button(box(132, 40, 52, 32)));
    const canvas = part("canvas", "viewer.canvas", box(48, 72, 1392, 804));
    const screen = part("div", "viewer.screen", box(48, 72, 1392, 804), canvas);
    screen.setAttribute("data-screen-root", "");
    screen.setAttribute("data-state", "ready");
    extendTo(frame([group, snap], TOOLBAR_HEIGHT, screen, part("div", "viewer.status", box(48, 876, 1392, STATUS_HEIGHT))), FITS);

    const { readCraft, scoreCraft } = await craft();
    const reading = await readCraft(page);
    expect(reading.slots.toolbarSlot?.children, "the page counts the elements the slot holds").toBe(2);
    expect(reading.frame.toolbar?.region).toBe(FRAME_REGIONS.toolbarSlot);
    expect(reading.frame.toolbar?.extent, "the page reads how far the slot's content runs").toEqual(FITS);
    expect(reading.toolbar?.height).toBe(TOOLBAR_HEIGHT);
    expect(reading.status?.height).toBe(STATUS_HEIGHT);
    expect([...reading.controls.toolbarButtons].sort()).toEqual([28, 32]);

    const { criteria } = scoreCraft(reading, {}, "canvas");
    expect(criteria["chromeGeometry"]).toEqual({ score: 5, why: `rail 48, toolbar track 32 (${FRAME_REGIONS.toolbarSlot}) and its row fits, status track 24 (${FRAME_REGIONS.viewerStatus})` });
    expect(criteria["controlHeight"]?.why, "a 32 px text button in the tool row is now seen").toContain("toolbar buttons at 32px");
  });

  test("the takeoff tab row is measured as the row, and its IdChip and primary are not graded as tools", async () => {
    staged = await stage();
    const { page, part, frame } = staged;
    // Direction §3.2's tabs row: area tabs (links), then the pinned revision's IdChip — a 24 px chip
    // that is a button — and the one primary. None of them is a tool group.
    const tabs = part("nav", "takeoff.nav", box(64, 40, 400, 32), part("a", null, box(64, 40, 80, 32)));
    const chip = part("button", null, box(1180, 44, 96, 24));
    const primary = part("button", null, box(1290, 42, 100, 28));
    const row = part("div", null, box(48, 40, 1392, 32), tabs, part("div", null, box(1100, 40, 340, 32), chip, primary));
    const grid = part("div", null, box(72, 96, 1344, 600));
    grid.setAttribute("role", "grid");
    frame([row], TOOLBAR_HEIGHT, part("div", null, box(72, 96, 1344, 600), grid), part("div", "shell.status", box(48, 876, 1392, STATUS_HEIGHT)));

    const { readCraft, scoreCraft } = await craft();
    const reading = await readCraft(page);
    expect(reading.frame.toolbar?.region).toBe(FRAME_REGIONS.toolbarSlot);
    expect(reading.controls.toolbarButtons, "the chip and the primary stand outside every tool group").toEqual([]);
    const { criteria } = scoreCraft(reading, {}, "grid");
    expect(criteria["chromeGeometry"]).toEqual({ score: 5, why: `rail 48, toolbar track 32 (${FRAME_REGIONS.toolbarSlot}) and its row fits, status track 24` });
    expect(criteria["controlHeight"]?.score).toBe(5);
  });

  test("the takeoff tab row whose aside wrapped inside the 32 px track: the track reads 32, the row is clipped, and the point is lost", async () => {
    staged = await stage();
    const { page, part, frame, extendTo } = staged;
    // The review's reproduction in the product's Chromium, from the shell's and the tab row's own
    // rules: a primary whose label wrapped to 51 px in the aside, outside every tool group, so the
    // button half of controlHeight never sees it. The slot still reads 32 — it is the frame's track —
    // and clips the row, whose content runs 45 high (`{slot: 32, row: 32, primaryButton: 51,
    // slotScrollH: 45, slotClientH: 32}`). Only the content's extent can say so.
    const tabs = part("nav", "takeoff.nav", box(64, 40, 400, 32), part("a", null, box(64, 40, 80, 32)));
    const primary = part("button", null, box(1290, 30, 100, 51));
    const row = part("div", null, box(48, 40, 1392, 32), tabs, part("div", null, box(1100, 40, 340, 32), primary));
    const grid = part("div", null, box(72, 96, 1344, 600));
    grid.setAttribute("role", "grid");
    extendTo(frame([row], TOOLBAR_HEIGHT, part("div", null, box(72, 96, 1344, 600), grid), part("div", "shell.status", box(48, 876, 1392, STATUS_HEIGHT))), WRAPPED);

    const { readCraft, scoreCraft } = await craft();
    const reading = await readCraft(page);
    expect(reading.toolbar?.height, "the slot is the frame's track and reads 32 whatever it holds").toBe(TOOLBAR_HEIGHT);
    expect(reading.controls.toolbarButtons, "the wrapped primary stands outside every tool group").toEqual([]);
    const { criteria } = scoreCraft(reading, {}, "grid");
    expect(criteria["chromeGeometry"]).toEqual({ score: 4, why: `toolbar clipped (${FRAME_REGIONS.toolbarSlot}) 45>32 high` });
  });

  test("a screen's own toolbar that spills past its right edge is read on the toolbar, not the slot", async () => {
    staged = await stage();
    const { page, part, frame, extendTo } = staged;
    const toolbar = part("div", "shell.toolbar", box(48, 40, 1392, TOOLBAR_HEIGHT), part("button", null, box(56, 42, 28, 28)));
    const grid = part("div", null, box(72, 96, 1344, 600));
    grid.setAttribute("role", "grid");
    extendTo(frame([toolbar], TOOLBAR_HEIGHT, part("div", null, box(72, 96, 1344, 600), grid), part("div", "shell.status", box(48, 876, 1392, STATUS_HEIGHT))), FITS);
    extendTo(toolbar, SPILLED);

    const { readCraft, scoreCraft } = await craft();
    const reading = await readCraft(page);
    expect(reading.frame.toolbar?.region).toBe(FRAME_REGIONS.toolbar);
    expect(scoreCraft(reading, {}, "grid").criteria["chromeGeometry"]).toEqual({ score: 4, why: `toolbar clipped (${FRAME_REGIONS.toolbar}) 1520>1392 wide` });
  });

  test("a screen with no tools: the empty, zeroed slot is not measured and the route keeps its score", async () => {
    staged = await stage();
    const { page, part, frame } = staged;
    const grid = part("div", null, box(72, 96, 1344, 600));
    grid.setAttribute("role", "grid");
    const screen = part("div", "sHome.grid", box(72, 96, 1344, 600), grid);
    frame([], 0, screen, part("div", "shell.status", box(48, 876, 1392, STATUS_HEIGHT)));

    const { readCraft, scoreCraft } = await craft();
    const reading = await readCraft(page);
    expect(reading.slots.toolbarSlot).toMatchObject({ height: 0, children: 0 });
    expect(reading.frame.toolbar).toBeNull();
    expect(reading.controls.toolbarButtons).toEqual([]);
    expect(scoreCraft(reading, {}, "grid").criteria["chromeGeometry"]).toEqual({ score: 5, why: "toolbar absent" });
  });
});
