// The gate as one command (scripts/gate.mjs; C-06, V-DB). What is worth proving is the DISCIPLINE
// session 3 kept by hand: the lanes run one after another in a fixed order, the db lane never runs
// beside a served product, a red lane silences no later lane, and the exit code is the first red's.
// Driven with an injected runner and an injected, async port probe, so a green tree proves the red
// paths without binding a socket (the probe itself is proved in port-probe.test.ts).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, expect, test } from "vitest";
import { sweepable } from "../../scripts/e2e-clean.mjs";
import { DEFAULT_LOG_DIR, GATE_LANES, gate, selectLanes } from "../../scripts/gate.mjs";
import { portFor, servedPorts } from "../../scripts/lib/ports.mjs";

const ORDER = ["verify", "checkup", "golden", "db", "e2e", "e2e-j000", "perf"];

/** A port probe that reads `held` as busy and every other port as free, and records every port it was asked. */
function probeHolding(...held: number[]): { probe: (port: number) => Promise<"free" | "busy">; asked: number[] } {
  const asked: number[] = [];
  return {
    asked,
    probe: async (port) => {
      asked.push(port);
      return held.includes(port) ? "busy" : "free";
    },
  };
}

/** Who holds a port, as the gate is told it — never `ss`, here. */
const attribute = (port: number): string => `a Linux listener (stand-in pid=${port})`;

/** A probe that reads every port free. */
const allFree = async (): Promise<"free"> => "free";

describe("the roster and its order", () => {
  test("the seven lanes the handoff quotes, in the order they are run", () => {
    expect(GATE_LANES.map((lane) => lane.id)).toEqual(ORDER);
  });

  test("--only keeps the roster's order whatever order it was asked in, and refuses a lane it does not know", () => {
    expect(selectLanes(GATE_LANES, "perf,verify").map((lane) => lane.id)).toEqual(["verify", "perf"]);
    expect(selectLanes(GATE_LANES, "").map((lane) => lane.id)).toEqual(ORDER);
    expect(() => selectLanes(GATE_LANES, "verify,vibes")).toThrow(/knows no lane named vibes/);
  });

  test("only the db lane needs the served ports free; the three e2e lanes serve the product", () => {
    expect(GATE_LANES.filter((lane) => lane.needsPortsFree).map((lane) => lane.id)).toEqual(["db"]);
    expect(GATE_LANES.filter((lane) => lane.servesProduct).map((lane) => lane.id)).toEqual(["e2e", "e2e-j000", "perf"]);
  });
});

describe("which ports the gate asks about (scripts/lib/ports.mjs is their one home)", () => {
  test("the db lane asks about every served port — the set servedPorts() names — and nothing else", async () => {
    const { probe, asked } = probeHolding();
    await gate({ only: "db", out: "test-results/gate-test", write: () => undefined, probe, attribute, run: async () => 0 });
    expect(asked, "the gate keeps a port list of its own beside servedPorts()").toEqual([...new Set(servedPorts())]);
  });

  test("each served lane asks about the journeys' port, portFor(\"e2e\"), right before it runs", async () => {
    const { probe, asked } = probeHolding();
    await gate({ only: "e2e,e2e-j000,perf", out: "test-results/gate-test", write: () => undefined, probe, attribute, run: async () => 0 });
    expect(asked).toEqual([portFor("e2e"), portFor("e2e"), portFor("e2e")]);
  });
});

