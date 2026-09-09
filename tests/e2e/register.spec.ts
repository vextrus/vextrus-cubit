/**
 * J-021's register leg — the column slice, read as a register (R-TO-050, S-Takeoff, J-021).
 *
 * The journey walks the product as a person does: from the project home's Takeoff tab into the
 * workspace, down the tree to a column, and out through the Measure door. What it asserts is what a
 * reader can see — the nav that says where they are standing, the object's own attributes, the
 * sightings that produced no line rendered in place, and the run the door started shown beneath it.
 *
 * The two design checkpoints are taken here and nowhere else; the picture itself is the gate's to
 * re-take (v16.2 §1).
 */
import { expect, test } from "@playwright/test";
import { STakeoffPage } from "./pages/s-takeoff.page";
import { SProjectPage } from "./pages/s-project.page";
import { CLASS_COLUMN, DISCIPLINE, LEVEL_LABEL, MARKS, stageRegister } from "./takeoff/register-stage";
import { checkpoint } from "./support/checkpoint";

/** The width the frame paints all three regions of the body at (R-UI-030, lg and up). */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe("J-021 — the register workspace", () => {
  test("J-021: a staged column campaign reads as a register, and the Measure door queues its run", async ({ page }, testInfo) => {
    const staged = await stageRegister(page, { label: "j021-register" });
    const project = new SProjectPage(page);
    const takeoff = new STakeoffPage(page);

    /* --- the project home is the visible door into the workspace (AC-1) --- */
    await project.open(staged.tenantId, staged.projectId);
    const tab = project.tab("takeoff");
    await expect(tab, "the Takeoff area has a screen now, so its tab is a link").toHaveAttribute("data-available", "true");
    await tab.click();
    await page.waitForURL(new RegExp(`/t/${staged.tenantId}/p/${staged.projectId}/takeoff/register$`));

    /* --- the lane's nav says where the reader is standing --- */
    await expect(takeoff.root, "the register workspace stands beneath the takeoff nav").toBeVisible();
    await expect(takeoff.nav).toBeVisible();
    await expect(takeoff.navRegister, "the entry for the address in the browser says so (I-125)").toHaveAttribute("aria-current", "page");

    /* --- the tree: discipline → level → class → object --- */
    for (const label of [DISCIPLINE, LEVEL_LABEL, CLASS_COLUMN, ...MARKS]) {
      await expect(takeoff.treeItem(label), `the tree states \`${label}\``).toBeVisible();
    }

    /* --- the inspector, filled from the object the reader chose --- */
    await takeoff.treeItem(MARKS[0] as string).click();
    await expect(takeoff.inspector).toBeVisible();
    await expect(page.getByTestId("register-object-key"), "the object key, whole").toBeVisible();
    await expect(page.getByTestId("register-object-basis")).toBeVisible();
    await expect(page.getByTestId("register-object-role")).toBeVisible();
    await expect(takeoff.objectCorroboration, "and the corroboration state a reader judges it by").toBeVisible();

    /* --- what produced no line is shown, not hidden (R-UI-050's partial cell) --- */
    await expect(takeoff.refusals).toBeVisible();
    await expect(takeoff.refusalRows.first(), "the refused sighting renders in place, through the one RefusalState").toBeVisible();
    await expect(takeoff.refusalRows.first().getByTestId("refusal-state")).toBeVisible();
    await expect(takeoff.refusalRows.first().getByTestId("refusal-evidence-link"), "carrying the link to the evidence that resolves it").toHaveAttribute(
      "href",
      `/t/${staged.tenantId}/p/${staged.projectId}/drawings`,
    );
    await expect(takeoff.root).toHaveAttribute("data-state", "partial");

    await checkpoint(page, testInfo, "s-takeoff/register");
    await expect(page).toHaveScreenshot(["s-takeoff", "register.png"], { mask: takeoff.masks(), animations: "disabled" });

    /* --- the Measure door: the run is queued, and shown where it was started (R-UI-024) --- */
    await takeoff.measure.click();
    await expect(takeoff.timeline).toBeVisible();
    await expect(takeoff.measureStep, "the measure run the door answered stands on the timeline beneath it").toBeVisible();
    await expect(takeoff.measureStep, "carrying the job the door answered").toHaveAttribute("data-job", /.+/);
    await expect(takeoff.root, "and the workspace is otherwise unchanged").toHaveAttribute("data-state", "partial");

    await checkpoint(page, testInfo, "s-takeoff/measure-queued");
  });
});
