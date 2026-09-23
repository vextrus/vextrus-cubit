// @vitest-environment node
/**
 * DB LANE — a struck object bills nothing: REPUDIATE withholds its lines from the draft BOQ and its
 * bar rows from the bar schedule, and deletes neither (R-TO-051, L-ACT-01; s-takeoff I-173,
 * s-boq I-449).
 *
 * A small campaign of the fixture's own columns is staged and measured through the shipped doors —
 * the rebar rail publishes a line per member and stores its bar rows — and then one member is
 * struck through the act seam, exactly as the register's inspector strikes one. What is graded is
 * what every bill reader answers afterwards: `boqViewOf` (the screen, the PDF and the workbook read
 * this one reading) and `bbsOf` (the schedule, its totals and its cutting list). The store is read
 * too, because a repudiation is a reading of the record and never a deletion of it: the struck
 * member's line and bar rows must still be there, withheld rather than gone.
 *
 * This suite opens a live database, so it is the DATABASE lane's (derived from its imports,
 * scripts/lib/pg-suites.mjs); nothing here measures time (AM-10 §3).
 */
import { afterAll, describe, expect, test } from "vitest";
import { performAct, productModule } from "../gate/support/gate-stage";
import {
  BNBC_MODEL,
  FOUNDATION_SLOT,
  bbsThroughDoor,
  closeStage,
  columnMembersOf,
  detailingStating,
  field,
  linesOf,
  measure,
  modelStoreys,
  stageRebarCampaign,
  type RebarStage,
} from "../rails/rebar/support/rebar-stage";

/** Staging and measuring a campaign is minutes of real work; the reading is all this suite grades. */
const BUDGET_MS = 900_000;

/** How many of the fixture's columns are measured: enough that one struck member leaves others standing. */
const MEMBERS = 3;

/** The detailing the fixture's own general notes state (the band suite's own reading). */
const APPLIED = detailingStating({ lapMultiplier: 50, fyMPa: 500, fcPsi: 3500, hook: { multiplier: 10, minimumMm: 75 } });

/** The act a person strikes an object with (R-TO-051). */
const REPUDIATE = "REPUDIATE";

/** What the draft is read through (test contract: `boqViewOf`). */
type DraftLine = { lineId: string; objectKey: string };
type DraftView = {
  payload: { sections: { groups: { lines: DraftLine[] }[] }[]; unclassified: { lines: DraftLine[] } } | null;
  items: ReadonlyMap<string, string>;
};
type BoqServer = { boqViewOf(scope: { tenantId: string; projectId: string }): Promise<DraftView> };
const boqServer = (): Promise<BoqServer> => productModule<BoqServer>("src/modules/takeoff/boq/server.ts");

/** Every line a draft lists, placed or kept. */
function draftLinesOf(view: DraftView): DraftLine[] {
  if (view.payload === null) return [];
  return [...view.payload.sections.flatMap((section) => section.groups.flatMap((group) => group.lines)), ...view.payload.unclassified.lines];
}

let ground: Promise<RebarStage> | undefined;

/** A campaign over a few of the fixture's columns, staged and measured once. */
const staged = (): Promise<RebarStage> =>
  (ground ??= (async () => {
    const columns = columnMembersOf(BNBC_MODEL).filter((member) => member.level !== FOUNDATION_SLOT);
    expect(columns.length, `${BNBC_MODEL} carries columns standing on the stack to measure`).toBeGreaterThanOrEqual(MEMBERS);
    const members = columns.slice(0, MEMBERS);
    const levels = modelStoreys(BNBC_MODEL).filter((level) => members.some((member) => member.level === level.label));
    const stage = await stageRebarCampaign("boq-struck", members, { levels, detailing: APPLIED });
    await measure(stage);
    return stage;
  })());

afterAll(async () => {
  await closeStage();
});

describe("I-449: a struck object bills nothing, and nothing is deleted", () => {
  test(
    "I-449: the draft BOQ and the bar schedule list the member before it is struck, and withhold it after",
    async () => {
      const { boqViewOf } = await boqServer();
      const stage = await staged();
      const struck = String(field(stage.objects[0] as Record<string, unknown>, "objectKey", "object_key"));
      expect(struck, "the first staged member has an object key to strike").not.toBe("");

      /* --- before: the member is billed on both --- */
      const before = await boqViewOf(stage.scope);
      const lines = draftLinesOf(before);
      expect(lines.some((line) => line.objectKey === struck), `the draft lists ${struck}'s line while it stands`).toBe(true);
      const bars = await bbsThroughDoor(stage);
      expect(bars.rows.some((row) => row.objectKey === struck), `the bar schedule lists ${struck}'s bars while it stands`).toBe(true);
      const kept = linesOf(stage).filter((row) => String(field(row, "objectKey", "object_key")) === struck).length;
      expect(kept, `the measure run published a line for ${struck}`).toBeGreaterThan(0);

      /* --- a person strikes it, through the one act seam --- */
      await performAct(stage.actor, { type: REPUDIATE, projectId: stage.projectId, objectKey: struck });

      /* --- after: the draft and the schedule read past it --- */
      const after = await boqViewOf(stage.scope);
      const left = draftLinesOf(after);
      expect(left.some((line) => line.objectKey === struck), `the draft lists no line of ${struck}: nothing is priced off an object the register says is nothing (I-173)`).toBe(false);
      expect(left.length, "and every other member's lines stand exactly as they did").toBe(lines.filter((line) => line.objectKey !== struck).length);
      for (const line of left) expect(after.items.has(line.lineId), `${line.lineId} is numbered on the draft that remains`).toBe(true);

      const schedule = await bbsThroughDoor(stage);
      expect(schedule.rows.some((row) => row.objectKey === struck), `the bar schedule lists no bar of ${struck}`).toBe(false);
      expect(schedule.rows.length, "and every other member's bars stand exactly as they did").toBe(bars.rows.filter((row) => row.objectKey !== struck).length);
      expect(schedule.rows.length, "the members left standing still have a schedule").toBeGreaterThan(0);

      /* --- nothing was deleted: the struck member's line stays on record (L-ACT-01) --- */
      expect(
        linesOf(stage).filter((row) => String(field(row, "objectKey", "object_key")) === struck).length,
        `${struck}'s line stays in the store — withheld from every bill, never deleted`,
      ).toBe(kept);
    },
    BUDGET_MS,
  );
});
