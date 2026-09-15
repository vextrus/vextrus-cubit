/**
 * The twelve slab, shear-wall and stair methods, in force (L-MEA-09/AM-02, AM-06 §3/§4, L-MEA-01/02,
 * L-FRM-02/06, L-QTY-03).
 *
 * A method is the sentence a figure is audited by: the variables it declares, in the order its
 * template names them, and the one tree both the printed formula and the computed value come from.
 * This grades the twelve through the registry the gate resolves them by — never by reading the
 * modules that implement them — and grades their arithmetic against the clauses' own statement of it,
 * computed in the canon rather than transcribed (B-19).
 *
 * The edition that puts the pairs in force is graded where that claim already lives — the live row in
 * tests/rulesets/column-method-edition.test.ts, the shard's digest in tests/rulesets/edition-digest.test.ts
 * — so this file asks only what a method IS (ARCH-02).
 */
import { describe, expect, test } from "vitest";
import {
  RULE,
  RULE_VERSION,
  canon,
  methodOf,
  type Canon,
  type Exact,
  type FormulaMethodShape,
} from "../takeoff/rails/support/slab-wall-stair-stage";

/** The role a method that prints a formula and computes a figure stands in (L-MEA-01). */
const FORMULA_ROLE = "formula";

/** The kinds and dimensions the two halves of every pair stand in (L-MEA-04, L-FRM-06). */
const CONCRETE = { kind: "rcc.concrete", dimension: "VOLUME" } as const;
const FORMWORK = { kind: "rcc.formwork", dimension: "AREA" } as const;

/** The one channel a slab partitions, and the sum only the gate can bind (L-MEA-02). */
const OPENING: readonly string[] = Object.freeze(["opening"]);
const NO_CHANNEL: readonly string[] = Object.freeze([]);

/**
 * Each rule as this leaf declares it: the half it stands in, the variables in the order its template
 * names them, the channels it partitions, and the sentence it prints. The templates are spelled here
 * rather than read off the methods, because what the criterion says is that these are the sentences —
 * a template compared to itself would pass over any formula at all.
 */
const DECLARED: readonly {
  ruleId: string;
  half: typeof CONCRETE | typeof FORMWORK;
  variables: readonly string[];
  channels: readonly string[];
  template: string;
}[] = Object.freeze([
  {
    ruleId: RULE.slabConcrete,
    half: CONCRETE,
    variables: ["count", "A", "A_members", "openings", "t"],
    channels: OPENING,
    template: "V = count × (A − A_members − openings) × t",
  },
  {
    ruleId: RULE.slabTaperConcrete,
    half: CONCRETE,
    variables: ["count", "A", "A_members", "openings", "t1", "t2"],
    channels: OPENING,
    template: "V = count × (A − A_members − openings) × (t1 + t2) × 0.5",
  },
  {
    ruleId: RULE.slabFormwork,
    half: FORMWORK,
    variables: ["count", "A", "A_members", "A_beams", "openings", "L_edge", "t"],
    channels: OPENING,
    template: "F = count × (A − A_members − openings − A_beams + L_edge × t)",
  },
  { ruleId: RULE.slabEdgeFormwork, half: FORMWORK, variables: ["count", "L_edge", "t"], channels: NO_CHANNEL, template: "F = count × L_edge × t" },
  { ruleId: RULE.dropConcrete, half: CONCRETE, variables: ["count", "L", "B", "H"], channels: NO_CHANNEL, template: "V = count × L × B × H" },
  { ruleId: RULE.dropFormwork, half: FORMWORK, variables: ["count", "L", "H"], channels: NO_CHANNEL, template: "F = count × 2 × L × H" },
  { ruleId: RULE.wallConcrete, half: CONCRETE, variables: ["count", "L", "t", "H"], channels: NO_CHANNEL, template: "V = count × L × t × H" },
  {
    ruleId: RULE.wallFormwork,
    half: FORMWORK,
    variables: ["count", "L", "H", "A_contact", "A_ends"],
    channels: NO_CHANNEL,
    template: "F = count × (2 × L × H − A_contact − A_ends)",
  },
  {
    ruleId: RULE.flightConcrete,
    half: CONCRETE,
    variables: ["count", "S", "W", "w", "G", "R"],
    channels: NO_CHANNEL,
    template: "V = count × (S × W × w + 0.5 × G × R × W)",
  },
  {
    ruleId: RULE.flightFormwork,
    half: FORMWORK,
    variables: ["count", "S", "W", "w", "R"],
    channels: NO_CHANNEL,
    template: "F = count × (S × W + R × W + 2 × S × w)",
  },
  { ruleId: RULE.landingConcrete, half: CONCRETE, variables: ["count", "A", "t"], channels: NO_CHANNEL, template: "V = count × A × t" },
  { ruleId: RULE.landingFormwork, half: FORMWORK, variables: ["count", "A"], channels: NO_CHANNEL, template: "F = count × A" },
]);

