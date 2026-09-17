/**
 * AC-2 — the three masonry and finish methods, in force (R-TO-032, L-MEA-01, L-MEA-02, L-MEA-03).
 *
 * A method is the sentence a figure is audited by: the variables it declares, the one tree its
 * template is printed from and its figure computed by, and the shard that records the pair an
 * edition cites. This grades the three through the registry the gate resolves them by — never by
 * reading the modules that implement them — and grades their arithmetic against L-MEA-02's and
 * L-MEA-03's own statements of it, computed in the canon rather than transcribed.
 *
 * `threshold` is declared and BOUND and is deliberately not in either tree: L-MEA-02 has it land in
 * the line's variables so a reader can see the rule that retained what was retained, and a figure
 * that moved when the threshold moved would be a figure the threshold was subtracted from. That is
 * asked here as behaviour — two thresholds, one figure — rather than by reading the tree.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { SEED_VERSION } from "../../../rulesets/support/editions";
import {
  AREA,
  BRICK_WALL_VOLUME_RULE_ID,
  EXPR_MODULE,
  FINISH_OPENING_CHANNEL,
  FINISH_PAINT,
  FINISH_PLASTER,
  LENGTH,
  MASONRY_BRICKWORK,
  MASONRY_PAIRS,
  MASONRY_SHARD,
  MASONRY_VERSION,
  METHOD_HASHES_SCRIPT,
  OPENING_CHANNEL,
  PAINT_RULE_ID,
  PLASTER_RULE_ID,
  REPO_ROOT,
  SEED_EDITION_NAME,
  SEED_EDITION_VERSION,
  SEED_MODULE,
  VOLUME,
  canon,
  masonryMethod,
  methodsRegistry,
  productModule,
  type DecimalLike,
  type MethodPairShape,
} from "./support/masonry-contract";

/** A method that prints a formula and computes a figure (L-MEA-01's two roles). */
const FORMULA_ROLE = "formula";

/** What each method declares: the kind it measures, the dimension, its variables and its channel. */
const DECLARED: readonly { ruleId: string; kind: string; dimension: string; channel: string; variables: readonly { name: string; dimension: string }[] }[] = [
  {
    ruleId: BRICK_WALL_VOLUME_RULE_ID,
    kind: MASONRY_BRICKWORK,
    dimension: VOLUME,
    channel: OPENING_CHANNEL,
    variables: [
      { name: "L", dimension: LENGTH },
      { name: "h", dimension: LENGTH },
      { name: "t", dimension: LENGTH },
      { name: "openings", dimension: AREA },
      { name: "threshold", dimension: AREA },
    ],
  },
  {
    ruleId: PLASTER_RULE_ID,
    kind: FINISH_PLASTER,
    dimension: AREA,
    channel: FINISH_OPENING_CHANNEL,
    variables: [
      { name: "gross", dimension: AREA },
      { name: "openings", dimension: AREA },
      { name: "threshold", dimension: AREA },
    ],
  },
  {
    ruleId: PAINT_RULE_ID,
    kind: FINISH_PAINT,
    dimension: AREA,
    channel: FINISH_OPENING_CHANNEL,
    variables: [
      { name: "gross", dimension: AREA },
      { name: "openings", dimension: AREA },
      { name: "threshold", dimension: AREA },
    ],
  },
];

/**
 * One binding per variable, in the canonical unit of its dimension — the readings a gate hands a
 * method (L-MEA-08). Deliberately all different and none of them 1, so an evaluator that dropped a
 * factor or swapped two cannot answer the same figure by accident.
 */
const BOUND: Readonly<Record<string, string>> = Object.freeze({
  L: "6.4",
  h: "2.9028",
  t: "0.25",
  gross: "42.35",
  openings: "3.17",
  threshold: "0.1",
});

/** A second threshold, for the reading that says the figure does not depend on it (L-MEA-02). */
const OTHER_THRESHOLD = "0.5";

/** The bindings one method declares, as the gate hands them: `{ value }` per declared variable. */
function bindingsFor(variables: readonly { name: string }[], overrides: Readonly<Record<string, string>> = {}): Record<string, { value: string }> {
  return Object.fromEntries(variables.map((one) => [one.name, { value: overrides[one.name] ?? (BOUND[one.name] as string) }]));
}

/**
 * L-MEA-02's and L-MEA-03's algebra over those same readings, written here as the clauses state it
 * and computed in the canon — the independent model a method's own figure is held against (B-19).
 */
