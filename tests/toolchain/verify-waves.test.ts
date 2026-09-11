// The chain's waves (V-VERIFY, C-06). The exit code is still the whole contract, and the two things
// concurrency could quietly cost are proved here rather than read: that every lane is still
// announced exactly once, and that a red lane no longer hides its siblings' verdicts — the engine
// reads all of them. Driven with an injected runner, so a green tree still proves the red paths.
import { describe, expect, test } from "vitest";
import { LANE_COMMANDS, LANE_ENV, planWaves, runChainInWaves } from "../../scripts/verify.mjs";

const VERIFY_ORDER = ["typegen", "types", "lint", "unit", "schema-drift", "method-hash", "catalogue-drift", "golden", "cad", "build"];

interface Lane {
  id: string;
  status: "armed" | "stub";
  probe: string;
}

const fullyArmed = (): Lane[] => VERIFY_ORDER.map((id) => ({ id, status: "armed" as const, probe: `input/${id}` }));

interface Trace {
  lines: string[];
  announced: string[];
  ran: string[][];
  envs: Map<string, Record<string, string> | undefined>;
}

async function drive(lanes: Lane[], exitCodes: Record<string, number> = {}): Promise<{ code: number; trace: Trace }> {
  const trace: Trace = { lines: [], announced: [], ran: [], envs: new Map() };
  const code = await runChainInWaves(lanes, {
    report: (lane) => {
      trace.announced.push(lane.id);
      trace.lines.push(lane.status === "armed" ? `RUN ${lane.id}` : `SKIP ${lane.id} missing=${lane.probe}`);
      return lane.status === "armed";
    },
    exec: async (argv, env, label) => {
      trace.ran.push(argv);
      trace.envs.set(label ?? "", env);
      return exitCodes[label ?? ""] ?? 0;
    },
    write: (line) => trace.lines.push(line.trimEnd()),
  });
  return { code, trace };
}

describe("verify gates its independent lanes at once, and answers for every one of them", () => {
  test("typegen stands alone in front, build alone at the back, and everything else gates together", () => {
    expect(planWaves(fullyArmed()).map((wave) => wave.map((lane) => lane.id))).toEqual([
      ["typegen"],
      ["types", "lint", "unit", "schema-drift", "method-hash", "catalogue-drift", "cad"],
      ["build"],
    ]);
  });

  test("an all-armed roster announces every lane exactly once, in roster order, and exits 0", async () => {
    const { code, trace } = await drive(fullyArmed());
    expect(code).toBe(0);
    expect(trace.announced).toEqual(VERIFY_ORDER);
    expect(trace.lines.filter((line) => line.startsWith("FAIL"))).toEqual([]);
    expect(trace.ran).toEqual(VERIFY_ORDER.flatMap((id) => LANE_COMMANDS[id] ?? []));
  });

  test("a red lane does not silence its siblings — every verdict of the wave is reported", async () => {
    const { code, trace } = await drive(fullyArmed(), { lint: 3, cad: 4 });
    expect(code, "the first failure in roster order is the chain's code").toBe(3);
    expect(trace.lines).toContain("FAIL lint exit=3");
    expect(trace.lines, "a lane that failed beside another had no verdict reported").toContain("FAIL cad exit=4");
    // The whole wave ran; only the wave behind it was spared.
    expect(trace.announced).toEqual(VERIFY_ORDER.filter((id) => id !== "build"));
  });

  test("a wave that came back red ends the chain — the build is never announced or run", async () => {
    const { trace } = await drive(fullyArmed(), { types: 1 });
    expect(trace.announced).not.toContain("build");
    expect(trace.ran, "the build ran after a red lane").not.toContainEqual(LANE_COMMANDS["build"]?.[0]);
  });

  test("typegen failing spares every lane behind it", async () => {
    const { code, trace } = await drive(fullyArmed(), { typegen: 2 });
    expect(code).toBe(2);
    expect(trace.announced).toEqual(["typegen"]);
  });

  test("a stub lane is a recorded skip and nothing of it runs, however it is waved", async () => {
    const { code, trace } = await drive([
      { id: "types", status: "armed", probe: "tsconfig.json" },
      { id: "cad", status: "stub", probe: "cad" },
      { id: "build", status: "stub", probe: "src/app" },
    ]);
    expect(code).toBe(0);
    expect(trace.lines).toContain("SKIP cad missing=cad");
    expect(trace.lines).toContain("SKIP build missing=src/app");
    expect(trace.ran.length).toBe(1);
  });

  test("only the build lane is told the chain already type-checked this tree", async () => {
    const { trace } = await drive(fullyArmed());
    const told = VERIFY_ORDER.filter((id) => trace.envs.get(id)?.["CUBIT_BUILD_SKIP_TYPECHECK"] === "1");
    expect(told, "a lane other than build was handed the build's flag").toEqual(["build"]);
    expect(LANE_ENV["build"]).toEqual({ CUBIT_BUILD_SKIP_TYPECHECK: "1" });
  });

  test("a roster entry no command can serve is refused before anything is announced", async () => {
    const lines: string[] = [];
    const code = await runChainInWaves([{ id: "not-a-lane", status: "armed", probe: "nowhere" }], {
      report: () => {
        throw new Error("an unrunnable lane must be refused before anything is announced");
      },
      exec: () => 0,
      write: (line) => lines.push(line.trimEnd()),
    });
    expect(code).not.toBe(0);
    expect(lines.join("\n")).toContain("not-a-lane");
  });
});
