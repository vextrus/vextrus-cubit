// @vitest-environment jsdom
/**
 * AC-2 — the roster of hook modules the split owes, what each one publishes, that every hook the
 * directory holds is judged by a unit test beside its siblings, and that the address writer kept its
 * one home (B-17): nothing under `hooks/` writes history itself.
 *
 * The roster below is the criterion's own enumeration — it is what AC-2 fixes, so it is stated once
 * here — while the test-per-hook reading is taken from the directory as it stands at test time, so a
 * tenth hook is owed a test the moment it exists rather than the moment somebody remembers (B-19).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { productModule, repoRoot } from "../support/viewer-support";

/** The home the concerns moved to, and the home their unit tests moved to beside it. */
const HOOKS_HOME = "src/modules/takeoff/viewer/hooks";
const HOOK_TESTS_HOME = "tests/takeoff/viewer/hooks";

/** AC-2's roster: the module the split owes, and the hook that module publishes. */
const OWED: readonly (readonly [string, string])[] = [
  ["use-manifest.ts", "useManifest"],
  ["use-layers.ts", "useLayers"],
  ["use-painter.ts", "usePainter"],
  ["use-camera.ts", "useCamera"],
  ["use-hit-testing.ts", "useHitTesting"],
  ["use-selection.ts", "useSelection"],
  ["use-reveal.ts", "useReveal"],
  ["use-pointer.ts", "usePointer"],
  ["use-keyboard.ts", "useKeyboard"],
];

/** The one module that writes the address, and the call that makes it that module (B-17). */
const ADDRESS_WRITE = "replaceState";

/** Every file under the hooks home, at any depth. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** The hooks home, asserted present first so a missing split reads as the absence it is. */
function hooksHome(): string {
  const home = join(repoRoot(), HOOKS_HOME);
  expect(existsSync(home), `${HOOKS_HOME}/ is missing from the tree — the product does not provide it yet`).toBe(true);
  return home;
}

describe("AC-2: one concern per module, one unit test per module, one home for the address", () => {
  test("AC-2: every hook module the split owes exists and publishes its hook", async () => {
    for (const [module, hook] of OWED) {
      const published = await productModule<Record<string, unknown>>(`${HOOKS_HOME}/${module}`);
      expect(typeof published[hook], `${HOOKS_HOME}/${module} exports ${hook}`).toBe("function");
    }
  });

  test("AC-2: every hook module the directory holds is judged by a unit test of its own", () => {
    const modules = readdirSync(hooksHome()).filter((entry) => /^use-[a-z0-9-]+\.ts$/.test(entry));
    expect(modules.length, `${HOOKS_HOME}/ holds the hook modules the concerns moved into`).toBeGreaterThanOrEqual(OWED.length);

    for (const module of modules) {
      const beside = `${HOOK_TESTS_HOME}/${module.replace(/\.ts$/, ".test.tsx")}`;
      expect(existsSync(join(repoRoot(), beside)), `${HOOKS_HOME}/${module} is judged by ${beside}`).toBe(true);
    }
  });

  test("AC-2: no hook writes the address — that stays in the screen's own address module", () => {
    // white-box: AC-2 — "the address writer keeps its one home" is a claim about what the files
    // under hooks/ may contain, and a hook that never writes history proves nothing by running.
    const offenders = filesUnder(hooksHome()).filter((path) => readFileSync(path, "utf8").includes(ADDRESS_WRITE));
    expect(offenders, `${ADDRESS_WRITE} has one home, and it is not under ${HOOKS_HOME}/ (B-17)`).toEqual([]);
  });
});
