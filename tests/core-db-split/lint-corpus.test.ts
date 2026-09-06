// @vitest-environment node
/**
 * Public acceptance for AC-3 of the db module split (SEAM-TENANT, Q-08).
 *
 * The one-driver ban widens from a single file to the seam's product directory, and a widened ban is
 * only as good as the corpus that pins its edges: the fixtures are put through the product's own
 * flat config exactly as `tests/toolchain/lint-law.test.ts` puts the whole corpus through it — the
 * real fixture paths are ignored by that config, so `lintText` at a virtual path is the only surface
 * that can see them (the layered path is read from the last `src/` segment, ARCH-01).
 *
 * A "lints clean" assertion passes on a tree where nothing is banned at all, so the lawful fixture is
 * never judged alone: the same bytes are linted a second time at a path the ban still covers, and
 * must be refused there for the driver, the schema import and the ORM's internals alike. That pairing
 * is what makes the silence at `src/core/db/good.ts` mean the allowlist, not an absent rule.
 *
 * The corpus that was already committed is judged twice over too — by the bytes it is made of, which
 * this increment may not touch, and by what the config still reports for it.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CORPUS = "tests/lint-fixtures/no-db-outside-seam";
const RULE = "cubit/no-db-outside-seam";
const MARKER = "RECORDED REASON";

/** The message ids the ban reports, so a payload can be proved to carry all three constructs. */
const MESSAGE_IDS = ["driver", "schema", "internal"] as const;

/** The fixture the widened allowlist is proved on, and the one that proves the seam's tests are not in it. */
const NEW_FIXTURES = {
  good: { path: `${CORPUS}/allowed/src/core/db/good.ts`, virtualPath: "src/core/db/good.ts" },
  bad: { path: `${CORPUS}/src/core/db/__tests__/bad.ts`, virtualPath: "src/core/db/__tests__/bad.ts" },
} as const;

/**
 * The corpus this increment inherits, frozen by the bytes it has on main: AC-3 says these four are
 * unchanged, and a digest is the only reading of "unchanged bytes" that a rewrite cannot talk its
 * way past. A later increment that genuinely re-writes one of these owns this line with it (B-20).
 */
const UNCHANGED = [
  { path: `${CORPUS}/allowed/src/core/db.ts`, sha256: "2419424feeeec1f01c0a05d22e409741b9bdfb04df81de5deac8ccbf0b9b0c67", virtualPath: "src/core/db.ts", refused: false },
  { path: `${CORPUS}/allowed/src/core/good.ts`, sha256: "fc8314ca23ae323d9bf73b36c939c223c0af2bf80f0e452d71888f44b5c82c17", virtualPath: "src/core/good.ts", refused: false },
  { path: `${CORPUS}/src/modules/billing/bad.ts`, sha256: "505b32651419d7d08d67053fbafd25ec31d04e94ef1b4efb3139f3bd451814a7", virtualPath: "src/modules/billing/bad.ts", refused: true },
  { path: `${CORPUS}/src/modules/billing/good.ts`, sha256: "9b9531dc7f5e2ed2d2a3ea403fcd7accbf9691a7c4ef869828d76cd296fef287", virtualPath: "src/modules/billing/good.ts", refused: false },
] as const;

let linter: ESLint;

