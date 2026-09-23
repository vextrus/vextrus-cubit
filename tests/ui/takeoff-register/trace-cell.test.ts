/**
 * AC-3 — the register's `source` cell is the Trace's origin (R-UI-022, R-TO-011, X-2).
 *
 * The workspace is mounted exactly as inc-214's suites mount it: the shipped chrome, now including
 * the shipped `EvidenceLink`, so what a test reads is what the route renders (I-170). Every address
 * asserted here is recomputed from the staged line by `traceAddressOf`/`originAddressOf` — the test
 * contract's own spelling, never the product's, so a wrong spelling cannot agree with itself.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import {
  DERIVED,
  LINE_PARAM,
  aLine,
  aView,
  all,
  anObject,
  cleanup,
  copy,
  linesFixture,
  mountRegister,
  objectKeyOf,
  one,
  originAddressOf,
  registerFixture,
  sourceKeyOf,
  takeoffStrings,
  text,
  traceAddressOf,
  userEvent,
  type ViewLine,
} from "./support/fixtures";

afterEach(() => cleanup());

/** Every link the workspace renders, wherever it stands. */
function links(root: HTMLElement): HTMLElement[] {
  return all(root, "evidence-link");
}

/** The link a row carries for one line, asserted to be exactly one. */
function linkOf(root: HTMLElement, lineId: string): HTMLElement {
  const found = links(root).filter((anchor) => anchor.getAttribute("data-line") === lineId);
  expect(found.length, `exactly one \`evidence-link\` stands for ${lineId} (Decision I-179)`).toBe(1);
  return found[0] as HTMLElement;
}

describe("AC-3: the source cell is the link", () => {
  test("AC-3: every row's source cell is one EvidenceLink addressed at the Trace", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);

    const anchors = links(root);
    expect(anchors.map((anchor) => anchor.getAttribute("data-line")).sort(), "one link per published line, and no line without one").toEqual(view.lines.map((line) => line.lineId).sort());

    for (const line of view.lines) {
      const anchor = linkOf(root, line.lineId);
      expect(anchor.getAttribute("data-basis"), `${line.lineId}: the link is coloured by the line's quantity basis`).toBe(line.quantityBasis);
      // I-287 amends I-179: the key stands on the element that IS the evidence, never in body text
      // (R-UI-082). This fixture's key is of no grammar the product reads, so I-234's last clause
      // keeps it whole in the label too — the reading of a VIEW key is identifier-exposure.test.ts's.
      expect(anchor.getAttribute("data-key"), `${line.lineId}: the cited key is whole on the anchor (I-287)`).toBe(line.sourceKey);
      expect(text(anchor), `${line.lineId}: a key of no known grammar stands whole in the chips (I-26, I-234)`).toContain(line.sourceKey);
      // TEST_AMENDED (VD-1, I-425): the sheet opens the label by its NUMBER (I-179), and the layout
      // it is — the whole title the Source column cut short — is where the href goes, not the face.
      expect(text(anchor), `${line.lineId}: and the sheet the line stands on opens the label, by its number`).toContain(`${line.sheetLabel as string} · `);
      expect(text(anchor), `${line.lineId}: never by the layout's whole title`).not.toContain(line.layoutName as string);
      expect(anchor.getAttribute("href"), `${line.lineId}: the href is the Trace address the contract spells`).toBe(traceAddressOf(line));

      const href = anchor.getAttribute("href") ?? "";
      expect(/[?&]v=/.test(href), `${line.lineId}: no \`v\` parameter — its absence is what makes the viewer fly (I-85)`).toBe(false);
      expect(href.includes(`${LINE_PARAM}=${encodeURIComponent(line.lineId)}`), `${line.lineId}: the address names the origin line`).toBe(true);

      const cell = anchor.closest('[role="gridcell"], [role="rowheader"]');
      expect(cell, `${line.lineId}: the link stands in a cell of the lines table`).not.toBeNull();
      expect(text(cell), `${line.lineId}: the cell's whole content is the link — no icon, no second control beside it (I-179)`).toBe(text(anchor));
    }
  });

  test("AC-3: no link stands outside the lines table, and each row carries exactly one", async () => {
    const root = await mountRegister(registerFixture());
    const lines = one(root, "register-lines");

    for (const anchor of links(root)) {
      expect(lines.contains(anchor), "every `evidence-link` under the workspace stands inside `register-lines` (Decision §7)").toBe(true);
    }

    // The body's own rows, which are the ones a line stands on: the header, the group headers
    // (§5 rule 4) and the totals footer (§5 rule 1) are rows of the table and not rows of a line.
    const rows = [...lines.querySelectorAll('[role="row"]')].filter(
      (row) => row.querySelector('[role="columnheader"]') === null && row.getAttribute("data-line") !== null,
    );
    for (const row of rows) {
      expect(row.querySelectorAll(testIdSelector(TESTIDS.evidence.link)).length, "exactly one `evidence-link` per rendered row").toBe(1);
    }
  });
});

