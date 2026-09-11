// @vitest-environment node
/**
 * The split proof for the method registry (AM-11, L-MEA-01, B-19).
 *
 * AM-11 gives each method area its own file — the shards it puts in force, and the code the pairs
 * they record are computed by — and leaves `src/core/rulesets/methods/registry.ts` as the registry
 * that ENUMERATES those files. The claim is that the aggregate did not change: `enumerateMethods`
 * answers the same pairs, in the same order, and `implementationOf` answers for every one of them
 * with the very object its area holds.
 *
 * PAIRS_BEFORE is the roster as it stood before the split, frozen on purpose — a derivation cannot
 * catch a shard the split stopped naming. An increment that lands a method re-baselines it and says
 * so, which is the event this file exists to make loud (B-19, B-20).
 *
 * Modules are loaded by absolute path, the contract this tree's other split proofs use: a module the
 * product does not provide yet fails as an assertion naming the file, never as a resolution error.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");

/** The registry: the one path the gate and the seed both name. */
const REGISTRY = "src/core/rulesets/methods/registry.ts";

/** Where the areas keep their own contributions. */
const AREA_DIR = "src/core/rulesets/methods/registry";

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** Every pair the shards recorded before AM-11 moved a line, keyed `<ruleId>@<version>` (L-MEA-01). */
const PAIRS_BEFORE: readonly string[] = Object.freeze(["conventions.resolve@1", "member.volume@1", "rcc.column.concrete@1"]);

/** One area's contribution, as this file reads one. */
interface Area {
  shards: readonly { methods: Record<string, { ruleId: string; version: string }> }[];
  implementations: Record<string, unknown>;
}

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Record<string, unknown>;
}

/** The contributions the areas publish: one `*_METHODS` per file that has one, read off the disk. */
async function areaContributions(): Promise<{ file: string; area: Area }[]> {
  const abs = join(REPO_ROOT, AREA_DIR);
  expect(existsSync(abs), `${AREA_DIR} is missing — AM-11 puts each area's methods in its own file there`).toBe(true);
  const found: { file: string; area: Area }[] = [];
  for (const name of readdirSync(abs).filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && entry !== "area.ts").sort(byCodePoint)) {
    const file = `${AREA_DIR}/${name}`;
    const mod = await moduleAt(file);
    for (const exported of Object.keys(mod).sort(byCodePoint)) {
      if (exported.endsWith("_METHODS")) found.push({ file, area: mod[exported] as Area });
    }
  }
  return found;
}

describe("AM-11: the registry is the areas, enumerated — and the aggregate did not move", () => {
  test("enumerateMethods answers exactly the pairs the shards recorded before the split", async () => {
    const mod = await moduleAt(REGISTRY);
    const enumerate = mod["enumerateMethods"] as () => readonly { ruleId: string; version: string }[];
    const key = mod["methodKey"] as (pair: { ruleId: string; version: string }) => string;
    expect(
      enumerate().map((pair) => key(pair)),
      "a pair was dropped or minted by the split — a shard nothing names is a pair an edition could cite that nothing can compute (L-MEA-01, B-19)",
    ).toEqual([...PAIRS_BEFORE]);
  });

  test("implementationOf answers for every pair, with the very object its area holds", async () => {
    const mod = await moduleAt(REGISTRY);
    const enumerate = mod["enumerateMethods"] as () => readonly { ruleId: string; version: string }[];
    const key = mod["methodKey"] as (pair: { ruleId: string; version: string }) => string;
    const implementationOf = mod["implementationOf"] as (pair: { ruleId: string; version: string }) => unknown;
    const held = new Map<string, unknown>();
    for (const { area } of await areaContributions()) {
      for (const [pairKey, implementation] of Object.entries(area.implementations)) held.set(pairKey, implementation);
    }
    const wrong: string[] = [];
    for (const pair of enumerate()) {
      const answered = implementationOf(pair);
      if (answered === undefined || answered !== held.get(key(pair))) wrong.push(key(pair));
    }
    expect(wrong, "the registry answers a pair with nothing, or with something other than the object its area registered — the gate refuses METHOD_IMPLEMENTATION_MISSING over exactly this (L-MEA-01)").toEqual([]);
  });

  test("the areas partition the roster: no pair twice, and none the registry does not answer", async () => {
    const areas = await areaContributions();
    expect(areas.length, `${AREA_DIR} publishes no area contribution — the split owes one \`*_METHODS\` per area`).toBeGreaterThan(0);
    const claimedBy = new Map<string, string>();
    const twice: string[] = [];
    for (const { file, area } of areas) {
      for (const shard of area.shards) {
        for (const entry of Object.values(shard.methods)) {
          const pairKey = `${entry.ruleId}@${entry.version}`;
          const first = claimedBy.get(pairKey);
          if (first !== undefined) twice.push(`${pairKey}: ${first} and ${file}`);
          else claimedBy.set(pairKey, file);
        }
      }
    }
    expect(twice, "two areas record one pair — a pair has one home, and the roster would silently pick a winner (ARCH-02, B-17)").toEqual([]);
    expect(
      [...claimedBy.keys()].sort(byCodePoint),
      "the areas together record a different set than the tree put in force — an area file the registry forgot to enumerate reads exactly like this (B-19)",
    ).toEqual([...PAIRS_BEFORE]);
  });
});
