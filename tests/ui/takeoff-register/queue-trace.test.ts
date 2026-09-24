// @vitest-environment jsdom
/**
 * I-557 — a queue item reveals its key in the sheet (R-TO-011, R-UI-022; docs/design/evidence-link.md
 * I-554, I-555).
 *
 * The register's "Deferred and refused" rail is mounted over two rows: one whose member the server
 * resolved to its outline and mark on S-10, and one it could not resolve. What a QS meets is judged:
 * the first row's chip stands beside a Trace to the member on its plan, named as the Source column
 * names a sheet, carrying the key whole and claiming no basis; the second offers no link at all.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { SELECTION_PARAM, splitSelection } from "../../../src/modules/takeoff/viewer-inspector/selection";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { PROJECT, TENANT, all, mountRegister, objectKeyOf, refusalsFixture, text } from "./support/fixtures";

afterEach(() => {
  cleanup();
});

const OUTLINE = "DXF_HANDLE:1A";
const MARK = "DXF_HANDLE:1B";

describe("I-557: a queue item reveals its key in the sheet", () => {
  test("a resolved queue item links the viewer at its sheet, selecting the member's outline and mark", async () => {
    const view = refusalsFixture();
    const [resolved, unresolved] = view.refusals;
    if (resolved === undefined || unresolved === undefined) throw new Error("the refusals fixture holds two rows");
    resolved.sheet = { drawingId: "drawing-1", layoutName: "S-10 Column layout", sheetLabel: "S-10", sourceKeys: [OUTLINE, MARK] };
    const root = await mountRegister(view);

    const rows = all(root, "register-refusal");
    const first = rows.find((row) => row.getAttribute("data-object") === objectKeyOf("C4"));
    const links = [...(first?.querySelectorAll<HTMLAnchorElement>(testIdSelector(TESTIDS.evidence.link)) ?? [])];
    expect(links, "the row carries exactly one Trace").toHaveLength(1);
    const link = links[0] as HTMLAnchorElement;
    const href = link.getAttribute("href") ?? "";
    expect(href, "the viewer at the drawing and the sheet the member stands on").toMatch(new RegExp(`^/t/${TENANT}/p/${PROJECT}/viewer/drawing-1/${encodeURIComponent("S-10 Column layout")}\\?`, "u"));
    expect(splitSelection(new URL(href, "http://cubit.test").searchParams.get(SELECTION_PARAM)), "selecting the outline and the mark — what the viewer can hold").toEqual([OUTLINE, MARK]);
    expect(href, "no origin row: no quantity line was published for a queue item").not.toContain("line=");
    expect(text(link).replace(/\s+/gu, " ").trim(), "named as the Source column names a sheet: its number, then the member's mark").toBe("S-10 · C4");
    expect(link.getAttribute("data-key"), "the key itself rides the anchor, whole (I-287)").toBe(objectKeyOf("C4"));
    expect(link.hasAttribute("data-basis"), "a queue item names a member, never a figure read on a basis (I-554)").toBe(false);
    expect(first?.querySelector(testIdSelector(TESTIDS.register.refusalObject)), "and the key's chip still stands beside it").not.toBeNull();

    const second = rows.find((row) => row.getAttribute("data-object") === objectKeyOf("C5"));
    expect(second?.querySelector(testIdSelector(TESTIDS.evidence.link)), "a row the server resolved nothing for offers no link (I-181)").toBeNull();
  });
});
