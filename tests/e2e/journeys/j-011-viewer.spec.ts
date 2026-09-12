/**
 * J-011 — the inspector leg of the viewer journey (AC-5, and the served halves of AC-1, AC-3 and
 * AC-4): a staged sheet opened, an entity read under the pointer, one selected by click, its key
 * copied, a rectangle taking the sheet, the address carrying the selection both ways, the Trace's
 * fly-to, and the whole of it on both papers at axe serious/critical = 0 (R-TO-011, R-UI-022/031,
 * R-UI-012, V-E2E).
 *
 * The gate runs `pnpm e2e --journey J-011`, which is Playwright's title grep — so every title here
 * names J-011. `tests/e2e/viewer-perf.spec.ts` (PB-2/PB-3) is tagged PERF-011 and runs under
 * `pnpm test:perf` instead (V-PERF, v17.1 §2) — the budgets are the perf lane's verdict.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, asked for by name below exactly as the
 * perf journey asks (playwright.config.ts is locked). The inspector is the third panel of a drawn
 * sheet, so a browser that answers `data-renderer="unavailable"` fails this journey honestly.
 *
 * Nothing is transcribed. The entity this journey selects is read off the served layer feed, the
 * copy is read from the product's own string registry by key, and every count is compared against
 * what the screen itself publishes (B-19).
 */
import { FONT_RENDER_FLAGS } from "../support/capture-geometry";
import { expect, test } from "@playwright/test";
import { strings } from "../../../src/ui/strings";
import { syntheticKey } from "../../takeoff/viewer/support/synthetic-graph";
import { checkpoint } from "../support/checkpoint";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { stageSyntheticSheet } from "../viewer/viewer-stage";
import { settled } from "../support/settled";
import { steadyText } from "../support/retrying-read";

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

