/**
 * AC-2: MEMBER_HAS_ACTS, registered and wired (R-SPINE-062, Q-07).
 *
 * The copy this increment fixes is not decoration: inc-010a2's Design Decision quotes it verbatim,
 * so the message and the remedy are pinned here word for word — that is the one thing about an
 * entry a later increment may not quietly re-author (R-UI-020, ARCH-02). Everything else is asked
 * of the register and of the tree's own scan rather than transcribed (B-19): whichever severities
 * and surfaces the taxonomy uses, whichever files spell the code, whichever lane collects the test
 * that names it.
 *
 * Q-07's three questions are answered by Q-07's own scan (tests/refusal-register/scan.ts), because
 * the semantics of "orphan", "spelled but not wired" and "exercised" have one home and this file is
 * not a second one (ARCH-02). What is added here is the part that is about THIS code: its copy, and
 * the co-located test the increment owes it in a lane that really runs.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REFUSALS, refusalOf } from "../../src/core/errors";
import { DEFERRED_CODES } from "../refusal-register/deferrals";
import { exercisedNames, isExecutedTest, scanRefusals } from "../refusal-register/scan";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PRODUCT_SOURCE = join(REPO_ROOT, "src");
const TEST_TREE = join(REPO_ROOT, "tests");

/** The code this increment registers, and the module that owes both its constructor and its exercise. */
const CODE = "MEMBER_HAS_ACTS";
const REMOVAL_MODULE = "src/modules/spine/tenancy/removal";
const EXERCISE_DIR = `${REMOVAL_MODULE}/__tests__`;

/** The copy this spec fixes verbatim, so the Design Decision that quotes it has something to quote. */
const MESSAGE = "This member holds recorded acts on open campaigns, so their membership was not removed.";
const REMEDY = "Remove them once those campaigns close — the record keeps its author until then.";
const SEVERITY = "error";
const SURFACE = "inline";

/** The registry as a plain bag, so a code that is not yet registered is a missing entry and not a type error. */
type Entry = { code: string; message: string; remedy: string; severity: string; surface: string };
const registry = REFUSALS as unknown as Readonly<Record<string, Entry | undefined>>;
const accessor = refusalOf as unknown as (code: string) => Entry;

const SOURCE = /\.(?:ts|tsx|mts)$/;

/** Every non-test source file of a directory tree. */
function sourceFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") found.push(...sourceFilesUnder(path));
    } else if (SOURCE.test(entry.name) && !entry.name.endsWith(".d.ts") && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

describe("AC-2: MEMBER_HAS_ACTS is registered with the copy this spec fixes, and wired where it is spelled", () => {
  it("AC-2: the register holds the entry, word for word, frozen like every other entry", () => {
    const entry = registry[CODE];
    expect(
      entry,
      `${CODE} must be registered in src/core/errors.ts — the taxonomy is closed, so a code that is not there does not exist (R-SPINE-062, B-06)`,
    ).toBeDefined();
    expect(entry?.code, `${CODE}'s entry carries its own key as its code, so a seam reads the value off the register instead of re-spelling it (Q-07)`).toBe(CODE);
    expect(
      entry?.message,
      `${CODE}'s message is fixed verbatim by this increment so inc-010a2's Design Decision can quote it rather than re-author it (R-UI-020, ARCH-02)`,
    ).toBe(MESSAGE);
    expect(entry?.remedy, `${CODE}'s remedy is fixed verbatim for the same reason — one sentence beginning with the verb that resolves it`).toBe(REMEDY);
    expect(entry?.severity, `${CODE} is refused and needs correction, so its severity reads as an error (R-SPINE-062)`).toBe(SEVERITY);
    expect(entry?.surface, `${CODE} answers beside the member it was refused for, so the one renderer places it inline (R-UI-020)`).toBe(SURFACE);

    // Frozen as a rule about the register rather than about this entry: every entry it holds is
    // frozen, and the appended one is not the exception.
    for (const [code, held] of Object.entries(registry)) {
      expect(Object.isFrozen(held), `${code}'s entry is frozen — a refusal read at a transport or a screen is the registered answer, never a mutated one`).toBe(true);
    }
    expect(accessor(CODE), `refusalOf("${CODE}") answers the registered entry — the accessor admits the code the register holds`).toBe(entry);
  });

  it("AC-2: the removal module spells the code, and every file in src that spells it reads the register", async () => {
    const home = join(REPO_ROOT, REMOVAL_MODULE);
    expect(existsSync(home), `${REMOVAL_MODULE}/ is missing — the refusal constructor this code answers through lives there`).toBe(true);

    const spelling = sourceFilesUnder(home).filter((file) => readFileSync(file, "utf8").includes(CODE));
    expect(
      spelling.map((file) => relative(REPO_ROOT, file).split("\\").join("/")),
      `no product file under ${REMOVAL_MODULE}/ spells ${CODE} — the coupling's refusal is built on refusalOf("${CODE}") there (Q-07, ARCH-02)`,
    ).not.toEqual([]);

    // Q-07's own scan decides "orphan" and "spelled but not wired": its semantics are law, and this
    // file asks them rather than restating them (ARCH-02).
    const { orphans, unwired } = await scanRefusals(PRODUCT_SOURCE);
    expect(
      orphans.filter((finding) => finding.code === CODE).map((finding) => finding.file),
      `${CODE} is spelled in product source and the register lacks it — register it in src/core/errors.ts (Q-07)`,
    ).toEqual([]);
    expect(
      unwired.filter((finding) => finding.code === CODE).map((finding) => finding.file),
      `${CODE} is spelled as a bare literal by a file that does not import src/core/errors — the spelling agrees with the taxonomy by coincidence rather than by reading it (Q-07)`,
    ).toEqual([]);
  });

  it("AC-2: an executed test beside the removal module names the code, and no deferral stands in for it", async () => {
    const spoken = await exercisedNames([PRODUCT_SOURCE, TEST_TREE]);
    const namedBy = spoken.get(CODE) ?? [];
    expect(
      namedBy,
      `no executed test names ${CODE} — a name in a comment, or in a lane nothing runs, exercises nothing (Q-07)`,
    ).not.toEqual([]);

    const colocated = namedBy.filter((file) => file.startsWith(`${EXERCISE_DIR}/`));
    expect(
      colocated,
      `${CODE} is named by ${namedBy.join(", ")}, but by nothing under ${EXERCISE_DIR}/ — the increment that registers a code names it in a co-located test the day it registers, so the register records no orphan (Q-07)`,
    ).not.toEqual([]);
    for (const file of colocated) {
      expect(
        isExecutedTest(join(REPO_ROOT, file)),
        `${file} names ${CODE} but no armed lane collects it — "exercised" means named in a test an executed lane runs (Q-07)`,
      ).toBe(true);
    }

    expect(
      Object.keys(DEFERRED_CODES),
      `${CODE} is exercised by the test above, so it is not deferred — a deferral is what accounts for a code nothing names, never a licence beside one that is named (Q-07)`,
    ).not.toContain(CODE);
  });
});
