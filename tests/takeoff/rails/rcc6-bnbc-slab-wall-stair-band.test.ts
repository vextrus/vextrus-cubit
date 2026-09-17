/**
 * AC-7 — F-RCC6-BNBC's slabs, shear walls and stairs inside L-QTY-06's band, per (class, kind, level),
 * through the rails BARREL (AM-01, L-QTY-06, L-MEA-08, AM-11).
 *
 * The band here is taken over readings TRANSCRIBED from the fixture's own authored model, not over an
 * ingest of it: reading a panel off the entity graph is the plan reader's leaf, and this one ships the
 * reading vocabulary. Every reading is derived from the member's own facts by the stage's
 * `bnbcPlans` — nothing about the fixture is typed into this file, so a regenerated fixture is judged
 * by its own numbers (B-19, L-QTY-06: "an input may never be derived from the figure it is compared
 * with").
 *
 * The rails are reached through `RAILS`, never through the area's own file: two areas answer
 * `rcc.concrete` and `rcc.formwork`, so what must measure the campaign is the COMPOSITION the barrel
 * builds (`enumerateRails`) — a band taken over this area's rail alone would pass while the roster
 * silently dropped one of them (AM-11, riskNotes: roster composition).
 */
import { afterAll, describe, expect, test } from "vitest";
import {
  BNBC_FIXTURE,
  RCC_CONCRETE,
  RCC_FORMWORK,
  RULE,
  SHEAR_WALL,
  SLAB,
  SLAB_DROP,
  STAIR,
  bnbcModel,
  bnbcPlans,
  bnbcStack,
  canon,
  carriedInto,
  closeStage,
  frameRails,
  gateSeam,
  goldenPrintingAllowance,
  goldenRowsAt,
  goldenSum,
  insideBand,
  linesFor,
  linesOf,
  railInput,
  railsLaw,
  railsRoster,
  registerPlanObjects,
  said,
  setupWith,
  slabsRails,
  stageSlabWallStairCampaign,
  sumOf,
  type Canon,
  type MeasureShape,
  type OfferShape,
  type RailInputShape,
  type RailShape,
  type SlabWallStairCampaign,
  type StoreRow,
  type VerdictShape,
} from "./support/slab-wall-stair-stage";

afterAll(async () => {
  await closeStage();
});

/** The levels AC-7 reconciles for every class. */
const LEVELS: readonly string[] = ["GF", "1F", "2F", "3F", "4F", "5F", "6F", "ROOF"];

/** The one further level a shear wall stands on — the foundation, below the ground floor. */
const WALL_ONLY_LEVEL = "FDN";

/** The three classes and the two kinds the band is taken per. */
const CLASSES: readonly string[] = [SLAB, SHEAR_WALL, STAIR];
const KINDS: readonly string[] = [RCC_CONCRETE, RCC_FORMWORK];

/** One drop wall the transcription states, with the register row it was registered as. */
type StagedDrop = { placementKey: string; objectKey: string; length: MeasureShape; breadth: MeasureShape; height: MeasureShape };

type Measured = {
  it: SlabWallStairCampaign;
  verdict: VerdictShape;
  published: Map<string, string[]>;
  units: Canon;
  levelOf: Map<string, string>;
  /** The one input per kind every area that answers it was handed — the same object, unchanged. */
  inputs: Map<string, RailInputShape>;
  /** Every SLAB_DROP of the transcription, so the drop rules are bound by their own figure (AC-7). */
  drops: StagedDrop[];
};

let measured: Measured;
let loading: Promise<Measured> | undefined;

/**
 * The case, staged once and shared. It is built INSIDE the tests rather than in a `beforeAll`, so a
 * product surface that does not exist yet fails each criterion's own assertion by name — a hook that
 * throws reports a suite that never ran, which reads as a defect in the acceptance rather than as the
 * red it is.
 */
const load = (): Promise<Measured> => (loading ??= build());