/** A fixture's bytes, asserted to be there at all so a fixture the corpus owes names itself. */
function fixtureSource(relative: string): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the corpus — the widened ban has nothing proving it`).toBe(true);
  return readFileSync(abs, "utf8");
}

/** What the product's own config reports for this source read at this layered path. */
async function lintAs(source: string, virtualPath: string): Promise<Linter.LintMessage[]> {
  const results = await linter.lintText(source, { filePath: join(REPO_ROOT, virtualPath) });
  return results.flatMap((result) => result.messages);
}

/** The ban's messages only — an unrelated rule firing is another suite's business. */
function banned(messages: Linter.LintMessage[]): Linter.LintMessage[] {
  return messages.filter((message) => message.ruleId === RULE);
}

/** What was reported, most useful first in a failure message. */
function reported(messages: Linter.LintMessage[]): string {
  if (messages.length === 0) return "nothing";
  return messages.map((message) => `${message.ruleId ?? "(parse)"}@${message.line}`).join(", ");
}

beforeAll(async () => {
  const loaded: unknown = await import(pathToFileURL(join(REPO_ROOT, "eslint.config.mjs")).href);
  const config = (loaded as { default: Linter.Config[] }).default;
  expect(Array.isArray(config), "eslint.config.mjs does not default-export a flat config array").toBe(true);
  linter = new ESLint({ cwd: REPO_ROOT, overrideConfigFile: true, overrideConfig: config });
}, 120_000);

describe("AC-3: the one-driver ban widens to the seam's directory", () => {
  test("AC-3: the lawful fixture lints clean at src/core/db/good.ts", async () => {
    const messages = await lintAs(fixtureSource(NEW_FIXTURES.good.path), NEW_FIXTURES.good.virtualPath);
    expect(messages, `the seam's product directory is still refused its own driver — reported ${reported(messages)}`).toEqual([]);
  });

  test("AC-3: the lawful fixture is a real payload — the same bytes are refused outside the seam", async () => {
    // The control: silence above must be the allowlist speaking, not a fixture with nothing in it.
    const messages = await lintAs(fixtureSource(NEW_FIXTURES.good.path), "src/modules/billing/probe.ts");
    const ids = new Set(banned(messages).map((message) => message.messageId));
    const absent = MESSAGE_IDS.filter((id) => !ids.has(id));
    expect(absent, "the lawful fixture does not carry the driver, schema and internals constructs the allowlist has to grant").toEqual([]);
  });

  test("AC-3: the seam's own __tests__ path is still refused", async () => {
    const messages = await lintAs(fixtureSource(NEW_FIXTURES.bad.path), NEW_FIXTURES.bad.virtualPath);
    expect(banned(messages).length, `${RULE} stayed silent under the seam's __tests__ — reported ${reported(messages)}`).toBeGreaterThan(0);
    const ids = new Set(banned(messages).map((message) => message.messageId));
    const absent = MESSAGE_IDS.filter((id) => !ids.has(id));
    expect(absent, "the refused fixture proves only part of the ban under src/core/db/__tests__/").toEqual([]);
  });

  test("AC-3: every line the corpus's refused fixture reports carries its recorded reason (Q-08)", async () => {
    const source = fixtureSource(NEW_FIXTURES.bad.path);
    const lines = source.split("\n");
    const messages = await lintAs(source, NEW_FIXTURES.bad.virtualPath);
    expect(messages.length, "nothing was reported at all, so the marker check would pass by not looking").toBeGreaterThan(0);
    const unmarked = messages
      .filter((message) => !(lines[message.line - 1] ?? "").includes(MARKER))
      .map((message) => `${message.line} (${message.ruleId ?? "parse error"}): ${(lines[message.line - 1] ?? "").trim()}`);
    expect(unmarked, `a deliberate payload sits on a line with no '// ${MARKER} <CODE>' marker — lint-law reds on it`).toEqual([]);
  });

  test.each(UNCHANGED)("AC-3: $path is byte-unchanged", ({ path, sha256 }) => {
    const digest = createHash("sha256").update(fixtureSource(path), "utf8").digest("hex");
    expect(digest, `${path} was rewritten — the corpus this increment inherits is not its to change`).toBe(sha256);
  });

  test.each(UNCHANGED)("AC-3: $path still lints as it did at $virtualPath", async ({ path, virtualPath, refused }) => {
    const messages = await lintAs(fixtureSource(path), virtualPath);
    if (refused) {
      const ids = new Set(banned(messages).map((message) => message.messageId));
      expect(MESSAGE_IDS.filter((id) => !ids.has(id)), `${path} no longer reports the whole ban — reported ${reported(messages)}`).toEqual([]);
    } else {
      expect(messages, `${path} is lawful code and was refused — reported ${reported(messages)}`).toEqual([]);
    }
  });
});
