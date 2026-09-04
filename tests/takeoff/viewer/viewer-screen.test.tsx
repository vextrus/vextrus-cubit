// @vitest-environment jsdom
/**
 * AC-3's screen half and AC-4 — `ViewerScreen` mounted over a supplied head, which is the surface
 * the increment publishes for exactly this (`head?: ViewerHead`, so a mount fetches nothing).
 *
 * What is judged is what a journey and an operator read: the test ids the Decision closes (§7), the
 * `data-` hooks it names, and the copy the register carries. Nothing here reads product source, and
 * nothing freezes a roster: the layer rows are derived from the manifest under test and the fidelity
 * rows from the facts object's own keys, so a sheet with more layers and an `IngestFacts` with more
 * facts both grow the expectation rather than reding it (B-19).
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { syntheticEntityGraph } from "./support/synthetic-graph";
import {
  ERRORS_MODULE,
  FORMAT_MODULE,
  MANIFEST_NOT_RENDERABLE,
  VIEWER_SCREEN_MODULE,
  productModule,
  viewerSeam,
  type ErrorsModule,
  type FormatModule,
  type RenderManifest,
} from "./support/viewer-support";

/**
 * The seam reads a record before it builds, so its module graph reaches the store. Nothing here
 * opens a connection — no scope is ever asked for — but the address must be stated before the import
 * so the pool is constructed rather than refused as unconfigured.
 */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** The sheet the screen is mounted over: small enough for jsdom, wide enough to have layers to hide. */
const SHEET = { entities: 4321, layers: 4, seed: 44 } as const;

type Screen = { ViewerScreen: (props: Record<string, unknown>) => unknown };
type Facts = { factsOf: (graph: unknown) => Record<string, unknown> };

let manifest: RenderManifest;
let facts: Record<string, unknown>;
let formatUserFigure: FormatModule["formatUserFigure"];
let refusalOf: ErrorsModule["refusalOf"];
let ViewerScreen: Screen["ViewerScreen"];

