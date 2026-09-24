// I-681 and I-682, stated: a drawing with no model space — a PDF set, a scan — is partitioned
// page by page, each page a drawing space of its own and the sheet it is printed on; its views are
// placed on their sheets by the page they were read on; and the stages that measure read none of it.
//
// Every artifact here is hand-built and small enough to read, so what is graded is the rule rather
// than a fixture's arithmetic. The F-RCC6-BNBC vector set itself is partitioned in
// `tests/cad/pdf-sheets.test.ts`, over the bytes a real upload hands the product.
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import { mayStandOn, sheetOfView, sheetsOfGraph, spacesOfGraph, framesOfGraph } from "@/core/sheets/frames";
import { scaleStateOf, type ScaleStateView } from "@/modules/takeoff/sheets/scale-state";
import { viewsOnSheet } from "@/modules/takeoff/sheets/sheet-views";
import { modelSpaceOf } from "../../rebuild";
import { partitionArtifact, type ViewPartition } from "../assign";
import { VIEW_TYPE, anchorlessViewKey, partitionViewKey } from "../law";

const PAGE_1 = "Page 1";
const PAGE_2 = "Page 2";
const MODEL_SPACE = "Model";
const CHANNELS = { rgb: [0, 0, 0], source: "truecolor" };

/** A key of the scheme a page's extractor mints, a whole digest (L-CAD-02) made readable. */
function pdfKey(n: number): string {
  return `PDF_OBJECT:${n.toString(16).toUpperCase().padStart(64, "0")}`;
}
function tracedKey(n: number): string {
  return `RASTER_TRACE:${n.toString(16).toUpperCase().padStart(64, "0")}`;
}

/** A text of one space: what it says, how tall it stands, and where. */
function text(key: string, space: string, said: string, height: number, at: readonly [number, number]): Record<string, unknown> {
  return { key, type: "TEXT", space, layer: "0", colour: CHANNELS, text: said, height, points: [at] };
}

/** A drawn line of one space. */
function line(key: string, space: string, from: readonly [number, number], to: readonly [number, number]): Record<string, unknown> {
  return { key, type: "LINE", space, layer: key.startsWith("RASTER_TRACE") ? "TRACE" : "0", colour: CHANNELS, points: [from, to] };
}

/** An original the extractor gave no points and nothing painted: it stands nowhere. */
function nowhere(key: string, space: string): Record<string, unknown> {
  return { key, type: "INSERT", space, layer: "0", colour: CHANNELS };
}

/** A page as the PDF lane's inventory states one: paper, with no window onto any model space (I-511). */
function page(name: string): Record<string, unknown> {
  return { name, kind: "paper", bbox: { min: [0, 0], max: [2400, 1700] }, strays_rejected: 0, viewports: [] };
}

/** An artifact of these layouts and originals — the whole of what a partition reads. */
function artifactOf(layouts: readonly Record<string, unknown>[], entities: readonly Record<string, unknown>[]): EntityGraph {
  return {
    entitygraph_version: 3,
    ingest: { scheme: "PDF_OBJECT", tool: "pages-test", tool_version: "0.0.0", parameter_set_hash: "0".repeat(64) },
    insunits: { code: 0, unit: "unitless", unmapped: false },
    layouts,
    dropped_layouts: [],
    entities,
    derived: [],
    block_attributes: [],
    counters: [],
  } as unknown as EntityGraph;
}

/** Which view each original landed in, read off the partition. */
function landed(partition: ViewPartition, key: string): string | undefined {
  return partition.assignments.get(key);
}

/**
 * S-10's page in miniature, as the BNBC PDF prints it: a plan captioned under itself, and a title
 * block in the corner whose sheet number and revision letter are the TALLEST texts on the page.
 */
const CAPTION = pdfKey(1);
const SHEET_NUMBER = pdfKey(2);
const REVISION = pdfKey(3);
const S10_PAGE = [
  text(CAPTION, PAGE_1, "COLUMN LAYOUT PLAN  SCALE 1:100", 11.34, [198, 351]),
  text(SHEET_NUMBER, PAGE_1, "S-10", 12.76, [2191, 1309]),
  text(REVISION, PAGE_1, "B", 12.76, [2302, 1309]),
  line(pdfKey(4), PAGE_1, [422, 626], [1077, 626]),
  line(pdfKey(5), PAGE_1, [1077, 626], [1077, 1152]),
  line(pdfKey(6), PAGE_1, [2106, 1251], [2356, 1251]),
  text(pdfKey(7), PAGE_1, "A", 9.07, [422, 626]),
];

