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
 * Nothing is transcribed. Since VD-1 the staged lines cite what a real rail's lines cite — a view
 * anchored at the plan's caption, the member's placement, and the entities its section and storey
 * height were read at — and each member stands in the store naming the outline and the mark it was
 * read off (`../takeoff/register-stage.ts`). So the Trace this journey follows is the one a real line
 * gets: it opens the sheet the member stands on (model space here, spelled as the artifact spells it)
 * and selects the MEMBER, not the keys the line happens to cite (I-421). The address followed is
 * the one the register's own link carries; the formula, the variable names, the values and the keys
 * asserted in the inspector are the ones the staged line itself was published with (B-19).
 */
import { expect, test } from "@playwright/test";
import { checkpoint } from "../support/checkpoint";
import { STakeoffPage, type RegisterFilter } from "../pages/s-takeoff.page";
import { SViewerTracePage } from "../pages/s-viewer-trace.page";
import { S_VIEWER, SViewerPage, VIEWER_BUDGETS } from "../viewer/s-viewer.page";
import { CLASS_COLUMN, stageRegister, type StagedMember } from "../takeoff/register-stage";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { heldAttribute, steadyText } from "../support/retrying-read";
import { afterSettled } from "../support/settled";

/** The register's five filter chips, in the bar's order (s-takeoff §7). */
const FILTERS: readonly RegisterFilter[] = ["class", "kind", "level", "basis", "coverage"];

/**
 * What the page puts at this element's own centre, run IN the page: `itself` when the element (or a
 * node inside it) is what a pointer pressed there would press, else the thing that stands there
 * instead. A clipped option answers with the grid under it — which is what walk-0 found.
 */
