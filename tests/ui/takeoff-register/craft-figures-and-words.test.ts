// @vitest-environment jsdom
/**
 * The register's craft amendments (docs/design/s-takeoff.md I-reg-1 … I-reg-3, session 7's look):
 *
 * - a line kept with no quantity SAYS why in its own Value cell, from the components the line itself
 *   enumerated as omitted, and wears no coverage percentage nobody computed (L-QTY-02, R-UI-002);
 * - a figure's face is its kind's display precision while `data-value` keeps the exact published
 *   decimal, in a row and in the sticky footer alike (L-QTY-03, L-FMT-02, B-07);
 * - a formula's long constant is cut on the face and stands whole in the inspector (§5 rule 2);
 * - marks read in natural order, and a class and a lawful-null level slot are said in words
 *   (R-UI-082, R-UI-083).
 *
 * Mounted over the shipped chrome exactly as the route binds it (I-170).
 */
import { cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { inWords } from "../../../src/core/documents/kinds/boq-draft-law";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { aLine, aView, anObject, all, cellsOf, lineRows, mountRegister, objectKeyOf, one, text, treeItem, treeItems, type ViewLine } from "./support/fixtures";

afterEach(() => {
  cleanup();
});

/** F-RCC6-BNBC's circular column C7, as the journey published it (the craft look's own figure). */
const C7_VALUE = "0.53323979985339035022662733";
const PI_FORMULA = "V = count × 3.14159265358979323846 × d × d × H ÷ 4";

/** The pile cap whose plan and depth the drawing never stated (FOUNDATION_PLAN/DEPTH_UNSTATED). */
function pileCapLine(mark: string): ViewLine {
  return {
    ...aLine({
      lineId: `line-${mark}`,
      objectKey: objectKeyOf(mark, "FOUNDATION"),
      class: "pile_cap",
      level: "FOUNDATION",
      value: null,
      coverage: "PARTIAL_DECLARED",
      formula: "V = count × L × B × D",
      sourceKey: `S-06:t:${mark}`,
    }),
    omitted: [
      { variable: "L", code: "FOUNDATION_PLAN_UNSTATED" },
      { variable: "B", code: "FOUNDATION_PLAN_UNSTATED" },
      { variable: "D", code: "FOUNDATION_DEPTH_UNSTATED" },
    ],
  } as ViewLine;
}

describe("the register states every figure it has, and says why of every figure it has not", () => {
  test("I-reg-1: a PARTIAL_DECLARED line names what it left out in its Value cell, and wears no 0% chip", async () => {
    const line = pileCapLine("P1");
    const root = await mountRegister(aView({ objects: [anObject({ mark: "P1", level: "FOUNDATION", class: "pile_cap" })], lines: [line] }));
    const [row] = lineRows(root);
    const cells = cellsOf(row as HTMLElement);
    expect(cells[1], "the Value cell says which components the drawing did not state").toBe("L, B, D unstated");
    expect(row?.querySelector('[data-testid="quantity-text"]'), "and states no figure — never a zero").toBeNull();
    expect(row?.querySelector(testIdSelector(TESTIDS.coverage.chip)), "no coverage percentage is painted for a share nobody measured").toBeNull();
    expect(cells[4], "the coverage is still said, in words").toContain("Partial declared");
  });

  test("I-reg-1: the inspector enumerates every omitted component with its registered sentence", async () => {
    const line = pileCapLine("P1");
    const root = await mountRegister(aView({ objects: [anObject({ mark: "P1", level: "FOUNDATION", class: "pile_cap" })], lines: [line] }));
    await userEvent.setup().click(lineRows(root)[0] as HTMLElement);
    const inspector = one(root, "register-inspector");
    const omissions = [...inspector.querySelectorAll(".cx-register-omission")].map((node) => ({ variable: node.getAttribute("data-variable"), code: node.getAttribute("data-code") }));
    expect(omissions, "L-QTY-02: every omitted component, in the line's own order").toEqual([
      { variable: "L", code: "FOUNDATION_PLAN_UNSTATED" },
      { variable: "B", code: "FOUNDATION_PLAN_UNSTATED" },
      { variable: "D", code: "FOUNDATION_DEPTH_UNSTATED" },
    ]);
    for (const node of inspector.querySelectorAll(".cx-register-omission")) {
      expect(text(node), "each is said by the registry's sentence, never its code").not.toMatch(/[A-Z]+_[A-Z_]+/u);
    }
  });

  test("I-reg-2: a figure's face is its kind's display precision, and data-value keeps the exact decimal — row and footer alike", async () => {
    const line = aLine({ lineId: "line-C7", objectKey: objectKeyOf("C7"), value: C7_VALUE, formula: PI_FORMULA });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C7" })], lines: [line] }));
    const figure = (lineRows(root)[0] as HTMLElement).querySelector('[data-testid="quantity-text"]') as HTMLElement;
    expect(figure.getAttribute("data-value"), "the exact published value stays on the element (L-QTY-03)").toBe(C7_VALUE);
    expect(text(figure), "the face states rcc.concrete at the three places the catalogue writes it to").toBe("0.533");

    const total = one(root, "register-lines").querySelector(`${testIdSelector(TESTIDS.datatable.total)} [data-testid="quantity-text"]`) as HTMLElement;
    expect(total.getAttribute("data-value"), "the footer keeps the visible set's exact sum (B-07; J-000 reads it here)").toBe(C7_VALUE);
    expect(text(total), "and states it at the kinds' display precision, with its unit beside it").toBe("0.533m3");
  });

  test("I-reg-2: a long constant is cut on the formula's face and stands whole in the inspector", async () => {
    const line = aLine({ lineId: "line-C7", objectKey: objectKeyOf("C7"), value: C7_VALUE, formula: PI_FORMULA });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C7" })], lines: [line] }));
    const row = lineRows(root)[0] as HTMLElement;
    expect(cellsOf(row)[6], "the one-line face").toBe("V = count × 3.141592… × d × d × H ÷ 4");
    await userEvent.setup().click(row);
    expect(text(one(root, "register-inspector")), "the formula whole, where it is audited").toContain(PI_FORMULA);
  });

  test("I-reg-2: marks read in natural order, and a class and a level slot are said in words", async () => {
    const marks = ["P10", "P1", "P2", "P19", "P20"];
    const root = await mountRegister(
      aView({
        objects: marks.map((mark) => anObject({ mark, level: "FOUNDATION", class: "pile_cap" })),
        lines: marks.map((mark) => pileCapLine(mark)),
      }),
    );
    const labels = treeItems(root).map((item) => (item.textContent ?? "").split("\n")[0]?.trim() ?? "");
    const objectLabels = labels.filter((label) => marks.includes(label));
    expect(objectLabels, "P1, P2 … P10 — never P10 before P1").toEqual(["P1", "P2", "P10", "P19", "P20"]);
    // The fixture's own reader asserts exactly one treeitem carries each label (the slot, the class).
    expect(treeItem(root, "Foundation").contains(treeItem(root, inWords("pile_cap"))), "the slot and the class are words, nested").toBe(true);
    expect(all(root, "register-lines")[0]?.textContent ?? "", "the group row reads `Foundation · Pile cap`").toContain("Foundation · Pile cap");
  });
});
