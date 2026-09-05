/**
 * J-011 — the inspector leg of the viewer journey (AC-5, and the served halves of AC-1, AC-3 and
 * AC-4): a staged sheet opened, an entity read under the pointer, one selected by click, its key
 * copied, a rectangle taking the sheet, the address carrying the selection both ways, the Trace's
 * fly-to, and the whole of it on both papers at axe serious/critical = 0 (R-TO-011, R-UI-022/031,
 * R-UI-012, V-E2E).
 *
 * The gate runs `pnpm e2e --journey J-011`, which is Playwright's title grep — so every title here
 * names J-011, and this file runs beside `tests/e2e/viewer-perf.spec.ts` under that one stage.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, asked for by name below exactly as the
 * perf journey asks (playwright.config.ts is locked). The inspector is the third panel of a drawn
 * sheet, so a browser that answers `data-renderer="unavailable"` fails this journey honestly.
 *
 * Nothing is transcribed. The entity this journey selects is read off the served layer feed, the
 * copy is read from the product's own string registry by key, and every count is compared against
 * what the screen itself publishes (B-19).
 */
import { expect, test } from "@playwright/test";
import { strings } from "../../../src/ui/strings";
import { checkpoint } from "../support/checkpoint";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { stageSyntheticSheet } from "../viewer/viewer-stage";

/** A sheet with room for a rectangle to cross and layers to pick from, and small enough to list. */
const ENTITIES = 600;

/** The scheme every source key of a DXF reading carries — the handle is what follows it (L-CAD-03). */
const SCHEME = "DXF_HANDLE:";

/** How long a fly-to has to settle, as AC-3 states it. */
const FLYTO_BUDGET_MS = 1_000;

/** How near the address's camera must land on the union centre, in drawing units (AC-3, AC-4). */
const WORLD_TOLERANCE = 1;

