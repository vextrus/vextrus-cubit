/**
 * AC-2's scene half and AC-3's hatch half — `overlayScene(overlay, toggles, camera)`, which the
 * contract states is pure: this file runs in the node environment, so a scene that needed a canvas
 * could not be graded here at all.
 *
 * The camera is the sheet's own (`createCamera`), and every screen quantity is judged by mapping it
 * BACK through the seam's own `worldAt` — the inverse the viewer already publishes. So nothing here
 * transcribes a projection, a pixel or a dash: a camera that maps differently moves both sides at
 * once (B-17, B-19), and the assertion stays what AC-2 says it is — an outline at the view's box, an
 * axis through the view at its stored position, a bubble at the ring's own centre and radius.
 */
import { describe, expect, test } from "vitest";
import { UNTYPED, VIEWER_CLIENT_MODULE, overlayFixture, productModule, sceneDoor, type OverlayAxis, type OverlayView, type Scene } from "./support/overlay-stage";

/** The viewport the scene is mapped into — a size, never a screen this suite has seen. */
const VIEWPORT = { width: 1280, height: 800 };

/** The sheet the camera is fitted to, wide enough to hold every staged view. */
const EXTENTS = { min: [-100, -200] as [number, number], max: [900, 100] as [number, number] };

/** How closely two readings of one world quantity must agree once mapped there and back. */
const PLACES = 6;

/** The overlay every surface criterion is read over, in the shape the interface list publishes. */
const overlay = (): ReturnType<typeof overlayFixture> => overlayFixture();

/** The camera the sheet is drawn under, and the inverse every screen quantity is judged by. */
async function sheet(): Promise<{ camera: unknown; worldAt: (camera: unknown, at: { x: number; y: number }) => [number, number] }> {
  const client = await productModule<{
    createCamera: (extents: unknown, viewportPx: { width: number; height: number }) => unknown;
    worldAt: (camera: unknown, at: { x: number; y: number }) => [number, number];
  }>(VIEWER_CLIENT_MODULE);
  return { camera: client.createCamera(EXTENTS, VIEWPORT), worldAt: client.worldAt };
}

/** Both switches on, unless a case says otherwise. */
const ON = { views: true, grid: true };

/** The scene, for one set of switches. */
async function sceneOf(toggles: { views: boolean; grid: boolean }): Promise<Scene> {
  const { overlayScene } = await sceneDoor();
  const { camera } = await sheet();
  return overlayScene(overlay(), toggles, camera);
}

/** The world box a screen rect covers, read back through the camera's own inverse. */
function worldBoxOf(rect: { x: number; y: number; width: number; height: number }, worldAt: (camera: unknown, at: { x: number; y: number }) => [number, number], camera: unknown): { min: [number, number]; max: [number, number] } {
  const corners = [
    worldAt(camera, { x: rect.x, y: rect.y }),
    worldAt(camera, { x: rect.x + rect.width, y: rect.y }),
    worldAt(camera, { x: rect.x, y: rect.y + rect.height }),
    worldAt(camera, { x: rect.x + rect.width, y: rect.y + rect.height }),
  ];
  return {
    min: [Math.min(...corners.map((point) => point[0])), Math.min(...corners.map((point) => point[1]))],
    max: [Math.max(...corners.map((point) => point[0])), Math.max(...corners.map((point) => point[1]))],
  };
}

