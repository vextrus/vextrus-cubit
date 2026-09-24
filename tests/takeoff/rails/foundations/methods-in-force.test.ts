/**
 * AC-2 (first half) — the sixteen foundation methods, in force (R-TO-032, L-MEA-01, L-FRM-02,
 * L-FRM-03, L-FRM-04, L-MEA-09, L-QTY-03): the seven this leaf landed, the two side formworks FND-3
 * appended after them (I-337), and the seven FND-OWN appended after those — a pile cap's prism less
 * the heads its piles own, with and without a recess, the recess's sides, and the blinding less the
 * piles' sections (I-544..c).
 *
 * TEST_AMENDED (FND-OWN): the roster grew from nine pairs to sixteen; nothing standing before them
 * moved, and each new pair is graded here exactly as the nine are.
 *
 * A method is the sentence a figure is audited by: the variables it declares, the one tree its
 * template is printed from and its figure computed by, and the shard that records the pair an
 * edition cites. This grades the nine through the registry the gate resolves them by — never by
 * reading the modules that implement them — and grades their arithmetic against L-FRM-02's and
 * L-FRM-04's own statements of it, computed in the canon rather than transcribed.
 *
 * The offers the rails make over these methods, and the figures the gate publishes from them, are
 * graded beside this file in `./offers-and-figures.test.ts`, which needs a live campaign.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SEED_VERSION } from "../../../rulesets/support/editions";
import {
  BLINDING_RULE_ID,
  EARTHWORK_EXCAVATION,
  EXCAVATION_RULE_ID,
  FOUNDATIONS_PAIRS,
  FOUNDATION_FORMWORK_POLY_RULE_ID,
  FOUNDATION_FORMWORK_RECT_RULE_ID,
  FOUNDATIONS_SHARD,
  FOUNDATIONS_VERSION,
  FOUNDATION_PRISM_POLY_RULE_ID,
  FOUNDATION_PRISM_RECT_RULE_ID,
  BLINDING_OVER_PILES_RULE_ID,
  PILE_CAP_FORMWORK_POLY_RECESS_RULE_ID,
  PILE_CAP_FORMWORK_RECT_RECESS_RULE_ID,
  PILE_CAP_PRISM_POLY_RECESS_RULE_ID,
  PILE_CAP_PRISM_POLY_RULE_ID,
  PILE_CAP_PRISM_RECT_RECESS_RULE_ID,
  PILE_CAP_PRISM_RECT_RULE_ID,
  PCC_BLINDING,
  PILE_CONCRETE_RULE_ID,
  PILE_COUNT_RULE_ID,
  PILE_LENGTH_RULE_ID,
  PILING_BORED,
  PILING_BORING,
  RCC_CONCRETE,
  RCC_FORMWORK,
  REPO_ROOT,
  SEED_MODULE,
  canon,
  foundationsMethod,
  methodsRegistry,
  productModule,
  type DecimalLike,
  type MethodPairShape,
} from "./support/foundations-contract";

/** The stage that keeps a shard's recorded digest honest (test contract). */
const METHOD_HASHES_SCRIPT = "scripts/method-hashes.mjs";

/** The expression module the one tree is printed by — the method's template comes from nowhere else. */
const EXPR_MODULE = "src/core/rulesets/methods/expr.ts";

/** A method that prints a formula and computes a figure (L-MEA-01's two roles). */
const FORMULA_ROLE = "formula";

/** The dimensions a variable of these methods stands in (B-17: the canon's own roster). */
const COUNT = "COUNT";
const LENGTH = "LENGTH";
const AREA = "AREA";
const VOLUME = "VOLUME";

/** π, to more places than any method may carry — the yardstick the pile's constant is judged by. */
const PI = "3.1415926535897932384626433832795";

/** How far the pile's own constant may stand from π: a constant of twenty significant digits. */
const PI_TOLERANCE = "0.0000000000000000001";

/** The three readings a recess cast into a cap is stated by (I-546). */
const RECESS_VARIABLES: readonly { name: string; dimension: string }[] = [
  { name: "Lr", dimension: LENGTH },
  { name: "Br", dimension: LENGTH },
  { name: "Dr", dimension: LENGTH },
];

