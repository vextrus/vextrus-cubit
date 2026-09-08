// @vitest-environment jsdom
/**
 * AC-2's panel half, AC-3's row half and AC-4's offer half — the shipped `ViewerScreen` mounted over
 * a supplied head, with the feed stood in for: the screen asks `?part=partition` for itself, which
 * is the door the contract fixes, so nothing here reaches past the surface a reader meets.
 *
 * What is judged is what a journey and an operator read: the test ids the Decision closes (§7), the
 * `data-` hooks it names, and the copy the registry and the refusal register carry. Nothing here
 * reads product source, and nothing freezes a roster: every row expectation is derived from the
 * overlay under test, so an overlay carrying more views grows the expectation with it (B-19).
 *
 * The overlay canvas publishes its counts from the scene the panel computed — a count that waits on
 * a 2D context is a count no reader and no journey can rely on, and jsdom hands out no context.
 */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  CAPTION_UNCLASSIFIABLE,
  COPY,
  FACTS_MODULE,
  MODEL_SPACE,
  PROPOSED_VIEW_TYPE,
  TESTID,
  UNTYPED,
  VIEWER_MODULE,
  VIEWER_SCREEN_MODULE,
  buildOverlayArtifact,
  errorsSeam,
  overlayFixture,
  productModule,
} from "./support/overlay-stage";

/**
 * The viewer seam reads a record before it builds, so its module graph reaches the store. Nothing
 * here opens a connection — no scope is ever asked for — but the address must be stated before the
 * import so the pool is constructed rather than refused as unconfigured.
 */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** The workspace, project and drawing the mounted screen is addressed by. */
const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const DRAWING = "33333333-3333-4333-8333-333333333333";

type Manifest = { layoutName: string; extents: unknown; insunits: unknown; digest: string; version: number; layers: { name: string; rgb: [number, number, number]; entityCount: number; records: unknown[] }[] };

let manifest: Manifest;
let facts: unknown;
let ViewerScreen: (props: Record<string, unknown>) => unknown;
let messageOf: (code: string) => string;

beforeAll(async () => {
  const artifact = buildOverlayArtifact(5);
  const seam = await productModule<{ buildRenderManifest: (graph: unknown, layoutName: string) => Manifest }>(VIEWER_MODULE);
  manifest = seam.buildRenderManifest(artifact.graph, MODEL_SPACE);
  facts = (await productModule<{ factsOf: (graph: unknown) => unknown }>(FACTS_MODULE)).factsOf(artifact.graph);
  ViewerScreen = (await productModule<{ ViewerScreen: (props: Record<string, unknown>) => unknown }>(VIEWER_SCREEN_MODULE)).ViewerScreen;
  const { REFUSALS } = await errorsSeam();
  messageOf = (code: string) => REFUSALS[code]?.message ?? "";
}, 120_000);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The props the route hands the screen, with the head supplied so the mount fetches no geometry twice. */
function props(): Record<string, unknown> {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    drawingId: DRAWING,
    layoutName: manifest.layoutName,
    initialViewport: null,
    head: { kind: "manifest", manifest, cache: "miss", facts },
  };
}

/** One answer of the feed, in the shape `fetch` gives the screen. */
function answer(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** The head, one layer, and the partition — the three questions the screen asks this feed. */
function serve(partition: () => Response): void {
  vi.stubGlobal("fetch", async (url: string) => {
    const asked = String(url);
    if (asked.includes("part=partition")) return partition();
    if (asked.includes("part=head")) {
      return answer(200, {
        kind: "manifest",
        cache: "miss",
        facts,
        version: manifest.version,
        layoutName: manifest.layoutName,
        extents: manifest.extents,
        insunits: manifest.insunits,
        digest: manifest.digest,
        layers: manifest.layers.map((layer) => ({ name: layer.name, rgb: layer.rgb, entityCount: layer.entityCount })),
      });
    }
    const index = Number(new URL(asked, "http://feed.invalid").searchParams.get("index"));
    const layer = manifest.layers[index];
    return answer(200, { index, name: layer?.name, rgb: layer?.rgb, entityCount: layer?.entityCount, records: layer?.records });
  });
}

/** The panel, once it has settled into the state the answer puts it in. */
async function panelIn(state: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.getByTestId(TESTID.panel).getAttribute("data-state"), `the panel settles into ${state}`).toBe(state);
  });
  return screen.getByTestId(TESTID.panel);
}

/** One row's attributes, as a journey reads them. */
function attributes(row: HTMLElement, names: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(names.map((name) => [name, row.getAttribute(name)]));
}

/**
 * Whether a `data-` hook claims the thing it is named for. The contract fixes the hooks' NAMES and
 * fixes `"true"`/`"false"` where a criterion spells one; where it does not, a row that says nothing
 * and a row that says `false` are the same answer, and this reading takes both rather than pinning
 * a spelling the spec never published (C-04).
 */
