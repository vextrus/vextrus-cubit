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
  SHEAR_WALL,
  SLAB,
  STAIR,
  bnbcModel,
  bnbcPlans,
  bnbcStack,
  canon,
  closeStage,
  gateSeam,
  goldenPrintingAllowance,
  goldenRowsAt,
  goldenSum,
  insideBand,
  linesOf,
  railInput,
  railsRoster,
  registerPlanObjects,
  said,
  setupWith,
  stageSlabWallStairCampaign,
  sumOf,
  type Canon,
  type OfferShape,
  type SlabWallStairCampaign,
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

type Measured = { it: SlabWallStairCampaign; verdict: VerdictShape; published: Map<string, string[]>; units: Canon; levelOf: Map<string, string> };

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

  const { plans } = await registerPlanObjects(it, drafts);
  const setup = setupWith(it, { plans });

  const rails = await railsRoster();
  const offers: OfferShape[] = [];
  for (const kind of KINDS) {
    const rail = rails[kind];
    expect(typeof rail, `\`RAILS\` answers ${kind} — the barrel composes every area that measures it (AM-11, interfaces)`).toBe("function");
    offers.push(...(rail as (input: ReturnType<typeof railInput>) => { offers: readonly OfferShape[] })(railInput(it, kind, setup)).offers);
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
  measured = { it, verdict, published, units, levelOf };
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
          const over = `${sum} against the golden's ${golden} (${rows.length} row(s), ±${allowance} for the figures' own rounding)`;

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