function owed(ruleId: string, exact: (value: string) => DecimalLike): DecimalLike {
  const v = (name: string): DecimalLike => exact(BOUND[name] as string);
  // V = (L × h − openings) × t — the wall's face, net of what was deducted, times its nominal
  // thickness per level (R-TO-032, L-MEA-02).
  if (ruleId === BRICK_WALL_VOLUME_RULE_ID) return v("L").mul(v("h")).sub(v("openings")).mul(v("t"));
  // A = gross − openings — "net = gross − Σ(deducted openings) per surface group" (L-MEA-03).
  return v("gross").sub(v("openings"));
}

/** The shard, as the registry records a method in one (AM-11: one spelling of a manifest). */
type ShardRow = { ruleId?: string; version?: string; law?: string; module?: string };
type Shard = { methods?: Record<string, ShardRow>; digest?: unknown };

/** The shard as it stands, asserted to stand at all so a missing one reads as the missing feature. */
function shard(): Shard {
  const abs = join(REPO_ROOT, MASONRY_SHARD);
  expect(existsSync(abs), `${MASONRY_SHARD} is missing from the checkout — the manifest that records this shard's pairs (AM-11)`).toBe(true);
  // white-box: AC-2 — the criterion is about this FILE: `masonry-finishes.methods.json` is the
  // manifest an edition's pairs are recorded in and `scripts/method-hashes.mjs` digests, so what it
  // records is the thing under test. It is read as data, never as source text, and every behavioural
  // claim beside it (the variables, the template, the figure) is asked of the registry instead.
  return JSON.parse(readFileSync(abs, "utf8")) as Shard;
}

