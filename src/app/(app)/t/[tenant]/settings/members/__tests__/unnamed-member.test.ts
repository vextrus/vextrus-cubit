// @vitest-environment jsdom
/**
 * A member with no readable address is a FACT the row is handed, not a sentence it recognises.
 *
 * The screen used to decide whether it was looking at an unnamed member by comparing the rendered
 * label against the string table. That makes copy load-bearing twice over: change the sentence in
 * the Decision and the accessible names silently stop being disambiguated, and an account whose
 * address happens to read like that sentence is renamed by the comparison. The absence travels as
 * `label: null` instead, and the copy is only ever what is shown (B-17, B-19, R-UI-012).
 *
 * `.ts` rather than `.tsx`: tsconfig includes `src/**\/*.ts`, so `tsc` reads this file too, and the
 * section is built with `createElement` (the `members-section-refusal` precedent).
 */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { fill } from "../../../../../../../ui/strings";
import { MembersSection, type MembersRow } from "../members-section";
import { membersStrings } from "../strings";

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const NAMELESS = "bbbbbbbb-1111-4222-8333-444444444444";
const ALSO_NAMELESS = "cccccccc-1111-4222-8333-444444444444";
/** An account whose stored address happens to read exactly like the copy for one that has none. */
const NAMED_LIKE_THE_COPY = "dddddddd-1111-4222-8333-444444444444";

const ROWS: readonly MembersRow[] = [
  { userId: NAMELESS, label: null, role: "MEMBER", history: [] },
  { userId: ALSO_NAMELESS, label: null, role: "MEMBER", history: [] },
  { userId: NAMED_LIKE_THE_COPY, label: membersStrings.members_member_unnamed, role: "MEMBER", history: [] },
];

/** The section, mounted over a settlement that is never reached: nothing here submits anything. */
function mount(): void {
  const never = async (): Promise<never> => {
    throw new Error("no move is made in these cases");
  };
  render(
    createElement(MembersSection, {
      tenantId: TENANT,
      rows: ROWS,
      roles: ["OWNER", "ADMIN", "MEMBER"],
      changeRole: never as never,
      remove: never as never,
    }),
  );
}

/** The row for one member, by the id it carries. */
function rowFor(userId: string): HTMLElement {
  const found = screen.getAllByTestId("members-row").find((row) => row.getAttribute("data-user") === userId);
  expect(found, `the roster holds a row for ${userId}`).toBeDefined();
  return found as HTMLElement;
}

/** Every accessible name the controls of one row are spoken under. */
const controlNames = (row: HTMLElement): string[] => [...row.querySelectorAll("[aria-label]")].map((control) => control.getAttribute("aria-label") ?? "");

afterEach(() => {
  cleanup();
});

test("a member with no stored address is SHOWN as an unnamed member", () => {
  mount();

  expect(rowFor(NAMELESS).textContent, "the row says what it knows: this account has no address to show").toContain(membersStrings.members_member_unnamed);
});

test("two of them are told apart by their controls, each named with its own id", () => {
  mount();

  const first = fill(membersStrings.members_member_unnamed_identified, { id: NAMELESS });
  const second = fill(membersStrings.members_member_unnamed_identified, { id: ALSO_NAMELESS });

  expect(controlNames(rowFor(NAMELESS)).every((name) => name.includes(NAMELESS)), `every control of the first row is spoken as ${first}`).toBe(true);
  expect(controlNames(rowFor(ALSO_NAMELESS)).every((name) => name.includes(ALSO_NAMELESS)), `and the second's as ${second}`).toBe(true);
  expect(controlNames(rowFor(NAMELESS)).length, "the row's controls are named at all").toBeGreaterThan(0);
});

test("an account whose address reads like the copy is still named by its address", () => {
  mount();

  const spoken = controlNames(rowFor(NAMED_LIKE_THE_COPY));
  expect(spoken.length, "the row's controls are named").toBeGreaterThan(0);
  expect(
    spoken.some((name) => name.includes(NAMED_LIKE_THE_COPY)),
    "an address is an address: a member who has one is never renamed by what the copy for a member without one happens to say",
  ).toBe(false);
});
