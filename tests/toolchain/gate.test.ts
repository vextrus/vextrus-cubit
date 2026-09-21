// The gate as one command (scripts/gate.mjs; C-06, V-DB). What is worth proving is the DISCIPLINE
// session 3 kept by hand: the lanes run one after another in a fixed order, the db lane never runs
// beside a served product, a red lane silences no later lane, and the exit code is the first red's.
// Driven with an injected runner and an injected port reading, so a green tree proves the red paths.
import { describe, expect, test } from "vitest";
import { GATE_LANES, SERVED_PORTS, gate, heldPorts, selectLanes } from "../../scripts/gate.mjs";

const ORDER = ["verify", "checkup", "golden", "db", "e2e", "e2e-j000", "perf"];

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
    expect([...SERVED_PORTS]).toEqual([3210, 3211]);
  });
});

describe("what the kernel says about the served ports", () => {
  test("a listener on 3211 is read as held; other ports are not; a box that cannot answer reads as free", () => {
    const listening = { status: 0, stdout: "State  Recv-Q Send-Q Local Address:Port  Peer Address:Port\nLISTEN 0 511 127.0.0.1:3211 0.0.0.0:*\nLISTEN 0 511 *:5544 *:*\n" };
    expect(heldPorts(() => listening)).toEqual([3211]);
    expect(heldPorts(() => ({ status: 0, stdout: "LISTEN 0 511 *:5544 *:*\n" }))).toEqual([]);
    expect(heldPorts(() => ({ status: 1, stdout: "" }))).toEqual([]);
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
      ports: () => [],
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
    const ran: string[] = [];
    const lines: string[] = [];
    const code = await gate({
      only: "db,perf",
      out: "test-results/gate-test",
      write: (line) => lines.push(line.trimEnd()),
      ports: () => [3211],
      run: async (lane) => {
        ran.push(lane.id);
        return 0;
      },
    });
    expect(ran, "the db lane never started").toEqual(["perf"]);
    expect(lines.some((line) => line.startsWith("GATE db REFUSED") && line.includes("3211") && line.includes("V-DB"))).toBe(true);
    expect(code, "a refused lane is a red gate").toBe(1);
  });
});
