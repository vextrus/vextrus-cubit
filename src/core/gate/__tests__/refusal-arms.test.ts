/**
 * The gate's refusal ladder, judged as the pure function it is (SEAM-GATE, L-MEA-08, L-QTY-04, Q-07).
 *
 * Every arm the gate can answer with is decided before anything is written — which campaign holds the
 * offer, which version the edition puts in force, whether the tree implements it, whether the geometry
 * was corroborated, whether the canon can carry the readings — so the ladder is provable without a
 * database, and each registered code is exercised here by name (Q-07's exercise half).
 *
 * Nothing is transcribed: the method under test is the registry's own, its variables are the ones it
 * declares, and the threshold is the seed edition's (B-19).
 */
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../errors";
import type { Offer } from "../../offers/contract";
import { GEOMETRY_TYPES } from "../../offers/law";
import type { PinnedEdition } from "../../campaigns";
import { MEMBER_VOLUME_METHOD } from "../../rulesets/methods/member/volume";
import { implementationOf } from "../../rulesets/methods/registry";
import { SEED_EDITION_CONTENT } from "../../rulesets/seed";
import { judgeOffer, type MeasuredUnder } from "../evaluate";

/** The campaign the offers below are judged under — a snapshot, not a store read. */
const UNDER: MeasuredUnder = {
  campaignId: "1a1d6c3a-0a5e-4a7b-9c2d-33333333ac01",
  projectId: "2b2d6c3a-0a5e-4a7b-9c2d-33333333ac02",
  setRevisionId: "3c3d6c3a-0a5e-4a7b-9c2d-33333333ac03",
  editionId: "4d4d6c3a-0a5e-4a7b-9c2d-33333333ac04",
  editionDigest: "0".repeat(64),
};

/** An edition citing the one pair this leaf implements — what a project's pin forks (L-REG-07). */
const EDITION: PinnedEdition = {
  editionId: UNDER.editionId,
  digest: UNDER.editionDigest,
  parameters: SEED_EDITION_CONTENT.parameters,
  methods: [MEMBER_VOLUME_METHOD],
};

/** The method the offers cite, and the variables it declares — read off the registry itself. */
const METHOD = implementationOf(MEMBER_VOLUME_METHOD);

/** One reading, in the unit it was written in. */
function reading(value: string, unit: string) {
  return { value, unit, basis: "MEASURED" as const, source: "S-101:e:41", calibration: "CAL:S-101:grid-A" };
}

/** Every variable the method declares, each read in feet — the offer a rail would make. */
function everyBinding(): Record<string, ReturnType<typeof reading>> {
  const method = METHOD;
  if (method === undefined || method.role !== "formula") throw new Error("the registry maps member.volume@1 to a formula — this suite judges the gate against it");
  return Object.fromEntries(method.variables.map((variable, at) => [variable.name, reading(String(at + 2), "ft")]));
}

/** One offer to the contract, with whatever this case changes about it. */
function offer(changed: Partial<Offer> = {}): Offer {
  return {
    ruleId: MEMBER_VOLUME_METHOD.ruleId,
    kind: "rcc.concrete",
    class: "column",
    register: { setRevisionId: UNDER.setRevisionId, objectKey: "column:C1:GF" },
    drawing: { drawingId: "5e5d6c3a-0a5e-4a7b-9c2d-33333333ac05", viewKey: "PLAN:S-101:t:12" },
    engine: "VECTOR",
    geometry: { type: GEOMETRY_TYPES[0], basis: "MEASURED", calibration: "CAL:S-101:grid-A" },
    bindings: everyBinding(),
    selectors: {},
    deductions: [],
    coverage: "COMPLETE",
    ...changed,
  };
}

/** The code one judgement refused with, or the arm it landed on instead. */
function answered(offered: Offer, edition: PinnedEdition = EDITION): string {
  const judgement = judgeOffer(offered, UNDER, edition);
  return judgement.arm === "refused" ? judgement.refusal.code : judgement.arm;
}