function standsWhereItPaints(node: Element): string {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit !== null && node.contains(hit)) return "itself";
  return hit === null ? "nothing" : `${hit.tagName.toLowerCase()}.${[...hit.classList].join(".")}`;
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

    /* --- the stage: the column slice, in production's key shapes (VD-1) --- */
    const staged = await stageRegister(page, { label: "j021" });
    // The member the followed line was measured off: the placement its count cites (B-19).
    const member = Object.values(staged.members).find((held) => Object.values(staged.line.variables).some((binding) => binding.source === held.placementKey));
    expect(member, `the followed line cites the placement of one staged member: ${JSON.stringify(staged.line.variables)}`).toBeTruthy();
    const { outlineKey, markKey } = member as StagedMember;

    /* --- the register: every published line offers a Trace from the key it was read at --- */
    await takeoff.open(staged.tenantId, staged.projectId);
    const traced = await takeoff.tracedLineIds();
    expect(traced.length, "the lines table offers a Trace from every line it shows (R-UI-022)").toBeGreaterThan(0);
    expect(traced, "including the column concrete line this journey follows").toContain(staged.line.lineId);

    const link = takeoff.evidenceLink(staged.line.lineId);
    await expect(link, "the source cell's whole content is the link").toBeVisible();
    const href = (await heldAttribute(link, "href")) ?? "";
    expect(href, "the address names the entities the line cites").toContain("s=");
    expect(href, "and the row it was followed from").toContain(`line=${encodeURIComponent(staged.line.lineId)}`);
    expect(/[?&]v=/.test(href), "and states no camera, which is what makes the viewer fly (s-viewer-inspector I-85)").toBe(false);
    await expect(link, "the link wears the basis of the number it stands for (R-UI-002)").toHaveAttribute("data-basis", /.+/);

    /* --- the Trace: the sheet flies to the cited entities and the formula is read --- */
    await link.click();
    await page.waitForURL(/\/viewer\//);
    await expect(viewer.status, "the sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await trace.settled();

    // TEST_AMENDED (VD-1, I-421): the Trace selects the MEMBER — the outline and the mark its
    // placement row names — where it once carried every key the line cites. As strict as before: the
    // address names exactly those two, and the sheet holds exactly those two.
    const asked = trace.addressKeys();
    expect(asked, "the address names the member the line was measured off: its outline, then its mark").toEqual([outlineKey, markKey]);
    expect(asked, "which is the selection the register's own reading composed").toEqual(staged.line.traceKeys);
    expect(trace.addressLine(), "and the row the reader came from").toBe(staged.line.lineId);

    const held = await trace.selectedKeys();
    expect([...held].sort(), "both stand on the sheet the Trace opened, so both are selected and flown to (I-88: what was found stays selected)").toEqual([...asked].sort());
    await expect(viewer.missingKeys, "and nothing the address named is missing from this sheet").toHaveCount(0);
    await expect(viewer.screen, "the camera flew to them").toHaveAttribute("data-flyto-flight", /^[1-9]\d*$/);

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
      // TEST_AMENDED (VD-1): the count is cited at the member's placement, as a real line's is; every
      // variable states the very key it was published with.
      expect(row.source, `${name}: at the key the line was published with`).toBe(binding.source);
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
      await afterSettled(takeoff.originLink, () => takeoff.originLink.evaluate((node) => node === document.activeElement)),
      "the focus reticle stands on it, so a reader arrives where they left (I-182)",
    ).toBe(true);

    /* --- the filter bar: a chip opens its options over the grid, and the pointer takes one (s-takeoff I-442/b) --- */
    // walk-0 (session 8): a click on a chip showed one empty filter field where the bar had been, and
    // no option — the 36 px bar clipped the popover — while every journey that narrowed stayed green,
    // because Playwright's own click scrolls a clipped box until its target shows. So the option is
    // asked what stands where it PAINTS, and pressed there by the mouse, as a hand presses it. The rows
    // stand (the origin read above is a client-only fact), so the chips are live.
    const classChip = takeoff.filter("class");
    await classChip.click();
    await expect(classChip, "the class chip opens").toHaveAttribute("aria-expanded", "true");
    const column = takeoff.root.locator(`[role="option"][data-value="${CLASS_COLUMN}"]`);
    await expect(column, "offering the class the staged lines stand in").toHaveCount(1);
    await expect
      .poll(() => column.evaluate(standsWhereItPaints), { message: "the option is what a pointer finds where it paints — not the grid under a clipped bar" })
      .toBe("itself");
    for (const name of FILTERS) {
      await expect
        .poll(() => takeoff.filter(name).evaluate(standsWhereItPaints), { message: `the ${name} chip still stands where it paints while one is open — the bar did not scroll it away` })
        .toBe("itself");
    }
    const said = (await steadyText(column, "the class option's words")).trim();
    const box = await afterSettled(column, () => column.boundingBox());
    expect(box, "the option has a box to press").not.toBeNull();
    const at = box as { x: number; y: number; width: number; height: number };
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    await expect(classChip, "the chip takes the option the pointer pressed").toHaveAttribute("data-chosen", "true");
    await expect.poll(async () => (await classChip.getAttribute("aria-label"))?.endsWith(` ${said}`) ?? false, { message: `and reads it (${said})` }).toBe(true);
    await expect(takeoff.root.getByRole("listbox"), "the list closed behind the choice").toHaveCount(0);
    await expect(classChip, "leaving the reader on the chip rather than at the top of the page").toBeFocused();
    await expect(takeoff.evidenceLink(staged.line.lineId), "and the column line this journey followed is one the filter keeps").toHaveCount(1);

    // The keyboard reaches the next chip from there: Tab steps to it, Enter opens it, Esc closes it onto itself.
    await page.keyboard.press("Tab");
    await expect(takeoff.filter("kind"), "Tab steps to the kind chip").toBeFocused();
    await page.keyboard.press("Enter");
    await expect(takeoff.filter("kind"), "Enter opens it").toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(takeoff.root.getByRole("listbox"), "Esc closes it").toHaveCount(0);
    await expect(takeoff.filter("kind"), "onto the chip itself").toBeFocused();

    /* --- the other direction: hold those entities, read what cites them (X-2) --- */
    // The section every staged column takes was read at ONE entity, and each column is a member of
    // its own — so holding this one asks for the lines that cite it, which is all three, rather than
    // for whatever the sheet published (X-2).
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [staged.shared.section]));
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

    /* --- and the answer is THOSE entities', not the sheet's: one column's own outline, one line --- */
    // Walk-0 (BLOCKS_DEMO): holding a column's OUTLINE on the sheet answered "No published line cites
    // this selection", because a line cites its placement and never the outline. The door now meets
    // the selection through the register's own join (I-421).
    await page.goto(S_VIEWER.selecting(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName, [outlineKey]));
    await expect(viewer.status, "the sheet paints once more").toHaveAttribute("data-first-paint", "true", { timeout: VIEWER_BUDGETS.firstPaintColdMs });
    await expect(trace.entities, "and this time one column's own outline is what is held").toHaveCount(1);
    await expect(trace.cited, "the block answers for what is held now").toHaveAttribute("data-state", "ready");
    expect(
      await trace.citedLineIds(),
      "holding the outline of the column this line was measured off lists its line and withholds its siblings' — the lines that cite THOSE entities (X-2)",
    ).toEqual([staged.line.lineId]);
  });
});
