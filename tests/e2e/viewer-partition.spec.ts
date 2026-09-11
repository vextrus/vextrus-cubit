/**
 * J-021 — the views/grid leg of the column slice (AC-5, and the served halves of AC-2, AC-3 and
 * AC-4): a partitioned sheet opened, every stored view and axis on the panel and on the overlay,
 * the untyped view hatched and naming the register's own sentence, the two switches driven from the
 * keyboard, and one proposed class confirmed through the offered group and the one ConsequenceDialog
 * — the whole of it on both papers at axe serious/critical = 0 (R-TO-014, L-CAD-06/07, L-ACT-02,
 * R-UI-020/021/023/050/060, V-E2E).
 *
 * The gate runs `pnpm e2e --journey J-021`, which is Playwright's title grep — so every title here
 * names J-021.
 *
 * WebGL in CI: headless Chromium paints through SwiftShader, asked for by name below exactly as the
 * inspector journey asks. The overlay is a second 2D canvas over a drawn sheet, so a browser that
 * answers `data-renderer="unavailable"` fails this journey honestly.
 *
 * Nothing is transcribed. Every row, badge, axis and group this journey expects is derived from what
 * the partition job STORED, read out of the lane database by SQL; every sentence is read from the
 * product's own registry by key (B-19).
 */
import { expect, test } from "@playwright/test";
import { REFUSALS } from "../../src/core/errors";
import { checkpoint } from "./support/checkpoint";
import { SViewerPartitionPage } from "./pages/s-viewer-partition.page";
import { S_VIEWER, SViewerPage } from "./viewer/s-viewer.page";
import { UNTYPED, confirmationsOf, stagePartitionedSheet, storedDeferrals } from "./viewer/viewer-partition-stage";
import { TESTIDS, testIdSelector } from "../../src/ui/testids";
import { everyRow, steadyCount, steadyText } from "./support/retrying-read";

/** The stored reason a caption no grammar rule reads leaves on its view (L-CAD-06, AC-3). */
const CAPTION_UNCLASSIFIABLE = "CAPTION_UNCLASSIFIABLE";

/** The act the panel's one door carries, and the key its offer is grouped on (L-ACT-02). */
const CONFIRM_VIEW_TYPE = "CONFIRM_VIEW_TYPE";
const PROPOSED_VIEW_TYPE = "PROPOSED_VIEW_TYPE";

/** The class the reticle draws on every focusable control of the house (R-UI-060, Decision §7). */
const RETICLE = "cx-reticle";

/** How long every layer of a small staged sheet has to arrive. */
const SHEET_BUDGET_MS = 120_000;

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