/** How long a case may take to stage before it is measured. */
const STAGING_BUDGET = 1_800_000;

async function build(): Promise<Measured> {
  const units = await canon();
  const stack = bnbcStack(units);
  const it = await stageSlabWallStairCampaign("bnbc", stack);

  // Every SLAB and STAIR member at the levels AC-7 names, and every SHEAR_WALL at those and at FDN.
  const drafts = bnbcPlans([...LEVELS, WALL_ONLY_LEVEL], units).filter((draft) => draft.level !== WALL_ONLY_LEVEL || draft.elementType === SHEAR_WALL);
  expect(drafts.length, "the fixture's own model states members of these classes at these levels to measure").toBeGreaterThan(0);

  const { objects, plans } = await registerPlanObjects(it, drafts);
  const setup = setupWith(it, { plans });
  const inputs = new Map(KINDS.map((kind) => [kind, railInput(it, kind, setup)]));

  // The drop walls, keyed to the register rows they were registered as, with the readings the
  // transcription derived from the fixture's own polygons — the drop rules are graded against these,
  // never against the golden they are one term of (L-QTY-06, B-19).
  const drops: StagedDrop[] = drafts.flatMap((draft, at) =>
    draft.reading.member === SLAB_DROP
      ? [{ placementKey: draft.placementKey, objectKey: (objects[at] as { objectKey: string }).objectKey, length: draft.reading.length, breadth: draft.reading.breadth, height: draft.reading.height }]
      : [],
  );

  const rails = await railsRoster();
  const offers: OfferShape[] = [];
  for (const kind of KINDS) {
    const rail = rails[kind];
    expect(typeof rail, `\`RAILS\` answers ${kind} — the barrel composes every area that measures it (AM-11, interfaces)`).toBe("function");
    offers.push(...(rail as RailShape)(inputs.get(kind) as RailInputShape).offers);
  }

  const gate = await gateSeam();
  const verdict = await gate.evaluateOffers(it.gateScope, { offers, observations: [] });

  const levelOf = new Map(it.objects.map((object) => [object.objectKey, object.levelLabel]));
  const published = new Map<string, string[]>();
  for (const kind of KINDS) {
    for (const row of linesOf(it, kind)) {
      const value = said(row, "value", "value");
      if (value === "null") continue;
      const key = `${said(row, "class", "class")}|${kind}|${String(levelOf.get(said(row, "objectKey", "object_key")))}`;
      published.set(key, [...(published.get(key) ?? []), value]);
    }
  }
  measured = { it, verdict, published, units, levelOf, inputs, drops };
  return measured;
}

/** The exact sum of the values published at one (class, kind, level) — S (L-QTY-06: row sums, never a printed total). */
function publishedSum(klass: string, kind: string, level: string): string {
  return sumOf(measured.published.get(`${klass}|${kind}|${level}`) ?? [], measured.units);
}

/**
 * Is every SLAB panel of this level bearing on the ground?
 *
 * A slab on grade forms EDGES ONLY, and the golden's edge figure is `free edges · t + opening reveals · t`
 * — and opening reveals are named out of this leaf's scope. Where every panel of a level is on grade
 * there is nothing else in that level's formwork figure for this leaf to reach, so the under-band is
 * not a statement it can make there. Read from the model, so the carve-out moves with the fixture
 * rather than naming a level (B-19).
 */
function allPanelsOnGround(level: string): boolean {
  const panels = bnbcModel().members.filter((member) => member.class === "SLAB" && member.level === level);
  return panels.length > 0 && panels.every((member) => member.on_ground === true);
}

