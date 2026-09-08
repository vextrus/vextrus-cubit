/**
 * AC-1 — L-CAD-06's vocabulary, its sole predicate and its yield rule, in one module.
 *
 * The roster and its ORDER are pinned here because the criterion is what defines them: L-CAD-06
 * names the eleven view types in this order and closes the list, so a member added, dropped or moved
 * is a change to the law rather than to a snapshot (B-19 pins a total to the thing that defines it).
 * Everything else is derived from that roster — the record's keys, the predicate's true cases, and
 * the ten types that yield no instance are all read off `VIEW_TYPES` rather than typed again.
 *
 * The scanner half of AC-1 lives where the criterion puts it: the committed test beside the scanner,
 * `src/modules/takeoff/partition/views/__tests__/view-type-literals.test.ts`, which runs it over
 * `src/**` and over the declared lint-fixture corpus. This file grades the law itself.
 */
import { describe, expect, test } from "vitest";
import { viewsLaw, type ViewsLaw } from "./support/partition-stage";

/**
 * The vocabulary, in the Bible's own order: layout plan · schedule · long-section strip · member
 * section · detail · stair plan · stair section · legend/notes · title · untyped · unassigned.
 * Spelled UPPER_SNAKE (settled): the kebab alternative collides with literals already in `src/**`,
 * which would make the ban scan unpassable.
 */
const ROSTER = [
  "LAYOUT_PLAN",
  "SCHEDULE",
  "LONG_SECTION_STRIP",
  "MEMBER_SECTION",
  "DETAIL",
  "STAIR_PLAN",
  "STAIR_SECTION",
  "LEGEND_NOTES",
  "TITLE",
  "UNTYPED",
  "UNASSIGNED",
];

/** The one member that may yield instances (L-CAD-06: only layout-plan-class views). */
const YIELDS = "LAYOUT_PLAN";

/** Values that look like a member without being one — the predicate's whole point. */
const NOT_MEMBERS: unknown[] = ["layout-plan", "Layout Plan", "", 3, null];

let law: Promise<ViewsLaw> | undefined;
const held = (): Promise<ViewsLaw> => (law ??= viewsLaw());

describe("AC-1: the closed branded vocabulary has one home", () => {
  test("AC-1: VIEW_TYPES is the eleven members, in the Bible's order, frozen", async () => {
    const { VIEW_TYPES } = await held();
    expect([...VIEW_TYPES], "L-CAD-06 closes the view-type vocabulary and states its order").toEqual(ROSTER);
    expect(Object.isFrozen(VIEW_TYPES), "a roster a caller can push onto is not a closed vocabulary").toBe(true);
  });

  test("AC-1: VIEW_TYPE is a frozen record mapping each spelling to its own branded member", async () => {
    const { VIEW_TYPE, VIEW_TYPES } = await held();
    expect(Object.keys(VIEW_TYPE).sort(), "the record names exactly the roster — no more, no fewer").toEqual([...VIEW_TYPES].sort());
    for (const member of VIEW_TYPES) {
      expect(VIEW_TYPE[member], `VIEW_TYPE.${member} is the member itself — the record is how a caller obtains one`).toBe(member);
    }
    expect(Object.isFrozen(VIEW_TYPE), "a record a caller can add a twelfth member to is not the closed vocabulary").toBe(true);
  });

  test("AC-1: isViewType is the sole membership predicate, and it is exact", async () => {
    const { isViewType, VIEW_TYPES } = await held();
    for (const member of VIEW_TYPES) {
      expect(isViewType(member), `${member} is a member of the vocabulary`).toBe(true);
    }
    for (const impostor of NOT_MEMBERS) {
      expect(isViewType(impostor), `${JSON.stringify(impostor)} is not a view type — a predicate that admits it admits anything`).toBe(false);
    }
  });

  test("AC-1: yieldsInstances is true for the layout plan alone", async () => {
    const { yieldsInstances, VIEW_TYPES } = await held();
    expect(yieldsInstances(YIELDS), "only layout-plan-class views may yield instances (L-CAD-06)").toBe(true);
    const yielding = VIEW_TYPES.filter((member) => member !== YIELDS).filter((member) => yieldsInstances(member));
    expect(yielding, "schedules, sections and details yield types and dimensions only — never an instance").toEqual([]);
  });
});
