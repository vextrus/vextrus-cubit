// AC2 — the roster is derived, never frozen. `scripts/lib/lanes.mjs` is the one exported home
// (ARCH-02) and its answer is a function of the tree under `rootDir` and of nothing else.
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const LANES_MODULE = "scripts/lib/lanes.mjs";

/** The closed lane-id set (increment spec, test contract). */
const CLOSED_LANE_IDS = ["typegen", "types", "lint", "unit", "schema-drift", "method-hash", "catalogue-drift", "cad", "build"];
/** Armed by the toolchain's own inputs, which this increment plants and no later one removes. */
const ARMED_TODAY = ["lint", "types", "unit"];

interface Lane {
  id: string;
  status: string;
  probe: string;
}

async function importModule(absolutePath: string): Promise<Record<string, unknown>> {
  const loaded: unknown = await import(pathToFileURL(absolutePath).href);
  return loaded as Record<string, unknown>;
}

async function deriveLanes(rootDir: string): Promise<Lane[]> {
  const abs = join(REPO_ROOT, LANES_MODULE);
  expect(existsSync(abs), `${LANES_MODULE} does not exist — the roster has no exported home`).toBe(true);
  const mod = await importModule(abs);
  const derive = mod["deriveLanes"] as ((root: string) => Lane[] | Promise<Lane[]>) | undefined;
  expect(typeof derive, `${LANES_MODULE} does not export deriveLanes(rootDir)`).toBe("function");
  const lanes = await Promise.resolve(derive!(rootDir));
  expect(Array.isArray(lanes), "deriveLanes did not return an array").toBe(true);
  return lanes;
}

/** Does the probe input exist? A probe naming a glob is satisfied by any file matching it. */
function probeExists(root: string, probe: string): boolean {
  const normalised = probe.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!normalised.includes("*")) return existsSync(join(root, ...normalised.split("/")));
  const prefix = normalised.slice(0, normalised.indexOf("*"));
  const base = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/")) : "";
  const start = base ? join(root, ...base.split("/")) : root;
  if (!existsSync(start)) return false;
  const pattern = new RegExp(
    `^${normalised
      .split("/")
      .map((segment) => (segment === "**" ? "@@" : segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")))
      .join("/")
      .replace(/@@\//g, "(?:.*/)?")
      .replace(/@@/g, ".*")}$`,
  );
  const stack = [start];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const rel = abs.slice(root.length + 1).split(sep).join("/");
      if (pattern.test(rel)) return true;
      if (statSync(abs).isDirectory()) stack.push(abs);
    }
  }
  return false;
}

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

describe("AC2: deriveLanes is the one derived roster", () => {
  test("AC2: the roster covers exactly the closed lane set", async () => {
    const lanes = await deriveLanes(REPO_ROOT);
    expect([...lanes.map((lane) => lane.id)].sort()).toEqual([...CLOSED_LANE_IDS].sort());
  });

  test("AC2: every entry is {id, status: 'armed'|'stub', probe} with a repo-relative probe", async () => {
    for (const lane of await deriveLanes(REPO_ROOT)) {
      expect(["armed", "stub"], `${lane.id} has status ${String(lane.status)}`).toContain(lane.status);
      expect(typeof lane.probe, `${lane.id} has no probe path`).toBe("string");
      expect(lane.probe.length, `${lane.id} has an empty probe path`).toBeGreaterThan(0);
      expect(lane.probe.startsWith("/"), `${lane.id}'s probe ${lane.probe} is not repo-relative`).toBe(false);
    }
  });

  test("AC2: a lane's status is the truth about its own probe input", async () => {
    const lies = (await deriveLanes(REPO_ROOT))
      .filter((lane) => (lane.status === "armed") !== probeExists(REPO_ROOT, lane.probe))
      .map((lane) => `${lane.id} is ${lane.status} but its probe ${lane.probe} ${probeExists(REPO_ROOT, lane.probe) ? "exists" : "is missing"}`);
    expect(lies, "a lane's status contradicts the tree it was derived from").toEqual([]);
  });

  test("AC2: the toolchain's own inputs arm types, lint and unit on this tree", async () => {
    const lanes = await deriveLanes(REPO_ROOT);
    const armed = lanes.filter((lane) => lane.status === "armed").map((lane) => lane.id);
    for (const id of ARMED_TODAY) {
      const lane = lanes.find((entry) => entry.id === id);
      expect(lane?.status, `${id} is not armed although this increment plants its input (armed: ${armed.join(", ") || "none"})`).toBe("armed");
    }
  });

  test("AC2: a root without the inputs arms nothing — the tree decides", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "cubit-roster-"));
    scratches.push(scratch);
    const armed = (await deriveLanes(scratch)).filter((lane) => lane.status === "armed").map((lane) => lane.id);
    expect(armed, `lanes armed on an empty root at ${scratch}`).toEqual([]);
  });

  test("AC2: no environment variable can change a status", async () => {
    const before = await deriveLanes(REPO_ROOT);
    const hostile = ["CI", "LANES", "CUBIT_LANES", "SKIP_LANES", "SKIP", "FORCE_LANES", "ARM_LANES", "VERIFY_LANES", "ARMED", "NODE_ENV"];
    const saved = new Map(hostile.map((name) => [name, process.env[name]]));
    try {
      for (const name of hostile) process.env[name] = "typegen,build,cad,schema-drift,method-hash,catalogue-drift";
      expect(await deriveLanes(REPO_ROOT), "an environment variable moved a lane's status").toEqual(before);
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
