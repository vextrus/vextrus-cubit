// @vitest-environment jsdom
/**
 * The proposal's surface on S-Coverage (s-coverage I-297, L-AI-02, L-AI-03, R-UI-050).
 *
 * What is judged is what a reader meets and what the act is handed: the block stands ONLY where a
 * boundary was proposed, it states the cause in words and the register's own sentence for it, its
 * one button opens the door the proposed cause names, and the proposal reaches the act's input so
 * the act can judge it. Where nothing was proposed there is no region and no sentence at all — this
 * screen has no idle panel — and a cell the two doors do not stand over is never even asked about,
 * because a call nobody could act on is a charge for nothing (L-AI-01).
 *
 * The cause's own words are never spelled here: they are read from `@/core/errors`, the one home
 * that holds them (I-191, R-SPINE-062), so a registry that rewords a cause moves the expectation
 * with it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { REFUSALS } from "@/core/errors";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import type { ResidueCell } from "@/core/residue/law";
import { CoverageWorkspace, type BoundaryCell, type CoverageDoors, type CoverageWorkspaceProps } from "@/modules/takeoff/coverage/coverage-workspace";
import { COVERAGE_COPY } from "@/modules/takeoff/coverage/copy";
import type { CoverageView, ProposedCause } from "@/modules/takeoff/coverage/view";

afterEach(cleanup);

const CELL = "rcc.concrete:column:level-1";
const CALL = "call-97f0";

function cell(over: Partial<ResidueCell> = {}): ResidueCell {
  return {
    kind: "rcc.concrete",
    class: "column",
    levelId: "level-1",
    levelLabel: "2F",
    levelOrdinal: 2,
    grain: "CELL",
    measurement: "NOT_ESTABLISHED",
    bill: "IN_BILL",
    contradicted: false,
    lineIds: [],
    sightings: [{ class: "column", levelId: "level-1", channel: "PARTITION", drawingId: "d1", layoutName: "S-10 COLUMN LAYOUT PLAN", sourceKey: "v:PLAN:DXF_HANDLE:10A2" }],
    observations: [{ class: "column", kind: "rcc.concrete", levelId: "level-1", rail: "column/rcc.concrete", reason: REFUSALS.PLAN_READING_ABSENT.message }],
    measurementActId: null,
    billActId: null,
    ...over,
  };
}

function view(cells: readonly ResidueCell[]): CoverageView {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    campaignId: "campaign-1",
    setRevisionId: "rev-1",
    input: { bears: [], workItems: [], levels: [{ levelId: "level-1", ordinal: 2, label: "2F" }], sightings: [], lines: [], declarations: [], truncated: [], observations: [] },
    cells,
    measurement: [],
    bill: [],
  };
}

/** What one mount asked and what it was handed, so a case can read both back. */
type Asked = { cells: string[]; inputs: BoundaryCell[] };

function doorsFor(answer: ProposedCause | null, asked: Asked, options: { omit?: boolean } = {}): Partial<CoverageDoors> {
  const remember = async ({ input }: { input: BoundaryCell }) => {
    asked.inputs.push(input);
    return { consequence: { actType: input.proposal === undefined ? "none" : "proposed" } as never, consequenceDigest: "digest-1" };
  };
  return {
    previewHoldOutOfBill: remember,
    previewDeclareNotInProjectScope: remember,
    commitHoldOutOfBill: async ({ input }) => {
      asked.inputs.push(input);
      return { actId: "act-1" };
    },
    commitDeclareNotInProjectScope: async ({ input }) => {
      asked.inputs.push(input);
      return { actId: "act-2" };
    },
    ...(options.omit === true
      ? {}
      : {
          proposeCause: async ({ cell: address }) => {
            asked.cells.push(address);
            return { proposal: answer };
          },
        }),
  };
}

