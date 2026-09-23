// @vitest-environment jsdom
/**
 * I-419 and I-420 on the scale panel itself: a sheet the drawing offers NO scale for is
 * scaled by two agreeing observations per axis, and a greyed door always says, in words, what it
 * still wants (L-MEA-05, R-UI-020, session 8's walk-0).
 *
 * Walk-0 took two observations on S-10's grid of a freshly uploaded drawing that proposed nothing,
 * read "Not verified" on both, and met an "Affirm at Two-point calibration" door that stayed grey
 * with no reason given: the panel judged each observation alone against machine proposals, so with
 * none the door could never open. Here the shipped region (`useScaleRegion` and `ScalePanel`, the
 * route's own markup) is mounted over supplied door answers for exactly that sheet — one view, no
 * proposal, an unmapped header — and driven the way a reader drives it: picks handed in as the snap
 * region hands them, a distance typed, Observe pressed, the view chosen, the door read and pressed.
 *
 * Nothing opens a database: the three doors are stand-ins (the region's `supplied` seam), and every
 * factor expected below is core's own `citeObservation` over the same picks (B-19).
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { citeObservation } from "@/core/scale";
import type { ViewScale } from "@/modules/takeoff/scale";
import { SCALE_COPY, fillCopy } from "@/modules/takeoff/scale-ui/copy";
import type { SnapPick } from "@/modules/takeoff/viewer-snap/snap";
import { TESTIDS } from "@/ui/testids";
import { ScalePanel, useScaleRegion, type ScaleDoors, type ScaleViewBox } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/scale-region";
import type { AffirmScaleRequest, PreviewAnswer, ReadAnswer } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/scale-actions";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const DRAWING = "33333333-3333-4333-8333-333333333333";

/** The one view of the sheet: a layout plan the drawing offers no scale for (SCALE_UNIT_UNMAPPED). */
const PLAN = "LAYOUT_PLAN:DXF_HANDLE:20AC";
/** A second view, so choosing is a choice. */
const DETAIL = "DETAIL:DXF_HANDLE:30AC";

const TWO_POINT = "QS_TWO_POINT";
const TOLERANCES = { anisotropy: "0.01", verification: "0.01" } as const;

/** Where the two views stand on the sheet, as the overlay hands their boxes to the region. */
const BOXES: readonly ScaleViewBox[] = [
  { viewKey: PLAN, box: { min: [-10, -100], max: [200, 10] } },
  { viewKey: DETAIL, box: { min: [500, -100], max: [700, 10] } },
];

/** One grid bay as walk-0 measured it: 45.7 drawing units, entered as 4,572 mm. */
const BAY = 45.7;
const BAY_MM = "4572";
/** 2.36 % over a bay: a reading beyond the edition's ±1 %. */
const FAR_MM = "4680";

function view(viewKey: string, type: string): ViewScale {
  return { viewKey, type, caption: `Caption of ${viewKey}`, proposals: [], affirmed: null, refusal: "SCALE_UNIT_UNMAPPED" } as unknown as ViewScale;
}

/** A pick as the snap region hands one: the entity it stands on and its lattice point. */
function pick(index: 1 | 2, sourceKey: string, x: number, y: number): SnapPick {
  return { index, point: [x, y], sourceKeys: [sourceKey], keyPoint: [x.toFixed(1), y.toFixed(1)] };
}

/** Two picks across one span: from (x1, y1) on grid 1 to (x2, y2) on grid 2. */
function span(x1: number, y1: number, x2: number, y2: number): SnapPick[] {
  return [pick(1, "DXF_HANDLE:A1", x1, y1), pick(2, "DXF_HANDLE:A2", x2, y2)];
}

const X_FIRST = span(0, 0, BAY, 0);
const X_SECOND = span(0, -30, BAY, -30);
const X_THIRD = span(0, -60, BAY, -60);
const Y_FIRST = span(BAY, 0, BAY, -BAY);
const Y_SECOND = span(0, 0, 0, -BAY);

/** The doors, answering one reading of the sheet and recording every preview asked. */
function doors(): ScaleDoors & { previews: AffirmScaleRequest[] } {
  const previews: AffirmScaleRequest[] = [];
  const read: ReadAnswer = { read: true, views: [view(PLAN, "LAYOUT_PLAN"), view(DETAIL, "DETAIL")], tolerances: { ...TOLERANCES } } as ReadAnswer;
  return {
    previews,
    read: async () => read,
    preview: async (request) => {
      previews.push(request);
      return { previewed: false, refusal: "SIGNED_OUT" } as PreviewAnswer;
    },
    commit: async () => ({ committed: false, refusal: "SIGNED_OUT" }) as never,
  };
}

