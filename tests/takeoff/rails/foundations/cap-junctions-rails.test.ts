// @vitest-environment node
/**
 * FND-OWN, the rails: F-RCC6-BNBC's 26 pile caps measured with the piles they stand on read
 * (L-MEA-09: pile › pile cap; I-544..d) — over what the partition's pure stages read of S-04 and
 * S-06, laid into the setup exactly as `railSetupOf` lays it. No database: the figures are computed
 * the way the gate computes them — the method each offer's rule names, each reading carried by the
 * ONE canon — and held against the clause's own algebra written out here (B-19).
 *
 * The three states the product can stand in, each graded:
 *   1. Nobody read the caps' piles (no pile plan in the revision, or none the caps' plan can be laid
 *      over): every cap KEEPS its one line and names `CAP_PILES_UNREAD` for n, d and e, with no figure
 *      — never the whole prism it once fell back to, which is 128.781275 m³ over the very plans it
 *      binds and reads over 89 heads (L-QTY-04); the blinding likewise, for n and d; the formwork,
 *      which the piles never touch, 254.132613 m² as ever. (TEST_AMENDED, FND-OWN review: this state
 *      published the prisms COMPLETE, which the review showed double-bills the heads.)
 *   2. The piles are read and nothing states how far their heads stand into the caps — the set's
 *      state today: every cap KEEPS its one line and names `PILE_HEAD_UNSTATED`, with no figure; the
 *      whole prism over 89 heads would be 1.321 m³ over (R0-0's refuter, CONFIRMED), and
 *      over-measurement is a hard block (L-QTY-04). The blinding under the 12 rectangular caps,
 *      which needs no head height, is COMPLETE and net of the 47 pile sections through it.
 *   3. The head height and PC5's lift-pit recess stated (staged here: no reader of the set carries
 *      them into a store yet): every cap COMPLETE, the heads and the recess netted, the recess's
 *      sides formed — and the figures inside the band of the regenerated golden R0 rules
 *      (cap concrete 122.500 m³, cap formwork 262.773 m², design §3.1 K17/K18).
 *   4. The head height READ off Rev C's S-05 by the setup's own reader (FND-HEAD, I-597), the
 *      recess not yet read: every cap COMPLETE at e = 3 in, PC5 over by its recess until FND-RECESS.
 *   5. Both READ — the heads off S-05 and PC5's recess off S-07 (FND-RECESS, I-598): every cap
 *      COMPLETE, 122.464091 m³ and 262.689481 m², nothing staged.
 */
import Decimal from "decimal.js";
import { describe, expect, test } from "vitest";
import type { CapJunctionSetup, Offer, RecessSetup } from "@/core/offers/contract";
import { FOUNDATIONS_RAIL_CODES } from "@/modules/takeoff/rails/foundations/index";
import * as read from "@/modules/takeoff/rails/foundations/read";
import { BUDGET_MS, CAP_KINDS, bnbc, capBatch, capOf, figureOf, junctionsOver, setupOver, sumOf } from "./support/cap-junctions-stage";

/** Exact decimals at a precision no figure here reaches — a figure never touches a float (B-07). */
const Exact = Decimal.clone({ precision: 60 });

/** π to forty digits — the independent model's own constant (L-FRM-02). */
const PI = new Exact("3.1415926535897932384626433832795028841972");

/**
 * How near the method's figure and the clause's algebra must stand: the method carries π to the
 * twenty-one digits the tree states (`expr.ts`), the model here to forty, and a billion billionth of a
 * cubic metre is the whole of the difference that may make.
 */
const AGREEMENT = new Exact("1e-15");

/** Whether a figure is the algebra's own, to AGREEMENT. */
function agrees(figure: Decimal | null | undefined, owed: Decimal): boolean {
  return figure !== null && figure !== undefined && new Exact(figure.toString()).minus(owed).abs().lte(AGREEMENT);
}

/** The pile diameter S-05's PILE SCHEDULE states (DIA 500), in metres. */
const PILE_DIA = new Exact("0.5");

/** The standing figures J-000 reads back today (CLAUDE.md, session 7's close). */
const STANDING_CONCRETE = "128.781275";
const STANDING_FORMWORK = "254.132613";

/**
 * How far the heads stand above the soffit, as the drawing's levels put it: cut-off EL −1.829 (S-05
 * `4DA`) against the soffit at −1.9046 (the neck's 0.6096 below GF, plus the schedule's 1.295). A
 * reader of the note states 3" (76.2 mm, I-597, below); 75.6 is the levels' metres rounded off
 * feet — one fact at two precisions — and is STAGED here as the by-the-levels stand-in, and says so.
 */
const HEAD_BY_LEVELS = { value: "75.6", unit: "mm", basis: "TRANSCRIBED" as const, source: "DXF_HANDLE:4DA" };

/** The same, as R0's Rev C S-05 prints it ("3\" INTO THE CAP"): the golden's own K17 figure. */
const HEAD_AS_EMBEDDED = { value: "76.2", unit: "mm", basis: "TRANSCRIBED" as const, source: "REV-C:S-05:EMBEDMENT" };

