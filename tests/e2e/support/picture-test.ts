// THE PICTURE LANE'S PLAYWRIGHT HALF — the frozen clock and the `test` that installs it.
//
// It is a file of its own so that `picture-tenant.ts` can be PLAYWRIGHT-FREE. That module holds the
// tenant's facts and the SQL that installs them, and both are wanted by things that are not a
// browser: the journeys' global setup, and the vitest that proves the seed actually lands rows
// (db/__tests__/picture-tenant-seed.live.test.ts). Importing `@playwright/test` is not free —
// `baseTest.extend({...})` runs at import time and throws outside a Playwright runner — so a data
// module that reached for it could never be unit-tested. Splitting the fixture from the facts is
// what makes the seed testable at all.
import { test as baseTest, type Page } from "@playwright/test";
import { pictureLane } from "./capture-geometry";
import { PICTURE_CLOCK } from "./picture-tenant";

/**
 * The frozen clock, injected into the BROWSER CONTEXT rather than into the product: a picture is a
 * picture of what a reader sees, and what a reader sees is what `new Date()` answered in their tab.
 * `page.clock.setFixedTime` pins that answer without stopping timers, so a screen that polls still
 * polls and only its idea of "now" is fixed — which is what keeps "2 minutes ago" from moving
 * between two runs of the same still.
 *
 * Off unless the run asked for pictures, so an existing journey's clock is untouched.
 */
export async function freezeClock(page: Page): Promise<void> {
  if (!pictureLane()) return;
  await page.clock.setFixedTime(PICTURE_CLOCK);
}

/**
 * The journeys' `test`, with the picture clock installed before the first navigation. A picture spec
 * imports `test` from here; every other journey imports it from `@playwright/test` and meets the
 * lane it always met.
 */
export const pictureTest = baseTest.extend({
  page: async ({ page }, use: (page: Page) => Promise<void>) => {
    await freezeClock(page);
    await use(page);
  },
});
