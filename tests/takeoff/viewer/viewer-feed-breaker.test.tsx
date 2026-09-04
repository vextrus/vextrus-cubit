// @vitest-environment jsdom
/**
 * The viewer's screen against a feed that does not answer the way the happy path does.
 *
 * The screen is mounted the way a reader meets it — no `head` prop, so it opens the sheet by asking
 * `/api/viewer/{drawing}/{layout}` for the head and then for each layer, exactly as it does in a
 * browser — and the feed is answered by a stub standing where the network stands. Nothing here
 * supplies a head, because the two failures below live in the asking.
 *
 * Both are cells the screen's own state matrix declares (`states.ts`, R-UI-050): the error cell,
 * delegated to the root boundary "only a head that cannot be read at all reaches it", and the
 * partial cell, "a layer whose geometry did not arrive keeps its row, says so, and offers to fetch
 * itself again". R-UI-020 binds both: silence never happens.
 */
import { Component, type ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { syntheticEntityGraph } from "./support/synthetic-graph";
import { VIEWER_SCREEN_MODULE, productModule, viewerSeam, type RenderManifest } from "./support/viewer-support";

/** The seam the screen's module graph reaches; no scope is ever asked for, but the pool is built. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** Small enough for jsdom, wide enough to have layers that can go missing one at a time. */
const SHEET = { entities: 400, layers: 4, seed: 7 } as const;

type ScreenModule = { ViewerScreen: (props: Record<string, unknown>) => ReactNode };

let manifest: RenderManifest;
let facts: unknown;
let ViewerScreen: ScreenModule["ViewerScreen"];

let prepared: Promise<void> | undefined;
function prepare(): Promise<void> {
  prepared ??= (async () => {
    const graph = syntheticEntityGraph(SHEET);
    const { buildRenderManifest } = await viewerSeam();
    manifest = buildRenderManifest(graph, graph.layouts[0]?.name as string) as RenderManifest;
    facts = (await productModule<{ factsOf: (graph: unknown) => unknown }>("src/modules/takeoff/ingest/facts.ts")).factsOf(graph);
    ViewerScreen = (await productModule<ScreenModule>(VIEWER_SCREEN_MODULE)).ViewerScreen;
  })();
  return prepared;
}

/** The props the route hands the screen, with no head — so the screen opens the sheet itself. */
function props(): Record<string, unknown> {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    projectId: "22222222-2222-4222-8222-222222222222",
    drawingId: "33333333-3333-4333-8333-333333333333",
    layoutName: manifest.layoutName,
    initialViewport: null,
  };
}

/** One answer of the feed, in the shape `fetch` gives the screen. */
function answer(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

/** The head as the route publishes it: the roster and the facts, without any geometry. */
function headBody(): unknown {
  return {
    kind: "manifest",
    cache: "miss",
    facts,
    version: manifest.version,
    layoutName: manifest.layoutName,
    extents: manifest.extents,
    insunits: manifest.insunits,
    digest: manifest.digest,
    layers: manifest.layers.map((layer) => ({ name: layer.name, rgb: layer.rgb, entityCount: layer.entityCount })),
  };
}

/** One layer, as the feed answers `?part=layer&index=<n>`. */
function layerBody(index: number): unknown {
  const layer = manifest.layers[index];
  return { index, name: layer?.name, rgb: layer?.rgb, entityCount: layer?.entityCount, records: layer?.records };
}

/**
 * The boundary the error cell is delegated to, stood in for here: a head that cannot be read at all
 * is raised into the render, and this is what catches it. The test accepts either the raise or a
 * refusal rendered in place — what it will not accept is neither.
 */
class Boundary extends Component<{ children: ReactNode }, { caught: boolean }> {
  override state = { caught: false };
  static getDerivedStateFromError(): { caught: boolean } {
    return { caught: true };
  }
  override render(): ReactNode {
    return this.state.caught ? <p data-testid="breaker-boundary">the boundary took it</p> : this.props.children;
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the feed answers a fault: the reader is told, one way or the other (R-UI-020, R-UI-050)", () => {
  test("a head that answers 500 with a fault id is never served as an empty sheet", async () => {
    await prepare();
    const faultId = "6f0f3f6a-0000-4000-8000-breaker0fault";
    vi.stubGlobal("fetch", async () => answer(500, { faultId }));

    render(
      <Boundary>
        <ViewerScreen {...props()} />
      </Boundary>,
    );

    // The screen settles: it has asked, and it has decided what to show.
    await waitFor(() => {
      expect(screen.queryByTestId("viewer-loading"), "the bones come down once the feed has answered").toBeNull();
    });

    const boundary = screen.queryByTestId("breaker-boundary");
    const refusal = screen.queryByTestId("refusal-state");
    const told = boundary !== null || refusal !== null;
    expect(
      told,
      "a feed answer that is not a head — a 500 carrying a fault id — must reach the reader as the error cell (raised, so the root boundary takes it) or as a refusal in place; today the answer is swallowed and the sheet is drawn empty, which is the silence R-UI-020 forbids",
    ).toBe(true);

    if (!told) return;
    const status = screen.queryByTestId("viewer-status");
    if (status !== null) {
      expect(
        status.getAttribute("data-first-paint"),
        "and a sheet that never arrived is not published as painted — PB-2's first paint is geometry a reader can see",
      ).not.toBe("true");
    }
  });
});

describe("a layer that does not arrive is the partial cell, shown and not hidden (R-UI-050, I-81)", () => {
  test("one layer's geometry fails: its row says so", async () => {
    await prepare();
    const missing = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("part=head")) return answer(200, headBody());
      const index = Number(new URL(String(url), "http://feed.invalid").searchParams.get("index"));
      return index === missing ? answer(500, { faultId: "fault" }) : answer(200, layerBody(index));
    });

    render(<ViewerScreen {...props()} />);

    await waitFor(() => {
      expect(screen.getByTestId("viewer-status").getAttribute("data-loaded-layers")).toBe(String(manifest.layers.length - 1));
    });

    const name = manifest.layers[missing]?.name as string;
    const row = screen.getAllByTestId("viewer-layer-row").find((candidate) => candidate.getAttribute("data-layer") === name);
    expect(row, `the panel keeps a row for ${name} — a sheet is not withdrawn because part of it is missing`).toBeDefined();
    expect(
      row?.getAttribute("data-failed"),
      `${name}'s geometry never arrived, so its row is marked failed and offers to fetch itself again (states.ts: partial, rendered by layers-panel.tsx)`,
    ).toBe("true");
  });

  test("every layer's geometry fails: every row says so, rather than a blank sheet that claims to be painted", async () => {
    await prepare();
    vi.stubGlobal("fetch", async (url: string) => (String(url).includes("part=head") ? answer(200, headBody()) : answer(500, { faultId: "fault" })));

    render(<ViewerScreen {...props()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("viewer-layer-row").length).toBe(manifest.layers.length);
    });
    await waitFor(() => {
      expect(screen.getByTestId("viewer-status").getAttribute("data-loaded-layers")).toBe("0");
    });

    const flags = screen.getAllByTestId("viewer-layer-row").map((row) => row.getAttribute("data-failed"));
    expect(
      flags,
      "not one layer of the sheet arrived: every row is marked failed, so the reader is told the sheet is empty because it could not be fetched (R-UI-020)",
    ).toEqual(manifest.layers.map(() => "true"));
  });
});
