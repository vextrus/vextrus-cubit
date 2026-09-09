// @vitest-environment jsdom
/**
 * AC-2, AC-3 and AC-4's screen half — `ViewerScreen` mounted over a supplied head (and, for the
 * metres, over a supplied `?part=calibration` answer), driven the way a reader drives it: the
 * pointer over the sheet, Alt+click and Enter for a pick, Escape to let go, and the roster's own key
 * for the toggle (R-TO-012, R-UI-041, R-UI-032, R-UI-060, I-145…I-151).
 *
 * What is judged is what a journey and an operator read: the test ids the Decision closes (§7), the
 * `data-` hooks it names, and the copy the one string table carries. Nothing here reads product
 * source, and nothing here freezes a snapshot — every expected figure is derived from the geometry
 * under test through the product's own `distanceBetween`, `metresBetween` and `quantise` (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  KIND_COPY_KEY,
  SNAP_EXTENTS,
  SNAP_SHORTCUT_ID,
  TESTID,
  VIEW_P,
  VIEW_Q,
  altClickWorld,
  cell,
  cells,
  copy,
  formatModule,
  hook,
  hoverWorld,
  keysModule,
  mountSnapScreen,
  plainClickWorld,
  press,
  pressButton,
  pressed,
  rosterModule,
  snapKeyEvent,
  snapModule,
  stringsModule,
  unmountSnap,
  type Point,
  type SnapMount,
} from "./support/snap-support";

/**
 * The seam the screen reaches through reads a record before it builds, so its module graph reaches
 * the store. Nothing here opens a connection, but the address must be stated before the import so
 * the pool is constructed rather than refused as unconfigured.
 */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** The endpoint of the staged horizontal line (`SNAP_KEYS.h`) at the origin — where every case that needs a live snap puts the pointer. */
const ENDPOINT: Point = [0, 0];

/** The other endpoint of the same segment — the second pick, 100 drawing units away. */
const FAR_ENDPOINT: Point = [100, 0];

/** A point of bare paper: every feature of the staged geometry stands 20 drawing units or more away. */
const BARE: Point = [70, 40];

/** A calibration of record over the view the whole staged sheet stands in (AC-4's answer shape). */
const CALIBRATED = {
  ingestId: "ingest-snap-readout",
  views: [{ viewKey: VIEW_P, box: { min: [...SNAP_EXTENTS.min], max: [...SNAP_EXTENTS.max] }, factorX: "0.012500000000", factorY: "0.025000000000" }],
};

/** A calibration of record over a view the picks do NOT stand in — affirmed, but not here. */
const ELSEWHERE = {
  ingestId: "ingest-snap-readout",
  views: [{ viewKey: VIEW_Q, box: { min: [500, 500], max: [600, 600] }, factorX: "0.012500000000", factorY: "0.025000000000" }],
};

afterEach(() => {
  unmountSnap();
});

/** The three toolbar toggles of a mount, by the ids the contract closes. */
function tools(mount: SnapMount): { toggle: HTMLElement; ortho: HTMLElement; angle: HTMLElement } {
  return { toggle: cell(mount, TESTID.toggle), ortho: cell(mount, TESTID.ortho), angle: cell(mount, TESTID.angle) };
}

/** The one glyph in reach, refused where the overlay carries more or fewer than one. */
function theGlyph(mount: SnapMount): HTMLElement {
  const held = cells(mount, TESTID.glyph);
  expect(held.length, "exactly one snap glyph stands on the overlay: a second would be a second answer to one question (Decision §1)").toBe(1);
  return held[0] as HTMLElement;
}

/** The picks standing, in the order the overlay indexes them. */
function picksTaken(mount: SnapMount): HTMLElement[] {
  return cells(mount, TESTID.pick).sort((left, right) => Number(hook(left, "data-index")) - Number(hook(right, "data-index")));
}

/** Focus put on the canvas — the keyboard's own path to this region (R-UI-060). */
function focusCanvas(mount: SnapMount): void {
  mount.canvas.focus();
  expect(document.activeElement, "the sheet takes keyboard focus, which is where every viewer key is answered (R-UI-060)").toBe(mount.canvas);
}

/** The step the roster binds this region under, pressed on the focused canvas. */
async function pressSnapKey(mount: SnapMount): Promise<void> {
  focusCanvas(mount);
  await press(mount.canvas, await snapKeyEvent());
}