describe("AC-2: the three masonry and finish methods are in force", () => {
  test("AC-2: the shard records exactly the three pairs, each citing the clause it measures by", () => {
    const recorded = shard();
    const owedKeys = MASONRY_PAIRS.map((pair) => `${pair.ruleId}@${pair.version}`).sort();
    expect(Object.keys(recorded.methods ?? {}).sort(), `${MASONRY_SHARD} records exactly this shard's three pairs, keyed \`<ruleId>@<version>\` (L-MEA-01)`).toEqual(owedKeys);
    for (const [key, row] of Object.entries(recorded.methods ?? {})) {
      expect(`${String(row.ruleId)}@${String(row.version)}`, `${key} restates the pair its key names`).toBe(key);
      expect(typeof row.module, `${key} names the module that computes it`).toBe("string");
      const law = String(row.law);
      const owedLaw = key.startsWith(BRICK_WALL_VOLUME_RULE_ID) ? "L-MEA-02" : "L-MEA-03";
      expect(
        law,
        `${key} names the clause it measures by — brickwork is L-MEA-02's opening schedule, a finish is L-MEA-03's surface group (goal)`,
      ).toContain(owedLaw);
    }
    expect(typeof recorded.digest, `${MASONRY_SHARD} records the digest \`${METHOD_HASHES_SCRIPT}\` keeps honest`).toBe("string");
  });

  test("AC-2: the registry enumerates each pair exactly once", async () => {
    const registry = await methodsRegistry();
    const enumerated = registry.enumerateMethods().map((pair: MethodPairShape) => `${pair.ruleId}@${pair.version}`);
    for (const pair of MASONRY_PAIRS) {
      expect(
        enumerated,
        `\`enumerateMethods()\` answers ${pair.ruleId}@${pair.version} — a method not enumerated is a method no edition can cite (L-MEA-01)`,
      ).toContain(`${pair.ruleId}@${pair.version}`);
    }
    expect(new Set(enumerated).size, "and answers each pair once — the barrel enumerates its shards and never re-declares one (AM-11)").toBe(enumerated.length);
  });

  test("AC-2: the shard's recorded digest is current — the method-hash stage is green", () => {
    // Asked of a tree that HOLDS this shard: the stage passes trivially where there is no manifest
    // to digest, and a stage that proves nothing is not a proof (B-23).
    expect(Object.keys(shard().methods ?? {}).length, `${MASONRY_SHARD} records the pairs whose digest the stage checks`).toBeGreaterThan(0);
    const stage = spawnSync(process.execPath, [join(REPO_ROOT, METHOD_HASHES_SCRIPT)], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    expect(
      stage.status,
      `\`node ${METHOD_HASHES_SCRIPT}\` passes over the shards in the tree — a recorded digest that has gone stale is drift (C-06):\n${`${stage.stdout ?? ""}${stage.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
  });

  test("AC-2: each declares its variables and its channel, and prints its template from the one tree it computes by", async () => {
    const expr = await productModule<{ print: (statement: unknown) => string }>(EXPR_MODULE);
    for (const declared of DECLARED) {
      const method = await masonryMethod({ ruleId: declared.ruleId, version: MASONRY_VERSION });
      expect(method.role, `${declared.ruleId} prints a formula and computes a figure — a formula method, not a resolver (L-MEA-01)`).toBe(FORMULA_ROLE);
      expect(method.kind, `${declared.ruleId} measures the kind its rail offers under (L-MEA-08)`).toBe(declared.kind);
      expect(method.dimension, `${declared.ruleId} stands in ${declared.dimension} (L-MEA-04)`).toBe(declared.dimension);
      expect(
        [...method.variables].map((one) => ({ name: one.name, dimension: one.dimension })).sort((left, right) => (left.name < right.name ? -1 : 1)),
        `${declared.ruleId} declares exactly the variables its clause names, each in the dimension it is read in (L-MEA-02, L-MEA-03)`,
      ).toEqual([...declared.variables].sort((left, right) => (left.name < right.name ? -1 : 1)));
      expect(
        [...method.deductionChannels],
        `${declared.ruleId} deducts through \`${declared.channel}\` and nothing else — a finish has its own channel because its threshold is its own (goal, interfaces)`,
      ).toEqual([declared.channel]);
      expect(method.tree, `${declared.ruleId} carries the tree its template and its figure both come from (L-QTY-03)`).toBeTruthy();
      expect(method.template, `${declared.ruleId}'s template is that tree, printed — a string kept beside it is the copy that parts (B-17)`).toBe(expr.print(method.tree));
    }
  });

  test("AC-2: each computes its clause's own algebra over the readings the gate hands it", async () => {
    const { exact } = await canon();
    for (const declared of DECLARED) {
      const method = await masonryMethod({ ruleId: declared.ruleId, version: MASONRY_VERSION });
      const figure = exact(String(method.evaluate(bindingsFor(declared.variables))));
      const expected = owed(declared.ruleId, exact as (value: string) => DecimalLike);
      expect(
        figure.eq(expected),
        `${declared.ruleId} over ${JSON.stringify(BOUND)} is ${expected.toString()} — its clause's own algebra, exactly (B-07); it answered ${figure.toString()}`,
      ).toBe(true);
    }
  });

  test("AC-2: the threshold lands in the variables and never in the figure", async () => {
    const { exact } = await canon();
    for (const declared of DECLARED) {
      const method = await masonryMethod({ ruleId: declared.ruleId, version: MASONRY_VERSION });
      const at = exact(String(method.evaluate(bindingsFor(declared.variables))));
      const moved = exact(String(method.evaluate(bindingsFor(declared.variables, { threshold: OTHER_THRESHOLD }))));
      expect(
        moved.eq(at),
        `${declared.ruleId}'s figure does not move when the threshold does — the threshold is what PARTITIONED the openings, and the sum it partitioned is already bound as \`openings\` (L-MEA-02, riskNotes (2)); it answered ${at.toString()} and ${moved.toString()}`,
      ).toBe(true);
    }
  });

  test("AC-2: the platform seed is re-minted at the version this increment lands, citing every enumerated pair", async () => {
    const seed = await productModule<{
      SEED_EDITION_IDENTITY: { scope: string; name: string; version: string };
      SEED_EDITION_CONTENT: { methods: readonly MethodPairShape[]; parameters: Record<string, { value: string; unit: string }> };
    }>(SEED_MODULE);
    const registry = await methodsRegistry();

    expect(
      { name: seed.SEED_EDITION_IDENTITY.name, version: seed.SEED_EDITION_IDENTITY.version },
      "the seed the product ships is re-minted at the identity this increment lands (AC-2, B-20)",
    ).toEqual({ name: SEED_EDITION_NAME, version: SEED_EDITION_VERSION });
    expect(
      SEED_VERSION,
      "and the shared test roster is re-baselined to the same version — one statement of what is minted, never two that can part (B-19)",
    ).toBe(seed.SEED_EDITION_IDENTITY.version);
    expect(
      seed.SEED_EDITION_CONTENT.methods.map((pair) => `${pair.ruleId}@${pair.version}`).sort(),
      "and cites exactly the pairs the shards enumerate — a method landed with its manifest is in force with no second list to edit (B-19)",
    ).toEqual(registry.enumerateMethods().map((pair) => `${pair.ruleId}@${pair.version}`).sort());
  });
});
