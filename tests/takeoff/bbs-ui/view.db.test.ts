/**
 * AC-2 — `bbsViewOf` over a REAL campaign: what the screen is drawn from is the campaign's own
 * standing, and `partial` is READ from the published lines rather than defaulted (I-bbs-1, L-QTY-02,
 * L-QTY-03, AM-03(f)).
 *
 * A flag hard-coded `false` would draw a whole schedule for a campaign whose rebar lines could only
 * be partly declared — the reader would never learn that a tie zone nobody transcribed is missing
 * from the figures in front of them. So a small campaign of the fixture's own columns is staged and
 * measured through the shipped doors, the COVERAGE the rail actually stored is read back from the
 * quantity lines, and the view's flag is compared against that reading both before the campaign is
 * measured (nothing published, nothing partial) and after it (a tie zone nobody stated, so partly
 * declared). Nothing is typed here: the expectation is the rule applied to whatever the ground says.
 *
 * The two cases are ordered — the first reads the view of an UNMEASURED campaign, which exists only
 * until the second measures it. This suite opens a live database, so it is the DATABASE lane's
 * (derived from its imports, scripts/lib/pg-suites.mjs); nothing here measures time (AM-10 §3).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BNBC_MODEL,
  FOUNDATION_SLOT,
  PARTIAL_DECLARED,
  bbsThroughDoor,
  closeStage,
  columnMembersOf,
  detailingStating,
  linesOf,
  measure,
  modelStoreys,
  said,
  stageRebarCampaign,
  type RebarStage,
} from "../rails/rebar/support/rebar-stage";
import { productModule, statesModule, type BbsDocumentShape, type BbsViewShape } from "./support/golden-document";

/** Staging and measuring a campaign is minutes of real work; a derivation is all this suite grades. */
const BUDGET_MS = 900_000;

/** How many of the fixture's columns this suite measures — enough to publish lines, not a reconciliation. */
const MEMBERS = 3;

/** The detailing the fixture's own general notes state (the band suite's own reading). */
const APPLIED = detailingStating({ lapMultiplier: 50, fyMPa: 500, fcPsi: 3500, hook: { multiplier: 10, minimumMm: 75 } });

/** What the screen's server reads for a project (test contract: `bbsViewOf`). */
type ServerModule = { bbsViewOf(scope: { tenantId: string; projectId: string }): Promise<BbsViewShape> };
const serverModule = (): Promise<ServerModule> => productModule<ServerModule>("src/modules/takeoff/bbs-ui/server.ts");

let ground: Promise<RebarStage> | undefined;

/**
 * A campaign over a few of the fixture's columns, staged once.
 *
 * Lazy rather than a hook: a module the Builder has not written yet must fail the CASE that needed
 * it, by name — a throwing hook leaves every case skipped, and judges nothing.
 */
const staged = (): Promise<RebarStage> =>
  (ground ??= (async () => {
    const columns = columnMembersOf(BNBC_MODEL).filter((member) => member.level !== FOUNDATION_SLOT);
    expect(columns.length, `${BNBC_MODEL} carries columns standing on the stack to measure`).toBeGreaterThanOrEqual(MEMBERS);
    const members = columns.slice(0, MEMBERS);
    const levels = modelStoreys(BNBC_MODEL).filter((level) => members.some((member) => member.level === level.label));
    return stageRebarCampaign("bbs-view", members, { levels, detailing: APPLIED });
  })());

afterAll(async () => {
  await closeStage();
});

/** The coverage the rail stored for this campaign's rebar lines (L-QTY-03). */
function partlyDeclared(stage: RebarStage): number {
  return linesOf(stage).filter((line) => said(line, "coverage", "coverage") === PARTIAL_DECLARED).length;
}

/** A schedule as two schedules can be compared: its rows by key, and the totals that close it. */
function shapeOf(document: BbsDocumentShape): string {
  return JSON.stringify([
    [...document.rows].map((row) => [row.barKey, row.diameterMm, row.cuttingRawMm, row.bars, row.kg]).sort(),
    Object.entries(document.perDiameterKg).sort(),
    document.grandTotalKg,
    document.stockMm,
  ]);
}

describe("AC-2: the view S-BBS is drawn from is the project's own campaign, declared as its lines are", () => {
  test(
    "AC-2: a campaign nothing has measured yet has no schedule to show, and nothing partly declared",
    async () => {
      // The seam is asked for FIRST: a tree that has not written it yet fails by naming the file,
      // rather than spending minutes staging a campaign for nothing.
      const { bbsViewOf } = await serverModule();
      const { bbsStateOf } = await statesModule();
      const stage = await staged();

      expect(linesOf(stage).length, "nothing is measured yet, so this campaign has published no rebar line").toBe(0);
      const view = await bbsViewOf({ tenantId: stage.tenantId, projectId: stage.projectId });

      expect(view.partial, "and a view over no line declares nothing partly declared — the flag is the LINES' answer, not a default").toBe(partlyDeclared(stage) > 0);
      expect(view.document === null || view.document.rows.length === 0, "there is no bill of bars to draw yet").toBe(true);
      expect(bbsStateOf({ view, permitted: true }), "so a reader meets the empty cell, never an error and never a blank grid").toBe("empty");
    },
    BUDGET_MS,
  );

  test(
    "AC-2: measured, the view carries that campaign's own schedule and says PARTIAL exactly where its lines do",
    async () => {
      const { bbsViewOf } = await serverModule();
      const { bbsStateOf } = await statesModule();
      const stage = await staged();
      await measure(stage);

      const lines = linesOf(stage);
      expect(lines.length, "the measured campaign published one rebar line per member it holds (L-QTY-02)").toBe(stage.members.length);
      const partly = partlyDeclared(stage);
      expect(
        partly,
        "the staged campaign reaches a line the rail could only PARTLY declare — its tie zone states a spacing and no length, which nobody has transcribed. A campaign where none did could not tell a derived flag from a hard-coded one",
      ).toBeGreaterThan(0);

      const view = await bbsViewOf({ tenantId: stage.tenantId, projectId: stage.projectId });
      expect(view.campaignId, "the view reads the project's own campaign").toBe(stage.campaignId);
      expect(view.setRevisionId, "and names the revision that campaign is pinned to (R-TO-054)").toBe(stage.setRevisionId);
      expect(view.partial, `the view declares PARTIAL because ${partly} of this campaign's ${lines.length} rebar line(s) stored coverage ${PARTIAL_DECLARED} — the flag is derived from them (I-bbs-1)`).toBe(partly > 0);

      expect(view.document, "and it carries the campaign's bill of bars").not.toBeNull();
      const door = await bbsThroughDoor(stage);
      expect(door.rows.length, "the one door answered this campaign with bar rows").toBeGreaterThan(0);
      expect(shapeOf(view.document as BbsDocumentShape), "the schedule in the view is `bbsOf`'s own answer for that campaign — never a second reckoning beside it (goal, I-bbs-2)").toBe(shapeOf(door));

      expect(bbsStateOf({ view, permitted: true }), "so the screen a reader meets is the partly-declared one, rendered in full with its notice").toBe(partly > 0 ? "partial" : "ready");
    },
    BUDGET_MS,
  );
});
