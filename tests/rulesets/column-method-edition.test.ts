/**
 * AC-6 — `rcc.column.concrete@1` and `rcc.column.circular.concrete@1` as the methods in force for a
 * column's concrete, and the platform edition re-minted to cite every method the shards enumerate
 * (L-MEA-01, L-FRM-02, L-REG-07, B-19, B-20).
 *
 * The criterion is extended to the SECOND pair because a column's section is read two ways: the
 * plan states the SHAPE (`C7 %%C450 PORCH COLUMN`) and the schedule states the SIZE (a `450x450`
 * B × D cell), and those two are not in disagreement — b = d = 450 either way, and a B × D schedule
 * has no cell in which to say "circle". A 450 circle is 78.5 % of a 450 square, so the two readings
 * are two METHODS and never one method taking whichever reading it was handed: the line a reader
 * audits has to print the section it measured (L-QTY-03).
 *
 * The pair is enumerated from the shards rather than from a second list, so what an edition may cite
 * is what the toolchain accepted: the method-hash stage is run here as `pnpm verify` runs it, and it
 * has to accept the new shard. The edition's own roster is then compared to `enumerateMethods()`
 * whole — riskNotes (1) settles that "every method in force" IS the shards' roster — while the
 * seventeen parameters L-MEA-01 fixes are compared value by value, because a re-mint that moved one
 * would be a new rule set rather than a new citation.
 *
 * The screen leg of this criterion (the pinned identity rendered in `ruleset-edition-identity`) is
 * graded by `./ruleset-settings-section.test.ts` over the same re-baselined `SEED_VERSION`, and the
 * store leg (two `ruleset_editions` rows, and a project pinning a fork of the new one) by
 * `db/__tests__/ruleset-editions.migration.test.ts`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  BREADTH_VARIABLE,
  COLUMN_CONCRETE_PAIR,
  COLUMN_CONCRETE_RULE_ID,
  COLUMN_CONCRETE_VERSION,
  COLUMN_METHOD_MODULE,
  COLUMN_SHARD,
  COLUMN_TEMPLATE,
  COUNT,
  type FormulaMethodShape,
  HEIGHT_VARIABLE,
  LENGTH_VARIABLE,
  METHOD_HASHES_SCRIPT,
  RCC_CONCRETE,
  REPO_ROOT,
  VOLUME,
  columnConcreteMethod,
  methodsRegistry,
  productModule,
} from "../takeoff/rails/support/column-rail-stage";
import { SEED_MODULE, SEED_NAME, SEED_PARAMETERS, SEED_PARAMETER_KEYS, SEED_VERSION } from "./support/editions";

/** The law the column method stands on (goal: the shard records `L-FRM-02`). */
const COLUMN_METHOD_LAW = "L-FRM-02";

/** The dimension each declared variable stands in (AC-6). */
const COUNT_DIMENSION = "COUNT";
const LENGTH_DIMENSION = "LENGTH";

/**
 * The circular pair, named here rather than in `column-rail-stage` because it is the EDITION's
 * business and not the rail's: the stage's constants are what a column rail offers through, and a
 * pair an edition cites is read from the registry by nothing but its (rule id, version).
 */
const CIRCULAR_RULE_ID = "rcc.column.circular.concrete";
const CIRCULAR_VERSION = "1";
const CIRCULAR_PAIR = Object.freeze({ ruleId: CIRCULAR_RULE_ID, version: CIRCULAR_VERSION });

/**
 * The one template the circular figure and the circular rendered formula are BOTH taken from.
 *
 * π by its twenty-one digits and not by its glyph, and `d × d` and not a power node: the template is
 * read back by the drift proof's own parser, which reads only the signs, the decimals and a
 * nameable — a glyph would be dropped silently on the way back. It is the bored pile's own spelling
 * (`rcc.pile.concrete@1`), which is the precedent this method was written against.
 */
const CIRCULAR_TEMPLATE = "V = count × 3.14159265358979323846 × d × d × H ÷ 4";

/** The variable a circular section is stated by: a DIAMETER, which is what `%%C450` states. */
const DIAMETER_VARIABLE = "d";

/** The expression tree's home — the one printer and the one parser the drift proof is taken with. */
const EXPR_MODULE = "src/core/rulesets/methods/expr.ts";

/** The seed, as the migration and every campaign read it (test contract). */
type SeedModule = {
  SEED_EDITION_IDENTITY: { scope: string; name: string; version: string };
  SEED_EDITION_CONTENT: { parameters: Record<string, { value: string; unit: string }>; methods: readonly { ruleId: string; version: string }[] };
};