/** The region as the viewer composes it: the hook, and the panel over the picks standing now. */
function Harness({ supplied, picks, onSpent }: { supplied: ScaleDoors; picks: readonly SnapPick[]; onSpent: () => void }) {
  const scale = useScaleRegion({ tenantId: TENANT, projectId: PROJECT, drawingId: DRAWING, sheetName: "S-10 COLUMN LAYOUT PLAN", enabled: true, supplied });
  return (
    <>
      <ScalePanel scale={scale} picks={picks} views={BOXES} onSpent={onSpent} />
      {scale.dialog}
    </>
  );
}

afterEach(() => {
  cleanup();
});

/** The mounted panel, with a way to hand it the next two picks. */
async function mounted() {
  const supplied = doors();
  let spent = 0;
  const onSpent = (): void => {
    spent += 1;
  };
  const view = render(<Harness supplied={supplied} picks={[]} onSpent={onSpent} />);
  const panel = await waitFor(() => {
    const held = view.getByTestId(TESTIDS.viewer.scale);
    expect(held.getAttribute("data-state"), "the panel settles out of loading over the supplied reading").toBe("ready");
    return held;
  });

  const door = (): HTMLButtonElement => {
    const held = [...panel.querySelectorAll<HTMLButtonElement>(`[data-testid="${TESTIDS.viewer.scaleAffirm}"][data-rank="${TWO_POINT}"]`)];
    expect(held.length, "the two-point door always stands (I-169)").toBe(1);
    return held[0] as HTMLButtonElement;
  };
  /** Every reason a door is shut, as the words under it publish them. */
  const reasons = (): string[] => [...panel.querySelectorAll(`[data-testid="${TESTIDS.viewer.scaleAffirmWhy}"] [data-reason], [data-testid="${TESTIDS.viewer.scaleAffirmWhy}"][data-reason]`)].map((line) => line.getAttribute("data-reason") ?? "");
  const rows = (): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>(`[data-testid="${TESTIDS.viewer.scaleObservation}"]`)];

  const observe = async (picks: readonly SnapPick[], millimetres: string): Promise<void> => {
    const before = spent;
    view.rerender(<Harness supplied={supplied} picks={picks} onSpent={onSpent} />);
    fireEvent.change(view.getByTestId(TESTIDS.viewer.scaleDistance), { target: { value: millimetres } });
    await act(async () => {
      fireEvent.click(view.getByTestId(TESTIDS.viewer.scaleObserve));
    });
    expect(spent, "a taken observation spends its picks (I-158)").toBe(before + 1);
    view.rerender(<Harness supplied={supplied} picks={[]} onSpent={onSpent} />);
  };

  const choose = async (viewKey: string): Promise<void> => {
    const member = panel.querySelector<HTMLInputElement>(`[data-testid="${TESTIDS.viewer.scaleMember}"][data-view-key="${viewKey}"]`);
    expect(member, `${viewKey}'s row carries its checkbox`).not.toBeNull();
    await act(async () => {
      fireEvent.click(member as HTMLInputElement);
    });
  };

  return { supplied, panel, door, reasons, rows, observe, choose };
}

/** Core's own factor for two picks and a distance in millimetres. */
function factorOf(picks: readonly SnapPick[], millimetres: string): string {
  return citeObservation({
    points: picks.map((held) => ({ sourceKey: held.sourceKeys[0], x: held.keyPoint[0], y: held.keyPoint[1] })),
    distance: { value: millimetres, unit: "mm" },
    distanceBasis: "ENTERED",
  }).factor;
}

describe("I-419: a sheet with no machine proposal is scaled by two agreeing observations per axis", () => {
  test("I-419: the two-point door opens on two agreeing observations per axis, with nothing machine-made, and the act is asked for exactly them", async () => {
    const panel = await mounted();
    expect(panel.door().disabled, "nothing observed, nothing chosen: the door is shut").toBe(true);

    await panel.choose(PLAN);
    await panel.observe(X_FIRST, BAY_MM);
    expect(panel.rows().map((row) => row.getAttribute("data-verified")), "one x reading, and nothing on this sheet to check it against").toEqual(["unverified"]);
    expect(panel.rows()[0]?.getAttribute("data-factor"), "the row carries core's own factor").toBe(factorOf(X_FIRST, BAY_MM));

    await panel.observe(X_SECOND, BAY_MM);
    expect(panel.rows().map((row) => row.getAttribute("data-verified")), "a second x bay across other points verifies the first, and the first the second").toEqual(["verified", "verified"]);
    expect(panel.door().disabled, "x stands, y does not yet").toBe(true);

    await panel.observe(Y_FIRST, BAY_MM);
    await panel.observe(Y_SECOND, BAY_MM);
    expect(panel.rows().map((row) => row.getAttribute("data-verified")), "every reading is vouched for by its axis's other bay").toEqual(["verified", "verified", "verified", "verified"]);
    expect(panel.door().disabled, "both axes verified: the door the walk found shut for good opens").toBe(false);
    expect(panel.reasons(), "and an open door says nothing it no longer wants").toEqual([]);

    await act(async () => {
      fireEvent.click(panel.door());
    });
    await waitFor(() => expect(panel.supplied.previews.length, "pressing it asks the act's preview").toBe(1));
    const asked = panel.supplied.previews[0] as AffirmScaleRequest & { observations?: readonly unknown[] };
    expect(asked.rank, "at the two-point rank").toBe(TWO_POINT);
    expect([...asked.viewKeys], "for the view chosen, and no other (membership is positive)").toEqual([PLAN]);
    expect(asked.observations?.length, "carrying the four observations taken in it").toBe(4);
  });
});

