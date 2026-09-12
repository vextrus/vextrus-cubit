/**
 * A RETRYING READ CAN RETRY A WRONG VALUE INTO A GREEN (P4b §3).
 *
 * `steadyCount` returned as soon as TWO readings agreed, and a table that has not begun painting
 * reads 0, reads 0 again, and is "settled" in about 100 ms. That premature zero then satisfies every
 * at-most assertion in the lane unconditionally — `expect(rows).toBeLessThanOrEqual(5)` is true of a
 * screen that is not there — and `project-home.spec.ts` BRANCHES on it. `steadyText` had the same
 * shape one step worse: it took the first NON-EMPTY text, which is the previous state's label.
 *
 * The doubles here are the adversary's own (scratchpad/adv/p4b/steady.test.ts): a locator whose count
 * climbs 0,0,0,3,7 as the body paints, and an element carrying the old label before the new one. They
 * carry no `page()`, which is also how they prove that the rendered-contract wait is skipped for a
 * reader that has no page under it rather than throwing at one.
 */
import { describe, expect, test } from "vitest";
import { AGREEING_READS, everyAttribute, steadyAttribute, steadyCount, steadyText } from "../e2e/support/retrying-read";

/** A locator whose count is 0 until the table starts painting, then climbs to 7. */
function slowLocator(values: number[]): never {
  let at = 0;
  return { count: async () => values[Math.min(at++, values.length - 1)] ?? 0 } as never;
}
/** An element carrying the PREVIOUS state's text, then the new one. */
function stalingText(texts: string[]): never {
  let at = 0;
  return { textContent: async () => texts[Math.min(at++, texts.length - 1)] ?? "" } as never;
}
/** An element that is server-rendered without its attribute, then hydrates with it. */
function stalingAttribute(values: (string | null)[]): never {
  let at = 0;
  return { getAttribute: async () => values[Math.min(at++, values.length - 1)] ?? null } as never;
}

describe("P4b §3: the reads that answer a question wait for the answer", () => {
  test("D1: steadyCount on a table that has not started painting answers 7, not 0", async () => {
    const seen = await steadyCount(slowLocator([0, 0, 0, 3, 7, 7]), "rows");
    expect(seen, "two agreeing readings of a table that is not there yet is not a settled table").toBe(7);
  });

  test("a zero IS the answer where the caller says zero is lawful, and is read as one", async () => {
    expect(await steadyCount(slowLocator([0, 0, 0, 0]), "the none line", { min: 0 })).toBe(0);
  });

  test("the floor is the caller's, not the reader's — a count below it is never settled", async () => {
    await expect(steadyCount(slowLocator([1, 1, 1, 1]), "the register's lines", { min: 2, timeout: 1_000 })).rejects.toThrow(/still painting/);
  });

  test("D2: steadyText takes the settled text, not the first non-empty one", async () => {
    const text = await steadyText(stalingText(["0 lines", "0 lines", "5,412 lines"]), "the count line");
    expect(text, "non-empty is not the same as settled").toBe("5,412 lines");
  });

  test("a caller that holds the previous label is never handed it back", async () => {
    const text = await steadyText(stalingText(["Riverside Tower", "Riverside Tower", "Riverside Tower", "Harbour Point"]), "the breadcrumb", {
      not: "Riverside Tower",
    });
    expect(text, "the act renamed it, so the old name is a reading of the frame before the act").toBe("Harbour Point");
  });

  test("steadyAttribute waits for the attribute to exist and hold still — a branch is not taken on a hydrating frame", async () => {
    expect(await steadyAttribute(stalingAttribute([null, null, "STRUCT", "STRUCT"]), "data-discipline", "the group's discipline")).toBe("STRUCT");
  });

  test("everyAttribute reads the WHOLE list in one call, and a list still growing is not a settled list", async () => {
    // The shape it replaces read each row on its own, so a list that grew between row 3 and row 400
    // was never noticed. Here the readings are compared as lists: the first two disagree in length.
    const readings = [["a"], ["a", "b"], ["a", "b", "c"], ["a", "b", "c"], ["a", "b", "c"]];
    let at = 0;
    // `evaluateAll` serves both the contract read and the list read; this double publishes no
    // contract (the reader then falls back to agreeing readings, which is what is under test here).
    const rows = { evaluateAll: async (_fn: unknown, arg: unknown) => (typeof arg === "string" ? readings[Math.min(at++, readings.length - 1)] ?? [] : { published: false, by: null, value: null }) } as never;
    expect(await everyAttribute(rows, "data-key", "the selected rows"), "the answer is the list that held still").toEqual(["a", "b", "c"]);
    expect(at, `one call per reading, never one per row — it took ${at}`).toBeLessThanOrEqual(readings.length);
  });

  test("everyAttribute refuses a list that never holds still, naming the attribute it was reading", async () => {
    let at = 0;
    const churning = { evaluateAll: async (_fn: unknown, arg: unknown) => (typeof arg === "string" ? [String(at++)] : { published: false, by: null, value: null }) } as never;
    await expect(everyAttribute(churning, "data-key", "the selected rows", { timeout: 1_000 })).rejects.toThrow(/data-key/);
  });

  test("three readings, stated once, are what the two helpers agree on", () => {
    expect(AGREEING_READS).toBeGreaterThanOrEqual(3);
  });
});
