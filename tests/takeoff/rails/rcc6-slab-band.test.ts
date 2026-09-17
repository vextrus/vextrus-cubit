/**
 * AC-8 — F-RCC6 v1.1's SLAB rows still hold, and the slabs refusal shard is exercised by name
 * (AM-01's frozen regression fixture, L-QTY-06, Q-07, AM-11).
 *
 * The fixture is byte-frozen, so what this grades is that the new rails reproduce the takeoff the
 * product has always reconciled with: one panel per level, TRANSCRIBED from `fixtures/rcc6/inputs.json`
 * by the stage, measured by the two rails and published by the real gate. Every figure is the
 * fixture's own — nothing about F-RCC6 is typed here (B-19).
 *
 * Its second half is Q-07's admission: the five codes `src/core/errors/slabs.ts` registers are asked of
 * the refusal register's OWN scanner, over the live corpus, so "exercised by name" means what the
 * register means by it and not what this file would like it to mean.
 */
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { DEFERRED_CODES } from "../../refusal-register/deferrals";
import { exercisedNames, unadmittedCodes } from "../../refusal-register/scan";
import {
  RCC6_FIXTURE,
  RCC_CONCRETE,
  RCC_FORMWORK,
  REPO_ROOT,
  SLAB,
  SLABS_SHARD_CODES,
  canon,
  closeStage,
  gateSeam,
  goldenPrintingAllowance,
  goldenRowsAt,
  goldenSum,
  insideBand,
  linesFor,
  railInput,
  rcc6SlabPlans,
  rcc6Stack,
  refusals,
  registerPlanObjects,
  said,
  setupWith,
  slabWallStairDoor,
  slabsRefusals,
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

const KINDS: readonly string[] = [RCC_CONCRETE, RCC_FORMWORK];

type Measured = { it: SlabWallStairCampaign; verdict: VerdictShape; units: Canon; keyOf: Map<string, string>; levels: string[] };

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
const STAGING_BUDGET = 600_000;

async function build(): Promise<Measured> {
  const units = await canon();
  const it = await stageSlabWallStairCampaign("rcc6-slab", rcc6Stack());
  const drafts = rcc6SlabPlans(units);
  expect(drafts.length, "fixtures/rcc6/inputs.json states the slab plate of every level F-RCC6 measures").toBeGreaterThan(0);

  const { objects, plans } = await registerPlanObjects(it, drafts);
  const setup = setupWith(it, { plans });
  const door = await slabWallStairDoor();
  const offers: OfferShape[] = [
    ...door.slabWallStairConcreteRail(railInput(it, RCC_CONCRETE, setup)).offers,
    ...door.slabWallStairFormworkRail(railInput(it, RCC_FORMWORK, setup)).offers,
  ];

  const gate = await gateSeam();
  const verdict = await gate.evaluateOffers(it.gateScope, { offers, observations: [] });
  measured = {
    it,
    verdict,
    units,
    keyOf: new Map(drafts.map((draft, at) => [draft.level, (objects[at] as { objectKey: string }).objectKey])),
    levels: drafts.map((draft) => draft.level),
  };
  return measured;
}

describe("AC-8: F-RCC6 v1.1's SLAB rows, measured by the new rails", () => {
  test("AC-8: the gate refused nothing over the fixture's panels", async () => {
    await load();
    expect(measured.verdict.refusals, `every offer was to the gate's contract: ${JSON.stringify(measured.verdict.refusals)}`).toEqual([]);
  }, STAGING_BUDGET);

  test("AC-8: every level the fixture states is reconciled, and the golden records a row for each", async () => {
    await load();
    for (const level of measured.levels) {
      for (const kind of KINDS) {
        expect(
          goldenRowsAt(RCC6_FIXTURE, SLAB, kind, level).length,
          `fixtures/rcc6/takeoff.golden.json records a SLAB ${kind} row at ${level} — AC-8 reconciles every level the fixture's \`slab[]\` names`,
        ).toBeGreaterThan(0);
      }
    }
  }, STAGING_BUDGET);

  for (const kind of KINDS) {
    test(`AC-8: every level's published ${kind} line stands inside L-QTY-06's band against the golden`, async () => {
      await load();
      const { units } = measured;
      for (const level of measured.levels) {
        const rows = linesFor(measured.it, kind, measured.keyOf.get(level) as string);
        expect(rows.length, `the panel at ${level} published exactly one ${kind} line`).toBe(1);

        const sum = sumOf(rows.map((row) => said(row, "value", "value")), units);
        const golden = goldenSum(RCC6_FIXTURE, SLAB, kind, level, units);
        const allowance = goldenPrintingAllowance(RCC6_FIXTURE, SLAB, kind, level, units);
        const over = `${sum} against the golden's ${golden} (each side is widened by ${allowance}, the golden's own printed half-unit)`;
        expect(insideBand(sum, golden, allowance, units), `SLAB ${kind} at ${level}: ±3% under, +0% over a competent manual takeoff — ${over}`).toBe(true);
      }
    }, STAGING_BUDGET);
  }
});

/**
 * The five codes AC-8 names, read from the acceptance's ONE spelling of them (the shared stage) rather
 * than spelled in this file.
 *
 * The spelling matters because of what the register's scanner counts: a code named inside a matcher's
 * argument IS its exercise (Q-07), so a file that both spells the five and then asserts they are
 * exercised admits them by the act of asking. The roster claim below is therefore made against a list
 * this file does not utter, and the exercise claim asks for an assertion in some OTHER file — one that
 * observes a rail or the gate answering the code, which is the only thing "exercised by name" can mean.
 */
const OWED_CODES: readonly string[] = [...SLABS_SHARD_CODES].sort();

/** This file, as the scanner names it — so its own spelling can never be its own exercise (Q-07). */
const THIS_FILE = relative(REPO_ROOT, fileURLToPath(import.meta.url)).split(sep).join("/");

describe("AC-8: the slabs refusal shard, registered and exercised by name", () => {
  test("AC-8: `src/core/errors/slabs.ts` registers exactly this leaf's five codes, and the barrel holds each", async () => {
    const shard = await slabsRefusals();
    const registered = await refusals();
    const door = await slabWallStairDoor();

    expect(
      Object.keys(shard).sort(),
      "the area's own file registers its own codes and no other area's — one home per code (AM-11, interfaces)",
    ).toStrictEqual(OWED_CODES);

    for (const name of OWED_CODES) {
      expect(shard[name]?.code, `${name} is registered under its own spelling`).toBe(name);
      expect(registered[name], `and the closed taxonomy the barrel assembles holds ${name} — the shard is enumerated, never re-declared (AM-11)`).toBeTruthy();
    }

    // And the shard is tied to the rails it serves rather than to a list: every entry is a code these
    // rails can actually answer, and every code they declare stands in the closed taxonomy — whether
    // this area registered it or the area that registered it first did (AM-11: one home per code).
    expect(
      Object.keys(shard).filter((name) => ![...door.SLAB_WALL_STAIR_RAIL_CODES].includes(name)),
      "the shard registers no code this area's rails cannot answer — a registered code no rail reaches is a code nothing measures (Q-07)",
    ).toEqual([]);
    expect(
      [...door.SLAB_WALL_STAIR_RAIL_CODES].filter((name) => registered[name] === undefined),
      "and every code the rails declare is one the closed taxonomy holds — a rail that observes an unregistered code speaks a name the product does not know (Q-07)",
    ).toEqual([]);
  }, STAGING_BUDGET);

  test("AC-8: each of the five is admitted by an assertion in a test that OBSERVES it, and none by a deferral", async () => {
    const spoken = await exercisedNames([join(REPO_ROOT, "src"), join(REPO_ROOT, "tests")]);
    const registered = await refusals();

    // The scanner's own answer over the live corpus, with this file's spellings taken out of it: a
    // file cannot be the corpus of its own question, so what is left is the exercises that observe
    // something (Q-07).
    const elsewhere = new Map<string, string[]>(
      [...spoken].map(([code, files]) => [code, files.filter((where) => where !== THIS_FILE)]).filter(([, files]) => (files as string[]).length > 0) as [string, string[]][],
    );

    for (const code of OWED_CODES) {
      expect(
        registered[code],
        `${code} is a code the closed taxonomy holds — the register admits what is registered, so there is nothing to admit until this leaf's shard registers it (Q-07)`,
      ).toBeTruthy();
      expect(
        elsewhere.get(code) ?? [],
        `${code} is asserted by a lane-collected test OTHER than this one — a rail driven into it, or the gate answering it. This file asks the question, so its own spelling cannot be the answer: "exercised by name" is a claim about a test that observes the code, not about the roster that names it (Q-07)`,
      ).not.toEqual([]);
      expect(
        DEFERRED_CODES[code],
        `${code} is exercised, so it is deferred to nobody — a deferral is for a code the increment that will exercise it has not landed yet (Q-07)`,
      ).toBeUndefined();
    }

    expect(
      unadmittedCodes(OWED_CODES, elsewhere, {}),
      "and with the deferral branch taken away entirely and this file's own spellings with it, every one of this leaf's codes is still admitted — the exercises are real (AC-8)",
    ).toEqual([]);
  }, STAGING_BUDGET);
});
