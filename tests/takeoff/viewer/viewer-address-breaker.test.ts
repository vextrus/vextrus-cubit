/**
 * The viewer's address, attacked at both ends (R-UI-031: the URL is the source of truth, and a sheet
 * at a viewport is one link).
 *
 * Two facts about the route's own segments, and one about the camera the address carries:
 *
 * 1. Next hands a dynamic segment already decoded — proved on the running app, where
 *    `/api/viewer/{drawing}/%256Dodel?part=head` (which decodes ONCE to `%6Dodel`, a sheet no
 *    drawing carries) answered the `model` sheet with `200 {"kind":"manifest"}`, and the page at the
 *    same segment titled itself "Sheet model". A second `decodeURIComponent` therefore reads a name
 *    the reader did not ask for: two addresses collide, a sheet whose layout name carries a percent
 *    sequence cannot be addressed at all, and one whose name carries a bare `%` throws `URIError` —
 *    on the feed that is `500 {"faultId": …}` with a fault recorded against a reader's own URL.
 * 2. The camera the viewer writes into `v` must be a camera the same module can read back. Below
 *    5e-5 pixels per drawing unit the spelling rounds the scale to `0`, and `parseViewport` refuses
 *    its own notation — so the address in the bar is not the address that reopens the sheet.
 */
import { describe, expect, test } from "vitest";
import { VIEWER_CLIENT_MODULE, productModule } from "./support/viewer-support";

/** The screen's module graph reaches the store; no scope is asked for here. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** The page this increment ships, at the address its ownership names. */
const PAGE_MODULE = "src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/page.tsx";

/** The four segments of the route, as Next resolves them for a page. */
type PageParams = { tenant: string; project: string; drawing: string; layout: string };

type PageModule = {
  default: (input: { params: Promise<PageParams>; searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<unknown>;
  generateMetadata: (input: { params: Promise<{ layout: string }> }) => Promise<{ title: string }>;
};

type ClientModule = {
  fitCamera: (extents: unknown, viewportPx: { width: number; height: number }) => { scale: number; centre: [number, number] };
  zoomCameraAt: (camera: unknown, factor: number, atPx: { x: number; y: number }) => { scale: number };
  serialiseViewport: (camera: unknown) => string;
  parseViewport: (value: string) => { x: number; y: number; scale: number } | null;
};

/** The screen's props, as the page hands them over. */
function propsOf(element: unknown): Record<string, unknown> {
  return (element as { props?: Record<string, unknown> }).props ?? {};
}

/** The page rendered for one layout segment, as Next resolves it (decoded). */
async function openSheet(layout: string): Promise<unknown> {
  const page = await productModule<PageModule>(PAGE_MODULE);
  return page.default({
    params: Promise.resolve({ tenant: "11111111-1111-4111-8111-111111111111", project: "22222222-2222-4222-8222-222222222222", drawing: "33333333-3333-4333-8333-333333333333", layout }),
    searchParams: Promise.resolve({}),
  });
}

describe("the layout segment is read once, because Next hands it over decoded (R-UI-031)", () => {
  test("a sheet name is carried to the screen as it stands, never decoded a second time", async () => {
    // `%6Dodel` is the name of no sheet; decoded a second time it becomes `model`, which is the name
    // of one. A screen handed the second is showing a sheet the address did not ask for.
    const element = await openSheet("%6Dodel");
    expect(
      propsOf(element)["layoutName"],
      "the segment Next resolved is the sheet's name: decoding it again makes `/viewer/{d}/%256Dodel` and `/viewer/{d}/model` the same address, and makes a sheet whose own name carries a percent sequence unaddressable",
    ).toBe("%6Dodel");
  });

  test("a sheet whose name carries a bare percent opens as itself rather than throwing", async () => {
    // A layout named `50%` reaches this component as `50%`. `decodeURIComponent("50%")` throws
    // URIError, which on the feed is answered `500 {"faultId": …}` — a reader's own address recorded
    // as our fault (ARCH-03), and on the page a raise the boundary takes.
    await expect(
      openSheet("50%"),
      "a sheet name is not an escape sequence: an address the reader can type must answer as a sheet or as an absence, never as a fault",
    ).resolves.toBeDefined();
  });

  test("the tab's title reads the same segment the same way", async () => {
    const page = await productModule<PageModule>(PAGE_MODULE);
    await expect(page.generateMetadata({ params: Promise.resolve({ layout: "50%" }) }), "the metadata reads the segment the page reads").resolves.toBeDefined();
  });
});

describe("the camera the address carries is one the viewer can read back (R-UI-031, AC-6)", () => {
  test("a sheet so large that fitting it zooms far out still writes a viewport that reopens it", async () => {
    const client = await productModule<ClientModule>(VIEWER_CLIENT_MODULE);
    const viewportPx = { width: 1200, height: 800 };
    // A drawing 40 000 000 units wide — a site plan in millimetres — fits at ~2.5e-5 px per unit.
    const camera = client.fitCamera({ min: [0, 0], max: [40_000_000, 30_000_000] }, viewportPx);
    const spelled = client.serialiseViewport(camera);
    const read = client.parseViewport(spelled);

    expect(read, `the viewer wrote \`v=${spelled}\` into the address itself: what it writes, it must read (R-UI-031)`).not.toBeNull();
    expect(
      Math.abs((read?.scale ?? 0) - camera.scale) / camera.scale,
      `and the camera it reads back is the camera it wrote — \`v=${spelled}\` restores ${String(read?.scale)} against ${camera.scale}`,
    ).toBeLessThan(0.05);
  });

  test("zooming out with a trackpad leaves the address restorable", async () => {
    const client = await productModule<ClientModule>(VIEWER_CLIENT_MODULE);
    const viewportPx = { width: 1200, height: 800 };
    let camera: unknown = client.fitCamera({ min: [0, 0], max: [1000, 800] }, viewportPx);
    // Seven flicks of a trackpad, each the factor one 1000-unit `deltaY` makes on the canvas.
    for (let flick = 0; flick < 7; flick += 1) camera = client.zoomCameraAt(camera, Math.exp(-1.5), { x: 600, y: 400 });

    const spelled = client.serialiseViewport(camera);
    const read = client.parseViewport(spelled);
    expect(read, `after seven zoom-out flicks the viewer wrote \`v=${spelled}\`, which it then refuses to read: reloading the tab loses the reader's place`).not.toBeNull();
    expect((read?.scale ?? 0) > 0, "and the scale it reads back is a scale").toBe(true);
  });
});
