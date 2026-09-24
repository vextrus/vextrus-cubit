// @vitest-environment jsdom
/**
 * An affirmation's Before and After say the scale in words — the rank and what one drawing unit is —
 * and the 64-character calibration key it moves to stands behind Details with the digest (I-566,
 * walk-1 B02). A key on the face of the dialog is what the walk found and what these cases forbid.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type { ConsequenceScale } from "@/core/acts";
import { FigureProvider, type FigureFormat } from "../../primitives/core";
import { TESTIDS } from "@/ui/testids";
import { ConsequenceDialog } from "./index";
import { strings } from "../../strings";

const AFFIRM_SCALE = "AFFIRM_SCALE";
const DIGEST = "3333333333333333333333333333333333333333333333333333333333333333";
const KEY_BEFORE = "a".repeat(64);
const KEY_AFTER = "2e129c698d2eb662e651f95805d7243baae7a58d5c3c8d2c24db5280ffde6b2e";

const FIGURES: FigureFormat = { figure: (value) => `‹${value}›`, money: (amount) => amount, date: () => "" };

function open(scale: ConsequenceScale, before: string[]): void {
  const consequence = {
    actType: AFFIRM_SCALE,
    tenantId: "tenant-sample",
    projectId: "project-sample",
    rendering: "SUBJECTS",
    subjects: [{ subjectId: "LAYOUT_PLAN:DXF_HANDLE:20AC", subjectLabel: "COLUMN LAYOUT PLAN  SCALE 1:100", before, after: [KEY_AFTER], scale }],
  };
  render(
    <FigureProvider format={FIGURES}>
      <ConsequenceDialog
        open
        actType={AFFIRM_SCALE}
        preview={() => Promise.resolve({ consequence, consequenceDigest: DIGEST } as never)}
        commit={() => Promise.resolve({ actId: "act-sample" })}
        onOpenChange={() => undefined}
        onCommitted={() => undefined}
      />
    </FigureProvider>,
  );
}

const MM = { rank: "DIMENSION_RATIO", factorX: "0.001000000000", factorY: "0.001000000000", millimetresX: "1", millimetresY: "1" };

afterEach(() => cleanup());

describe("an affirmation's scale, in words", () => {
  test("After names the rank and what one drawing unit is, and never the calibration key", async () => {
    open({ before: null, after: MM }, []);
    const row = await screen.findByTestId(TESTIDS.consequence.subjectRow);
    const after = row.querySelector('[data-column="after"]');
    expect(after?.textContent).toContain(strings.consequence_dialog_scale_rank_DIMENSION_RATIO);
    expect(after?.textContent).toContain(strings.consequence_dialog_scale_per_unit);
    expect(after?.textContent).toContain("‹1›");
    expect(row.textContent).not.toContain(KEY_AFTER);
    expect(within(row).getByText(strings.consequence_dialog_scale_none)).toBeTruthy();
  });

  test("X and Y are said apart where they differ, and Before says the scale the view stood at", async () => {
    const before = { rank: "FILE_UNITS", factorX: "0.001000000000", factorY: "0.001000000000", millimetresX: "1", millimetresY: "1" };
    const after = { rank: "QS_TWO_POINT", factorX: "0.001000000000", factorY: "0.001020000000", millimetresX: "1", millimetresY: "1.02" };
    open({ before, after }, [KEY_BEFORE]);
    const row = await screen.findByTestId(TESTIDS.consequence.subjectRow);
    expect(row.querySelector('[data-column="before"]')?.textContent).toContain(strings.consequence_dialog_scale_rank_FILE_UNITS);
    const said = row.querySelector('[data-column="after"]')?.textContent ?? "";
    expect(said).toContain(strings.consequence_dialog_scale_rank_QS_TWO_POINT);
    expect(said).toContain("‹1.02›");
    expect(row.textContent).not.toContain(KEY_BEFORE);
  });

  test("the calibration key stands behind Details beside the digest", async () => {
    open({ before: null, after: MM }, []);
    await screen.findByTestId(TESTIDS.consequence.subjectRow);
    const details = screen.getByTestId(TESTIDS.consequence.details).closest("details");
    expect(details?.textContent).toContain(strings.consequence_dialog_details_calibrations);
    expect(details?.textContent).toContain(KEY_AFTER);
    expect(details?.textContent).toContain(DIGEST);
  });
});
