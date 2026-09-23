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
import { cleanup, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import { declaredValue } from "../../support/stylesheet";
import { aLine, aView, anObject, copy, lineRows, mountRegister, objectKeyOf, one, takeoffStrings, text, textNodesUnder } from "./support/fixtures";

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

/**
 * s-takeoff I-466 — the basis is said once, and the Bases header names its two halves.
 *
 * On F-RCC6-BNBC's piles both bases are TRANSCRIBED, and the cell read "▣ Transcribed Transcribed",
 * the second copy clipped at 184 px (the re-look's D5). The selecting basis is said beside the chip
 * only where it adds a fact — where it differs — and both stored values stay on the cell. The header
 * carries the sentence that says which half is which (§8's "The Bases pair names neither half").
 */
describe("I-466: one basis word where the two agree, and a header that names the pair", () => {
  /** The words a reader sees in one element: every text node outside a technical disclosure and the glyph. */
  const faceOf = (node: HTMLElement): string => textNodesUnder(node, (held) => held.hasAttribute("data-technical") || held.getAttribute("aria-hidden") === "true").join(" ");

  test("where the two bases agree the chip says the word once; where they differ the selecting basis stands beside it", async () => {
    const pile = aLine({ lineId: "line-P1", objectKey: objectKeyOf("P1"), sourceKey: "S-05:t:P1", quantityBasis: "TRANSCRIBED", selectionBasis: "TRANSCRIBED" });
    const column = aLine({ lineId: "line-C1", objectKey: objectKeyOf("C1"), sourceKey: "S-10:t:C1", quantityBasis: "TRANSCRIBED", selectionBasis: "DEFAULTED" });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "P1" }), anObject({ mark: "C1" })], lines: [pile, column] }));
    const pairOf = (lineId: string): HTMLElement => lineRows(root).find((row) => row.getAttribute("data-line") === lineId)?.querySelector(".cx-register-bases") as HTMLElement;

    const agreed = pairOf(pile.lineId);
    expect(agreed.querySelector(".cx-register-selecting"), "no second word stands beside a chip that already says it").toBeNull();
    expect(faceOf(agreed).split("Transcribed").length - 1, "the pile says `Transcribed` once").toBe(1);
    expect([agreed.getAttribute("data-quantity-basis"), agreed.getAttribute("data-selection-basis")], "and both stored halves stay on the cell").toEqual(["TRANSCRIBED", "TRANSCRIBED"]);

    const differing = pairOf(column.lineId);
    expect(differing.querySelector(".cx-register-selecting")?.getAttribute("data-value"), "a selecting basis that differs is said beside the chip").toBe("DEFAULTED");
    expect(faceOf(differing), "the chip's word, then the qualifier's").toBe("Transcribed Defaulted");
  });

  test("the inspector's Bases row says an agreeing pair once too", async () => {
    const pile = aLine({ lineId: "line-P1", objectKey: objectKeyOf("P1"), quantityBasis: "TRANSCRIBED", selectionBasis: "TRANSCRIBED" });
    const root = await mountRegister(aView({ objects: [anObject({ mark: "P1" })], lines: [pile] }));
    await userEvent.setup().click(lineRows(root)[0] as HTMLElement);
    const row = one(root, "register-inspector").querySelector("dd[data-basis]") as HTMLElement;
    expect(row.querySelector(".cx-register-selecting"), "no second word beside the chip").toBeNull();
    expect(row.getAttribute("data-selection-basis"), "and the selecting basis still stands on the row").toBe("TRANSCRIBED");
  });

  test("the Bases header states its hint as its Tooltip, opened from the keyboard as from the pointer", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [aLine()] }));
    const header = [...one(root, "register-lines").querySelectorAll<HTMLElement>('[role="columnheader"]')].find((cell) => text(cell) === copy(strings, "takeoff_register_col_bases"));
    expect(header, "the Bases header still reads its one word").toBeDefined();
    const trigger = (header as HTMLElement).querySelector<HTMLElement>(".cx-register-hinted");
    expect(trigger?.getAttribute("tabindex"), "its word is a trigger the keyboard reaches (R-UI-012)").toBe("0");
    fireEvent.focus(trigger as HTMLElement);
    const hint = await screen.findByTestId(TESTIDS.tooltip.content);
    expect(hint.textContent, "and it says which half of the pair is which, in the string table's own words").toContain(copy(strings, "takeoff_register_bases_hint"));
    fireEvent.blur(trigger as HTMLElement);
  });
});

/**
 * s-takeoff I-472 — the composed Bases header is still named "Bases" where no header is drawn.
 *
 * I-466 made the header a word inside its Tooltip trigger, and the table names a column by its
 * header only when the header is a string: the column drawer listed the column as `bases`, a code in
 * front of a reader (R-UI-082), and the resize handle was `Resize bases`. The column states its words.
 */
