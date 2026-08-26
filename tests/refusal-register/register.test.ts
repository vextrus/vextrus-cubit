/**
 * The refusal register (Q-07): every code exercised by name or deferred by name, no orphan codes,
 * and the three findings told apart.
 *
 * The scan's semantics are law, so this file proves them twice over: on the product tree, where all
 * three answers must be the lawful ones, and on the declared fixture corpus, where each finding is
 * shown to actually fire on source planted to earn it. A scan proved only against a clean tree
 * proves nothing — it would pass while blind.
 *
 * Nothing here transcribes the roster (B-19): the questions are asked of whatever `REFUSALS` holds,
 * so a code registered later is judged by this file without an edit.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import { TRANSPORT_VOCABULARY } from "../../src/core/errors/transport-vocabulary";
import { DEFERRED_CODES } from "./deferrals";
import { exercisedNames, scanRefusals } from "./scan";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PRODUCT_SOURCE = join(REPO_ROOT, "src");
const TEST_TREE = join(REPO_ROOT, "tests");
const FIXTURES = join(REPO_ROOT, "tests", "refusal-register", "fixtures");

/** The two foreign names AC-2 (c) names, spelled by the seams that speak those vocabularies. */
const FOREIGN_NAMES = ["INTERNAL_SERVER_ERROR", "DATABASE_URL"];

/** The registered code the unwired fixture spells without reading the register. */
const FIXTURE_REGISTERED = "PRECISION_NOT_APPLIED";

/** The unregistered, undeclared code the orphan fixture plants. */
const FIXTURE_ORPHAN = "FIXTURE_ORPHAN_CODE";

const codesIn = (findings: ReadonlyArray<{ code: string }>): string[] => findings.map((finding) => finding.code);

const shown = (findings: ReadonlyArray<{ code: string; file: string }>): string =>
  findings.length === 0 ? "none" : findings.map((finding) => `${finding.code} in ${finding.file}`).join(", ");

describe("Q-07: the register against the product tree", () => {
  test("AC-2 (a): no orphan codes — every refusal-shaped name in src is registered or declared", async () => {
    const { orphans } = await scanRefusals(PRODUCT_SOURCE);
    expect(
      orphans,
      `a refusal-shaped code is spelled in product source that the registry lacks and no vocabulary declares: ${shown(orphans)} — register it in src/core/errors.ts, or declare its vocabulary (Q-07)`,
    ).toEqual([]);
  });

  test("AC-2 (b): no registered code is spelled but not wired — a file that spells one reads the register", async () => {
    const { unwired } = await scanRefusals(PRODUCT_SOURCE);
    expect(
      unwired,
      `a registered code is spelled as a bare literal by a file that does not import src/core/errors: ${shown(unwired)} — the spelling agrees with the taxonomy by coincidence, not by reading it (Q-07)`,
    ).toEqual([]);
  });

  test("AC-2 (c): the transport vocabulary is what tells foreign from orphan", async () => {
    const { foreign, orphans } = await scanRefusals(PRODUCT_SOURCE);
    for (const name of FOREIGN_NAMES) {
      expect(codesIn(foreign), `${name} is spelled in src and answers "foreign, declared" (Q-07)`).toContain(name);
      expect(codesIn(orphans), `${name} is declared foreign, so it is never read as an orphan (Q-07)`).not.toContain(name);
    }
  });

  test("AC-2 (d): every registered code is exercised by name, or deferred by name with an owner", async () => {
    const spoken = await exercisedNames([PRODUCT_SOURCE, TEST_TREE]);
    for (const code of Object.keys(REFUSALS)) {
      const exercised = spoken.get(code) ?? [];
      const deferral = DEFERRED_CODES[code] ?? "";
      expect(
        exercised.length > 0 || deferral.trim().length > 0,
        `${code} is registered but no executed test names it and no deferral owns it — exercise it, or defer it by name to the increment that will (Q-07)`,
      ).toBe(true);
    }
  });

  test("AC-2 (d): a deferral names a registered code and states its owner — SIGNED_OUT proves the mechanism", async () => {
    const registered = Object.keys(REFUSALS);
    for (const [code, owner] of Object.entries(DEFERRED_CODES)) {
      expect(registered, `"${code}" is deferred but is not a registered refusal — a deferral defers a code the taxonomy holds`).toContain(code);
      expect(owner.trim().length, `"${code}" is deferred to nobody — a deferral names the owner who will exercise it (Q-07)`).toBeGreaterThan(0);
    }
    expect(
      Object.keys(DEFERRED_CODES),
      "SIGNED_OUT is deferred to the increment that maps an expired session (ARCH-03, B-21) — the deferral half of Q-07 is exercised, not merely available",
    ).toContain("SIGNED_OUT");
  });

  test("AC-2: no name is both registered and declared foreign — the scan is never asked to choose", async () => {
    const registered = new Set(Object.keys(REFUSALS));
    for (const entry of TRANSPORT_VOCABULARY) {
      for (const code of entry.codes) {
        expect(registered.has(code), `"${code}" is declared by vocabulary "${entry.vocabulary}" and also registered as a refusal (Q-07)`).toBe(false);
      }
    }
  });
});

