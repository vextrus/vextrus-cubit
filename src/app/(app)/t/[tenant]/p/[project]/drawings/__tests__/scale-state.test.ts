// @vitest-environment jsdom
/**
 * AC-7 — the sheet card's scale line: `scaleStateOf` (src/modules/takeoff/sheets/scale-state.ts,
 * pure) derives `unaffirmed | affirmed | unplaceable(n)` from the calibrations in force per view, and
 * the card renders the unplaceable state as the count of views with no scale of record out of the
 * total (R-TO-004, R-TO-021, docs/design/s-scale.md §1).
 *
 * The rule is asserted, never a snapshot of today's sheets: each case builds its own views and the
 * expected count is DERIVED from them, so a sheet with more views grades by the same rule (B-19). The
 * copy is read from the route's own strings table by key, so this file spells no sentence of its own.
 *
 * `.ts` with `createElement` rather than `.tsx`: this path is inside `src/`, where the sheet-index and
 * sheet-card precedents already mount this screen. The module under test is loaded by absolute path,
 * so a file the Builder has not written yet fails as an assertion naming it.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DISCIPLINES } from "@/core/sheets/law";
import { formatUserFigure } from "@/core/format";
import { JobsProvider, type JobsFormat } from "@/ui/patterns/job-timeline";
import { fill } from "@/ui/strings";
import { SheetIndex } from "../sheet-index";
import { drawings } from "../strings";
import type { SheetCardData } from "../sheet-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, back: () => undefined, prefetch: () => undefined }),
  usePathname: () => "/t/tenant-1/p/project-1/drawings",
  useSearchParams: () => new URLSearchParams(),
}));

/** The module this criterion names (increment interfaces: `scaleStateOf`). */
const SCALE_STATE_MODULE = "src/modules/takeoff/sheets/scale-state.ts";

/** One view of a sheet as the scale door answers it, narrowed to what a state derivation reads. */
type ViewLike = { viewKey: string; affirmed: { placeable: boolean } | null; refusal: string | null };

/** What `scaleStateOf` answers: the card's state, how many views have no scale of record, and of how many. */
type ScaleStateAnswer = { state: string; unplaceable: number | null; total: number };

type ScaleStateModule = { scaleStateOf: (core: string, views: readonly ViewLike[]) => ScaleStateAnswer };

