// AC-2-ROSTER-PROBES — deriveLaneRoster decides armed/stub by probing input roots and nothing
// else, and `pnpm verify`'s printed roster is that same answer, line for line.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARMED_AT_END_OF_INC_000, LANE_ORDER } from "./support/contract.mjs";
import { createRoot, finalLineOf, laneOf, pnpmRun, removeTree, repoRoot, rosterOf, scratchTree, skipRootOf } from "./support/tree.mjs";

const lanesPath = () => join(repoRoot(), "scripts/lanes.mjs");

const load = async () => {
  const mod = await import(lanesPath());
  expect(typeof mod.deriveLaneRoster, "scripts/lanes.mjs does not export deriveLaneRoster").toBe("function");
  return mod.deriveLaneRoster;
};

/** The verdict line with its wall time blanked: what the environment must not be able to change. */
const verdictOf = (run) => (finalLineOf(run) ?? "<no verify: line>").replace(/\d+(?:\.\d+)?s\s*$/, "<t>s");

/**
 * JS source minus its comments. The source scan below asks whether scripts/lanes.mjs *reads* the
 * environment, so a comment that merely names the escape hatch ("never reads process.env") must not
 * fail it, and a real read must not hide inside one. String-aware by construction.
 */
function stripComments(src) {
  let out = "";
  let quote = null;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      out += ch;
      if (ch === "\\") {
        out += src[i + 1] ?? "";
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 1;
      out += " ";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Every shape an environment read takes in an ES module: the property, the destructure, the import. */
const ENV_READS = [
  [/process\s*\.\s*env/, "process.env"],
  [/process\s*\[\s*["'`]env/, "process['env']"],
  [/\{[^}]*\benv\b[^}]*\}\s*=\s*(?:globalThis\s*\.\s*)?process\b/, "const { env } = process"],
  [/(?:from|import|require\s*\(\s*)\s*["'](?:node:)?process["']/, "an import of node:process"],
];

describe("AC-2-ROSTER-PROBES", () => {
  let deriveLaneRoster;
  let dir;

  beforeAll(async () => {
    deriveLaneRoster = await load();
    dir = scratchTree("ac2");
  }, 120_000);

  afterAll(() => dir && removeTree(dir));

  it("AC-2-ROSTER-PROBES: returns every contract lane in order as { lane, armed, inputRoots }", () => {
    const roster = deriveLaneRoster(repoRoot());
    expect(Array.isArray(roster)).toBe(true);
    expect(roster.map((l) => l.lane)).toEqual(LANE_ORDER);
    for (const entry of roster) {
      expect(typeof entry.armed, `${entry.lane}.armed is not a boolean`).toBe("boolean");
      expect(Array.isArray(entry.inputRoots) && entry.inputRoots.length > 0, `${entry.lane} declares no inputRoots`).toBe(true);
      for (const r of entry.inputRoots) expect(typeof r).toBe("string");
    }
  });

  it("AC-2-ROSTER-PROBES: with every declared input root removed, no lane is armed", () => {
    const roots = new Set(deriveLaneRoster(dir).flatMap((l) => l.inputRoots));
    for (const rel of roots) rmSync(join(dir, rel), { recursive: true, force: true });
    for (const entry of deriveLaneRoster(dir)) {
      expect(entry.armed, `${entry.lane} is armed though none of ${entry.inputRoots.join(", ")} exists`).toBe(false);
    }
  });

  it("AC-2-ROSTER-PROBES: creating only a lane's own input roots arms exactly that lane", () => {
    for (const target of deriveLaneRoster(dir)) {
      const undo = [];
      for (const rel of target.inputRoots) {
        undo.push(createRoot(dir, rel));
        // The contract probes the unit lane's root by content: any *.test.* outside tests/e2e.
        if (target.lane === "unit") undo.push(createRoot(dir, join(rel, "probe.test.mjs")));
      }
      try {
        const armed = deriveLaneRoster(dir).filter((l) => l.armed).map((l) => l.lane);
        expect(armed, `creating ${target.inputRoots.join(", ")} did not arm ${target.lane}`).toContain(target.lane);
        // Only lanes whose own roots are now all present may have armed with it.
        for (const other of deriveLaneRoster(dir).filter((l) => l.armed)) {
          const satisfied = other.inputRoots.every((r) => existsSync(join(dir, r)));
          expect(satisfied, `${other.lane} armed without its input roots existing`).toBe(true);
        }
      } finally {
        for (const u of undo.reverse()) u();
      }
    }
  });

  it("AC-2-ROSTER-PROBES: on this tree the armed set is exactly typecheck, lint, unit", async (ctx) => {
    const roster = deriveLaneRoster(repoRoot());
    const armed = roster.filter((l) => l.armed).map((l) => l.lane);

    // The end-of-inc-000 armed set is a bounded-in-time checkpoint, not a roster driver: it
    // catches inc-000 smuggling in later-layer surface. C-06 keeps the tree deciding — the day an
    // increment lawfully creates a later lane's input root, that lane arms with no toolchain edit,
    // and this checkpoint must retire rather than turn red. It retires as a recorded skip naming
    // the lanes and the roots that armed them; the trigger is unforgeable because it fires only
    // when those roots genuinely exist on the real tree (the scratch-tree cases above prove the
    // probing itself). The inc-000 lanes are still required to be armed either way.
    expect(
      armed.filter((l) => ARMED_AT_END_OF_INC_000.includes(l)),
      "a lane armed at the end of inc-000 is no longer armed",
    ).toEqual(ARMED_AT_END_OF_INC_000);

    const beyond = roster.filter((l) => l.armed && !ARMED_AT_END_OF_INC_000.includes(l.lane));
    if (beyond.length > 0) {
      const named = beyond.map((l) => `${l.lane} (input root ${l.inputRoots.join(", ")})`).join("; ");
      const note = `RECORDED SKIP AC-2-ROSTER-PROBES: the end-of-inc-000 armed-set checkpoint has retired — the tree now arms ${named}`;
      await ctx.annotate(note);
      ctx.skip(note);
    }

    expect(armed).toEqual(ARMED_AT_END_OF_INC_000);
  });

  it("AC-2-ROSTER-PROBES: pnpm verify's printed roster matches deriveLaneRoster line for line", () => {
    const probe = scratchTree("ac2-verify");
    try {
      const run = pnpmRun(probe, ["verify"]);
      const expected = deriveLaneRoster(probe).map((l) =>
        l.armed ? `RUN ${l.lane}` : `SKIP ${l.lane}: input root ${l.inputRoots.find((r) => !existsSync(join(probe, r))) ?? l.inputRoots[0]} absent`,
      );
      expect(rosterOf(run), `verify printed a different roster than deriveLaneRoster\n${run.out}`).toEqual(expected);
      expect(rosterOf(run).map(laneOf)).toEqual(LANE_ORDER);
    } finally {
      removeTree(probe);
    }
  }, 900_000);

  // The negative half of C-06's roster clause: "never a frozen list or an env var". The cases above
  // prove the tree decides; these two prove the environment cannot, so an escape hatch added
  // tomorrow (`if (process.env.VERIFY_SKIP) …`) turns this suite red instead of passing silently.
  it("AC-2-ROSTER-PROBES: VERIFY_SKIP cannot move a lane — the printed roster is byte-identical with it set", () => {
    const probe = scratchTree("ac2-env");
    try {
      const baseline = pnpmRun(probe, ["verify"]);
      const roster0 = rosterOf(baseline);
      expect(roster0.length, `pnpm verify printed no roster at all\n${baseline.out}`).toBe(LANE_ORDER.length);

      // The values are read off the run itself, never listed here: whichever lane this tree happens
      // to arm is the one an env var would most tempt someone to silence.
      const armed = roster0.filter((l) => l.startsWith("RUN ")).map(laneOf);
      const stubs = roster0.filter((l) => skipRootOf(l) !== null).map(laneOf);
      expect(armed.length, "no lane is armed, so silencing one would prove nothing").toBeGreaterThan(0);
      const values = [...new Set(["all", armed[0], stubs[0] ?? armed[0]])];

      for (const value of values) {
        const run = pnpmRun(probe, ["verify"], { VERIFY_SKIP: value });
        expect(
          rosterOf(run),
          `VERIFY_SKIP=${value} changed the roster — the tree decides, never an env var (C-06)\n${run.out}`,
        ).toEqual(roster0);
        expect(run.code, `VERIFY_SKIP=${value} changed verify's exit code from ${baseline.code} to ${run.code}\n${run.out}`).toBe(baseline.code);
        expect(verdictOf(run), `VERIFY_SKIP=${value} changed the verdict line\n${run.out}`).toBe(verdictOf(baseline));
      }
    } finally {
      removeTree(probe);
    }
  }, 1_800_000);

  it("AC-2-ROSTER-PROBES: deriveLaneRoster never reads the environment", async () => {
    const url = pathToFileURL(lanesPath()).href;
    const before = process.env.VERIFY_SKIP;
    delete process.env.VERIFY_SKIP;
    try {
      const clean = deriveLaneRoster(repoRoot());
      expect(clean.length, "deriveLaneRoster returned no lanes").toBe(LANE_ORDER.length);

      let bust = 0;
      for (const value of ["all", "", "*", ...clean.map((l) => l.lane)]) {
        // Poisoned before the fresh import too: an env var read at module load must not decide either.
        process.env.VERIFY_SKIP = value;
        expect(
          deriveLaneRoster(repoRoot()),
          `deriveLaneRoster changed its answer under VERIFY_SKIP=${value} (C-06: never an env var)`,
        ).toEqual(clean);
        bust += 1;
        const fresh = await import(`${url}?env-probe=${bust}`);
        expect(
          fresh.deriveLaneRoster(repoRoot()),
          `scripts/lanes.mjs answered differently when loaded under VERIFY_SKIP=${value} (C-06: never an env var)`,
        ).toEqual(clean);
      }
    } finally {
      if (before === undefined) delete process.env.VERIFY_SKIP;
      else process.env.VERIFY_SKIP = before;
    }

    // The behavioural half above cannot see an env read that only *sometimes* moves the roster, so
    // the guarantee is also asserted at the source: the roster's one home does not touch the
    // environment at all. Arbitration on this file directed both halves.
    const source = stripComments(readFileSync(lanesPath(), "utf8"));
    for (const [pattern, shape] of ENV_READS) {
      expect(
        pattern.test(source),
        `scripts/lanes.mjs reads the environment via ${shape} — the roster is derived by probing input roots only (C-06)`,
      ).toBe(false);
    }
  }, 300_000);
});
