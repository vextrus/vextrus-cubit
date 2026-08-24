// AC-4-CHECKUP — the machine's report: pins beside found versions, the probes the tree needs
// today, and a failure only for what an armed lane actually needs (B-23).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PIN_TOOLS } from "./support/contract.mjs";
import { pnpmRun, readJson, removeTree, repoRoot, scratchTree } from "./support/tree.mjs";

const PIN_LINE = /^pin ([a-z]+) want=(\S+) found=(\S+)$/;

describe("AC-4-CHECKUP", () => {
  let dir;
  let run;

  beforeAll(() => {
    dir = scratchTree("ac4");
    run = pnpmRun(dir, ["checkup"]);
  }, 300_000);

  afterAll(() => dir && removeTree(dir));

  const pins = () => Object.fromEntries(run.lines.map((l) => PIN_LINE.exec(l)).filter(Boolean).map((m) => [m[1], { want: m[2], found: m[3] }]));

  it("AC-4-CHECKUP: prints one pin line per tool, in the contract's shape", () => {
    const found = pins();
    for (const tool of PIN_TOOLS) {
      expect(found[tool], `no "pin ${tool} want=… found=…" line in\n${run.out}`).toBeTruthy();
    }
  });

  it("AC-4-CHECKUP: each want= is the pin the contract stores for that tool", () => {
    const found = pins();
    const nvmrc = readFileSync(join(repoRoot(), ".nvmrc"), "utf8").trim();
    const pkg = readJson(join(repoRoot(), "package.json"));
    const jsonPins = readJson(join(repoRoot(), "scripts/pins.json"));
    expect(found.node.want.replace(/^v/, "")).toBe(nvmrc.replace(/^v/, ""));
    expect(found.pnpm.want).toBe(pkg.packageManager.replace(/^pnpm@/, "").replace(/\+.*$/, ""));
    for (const tool of ["uv", "typst", "libredwg"]) {
      expect(found[tool].want, `pin ${tool} does not come from scripts/pins.json`).toBe(String(jsonPins[tool]));
    }
  });

  it("AC-4-CHECKUP: reports Postgres on 5544, port bindability, storage root and env", () => {
    const body = run.out;
    expect(body, "no Postgres 5544 reachability report").toMatch(/5544/);
    expect(body.toLowerCase(), "no Postgres report").toMatch(/postgres/);
    expect(body.toLowerCase(), "no port bindability report").toMatch(/port/);
    expect(body.toLowerCase(), "no storage root report").toMatch(/storage/);
    expect(body.toLowerCase(), "no env report").toMatch(/env/);
  });

  it("AC-4-CHECKUP: a tool only a stub lane needs may be ABSENT without failing the run (B-23)", () => {
    const found = pins();
    const armedToolsAgree = ["node", "pnpm"].every((t) => found[t].found !== "ABSENT" && found[t].found.replace(/^v/, "").startsWith(found[t].want.replace(/^v/, "")));
    if (armedToolsAgree) {
      expect(run.code, `checkup failed although only stub-lane tools are missing\n${run.out}`).toBe(0);
    } else {
      // The machine genuinely does not meet a pin an armed lane needs: checkup must say so.
      expect(run.code, "checkup passed although an armed lane's tool mismatches its pin").not.toBe(0);
    }
  });

  it("AC-4-CHECKUP: a pin an armed lane needs, mismatched, fails the run", () => {
    const probe = scratchTree("ac4-mismatch");
    try {
      writeFileSync(join(probe, ".nvmrc"), "99.99.99\n");
      const bad = pnpmRun(probe, ["checkup"]);
      expect(bad.out, "checkup did not report the impossible node pin").toMatch(/^pin node want=v?99\.99\.99 found=\S+$/m);
      expect(bad.code, `checkup passed with a node pin no machine can satisfy\n${bad.out}`).not.toBe(0);
    } finally {
      removeTree(probe);
    }
  }, 300_000);
});
