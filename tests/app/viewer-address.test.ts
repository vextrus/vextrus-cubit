// The viewer's address publisher: R-UI-031 makes the address the camera, and the last frame of a
// gesture can settle after the person has already left the sheet. A flush that lands then would
// stamp `?v=` onto whatever page they navigated to.
import { expect, test, vi } from "vitest";
import { serialiseViewport } from "../../src/modules/takeoff/viewer/client";
import type { Camera } from "../../src/modules/takeoff/viewer/types";
import { codeOf, productModule } from "./support/source-facts";

const ADDRESS = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/address.ts";
const SCREEN = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen.tsx";

const OWN_PATH = "/t/ashuganj/p/p-1/viewer/d-1/Layout1";
const CAMERA: Camera = { centre: [1200.5, -340.25], scale: 0.75, viewport: { width: 800, height: 600 } };

interface AddressModule {
  publishViewport: (
    win: { location: { pathname: string; search: string; href: string }; history: { replaceState(data: unknown, unused: string, url: string): void } },
    ownPathname: string,
    at: Camera,
  ) => boolean;
}

/** A window standing at some address, with the one history call this module is allowed to make. */
function windowAt(pathname: string, search: string) {
  return {
    location: { pathname, search, href: `https://cubit.example${pathname}${search}` },
    history: { replaceState: vi.fn() },
  };
}

test("AC-1(e): a flush that arrives after the reader has left stamps nothing", async () => {
  const { publishViewport } = await productModule<AddressModule>(ADDRESS);
  const elsewhere = windowAt("/t/ashuganj/p/p-1/audit", "");

  expect(publishViewport(elsewhere, OWN_PATH, CAMERA), "the viewer's own page is no longer the page").toBe(false);
  expect(elsewhere.history.replaceState, "another screen's address is never rewritten").not.toHaveBeenCalled();
});

test("AC-1(e): on its own page the camera is written to the address, keeping every other parameter", async () => {
  const { publishViewport } = await productModule<AddressModule>(ADDRESS);
  const here = windowAt(OWN_PATH, "?part=3&index=2");

  expect(publishViewport(here, OWN_PATH, CAMERA), "the viewer's own address is its to publish").toBe(true);
  expect(here.history.replaceState, "the address is replaced, never pushed").toHaveBeenCalledTimes(1);

  const written = String(here.history.replaceState.mock.calls[0]?.[2] ?? "");
  const url = new URL(written, "https://cubit.example");
  expect(url.pathname, "the address stays the viewer's own").toBe(OWN_PATH);
  expect(url.searchParams.get("v"), "the camera is carried as the seam serialises it").toBe(serialiseViewport(CAMERA));
  expect(url.searchParams.get("part"), "a parameter the screen did not write is not dropped").toBe("3");
  expect(url.searchParams.get("index"), "a parameter the screen did not write is not dropped").toBe("2");
});

test("AC-1(e): the screen no longer replaces the address itself", () => {
  // white-box: AC-1(e) — B-17 asks that this decision have one home; "the screen makes no history
  // call of its own" is a property of the module's text, with no runtime observable once the
  // publisher exists.
  expect(codeOf(SCREEN).includes("replaceState"), `${SCREEN} still calls history.replaceState outside the address module`).toBe(false);
});
