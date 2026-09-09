/**
 * J-020 — the snapping leg of the scale journey (the served halves of AC-2 and AC-3): a staged sheet
 * opened, the pointer put on a point of the drawing, the glyph that names what it met by SHAPE and
 * the readout that names it by WORD, the S the roster binds, two picks and the distance between them
 * in the drawing's own units (R-TO-012, R-UI-041, R-UI-032, R-UI-004, R-UI-060, V-E2E).
 *
 * The gate runs `pnpm e2e --journey J-020`, which is Playwright's title grep — so every title here
 * names J-020. The rest of J-020 — proposals, the two-point calibration act, the scale panel and the
 * hatched unplaceable view — is inc-204's screen leaf; this leg only reads.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, asked for by name below exactly as the
 * viewer journey asks (playwright.config.ts is locked).
 *
 * Nothing is transcribed. The points this journey snaps to are read off the served layer feed and
 * chosen by how clear of every other point they stand, the copy is read from the product's own
 * string registry by key, and every figure is compared against what the screen itself publishes
 * (B-19).
 */
import { expect, test } from "@playwright/test";
import { formatUserFigure } from "../../../src/core/format";
import { quantise } from "../../../src/core/identity/keys";
import { strings } from "../../../src/ui/strings";
import { checkpoint } from "../support/checkpoint";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { SViewerSnapPage } from "../viewer/s-viewer-snap.page";
import { stageSyntheticSheet } from "../viewer/viewer-stage";

/** A sheet with room for a point to stand well clear of its neighbours, and small enough to list. */
const ENTITIES = 250;

/**
 * How far clear of every other record's drawn points the anchors this journey snaps to must stand,
 * in drawing units. `SNAP_TOLERANCE_PX` is 8 px, and the whole sheet fits its stage at rather more
 * than a pixel to the unit, so this is several times the reach of a snap at the opening camera.
 */
const CLEARANCE = 25;

/** How far clear of its OWN record's other points a midpoint must stand for that midpoint to be met. */
const OWN_CLEARANCE = 20;

/** The drawn type this journey takes its anchors from: a segment has two ends and one middle. */
const LINE = "LINE";

/** One registered string, read by key: this journey is written before the table carries it. */
function copy(key: string): string {
  const held = (strings as unknown as Record<string, string>)[key];
  expect(typeof held, `the string registry carries \`${key}\` (R-SPINE-060)`).toBe("string");
  return held as string;
}