describe("AC-3: activating a link stamps the origin first", () => {
  test("AC-3: history.replaceState carries the register's own address plus ?line before the navigation proceeds", async () => {
    const view = registerFixture();
    const root = await mountRegister(view);
    const line = view.lines[0] as ViewLine;
    const anchor = linkOf(root, line.lineId);

    const replaced: unknown[][] = [];
    const pushed: unknown[][] = [];
    const originalReplace = window.history.replaceState;
    const originalPush = window.history.pushState;
    window.history.replaceState = ((...args: unknown[]) => void replaced.push(args)) as typeof window.history.replaceState;
    window.history.pushState = ((...args: unknown[]) => void pushed.push(args)) as typeof window.history.pushState;

    /* The default action is what makes Back a real history step (I-180), so the click is allowed to
       reach the end of its dispatch and is only then stopped — jsdom cannot navigate. What is read
       at that point is what the browser would have carried out of the page. */
    let preventedByTheScreen: boolean | null = null;
    let stampedBeforeNavigation = 0;
    const guard = (event: Event): void => {
      preventedByTheScreen = event.defaultPrevented;
      stampedBeforeNavigation = replaced.length;
      event.preventDefault();
    };
    window.addEventListener("click", guard);

    try {
      await userEvent.setup().click(anchor);
    } finally {
      window.removeEventListener("click", guard);
      window.history.replaceState = originalReplace;
      window.history.pushState = originalPush;
    }

    expect(stampedBeforeNavigation, "the origin is stamped before the navigation is allowed to proceed (I-180)").toBe(1);
    expect(String((replaced[0] as unknown[])[2]), "the stamp is the register's own address plus `?line={lineId}`").toBe(originAddressOf(line.lineId));
    expect(preventedByTheScreen, "the screen never calls preventDefault: the link is a plain anchor navigation (I-178, I-180)").toBe(false);
    expect(pushed.length, "and never pushState: a second Back between the sheet and the register is not offered (I-180)").toBe(0);
  });
});