/** What each method declares: the kind it measures, the dimension it stands in, and its variables. */
const DECLARED: readonly { ruleId: string; kind: string; dimension: string; variables: readonly { name: string; dimension: string }[] }[] = [
  {
    ruleId: FOUNDATION_PRISM_RECT_RULE_ID,
    kind: RCC_CONCRETE,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "L", dimension: LENGTH },
      { name: "B", dimension: LENGTH },
      { name: "D", dimension: LENGTH },
    ],
  },
  {
    ruleId: FOUNDATION_PRISM_POLY_RULE_ID,
    kind: RCC_CONCRETE,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "A", dimension: AREA },
      { name: "D", dimension: LENGTH },
    ],
  },
  {
    ruleId: PILE_CONCRETE_RULE_ID,
    kind: RCC_CONCRETE,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "d", dimension: LENGTH },
      { name: "length", dimension: LENGTH },
    ],
  },
  { ruleId: PILE_COUNT_RULE_ID, kind: PILING_BORED, dimension: COUNT, variables: [{ name: "count", dimension: COUNT }] },
  {
    ruleId: PILE_LENGTH_RULE_ID,
    kind: PILING_BORING,
    dimension: LENGTH,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "length", dimension: LENGTH },
    ],
  },
  {
    ruleId: EXCAVATION_RULE_ID,
    kind: EARTHWORK_EXCAVATION,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "L", dimension: LENGTH },
      { name: "B", dimension: LENGTH },
      { name: "a", dimension: LENGTH },
      { name: "dx", dimension: LENGTH },
      { name: "egl", dimension: LENGTH },
      { name: "top", dimension: LENGTH },
      { name: "D", dimension: LENGTH },
      { name: "t", dimension: LENGTH },
    ],
  },
  {
    ruleId: FOUNDATION_FORMWORK_RECT_RULE_ID,
    kind: RCC_FORMWORK,
    dimension: AREA,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "L", dimension: LENGTH },
      { name: "B", dimension: LENGTH },
      { name: "D", dimension: LENGTH },
    ],
  },
  {
    ruleId: FOUNDATION_FORMWORK_POLY_RULE_ID,
    kind: RCC_FORMWORK,
    dimension: AREA,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "P", dimension: LENGTH },
      { name: "D", dimension: LENGTH },
    ],
  },
  {
    ruleId: BLINDING_RULE_ID,
    kind: PCC_BLINDING,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "L", dimension: LENGTH },
      { name: "B", dimension: LENGTH },
      { name: "p", dimension: LENGTH },
      { name: "t", dimension: LENGTH },
    ],
  },
  // FND-OWN (I-544..c): the piles a cap stands on (`n`, `d`), how far their heads stand into it
  // (`e`), and the recess cast into it (`Lr`, `Br`, `Dr`).
  ...[
    { ruleId: PILE_CAP_PRISM_RECT_RULE_ID, plan: ["L", "B"], recess: false },
    { ruleId: PILE_CAP_PRISM_POLY_RULE_ID, plan: ["A"], recess: false },
    { ruleId: PILE_CAP_PRISM_RECT_RECESS_RULE_ID, plan: ["L", "B"], recess: true },
    { ruleId: PILE_CAP_PRISM_POLY_RECESS_RULE_ID, plan: ["A"], recess: true },
  ].map((one) => ({
    ruleId: one.ruleId,
    kind: RCC_CONCRETE,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      ...one.plan.map((name) => ({ name, dimension: name === "A" ? AREA : LENGTH })),
      { name: "D", dimension: LENGTH },
      { name: "n", dimension: COUNT },
      { name: "d", dimension: LENGTH },
      { name: "e", dimension: LENGTH },
      ...(one.recess ? RECESS_VARIABLES : []),
    ],
  })),
  ...[
    { ruleId: PILE_CAP_FORMWORK_RECT_RECESS_RULE_ID, plan: ["L", "B"] },
    { ruleId: PILE_CAP_FORMWORK_POLY_RECESS_RULE_ID, plan: ["P"] },
  ].map((one) => ({
    ruleId: one.ruleId,
    kind: RCC_FORMWORK,
    dimension: AREA,
    variables: [{ name: "count", dimension: COUNT }, ...one.plan.map((name) => ({ name, dimension: LENGTH })), { name: "D", dimension: LENGTH }, ...RECESS_VARIABLES],
  })),
  {
    ruleId: BLINDING_OVER_PILES_RULE_ID,
    kind: PCC_BLINDING,
    dimension: VOLUME,
    variables: [
      { name: "count", dimension: COUNT },
      { name: "L", dimension: LENGTH },
      { name: "B", dimension: LENGTH },
      { name: "p", dimension: LENGTH },
      { name: "t", dimension: LENGTH },
      { name: "n", dimension: COUNT },
      { name: "d", dimension: LENGTH },
    ],
  },
];

