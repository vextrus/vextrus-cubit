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
 * IT IS NOT `test.skip`-ed when the run did not ask for it — Q-08 and C-06 forbid that, and rightly:
 * "an intentionally-not-run assertion surfaces as a recorded skip with an unforgeable trigger, never
 * as .skip or .only". A skipped assertion is one somebody has to remember is skipped. So the test is
 * simply NOT REGISTERED unless `CUBIT_GALLERY=1`: a journey run collects a file that declares no
 * test, which is an honest nothing, and there is no green skip line for anyone to read past.
 */
import { expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PICTURE_ROUTES, PICTURE_TENANT } from "./support/picture-tenant";
import { pictureTest as test } from "./support/picture-test";
import { afterSettled, settled } from "./support/settled";
import { TESTIDS } from "../../src/ui/testids";

/** Where the gallery lives, beside the scores and the lease that took its pictures. */
const GALLERY = join(process.cwd(), "docs", "design", "gallery-v22");

/**
 * §9.3's two measures: "the whole screen at exactly 1440×900 (and a second at 1280×800 for the fold
 * check)". Both are taken here, in both themes, and the file says which it is — until 2026-09-12 no
 * 1280×800 capture existed anywhere in the tree while `SCORES.md` claimed every criterion was
 * measured at both, and §7 takes the MINIMUM over the two. A fold that nothing photographs is a
 * fold nothing can score.
 */
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
] as const;

/** §9.3: "capped at 2× the viewport height — a taller capture fails the run". */
const heightCap = (viewport: { readonly height: number }): number =>
  viewport.height * 2;

/** The M0–M2 screens, in the order §9.2 rebuilds them, each with the address it is pictured at. */
const SCREENS: readonly { readonly name: string; readonly path: string }[] = [
  { name: "home", path: PICTURE_ROUTES.workspace },
  { name: "project", path: PICTURE_ROUTES.project },
  { name: "drawings", path: `${PICTURE_ROUTES.project}/drawings` },
  {
    name: "viewer",
    path: `${PICTURE_ROUTES.project}/viewer/${PICTURE_TENANT.drawingId}/${encodeURIComponent(PICTURE_TENANT.sheetName)}`,
  },
  { name: "register", path: `${PICTURE_ROUTES.project}/takeoff/register` },
  { name: "coverage", path: `${PICTURE_ROUTES.project}/takeoff/coverage` },
  { name: "members", path: `${PICTURE_ROUTES.workspace}/settings/members` },
  { name: "ruleset", path: `${PICTURE_ROUTES.project}/settings/ruleset` },
];

/** The two grounds. Dark is the product's default, so it is the gallery's first pair (§1). */
const THEMES = ["dark", "light"] as const;

/** Did this run ask for the gallery? Only then does the test below exist at all (Q-08, C-06). */
const TAKING = process.env["CUBIT_GALLERY"] === "1";

if (TAKING) {
  test.describe("the v22 gallery", () => {
    test("every M0–M2 screen, in both themes, at the §9.3 geometry", async ({
      page,
    }) => {
      test.setTimeout(600_000);
      await mkdir(GALLERY, { recursive: true });

      // Signed in as the picture tenant's own account: a still of the signed-out frame is a still of
      // the auth card, which is its own screen below and not the frame every other screen wears.
      await page.goto("/sign-in");
      await page.getByTestId(TESTIDS.sAuth.email).fill(PICTURE_TENANT.email);
      await page
        .getByTestId(TESTIDS.sAuth.password)
        .fill(PICTURE_TENANT.password);
      await page.getByTestId(TESTIDS.sAuth.submit).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        for (const theme of THEMES) {
          for (const screen of SCREENS) {
            // The theme is set as the instrument's own capability, not by a URL anybody can take
            // (src/app/theme-resolver.ts), and it is set BEFORE the navigation so the first paint is
            // already on the right ground — the Surveyor's own fix, §9.1 point 2.
            await page.goto(`${screen.path}?__theme=${theme}`);
            await settled(page);
            // The theme is the DOCUMENT's, not the shell's: `src/app/theme-resolver.ts` writes
            // `data-theme` on `<html>` pre-paint, and the shell root carries density alone. This line
            // read the shell root until 2026-09-12 and could never have passed — the spec had never
            // got past the sign-in it could not make, so nothing had ever run it.
            await expect(
              page.locator("html"),
              "the document states the theme it is painting in",
            ).toHaveAttribute("data-theme", theme);

            const height = await afterSettled(page, () => page.evaluate(
              () => document.documentElement.scrollHeight,
            ));
            expect(
              height,
              `${screen.name}.${theme}.${viewport.width}x${viewport.height}: §9.3 caps a still at twice the viewport; a taller one is a picture of a scroll, not of a screen`,
            ).toBeLessThanOrEqual(heightCap(viewport));

            // §9.3's own name for a still: the screen, the ground, and the measure it was taken at.
            await page.screenshot({
              path: join(
                GALLERY,
                `${screen.name}.${theme}.${viewport.width}x${viewport.height}.png`,
              ),
              fullPage: true,
            });
          }
        }
      }

      // The auth card is the ninth pair and the only one taken signed out (§3.7).
      // The session is ENDED, not merely clicked at. `signout` lives inside the user menu, so the
      // bare click above waited the whole test budget for a control that was never on the screen and
      // the two auth stills were never taken at all. The click is still attempted — signing out the
      // way a person does is the truer act — but it is bounded, and the cookie jar is what makes the
      // next navigation a signed-out one whether the control was reachable or not.
      await page
        .getByTestId(TESTIDS.sAuth.signout)
        .click({ timeout: 2_000 })
        .catch(() => undefined);
      await page.context().clearCookies();
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        for (const theme of THEMES) {
          await page.goto(`/sign-in?__theme=${theme}`);
          await settled(page);
          await page.screenshot({
            path: join(
              GALLERY,
              `auth.${theme}.${viewport.width}x${viewport.height}.png`,
            ),
            fullPage: true,
          });
        }
      }
    });
  });
}
