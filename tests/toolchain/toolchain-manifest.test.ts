// AC1 (manifest half) — the scripts family exists, package.json delegates to it, and the pins agree
// with each other. The run half of AC1 (`pnpm verify` exits 0, one line per lane, wall time
// printed) is the gate's own verify lane: a vitest test that spawned `pnpm verify` would recurse,
// because verify's unit lane runs vitest.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** C-06 names them; the spec's interfaces section repeats them. */
const SCRIPT_FILES = [
  "scripts/lib/lanes.mjs",
  "scripts/verify.mjs",
  "scripts/checkup.mjs",
  "scripts/db-migrate.mjs",
  "scripts/db-drift.mjs",
  "scripts/e2e.mjs",
  "scripts/seed.mjs",
  "scripts/method-hashes.mjs",
];

const SCRIPTS_BLOCK = ["verify", "checkup", "test:db", "e2e", "db:migrate", "db:drift", "seed"];

interface PackageJson {
  packageManager?: string;
  scripts?: Record<string, string>;
}

function packageJson(): PackageJson {
  const path = join(REPO_ROOT, "package.json");
  expect(existsSync(path), "package.json does not exist").toBe(true);
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

describe("AC1: the toolchain surface is whole", () => {
  test("AC1: every script file C-06 names exists", () => {
    const missing = SCRIPT_FILES.filter((rel) => !existsSync(join(REPO_ROOT, rel)));
    expect(missing, "a command that exists must run (B-23)").toEqual([]);
  });

  test("AC1: package.json carries the full scripts block, each entry delegating to its scripts/*.mjs file", () => {
    const scripts = packageJson().scripts ?? {};
    const problems: string[] = [];
    for (const name of SCRIPTS_BLOCK) {
      const command = scripts[name];
      if (!command) {
        problems.push(`${name}: absent from the scripts block`);
        continue;
      }
      const delegate = /(scripts\/[\w./-]+\.mjs)/.exec(command)?.[1];
      if (!delegate) problems.push(`${name}: '${command}' does not delegate to a scripts/*.mjs file`);
      else if (!existsSync(join(REPO_ROOT, delegate))) problems.push(`${name}: delegates to ${delegate}, which does not exist`);
    }
    expect(problems, "the scripts block is the command surface the gate and the CI workflow both call").toEqual([]);
  });

  test("AC1: packageManager pins pnpm and .nvmrc pins Node", () => {
    expect(packageJson().packageManager, "package.json does not pin pnpm").toMatch(/^pnpm@\d+\.\d+\.\d+/);
    const nvmrc = join(REPO_ROOT, ".nvmrc");
    expect(existsSync(nvmrc), ".nvmrc does not exist").toBe(true);
    expect(readFileSync(nvmrc, "utf8").trim(), ".nvmrc does not pin a Node version").toMatch(/^v?\d+(\.\d+)*$/);
  });

  test("AC1: the CI workflow uses the same Node major as .nvmrc", () => {
    expect(existsSync(join(REPO_ROOT, ".nvmrc")), ".nvmrc does not exist").toBe(true);
    const nodeMajor = readFileSync(join(REPO_ROOT, ".nvmrc"), "utf8").trim().replace(/^v/, "").split(".")[0]!;
    const dir = join(REPO_ROOT, ".github", "workflows");
    expect(existsSync(dir), ".github/workflows/ does not exist").toBe(true);
    const workflows = readdirSync(dir).filter((file) => /\.ya?ml$/.test(file));
    expect(workflows, "no workflow file under .github/workflows/").not.toEqual([]);

    const contradictions: string[] = [];
    let pinned = false;
    for (const file of workflows) {
      const text = readFileSync(join(dir, file), "utf8");
      if (text.includes(".nvmrc")) pinned = true;
      for (const match of text.matchAll(/node-version\s*:\s*['"]?v?(\d+)/g)) {
        pinned = true;
        if (match[1] !== nodeMajor) contradictions.push(`${file} pins Node ${match[1]} while .nvmrc says ${nodeMajor}`);
      }
    }
    expect(contradictions, "the CI Node version and .nvmrc must be the same major").toEqual([]);
    expect(pinned, "no workflow takes its Node version from .nvmrc or an explicit pin").toBe(true);
  });

  test("AC1: the toolchain configs the lanes run are committed at the repo root", () => {
    const roots = readdirSync(REPO_ROOT);
    const wanted = [/^tsconfig\.json$/, /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/, /^vitest\.config\.(js|mjs|ts|mts)$/, /^playwright\.config\.(js|mjs|ts|mts)$/, /^drizzle\.config\.(js|mjs|ts|mts)$/];
    const missing = wanted.filter((pattern) => !roots.some((entry) => pattern.test(entry))).map((pattern) => pattern.source);
    expect(missing, "the toolchain surface is delivered whole, in one increment (B-15)").toEqual([]);
  });
});
