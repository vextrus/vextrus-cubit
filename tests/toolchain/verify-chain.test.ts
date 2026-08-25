// The exit code is the whole contract (V-VERIFY, C-06). verify's chain is driven here with an
// injected runner, so the paths a green tree can never reach — an armed lane failing, the chain
// stopping at it, a roster entry nothing can run — are proven rather than read.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { LANE_COMMANDS, runChain } from "../../scripts/verify.mjs";
import { deriveLanes } from "../../scripts/lib/lanes.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

/** V-VERIFY names the chain's order; the roster yields it. */
const VERIFY_ORDER = ["typegen", "types", "lint", "unit", "schema-drift", "method-hash", "catalogue-drift", "cad", "build"];

interface Lane {
  id: string;
  status: "armed" | "stub";
  probe: string;
}

/** A roster of armed lanes, in V-VERIFY order, standing in for a tree that has every input. */
function fullyArmed(): Lane[] {
  return VERIFY_ORDER.map((id) => ({ id, status: "armed", probe: `input/${id}` }));
}

interface Trace {
  lines: string[];
  announced: string[];
  ran: string[][];
}

/** Drive the chain, recording what it announced and what it executed. */
function drive(lanes: Lane[], exitCodes: Record<string, number> = {}): { code: number; trace: Trace } {
  const trace: Trace = { lines: [], announced: [], ran: [] };
  let current = "";
  const code = runChain(lanes, {
    report: (lane) => {
      current = lane.id;
      trace.announced.push(lane.id);
      trace.lines.push(lane.status === "armed" ? `RUN ${lane.id}` : `SKIP ${lane.id} missing=${lane.probe}`);
      return lane.status === "armed";
    },
    exec: (argv) => {
      trace.ran.push(argv);
      return exitCodes[current] ?? 0;
    },
    write: (line) => trace.lines.push(line.trimEnd()),
  });
  return { code, trace };
}

describe("verify's chain is fail-fast and its exit code is the contract", () => {
  test("every lane the roster can yield has a command — none can pass silently", () => {
    const orphans = deriveLanes(REPO_ROOT)
      .filter((lane) => LANE_COMMANDS[lane.id] === undefined)
      .map((lane) => lane.id);
    expect(orphans, "a lane with no command would be announced and then quietly skipped").toEqual([]);
  });

  test("an all-armed roster runs every lane in V-VERIFY order and exits 0", () => {
    const { code, trace } = drive(fullyArmed());
    expect(code).toBe(0);
    expect(trace.announced).toEqual(VERIFY_ORDER);
    expect(trace.lines.filter((line) => line.startsWith("FAIL"))).toEqual([]);
  });

  test("the first failing armed lane ends the chain — no later lane is announced or run", () => {
    const { code, trace } = drive(fullyArmed(), { lint: 3 });
    expect(code, "the failing lane's code is the chain's code").toBe(3);
    expect(trace.announced, "the chain announced a lane after the failure").toEqual(["typegen", "types", "lint"]);
    expect(trace.lines.at(-1)).toBe("FAIL lint exit=3");
  });

  test("a stub lane is announced as a recorded skip and nothing of it runs", () => {
    const lanes: Lane[] = [
      { id: "types", status: "armed", probe: "tsconfig.json" },
      { id: "cad", status: "stub", probe: "cad" },
      { id: "build", status: "stub", probe: "src/app" },
    ];
    const { code, trace } = drive(lanes);
    expect(code).toBe(0);
    expect(trace.lines).toContain("SKIP cad missing=cad");
    expect(trace.lines).toContain("SKIP build missing=src/app");
    expect(trace.ran.length, "a stub lane executed something").toBe(1);
  });

  test("a stub lane whose armed sibling fails still never runs — the skip is not a fallback", () => {
    const lanes: Lane[] = [
      { id: "types", status: "armed", probe: "tsconfig.json" },
      { id: "lint", status: "stub", probe: "eslint.config.mjs" },
    ];
    const { code, trace } = drive(lanes, { types: 1 });
    expect(code).toBe(1);
    expect(trace.announced).toEqual(["types"]);
  });

  test("a roster entry no command can serve is refused loudly, not passed", () => {
    const trace: string[] = [];
    const code = runChain([{ id: "not-a-lane", status: "armed", probe: "nowhere" }], {
      report: () => {
        throw new Error("an unrunnable lane must be refused before anything is announced");
      },
      exec: () => 0,
      write: (line) => trace.push(line.trimEnd()),
    });
    expect(code, "an unrunnable lane exited 0").not.toBe(0);
    expect(trace.join("\n")).toContain("not-a-lane");
  });

  test("the chain executes exactly the commands its own table names", () => {
    const { trace } = drive(fullyArmed());
    const expected = VERIFY_ORDER.flatMap((id) => LANE_COMMANDS[id] ?? []);
    expect(trace.ran).toEqual(expected);
  });
});
