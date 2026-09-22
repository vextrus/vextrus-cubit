// D-001 at the stage that reads it: a section that states its storeys in two notations proposes each
// storey ONCE, and reads its height once PER NOTATION — two marks of one notation, never a metric mark
// less an imperial one. An imperial mark names no storey, so it is bound to the storey the section
// DRAWS it beside, off the section's own geometry.
//
// Every geometry below is drawn here, at the offsets F-RCC6-BNBC's S-25 draws at (the metric mark on
// the level line, the imperial one 180 units above it, a storey of 3352.8 then 3048); the artifact
// itself is read in tests/takeoff/partition/levels-two-notations.test.ts (B-19).
import { describe, expect, test } from "vitest";
import type { EntityGraph } from "@/core/entitygraph/schema";
import type { PartitionedView } from "../views/assign";
import { VIEW_TYPE } from "../views/law";
import { proposeLevelStack, type ProposedLevelRow } from "./propose";

const SECTION = "MEMBER_SECTION:S-25";

/** One text of the section: what it says and how far up the sheet it was drawn. */
type Drawn = { readonly key: string; readonly said: string; readonly y: number };

/** The stack a section's drawn texts propose, from the foot up. */
function stackOf(texts: readonly Drawn[]): ProposedLevelRow[] {
  const entities = texts.map((text) => ({
    key: text.key,
    type: "TEXT",
    space: "model",
    layer: "Text-1",
    colour: { rgb: [0, 0, 0], source: "bylayer" },
    text: text.said,
    height: 240,
    points: [[598000, text.y]],
  }));
  const view = { viewKey: SECTION, type: VIEW_TYPE.MEMBER_SECTION, reason: null, caption: "SECTION A-A", anchorKey: null } as PartitionedView;
  return [...proposeLevelStack({ graph: { entities } as unknown as EntityGraph, views: [view], assignments: new Map(entities.map((entity) => [entity.key, SECTION])) }).levels];
}

/** S-25's own storeys: the level lines up the sheet, 3352.8 for the ground storey and 3048 above it. */
const GF_Y = 0;
const ONE_F_Y = 3352.8;
const TWO_F_Y = 6400.8;

/** Where S-25 writes its imperial figure: 180 above the level line its metric mark stands on. */
const BESIDE = 180;

/** The section as S-25 draws it — metric storey marks, and the imperial marks beside them. */
const S25: readonly Drawn[] = [
  { key: "m:gf", said: "GF EL +0.000", y: GF_Y },
  { key: "m:1f", said: "1F EL +3.353", y: ONE_F_Y },
  { key: "m:2f", said: "2F EL +6.401", y: TWO_F_Y },
  { key: "i:pl", said: `P.L= +0'-0"`, y: GF_Y + BESIDE },
  { key: "i:egl", said: `E.G.L (-1'-6")`, y: GF_Y - 734.4 },
  { key: "i:1f", said: `EL +11'-0"`, y: ONE_F_Y + BESIDE },
  { key: "i:bare", said: "+3.353", y: ONE_F_Y - 620 },
];

