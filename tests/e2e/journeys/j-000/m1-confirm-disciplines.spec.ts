/**
 * J-000 SEGMENTS: confirm disciplines
 *
 * M1's leg of the golden path: the sheets F-RCC6 fanned out into are OFFERED a discipline, and a
 * person confirms the offer through the one ConsequenceDialog. Nothing is staged — the state this
 * leg starts from is the state the legs before it left, reached by `goldenRun()` with a browser
 * (AM-09 §2).
 */
import { expect, test } from "@playwright/test";
import { SDrawingsPage } from "../../pages/s-drawings.page";
import { checkpoint } from "../../support/checkpoint";
import { settled } from "../../support/settled";
import { goldenRun, releaseGoldenWorker } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe.serial("J-000 — Golden Path: the sheets are given their discipline", () => {
  test.afterAll(async () => {
    await releaseGoldenWorker();
  });

  test("J-000 m1-confirm-disciplines: the offered discipline is confirmed, and the sheets wear it", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await goldenRun(page);
    const drawings = new SDrawingsPage(page);

    await drawings.open(run.tenantId, run.projectId);
    await settled(page);

    // The discipline is the READING's, not this journey's: the offer standing on the screen is what
    // a person meets, and transcribing a guess here would test the fixture rather than the product.
    const offer = drawings.groups.first();
    await expect(offer, "the reading offers its sheets as a group to confirm").toBeVisible({ timeout: 120_000 });
    const offered = (await offer.getAttribute("data-discipline")) ?? "";
    expect(offered, "an offered group names the discipline it proposes").not.toBe("");

    await drawings.confirmGroup(offered);
    await settled(page);
    await expect(drawings.groupFor(offered), "a confirmed group is no longer an offer standing open").toHaveCount(0, { timeout: 60_000 });
    await expect(drawings.cards.first().getByTestId("sheet-card-discipline"), "and each sheet wears the discipline it was confirmed under").not.toBeEmpty();

    await checkpoint(page, testInfo, "j-000/disciplines-confirmed");
  });
});