describe("AC-7: the campaign measured through the barrel", () => {
  test("AC-7: the gate refused nothing, and the batch published lines of both kinds", async () => {
    await load();
    expect(measured.verdict.refusals, `every offer the composed rails made was to the gate's contract: ${JSON.stringify(measured.verdict.refusals.slice(0, 8))}`).toEqual([]);
    for (const kind of KINDS) {
      expect(linesOf(measured.it, kind).length, `the campaign published ${kind} lines over the fixture's members (L-MEA-08)`).toBeGreaterThan(0);
    }
  }, STAGING_BUDGET);

  test("AC-7: the golden this band is taken against names both kinds — neither yardstick is an empty row set", async () => {
    await load();
    for (const kind of KINDS) {
      const rows = CLASSES.flatMap((klass) =>
        (klass === SHEAR_WALL ? [WALL_ONLY_LEVEL, ...LEVELS] : [...LEVELS]).flatMap((level) => goldenRowsAt(BNBC_FIXTURE, klass, kind, level)),
      );
      expect(
        rows.length,
        `fixtures/rcc6-bnbc/takeoff.golden.json records ${kind} rows over the classes and levels AC-7 reconciles — a band taken against no rows is no band: G would collapse to zero and "0.97 × G ≤ S ≤ G" would demand that a correct figure be suppressed (L-QTY-06, arbitration on the stage's translation)`,
      ).toBeGreaterThan(0);
    }
  }, STAGING_BUDGET);

  test("AC-7: every published line provenances to a register object this case staged on a level it named", async () => {
    await load();
    for (const kind of KINDS) {
      for (const row of linesOf(measured.it, kind)) {
        expect(
          measured.levelOf.get(said(row, "objectKey", "object_key")),
          `the line for ${said(row, "objectKey", "object_key")} stands on one of the levels this case registered — a sum grouped by a level nobody staged is a sum of nothing (L-QTY-03)`,
        ).toBeTruthy();
      }
    }
  }, STAGING_BUDGET);
});

/** The one line of a kind for one staged row, asserted to be exactly one. */
function oneDropLine(kind: string, drop: StagedDrop): StoreRow {
  const rows = linesFor(measured.it, kind, drop.objectKey);
  expect(
    rows.length,
    `the drop wall ${drop.placementKey} published exactly one ${kind} line: a sunken panel is set down by walls that are concreted and formed like any other member, so a rail that answers nothing for a SLAB_DROP reading leaves a real quantity unmeasured (R-TO-032, AM-06 §3); it published ${JSON.stringify(rows.map((row) => said(row, "ruleId", "rule_id")))}`,
  ).toBe(1);
  return rows[0] as StoreRow;
}

