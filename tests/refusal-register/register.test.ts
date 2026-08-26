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
import { exercisedNames, isExecutedTest, scanRefusals, unadmittedCodes } from "./scan";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PRODUCT_SOURCE = join(REPO_ROOT, "src");
const TEST_TREE = join(REPO_ROOT, "tests");
const FIXTURES = join(REPO_ROOT, "tests", "refusal-register", "fixtures");

/** The two foreign names AC-2 (c) names, spelled by the seams that speak those vocabularies. */
const FOREIGN_NAMES = ["INTERNAL_SERVER_ERROR", "DATABASE_URL"];

/** The table itself, which spells every name it declares — so it never counts as a seam speaking one. */
const VOCABULARY_FILE = "src/core/errors/transport-vocabulary.ts";

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
      // The table spells its own declarations, so it would satisfy the assertion above all by
      // itself. What is being proved is that a seam speaks the name and the declaration answers for
      // it — a declaration nothing spells is dead amnesty, not a vocabulary (Q-07).
      const spokenAt = foreign.filter((finding) => finding.code === name && finding.file !== VOCABULARY_FILE);
      expect(
        spokenAt.map((finding) => finding.file),
        `${name} is declared foreign but only ${VOCABULARY_FILE} spells it — the declaration is answering for nobody`,
      ).not.toEqual([]);
    }
  });

  test("AC-2 (d): every registered code is exercised by name, or deferred by name with an owner", async () => {
    const spoken = await exercisedNames([PRODUCT_SOURCE, TEST_TREE]);
    const unadmitted = unadmittedCodes(Object.keys(REFUSALS), spoken, DEFERRED_CODES);
    expect(
      unadmitted,
      `registered but no executed test names it and no deferral owns it: ${unadmitted.join(", ")} — exercise it, or defer it by name to the increment that will (Q-07)`,
    ).toEqual([]);
  });

  test("AC-2 (d): the deferral branch is what admits SIGNED_OUT when nothing names it — and nothing else does", () => {
    // The live corpus happens to name SIGNED_OUT, so on the tree the exercise branch answers first
    // and the deferral is never asked. Asked of a corpus that names nothing, the deferral is the
    // only thing that can admit — which is the mechanism the spec says SIGNED_OUT proves.
    const namesNothing = new Map<string, readonly string[]>();
    expect(
      unadmittedCodes(["SIGNED_OUT"], namesNothing, DEFERRED_CODES),
      "SIGNED_OUT is admitted by its named deferral even when no executed test names it (Q-07)",
    ).toEqual([]);
    expect(
      unadmittedCodes(["SIGNED_OUT"], namesNothing, {}),
      "and with neither an exercise nor a deferral, the same code fails the register — the branch is real, not decorative",
    ).toEqual(["SIGNED_OUT"]);
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

  test("AC-2 (d): \"executed\" is answered by the lane's own collection rules, not by a list of directories", () => {
    const at = (path: string): boolean => isExecutedTest(join(REPO_ROOT, path));
    expect(at("tests/ui/refusal-state/in-dialog.test.ts"), "a suite the lane's include collects exercises the names it spells").toBe(true);
    expect(at("src/core/errors/taxonomy.test.ts"), "a suite beside the module it judges is collected too").toBe(true);
    // The lane's include is .test.ts / .test.tsx only, so a .test.mts is a file nothing runs — and
    // a name in a lane nothing runs exercises nothing (Q-07).
    expect(at("tests/probe.test.mts"), "no lane collects a .test.mts, so it exercises nothing").toBe(false);
    for (const dropped of ["tests/lint-fixtures/some-rule/bad.test.ts", "tests/e2e/j-000.test.ts"]) {
      expect(at(dropped), `${dropped} is dropped by the lane's own exclude, so nothing runs it`).toBe(false);
    }
    expect(at("tests/refusal-register/register.test.ts"), "the register does not exercise the codes it names — the question would answer itself").toBe(false);
    expect(at("src/core/format.ts"), "a module is not a test").toBe(false);
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
      "a lawful spelling raises no finding, whether the register is reached relatively or through the `@/` alias — otherwise every lawful spelling in the tree would raise one",
    ).toEqual([]);
  });

  test("AC-3: a code painted as JSX text or written as an unquoted key is spelled — quoting is typography (Q-07)", async () => {
    // Written outside the tree for the same reason as the assembled spelling above: this is the
    // shape of a screen-local refusal block, which R-UI-020 calls a defect, so the tree keeps none.
    const scratch = mkdtempSync(join(tmpdir(), "cubit-refusal-shapes-"));
    try {
      writeFileSync(
        join(scratch, "painted.tsx"),
        [
          "export const Block = (): JSX.Element => <span>FIXTURE_PAINTED_CODE</span>;",
          "export const table = { FIXTURE_KEYED_CODE: \"a screen-local message\" };",
          "",
        ].join("\n"),
        "utf8",
      );
      const { orphans } = await scanRefusals(scratch);
      expect(
        codesIn(orphans).sort(),
        "a name a screen paints, and a name written as a bare key, are spellings the register must answer for (Q-07)",
      ).toEqual(["FIXTURE_KEYED_CODE", "FIXTURE_PAINTED_CODE"]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});
