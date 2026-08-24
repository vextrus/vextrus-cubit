// AC-3-LINT-NEVERS — the ARCH-01 matrix and the Q-08 NEVERs are rules, proved by the declared
// corpus (each bad.* fires, each good.* twin stays silent) and by synthesised violations on real
// product paths; and `eslint .` on the tree itself is clean (Q-16).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARCH_01_BRANCH_RULE, ARCH_01_BRANCHES, CORPUS_DIR_RULE, NEVER_BRANCHES } from "./support/contract.mjs";
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

/**
 * The fixtures Q-08's exception is written against: the committed corpus at
 * `tests/lint-fixtures/<rule>/bad.<ext>` — one directory deep, no further. Derived from the glob, so a
 * later increment that adds a NEVER branch is covered without editing this file, and the deeper
 * ARCH-01 fixtures (whose payload is an import, not a Q-08 banned construct) are correctly out.
 */
function declaredCorpusDirs(root) {
  const base = join(root, CORPUS);
  return fixtureDirs(root).filter((d) => dirname(d) === base);
}

/**
 * The rule a fixture directory declares, found by walking its corpus-relative path from the longest
 * prefix down — so the one-deep NEVER directories and the deeper ARCH-01 ones resolve by the same
 * mechanism, with no depth written into this file. `rule: null` means the corpus carries a branch
 * the contract file has not declared, which is a hole in the proof, not a pass.
 */
function declaredRule(root, dirAbs) {
  const segments = relative(join(root, CORPUS), dirAbs).split(/[\\/]/);
  for (let n = segments.length; n > 0; n -= 1) {
    const key = segments.slice(0, n).join("/");
    if (Object.hasOwn(CORPUS_DIR_RULE, key)) return { key, rule: CORPUS_DIR_RULE[key] };
  }
  return { key: segments.join("/"), rule: null };
}

const MARKER = /\/\/ RECORDED REASON [A-Z0-9_-]+/g;

