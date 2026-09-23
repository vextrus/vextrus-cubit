// @vitest-environment jsdom
/**
 * S-Coverage's craft amendments (docs/design/s-coverage.md I-cov-1 … I-cov-5, session 7's look).
 *
 * - A published cell whose every line was kept with no quantity (PARTIAL_DECLARED) is NOT painted as
 *   measured: it wears the partial mark at ramp step 0 and says how many of its lines carry none,
 *   while `data-measurement` still states the residue's own reading (L-QTY-02, R-UI-050, I-cov-1).
 * - A class band names its class in words, in a band wide enough to name it (I-cov-2).
 * - A column sighted on no level of the stack says so rather than standing blank (I-cov-3).
 * - A certificate row separates kind · class · level and names a level-less cell's level (I-cov-4).
 * - The screen names itself with one h1 (I-cov-5).
 */
import { afterEach, describe, expect, test } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { RESIDUE_REFUSALS } from "@/core/errors/residue";
import { cellRef, type ResidueCell, type StatementRow } from "@/core/residue/law";
import { CoverageWorkspace } from "@/modules/takeoff/coverage/coverage-workspace";
import { COVERAGE_COPY } from "@/modules/takeoff/coverage/copy";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { TESTIDS, testIdSelector } from "@/ui/testids";

afterEach(cleanup);

/** One cell of F-RCC6-BNBC's shape: pile caps, filed under the FOUNDATION slot, so on no stack level. */
function cell(over: Partial<ResidueCell> = {}): ResidueCell {
  return {
    kind: "rcc.concrete",
    class: "pile_cap",
    levelId: null,
    levelLabel: "",
    levelOrdinal: null,
    grain: "CELL",
    measurement: "QUANTITY_BEARING",
    bill: "IN_BILL",
    contradicted: false,
    lineIds: ["l1", "l2", "l3"],
    sightings: [],
    observations: [],
    measurementActId: null,
    billActId: null,
    ...over,
  };
}

function view(cells: readonly ResidueCell[], declaredLineIds: readonly string[], measurement: readonly StatementRow[] = []): CoverageView {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    campaignId: "campaign-1",
    setRevisionId: "rev-1",
    input: { bears: [], workItems: [], levels: [{ levelId: "level-1", ordinal: 0, label: "GF" }], sightings: [], lines: [], declarations: [], truncated: [], observations: [] },
    cells,
    measurement,
    bill: [],
    declaredLineIds,
  };
}

async function mount(of: CoverageView): Promise<HTMLElement> {
  const rendered = render(<CoverageWorkspace permitted view={of} />);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered.container;
}

const cellsOf = (root: ParentNode): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('[role="gridcell"]')];

describe("S-Coverage paints what the lines bear, and names every column", () => {
  test("I-cov-1: a published cell whose lines all carry no quantity wears the partial mark at step 0", async () => {
    const root = await mount(view([cell()], ["l1", "l2", "l3"]));
    const [only] = cellsOf(root);
    expect(only?.getAttribute("data-measurement"), "the residue's own reading is stated, untouched").toBe("QUANTITY_BEARING");
    expect(only?.getAttribute("data-mark"), "and it is not painted as measured").toBe("partial");
    expect(only?.getAttribute("data-cov"), "no quantity borne is ramp step 0 — nothing rounds up into measured (I-210)").toBe("0");
    expect(only?.getAttribute("data-declared")).toBe("3");
    expect(only?.getAttribute("aria-label"), "the cell says how many lines carry none").toContain("3 of its 3 lines carry no quantity");
  });

  test("I-cov-1: a cell whose lines bear quantity stays published and whole", async () => {
    const root = await mount(view([cell()], []));
    const [only] = cellsOf(root);
    expect(only?.getAttribute("data-mark")).toBe("published");
    expect(only?.getAttribute("data-cov")).toBe("4");
  });

  test("I-cov-2, I-cov-3: the band names its class in words and a level-less column says so", async () => {
    const root = await mount(view([cell(), cell({ class: "pile", kind: "piling.bored" })], []));
    const bands = [...root.querySelectorAll<HTMLElement>(".cx-coverage-class")].map((band) => band.textContent);
    expect(bands, "two classes, two names — never `pile | pile`").toEqual(["Pile", "Pile cap"]);
    const levels = [...root.querySelectorAll<HTMLElement>(".cx-coverage-level")].map((header) => header.textContent);
    expect(levels, "a column on no stack level states it").toEqual([COVERAGE_COPY.takeoff_coverage_level_none, COVERAGE_COPY.takeoff_coverage_level_none]);
    // TEST_AMENDED (I-351): a column is the grid's CELL at least — `--cx-coverage-cell`, which is
    // `var(--row-h)` at least and grows when the box has room — no longer `var(--row-h)` outright.
    const tracks = root.querySelector<HTMLElement>('[role="grid"]')?.style.getPropertyValue("--cx-coverage-tracks") ?? "";
    expect(tracks, "each band's columns are wide enough for its name, and never narrower than a cell").toContain("max(var(--cx-coverage-cell)");
  });

  test("I-cov-4, I-cov-5: a certificate row is kind · class · level, and the screen has one h1", async () => {
    const row: StatementRow = { kind: "piling.bored", class: "pile", levelId: null, levelLabel: "", levels: "", grain: "CELL", cause: "NOT_ESTABLISHED" };
    const root = await mount(view([cell()], [], [row]));
    const said = [...root.querySelectorAll<HTMLElement>(".cx-coverage-statement-where .cx-coverage-value")].map((node) => node.textContent);
    // TEST_AMENDED (I-351): the kind and the class are said in words, by the rule the draft BOQ prints
    // them by — a certificate is a document a client reads. The keys stay on the row's data.
    expect(said, "each part its own named value — the stylesheet puts the separator between them").toEqual(["Bored", "Pile", COVERAGE_COPY.takeoff_coverage_level_none]);
    const statement = root.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.statementRow));
    expect(statement?.getAttribute("data-kind"), "the stored kind stays on the row").toBe("piling.bored");
    expect(statement?.getAttribute("data-class"), "and the stored class").toBe("pile");
    expect([...root.querySelectorAll("h1")].map((heading) => heading.textContent)).toEqual([COVERAGE_COPY.takeoff_coverage_heading]);
  });
});

