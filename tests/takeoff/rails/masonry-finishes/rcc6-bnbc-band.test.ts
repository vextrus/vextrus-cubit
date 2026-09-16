/**
 * AC-5 — F-RCC6-BNBC's brickwork, measured through the shipped doors and reconciled with the golden
 * takeoff per (class, kind, level, thickness) (AM-01, AM-07, L-MEA-02, L-QTY-06, R-TO-035).
 *
 * The campaign is real: a workspace, a project pinned to an edition citing this shard's three
 * methods, a live 1F–6F stack, one register object per brick wall of the fixture's own model, the
 * walls' readings staged from the model's own figures with the one scheduled opening the model
 * states, the brickwork rail run over those rows through the BARREL, and one batch handed to the
 * gate (procedure F-RCC6-BNBC-MASONRY).
 *
 * What is graded is L-QTY-06's band per golden row: three per cent under the competent manual
 * takeoff, and never over it. The rows are the golden's own — derived from the file, never a list
 * typed here — and the comparand is the golden's figure read as the PRINTED figure it is (a file
 * that writes 29.749 measured something in [29.7485, 29.7495]; the yardstick is the takeoff, not the
 * string the fixture rounds it to).
 *
 * The component a row is keyed by is a THICKNESS IN MILLIMETRES, and the lines are matched to it by
 * carrying each line's own `thickness` selector through the canon — never by reading a band off it:
 * L-MEA-06 bars a band from reaching the line at all, and the last case here says so by name.
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BNBC_MODEL,
  BRICK_WALL,
  BRICK_WALL_VOLUME_RULE_ID,
  COMPLETE,
  GOLDEN_CLASS,
  GOLDEN_KIND,
  MASONRY_BRICKWORK,
  MILLIMETRE,
  MILLIMETRE_SQUARED,
  RCC6_FIXTURE,
  TRANSCRIBED,
  UNDER_TOLERANCE,
  bnbcBrickWalls,
  canon,
  closeStage,
  evaluate,
  goldenBrickworkRows,
  goldenFigure,
  goldenRows,
  inMillimetres,
  opening,
  publishedLines,
  railBatchOf,
  reading,
  stageMasonryCampaign,
  wall,
  type DecimalLike,
  type GoldenRow,
  type MasonryStage,
  type PublishedLine,
  type StagedMember,
  type VerdictShape,
} from "./support/masonry-stage";

let stage: MasonryStage;
let verdict: VerdictShape;
let lines: PublishedLine[];
let staging: Promise<void> | undefined;

/** One brick wall of the model, staged as the procedure states it — the model's own figures. */
function stagedFrom(member: ReturnType<typeof bnbcBrickWalls>[number]): StagedMember {
  const at = (field: string): string => `${BNBC_MODEL}#${member.id}.${field}`;
  return {
    id: member.id,
    class: BRICK_WALL,
    mark: member.mark,
    level: member.level,
    wall: wall({
      length: reading(String(member.length), MILLIMETRE, { basis: TRANSCRIBED, source: at("length") }),
      height: reading(String(member.h), MILLIMETRE, { basis: TRANSCRIBED, source: at("h") }),
      thickness: reading(String(member.t), MILLIMETRE, { basis: TRANSCRIBED, source: at("t") }),
      openings: [
        opening({
          mark: member.mark,
          area: reading(String(member.openings), MILLIMETRE_SQUARED, { basis: TRANSCRIBED, source: at("openings") }),
          count: "1",
          floors: null,
          countBasis: TRANSCRIBED,
          source: at("openings"),
        }),
      ],
    }),
  };
}

/**
 * The corpus, staged and measured once, and awaited by every case.
 *
 * Lazy rather than a hook on purpose: a module the Builder has not written yet must fail the CASE
 * that needed it, by name — a throwing hook leaves every case skipped, and judges nothing.
 */
const staged = (): Promise<void> =>
  (staging ??= (async () => {
    const members = bnbcBrickWalls().map(stagedFrom);
    stage = await stageMasonryCampaign("bnbc-masonry", members);
    verdict = await evaluate(stage, await railBatchOf(stage, [MASONRY_BRICKWORK]));
    lines = publishedLines(stage);
  })());

afterAll(async () => {
  await closeStage();
});

/** The brickwork lines this campaign published, all of them under this leaf's one rule. */
function brickworkLines(): PublishedLine[] {
  return lines.filter((line) => line.kind === MASONRY_BRICKWORK);
}

