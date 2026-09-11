// @vitest-environment node
/**
 * The split proof for the rail roster (AM-11, L-MEA-08, B-19).
 *
 * AM-11 gives each area its own roster file and leaves `./index.ts` as the barrel that ENUMERATES
 * them and merges them, so M3's five rails can each be written in their own file. The claim is that
 * the aggregate did not change: the same kinds answered, by the same functions.
 *
 * KINDS_BEFORE is the roster as it stood before the split, frozen on purpose — a derivation cannot
 * catch a kind the split dropped. An increment that lands a rail re-baselines it and says so (B-19).
 *
 * Modules are loaded by absolute path, the contract this tree's other split proofs use: a module the
 * product does not provide yet fails as an assertion naming the file, never as a resolution error.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The barrel: the one path the measure job and the worker name. */
const BARREL = "src/modules/takeoff/rails/index.ts";

/** Where the areas keep their own rosters. */
const AREA_DIR = "src/modules/takeoff/rails";

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** Every kind the product measured before AM-11 moved a line, in code-point order. */
const KINDS_BEFORE: readonly string[] = Object.freeze(["rcc.concrete"]);

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Record<string, unknown>;
}

/** The rosters the areas publish: one `*_RAILS` per file that has one, read off the disk (B-19). */
async function areaRosters(): Promise<{ file: string; roster: Readonly<Record<string, unknown>> }[]> {
  const abs = join(REPO_ROOT, AREA_DIR);
  expect(existsSync(abs), `${AREA_DIR} is missing — AM-11 puts each area's rails in its own file there`).toBe(true);
  const found: { file: string; roster: Readonly<Record<string, unknown>> }[] = [];
  for (const name of readdirSync(abs).filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && entry !== "law.ts" && entry !== "index.ts").sort(byCodePoint)) {
    const file = `${AREA_DIR}/${name}`;
    const mod = await moduleAt(file);
    for (const exported of Object.keys(mod).sort(byCodePoint)) {
      if (exported.endsWith("_RAILS")) found.push({ file, roster: mod[exported] as Readonly<Record<string, unknown>> });
    }
  }
  return found;
}

describe("AM-11: the roster is the areas, enumerated — and the aggregate did not move", () => {
  test("the barrel answers exactly the kinds it answered before the split", async () => {
    const mod = await moduleAt(BARREL);
    const rails = mod["RAILS"] as Readonly<Record<string, unknown>>;
    expect(Object.keys(rails).sort(byCodePoint), "a kind was dropped or minted by the split — a kind with no rail is a kind nothing measures (L-MEA-08)").toEqual([...KINDS_BEFORE]);
  });

  test("the areas partition the roster: no kind twice, and none the barrel does not answer", async () => {
    const rosters = await areaRosters();
    expect(rosters.length, `${AREA_DIR} publishes no area roster — the split owes one \`*_RAILS\` per area`).toBeGreaterThan(0);
    const claimedBy = new Map<string, string>();
    const twice: string[] = [];
    for (const { file, roster } of rosters) {
      for (const kind of Object.keys(roster)) {
        const held = claimedBy.get(kind);
        if (held !== undefined) twice.push(`${kind}: ${held} and ${file}`);
        else claimedBy.set(kind, file);
      }
    }
    expect(twice, "two areas measure one kind — a rail is selected per kind, and the merge would silently pick a winner (L-MEA-08, B-17)").toEqual([]);
    expect(
      [...claimedBy.keys()].sort(byCodePoint),
      "the areas together measure a different set than the product did — an area file the barrel forgot to enumerate reads exactly like this (B-19)",
    ).toEqual([...KINDS_BEFORE]);
  });

  test("the barrel hands out the areas' own rails rather than wrappers of them", async () => {
    const mod = await moduleAt(BARREL);
    const rails = mod["RAILS"] as Readonly<Record<string, unknown>>;
    const copies: string[] = [];
    for (const { file, roster } of await areaRosters()) {
      for (const [kind, rail] of Object.entries(roster)) {
        if (rails[kind] !== rail) copies.push(`${kind} (${file})`);
      }
    }
    expect(copies, "the barrel answers a kind with something other than the very function its area holds — a wrapper is a second implementation (ARCH-02, B-17)").toEqual([]);
  });
});
