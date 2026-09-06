// @vitest-environment jsdom
/**
 * The Trace's target as a hook (R-UI-022, Decision § 4): the camera eases from where it stands to
 * the frame that holds what was named, the arrival is struck once in the pulse colour, and a reveal
 * with nowhere to go does not pretend to travel.
 *
 * The frame travelled to is `revealCamera`'s own answer and every waypoint is `flyTo`'s, for the
 * duration `flytoMotion` reads off this stage (B-17, B-19) — nothing here states a curve, a frame or
 * a number of milliseconds of its own.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { productModule } from "../support/viewer-support";

/** The module AC-2 names for this concern, and the one the travel itself belongs to. */
const USE_REVEAL_MODULE = "src/modules/takeoff/viewer/hooks/use-reveal.ts";
const FLYTO_MODULE = "src/modules/takeoff/viewer-inspector/flyto.ts";

/** The box the reveal is framed on, and the stage it is framed into. */
const BOX = { min: [10, 20], max: [50, 44] };
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 600;

/** Where the camera stands before the travel — nowhere near where it is going. */
const FROM = { centre: [300, 300], scale: 0.5, viewport: { width: STAGE_WIDTH, height: STAGE_HEIGHT } };

/** The key the sheet knows, and one it does not. */
const KNOWN = "DXF_HANDLE:1A";
const UNKNOWN = "DXF_HANDLE:FF";

type Camera = typeof FROM;
type RevealHook = {
  flytoMotion: (element: Element) => { durationMs: number; ease: unknown };
  useReveal: (options: {
    head: unknown;
    stageRef: { current: HTMLElement | null };
    cameraRef: { current: unknown };
    facts: { get: (key: string) => unknown; has: (key: string) => boolean; learn: (layer: unknown) => void };
    heldRef: { current: readonly string[] };
    moveCamera: (move: (held: Camera) => Camera, live: boolean) => void;
    jumpTo: (to: Camera) => void;
    pulse: (durationMs: number) => void;
  }) => { reveal: (keys?: readonly string[]) => void; flyto: "flying" | "settled" | null };
};

/** What this sheet knows about its keys: one of them, and only that one. */
const facts = {
  get: (key: string) => (key === KNOWN ? { type: "LINE", layer: "GRID", box: BOX, records: [] } : undefined),
  has: (key: string) => key === KNOWN,
  learn: () => undefined,
};

const SHEET = {
  kind: "manifest",
  cache: "miss",
  facts: {},
  manifest: {
    version: 1,
    layoutName: "SHEET ONE",
    extents: { min: [0, 0], max: [400, 200] },
    insunits: { code: 0, unit: null, unmapped: true },
    digest: "sheet-one",
    layers: [],
  },
};

let flytoMotion: RevealHook["flytoMotion"];
let useReveal: RevealHook["useReveal"];
let revealCamera: (box: unknown, viewportPx: { width: number; height: number }) => Camera;
let flyTo: (from: Camera, to: Camera, elapsedMs: number, durationMs: number, ease: unknown) => Camera;
let stage: HTMLDivElement;
let cameraRef: { current: Camera | null };
let heldRef: { current: readonly string[] };
let moveCamera: ReturnType<typeof vi.fn>;
let jumpTo: ReturnType<typeof vi.fn>;
let pulse: ReturnType<typeof vi.fn>;
/** The frames nobody has run yet, and the clock they are run against. */
let frames: (() => void)[];
let now: number;

async function mount() {
  const module = await productModule<RevealHook>(USE_REVEAL_MODULE);
  ({ flytoMotion, useReveal } = module);
  ({ revealCamera, flyTo } = await productModule<{ revealCamera: typeof revealCamera; flyTo: typeof flyTo }>(FLYTO_MODULE));
  return renderHook(() => useReveal({ head: SHEET, stageRef: { current: stage }, cameraRef, facts, heldRef, moveCamera, jumpTo, pulse }));
}

