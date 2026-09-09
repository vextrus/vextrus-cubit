/**
 * AC-7 — the methods registry enumerates what the shards record and maps each pair to its
 * implementation, and the gate partitions deduction candidates against the edition's threshold
 * (L-MEA-01, L-MEA-08, L-QTY-04).
 *
 * "Methods (formulas, expansions…) are versioned code, keyed (rule id, version)": the registry's
 * roster is derived here from the shards themselves rather than transcribed, so a method a later
 * leaf lands is demanded of `enumerateMethods` with no edit (B-19). The recorded digest is judged by
 * running the toolchain stage that accepts it, not by re-computing it here.
 *
 * The threshold the opening channel is partitioned against is read from the seed edition's own
 * parameters, and the "below" candidate is proved below by carrying it through the canon — the two
 * facts a strictly-greater partition turns on, both asked of the product (B-17, B-19).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, test } from "vitest";
import {
  MEMBER_SHARD,
  MEMBER_VOLUME,
  OPENING,
  OPENING_THRESHOLD_PARAMETER,
  REPO_ROOT,
  UNIMPLEMENTED_VERSION,
  UNIT_UNMAPPED,
  bears,
  gateSeam,
  measure,
  methodsRegistry,
  offersContract,
  productModule,
  unitsSeam,
  type DeductionCandidateShape,
  type MethodPairShape,
} from "./support/gate-stage";

/** The pair AC-7 names as already recorded, beside the one this leaf adds. */
const CONVENTIONS_RESOLVE: MethodPairShape = { ruleId: "conventions.resolve", version: "1" };

/** The variables `member.volume@1` declares, and the dimension each is of (AC-7). */
const MEMBER_VOLUME_VARIABLES: readonly string[] = ["L", "b", "d"];
const LENGTH = "LENGTH";

/** The kind `member.volume@1` measures (AC-7). */
const RCC_CONCRETE = "rcc.concrete";

/** A unit the canon has no factor for at all (AC-7). */
const UNMAPPED_UNIT = "furlong";

/** The candidate AC-7 names as below the threshold once the canon has carried it. */
const BELOW = { value: "1.076391", unit: "sft" };

/** Sorted by code point — `localeCompare` is not available to this tree (L-REG-05). */
function byCodePoint(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Every file under a directory whose name ends in this suffix, in a stable order. */
function shardsUnder(directory: string, suffix: string): string[] {
  // white-box: AC-7 — the criterion asks for the roster to be "derived by reading the shards in the
  // test" (B-19): the shards ARE the record of which (rule id, version) pairs are in force, and a
  // roster judged against a list typed here would freeze what a later leaf extends. Only the shard
  // FILE LIST is gathered here — enumerated rather than pinned — and only the recorded pairs are
  // read from it; nothing about any implementation's source is asserted.
  return readdirSync(directory)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap((entry) => {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) return shardsUnder(path, suffix);
      return path.endsWith(suffix) ? [path] : [];
    });
}