describe("Q-07: the scan's three findings, each proved to fire", () => {
  test("AC-3: an unregistered, undeclared code is an orphan — and only an orphan", async () => {
    const { orphans, unwired, foreign } = await scanRefusals(join(FIXTURES, "orphan"));
    expect(codesIn(orphans), "the planted code belongs to no registry and no vocabulary").toEqual([FIXTURE_ORPHAN]);
    expect(orphans[0]?.file, "the finding names the file that spells it").toContain("planted-orphan.ts");
    expect(codesIn(unwired), "an orphan is not a wiring failure — it is a code the law does not hold").toEqual([]);
    expect(codesIn(foreign), "an orphan is not foreign — no vocabulary declares it").toEqual([]);
  });

  test("AC-3: a registered code spelled without the register is spelled-but-not-wired — and only that", async () => {
    const { orphans, unwired, foreign } = await scanRefusals(join(FIXTURES, "unwired"));
    expect(codesIn(unwired), "a registered code spelled by a file that does not read the register").toEqual([FIXTURE_REGISTERED]);
    expect(unwired[0]?.file, "the finding names the file that spells it").toContain("spelled-not-wired.ts");
    expect(codesIn(orphans), "a registered code is never an orphan, wired or not").toEqual([]);
    expect(codesIn(foreign), "a registered code is the product's own, never foreign").toEqual([]);
  });

  test("AC-3: a declared transport code is foreign, and never an orphan", async () => {
    const { orphans, unwired, foreign } = await scanRefusals(join(FIXTURES, "foreign"));
    expect(codesIn(foreign), "the vocabulary table answers for the transport's own code").toEqual(["INTERNAL_SERVER_ERROR"]);
    expect(foreign[0]?.file, "the finding names the file that spells it").toContain("declared-transport.ts");
    expect(codesIn(orphans), "a declared foreign name is never an orphan — that is what declaring it is for (Q-07)").toEqual([]);
    expect(codesIn(unwired), "a foreign name is not the register's to be wired to").toEqual([]);
  });

  test("AC-3: a code assembled from static parts is the same spelling — no evasion idiom exists (Q-07)", async () => {
    // Written outside the tree: the point is a spelling nobody would ever commit, and a fixture
    // corpus is for source the tree keeps.
    const scratch = mkdtempSync(join(tmpdir(), "cubit-refusal-scan-"));
    try {
      writeFileSync(
        join(scratch, "assembled.ts"),
        ['export const JOINED = "FIXTURE" + "_ASSEMBLED_CODE";', 'export const WOVEN = `FIXTURE_${"WOVEN"}_CODE`;', ""].join("\n"),
        "utf8",
      );
      const { orphans } = await scanRefusals(scratch);
      expect(
        codesIn(orphans).sort(),
        "a name written in parts is the name it spells — assembling it hides it from nothing (Q-07)",
      ).toEqual(["FIXTURE_ASSEMBLED_CODE", "FIXTURE_WOVEN_CODE"]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test("AC-3: the control — a registered code spelled by a file that reads the register finds nothing", async () => {
    const scan = await scanRefusals(join(FIXTURES, "wired"));
    expect(
      [...scan.orphans, ...scan.unwired, ...scan.foreign],
      "a lawful spelling raises no finding — otherwise every lawful spelling in the tree would raise one",
    ).toEqual([]);
  });
});
