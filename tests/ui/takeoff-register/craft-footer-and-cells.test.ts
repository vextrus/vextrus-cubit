// @vitest-environment jsdom
/**
 * s-takeoff I-350 — the register a quantity surveyor can demo from (session 7's re-look):
 *
 * - the sticky footer states EVERY unit's total on its face, in the order the units first appear —
 *   never the last unit alone with the rest pushed off the Value cell's left edge and left to a
 *   Tooltip (§5 rule 1, B-07, I-reg-2);
 * - a composed cell (a chip and a word) is the line's inline text, so the table's own ellipsis ends
 *   the word and the table's own Tooltip states it whole, and the selecting basis reads as the chip's
 *   qualifier (R-UI-083, s-takeoff-register §1);
 * - the Source link is placed in its cell no wider than the cell, its label ending in an ellipsis.
 *
 * The DOM half is mounted over the shipped chrome exactly as the route binds it (I-170). The layout
 * half is a stylesheet fact — jsdom lays nothing out — so it is read from the sheet the screen is drawn
 * by, through the reader the craft rubric's mechanical half uses (`tests/support/stylesheet.ts`).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { declaredValue } from "../../support/stylesheet";
import { aLine, aView, anObject, lineRows, mountRegister, objectKeyOf, one, text } from "./support/fixtures";

afterEach(() => {
  cleanup();
});

// Resolved from this file's own path: under jsdom the global `URL` is the DOM's, which Node's
// `fileURLToPath` does not take.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SHEET = readFileSync(join(REPO_ROOT, "src/app/(app)/t/[tenant]/p/[project]/takeoff/register/register.css"), "utf8");

/** One bored pile of F-RCC6-BNBC as the register holds it: counted, bored, and cast. */
function pileLines(mark: string) {
  const objectKey = objectKeyOf(mark, "FOUNDATION");
  const at = { objectKey, class: "pile", level: "FOUNDATION" } as const;
  return [
    aLine({ ...at, lineId: `line-${mark}-count`, kind: "piling.bored", value: "1", unit: "pcs" }),
    aLine({ ...at, lineId: `line-${mark}-concrete`, kind: "rcc.concrete", value: "4.18879", unit: "m3" }),
    aLine({ ...at, lineId: `line-${mark}-boring`, kind: "piling.boring", value: "21.336", unit: "m" }),
  ];
}

describe("I-350: the footer states every total it has", () => {
  test("three units, three totals on the face, in the order the units first appear — no Tooltip holds the rest", async () => {
    const lines = [...pileLines("P1"), ...pileLines("P2")];
    const root = await mountRegister(aView({ objects: [anObject({ mark: "P1", level: "FOUNDATION", class: "pile" }), anObject({ mark: "P2", level: "FOUNDATION", class: "pile" })], lines }));
    const footer = one(root, "register-lines").querySelector(testIdSelector(TESTIDS.datatable.footer)) as HTMLElement;
    const totals = footer.querySelector(".cx-register-totals") as HTMLElement;
    expect(totals, "the footer carries the register's totals").not.toBeNull();
    expect(totals.getAttribute("data-units"), "one total per unit the visible set adds up in").toBe("3");
    expect(
      totals.parentElement?.getAttribute("data-testid"),
      "the totals are the footer cell's own child — no Tooltip trigger stands between the cell and what it states",
    ).toBe(TESTIDS.datatable.total);

    const figures = [...totals.querySelectorAll<HTMLElement>('[data-testid="quantity-text"]')];
    expect(
      figures.map((figure) => ({ exact: figure.getAttribute("data-value"), face: text(figure) })),
      "each exact sum in data-value (B-07), each face at its kind's precision with its unit beside it, first unit first",
    ).toEqual([
      { exact: "2", face: "2pcs" },
      { exact: "8.37758", face: "8.378m3" },
      { exact: "42.672", face: "42.672m" },
    ]);
  });

  test("the stylesheet lets the list run on across the footer's empty cells instead of off the Value cell's left edge", () => {
    const cell = ".cx-register-lines .cx-table-footercell:has(> .cx-register-totals)";
    expect(declaredValue(SHEET, cell, "justify-content"), "right-aligned while it fits, started under Value when it does not").toBe("safe flex-end");
    expect(declaredValue(SHEET, cell, "overflow"), "the one cell that holds the totals does not cut them").toBe("visible");
    expect(declaredValue(SHEET, ".cx-register-totals", "flex"), "and the list never shrinks to fit").toBe("none");
  });
});

describe("I-350: a composed cell ends in an ellipsis, never a hard slice", () => {
  test("the chip-and-word cells are inline text the table's own ellipsis and Tooltip reach", () => {
    expect(declaredValue(SHEET, ".cx-register-coverage", "display"), "Bases and Coverage are the line's inline text, never one atomic box").toBe("inline");
  });

  test("the selecting basis is marked as the qualifier of the chip beside it", async () => {
    const line = aLine({ quantityBasis: "MEASURED", selectionBasis: "TRANSCRIBED" });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [line] }));
    const row = lineRows(root)[0] as HTMLElement;
    const selecting = row.querySelector(".cx-register-bases > .cx-register-selecting") as HTMLElement;
    expect(selecting, "the word after the chip is the selecting basis").not.toBeNull();
    expect(selecting.getAttribute("data-value"), "the stored basis stays on the label").toBe("TRANSCRIBED");
    // The rule names the cell and the inspector's fact line together; its last selector is the one
    // the reader addresses.
    expect(declaredValue(SHEET, ".cx-register-facts .cx-register-selecting", "color"), "and reads a step quieter").toBe("var(--ink-secondary)");
  });

  test("the Source link is no wider than its cell, and its label is what gives way", () => {
    expect(declaredValue(SHEET, ".cx-register-trace > .cx-evidence-link", "min-width"), "the link may shrink to the cell").toBe("0");
    expect(declaredValue(SHEET, ".cx-register-trace .cx-evidence-link-label", "text-overflow"), "and its label ends in an ellipsis").toBe("ellipsis");
    expect(declaredValue(SHEET, ".cx-register-trace .cx-evidence-link-label", "line-height"), "on a line box the target's own height, so the underline is never clipped").toBe("var(--space-6)");
  });
});
