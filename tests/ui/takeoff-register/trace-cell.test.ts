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
import {
  DERIVED,
  LINE_PARAM,
  aLine,
  aView,
  all,
  anObject,
  cleanup,
  linesFixture,
  mountRegister,
  objectKeyOf,
  one,
  originAddressOf,
  registerFixture,
  sourceKeyOf,
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
      expect(text(anchor), `${line.lineId}: the visible label is the cited key, whole (I-26, I-179)`).toContain(line.sourceKey);
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

    const rows = [...lines.querySelectorAll('[role="row"]')].filter((row) => row.querySelector('[role="columnheader"]') === null);
    for (const row of rows) {
      expect(row.querySelectorAll('[data-testid="evidence-link"]').length, "exactly one `evidence-link` per rendered row").toBe(1);
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