describe("I-681: a paged drawing is partitioned page by page", () => {
  test("a caption the grammar types anchors a view on its page, and every original of the page is that view's", () => {
    const partition = partitionArtifact(artifactOf([page(PAGE_1)], S10_PAGE));
    const plan = partitionViewKey(VIEW_TYPE.LAYOUT_PLAN, CAPTION);

    expect(partition.views, "the plan is the page's one view, anchored on its caption and read on its page").toEqual([
      { viewKey: plan, type: VIEW_TYPE.LAYOUT_PLAN, reason: null, caption: "COLUMN LAYOUT PLAN  SCALE 1:100", anchorKey: CAPTION, page: PAGE_1 },
    ]);
    expect(partition.assignments.size, "every original of the page is assigned").toBe(S10_PAGE.length);
    for (const entity of S10_PAGE) expect(landed(partition, entity["key"] as string), `${String(entity["key"])} is the plan's`).toBe(plan);
  });

  test("a sheet number and a revision letter type nothing, so they anchor no view and are content of the page's", () => {
    const partition = partitionArtifact(artifactOf([page(PAGE_1)], S10_PAGE));
    expect(partition.views.some((view) => view.anchorKey === SHEET_NUMBER || view.anchorKey === REVISION), "neither title-block text is a view").toBe(false);
    expect(partition.views.every((view) => view.type !== VIEW_TYPE.UNTYPED), "and no untyped view stands for a model to be asked about").toBe(true);
  });

  test("a text-less scanned page is one view no caption anchors, keyed by its page — and each page has its own", () => {
    const scanned = [line(tracedKey(1), PAGE_1, [0, 0], [100, 0]), line(tracedKey(2), PAGE_1, [0, 0], [0, 100]), line(tracedKey(3), PAGE_2, [0, 0], [100, 0])];
    const partition = partitionArtifact(artifactOf([page(PAGE_1), page(PAGE_2)], scanned));

    expect(anchorlessViewKey(PAGE_1)).not.toBe(anchorlessViewKey(PAGE_2));
    expect(partition.views).toEqual([
      { viewKey: anchorlessViewKey(PAGE_1), type: VIEW_TYPE.UNASSIGNED, reason: null, caption: "", anchorKey: null, page: PAGE_1 },
      { viewKey: anchorlessViewKey(PAGE_2), type: VIEW_TYPE.UNASSIGNED, reason: null, caption: "", anchorKey: null, page: PAGE_2 },
    ]);
    expect([tracedKey(1), tracedKey(2)].map((key) => landed(partition, key)), "the first page's traced lines are its own view's").toEqual([anchorlessViewKey(PAGE_1), anchorlessViewKey(PAGE_1)]);
    expect(landed(partition, tracedKey(3)), "and the second page's are the second's, drawn at the same coordinates").toBe(anchorlessViewKey(PAGE_2));
  });

  test("two typed captions share a page by nearness, however far; an original never joins a view of another page; one that stands nowhere is its page's anchorless view's", () => {
    const left = pdfKey(10);
    const right = pdfKey(11);
    const schedule = pdfKey(12);
    const drawn = [
      text(left, PAGE_1, "GB1 LONG SECTION  SCALE 1:50", 10, [0, 0]),
      text(right, PAGE_1, "GB2 LONG SECTION  SCALE 1:50", 10, [5000, 0]),
      line(pdfKey(13), PAGE_1, [100, 0], [200, 0]),
      line(pdfKey(14), PAGE_1, [4800, 0], [4900, 0]),
      nowhere(pdfKey(15), PAGE_1),
      text(schedule, PAGE_2, "COLUMN SCHEDULE", 10, [150, 0]),
      line(tracedKey(16), PAGE_2, [4800, 10], [4900, 10]),
    ];
    const partition = partitionArtifact(artifactOf([page(PAGE_1), page(PAGE_2)], drawn));
    const gb1 = partitionViewKey(VIEW_TYPE.LONG_SECTION_STRIP, left);
    const gb2 = partitionViewKey(VIEW_TYPE.LONG_SECTION_STRIP, right);
    const onTwo = partitionViewKey(VIEW_TYPE.SCHEDULE, schedule);

    expect(landed(partition, pdfKey(13)), "the line beside GB1 is GB1's — a schedule on the next page stands nearer by coordinates alone").toBe(gb1);
    expect(landed(partition, pdfKey(14)), "the line beside GB2 is GB2's, a page-width from any caption").toBe(gb2);
    expect(landed(partition, tracedKey(16)), "a page with one typed caption gives it the whole page").toBe(onTwo);
    expect(landed(partition, pdfKey(15)), "an original with nowhere to stand is its own page's anchorless view's").toBe(anchorlessViewKey(PAGE_1));
    expect(partition.views.map((view) => [view.viewKey, view.page]), "and each view names the page it was read on").toEqual(
      [
        [gb1, PAGE_1],
        [gb2, PAGE_1],
        [onTwo, PAGE_2],
        [anchorlessViewKey(PAGE_1), PAGE_1],
      ].sort((a, b) => ((a[0] as string) < (b[0] as string) ? -1 : 1)),
    );
    expect(partition.assignments.size, "every original of every page is assigned, once").toBe(drawn.length);
  });

  test("a drawing WITH model space is partitioned as it always was: no view names a page, and the anchorless view keeps its bare key", () => {
    const modelled = {
      ...artifactOf([{ name: MODEL_SPACE, kind: "model", bbox: null, strays_rejected: 0 }, { ...page("S-10"), viewports: [] }], [
        text("DXF_HANDLE:A1", MODEL_SPACE, "COLUMN LAYOUT PLAN", 10, [0, 0]),
        line("DXF_HANDLE:A2", MODEL_SPACE, [10, 0], [20, 0]),
        line("DXF_HANDLE:A3", MODEL_SPACE, [90000, 0], [90010, 0]),
        text("DXF_HANDLE:A4", "S-10", "S-10", 20, [0, 0]),
      ]),
    } as EntityGraph;
    const partition = partitionArtifact(modelled);
    expect(partition.views.map((view) => Object.hasOwn(view, "page")), "a model-space view carries no page at all").toEqual([false, false]);
    expect(partition.views.map((view) => view.viewKey)).toEqual([partitionViewKey(VIEW_TYPE.LAYOUT_PLAN, "DXF_HANDLE:A1"), VIEW_TYPE.UNASSIGNED]);
    expect(anchorlessViewKey(null)).toBe(VIEW_TYPE.UNASSIGNED);
    expect(partition.assignments.has("DXF_HANDLE:A4"), "paper furniture of a modelled drawing is still assigned to nothing").toBe(false);
  });
});