describe("I-351: one kind, one spelling across the lane; every header read in full; no build word in a sentence", () => {
  test("a row header says its kind in words, with the key on the row and inside the label's disclosure", async () => {
    const root = await mount(view([cell(), cell({ class: "pile", kind: "piling.bored" })], []));
    const rows = [...root.querySelectorAll<HTMLElement>(testIdSelector(TESTIDS.coverage.kindRow))];
    expect(rows.map((row) => row.getAttribute("data-kind")), "the rows still carry the stored keys").toEqual(["piling.bored", "rcc.concrete"]);
    const names = rows.map((row) => row.querySelector<HTMLElement>(".cx-coverage-kind-name"));
    expect(names.map((name) => name?.getAttribute("data-value")), "the label keeps the key it says").toEqual(["piling.bored", "rcc.concrete"]);
    expect(names.map((name) => name?.firstChild?.textContent), "and says it as the register and the bill do").toEqual(["Bored", "Concrete"]);
    const headers = rows.map((row) => row.querySelector<HTMLElement>('[role="rowheader"]')?.getAttribute("aria-label") ?? "");
    expect(headers[1], "the row's accessible name says the kind in words too").toMatch(/^Concrete /u);
  });

  test("a cell's name says its kind and its class in the words the headers show", async () => {
    const root = await mount(view([cell()], []));
    const [only] = cellsOf(root);
    const label = only?.getAttribute("aria-label") ?? "";
    expect(label, "never the key").not.toContain("rcc.concrete");
    expect(label).toContain("Concrete on Pile cap");
  });

  test("a level header is its own box, and its column is sized to read it — `No level` over a one-level band", async () => {
    const root = await mount(view([cell({ class: "pile", kind: "piling.bored" })], []));
    const header = root.querySelector<HTMLElement>(".cx-coverage-level");
    expect(header?.querySelector(".cx-coverage-level-name")?.textContent, "the label rides its own box so an ellipsis can reach it").toBe(COVERAGE_COPY.takeoff_coverage_level_none);
    const tracks = root.querySelector<HTMLElement>('[role="grid"]')?.style.getPropertyValue("--cx-coverage-tracks") ?? "";
    const width = COVERAGE_COPY.takeoff_coverage_level_none.length;
    expect(tracks, "the column measures its own level header, not only the class word above it").toContain(`calc(${width}ch + 2 * var(--space-2))`);
  });

  test("the inspector's fact line says the kind and the class in words", async () => {
    const rendered = render(<CoverageWorkspace permitted view={view([cell()], [])} cell={cellRef(cell())} />);
    await act(async () => {
      await Promise.resolve();
    });
    const where = rendered.container.querySelector<HTMLElement>(".cx-coverage-where");
    expect(where, "a selected cell stands in the inspector").not.toBeNull();
    const parts = [...(where as HTMLElement).querySelectorAll<HTMLElement>(".cx-coverage-value")].map((node) => node.firstChild?.textContent);
    expect(parts).toEqual(["Concrete", "Pile cap", COVERAGE_COPY.takeoff_coverage_level_none]);
  });

  test("no registered sentence about a coverage cell names the machine's own word for the grid", () => {
    // §3's voice: "seam", "ingest", "manifest", "residue" appear nowhere a reader can see — and the
    // certificate prints these messages to a client (R-SPINE-062: the registry is their one home).
    for (const entry of Object.values(RESIDUE_REFUSALS)) {
      expect(`${entry.message} ${entry.remedy}`, entry.code).not.toMatch(/\b(?:residue|seam|ingest|manifest)\b/iu);
    }
  });
});