describe("AC-7: the sunken drops, measured by their own rules", () => {
  /**
   * The drop half of the level band is small enough to hide inside ±3%, so it is bound HERE by the
   * reading's own product rather than through the level sum: `length × breadth × height` of concrete
   * and two faces of formwork, from the polygon perimeter the transcription derived (interfaces:
   * rcc.slab.drop.concrete, rcc.slab.drop.formwork). Nothing of the golden enters this claim.
   */
  test("AC-7: each drop's concrete is its own L × B × H, under `rcc.slab.drop.concrete`", async () => {
    await load();
    const { units } = measured;
    expect(measured.drops.length, "the fixture's model states sunken panels, so the transcription states drop walls to measure (AC-7)").toBeGreaterThan(0);

    for (const drop of measured.drops) {
      const length = carriedInto(drop.length, "m", units);
      const breadth = carriedInto(drop.breadth, "m", units);
      const height = carriedInto(drop.height, "m", units);
      const owed = units.exact(length).mul(units.exact(breadth)).mul(units.exact(height)).toString();

      const row = oneDropLine(RCC_CONCRETE, drop);
      expect(said(row, "ruleId", "rule_id"), `${drop.placementKey} is measured under the drop's own concrete rule (interfaces)`).toBe(RULE.dropConcrete);
      expect(
        units.exact(said(row, "value", "value")).eq(units.exact(owed)),
        `${drop.placementKey}: ${length} m × ${breadth} m × ${height} m is ${owed} m3 — the drop the reading states, in exact decimals (L-FRM-02, B-07); the line states ${said(row, "value", "value")}`,
      ).toBe(true);
      expect(said(row, "unit", "unit"), "in the canonical unit of VOLUME (L-FRM-06)").toBe(units.CANONICAL_UNIT["VOLUME"]);
    }
  }, STAGING_BUDGET);

  test("AC-7: each drop's formwork is its two faces, 2 × L × H, under `rcc.slab.drop.formwork`", async () => {
    await load();
    const { units } = measured;
    expect(measured.drops.length, "the fixture's model states sunken panels, so the transcription states drop walls to form (AC-7)").toBeGreaterThan(0);

    for (const drop of measured.drops) {
      const length = carriedInto(drop.length, "m", units);
      const height = carriedInto(drop.height, "m", units);
      const owed = units.exact("2").mul(units.exact(length)).mul(units.exact(height)).toString();

      const row = oneDropLine(RCC_FORMWORK, drop);
      expect(said(row, "ruleId", "rule_id"), `${drop.placementKey} is formed under the drop's own formwork rule (interfaces)`).toBe(RULE.dropFormwork);
      expect(
        units.exact(said(row, "value", "value")).eq(units.exact(owed)),
        `${drop.placementKey}: 2 × ${length} m × ${height} m is ${owed} m2 — both faces of the drop wall (L-FRM-03); the line states ${said(row, "value", "value")}`,
      ).toBe(true);
      expect(said(row, "unit", "unit"), "in the canonical unit of AREA (L-FRM-06)").toBe(units.CANONICAL_UNIT["AREA"]);
    }
  }, STAGING_BUDGET);
});

describe("AC-7: the barrel these kinds were measured through loses no area", () => {
  /**
   * AC-7 measures "through the barrel, so the frame area's rails run in the same composition". That is
   * a claim about `RAILS` and not about this area: a kind two areas answer must be answered by the
   * COMPOSITION of both, in enumeration order — never by whichever roster was spread last, which would
   * claim a kind is measured while half of it never is (AM-11, settled ruling).
   *
   * What AM-11 requires of the barrel is that every area roster be ASSEMBLED BY ENUMERATION, and what
   * it forbids is re-declaration; it prescribes no syntactic form for the assembly. So an area roster
   * passed to the registry's own enumerator (`enumerateRails([...])`) is enumerated as fully as a
   * spread property ever was, and a check that reads spreads alone is asking for a form the clause
   * does not name — while the spread it would restore is last-writer-wins and loses an area in silence
   * (arbitration on F-1 REGISTRY_ENTRY_LOST). This case therefore asserts the assembly by DRIVING it:
   * every area's offers for a shared kind reach the barrel's batch, in enumeration order. A roster
   * imported but left out of the initializer — a real lost entry — fails here by the offers that go
   * missing, whatever shape the initializer takes.
   *
   * The kinds the claim is made over are the ones the two rosters BOTH answer, read off the rosters
   * themselves, so an area that comes to answer a third kind is judged by the same law (B-19).
   */
  test("AC-7: `RAILS` answers each kind both areas answer with the two areas' batches concatenated", async () => {
    await load();
    const rails = await railsRoster();
    const frame = await frameRails();
    const slabs = await slabsRails();
    const law = await railsLaw();

    const shared = Object.keys(slabs)
      .filter((kind) => Object.hasOwn(frame, kind))
      .sort();
    expect(
      shared,
      "both kinds this leaf measures are answered by the frame area too — a column and a slab are both concreted and both formed (L-MEA-04's `bears`, AM-11)",
    ).toStrictEqual([...KINDS].sort());

    const enumerated = law.enumerateRails([frame, slabs]);
    for (const kind of shared) {
      const input = measured.inputs.get(kind) as RailInputShape;
      const composed = rails[kind];
      expect(typeof composed, `\`RAILS\` answers ${kind}`).toBe("function");
      expect(
        composed === frame[kind] || composed === slabs[kind],
        `the barrel's ${kind} is neither area's own function: two areas answer it, so it is a composition of both and not the one a merge kept — restoring a spread here makes one area's rail the value at this key and drops the other area's offers with no refusal and no observation (AM-11, L-MEA-08, settled ruling; arbitration on F-1)`,
      ).toBe(false);

      const batches = [frame[kind] as RailShape, slabs[kind] as RailShape].map((rail) => rail(input));
      const offers = batches.flatMap((batch) => [...batch.offers]);
      const observations = batches.flatMap((batch) => [...batch.observations]);
      const answered = (composed as RailShape)(input);

      expect(
        answered.offers,
        `over the very input AC-7 was measured with, the barrel's ${kind} answers the frame's offers then this area's, whole and in enumeration order — a barrel that lost an area or reordered it would publish a different bill from the same drawings (AM-11)`,
      ).toStrictEqual(offers);
      expect(answered.observations, `and their observations likewise, in the same order (interfaces)`).toStrictEqual(observations);

      const byLaw = enumerated[kind] as RailShape;
      expect(typeof byLaw, `\`enumerateRails\` answers ${kind} for the two rosters it was handed (interfaces)`).toBe("function");
      expect(byLaw(input).offers, `and the barrel's answer is the law's own — \`enumerateRails\` is what composes the areas, not a merge written beside it (AM-11)`).toStrictEqual(offers);
    }
  }, STAGING_BUDGET);
});

