// @vitest-environment jsdom
/**
 * MEASURE-REFUSE's QS outcome on the register (s-coverage I-484; the HONEST-SCOPE review's
 * blocking item): the deferred-and-refused region "tells the QS exactly which sheets need a scale
 * and which storeys need a height, with a link to each".
 *
 * WHY. A run's deferrals first reached the region as ordinary sighting rows: the caption or the
 * storey stood in the object-key chip under the label "Object", cut to seven characters on the face
 * of the rail — `1ST FLOOR BEAM LAYOUT` and `1ST FLOOR SLAB REINFORCEMENT PLAN` both read `1ST FLO`,
 * a caption-less view read `v:LAYOU` — and every row, heights included, linked to the page-wide
 * drawings list, where no height is ever stated. What is held here is what the QS reads and where
 * each row's door goes, through the shipped workspace and the one RefusalState.
 */
import { cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { REFUSALS } from "@/core/errors";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import type { ViewRefusal } from "@/modules/takeoff/register-ui/view";
import { DRAWING, PROJECT, TENANT, aView, all, drawingsRoute, mountRegister, text } from "../../ui/takeoff-register/support/fixtures";

afterEach(() => cleanup());

const SCALE = REFUSALS.VIEW_SCALE_UNAFFIRMED.code;
const HEIGHT = REFUSALS.STOREY_HEIGHT_UNSTATED.code;

const BEAM_VIEW = "v:LAYOUT_PLAN:DXF_HANDLE:2B1";
const SLAB_VIEW = "v:LAYOUT_PLAN:DXF_HANDLE:2C4";
const BARE_VIEW = "v:LAYOUT_PLAN:DXF_HANDLE:3D9";
const FIRST_FLOOR = "11111111-1111-4111-8111-111111111111";

/** A run over an unscaled set: two captioned views on sheets, one view no caption anchors, one storey. */
const deferrals: ViewRefusal[] = [
  {
    code: SCALE,
    objectKey: BEAM_VIEW,
    kind: null,
    deferral: { subject: "VIEW", name: "1ST FLOOR BEAM LAYOUT", sheet: { drawingId: DRAWING, layoutName: "S-13 Beam layout", sourceKey: "DXF_HANDLE:2B1" } },
  },
  {
    code: SCALE,
    objectKey: SLAB_VIEW,
    kind: null,
    deferral: { subject: "VIEW", name: "1ST FLOOR SLAB REINFORCEMENT PLAN", sheet: { drawingId: DRAWING, layoutName: "S-19 Slab", sourceKey: "DXF_HANDLE:2C4" } },
  },
  { code: SCALE, objectKey: BARE_VIEW, kind: null, deferral: { subject: "VIEW", name: "", sheet: null } },
  { code: HEIGHT, objectKey: FIRST_FLOOR, kind: null, deferral: { subject: "STOREY", name: "1ST FLOOR" } },
];

const rowOf = (root: HTMLElement, objectKey: string): HTMLElement => {
  const row = all(root, "register-refusal").find((one) => one.getAttribute("data-object") === objectKey);
  expect(row, `a row stands for ${objectKey}`).toBeTruthy();
  return row as HTMLElement;
};
const doorOf = (row: HTMLElement): HTMLAnchorElement => within(row).getByTestId("refusal-evidence-link") as HTMLAnchorElement;
const nameOf = (row: HTMLElement): string => text(row.querySelector(".cx-register-refusal-name") as HTMLElement);
const labelOf = (row: HTMLElement): string => text(row.querySelector("[data-deferral] .cx-register-refusal-label") as HTMLElement);

describe("I-484: a run's deferral names its view or storey whole, with a door to where it is fixed", () => {
  test("a view is named by its whole caption under 'View' — two captions that share a prefix read apart — and never through a cut identifier chip", async () => {
    const root = await mountRegister(aView({ refusals: deferrals }));
    const beam = rowOf(root, BEAM_VIEW);
    const slab = rowOf(root, SLAB_VIEW);
    expect(labelOf(beam)).toBe("View");
    expect(nameOf(beam), "the caption, whole, as text").toBe("1ST FLOOR BEAM LAYOUT");
    expect(nameOf(slab)).toBe("1ST FLOOR SLAB REINFORCEMENT PLAN");
    expect(beam.textContent, "the caption is on the face of the row, not only in a tooltip").toContain("1ST FLOOR BEAM LAYOUT");
    for (const row of [beam, slab]) {
      expect(row.querySelector(testIdSelector(TESTIDS.register.refusalObject)), "a deferral is no object key: no id chip").toBeNull();
    }
  });

  test("a view's door opens the sheet it stands on, flown to its caption", async () => {
    const root = await mountRegister(aView({ refusals: deferrals }));
    const door = doorOf(rowOf(root, BEAM_VIEW));
    expect(text(door)).toBe("Open the sheet");
    expect(door.getAttribute("href")).toMatch(new RegExp(`^/t/${TENANT}/p/${PROJECT}/viewer/${DRAWING}/${encodeURIComponent("S-13 Beam layout")}\\?.+`, "u"));
    expect(decodeURIComponent(door.getAttribute("href") ?? ""), "selecting the caption's own entity").toContain("DXF_HANDLE:2B1");
  });

  test("a view no caption anchors is named by its class in words, and opens the drawings where no sheet is known", async () => {
    const root = await mountRegister(aView({ refusals: deferrals }));
    const bare = rowOf(root, BARE_VIEW);
    expect(nameOf(bare), "never the leading characters of its address").not.toMatch(/^v:/u);
    expect(nameOf(bare).toLowerCase()).toContain("layout plan");
    expect(doorOf(bare).getAttribute("href")).toBe(drawingsRoute(TENANT, PROJECT));
  });

  test("a storey is named by its label under 'Storey', and its door goes to the level stack, where a height is stated", async () => {
    const root = await mountRegister(aView({ refusals: deferrals }));
    const storey = rowOf(root, FIRST_FLOOR);
    expect(labelOf(storey)).toBe("Storey");
    expect(nameOf(storey)).toBe("1ST FLOOR");
    const door = doorOf(storey);
    expect(text(door)).toBe("Open the levels");
    expect(door.getAttribute("href")).toBe(`/t/${TENANT}/p/${PROJECT}/takeoff/levels`);
  });

  test("every row keeps its own key, so two views that share a caption are still two rows", async () => {
    const twins: ViewRefusal[] = [
      { code: SCALE, objectKey: BEAM_VIEW, kind: null, deferral: { subject: "VIEW", name: "BEAM LAYOUT", sheet: null } },
      { code: SCALE, objectKey: SLAB_VIEW, kind: null, deferral: { subject: "VIEW", name: "BEAM LAYOUT", sheet: null } },
    ];
    const root = await mountRegister(aView({ refusals: twins }));
    expect(all(root, "register-refusal").map((row) => row.getAttribute("data-object"))).toEqual([BEAM_VIEW, SLAB_VIEW]);
  });
});