describe("AC-5: F-RCC6-BNBC's brickwork stands inside L-QTY-06's band, per level and thickness", () => {
  test("AC-5: every offer published — nothing refused, and no line partial", async () => {
    await staged();
    expect(verdict.refused, `every offer published (the gate refused ${JSON.stringify(verdict.refusals)})`).toBe(0);
    const published = brickworkLines();
    expect(published.length, "the campaign published a brickwork line for every wall the fixture states").toBe(bnbcBrickWalls().length);
    for (const line of published) {
      expect(line.coverage, `${line.objectKey} is COMPLETE — L-QTY-06 reconciles only under complete coverage, and a deferral here would be a cell that quietly stopped measuring`).toBe(COMPLETE);
      expect(line.ruleId, "and stands under this leaf's own rule (L-MEA-01)").toBe(BRICK_WALL_VOLUME_RULE_ID);
      expect(line.class, "borne by the class the relation names (L-MEA-04)").toBe(BRICK_WALL);
    }
  }, 1_800_000);

  test("AC-5: each golden row reconciles with the lines of its level and thickness — three per cent under, never over", async () => {
    await staged();
    const { exact } = await canon();
    const rows = goldenBrickworkRows();
    expect(rows.length, "the BNBC golden carries the brickwork rows this leaf reconciles against").toBeGreaterThan(0);

    // And the reconciliation is against THIS fixture alone: F-RCC6 is byte-frozen at v1.1 and is
    // the fast regression lane, so this leaf adds no masonry row to it (AM-01, fixtures).
    expect(
      goldenRows(RCC6_FIXTURE).filter((row: GoldenRow) => row.kind === GOLDEN_KIND[MASONRY_BRICKWORK] || row.class === GOLDEN_CLASS[BRICK_WALL]),
      "F-RCC6 asserts nothing on masonry — `pnpm test:golden` stays green because the frozen fixture is untouched by this leaf",
    ).toEqual([]);

    for (const row of rows) {
      const owed = goldenFigure(row, exact as (value: string) => DecimalLike);
      const component = exact(String(row.component));
      const held: PublishedLine[] = [];
      for (const line of brickworkLines()) {
        if (line.level !== row.level) continue;
        const selector = line.selectors["thickness"];
        const carried = await inMillimetres(String(selector?.value), String(selector?.unit));
        if (carried !== null && carried.eq(component)) held.push(line);
      }
      expect(
        held.length,
        `the campaign published a line of ${row.level} whose thickness canonicalises to ${String(row.component)} mm — the golden keys this row by it (it published ${JSON.stringify(
          brickworkLines().map((line) => [line.level, line.selectors["thickness"]?.value, line.selectors["thickness"]?.unit]),
        )})`,
      ).toBeGreaterThan(0);

      let sum = exact("0");
      for (const line of held) {
        expect(line.value, `${line.objectKey} carries a figure — a COMPLETE row always does (L-QTY-02)`).not.toBeNull();
        sum = sum.add(exact(String(line.value)));
      }
      expect(
        owed.printed.mul(exact(UNDER_TOLERANCE)).lte(sum),
        `${GOLDEN_CLASS[BRICK_WALL]} × ${GOLDEN_KIND[MASONRY_BRICKWORK]} × ${row.level} × ${String(row.component)}: ${sum.toString()} is no more than three per cent under the golden ${owed.said} (L-QTY-06)`,
      ).toBe(true);
      expect(
        sum.lte(owed.printed.add(owed.halfUlp)),
        `${GOLDEN_CLASS[BRICK_WALL]} × ${GOLDEN_KIND[MASONRY_BRICKWORK]} × ${row.level} × ${String(row.component)}: ${sum.toString()} is not over the golden ${owed.said} — L-QTY-06 allows +0% over, and an over-measured figure is never a disclosure (L-QTY-04)`,
      ).toBe(true);
    }
  }, 900_000);

  test("AC-5: the thickness reaches the line as the reading it was written as, and no selector is a band", async () => {
    await staged();
    const written = new Map(bnbcBrickWalls().map((member) => [member.id, String(member.t)]));
    for (const line of brickworkLines()) {
      const selector = line.selectors["thickness"];
      expect(selector, `${line.objectKey} carries the thickness that selects its item (L-QTY-03)`).toBeTruthy();
      expect(
        [...written.values()],
        `and carries it AS WRITTEN — \`250\` or \`125\` in the unit the model states, never a band (L-MEA-06: store \`clear height 6.2 m\`, never \`band: 3\`); it carried ${JSON.stringify(selector)}`,
      ).toContain(String(selector?.value));
      expect(selector?.unit, "in the unit the model wrote it in").toBe(MILLIMETRE);
      expect(
        Object.keys(line.selectors),
        `no selector of ${line.objectKey} is a band — the pricing seam bands, the line records (L-MEA-06)`,
      ).not.toContain("band");
    }
  }, 900_000);
});
