/**
 * AC-3's camera work — where a reveal lands and how it travels there (increment interfaces:
 * `src/modules/takeoff/viewer-inspector/flyto.ts`).
 *
 * The scale band is not a number typed here: it is read out of the inherited camera itself, by
 * asking `zoomCameraAt` for an impossible zoom in each direction and taking what it answers (B-19).
 * The easing curve is not asserted either — only what any ease owes: it starts where it started,
 * it ends where it was going, a zero duration is already there, and half way along it is between
 * the two.
 */
import { describe, expect, test } from "vitest";
import { SYNTHETIC_EXTENTS } from "../viewer/support/synthetic-graph";
import { centreOf, flytoModule, viewerClient, type Camera, type IndexBox } from "./support/inspector-support";

/** The box a screen is drawn into — the one a reveal frames its selection inside. */
const VIEWPORT = { width: 1200, height: 800 };

/** The sheet the camera starts on, and a box inside it a reveal is asked for. */
const EXTENTS = { min: [...SYNTHETIC_EXTENTS.min] as [number, number], max: [...SYNTHETIC_EXTENTS.max] as [number, number] };
const BOX: IndexBox = { min: [120, 240], max: [180, 260] };

/** A box of no extent at all: one point, selected on its own. */
const DEGENERATE: IndexBox = { min: [400, 300], max: [400, 300] };

/** The duration a fly-to is graded over here — the token's value is the screen's business (§4). */
const DURATION_MS = 320;

/** The band the camera's own scale is clamped into, asked of the inherited camera rather than typed. */
async function scaleBand(): Promise<{ min: number; max: number }> {
  const client = await viewerClient();
  const at = client.fitCamera(EXTENTS, VIEWPORT);
  return {
    min: client.zoomCameraAt(at, 1e-30, { x: 0, y: 0 }).scale,
    max: client.zoomCameraAt(at, 1e30, { x: 0, y: 0 }).scale,
  };
}

describe("AC-3: a reveal frames the selection, inside the camera's own band", () => {
  test("AC-3: revealCamera centres on the box and leaves room around it", async () => {
    const { revealCamera } = await flytoModule();
    const band = await scaleBand();

    const camera = revealCamera(BOX, VIEWPORT);
    expect([camera.centre[0], camera.centre[1]], "the camera looks at the centre of the box it was given").toStrictEqual(centreOf(BOX));

    expect(Number.isFinite(camera.scale) && camera.scale > 0, `the answered scale is a real scale: ${camera.scale}`).toBe(true);
    expect(camera.scale, "and it is inside the band the camera clamps every scale into").toBeGreaterThanOrEqual(band.min);
    expect(camera.scale, "and it is inside the band the camera clamps every scale into").toBeLessThanOrEqual(band.max);

    const visible = { width: VIEWPORT.width / camera.scale, height: VIEWPORT.height / camera.scale };
    const width = BOX.max[0] - BOX.min[0];
    const height = BOX.max[1] - BOX.min[1];
    expect(visible.width, `the whole box is on screen across (${visible.width} world units for a box ${width} wide)`).toBeGreaterThan(width);
    expect(visible.height, `the whole box is on screen down (${visible.height} world units for a box ${height} tall)`).toBeGreaterThan(height);
    // Padded, not merely fitted: the selection arrives with sheet around it rather than touching
    // both edges of the stage, so a reader can see what it was found among (Decision §5).
    expect(Math.min(visible.width / width, visible.height / height), "the box is padded rather than pressed against the edges").toBeGreaterThan(1);
  });

  test("AC-3: the frame is the selection's own size — the same padding, whatever the box", async () => {
    const { revealCamera } = await flytoModule();

    // Two boxes of the same shape, one a hundred times the other. Padding is stated as a ratio of the
    // box's own extent (§5), so the frame each is shown in is the same multiple of itself — which a
    // camera that always answered one fixed, sheet-wide scale could not be.
    const small: IndexBox = { min: [100, 100], max: [110, 110] };
    const large: IndexBox = { min: [100, 100], max: [1100, 1100] };
    const framed = (box: IndexBox): number => {
      const camera = revealCamera(box, VIEWPORT);
      const width = box.max[0] - box.min[0];
      const height = box.max[1] - box.min[1];
      return Math.min(VIEWPORT.width / camera.scale / width, VIEWPORT.height / camera.scale / height);
    };

    const tight = framed(small);
    const wide = framed(large);
    expect(tight, `a selection is framed with room around it, not pressed to the edge (${tight})`).toBeGreaterThan(1);
    expect(tight, `and it is framed ON the selection, not lost in the sheet around it (${tight})`).toBeLessThan(2);
    expect(wide, `the same holds for a box a hundred times larger (${wide})`).toBeGreaterThan(1);
    expect(Math.abs(tight - wide) / tight, `the padding is a ratio, so both boxes are framed alike (${tight} vs ${wide})`).toBeLessThan(0.01);

    const ratio = revealCamera(small, VIEWPORT).scale / revealCamera(large, VIEWPORT).scale;
    expect(Math.abs(ratio - 100) / 100, `and a box a hundred times smaller is seen a hundred times closer (${ratio})`).toBeLessThan(0.01);
  });

  test("AC-3: a box of no extent is still somewhere the camera can stand", async () => {
    const { revealCamera } = await flytoModule();
    const band = await scaleBand();

    const camera = revealCamera(DEGENERATE, VIEWPORT);
    expect([camera.centre[0], camera.centre[1]], "a single point is looked at exactly").toStrictEqual(centreOf(DEGENERATE));
    expect(Number.isFinite(camera.scale) && camera.scale > 0, `a degenerate box answers a real scale rather than an infinity: ${camera.scale}`).toBe(true);
    expect(camera.scale, "and that scale is inside the camera's own band").toBeLessThanOrEqual(band.max);
    expect(VIEWPORT.width / camera.scale, "so a point selected on its own is seen with the sheet around it, not through a needle").toBeGreaterThan(0);
  });
});

