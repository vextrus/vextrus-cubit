// @vitest-environment jsdom
/**
 * I-556 — a coverage sighting is the Trace to the place it names (s-coverage, evidence-link
 * I-554; R-UI-022, R-TO-011).
 *
 * The inspector's "Sighted in" rows are mounted over a reading whose server resolved each sighting's
 * key to what the viewer flies to on the sighting's own sheet: a placed pile to its outline and its
 * mark, a declaration's caption to itself. What is judged is what a QS meets — a link that opens the
 * sheet the row names, selecting exactly those entities, and no link at all where nothing resolved.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { cellRef, type ResidueCell } from "@/core/residue/law";
import { CoverageWorkspace, sightingAddress, type CoverageChrome } from "@/modules/takeoff/coverage/coverage-workspace";
import type { CoverageView } from "@/modules/takeoff/coverage/view";
import { SELECTION_PARAM, splitSelection } from "@/modules/takeoff/viewer-inspector/selection";
import { TESTIDS, testIdSelector } from "@/ui/testids";

afterEach(cleanup);

const PLACEMENT = "v:LAYOUT_PLAN:DXF_HANDLE:9A|P1|0.0,0.0";
const UNRESOLVED = "v:LAYOUT_PLAN:DXF_HANDLE:9A|P2|10.0,0.0";

const PILE: ResidueCell = {
  kind: "rcc.concrete",
  class: "pile",
  levelId: null,
  levelLabel: "",
  levelOrdinal: null,
  grain: "CELL",
  measurement: "QUANTITY_BEARING",
  bill: "IN_BILL",
  contradicted: false,
  lineIds: ["p1"],
  sightings: [
    { class: "pile", levelId: null, channel: "REGISTER", drawingId: "drawing-1", layoutName: "S-04", sourceKey: PLACEMENT, levelSlot: "FOUNDATION" },
    { class: "pile", levelId: null, channel: "REGISTER", drawingId: "drawing-1", layoutName: "S-04", sourceKey: UNRESOLVED, levelSlot: "FOUNDATION" },
  ],
  observations: [],
  measurementActId: null,
  billActId: null,
  reason: null,
  reasonViews: [],
  levelSlot: "FOUNDATION",
  partial: null,
};

function view(selections: CoverageView["sightingSelections"]): CoverageView {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    campaignId: "campaign-1",
    setRevisionId: "rev-1",
    input: { bears: [], workItems: [], levels: [], sightings: [], lines: [], declarations: [], truncated: [], observations: [] },
    cells: [PILE],
    measurement: [],
    bill: [],
    ...(selections === undefined ? {} : { sightingSelections: selections }),
  };
}

/** The shipped link's contract, stubbed: the anchor, its href and its words — and whether a basis was claimed. */
const EvidenceLink: CoverageChrome["EvidenceLink"] = (props) => {
  const claimed = (props as { basis?: string }).basis;
  return (
    <a data-testid={TESTIDS.evidence.link} href={props.href} data-basis={claimed}>
      {props.label}
    </a>
  );
};

async function mount(of: CoverageView): Promise<HTMLElement> {
  const rendered = render(<CoverageWorkspace permitted view={of} cell={cellRef(PILE)} chrome={{ EvidenceLink }} />);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered.container;
}

const rows = (root: ParentNode): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(testIdSelector(TESTIDS.coverage.inspectorSighting))];

describe("I-556: a sighting reveals its key on the sheet it names", () => {
  test("a placed pile's sighting links the viewer at S-04, selecting its outline and mark, and claims no basis", async () => {
    const root = await mount(view({ "drawing-1": { [PLACEMENT]: ["DXF_HANDLE:1A", "DXF_HANDLE:1B"] } }));
    const placed = rows(root).find((row) => row.getAttribute("data-source") === PLACEMENT);
    const link = placed?.querySelector<HTMLAnchorElement>(testIdSelector(TESTIDS.evidence.link));
    expect(link, "the resolved sighting's key is a Trace").not.toBeNull();
    const href = link?.getAttribute("href") ?? "";
    expect(href, "the viewer, at the drawing and the sheet the row names").toMatch(/^\/t\/tenant-1\/p\/project-1\/viewer\/drawing-1\/S-04\?/u);
    const selected = splitSelection(new URL(href, "http://cubit.test").searchParams.get(SELECTION_PARAM));
    expect(selected, "selecting the member's outline and mark — never the placement key the viewer cannot hold").toEqual(["DXF_HANDLE:1A", "DXF_HANDLE:1B"]);
    expect(href, "no origin row: a sighting was not followed from a quantity line").not.toContain("line=");
    expect(link?.textContent, "the key the channel read, whole").toBe(PLACEMENT);
    expect(link?.hasAttribute("data-basis"), "a sighting names an entity, never a figure read on a basis (I-554)").toBe(false);
  });

  test("a sighting whose key resolved to nothing keeps its key, whole, and offers no link", async () => {
    const root = await mount(view({ "drawing-1": { [PLACEMENT]: ["DXF_HANDLE:1A"] } }));
    const unresolved = rows(root).find((row) => row.getAttribute("data-source") === UNRESOLVED);
    expect(unresolved, "the row stands").toBeDefined();
    expect(unresolved?.querySelector(testIdSelector(TESTIDS.evidence.link)), "no link to a sheet that cannot hold it").toBeNull();
    expect(unresolved?.textContent, "the key still stands in the row").toContain(UNRESOLVED);
  });

  test("the address is the server's reading or none — never a guess made in the browser", () => {
    const seen = { drawingId: "drawing-1", layoutName: "S-04", sourceKey: PLACEMENT };
    expect(sightingAddress("tenant-1", "project-1", seen, undefined), "no reading, no link").toBeNull();
    expect(sightingAddress("tenant-1", "project-1", seen, { "drawing-1": { [PLACEMENT]: [] } }), "an empty selection, no link").toBeNull();
    expect(sightingAddress("tenant-1", "project-1", { ...seen, layoutName: "" }, { "drawing-1": { [PLACEMENT]: ["DXF_HANDLE:1A"] } }), "no sheet named, no link").toBeNull();
    expect(sightingAddress("tenant-1", "project-1", seen, { "drawing-2": { [PLACEMENT]: ["DXF_HANDLE:1A"] } }), "another drawing's reading is not this sighting's").toBeNull();
  });
});
