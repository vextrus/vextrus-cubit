/**
 * F-RCC6 on the ROUTER'S path: the typical range authored, then the project re-expanded, exactly as
 * `commitAuthorTypicalRange` does it — and the register read back (L-CAD-07, L-REG-03, L-REG-04,
 * L-QTY-06).
 *
 * WHY. Until session 7 the F-RCC6 stage committed AUTHOR_TYPICAL_RANGE through the seam and measured
 * straight away, while the lane's door re-expands the project after the act. The act and the resolver
 * then disagreed about six of the roof's beams — the typical plan's B1/B2 rows at ROOF, lettered off a
 * different backbone than the ROOF PLAN that draws them — so the register a customer's campaign is
 * measured over stood them twice (+2.09125 m³ at ROOF over the golden 19.205) and every suite here
 * graded the other register and stayed green. The stage now walks the door's path whole; this suite
 * holds the two readings to one answer and reads the register the router leaves.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { BEAM_CLASS, GOLDEN_BEAM, GOLDEN_CONCRETE, RCC_CONCRETE, canon, goldenFrameByLevel } from "./support/frame-rail-stage";
import { closeStage, field, levelLabelsOf, publishedByLevelOf, registerRowsOf, said, stageRcc6, type Rcc6Stage } from "./support/rcc6-stage";

const MEASURED = "MEASURED";
const DERIVED = "DERIVED";
const ROOF = "ROOF";

let measured: Rcc6Stage;

beforeAll(async () => {
  measured = await stageRcc6("rcc6-router-path");
}, 1_800_000);

afterAll(async () => {
  await closeStage();
});

describe("F-RCC6, authored and re-expanded the way the lane's door does it", () => {
  test("the act wrote exactly the resolver's rows: the re-expansion after it registers nothing and finds nothing stale", () => {
    expect(measured.authored.some((one) => one.performed), `the stage authored a range (${JSON.stringify(measured.authored)})`).toBe(true);
    const corpus = measured.reexpanded.find((one) => one.drawingId === measured.drawingId);
    expect(corpus, `the re-expansion answered for the corpus drawing: ${JSON.stringify(measured.reexpanded)}`).toBeTruthy();
    expect(corpus?.registered, "nothing the act left out").toBe(0);
    expect(corpus?.stale, "nothing the act wrote that the resolver does not derive").toEqual([]);
  });

  test("a storey a plan DREW a mark on is that plan's: no view's derived row of the mark stands beside it", () => {
    const at = levelLabelsOf(measured);
    const rows = registerRowsOf(measured).filter((row) => field(row, "levelId", "level_id") !== null && field(row, "levelId", "level_id") !== undefined);
    const drawnBy = new Map<string, Set<string>>();
    for (const row of rows.filter((one) => said(one, "standing", "standing") === MEASURED)) {
      const key = `${said(row, "mark", "mark")}@${at.get(said(row, "objectKey", "object_key")) ?? ""}`;
      drawnBy.set(key, (drawnBy.get(key) ?? new Set<string>()).add(said(row, "viewKey", "view_key")));
    }
    const beside = rows
      .filter((row) => said(row, "standing", "standing") === DERIVED)
      .filter((row) => {
        const drawers = drawnBy.get(`${said(row, "mark", "mark")}@${at.get(said(row, "objectKey", "object_key")) ?? ""}`) ?? new Set<string>();
        return [...drawers].some((view) => view !== said(row, "viewKey", "view_key"));
      })
      .map((row) => said(row, "objectKey", "object_key"));
    expect(beside, "every derived row a drawing plan's own sightings account for yielded to them (L-REG-03, L-MEA-09)").toEqual([]);
  });

  test("the roof's beam concrete is the golden's, to the last digit, on the register the router leaves", async () => {
    const { exact } = await canon();
    const golden = goldenFrameByLevel(GOLDEN_BEAM, GOLDEN_CONCRETE).get(ROOF);
    expect(golden, "the golden records beam concrete at ROOF").toBeTruthy();
    const published = (await publishedByLevelOf(measured, { class: BEAM_CLASS, kind: RCC_CONCRETE })).get(ROOF);
    expect(published, "the campaign published beam concrete at ROOF").toBeTruthy();
    expect(exact(String(published)).eq(exact(String(golden))), `ROOF: ${String(published)} m3 against the golden ${String(golden)} m3 — no beam stands twice`).toBe(true);
  });
});
