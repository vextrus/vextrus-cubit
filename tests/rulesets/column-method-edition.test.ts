/**
 * AC-6 — `rcc.column.concrete@1` as a method in force, and the platform edition re-minted to cite
 * every method the shards enumerate (L-MEA-01, L-FRM-02, L-REG-07, B-19, B-20).
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

  test("AC-6: the platform seed is IS1200_IN @ 2026.09 and cites every method the shards enumerate", async () => {
    const registry = await methodsRegistry();
    const seed = await productModule<SeedModule>(SEED_MODULE);

    expect(seed.SEED_EDITION_IDENTITY, "the platform edition is re-minted at the head of every lineage (L-REG-07, B-20)").toEqual({
      scope: "platform",
      name: SEED_NAME,
      version: SEED_VERSION,
    });
    expect(SEED_VERSION, "and the version it is re-minted at is the one this increment lands").toBe("2026.09");

    expect(
      [...seed.SEED_EDITION_CONTENT.methods],
      "the edition cites every method in force — the shards' own roster, so a method landed with its manifest is cited without a second list being edited (riskNotes (1), B-19)",
    ).toEqual([...registry.enumerateMethods()]);
    expect(
      seed.SEED_EDITION_CONTENT.methods.map((pair) => `${pair.ruleId}@${pair.version}`),
      "including the pair this leaf lands",
    ).toContain(`${COLUMN_CONCRETE_RULE_ID}@${COLUMN_CONCRETE_VERSION}`);

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
