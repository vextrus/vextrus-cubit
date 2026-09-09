/**
 * The gate's refusal ladder, judged as the pure function it is (SEAM-GATE, L-MEA-08, L-QTY-04, Q-07).
 *
 * Every arm the gate can answer with is decided before anything is written — which version the
 * edition puts in force, whether the tree implements it, whether the register holds the object,
 * whether the geometry was corroborated, whether the readings can be carried and what they stand on
 * — so the ladder is provable without a database, and each registered code this seam answers with is
 * exercised here by name (Q-07's exercise half).
 *
 * Nothing is transcribed: the method under test is the registry's own, its variables are the ones it
 * declares, the class is one the catalogue bears for its kind, and the threshold is the seed
 * edition's (B-19).
 */
import { describe, expect, test } from "vitest";
import type { PinnedEdition } from "../../campaigns";
import { BEARS } from "../../catalogue/bears";
import { REFUSALS } from "../../errors";
import type { Offer } from "../../offers/contract";
import { GEOMETRY_TYPES } from "../../offers/law";
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

/** The method the offers cite — the formula the registry maps this leaf's one pair to. */
const METHOD = implementationOf(MEMBER_VOLUME_METHOD);

/** The formula, or a failure naming what this suite is judged against. */
function formula() {
  if (METHOD === undefined || METHOD.role !== "formula") {
    throw new Error("the registry maps member.volume@1 to a formula — this suite judges the gate against it");
  }
  return METHOD;
}

/** A class the catalogue bears the method's kind for — an offer names a pair `bears` holds (L-REG-07). */
function bearing(): { class: string; kind: string } {
  const row = BEARS.find((entry) => entry.kind === formula().kind);
  if (row === undefined) throw new Error(`the catalogue bears no class for ${formula().kind} — an offer of it names nothing`);
  return { class: row.class, kind: row.kind };
}

/** The object this suite offers over, and the register's answer that it holds it (L-QTY-03). */
const OBJECT_KEY = "v:PLAN:S-101:t:12|C1|1500.0,250.0@8f1d6c3a-0a5e-4a7b-9c2d-33333333ac09";
const REGISTERED: ReadonlySet<string> = new Set([OBJECT_KEY]);

/** The calibration reference every well-formed offer below stands on (L-QTY-03). */
const CALIBRATION = "CAL:S-101:grid-A";

/** One reading, in the unit it was written in. */
function reading(value: string, unit: string) {
  return { value, unit, basis: "MEASURED" as const, source: "S-101:e:41", calibration: CALIBRATION };
}

/** Every variable the method declares, each read in feet — the offer a rail would make. */
function everyBinding(): Record<string, ReturnType<typeof reading>> {
  return Object.fromEntries(formula().variables.map((variable, at) => [variable.name, reading(String(at + 2), "ft")]));
}

/** One offer to the contract, with whatever this case changes about it. */
function offer(changed: Partial<Offer> = {}): Offer {
  const pair = bearing();
  return {
    ruleId: MEMBER_VOLUME_METHOD.ruleId,
    kind: pair.kind,
    class: pair.class,
    register: { setRevisionId: UNDER.setRevisionId, objectKey: OBJECT_KEY },
    drawing: { drawingId: "5e5d6c3a-0a5e-4a7b-9c2d-33333333ac05", viewKey: "PLAN:S-101:t:12" },
    engine: "VECTOR",
    geometry: { type: GEOMETRY_TYPES[0], basis: "MEASURED", calibration: CALIBRATION },
    bindings: everyBinding(),
    selectors: {},
    deductions: [],
    coverage: "COMPLETE",
    ...changed,
  } as Offer;
}

/** The code one judgement refused with, or the arm it landed on instead. */
function answered(offered: Offer, edition: PinnedEdition = EDITION): string {
  const judgement = judgeOffer(offered, UNDER, edition, REGISTERED);
  return judgement.arm === "refused" ? judgement.refusal.code : judgement.arm;
}

describe("SEAM-GATE: every offer lands on one arm, and a refusal names the registered code", () => {
  test("an offer to the contract, citing a method in force, publishes", () => {
    const judgement = judgeOffer(offer(), UNDER, EDITION, REGISTERED);
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
    const judgement = judgeOffer(offer({ geometry: { type: GEOMETRY_TYPES[0], basis: "INTERPRETED", calibration: CALIBRATION } }), UNDER, EDITION, REGISTERED);
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

  test("a reading that is not a decimal figure at all is OFFER_NOT_TO_CONTRACT", () => {
    const bindings = everyBinding();
    const first = Object.keys(bindings)[0] as string;
    expect(
      answered(offer({ bindings: { ...bindings, [first]: reading("not-a-number", "ft") } })),
      "a line states the SI value at full precision, and text that is no figure is an inadmissible reading rather than a fault of the machine (L-QTY-03, L-QTY-04)",
    ).toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
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
      answered(offer({ register: { setRevisionId: UNDER.campaignId, objectKey: OBJECT_KEY } })),
      "a campaign measures the revision it was opened over, so an offer about another one provenances to nothing it holds (L-REG-07)",
    ).toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  });

  test("an object no register row of the revision holds is OFFER_NOT_TO_CONTRACT", () => {
    expect(
      answered(offer({ register: { setRevisionId: UNDER.setRevisionId, objectKey: `${OBJECT_KEY}-ghost` } })),
      "a line carries provenance to a register row as a reference, so a quantity for an object nothing registered is severed from what it claims to measure (L-QTY-03)",
    ).toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  });

  test("a measured offer affirming no calibration reference is OFFER_NOT_TO_CONTRACT", () => {
    const bare = Object.fromEntries(formula().variables.map((variable, at) => [variable.name, { value: String(at + 2), unit: "ft", basis: "MEASURED" as const, source: "S-101:e:41" }]));
    // The contract spells the geometry's reference as owed, so this offer is off it by construction:
    // the shape is cast in to prove the gate ANSWERS a rail that affirms nothing, rather than leaving
    // the arm to a type a rail reading a drawing at runtime can always get past.
    const affirmingNone = { type: GEOMETRY_TYPES[0], basis: "MEASURED" } as Offer["geometry"];
    const judgement = judgeOffer(offer({ bindings: bare, geometry: affirmingNone }), UNDER, EDITION, REGISTERED);
    expect(
      judgement.arm,
      "a line always carries a non-empty set of affirmed calibration references, and a missing mandatory publishable attribute is a hard block — nothing publishes (L-QTY-03, L-QTY-04)",
    ).toBe("refused");
    if (judgement.arm !== "refused") return;
    expect(judgement.refusal.code, "and the block names the registered code the rail is off the contract by (riskNotes (4))").toBe(REFUSALS.OFFER_NOT_TO_CONTRACT.code);
  });

  test("the gate never answers PIN_STALE — freshness blocks signing, never measuring", () => {
    // L-REG-07's freshness gate "blocks signing". A campaign whose snapshot has diverged goes on
    // being measured against exactly what it copied, so PIN_STALE is the signing gate's answer and
    // never one of the arms an offer can land on (scope: signing is M9's).
    const arms = [
      answered(offer()),
      answered(offer({ ruleId: "face.area" })),
      answered(offer({ geometry: { type: GEOMETRY_TYPES[0], basis: "INTERPRETED", calibration: CALIBRATION } })),
    ];
    expect(arms, "measuring is never blocked by a pin that has moved (L-REG-07)").not.toContain(REFUSALS.PIN_STALE.code);
    expect(arms, "and a campaign the gate did hold is never answered as one it does not (ARCH-03)").not.toContain(REFUSALS.CAMPAIGN_NOT_FOUND.code);
  });
});
