/**
 * J-021 — the column slice, both ways (R-UI-022, R-TO-011, X-2, AC-6).
 *
 * Partition → placements → member types → column concrete lines is already staged by
 * `stageRegister`; what this journey walks is the Trace on top of it. A reader meets a published
 * quantity in the register, follows the key it was read at, watches the sheet fly to the entities
 * and reads the formula with its live variables; goes Back and lands on the row they left from,
 * marked and focused; then holds those same entities on the sheet and reads the lines that cite
 * them, each an EvidenceLink back to its own register row.
 *
 * The gate runs `pnpm e2e --journey J-021`, which is Playwright's title grep — so every title here
 * names J-021.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, asked for by name below exactly as the
 * viewer journeys ask (playwright.config.ts is locked).
 *
 * Nothing is transcribed. The keys the staged lines cite are read off the SERVED layer feed, so the
 * Trace lands on entities the sheet in fact holds (risk note 1, j-020's idiom); the address followed
 * is the one the register's own link carries; the formula, the variable names and the values
 * asserted in the inspector are the ones the staged line itself was published with (B-19).
 */
import { expect, test, type Page } from "@playwright/test";
import { checkpoint } from "../support/checkpoint";
import { STakeoffPage } from "../pages/s-takeoff.page";
import { SViewerTracePage } from "../pages/s-viewer-trace.page";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { CITE_KEYS, stageRegister } from "../takeoff/register-stage";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";

/** A source key of the served sheet's own grammar (L-CAD-03). */
const HANDLE = /^DXF_HANDLE:[0-9A-F]+$/;

/** How many layers of the feed are walked looking for them before the stage gives up. */
const LAYERS = 32;

/**
 * The handles the served sheet in fact holds, read off the layer feed exactly as J-011 and J-000
 * read theirs. A Trace citing keys the sheet does not hold would land in I-88's "Not on this sheet"
 * cell with no fly-to, which is not the moment this journey exists to walk.
 */