describe("AC-7: the registry enumerates the shards and maps each pair to its implementation", () => {
  test("AC-7: enumerateMethods answers exactly the pairs the shards record, code-point sorted", async () => {
    const registry = await methodsRegistry();

    // white-box: AC-7 — the criterion itself asks for the roster to be "derived by reading the
    // shards in the test" (B-19): the shards ARE the record of which (rule id, version) pairs are in
    // force, and a roster judged against a list typed here would freeze what a later leaf extends.
    // Only the recorded pairs are read; nothing about any implementation's source is asserted.
    const files = shardsUnder(join(REPO_ROOT, "src"), registry.METHOD_MANIFEST_SUFFIX);
    expect(files.length, `src/** carries ${registry.METHOD_MANIFEST_SUFFIX} shards — with none there is no roster to enumerate`).toBeGreaterThan(0);

    const recorded: string[] = [];
    for (const file of files) {
      const shard = JSON.parse(readFileSync(file, "utf8")) as { methods?: Record<string, { ruleId?: string; version?: string }> };
      for (const [id, entry] of Object.entries(shard.methods ?? {})) {
        expect(typeof entry.ruleId === "string" && typeof entry.version === "string", `${file.split(sep).join("/")} records ${id} with its rule id and version`).toBe(true);
        recorded.push(registry.methodKey({ ruleId: String(entry.ruleId), version: String(entry.version) }));
      }
    }

    expect(recorded, "the shards record the pair the convention resolver was landed under (AC-7)").toContain(registry.methodKey(CONVENTIONS_RESOLVE));
    expect(recorded, "and the formula method this leaf adds (AC-7)").toContain(registry.methodKey(MEMBER_VOLUME));

    expect(
      registry.enumerateMethods().map((pair) => registry.methodKey(pair)),
      "the registry enumerates every pair recorded across every shard, in code-point order (goal)",
    ).toEqual(byCodePoint(recorded));
  });

  test("AC-7: methodKey spells a pair `<ruleId>@<version>`", async () => {
    const registry = await methodsRegistry();
    for (const pair of registry.enumerateMethods()) {
      expect(registry.methodKey(pair), "a pair's key is its rule id and its version, joined by an at-sign (test contract)").toBe(`${pair.ruleId}@${pair.version}`);
    }
  });

  test("AC-7: every enumerated pair has an implementation, and a version nothing implements has none", async () => {
    const registry = await methodsRegistry();
    const pairs = registry.enumerateMethods();
    expect(pairs.length, "the registry enumerates something — a registry over nothing maps nothing").toBeGreaterThan(0);
    for (const pair of pairs) {
      expect(
        registry.implementationOf(pair),
        `${registry.methodKey(pair)} is cited by a shard and must map to an implementation — an edition citing a method nothing implements keys content nothing can compute (L-MEA-01)`,
      ).toBeTruthy();
    }
    expect(
      registry.implementationOf({ ruleId: MEMBER_VOLUME.ruleId, version: UNIMPLEMENTED_VERSION }),
      `${MEMBER_VOLUME.ruleId}@${UNIMPLEMENTED_VERSION} is a version no shard records — the registry answers nothing for it, and the gate refuses METHOD_IMPLEMENTATION_MISSING`,
    ).toBeUndefined();
  });

  test("AC-7: member.volume@1 is a formula over b, d and L, each a length, for the concrete kind", async () => {
    const registry = await methodsRegistry();
    const canon = await unitsSeam();
    const catalogue = await bears();
    const implementation = registry.implementationOf(MEMBER_VOLUME);
    expect(implementation, `${registry.methodKey(MEMBER_VOLUME)} maps to an implementation`).toBeTruthy();
    const method = implementation as NonNullable<typeof implementation>;

    expect(method.role, "the method is a formula — it renders a value and a string from one template (L-QTY-03)").toBe("formula");
    expect(method.kind, "and it measures the concrete kind (AC-7)").toBe(RCC_CONCRETE);
    expect(catalogue.rows.map((row) => row.kind), "which is a kind the catalogue says a class bears — never a name this file invented (B-17)").toContain(method.kind);

    expect(byCodePoint(method.variables.map((variable) => variable.name)), "the formula declares b, d and L (AC-7)").toEqual([...MEMBER_VOLUME_VARIABLES]);
    for (const variable of method.variables) {
      expect(variable.dimension, `${variable.name} is a length (AC-7)`).toBe(LENGTH);
      expect([...canon.DIMENSIONS], "and LENGTH is a dimension the canon knows — a variable of no dimension cannot be normalised").toContain(variable.dimension);
    }
  });

  test("AC-7: the member shard records the pair, and its digest is the one the toolchain accepts", async () => {
    const registry = await methodsRegistry();
    const shard = join(REPO_ROOT, MEMBER_SHARD);
    expect(existsSync(shard), `${MEMBER_SHARD} is the shard ${registry.methodKey(MEMBER_VOLUME)} is recorded in (test contract)`).toBe(true);

    // white-box: AC-7 — which pair a shard RECORDS is a property of the shard's own text, and the
    // criterion asks for exactly that reading; the digest beside it is judged by running the stage
    // that accepts it, never by re-computing it here (scripts/** is locked, and a second
    // implementation of the hash would be a second home for the law).
    const recorded = JSON.parse(readFileSync(shard, "utf8")) as { methods?: Record<string, unknown>; digest?: unknown };
    expect(Object.keys(recorded.methods ?? {}), `${MEMBER_SHARD} records the formula method this leaf lands`).toContain(registry.methodKey(MEMBER_VOLUME));
    expect(typeof recorded.digest, `${MEMBER_SHARD} records a digest over its entries — a shard with none is a roster nothing guards`).toBe("string");

    const stage = spawnSync(process.execPath, [join(REPO_ROOT, "scripts", "method-hashes.mjs")], { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 });
    expect(
      stage.status,
      `pnpm verify's method-hash stage accepts every shard's recorded digest — a shard whose digest has gone stale is a method roster nobody can trust:\n${`${stage.stdout ?? ""}${stage.stderr ?? ""}`.slice(-1200)}`,
    ).toBe(0);
  });
});

