// The probe's verdict line states the workspace rail, because for a whole session it did not.
//
// The session-4 craft walk read `rail 220` in 27 of its 72 captures, across 13 of the 18 published
// rows: Chromium keeps its pointer at (0, 0) from load and replays the hover on every layout
// change, (0, 0) is inside the rail's 48x900 box, and `src/ui/shell/shell-rail.tsx` opens the rail
// after HOVER_HOLD_MS on pointer enter. Thirteen craft rows were therefore published against a
// chrome no customer meets — and nothing in the line said so. The probe now rests the pointer off
// the frame, and `railState` is the field that makes the rail's state READABLE, so the same silence
// cannot happen twice.
//
// Pure, and tested pure: a reading in, a string out, no browser anywhere near it.
import { describe, expect, test } from "vitest";
import { railState } from "../../scripts/probe/lib/rail.mjs";
import { idOf } from "../../scripts/probe/lib/testids.mjs";

const RAIL = idOf("shell.rail");
const RAIL_PIN = idOf("shell.railCollapse");
const collapsed = { rail: { width: 48 }, chrome: { railCollapsed: "true", hovered: null, focused: null } };
const open = (chrome: { railCollapsed: string; hovered: string | null; focused: string | null }) => ({ rail: { width: 220 }, chrome });

describe("railState says which rail the capture photographed", () => {
  test("the rail a customer meets: 48 px, and its own data-collapsed is what says so", () => {
    expect(railState(collapsed)).toBe("rail=48/collapsed");
  });

  test("open with the pointer in it — the state the pointer rest exists to prevent — names the hovered element", () => {
    expect(railState(open({ railCollapsed: "false", hovered: RAIL, focused: null }))).toBe(`rail=220/expanded(hover=${RAIL})`);
  });

  test("open on focus names the control that holds it: a keyboard has no pointer to hold", () => {
    expect(railState(open({ railCollapsed: "false", hovered: null, focused: RAIL_PIN }))).toBe(`rail=220/expanded(focus=${RAIL_PIN})`);
  });

  test("open with neither is the remembered pin — the only opener left once hover and focus are read out", () => {
    expect(railState(open({ railCollapsed: "false", hovered: null, focused: null }))).toBe("rail=220/expanded(pinned)");
  });

  test("hover is named before focus: the pointer is what opened a rail that has both", () => {
    expect(railState(open({ railCollapsed: "false", hovered: RAIL, focused: RAIL_PIN }))).toBe(`rail=220/expanded(hover=${RAIL})`);
  });

  test("a screen with no shell has no rail to state", () => {
    expect(railState({ rail: null })).toBe("rail=absent");
    expect(railState({})).toBe("rail=absent");
  });
});

describe("railState is total over the readings that exist", () => {
  test("a reading taken before the chrome was read says the rail's width and nothing it cannot know", () => {
    expect(railState({ rail: { width: 48 } })).toBe("rail=48/collapsed");
    expect(railState({ rail: { width: 220 } })).toBe("rail=220/expanded");
  });

  test("with no data-collapsed published, the width answers by the same 56 px scoreCraft reads by", () => {
    const unpublished = { railCollapsed: null, hovered: null, focused: null };
    expect(railState({ rail: { width: 56 }, chrome: unpublished })).toBe("rail=56/collapsed");
    expect(railState({ rail: { width: 57 }, chrome: unpublished })).toBe("rail=57/expanded(pinned)");
  });

  test("a fractional box is stated in whole pixels, as the rest of the rubric states its geometry", () => {
    expect(railState({ rail: { width: 219.6 }, chrome: { railCollapsed: "false", hovered: null, focused: null } })).toBe("rail=220/expanded(pinned)");
  });
});
