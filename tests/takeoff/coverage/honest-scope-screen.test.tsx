// @vitest-environment jsdom
/**
 * S-Coverage states the whole building and never answers with silence (s-coverage I-480..g,
 * C9a; walk-0 register-trace B11 and its FRICTION and POLISH on the grid and the inspector).
 *
 * Mounted over a reading shaped as F-RCC6-BNBC's now reads: a slab the drawings declare and nothing
 * placed, piles filed under the FOUNDATION slot, beams whose every line was kept PARTIAL_DECLARED for
 * want of the slab thickness, a column level the run never reached, the kinds no sighted class bears,
 * and a water tank no class measures. What is judged is what a QS meets: every gap says why and where
 * to fix it, and "nothing explains" is printed nowhere.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { REFUSALS } from "@/core/errors";
import { cellRef, type PartialStatementRow, type ResidueCell, type StatementRow } from "@/core/residue/law";
import { CoverageWorkspace, registerCellHref, remedyDoorOf } from "@/modules/takeoff/coverage/coverage-workspace";
import { COVERAGE_COPY } from "@/modules/takeoff/coverage/copy";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import { declaredValue } from "../../support/stylesheet";

afterEach(cleanup);

const NOTHING_EXPLAINS = /nothing explains/iu;

const GF = { levelId: "level-gf", ordinal: 0, label: "GF" };
const L1 = { levelId: "level-1f", ordinal: 1, label: "1F" };

function cell(over: Partial<ResidueCell>): ResidueCell {
  return {
    kind: "rcc.concrete",
    class: "column",
    levelId: GF.levelId,
    levelLabel: "GF",
    levelOrdinal: 0,
    grain: "CELL",
    measurement: "NOT_ESTABLISHED",
    bill: "IN_BILL",
    contradicted: false,
    lineIds: [],
    sightings: [],
    observations: [],
    measurementActId: null,
    billActId: null,
    reason: null,
    reasonViews: [],
    levelSlot: null,
    partial: null,
    ...over,
  };
}

const SLAB = cell({
  class: "slab",
  levelId: null,
  levelLabel: "",
  levelOrdinal: null,
  reason: REFUSALS.COVERAGE_CLASS_NOT_PLACED.code,
  reasonViews: ["TYPICAL SLAB REINFORCEMENT PLAN"],
  levelSlot: "UNPLACED",
  sightings: [
    { class: "slab", levelId: null, channel: "LAYOUT", drawingId: "drawing-1", layoutName: "S-19", sourceKey: "DXF_HANDLE:1FE", declared: true, caption: "TYPICAL SLAB REINFORCEMENT PLAN" },
  ],
});

const PILE = cell({
  class: "pile",
  levelId: null,
  levelLabel: "",
  levelOrdinal: null,
  measurement: "QUANTITY_BEARING",
  lineIds: ["p1"],
  levelSlot: "FOUNDATION",
  sightings: [{ class: "pile", levelId: null, channel: "REGISTER", drawingId: "drawing-1", layoutName: "S-04", sourceKey: "v:LAYOUT_PLAN:p|P1|0,0", levelSlot: "FOUNDATION" }],
});

const BEAM = cell({
  class: "beam",
  levelId: L1.levelId,
  levelLabel: "1F",
  levelOrdinal: 1,
  measurement: "QUANTITY_BEARING",
  lineIds: Array.from({ length: 23 }, (_, at) => `b${at}`),
  partial: { lines: 23, members: 23, omitted: [{ code: "SLAB_THICKNESS_UNSTATED", variables: ["t"], lines: 23 }] },
  sightings: Array.from({ length: 23 }, (_, at) => ({
    class: "beam",
    levelId: L1.levelId,
    channel: "REGISTER" as const,
    drawingId: "drawing-1",
    layoutName: "S-13",
    sourceKey: `v:LAYOUT_PLAN:b|B${at}|0,0`,
  })),
});

const COLUMN_REACHED = cell({ measurement: "QUANTITY_BEARING", lineIds: ["c1"] });
const COLUMN_UNREACHED = cell({ levelId: L1.levelId, levelLabel: "1F", levelOrdinal: 1, reason: REFUSALS.COVERAGE_MEMBERS_NOT_REACHED.code });
const COLUMN_SCALE = cell({
  kind: "rcc.formwork",
  reason: REFUSALS.VIEW_SCALE_UNAFFIRMED.code,
  reasonViews: ["COLUMN LAYOUT PLAN  SCALE 1:100"],
  observations: [
    { class: "column", kind: "rcc.formwork", levelId: GF.levelId, rail: "column/rcc.formwork", reason: REFUSALS.VIEW_SCALE_UNAFFIRMED.message, code: REFUSALS.VIEW_SCALE_UNAFFIRMED.code, view: "COLUMN LAYOUT PLAN  SCALE 1:100" },
    { class: "column", kind: "rcc.formwork", levelId: GF.levelId, rail: "column/rcc.formwork", reason: REFUSALS.VIEW_SCALE_UNAFFIRMED.message, code: REFUSALS.VIEW_SCALE_UNAFFIRMED.code, view: "COLUMN LAYOUT PLAN  SCALE 1:100" },
  ],
});
const PAINT = cell({ kind: "finish.paint", class: null, levelId: null, levelLabel: "", levelOrdinal: null, grain: "KIND", measurement: "NO_BEARER_SIGHTED" });

const MEASUREMENT: StatementRow[] = [
  { kind: "finish.paint", class: null, levelId: null, levelLabel: "", levels: "", grain: "KIND", cause: "NO_BEARER_SIGHTED", reason: null, views: [], levelSlot: null },
  { kind: "rcc.concrete", class: "column", levelId: L1.levelId, levelLabel: "1F", levels: "1F", grain: "CELL", cause: "NOT_ESTABLISHED", reason: REFUSALS.COVERAGE_MEMBERS_NOT_REACHED.code, views: [], levelSlot: null },
  {
    kind: "rcc.concrete",
    class: "slab",
    levelId: null,
    levelLabel: "",
    levels: "",
    grain: "CELL",
    cause: "NOT_ESTABLISHED",
    reason: REFUSALS.COVERAGE_CLASS_NOT_PLACED.code,
    views: ["TYPICAL SLAB REINFORCEMENT PLAN"],
    levelSlot: "UNPLACED",
  },
];
const PARTIAL: PartialStatementRow[] = [
  { kind: "rcc.concrete", class: "beam", levelId: L1.levelId, levelLabel: "1F", levels: "1F", levelSlot: null, omitted: ["SLAB_THICKNESS_UNSTATED"] },
];

function view(over: Partial<CoverageView> = {}): CoverageView {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    campaignId: "campaign-1",
    setRevisionId: "rev-1",
    input: { bears: [], workItems: [], levels: [GF, L1], sightings: [], lines: [], declarations: [], truncated: [], observations: [] },
    cells: [PAINT, BEAM, COLUMN_REACHED, COLUMN_UNREACHED, COLUMN_SCALE, PILE, SLAB],
    measurement: MEASUREMENT,
    partial: PARTIAL,
    unclassed: [{ drawingId: "drawing-1", address: "v:UNTYPED:t", caption: "OVERHEAD WATER TANK  SCALE 1:50", word: "tank", code: "COVERAGE_MEMBER_UNCLASSED" }],
    bill: [],
    declaredLineIds: BEAM.lineIds,
    ...over,
  };
}

async function mount(of: CoverageView, selected: string | null = null): Promise<HTMLElement> {
  const rendered = render(<CoverageWorkspace permitted view={of} cell={selected} />);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered.container;
}

const cellEl = (root: ParentNode, of: ResidueCell): HTMLElement | null =>
  root.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.cell)}[data-kind="${of.kind}"][data-class="${of.class ?? ""}"][data-level="${of.levelId ?? ""}"]`);

describe("COV-ALL: every class the drawings carry has its column, and every gap says why", () => {
  test("a class the drawings declare and nothing placed stands under a column that says so, and its cell names the reason", async () => {
    const root = await mount(view());
    const levels = [...root.querySelectorAll<HTMLElement>(".cx-coverage-level")].map((header) => `${header.getAttribute("data-class")}:${header.textContent}`);
    expect(levels, "the slab stands nowhere yet; the piles stand in the foundation").toEqual(expect.arrayContaining(["slab:Not placed", "pile:Foundation"]));
    const slab = cellEl(root, SLAB);
    expect(slab?.getAttribute("data-code"), "the cause stays the law's").toBe("NOT_ESTABLISHED");
    expect(slab?.getAttribute("data-mark")).toBe("absent");
    expect(slab?.getAttribute("aria-label"), "the cell is named by its reason").toContain(REFUSALS.COVERAGE_CLASS_NOT_PLACED.message);
  });

  test("no face of the screen says that nothing explains an absence", async () => {
    const root = await mount(view(), cellRef(COLUMN_UNREACHED));
    expect(root.textContent ?? "", "no text node").not.toMatch(NOTHING_EXPLAINS);
    for (const element of root.querySelectorAll<HTMLElement>("[aria-label], [data-meaning]")) {
      expect(`${element.getAttribute("aria-label") ?? ""} ${element.getAttribute("data-meaning") ?? ""}`, "no accessible name, no key-line meaning").not.toMatch(NOTHING_EXPLAINS);
    }
  });

  test("the key line says Not measured, and keys the position no class bears", async () => {
    const root = await mount(view());
    const absent = root.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.legendEntry)}[data-code="NOT_ESTABLISHED"]`);
    expect(absent?.textContent).toBe(COVERAGE_COPY.takeoff_coverage_mark_absent);
    expect(COVERAGE_COPY.takeoff_coverage_mark_absent).toBe("Not measured");
    const voidKey = root.querySelector<HTMLElement>('.cx-coverage-legend-entry[data-mark="void"]');
    expect(voidKey?.textContent).toBe(COVERAGE_COPY.takeoff_coverage_mark_void);
    const voids = [...root.querySelectorAll<HTMLElement>('.cx-coverage-void[data-mark="void"]')];
    expect(voids.length, "a kind row draws a keyed dash where a column's class does not bear it").toBeGreaterThan(0);
    expect(voids.every((node) => node.getAttribute("data-testid") === null), "and a dash is no residue cell").toBe(true);
  });

  test("a kind row draws its cells and dashes in column order, so no dash drops onto a second line under the cells", async () => {
    // The row is a CSS grid on the sparse flow: an item whose column stands left of the one before it
    // opens a second line. jsdom lays nothing out, so the two halves are held where they are stated —
    // the DOM order (every explicit column after the one before it) and the sheet's pin of a dash to
    // its row's one line.
    const root = await mount(view());
    const rows = [...root.querySelectorAll<HTMLElement>(testIdSelector(TESTIDS.coverage.kindRow))];
    const formwork = rows.find((row) => row.getAttribute("data-kind") === "rcc.formwork");
    const positions = [...(formwork?.children ?? [])].slice(1) as HTMLElement[];
    expect(
      positions.map((node) => `${node.classList.contains("cx-coverage-void") ? "void" : "cell"}@${node.style.gridColumn}`),
      "the beam's dash, the column's cell, then the three dashes after it — in the order the columns stand",
    ).toEqual(["void@2", "cell@3", "void@4", "void@5", "void@6"]);
    for (const row of rows) {
      const columns = ([...row.children].slice(1) as HTMLElement[]).map((node) => node.style.gridColumn).filter((column) => /^\d+$/u.test(column)).map(Number);
      expect(columns, `${row.getAttribute("data-kind")}: no position steps back left of the one before it`).toEqual([...columns].sort((left, right) => left - right));
    }
    const sheet = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../src/app/(app)/t/[tenant]/p/[project]/takeoff/coverage/coverage.css"), "utf8");
    expect(declaredValue(sheet, ".cx-coverage-void", "grid-row"), "and a dash stands on its row's one line whatever order it is drawn in").toBe("1");
  });

  test("the kinds no sighted class bears stand at the foot of the grid, the borne kinds first", async () => {
    const root = await mount(view());
    const rows = [...root.querySelectorAll<HTMLElement>(testIdSelector(TESTIDS.coverage.kindRow))].map((row) => row.getAttribute("data-kind"));
    expect(rows).toEqual(["rcc.concrete", "rcc.formwork", "finish.paint"]);
  });
});

describe("the inspector: the reason, the views, one remedy and a door to where it is fixed", () => {
  test("a class nothing placed: its reason, the caption that shows it, and a door to that sheet flown to the caption", async () => {
    const root = await mount(view(), cellRef(SLAB));
    const cause = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.inspectorCause));
    expect(cause?.getAttribute("data-code")).toBe("NOT_ESTABLISHED");
    expect(cause?.getAttribute("data-reason")).toBe(REFUSALS.COVERAGE_CLASS_NOT_PLACED.code);
    expect(cause?.textContent).toContain(REFUSALS.COVERAGE_CLASS_NOT_PLACED.message);
    expect(root.querySelector(".cx-coverage-reason-views")?.textContent).toContain("TYPICAL SLAB REINFORCEMENT PLAN");
    const remedy = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.inspectorRemedy));
    expect(remedy?.textContent).toContain(REFUSALS.COVERAGE_CLASS_NOT_PLACED.remedy);
    const door = remedy?.querySelector<HTMLAnchorElement>("a");
    expect(door?.textContent).toBe(COVERAGE_COPY.takeoff_coverage_remedy_sheet);
    expect(door?.getAttribute("href"), "the viewer at the sheet the caption stands on, selecting the caption").toMatch(/^\/t\/tenant-1\/p\/project-1\/viewer\/drawing-1\/S-19\?.+/u);
    expect(decodeURIComponent(door?.getAttribute("href") ?? "")).toContain("DXF_HANDLE:1FE");
  });

  test("a view nobody affirmed a scale for: the report said once with how many members, and a door to the drawings", async () => {
    const root = await mount(view(), cellRef(COLUMN_SCALE));
    const reports = [...root.querySelectorAll<HTMLElement>(testIdSelector(TESTIDS.coverage.inspectorObservation))];
    expect(reports, "two identical reports are one row").toHaveLength(1);
    expect(reports[0]?.getAttribute("data-count")).toBe("2");
    expect(reports[0]?.textContent).toContain("COLUMN LAYOUT PLAN");
    expect(root.querySelector(".cx-coverage-inspector")?.textContent).toContain(COVERAGE_COPY.takeoff_coverage_observations_heading);
    expect(COVERAGE_COPY.takeoff_coverage_observations_heading, "the screen says what the run reported, in the QS's words").not.toMatch(/rails/iu);
    const door = root.querySelector<HTMLAnchorElement>(`${testIdSelector(TESTIDS.coverage.inspectorRemedy)} a`);
    expect(door?.getAttribute("href")).toBe("/t/tenant-1/p/project-1/drawings");
  });

  test("a partly published cell says what its lines left out — never 'quantity is published' beside 'none carries one'", async () => {
    const root = await mount(view(), cellRef(BEAM));
    const cause = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.inspectorCause));
    expect(cause?.textContent).toContain("Declared partial: 23 beams, slab thickness unstated (t).");
    expect(cause?.textContent).not.toContain(COVERAGE_COPY.takeoff_coverage_cell_label_measured);
    expect(root.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.inspectorRemedy))?.textContent, "the remedy of the omission").toContain(REFUSALS.SLAB_THICKNESS_UNSTATED.remedy);
    expect(cellEl(root, BEAM)?.getAttribute("aria-label")).toContain("Declared partial: 23 beams");
  });

  test("'Open the register' opens the register narrowed to the cell's class, kind and level", async () => {
    const root = await mount(view(), cellRef(COLUMN_UNREACHED));
    const door = root.querySelector<HTMLAnchorElement>(`${testIdSelector(TESTIDS.coverage.inspectorRemedy)} a`);
    expect(door?.textContent).toBe(COVERAGE_COPY.takeoff_coverage_empty_campaign_action);
    expect(door?.getAttribute("href")).toBe("/t/tenant-1/p/project-1/takeoff/register?class=column&kind=rcc.concrete&level=1F");
    expect(registerCellHref("t", "p", PILE), "a foundation is narrowed by the slot the register labels it").toBe("/t/t/p/p/takeoff/register?class=pile&kind=rcc.concrete&level=FOUNDATION");
    expect(remedyDoorOf(PAINT, "t", "p").href, "a kind no class bears is narrowed by its kind alone").toBe("/t/t/p/p/takeoff/register?kind=finish.paint");
  });

  test("the sightings fold behind one line that counts them and names their sheets; every row stays", async () => {
    const root = await mount(view(), cellRef(BEAM));
    const fold = root.querySelector<HTMLDetailsElement>(".cx-coverage-sightings-fold");
    expect(fold, "a disclosure, shut").not.toBeNull();
    expect(fold?.open).toBe(false);
    expect(fold?.querySelector("summary")?.textContent).toBe("23 sightings on S-13");
    expect(root.querySelectorAll(testIdSelector(TESTIDS.coverage.inspectorSighting))).toHaveLength(23);
  });
});

describe("the certificate enumerates every gap with its reason, and the drawn members no class measures", () => {
  test("a row prints the reason's words and the views it names; partial cells and unclassed members are enumerated; no count", async () => {
    const root = await mount(view());
    const preview = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.certificatePreview));
    const slab = preview?.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.statementRow)}[data-class="slab"]`);
    expect(slab?.getAttribute("data-code")).toBe("NOT_ESTABLISHED");
    expect(slab?.getAttribute("data-reason")).toBe(REFUSALS.COVERAGE_CLASS_NOT_PLACED.code);
    expect(slab?.textContent).toContain(REFUSALS.COVERAGE_CLASS_NOT_PLACED.message);
    expect(slab?.textContent).toContain("TYPICAL SLAB REINFORCEMENT PLAN");
    expect(slab?.textContent, "the slab's level says it stands nowhere yet").toContain(COVERAGE_COPY.takeoff_coverage_level_unplaced);
    const partial = preview?.querySelector<HTMLElement>('.cx-coverage-statement-partial[data-class="beam"]');
    expect(partial?.textContent).toContain(`${COVERAGE_COPY.takeoff_coverage_statement_partial_label}: slab thickness unstated.`);
    const tank = preview?.querySelector<HTMLElement>('.cx-coverage-statement-unclassed[data-word="tank"]');
    expect(tank?.textContent).toContain("OVERHEAD WATER TANK");
    expect(tank?.textContent).toContain(REFUSALS.COVERAGE_MEMBER_UNCLASSED.message);
    expect(preview?.textContent ?? "").not.toMatch(NOTHING_EXPLAINS);
    const measurement = preview?.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.statement)}[data-axis="MEASUREMENT"]`);
    expect(measurement?.querySelector(testIdSelector(TESTIDS.coverage.statementNone)), "a statement with rows prints no none").toBeNull();
  });

  test("the measurement statement says none only where nothing — unmeasured, partial or unclassed — stands outside it", async () => {
    const onlyPartial = await mount(view({ measurement: [], unclassed: [] }));
    const statement = onlyPartial.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.statement)}[data-axis="MEASUREMENT"]`);
    expect(statement?.querySelector(testIdSelector(TESTIDS.coverage.statementNone)), "a partly published cell is no complete boundary").toBeNull();
    cleanup();
    const whole = await mount(view({ measurement: [], partial: [], unclassed: [] }));
    const complete = whole.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.coverage.statement)}[data-axis="MEASUREMENT"]`);
    expect(complete?.querySelector(testIdSelector(TESTIDS.coverage.statementNone))?.textContent).toBe(COVERAGE_COPY.takeoff_coverage_statement_measurement_none);
  });
});
