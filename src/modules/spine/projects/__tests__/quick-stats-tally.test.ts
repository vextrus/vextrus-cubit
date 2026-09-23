/**
 * s-home I-36 as amended (session 7): the quick stats are COUNTED. The craft look found S-Home and
 * S-Project stating Sheets 0 / Campaigns 0 on a project holding a pinned set of eleven sheets and a
 * campaign, because the read counted four empty M0 arrays forever. The tally is judged here over the
 * rows the two reads answer, without a store: a project's sheets are the layouts of each drawing's
 * CURRENT record — the sheet index's own cards — and its campaigns are its campaign rows.
 */
import { expect, test } from "vitest";
import { tallied, type TalliedRecord } from "../read";

const BASHUNDHARA = "74281e82-6f49-4efc-bfa2-7d4431562cca";
const RIVERSIDE = "11111111-2222-4333-8444-555555555555";

/** A record whose inventory names `count` layouts. */
function record(projectId: string, drawingId: string, count: number): TalliedRecord {
  return { projectId, drawingId, facts: { layouts: Array.from({ length: count }, (_, at) => ({ name: `S-${String(at).padStart(2, "0")}`, kind: "paper" })) } };
}

test("a drawing's sheets are its current record's layouts — a superseded record is not counted again", () => {
  // Newest first, as the read orders them: the re-ingest of drawing A (12 layouts) stands, the
  // record it superseded (11) does not.
  const counted = tallied([record(BASHUNDHARA, "a", 12), record(BASHUNDHARA, "b", 3), record(BASHUNDHARA, "a", 11)], []);
  expect(counted.sheets.get(BASHUNDHARA), "12 from drawing A's current record, 3 from drawing B").toBe(15);
});

test("the counts are grouped by project, and a project holding nothing is absent — the screen states its honest zero", () => {
  const counted = tallied([record(BASHUNDHARA, "a", 12)], [{ projectId: BASHUNDHARA }, { projectId: BASHUNDHARA }]);
  expect(counted.sheets.get(BASHUNDHARA)).toBe(12);
  expect(counted.campaigns.get(BASHUNDHARA), "one row per campaign opened on the project").toBe(2);
  expect(counted.sheets.get(RIVERSIDE), "a project with no drawing has no sheet to count").toBeUndefined();
  expect(counted.campaigns.get(RIVERSIDE)).toBeUndefined();
});

test("a record that states no inventory contributes no sheet rather than failing the home", () => {
  const counted = tallied([{ projectId: BASHUNDHARA, drawingId: "a", facts: {} }], []);
  expect(counted.sheets.get(BASHUNDHARA)).toBe(0);
});
