// @vitest-environment jsdom
/**
 * I-683 on the scale panel itself: a page of a paged drawing — a PDF set, a scan — scales the
 * views read on that page, and never another page's (viewer.md I-683, s-drawings I-681).
 *
 * The scale door answers every view of the drawing. Before pages were partitioned a PDF answered
 * none; now it answers each page's, and a panel listing them all would put 49 rows in front of a QS
 * on S-10's page of the BNBC set, one of them S-10's plan. Here the shipped region is mounted over a
 * supplied reading of three views — S-10's plan on Page 11, a schedule on Page 12, and a view of
 * model space — and the rows, the member count and the two-point door are read as a reader reads them.
 *
 * Nothing opens a database: the doors are stand-ins (the region's `supplied` seam).
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ViewScale } from "@/modules/takeoff/scale";
import { SCALE_COPY, fillCopy } from "@/modules/takeoff/scale-ui/copy";
import { formatUserFigure } from "@/core/format";
import { TESTIDS } from "@/ui/testids";
import { ScalePanel, useScaleRegion, viewsOfSheet, type ScaleDoors } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/scale-region";
import type { ReadAnswer } from "@/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/scale-actions";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const DRAWING = "33333333-3333-4333-8333-333333333333";

const S10_PAGE = "Page 11";
const PLAN = `LAYOUT_PLAN:PDF_OBJECT:${"A".repeat(64)}`;
const SCHEDULE = `SCHEDULE:PDF_OBJECT:${"B".repeat(64)}`;
const MODELLED = "DETAIL:DXF_HANDLE:30AC";

function view(viewKey: string, type: string, page: string | null): ViewScale {
  return { viewKey, type, caption: `Caption of ${viewKey}`, proposals: [], affirmed: null, refusal: "SCALE_NO_EVIDENCE", printedScale: null, page } as unknown as ViewScale;
}

const READING: readonly ViewScale[] = [view(PLAN, "LAYOUT_PLAN", S10_PAGE), view(SCHEDULE, "SCHEDULE", "Page 12"), view(MODELLED, "DETAIL", null)];

function doors(): ScaleDoors {
  const read: ReadAnswer = { read: true, views: [...READING], tolerances: { anisotropy: "0.01", verification: "0.01" } } as ReadAnswer;
  return { read: async () => read, preview: async () => ({ previewed: false, refusal: "SIGNED_OUT" }) as never, commit: async () => ({ committed: false, refusal: "SIGNED_OUT" }) as never };
}

function Harness({ supplied, sheetName }: { supplied: ScaleDoors; sheetName: string }) {
  const scale = useScaleRegion({ tenantId: TENANT, projectId: PROJECT, drawingId: DRAWING, sheetName, enabled: true, supplied });
  return <ScalePanel scale={scale} picks={[]} views={[]} onSpent={() => undefined} />;
}

afterEach(() => {
  cleanup();
});

describe("I-683: a page's scale panel lists the views of that page", () => {
  test("S-10's page lists its plan and the model-space view, never the next page's schedule, and counts members out of them", async () => {
    const mounted = render(<Harness supplied={doors()} sheetName={S10_PAGE} />);
    const panel = await waitFor(() => {
      const held = mounted.getByTestId(TESTIDS.viewer.scale);
      expect(held.getAttribute("data-state")).toBe("ready");
      return held;
    });
    const rows = [...panel.querySelectorAll<HTMLElement>(`[data-testid="${TESTIDS.viewer.scaleView}"]`)].map((row) => row.getAttribute("data-view-key"));
    expect(rows, "the schedule of Page 12 stands on no part of Page 11").toEqual([PLAN, MODELLED]);

    const member = panel.querySelector<HTMLInputElement>(`[data-testid="${TESTIDS.viewer.scaleMember}"][data-view-key="${PLAN}"]`);
    await act(async () => {
      fireEvent.click(member as HTMLInputElement);
    });
    expect(panel.textContent, "the member count is out of this page's views").toContain(
      fillCopy(SCALE_COPY.viewer_scale_members_count, { count: formatUserFigure("1"), total: formatUserFigure("2") }),
    );
  });

  test("a drawing with no page answers its whole list, the very list the door answered", () => {
    const modelled = [view(MODELLED, "DETAIL", null), { ...view(PLAN, "LAYOUT_PLAN", null), page: undefined } as ViewScale];
    expect(viewsOfSheet(modelled, "S-10")).toBe(modelled);
  });
});