function claims(row: HTMLElement, name: string): boolean {
  const said = row.getAttribute(name);
  return said !== null && said !== "" && said !== "false" && said !== "null" && said !== "undefined";
}

describe("AC-2: the panel is the stored partition, and the overlay canvas counts what it paints", () => {
  test("AC-2: the panel docks under the layers panel and says it is ready", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);

    const panel = await panelIn("ready");
    expect(panel.tagName, "the region is a section of the left stack, not a second panel of its own").toBe("SECTION");
    const layers = screen.getByTestId(TESTID.layers);
    expect(
      Boolean(layers.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
      "and it stands under the layers panel, where the Decision docks it",
    ).toBe(true);
  });

  test("AC-2: one row per stored view, badged with the stored type spelling", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    const panel = await panelIn("ready");

    const rows = within(panel).getAllByTestId(TESTID.view);
    expect(
      rows.map((row) => row.getAttribute("data-view-key")),
      "one row per view the overlay carries, in the order it carries them",
    ).toEqual(overlay.views.map((view) => view.viewKey));

    for (const view of overlay.views) {
      const row = rows.find((candidate) => candidate.getAttribute("data-view-key") === view.viewKey) as HTMLElement;
      expect(attributes(row, ["data-type", "data-on-sheet"]), `${view.viewKey} publishes its stored type and whether it stands on this sheet`).toEqual({
        "data-type": view.type,
        "data-on-sheet": String(view.box !== null),
      });
      expect(claims(row, "data-proposed"), `${view.viewKey} claims a proposal exactly where the store holds one`).toBe(view.proposed !== null);
      expect(claims(row, "data-confirmed"), `${view.viewKey} claims a confirmation exactly where one has been made`).toBe(view.confirmed !== null);
      expect(within(row).getByTestId(TESTID.badge).textContent, `${view.viewKey}'s badge is the stored spelling, verbatim`).toBe(view.type);
    }
  });

  test("AC-2: one axis row per stored axis and one deferral row per stored deferral", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    const panel = await panelIn("ready");

    const axes = within(panel).getAllByTestId(TESTID.axis);
    expect(
      axes.map((row) => `${row.getAttribute("data-view-key")}|${row.getAttribute("data-family")}|${row.getAttribute("data-axis")}|${row.getAttribute("data-label")}`),
      "one row per stored axis, carrying the view it stands in, its family, its world axis and its label",
    ).toEqual(overlay.axes.map((axis) => `${axis.viewKey}|${axis.family}|${axis.axis}|${axis.label}`));

    const deferrals = within(panel).getAllByTestId(TESTID.deferral);
    expect(
      deferrals.map((row) => `${row.getAttribute("data-view-key")}|${row.getAttribute("data-reason")}`),
      "and one row per layout plan that georeferenced as deferred, naming the closed reason",
    ).toEqual(overlay.deferrals.map((deferral) => `${deferral.viewKey}|${deferral.reason}`));
    expect(deferrals[0]?.textContent, "which says the register's own sentence for that reason (R-UI-020)").toContain(messageOf(overlay.deferrals[0]?.reason ?? ""));
  });

  test("AC-2: both switches are on at mount, and the section says so", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    const panel = await panelIn("ready");

    for (const id of [TESTID.viewsToggle, TESTID.gridToggle]) {
      const toggle = within(panel).getByTestId(id);
      expect(toggle.getAttribute("role"), `${id} is a switch`).toBe("switch");
      expect(toggle.getAttribute("aria-checked"), `${id} is on at mount — nothing is persisted`).toBe("true");
    }
    expect(attributes(panel, ["data-views", "data-grid"]), "and the section publishes both switches for the overlay to be read by").toEqual({
      "data-views": "on",
      "data-grid": "on",
    });
    expect(within(panel).getByTestId(TESTID.viewsToggle).textContent, "the views switch says its own word").toContain(COPY["viewer_partition_views_toggle"]);
    expect(within(panel).getByTestId(TESTID.gridToggle).textContent, "and the grid switch says its own").toContain(COPY["viewer_partition_grid_toggle"]);
  });

  test("AC-2: the overlay canvas lies over the sheet and counts what the scene holds", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    await panelIn("ready");

    const canvas = await waitFor(() => screen.getByTestId(TESTID.canvas));
    expect(canvas.getAttribute("aria-hidden"), "the overlay is paint: it is not a thing a reader reaches").toBe("true");
    expect(screen.getByTestId(TESTID.sheet), "and it lies over the sheet, which is still the surface underneath").toBeTruthy();

    const outlines = overlay.views.filter((view) => view.box !== null);
    await waitFor(() => {
      expect(
        attributes(canvas, ["data-outlines", "data-hatched", "data-axes", "data-bubbles"]),
        "after the first frame the canvas publishes what it painted: the views with a box, the hatched ones among them, the axes and the bubbles",
      ).toEqual({
        "data-outlines": String(outlines.length),
        "data-hatched": String(outlines.filter((view) => view.type === UNTYPED).length),
        "data-axes": String(overlay.axes.length),
        "data-bubbles": String(overlay.axes.filter((axis) => axis.bubble !== null).length),
      });
    });
  });

  test("AC-2: a sheet with no partition teaches, and a partition that cannot be read offers to be read again", async () => {
    serve(() => answer(200, { overlay: null }));
    const first = render(<ViewerScreen {...props()} />);
    const empty = await panelIn("empty");
    expect(empty.textContent, "the empty cell says why it is empty (R-UI-020)").toContain(COPY["viewer_partition_empty"]);
    expect(within(empty).queryAllByTestId(TESTID.view).length, "and holds no rows at all").toBe(0);
    expect(within(empty).queryAllByTestId(TESTID.axis).length, "of either kind").toBe(0);
    first.unmount();

    serve(() => answer(500, { faultId: "6f0f3f6a-0000-4000-8000-000000000000" }));
    render(<ViewerScreen {...props()} />);
    const failed = await panelIn("failed");
    expect(failed.textContent, "a partition that could not be read says so").toContain(COPY["viewer_partition_failed"]);
    expect(within(failed).getByTestId(TESTID.retry), "and offers to ask again in place").toBeTruthy();
  });
});

