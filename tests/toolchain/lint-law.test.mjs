// AC-3-LINT-NEVERS — the ARCH-01 matrix and the Q-08 NEVERs are rules, proved by the declared
// corpus (each bad.* fires, each good.* twin stays silent) and by synthesised violations on real
// product paths; and `eslint .` on the tree itself is clean (Q-16).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARCH_01_BRANCHES, NEVER_BRANCHES } from "./support/contract.mjs";
import { pnpmRun, readJson, removeTree, repoRoot, scratchTree } from "./support/tree.mjs";

const CORPUS = "tests/lint-fixtures";

/** Every directory of the declared corpus that carries a bad.* payload, at any depth. */
function fixtureDirs(root) {
  const out = [];
  const walk = (abs) => {
    if (!existsSync(abs)) return;
    const entries = readdirSync(abs);
    if (entries.some((e) => /^bad\./.test(e))) out.push(abs);
    for (const e of entries) {
      const child = join(abs, e);
      if (statSync(child).isDirectory()) walk(child);
    }
  };
  walk(join(root, CORPUS));
  return out;
}

const payload = (dir, kind) => {
  const name = readdirSync(dir).find((e) => new RegExp(`^${kind}\\.`).test(e));
  return name ? join(dir, name) : null;
};

/** The alias prefix that maps onto src/, if the tree configures one. */
function srcAlias(root) {
  const tsconfig = readJson(join(root, "tsconfig.json"));
  const paths = tsconfig.compilerOptions?.paths ?? {};
  for (const [pattern, targets] of Object.entries(paths)) {
    if (!pattern.endsWith("/*")) continue;
    const target = (targets ?? []).find((t) => /(^|\/)src\/\*$/.test(t));
    if (target) return pattern.slice(0, -1); // "@/*" -> "@/"
  }
  return null;
}