/** PC5's lift-pit recess, as R0's Rev C S-07 view "PC5 WITH LIFT PIT RECESS" prints it: 2493 × 2188 × 914. */
const PC5_RECESS: RecessSetup = {
  length: { value: "2493", unit: "mm", basis: "TRANSCRIBED", source: "REV-C:S-07:RECESS-L" },
  breadth: { value: "2188", unit: "mm", basis: "TRANSCRIBED", source: "REV-C:S-07:RECESS-B" },
  depth: { value: "914", unit: "mm", basis: "TRANSCRIBED", source: "REV-C:S-07:RECESS-D" },
};

/** The regenerated golden's two cap cells R0 rules (design §3.1, K17 + K18), and L-QTY-06's floor. */
const R0_CAP_CONCRETE = new Decimal("122.500");
const R0_CAP_FORMWORK = new Decimal("262.773");
const HALF_UNIT = new Decimal("0.0005");
const UNDER_TOLERANCE = new Decimal("0.97");

/** The recess's sides and its void, in the clause's own algebra (I-546). */
const RECESS_VOID = new Exact("2.493").mul("2.188").mul("0.914");
const RECESS_SIDES = new Exact(2).mul(new Exact("2.493").plus("2.188")).mul("0.914");

/** The quarter of π d² — one pile's section. */
const SECTION = PI.mul(PILE_DIA).mul(PILE_DIA).div(4);

/** Within L-QTY-06's band of a golden cell: never over it by more than its printed half-unit, and no more than 3 % under. */
function withinBand(figure: Decimal, golden: Decimal): boolean {
  return figure.lte(golden.plus(HALF_UNIT)) && figure.gte(golden.mul(UNDER_TOLERANCE).minus(HALF_UNIT));
}

/**
 * The figure another rule's sentence gives over the SAME readings an offer binds — the footing's prism
 * over a cap's plan and depth, L-FRM-04's blinding over its sides — so a case can grade what the owned
 * sentence took out against what the plain one would have published, without a second setup.
 */
function asRule(offer: Offer, ruleId: string): Decimal | null {
  return figureOf({ ...offer, ruleId, coverage: "COMPLETE" });
}

/** The prism a cap's concrete offer binds the plan of: `rcc.foundation.prism_rect` or `_poly`, by its shape. */
function prismOf(offer: Offer): Decimal {
  return asRule(offer, offer.geometry.type === "PRISM_POLY" ? "rcc.foundation.prism_poly" : "rcc.foundation.prism_rect") as Decimal;
}

/** The exact sum of the prisms a batch's offers bind. */
function prismsOf(offers: readonly Offer[]): Decimal {
  return offers.reduce((sum, offer) => sum.plus(prismOf(offer)), new Decimal(0));
}

/** Every PC5 of the read (there is one). */
function isPc5(offer: Offer, stage: Awaited<ReturnType<typeof bnbc>>): boolean {
  return capOf(stage, offer).mark === "PC5";
}