describe("I-472: the column drawer and the resize handle read the Bases column's words", () => {
  test("the drawer lists `Bases`, and the resize handle is named by it — never the column id", async () => {
    const strings = await takeoffStrings();
    const bases = copy(strings, "takeoff_register_col_bases");
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [aLine()] }));
    const lines = one(root, "register-lines");
    await userEvent.setup().click(lines.querySelector(testIdSelector(TESTIDS.datatable.columnsToggle)) as HTMLElement);
    const toggle = lines.querySelector('[data-testid="datatable-column-toggle-bases"]');
    expect(toggle, "the drawer lists the Bases column").not.toBeNull();
    expect(text(toggle?.closest("label") as HTMLElement), "by the string table's word, as the header draws it").toBe(bases);
    const resize = lines.querySelector('[data-testid="datatable-resize-bases"]');
    expect(resize?.getAttribute("aria-label"), "the resize handle is named by the same word").toContain(bases);
    expect(resize?.getAttribute("aria-label"), "and not by the id").not.toMatch(/\bbases\b/u);
  });
});

/**
 * s-takeoff I-468 — the Source column is read at the width its chip is measured at.
 *
 * `S-10 · C1 · Layout plan` measured 177 px in the product's Chromium (Spline Sans Mono at 12 px, the
 * basis glyph and its gap) and 191 px with a four-character mark; with the compact cell's 16 px of
 * padding the column wants 207. At 168 the chip ended `S-10 · C1 · Layou…`. The 40 px come from the
 * two derivation columns the inspector states whole, so the eight still fit the 1,088 px grid at 1440
 * and everything through Source stands whole in the 928 px grid at 1280.
 */
describe("I-468: the Source column holds the chip a reader reads", () => {
  test("Source is 208 px, taken from Formula and Variables, and the eight columns still sum to 1,064", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister(aView({ objects: [anObject({ mark: "C1" })], lines: [aLine()] }));
    const widths = Object.fromEntries(
      [...one(root, "register-lines").querySelectorAll<HTMLElement>('[role="columnheader"]')].map((cell) => [text(cell), Number.parseInt(cell.style.width, 10)]),
    );
    expect(widths[copy(strings, "takeoff_register_col_source")], "the chip's measured 207 px, on the 4 px grid").toBe(208);
    expect(widths[copy(strings, "takeoff_register_col_formula")], "the formula's face, whole in the inspector").toBe(132);
    expect(widths[copy(strings, "takeoff_register_col_variables")], "the variables' face, whole in the inspector").toBe(120);
    // I-reg-3 wrote the sum as 1,068; its own eight widths add to 1,064, and so do these.
    expect(
      Object.values(widths).reduce((sum, width) => sum + width, 0),
      "the eight columns inside the 1,088 px grid at 1440, as wide together as I-reg-3 left them",
    ).toBe(1064);
  });
});

/**
 * s-takeoff I-469 — a rail heading is one line, and the rail is not a word a reader meets.
 */
describe("I-469: the rail's headings stand on one line", () => {
  test("a rail heading never wraps: it ends in an ellipsis where it would", () => {
    expect(declaredValue(SHEET, ".cx-register-panel-heading", "white-space"), "one line").toBe("nowrap");
    expect(declaredValue(SHEET, ".cx-register-panel-heading", "text-overflow"), "ended in an ellipsis where it would outgrow the rail").toBe("ellipsis");
    expect(declaredValue(SHEET, ".cx-register-panel-heading", "overflow"), "the clip the ellipsis needs").toBe("hidden");
    // A clipped flex item has no automatic minimum height: in the rail's scrolling column the heading
    // shrank to 17 px, its top half cut, until it was told not to shrink.
    expect(declaredValue(SHEET, ".cx-register-panel-heading", "flex"), "and it never shrinks in the rail's column").toBe("none");
  });

  test("the level-stack offer stands in rows in the rail: the sentence, the count, then the door at its own width", () => {
    // The pattern's one-row group put the sentence one word to a line in the 214 px rail (walk-0).
    expect(declaredValue(SHEET, ".cx-register-level-stack .cx-offered-group", "grid-template-columns"), "one column, one fact to a row").toBe("minmax(0, 1fr)");
    expect(declaredValue(SHEET, ".cx-register-level-stack .cx-offered-group", "justify-items"), "each at its own width — the door is never a full-width bar").toBe("start");
    expect(declaredValue(SHEET, ".cx-register-level-stack .cx-offered-count", "text-align"), "the count reads from the start, under the sentence").toBe("start");
  });

  test("no sentence of the register's table says `rail` — the product's own build word", async () => {
    const strings = await takeoffStrings();
    const said = Object.entries(strings).filter(([key, value]) => key.startsWith("takeoff_register_") && /\brails?\b/iu.test(value));
    expect(said, "a reader meets the register, the drawings and the lines, never the machinery that reads them (§3's voice)").toEqual([]);
  });
});
