// AM-09 §1's registry has teeth, and this is the ratchet on the one place the teeth cannot close.
//
// `cubit/no-literal-testid` is an ERROR across the tree. It is a WARNING under `src/modules/**` for
// one reason and not for convenience: ARCH-01 forbids `src/modules/*` importing `src/ui`, and the
// registry lives at `src/ui/testids.ts`, so those four takeoff screens cannot read the key they
// should read. A warning with no floor is how a debt becomes a habit, so the count is frozen here:
// it may fall, never rise. The repair is a home, not a suppression — the ids these module screens
// publish belong where a module may lawfully reach them, and M3's UI-foundation increment (AM-08)
// is where the screens and their ids land together.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const MODULES = join(REPO_ROOT, "src", "modules");

/** The literal `data-testid="…"` spellings left in the tree, by file. */
function literalsUnder(dir: string): { file: string; count: number }[] {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) return literalsUnder(abs);
      if (!/\.tsx?$/.test(entry)) return [];
      const count = (readFileSync(abs, "utf8").match(/data-testid="[^"$]*"/g) ?? []).length;
      return count === 0 ? [] : [{ file: abs.slice(REPO_ROOT.length + 1), count }];
    });
}

/**
 * THE FROZEN COUNT. Lower it when a site migrates; it is never raised. Raising it is the change
 * this test exists to refuse, and a reviewer who sees this number go up is seeing the debt grow.
 */
const FROZEN = 75;

describe("AM-09 §1: the test-id registry's ratchet over the sites ARCH-01 blocks", () => {
  it(`src/modules carries no more than ${FROZEN} literal test ids, and the number only falls`, () => {
    const found = literalsUnder(MODULES);
    const total = found.reduce((sum, entry) => sum + entry.count, 0);
    const detail = found.map((entry) => `  ${entry.count}\t${entry.file}`).join("\n");
    expect(total, `literal test ids under src/modules rose above the frozen count — every new id reads the registry (AM-09 §1):\n${detail}`).toBeLessThanOrEqual(FROZEN);
    expect(
      total,
      `literal test ids under src/modules fell to ${total}: lower FROZEN to ${total} in this file, so the ratchet holds the ground that was won\n${detail}`,
    ).toBe(FROZEN);
  });

  it("nothing outside src/modules spells a literal test id — there the rule is an error, not a ratchet", () => {
    const elsewhere = ["src/app", "src/ui", "src/server", "src/core", "src/worker"]
      .flatMap((dir) => {
        try {
          return literalsUnder(join(REPO_ROOT, dir));
        } catch {
          return [];
        }
      })
      .filter((entry) => entry.file !== "src/ui/testids.ts" && entry.file !== "src/ui/testids.test.ts")
      // A unit test's own throwaway probe (`data-testid="cb"` on the Checkbox under test) is not an
      // id the product publishes, so the registry's sentence does not reach it and the rule stays
      // silent — see scripts/eslint/rules/no-literal-testid.mjs.
      .filter((entry) => !/\.test\.tsx?$/.test(entry.file) && !entry.file.includes("/__tests__/"));
    expect(elsewhere.map((entry) => `${entry.count}\t${entry.file}`), "a literal test id outside src/modules is an eslint error, so it cannot survive the gate").toEqual([]);
  });

  it("the rule is mounted, and mounted as a warning only where ARCH-01 forces it", () => {
    const config = readFileSync(join(REPO_ROOT, "eslint.config.mjs"), "utf8");
    expect(config, "the rule is an error across the tree").toContain('"cubit/no-literal-testid": "error"');
    const softened = /files:\s*\["src\/modules\/\*\*\/\*\.ts",\s*"src\/modules\/\*\*\/\*\.tsx"\][\s\S]{0,200}?"cubit\/no-literal-testid":\s*"warn"/.test(config);
    expect(softened, "the only softened binding is src/modules, where ARCH-01 forbids reaching the registry").toBe(true);
    expect(config.match(/"cubit\/no-literal-testid":\s*"warn"/g)?.length ?? 0, "one softened binding, not two").toBe(1);
  });
});
