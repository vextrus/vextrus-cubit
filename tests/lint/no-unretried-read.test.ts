// AM-09 §4, B-19 — `cubit/no-unretried-read`: inside `tests/e2e/**` a journey reads the product
// through RETRYING waits, and `waitForTimeout` is unlawful.
//
// Everything here is observed by driving the product: the tree's own `eslint.config.mjs` is loaded
// and run over payloads at virtual paths, so what is asserted is what `pnpm exec eslint tests/e2e`
// reports — not what a hand-built config would. The binding is asserted from both sides: the rule
// fires where the law binds, and it is SILENT one directory away, because a one-shot `.count()` over
// an array in a node suite is a read of a value that is already final and there is no page under it.
//
// It sits in tests/lint/ beside the other rule suites rather than in tests/toolchain/, which C-06
// locks to the files an increment's spec names.
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const RULE_ID = "cubit/no-unretried-read";
/** Where the law binds. */
const IN_LANE = "tests/e2e/probe.spec.ts";
/** One directory away, where it does not. */
const OUT_OF_LANE = "tests/journeys/probe.test.ts";

let linter: ESLint;

async function lintAs(source: string, virtualPath: string): Promise<Linter.LintMessage[]> {
  const results = await linter.lintText(source, { filePath: join(REPO_ROOT, virtualPath) });
  return results.flatMap((result) => result.messages);
}

/** @returns the lines this rule fired on, so a failure says WHERE rather than how many. */
async function firesAt(source: string, virtualPath = IN_LANE): Promise<number[]> {
  return (await lintAs(source, virtualPath)).filter((message) => message.ruleId === RULE_ID).map((message) => message.line);
}

beforeAll(async () => {
  const loaded: unknown = await import(pathToFileURL(join(REPO_ROOT, "eslint.config.mjs")).href);
  linter = new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: (loaded as { default: Linter.Config[] }).default });
}, 120_000);

describe("cubit/no-unretried-read fires on the reads that pass by timing", () => {
  test.each(["all", "count", "textContent", "innerText"])("a bare .%s() is refused", async (method) => {
    expect(await firesAt(`const value = await page.getByTestId("x").${method}();\n`)).toEqual([1]);
  });

  test("waitForTimeout is refused wherever it is written", async () => {
    expect(await firesAt("await page.waitForTimeout(250);\nawait frame.waitForTimeout(8);\n")).toEqual([1, 2]);
  });

  test("every offending read in a file is reported, not just the first", async () => {
    expect(await firesAt("const a = await one.count();\nconst b = await two.all();\nawait page.waitForTimeout(1);\n")).toEqual([1, 2, 3]);
  });

  test("the message names the retrying spellings, so the fix is in the failure", async () => {
    const [message] = (await lintAs("const n = await rows.count();\n", IN_LANE)).filter((entry) => entry.ruleId === RULE_ID);
    expect(message?.message).toContain("expect.poll");
    expect(message?.message).toContain("toHaveCount");
  });

  test("the sleep's message names settled(), which is what replaced it", async () => {
    const [message] = (await lintAs("await page.waitForTimeout(9);\n", IN_LANE)).filter((entry) => entry.ruleId === RULE_ID);
    expect(message?.message).toContain("settled(page)");
  });
});

describe("cubit/no-unretried-read admits the one place a single reading is lawful", () => {
  test("a one-shot read inside an expect.poll callback is the poll's, and is allowed", async () => {
    expect(await firesAt("await expect.poll(async () => await rows.count()).toBe(3);\n")).toEqual([]);
  });

  test("the same read nested deep inside the callback is still the poll's", async () => {
    expect(await firesAt("await expect.poll(async () => (await rows.all()).map((row) => row.id).length).toBe(3);\n")).toEqual([]);
  });

  test("a read in expect.poll's OPTIONS is not in the callback and is refused", async () => {
    // `expect.poll(fn, { timeout })` retries `fn` and nothing else it is handed.
    expect(await firesAt("await expect.poll(() => 1, { timeout: await rows.count() }).toBe(1);\n")).toEqual([1]);
  });

  test("a sleep inside an expect.poll callback is still a sleep", async () => {
    expect(await firesAt("await expect.poll(async () => { await page.waitForTimeout(5); return 1; }).toBe(1);\n")).toEqual([1]);
  });

  test("a retrying wait is not a read, and is never reported", async () => {
    const source = [
      'await expect(page.getByTestId("rows")).toHaveCount(3);',
      'await expect(page.getByTestId("name")).toHaveText("Riverside Tower");',
      'await page.getByTestId("card").waitFor({ state: "visible" });',
      "",
    ].join("\n");
    expect(await firesAt(source)).toEqual([]);
  });

  test("a method that merely shares a name but takes arguments is left alone", async () => {
    // `list.count(predicate)` is somebody else's API, not a locator's one-shot read.
    expect(await firesAt("const n = list.count((entry) => entry.ok);\n")).toEqual([]);
  });
});

describe("cubit/no-unretried-read binds tests/e2e and nothing else", () => {
  test("the same source one directory away is silent", async () => {
    const source = "const n = rows.count();\nconst all = rows.all();\n";
    expect(await firesAt(source, IN_LANE)).toEqual([1, 2]);
    expect(await firesAt(source, OUT_OF_LANE)).toEqual([]);
  });

  test("a product source file is silent too — src has no page under it", async () => {
    expect(await firesAt("export const n = [1, 2].length;\nexport const c = () => undefined;\n", "src/core/probe.ts")).toEqual([]);
  });
});

describe("the lane holds: tests/e2e carries no unretried read", () => {
  test("pnpm exec eslint tests/e2e reports no cubit/no-unretried-read", async () => {
    const results = await linter.lintFiles([join(REPO_ROOT, "tests", "e2e")]);
    const offending = results.flatMap((result) =>
      result.messages.filter((message) => message.ruleId === RULE_ID).map((message) => `${result.filePath.slice(REPO_ROOT.length + 1)}:${message.line}`),
    );
    expect(offending, "a journey or page object reads the page once where it owes a retrying wait (AM-09 §4, B-19)").toEqual([]);
  }, 180_000);
});
