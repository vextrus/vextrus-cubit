/**
 * AC-1(e): the viewer's address flush may not stamp another page.
 *
 * The camera is published into the address on every settle. A flush that fires after the reader has
 * already left the sheet rewrites whatever page they landed on with this sheet's `?v=` — the effect
 * is a stranger's URL wearing a camera. The cure is that the publisher is told which pathname it
 * belongs to and answers `false`, touching nothing, when the window is somewhere else.
 *
 * It is a pure function of a window-shaped bag, so it is driven as one: no jsdom, no component, and
 * the expected `v` derived by asking the viewer module's own serialiser rather than spelling a
 * camera's text here (B-19, ARCH-02).
 */
import { describe, expect, test } from "vitest";
import { productModule } from "../server/support/wire";
// white-box: AC-1(e) — the last leg of this criterion is B-17's "one home": the `replaceState`
// token must appear NOWHERE in the viewer screen. An absent call has no runtime observable — a
// render that simply never reaches the screen's own flush would pass — so the code channel is read.
import { lexed } from "./support/sources";

const VIEWER_DIR = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]";
const ADDRESS = `${VIEWER_DIR}/address.ts`;
const SCREEN = `${VIEWER_DIR}/viewer-screen.tsx`;
const CLIENT = "src/modules/takeoff/viewer/client.ts";

/** The sheet this viewer is drawing — the pathname the publisher belongs to. */
const OWN_PATH = "/t/2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88/p/e0a1/viewer/d7/L1";

interface Camera {
  readonly centre: readonly [number, number];
  readonly scale: number;
  readonly viewport: { readonly width: number; readonly height: number };
}

interface ClientModule {
  fitCamera: (extents: { min: readonly [number, number]; max: readonly [number, number] } | null, viewportPx: { width: number; height: number }) => Camera;
  serialiseViewport: (camera: Camera) => string;
}

interface AddressModule {
  publishViewport: (
    win: { location: { pathname: string; search: string; href: string }; history: { replaceState(data: unknown, unused: string, url: string): void } },
    ownPathname: string,
    at: Camera,
  ) => boolean;
}

/** A window-shaped bag standing where the real one would, recording every address it is given. */
function windowAt(pathname: string, search: string): { win: Parameters<AddressModule["publishViewport"]>[0]; written: string[] } {
  const written: string[] = [];
  return {
    win: {
      location: { pathname, search, href: `https://cubit.example${pathname}${search}` },
      history: {
        replaceState: (_data: unknown, _unused: string, url: string) => {
          written.push(url);
        },
      },
    },
    written,
  };
}

describe("AC-1: the viewer publishes its camera onto its own page and no other", () => {
  test("AC-1: a flush that lands on another pathname writes nothing and says so", async () => {
    const { publishViewport } = await productModule<AddressModule>(ADDRESS);
    const { fitCamera } = await productModule<ClientModule>(CLIENT);
    const camera = fitCamera({ min: [0, 0], max: [100, 80] }, { width: 800, height: 600 });

    const elsewhere = windowAt("/t/2b0a9a1e-7d5c-4f3b-9a61-0c6f5f2e4d88/p/e0a1/audit", "?q=acts");
    expect(publishViewport(elsewhere.win, OWN_PATH, camera), "a settle that fires after the reader has left the sheet publishes nothing").toBe(false);
    expect(elsewhere.written, "and it stamps no camera on the page they went to").toStrictEqual([]);
  });

  test("AC-1: on its own page it replaces the camera and keeps every other query parameter", async () => {
    const { publishViewport } = await productModule<AddressModule>(ADDRESS);
    const { fitCamera, serialiseViewport } = await productModule<ClientModule>(CLIENT);
    const camera = fitCamera({ min: [10, 10], max: [210, 130] }, { width: 640, height: 480 });

    const here = windowAt(OWN_PATH, "?layer=walls&v=0,0,1&pinned=3");
    expect(publishViewport(here.win, OWN_PATH, camera), "on its own page the camera is published").toBe(true);
    expect(here.written.length, `exactly one address is written — it wrote ${JSON.stringify(here.written)}`).toBe(1);

    const written = new URL(String(here.written[0]), "https://cubit.example");
    expect(written.pathname, "the address stays on the sheet it belongs to").toBe(OWN_PATH);
    expect(written.searchParams.get("v"), "the camera is the viewer's own serialisation (R-UI-031, ARCH-02)").toBe(serialiseViewport(camera));
    expect(written.searchParams.get("layer"), "every other parameter the address carried survives the flush").toBe("walls");
    expect(written.searchParams.get("pinned"), "including the ones this publisher knows nothing about").toBe("3");
  });

  test("AC-1: the viewer screen no longer replaces the address itself", () => {
    // white-box: AC-1(e) — B-17's "one invariant, one home": the criterion is that the token appears
    // nowhere in the screen's code, which no render of the screen can observe.
    const { code } = lexed(SCREEN);
    expect(code.includes("replaceState"), `${SCREEN} still calls history.replaceState itself — the address flush has one home now (${ADDRESS})`).toBe(false);
  });
});