async function handlesOf(page: Page, sheet: { tenantId: string; drawingId: string; layoutName: string }, count: number): Promise<string[]> {
  const held: string[] = [];
  for (let index = 0; index < LAYERS && held.length < count; index += 1) {
    const answer = await page.request.get(`/api/viewer/${sheet.drawingId}/${encodeURIComponent(sheet.layoutName)}?tenant=${sheet.tenantId}&part=layer&index=${index}`);
    if (!answer.ok()) break;
    const body = (await answer.json()) as { records?: { key?: string }[] };
    for (const record of body.records ?? []) {
      const key = record.key ?? "";
      if (HANDLE.test(key) && !held.includes(key)) held.push(key);
    }
  }
  expect(held.length, `the served sheet holds at least ${count} keyed entities for the staged lines to cite`).toBeGreaterThanOrEqual(count);
  return held.slice(0, count);
}

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-021 — the column slice: a line traced to its entities, back to its row, and the lines those entities are cited by", () => {
  test("J-021: a reader traces a column concrete line to the sheet, returns to the origin row, and reads what else cites those entities", async ({ page }, testInfo) => {
    test.slow();
    const takeoff = new STakeoffPage(page);
    const trace = new SViewerTracePage(page);
    const viewer = new SViewerPage(page);

    /* --- the stage: the column slice, citing keys the served sheet in fact holds --- */
    const staged = await stageRegister(page, { label: "j021", cite: (sheet) => handlesOf(page, sheet, CITE_KEYS) });
    for (const key of [...Object.values(staged.cited), ...Object.values(staged.placementSources)]) {
      expect(key, "every staged citation — the shared ones and each placement's own — is a key of the sheet's own grammar (risk note 1)").toMatch(HANDLE);
    }
    expect(new Set(Object.values(staged.placementSources)).size, "and no two placements were read at the same entity, so the lines they publish can be told apart").toBe(
      Object.keys(staged.placementSources).length,
    );

    /* --- the register: every published line offers a Trace from the key it was read at --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    const traced = await takeoff.tracedLineIds();
    expect(traced.length, "the lines table offers a Trace from every line it shows (R-UI-022)").toBeGreaterThan(0);
    expect(traced, "including the column concrete line this journey follows").toContain(staged.line.lineId);

    const link = takeoff.evidenceLink(staged.line.lineId);
    await expect(link, "the source cell's whole content is the link").toBeVisible();
    const href = (await link.getAttribute("href")) ?? "";
    expect(href, "the address names the entities the line cites").toContain("s=");
    expect(href, "and the row it was followed from").toContain(`line=${encodeURIComponent(staged.line.lineId)}`);
    expect(/[?&]v=/.test(href), "and states no camera, which is what makes the viewer fly (s-viewer-inspector I-85)").toBe(false);
    await expect(link, "the link wears the basis of the number it stands for (R-UI-002)").toHaveAttribute("data-basis", /.+/);

    /* --- the Trace: the sheet flies to the cited entities and the formula is read --- */
    await link.click();
    await page.waitForURL(/\/viewer\//);
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await trace.settled();

    const asked = trace.addressKeys();
    expect(asked.length, "the address carries the keys the line cites").toBeGreaterThan(0);
    expect(trace.addressLine(), "and the row the reader came from").toBe(staged.line.lineId);
    const own = asked.filter((key) => Object.values(staged.placementSources).includes(key));
    expect(own.length, "one of them the key this placement alone was read at, which is what tells its line from its siblings' (AC-2)").toBe(1);
    expect(asked, "and one they all share, which is what gathers them when the sheet is asked the other way (X-2)").toContain(staged.cited.section);

    const held = await trace.selectedKeys();
    expect(held.length, "the cited entities the sheet holds are selected (I-88: what was found stays selected)").toBeGreaterThan(0);
    for (const key of held) expect(asked, `${key} is one of the keys the address named`).toContain(key);

    const basis = await trace.traceBasis();
    expect(basis, "the screen publishes the basis the Trace is held in, which is the colour the pulse was struck in (AC-4)").toBeTruthy();

    const block = trace.trace;
    await expect(block, "the selection tab gains the Trace block").toBeVisible();
    await expect(block, "which names the line the address named").toHaveAttribute("data-line", staged.line.lineId);
    await expect(block, "and stands on a reading that answered").toHaveAttribute("data-state", "ready");
    await expect(trace.formula, "the formula the line was measured by, verbatim (I-25)").toHaveText(staged.line.formula);

    const names = await trace.variableNames();
    expect(names, "one row per binding of that formula, in binding order").toEqual(Object.keys(staged.line.variables));
    for (const [name, binding] of Object.entries(staged.line.variables)) {
      const row = await trace.variable(name);
      expect(row.value, `${name}: the value it was read as`).toBe(binding.value);
      expect(row.unit, `${name}: in the unit it was written in`).toBe(binding.unit);
      expect(row.source, `${name}: at a key of the sheet's own grammar`).toMatch(HANDLE);
    }
    await expect(trace.origin, "and a way back to the row it was traced from").toHaveAttribute("href", new RegExp(`takeoff/register\\?line=${staged.line.lineId}$`));

    await checkpoint(page, testInfo, "j-021-column-slice/traced");
    await expect(trace.inspector, "traced.png pictures the Trace as a reader meets it").toHaveScreenshot(["j-021-column-slice", "traced.png"], {
      animations: "disabled",
      mask: trace.masks(),
      maxDiffPixelRatio: 0.002,
    });

    /* --- Back: a real history step, landing on the row the reader left from --- */
    await page.goBack();
    await page.waitForURL(new RegExp(`takeoff/register\\?line=${staged.line.lineId}$`));
    await expect(takeoff.root, "the register stands again").toBeVisible();
    await expect(takeoff.originLink, "exactly one row is marked as the origin (I-182)").toHaveCount(1);
    await expect(takeoff.originLink, "and it is the row the Trace was followed from").toHaveAttribute("data-line", staged.line.lineId);
    await expect(takeoff.originLink, "which is announced as well as painted (R-UI-060)").toHaveAttribute("aria-current", "true");
    expect(
      await takeoff.originLink.evaluate((node) => node === document.activeElement),
      "the focus reticle stands on it, so a reader arrives where they left (I-182)",
    ).toBe(true);

    /* --- the other direction: hold those entities, read what cites them (X-2) --- */
    // The section every staged column takes was read at ONE entity, and each column's geometry at an
    // entity of its own — so holding this one asks for the lines that cite it, which is all three,
    // rather than for whatever the sheet published (X-2).
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [staged.cited.section]));
    await expect(viewer.status, "the sheet paints again").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect(trace.entities, "the entity every staged column's section was read at is held").toHaveCount(1);

    await expect(trace.cited, "the selection tab answers what cites the held selection").toBeVisible();
    await expect(trace.cited, "with a reading that answered").toHaveAttribute("data-state", "ready");
    const citing = await trace.citedLineIds();
    expect(citing, "the staged column concrete line cites this entity, so it is listed").toContain(staged.line.lineId);
    await expect(trace.cited, "and the block counts exactly the rows it holds").toHaveAttribute("data-count", String(citing.length));

    const back = page.locator(`${testIdSelector(TESTIDS.viewer.inspectorCitedLine)}[data-line="${staged.line.lineId}"]`).getByTestId("evidence-link").first();
    await expect(back, "each cited line offers a way back to its own register row").toHaveAttribute("href", new RegExp(`takeoff/register\\?line=${staged.line.lineId}$`));

    await checkpoint(page, testInfo, "j-021-column-slice/cited");
    await expect(trace.inspector, "cited.png pictures the other direction of X-2").toHaveScreenshot(["j-021-column-slice", "cited.png"], {
      animations: "disabled",
      mask: trace.masks(),
      maxDiffPixelRatio: 0.002,
    });

    /* --- and the way back is a way back --- */
    await back.click();
    await page.waitForURL(new RegExp(`takeoff/register\\?line=${staged.line.lineId}$`));
    await expect(takeoff.originLink, "which lands on the register at that row, marked").toHaveAttribute("data-line", staged.line.lineId);

    /* --- and the answer is THOSE entities', not the sheet's: one column's own entity, one line --- */
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [own[0] as string]));
    await expect(viewer.status, "the sheet paints once more").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect(trace.entities, "and this time one column's own entity is what is held").toHaveCount(1);
    await expect(trace.cited, "the block answers for what is held now").toHaveAttribute("data-state", "ready");
    expect(
      await trace.citedLineIds(),
      "holding the entity this column alone was read at lists its line and withholds its siblings' — the lines that cite THOSE entities (X-2)",
    ).toEqual([staged.line.lineId]);
  });
});
