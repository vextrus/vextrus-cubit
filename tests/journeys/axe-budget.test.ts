/**
 * The moderate budget registry, asserted (U1 adversary finding 4).
 *
 * Until 2026-09-12 all seventy entries were `null`, `moderateBudgetFor` answered `null` for a
 * checkpoint it had never heard of as well, and `checkpoint.ts` gated on `budget !== null`: naming a
 * checkpoint and omitting it were byte-identical outcomes, and no test asserted that a checkpoint
 * appeared in the file at all. The registry was a no-op with a docblock — which is exactly the shape
 * of defect it was written to catch, one level up.
 *
 * This file is the assertion that was missing. It is a UNIT test on purpose: the property is about
 * the registry's shape, and a property that needs a browser to be checked is a property that is
 * checked once a night instead of once a commit.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
import { AXE_MODERATE_BUDGET, moderateBudgetFor } from "../e2e/support/axe-budget";

describe("AM-09 §4: the per-screen moderate budget is a reading, not a placeholder", () => {
  test("every named checkpoint carries a number — a budget that is not a number enforces nothing", () => {
    const entries = Object.entries(AXE_MODERATE_BUDGET);
    expect(entries.length, "the registry names the checkpoints the lane walks").toBeGreaterThan(50);
    const unusable = entries.filter(([, budget]) => typeof budget !== "number" || !Number.isInteger(budget) || budget < 0);
    expect(unusable, "a budget is a whole count of findings a screen is allowed — never null, never a fraction").toEqual([]);
  });

  test("a checkpoint the registry does not name is undefined, so the caller can fail on it", () => {
    // The whole point: the answer for an unknown checkpoint must be distinguishable from a real
    // budget of 0, or `checkpoint.ts` cannot tell "allowed none" from "nobody looked".
    expect(moderateBudgetFor("a-checkpoint-nobody-has-recorded")).toBeUndefined();
    const [first] = Object.keys(AXE_MODERATE_BUDGET);
    expect(typeof moderateBudgetFor(first as string), "a named checkpoint answers with its number").toBe("number");
  });

  test("the checkpoint gate fails on an unnamed checkpoint rather than skipping the assertion", () => {
    // Read from the source, because the behaviour lives in a file this lane cannot execute (it needs
    // a Page). What is asserted is that the gate is no longer conditional on the budget existing.
    const gate = readFileSync(resolve(REPO_ROOT, "tests/e2e/support/checkpoint.ts"), "utf8");
    expect(gate.includes("if (budget !== null)"), "the old gate skipped the assertion whenever the budget was unseeded").toBe(false);
    expect(gate.includes("no moderate budget is recorded for it"), "an unnamed checkpoint fails by name").toBe(true);
  });
});
