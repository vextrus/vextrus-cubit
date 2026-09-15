/**
 * AC-2 — the three M2 level acts state their EFFECTS (R-TO-020, L-ACT-02, L-MEA-07, B-17).
 *
 * What a person confirms includes which stored quantity lines will re-derive: a Consequence now
 * names them, the digest binds them, and a commit carrying the digest of what was shown still lands.
 *
 * Nothing here freezes a line id or a count. The expected set is DERIVED from the store — the
 * campaign's published lines, joined to the register objects they were measured from, by the level
 * those objects stand on — so a stage that publishes another line grows the expectation with it
 * (B-19). The screen never re-derives a figure and neither does this suite.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  AUTHOR_STOREY_HEIGHT,
  INSERT_LEVEL,
  REPUDIATE_LEVEL,
  actsSeam,
  closeStage,
  heightReading,
  insertion,
  lineIdsOnLevels,
  liveStack,
  repudiation,
  stageLevelsUi,
  type StagedLevelsUi,
} from "./support/levels-ui-stage";
import { actorOf } from "../support/sheets-stage";

/** How long a staged campaign may take: the shipped seams, driven end to end, over one database. */
const BUDGET_MS = 900_000;

afterAll(async () => {
  await closeStage();
}, 120_000);

let staging: Promise<StagedLevelsUi> | undefined;
const staged = (): Promise<StagedLevelsUi> => (staging ??= stageLevelsUi("effects"));

/** The two slots an act's effects are stated in, read off the Consequence the seam answered. */
function effectsOf(consequence: Record<string, unknown>, where: string): { linesRederiving: string[]; signaturesVoiding: string[] } {
  const held = consequence["effects"];
  expect(held, `${where} states its effects — a stated nothing, never an absent field (R-TO-020): ${JSON.stringify(consequence)}`).toBeTypeOf("object");
  const effects = held as Record<string, unknown>;
  expect(Array.isArray(effects["linesRederiving"]), `${where} names the lines that re-derive as a list`).toBe(true);
  expect(Array.isArray(effects["signaturesVoiding"]), `${where} names the signatures it voids as a list`).toBe(true);
  return { linesRederiving: effects["linesRederiving"] as string[], signaturesVoiding: effects["signaturesVoiding"] as string[] };
}

/** The digest of one Consequence, taken by the product's own one home for it (L-ACT-02, B-17). */
const digestOf = async (consequence: Record<string, unknown>): Promise<string> => (await actsSeam()).consequenceDigest(consequence);

describe("AC-2: AUTHOR_STOREY_HEIGHT names the lines standing on the level it reads", () => {
  test("AC-2: the preview on a bearing level names exactly its lines, and on a bare level names none", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const actor = actorOf(it.person);

    const bearing = await acts.preview(actor, heightReading({ projectId: it.projectId, levelId: it.bearingLevelId, value: "3.2", unit: "m" }));
    const owed = lineIdsOnLevels(it, [it.bearingLevelId]);
    expect(owed.length, `the stage published lines standing on ${it.bearingLabel}, so the criterion has something to name`).toBeGreaterThan(0);
    expect(effectsOf(bearing, `${AUTHOR_STOREY_HEIGHT} on ${it.bearingLabel}`).linesRederiving, "every line of the project whose object stands on the level read, code-point sorted").toEqual(owed);
    expect(effectsOf(bearing, `${AUTHOR_STOREY_HEIGHT} on ${it.bearingLabel}`).signaturesVoiding, "and no signature voids until a signature table exists").toEqual([]);

    const bare = await acts.preview(actor, heightReading({ projectId: it.projectId, levelId: it.bareLevelId, value: "3.2", unit: "m" }));
    expect(effectsOf(bare, `${AUTHOR_STOREY_HEIGHT} on ${it.bareLabel}`).linesRederiving, `${it.bareLabel} bears no line, so the act names none`).toEqual([]);

    expect(
      await digestOf(bearing),
      "and the two consequences do not digest alike — what a person confirmed includes which lines would move",
    ).not.toBe(await digestOf(bare));
  }, BUDGET_MS);
});

describe("AC-2: REPUDIATE_LEVEL and INSERT_LEVEL name theirs too", () => {
  test("AC-2: repudiating a level names the lines standing on the level it marks", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const actor = actorOf(it.person);

    const marked = await acts.preview(actor, repudiation(it.projectId, it.bearingLevelId));
    expect(effectsOf(marked, `${REPUDIATE_LEVEL} on ${it.bearingLabel}`).linesRederiving, "the lines measured through the level a person judged to be nothing").toEqual(
      lineIdsOnLevels(it, [it.bearingLevelId]),
    );

    const bare = await acts.preview(actor, repudiation(it.projectId, it.bareLevelId));
    expect(effectsOf(bare, `${REPUDIATE_LEVEL} on ${it.bareLabel}`).linesRederiving, `${it.bareLabel} carries no line, so nothing re-derives`).toEqual([]);
  }, BUDGET_MS);

  test("AC-2: inserting mid-stack names the lines of every live level whose ordinal moves", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const actor = actorOf(it.person);
    const stack = await liveStack(it);

    /* An ordinal at the bottom moves every live level; one above the top moves none. The expected
       set is the lines of the levels that in fact move, read off the stack under test. */
    const lowest = Math.min(...stack.map((level) => level.ordinal));
    const highest = Math.max(...stack.map((level) => level.ordinal));

    const mid = await acts.preview(actor, insertion(it.projectId, [{ label: "MEZZ", ordinal: lowest }]));
    const moved = stack.filter((level) => level.ordinal >= lowest).map((level) => level.levelId);
    expect(effectsOf(mid, `${INSERT_LEVEL} at ${lowest}`).linesRederiving, "every line standing on a level the insert moves up one").toEqual(lineIdsOnLevels(it, moved));

    const above = await acts.preview(actor, insertion(it.projectId, [{ label: "ROOF", ordinal: highest + 1 }]));
    expect(effectsOf(above, `${INSERT_LEVEL} at ${highest + 1}`).linesRederiving, "a level inserted above the stack moves nothing, so nothing re-derives").toEqual([]);
  }, BUDGET_MS);

  test("AC-2: a commit carrying the digest of the Consequence it was shown still lands", async () => {
    const it = await staged();
    const acts = await actsSeam();
    const actor = actorOf(it.person);
    const input = heightReading({ projectId: it.projectId, levelId: it.bearingLevelId, value: "3.111", unit: "m" });

    const shown = await acts.preview(actor, input);
    effectsOf(shown, `${AUTHOR_STOREY_HEIGHT} before the commit`);
    const performed = await acts.commit(actor, input, acts.consequenceDigest(shown));
    expect(typeof performed["actId"], `a commit carrying the digest of what was shown lands: ${JSON.stringify(performed)}`).toBe("string");
  }, BUDGET_MS);
});
