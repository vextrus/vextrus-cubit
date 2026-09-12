/**
 * A HEIGHT BUDGET MAY ONLY FALL (Design Direction 00 §9.3, tests/e2e/support/height-budget.ts).
 *
 * The budget file says it in prose — "a budget is a CEILING TO LOWER, never a target" — and until
 * this suite existed nothing enforced it: a screen that grew 400 px could be made green by editing
 * one number, in the same commit that grew it, and the walk would never know. That is the whole
 * failure mode the file was written to prevent, so the file's own numbers get the ratchet the axe
 * budget already has.
 *
 * The reference is `height-budget.frozen.json`, a copy of the numbers at the moment the cap's
 * off-switch was deleted. Against it an entry may FALL (the composition improved), or DISAPPEAR
 * (the redesign earned the debt away, which is what the file asks for), and may never RISE. A
 * checkpoint that appears in neither file is a screen nothing had measured before; it is admitted
 * once, with its own measured number, and is frozen from then on by being written here.
 *
 * The second property is the one that cost this branch 43 blessed pictures: the cap must have NO
 * off-switch. `CUBIT_HEIGHT_BUDGET_SEED=1` used to write the measured heights to a seed file and
 * silence the assertion; the v22 re-baseline walk ran with it, so every committed still was taken
 * in a run where §9.3 was not enforced. It is deleted, and this suite reads the source to keep it
 * deleted — a flag can be re-added in three lines by anyone who has not read the history.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { SCREEN_HEIGHT_BUDGET } from "../e2e/support/height-budget";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** §9.3's own cap: twice the lease's 900 px viewport. An entry at or under it is not a budget. */
const CAP = 1800;

const frozen = JSON.parse(readFileSync(resolve(REPO_ROOT, "tests/ui/height-budget.frozen.json"), "utf8")) as Record<string, number | string>;
const frozenHeights = Object.fromEntries(Object.entries(frozen).filter((entry): entry is [string, number] => typeof entry[1] === "number"));

describe("the per-screen height budget", () => {
  test("no entry rises against the frozen copy", () => {
    const risen = Object.entries(SCREEN_HEIGHT_BUDGET)
      .filter(([name, px]) => name in frozenHeights && px > (frozenHeights[name] as number))
      .map(([name, px]) => `${name}: ${frozenHeights[name] as number} -> ${px}`);
    expect(risen, "a height budget is a ceiling to lower: raise one and the screen that grew is blessed in the same commit that grew it. Lower the screen, not the number").toEqual([]);
  });

  test("every entry the frozen copy does not know is a first measurement, and is written down here", () => {
    const unfrozen = Object.keys(SCREEN_HEIGHT_BUDGET).filter((name) => !(name in frozenHeights));
    expect(unfrozen, "a new entry is a screen's first measurement; add it to tests/ui/height-budget.frozen.json in the same commit, with the walk that measured it named in the budget file's comment, so the next commit cannot raise it").toEqual([]);
  });

  test("every entry is taller than §9.3's own cap — an entry under it is a debt already paid", () => {
    const pointless = Object.entries(SCREEN_HEIGHT_BUDGET).filter(([, px]) => px <= CAP).map(([name, px]) => `${name}: ${px}`);
    expect(pointless, `a budget exists only to admit a screen taller than ${CAP} px; one at or under the cap enforces nothing and must be deleted, which is the redesign earning it away`).toEqual([]);
  });

  test("the cap has no off-switch", () => {
    const source = readFileSync(resolve(REPO_ROOT, "tests/e2e/support/checkpoint.ts"), "utf8");
    const reads = source.split("\n").filter((line) => /process\.env\[[^\]]*HEIGHT[^\]]*\]/.test(line));
    expect(reads, "the height cap is read from no environment variable: a flag that silences it blesses every picture the run takes. The failure message prints the measured px, which is all a first measurement needs").toEqual([]);
  });
});