/**
 * One reading per rule, in the canonical unit of each variable's own dimension — the criteria's own
 * members: AC-1/AC-2's panel, AC-3's wall at its lower band, AC-4's flight and landing, and a sunken
 * drop as AC-7 transcribes one.
 */
const READINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  [RULE.slabConcrete]: { count: "1", A: "120", A_members: "3.5", openings: "4", t: "0.15" },
  [RULE.slabTaperConcrete]: { count: "1", A: "120", A_members: "3.5", openings: "4", t1: "0.15", t2: "0.25" },
  [RULE.slabFormwork]: { count: "1", A: "120", A_members: "3.5", A_beams: "20", openings: "4", L_edge: "12", t: "0.15" },
  [RULE.slabEdgeFormwork]: { count: "1", L_edge: "40", t: "0.15" },
  [RULE.dropConcrete]: { count: "1", L: "10", B: "0.125", H: "0.15" },
  [RULE.dropFormwork]: { count: "1", L: "10", H: "0.15" },
  [RULE.wallConcrete]: { count: "1", L: "2.5", t: "0.25", H: "3.3" },
  [RULE.wallFormwork]: { count: "1", L: "2.5", H: "3.3", A_contact: "0.625", A_ends: "0.5" },
  [RULE.flightConcrete]: { count: "1", S: "2.8", W: "1.2", w: "0.15", G: "0.25", R: "1.68" },
  [RULE.flightFormwork]: { count: "1", S: "2.8", W: "1.2", w: "0.15", R: "1.68" },
  [RULE.landingConcrete]: { count: "1", A: "2.4", t: "0.15" },
  [RULE.landingFormwork]: { count: "1", A: "2.4" },
});

/** One binding as a method is handed one: a value in the canonical unit of its own dimension. */
function carried(method: FormulaMethodShape, units: Canon): Record<string, { value: string; unit: string }> {
  const values = READINGS[method.ruleId] as Readonly<Record<string, string>>;
  return Object.fromEntries(
    method.variables.map((variable) => [
      variable.name,
      { value: values[variable.name] as string, unit: units.CANONICAL_UNIT[variable.dimension] as string },
    ]),
  );
}

