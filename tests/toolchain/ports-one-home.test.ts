// The served ports have ONE home, scripts/lib/ports.mjs (ARCH-02). Session 7 found five spellings of
// the journeys' port — the gate's own list (frozen again by its test), the probe server's default
// under a probe-only variable, the probe's origin under a second one, the journeys' server's `--port`
// default — and three probes for "is it held?", one of which (`ss`) cannot see a port Windows holds
// under WSL2 mirrored networking. This file keeps it at one: no other script, no Playwright config
// and no journey spells a served port, and the lanes that ask whether a port is held do not bind one
// of their own — they ask scripts/lib/port-probe.mjs.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { PORTS, originFor, portFor, servedPorts } from "../../scripts/lib/ports.mjs";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const HOME = "scripts/lib/ports.mjs";

/** A served port as source spells it: 3210 to 3213 (the app, the journeys, the dev worker's health, the demo). */
const SERVED_PORT = /\b32(1[0-3])\b/;

/** Every file under `dir` (relative to the root) whose name matches `name`, as root-relative paths. */
function filesUnder(dir: string, name: RegExp): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && name.test(entry.name))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)).replace(/\\/g, "/"));
}

/**
 * Where a second spelling would do harm: every script (the lanes, the probe, the servers — `.mjs`,
 * and the `.sh` and `.ts` tools beside them), the journey runner's config, and the journeys.
 */
function scanned(): string[] {
  return [...filesUnder("scripts", /\.(?:mjs|ts|sh)$/), "playwright.config.ts", ...filesUnder("tests/e2e", /\.(?:ts|tsx|mjs|js|json)$/)]
    .filter((file) => file !== HOME)
    .sort();
}

describe("the served ports are spelled once", () => {
  test("the home spells every port the scan looks for, so the scan can see a second spelling", () => {
    for (const port of Object.values(PORTS)) expect(String(port), `${HOME} names ${port}, which the scan's pattern would not catch`).toMatch(SERVED_PORT);
    expect(readFileSync(join(ROOT, HOME), "utf8")).toMatch(SERVED_PORT);
  });

  test("no script, Playwright config or journey spells a served port outside scripts/lib/ports.mjs", () => {
    const files = scanned();
    expect(files.length, "the scan read nothing — it would pass any tree").toBeGreaterThan(100);
    expect(files, "the scan no longer reads the lanes it exists for").toEqual(expect.arrayContaining(["scripts/gate.mjs", "scripts/checkup.mjs", "scripts/dev.mjs", "scripts/e2e-server.mjs", "scripts/probe/server.mjs", "scripts/probe/probe.mjs"]));
    const spelled = files.flatMap((file) =>
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .flatMap((line, at) => (SERVED_PORT.test(line) ? [`${file}:${at + 1}: ${line.trim()}`] : [])),
    );
    expect(spelled, `a served port spelled outside ${HOME} — ask portFor/servedPorts/originFor instead`).toEqual([]);
  });

  test("the gate, the checkup and the dev lane bind no port of their own — they ask scripts/lib/port-probe.mjs", () => {
    for (const file of ["scripts/gate.mjs", "scripts/checkup.mjs", "scripts/dev.mjs"]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source, `${file} builds a server of its own to probe a port`).not.toMatch(/\bcreateServer\b/);
      expect(source, `${file} binds a port of its own`).not.toMatch(/\.listen\(/);
      expect(source, `${file} does not ask the one probe`).toMatch(/from "\.\/lib\/port-probe\.mjs"/);
    }
  });
});

describe("what the home answers", () => {
  const NAMES = ["PORT", "E2E_PORT", "DEMO_PORT"] as const;
  const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
  afterEach(() => {
    for (const name of NAMES) {
      const value = saved[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test("servedPorts is the app's, the journeys' and the demo's port; each moves by its own variable", () => {
    for (const name of NAMES) delete process.env[name];
    expect(servedPorts()).toEqual([PORTS.app, PORTS.e2e, PORTS.demo]);
    process.env["PORT"] = "4100";
    process.env["E2E_PORT"] = "4101";
    process.env["DEMO_PORT"] = "4103";
    expect(servedPorts()).toEqual([4100, 4101, 4103]);
    process.env["DEMO_PORT"] = "not-a-port";
    expect(portFor("demo"), "a variable that names no port leaves the stated one").toBe(PORTS.demo);
  });

  test("an origin is 127.0.0.1, never localhost — Windows tries ::1 first", () => {
    process.env["E2E_PORT"] = "4101";
    expect(originFor("e2e")).toBe("http://127.0.0.1:4101");
  });
});
