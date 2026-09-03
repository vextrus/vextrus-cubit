/**
 * AC-6(a)(b): the two data stylesheet rows — a dead border and a drag style that also paints on
 * keyboard focus.
 *
 * A stylesheet is read as rule blocks (balanced braces, selector matched exactly) rather than
 * grepped: `border-bottom` appears in half a dozen rules of this file, and "the filter row declares
 * none" is a statement about one block. Nothing here asserts a colour or a token value — the paint
 * itself is J-004's baseline (R-UI-011).
 */
import { describe, expect, test } from "vitest";
import { sourceOf } from "../../../src/core/__tests__/support/read-source";
import { cssRules, declarationParts, rulesFor } from "./support/sources";

const DATA_CSS = "src/ui/primitives/data/data.css";
const FILTER_ROW = ".cx-table-filters";
const ACTIVE_HANDLE_LINE = '.cx-resizable-handle[data-resize-handle-active="pointer"] .cx-resizable-line';

const stylesheet = (): string => sourceOf(DATA_CSS, "AC-6 judges the data primitives' stylesheet");

describe("AC-6a: the filter row declares no bottom border", () => {
  test("AC-6a: .cx-table-filters carries no border-bottom", () => {
    const blocks = rulesFor(stylesheet(), FILTER_ROW);
    expect(blocks.length, `${FILTER_ROW} is a rule of the stylesheet — it gives the filter row its own height`).toBe(1);

    const bordered = (blocks[0]?.declarations ?? []).filter((declaration) => /^border(-bottom)?\b/.test(declarationParts(declaration).property));
    expect(bordered, "the header rule already draws the divider: a second, outranked border-bottom is dead weight").toEqual([]);
  });
});

describe("AC-6b: the dragging style is scoped to a pointer drag", () => {
  test("AC-6b: no rule selects the resize handle's active state without naming which one", () => {
    const bare = cssRules(stylesheet())
      .map((rule) => rule.selector)
      .filter((selector) => /\[data-resize-handle-active\]/.test(selector));
    expect(bare, "keyboard focus sets the same attribute, so an unqualified selector paints the drag style on a keystroke").toEqual([]);
  });

  test("AC-6b: the active line is painted for a pointer drag", () => {
    const blocks = rulesFor(stylesheet(), ACTIVE_HANDLE_LINE);
    expect(blocks.length, "the handle still shows a drag in progress — for the drag it is").toBe(1);
    expect(blocks[0]?.declarations.length, "the rule still declares the line's drag appearance").toBeGreaterThan(0);
  });
});