describe("AC-6: the column method is enumerated, implemented and cited", () => {
  test("AC-6: the shards enumerate rcc.column.concrete@1, and the method-hash stage accepts the shard that records it", async () => {
    const registry = await methodsRegistry();
    expect(
      [...registry.enumerateMethods()],
      "the pair the columns shard records is enumerated — the shards are the record of what is in force, and nothing else is edited to add one (B-19)",
    ).toContainEqual({ ruleId: COLUMN_CONCRETE_RULE_ID, version: COLUMN_CONCRETE_VERSION });
    expect([...registry.enumerateMethods()], "and so is the circular section the shard records beside it").toContainEqual({ ruleId: CIRCULAR_RULE_ID, version: CIRCULAR_VERSION });

    // white-box: AC-6 — the shard manifest IS the artifact the criterion names; what it records
    // (the law and the module the pair is computed by) is a property of that declaration itself.
    const shard = JSON.parse(readFileSync(join(REPO_ROOT, COLUMN_SHARD), "utf8")) as {
      methods: Record<string, { ruleId: string; version: string; law: string; module: string }>;
    };
    const recorded = Object.values(shard.methods).find((entry) => entry.ruleId === COLUMN_CONCRETE_RULE_ID && entry.version === COLUMN_CONCRETE_VERSION);
    expect(recorded, `${COLUMN_SHARD} records ${COLUMN_CONCRETE_RULE_ID}@${COLUMN_CONCRETE_VERSION} (it records ${Object.keys(shard.methods).join(", ")})`).toBeTruthy();
    expect(
      { law: (recorded as { law: string }).law, module: (recorded as { module: string }).module },
      "a method is recorded beside the code it declares, under the law it computes (L-MEA-01)",
    ).toEqual({ law: COLUMN_METHOD_LAW, module: COLUMN_METHOD_MODULE });

    const circular = Object.values(shard.methods).find((entry) => entry.ruleId === CIRCULAR_RULE_ID && entry.version === CIRCULAR_VERSION);
    expect(circular, `${COLUMN_SHARD} records ${CIRCULAR_RULE_ID}@${CIRCULAR_VERSION} beside it (it records ${Object.keys(shard.methods).join(", ")})`).toBeTruthy();
    expect(
      { law: (circular as { law: string }).law, module: (circular as { module: string }).module },
      "and the circular section is recorded beside the same code, under the same clause — it is L-FRM-02's other prism, not another law (L-MEA-01)",
    ).toEqual({ law: COLUMN_METHOD_LAW, module: COLUMN_METHOD_MODULE });

    const verified = spawnSync(process.execPath, [METHOD_HASHES_SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(
      verified.status,
      `\`node ${METHOD_HASHES_SCRIPT}\` verifies every shard's digest — a declaration that drifted from what the toolchain accepted fails the stage: ${verified.stdout}${verified.stderr}`,
    ).toBe(0);
  });

  test("AC-6: the registry maps the pair to the formula this leaf lands", async () => {
    const method = await columnConcreteMethod();
    const module = await productModule<Record<string, unknown>>(COLUMN_METHOD_MODULE);

    expect(module["COLUMN_CONCRETE_METHOD"], `${COLUMN_METHOD_MODULE} publishes \`COLUMN_CONCRETE_METHOD\` — the pair an edition cites (test contract)`).toEqual(
      COLUMN_CONCRETE_PAIR,
    );
    expect(
      module["COLUMN_CONCRETE_FORMULA"],
      `${COLUMN_METHOD_MODULE} publishes \`COLUMN_CONCRETE_FORMULA\`, and the registry answers the pair with exactly it — one declaration, one implementation (B-17)`,
    ).toBe(method);

    expect(
      { role: method.role, kind: method.kind, dimension: method.dimension, template: method.template },
      "the method is a formula over the column's concrete, standing in the volume dimension, with the one template its value and its rendered formula are both taken from (L-QTY-03)",
    ).toEqual({ role: "formula", kind: RCC_CONCRETE, dimension: VOLUME, template: COLUMN_TEMPLATE });
    expect(
      method.variables.map((variable) => [variable.name, variable.dimension]),
      "and it declares the four variables its template names, each in the dimension it stands in (L-FRM-02: `count × L × B × H`)",
    ).toEqual([
      [COUNT, COUNT_DIMENSION],
      [LENGTH_VARIABLE, LENGTH_DIMENSION],
      [BREADTH_VARIABLE, LENGTH_DIMENSION],
      [HEIGHT_VARIABLE, LENGTH_DIMENSION],
    ]);
  });

  test("AC-6: the registry maps the circular pair to a formula that measures a quarter of pi d squared over a storey", async () => {
    const registry = await methodsRegistry();
    const module = await productModule<Record<string, unknown>>(COLUMN_METHOD_MODULE);
    const method = registry.implementationOf(CIRCULAR_PAIR) as FormulaMethodShape | undefined;

    expect(module["COLUMN_CIRCULAR_CONCRETE_METHOD"], `${COLUMN_METHOD_MODULE} publishes \`COLUMN_CIRCULAR_CONCRETE_METHOD\` — the pair an edition cites`).toEqual(CIRCULAR_PAIR);
    expect(
      method,
      `the registry maps ${CIRCULAR_RULE_ID}@${CIRCULAR_VERSION} to an implementation — a pair an edition cites and nothing computes is what the gate refuses METHOD_IMPLEMENTATION_MISSING over (L-MEA-01)`,
    ).toBeTruthy();
    expect(module["COLUMN_CIRCULAR_CONCRETE_FORMULA"], "and the registry answers the pair with exactly the object the module publishes — one declaration, one implementation (B-17)").toBe(method);

    expect(
      { role: (method as FormulaMethodShape).role, kind: (method as FormulaMethodShape).kind, dimension: (method as FormulaMethodShape).dimension, template: (method as FormulaMethodShape).template },
      "the circular method is a formula over the column's concrete, standing in the volume dimension, with the one template its value and its rendered formula are both taken from (L-QTY-03)",
    ).toEqual({ role: "formula", kind: RCC_CONCRETE, dimension: VOLUME, template: CIRCULAR_TEMPLATE });
    expect(
      (method as FormulaMethodShape).variables.map((variable) => [variable.name, variable.dimension]),
      "and it declares three variables and never a radius: a plan states `%%C450` and a schedule states 450, so a formula naming a radius would print a reading nobody took (L-QTY-03)",
    ).toEqual([
      [COUNT, COUNT_DIMENSION],
      [DIAMETER_VARIABLE, LENGTH_DIMENSION],
      [HEIGHT_VARIABLE, LENGTH_DIMENSION],
    ]);

    // The drift proof the whole expression tree exists for: what the line PRINTS is read back and is
    // the very tree the figure was computed from. A pi glyph or a power node would be dropped by the
    // parser, and this is the assertion that would catch it (L-QTY-03, B-17, B-19).
    const expr = await productModule<{ parse: (text: string) => unknown; print: (statement: unknown) => string }>(EXPR_MODULE);
    expect(expr.parse(expr.print((method as unknown as { tree: unknown }).tree)), "the printed formula reads back as the very tree it was printed from").toEqual(
      (method as unknown as { tree: unknown }).tree,
    );

    // A 450 circle over a 3 m storey is pi x 0.45 x 0.45 x 3 / 4 — 78.5 % of the 0.6075 m3 prism the
    // rectangular method answers for the same schedule cell, which is the whole of the difference
    // the golden band refuses when a porch column is measured square.
    expect(
      (method as FormulaMethodShape).evaluate({ count: { value: "1" }, d: { value: "0.45" }, H: { value: "3" } }),
      "and the figure is the canon's exact decimal, never a machine's double (B-07)",
    ).toBe("0.4771293842639498480911125");
  });

  test("AC-6: the platform seed is IS1200_IN @ 2027.03 and cites every method the shards enumerate", async () => {
    const registry = await methodsRegistry();
    const seed = await productModule<SeedModule>(SEED_MODULE);

    expect(seed.SEED_EDITION_IDENTITY, "the platform edition is re-minted at the head of every lineage (L-REG-07, B-20)").toEqual({
      scope: "platform",
      name: SEED_NAME,
      version: SEED_VERSION,
    });
    // Re-baselined by the circular column: its one method is minted at the next version beside the
    // standing 2027.02 rather than over it — an edition is immutable, so a leaf that lands a method
    // lands a version with it, and ONE method owes a version exactly as twelve did (L-MEA-01, B-20).
    expect(SEED_VERSION, "and the version it is re-minted at is the one this increment lands").toBe("2027.03");

    expect(
      [...seed.SEED_EDITION_CONTENT.methods],
      "the edition cites every method in force — the shards' own roster, so a method landed with its manifest is cited without a second list being edited (riskNotes (1), B-19)",
    ).toEqual([...registry.enumerateMethods()]);
    expect(
      seed.SEED_EDITION_CONTENT.methods.map((pair) => `${pair.ruleId}@${pair.version}`),
      "including both pairs a column's concrete is measured by — the prism the schedule's B × D cell states, and the circle the plan's own note states",
    ).toEqual(expect.arrayContaining([`${COLUMN_CONCRETE_RULE_ID}@${COLUMN_CONCRETE_VERSION}`, `${CIRCULAR_RULE_ID}@${CIRCULAR_VERSION}`]));

    expect(
      Object.keys(seed.SEED_EDITION_CONTENT.parameters),
      "and L-MEA-01's seventeen parameters are the same seventeen after the re-mint — a parameter added or dropped would be another rule set, not another citation",
    ).toEqual([...SEED_PARAMETER_KEYS]);
    for (const parameter of SEED_PARAMETERS) {
      const held = seed.SEED_EDITION_CONTENT.parameters[parameter.key];
      expect(held, `the re-minted content states \`${parameter.key}\``).toBeTruthy();
      // The value is compared as a quantity, never as a spelling: `0.10` and `0.1` are one allowance.
      expect(Number((held as { value: string }).value), `\`${parameter.key}\` stands at the value L-MEA-01 fixes`).toBe(parameter.value);
    }
  });
});