test.describe("J-021 — views and grid on the sheet: what the machine saw, and confirming what it proposed", () => {
  test("J-021: a reader reads the partition on the sheet, toggles the paint from the keyboard, and confirms a proposed class", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(900_000);
    expect(baseURL, "the journeys are driven against the served product").toBeTruthy();

    const staged = await stagePartitionedSheet(page);
    const viewer = new SViewerPage(page);
    const partition = new SViewerPartitionPage(page);
    const address = S_VIEWER.route(staged.tenantId, staged.projectId, staged.drawingId, staged.layoutName);

    /* --- what the store holds: this journey's whole expectation, derived and never typed (B-19) --- */
    const deferrals = storedDeferrals(staged.tenantId, staged.ingestId);
    const untyped = staged.views.filter((view) => view.type === UNTYPED);
    expect(untyped.length, "the staged plan carries captions no grammar rule reads, so the store holds untyped views").toBeGreaterThan(0);
    const proposedClasses = [...new Set(staged.views.filter((view) => view.proposedType !== null).map((view) => view.proposedType as string))].sort();
    expect(proposedClasses.length, "and a recorded answer proposed a class for each, in more than one class").toBeGreaterThan(1);
    // The group this journey confirms: the biggest one, so the dialog is graded over more than one subject.
    const membersOf = (type: string): string[] => staged.views.filter((view) => view.proposedType === type).map((view) => view.viewKey).sort();
    const confirmingClass = [...proposedClasses].sort((left, right) => membersOf(right).length - membersOf(left).length)[0] as string;
    const members = membersOf(confirmingClass);
    expect(members.length, `the class ${confirmingClass} is proposed for at least one view`).toBeGreaterThan(0);

    /* --- the sheet, opened and drawn --- */
    await page.goto(address, { waitUntil: "commit" });
    // The paint's own budget is PB-2's and the perf lane's verdict, never this journey's: what is
    // waited on here is that the sheet arrives at all, so the overlay has something to be laid over.
    await expect(viewer.status, "the staged sheet paints").toHaveAttribute("data-first-paint", "true", { timeout: SHEET_BUDGET_MS });
    await expect(viewer.status, "and it is painted by WebGL, which is what the overlay is laid over").toHaveAttribute("data-renderer", "webgl");
    await expect
      .poll(async () => {
        const total = await viewer.statusNumber("data-total-layers");
        return total > 0 && (await viewer.statusNumber("data-loaded-layers")) === total;
      }, { timeout: SHEET_BUDGET_MS, message: "every layer of the sheet arrives before the partition is asked about" })
      .toBe(true);

    /* --- j-021/partition-open: the panel says exactly what the store holds --- */
    await expect(partition.panel, "the views/grid panel docks in the left stack (R-UI-030, I-110)").toBeVisible();
    await expect(partition.panel, "and reads the partition of this drawing").toHaveAttribute("data-state", "ready", { timeout: SHEET_BUDGET_MS });
    await expect(viewer.layers, "under the layers panel, which keeps its place").toBeVisible();

    await expect(partition.viewRows, "one row per stored view, and no row of anything else").toHaveCount(staged.views.length);
    for (const view of staged.views) {
      const row = partition.viewRow(view.viewKey);
      await expect(row, `the store holds a view ${view.viewKey}, so the panel stands one`).toHaveCount(1);
      await expect(row, "wearing the stored type spelling").toHaveAttribute("data-type", view.type);
      await expect(row.getByTestId("viewer-partition-view-badge"), "and saying it verbatim on the badge (I-114)").toHaveText(view.type);
      await expect(row, "and saying whether the machine proposed a class for it").toHaveAttribute("data-proposed", String(view.proposedType !== null));
      await expect(row, "and that nothing has been confirmed of it yet").toHaveAttribute("data-confirmed", "false");
    }

    await expect(partition.axisRows, "one row per stored grid axis").toHaveCount(staged.axes.length);
    for (const axis of staged.axes) {
      const row = page.locator(`[data-testid="viewer-partition-axis"][data-label="${axis.label}"][data-view-key="${axis.viewKey}"]`);
      await expect(row, `the axis ${axis.label} of ${axis.viewKey} is listed`).toHaveCount(1);
      await expect(row, "in the family the grid stage read it as").toHaveAttribute("data-family", axis.family);
      await expect(row, "along the axis it runs").toHaveAttribute("data-axis", axis.axis);
    }

    await expect(partition.deferralRows, "one row per layout plan that georeferenced as deferred — shown, not hidden (R-UI-050)").toHaveCount(deferrals.length);
    for (const deferral of deferrals) {
      const row = page.locator(`[data-testid="viewer-partition-grid-deferral"][data-view-key="${deferral.viewKey}"]`);
      await expect(row, `the deferral of ${deferral.viewKey} stands`).toHaveCount(1);
      await expect(row, "naming the closed reason the store holds").toHaveAttribute("data-reason", deferral.reason);
    }

    /* --- AC-3: the untyped view is hatched on the sheet and names its reason in the register's words --- */
    for (const view of untyped) {
      const row = partition.viewRow(view.viewKey);
      await expect(row, "an untyped view says so machine-readably").toHaveAttribute("data-untyped", "true");
      await expect(row, "carrying the stored reason verbatim").toHaveAttribute("data-reason", CAPTION_UNCLASSIFIABLE);
      await expect(row.getByTestId("viewer-partition-view-reason"), "and rendering the REGISTER's own sentence for it, never a second spelling (I-111)").toHaveText(
        REFUSALS[CAPTION_UNCLASSIFIABLE].message,
      );
    }

    /* --- both switches are on, and the overlay counts what the scene holds --- */
    await expect(partition.viewsToggle, "the Views switch is a switch (R-UI-060)").toHaveAttribute("role", "switch");
    await expect(partition.gridToggle, "so is the Grid switch").toHaveAttribute("role", "switch");
    await expect(partition.viewsToggle, "and both are on at every mount").toHaveAttribute("aria-checked", "true");
    await expect(partition.gridToggle).toHaveAttribute("aria-checked", "true");
    await expect(partition.panel, "the section publishes the same two facts").toHaveAttribute("data-views", "on");
    await expect(partition.panel).toHaveAttribute("data-grid", "on");

    await expect(partition.overlayCanvas, "the overlay is out of the screen reader's way (I-112)").toHaveAttribute("aria-hidden", "true");
    expect(await partition.computed(partition.overlayCanvas, "pointer-events"), "and out of the pointer's reach — it paints, it never picks").toBe("none");
    const onSheet = await steadyCount(page.locator(`${testIdSelector(TESTIDS.viewer.partitionView)}[data-on-sheet="true"]`), "the views standing on this sheet");
    expect(await partition.count("data-outlines"), "one outline per view standing on this sheet").toBe(onSheet);
    expect(await partition.count("data-axes"), "one axis drawn per stored axis").toBe(staged.axes.length);
    // A hatch is a fill of an OUTLINE, so what is counted is the untyped views that stand on this
    // sheet — a view whose members are elsewhere paints nothing to hatch (Decision §2's partial).
    const hatchable = await steadyCount(page.locator(`${testIdSelector(TESTIDS.viewer.partitionView)}[data-untyped="true"][data-on-sheet="true"]`), "the untyped views standing on this sheet");
    expect(await partition.count("data-hatched"), "and the untyped views standing on this sheet are the hatched ones").toBe(hatchable);
    const bubbles = await partition.count("data-bubbles");
    expect(bubbles, "the bubbles drawn are the axes whose ring the store carries").toBeGreaterThan(0);
    expect(bubbles, "and never more axes than there are").toBeLessThanOrEqual(staged.axes.length);

    await checkpoint(page, testInfo, "j-021/partition-open");
    await expect(partition.panel, "panel-light.png pictures the region a reader reads the partition in").toHaveScreenshot(["viewer-partition", "panel-light.png"], {
      mask: [partition.offeredGroups.getByTestId("offered-group-count")],
      animations: "disabled",
    });
    await partition.setTheme("dark");
    await expect(partition.panel, "panel-dark.png pictures the same region on the other paper (R-UI-001)").toHaveScreenshot(["viewer-partition", "panel-dark.png"], {
      mask: [partition.offeredGroups.getByTestId("offered-group-count")],
      animations: "disabled",
    });
    await partition.setTheme("light");

    /* --- AC-5: the region is walked on the keyboard, in DOM order, every stop wearing the reticle --- */
    await partition.heading.focus();
    expect(await partition.heading.evaluate((element) => element === document.activeElement), "the region takes focus at its own heading (I-110)").toBe(true);
    const walk: string[] = ["viewer-partition-views-toggle", "viewer-partition-grid-toggle", ...members.map(() => "offered-group-confirm")];
    for (const expected of walk) {
      await page.keyboard.press("Tab");
      const stop = await partition.focused();
      expect(stop.testId, `tabbing through the panel reaches ${expected} in DOM order`).toBe(expected);
      expect(stop.classes.split(/\s+/), `and ${expected} wears the reticle a keyboard reader is followed by`).toContain(RETICLE);
    }

    /* --- j-021/partition-toggled: Views off from the keyboard, and nothing else moves --- */
    const scaleBefore = await viewer.scale();
    const selectionBefore = await viewer.status.getAttribute("data-selection");
    const viewportBefore = await viewer.viewportParam();
    const selectionParamBefore = await viewer.selectionParam();

    await partition.viewsToggle.focus();
    await page.keyboard.press("Space");
    await expect(partition.viewsToggle, "Space flips the switch").toHaveAttribute("aria-checked", "false");
    await expect(partition.panel, "and the section says the paint is off").toHaveAttribute("data-views", "off");
    await expect(partition.overlayCanvas, "no outline is drawn").toHaveAttribute("data-outlines", "0");
    await expect(partition.overlayCanvas, "and no hatch with it").toHaveAttribute("data-hatched", "0");
    expect(await partition.count("data-axes"), "while the grid is still drawn — the two switches are two facts").toBe(staged.axes.length);
    await expect(partition.gridToggle, "and the Grid switch is untouched").toHaveAttribute("aria-checked", "true");
    await expect(partition.viewRows, "every stored view keeps its row: a switch gates the PAINT and nothing else").toHaveCount(staged.views.length);

    expect(await viewer.scale(), "the camera did not move").toBe(scaleBefore);
    expect(await viewer.status.getAttribute("data-selection"), "nothing was selected or let go").toBe(selectionBefore);
    expect(await viewer.viewportParam(), "and the address carries the same camera").toBe(viewportBefore);
    expect(await viewer.selectionParam(), "and the same selection").toBe(selectionParamBefore);
    await checkpoint(page, testInfo, "j-021/partition-toggled");

    await partition.viewsToggle.focus();
    await page.keyboard.press("Space");
    await expect(partition.viewsToggle, "and the paint comes back exactly as it went").toHaveAttribute("aria-checked", "true");
    expect(await partition.count("data-outlines"), "with every outline it had").toBe(onSheet);

    /* --- j-021/partition-confirm-open: the offer, and the one dialog it opens --- */
    await expect(partition.offeredGroups, "the offer stands inside the panel's groups region (R-UI-023)").toBeVisible();
    await expect(partition.offeredGroups, "one group per proposed class among the unconfirmed views").toHaveAttribute("data-count", String(proposedClasses.length));
    await expect(
      partition.panel.locator('input[type="checkbox"], [role="checkbox"]'),
      "and no checkbox or select-all exists anywhere in this region — bulk is offered, never assembled (I-77)",
    ).toHaveCount(0);
    const group = partition.group(confirmingClass);
    await expect(group, `the class ${confirmingClass} is offered as a named group`).toHaveAttribute("data-kind", PROPOSED_VIEW_TYPE);
    await expect(group, "keyed on the drawing it is a reading of").toHaveAttribute("data-drawing", staged.drawingId);

    await partition.groupConfirm(confirmingClass).focus();
    await page.keyboard.press("Enter");
    await expect(partition.dialog, "the door opens the one act pattern (R-UI-021)").toBeVisible();
    await expect(partition.dialog, "over the act it is for").toHaveAttribute("data-act-type", CONFIRM_VIEW_TYPE);
    await expect(partition.subjectRows, "with one row per member of the group the machine named").toHaveCount(members.length);
    const subjects: string[] = [];
    for (const row of await everyRow(partition.subjectRows, "the Consequence subject rows")) subjects.push((await row.getAttribute("data-subject")) ?? "");
    expect(subjects.sort(), "and those rows are exactly that group's members — nobody widened them").toEqual(members);
    await expect(partition.digestLine, "the digest the server computed is shown, because the confirm carries it").not.toBeEmpty();
    const digest = await steadyText(partition.digestLine, "the Consequence digest line");
    expect(digest, "and it is a digest, not an empty line").not.toBe("");
    await expect(partition.confirm, "the act variant carries that very digest (L-ACT-02)").toHaveAttribute("data-digest", digest);
    await checkpoint(page, testInfo, "j-021/partition-confirm-open");

    /* --- j-021/partition-confirmed: the act lands, and the visible answer is the store's --- */
    await partition.confirm.focus();
    await page.keyboard.press("Enter");
    await expect(partition.dialog, "a carried consequence closes the dialog — the answer is the screen behind it").toBeHidden({ timeout: 60_000 });
    await expect(partition.offeredGroups, "the confirmed group is gone, and the other one stands").toHaveAttribute(
      "data-count",
      String(proposedClasses.length - 1),
      { timeout: 60_000 },
    );
    await expect(partition.group(confirmingClass), "there is nothing left to offer of that class").toHaveCount(0);

    for (const viewKey of members) {
      const row = partition.viewRow(viewKey);
      await expect(row, "each member's row says a class has been confirmed of it").toHaveAttribute("data-confirmed", "true");
      const stored = staged.views.find((view) => view.viewKey === viewKey);
      await expect(row.getByTestId("viewer-partition-view-badge"), "while the badge still says what the GRAMMAR read — a confirmation appends, it never overwrites (I-114)").toHaveText(
        (stored as { type: string }).type,
      );
    }

    const confirmations = confirmationsOf(staged.tenantId, staged.ingestId);
    expect(confirmations.map((row) => row.viewKey).sort(), "the ledger holds one confirmation per subject").toEqual(members);
    expect([...new Set(confirmations.map((row) => row.type))], "each naming the class that was confirmed").toEqual([confirmingClass]);
    expect([...new Set(confirmations.map((row) => row.actId))], "and all of them naming the one act that carried them").toHaveLength(1);
    await checkpoint(page, testInfo, "j-021/partition-confirmed");
  });
});
