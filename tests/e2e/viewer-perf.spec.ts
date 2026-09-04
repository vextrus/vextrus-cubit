/**
 * J-011 — the viewer leg this increment can honestly walk: a staged 100 000-entity sheet opened,
 * its layers listed and one of them hidden, zoomed and panned inside PB-3's frame budget, fitted,
 * deep-linked at a viewport, and drawn on both papers (R-TO-010, R-UI-040/043, PB-2, PB-3).
 *
 * The gate runs `pnpm e2e --journey J-011`, and Playwright exits 1 on an unmatched grep — so the
 * J-011 tag in the title below is what makes that stage runnable at all. J-000 is untouched.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, which the launch options below ask for
 * by name (playwright.config.ts is locked, so the spec states them for itself). Under software GL
 * the tail is graded at two vsyncs while the median holds PB-3's 16.7 ms — the reading the Design
 * Decision records (§7). A browser that answers `data-renderer="unavailable"` fails this journey
 * honestly rather than skipping it.
 *
 * Every expectation is derived from the sheet that was staged — its layer roster, its entity count,
 * the camera the product itself reports — so a sheet staged at another size or over another roster
 * grades the same rules (B-19).
 */
import { expect, test } from "@playwright/test";
import { checkpoint } from "./support/checkpoint";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "./viewer/s-viewer.page";
import { stageSyntheticSheet } from "./viewer/viewer-stage";

/** The sheet R-TO-010 states its budget at. */
const ENTITIES = 100_000;

