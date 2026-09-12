// THE LANE'S OWN GROUND, and the one place a spec asks for it (B-17).
//
// The dark lane exists to picture the dark product. A spec that emulates a theme mid-test and then
// sets the page back to a SPELLED theme rather than to the lane's own ends the walk on that spelled
// ground, and every capture after it is a picture of the wrong product — measured on this branch on
// 2026-09-12: `design-dark/shell-tenant-switcher-open.png` had mean luma 241.8 (white) and was
// byte-identical to its light twin, because `shell.spec.ts` restored `colorScheme: "light"` after
// its two-theme pair. §9.3 names that exact fault ("dark captures are light") as the thing the two
// projects exist to end.
//
// So: a capture named `-light` or `-dark` states its own ground and must be TAKEN on it in both
// lanes; every other capture belongs to the lane, and a spec that borrowed the page's theme gives it
// back here rather than to a literal.
import type { Page, TestInfo } from "@playwright/test";

/** The ground this project walks on, as the project itself declares it (`playwright.config.ts`). */
export function laneTheme(testInfo: TestInfo): "light" | "dark" {
  const asked = (testInfo.project.use as { colorScheme?: "light" | "dark" | "no-preference" | null }).colorScheme;
  return asked === "dark" ? "dark" : "light";
}

/**
 * Ask the browser for a theme the way the product resolves one: the OS preference, read pre-paint at
 * load (`src/app/theme-resolver.ts`), which is why the reload is not optional — the attribute's one
 * home is the root document's resolver and no clause asks the shell to track a live flip.
 */
export async function emulateTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.reload();
}

/** Give the page back to the lane after a spec has borrowed it for a two-theme pair. */
export async function restoreLaneTheme(page: Page, testInfo: TestInfo): Promise<void> {
  await emulateTheme(page, laneTheme(testInfo));
}
