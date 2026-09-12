// THE REGISTRY IS A NODE-SIDE DECLARATION, AND `page.evaluate` RUNS IN THE BROWSER.
//
// AM-09 §1 makes `src/ui/testids.ts` the single source of every test id, and the v22 migration
// replaced the tree's literal `data-testid="…"` strings with reads of that registry. Inside a
// Playwright `evaluate` callback that read is a runtime fault, not a style question: the callback
// is serialised and run in the page, where nothing named `TESTIDS` or `testIdSelector` exists, and
// the journey dies with `ReferenceError: testIdSelector is not defined` — seven specs did, and the
// unit lane could not see it because no unit test runs a browser.
//
// The lawful shape is to resolve the selector in node and hand it in as the evaluate ARGUMENT:
//
//   const selector = testIdSelector(TESTIDS.shell.user);
//   await page.evaluate((selector) => document.querySelector(selector), selector);
//
// So this scans the callback bodies themselves — balanced parentheses from the call, not a line
// grep — and refuses any registry reference inside one.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const TESTS = join(REPO_ROOT, "tests");

/** The calls whose callback is serialised and run inside the page, never in node. */
const IN_PAGE = /\.(evaluate|evaluateAll|evaluateHandle|waitForFunction|addInitScript)\(/g;

/** Every `.ts`/`.tsx` file under tests/, in a stable order. */
function sources(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) return entry === "lint-fixtures" ? [] : sources(abs);
      // This file's own planted fixtures are strings that spell the offence so the scan can be
      // shown to see it — a check that may not name what it bans cannot say what it is for.
      if (entry === "no-registry-in-evaluate.test.ts") return [];
      return /\.tsx?$/.test(entry) ? [abs] : [];
    });
}

/** The text of the call's argument list, read by balancing parentheses from the opening one. */
function argumentsOf(source: string, openAt: number): string {
  let depth = 0;
  for (let at = openAt; at < source.length; at += 1) {
    if (source[at] === "(") depth += 1;
    else if (source[at] === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(openAt, at + 1);
    }
  }
  return source.slice(openAt);
}

/**
 * The callback, without the trailing arguments handed to the page. Everything after the LAST
 * top-level comma is the argument the browser receives, and resolving the selector there is exactly
 * the lawful shape — so it is cut before the body is judged.
 */
function callbackOf(args: string): string {
  // A trailing comma before the closing paren is not a separator — cut it first, or the "last
  // top-level comma" is the trailing one and the whole argument list reads as the callback.
  const body = args.slice(1, -1).replace(/,\s*$/, "");
  let depth = 0;
  let lastComma = -1;
  for (let at = 0; at < body.length; at += 1) {
    const char = body[at];
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) lastComma = at;
  }
  return lastComma === -1 ? body : body.slice(0, lastComma);
}

describe("the test-id registry never crosses into the page (AM-09 §1)", () => {
  it("no evaluate/waitForFunction/addInitScript callback references TESTIDS or testIdSelector", () => {
    const offences: string[] = [];
    for (const file of sources(TESTS)) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("TESTIDS") && !source.includes("testIdSelector")) continue;
      IN_PAGE.lastIndex = 0;
      let call = IN_PAGE.exec(source);
      while (call !== null) {
        const callback = callbackOf(argumentsOf(source, call.index + call[0].length - 1));
        if (/\bTESTIDS\b|\btestIdSelector\b/.test(callback)) {
          const line = source.slice(0, call.index).split("\n").length;
          offences.push(`${file.slice(REPO_ROOT.length + 1)}:${line} — .${call[1]}()`);
        }
        call = IN_PAGE.exec(source);
      }
    }
    expect(
      offences,
      `these callbacks run in the BROWSER, where the registry does not exist — resolve the selector in node and hand it in as the evaluate argument:\n  ${offences.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the scan can see an offence — it is not a grep that passes because it matches nothing", () => {
    const planted = 'await page.evaluate(() => document.querySelector(testIdSelector(TESTIDS.shell.user)), "unused");';
    const at = planted.indexOf(".evaluate(") + ".evaluate".length;
    expect(/\bTESTIDS\b|\btestIdSelector\b/.test(callbackOf(argumentsOf(planted, at))), "a registry read inside the callback is seen").toBe(true);

    const lawful = 'await page.evaluate((selector) => document.querySelector(selector), testIdSelector(TESTIDS.shell.user));';
    const lawfulAt = lawful.indexOf(".evaluate(") + ".evaluate".length;
    expect(/\bTESTIDS\b|\btestIdSelector\b/.test(callbackOf(argumentsOf(lawful, lawfulAt))), "the same read as the ARGUMENT is the lawful shape and is not flagged").toBe(false);
  });
});
