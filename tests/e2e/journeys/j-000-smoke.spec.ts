// J-000 — the Golden Path smoke. It proves the lane itself: the product was built, is being served
// on the journey port, and answers the root route with the shell every other journey starts from.
import { expect, test } from "@playwright/test";

test.describe("J-000 — Golden Path smoke", () => {
  test("J-000: the product shell renders at /", async ({ page }) => {
    const answer = await page.goto("/");
    expect(answer?.status(), "the root route answers 200").toBe(200);

    // Checkpoint j-000-home: the shell's own landmark, which every screen renders inside.
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page).toHaveURL(/\/$/);
  });
});