describe("AC-2: the glyph and the snap cell say what is under the pointer, by shape and by word", () => {
  test("AC-2: a hover in reach of an endpoint mounts one glyph and names the kind and the key it snapped to", async () => {
    const mount = await mountSnapScreen();
    const { quantise } = await keysModule();
    const snap = await snapModule();
    const tool = tools(mount);

    expect(pressed(tool.toggle), "every mount opens with snapping on (I-148)").toBe(true);
    expect(
      tool.toggle.getAttribute("aria-keyshortcuts"),
      "the toggle states its key from the ONE roster of bindings, so what the product documents and what it binds cannot drift apart (R-UI-032, B-17)",
    ).toBe((await rosterModule()).shortcutById(SNAP_SHORTCUT_ID).keys.join(" "));
    expect(pressed(tool.ortho), "and ortho released").toBe(false);
    expect(pressed(tool.angle), "and angle lock released").toBe(false);

    await hoverWorld(mount, ENDPOINT);

    const glyph = theGlyph(mount);
    expect(hook(glyph, "data-kind"), "the kind is published on the glyph, and the stylesheet gives that kind its own shape (R-UI-060: never colour alone)").toBe("endpoint");
    expect(snap.SNAP_KINDS, "and it is one of the closed roster").toContain(hook(glyph, "data-kind"));
    expect(hook(glyph, "data-source").length, "the glyph names the source key it snapped to").toBeGreaterThan(0);
    expect(hook(glyph, "data-motion"), "and how it drew itself in, as `prefers-reduced-motion` reads (R-UI-004)").toBe("full");

    const cellSnap = cell(mount, TESTID.statusSnap);
    expect(hook(cellSnap, "data-enabled"), "snapping is on").toBe("true");
    expect(hook(cellSnap, "data-kind"), "and the readout names the same kind the glyph draws").toBe(hook(glyph, "data-kind"));
    expect(hook(cellSnap, "data-source"), "and the same source key").toBe(hook(glyph, "data-source"));

    const keyX = hook(cellSnap, "data-key-x");
    const keyY = hook(cellSnap, "data-key-y");
    expect([keyX, keyY], "the cell publishes the snapped point on the register's one lattice (L-REG-04)").toEqual([quantise(ENDPOINT[0]), quantise(ENDPOINT[1])]);

    const word = await copy(KIND_COPY_KEY["endpoint"] as string);
    expect(cellSnap.textContent ?? "", "the kind is a WORD as well as a shape — nothing here is colour-only (R-UI-060)").toContain(word);
    for (const key of hook(cellSnap, "data-source").split(" ")) {
      expect(cellSnap.textContent ?? "", `the source key ${key} is rendered whole and verbatim (I-26)`).toContain(key);
    }
  });

  test("AC-2: a hover in reach of nothing mounts no glyph and says so", async () => {
    const mount = await mountSnapScreen();
    await hoverWorld(mount, ENDPOINT);
    expect(cells(mount, TESTID.glyph).length, "a snap stands under the pointer to begin with").toBe(1);

    await hoverWorld(mount, BARE);
    expect(cells(mount, TESTID.glyph).length, "over bare paper nothing is in reach, so no glyph is drawn").toBe(0);
    const cellSnap = cell(mount, TESTID.statusSnap);
    expect(hook(cellSnap, "data-kind"), "and the cell says nothing is in reach rather than standing empty (R-UI-020)").toBe("none");
    expect(hook(cellSnap, "data-enabled"), "snapping is still on — nothing is in reach, which is not the same as being off").toBe("true");
    expect((cellSnap.textContent ?? "").trim(), "the cell carries the sentence the register writes for that").toContain(await copy("viewer_status_snap_none"));
  });

  test("AC-2: the S the roster binds turns snapping off and on, and nothing is snapped while it is off", async () => {
    const mount = await mountSnapScreen();
    const tool = tools(mount);
    await hoverWorld(mount, ENDPOINT);
    expect(cells(mount, TESTID.glyph).length, "a snap stands under the pointer to begin with").toBe(1);

    await pressSnapKey(mount);

    expect(pressed(tool.toggle), "the roster's own key flips the toolbar's Snap — one roster, one binding (R-UI-032, B-17)").toBe(false);
    const cellSnap = cell(mount, TESTID.statusSnap);
    expect(hook(cellSnap, "data-enabled"), "and the readout follows it").toBe("false");
    expect(hook(cellSnap, "data-kind"), "off is its own answer, told apart from nothing being in reach").toBe("off");
    expect((cellSnap.textContent ?? "").trim(), "and it is said in words").toContain(await copy("viewer_status_snap_off"));

    await hoverWorld(mount, ENDPOINT);
    expect(cells(mount, TESTID.glyph).length, "with snapping off no glyph mounts at all, wherever the pointer stands").toBe(0);

    await pressSnapKey(mount);
    expect(pressed(tool.toggle), "and the same key turns it back on").toBe(true);
    await hoverWorld(mount, ENDPOINT);
    expect(cells(mount, TESTID.glyph).length, "so the sheet snaps again").toBe(1);
  });

  test("AC-2: under prefers-reduced-motion the glyph publishes the reading the token was zeroed by", async () => {
    const mount = await mountSnapScreen({ reduced: true });
    await hoverWorld(mount, ENDPOINT);
    expect(hook(theGlyph(mount), "data-motion"), "the duration token is zeroed at source, and the glyph publishes the same reading for a journey to grade (R-UI-004)").toBe("reduced");
  });
});

