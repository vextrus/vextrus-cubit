// @vitest-environment node
/**
 * The split proof for the job-kind roster (AM-11, R-SPINE-030, SEAM-JOBS, B-19).
 *
 * AM-11 moves each kind's policy and payload type into the file of the area that runs it, leaving
 * `src/core/jobs/kinds.ts` as the roster that ENUMERATES those files and merges them. The claim is
 * that the aggregate did not change: the same kinds, in the same order, with the same numbers.
 *
 * POLICIES_BEFORE is the table as it stood before the split, frozen here on purpose: a derivation
 * cannot catch a kind the split dropped or a number it retyped. An increment that lands a kind
 * re-baselines this table in its own commit and says so (B-19, B-20). ORDER_BEFORE is separate
 * because the order is load-bearing — `KIND_NAMES` is read off the table's keys, and the runtime
 * declares queues and consumes in that order.
 *
 * Modules are loaded by absolute path, the contract `src/core/errors/taxonomy.test.ts` uses: a module
 * the product does not provide yet fails as an assertion naming the file, never as a resolution error.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/** The checkout this suite runs against. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** The roster: the one path every importer in the tree names. */
const ROSTER = "src/core/jobs/kinds.ts";

/** Where the areas keep their own groups. */
const AREA_DIR = "src/core/jobs/kinds";

/** Code-point order — the only order this tree sorts a roster by (L-REG-05). */
const byCodePoint = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/** Every kind's policy as the seam held it before AM-11 moved a line — the baseline, transcribed. */
const POLICIES_BEFORE: Readonly<Record<string, Readonly<Record<string, number | boolean>>>> = Object.freeze({
  ingest: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 2100 }),
  measure: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 1800 }),
  partition: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 900 }),
  probe: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 1, retryBackoff: true, expireSeconds: 900 }),
  thumbnails: Object.freeze({ concurrency: 1, retryLimit: 2, retryDelaySeconds: 5, retryBackoff: true, expireSeconds: 900 }),
});

/** The order the table declared its kinds in, which `KIND_NAMES` and the runtime both read off it. */
const ORDER_BEFORE: readonly string[] = Object.freeze(["probe", "ingest", "thumbnails", "partition", "measure"]);

async function moduleAt(relative: string): Promise<Record<string, unknown>> {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs) && statSync(abs).isFile(), `${relative} is missing from the checkout — the split does not provide it yet`).toBe(true);
  const specifier: string = abs;
  return (await import(specifier)) as Record<string, unknown>;
}

/** The groups the areas publish: one `*_JOB_KINDS` per file that has one, read off the disk (B-19). */
async function areaGroups(): Promise<{ file: string; group: Readonly<Record<string, unknown>> }[]> {
  const abs = join(REPO_ROOT, AREA_DIR);
  expect(existsSync(abs), `${AREA_DIR} is missing — AM-11 puts each area's kinds in its own file there`).toBe(true);
  const found: { file: string; group: Readonly<Record<string, unknown>> }[] = [];
  for (const name of readdirSync(abs).filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && entry !== "law.ts").sort(byCodePoint)) {
    const file = `${AREA_DIR}/${name}`;
    const mod = await moduleAt(file);
    for (const exported of Object.keys(mod).sort(byCodePoint)) {
      if (exported.endsWith("_JOB_KINDS")) found.push({ file, group: mod[exported] as Readonly<Record<string, unknown>> });
    }
  }
  return found;
}

describe("AM-11: the roster is the areas, enumerated — and the aggregate did not move", () => {
  test("the roster holds exactly the kinds and policies it held before the split", async () => {
    const mod = await moduleAt(ROSTER);
    const kinds = mod["JOB_KINDS"] as Readonly<Record<string, unknown>>;
    expect(kinds, "a kind or a number changed on its way into an area file — a policy is the answer to 'how often does this kind retry', and a move does not edit it (R-SPINE-030)").toEqual(POLICIES_BEFORE);
  });

  test("the roster declares its kinds in the order it declared them before", async () => {
    const mod = await moduleAt(ROSTER);
    const kinds = mod["JOB_KINDS"] as Readonly<Record<string, unknown>>;
    expect(Object.keys(kinds), "the declaration order moved — KIND_NAMES is read off these keys, and the runtime declares queues and consumes in that order").toEqual([...ORDER_BEFORE]);
    expect(mod["KIND_NAMES"], "KIND_NAMES is the table's keys and nothing else").toEqual([...ORDER_BEFORE]);
  });

  test("the areas partition the roster: no kind twice, and none the roster does not hold", async () => {
    const groups = await areaGroups();
    expect(groups.length, `${AREA_DIR} publishes no area group — the split owes one \`*_JOB_KINDS\` per area`).toBeGreaterThan(0);
    const claimedBy = new Map<string, string>();
    const twice: string[] = [];
    for (const { file, group } of groups) {
      for (const kind of Object.keys(group)) {
        const held = claimedBy.get(kind);
        if (held !== undefined) twice.push(`${kind}: ${held} and ${file}`);
        else claimedBy.set(kind, file);
      }
    }
    expect(twice, "two areas declare one kind — a kind has one home, and the merge would silently pick a winner (ARCH-02, B-17)").toEqual([]);
    expect(
      [...claimedBy.keys()].sort(byCodePoint),
      "the areas together declare a different set than the seam ran — an area file the roster forgot to enumerate reads exactly like this (B-19)",
    ).toEqual(Object.keys(POLICIES_BEFORE).sort(byCodePoint));
  });
});