async function mount(props: Partial<CoverageWorkspaceProps> & { view: CoverageView }): Promise<HTMLElement> {
  const rendered = render(<CoverageWorkspace permitted {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered.container;
}

/** The proposal block, found by its heading and never by a test id (§7: the registry is closed). */
function region(container: ParentNode): HTMLElement | null {
  return container.querySelector<HTMLElement>(`section[aria-label="${COVERAGE_COPY.takeoff_coverage_proposed_heading}"]`);
}

function inspector(container: ParentNode): HTMLElement {
  const found = container.querySelector<HTMLElement>(testIdSelector(TESTIDS.coverage.inspector));
  expect(found, "a selected cell mounts the one inspector").not.toBeNull();
  return found as HTMLElement;
}

describe("a boundary a model proposed, stated as a proposal", () => {
  test("the block stands where one was proposed, in words, with the register's own sentence beneath it", async () => {
    const asked: Asked = { cells: [], inputs: [] };
    const container = await mount({ view: view([cell()]), cell: CELL, doors: doorsFor({ callId: CALL, cause: "NOT_IN_THIS_BILL" }, asked) });
    await waitFor(() => expect(region(container), "the region stands once the door has answered").not.toBeNull());

    const block = region(container) as HTMLElement;
    const text = (block.textContent ?? "").replace(/\s+/gu, " ");
    expect(text, "the cause is said in words").toContain("NOT_IN_THIS_BILL");
    expect(text, "the certificate's sentence is the registry's, verbatim (I-191)").toContain(REFUSALS.NOT_IN_THIS_BILL.message);
    expect(text, "the block says what it is: a proposal, and nothing declared").toContain(COVERAGE_COPY.takeoff_coverage_proposed_note);
    expect(text).toContain(COVERAGE_COPY.takeoff_coverage_proposed_sentence_label);
    expect(asked.cells, "one cell open, one question asked").toEqual([CELL]);
  });

  test("the inspector carries the cause and the call a journey reads it by", async () => {
    const asked: Asked = { cells: [], inputs: [] };
    const container = await mount({ view: view([cell()]), cell: CELL, doors: doorsFor({ callId: CALL, cause: "NOT_IN_PROJECT_SCOPE" }, asked) });
    await waitFor(() => expect(inspector(container).getAttribute("data-proposed-cause")).toBe("NOT_IN_PROJECT_SCOPE"));
    expect(inspector(container).getAttribute("data-proposed-call")).toBe(CALL);
  });

  test("nothing proposed is no region and no sentence — there is no idle panel on this screen", async () => {
    const asked: Asked = { cells: [], inputs: [] };
    const container = await mount({ view: view([cell()]), cell: CELL, doors: doorsFor(null, asked) });
    await waitFor(() => expect(asked.cells).toEqual([CELL]));
    expect(region(container)).toBeNull();
    expect(inspector(container).getAttribute("data-proposed-cause")).toBe("");
    expect((container.textContent ?? ""), "no sentence stands in for a proposal nobody made").not.toContain(COVERAGE_COPY.takeoff_coverage_proposed_note);
  });

  test("a mount that hands no such door shows no region and asks nothing", async () => {
    const asked: Asked = { cells: [], inputs: [] };
    const container = await mount({ view: view([cell()]), cell: CELL, doors: doorsFor({ callId: CALL, cause: "NOT_IN_THIS_BILL" }, asked, { omit: true }) });
    expect(region(container)).toBeNull();
    expect(asked.cells).toEqual([]);
  });
});

describe("which cell is asked about at all, and what the act is handed", () => {
  test("a measured cell, a kind-grain row and a reader who may not act are never asked (I-194, L-AI-01)", async () => {
    for (const [name, props] of [
      ["a measured cell", { view: view([cell({ measurement: "QUANTITY_BEARING" })]), cell: CELL }],
      ["a kind-grain row", { view: view([cell({ grain: "KIND", class: null, levelId: null })]), cell: "rcc.concrete::" }],
      ["a cell naming no level", { view: view([cell({ levelId: null })]), cell: "rcc.concrete:column:" }],
      ["a reader who may not declare", { view: view([cell()]), cell: CELL, permitted: false }],
    ] as const) {
      const asked: Asked = { cells: [], inputs: [] };
      await mount({ ...props, doors: doorsFor({ callId: CALL, cause: "NOT_IN_THIS_BILL" }, asked) });
      expect(asked.cells, `${name} is never put to a model`).toEqual([]);
      cleanup();
    }
  });

  test("carrying the proposed boundary opens the door that cause names, and the act is handed the proposal", async () => {
    const asked: Asked = { cells: [], inputs: [] };
    const container = await mount({
      view: view([cell()]),
      cell: CELL,
      doors: doorsFor({ callId: CALL, cause: "NOT_IN_THIS_BILL" }, asked),
      chrome: { ConsequenceDialog: ({ preview }) => <button data-testid="dialog-preview" onClick={() => void preview()} type="button" /> },
    });
    await waitFor(() => expect(region(container)).not.toBeNull());

    const carry = [...(region(container) as HTMLElement).querySelectorAll("button")].find((button) => (button.textContent ?? "").includes(COVERAGE_COPY.takeoff_coverage_proposed_carry));
    expect(carry, "the block's one button carries the boundary it proposes").toBeTruthy();
    fireEvent.click(carry as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector('[data-testid="dialog-preview"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-testid="dialog-preview"]') as HTMLButtonElement);

    await waitFor(() => expect(asked.inputs.length).toBe(1));
    expect(asked.inputs[0]?.proposal, "the act judges the proposal it was handed, by its call id").toEqual({ callId: CALL, cause: "NOT_IN_THIS_BILL" });
  });

  test("a person who declared unaided carries no proposal at all, so the act writes no outcome", async () => {
    const asked: Asked = { cells: [], inputs: [] };
    const container = await mount({
      view: view([cell()]),
      cell: CELL,
      doors: doorsFor(null, asked),
      chrome: { ConsequenceDialog: ({ preview }) => <button data-testid="dialog-preview" onClick={() => void preview()} type="button" /> },
    });
    await waitFor(() => expect(asked.cells).toEqual([CELL]));
    fireEvent.click(container.querySelector(testIdSelector(TESTIDS.coverage.holdOut)) as HTMLButtonElement);
    await waitFor(() => expect(container.querySelector('[data-testid="dialog-preview"]')).not.toBeNull());
    fireEvent.click(container.querySelector('[data-testid="dialog-preview"]') as HTMLButtonElement);

    await waitFor(() => expect(asked.inputs.length).toBe(1));
    expect(Object.hasOwn(asked.inputs[0] ?? {}, "proposal"), "no member at all, rather than a null one").toBe(false);
  });
});