describe("SEAM-GATE: every offer lands on one arm, and a refusal names the registered code", () => {
  test("an offer to the contract, citing a method in force, publishes", () => {
    const judgement = judgeOffer(offer(), UNDER, EDITION);
    expect(judgement.arm, `a measured offer whose readings the canon carries publishes a line: ${JSON.stringify(judgement)}`).toBe("published");
  });

  test("a rule the edition does not cite is METHOD_NOT_IN_EDITION", () => {
    expect(
      answered(offer({ ruleId: "face.area" })),
      "which version of a rule is in force is the pinned edition's to say, and a rule it cites no version of is measured by nothing (L-MEA-08)",
    ).toBe(REFUSALS.METHOD_NOT_IN_EDITION.code);
  });

  test("a version the tree implements nothing for is METHOD_IMPLEMENTATION_MISSING", () => {
    const unimplemented: PinnedEdition = { ...EDITION, methods: [{ ruleId: MEMBER_VOLUME_METHOD.ruleId, version: "99" }] };
    expect(
      answered(offer(), unimplemented),
      "an edition may cite a pair this build implements nothing for — the gate says so rather than guessing a version (L-MEA-01)",
    ).toBe(REFUSALS.METHOD_IMPLEMENTATION_MISSING.code);
  });

  test("interpreted geometry is a queue item and never a line", () => {
    const judgement = judgeOffer(offer({ geometry: { type: GEOMETRY_TYPES[0], basis: "INTERPRETED", calibration: "CAL:S-101:grid-A" } }), UNDER, EDITION);
    expect(judgement.arm, "interpreted geometry uncorroborated is a declared exclusion, never a line (L-QTY-04)").toBe("queued");
    if (judgement.arm !== "queued") return;
    expect(judgement.item.cause, "and it states the registered reason it was deferred for (riskNotes (3))").toBe(REFUSALS.INTERPRETED_UNCORROBORATED.code);
  });

  test("a reading in a unit the canon has no factor for is UNIT_UNMAPPED", () => {
    const bindings = everyBinding();
    const first = Object.keys(bindings)[0] as string;
    expect(
      answered(offer({ bindings: { ...bindings, [first]: reading("3", "furlong") } })),
      "a spelling the canon has no factor for is refused rather than silently carried at 1.0 (L-FRM-06)",
    ).toBe(REFUSALS.UNIT_UNMAPPED.code);
  });

  test("a declared binding the offer omits is OFFER_NOT_TO_CONTRACT", () => {
    const bindings = everyBinding();
    const first = Object.keys(bindings)[0] as string;
    const { [first]: dropped, ...rest } = bindings;
    void dropped;
    expect(answered(offer({ bindings: rest })), "the rail and the method disagree about the declaration, which is not a measurement question (riskNotes (4))").toBe(
      REFUSALS.OFFER_NOT_TO_CONTRACT.code,
    );
  });

  test("a deduction candidate in a channel the method does not declare is OFFER_NOT_TO_CONTRACT", () => {
    expect(
      answered(offer({ deductions: [{ channel: "opening", measure: { value: "1", unit: "m2", basis: "MEASURED", source: "S-101:e:42" } }] })),
      "member.volume@1 deducts through no channel at this leaf, so a candidate for one is an offer its rule cannot answer (L-MEA-08)",
    ).toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  });

  test("an offer about another pinned revision is OFFER_NOT_TO_CONTRACT", () => {
    expect(
      answered(offer({ register: { setRevisionId: UNDER.campaignId, objectKey: "column:C1:GF" } })),
      "a campaign measures the revision it was opened over, so an offer about another one provenances to nothing it holds (L-REG-07)",
    ).toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  });

  test("the gate never answers PIN_STALE — freshness blocks signing, never measuring", () => {
    // L-REG-07's freshness gate "blocks signing". A campaign whose snapshot has diverged goes on
    // being measured against exactly what it copied, so PIN_STALE is the signing gate's answer and
    // never one of the arms an offer can land on (scope: signing is M9's).
    const arms = [
      answered(offer()),
      answered(offer({ ruleId: "face.area" })),
      answered(offer({ geometry: { type: GEOMETRY_TYPES[0], basis: "INTERPRETED" } })),
    ];
    expect(arms, "measuring is never blocked by a pin that has moved (L-REG-07)").not.toContain(REFUSALS.PIN_STALE.code);
    expect(arms, "and a campaign the gate did hold is never answered as one it does not (ARCH-03)").not.toContain(REFUSALS.CAMPAIGN_NOT_FOUND.code);
  });
});
