/**
 * The listbox engine (B-17): what a key press MEANS in a list, decided once for Select and Combobox.
 * Pure in, pure out — so the rule is graded here and the surfaces are graded on wiring.
 */
import { describe, expect, test } from "vitest";
import {
  NO_OPTION,
  filterOptions,
  firstChoosable,
  indexOfValue,
  isTypeAheadKey,
  lastChoosable,
  optionId,
  step,
  typeAhead,
  type ListboxOption,
} from "./listbox";

const OPTIONS: readonly ListboxOption[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie", disabled: true },
  { value: "d", label: "Delta" },
];

describe("the listbox engine", () => {
  test("a disabled option is shown but never landed on", () => {
    expect(step(OPTIONS, 1, 1), "↓ from Bravo skips the disabled Charlie").toBe(3);
    expect(step(OPTIONS, 3, -1), "↑ from Delta skips it in the other direction too").toBe(1);
  });

  test("the cursor does not wrap: holding a direction at the end stays at the end", () => {
    expect(step(OPTIONS, 3, 1)).toBe(3);
    expect(step(OPTIONS, 0, -1)).toBe(0);
  });

  test("with no cursor, ↓ takes the first choosable option and ↑ the last", () => {
    expect(step(OPTIONS, NO_OPTION, 1)).toBe(firstChoosable(OPTIONS));
    expect(step(OPTIONS, NO_OPTION, -1)).toBe(lastChoosable(OPTIONS));
    expect(firstChoosable(OPTIONS)).toBe(0);
    expect(lastChoosable(OPTIONS)).toBe(3);
  });

  test("an all-disabled list has nothing to land on", () => {
    const closed: ListboxOption[] = [{ value: "x", label: "X", disabled: true }];
    expect(firstChoosable(closed)).toBe(NO_OPTION);
    expect(lastChoosable(closed)).toBe(NO_OPTION);
    expect(step(closed, NO_OPTION, 1)).toBe(NO_OPTION);
  });

  test("type-ahead matches the start of a label, case-insensitively, from after the cursor", () => {
    expect(typeAhead(OPTIONS, "b", NO_OPTION)).toBe(1);
    expect(typeAhead(OPTIONS, "DE", NO_OPTION)).toBe(3);
    expect(typeAhead(OPTIONS, "c", NO_OPTION), "a disabled option is not a type-ahead answer").toBe(NO_OPTION);
    expect(typeAhead(OPTIONS, "z", NO_OPTION)).toBe(NO_OPTION);
  });

  test("a repeated letter walks that letter's options rather than sticking on the first", () => {
    const many: ListboxOption[] = [
      { value: "1", label: "Beam" },
      { value: "2", label: "Basis" },
      { value: "3", label: "Coverage" },
    ];
    const first = typeAhead(many, "b", NO_OPTION);
    expect(first).toBe(0);
    expect(typeAhead(many, "bb", first), "pressing b again moves to the next b").toBe(1);
  });

  test("a key is type-ahead only when it is a character a reader meant to type", () => {
    expect(isTypeAheadKey("a")).toBe(true);
    expect(isTypeAheadKey("7")).toBe(true);
    expect(isTypeAheadKey(" "), "space opens and commits — it is a command, not a letter").toBe(false);
    expect(isTypeAheadKey("ArrowDown")).toBe(false);
  });

  test("filtering keeps every option whose label contains the query, and all of them for an empty one", () => {
    expect(filterOptions(OPTIONS, "").length).toBe(4);
    expect(filterOptions(OPTIONS, "a").map((option) => option.value)).toEqual(["a", "b", "c", "d"]);
    expect(filterOptions(OPTIONS, "ra").map((option) => option.value)).toEqual(["b"]);
    expect(filterOptions(OPTIONS, "  BRA ").map((option) => option.value), "the query is trimmed and case-folded").toEqual(["b"]);
  });

  test("a value the list does not hold is not an index", () => {
    expect(indexOfValue(OPTIONS, "d")).toBe(3);
    expect(indexOfValue(OPTIONS, "nothing")).toBe(NO_OPTION);
  });

  test("an option's id names its listbox and its position, so aria-activedescendant can point at it", () => {
    expect(optionId("filters-listbox", 2)).toBe("filters-listbox-o2");
  });
});
