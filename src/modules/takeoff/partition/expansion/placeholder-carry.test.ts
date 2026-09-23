// I-366: a placeholder a single-level plan registered under the caption's own word is carried onto the
// row the ONE resolver derives for its member once the storey stands — read by the resolver's storey
// reading (`1ST` is `1F`), never by letters — and never stood beside it; and I-367: it is carried onto
// nothing the resolver does not derive, nor onto a key already standing.
import { describe, expect, test } from "vitest";
import { dotlessUpper, viewKey, type ViewRef } from "@/core/identity";
import type { PlacementRow } from "../placement/rows";
import { VIEW_TYPE } from "../views/law";
import { placeholderCarries, resolveExpansion, type ExpansionRow, type FamilyBands, type StackedLevel, type StandingPlaceholder } from "./resolve";

/** A single-level beam layout, captioned as F-RCC6-BNBC's S-13 is: the storey in ordinal words. */
const PLAN: ViewRef = { viewClass: VIEW_TYPE.LAYOUT_PLAN, captionAnchorSourceKey: "DXF_HANDLE:2116" };
const CAPTION = "1ST FLOOR BEAM LAYOUT  SCALE 1:100";

/** The stack a person inserts, spelled the way the section's marks spell it. */
const STACK: readonly StackedLevel[] = [
  { levelId: "level-gf", label: "GF", ordinal: 0 },
  { levelId: "level-1f", label: "1F", ordinal: 1 },
  { levelId: "level-2f", label: "2F", ordinal: 2 },
];

/** One beam placement of that plan. */
function beam(mark: string, x: number, family: string | null = null): PlacementRow {
  return {
    viewKey: viewKey(PLAN),
    view: PLAN,
    placementKey: `${viewKey(PLAN)}|${mark}|${x}`,
    mark,
    markText: mark,
    elementType: "beam",
    x,
    y: 0,
    gridLetter: "A",
    gridNumeral: "1",
    outlineKey: `o${x}`,
    markKey: `m${x}`,
    memberFamily: family,
    note: null,
  };
}

/** What the resolver answers for these placements over a stack. */
function resolved(placements: readonly PlacementRow[], levels: readonly StackedLevel[], families: readonly FamilyBands[] = []): readonly ExpansionRow[] {
  return resolveExpansion({ placements, views: [{ caption: CAPTION, view: PLAN }], levels, ranges: [], families }).rows;
}

/** The rows a pin with no stack registered, as the register then holds them: under the caption's word. */
function placeholdersOf(rows: readonly ExpansionRow[]): StandingPlaceholder[] {
  return rows.flatMap((row) => ("unregistered" in row.level ? [{ objectKey: row.objectKey, label: row.level.unregistered, standing: row.standing }] : []));
}

const BEAMS = [beam("B1", 0), beam("B2", 4000), beam("B3", 8000)];

describe("I-366: a placeholder is retired onto the row the resolver derives for it, by the resolver's own storey reading", () => {
  test("the plan's word 1ST places on the stack's 1F: every placeholder is carried onto exactly its member's 1F row", () => {
    const pinned = placeholdersOf(resolved(BEAMS, []));
    expect(pinned.map((one) => one.label), "with no stack, the three beams wait under the caption's own word").toEqual(["1ST", "1ST", "1ST"]);
    expect(STACK.some((level) => dotlessUpper(level.label) === dotlessUpper("1ST")), "and the comparison form alone finds no level for it — the cause").toBe(false);

    const rows = resolved(BEAMS, STACK);
    const carries = placeholderCarries(rows, pinned, STACK);
    expect(carries.map((carry) => carry.levelId), "each onto 1F").toEqual(["level-1f", "level-1f", "level-1f"]);
    expect(new Set(carries.map((carry) => carry.row.objectKey)), "onto the very rows the resolver derives — one hop, so the rebuild finds them standing").toEqual(new Set(rows.map((row) => row.objectKey)));
    for (const carry of carries) expect(carry.row.placement.placementKey, "each onto its OWN member's row").toBe(beam(carry.row.placement.mark, carry.row.placement.x).placementKey);
  });

  test("a stack that carries no level of that storey retires nothing — the placeholder waits, as L-REG-04 says it does", () => {
    const pinned = placeholdersOf(resolved(BEAMS, []));
    const fdnOnly: readonly StackedLevel[] = [{ levelId: "level-fdn", label: "FDN", ordinal: -1 }];
    expect(placeholderCarries(resolved(BEAMS, fdnOnly), pinned, fdnOnly), "FDN is no storey 1ST names").toEqual([]);
  });

  test("I-367: a member its band keeps off the storey is carried onto nothing — never measured where no drawing put it", () => {
    const pinned = placeholdersOf(resolved([...BEAMS, beam("RB1", 12000, "RB1")], []));
    // RB1's schedule bands it 2F TO 2F: the resolver stands it on no level of a 1ST plan.
    const rows = resolved([...BEAMS, beam("RB1", 12000, "RB1")], STACK, [{ family: "RB1", bands: [{ from: "2F", to: "2F" }] }]);
    expect(rows.some((row) => row.placement.mark === "RB1"), "the band cuts RB1 off the plan's one storey").toBe(false);
    const carries = placeholderCarries(rows, pinned, STACK);
    expect(carries.map((carry) => carry.row.placement.mark).sort(), "the three it keeps are carried; RB1 keeps its placeholder").toEqual(["B1", "B2", "B3"]);
  });

  test("I-367: never onto a key already standing, and never across a standing it would have to rewrite", () => {
    const pinned = placeholdersOf(resolved(BEAMS, []));
    const rows = resolved(BEAMS, STACK);
    const taken = rows[0] as ExpansionRow;
    const carries = placeholderCarries(rows, pinned, STACK, new Set([taken.objectKey]));
    expect(carries.map((carry) => carry.row.objectKey), "a row already standing IS that sighting: nothing is carried onto it (L-REG-03)").not.toContain(taken.objectKey);
    expect(carries.length, "the other two carry").toBe(2);

    const derivedOnly = pinned.map((one) => ({ ...one, standing: "DERIVED" as const }));
    expect(placeholderCarries(rows, derivedOnly, STACK), "the carry moves the level and nothing else about the sighting").toEqual([]);
  });

  test("one row retires one placeholder, and the answer does not depend on the order the evidence arrives in", () => {
    const rows = resolved(BEAMS, STACK);
    const pinned = placeholdersOf(resolved(BEAMS, []));
    // The same member under a second spelling of the word — two placeholders, one storey, one row.
    const twice = [...pinned, ...pinned.map((one) => ({ ...one, objectKey: one.objectKey.replace("@unregistered:1ST", "@unregistered:1st"), label: "1st" }))];
    const carries = placeholderCarries(rows, twice, STACK);
    expect(carries.length, "three members, three rows, three carries — the second spelling of each waits").toBe(3);
    expect(placeholderCarries([...rows].reverse(), [...twice].reverse(), [...STACK].reverse()), "one evidence, one answer (AC-8)").toEqual(carries);
  });
});