describe("AC-3: an untyped row is hatched and names its reason from the register", () => {
  test("AC-3: the untyped rows carry the stored reason and say the register's sentence", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    const panel = await panelIn("ready");

    const untyped = overlay.views.filter((view) => view.type === UNTYPED);
    expect(untyped.length, "the overlay under test really carries views the grammar could not read").toBeGreaterThan(0);

    for (const view of overlay.views) {
      const row = within(panel)
        .getAllByTestId(TESTID.view)
        .find((candidate) => candidate.getAttribute("data-view-key") === view.viewKey) as HTMLElement;
      const isUntyped = view.type === UNTYPED;
      expect(claims(row, "data-untyped"), `${view.viewKey} is marked untyped when, and only when, the store says it is`).toBe(isUntyped);
      if (isUntyped) expect(row.getAttribute("data-reason"), `${view.viewKey} carries the stored reason, verbatim`).toBe(view.reason);
      else expect(row.getAttribute("data-reason") ?? "", `${view.viewKey} has no reason to carry`).toBe("");

      const said = within(row).queryAllByTestId(TESTID.reason);
      expect(said.length, `${view.viewKey} renders a reason exactly when it has one`).toBe(isUntyped ? 1 : 0);
      if (isUntyped) {
        expect(said[0]?.textContent, "the register's own sentence for that code — never re-spelled in the strings table").toBe(messageOf(view.reason as string));
      }
    }

    expect(untyped[0]?.reason, "and the stored reason of a caption the grammar could not read is its own code").toBe(CAPTION_UNCLASSIFIABLE);
  });
});

describe("AC-4: the offer stands in the panel, and no select-all stands anywhere in it", () => {
  test("AC-4: the shipped OfferedGroups is mounted, one group per proposed class, keyed on the fact judged", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    const panel = await panelIn("ready");

    const groups = within(panel).getByTestId(TESTID.groups);
    expect(within(groups).getByTestId(TESTID.offeredGroups), "the one shipped pattern, mounted — never a second offer of its own").toBeTruthy();

    const armed = new Map<string, number>();
    for (const view of overlay.views) {
      if (view.proposed === null || view.confirmed !== null) continue;
      armed.set(view.proposed.type, (armed.get(view.proposed.type) ?? 0) + 1);
    }
    expect(armed.size, "the overlay under test really proposes more than one class").toBeGreaterThan(1);

    const offered = within(groups).getAllByTestId(TESTID.offeredGroup);
    expect(
      offered.map((row) => row.getAttribute("data-view-type")).sort(),
      "one group per proposed class among the views nobody has confirmed",
    ).toEqual([...armed.keys()].sort());
    for (const row of offered) {
      expect(attributes(row, ["data-kind", "data-drawing"]), `the ${row.getAttribute("data-view-type")} group publishes the key it is offered on`).toEqual({
        "data-kind": PROPOSED_VIEW_TYPE,
        "data-drawing": DRAWING,
      });
      expect(within(row).getByTestId(TESTID.offeredGroupConfirm), "and the one door there is").toBeTruthy();
    }
  });

  test("AC-4: no checkbox and no select-all exists anywhere inside the panel", async () => {
    const overlay = overlayFixture();
    serve(() => answer(200, { overlay }));
    render(<ViewerScreen {...props()} />);
    const panel = await panelIn("ready");

    expect(
      panel.querySelectorAll('input[type="checkbox"], [role="checkbox"]').length,
      "bulk is offered, never assembled: a visitor cannot add a subject to a group or take one out (L-ACT-02, R-UI-023)",
    ).toBe(0);
  });
});