/**
 * One binding per variable these methods declare, in the canonical unit of its dimension — the
 * readings a gate hands a method (L-MEA-08). Deliberately all different and none of them 1, so an
 * evaluator that dropped a factor or swapped two cannot answer the same figure by accident.
 */
const BOUND: Readonly<Record<string, string>> = Object.freeze({
  count: "3",
  L: "1.6",
  B: "1.2",
  D: "0.45",
  A: "2.35",
  P: "6.9601",
  d: "0.5",
  length: "21.336",
  a: "0.4572",
  dx: "0.1524",
  egl: "-0.1524",
  top: "-0.6096",
  t: "0.0762",
  p: "0.0762",
  n: "4",
  e: "0.0756",
  Lr: "0.9",
  Br: "0.7",
  Dr: "0.3",
});

/** The bindings one method declares, as the gate hands them: `{ value }` per declared variable. */
function bindingsFor(variables: readonly { name: string }[]): Record<string, { value: string }> {
  return Object.fromEntries(variables.map((one) => [one.name, { value: BOUND[one.name] as string }]));
}

/**
 * L-FRM-02's and L-FRM-04's algebra over those same readings, written here as the clauses state it
 * and computed in the canon — the independent model a method's own figure is held against (B-19).
 * The pile's π is not modelled: its constant is judged on its own, below.
 */
function owed(ruleId: string, exact: (value: string) => DecimalLike): DecimalLike | null {
  const v = (name: string): DecimalLike => exact(BOUND[name] as string);
  const two = exact("2");
  switch (ruleId) {
    // count × L × B × D — the rectangular prism (L-FRM-02).
    case FOUNDATION_PRISM_RECT_RULE_ID:
      return v("count").mul(v("L")).mul(v("B")).mul(v("D"));
    // count × A × D — the shoelace plan, times its depth (L-FRM-02's PRISM_POLY).
    case FOUNDATION_PRISM_POLY_RULE_ID:
      return v("count").mul(v("A")).mul(v("D"));
    // count × 2 × (L + B) × D — a rectangular foundation's four sides, never its soffit or its top
    // (L-FRM-03).
    case FOUNDATION_FORMWORK_RECT_RULE_ID:
      return v("count").mul(two).mul(v("L").add(v("B"))).mul(v("D"));
    // count × P × D — a polygonal cap's side faces, along its own boundary (L-FRM-03).
    case FOUNDATION_FORMWORK_POLY_RULE_ID:
      return v("count").mul(v("P")).mul(v("D"));
    // N = count — a bored pile is counted, never measured (R-TO-032).
    case PILE_COUNT_RULE_ID:
      return v("count");
    // L = count × length — the bored length below cut-off (AM-06 §2).
    case PILE_LENGTH_RULE_ID:
      return v("count").mul(v("length"));
    // count × (L + 2a) × (B + 2a) × ((egl − top) + D + t + dx) — the rectangular pit (L-FRM-04).
    case EXCAVATION_RULE_ID:
      return v("count")
        .mul(v("L").add(two.mul(v("a"))))
        .mul(v("B").add(two.mul(v("a"))))
        .mul(v("egl").sub(v("top")).add(v("D")).add(v("t")).add(v("dx")));
    // count × (L + 2p) × (B + 2p) × t — the blinding under it (L-FRM-04).
    case BLINDING_RULE_ID:
      return v("count")
        .mul(v("L").add(two.mul(v("p"))))
        .mul(v("B").add(two.mul(v("p"))))
        .mul(v("t"));
    // count × (2 × (L + B) × D + 2 × (Lr + Br) × Dr) — a cap's four sides and its recess's four
    // (L-FRM-03, I-546).
    case PILE_CAP_FORMWORK_RECT_RECESS_RULE_ID:
      return v("count").mul(two.mul(v("L").add(v("B"))).mul(v("D")).add(two.mul(v("Lr").add(v("Br"))).mul(v("Dr"))));
    // count × (P × D + 2 × (Lr + Br) × Dr) — a polygon cap's own boundary and its recess's sides.
    case PILE_CAP_FORMWORK_POLY_RECESS_RULE_ID:
      return v("count").mul(v("P").mul(v("D")).add(two.mul(v("Lr").add(v("Br"))).mul(v("Dr"))));
    default:
      return null;
  }
}

