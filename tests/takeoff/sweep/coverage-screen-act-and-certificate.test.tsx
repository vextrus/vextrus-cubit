// @vitest-environment jsdom
/**
 * AC-5(d) and AC-5(f): what the inspector's `data-act` carries, and the certificate section a
 * keyboard can reach (debt-src-modules-9gp0ot, debt-src-modules-1yhtkme, L-QTY-05, R-UI-020).
 *
 * Both are read off the screen the route mounts, over the residue the coverage stage resolves: the
 * act expected is the one THIS cell's own axis stands under, derived from the cell rather than named
 * here (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  IN_BILL,
  TESTID,
  attr,
  cleanup,
  coverageViewFixture,
  hook,
  hooks,
  mountCoverage,
  productModule,
  residueFixture,
  residueSeam,
  type CoverageViewShape,
  type ResidueCellShape,
} from "../coverage/support/coverage-stage";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

const COVERAGE_WORKSPACE = "src/modules/takeoff/coverage/coverage-workspace.tsx";

afterEach(() => {
  cleanup();
});

/** A residue with nothing in it at all — a campaign whose grid has no cell to draw. */
function emptyInput(): ReturnType<typeof residueFixture> {
  return { bears: [], workItems: [], levels: [], sightings: [], lines: [], declarations: [], truncated: [], observations: [] };
}

describe("AC-5: the coverage inspector cites the act of the axis it reads", () => {
  test("AC-5: a cell read under the bill axis carries the BILL's act in `data-act`", async () => {
    const view = (await coverageViewFixture()) as CoverageViewShape;
    const residue = await residueSeam();
    const cells = view.cells as readonly ResidueCellShape[];

    // The cell this case is about: one the bill axis moved, whose bill act is not the act its
    // measurement axis stands under — with the two the same, the citation could not be told apart.
    const onBill = cells.find(
      (cell) => cell.bill !== IN_BILL && cell.billActId !== null && cell.billActId !== cell.measurementActId,
    );
    expect(onBill, "the staged residue really carries a cell declared out of the bill by an act of its own — with none, this case grades nothing (L-QTY-05)").toBeTruthy();
    const cell = onBill as ResidueCellShape;

    const door = await productModule<Record<string, unknown>>("src/modules/takeoff/coverage/cited-act.ts");
    expect(typeof door["citedActOf"], "src/modules/takeoff/coverage/cited-act.ts publishes `citedActOf` — the one answer to which act a cell's reading was declared by (interfaces)").toBe("function");
    const citedActOf = door["citedActOf"] as (one: ResidueCellShape, axis: string) => string | null;

    const { root } = await mountCoverage({ view, cell: residue.cellRef(cell) });
    expect(
      attr(hook(root, TESTID.inspectorCause), "data-act"),
      "the inspector cites what that one door answers for the axis this cell is read under — the screen holds no second opinion about which act moved a cell (B-17, L-QTY-05)",
    ).toBe(citedActOf(cell, "BILL"));
    expect(citedActOf(cell, "BILL"), "and for this cell that answer is the act that moved its bill axis").toBe(cell.billActId);
  });
});

describe("AC-5: the certificate preview is a place a keyboard can stand", () => {
  test("AC-5: `CertificatePreviewSection` is published, and the preview is focusable with rows and with none", async () => {
    const module_ = await productModule<Record<string, unknown>>(COVERAGE_WORKSPACE);
    expect(
      typeof module_["CertificatePreviewSection"],
      `${COVERAGE_WORKSPACE} publishes \`CertificatePreviewSection\` — the section a test can mount on its own (interfaces)`,
    ).toBe("function");

    for (const [said, input] of [
      ["a campaign whose residue carries rows", residueFixture()],
      ["a campaign whose residue carries none", emptyInput()],
    ] as const) {
      const view = (await coverageViewFixture(input)) as CoverageViewShape;
      const { root, unmount } = await mountCoverage({ view });
      const preview = hooks(root, TESTID.certificate);
      expect(preview.length, `${said}: the certificate preview stands on the screen`).toBe(1);
      expect(
        attr(preview[0] as HTMLElement, "tabindex"),
        `${said}: a region a reader can scroll is a region a reader can reach by keyboard — a scrollable box no tab order carries is unreachable without a mouse (R-UI-020)`,
      ).toBe("0");
      unmount();
    }
  });
});