/** The frames the ledger is read over — the painter keeps the last 120 (Decision §7). */
const FRAMES = 120;

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-011 — a 100 000-entity sheet is opened, drawn, navigated and deep-linked", () => {
  test("J-011: the viewer opens a 100k sheet within budget, lists its layers, holds 60 fps, deep-links its viewport and draws on both papers", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();

    const staged = await stageSyntheticSheet(page, { entities: ENTITIES });
    const viewer = new SViewerPage(page);
    const address = S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName);

    /* --- j-011-sheet-open: cold, then warm from the content-keyed cache (PB-2) --- */
    const coldAt = Date.now();
    await page.goto(address, { waitUntil: "commit" });
    await expect(viewer.status, "the sheet reaches first paint inside PB-2's cold budget").toHaveAttribute("data-first-paint", "true", {
      timeout: VIEWER_BUDGETS.firstPaintColdMs,
    });
    expect(Date.now() - coldAt, `first paint of a ${ENTITIES}-entity sheet is inside ${VIEWER_BUDGETS.firstPaintColdMs} ms cold (PB-2)`).toBeLessThanOrEqual(
      VIEWER_BUDGETS.firstPaintColdMs,
    );

    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer of the sheet arrives — progressive loading finishes (R-UI-043)" })
      .toBe(true);

    expect(await viewer.statusNumber("data-total-layers"), "the roster is the sheet's own layers").toBe(staged.layerNames.length);
    expect(await viewer.statusNumber("data-entity-count"), "and the sheet is the whole staged sheet").toBe(staged.entityCount);
    await expect(viewer.status, "the sheet is painted by WebGL, not by a fallback (R-UI-040)").toHaveAttribute("data-renderer", "webgl");
    await expect(viewer.canvas, "the canvas is the screen").toBeVisible();
    await checkpoint(page, testInfo, "j-011-sheet-open");

    /* --- the warm reopen: the manifest is cached by content hash (R-UI-043, PB-2) --- */
    const warmAt = Date.now();
    await page.goto(address, { waitUntil: "commit" });
    await expect(viewer.status, "the same sheet reopens inside PB-2's warm budget").toHaveAttribute("data-first-paint", "true", {
      timeout: VIEWER_BUDGETS.firstPaintWarmMs,
    });
    expect(Date.now() - warmAt, `a second open of the same sheet is inside ${VIEWER_BUDGETS.firstPaintWarmMs} ms warm (PB-2)`).toBeLessThanOrEqual(
      VIEWER_BUDGETS.firstPaintWarmMs,
    );
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000 })
      .toBe(true);

    /* --- j-011-layers: one row per layer, and hiding one takes its entities off the sheet --- */
    await expect(viewer.layers, "the layers panel stands beside the sheet").toBeVisible();
    await expect(viewer.rows, "one row per layer of the manifest").toHaveCount(staged.layerNames.length);
    for (const layerName of staged.layerNames) {
      const row = viewer.row(layerName);
      await expect(row, `${layerName} is listed`).toBeVisible();
      await expect(row.getByTestId("viewer-layer-swatch"), `${layerName} carries its colour swatch`).toBeVisible();
      await expect(row.getByTestId("viewer-layer-count"), `${layerName} carries its entity count`).toBeVisible();
    }

    const drawnBefore = await viewer.statusNumber("data-drawn-entities");
    const hidden = staged.layerNames[0] as string;
    await viewer.row(hidden).getByTestId("viewer-layer-visible").click();
    await expect(viewer.row(hidden), `${hidden} is hidden`).toHaveAttribute("data-visible", "false");
    await expect
      .poll(() => viewer.statusNumber("data-drawn-entities"), { message: "hiding a layer lowers what is drawn" })
      .toBeLessThan(drawnBefore);
    expect(await viewer.statusNumber("data-entity-count"), "while the sheet still holds every entity it holds").toBe(staged.entityCount);
    await checkpoint(page, testInfo, "j-011-layers");

    /* --- j-011-zoom-pan-fit: the frame ledger, then the fit and the zoom the URL follows --- */
    await viewer.scriptGestures(FRAMES);
    const median = await viewer.statusNumber("data-frame-median-ms");
    const p95 = await viewer.statusNumber("data-frame-p95-ms");
    expect(median, `the median frame of a scripted zoom and pan holds 60 fps at ${ENTITIES} entities (PB-3)`).toBeLessThanOrEqual(VIEWER_BUDGETS.frameMedianMs);
    expect(p95, "and the tail stays inside two vsyncs under software GL (Decision §7)").toBeLessThanOrEqual(VIEWER_BUDGETS.frameP95Ms);

    await viewer.fit.click();
    const fitted = await viewer.scale();
    const fittedViewport = await viewer.viewportParam();
    expect(fittedViewport, "the address carries the camera — the URL is the source of truth (R-UI-031)").not.toBeNull();

    await viewer.zoomIn.click();
    await expect.poll(() => viewer.scale(), { message: "zooming in changes the camera's scale" }).not.toBe(fitted);
    const zoomed = await viewer.scale();
    const zoomedViewport = await viewer.viewportParam();
    expect(zoomedViewport, "and the address follows the camera").not.toBe(fittedViewport);
    await checkpoint(page, testInfo, "j-011-zoom-pan-fit");

    /* --- j-011-deep-link: a fresh open of that address stands at the same camera --- */
    await page.goto(S_VIEWER.at(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, zoomedViewport ?? ""), { waitUntil: "commit" });
    await expect(viewer.status, "the deep-linked sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    const restored = await viewer.scale();
    expect(Math.abs(restored - zoomed), `the deep link restores the camera it captured (${zoomed} → ${restored})`).toBeLessThanOrEqual(Math.abs(zoomed) * 0.005);
    await checkpoint(page, testInfo, "j-011-deep-link");

    /* --- j-011-dark: the same sheet on both papers, judged by the canvas's own corner (§6) --- */
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(address, { waitUntil: "commit" });
    await expect(page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", "light");
    await expect(viewer.status).toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect(viewer.status).toHaveAttribute("data-renderer", "webgl");
    const light = await viewer.cornerLuminance();

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(address, { waitUntil: "commit" });
    await expect(page.locator("html"), "the document states the theme it is painting in").toHaveAttribute("data-theme", "dark");
    await expect(viewer.status).toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    const dark = await viewer.cornerLuminance();

    expect(light, `the canvas paper is lighter in light than in dark (${light} vs ${dark}) — both come from the --canvas-* tokens`).toBeGreaterThan(dark);
    await checkpoint(page, testInfo, "j-011-dark");
  });
});
