/**
 * S2 (session 8): the manual methods — `pcc.blinding.area@1`, the `junction` channel it deducts
 * members through, and the roster of which rule a hand measurement is offered under (R-TO-040,
 * R-TO-041, L-FRM-04 as s-measure I-388 reads it, L-MEA-09 as I-389 reads it, I-538, I-539).
 *
 * The figure is proved the way the gate asks for it: an offer shaped as the manual builder will make
 * it for J-000's ring on S-08 (the SOG outline 81D, the lift pit 830 as an opening, the FDN columns
 * standing through it as junctions, t = 75 mm from note 828) is JUDGED by `judgeOffer`, the gate's
 * pure judgement, under the seed edition's own parameters. Nothing is transcribed that the product
 * can answer: the method is the registry's, the threshold is the edition's, the channel's variable is
 * the gate's map (B-19).
 *
 * The readings are I-393's table (`docs/design/s-measure.md`), which
 * `tests/takeoff/manual/s-measure-decision.test.ts` recomputes from the committed DXF and model; the
 * columns' 4.051875 m² is split here so that one of them is a 300 × 300 stub — below the opening
 * threshold, and deducted whole all the same. Pure: no store, no clock.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { PinnedEdition } from "@/core/campaigns";
import { BEARS } from "@/core/catalogue/bears";
import { WORK_ITEM_CATALOGUE } from "@/core/catalogue/catalogue";
import { KINDS } from "@/core/catalogue/kinds";
import { CHANNEL_THRESHOLD, CHANNEL_VARIABLE, partitionDeductions } from "@/core/gate/deductions";
import { judgeOffer, type MeasuredUnder, type RegisteredLevel } from "@/core/gate/evaluate";
import type { DeductionCandidate, Measure, Offer } from "@/core/offers/contract";
import { THRESHOLD_VARIABLE } from "@/core/offers/law";
import { MANUAL_BLINDING_METHOD } from "@/core/rulesets/methods/manual/blinding";
import { MANUAL_GEOMETRIES, MANUAL_RULES, channelSupplies, manualRuleOf, type ManualGeometry } from "@/core/rulesets/methods/manual/rules";
import { enumerateMethods, implementationOf, methodKey, type FormulaMethod } from "@/core/rulesets/methods/registry";
import { SEED_EDITION_CONTENT } from "@/core/rulesets/seed";

/** The repository root, for the two facts this suite reads as text: a source file and the Decision. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

/** The campaign the offer is judged under — a snapshot, not a store read. */
const UNDER: MeasuredUnder = {
  campaignId: "1a1d6c3a-0a5e-4a7b-9c2d-5252525252a1",
  projectId: "2b2d6c3a-0a5e-4a7b-9c2d-5252525252a2",
  setRevisionId: "3c3d6c3a-0a5e-4a7b-9c2d-5252525252a3",
  editionId: "4d4d6c3a-0a5e-4a7b-9c2d-5252525252a4",
  editionDigest: "0".repeat(64),
};

/** An edition citing the manual pair beside the seed's own parameters (L-REG-07's fork). */
const EDITION: PinnedEdition = {
  editionId: UNDER.editionId,
  digest: UNDER.editionDigest,
  parameters: SEED_EDITION_CONTENT.parameters,
  methods: [MANUAL_BLINDING_METHOD],
};

/** A hand measurement's register row on S-08's view, standing on a level (s-measure I-378). */
const OBJECT_KEY = "v:LAYOUT_PLAN:DXF_HANDLE:2073|~m.5b1f0c9ad2e7|-125.0,-384025.4@6eaf4fa7-0a5e-4a7b-9c2d-5252525252a9";
const REGISTERED: ReadonlyMap<string, RegisteredLevel> = new Map([[OBJECT_KEY, { levelSlot: null }]]);

/** The view's scale of record (S-08 holds a DIMENSION_RATIO scale, the map's read-back). */
const CALIBRATION = "LAYOUT_PLAN:DXF_HANDLE:2073";

/** One reading, in the unit it was written in. */
function reading(value: string, unit: string, basis: Measure["basis"], source: string): Measure {
  return { value, unit, basis, source, calibration: CALIBRATION };
}

/** I-393's readings: the ring 81D, the pit 830 and the FDN columns meeting the ring, in mm². */
const RING_81D_MM2 = "328838371.24436192623624929233379";
const LIFT_PIT_830_MM2 = "8046918.88";
const COLUMN_STUB_MM2 = "90000"; // a 300 × 300 column: 0.09 m², below the 0.1 m² opening threshold
const OTHER_COLUMNS_MM2 = "3961875"; // the other 24 of the 25, clipped to the ring: 4051875 − 90000

