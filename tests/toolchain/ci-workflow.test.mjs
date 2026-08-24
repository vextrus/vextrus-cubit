// AC-5-CI-EVERY-LANE — the suite that proves a guarantee runs everywhere merges are decided
// (B-22): every PR, ubuntu-latest, Postgres 16 service (AS-01), pins from .nvmrc and
// packageManager, and the roster-driven verify rather than a hand-listed lane subset.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, repoRoot } from "./support/tree.mjs";

const DIR = join(repoRoot(), ".github/workflows");

function workflows() {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => ({ name: f, body: readFileSync(join(DIR, f), "utf8") }));
}

/** The one workflow that carries the gate: it must invoke `pnpm verify`. */
function gateWorkflow() {
  const all = workflows();
  expect(all.length, "no workflow in .github/workflows (B-22)").toBeGreaterThan(0);
  const gate = all.find((w) => /\bpnpm (run )?verify\b/.test(w.body));
  expect(gate, `no workflow runs pnpm verify:\n${all.map((w) => w.name).join(", ")}`).toBeTruthy();
  return gate;
}

describe("AC-5-CI-EVERY-LANE", () => {
  it("AC-5-CI-EVERY-LANE: runs on every pull request and on pushes to the default branch", () => {
    const { body } = gateWorkflow();
    expect(body, "the workflow does not trigger on pull_request").toMatch(/^\s*pull_request:/m);
    expect(body, "the workflow does not trigger on push").toMatch(/^\s*push:/m);
    const push = body.slice(body.search(/^\s*push:/m));
    expect(push.slice(0, 400), "the push trigger does not name the default branch").toMatch(/main/);
    // An unconditional pull_request trigger: a paths filter would let a PR merge without the
    // lanes that prove the guarantee (B-22).
    const prBlock = /^[ \t]*pull_request:[ \t]*\n((?:(?:[ \t]{4,}.*)?\n)*)/m.exec(body)?.[1] ?? "";
    expect(prBlock, "the pull_request trigger is filtered by paths — some PRs would skip the lanes").not.toMatch(/paths(-ignore)?:/);
  });

  it("AC-5-CI-EVERY-LANE: ubuntu-latest with a Postgres 16 service (AS-01)", () => {
    const { body } = gateWorkflow();
    expect(body, "the job does not run on ubuntu-latest").toMatch(/runs-on:\s*['"]?ubuntu-latest/);
    expect(body, "no services: block").toMatch(/^\s*services:/m);
    expect(body, "the Postgres service is not pinned to 16 (AS-01)").toMatch(/image:\s*['"]?postgres:16/);
  });

  it("AC-5-CI-EVERY-LANE: installs Node from .nvmrc and pnpm from the packageManager pin, with a store cache", () => {
    const { body } = gateWorkflow();
    expect(body, "Node is not installed from .nvmrc").toMatch(/node-version-file:\s*['"]?\.nvmrc/);
    expect(body, "pnpm is not installed from the packageManager pin (corepack or pnpm/action-setup)").toMatch(/corepack enable|pnpm\/action-setup/);
    const pinned = /pnpm\/action-setup[\s\S]{0,200}?version:\s*['"]?(\d+\.\d+\.\d+)/.exec(body);
    if (pinned) {
      const pkg = readJson(join(repoRoot(), "package.json"));
      expect(pinned[1], "the workflow pins a pnpm version other than the packageManager pin").toBe(pkg.packageManager.replace(/^pnpm@/, "").replace(/\+.*$/, ""));
    }
    expect(body, "no pnpm store cache").toMatch(/cache:\s*['"]?pnpm|pnpm[- ]store|actions\/cache/);
  });

  it("AC-5-CI-EVERY-LANE: runs checkup, the roster-driven verify, and the toolchain suite", () => {
    const { body } = gateWorkflow();
    expect(body, "CI does not run pnpm checkup").toMatch(/\bpnpm (run )?checkup\b/);
    expect(body, "CI does not run pnpm verify").toMatch(/\bpnpm (run )?verify\b/);
    expect(body, "CI does not run the toolchain suite").toMatch(/\bpnpm (run |exec )?vitest run tests\/toolchain\b/);
    // Roster-driven, not a hand-listed subset: CI must not enumerate the lanes itself.
    const handListed = ["typegen", "db-drift", "method-hash", "catalogue"].filter((lane) => new RegExp(`pnpm (run )?${lane}\\b`).test(body));
    expect(handListed, `CI hand-lists lanes instead of letting the roster decide: ${handListed.join(", ")}`).toEqual([]);
  });
});
