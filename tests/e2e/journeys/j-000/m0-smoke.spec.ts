// J-000 — the Golden Path smoke. It proves the lane itself: the product was built, is being served
// on the journey port, and answers the root route with the shell every other journey starts from.
//
// `/` carries no named checkpoint here, so the smoke attaches no screenshot and runs no axe on it:
// V-E2E's "axe on every checkpoint page" binds the pages that ARE checkpoints, and this increment's
// checkpoint set is the three Design Decision § 7 enumerates (all on S-Auth routes, all judged by
// axe in j-001a). The root document belongs to src/app/layout.tsx, which this increment does not
// own; `/` is promoted to an axe checkpoint by the increment that owns that cure (B-20).
import { expect, test } from "@playwright/test";

test.describe("J-000 — Golden Path smoke", () => {
  test("J-000: the product shell renders at /", async ({ page }) => {
    const answer = await page.goto("/");
    expect(answer?.status(), "the root route answers 200").toBe(200);

    // The shell's own landmark, which every screen renders inside.
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page).toHaveURL(/\/$/);
  });
});