describe("AC-3: the travel starts where the camera is and ends where the reveal is", () => {
  test("AC-3: a zero duration is already there, and time past the duration stays there", async () => {
    const { revealCamera, flyTo } = await flytoModule();
    const client = await viewerClient();
    const from = client.fitCamera(EXTENTS, VIEWPORT);
    const to = revealCamera(BOX, VIEWPORT);

    const instant = flyTo(from, to, 0, 0);
    expect({ centre: [instant.centre[0], instant.centre[1]], scale: instant.scale }, "reduced motion zeroes the duration at source, so the first frame is the destination (§4)").toStrictEqual({
      centre: [to.centre[0], to.centre[1]],
      scale: to.scale,
    });

    const landed = flyTo(from, to, DURATION_MS, DURATION_MS);
    expect({ centre: [landed.centre[0], landed.centre[1]], scale: landed.scale }, "the last frame of the travel is the destination").toStrictEqual({
      centre: [to.centre[0], to.centre[1]],
      scale: to.scale,
    });

    const overrun = flyTo(from, to, DURATION_MS * 4, DURATION_MS);
    expect({ centre: [overrun.centre[0], overrun.centre[1]], scale: overrun.scale }, "and a frame that arrives late does not carry on past it").toStrictEqual({
      centre: [to.centre[0], to.centre[1]],
      scale: to.scale,
    });
  });

  test("AC-3: the first frame is where the camera stood, and the middle is between the two", async () => {
    const { revealCamera, flyTo } = await flytoModule();
    const client = await viewerClient();
    const from = client.fitCamera(EXTENTS, VIEWPORT);
    const to = revealCamera(BOX, VIEWPORT);

    const start: Camera = flyTo(from, to, 0, DURATION_MS);
    expect({ centre: [start.centre[0], start.centre[1]], scale: start.scale }, "a travel begins at the camera it was given").toStrictEqual({
      centre: [from.centre[0], from.centre[1]],
      scale: from.scale,
    });

    const middle = flyTo(from, to, DURATION_MS / 2, DURATION_MS);
    for (const axis of [0, 1] as const) {
      const lower = Math.min(from.centre[axis], to.centre[axis]);
      const upper = Math.max(from.centre[axis], to.centre[axis]);
      expect(middle.centre[axis], `half way along, axis ${axis} of the camera lies between where it started and where it is going`).toBeGreaterThanOrEqual(lower);
      expect(middle.centre[axis], `half way along, axis ${axis} of the camera lies between where it started and where it is going`).toBeLessThanOrEqual(upper);
      if (from.centre[axis] !== to.centre[axis]) {
        expect(middle.centre[axis], `and on axis ${axis} it has actually moved off the start`).not.toBe(from.centre[axis]);
        expect(middle.centre[axis], `and on axis ${axis} it has not arrived early`).not.toBe(to.centre[axis]);
      }
    }
  });
});