describe("AC-3: two picks, and the drawing-unit figure between them", () => {
  test("AC-3: Alt+click takes pick 1 at the snapped point, and the figure follows the pointer", async () => {
    const mount = await mountSnapScreen();
    const snap = await snapModule();
    const { formatUserFigure } = await formatModule();
    const { fill } = await stringsModule();

    const distanceCell = cell(mount, TESTID.statusDistance);
    expect(hook(distanceCell, "data-picks"), "no pick stands at mount").toBe("0");
    expect((distanceCell.textContent ?? "").trim(), "and the cell says so rather than standing empty (R-UI-020)").toContain(await copy("viewer_status_distance_none"));

    await hoverWorld(mount, ENDPOINT);
    const selectionBefore = hook(mount.status, "data-selection");
    await altClickWorld(mount, ENDPOINT);

    const pick = picksTaken(mount);
    expect(pick.length, "one pick stands on the overlay").toBe(1);
    expect(hook(pick[0] as HTMLElement, "data-index"), "and it is the first").toBe("1");
    expect(hook(pick[0] as HTMLElement, "data-source"), "sourced by the keys the snap it was taken at named").toBe(hook(cell(mount, TESTID.statusSnap), "data-source"));
    expect(hook(mount.status, "data-selection"), "a pick is not a selection: Alt+click never enters the select path (I-145)").toBe(selectionBefore);
    expect(hook(distanceCell, "data-picks"), "the readout counts the pick").toBe("1");

    await hoverWorld(mount, FAR_ENDPOINT);
    const dx = Number(hook(distanceCell, "data-dx"));
    const dy = Number(hook(distanceCell, "data-dy"));
    const live: Point = [Number(hook(cell(mount, TESTID.statusSnap), "data-key-x")), Number(hook(cell(mount, TESTID.statusSnap), "data-key-y"))];
    expect([dx, dy], "the offsets are the live point minus pick 1, in drawing units").toEqual([live[0] - ENDPOINT[0], live[1] - ENDPOINT[1]]);
    expect(
      (distanceCell.textContent ?? "").trim(),
      "and the figure is `distanceBetween` rendered to one decimal through the figure seam (R-SPINE-010)",
    ).toContain(fill(await copy("viewer_status_distance_units"), { distance: formatUserFigure(snap.distanceBetween(ENDPOINT, live).toFixed(1)) }));
  });

  test("AC-3: Enter on the focused canvas takes a pick too, and a second one freezes the figure", async () => {
    const mount = await mountSnapScreen();
    const snap = await snapModule();
    const { formatUserFigure } = await formatModule();
    const { fill } = await stringsModule();
    const distanceCell = cell(mount, TESTID.statusDistance);

    await hoverWorld(mount, ENDPOINT);
    focusCanvas(mount);
    await press(mount.canvas, { key: "Enter" });
    expect(hook(distanceCell, "data-picks"), "Enter on the focused canvas is the pick gesture's accessible equal (R-UI-060, I-145)").toBe("1");

    await hoverWorld(mount, FAR_ENDPOINT);
    focusCanvas(mount);
    await press(mount.canvas, { key: "Enter" });
    expect(hook(distanceCell, "data-picks"), "and a second press takes the second pick").toBe("2");

    const taken = picksTaken(mount).map((mark) => [Number(hook(mark, "data-key-x")), Number(hook(mark, "data-key-y"))] as Point);
    expect(taken.length, "both picks stand on the overlay").toBe(2);
    const frozen = (distanceCell.textContent ?? "").trim();
    expect(frozen, "the figure is now the distance between the two points of record").toContain(
      fill(await copy("viewer_status_distance_units"), { distance: formatUserFigure(snap.distanceBetween(taken[0] as Point, taken[1] as Point).toFixed(1)) }),
    );

    await hoverWorld(mount, BARE);
    expect((distanceCell.textContent ?? "").trim(), "and moving the pointer no longer moves it — two picks are two points of record").toBe(frozen);
    expect([Number(hook(distanceCell, "data-dx")), Number(hook(distanceCell, "data-dy"))], "as are the offsets it publishes").toEqual([
      (taken[1] as Point)[0] - (taken[0] as Point)[0],
      (taken[1] as Point)[1] - (taken[0] as Point)[1],
    ]);
  });

  test("AC-3: Escape lets go of the picks", async () => {
    const mount = await mountSnapScreen();
    const distanceCell = cell(mount, TESTID.statusDistance);
    await hoverWorld(mount, ENDPOINT);
    await altClickWorld(mount, ENDPOINT);
    await hoverWorld(mount, FAR_ENDPOINT);
    await altClickWorld(mount, FAR_ENDPOINT);
    expect(hook(distanceCell, "data-picks"), "two picks stand").toBe("2");

    focusCanvas(mount);
    await press(mount.canvas, { key: "Escape" });

    expect(hook(distanceCell, "data-picks"), "one press of Escape clears them (I-145)").toBe("0");
    expect(cells(mount, TESTID.pick).length, "and takes their marks off the overlay").toBe(0);
    expect((distanceCell.textContent ?? "").trim(), "and the cell says there are none rather than standing empty").toContain(await copy("viewer_status_distance_none"));
  });

  test("AC-3: ortho and angle lock constrain the live point relative to pick 1, and release each other", async () => {
    const mount = await mountSnapScreen();
    const tool = tools(mount);
    const distanceCell = cell(mount, TESTID.statusDistance);
    const snap = await snapModule();

    expect((tool.ortho.textContent ?? "").trim(), "the toolbar names ortho in words").toContain(await copy("viewer_snap_ortho"));
    expect((tool.angle.textContent ?? "").trim(), "and angle lock").toContain(await copy("viewer_snap_angle"));

    await hoverWorld(mount, ENDPOINT);
    await altClickWorld(mount, ENDPOINT);

    await pressButton(tool.ortho);
    await hoverWorld(mount, [60, 30]);
    expect(pressed(tool.ortho), "ortho is pressed").toBe(true);
    expect(pressed(tool.angle), "and angle lock is not — two constraints on one segment would be one constraint with a hidden winner (I-148)").toBe(false);
    const orthoOff = [Number(hook(distanceCell, "data-dx")), Number(hook(distanceCell, "data-dy"))];
    expect(orthoOff[0] === 0 || orthoOff[1] === 0, `ortho leaves the segment on one world axis: it reads (${orthoOff.join(", ")})`).toBe(true);

    await pressButton(tool.angle);
    await hoverWorld(mount, [60, 30]);
    expect(pressed(tool.angle), "pressing angle lock presses it").toBe(true);
    expect(pressed(tool.ortho), "and releases ortho").toBe(false);
    const angleOff = [Number(hook(distanceCell, "data-dx")), Number(hook(distanceCell, "data-dy"))];
    const steps = (Math.atan2(angleOff[1] as number, angleOff[0] as number) * 180) / Math.PI / snap.ANGLE_STEP_DEG;
    expect(Math.abs(steps - Math.round(steps)), `the direction is a whole number of ${snap.ANGLE_STEP_DEG}° steps: it reads (${angleOff.join(", ")})`).toBeLessThan(1e-6);
  });
});