/** The figure the gate must answer: (A − pit − columns) × 0.075, exact (B-07). */
const EXPECTED_M3 = "23.75546830232714446771869692503425";

/** What a hand measurement of J-000's ring offers, with whatever a case changes about it. */
function blindingOffer(deductions: readonly DeductionCandidate[], changed: Partial<Offer> = {}): Offer {
  return {
    ruleId: MANUAL_BLINDING_METHOD.ruleId,
    kind: "pcc.blinding",
    class: "slab",
    register: { setRevisionId: UNDER.setRevisionId, objectKey: OBJECT_KEY },
    drawing: { drawingId: "5e5d6c3a-0a5e-4a7b-9c2d-5252525252a5", viewKey: CALIBRATION },
    engine: "VECTOR",
    geometry: { type: "POLYGON", basis: "MEASURED", calibration: CALIBRATION },
    bindings: {
      count: reading("1", "pcs", "ENTERED", "act:measurement"),
      A: reading(RING_81D_MM2, "mm2", "MEASURED", "S-08:DXF_HANDLE:81D"),
      t: reading("75", "mm", "TRANSCRIBED", "S-08:DXF_HANDLE:828"),
      [THRESHOLD_VARIABLE]: reading("0.1", "m2", "DERIVED", "edition:openingDeductionMinM2"),
    },
    selectors: {},
    deductions,
    omitted: [],
    coverage: "COMPLETE",
    ...changed,
  };
}

const opening = (value: string, source: string): DeductionCandidate => ({ channel: "opening", measure: reading(value, "mm2", "MEASURED", source) });
const junction = (value: string, source: string): DeductionCandidate => ({ channel: "junction", measure: reading(value, "mm2", "DERIVED", source) });

/** The pit (deducted), a sliver exactly AT the threshold and one below it (both kept), and the columns. */
const J000_RING: readonly DeductionCandidate[] = [
  opening(LIFT_PIT_830_MM2, "S-08:DXF_HANDLE:830"),
  opening("100000", "act:cut-out-at-threshold"),
  opening("50000", "act:cut-out-below-threshold"),
  junction(COLUMN_STUB_MM2, "register:C-stub@FDN"),
  junction(OTHER_COLUMNS_MM2, "register:FDN-columns"),
];

/** The blinding method, as the registry answers it. */
function blinding(): FormulaMethod {
  const method = implementationOf(MANUAL_BLINDING_METHOD);
  if (method === undefined || method.role !== "formula") throw new Error(`${methodKey(MANUAL_BLINDING_METHOD)} maps to a formula — this suite judges the gate against it`);
  return method;
}

