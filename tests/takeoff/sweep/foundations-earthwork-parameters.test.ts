/**
 * AC-3(d): an earthwork parameter neither the site nor the edition states is omitted under its own
 * code — not under the one that says the GROUND LEVEL was never entered (debt-src-modules-t9z401,
 * L-MEA-06, L-QTY-02, Q-07).
 *
 * Two pits are graded: one whose edition states nothing at all, and one whose edition states the
 * parameters while the site has entered no ground level. What each row declares says which absence
 * the reader is sent to, and a rail answering one code for both cannot satisfy them together.
 */
import { describe, expect, test } from "vitest";
import { MODULE, productModule, railInput, registerRow, variantSetup } from "./support/sweep-stage";

/** One component a kept row declares it could not bind. */
type Omitted = { variable: string; code: string };
type Offer = { coverage: string; omitted: readonly Omitted[] };
type Batch = { offers: readonly Offer[]; observations: readonly { code: string }[] };
type Rail = (input: Record<string, unknown>) => Batch;
type Entry = { code: string; message: string; remedy: string };

const EARTHWORK_PARAMETER_UNSTATED = "EARTHWORK_PARAMETER_UNSTATED";
const GROUND_LEVEL_UNSTATED = "GROUND_LEVEL_UNSTATED";
const EARTHWORK_EXCAVATION = "earthwork.excavation";
const PCC_BLINDING = "pcc.blinding";
const FOUNDATIONS_RAIL_MODULE = "src/modules/takeoff/rails/foundations/index.ts";

const INGEST_ID = "33333333-3333-4333-8333-333333333333";
const VIEW_KEY = "PLAN:S-04:t:2";
const PLACEMENT = "PLACEMENT:S-04:F1:3000:4000";
const FAMILY = "F1";
const MM = "mm";

/** A reading of the drawing, as the setup carries one. */
function reading(value: string, unit: string = MM): { value: string; unit: string; basis: string; source: string } {
  return { value, unit, basis: "TRANSCRIBED", source: "S-04:e:7" };
}

/** The ground level, entered on site — so a case about a parameter is not also a case about the egl. */
const EGL = { GROUND_LEVEL: { value: "-152.4", unit: MM, canonicalMetres: "-0.1524", sourceNote: "S-01 general notes", actId: "55555555-5555-4555-8555-555555555555" } };

/** The four L-FRM-04 parameters at the seed's own values — the edition a pinned project holds. */
const SEED_EDITION = {
  digest: "d0000000000000000000000000000000000000000000000000000000000000ed",
  parameters: {
    earthworkWorkingAllowance: { value: "1.5", unit: "ft" },
    earthworkDepthExtra: { value: "0.5", unit: "ft" },
    blindingProjection: { value: "3", unit: "in" },
    blindingThickness: { value: "3", unit: "in" },
  },
};

/** An edition stating none of them — a project pinned to an edition that never carried them. */
const BARE_EDITION = { digest: SEED_EDITION.digest, parameters: {} };

/** One spread footing, stated whole, under whichever edition and site facts the case gives it. */
function input(kind: string, options: { edition: unknown; siteFacts?: Record<string, unknown> }): Record<string, unknown> {
  return railInput({
    kind,
    objects: [registerRow({ placementKey: PLACEMENT, levelId: "level-fdn", viewKey: VIEW_KEY, mark: FAMILY, elementType: "footing" })],
    placements: {
      [PLACEMENT]: {
        drawingId: "22222222-2222-4222-8222-222222222222",
        ingestId: INGEST_ID,
        viewKey: VIEW_KEY,
        memberFamily: FAMILY,
        engine: "VECTOR",
        sourceEntity: PLACEMENT,
        outline: null,
      },
    },
    memberTypes: {
      [INGEST_ID]: {
        [FAMILY]: [variantSetup({ variantKey: FAMILY, width: 1500, depth: 1500, dimensions: { depth: reading("450"), top: reading("-609.6") } })],
      },
    },
    calibrations: { [INGEST_ID]: { [VIEW_KEY]: "cal-fdn-1" } },
    siteFacts: options.siteFacts ?? {},
    edition: options.edition,
  });
}

/** The one row a case's batch keeps, and what it declared it could not bind. */
function omittedBy(batch: Batch, said: string): Record<string, string> {
  expect(batch.offers.length, `${said}: the row is kept and declares its omissions, never dropped (L-QTY-02)`).toBe(1);
  const offer = batch.offers[0] as Offer;
  expect(offer.coverage, `${said}: a row kept with a component omitted is PARTIAL_DECLARED`).toBe("PARTIAL_DECLARED");
  return Object.fromEntries(offer.omitted.map((one) => [one.variable, one.code]));
}