/** The next frame the travel asked for, run at this moment on the clock. */
function runFrame(at: number): void {
  now = at;
  const next = frames.shift();
  expect(next, "the travel asked for a frame").toBeDefined();
  act(() => (next as () => void)());
}

/** Where the last live move left the camera. */
function lastMove(): Camera {
  const call = moveCamera.mock.calls.at(-1) as [(held: Camera) => Camera, boolean];
  return call[0](cameraRef.current as Camera);
}

beforeEach(() => {
  stage = document.createElement("div");
  document.body.append(stage);
  // jsdom lays nothing out, so the box the travel is framed into is stated here.
  stage.getBoundingClientRect = () =>
    ({ width: STAGE_WIDTH, height: STAGE_HEIGHT, x: 0, y: 0, top: 0, left: 0, right: STAGE_WIDTH, bottom: STAGE_HEIGHT, toJSON: () => ({}) }) as DOMRect;

  cameraRef = { current: FROM };
  heldRef = { current: [] };
  moveCamera = vi.fn();
  jumpTo = vi.fn();
  pulse = vi.fn();
  frames = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", (frame: () => void) => {
    frames.push(frame);
    return frames.length;
  });
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  stage.remove();
});

describe("the reveal", () => {
  test("a reveal of keys with no box has nowhere to go and does not pretend to travel", async () => {
    const { result } = await mount();

    act(() => result.current.reveal([UNKNOWN]));

    expect(frames, "no frame was asked for").toHaveLength(0);
    expect(jumpTo, "and no camera was moved").not.toHaveBeenCalled();
    expect(result.current.flyto, "so the sheet never says it flew (I-85)").toBeNull();
  });

  test("the camera eases to the frame that holds the keys, and the arrival is struck once", async () => {
    const { result } = await mount();
    const { durationMs, ease } = flytoMotion(stage);
    const to = revealCamera(BOX, { width: STAGE_WIDTH, height: STAGE_HEIGHT });

    act(() => result.current.reveal([KNOWN]));
    expect(result.current.flyto, "the travel is under way").toBe("flying");

    const midway = durationMs / 2;
    runFrame(midway);
    expect(moveCamera, "every frame of the travel is drawn and none of them is an address write").toHaveBeenCalledWith(expect.any(Function), true);
    expect(lastMove(), "and each waypoint is the tree's own ease between the two cameras").toEqual(flyTo(FROM, to, midway, durationMs, ease));

    runFrame(durationMs);
    expect(jumpTo, "the arrival is one discrete move to the frame that holds what was named").toHaveBeenCalledWith(to);
    expect(pulse, "struck once, for as long as the travel lasted (Decision § 4)").toHaveBeenCalledWith(durationMs);
    expect(result.current.flyto, "and the sheet says it has landed").toBe("settled");
    expect(frames, "a landed travel asks for no further frame").toHaveLength(0);
  });

  test("a reveal named no keys travels to what is held", async () => {
    const { result } = await mount();
    heldRef.current = [KNOWN];

    act(() => result.current.reveal());

    expect(result.current.flyto, "the Reveal door reveals what the reader is holding").toBe("flying");
  });

  test("a second reveal cancels the first, so a sheet never travels two ways at once", async () => {
    const { result } = await mount();
    const { durationMs } = flytoMotion(stage);

    act(() => result.current.reveal([KNOWN]));
    // The frame the first travel asked for, taken off the queue and deliberately not run yet.
    const abandoned = frames.shift() as () => void;

    act(() => result.current.reveal([KNOWN]));
    const drawn = moveCamera.mock.calls.length;
    expect(result.current.flyto, "the newer travel is the one under way").toBe("flying");

    now = durationMs / 2;
    act(() => abandoned());

    expect(moveCamera.mock.calls.length, "the travel that was overtaken stops rather than fighting the new one").toBe(drawn);
    expect(frames, "and only the travel still under way has a frame outstanding").toHaveLength(1);
  });
});