/** The props the route hands the screen (increment interfaces), with the head supplied here. */
function props(head: unknown): Record<string, unknown> {
  return { tenantId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222", drawingId: "33333333-3333-4333-8333-333333333333", layoutName: manifest.layoutName, initialViewport: null, head };
}

/** The manifest head, as the route answers one. */
const manifestHead = (): unknown => ({ kind: "manifest", manifest, cache: "miss", facts });

/** A number read off a `data-` hook, as a journey reads one. */
function dataNumber(element: HTMLElement, name: string): number {
  const raw = element.getAttribute(name);
  expect(raw, `the status line publishes ${name}`).not.toBeNull();
  return Number(raw);
}

/** The status line, which is where every total this criterion names is published (Decision §7). */
function status(): HTMLElement {
  return screen.getByTestId("viewer-status");
}

/** One row by the layer it names — rows carry `data-layer`, so a row is found by its own layer. */
function rowFor(layerName: string): HTMLElement {
  const row = screen.getAllByTestId("viewer-layer-row").find((candidate) => candidate.getAttribute("data-layer") === layerName);
  expect(row, `the layers panel holds a row for ${layerName}`).toBeDefined();
  return row as HTMLElement;
}

/** The control of one row, by the test id the contract closes. */
function control(row: HTMLElement, testid: string): HTMLElement {
  const found = row.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  expect(found, `row ${row.getAttribute("data-layer")} carries its ${testid}`).not.toBeNull();
  return found as HTMLElement;
}

/** Σ of the manifest's own counts — the total the screen must publish, derived not transcribed. */
function totalEntities(): number {
  return manifest.layers.reduce((sum, layer) => sum + layer.entityCount, 0);
}

/**
 * The sheet and the modules, prepared once and awaited by each test rather than staged in a
 * `beforeAll`: a hook that throws leaves its tests reported as "did not run", and a criterion nobody
 * ran is not a criterion anybody judged.
 */
let prepared: Promise<void> | undefined;
function prepare(): Promise<void> {
  prepared ??= (async () => {
    const graph = syntheticEntityGraph(SHEET);
    const { buildRenderManifest } = await viewerSeam();
    manifest = buildRenderManifest(graph, graph.layouts[0]?.name as string) as RenderManifest;
    facts = (await productModule<Facts>("src/modules/takeoff/ingest/facts.ts")).factsOf(graph);
    formatUserFigure = (await productModule<FormatModule>(FORMAT_MODULE)).formatUserFigure;
    refusalOf = (await productModule<ErrorsModule>(ERRORS_MODULE)).refusalOf;
    ViewerScreen = (await productModule<Screen>(VIEWER_SCREEN_MODULE)).ViewerScreen;
  })();
  return prepared;
}

afterEach(() => {
  cleanup();
});

describe("AC-4: the layers panel is the manifest's own roster, and the status line its arithmetic", () => {
  test("AC-4: one row per layer, each with its swatch colour and its count", async () => {
    await prepare();
    render(<ViewerScreen {...props(manifestHead())} />);

    const rows = screen.getAllByTestId("viewer-layer-row");
    expect(
      rows.map((row) => row.getAttribute("data-layer")),
      "the panel holds one row per manifest layer, in the manifest's own order",
    ).toEqual(manifest.layers.map((layer) => layer.name));

    for (const layer of manifest.layers) {
      const row = rowFor(layer.name);
      const style = control(row, "viewer-layer-swatch").getAttribute("style") ?? "";
      const numbers = (style.match(/\d+/g) ?? []).map(Number);
      const carries = numbers.some((_, index) => layer.rgb.every((channel, offset) => numbers[index + offset] === channel));
      expect(carries, `the swatch of ${layer.name} resolves the layer's own colour ${layer.rgb.join(",")} — it is artifact data, never a token (Decision §1): ${style}`).toBe(true);

      expect(
        control(row, "viewer-layer-count").textContent ?? "",
        `the count of ${layer.name} is rendered through formatUserFigure (R-SPINE-010)`,
      ).toContain(formatUserFigure(String(layer.entityCount)));
    }

    expect(dataNumber(status(), "data-entity-count"), "the status line counts every entity of the sheet").toBe(totalEntities());
    expect(dataNumber(status(), "data-drawn-entities"), "and with nothing hidden it draws all of them").toBe(totalEntities());
  });

  test("AC-4: hiding a layer takes its entities out of what is drawn", async () => {
    await prepare();
    const user = userEvent.setup();
    render(<ViewerScreen {...props(manifestHead())} />);
    const layer = manifest.layers[0] as RenderManifest["layers"][number];

    await user.click(control(rowFor(layer.name), "viewer-layer-visible"));

    expect(rowFor(layer.name).getAttribute("data-visible"), `${layer.name} is hidden`).toBe("false");
    expect(dataNumber(status(), "data-drawn-entities"), `hiding ${layer.name} lowers what is drawn by its own count`).toBe(totalEntities() - layer.entityCount);
    expect(dataNumber(status(), "data-entity-count"), "the sheet still holds every entity it held").toBe(totalEntities());
  });

  test("AC-4: isolating a layer leaves only that layer drawn", async () => {
    await prepare();
    const user = userEvent.setup();
    render(<ViewerScreen {...props(manifestHead())} />);
    const layer = manifest.layers[0] as RenderManifest["layers"][number];

    await user.click(control(rowFor(layer.name), "viewer-layer-isolate"));

    expect(dataNumber(status(), "data-drawn-entities"), `isolating ${layer.name} draws that layer alone`).toBe(layer.entityCount);
  });

  test("AC-4: locking a layer leaves it drawn", async () => {
    await prepare();
    const user = userEvent.setup();
    render(<ViewerScreen {...props(manifestHead())} />);
    const layer = manifest.layers[0] as RenderManifest["layers"][number];

    await user.click(control(rowFor(layer.name), "viewer-layer-lock"));

    expect(rowFor(layer.name).getAttribute("data-locked"), `${layer.name} is locked`).toBe("true");
    expect(dataNumber(status(), "data-drawn-entities"), "a locked layer is still drawn — lock takes it out of the hit-test, not off the sheet").toBe(totalEntities());
  });
});

describe("AC-3: a damaged reading renders in place, with the facts and the evidence link", () => {
  test("AC-3: the one RefusalState carries the code, the surface, the evidence and every fidelity fact", async () => {
    await prepare();
    const entry = refusalOf(MANIFEST_NOT_RENDERABLE);
    render(<ViewerScreen {...props({ kind: "refusal", refusal: entry, facts })} />);

    const refusal = screen.getByTestId("refusal-state");
    expect(refusal.getAttribute("data-code"), "the refusal names itself machine-readably (R-UI-020)").toBe(MANIFEST_NOT_RENDERABLE);
    expect(refusal.getAttribute("data-surface"), "on the surface its registry entry states").toBe("banner");
    expect(screen.getByTestId("refusal-message").textContent, "with the register's own message").toBe(entry.message);
    expect(screen.getByTestId("refusal-remedy").textContent, "and its remedy").toBe(entry.remedy);
    expect(screen.getByTestId("refusal-evidence-link").getAttribute("href") ?? "", "and a link to where it is resolved").not.toBe("");

    const cells = screen.getByTestId("viewer-fidelity-facts").querySelectorAll<HTMLElement>('[data-testid="viewer-fidelity-fact"]');
    expect(
      [...cells].map((cell) => cell.getAttribute("data-fact")).sort(),
      "one row per fact the ingest record carries — a reader learns what the reading did recover",
    ).toEqual(Object.keys(facts).sort());
    for (const cell of cells) {
      expect((cell.textContent ?? "").trim(), `the ${cell.getAttribute("data-fact")} fact is legible, not an empty row`).not.toBe("");
    }

    expect(screen.queryAllByTestId("viewer-canvas").length, "nothing is drawn: there is no sheet to draw").toBe(0);
  });
});