async function foundationsDoor(): Promise<{ excavation: Rail; blinding: Rail; codes: readonly string[] }> {
  const door = await productModule<Record<string, unknown>>(FOUNDATIONS_RAIL_MODULE);
  for (const rail of ["excavationRail", "blindingRail"]) expect(typeof door[rail], `${FOUNDATIONS_RAIL_MODULE} publishes \`${rail}\``).toBe("function");
  expect(Array.isArray(door["FOUNDATIONS_RAIL_CODES"]), `${FOUNDATIONS_RAIL_MODULE} publishes \`FOUNDATIONS_RAIL_CODES\``).toBe(true);
  return { excavation: door["excavationRail"] as Rail, blinding: door["blindingRail"] as Rail, codes: door["FOUNDATIONS_RAIL_CODES"] as readonly string[] };
}

describe("AC-3: an unstated earthwork parameter is not an unentered ground level", () => {
  test("AC-3: the allowance, the depth extra and the thickness no edition and no site states are omitted EARTHWORK_PARAMETER_UNSTATED", async () => {
    const { excavation, codes } = await foundationsDoor();

    const bare = omittedBy(excavation(input(EARTHWORK_EXCAVATION, { edition: BARE_EDITION, siteFacts: EGL })), "a pit under an edition stating no parameters");
    expect(
      Object.keys(bare).sort(),
      "the working allowance, the depth extra and the blinding thickness are the three the pit could not bind — the ground level IS entered here, so this case is about those three alone (L-FRM-04's variables)",
    ).toEqual(["a", "dx", "t"]);
    expect(
      [...new Set(Object.values(bare))],
      "and each is declared under the code that says the parameter was never stated: the reader is sent to state it, rather than to enter a ground level that is already entered (L-MEA-06, Q-07)",
    ).toEqual([EARTHWORK_PARAMETER_UNSTATED]);

    const noEgl = omittedBy(excavation(input(EARTHWORK_EXCAVATION, { edition: SEED_EDITION })), "a pit whose edition states every parameter and whose site has entered no ground level");
    expect(
      Object.values(noEgl),
      "while the ground level nobody entered keeps its own code, alone: earthwork is unpriceable from drawings alone, and that is what this code says (AM-06 §1)",
    ).toEqual([GROUND_LEVEL_UNSTATED]);

    expect(codes, "the area's own roster carries the new code (AM-11)").toContain(EARTHWORK_PARAMETER_UNSTATED);
  });

  test("AC-3: the blinding's projection and thickness are declared the same way, and the code is registered", async () => {
    const { blinding } = await foundationsDoor();
    const bare = omittedBy(blinding(input(PCC_BLINDING, { edition: BARE_EDITION, siteFacts: EGL })), "a blinding under an edition stating no parameters");
    expect(Object.keys(bare).length, "the projection and the thickness are both unbound").toBe(2);
    expect(
      [...new Set(Object.values(bare))],
      "and both are declared under the parameter code — a blinding says nothing about a ground level (L-FRM-04)",
    ).toEqual([EARTHWORK_PARAMETER_UNSTATED]);

    const area = await productModule<Record<string, unknown>>(MODULE.foundationErrors);
    const registry = (area["FOUNDATIONS_REFUSALS"] ?? {}) as Record<string, Entry | undefined>;
    const entry = registry[EARTHWORK_PARAMETER_UNSTATED];
    expect(entry, `${MODULE.foundationErrors} registers ${EARTHWORK_PARAMETER_UNSTATED} (AM-11)`).toBeTruthy();
    expect((entry as Entry).message.length, "saying what happened").toBeGreaterThan(0);
    expect((entry as Entry).remedy.length, "and what to do about it").toBeGreaterThan(0);

    const barrel = await productModule<Record<string, unknown>>(MODULE.errors);
    const refusals = (barrel["REFUSALS"] ?? {}) as Record<string, Entry | undefined>;
    expect(refusals[EARTHWORK_PARAMETER_UNSTATED], "and the barrel enumerates it (AM-11, ARCH-02)").toBeTruthy();
    expect(
      (refusals[GROUND_LEVEL_UNSTATED] as Entry | undefined)?.message,
      "while GROUND_LEVEL_UNSTATED's copy is untouched — the wrong reading is re-homed, never rewritten (riskNotes (1))",
    ).toBe((registry[GROUND_LEVEL_UNSTATED] as Entry | undefined)?.message);
  });
});
