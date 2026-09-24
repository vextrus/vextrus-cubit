// @vitest-environment jsdom
/**
 * THE REGISTER SAYS WHAT A RUN DID (s-takeoff-register I-649, -b, -c; R-UI-020, R-UI-050).
 *
 * WHY. Walk-1 (session 9) found three silences. On a fresh project after Measure, the work surface
 * still said "Not measured yet… Measure this campaign reads their quantities" — inviting the run that
 * had just happened — while what the run deferred sat in a card below the fold of the rail. On the
 * measured BNBC project "Deferred and refused" was a bare heading (data-count=0) that neither stated
 * its zero nor named what the coverage certificate names as drawn and not measured (Reservoir,
 * Sunshade, Tank; the "Not placed" classes). And no storey was named on the surface where a height
 * was unstated.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS } from "../../../src/ui/testids";
import {
  aView,
  all,
  anObject,
  copy,
  levelStackFixture,
  mountRegister,
  one,
  refusalsFixture,
  takeoffStrings,
  text,
  type ViewDeclared,
  type ViewRefusal,
} from "./support/fixtures";

afterEach(() => {
  cleanup();
});

const VIEW_DEFERRAL: ViewRefusal = {
  code: "VIEW_SCALE_UNAFFIRMED",
  objectKey: "v:LAYOUT_PLAN:DXF_HANDLE:1FEB",
  kind: null,
  deferral: { subject: "VIEW", name: "1ST FLOOR BEAM LAYOUT SCALE 1:100", sheet: null },
};
const STOREY_DEFERRAL: ViewRefusal = {
  code: "STOREY_HEIGHT_UNSTATED",
  objectKey: "level-1st",
  kind: null,
  deferral: { subject: "STOREY", name: "1ST" },
};
const DECLARED: ViewDeclared[] = [
  { subject: "CLASS", class: "tie_beam", kinds: ["rcc.concrete"] },
  { subject: "MEMBER", word: "reservoir", caption: "UNDERGROUND WATER RESERVOIR", drawingId: "d-1", address: "v:SECTION:DXF_HANDLE:2A" },
];

/** A campaign whose objects are registered and whose run published nothing. */
function measuredNothing(refusals: ViewRefusal[], declared: ViewDeclared[] = []) {
  return aView({ objects: [anObject({ mark: "C1" }), anObject({ mark: "C2" })], lines: [], refusals, measured: true, declared });
}

describe("after a run that published no line, the work surface says what the run did", () => {
  test("it never says 'not measured yet' nor invites the run that just happened, and names the run's outcome", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister(measuredNothing([VIEW_DEFERRAL]));
    const said = text(root);
    expect(said, "the surface does not claim nothing was run").not.toContain(copy(strings, "takeoff_register_lines_unmeasured_heading"));
    expect(said, "and does not invite the run that just happened").not.toContain(copy(strings, "takeoff_register_lines_unmeasured_body"));
    const summary = one(root, TESTIDS.register.runSummary);
    expect(text(summary), "it says the run published no line").toContain(copy(strings, "takeoff_register_run_empty_heading"));
    expect(text(summary), "and that what it deferred stands below").toContain(copy(strings, "takeoff_register_run_empty_deferred_body"));
    expect(summary.getAttribute("data-lines")).toBe("0");
  });

  test("what the run deferred is the work surface's own content, not a card in the rail", async () => {
    const root = await mountRegister(measuredNothing([VIEW_DEFERRAL, STOREY_DEFERRAL], DECLARED));
    const summary = one(root, TESTIDS.register.runSummary);
    const region = one(root, TESTIDS.register.refusals);
    expect(summary.contains(region), "the deferred-and-refused region stands inside the work surface").toBe(true);
    expect(one(root, TESTIDS.register.lines).contains(region), "in the grid's own field").toBe(true);
    expect(all(region, TESTIDS.register.refusal).map((row) => row.getAttribute("data-code"))).toEqual(["VIEW_SCALE_UNAFFIRMED", "STOREY_HEIGHT_UNSTATED"]);
    expect(summary.contains(one(root, TESTIDS.register.declared)), "and what the drawings name beside it").toBe(true);
  });

  test("a storey whose height is unstated is named on the surface, by its label", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister(measuredNothing([VIEW_DEFERRAL, STOREY_DEFERRAL]));
    const storeys = one(root, TESTIDS.register.runStoreys);
    expect(text(storeys)).toBe(copy(strings, "takeoff_register_run_storeys").replace("{storeys}", "1ST"));
  });

  test("a run that deferred nothing and published nothing says that, and states the region's zero", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister(measuredNothing([]));
    expect(text(one(root, TESTIDS.register.runSummary))).toContain(copy(strings, "takeoff_register_run_empty_clear_body"));
    expect(all(root, TESTIDS.register.runStoreys), "no storey is named where none was deferred").toHaveLength(0);
    expect(text(one(root, TESTIDS.register.refusalsZero))).toBe(copy(strings, "takeoff_register_refusals_none"));
  });

  test("before any run, the surface still says 'not measured yet' and names the Measure door", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister({ ...levelStackFixture(), lines: [] });
    expect(text(root)).toContain(copy(strings, "takeoff_register_lines_unmeasured_heading"));
    expect(all(root, TESTIDS.register.runSummary), "no run summary where no run was carried").toHaveLength(0);
  });
});