describe("a page's views reach their sheet and its card (I-681, R-TO-021)", () => {
  const scanned = artifactOf([page(PAGE_1), page(PAGE_2)], [line(tracedKey(1), PAGE_1, [0, 0], [100, 0]), ...S10_PAGE.map((entity) => ({ ...entity, space: PAGE_2 }))]);
  const partition = partitionArtifact(scanned);
  const sheets = sheetsOfGraph(scanned);
  const spaces = spacesOfGraph(scanned);
  const frames = framesOfGraph(scanned);
  const cardViews = (affirmed: { placeable: boolean } | null): ScaleStateView[] => partition.views.map((view) => ({ viewKey: view.viewKey, anchorKey: view.anchorKey, page: view.page ?? null, affirmed }));

  test("the anchorless view of a text-less page stands on that page's sheet, and a captioned view on its caption's", () => {
    expect(sheetOfView({ anchorKey: null, page: PAGE_1 }, spaces, sheets, frames), "a paged drawing has no model sheet for an anchorless view to fall back to").toBe(PAGE_1);
    const onFirst = viewsOnSheet(cardViews(null), sheets[0] as (typeof sheets)[number], spaces, sheets, frames).map((view) => view.viewKey);
    const onSecond = viewsOnSheet(cardViews(null), sheets[1] as (typeof sheets)[number], spaces, sheets, frames).map((view) => view.viewKey);
    expect(onFirst, "the scan's page counts its one view").toEqual([anchorlessViewKey(PAGE_1)]);
    expect(onSecond, "S-10's page counts its plan").toEqual([partitionViewKey(VIEW_TYPE.LAYOUT_PLAN, CAPTION)]);
  });

  test("the card's scale line reads the page's views: no scale of record on 1 of 1, then affirmed once its one view is", () => {
    const sheet = sheets[0] as (typeof sheets)[number];
    const before = scaleStateOf("unaffirmed", viewsOnSheet(cardViews(null), sheet, spaces, sheets, frames));
    const after = scaleStateOf("unaffirmed", viewsOnSheet(cardViews({ placeable: true }), sheet, spaces, sheets, frames));
    expect(before, "a page no act has scaled says so of its one view").toEqual({ state: "unplaceable", unplaceable: 1, total: 1 });
    expect(after, "and reads affirmed once that view is").toEqual({ state: "affirmed", unplaceable: 0, total: 1 });
  });

  test("a sheet's panels list model-space views everywhere and a page's views on their page alone", () => {
    expect(mayStandOn({ page: null }, PAGE_2), "a model-space view may be framed by any sheet").toBe(true);
    expect(mayStandOn({}, PAGE_2), "and so may one that names no page at all").toBe(true);
    expect(mayStandOn({ page: PAGE_1 }, PAGE_1)).toBe(true);
    expect(mayStandOn({ page: PAGE_1 }, PAGE_2), "a view read on page 1 is on no part of page 2").toBe(false);
  });
});

describe("I-682: the stages that measure read model space alone", () => {
  test("a paged partition hands the stages after the views nothing to read, and the store still receives every view", () => {
    const partition = partitionArtifact(artifactOf([page(PAGE_1)], S10_PAGE));
    const held = { views: partition.views, assignments: partition.assignments, grid: null };
    const measured = modelSpaceOf(held);
    expect(measured.views, "no page view reaches the census, the schedules, the placements or the level stack").toEqual([]);
    expect(measured.assignments.size).toBe(0);
    expect(held.views.length, "the partition itself is untouched").toBe(1);
  });

  test("a partition with no page in it is handed on as it stands — the very object, so a DXF's stages read what they read", () => {
    const held = { views: [{ viewKey: VIEW_TYPE.UNASSIGNED, type: VIEW_TYPE.UNASSIGNED, reason: null, caption: "", anchorKey: null }], assignments: new Map([["DXF_HANDLE:1", VIEW_TYPE.UNASSIGNED]]) };
    expect(modelSpaceOf(held)).toBe(held);
  });
});