/** A registered string with its slots filled — the product's own substitution, restated for the lane. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-020 — snapping: the glyph that names what is under the pointer, and the distance between two picks", () => {
  test("J-020: a reader snaps to a point of the drawing, reads what it met, and measures between two picks", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();

    const staged = await stageSyntheticSheet(page, { entities: ENTITIES });
    const viewer = new SViewerPage(page);
    const snap = new SViewerSnapPage(page);

    /* --- the sheet, opened and drawn --- */
    await page.goto(S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName), { waitUntil: "commit" });
    await expect(viewer.status, "the staged sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer of the sheet arrives before it is snapped to" })
      .toBe(true);
    await viewer.fit.click();

    /* --- the toolbar, as every mount opens (I-148) --- */
    await expect(snap.toggle, "the stage carries a Snap toggle, named in words").toContainText(copy("viewer_snap_toggle"));
    expect(await snap.isPressed(snap.toggle), "snapping starts on").toBe(true);
    expect(await snap.isPressed(snap.ortho), "ortho starts released").toBe(false);
    expect(await snap.isPressed(snap.angle), "angle lock starts released").toBe(false);
    await expect(snap.statusDistance, "and no pick stands").toHaveAttribute("data-picks", "0");
    await expect(snap.statusDistance).toContainText(copy("viewer_status_distance_none"));

    /* --- the anchors this journey snaps to, read off the served feed --- */
    const records = await snap.sheetRecords(staged, staged.layerNames.length);
    const features = SViewerSnapPage.featuresOf(records);
    const endpoint = SViewerSnapPage.isolated(features, { kind: "endpoint", type: LINE, clearance: CLEARANCE });
    const middle = SViewerSnapPage.isolated(features, { kind: "midpoint", type: LINE, clearance: CLEARANCE, ownClearance: OWN_CLEARANCE });
    const second = SViewerSnapPage.isolated(features, { kind: "midpoint", type: LINE, clearance: CLEARANCE, ownClearance: OWN_CLEARANCE, notKey: endpoint.key });
    expect(second.key, "the two picks this journey takes stand on two different records").not.toBe(endpoint.key);
    const bare = SViewerSnapPage.emptiest(features);
    expect(bare.clear, "and the patch of bare paper it hovers stands well outside the reach of any snap").toBeGreaterThan(CLEARANCE);

    /* --- j-020-snap-glyph: the pointer on an endpoint --- */
    await snap.hoverAt(await viewer.screenPointOf(endpoint.at));
    await expect(snap.glyph, "one glyph stands where the pointer met the drawing — never two answers to one question").toHaveCount(1);
    await expect(snap.glyph, "and it names what it met, which is what gives it its shape (R-UI-060: never colour alone)").toHaveAttribute("data-kind", "endpoint");
    await expect(snap.statusSnap, "snapping is on").toHaveAttribute("data-enabled", "true");
    await expect(snap.statusSnap, "and the readout names the same kind").toHaveAttribute("data-kind", "endpoint");
    await expect(snap.statusSnap, "in the drawing office's own word, so the meaning is not carried by a shape alone").toContainText(copy("viewer_snap_kind_endpoint"));

    const source = await snap.hook(snap.glyph, "data-source");
    expect(source.length, "the glyph names the source key it snapped to").toBeGreaterThan(0);
    expect(await snap.hook(snap.statusSnap, "data-source"), "and the readout names the same key").toBe(source);
    await expect(snap.statusSnap, "rendering it whole and verbatim, as model data (I-26)").toContainText(source.split(" ")[0] as string);

    // Nothing else the sheet draws stands within CLEARANCE of that anchor, so what the pointer met
    // can only be that end — and the readout keys it on the register's one lattice (L-REG-04).
    expect(
      [await snap.hook(snap.statusSnap, "data-key-x"), await snap.hook(snap.statusSnap, "data-key-y")],
      `the readout keys the drawing's own point (${endpoint.at.join(", ")}) as \`quantise\` spells it`,
    ).toEqual([quantise(endpoint.at[0]), quantise(endpoint.at[1])]);

    const glyphColour = await snap.glyphStyle("border-top-color");
    expect(glyphColour, "the glyph is painted in the sheet's own snap token, never a colour spelled in a stylesheet (R-UI-001, Decision §5)").toBe(
      await snap.resolvedColour("--canvas-snap"),
    );
    const endpointShape = await snap.shapeSignature();
    await checkpoint(page, testInfo, "j-020-snap-glyph");

    /* --- the shape is the kind's, not one shape wearing two colours (AC-2, R-UI-060) --- */
    await snap.hoverAt(await viewer.screenPointOf(middle.at));
    await expect(snap.glyph, "the middle of an isolated segment is met by something that is not its end").not.toHaveAttribute("data-kind", "endpoint");
    const otherKind = await snap.hook(snap.glyph, "data-kind");
    expect(await snap.shapeSignature(), `a ${otherKind} is drawn as a different shape from an endpoint — the kind is not carried by colour (R-UI-060)`).not.toBe(endpointShape);
    expect(await snap.glyphStyle("border-top-color"), "and both are painted in the sheet's one snap colour").toBe(glyphColour);
    await expect(snap.statusSnap, "and the readout names this kind in words too").toContainText(copy(`viewer_snap_kind_${otherKind}`));

    /* --- over bare paper nothing is in reach, and the cell says so rather than falling silent --- */
    await snap.hoverAt(await viewer.screenPointOf(bare.at));
    await expect(snap.statusSnap, `nothing the sheet draws stands within ${bare.clear.toFixed(1)} drawing units of that point`).toHaveAttribute("data-kind", "none");
    await expect(snap.glyph, "so no glyph is drawn").toHaveCount(0);
    await expect(snap.statusSnap).toContainText(copy("viewer_status_snap_none"));

    /* --- the S the roster binds, on the focused canvas (R-UI-032, B-17) --- */
    await viewer.canvas.focus();
    await page.keyboard.press("s");
    expect(await snap.isPressed(snap.toggle), "the roster's own key flips the toolbar's Snap").toBe(false);
    await expect(snap.statusSnap, "and the readout follows it").toHaveAttribute("data-enabled", "false");
    await expect(snap.statusSnap, "off is its own answer, told apart from nothing being in reach").toHaveAttribute("data-kind", "off");
    await snap.hoverAt(await viewer.screenPointOf(endpoint.at));
    await expect(snap.glyph, "with snapping off no glyph mounts at all").toHaveCount(0);

    /* --- the gestures this leaf does not own behave exactly as they did (I-145) --- */
    const selectionBefore = await viewer.statusNumber("data-selection");
    await viewer.clickAt(await viewer.screenPointOf(endpoint.at));
    await expect
      .poll(async () => viewer.statusNumber("data-selection"), { message: "a plain click is still selection, snapping on or off (J-011, J-000)" })
      .toBeGreaterThan(selectionBefore);
    await expect(snap.statusDistance, "and it takes no pick").toHaveAttribute("data-picks", "0");

    await viewer.canvas.focus();
    await page.keyboard.press("s");
    expect(await snap.isPressed(snap.toggle), "the same key turns snapping back on").toBe(true);

    /* --- j-020-snap-readout: two picks, and the distance between them in drawing units --- */
    await snap.pickAt(await viewer.screenPointOf(endpoint.at));
    await expect(snap.picks, "Alt+click takes a pick and puts its mark on the overlay (I-145)").toHaveCount(1);
    await expect(snap.statusDistance).toHaveAttribute("data-picks", "1");
    await expect(snap.picks.first()).toHaveAttribute("data-index", "1");

    await snap.pickAt(await viewer.screenPointOf(second.at));
    await expect(snap.picks, "and a second Alt+click takes the second").toHaveCount(2);
    await expect(snap.statusDistance).toHaveAttribute("data-picks", "2");

    // Each pick stands on the point the drawing itself draws, carried onto the register's 0.1
    // lattice — so the keyed point is half a lattice step from the anchor at most, and the distance
    // the readout states is the distance between the two anchors (L-REG-04).
    const taken = await Promise.all(
      (await snap.picks.all()).map(async (mark) => ({
        index: await snap.hook(mark, "data-index"),
        keyed: [await snap.hook(mark, "data-key-x"), await snap.hook(mark, "data-key-y")],
      })),
    );
    expect(taken.map((mark) => mark.index).sort(), "the two picks are the first and the second, and say which is which").toEqual(["1", "2"]);
    for (const [ordinal, anchor] of [endpoint.at, second.at].entries()) {
      const mark = taken.find((one) => one.index === String(ordinal + 1));
      expect(mark?.keyed, `pick ${ordinal + 1} stands on (${anchor.join(", ")}) as the register's lattice spells it (L-REG-04)`).toEqual([quantise(anchor[0]), quantise(anchor[1])]);
    }
    const between = Math.hypot(second.at[0] - endpoint.at[0], second.at[1] - endpoint.at[1]);
    await expect(snap.statusDistance, "and the readout measures between them, in the drawing's own units (R-UI-041)").toContainText(
      fill(copy("viewer_status_distance_units"), { distance: formatUserFigure(between.toFixed(1)) }),
    );
    await expect(snap.statusDistance, "nothing has affirmed a scale on this drawing, so there are no metres to show").toHaveAttribute("data-si", "uncalibrated");
    await expect(snap.statusDistance, "and the cell says why rather than falling silent (R-UI-020)").toContainText(copy("viewer_status_distance_uncalibrated"));

    await snap.ortho.click();
    expect(await snap.isPressed(snap.ortho), "ortho is pressed").toBe(true);
    expect(await snap.isPressed(snap.angle), "and angle lock is released — two constraints on one segment would be one with a hidden winner (I-148)").toBe(false);
    await checkpoint(page, testInfo, "j-020-snap-readout");

    /* --- Escape lets go of the picks, and then of the selection, in that order (I-145) --- */
    await viewer.canvas.focus();
    await page.keyboard.press("Escape");
    await expect(snap.statusDistance, "one press of Escape clears the picks").toHaveAttribute("data-picks", "0");
    await expect(snap.picks, "and takes their marks off the overlay").toHaveCount(0);
    await expect(snap.statusDistance).toContainText(copy("viewer_status_distance_none"));

    /* --- AC-2: reduced motion zeroes the duration at the token, so the glyph simply appears --- */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload({ waitUntil: "commit" });
    await expect(viewer.status, "the sheet paints again").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await viewer.fit.click();
    await snap.hoverAt(await viewer.screenPointOf(endpoint.at));
    await expect(snap.glyph, "the glyph still stands where the pointer met the drawing").toHaveCount(1);
    await expect(snap.glyph, "and it publishes the reading it drew itself in under").toHaveAttribute("data-motion", "reduced");
    expect(await snap.glyphStyle("transition-duration"), "the motion token is zeroed at source, so nothing tweens (R-UI-004)").toBe("0s");
    expect(await snap.glyphStyle("opacity"), "and the glyph stands at its final opacity in the frame it was asked for").toBe("1");
  });
});