describe("D-001: a section that states its storeys in two notations", () => {
  test("proposes each storey once, and reads the ground storey's height again in feet and inches", () => {
    const stack = stackOf(S25);
    expect(stack.map((level) => level.label), "the imperial marks name no storey: the stack is the metric marks', once each (T-NOT-LEVEL)").toEqual(["GF", "1F", "2F"]);
    expect(stack.map((level) => level.markKey)).toEqual(["m:gf", "m:1f", "m:2f"]);
    expect(stack.map((level) => level.heightAsWritten), "the metric marks write no unit, so the metric heights stay a person's to transcribe (B-07)").toEqual([null, null, null]);
    expect(
      stack[0]?.otherNotation,
      "P.L= +0'-0\" is drawn beside GF and EL +11'-0\" beside 1F: GF's height in feet and inches is 11'-0\", in inches, citing GF's OWN imperial mark (L-CAD-03)",
    ).toEqual({ heightAsWritten: "132", heightUnit: "in", markKey: "i:pl", elevation: 0 });
    expect(stack[1]?.otherNotation, "1F has an imperial mark and 2F none, so 1F's height is stated in one notation only — never 6.401 less 11'-0\"").toBeUndefined();
    expect(stack[2]?.otherNotation, "the top of the section states no height in any notation").toBeUndefined();
  });

  test("a height is never mixed across notations: each is the distance between two marks of its own", () => {
    const stack = stackOf([
      { key: "m:gf", said: "GF LVL +0.000 m", y: GF_Y },
      { key: "m:1f", said: "1ST FLOOR LVL +3.353 m", y: ONE_F_Y },
      { key: "m:2f", said: "2ND FLOOR LVL +6.401 m", y: TWO_F_Y },
      { key: "i:gf", said: `EL +0'-0"`, y: GF_Y + BESIDE },
      { key: "i:1f", said: `EL +11'-0"`, y: ONE_F_Y + BESIDE },
      { key: "i:2f", said: `EL +21'-0"`, y: TWO_F_Y + BESIDE },
    ]);
    expect(
      stack.map((level) => ({ metric: level.heightAsWritten, imperial: level.otherNotation?.heightAsWritten ?? null })),
      "1F reads 3.048 m (6.401 − 3.353) and 120 in (21'-0\" − 11'-0\") — a rounded elevation corrupts only its own notation's storey",
    ).toEqual([
      { metric: "3.353", imperial: "132" },
      { metric: "3.048", imperial: "120" },
      { metric: null, imperial: null },
    ]);
  });

  test("the existing ground is the site, never a storey: E.G.L binds to nothing", () => {
    const stack = stackOf([
      { key: "m:gf", said: "GF EL +0.000", y: GF_Y },
      { key: "m:1f", said: "1F EL +3.353", y: ONE_F_Y },
      { key: "i:egl", said: `E.G.L (-1'-6")`, y: GF_Y + BESIDE },
      { key: "i:1f", said: `EL +11'-0"`, y: ONE_F_Y + BESIDE },
    ]);
    expect(stack[0]?.otherNotation, "with the ground level drawn right beside GF, GF still has no imperial mark, so no imperial height (T-NOT-LEVEL: EGL is the SITE fact)").toBeUndefined();
  });

  test("the section's own geometry binds a mark, or nothing does", () => {
    const upsideDown = stackOf(S25.map((text) => ({ ...text, y: -text.y })));
    expect(upsideDown[0]?.otherNotation, "a section whose storey marks do not rise up the sheet states no axis, so nothing is bound by where it was drawn").toBeUndefined();

    const between = stackOf([...S25.filter((text) => text.key !== "i:pl"), { key: "i:mid", said: `EL +0'-0"`, y: ONE_F_Y / 2 }]);
    expect(between[0]?.otherNotation, "a mark exactly between two storeys is beside neither").toBeUndefined();

    const clear = stackOf([...S25.filter((text) => text.key !== "i:pl"), { key: "i:below", said: `EL +0'-0"`, y: GF_Y - ONE_F_Y / 2 - 1 }]);
    expect(clear[0]?.otherNotation, "a mark more than half a storey past the foot of the section marks something other than a storey").toBeUndefined();

    const twice = stackOf([...S25, { key: "i:pl-again", said: `P.L= +1'-0"`, y: GF_Y + BESIDE + 10 }]);
    expect(twice[0]?.otherNotation?.markKey, "a storey two imperial marks are drawn beside keeps the first in the artifact's own order (L-REG-04)").toBe("i:pl");
  });

  test("a pair whose upper figure does not stand above the lower states no height", () => {
    const stack = stackOf([...S25.filter((text) => text.key !== "i:1f"), { key: "i:1f-low", said: `EL -1'-0"`, y: ONE_F_Y + BESIDE }]);
    expect(stack[0]?.otherNotation, "the section draws the storey upward; a pair that says otherwise is no storey height").toBeUndefined();
  });

  test("a section written in one notation proposes exactly the rows it always did — no field is added", () => {
    const stack = stackOf(S25.filter((text) => text.key.startsWith("m:")));
    expect(stack.every((level) => !("otherNotation" in level)), "the second notation's reading is absent, not undefined, so a stored or serialised row is byte-identical").toBe(true);
  });
});
