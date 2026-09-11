// @vitest-environment jsdom
/**
 * BREAKER — the screen a denied reader meets when there is nothing to show (R-UI-050, R-UI-020,
 * inc-216-coverage-grid).
 *
 * Reading this screen and MOVING a boundary on it are two different permissions: the lane's own door
 * admits the reading on MEASURE (`takeoffRouter.coverage`), while `permitted` is the route's reading
 * of SET_BILL_BOUNDARY (page.tsx `holdsBoundary`). So a participant who may measure but may not move
 * a boundary — the ordinary case — opens this screen with `permitted: false`, and `stateOf` answers
 * `denied` before it ever asks whether the project has a campaign pinned.
 *
 * On a project with no pinned campaign that reader is then shown an empty `coverage-grid` — no rows,
 * no cells — and NO `coverage-empty`: the one cell of the matrix that teaches the next action is the
 * one the denial takes the place of. R-UI-050 asks each state to say the true thing and R-UI-020
 * forbids the silence ("an empty list says why it is empty"); the denial states a permission this
 * reader does not need in order to be told that nothing has been pinned yet.
 *
 * The same workspace already makes this distinction for the read that FAILED — `view === null ||
 * state === "error"` renders the error cell whatever the state precedence said (coverage-workspace
 * .tsx) — so the body's choice of what to render is not the `data-state` precedence the Decision §2
 * fixes, and answering this defect need not move `data-state` at all: a denied reader still reads
 * `data-state="denied"` and still keeps no doors (B-12's line).
 */
import { afterEach, describe, expect, test } from "vitest";
import { GF, TESTID, cleanup, coverageViewFixture, hooks, mountCoverage, sighting, type CoverageViewShape } from "./support/coverage-stage";

/** The seam under `residue.ts` opens a pool at import time; the address is stated, never dialled. */
process.env["DATABASE_URL"] ??= "postgresql://cubit_app:cubit_app@127.0.0.1:5544/postgres";

/** How the screen spells the denial of SET_BILL_BOUNDARY (the interfaces' hook registry). */
const DENIED = "denied";

/** A project whose campaign was never pinned: the reading stands, and it holds nothing. */
async function unpinned(): Promise<CoverageViewShape> {
  const read = await coverageViewFixture({
    bears: [{ class: "column", kind: "rcc.concrete" }],
    workItems: ["rcc.concrete"],
    levels: [{ ...GF }],
    sightings: [sighting("column", GF.levelId)],
    lines: [],
    declarations: [],
    truncated: [],
    observations: [],
  });
  return { ...read, campaignId: null, cells: [], measurement: [], bill: [] };
}

afterEach(() => {
  cleanup();
});

describe("a project with no campaign pinned", () => {
  test("teaches the next action to a reader who may move a boundary", async () => {
    const { root } = await mountCoverage({ view: await unpinned() });
    expect(root.getAttribute("data-state"), "the screen reads as empty").toBe("empty");
    expect(hooks(root, TESTID.empty).length, "and the empty cell teaches what to do next").toBe(1);
  });

  test("teaches it to a reader denied the boundary doors too — a denial is not an answer about the campaign", async () => {
    const { root } = await mountCoverage({ view: await unpinned(), state: DENIED });

    expect(root.getAttribute("data-state"), "the denial is still the state the screen reads at").toBe(DENIED);
    expect(hooks(root, TESTID.holdOut).length, "and the denied screen still keeps no doors").toBe(0);
    expect(hooks(root, TESTID.declareOutOfScope).length, "neither of them").toBe(0);

    expect(
      hooks(root, TESTID.empty).length,
      "a reader who may read this screen but not move a boundary is still owed the reason it is empty: no campaign is pinned. Denied, the screen draws an empty coverage-grid with no rows instead, and the one state that teaches the next action never renders (R-UI-050, R-UI-020 — an empty list says why it is empty)",
    ).toBe(1);
  });
});