describe("S2: pcc.blinding.area@1 measures the blinding under a traced outline", () => {
  test("it is enumerated, and it is a VOLUME formula of the blinding kind over the ring, its two channels and a thickness — with no projection", () => {
    expect(enumerateMethods().map(methodKey), "the registry enumerates the manual pair — a pair no area names is one no edition can cite (L-MEA-01)").toContain("pcc.blinding.area@1");
    const method = blinding();
    expect(method.kind, "it measures the blinding kind").toBe("pcc.blinding");
    expect(method.dimension, "in the dimension the catalogue bills the blinding in (L-MEA-04)").toBe(WORK_ITEM_CATALOGUE["pcc.blinding"].dimension);
    expect(
      Object.fromEntries(method.variables.map((variable) => [variable.name, variable.dimension])),
      "the ring's area, the multiplier, the two deducted sums, the thickness and the threshold in force — and no `p`: a traced outline projects nothing (I-388)",
    ).toStrictEqual({ count: "COUNT", A: "AREA", openings: "AREA", junctions: "AREA", t: "LENGTH", threshold: "AREA" });
    expect([...method.deductionChannels], "cut-outs through the opening channel, members through the junction channel (I-389)").toStrictEqual(["opening", "junction"]);
    expect(method.template, "the line prints the traced plate, net of both deductions (L-QTY-03)").toBe("V = count × (A − openings − junctions) × t");
  });

  test("the gate publishes J-000's ring: the pit deducts, cut-outs at and below the threshold are kept, and every column comes off whole", () => {
    const judgement = judgeOffer(blindingOffer(J000_RING), UNDER, EDITION, REGISTERED);
    expect(judgement.arm, `the hand blinding publishes: ${JSON.stringify(judgement)}`).toBe("published");
    if (judgement.arm !== "published") return;
    const line = judgement.line;

    expect(line.value, "(81D − pit − 25 columns) × 0.075 m³, exact to the last digit the readings carry (B-07)").toBe(EXPECTED_M3);
    expect(line.unit).toBe("m3");
    expect([line.ruleId, line.ruleVersion], "under the manual pair the edition cites").toStrictEqual(["pcc.blinding.area", "1"]);

    const sides = (line.deductions as readonly { channel: string; measure: Measure; side: string }[]).map((held) => `${held.channel}:${held.measure.value}:${held.side}`);
    expect(sides.sort(), "each candidate stands on the line with the side it fell on — the stub below the opening threshold is deducted, the cut-out AT it is kept (L-MEA-02, L-MEA-09)").toStrictEqual(
      [
        `junction:${COLUMN_STUB_MM2}:deducted`,
        `junction:${OTHER_COLUMNS_MM2}:deducted`,
        "opening:100000:kept",
        "opening:50000:kept",
        `opening:${LIFT_PIT_830_MM2}:deducted`,
      ].sort(),
    );

    const bindings = line.bindings as Readonly<Record<string, { basis: string; canonical: { value: string; unit: string } }>>;
    expect(bindings["openings"]?.canonical, "the gate bound the opening channel's deducted sum itself (L-MEA-02)").toStrictEqual({ value: "8.04691888", unit: "m2" });
    expect(bindings["junctions"]?.canonical, "and the junction channel's — both columns, whole").toStrictEqual({ value: "4.051875", unit: "m2" });
    expect(bindings["junctions"]?.basis, "a sum the gate computed is DERIVED (L-QTY-01)").toBe("DERIVED");
    expect(line.formula, "the printed formula names every reading it was evaluated over").toContain("junctions = 4.051875 m2");
  });

  test("an offer that binds the junctions' sum itself has computed what only the gate may compute, and is refused", () => {
    const summed = blindingOffer(J000_RING.filter((candidate) => candidate.channel === "opening"), {
      bindings: { ...blindingOffer([]).bindings, junctions: reading("4.051875", "m2", "DERIVED", "act:measurement") },
    });
    const judgement = judgeOffer(summed, UNDER, EDITION, REGISTERED);
    expect(judgement.arm === "refused" ? judgement.refusal.code : judgement.arm, "an offer carries candidates and no sums (L-MEA-08)").toBe("OFFER_NOT_TO_CONTRACT");
  });
});

describe("S2 (I-538): the junction channel deducts whole, and carries no threshold", () => {
  test("the junction channel states no threshold and binds `junctions`; the opening channel keeps its own", () => {
    expect(CHANNEL_THRESHOLD.junction, "L-MEA-09 puts the allowance on openings alone").toBeNull();
    expect(CHANNEL_THRESHOLD.opening, "and the opening channel is still partitioned against the edition's figure (L-MEA-02)").toBe("openingDeductionMinM2");
    expect(CHANNEL_VARIABLE.junction).toBe("junctions");
  });

  test("a junction far below every threshold is deducted; one in a unit the canon lacks is refused by name", () => {
    const tiny: DeductionCandidate = { channel: "junction", measure: reading("1", "mm2", "DERIVED", "register:tiny") };
    const answer = partitionDeductions([tiny], SEED_EDITION_CONTENT.parameters);
    expect(answer, "a member's plan is deducted whatever its size (L-MEA-09)").toStrictEqual({ ok: true, deducted: [tiny], kept: [] });

    const unmapped = partitionDeductions([{ channel: "junction", measure: reading("1", "furlong2", "DERIVED", "register:odd") }], SEED_EDITION_CONTENT.parameters);
    expect(unmapped, "a junction nobody can carry is never taken off a bill on its digits").toStrictEqual({ ok: false, code: "UNIT_UNMAPPED" });

    const unreadable = partitionDeductions([{ channel: "junction", measure: reading("about 1", "mm2", "DERIVED", "register:odd") }], SEED_EDITION_CONTENT.parameters);
    expect(unreadable, "and a reading that is not a figure is no candidate at all").toStrictEqual({ ok: false, code: "OFFER_NOT_TO_CONTRACT" });
  });

  test("a junction below zero is refused by name and never deducted — with no threshold in the way it would raise the figure (L-QTY-04)", () => {
    // A signed ring area that came through clockwise: −10 m². Subtracted from the ring it would ADD
    // 0.75 m³ to the blinding and still publish COMPLETE — over-measurement, a hard block.
    const signed = junction("-10000000", "register:signed-ring");
    expect(partitionDeductions([signed], SEED_EDITION_CONTENT.parameters), "a member's plan is never less than nothing").toStrictEqual({ ok: false, code: "OFFER_NOT_TO_CONTRACT" });

    const judgement = judgeOffer(blindingOffer([...J000_RING, signed]), UNDER, EDITION, REGISTERED);
    expect(judgement.arm === "refused" ? judgement.refusal.code : `${judgement.arm}: ${JSON.stringify(judgement)}`, "the offer is refused through the gate, by name").toBe("OFFER_NOT_TO_CONTRACT");

    // The same reading in the opening channel moves nothing: it is never strictly greater than the
    // threshold, so it is kept, and the ring publishes the figure it publishes without it.
    const asOpening = opening("-10000000", "act:signed-cut-out");
    const kept = judgeOffer(blindingOffer([...J000_RING, asOpening]), UNDER, EDITION, REGISTERED);
    expect(kept.arm === "published" ? kept.line.value : `${kept.arm}: ${JSON.stringify(kept)}`, "a threshold channel's own comparison keeps it").toBe(EXPECTED_M3);

    // Zero is a plan of nothing: deducted, and it moves nothing either.
    const nothing = junction("0", "register:zero");
    const zero = judgeOffer(blindingOffer([...J000_RING, nothing]), UNDER, EDITION, REGISTERED);
    expect(zero.arm === "published" ? zero.line.value : `${zero.arm}: ${JSON.stringify(zero)}`).toBe(EXPECTED_M3);
  });
});