describe("AC-4: metres beside the drawing units, once the view the picks stand in is affirmed", () => {
  test("AC-4: two picks inside one calibrated view read in metres as well as in drawing units", async () => {
    const mount = await mountSnapScreen({ calibration: CALIBRATED });
    const snap = await snapModule();
    const { formatUserFigure } = await formatModule();
    const { fill } = await stringsModule();
    const distanceCell = cell(mount, TESTID.statusDistance);

    await hoverWorld(mount, ENDPOINT);
    await altClickWorld(mount, ENDPOINT);
    await hoverWorld(mount, FAR_ENDPOINT);
    await altClickWorld(mount, FAR_ENDPOINT);

    const taken = picksTaken(mount).map((mark) => [Number(hook(mark, "data-key-x")), Number(hook(mark, "data-key-y"))] as Point);
    expect(taken.length, "two picks stand").toBe(2);
    const view = CALIBRATED.views[0] as { viewKey: string; factorX: string; factorY: string };

    expect(hook(distanceCell, "data-si"), "both picks stand inside one view an affirmation of record names (I-146)").toBe("calibrated");
    expect(hook(distanceCell, "data-view-key"), "and the cell names which view it read the factors off").toBe(view.viewKey);

    const text = (distanceCell.textContent ?? "").trim();
    expect(text, "the metre figure is `metresBetween` under that view's own two factors, never a mean of them (L-MEA-05)").toContain(
      fill(await copy("viewer_status_distance_metres"), { metres: formatUserFigure(snap.metresBetween(taken[0] as Point, taken[1] as Point, view)) }),
    );
    expect(text, "and it stands BESIDE the drawing-unit figure, never instead of it (R-UI-041)").toContain(
      fill(await copy("viewer_status_distance_units"), { distance: formatUserFigure(snap.distanceBetween(taken[0] as Point, taken[1] as Point).toFixed(1)) }),
    );
  });

  test("AC-4: picks in a view no affirmation of record names read in drawing units alone", async () => {
    const mount = await mountSnapScreen({ calibration: ELSEWHERE });
    const snap = await snapModule();
    const { formatUserFigure } = await formatModule();
    const { fill } = await stringsModule();
    const distanceCell = cell(mount, TESTID.statusDistance);

    await hoverWorld(mount, ENDPOINT);
    await altClickWorld(mount, ENDPOINT);
    await hoverWorld(mount, FAR_ENDPOINT);
    await altClickWorld(mount, FAR_ENDPOINT);

    const taken = picksTaken(mount).map((mark) => [Number(hook(mark, "data-key-x")), Number(hook(mark, "data-key-y"))] as Point);
    expect(hook(distanceCell, "data-si"), "the affirmed view is elsewhere on the drawing, so nothing here is calibrated").toBe("uncalibrated");
    expect(distanceCell.getAttribute("data-view-key"), "and no view is named, because none of them measured this").toBeNull();
    expect((distanceCell.textContent ?? "").trim(), "the drawing-unit figure still stands — drawing units always, SI when calibrated (R-UI-041)").toContain(
      fill(await copy("viewer_status_distance_units"), { distance: formatUserFigure(snap.distanceBetween(taken[0] as Point, taken[1] as Point).toFixed(1)) }),
    );
    expect((distanceCell.textContent ?? "").trim(), "and the cell says why there are no metres rather than falling silent (R-UI-020)").toContain(
      await copy("viewer_status_distance_uncalibrated"),
    );
  });

  test("AC-4: with no calibration answered at all, the cell still measures in drawing units", async () => {
    const mount = await mountSnapScreen({ calibration: null });
    const distanceCell = cell(mount, TESTID.statusDistance);

    await hoverWorld(mount, ENDPOINT);
    await altClickWorld(mount, ENDPOINT);
    await hoverWorld(mount, FAR_ENDPOINT);
    await altClickWorld(mount, FAR_ENDPOINT);

    expect(hook(distanceCell, "data-picks"), "the two picks stand whatever the feed answered about scale").toBe("2");
    expect(hook(distanceCell, "data-si"), "a drawing nothing has affirmed measures in its own units").toBe("uncalibrated");
  });
});

describe("AC-3: the gestures this region does not own behave exactly as they did", () => {
  test("AC-3: a plain click is still selection, and takes no pick", async () => {
    const mount = await mountSnapScreen();
    const distanceCell = cell(mount, TESTID.statusDistance);
    await hoverWorld(mount, ENDPOINT);
    await plainClickWorld(mount, ENDPOINT);
    expect(hook(distanceCell, "data-picks"), "a pick is Alt+click or Enter, never the plain click that is selection under J-011 and J-000 (I-145)").toBe("0");
    expect(cells(mount, TESTID.pick).length, "and no mark is put on the overlay").toBe(0);
  });
});