/** The 1-based lines of <text> that carry a RECORDED REASON marker. */
const markedLines = (text) =>
  text
    .split("\n")
    .map((line, i) => (new RegExp(MARKER.source).test(line) ? i + 1 : 0))
    .filter((n) => n > 0);

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

      // ARCH-01: "every rule branch has a fixture test proving IT fires" — the branch's own rule, not
      // merely something. The expected id comes from the directory's declaration in
      // tests/toolchain/support/contract.mjs, resolved from the corpus layout, so a fixture whose rule
      // is switched off stays red even if an unrelated rule happens to flag the payload.
      const { key, rule } = declaredRule(repoRoot(), d);
      expect(rule, `${name}: no rule id declared for corpus directory \`${key}\` — add its entry to tests/toolchain/support/contract.mjs`).toBeTruthy();
      expect(real.map((m) => m.ruleId), `${name}/bad.* fired ${JSON.stringify(real.map((m) => m.ruleId))} but not its declared rule \`${rule}\` — that branch is not armed`).toContain(rule);

      const good = await lint(repoRoot(), payload(d, "good"));
      expect(good.messages.filter((m) => m.ruleId || m.fatal), `${name}/good.* must not fire: ${JSON.stringify(good.messages)}`).toEqual([]);
    }
  }, 600_000);

  // -------------------------------------------------------------------------------------------
  // Q-08's one exception, and both of its guardrails. Settled reading: the marker is honoured by
  // the gate's structural NEVER scan, not by ESLint — the rules fire on every file including the
  // corpus (that firing IS the record), and the corpus is excluded from `eslint .` of the product
  // tree, so the marked payload is recorded and never blocking. The two guardrails must hold in
  // the same breath: an unmarked construct in the same file is no more exempt than a marked one,
  // and the marker buys nothing outside the declared corpus.
  // -------------------------------------------------------------------------------------------

  it("AC-3-LINT-NEVERS: a declared fixture's marked payload is recorded, never blocking (Q-08)", async () => {
    const dirs = declaredCorpusDirs(repoRoot());
    expect(dirs.length, "no fixture sits at the corpus path Q-08's exception names").toBeGreaterThan(0);

    for (const d of dirs) {
      const file = payload(d, "bad");
      const name = relative(repoRoot(), file);
      const marks = markedLines(readFileSync(file, "utf8"));
      expect(marks.length, `${name} carries no RECORDED REASON marker, so the exception cannot reach it`).toBeGreaterThan(0);

      // Recorded: the rule still fires, and it fires ON the marked line — Q-08's exception is
      // line-level, so the marker must sit beside the construct it records, not somewhere else.
      const fired = (await lint(repoRoot(), file)).messages.filter((m) => m.ruleId && !m.fatal);
      expect(fired.length, `${name}: nothing fired, so nothing was recorded`).toBeGreaterThan(0);
      expect(
        fired.map((m) => m.line).filter((l) => marks.includes(l)).length,
        `${name}: the rule fired on ${JSON.stringify(fired.map((m) => m.line))} but the marker is on ${JSON.stringify(marks)} — the exception is line-level (Q-08)`,
      ).toBeGreaterThan(0);
    }

    // Never blocking: the same payloads, present and unaltered, do not fail the tree's own lint.
    const run = pnpmRun(dir, ["lint"]);
    expect(run.code, `the declared corpus blocked \`eslint .\` — Q-08 says recorded, never blocking\n${run.out}`).toBe(0);
  }, 600_000);

  it("AC-3-LINT-NEVERS: an unmarked construct in a declared fixture is exempt from nothing (Q-08)", async () => {
    const planted = [];
    try {
      for (const d of declaredCorpusDirs(repoRoot())) {
        const file = payload(d, "bad");
        const name = relative(repoRoot(), file);
        const marked = readFileSync(file, "utf8");
        const unmarked = marked.replace(MARKER, "");
        expect(unmarked, `${name}: stripping the marker changed nothing — there is no marker to strip`).not.toBe(marked);

        // Same directory, same config context, same payload: the marker is the only difference.
        const twin = join(dir, relative(repoRoot(), d), `unmarked_${basename(file)}`);
        mkdirSync(dirname(twin), { recursive: true });
        writeFileSync(twin, unmarked);
        planted.push(twin);

        const before = new Set((await lint(repoRoot(), file)).messages.filter((m) => m.ruleId && !m.fatal).map((m) => m.ruleId));
        const after = (await lint(dir, twin)).messages.filter((m) => m.ruleId && !m.fatal);
        expect(after.length, `${name}: the unmarked twin fired nothing`).toBeGreaterThan(0);
        const missing = [...before].filter((r) => !after.some((m) => m.ruleId === r));
        expect(missing, `${name}: removing the marker silenced ${JSON.stringify(missing)} — the marker is doing work it must not do`).toEqual([]);
      }
    } finally {
      for (const abs of planted) rmSync(abs, { force: true });
    }
  }, 600_000);

  // Amended after arbitration on the gate's structural stage: Q-08's exception is defined by
  // construct, line and path — not by which detector found it — so the structural NEVER/diff scan
  // honours it too. A finding on a marked line whose path matches the canonical glob
  // `tests/lint-fixtures/*/bad.*` is recorded (printed with its code, never silently passed) and
  // never blocking; an unmarked construct in the same file still blocks; the marker does nothing
  // outside the corpus. The two guardrails are what keep that downgrade as narrow as Q-08 wrote
  // it, and both are mechanical facts about the committed tree — so the tree carries them, rather
  // than leaving them to the arbitration record. The detector here is ESLint because ESLint is
  // the detector this tree owns; the constructs it finds are the constructs the scan scans.
  it("AC-3-LINT-NEVERS: the recorded-not-blocking downgrade reaches every marked corpus line and none beyond (Q-08)", async () => {
    const canonical = declaredCorpusDirs(repoRoot());
    expect(canonical.length, "no fixture sits at the corpus path Q-08's exception names").toBeGreaterThan(0);

    // The NEVER rule ids are whatever the canonical corpus's own payloads fire — derived, never
    // listed, so a later increment that adds a NEVER branch extends the set by adding its fixture.
    const neverRules = new Set();

    for (const d of canonical) {
      const file = payload(d, "bad");
      const name = relative(repoRoot(), file);
      const text = readFileSync(file, "utf8");
      const marks = markedLines(text);
      const fired = (await lint(repoRoot(), file)).messages.filter((m) => m.ruleId && !m.fatal);
      expect(fired.length, `${name}: nothing fired, so the downgrade has nothing to record`).toBeGreaterThan(0);
      for (const m of fired) neverRules.add(m.ruleId);

      // Guardrail one — an unmarked construct in the same file still blocks. The corpus is only
      // safe to downgrade wholesale if every construct it carries is on a marked line: one
      // detected line without a marker is a construct that blocks, and the fixture would be a trap.
      const unmarked = fired.filter((m) => !marks.includes(m.line)).map((m) => `${m.line}:${m.ruleId}`);
      expect(unmarked, `${name}: detected on unmarked line(s) ${JSON.stringify(unmarked)} — an unmarked construct still blocks (Q-08)`).toEqual([]);

      // Recorded, never silently passed: the gate tail prints the finding WITH its code, so every
      // marker must actually name one.
      for (const line of marks) {
        const code = (text.split("\n")[line - 1].match(/\/\/ RECORDED REASON ([A-Z0-9_-]+)/) ?? [])[1];
        expect(code, `${name}:${line}: the marker names no <CODE> for the gate tail to print (Q-08)`).toBeTruthy();
      }
    }

    // Guardrail two — the marker has no effect outside the declared corpus, so nothing outside the
    // canonical glob may carry a construct the NEVER rules detect: a marker there would not be
    // honoured and the construct would block. Covers the deeper ARCH-01 fixtures (import payloads,
    // markers and all) and every good.* twin.
    for (const d of fixtureDirs(repoRoot())) {
      for (const kind of ["bad", "good"]) {
        const file = payload(d, kind);
        if (!file || (kind === "bad" && canonical.includes(d))) continue;
        const name = relative(repoRoot(), file);
        const leaked = (await lint(repoRoot(), file)).messages.filter((m) => m.ruleId && neverRules.has(m.ruleId));
        expect(
          leaked.map((m) => `${m.line}:${m.ruleId}`),
          `${name} is outside the canonical corpus \`${CORPUS}/*/bad.*\`, where the marker does nothing — a construct here blocks (Q-08)`,
        ).toEqual([]);
      }
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
      // …and it must not merely be reported: outside the corpus the same construct BLOCKS. The
      // corpus exclusion is path-bound, so `eslint .` — the tree's own blocking surface — fails.
      const run = pnpmRun(dir, ["lint"]);
      expect(run.code, `a marked NEVER at a product path passed \`eslint .\` — the marker is path-bound (Q-08)\n${run.out}`).not.toBe(0);
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
    // Every branch the contract enumerates names the rule that arms it, so no probe below can be
    // checked against an undefined expectation.
    expect(Object.keys(ARCH_01_BRANCH_RULE).sort(), "a branch of ARCH_01_BRANCHES declares no rule in tests/toolchain/support/contract.mjs").toEqual(
      [...ARCH_01_BRANCHES].sort(),
    );

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
        const fired = result.messages.filter((m) => m.ruleId && !m.fatal);
        expect(result.messages.filter((m) => m.fatal).length, `${branch}: ${from} is a parse error, not a flagged import`).toBe(0);
        expect(fired.length, `${branch}: ${from} importing ${target} was not flagged (ARCH-01)`).toBeGreaterThan(0);
        // The branch's OWN rule, named per-branch in the contract file: "every rule branch has a
        // fixture test proving IT fires". Anything weaker stays green on an unrelated rule flagging
        // the probe body while the branch itself is dead.
        expect(
          fired.map((m) => m.ruleId),
          `${branch}: ${from} importing ${target} fired ${JSON.stringify(fired.map((m) => m.ruleId))} — not \`${ARCH_01_BRANCH_RULE[branch]}\`, the rule this branch is armed by (ARCH-01)`,
        ).toContain(ARCH_01_BRANCH_RULE[branch]);
      }
      const a = plant("src/core/cycle_a.ts", 'import { b } from "./cycle_b.ts";\nexport const a = b;\n');
      plant("src/core/cycle_b.ts", 'import { a } from "./cycle_a.ts";\nexport const b = a;\n');
      const cycle = await lint(dir, a);
      const cycleFired = cycle.messages.filter((m) => m.ruleId && !m.fatal);
      expect(cycle.messages.filter((m) => m.fatal).length, "the file-grain cycle probe is a parse error, not a flagged cycle").toBe(0);
      expect(cycleFired.length, "a file-grain cycle in src/core was not flagged (ARCH-01)").toBeGreaterThan(0);
      expect(
        cycleFired.map((m) => m.ruleId),
        `the file-grain cycle fired ${JSON.stringify(cycleFired.map((m) => m.ruleId))} — not \`${ARCH_01_BRANCH_RULE["file-grain cycle"]}\`, the rule this branch is armed by (ARCH-01)`,
      ).toContain(ARCH_01_BRANCH_RULE["file-grain cycle"]);
    } finally {
      for (const abs of written) rmSync(abs, { force: true });
    }
  }, 600_000);

  it("AC-3-LINT-NEVERS: the product tree itself carries zero standing violations (Q-16)", () => {
    const run = pnpmRun(dir, ["lint"]);
    expect(run.code, `pnpm lint on the tree reported violations\n${run.out}`).toBe(0);
  }, 600_000);
});