describe("the deferred-and-refused region states its zero, and names what the drawings declare", () => {
  test("measured, with lines and nothing deferred: the region says so in words, never a bare heading", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister({ ...levelStackFixture(), measured: true, refusals: [] });
    const region = one(root, TESTIDS.register.refusals);
    expect(region.getAttribute("data-count")).toBe("0");
    const zero = one(region, TESTIDS.register.refusalsZero);
    expect(text(zero)).toBe(copy(strings, "takeoff_register_refusals_none"));
    expect(zero.getAttribute("data-measured")).toBe("true");
  });

  test("before any run the zero says no run was carried — a different fact from 'nothing deferred'", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister({ ...levelStackFixture(), refusals: [] });
    expect(text(one(root, TESTIDS.register.refusalsZero))).toBe(copy(strings, "takeoff_register_refusals_unrun"));
  });

  test("a region that holds rows states no zero", async () => {
    const root = await mountRegister(refusalsFixture());
    expect(all(root, TESTIDS.register.refusalsZero)).toHaveLength(0);
  });

  test("the declared-but-unmeasured sightings stand under their own heading, each by its word and why", async () => {
    const strings = await takeoffStrings();
    const root = await mountRegister({ ...levelStackFixture(), measured: true, refusals: [], declared: DECLARED });
    const region = one(root, TESTIDS.register.declared);
    expect(region.getAttribute("data-count")).toBe(String(DECLARED.length));
    expect(text(region)).toContain(copy(strings, "takeoff_register_declared_heading"));
    const items = all(region, TESTIDS.register.declaredItem);
    expect(items.map((item) => item.getAttribute("data-subject"))).toEqual(["CLASS", "MEMBER"]);
    const said = (item: HTMLElement | undefined): string[] => [...(item?.children ?? [])].map((part) => text(part));
    expect(said(items[0]), "a class by its word, and why").toEqual(["Tie beam", copy(strings, "takeoff_register_declared_class")]);
    expect(said(items[1]), "a member by its word, the caption that shows it, and why").toEqual([
      "Reservoir",
      copy(strings, "takeoff_register_declared_member").replace("{caption}", "UNDERGROUND WATER RESERVOIR"),
    ]);
    const door = region.querySelector("a");
    expect(door?.getAttribute("href"), "the door opens the coverage, where the certificate states each").toMatch(/\/takeoff\/coverage$/);
    expect(one(root, TESTIDS.register.refusals).contains(region), "never mixed into the refusals").toBe(false);
  });

  test("nothing declared renders no declared region at all", async () => {
    const root = await mountRegister({ ...levelStackFixture(), measured: true, refusals: [] });
    expect(all(root, TESTIDS.register.declared)).toHaveLength(0);
  });
});