describe("AC-3-LINT-NEVERS", () => {
  let ESLint;
  let dir;

  beforeAll(async () => {
    ({ ESLint } = await import("eslint"));
    dir = scratchTree("ac3");
  }, 120_000);

  afterAll(() => dir && removeTree(dir));

  const lint = async (root, file) => {
    const eslint = new ESLint({ cwd: root, ignore: false, errorOnUnmatchedPattern: false });
    const [result] = await eslint.lintFiles([file]);
    return result ?? { messages: [], errorCount: 0 };
  };

  it("AC-3-LINT-NEVERS: the corpus carries one bad/good twin per ARCH-01 branch and per NEVER", () => {
    const dirs = fixtureDirs(repoRoot());
    // The contract's declared corpus: twelve ARCH-01 branches plus six NEVERs. A later increment
    // may add branches — never remove one, so this is a floor.
    expect(dirs.length, `the corpus has ${dirs.length} branches; the contract declares ${ARCH_01_BRANCHES.length + NEVER_BRANCHES.length}`).toBeGreaterThanOrEqual(
      ARCH_01_BRANCHES.length + NEVER_BRANCHES.length,
    );
    for (const d of dirs) {
      expect(payload(d, "bad"), `${relative(repoRoot(), d)} has no bad.*`).toBeTruthy();
      expect(payload(d, "good"), `${relative(repoRoot(), d)} has no good.* twin`).toBeTruthy();
      expect(readFileSync(payload(d, "bad"), "utf8"), `${relative(repoRoot(), d)}/bad.* carries no // RECORDED REASON marker (Q-08)`).toMatch(
        /\/\/ RECORDED REASON [A-Z0-9_-]+/,
      );
    }
  });

  it("AC-3-LINT-NEVERS: every bad.* fires a rule and every good.* twin stays silent", async () => {
    for (const d of fixtureDirs(repoRoot())) {
      const name = relative(repoRoot(), d);
      const bad = await lint(repoRoot(), payload(d, "bad"));
      const real = bad.messages.filter((m) => m.ruleId && !m.fatal);
      expect(real.length, `${name}/bad.* fired no rule — the branch is not armed`).toBeGreaterThan(0);
      expect(bad.messages.filter((m) => m.fatal).length, `${name}/bad.* is a parse error, not a flagged construct`).toBe(0);

      const good = await lint(repoRoot(), payload(d, "good"));
      expect(good.messages.filter((m) => m.ruleId || m.fatal), `${name}/good.* must not fire: ${JSON.stringify(good.messages)}`).toEqual([]);
    }
  }, 600_000);

  it("AC-3-LINT-NEVERS: a RECORDED REASON marker exempts nothing outside a declared fixture", async () => {
    const source = fixtureDirs(repoRoot())
      .filter((d) => /any|ts-ignore|ts-expect|eslint-disable/.test(d))
      .map((d) => payload(d, "bad"))
      .find((f) => f && !/from\s+["']\./.test(readFileSync(f, "utf8")));
    expect(source, "no self-contained NEVER fixture to re-site (Q-08 declares one per NEVER)").toBeTruthy();

    const planted = join(dir, "src/core/recorded_reason_probe.ts");
    mkdirSync(dirname(planted), { recursive: true });
    writeFileSync(planted, readFileSync(source, "utf8"));
    try {
      const result = await lint(dir, planted);
      expect(result.messages.filter((m) => m.ruleId && !m.fatal).length, "the marker silenced a NEVER outside the declared corpus (Q-08)").toBeGreaterThan(0);
    } finally {
      rmSync(planted, { force: true });
    }
  }, 120_000);

  it("AC-3-LINT-NEVERS: every ARCH-01 branch fires on a real product path, not only in the corpus", async () => {
    const alias = srcAlias(dir);
    const specifiers = (from, target) => {
      const rel = relative(dirname(join(dir, from)), join(dir, target)).replace(/\\/g, "/");
      const forms = [rel.startsWith(".") ? rel : `./${rel}`, target];
      if (alias) forms.push(`${alias}${target.replace(/^src\//, "")}`);
      return [...new Set(forms)];
    };
    const cases = [
      ["core→ui", "src/core/probe_a.ts", "src/ui/probe_target"],
      ["core→server", "src/core/probe_b.ts", "src/server/probe_target"],
      ["core→app", "src/core/probe_c.ts", "src/app/probe_target"],
      ["module→other-module-internals", "src/modules/alpha/probe_d.ts", "src/modules/beta/internal/probe_target"],
      ["module→server", "src/modules/alpha/probe_e.ts", "src/server/probe_target"],
      ["module→app", "src/modules/alpha/probe_f.ts", "src/app/probe_target"],
      ["module→ui", "src/modules/alpha/probe_g.ts", "src/ui/probe_target"],
      ["ui→app", "src/ui/probe_h.ts", "src/app/probe_target"],
      ["ui→server", "src/ui/probe_i.ts", "src/server/probe_target"],
      ["server→app", "src/server/probe_j.ts", "src/app/probe_target"],
      ["server→ui", "src/server/probe_k.ts", "src/ui/probe_target"],
    ];
    expect(cases.map((c) => c[0]).concat("file-grain cycle")).toEqual(ARCH_01_BRANCHES);

    const written = [];
    const plant = (rel, body) => {
      const abs = join(dir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body);
      written.push(abs);
      return abs;
    };
    try {
      for (const [branch, from, target] of cases) {
        const body = `${specifiers(from, target).map((s) => `import "${s}";`).join("\n")}\nexport const probe = "${branch}";\n`;
        const abs = plant(from, body);
        const result = await lint(dir, abs);
        expect(result.messages.filter((m) => m.ruleId && !m.fatal).length, `${branch}: ${from} importing ${target} was not flagged (ARCH-01)`).toBeGreaterThan(0);
      }
      const a = plant("src/core/cycle_a.ts", 'import { b } from "./cycle_b.ts";\nexport const a = b;\n');
      plant("src/core/cycle_b.ts", 'import { a } from "./cycle_a.ts";\nexport const b = a;\n');
      const cycle = await lint(dir, a);
      expect(cycle.messages.filter((m) => m.ruleId && !m.fatal).length, "a file-grain cycle in src/core was not flagged (ARCH-01)").toBeGreaterThan(0);
    } finally {
      for (const abs of written) rmSync(abs, { force: true });
    }
  }, 600_000);

  it("AC-3-LINT-NEVERS: the product tree itself carries zero standing violations (Q-16)", () => {
    const run = pnpmRun(dir, ["lint"]);
    expect(run.code, `pnpm lint on the tree reported violations\n${run.out}`).toBe(0);
  }, 600_000);
});
