/**
 * THE v22 GALLERY — eight screens, two themes, one frame (Design Direction 00 §9.3).
 *
 * "A reviewer should be able to lay the eight stills side by side and see the same frame, the same
 * rail, the same readout on every one — that sameness is the instrument."
 *
 * It is a SPEC and not a standalone Playwright script on purpose. Everything a still needs is
 * already built and already proved in this lane: the geometry (`capture-geometry.ts`), the frozen
 * tenant and the frozen clock (`picture-tenant.ts`, provisioned by the global setup), the built
 * product on the journeys' port, `settled()`, and §9.3's height cap. A script under `scripts/` that
 * reached for a browser of its own would be a second lane with a second idea of what 1440×900 means
 * — which is exactly the drift the picture tenant exists to end (B-17). `scripts/capture-gallery.mjs`
 * runs this file and does nothing else.
 *
 * It is skipped unless `CUBIT_GALLERY=1`, so a journey run collects it and spends nothing on it.
 */
import { expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PICTURE_ROUTES, PICTURE_TENANT, pictureTest as test } from "./support/picture-tenant";
import { settled } from "./support/settled";
import { TESTIDS } from "../../src/ui/testids";

/** Where the gallery lives, beside the scores and the lease that took its pictures. */
const GALLERY = join(process.cwd(), "docs", "design", "gallery-v22");

/** §9.3: "capped at 2× the viewport height — a taller capture fails the run". */
const VIEWPORT_H = 900;
const HEIGHT_CAP = VIEWPORT_H * 2;

/** The M0–M2 screens, in the order §9.2 rebuilds them, each with the address it is pictured at. */
const SCREENS: readonly { readonly name: string; readonly path: string }[] = [
  { name: "home", path: PICTURE_ROUTES.workspace },
  { name: "project", path: PICTURE_ROUTES.project },
  { name: "drawings", path: `${PICTURE_ROUTES.project}/drawings` },
  { name: "viewer", path: `${PICTURE_ROUTES.project}/viewer/${PICTURE_TENANT.drawingId}/${encodeURIComponent(PICTURE_TENANT.sheetName)}` },
  { name: "register", path: `${PICTURE_ROUTES.project}/takeoff/register` },
  { name: "coverage", path: `${PICTURE_ROUTES.project}/takeoff/coverage` },
  { name: "members", path: `${PICTURE_ROUTES.workspace}/settings/members` },
  { name: "ruleset", path: `${PICTURE_ROUTES.project}/settings/ruleset` },
];

/** The two grounds. Dark is the product's default, so it is the gallery's first pair (§1). */
const THEMES = ["dark", "light"] as const;

test.describe("the v22 gallery", () => {
  test.skip(process.env["CUBIT_GALLERY"] !== "1", "the gallery is taken by scripts/capture-gallery.mjs, not by every journey run");

  test("every M0–M2 screen, in both themes, at the §9.3 geometry", async ({ page }) => {
    test.setTimeout(600_000);
    await mkdir(GALLERY, { recursive: true });

    // Signed in as the picture tenant's own account: a still of the signed-out frame is a still of
    // the auth card, which is its own screen below and not the frame every other screen wears.
    await page.goto("/sign-in");
    await page.getByTestId(TESTIDS.sAuth.email).fill(PICTURE_TENANT.email);
    await page.getByTestId(TESTIDS.sAuth.password).fill(PICTURE_TENANT.password);
    await page.getByTestId(TESTIDS.sAuth.submit).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

    for (const theme of THEMES) {
      for (const screen of SCREENS) {
        // The theme is set as the instrument's own capability, not by a URL anybody can take
        // (src/app/theme-resolver.ts), and it is set BEFORE the navigation so the first paint is
        // already on the right ground — the Surveyor's own fix, §9.1 point 2.
        await page.goto(`${screen.path}?__theme=${theme}`);
        await settled(page);
        await expect(page.getByTestId(TESTIDS.shell.root)).toHaveAttribute("data-theme", theme);

        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(height, `${screen.name}.${theme}: §9.3 caps a still at twice the viewport; a taller one is a picture of a scroll, not of a screen`).toBeLessThanOrEqual(HEIGHT_CAP);

        await page.screenshot({ path: join(GALLERY, `${screen.name}-${theme}.png`), fullPage: true });
      }
    }

    // The auth card is the ninth pair and the only one taken signed out (§3.7).
    await page.getByTestId(TESTIDS.sAuth.signout).click().catch(() => undefined);
    for (const theme of THEMES) {
      await page.goto(`/sign-in?__theme=${theme}`);
      await settled(page);
      await page.screenshot({ path: join(GALLERY, `auth-${theme}.png`), fullPage: true });
    }
  });
});