/** Import a product module by repo-relative path, saying which file is missing when one is. */
async function productModule<T = Record<string, unknown>>(relative: string): Promise<T> {
  const absolute = join(process.env["BUILDER_REPO_ROOT"]?.trim() || process.cwd(), relative);
  expect(existsSync(absolute), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  const specifier: string = absolute;
  return (await import(specifier)) as T;
}

function scaleState(): Promise<ScaleStateModule> {
  return productModule<ScaleStateModule>(SCALE_STATE_MODULE).then((module) => {
    expect(typeof module.scaleStateOf, `${SCALE_STATE_MODULE} publishes \`scaleStateOf\``).toBe("function");
    return module;
  });
}

/** One view under a calibration of record, placeable or not at the edition's anisotropy tolerance. */
function affirmed(viewKey: string, placeable: boolean): ViewLike {
  return { viewKey, affirmed: { placeable }, refusal: null };
}

/** One view no act names: no calibration, and the absence code that says so. */
function unaffirmed(viewKey: string, refusal = "SCALE_NO_EVIDENCE"): ViewLike {
  return { viewKey, affirmed: null, refusal };
}

/** The route's own copy, read by key: this acceptance is written before the key exists. */
function copy(key: string): string {
  const held = (drawings as unknown as Record<string, string>)[key];
  expect(typeof held, `the drawings screen's strings table carries \`${key}\` (Design Decision §3)`).toBe("string");
  return held as string;
}

/** The workspace and project the index is rendered for. */
const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";

const JOBS_FORMAT: JobsFormat = { seconds: (elapsedMs: number) => String(elapsedMs), refusal: () => null };

/**
 * One card of the index carrying a scale line. The new field is spread in and the whole cast: this
 * acceptance is written before `SheetCardData` declares it, and a card the type does not know yet is
 * exactly the red this criterion asks for.
 */
function card(o: { scaleState: string; unplaceableViews: number | null; viewCount: number | null }): SheetCardData {
  return {
    sheetId: `ingest-1:${o.scaleState}-${String(o.unplaceableViews)}`,
    drawingId: "11111111-1111-4111-8111-111111111111",
    layoutName: `SHEET ${o.scaleState}`,
    format: "dxf",
    scheme: "DXF_HANDLE",
    thumbnail: null,
    proposal: { number: "S-101", title: "Staged sheet", discipline: DISCIPLINES[0], basis: "GRAMMAR", cited: [] },
    confirmed: null,
    scaleState: o.scaleState,
    unplaceableViews: o.unplaceableViews,
    viewCount: o.viewCount,
    facts: {},
  } as unknown as SheetCardData;
}

/** The one card of a one-card index, rendered as a reader meets it. */
function renderCard(one: SheetCardData): HTMLElement {
  render(
    createElement(
      JobsProvider,
      { format: JOBS_FORMAT },
      createElement(SheetIndex, { tenantId: TENANT, projectId: PROJECT, cards: [one], groups: [], canConfirm: false, awaitingIngest: 0 }),
    ),
  );
  const cards = screen.getAllByTestId("sheet-card");
  expect(cards.length, "the index rendered the one card it was given").toBe(1);
  return within(cards[0] as HTMLElement).getByTestId("sheet-card-scale");
}

afterEach(() => {
  cleanup();
});

describe("AC-7: the state a sheet's scale line stands at, derived from the calibrations in force per view", () => {
  test("AC-7: a sheet with no partition views is unaffirmed, and counts nothing", async () => {
    const { scaleStateOf } = await scaleState();
    const answered = scaleStateOf("unaffirmed", []);
    expect(answered.state, "there is no view to have a scale, so nothing has been affirmed and nothing is unplaceable").toBe("unaffirmed");
    expect(answered.unplaceable, "and no count is invented for a sheet whose views nobody has read").toBeNull();
  });

  test("AC-7: a sheet whose every view carries a placeable calibration of record is affirmed", async () => {
    const { scaleStateOf } = await scaleState();
    const views = [affirmed("v:1", true), affirmed("v:2", true), affirmed("v:3", true)];
    const answered = scaleStateOf("unaffirmed", views);
    expect(answered.state, "every view stands under a calibration judged placeable, so the sheet is affirmed").toBe("affirmed");
    expect(answered.unplaceable, "with none of its views left without a scale of record").toBe(0);
    expect(answered.total, "and the total is the views the sheet holds").toBe(views.length);
  });

  test("AC-7: a sheet counts the views with no calibration of record, or an unplaceable one", async () => {
    const { scaleStateOf } = await scaleState();
    const views = [affirmed("v:1", true), affirmed("v:2", false), unaffirmed("v:3"), unaffirmed("v:4", "SCALE_UNIT_UNMAPPED")];
    const owed = views.filter((view) => view.affirmed === null || !view.affirmed.placeable).length;

    const answered = scaleStateOf("unaffirmed", views);
    expect(answered.state, "a sheet holding a view with no scale of record is unplaceable, not affirmed (R-TO-021)").toBe("unplaceable");
    expect(answered.unplaceable, "and the count is every view with no calibration of record or an unplaceable one").toBe(owed);
    expect(answered.total, "out of the views the sheet holds").toBe(views.length);
  });

  test("AC-7: a sheet whose header names no length unit counts every one of its views", async () => {
    const { scaleStateOf } = await scaleState();
    // The strict unit lane: no mapped unit, no rank, so no view of the sheet carries a calibration.
    const views = [unaffirmed("v:1", "SCALE_UNIT_UNMAPPED"), unaffirmed("v:2", "SCALE_UNIT_UNMAPPED")];
    const answered = scaleStateOf("unaffirmed", views);
    expect([answered.state, answered.unplaceable, answered.total], "every view of an unmapped sheet is a view with no scale of record").toEqual(["unplaceable", views.length, views.length]);
  });

  test("AC-7: core's own unplaceable — no extent, no drawing unit — is kept as it stands", async () => {
    const { scaleStateOf } = await scaleState();
    const answered = scaleStateOf("unplaceable", [affirmed("v:1", true)]);
    expect(answered.state, "a layout carrying no extent or no drawing units is unplaceable whatever its views say, and that reading is not re-derived (B-17)").toBe("unplaceable");
  });
});

describe("AC-7: the card renders that state as the count of views without a scale of record", () => {
  test("AC-7: the unplaceable state reads as its count out of the total, and publishes both", () => {
    const line = renderCard(card({ scaleState: "unplaceable", unplaceableViews: 2, viewCount: 5 }));
    expect(line.getAttribute("data-scale"), "the card publishes the state the derivation answered").toBe("unplaceable");
    expect(line.getAttribute("data-unplaceable"), "and the count of views with no scale of record").toBe("2");
    expect((line.textContent ?? "").trim(), "reading as the route's own sentence, filled with the count and the total (R-SPINE-010, R-SPINE-060)").toBe(
      fill(copy("drawings_scale_unplaceable_count"), { count: formatUserFigure("2"), total: formatUserFigure("5") }),
    );
  });

  test("AC-7: an unplaceable sheet with no count keeps core's own sentence and publishes no number", () => {
    const line = renderCard(card({ scaleState: "unplaceable", unplaceableViews: null, viewCount: null }));
    expect(line.getAttribute("data-unplaceable"), "a count nobody derived is empty, the way the views line already answers one (Decision §1)").toBe("");
    expect((line.textContent ?? "").trim(), "and the sentence is the one the sheet grammar already wrote for a layout that cannot be placed").toBe(copy("drawings_scale_unplaceable"));
  });

  test("AC-7: the two states that carry no count keep their sentences and still publish the hook", () => {
    const unaffirmedLine = renderCard(card({ scaleState: "unaffirmed", unplaceableViews: null, viewCount: 3 }));
    expect((unaffirmedLine.textContent ?? "").trim(), "an unaffirmed sheet reads exactly as it did before this increment (B-20)").toBe(copy("drawings_scale_unaffirmed"));
    expect(unaffirmedLine.getAttribute("data-unplaceable"), "and the hook is published all the same, empty where no count was derived").toBe("");
    cleanup();
    const affirmedLine = renderCard(card({ scaleState: "affirmed", unplaceableViews: 0, viewCount: 3 }));
    expect((affirmedLine.textContent ?? "").trim(), "and so does an affirmed one").toBe(copy("drawings_scale_affirmed"));
    expect(affirmedLine.getAttribute("data-unplaceable"), "which stands at none of its views having no scale of record").toBe("0");
  });
});