describe("AC-2: the scene is the partition mapped onto the sheet, and nothing else", () => {
  test("AC-2: one outline per view with a box, at that box, carrying the view's type", async () => {
    const scene = await sceneOf(ON);
    const { camera, worldAt } = await sheet();
    const withBox = overlay().views.filter((row) => row.box !== null);

    expect(
      scene.outlines.map((outline) => outline.viewKey).sort(),
      "an outline for every view standing on this sheet, and none for a view standing on no box of it",
    ).toEqual(withBox.map((row) => row.viewKey).sort());

    for (const row of withBox) {
      const outline = scene.outlines.find((candidate) => candidate.viewKey === row.viewKey);
      expect(outline, `${row.viewKey} is outlined`).toBeDefined();
      expect(outline?.type, `${row.viewKey}'s outline carries the stored type spelling`).toBe(row.type);

      const measured = worldBoxOf(outline?.rect as { x: number; y: number; width: number; height: number }, worldAt, camera);
      const box = row.box as { min: [number, number]; max: [number, number] };
      expect(measured.min[0], `${row.viewKey}'s outline covers its box in x`).toBeCloseTo(box.min[0], PLACES);
      expect(measured.max[0], `${row.viewKey}'s outline covers its box in x`).toBeCloseTo(box.max[0], PLACES);
      expect(measured.min[1], `${row.viewKey}'s outline covers its box in y`).toBeCloseTo(box.min[1], PLACES);
      expect(measured.max[1], `${row.viewKey}'s outline covers its box in y`).toBeCloseTo(box.max[1], PLACES);
    }
  });

  test("AC-2: one axis per stored row, drawn through its view at its stored position", async () => {
    const scene = await sceneOf(ON);
    const { camera, worldAt } = await sheet();
    const stored = overlay().axes;

    expect(scene.axes.length, "one axis of the scene per stored grid row").toBe(stored.length);
    expect(
      scene.axes.map((drawn) => `${drawn.viewKey}|${drawn.family}|${drawn.label}`),
      "each carrying the view it stands in, its family and its label, verbatim",
    ).toEqual(stored.map((row) => `${row.viewKey}|${row.family}|${row.label}`));

    const boxes = new Map(overlay().views.map((row) => [row.viewKey, row.box]));
    for (let at = 0; at < stored.length; at += 1) {
      const row = stored[at] as OverlayAxis;
      const drawn = scene.axes[at] as Scene["axes"][number];
      const from = worldAt(camera, { x: drawn.from[0], y: drawn.from[1] });
      const to = worldAt(camera, { x: drawn.to[0], y: drawn.to[1] });

      // An axis of the `x` family georeferences at a world x; one of the `y` family at a world y.
      const along = row.axis === "x" ? 0 : 1;
      const across = row.axis === "x" ? 1 : 0;
      expect(from[along], `${row.bubbleKey} is drawn at its stored position`).toBeCloseTo(row.position, PLACES);
      expect(to[along], `${row.bubbleKey} stays at its stored position along its whole length`).toBeCloseTo(row.position, PLACES);

      // And it runs THROUGH the view it stands in: the line spans that view's box, never a stub.
      const box = boxes.get(row.viewKey);
      if (box !== null && box !== undefined) {
        const low = Math.min(from[across], to[across]);
        const high = Math.max(from[across], to[across]);
        expect(low, `${row.bubbleKey} runs through ${row.viewKey}'s box`).toBeLessThanOrEqual(box.min[across] + 10 ** -PLACES);
        expect(high, `${row.bubbleKey} runs through ${row.viewKey}'s box`).toBeGreaterThanOrEqual(box.max[across] - 10 ** -PLACES);
      }
    }
  });

  test("AC-2: a bubble is drawn at the stored ring's own centre and radius, in pixels", async () => {
    const scene = await sceneOf(ON);
    const { camera, worldAt } = await sheet();
    const stored = overlay().axes;

    expect(
      scene.axes.map((drawn) => drawn.bubble === null),
      "a row with no ring behind it is drawn with no bubble — the axis still stands",
    ).toEqual(stored.map((row) => row.bubble === null));

    for (let at = 0; at < stored.length; at += 1) {
      const row = stored[at] as OverlayAxis;
      const drawn = scene.axes[at] as Scene["axes"][number];
      if (row.bubble === null || drawn.bubble === null) continue;

      const centre = worldAt(camera, { x: drawn.bubble.centre[0], y: drawn.bubble.centre[1] });
      expect(centre[0], `${row.bubbleKey}'s bubble stands at the stored centre`).toBeCloseTo(row.bubble.centre[0], PLACES);
      expect(centre[1], `${row.bubbleKey}'s bubble stands at the stored centre`).toBeCloseTo(row.bubble.centre[1], PLACES);

      // The radius is that ring's radius, expressed in the camera's pixels: a pixel offset of the
      // drawn radius lands exactly the stored radius away from the centre in the world.
      const edge = worldAt(camera, { x: drawn.bubble.centre[0] + drawn.bubble.radius, y: drawn.bubble.centre[1] });
      expect(Math.hypot(edge[0] - centre[0], edge[1] - centre[1]), `${row.bubbleKey}'s bubble is the stored ring's radius across`).toBeCloseTo(row.bubble.radius, PLACES);
    }
  });

  test("AC-2: each switch gates its own paint and nothing else", async () => {
    const both = await sceneOf(ON);
    const noViews = await sceneOf({ views: false, grid: true });
    const noGrid = await sceneOf({ views: true, grid: false });
    const neither = await sceneOf({ views: false, grid: false });

    expect(noViews.outlines, "views off: no outline is drawn").toEqual([]);
    expect(noViews.axes, "and the grid is untouched by the views switch").toEqual(both.axes);
    expect(noGrid.axes, "grid off: no axis is drawn").toEqual([]);
    expect(noGrid.outlines, "and the views are untouched by the grid switch").toEqual(both.outlines);
    expect(neither, "both off: nothing is painted at all").toEqual({ outlines: [], axes: [] });
  });
});

describe("AC-3: an untyped view is hatched, and it is the only one that is", () => {
  test("AC-3: hatched is set on exactly the UNTYPED outlines, each carrying its stored reason", async () => {
    const scene = await sceneOf(ON);
    const stored = new Map(overlay().views.map((row) => [row.viewKey, row]));

    expect(
      scene.outlines.map((outline) => `${outline.viewKey}|${outline.hatched}`),
      "an outline is hatched when, and only when, its view's stored type is UNTYPED",
    ).toEqual(scene.outlines.map((outline) => `${outline.viewKey}|${stored.get(outline.viewKey)?.type === UNTYPED}`));

    for (const outline of scene.outlines) {
      const row = stored.get(outline.viewKey) as OverlayView;
      expect(outline.reason, `${outline.viewKey}'s outline carries the reason the store holds, verbatim`).toBe(outline.hatched ? row.reason : null);
    }

    expect(
      scene.outlines.some((outline) => outline.hatched),
      "the staged overlay really carries a view the grammar could not read — a hatch nobody drew grades nothing",
    ).toBe(true);
  });
});