describe("AC-7: L-QTY-06's band, per (class, kind, level), against the fixture's golden takeoff", () => {
  for (const klass of CLASSES) {
    for (const kind of KINDS) {
      for (const level of klass === SHEAR_WALL ? [WALL_ONLY_LEVEL, ...LEVELS] : LEVELS) {
        test(`AC-7: ${klass} ${kind} at ${level}`, async () => {
          await load();
          const { units } = measured;
          const rows = goldenRowsAt(BNBC_FIXTURE, klass, kind, level);
          const sum = publishedSum(klass, kind, level);

          if (rows.length === 0) {
            // The golden names no such row, so the fixture holds no such member: the answer owed is
            // silence. A line published where a competent takeoff records none is an over-measure,
            // which L-QTY-04 makes a hard block rather than a disclosure.
            expect(
              units.exact(sum).eq(units.exact("0")),
              `the golden records no ${klass} ${kind} at ${level}, so the campaign publishes none — it published ${sum}`,
            ).toBe(true);
            return;
          }

          const golden = goldenSum(BNBC_FIXTURE, klass, kind, level, units);
          const allowance = goldenPrintingAllowance(BNBC_FIXTURE, klass, kind, level, units);
          const over = `${sum} against the golden's ${golden} (${rows.length} row(s); each side is widened by ${allowance}, the golden's own printed half-unit)`;

          expect(
            units.exact(sum).lte(units.exact(golden).add(units.exact(allowance))),
            `${klass} ${kind} at ${level} is not over a competent manual takeoff — L-QTY-06 allows +0% over: ${over}`,
          ).toBe(true);

          if (kind === RCC_FORMWORK && klass === SLAB && allPanelsOnGround(level)) {
            // Every panel of this level bears on the ground, so its whole golden formwork figure is
            // the EDGE term — which includes the opening reveals this leaf's scope excludes. The
            // over-measure half above still binds; the under-band is the reveals leaf's to earn.
            expect(
              measured.published.has(`${klass}|${kind}|${level}`),
              `every slab on grade at ${level} is still measured for formwork — its edges are formed even where its soffit is not (AM-06 §3)`,
            ).toBe(true);
            return;
          }

          expect(insideBand(sum, golden, allowance, units), `${klass} ${kind} at ${level} is no more than three per cent under a competent manual takeoff: ${over}`).toBe(true);
        }, STAGING_BUDGET);
      }
    }
  }
});