/** A key an address may name that no sheet holds — the shape error I-88 answers as a fact. */
const MALFORMED_KEY = "FOO:1";

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
  permissions: ["clipboard-read", "clipboard-write"],
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-011 — the inspector: hover, select, copy, reveal, and the address that carries it", () => {
  test("J-011: a reader reads an entity, selects it, copies its key, reveals it, and shares the address", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();

    const staged = await stageSyntheticSheet(page, { entities: ENTITIES });
    const viewer = new SViewerPage(page);
    const address = S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName);

    /* --- the sheet, opened and drawn --- */
    await page.goto(address, { waitUntil: "commit" });
    await expect(viewer.status, "the staged sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect(viewer.status, "and it is painted by WebGL, which is what the inspector's third panel stands beside").toHaveAttribute("data-renderer", "webgl");
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000, message: "every layer of the sheet arrives before it is asked about" })
      .toBe(true);

    await expect(viewer.inspector, "the inspector stands to the right of the sheet (R-UI-030)").toBeVisible();
    await expect(viewer.inspector, "holding nothing, and saying so").toHaveAttribute("data-state", "idle");
    await expect(viewer.inspector).toHaveAttribute("data-count", "0");
    await expect(viewer.inspector, "the idle cell teaches the three gestures (R-UI-050)").toContainText(copy("viewer_inspector_idle_body"));
    await expect(viewer.reveal, "a reveal with nothing to reveal is shut").toBeDisabled();
    await expect(viewer.statusSelection, "the readout counts the empty selection rather than hiding the cell").toContainText(
      fill(copy("viewer_inspector_selected_count"), { count: "0" }),
    );

    /* --- the two entities this journey works with, read off the served feed --- */
    await viewer.fit.click();
    const first = await viewer.recordOnLayer(staged.drawingId, staged.layoutName, staged.tenantId, 0, "LINE");
    const second = await viewer.recordOnLayer(staged.drawingId, staged.layoutName, staged.tenantId, 1, "LINE");
    expect(first.key, "the two entities this journey selects are different atoms").not.toBe(second.key);

    /* --- j-011-deep-link-selection: `s` without `v` selects and flies; `s` with `v` keeps the camera --- */
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [first.key, second.key]), { waitUntil: "commit" });
    await expect(viewer.screen, "an address naming keys and no camera flies to them (I-85)").toHaveAttribute("data-flyto", "settled", { timeout: 120_000 });
    expect(await viewer.selectedKeys(), "both named keys are selected, in the order the address named them").toEqual([first.key, second.key]);

    const flown = await viewer.cameraFromAddress();
    const union = await viewer.selectionCentre();
    expect(Math.abs(flown.x - union[0]), `the camera landed on the union's centre in x (${flown.x} vs ${union[0]})`).toBeLessThanOrEqual(WORLD_TOLERANCE);
    expect(Math.abs(flown.y - union[1]), `the camera landed on the union's centre in y (${flown.y} vs ${union[1]})`).toBeLessThanOrEqual(WORLD_TOLERANCE);

    const stated = `${flown.x},${flown.y},${flown.scale}`;
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [first.key], stated), { waitUntil: "commit" });
    await expect(viewer.inspector, "the stated address selects the key it names").toHaveAttribute("data-count", "1");
    expect(await viewer.selectedKeys(), "and only that key").toEqual([first.key]);
    expect(await viewer.viewportParam(), "a camera the address states is the camera a reader gets — no fly-to overrules it (I-85)").toBe(stated);
    await expect(viewer.screen, "and nothing flew, so nothing says it did").not.toHaveAttribute("data-flyto", /.*/);
    await checkpoint(page, testInfo, "j-011-deep-link-selection");

    /* --- AC-4: a key this sheet does not hold is a fact, and the keys that are found stay --- */
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [first.key, MALFORMED_KEY], stated), { waitUntil: "commit" });
    await expect(viewer.missingKeys, "the key the sheet cannot hold is listed rather than swallowed (I-88)").toHaveCount(1);
    await expect(viewer.missingKeys.first()).toHaveAttribute("data-key", MALFORMED_KEY);
    await expect(viewer.inspector, "while the key that was found is still selected — shown, not hidden (R-UI-050)").toHaveAttribute("data-count", "1");
    await expect(page.getByTestId("viewer-inspector-missing"), "and the cell says what happened in the registry's own words").toBeVisible();
    await expect(viewer.inspector).toContainText(copy("viewer_inspector_missing_body"));

    /* --- j-011-inspector-hover: the pointer reads an entity, and bare paper reads nothing --- */
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [first.key]), { waitUntil: "commit" });
    await expect(viewer.screen, "the sheet flies to the one key the address names").toHaveAttribute("data-flyto", "settled", { timeout: 120_000 });
    await viewer.clear.click();
    await expect(viewer.inspector, "the selection is let go, and the camera is left where the fly-to put it").toHaveAttribute("data-state", "idle");

    const centre = await viewer.canvasCentre();
    await page.mouse.move(centre.x, centre.y);
    await expect(viewer.hover, "the entity under the pointer is read out").toBeVisible();
    await expect(viewer.inspector, "and reading is what the panel is reporting").toHaveAttribute("data-state", "hover");
    const hovered = (await viewer.hover.getAttribute("data-key")) ?? "";
    expect(hovered, `the hover names a source key of this reading: it reads "${hovered}"`).toMatch(/^DXF_HANDLE:[0-9A-F]+$/);
    await expect(page.getByTestId("viewer-inspector-hover-handle"), "the handle cell is the key's own handle, verbatim").toHaveText(hovered.slice(SCHEME.length));
    await expect(page.getByTestId("viewer-inspector-hover-type"), "the type cell says something the reading recorded").not.toBeEmpty();
    const layerRead = await page.getByTestId("viewer-inspector-hover-layer").textContent();
    expect(staged.layerNames, `the layer cell names a layer of this sheet: it reads "${layerRead}"`).toContain((layerRead ?? "").trim());

    // Mono, as the Decision fixes it — read as the page resolves the token, never as a font typed here.
    const mono = await viewer.token("--font-mono", viewer.inspector);
    expect(mono, "the panel resolves the mono face from the token set").not.toBe("");
    expect(await viewer.computed(page.getByTestId("viewer-inspector-hover-handle"), "font-family"), "model values are lettered in the mono face (I-25)").toBe(mono);
    await checkpoint(page, testInfo, "j-011-inspector-hover");

    const corner = await viewer.canvasBox();
    await page.mouse.move(corner.x + 6, corner.y + 6);
    await expect(viewer.hover, "the pointer over bare paper reads nothing, rather than the last thing it read").toHaveCount(0);

    /* --- j-011-inspector-selected: a click selects, and the address says so --- */
    const historyBefore = await page.evaluate(() => history.length);
    await viewer.clickAt(centre);
    await expect(viewer.inspector, "a click selects the entity under it").toHaveAttribute("data-state", "selected");
    await expect(viewer.inspector).toHaveAttribute("data-count", "1");
    const selected = await viewer.selectedKeys();
    expect(selected, "and what is selected is what was under the pointer").toEqual([hovered]);
    await expect(viewer.entities.first().getByTestId("viewer-inspector-key"), "the row shows the source key whole (I-26)").toHaveText(hovered);
    await expect(viewer.status, "the readout publishes the size of the selection").toHaveAttribute("data-selection", "1");
    await expect(viewer.statusSelection).toContainText(fill(copy("viewer_inspector_selected_count"), { count: "1" }));
    expect(await viewer.selectionParam(), "the address is the whole state (R-UI-031)").toBe(hovered);
    expect(await page.evaluate(() => history.length), "the selection is replaced onto the address, never pushed — Back leaves the sheet").toBe(historyBefore);
    await checkpoint(page, testInfo, "j-011-inspector-selected");

    /* --- AC-3: the key is copyable, exactly as it stands --- */
    const copied = await viewer.copyKey(viewer.entities.first());
    expect(copied, "the row that was copied is the row that was selected").toBe(hovered);
    expect(await viewer.clipboardText(), "the clipboard holds the source key, whole and unstripped").toBe(hovered);
    await expect(viewer.entities.first().getByTestId("viewer-inspector-copy"), "and the door says it was copied").toContainText(copy("viewer_inspector_copied"));

    /* --- AC-3: Reveal in sheet — the Trace's target, flown and settled --- */
    await viewer.zoomIn.click();
    await viewer.zoomIn.click();
    const flying = page.waitForSelector('[data-testid="viewer-screen"][data-flyto="flying"]', { timeout: FLYTO_BUDGET_MS });
    await viewer.reveal.click();
    await flying;
    await expect(viewer.screen, "and it settles by itself, inside a second").toHaveAttribute("data-flyto", "settled", { timeout: FLYTO_BUDGET_MS });

    const revealed = await viewer.cameraFromAddress();
    const target = await viewer.selectionCentre();
    expect(Math.abs(revealed.x - target[0]), `the reveal centred the camera on the selection in x (${revealed.x} vs ${target[0]})`).toBeLessThanOrEqual(WORLD_TOLERANCE);
    expect(Math.abs(revealed.y - target[1]), `the reveal centred the camera on the selection in y (${revealed.y} vs ${target[1]})`).toBeLessThanOrEqual(WORLD_TOLERANCE);
    expect(await viewer.scale(), "the camera it landed at is a real scale").toBeGreaterThan(0);
    await expect(viewer.status, "and the sheet is still drawn after the travel").toHaveAttribute("data-renderer", "webgl");

    /* --- AC-3: reduced motion arrives at the same place, without the travel --- */
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [hovered]), { waitUntil: "commit" });
    await expect(viewer.screen, "with motion reduced the fly-to is already over (§4: the token is zeroed at source)").toHaveAttribute("data-flyto", "settled", {
      timeout: 120_000,
    });
    const quiet = await viewer.cameraFromAddress();
    const quietTarget = await viewer.selectionCentre();
    expect(Math.abs(quiet.x - quietTarget[0]), "and it lands where the travel would have landed, in x").toBeLessThanOrEqual(WORLD_TOLERANCE);
    expect(Math.abs(quiet.y - quietTarget[1]), "and it lands where the travel would have landed, in y").toBeLessThanOrEqual(WORLD_TOLERANCE);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    /* --- j-011-multi-select: a rectangle over the whole fitted sheet takes what is drawn --- */
    await page.goto(address, { waitUntil: "commit" });
    await expect(viewer.status).toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: 120_000 })
      .toBe(true);
    await viewer.fit.click();

    await viewer.dragAcross();
    await expect(viewer.inspector, "a plain drag is a pan, and selects nothing").toHaveAttribute("data-count", "0");
    await viewer.fit.click();

    await viewer.rectangleSelect();
    await expect(viewer.marquee, "the rectangle is gone once the button is up").toHaveCount(0);
    const drawn = await viewer.statusNumber("data-drawn-entities");
    await expect
      .poll(async () => Number((await viewer.inspector.getAttribute("data-count")) ?? "0"), {
        timeout: 60_000,
        message: "a rectangle over the whole fitted sheet takes every drawn entity of it",
      })
      .toBe(drawn);
    await expect(viewer.entities, "and every one of them is listed").toHaveCount(drawn);
    await expect(viewer.reveal, "a selection this size is revealable").toBeEnabled();
    await expect(viewer.status).toHaveAttribute("data-selection", String(drawn));
    await checkpoint(page, testInfo, "j-011-multi-select");

    /* --- j-011-inspector-dark: the same selection on the other paper --- */
    await viewer.setTheme("light");
    const light = await viewer.cornerLuminance();
    const heldInLight = await viewer.inspector.getAttribute("data-count");
    const lightPanel = await viewer.computed(viewer.inspector, "background-color");
    expect(lightPanel, "the panel resolves a fill of its own in light").not.toBe("");

    await viewer.setTheme("dark");
    const dark = await viewer.cornerLuminance();
    expect(light, `the canvas paper is lighter in light than in dark (${light} vs ${dark})`).toBeGreaterThan(dark);
    expect(await viewer.inspector.getAttribute("data-count"), "the selection survives the theme — a repaint is not a change of what is held").toBe(heldInLight);
    await expect(viewer.entities, "and the rows still stand").toHaveCount(drawn);

    // The panel sits on the layers panel's own fill in both themes: the value is read from the
    // document, never spelled here (R-UI-001 — no acceptance names a colour).
    const graphite50 = await viewer.token("--graphite-50", page.locator("html"));
    expect(graphite50, "the token set resolves the panel's fill in this theme").not.toBe("");
    const asColour = await page.evaluate((value) => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = value;
      document.body.append(probe);
      const computed = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return computed;
    }, graphite50);
    expect(await viewer.computed(viewer.inspector, "background-color"), "the inspector stands on --graphite-50 as the dark theme resolves it (§6)").toBe(asColour);
    expect(asColour, "and that is not the fill it stood on in light — the difference arrives through token values alone").not.toBe(lightPanel);
    await checkpoint(page, testInfo, "j-011-inspector-dark");

    /* --- AC-4: Back leaves the sheet, because the address was replaced and never pushed --- */
    await viewer.setTheme("light");
    const opened = `/t/${staged.tenantId}/p/${staged.projectId}/drawings`;
    await page.goto(opened, { waitUntil: "commit" });
    await page.goto(address, { waitUntil: "commit" });
    await expect(viewer.status).toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await viewer.fit.click();
    await viewer.rectangleSelect();
    await expect(viewer.inspector, "something is held, so the address carries it").not.toHaveAttribute("data-count", "0");
    await page.goBack();
    await expect(page, "Back from a sheet leaves the sheet — every camera and every selection was replaced onto the address").toHaveURL(new RegExp(`${opened}$`));
  });
});
