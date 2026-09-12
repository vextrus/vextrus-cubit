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
import { DISCIPLINE, goldenRun } from "./golden-run";

test.use({ viewport: { width: 1440, height: 900 } });

test.describe.serial("J-000 — Golden Path: the sheets are given their discipline", () => {
  test("J-000 m1-confirm-disciplines: the offered discipline is confirmed, and the sheets wear it", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const run = await goldenRun(page);
    const drawings = new SDrawingsPage(page);

    await drawings.open(run.tenantId, run.projectId);
    await settled(page);

    const group = drawings.groupFor(DISCIPLINE);
    await expect(group, `the reading offers the ${DISCIPLINE} sheets as one group to confirm`).toBeVisible({ timeout: 120_000 });
    await drawings.confirmGroup(DISCIPLINE);

    await settled(page);
    await expect(drawings.groupFor(DISCIPLINE), "a confirmed group is no longer an offer standing open").toHaveCount(0, { timeout: 60_000 });
    await expect(drawings.cards.first().getByTestId("sheet-card-discipline"), "and each sheet wears the discipline it was confirmed under").toContainText(
      /STRUCT|Structural/i,
    );

    await checkpoint(page, testInfo, "j-000/disciplines-confirmed");
  });
});