describe("AC-3: a link is offered only where there is somewhere to go", () => {
  test("AC-3: a repudiated line is withheld from the table, so it carries no link at all (I-173)", async () => {
    const kept = aLine({ lineId: "line-kept", objectKey: objectKeyOf("C1"), sourceKey: sourceKeyOf("C1") });
    const struck = aLine({ lineId: "line-struck", objectKey: objectKeyOf("C2"), sourceKey: sourceKeyOf("C2"), repudiated: true });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" }), anObject({ mark: "C2" })], lines: [kept, struck] }));

    expect(links(root).map((anchor) => anchor.getAttribute("data-line")), "only the lines the table shows carry links").toEqual([kept.lineId]);
    expect(text(one(root, "register-lines")), "and the struck line is not a row at all (I-173)").not.toContain(struck.sourceKey);
  });

  test("AC-3: a line that can name no place keeps its key as plain text and no anchor (I-181)", async () => {
    const placed = aLine({ lineId: "line-placed", objectKey: objectKeyOf("C1"), sourceKey: sourceKeyOf("C1") });
    const sheetless = aLine({ lineId: "line-sheetless", objectKey: objectKeyOf("C2"), sourceKey: sourceKeyOf("C2"), drawingId: null, layoutName: null });
    const defaulted = aLine({ lineId: "line-defaulted", objectKey: objectKeyOf("C3"), sourceKey: sourceKeyOf("C3"), quantityBasis: "DEFAULTED", selectionBasis: DERIVED });
    const root = await mountRegister(aView({ objects: ["C1", "C2", "C3"].map((mark) => anObject({ mark })), lines: [placed, sheetless, defaulted] }));

    expect(links(root).map((anchor) => anchor.getAttribute("data-line")), "the line with a resolvable sheet and a read basis is the only one offered a place (I-181)").toEqual([placed.lineId]);

    const table = text(one(root, "register-lines"));
    for (const line of [sheetless, defaulted]) {
      expect(table, `${line.lineId} keeps its key, rendered and not hidden (R-UI-050's partial cell)`).toContain(line.sourceKey);
    }
  });

  /*
   * VD-1 (walk-0, BLOCKS_DEMO): every register Trace landed on a sheet named `Model` that the drawing
   * does not hold, and the chip read "Model · P1 · Layou…". The chip now names the sheet a line
   * stands on by its number and its link opens that very layout; a line read in model space that no
   * sheet's window shows says so in words, and its link opens model space by the artifact's own name.
   */
  test("VD-1: the chip names the sheet's number and the link opens the layout it names", async () => {
    const column = aLine({ lineId: "line-s10", objectKey: objectKeyOf("C1"), sourceKey: sourceKeyOf("C1"), layoutName: "S-10 COLUMN LAYOUT PLAN", sheetLabel: "S-10" });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [column] }));
    const anchor = linkOf(root, column.lineId);

    expect(text(anchor), "the chip leads with the sheet's number").toContain("S-10 · C1");
    expect(text(anchor), "and never the layout's whole title").not.toContain("COLUMN LAYOUT PLAN");
    expect(anchor.getAttribute("href"), "while the link opens the layout the number stands for").toBe(traceAddressOf(column));
    expect(anchor.getAttribute("href"), "spelled as that layout is spelled").toContain(`/${encodeURIComponent("S-10 COLUMN LAYOUT PLAN")}?`);
  });

  test("VD-1: a line on model space says so in words, and opens model space by the artifact's own name", async () => {
    const strings = await takeoffStrings();
    const modelSpace = aLine({ lineId: "line-model", objectKey: objectKeyOf("C1"), sourceKey: sourceKeyOf("C1"), layoutName: "model", sheetLabel: null });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [modelSpace] }));
    const anchor = linkOf(root, modelSpace.lineId);

    expect(text(anchor), "the chip says model space in words (I-179, R-UI-082)").toContain(`${copy(strings, "takeoff_register_source_model_space")} · C1`);
    expect(anchor.getAttribute("href"), "and the link opens the layout the artifact names — `model`, never `Model`").toContain("/model?");
  });

  test("VD-1: what the Trace selects is addressed losslessly — a key's comma is not a separator", async () => {
    const placed = aLine({ lineId: "line-comma", objectKey: objectKeyOf("C1"), sourceKey: sourceKeyOf("C1"), traceKeys: ["PDF_OBJECT:12,0", "DXF_HANDLE:99C"] });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [placed] }));
    const href = linkOf(root, placed.lineId).getAttribute("href") ?? "";

    expect(href, "the address the contract spells, each key escaped before it is joined (I-423)").toBe(traceAddressOf(placed));
    expect(new URL(href, "http://cubit.test").searchParams.get("s")?.split(",").length, "two keys, two segments — never three").toBe(2);
  });

  /*
   * A line measured off a placement CITES the placement, the schedule cell and the level note, and
   * its Trace SELECTS the member's outline and mark, which it cites nowhere. The reading carries the
   * two apart (`sourceKeys`, `traceKeys`) because the register JSON export publishes the first under
   * its 1.0 meaning (I-426); the link must carry the second, and nothing of the first.
   */
  test("VD-1: the link carries what the Trace selects, never the keys the line cites", async () => {
    const member = ["DXF_HANDLE:98B", "DXF_HANDLE:9A5"];
    const placed = aLine({ lineId: "line-member", objectKey: objectKeyOf("C4"), sourceKey: sourceKeyOf("C4"), traceKeys: member });
    expect(placed.sourceKeys.some((key) => member.includes(key)), "the staged line cites none of its member's keys, so the two lists are told apart").toBe(false);
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C4" })], lines: [placed] }));
    const href = linkOf(root, placed.lineId).getAttribute("href") ?? "";

    expect(href, "the address is the Trace's selection, as the contract spells it").toBe(traceAddressOf(placed));
    const selected = (new URL(href, "http://cubit.test").searchParams.get("s") ?? "").split(",");
    expect(selected, "exactly the member's outline and mark").toEqual(member);
    expect(selected.filter((key) => placed.sourceKeys.includes(key)), "and no key the line merely cites").toEqual([]);
  });

  test("AC-3: the cell spreads over the table it is given, one link per row, at any size", async () => {
    const view = linesFixture(8);
    const root = await mountRegister(view);

    const addressed = links(root);
    expect(addressed.length, "the fixture's every line carries a link — the count is the fixture's, not this file's").toBe(view.lines.length);
    for (const line of view.lines) {
      expect(linkOf(root, line.lineId).getAttribute("href"), `${line.lineId}: each row's address is composed from that row (B-19)`).toBe(traceAddressOf(line));
    }
  });
});