describe("the chain", () => {
  test("lanes run in order, a red one silences none after it, the exit code is the first red's", async () => {
    const ran: string[] = [];
    const lines: string[] = [];
    const code = await gate({
      only: "verify,golden,e2e",
      out: "test-results/gate-test",
      write: (line) => lines.push(line.trimEnd()),
      probe: allFree,
      attribute,
      run: async (lane) => {
        ran.push(lane.id);
        return lane.id === "golden" ? 3 : 0;
      },
    });
    expect(ran).toEqual(["verify", "golden", "e2e"]);
    expect(code).toBe(3);
    expect(lines.some((line) => line.startsWith("GATE golden RED exit=3")), "the red lane is named with its code").toBe(true);
    expect(lines.some((line) => line.startsWith("GATE e2e green")), "the lane after the red one still ran").toBe(true);
    expect(lines[lines.length - 1]).toMatch(/^GATE wall-time [\d.]+s exit 3$/);
  });

  test("the db lane is refused, by name, while a served product holds a port — and the chain goes on", async () => {
    // The dev lane is up: the app port is held, the journeys' port is not — so the served lane runs.
    const app = portFor("app");
    const ran: string[] = [];
    const lines: string[] = [];
    const code = await gate({
      only: "db,perf",
      out: "test-results/gate-test",
      write: (line) => lines.push(line.trimEnd()),
      probe: probeHolding(app).probe,
      attribute,
      run: async (lane) => {
        ran.push(lane.id);
        return 0;
      },
    });
    expect(ran, "the db lane never started").toEqual(["perf"]);
    const refusal = lines.find((line) => line.startsWith("GATE db REFUSED")) ?? "";
    expect(refusal, "the refusal names the lane, the held port and V-DB").toMatch(new RegExp(`\\b${app}\\b.*V-DB`));
    expect(refusal, "the refusal says who holds the port").toContain(attribute(app));
    expect(lines, "the summary names the refusal").toContainEqual(expect.stringMatching(new RegExp(`^GATE summary — db: refused \\(port ${app} held\\)`)));
    expect(code, "a refused lane is a red gate").toBe(1);
  });

  test("a served lane whose port is held is refused by name at once — never started to die on EADDRINUSE", async () => {
    // Under WSL2 mirrored networking a Windows listener holds the journeys' port where `ss` cannot
    // see it; the lanes then died 20–37 s in. The pre-flight asks by binding, before the lane starts.
    const e2e = portFor("e2e");
    const ran: string[] = [];
    const lines: string[] = [];
    const code = await gate({
      only: "verify,e2e,e2e-j000,perf",
      out: "test-results/gate-test",
      write: (line) => lines.push(line.trimEnd()),
      probe: probeHolding(e2e).probe,
      attribute,
      run: async (lane) => {
        ran.push(lane.id);
        return 0;
      },
    });
    expect(ran, "no served lane was started while its port was held; the lanes that serve nothing still ran").toEqual(["verify"]);
    for (const id of ["e2e", "e2e-j000", "perf"]) {
      const refusal = lines.find((line) => line.startsWith(`GATE ${id} REFUSED`)) ?? "";
      expect(refusal, `${id} is refused by name, naming the port`).toMatch(new RegExp(`\\b${e2e}\\b`));
      expect(refusal, `${id}'s refusal says who holds the port`).toContain(attribute(e2e));
      expect(refusal, `${id}'s refusal says what it saved the session from`).toContain("EADDRINUSE");
    }
    expect(code, "a refused lane is a red gate").toBe(1);
  });
});

describe("the logs survive the gate (session 4 handoff § 7 item 6)", () => {
  /** The path the GATE line names for one lane's log, run with an injected runner. */
  async function loggedAt(out?: string): Promise<string> {
    const lines: string[] = [];
    await gate({ only: "verify", out, write: (line) => lines.push(line.trimEnd()), probe: allFree, attribute, run: async () => 0 });
    return lines.find((line) => line.startsWith("GATE verify green")) ?? "";
  }

  test("the default log directory is outside everything the journey lane cleans", () => {
    // Asked of the cleaner itself, not of a list kept here: the logs lived under `test-results/`,
    // which `pnpm e2e:clean` and the e2e lanes take — so the verify, checkup, golden and db logs the
    // summary cites were gone by the time it cited them, and a red db lane had to be run again alone.
    const root = mkdtempSync(join(tmpdir(), "cubit-gate-logs-"));
    try {
      mkdirSync(join(root, "test-results"), { recursive: true });
      mkdirSync(join(root, DEFAULT_LOG_DIR), { recursive: true });
      const taken = sweepable(root).filter((target) => target.take).map((target) => target.name);
      expect(taken, "the sweep no longer takes test-results/ — this test proves nothing about the move").toContain("test-results");
      expect(
        taken.filter((name) => DEFAULT_LOG_DIR === name || DEFAULT_LOG_DIR.startsWith(`${name}${sep}`)),
        "the gate writes its logs into a directory its own lanes delete",
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the GATE line names the log's path, and --out still wins", async () => {
    expect(await loggedAt(), "the default log path is no longer the one the GATE line names").toContain(join(DEFAULT_LOG_DIR, "verify.log"));

    const asked = await loggedAt(join("test-results", "gate-test"));
    expect(asked, "--out no longer decides where a lane's log goes").toContain(join("test-results", "gate-test", "verify.log"));
    expect(asked, "--out was asked for and the default answered").not.toContain(DEFAULT_LOG_DIR);
  });
});