/** The clauses' own arithmetic over the same readings, computed in the canon (B-19: never typed). */
function owedFor(ruleId: string, units: Canon): Exact {
  const read = (name: string): Exact => units.exact((READINGS[ruleId] as Readonly<Record<string, string>>)[name] as string);
  const net = (): Exact => read("A").sub(read("A_members")).sub(read("openings"));
  switch (ruleId) {
    // L-MEA-09: the plate net of the verticals it runs past and the openings the gate deducted.
    case RULE.slabConcrete:
      return read("count").mul(net()).mul(read("t"));
    // L-FRM-02's taper: the mean of the two thicknesses the plate was read at.
    case RULE.slabTaperConcrete:
      return read("count").mul(net()).mul(read("t1").add(read("t2"))).mul("0.5");
    // AM-06 §3: the soffit net of the beam soffits below it, plus the free edges through the thickness.
    case RULE.slabFormwork:
      return read("count").mul(net().sub(read("A_beams")).add(read("L_edge").mul(read("t"))));
    // AM-06 §3: a slab on grade forms its edges and nothing else.
    case RULE.slabEdgeFormwork:
      return read("count").mul(read("L_edge")).mul(read("t"));
    case RULE.dropConcrete:
      return read("count").mul(read("L")).mul(read("B")).mul(read("H"));
    // Both faces of the drop are shuttered — the pocket's and the plate's.
    case RULE.dropFormwork:
      return read("count").mul("2").mul(read("L")).mul(read("H"));
    // L-MEA-09: a vertical stands floor-to-floor through the joint.
    case RULE.wallConcrete:
      return read("count").mul(read("L")).mul(read("t")).mul(read("H"));
    case RULE.wallFormwork:
      return read("count").mul(units.exact("2").mul(read("L")).mul(read("H")).sub(read("A_contact")).sub(read("A_ends")));
    // AM-06 §4: the waist plate plus the step triangles cast on top of it.
    case RULE.flightConcrete:
      return read("count").mul(read("S").mul(read("W")).mul(read("w")).add(units.exact("0.5").mul(read("G")).mul(read("R")).mul(read("W"))));
    // AM-06 §4: the soffit, the risers across the width, and the two strings down the waist.
    case RULE.flightFormwork:
      return read("count").mul(
        read("S").mul(read("W")).add(read("R").mul(read("W"))).add(units.exact("2").mul(read("S")).mul(read("w"))),
      );
    case RULE.landingConcrete:
      return read("count").mul(read("A")).mul(read("t"));
    case RULE.landingFormwork:
      return read("count").mul(read("A"));
    default:
      throw new Error(`no arithmetic is stated for ${ruleId}`);
  }
}

describe("the twelve slab, shear-wall and stair methods, as the registry resolves them", () => {
  test("the registry answers a formula for each of the twelve pairs, at version 1", async () => {
    for (const declared of DECLARED) {
      const method = await methodOf(declared.ruleId);
      expect(method.role, `${declared.ruleId} stands in the role that prints a formula and computes a figure (L-MEA-01)`).toBe(FORMULA_ROLE);
      expect(method.ruleId, `${declared.ruleId} answers under its own rule id`).toBe(declared.ruleId);
      expect(method.version, `${declared.ruleId} is in force at its only version`).toBe(RULE_VERSION);
    }
  });

  for (const declared of DECLARED) {
    test(`${declared.ruleId} declares its half, its variables in order and its channels`, async () => {
      const method = await methodOf(declared.ruleId);
      expect(method.kind, `${declared.ruleId} bills the ${declared.half.kind} half of the pair (L-MEA-04)`).toBe(declared.half.kind);
      expect(method.dimension, `${declared.ruleId} stands in ${declared.half.dimension} (L-FRM-06)`).toBe(declared.half.dimension);
      expect(
        method.variables.map((variable) => variable.name),
        `${declared.ruleId} declares exactly the variables its template names, in the order it names them`,
      ).toStrictEqual(declared.variables);
      expect(
        [...method.deductionChannels],
        `${declared.ruleId} partitions exactly the channels a member of its own shape can offer through (L-MEA-02)`,
      ).toStrictEqual([...declared.channels]);
    });
  }

  test("each prints the sentence its clause states, and no other", async () => {
    for (const declared of DECLARED) {
      const method = await methodOf(declared.ruleId);
      expect(method.template, `${declared.ruleId} prints the formula a reader audits the figure by (L-QTY-03)`).toBe(declared.template);
    }
  });

  test("`openings` is declared by every method that partitions the channel, and by nobody else", async () => {
    for (const declared of DECLARED) {
      const method = await methodOf(declared.ruleId);
      const declares = method.variables.some((variable) => variable.name === "openings");
      expect(
        declares,
        `${declared.ruleId} declares \`openings\` exactly where it partitions the \`opening\` channel — the gate binds the deducted sum into that variable and nothing else (L-MEA-02, CHANNEL_VARIABLE)`,
      ).toBe(declared.channels.length > 0);
    }
  });

  test("each computes the figure its clause owes over the same reading", async () => {
    const units = await canon();
    for (const declared of DECLARED) {
      const method = await methodOf(declared.ruleId);
      const owed = owedFor(declared.ruleId, units);
      const figured = method.evaluate(carried(method, units));
      expect(
        units.exact(figured).eq(owed),
        `${declared.ruleId} figures ${owed.toString()} over the reading the criteria state — it figured ${figured}`,
      ).toBe(true);
    }
  });
});