/** The shard, as the registry records a method in one (AM-11: one spelling of a manifest). */
type ShardRow = { ruleId?: string; version?: string; law?: string; module?: string };
type Shard = { methods?: Record<string, ShardRow>; digest?: unknown };

/** The shard as it stands, asserted to stand at all so a missing one reads as the missing feature. */
function shard(): Shard {
  const abs = join(REPO_ROOT, FOUNDATIONS_SHARD);
  expect(existsSync(abs), `${FOUNDATIONS_SHARD} is missing from the checkout — the manifest that records this shard's pairs (AM-11)`).toBe(true);
  // white-box: AC-2 — the criterion is about this FILE: `foundations.methods.json` is the manifest an
  // edition's pairs are recorded in and `scripts/method-hashes.mjs` digests, so what it records is
  // the thing under test. It is read as data, never as source text, and every behavioural claim
  // beside it (the variables, the template, the figure) is asked of the registry instead.
  return JSON.parse(readFileSync(abs, "utf8")) as Shard;
}

describe("AC-2: the sixteen foundation methods are in force", () => {
  test("AC-2: the shard records exactly the sixteen pairs, and the registry enumerates every one", async () => {
    const recorded = shard();
    const owedKeys = FOUNDATIONS_PAIRS.map((pair) => `${pair.ruleId}@${pair.version}`).sort();
    expect(Object.keys(recorded.methods ?? {}).sort(), `${FOUNDATIONS_SHARD} records exactly this shard's sixteen pairs, keyed \`<ruleId>@<version>\` (L-MEA-01)`).toEqual(owedKeys);
    for (const [key, row] of Object.entries(recorded.methods ?? {})) {
      expect(`${String(row.ruleId)}@${String(row.version)}`, `${key} restates the pair its key names`).toBe(key);
      expect(typeof row.module, `${key} names the module that computes it`).toBe("string");
      expect(typeof row.law, `${key} names the clause it measures by`).toBe("string");
    }
    expect(typeof recorded.digest, `${FOUNDATIONS_SHARD} records the digest \`${METHOD_HASHES_SCRIPT}\` keeps honest`).toBe("string");

    const registry = await methodsRegistry();
    const enumerated = registry.enumerateMethods().map((pair: MethodPairShape) => `${pair.ruleId}@${pair.version}`);
    for (const key of owedKeys) {
      expect(enumerated, `\`enumerateMethods()\` answers ${key} — a method not enumerated is a method no edition can cite (L-MEA-01)`).toContain(key);
    }
    expect(new Set(enumerated).size, "and answers each pair once — the barrel enumerates its shards and never re-declares one (AM-11)").toBe(enumerated.length);
  });

  test("AC-2: the shard's recorded digest is current — the method-hash stage is green", () => {
    // Asked of a tree that HOLDS this shard: the stage passes trivially where there is no manifest
    // to digest, and a stage that proves nothing is not a proof (B-23).
    expect(Object.keys(shard().methods ?? {}).length, `${FOUNDATIONS_SHARD} records the pairs whose digest the stage checks`).toBeGreaterThan(0);
    const stage = spawnSync(process.execPath, [join(REPO_ROOT, METHOD_HASHES_SCRIPT)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    expect(
      stage.status,
      `\`node ${METHOD_HASHES_SCRIPT}\` passes over the shards in the tree — a recorded digest that has gone stale is drift (C-06):\n${`${stage.stdout ?? ""}${stage.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
  });

  test("AC-2: each declares its variables and prints its template from the one tree it computes by", async () => {
    const expr = await productModule<{ print: (statement: unknown) => string }>(EXPR_MODULE);
    for (const declared of DECLARED) {
      const method = await foundationsMethod({ ruleId: declared.ruleId, version: FOUNDATIONS_VERSION });
      expect(method.role, `${declared.ruleId} prints a formula and computes a figure — a formula method, not a resolver (L-MEA-01)`).toBe(FORMULA_ROLE);
      expect(method.kind, `${declared.ruleId} measures the kind its rail offers under (L-MEA-08)`).toBe(declared.kind);
      expect(method.dimension, `${declared.ruleId} stands in ${declared.dimension} (L-MEA-04)`).toBe(declared.dimension);
      expect(
        [...method.variables].map((one) => ({ name: one.name, dimension: one.dimension })).sort((left, right) => (left.name < right.name ? -1 : 1)),
        `${declared.ruleId} declares exactly the variables its clause names, each in the dimension it is read in (L-FRM-02, L-FRM-04)`,
      ).toEqual([...declared.variables].sort((left, right) => (left.name < right.name ? -1 : 1)));
      expect(
        [...method.deductionChannels],
        `${declared.ruleId} deducts through no channel — what a pile owns of a cap is a variable of the cap's own sentence, never an opening partitioned against a threshold (scope, I-545)`,
      ).toEqual([]);
      expect(method.tree, `${declared.ruleId} carries the tree its template and its figure both come from (L-QTY-03)`).toBeTruthy();
      expect(method.template, `${declared.ruleId}'s template is that tree, printed — a string kept beside it is the copy that parts (B-17)`).toBe(expr.print(method.tree));
    }
  });

  test("AC-2: each computes its clause's own algebra over the readings the gate hands it", async () => {
    const { exact } = await canon();
    for (const declared of DECLARED) {
      const method = await foundationsMethod({ ruleId: declared.ruleId, version: FOUNDATIONS_VERSION });
      const figure = exact(String(method.evaluate(bindingsFor(declared.variables))));
      const expected = owed(declared.ruleId, exact as (value: string) => DecimalLike);
      if (expected === null) continue;
      expect(figure.eq(expected), `${declared.ruleId} over ${JSON.stringify(BOUND)} is ${expected.toString()} — its clause's own algebra, exactly (B-07)`).toBe(true);
    }
  });

  test("FND-OWN: a cap's heads and the blinding's sections are the pile's own π/4 · d², over the readings the gate hands them", async () => {
    const { exact } = await canon();
    // π/4 exactly as the pile's shaft carries it — one pile, one metre across, one metre long — so a
    // cap's heads are measured in the one sentence of the one constant the pile that owns them is
    // (B-17), and the constant itself is judged beside, on its own.
    const pile = await foundationsMethod({ ruleId: PILE_CONCRETE_RULE_ID, version: FOUNDATIONS_VERSION });
    const quarterPi = exact(String(pile.evaluate({ count: { value: "1" }, d: { value: "1" }, length: { value: "1" } })));
    const v = (name: string): DecimalLike => exact(BOUND[name] as string);
    const two = exact("2");
    const heads = v("n").mul(quarterPi).mul(v("d")).mul(v("d")).mul(v("e"));
    const sections = v("n").mul(quarterPi).mul(v("d")).mul(v("d"));
    const recess = v("Lr").mul(v("Br")).mul(v("Dr"));
    const owedBy: Readonly<Record<string, DecimalLike>> = {
      // count × (L × B × D − n × π/4 × d² × e) — the cap less the heads its piles own (L-MEA-09).
      [PILE_CAP_PRISM_RECT_RULE_ID]: v("count").mul(v("L").mul(v("B")).mul(v("D")).sub(heads)),
      [PILE_CAP_PRISM_POLY_RULE_ID]: v("count").mul(v("A").mul(v("D")).sub(heads)),
      // … and less the recess cast into it (I-546).
      [PILE_CAP_PRISM_RECT_RECESS_RULE_ID]: v("count").mul(v("L").mul(v("B")).mul(v("D")).sub(heads).sub(recess)),
      [PILE_CAP_PRISM_POLY_RECESS_RULE_ID]: v("count").mul(v("A").mul(v("D")).sub(heads).sub(recess)),
      // count × ((L + 2p) × (B + 2p) − n × π/4 × d²) × t — the blinding less the piles through it (I-545).
      [BLINDING_OVER_PILES_RULE_ID]: v("count")
        .mul(v("L").add(two.mul(v("p"))).mul(v("B").add(two.mul(v("p")))).sub(sections))
        .mul(v("t")),
    };
    for (const [ruleId, owedFigure] of Object.entries(owedBy)) {
      const declared = DECLARED.find((one) => one.ruleId === ruleId);
      expect(declared, `${ruleId} is declared above`).toBeTruthy();
      const method = await foundationsMethod({ ruleId, version: FOUNDATIONS_VERSION });
      const figure = exact(String(method.evaluate(bindingsFor(declared?.variables ?? []))));
      const drift = figure.sub(owedFigure);
      expect(
        drift.lte(exact(PI_TOLERANCE)) && exact(`-${PI_TOLERANCE}`).lte(drift),
        `${ruleId} over ${JSON.stringify(BOUND)} is ${owedFigure.toString()} — its clause's own algebra, with the pile's own π/4 (it answered ${figure.toString()})`,
      ).toBe(true);
    }
  });

  test("AC-2: the pile's concrete is π/4 · d² · length, with π to at least twenty significant digits", async () => {
    const { exact } = await canon();
    const method = await foundationsMethod({ ruleId: PILE_CONCRETE_RULE_ID, version: FOUNDATIONS_VERSION });
    // One pile, one metre across, one metre long: whatever the method answers is π/4 itself, so the
    // constant it carries is read off its own arithmetic rather than out of its source (L-FRM-02).
    const unit = exact(String(method.evaluate({ count: { value: "1" }, d: { value: "1" }, length: { value: "1" } })));
    const drift = unit.mul(exact("4")).add(exact(`-${PI}`));
    expect(
      drift.lte(exact(PI_TOLERANCE)) && exact(`-${PI_TOLERANCE}`).lte(drift),
      `4 × the method's figure for a 1 m × 1 m pile is π to twenty significant digits (it answered ${unit.toString()}, off by ${drift.toString()})`,
    ).toBe(true);

    // And the figure scales as count × d² × length does — the shape of the formula, over readings.
    const many = exact(String(method.evaluate({ count: { value: "3" }, d: { value: "0.5" }, length: { value: "21.336" } })));
    const owedMany = unit.mul(exact("3")).mul(exact("0.5")).mul(exact("0.5")).mul(exact("21.336"));
    expect(many.eq(owedMany), `count × π/4 × d² × length, exactly (it answered ${many.toString()} against ${owedMany.toString()})`).toBe(true);
  });

  test("AC-2: the platform seed is re-minted at the version this increment lands, citing every enumerated pair", async () => {
    const seed = await productModule<{
      SEED_EDITION_IDENTITY: { scope: string; name: string; version: string };
      SEED_EDITION_CONTENT: { methods: readonly MethodPairShape[]; parameters: Record<string, { value: string; unit: string }> };
      IN_FORCE_VERSIONS: Readonly<Record<string, string>>;
    }>(SEED_MODULE);
    const registry = await methodsRegistry();
    // A rule the tree computes at two versions is cited at the one the seed selects by name (R6b).
    const selected = seed.IN_FORCE_VERSIONS;

    expect(seed.SEED_EDITION_IDENTITY.version, "the seed the product ships is re-minted at the version this increment lands (AC-2, B-20)").toBe(SEED_VERSION);
    expect(
      seed.SEED_EDITION_CONTENT.methods.map((pair) => `${pair.ruleId}@${pair.version}`).sort(),
      "and cites exactly the pairs the shards enumerate, narrowed only by the seed's named in-force selection — a method landed with its manifest is in force with no second list to edit (B-19)",
    ).toEqual(
      registry
        .enumerateMethods()
        .filter((pair) => !Object.hasOwn(selected, pair.ruleId) || selected[pair.ruleId] === pair.version)
        .map((pair) => `${pair.ruleId}@${pair.version}`)
        .sort(),
    );
  });
});