describe("AC-7: deduction candidates are partitioned strictly-greater against the edition's threshold", () => {
  test("AC-7: at the threshold is kept, below it is kept, above it is deducted", async () => {
    const gate = await gateSeam();
    const canon = await unitsSeam();
    const contract = await offersContract();
    const seed = await productModule<{ SEED_EDITION_CONTENT: { parameters: Readonly<Record<string, { value: string; unit: string }>> } }>("src/core/rulesets/seed/index.ts");

    expect([...contract.DEDUCTION_CHANNELS], "the contract admits the opening channel — the one this leaf partitions (scope)").toContain(OPENING);
    const parameters = seed.SEED_EDITION_CONTENT.parameters;
    const threshold = parameters[OPENING_THRESHOLD_PARAMETER];
    expect(threshold, `the edition states ${OPENING_THRESHOLD_PARAMETER} — the parameter the opening channel is partitioned against (L-MEA-01)`).toBeTruthy();
    const at = threshold as { value: string; unit: string };

    // The two facts a strictly-greater partition turns on, both derived from the product itself.
    const carried = canon.convert(BELOW.value, BELOW.unit, at.unit);
    expect(carried.ok, `the canon carries ${BELOW.value} ${BELOW.unit} to ${at.unit}: ${JSON.stringify(carried)}`).toBe(true);
    expect(canon.exact(String(carried.value)).lt(canon.exact(at.value)), `${BELOW.value} ${BELOW.unit} really is below the threshold once the canon has carried it`).toBe(true);
    const above = canon.exact(at.value).mul(canon.exact("1.001")).toString();
    expect(canon.exact(at.value).lt(canon.exact(above)), `${above} ${at.unit} really is above the threshold`).toBe(true);

    const exactly: DeductionCandidateShape = { channel: OPENING, measure: measure(at.value, at.unit) };
    const below: DeductionCandidateShape = { channel: OPENING, measure: measure(BELOW.value, BELOW.unit) };
    const over: DeductionCandidateShape = { channel: OPENING, measure: measure(above, at.unit) };

    const answer = gate.partitionDeductions([exactly, below, over], parameters);
    expect(answer.ok, `the three candidates partition: ${JSON.stringify(answer)}`).toBe(true);
    const partitioned = answer as { ok: true; deducted: DeductionCandidateShape[]; kept: DeductionCandidateShape[] };

    expect(partitioned.kept, "a candidate exactly AT the threshold is kept — the partition is strictly greater (L-MEA-01)").toContainEqual(exactly);
    expect(partitioned.kept, "and one below it once the canon has carried it is kept too").toContainEqual(below);
    expect(partitioned.deducted, "only a candidate strictly above the threshold is deducted").toContainEqual(over);
    expect(partitioned.deducted.length + partitioned.kept.length, "and every candidate handed in lands on one side or the other").toBe(3);
  });

  test("AC-7: a candidate in a unit the canon lacks refuses UNIT_UNMAPPED rather than partitioning", async () => {
    const gate = await gateSeam();
    const canon = await unitsSeam();
    const seed = await productModule<{ SEED_EDITION_CONTENT: { parameters: Readonly<Record<string, { value: string; unit: string }>> } }>("src/core/rulesets/seed/index.ts");

    expect(canon.isUnit(UNMAPPED_UNIT), `${UNMAPPED_UNIT} is a spelling the canon rejects — with a factor for it this case proves nothing`).toBe(false);
    const answer = gate.partitionDeductions([{ channel: OPENING, measure: measure("1", UNMAPPED_UNIT) }], seed.SEED_EDITION_CONTENT.parameters);
    expect(answer.ok, `a candidate the canon cannot carry is refused, never partitioned: ${JSON.stringify(answer)}`).toBe(false);
    expect((answer as { ok: false; code: string }).code, "and the refusal is UNIT_UNMAPPED (goal, riskNotes (4))").toBe(UNIT_UNMAPPED);
  });
});