/** The dimension each geometry's own trace is read in. */
const TRACE_DIMENSION: Readonly<Record<ManualGeometry, string>> = { POLYGON: "AREA", POLYLINE: "LENGTH", POINT_SET: "COUNT" };

describe("S2 (I-539): which rule a hand measurement is offered under", () => {
  test("every pairing names a formula the registry enumerates, of its own kind, for a class the catalogue bears it for — once", () => {
    expect(MANUAL_RULES.length, "a roster over nothing offers nothing").toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const rule of MANUAL_RULES) {
      const said = `${rule.geometry} × ${rule.class} × ${rule.kind}`;
      expect(seen.has(said), `${said} is paired once — two rules for one pairing would let the builder pick`).toBe(false);
      seen.add(said);
      expect([...MANUAL_GEOMETRIES], `${said}: a geometry a manual tool draws`).toContain(rule.geometry);
      expect(BEARS.some((row) => row.class === rule.class && row.kind === rule.kind), `${said}: the catalogue bears ${rule.kind} for ${rule.class} (L-MEA-04)`).toBe(true);

      const versions = enumerateMethods().filter((pair) => pair.ruleId === rule.ruleId);
      expect(versions.length, `${said}: ${rule.ruleId} is a rule the registry enumerates`).toBeGreaterThan(0);
      for (const pair of versions) {
        const method = implementationOf(pair);
        expect(method?.role, `${methodKey(pair)} is a formula`).toBe("formula");
        const formula = method as FormulaMethod;
        expect(formula.kind, `${methodKey(pair)} measures ${rule.kind}`).toBe(rule.kind);
        expect(Object.keys(rule.supply).sort(), `${said}: every variable ${methodKey(pair)} declares has a supplier, and nothing else does`).toStrictEqual(formula.variables.map((variable) => variable.name).sort());

        for (const variable of formula.variables) {
          const supply = rule.supply[variable.name];
          if (supply === undefined) continue;
          if (supply.from === "trace") expect(variable.dimension, `${said}: ${variable.name} is the trace's own reading`).toBe(TRACE_DIMENSION[rule.geometry]);
          if (supply.from === "multiplier") expect(variable.dimension, `${said}: ${variable.name} is a count`).toBe("COUNT");
          if (supply.from === "gate") {
            expect([...formula.deductionChannels], `${said}: ${variable.name} is the sum of a channel the method declares`).toContain(supply.channel);
            expect(CHANNEL_VARIABLE[supply.channel], `${said}: and the gate binds that channel's sum into ${variable.name}`).toBe(variable.name);
          }
          if (supply.from === "edition") {
            expect(variable.name, `${said}: only the threshold in force is the edition's to supply`).toBe(THRESHOLD_VARIABLE);
            expect(Object.keys(SEED_EDITION_CONTENT.parameters), `${said}: the edition states ${supply.parameter}`).toContain(supply.parameter);
            expect(
              formula.deductionChannels.map((channel) => CHANNEL_THRESHOLD[channel]),
              `${said}: ${supply.parameter} is the threshold of a channel ${methodKey(pair)} partitions`,
            ).toContain(supply.parameter);
          }
        }
      }
    }
  });

  test("a slab's traced blinding is offered under the twin; a footing's or a pile cap's is not offered by hand", () => {
    expect(manualRuleOf("POLYGON", "slab", "pcc.blinding")?.ruleId).toBe("pcc.blinding.area");
    expect(manualRuleOf("POLYGON", "pile_cap", "pcc.blinding"), "a cap's blinding owes the piles through it, which no hand trace offers yet (I-539)").toBeUndefined();
    expect(manualRuleOf("POLYGON", "footing", "pcc.blinding")).toBeUndefined();
    expect(manualRuleOf("POLYLINE", "slab", "pcc.blinding"), "a run is not a ring").toBeUndefined();
  });

  test("a pairing's channel variables and threshold are the gate's own, and a method partitioned against two thresholds is no roster row", () => {
    expect(channelSupplies(["opening", "junction"]), "each channel fills the variable the gate binds its sum into; only the partitioned one brings a threshold").toStrictEqual({
      [CHANNEL_VARIABLE.opening]: { from: "gate", channel: "opening" },
      [CHANNEL_VARIABLE.junction]: { from: "gate", channel: "junction" },
      [THRESHOLD_VARIABLE]: { from: "edition", parameter: CHANNEL_THRESHOLD.opening },
    });
    expect(channelSupplies(["junction"]), "a channel with no threshold brings none").toStrictEqual({ [CHANNEL_VARIABLE.junction]: { from: "gate", channel: "junction" } });
    expect(() => channelSupplies(["opening", "finish_opening"]), "one `threshold` variable cannot stand for two figures (L-MEA-02)").toThrow(/2 thresholds/);
  });

  test("every kind of KINDS has its row in the Decision's table, and the table names no kind the roster lacks", () => {
    const decision = read("docs/design/s-measure.md");
    const anchor = decision.indexOf("Every kind of `KINDS`, decided");
    expect(anchor, "the Decision decides each kind under one heading (I-539)").toBeGreaterThan(-1);
    // The first table after the heading, to its last row.
    const rows: string[] = [];
    for (const line of decision.slice(anchor).split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("|")) rows.push(trimmed);
      else if (rows.length > 0 && trimmed !== "") break;
    }
    const named = rows
      .slice(2) // the header and its rule
      .flatMap((row) => (row.split("|")[1] ?? "").split(","))
      .map((cell) => cell.trim());
    expect(named.length, "the table has rows").toBeGreaterThan(0);
    expect([...KINDS].filter((kind) => !named.includes(kind)), "a kind with no row is a hand measurement nobody decided — add its row (I-539)").toEqual([]);
    expect(named.filter((kind) => !(KINDS as readonly string[]).includes(kind)), "a row for a kind the roster does not hold is stale").toEqual([]);
  });
});

describe("S2 (I-539): the manual geometry roster has one home", () => {
  test("rules.ts states the roster only until S1's core/manual/law.ts does, and imports it from there once it does (ARCH-02)", () => {
    const rules = read("src/core/rulesets/methods/manual/rules.ts");
    const declares = /export const MANUAL_GEOMETRIES\s*=/.test(rules);
    if (!existsSync(join(ROOT, "src/core/manual/law.ts"))) {
      // Before S1 lands: the stand-in is the roster, with S1's names and members.
      expect(declares, "rules.ts carries the stand-in until core/manual/law.ts exists").toBe(true);
      expect([...MANUAL_GEOMETRIES]).toStrictEqual(["POLYGON", "POLYLINE", "POINT_SET"]);
      return;
    }
    expect(read("src/core/manual/law.ts"), "core/manual/law.ts is the roster's home").toMatch(/export const MANUAL_GEOMETRIES\s*=/);
    expect(declares, "S1 has landed: delete the stand-in in rules.ts and import MANUAL_GEOMETRIES and ManualGeometry from @/core/manual/law (a copy is a defect)").toBe(false);
    expect(rules, "rules.ts reads the roster from its home").toMatch(/from "@\/core\/manual\/law"/);
  });
});
