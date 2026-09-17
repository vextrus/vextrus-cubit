/**
 * AC-3(b): an AGREED storey height that cites no drawing entity is omitted under a code that says so
 * — never under the one that says nobody read a height at all (debt-src-modules-1m7xg1h, L-QTY-02,
 * L-QTY-03, Q-07).
 *
 * The four standings a level's height can be in are driven through the rail over one input, each
 * differing from the next in exactly one field of the setup: what stands, and what cites nothing.
 */
import { describe, expect, test } from "vitest";
import { MODULE, agreedHeight, levelSetup, productModule, railInput, registerRow, variantSetup } from "./support/sweep-stage";

/** One component a kept row declares it could not bind (L-QTY-02). */
type Omitted = { variable: string; code: string };

/** One offer, as far as this case reads one. */
type Offer = { coverage: string; omitted: readonly Omitted[]; bindings: Record<string, unknown> };

type Batch = { offers: readonly Offer[]; observations: readonly { code: string }[] };

type Rail = (input: Record<string, unknown>) => Batch;

/** One registered refusal, as the register holds one. */
type Entry = { code: string; message: string; remedy: string };

const STOREY_HEIGHT_UNCITED = "STOREY_HEIGHT_UNCITED";
const STOREY_HEIGHT_UNSTATED = "STOREY_HEIGHT_UNSTATED";
const STOREY_HEIGHT_CONTESTED = "STOREY_HEIGHT_CONTESTED";
const PARTIAL_DECLARED = "PARTIAL_DECLARED";
const COMPLETE = "COMPLETE";

const INGEST_ID = "33333333-3333-4333-8333-333333333333";
const VIEW_KEY = "PLAN:S-102:t:4";
const LEVEL_ID = "44444444-4444-4444-8444-444444444444";
const PLACEMENT_KEY = "PLACEMENT:S-102:C1:1000:2000";
const FAMILY = "C1";

const ROW = registerRow({ placementKey: PLACEMENT_KEY, levelId: LEVEL_ID, viewKey: VIEW_KEY, mark: FAMILY });

/** The whole input, with this case's own storey-height standing on the level the row stands on. */
function input(height: { standing: string; value: string | null; unit: string | null; basis: string | null; sourceKey: string | null }): Record<string, unknown> {
  return railInput({
    kind: "rcc.concrete",
    objects: [ROW],
    placements: {
      [PLACEMENT_KEY]: { drawingId: "22222222-2222-4222-8222-222222222222", ingestId: INGEST_ID, viewKey: VIEW_KEY, memberFamily: FAMILY, engine: "VECTOR", sourceEntity: PLACEMENT_KEY },
    },
    memberTypes: { [INGEST_ID]: { [FAMILY]: [variantSetup({ variantKey: FAMILY, width: 300, depth: 450 })] } },
    levels: [levelSetup({ levelId: LEVEL_ID, label: "L1", ordinal: 0, height })],
    calibrations: { [INGEST_ID]: { [VIEW_KEY]: "cal-1" } },
  });
}

async function columnRail(): Promise<Rail> {
  const door = await productModule<Record<string, unknown>>("src/modules/takeoff/rails/columns/index.ts");
  expect(typeof door["columnConcreteRail"], "the column rail's home publishes `columnConcreteRail`").toBe("function");
  return door["columnConcreteRail"] as Rail;
}

/** The one offer a case's batch keeps. */
function kept(batch: Batch, said: string): Offer {
  expect(batch.observations.map((one) => one.code), `${said}: the row is KEPT and declares what it could not bind, never dropped into the residue (L-QTY-02)`).toEqual([]);
  expect(batch.offers.length, `${said}: one offer stands for the one register row`).toBe(1);
  return batch.offers[0] as Offer;
}

describe("AC-3: a storey height nobody can trace is omitted under its own name", () => {
  test("AC-3: an AGREED height citing nothing is omitted STOREY_HEIGHT_UNCITED, and the row is PARTIAL_DECLARED", async () => {
    const rail = await columnRail();

    for (const [said, cites] of [
      ["a height whose source key is empty", ""],
      ["a height whose source key is null", null],
    ] as const) {
      const offer = kept(rail(input(agreedHeight("3", "M", cites))), said);
      expect(
        offer.omitted.map((one) => one.code),
        `${said}: the readings agree and a figure stands, but nothing in the drawing answers for it — the reader is told the citation is missing, not that nobody read a height (L-QTY-03, Q-07)`,
      ).toEqual([STOREY_HEIGHT_UNCITED]);
      expect(offer.coverage, `${said}: a row kept with a component omitted is PARTIAL_DECLARED, never COMPLETE (L-QTY-02)`).toBe(PARTIAL_DECLARED);
    }

    // The two absences this code is NOT: the code each stands under is the levels law's own pairing,
    // and neither is relitigated by this sweep.
    const unread = kept(rail(input({ standing: "NONE", value: null, unit: null, basis: null, sourceKey: null })), "a height nobody read");
    expect(unread.omitted.map((one) => one.code), "a level nobody has read a storey height for keeps its own code").toEqual([STOREY_HEIGHT_UNSTATED]);

    const contested = kept(rail(input({ standing: "SUSPENDED", value: null, unit: null, basis: null, sourceKey: null })), "a height whose readings disagree");
    expect(contested.omitted.map((one) => one.code), "and a height whose readings disagree keeps its own (L-REG-03: declared, never resolved)").toEqual([STOREY_HEIGHT_CONTESTED]);

    // Armed: the same setup with a height that DOES cite a drawing entity binds and is complete, so
    // what the cases above grade is the citation rather than the rail refusing every height.
    const bound = kept(rail(input(agreedHeight("3", "M", "S-105:e:3"))), "a height that cites the mark it was read off");
    expect({ omitted: bound.omitted, coverage: bound.coverage }, "a cited height binds, and the row is complete").toEqual({ omitted: [], coverage: COMPLETE });
  });

  test("AC-3: STOREY_HEIGHT_UNCITED is registered in the levels area and assembled into the one taxonomy", async () => {
    const area = await productModule<Record<string, unknown>>(MODULE.levelErrors);
    const registry = (area["TAKEOFF_LEVELS_REFUSALS"] ?? {}) as Record<string, Entry | undefined>;
    const entry = registry[STOREY_HEIGHT_UNCITED];
    expect(entry, `${MODULE.levelErrors} registers ${STOREY_HEIGHT_UNCITED} — the area the storey-height codes live in (AM-11)`).toBeTruthy();
    expect((entry as Entry).message.length, "saying what happened").toBeGreaterThan(0);
    expect((entry as Entry).remedy.length, "and what to do about it").toBeGreaterThan(0);

    const barrel = await productModule<Record<string, unknown>>(MODULE.errors);
    const refusals = (barrel["REFUSALS"] ?? {}) as Record<string, Entry | undefined>;
    expect(refusals[STOREY_HEIGHT_UNCITED], "and the barrel enumerates it (AM-11, ARCH-02)").toBeTruthy();
    expect(
      (refusals[STOREY_HEIGHT_UNSTATED] as Entry | undefined)?.message,
      "while STOREY_HEIGHT_UNSTATED's copy is untouched — the wrong reading is re-homed, never rewritten (riskNotes (1))",
    ).toBe((registry[STOREY_HEIGHT_UNSTATED] as Entry | undefined)?.message);
  });
});