describe("I-544..d: each pile cap owned once — the heads, the pit recess, the blinding through the piles", () => {
  test(
    "state 1 — nobody read the caps' piles: 26 caps keep one line each, PARTIAL, naming CAP_PILES_UNREAD, and never fall back to the prism",
    async () => {
      const stage = await bnbc();
      for (const [said, setup] of [
        ["a setup that states no junctions at all", setupOver(stage, undefined)],
        ["a setup whose relation holds no entry for any cap", setupOver(stage, {})],
      ] as const) {
        const concrete = capBatch(stage, CAP_KINDS.concrete, setup);
        expect(concrete.offers.length, `${said}: one line per cap, kept (I-333)`).toBe(26);
        expect(new Set(concrete.offers.map((offer) => offer.ruleId)), `${said}: under the cap's own sentence, never the footing's prism`).toEqual(new Set(["rcc.pile_cap.prism_rect", "rcc.pile_cap.prism_poly"]));
        for (const offer of concrete.offers) {
          const cap = capOf(stage, offer);
          expect(offer.coverage, `${said}: ${cap.mark} ${cap.placementKey} is kept with no figure (L-QTY-02, L-QTY-04)`).toBe("PARTIAL_DECLARED");
          expect(offer.omitted, `${said}: ${cap.mark} names every reading of its piles, and nothing of its plan`).toEqual([
            { variable: "n", code: "CAP_PILES_UNREAD" },
            { variable: "d", code: "CAP_PILES_UNREAD" },
            { variable: "e", code: "CAP_PILES_UNREAD" },
          ]);
          expect(figureOf(offer), `${said}: ${cap.mark} publishes nothing`).toBeNull();
        }
        expect(concrete.observations, `${said}: an unread relation is an omission on the kept row, not an observation beside it`).toEqual([]);
        // What the fallback WOULD have published over these very readings — J-000's standing figure,
        // over 89 heads the pile rail already bills from cut-off: exactly what may no longer publish.
        expect(prismsOf(concrete.offers).toFixed(6), `${said}: the prisms over the plans the rows still bind are 128.781275 m³ — withheld, not published`).toBe(STANDING_CONCRETE);

        const blinding = capBatch(stage, CAP_KINDS.blinding, setup).offers;
        expect(blinding.every((offer) => offer.ruleId === "pcc.blinding_rect_piled"), `${said}: the blinding under the sentence that takes the piles out`).toBe(true);
        expect(blinding.every((offer) => offer.coverage === "PARTIAL_DECLARED"), `${said}: and kept, with no figure, on every cap`).toBe(true);
        for (const offer of blinding) {
          const unread = offer.omitted.filter((one) => one.code === "CAP_PILES_UNREAD").map((one) => one.variable);
          expect(unread, `${said}: ${capOf(stage, offer).mark}'s blinding names n and d`).toEqual(["n", "d"]);
        }

        const formwork = capBatch(stage, CAP_KINDS.formwork, setup).offers;
        expect(formwork.every((offer) => offer.coverage === "COMPLETE"), `${said}: the formwork the piles never touch publishes, as ever`).toBe(true);
        expect(sumOf(formwork).toFixed(6), `${said}: 254.132613 m²`).toBe(STANDING_FORMWORK);
      }
    },
    BUDGET_MS,
  );

  test(
    "state 2 — the piles read, their heads' height unstated: 26 caps keep one line each, PARTIAL, naming PILE_HEAD_UNSTATED, and publish no figure over the heads",
    async () => {
      const stage = await bnbc();
      const junctions = junctionsOver(stage);
      expect(Object.keys(junctions).length, "every one of the 26 caps has its piles read").toBe(26);
      const batch = capBatch(stage, CAP_KINDS.concrete, setupOver(stage, junctions));
      const offers = batch.offers;
      expect(offers.length, "one line per cap — never one per pile, never one per head (I-333)").toBe(26);
      expect(new Set(offers.map((offer) => offer.ruleId)), "each under the cap's own sentence, rectangle or polygon").toEqual(new Set(["rcc.pile_cap.prism_rect", "rcc.pile_cap.prism_poly"]));
      for (const offer of offers) {
        const cap = capOf(stage, offer);
        expect(offer.coverage, `${cap.mark} ${cap.placementKey}: kept, with no figure — its whole prism would read over the heads (L-QTY-04)`).toBe("PARTIAL_DECLARED");
        expect(offer.omitted, `${cap.mark}: the one reading it lacks is named`).toEqual([{ variable: "e", code: "PILE_HEAD_UNSTATED" }]);
        expect(offer.bindings["d"], `${cap.mark}: the held piles' diameter is the pile schedule's own cell (I-304)`).toMatchObject({ value: "500", unit: "mm", basis: "TRANSCRIBED" });
        expect(offer.bindings["n"], `${cap.mark}: n is the count taken over its ring, on the cap view's calibration`).toMatchObject({ unit: "pcs", basis: "MEASURED", source: cap.placementKey });
        expect(figureOf(offer), `${cap.mark}: a kept row carries no quantity (L-QTY-02)`).toBeNull();
      }
      expect(
        offers.reduce((sum, offer) => sum + Number(offer.bindings["n"]?.value), 0),
        "and between them the caps stand on all 89 piles",
      ).toBe(89);
      expect(batch.observations, "a head nothing states is an omission on the kept row, not an observation beside it").toEqual([]);
    },
    BUDGET_MS,
  );

  test(
    "state 2 — the blinding under the 12 rectangular caps is COMPLETE and net of the 47 pile sections through it; the 14 PC2 still defer",
    async () => {
      const stage = await bnbc();
      const after = capBatch(stage, CAP_KINDS.blinding, setupOver(stage, junctionsOver(stage))).offers;
      const complete = after.filter((offer) => offer.coverage === "COMPLETE");
      expect(complete.length, "the 12 rectangular caps' blinding publishes").toBe(12);
      expect(complete.every((offer) => offer.ruleId === "pcc.blinding_rect_piled"), "under L-FRM-04's sentence with the piles' sections out (I-545)").toBe(true);
      const deferred = after.filter((offer) => offer.coverage !== "COMPLETE");
      expect(deferred.length, "the 14 chamfered PC2 still defer").toBe(14);
      expect(deferred.every((offer) => offer.omitted.every((one) => one.code === "BLINDING_PLAN_DEFERRED")), "by name, and for their plan alone").toBe(true);

      const through = complete.reduce((sum, offer) => sum + Number(offer.bindings["n"]?.value), 0);
      expect(through, "PC1 × 4, PC3 × 5, PC4 × 2 and PC5 × 1 stand on 8 + 20 + 10 + 9 = 47 piles").toBe(47);
      // L-FRM-04's own sentence over the very sides, projection and thickness each line binds.
      const gross = complete.reduce((sum, offer) => sum.plus(asRule(offer, "pcc.blinding_rect") as Decimal), new Decimal(0));
      const net = sumOf(complete);
      const sections = SECTION.mul(through).mul(new Exact("3").mul("0.0254"));
      expect(agrees(net, new Exact(gross.toString()).minus(sections)), `the blinding ${net.toString()} is L-FRM-04's figure less 47 × π/4 × 0.5² × 3 in — the clause's own algebra`).toBe(true);
      expect(gross.minus(net).toFixed(3), "0.703 m³ the piles own, no longer billed twice (R0-0's refuter)").toBe("0.703");
      expect(net.toFixed(3), "the cap blinding stands at 3.989 m³ where it stood at 4.692").toBe("3.989");
    },
    BUDGET_MS,
  );

  test(
    "state 3 — the heads' height (75.6 mm, by the levels) and PC5's recess stated: all 26 COMPLETE, the heads and the recess netted, inside R0's golden band",
    async () => {
      const stage = await bnbc();
      const junctions = junctionsOver(stage, {
        headHeight: { reading: HEAD_BY_LEVELS, standing: "RESOLVED" },
        recessOf: (cap) => (cap.mark === "PC5" ? PC5_RECESS : null),
      });
      const setup = setupOver(stage, junctions);
      const concrete = capBatch(stage, CAP_KINDS.concrete, setup).offers;
      const prisms = prismsOf(concrete);
      expect(prisms.toFixed(6), "the prisms over the plans these lines bind are J-000's standing 128.781275 m³").toBe(STANDING_CONCRETE);
      const formwork = capBatch(stage, CAP_KINDS.formwork, setup).offers;

      expect(concrete.length, "one line per cap").toBe(26);
      expect(concrete.every((offer) => offer.coverage === "COMPLETE"), "every cap publishes").toBe(true);
      expect(concrete.filter((offer) => isPc5(offer, stage)).map((offer) => offer.ruleId), "PC5 under the recess sentence").toEqual(["rcc.pile_cap.prism_rect_recess"]);
      expect(concrete.filter((offer) => !isPc5(offer, stage)).every((offer) => !offer.ruleId.endsWith("_recess")), "and no other cap").toBe(true);

      const heads = SECTION.mul(89).mul(new Exact("0.0756"));
      const owed = new Exact(prisms.toString()).minus(heads).minus(RECESS_VOID);
      const figure = sumOf(concrete);
      expect(agrees(figure, owed), `${figure.toString()} is the prisms less 89 heads of π/4 × 0.5² × 0.0756 and the 2.493 × 2.188 × 0.914 recess`).toBe(true);
      expect(figure.toFixed(3), "the projected cap concrete").toBe("122.475");
      expect(withinBand(figure, R0_CAP_CONCRETE), `${figure.toFixed(6)} m³ stands inside R0's golden band on 122.500 m³ (L-QTY-06)`).toBe(true);

      expect(formwork.filter((offer) => isPc5(offer, stage)).map((offer) => offer.ruleId), "PC5 formed along its recess's four sides as well").toEqual(["rcc.pile_cap.formwork_rect_recess"]);
      const formed = sumOf(formwork);
      expect(agrees(formed, new Exact(STANDING_FORMWORK).plus(RECESS_SIDES)), `${formed.toString()} is 254.132613 m² and the recess's 2 × (2.493 + 2.188) × 0.914`).toBe(true);
      expect(formed.toFixed(3), "the projected cap formwork").toBe("262.689");
      expect(withinBand(formed, R0_CAP_FORMWORK), `${formed.toFixed(6)} m² stands inside R0's golden band on 262.773 m² (L-QTY-06)`).toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "state 3, as R0's Rev C prints the embedment (3 in, the golden's own 76.2): still inside the band, and 0.011 m³ further under",
    async () => {
      const stage = await bnbc();
      const setup = setupOver(
        stage,
        junctionsOver(stage, { headHeight: { reading: HEAD_AS_EMBEDDED, standing: "RESOLVED" }, recessOf: (cap) => (cap.mark === "PC5" ? PC5_RECESS : null) }),
      );
      const figure = sumOf(capBatch(stage, CAP_KINDS.concrete, setup).offers);
      expect(figure.toFixed(3), "the cap concrete with every head at 76.2 mm").toBe("122.464");
      expect(withinBand(figure, R0_CAP_CONCRETE), "inside R0's band").toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "a head height the drawing only BOUNDS is deducted at its bound — the figure then stands under — and the row says JUNCTION_DEFERRED",
    async () => {
      const stage = await bnbc();
      const setup = setupOver(stage, junctionsOver(stage, { headHeight: { reading: { value: "150", unit: "mm", basis: "TRANSCRIBED", source: "BOUND" }, standing: "BOUNDED" } }));
      const batch = capBatch(stage, CAP_KINDS.concrete, setup);
      expect(batch.offers.every((offer) => offer.coverage === "COMPLETE"), "every cap publishes at the bound").toBe(true);
      expect(batch.observations.length, "and each says it stands under").toBe(26);
      expect(new Set(batch.observations.map((one) => one.code)), "by name (L-QTY-04)").toEqual(new Set(["JUNCTION_DEFERRED"]));
      const prisms = prismsOf(batch.offers);
      expect(sumOf(batch.offers).lt(prisms.minus(SECTION.mul(89).mul("0.0756"))), "under the stated heads — never over them").toBe(true);
    },
    BUDGET_MS,
  );
});

describe("I-544: what a cap's junction reading lacks is named, and a footing is never read as a cap", () => {
  /** A one-cap stage: a 2 m × 2 m PC over two held piles, the depth and the diameter scheduled. */
  function oneCap(junction: Partial<CapJunctionSetup> & { piles: readonly string[] }, options: { elementType?: string; pileDia?: readonly string[]; unread?: boolean } = {}) {
    const ingest = "ingest-1";
    const capKey = "PLACEMENT:CAP";
    const pileKeys = junction.piles;
    const dias = options.pileDia ?? pileKeys.map(() => "500");
    const placements: Record<string, unknown> = {
      [capKey]: { drawingId: "d", ingestId: ingest, viewKey: "v:CAPS", memberFamily: "PC1", engine: "VECTOR", sourceEntity: capKey, outline: null, noteShape: null, noteKey: null },
    };
    const memberTypes: Record<string, unknown[]> = {
      PC1: [{ variantKey: "PC1", bandFrom: null, bandTo: null, sectionText: "2000x2000", sectionWidth: 2000, sectionDepth: 2000, sectionUnit: "mm", sourceKeys: ["CELL:SIZE"], dimensions: { depth: { value: "1295", unit: "mm", basis: "TRANSCRIBED", source: "CELL:DEPTH" } }, rebar: [] }],
    };
    pileKeys.forEach((pile, index) => {
      const family = `P${index}`;
      placements[pile] = { drawingId: "d", ingestId: ingest, viewKey: "v:PILES", memberFamily: family, engine: "VECTOR", sourceEntity: pile, outline: null, noteShape: null, noteKey: null };
      memberTypes[family] = [{ variantKey: family, bandFrom: null, bandTo: null, sectionText: "", sectionWidth: null, sectionDepth: null, sectionUnit: null, sourceKeys: [], dimensions: { dia: { value: dias[index], unit: "mm", basis: "TRANSCRIBED", source: `CELL:DIA:${index}` } }, rebar: [] }];
    });
    const setup = {
      placements,
      memberTypes: { [ingest]: memberTypes },
      levels: [],
      calibrations: { [ingest]: { "v:CAPS": "cal", "v:PILES": "cal" } },
      grades: {},
      plans: {},
      runs: {},
      lintels: {},
      walls: {},
      surfaces: {},
      capJunctions: options.unread === true ? {} : {
        [capKey]: {
          piles: pileKeys,
          count: { value: String(pileKeys.length), unit: "pcs", basis: "MEASURED", source: capKey },
          headHeight: junction.headHeight ?? { reading: { value: "75", unit: "mm", basis: "TRANSCRIBED", source: "HEAD" }, standing: "RESOLVED" },
          recess: junction.recess ?? null,
        },
      },
      siteFacts: {},
      edition: { digest: "0".repeat(64), parameters: { blindingProjection: { value: "75", unit: "mm" }, blindingThickness: { value: "75", unit: "mm" } } },
      detailing: { fy: null, fc: null, lapMultiplier: null, hookExtension: null, suspended: [], sourceKeys: [] },
    };
    const row = { objectKey: "object|cap", placementKey: capKey, elementType: options.elementType ?? "pile_cap", mark: "PC1", standing: "MEASURED", setRevisionId: "rev" };
    return { setup, row };
  }

  async function railsOf() {
    return import("@/modules/takeoff/rails/foundations/index");
  }

  test("a pile cap the relation holds no entry for keeps its row naming CAP_PILES_UNREAD — concrete and blinding — and its formwork is untouched", async () => {
    const rails = await railsOf();
    const { setup, row } = oneCap({ piles: [] }, { unread: true });
    const input = (kind: string) => ({ campaignId: "c", setRevisionId: "rev", kind, objects: [row], setup }) as never;
    const concrete = rails.foundationConcreteRail(input("rcc.concrete")).offers[0] as Offer;
    expect([concrete.ruleId, concrete.coverage], "the cap's own sentence, kept — never the footing's prism, published whole over heads nobody placed").toEqual(["rcc.pile_cap.prism_rect", "PARTIAL_DECLARED"]);
    expect(concrete.omitted, "every reading of its piles, by name").toEqual([
      { variable: "n", code: "CAP_PILES_UNREAD" },
      { variable: "d", code: "CAP_PILES_UNREAD" },
      { variable: "e", code: "CAP_PILES_UNREAD" },
    ]);
    expect(Object.keys(concrete.bindings).sort(), "and its plan and depth still bound, for the reader to see").toEqual(["B", "D", "L", "count"]);
    const blinding = rails.blindingRail(input("pcc.blinding")).offers[0] as Offer;
    expect([blinding.ruleId, blinding.omitted], "its blinding names n and d").toEqual([
      "pcc.blinding_rect_piled",
      [
        { variable: "n", code: "CAP_PILES_UNREAD" },
        { variable: "d", code: "CAP_PILES_UNREAD" },
      ],
    ]);
    const formwork = rails.foundationFormworkRail(input("rcc.formwork")).offers[0] as Offer;
    expect([formwork.ruleId, formwork.coverage], "the sides it is formed along meet no pile").toEqual(["rcc.foundation.formwork_rect", "COMPLETE"]);
  });

  test("a cap the plans hold no pile under keeps its row and names CAP_HOLDS_NO_PILE — for its concrete and its blinding", async () => {
    const rails = await railsOf();
    const { setup, row } = oneCap({ piles: [] });
    const input = (kind: string) => ({ campaignId: "c", setRevisionId: "rev", kind, objects: [row], setup }) as never;
    const concrete = rails.foundationConcreteRail(input("rcc.concrete")).offers[0] as Offer;
    expect(concrete.coverage).toBe("PARTIAL_DECLARED");
    expect(concrete.omitted, "d and e have nothing to be read off: the plans disagree about this cap").toEqual([
      { variable: "d", code: "CAP_HOLDS_NO_PILE" },
      { variable: "e", code: "CAP_HOLDS_NO_PILE" },
    ]);
    const blinding = rails.blindingRail(input("pcc.blinding")).offers[0] as Offer;
    expect(blinding.omitted, "and its blinding names the same, for d alone").toEqual([{ variable: "d", code: "CAP_HOLDS_NO_PILE" }]);
  });

  test("piles of two diameters under one cap are no one `d`: the diameter is omitted PILE_DIAMETER_UNSTATED", async () => {
    const rails = await railsOf();
    const { setup, row } = oneCap({ piles: ["PILE:1", "PILE:2"] }, { pileDia: ["500", "600"] });
    const offer = rails.foundationConcreteRail({ campaignId: "c", setRevisionId: "rev", kind: "rcc.concrete", objects: [row], setup } as never).offers[0] as Offer;
    expect(offer.omitted).toEqual([{ variable: "d", code: "PILE_DIAMETER_UNSTATED" }]);
    expect(offer.bindings["e"], "the head height is still bound: only the diameter is in question").toMatchObject({ value: "75" });
  });

  test("two held piles of one diameter, a stated head and a recess: COMPLETE, and the formula the line prints names all of it", async () => {
    const rails = await railsOf();
    const recess: RecessSetup = {
      length: { value: "1000", unit: "mm", basis: "TRANSCRIBED", source: "R:L" },
      breadth: { value: "800", unit: "mm", basis: "TRANSCRIBED", source: "R:B" },
      depth: { value: "500", unit: "mm", basis: "TRANSCRIBED", source: "R:D" },
    };
    const { setup, row } = oneCap({ piles: ["PILE:1", "PILE:2"], recess });
    const offer = rails.foundationConcreteRail({ campaignId: "c", setRevisionId: "rev", kind: "rcc.concrete", objects: [row], setup } as never).offers[0] as Offer;
    expect(offer.ruleId).toBe("rcc.pile_cap.prism_rect_recess");
    expect(offer.coverage).toBe("COMPLETE");
    expect(Object.keys(offer.bindings).sort()).toEqual(["B", "Br", "D", "Dr", "L", "Lr", "count", "d", "e", "n"]);
    // 2 × 2 × 1.295 − 2 × π/4 × 0.5² × 0.075 − 1 × 0.8 × 0.5
    const owed = new Exact(2).mul(2).mul("1.295").minus(SECTION.mul(2).mul("0.075")).minus(new Exact(1).mul("0.8").mul("0.5"));
    expect(agrees(figureOf(offer), owed), `${String(figureOf(offer))} is 2 × 2 × 1.295 − 2 × π/4 × 0.5² × 0.075 − 1 × 0.8 × 0.5`).toBe(true);
  });

  test("a recess stated one way only is no recess stated: concrete and formwork keep their rows naming CAP_RECESS_UNSTATED, never the whole prism (I-598)", async () => {
    const rails = await railsOf();
    const recess: RecessSetup = {
      length: { value: "1000", unit: "mm", basis: "TRANSCRIBED", source: "R:L" },
      breadth: null,
      depth: { value: "500", unit: "mm", basis: "TRANSCRIBED", source: "R:D" },
    };
    const { setup, row } = oneCap({ piles: ["PILE:1", "PILE:2"], recess });
    const input = (kind: string) => ({ campaignId: "c", setRevisionId: "rev", kind, objects: [row], setup }) as never;
    const concrete = rails.foundationConcreteRail(input("rcc.concrete")).offers[0] as Offer;
    expect([concrete.ruleId, concrete.coverage], "the recess sentence, kept with no figure — never the prism over a void nobody netted").toEqual(["rcc.pile_cap.prism_rect_recess", "PARTIAL_DECLARED"]);
    expect(concrete.omitted, "and the side it lacks, by name").toEqual([{ variable: "Br", code: "CAP_RECESS_UNSTATED" }]);
    expect(Object.keys(concrete.bindings).sort(), "the sides it does state still bound, for the reader to see").toEqual(["B", "D", "L", "Lr", "count", "d", "Dr", "e", "n"].sort());
    expect(figureOf(concrete), "no figure").toBeNull();
    const formwork = rails.foundationFormworkRail(input("rcc.formwork")).offers[0] as Offer;
    expect([formwork.ruleId, formwork.coverage, formwork.omitted], "its four sides cannot be formed off one: the formwork keeps its row too").toEqual([
      "rcc.pile_cap.formwork_rect_recess",
      "PARTIAL_DECLARED",
      [{ variable: "Br", code: "CAP_RECESS_UNSTATED" }],
    ]);

    const seen: RecessSetup = { length: null, breadth: null, depth: null };
    const named = oneCap({ piles: ["PILE:1"], recess: seen });
    const nothing = rails.foundationConcreteRail({ campaignId: "c", setRevisionId: "rev", kind: "rcc.concrete", objects: [named.row], setup: named.setup } as never).offers[0] as Offer;
    expect([nothing.coverage, nothing.omitted], "a recess named and stated no way at all names all three").toEqual([
      "PARTIAL_DECLARED",
      [
        { variable: "Lr", code: "CAP_RECESS_UNSTATED" },
        { variable: "Br", code: "CAP_RECESS_UNSTATED" },
        { variable: "Dr", code: "CAP_RECESS_UNSTATED" },
      ],
    ]);
  });

  test("a FOOTING is never read as a cap, whatever the junction map holds under its key", async () => {
    const rails = await railsOf();
    const { setup, row } = oneCap({ piles: ["PILE:1"] }, { elementType: "footing" });
    const offer = rails.foundationConcreteRail({ campaignId: "c", setRevisionId: "rev", kind: "rcc.concrete", objects: [row], setup } as never).offers[0] as Offer;
    expect(offer.ruleId, "a footing stands on the ground: L-FRM-02's prism").toBe("rcc.foundation.prism_rect");
    expect(Object.keys(offer.bindings).sort()).toEqual(["B", "D", "L", "count"]);
  });

  test("the area's roster names each of its codes by its own name, in order — no name holds its neighbour's code", () => {
    const named: Record<string, string> = read as unknown as Record<string, string>;
    for (const code of FOUNDATIONS_RAIL_CODES) expect(named[code], `\`${code}\` is exported under its own name and holds itself`).toBe(code);
  });
});

/**
 * FND-HEAD (I-597): the head's height READ off Rev C's own S-05 — `MAIN BARS EXTENDED 3" INTO
 * THE CAP` beside `AND 40d (800) ABOVE THE CUT-OFF` on the PILE CURTAILMENT & SPIRAL ZONES view — by the
 * reader the setup runs (`viewTextsOf`, `headHeightOverRevision`), over the partition's own view
 * assignments and the drawing's declared unit. PC5's recess is still unread here (FND-RECESS reads
 * it), so PC5 publishes its prism less its nine heads and NOT its recess: this step never lands on
 * BNBC's golden path without the recess reader beside it.
 */
describe("FND-HEAD: the heads' height as the set states it", () => {
  /** S-05's two lines, as the Rev C corpus keys them. */
  const EMBEDMENT = "DXF_HANDLE:22A8";
  const CUT_OFF = "DXF_HANDLE:22A9";

  const headOf = async () => {
    const stage = await bnbc();
    const { headHeightOverRevision, viewTextsOf } = await import("@/modules/takeoff/measure/cap-junctions");
    const textsByView = viewTextsOf(stage.graph, stage.evidence.assignments);
    return { stage, textsByView, head: headHeightOverRevision([{ textsByView, declaredUnit: stage.evidence.declaredUnit?.unit ?? null }]) };
  };

  test(
    "the revision states one head: 3 in, RESOLVED, TRANSCRIBED, cited to S-05's embedment line — the one clause of the set that speaks of a length into the cap",
    async () => {
      const { stage, textsByView, head } = await headOf();
      expect(head).toEqual({ reading: { value: "3", unit: "in", basis: "TRANSCRIBED", source: EMBEDMENT }, standing: "RESOLVED" });
      const view = stage.evidence.assignments.get(EMBEDMENT);
      expect(view, "the embedment line stands in a view the partition assigned").toBeDefined();
      expect(stage.evidence.assignments.get(CUT_OFF), "and its cut-off line in the same view — one note, two TEXT entities").toBe(view);
      const caption = stage.evidence.views.find((one) => one.viewKey === view)?.caption ?? "";
      expect(caption, "the pile's own detail").toContain("PILE CURTAILMENT");
      const { pileHeadClausesOf } = await import("@/modules/takeoff/partition/notation/pile-head");
      const clauses = [...textsByView.values()].flatMap((texts) => pileHeadClausesOf(texts, stage.evidence.declaredUnit?.unit ?? null));
      expect(clauses.map((one) => [one.stated, one.stated ? one.sourceKeys : one.sourceKey]), "every clause of the drawing that states a length into the cap").toEqual([[true, [EMBEDMENT, CUT_OFF]]]);
    },
    BUDGET_MS,
  );

  test(
    "the 26 caps offered with e = 3 in (76.2 mm): 25 COMPLETE at their prisms less their heads; PC5 COMPLETE less its nine heads, its recess not yet read",
    async () => {
      const { stage, head } = await headOf();
      const junctions = junctionsOver(stage, { headHeight: head });
      const concrete = capBatch(stage, CAP_KINDS.concrete, setupOver(stage, junctions)).offers;
      expect(concrete.length, "one line per cap").toBe(26);
      expect(concrete.every((offer) => offer.coverage === "COMPLETE"), "every cap publishes").toBe(true);
      expect(concrete.every((offer) => offer.bindings["e"]?.value === "3" && offer.bindings["e"]?.unit === "in" && offer.bindings["e"]?.source === EMBEDMENT), "each binds e as S-05 writes it, cited to it").toBe(true);
      expect(concrete.every((offer) => !offer.ruleId.endsWith("_recess")), "and no cap stands under a recess sentence: nothing read one").toBe(true);

      const e = new Exact("0.0762");
      const others = concrete.filter((offer) => !isPc5(offer, stage));
      const pc5 = concrete.filter((offer) => isPc5(offer, stage));
      expect([others.length, pc5.length]).toEqual([25, 1]);
      const heldOthers = others.reduce((sum, offer) => sum + Number(offer.bindings["n"]?.value), 0);
      expect(heldOthers, "the 25 hold 80 of the 89 piles; PC5 the other nine").toBe(80);
      const owedOthers = new Exact(prismsOf(others).toString()).minus(SECTION.mul(80).mul(e));
      const figureOthers = sumOf(others);
      expect(agrees(figureOthers, owedOthers), `${figureOthers.toString()} m³ is the 25 prisms less 80 heads of π/4 × 0.5² × 0.0762`).toBe(true);
      expect(figureOthers.toFixed(6), "the 25 caps other than PC5").toBe("111.720578");
      const figurePc5 = sumOf(pc5);
      expect(agrees(figurePc5, new Exact(prismsOf(pc5).toString()).minus(SECTION.mul(9).mul(e))), `PC5 ${figurePc5.toString()} m³ is its prism less nine heads`).toBe(true);
      expect(figurePc5.toFixed(6), "PC5, over by its recess until FND-RECESS reads it").toBe("15.729093");
      const all = figureOthers.plus(figurePc5);
      expect(all.toFixed(6), "the 26 with the recess unread — over R0's 122.500 by the recess, which is why this step lands only beside FND-RECESS").toBe("127.449672");
      expect(new Exact(all.toString()).minus(RECESS_VOID).toFixed(3), "less the recess S-07 prints, the 26 stand at the 122.464 FND-RECESS owes").toBe("122.464");
    },
    BUDGET_MS,
  );
});

/**
 * FND-RECESS (I-598): PC5's lift-pit recess READ off Rev C's own S-07 — the void cut into the
 * top of PC5's section, `2493` across its mouth and `914` down to its floor as the two dimensions on
 * it write them, and `2493x2188` beside LIFT PIT RECESS — by the reader the setup runs
 * (`recessesOverRevision`), with the heads read beside it (FND-HEAD). Every figure is the set's; no
 * reading is staged.
 */
describe("FND-RECESS: PC5's recess as the set states it, beside the heads", () => {
  const read = async () => {
    const stage = await bnbc();
    const { headHeightOverRevision, recessesOverRevision, viewTextsOf } = await import("@/modules/takeoff/measure/cap-junctions");
    const declaredUnit = stage.evidence.declaredUnit?.unit ?? null;
    const head = headHeightOverRevision([{ textsByView: viewTextsOf(stage.graph, stage.evidence.assignments), declaredUnit }]);
    const views = stage.evidence.views.map((view) => ({ viewKey: view.viewKey, caption: view.caption }));
    const marks = [...new Set(stage.placed.placements.filter((row) => row.elementType === "pile_cap").map((row) => row.mark))];
    const recesses = recessesOverRevision([{ graph: stage.graph, views, assignments: stage.evidence.assignments, declaredUnit }], marks);
    const junctions = junctionsOver(stage, { headHeight: head, recessOf: (row) => recesses.get(row.mark) ?? null });
    return { stage, recesses, setup: setupOver(stage, junctions) };
  };

  test(
    "the revision states one recess, PC5's: 2493 × 2188 × 914 mm, TRANSCRIBED, each side cited to the entity that writes it — no other cap",
    async () => {
      const { recesses } = await read();
      expect([...recesses.entries()]).toEqual([
        [
          "PC5",
          {
            length: { value: "2493", unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:22BA" },
            breadth: { value: "2188", unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:22DD" },
            depth: { value: "914", unit: "mm", basis: "TRANSCRIBED", source: "DXF_HANDLE:22C9" },
          },
        ],
      ]);
    },
    BUDGET_MS,
  );

  test(
    "the 26 caps' concrete: every one COMPLETE, PC5 alone under the recess sentence — 122.464091 m³, the prisms less 89 heads and S-07's recess, inside R0's band on 122.500",
    async () => {
      const { stage, setup } = await read();
      const concrete = capBatch(stage, CAP_KINDS.concrete, setup).offers;
      expect(concrete.length, "one line per cap").toBe(26);
      expect(concrete.filter((offer) => offer.coverage !== "COMPLETE").map((offer) => offer.omitted), "every cap publishes").toEqual([]);
      const pc5 = concrete.filter((offer) => isPc5(offer, stage));
      expect(pc5.map((offer) => offer.ruleId), "PC5 under the recess sentence").toEqual(["rcc.pile_cap.prism_rect_recess"]);
      expect(concrete.filter((offer) => offer.ruleId.endsWith("_recess")).length, "and no other cap").toBe(1);
      expect([pc5[0]?.bindings["Lr"]?.value, pc5[0]?.bindings["Br"]?.value, pc5[0]?.bindings["Dr"]?.value], "bound as S-07 writes them").toEqual(["2493", "2188", "914"]);

      const figurePc5 = sumOf(pc5);
      const e = new Exact("0.0762");
      expect(agrees(figurePc5, new Exact(prismsOf(pc5).toString()).minus(SECTION.mul(9).mul(e)).minus(RECESS_VOID)), `PC5 ${figurePc5.toString()} m³ is its prism less nine heads and 2.493 × 2.188 × 0.914`).toBe(true);
      expect(figurePc5.toFixed(6), "PC5 net of its heads and its recess").toBe("10.743512");
      const all = sumOf(concrete);
      expect(all.toFixed(6), "the 26: FND-HEAD's 127.449672 less S-07's recess").toBe("122.464091");
      expect(withinBand(all, R0_CAP_CONCRETE), `${all.toString()} m³ inside R0's band on 122.500`).toBe(true);
    },
    BUDGET_MS,
  );

  test(
    "the 26 caps' formwork: every one COMPLETE, PC5 formed along its recess's four sides — 262.689481 m², inside R0's band on 262.773",
    async () => {
      const { stage, setup } = await read();
      const formwork = capBatch(stage, CAP_KINDS.formwork, setup).offers;
      expect([formwork.length, formwork.filter((offer) => offer.coverage !== "COMPLETE").length]).toEqual([26, 0]);
      expect(formwork.filter((offer) => isPc5(offer, stage)).map((offer) => offer.ruleId)).toEqual(["rcc.pile_cap.formwork_rect_recess"]);
      const formed = sumOf(formwork);
      expect(agrees(formed, new Exact(STANDING_FORMWORK).plus(RECESS_SIDES)), `${formed.toString()} is 254.132613 m² and 2 × (2.493 + 2.188) × 0.914`).toBe(true);
      expect(formed.toFixed(6)).toBe("262.689481");
      expect(withinBand(formed, R0_CAP_FORMWORK), "inside R0's band").toBe(true);
    },
    BUDGET_MS,
  );
});
