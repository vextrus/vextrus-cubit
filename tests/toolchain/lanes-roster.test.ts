// AC2 — the roster is derived, never frozen. `scripts/lib/lanes.mjs` is the one exported home
// (ARCH-02) and its answer is a function of the tree under `rootDir` and of nothing else.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const LANES_MODULE = "scripts/lib/lanes.mjs";

/** The closed lane-id set (increment spec, test contract). */
const CLOSED_LANE_IDS = ["typegen", "types", "lint", "unit", "schema-drift", "method-hash", "catalogue-drift", "cad", "build"];
/** Armed by the toolchain's own inputs, which this increment plants and no later one removes. */
const ARMED_TODAY = ["lint", "types", "unit"];

/**
 * Test-contract data beside the closed lane set: for each lane, hand-written witness files that
 * satisfy the input root that lane waits on. The test plants these and is therefore the source of
 * truth about the tree it asks deriveLanes about — no matcher of the product's lives here. Lanes
 * whose probe is a glob carry the known boundary shapes per Q-01: the zero-directory-depth witness
 * and a nested one, so a matcher that only handles one of them cannot pass.
 */
const WITNESSES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  typegen: ["src/app/page.tsx"],
  types: ["tsconfig.json"],
  lint: ["eslint.config.mjs"],
  unit: ["tests/roster.test.ts", "tests/toolchain/nested/roster.test.ts"],
  "schema-drift": ["db/schema.ts"],
  "method-hash": ["src/x.methods.json", "src/modules/billing/hours.methods.json"],
  "catalogue-drift": ["db/catalogue/bears.json"],
  cad: ["cad/pyproject.toml"],
  build: ["src/app/page.tsx"],
});

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

const scratches: string[] = [];
afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

function scratchRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "cubit-roster-"));
  scratches.push(dir);
  return dir;
}

/**
 * Plant one witness file under a scratch root; returns the top-level entry that undoes it, so the
 * root can be returned to the state it started in.
 */
function plantWitness(root: string, witness: string): string {
  const segments = witness.split("/");
  const head = segments[0];
  expect(head, `the witness ${witness} names no path`).toBeTruthy();
  const target = join(root, ...segments);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "");
  return join(root, head ?? witness);
}

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

  test("AC2: every lane in the closed set is owed a planted witness", () => {
    const unwitnessed = CLOSED_LANE_IDS.filter((id) => (WITNESSES[id] ?? []).length === 0);
    expect(unwitnessed, "a lane has no witness — the table beside CLOSED_LANE_IDS moves with the roster").toEqual([]);
  });

  test.each(CLOSED_LANE_IDS.flatMap((id) => (WITNESSES[id] ?? []).map((witness) => [id, witness] as const)))(
    "AC2: %s records its skip until %s exists, and arms the moment it does",
    async (id, witness) => {
      const root = scratchRoot();
      const before = (await deriveLanes(root)).find((lane) => lane.id === id);
      expect(before?.status, `${id} is armed on a root that has no ${witness}`).toBe("stub");

      const planted = plantWitness(root, witness);
      const after = (await deriveLanes(root)).find((lane) => lane.id === id);
      expect(after?.status, `${id} still records a skip although ${witness} now exists (probe: ${String(before?.probe)})`).toBe("armed");
      expect(after?.probe, `${id} changed the input root it names once it was armed`).toBe(before?.probe);

      rmSync(planted, { recursive: true, force: true });
      const restored = (await deriveLanes(root)).find((lane) => lane.id === id);
      expect(restored?.status, `${id} stayed armed after ${witness} was removed — its status is not the truth about the tree`).toBe("stub");
    },
  );

  test("AC2: on this tree a literal probe's status is what the platform sees at that path", async () => {
    const literal = (await deriveLanes(REPO_ROOT)).filter((lane) => !lane.probe.includes("*"));
    expect(literal.length, "no lane names a literal input root — nothing to check against the filesystem").toBeGreaterThan(0);
    const lies = literal
      .filter((lane) => (lane.status === "armed") !== existsSync(join(REPO_ROOT, ...lane.probe.split("/"))))
      .map((lane) => `${lane.id} is ${lane.status} but ${lane.probe} ${lane.status === "armed" ? "is missing" : "exists"}`);
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