describe("I-420: a greyed door always says what it needs, in words", () => {
  test("I-420: before anything is chosen the panel says to choose, once; then each axis says what it lacks", async () => {
    const panel = await mounted();
    const members = panel.panel.querySelector(`[data-testid="${TESTIDS.viewer.scaleAffirmWhy}"][data-reason="members"]`);
    expect(members?.textContent, "nothing chosen: every door wants a view, said once for all of them").toBe(SCALE_COPY.viewer_scale_why_members);
    expect(panel.door().getAttribute("aria-describedby"), "and the shut door is described by those words (R-UI-020)").toBeTruthy();
    expect(panel.reasons()).toEqual(["members", "x-absent", "y-absent"]);
    const words = panel.panel.querySelector(`[data-testid="${TESTIDS.viewer.scaleAffirmWhy}"][data-rank="${TWO_POINT}"]`)?.textContent ?? "";
    expect(words, "x's want is a sentence of the panel's own table").toContain(fillCopy(SCALE_COPY.viewer_scale_why_axis_absent, { axis: SCALE_COPY.scale_axis_x }));

    await panel.choose(PLAN);
    expect(panel.reasons(), "a view chosen takes the members line away, and the axes still want observing").toEqual(["x-absent", "y-absent"]);

    await panel.observe(X_FIRST, BAY_MM);
    expect(panel.reasons(), "one x bay: x wants a second one across other points").toEqual(["x-single", "y-absent"]);
  });

  test("I-420: an observation taken in a view not chosen is named, and choosing it is the remedy", async () => {
    const panel = await mounted();
    await panel.choose(DETAIL);
    await panel.observe(X_FIRST, BAY_MM);
    expect(panel.rows()[0]?.getAttribute("data-view-key"), "the picks stood in the plan").toBe(PLAN);
    expect(panel.reasons(), "x was observed, in a view this scale does not cover").toEqual(["x-unchosen", "y-absent"]);
  });

  test("I-420: the same span taken twice still wants a second span", async () => {
    const panel = await mounted();
    await panel.choose(PLAN);
    await panel.observe(X_FIRST, BAY_MM);
    await panel.observe([...X_FIRST].reverse().map((held, at) => ({ ...held, index: (at + 1) as 1 | 2 })), BAY_MM);
    expect(panel.rows().map((row) => row.getAttribute("data-verified")), "a repeated click vouches for nothing").toEqual(["unverified", "unverified"]);
    expect(panel.reasons()).toEqual(["x-single", "y-absent"]);
  });

  test("I-420: a disagreeing reading is named, marked Not verified, and Remove takes it back", async () => {
    const panel = await mounted();
    await panel.choose(PLAN);
    for (const picks of [X_FIRST, X_SECOND, Y_FIRST, Y_SECOND]) await panel.observe(picks, BAY_MM);
    expect(panel.door().disabled).toBe(false);

    await panel.observe(X_THIRD, FAR_MM);
    expect(panel.door().disabled, "a third x bay beyond ±1 % shuts the door again").toBe(true);
    expect(panel.reasons(), "and says the x readings disagree").toEqual(["x-disagreeing"]);
    const odd = panel.rows()[4] as HTMLElement;
    expect(odd.getAttribute("data-verified"), "the odd one out is the row marked Not verified — the one the words ask to remove").toBe("unverified");

    const remove = odd.querySelector<HTMLButtonElement>(`[data-testid="${TESTIDS.viewer.scaleObservationRemove}"]`);
    expect(remove?.getAttribute("aria-label"), "Remove names the observation it takes back").toBe(fillCopy(SCALE_COPY.viewer_scale_observation_remove_label, { index: "5", axis: SCALE_COPY.scale_axis_x }));
    await act(async () => {
      fireEvent.click(remove as HTMLButtonElement);
    });
    expect(panel.rows().length, "the mistaken observation is gone").toBe(4);
    expect(panel.door().disabled, "and the door opens again").toBe(false);
  });
});