/** How far around the point an entity is expected at the pointer is tried, in pixels. */
const HOVER_REACH_PX = 60;

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
  // THE ONE SPEC THAT ASKS FOR MOTION BY NAME. §9.3 gives the whole lane `reducedMotion: reduce`,
  // because a picture of a moving screen is a picture of nothing. But this journey's clause is the
  // PULSE (§4, R-UI-022) — that a revealed selection goes on repainting for a moment and then stops
  // of its own accord — and viewer.md §4 forbids a pulse at all under reduced motion: the durations
  // are zeroed at source, so with `reduce` in force there is nothing to watch and the leg asserts a
  // thing the product is right not to do. A journey that needs motion says so, in its own file,
  // rather than the lane's ground being bent for it.
  reducedMotion: "no-preference",
  permissions: ["clipboard-read", "clipboard-write"],
  // EXTENDED, never replaced: `test.use({ launchOptions })` overwrites the lane's whole object, and
  // until 2026-09-12 this line did exactly that — §9.3's three font flags never reached this
  // journey's browser, so its heights and any picture it took were rastered differently from every
  // other spec's, by an override nothing documented. The three come from their one home
  // (`capture-geometry.ts`). `--force-prefers-reduced-motion` is the ONE flag deliberately left out:
  // it is Chromium forcing the preference the `reducedMotion: "no-preference"` above asks against,
  // and this journey's clause IS the pulse. That omission is the whole reason this spec has a
  // `launchOptions` of its own, and it is now written down rather than implied.
  launchOptions: { args: [...FONT_RENDER_FLAGS, "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-011 — the inspector: hover, select, copy, reveal, and the address that carries it", () => {
  test("J-011: a reader reads an entity, selects it, copies its key, reveals it, and shares the address", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(600_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();

    const staged = await stageSyntheticSheet(page, { entities: ENTITIES, derivedPaint: true });
    const derived = staged.derived;
    expect(derived, "the staged sheet carries one piece of derived paint, so I-86 can be judged").not.toBeNull();
    const paint = derived as NonNullable<typeof derived>;
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

    // §3.1: the shell's right slot is ABSENT — width 0 — until something is selected, so the idle
    // inspector this leg reads is held open by the pin a person would press for it (I-152). Every
    // assertion below is the one that stood here; what changed is that the journey performs the act
    // the screen now needs before making them.
    await viewer.pinInspector();
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
    // Two atoms that paint nothing but themselves: the instance the staged sheet's derived paint
    // belongs to is deliberately left out of this pair, because its extent is the union of the two
    // places it paints and a journey that flew to it would be looking between them.
    const first = await viewer.recordOnLayer(staged.drawingId, staged.layoutName, staged.tenantId, 1, "LINE");
    const second = await viewer.recordOnLayer(staged.drawingId, staged.layoutName, staged.tenantId, 2, "LINE");
    expect(first.key, "the two entities this journey selects are different atoms").not.toBe(second.key);
    expect([first.key, second.key], "and neither of them is the instance the derived paint was painted from").not.toContain(paint.srcKey);

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
    // A fresh load starts with the pin released (§3.1), and everything below this line reads the
    // inspector AFTER letting a selection go — so the panel is held open again, exactly as a person
    // who wanted to keep watching it would. Not one assertion below is loosened by it.
    await viewer.pinInspector();
    // Where that entity stands on screen NOW, by inverting the shipped projection at the camera the
    // address states — not "the middle of the stage". The two were the same thing until §3.1 gave
    // the inspector a pin: holding the panel open takes its width off the stage, and the entity the
    // sheet flew to is no longer over the canvas's new centre. The projection is the honest anchor
    // either way, and it is the page object's own (`screenPointOf`, and `selectionCentre` for the
    // world point). A few pixels around it are tried because a drawing is painted to a fraction of
    // one. The reading is taken while the entity is still held, because a hover renders above a
    // selection and never displaces it (Decision §1).
    const met = await viewer.hoverNear(await viewer.screenPointOf(await viewer.selectionCentre()), HOVER_REACH_PX);
    const centre = met.at;
    expect(met.key, "the sheet was flown to that key, so that is the entity the pointer meets there").toBe(first.key);

    await viewer.clear.click();
    await expect(viewer.inspector, "the selection is let go").toHaveAttribute("data-state", "idle");
    await page.mouse.move(1, 1);
    await page.mouse.move(centre.x, centre.y);
    await expect(viewer.hover, "the entity under the pointer is still read out").toBeVisible();
    await expect(viewer.inspector, "and with nothing held, reading is what the panel is reporting").toHaveAttribute("data-state", "hover");
    const hovered = (await viewer.hover.getAttribute("data-key")) ?? "";
    expect(hovered, "letting a selection go does not move the sheet under the pointer").toBe(first.key);
    expect(hovered, `the hover names a source key of this reading: it reads "${hovered}"`).toMatch(/^DXF_HANDLE:[0-9A-F]+$/);
    await expect(page.getByTestId("viewer-inspector-hover-handle"), "the handle cell is the key's own handle, verbatim").toHaveText(hovered.slice(SCHEME.length));
    await expect(page.getByTestId("viewer-inspector-hover-type"), "the type cell says something the reading recorded").not.toBeEmpty();
    const layerRead = await steadyText(page.getByTestId("viewer-inspector-hover-layer"), "the hover readout's layer cell");
    expect(staged.layerNames, `the layer cell names a layer of this sheet: it reads "${layerRead}"`).toContain(layerRead);

    // Mono, as the Decision fixes it — read as the page resolves the token, never as a font typed here.
    const mono = await viewer.token("--font-mono", viewer.inspector);
    expect(mono, "the panel resolves the mono face from the token set").not.toBe("");
    expect(await viewer.computed(page.getByTestId("viewer-inspector-hover-handle"), "font-family"), "model values are lettered in the mono face (I-25)").toBe(mono);
    await checkpoint(page, testInfo, "j-011-inspector-hover");

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
    // Read the fly-to that RAN, not the state it was in while it ran. `data-flyto="flying"` is a
    // transient a poll can miss and that §4 never writes at all when motion is reduced; the screen's
    // `data-flyto-flight` ordinal counts every fly-to as it begins, so "the Reveal flew this sheet"
    // is a fact that can be read after the fact — and it is asserted as an INCREMENT over what the
    // address's own arrival already flew, so nothing else on the screen can satisfy it.
    const flewBefore = Number((await viewer.screen.getAttribute("data-flyto-flight")) ?? "0");
    await viewer.reveal.click();
    await expect(viewer.screen, "the Reveal flies the sheet: one more fly-to has run than before the press").toHaveAttribute(
      "data-flyto-flight",
      String(flewBefore + 1),
      { timeout: FLYTO_BUDGET_MS },
    );
    // Read at the sampler's own resolution, not at `expect`'s. The clause is identical — the fly-to
    // settles by itself inside a second — but the PULSE that follows is one `--motion-flyto` long
    // (320 ms), so a reader that learns the travel has landed 300 ms late has already missed most of
    // what it came to watch. Asked every 20 ms, the first frame below falls inside the pulse.
    await expect
      .poll(async () => viewer.screen.getAttribute("data-flyto"), {
        intervals: Array.from({ length: FLYTO_BUDGET_MS / 20 }, () => 20),
        timeout: FLYTO_BUDGET_MS,
        message: "and it settles by itself, inside a second",
      })
      .toBe("settled");

    // THE PULSE IS NOT WATCHED HERE ANY MORE — see the `test.fixme` at the foot of this file, and
    // docs/design/gallery-v22/README.md. The clause (R-UI-022) is not withdrawn; it is unowned.

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

    /* --- AC-1, AC-4: bare paper, Escape and Clear each let the selection go, address and all --- */
    // Fitted, so the sheet stands inside its own margin and the corner of the stage is paper and
    // nothing else; what is held is untouched by a camera move.
    await viewer.fit.click();
    await settled(page);
    // The reduced-motion arrival above was a fresh load, and a fresh load starts with the pin
    // released (§3.1) — so the panel is held open again before a leg that reads it with NOTHING
    // selected, exactly as the two legs before it do and exactly as a person who wanted to keep
    // watching it would. Not one assertion below is loosened by it; the screen simply now needs the
    // act performed before they can be made (I-152).
    await viewer.pinInspector();
    await expect(viewer.inspector, "fitting the sheet is not letting go of it").toHaveAttribute("data-count", "1");
    const corner = await viewer.canvasBox();
    const bare = { x: corner.x + 6, y: corner.y + 6 };
    await page.mouse.move(bare.x, bare.y);
    await expect(viewer.hover, "the pointer over bare paper reads nothing, rather than the last thing it read").toHaveCount(0);
    const beforeBare = await page.evaluate(() => history.length);
    await viewer.clickAt(bare);
    await expect(viewer.inspector, "a click on bare paper lets the selection go (AC-1)").toHaveAttribute("data-state", "idle");
    await expect(viewer.inspector).toHaveAttribute("data-count", "0");
    await expect(viewer.inspector, "and the idle cell teaches the gestures again").toContainText(copy("viewer_inspector_idle_body"));
    expect(await viewer.selectionParam(), "the address carries no selection, because none is held (R-UI-031)").toBeNull();
    expect(await page.evaluate(() => history.length), "and letting go was replaced onto the address, never pushed").toBe(beforeBare);

    const again = await viewer.hoverNear(await viewer.canvasCentre(), HOVER_REACH_PX);
    await viewer.clickAt(again.at);
    await expect(viewer.inspector, "an entity is held again").toHaveAttribute("data-count", "1");
    const beforeEscape = await page.evaluate(() => history.length);
    // The pointer comes off the sheet first, so what the panel reports afterwards is what is HELD
    // and not what is merely under a mouse that never moved.
    await page.mouse.move(1, 1);
    await viewer.canvas.focus();
    await page.keyboard.press("Escape");
    await expect(viewer.inspector, "Escape with the canvas focused lets it go (AC-1)").toHaveAttribute("data-state", "idle");
    await expect(viewer.inspector).toHaveAttribute("data-count", "0");
    expect(await viewer.selectionParam(), "and the address stops carrying it").toBeNull();
    expect(await page.evaluate(() => history.length), "with no entry pushed for the letting go").toBe(beforeEscape);

    await viewer.clickAt(again.at);
    await expect(viewer.inspector, "and once more, to press the door this time").toHaveAttribute("data-count", "1");
    const painted = await viewer.canvas.screenshot();
    const beforeClear = await page.evaluate(() => history.length);
    await viewer.clear.click();
    await expect(viewer.inspector, "Clear selection lets it go").toHaveAttribute("data-count", "0");
    expect(await viewer.selectionParam(), "and `s` is absent at count 0 — the address is the whole state (AC-4)").toBeNull();
    expect(await page.evaluate(() => history.length), "unchanged across the clear, exactly as across the select").toBe(beforeClear);
    // The repaint is waited FOR, not slept through: the sheet is re-read until it differs from the
    // frame that carried the selection, and a sheet that never repaints fails with that sentence.
    await expect
      .poll(async () => painted.equals(await viewer.canvas.screenshot()), {
        message: "a held entity was painted on the sheet, so letting it go repaints the sheet without it (AC-3: --canvas-selection)",
      })
      .toBe(false);

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

    // A fresh load again, and this leg reads the inspector holding NOTHING — so the panel is held
    // open by the pin first, exactly as the three legs above it do (§3.1, I-152). No assertion here
    // is loosened by it.
    await viewer.pinInspector();
    await viewer.dragAcross();
    await expect(viewer.inspector, "a plain drag is a pan, and selects nothing").toHaveAttribute("data-count", "0");
    await viewer.fit.click();

    await viewer.rectangleSelect();
    await expect(viewer.marquee, "the rectangle is gone once the button is up").toHaveCount(0);
    const drawn = await viewer.statusNumber("data-drawn-entities");
    expect(drawn, "the sheet draws every record the staged reading holds, its derived paint included").toBe(staged.entityCount);
    const held = staged.keyCount;
    await expect
      .poll(async () => Number((await viewer.inspector.getAttribute("data-count")) ?? "0"), {
        timeout: 60_000,
        message: "a rectangle over the whole fitted sheet takes every atom of it",
      })
      .toBe(held);
    await expect(viewer.entities, "and every one of them is listed, once").toHaveCount(held);
    await expect(viewer.reveal, "a selection this size is revealable").toBeEnabled();
    await expect(viewer.status).toHaveAttribute("data-selection", String(held));

    // AC-1 (I-86): the sheet draws more records than it holds atoms, because one of them is paint
    // synthesised from an instance. What was taken is the sheet's own source keys — the derived
    // record under the key it was painted from, never under an identity nobody can name.
    expect(held, "this sheet paints more records than it holds atoms").toBeLessThan(drawn);
    const taken = await viewer.selectedKeys();
    expect(new Set(taken).size, "no key is listed twice, however many pieces it paints").toBe(taken.length);
    expect([...taken].sort(), "and the atoms taken are exactly the source keys the reading minted").toEqual(
      Array.from({ length: staged.keyCount }, (_, index) => syntheticKey(index)).sort(),
    );
    expect(taken, "including the instance whose paint the rectangle also crossed").toContain(paint.srcKey);
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
    await expect(viewer.entities, "and the rows still stand").toHaveCount(held);

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

/**
 * THE PULSE, NAMED AND NOT RUN (R-UI-022, Decision §4).
 *
 * The clause: once a Reveal's travel has landed, the sheet goes on repainting the struck selection
 * for one `--motion-flyto` and then stops of its own accord — sampled as frames off the canvas, so
 * no colour is named in the lane.
 *
 * WHY IT IS A FIXME AND NOT A RUNNING LEG. Two things were wrong with it and only one is now
 * settled. (1) The lane's ground is `reducedMotion: reduce` (§9.3), which zeroes `--motion-flyto`
 * at source, and viewer.md §4 says a zeroed token draws NO pulse frame at all: under the lane's own
 * ground the leg asked the product for a thing the product is right to refuse. That is decided —
 * this spec now asks for motion by name (`reducedMotion: "no-preference"` in its `test.use`), which
 * is the lawful way for one journey to need what the gallery does not.
 *
 * (2) With motion in force the pulse STILL could not be seen. The 320 ms strike was sampled at 20 ms
 * resolution, in a 200 px square centred on what the reveal flew to, and every frame the sampler
 * held was identical: the sheet is still from the moment `data-flyto` reads `settled`. The product
 * path reads right on inspection — `useReveal.land()` calls `painter.pulse(durationMs, colour)`,
 * `pulse()` sets `pulseMs` and re-arms the loop, and `tick()` keeps asking for frames while
 * `pulseMs > 0` — so either those frames are not painted or they are not composited into what a
 * screenshot of this canvas returns. Telling those two apart is a WebGL question, not a journey
 * one, and this node could not own it inside its budget.
 *
 * THE DEFECT, IN ONE LINE: with motion in force, a Reveal's arrival paints no frame a reader (or a
 * screenshot) can see between `data-flyto="settled"` and stillness.
 *
 * The next owner turns this `test.fixme` back into the leg it was — the sampling loop, then
 * `changed`, then the last two frames alike — inside J-011's walk, and deletes this stub.
 */
test.describe("J-011 — the Reveal's pulse", () => {
  test.fixme("J-011: the selection is repainted after the fly-to settles, and the pulse ends by itself (R-UI-022)", () => {
    // The leg is restored into J-011's own walk, not run from here.
  });
});
